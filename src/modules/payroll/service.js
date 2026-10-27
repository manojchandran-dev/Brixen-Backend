const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const prefixedId = require('../../utils/prefixedId');
const { dateIn, parseDay } = require('../../utils/timezone');
const { sendPayslipEmail } = require('../../utils/mailer');
const { companyTz } = require('../attendance/service');
const { LABEL } = require('../employees/salary');
const { monthRange, workingDaysIn, payFor, round2 } = require('./calc');

// Salary generation: one run per company per month, a payslip per employee
// with a salary type (active, or anyone with attendance that month). A DRAFT
// run can be generated again (additions, deductions and notes are kept per
// employee) and its payslips adjusted; FINALIZED locks it, lets payslips be
// emailed and counts it in the salary report. Reopen to change it again.

class PayrollError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const DRAFT = 'DRAFT';
const FINALIZED = 'FINALIZED';
const MAX_ADJUSTMENT = 99999999;

const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');
const ymd = (d) => (d ? d.toISOString().slice(0, 10) : null);

const EMPLOYEE = {
  select: {
    id: true,
    employee_code: true,
    first_name: true,
    last_name: true,
    email: true,
    department: true,
    designation: true,
  },
};

function shapeRun(run) {
  return {
    id: run.id,
    month: run.month,
    period_from: ymd(run.period_from),
    period_to: ymd(run.period_to),
    working_days: run.working_days,
    status: run.status,
    total_gross: Number(run.total_gross),
    total_net: Number(run.total_net),
    finalized_at: run.finalized_at,
    created_at: run.created_at,
    payslip_count: run._count?.payslips ?? run.payslips?.length ?? 0,
  };
}

function shapeSlip(p, run = p.payroll_runs) {
  const e = p.employees;
  return {
    id: p.id,
    run_id: p.run_id,
    month: run?.month ?? null,
    period_from: ymd(run?.period_from),
    period_to: ymd(run?.period_to),
    working_days: run?.working_days ?? null,
    status: run?.status ?? null,
    employee: e
      ? {
          id: e.id,
          employee_code: e.employee_code,
          name: fullName(e),
          email: e.email,
          department: e.department,
          designation: e.designation,
        }
      : null,
    salary_type: p.salary_type,
    rate: p.rate === null ? null : Number(p.rate),
    units: Number(p.units),
    days_present: Number(p.days_present),
    gross: Number(p.gross),
    additions: Number(p.additions),
    deductions: Number(p.deductions),
    net: Number(p.net),
    breakdown: p.breakdown ?? null,
    notes: p.notes,
    emailed_at: p.emailed_at,
    email_error: p.email_error,
  };
}

async function findRun(id, company_id) {
  const run = await prisma.payroll_runs.findFirst({ where: { id, company_id } });
  if (!run) throw new PayrollError('Salary run not found', 404);
  return run;
}

async function refreshTotals(tx, run_id) {
  const sums = await tx.payslips.aggregate({ where: { run_id }, _sum: { gross: true, net: true } });
  await tx.payroll_runs.update({
    where: { id: run_id },
    data: { total_gross: sums._sum.gross ?? 0, total_net: sums._sum.net ?? 0, updated_at: new Date() },
  });
}

async function listRuns(company_id) {
  const runs = await prisma.payroll_runs.findMany({
    where: { company_id },
    include: { _count: { select: { payslips: true } } },
    orderBy: { month: 'desc' },
  });
  return { items: runs.map(shapeRun) };
}

async function getRun(id, company_id) {
  const run = await prisma.payroll_runs.findFirst({
    where: { id, company_id },
    include: { payslips: { include: { employees: EMPLOYEE } } },
  });
  if (!run) throw new PayrollError('Salary run not found', 404);
  const payslips = run.payslips
    .map((p) => shapeSlip(p, run))
    .sort((a, b) => (a.employee?.name ?? '').localeCompare(b.employee?.name ?? ''));
  return { ...shapeRun(run), payslips };
}

// The month's working days by default, for the generate screen.
async function preview(company_id, month) {
  const range = monthRange(month);
  if (!range) throw new PayrollError('month must be YYYY-MM');
  const existing = await prisma.payroll_runs.findFirst({ where: { company_id, month }, select: { id: true, status: true } });
  return { month, ...range, working_days: workingDaysIn(month), run: existing };
}

// Works out (again) the month's payslips. body: { month: "YYYY-MM",
// working_days?: 1-31 }.
async function generate(company_id, user_id, body) {
  const month = body.month;
  const range = monthRange(month);
  if (!range) throw new PayrollError('Pick a month (YYYY-MM)');
  const today = dateIn(await companyTz(company_id));
  if (range.from > today) throw new PayrollError("Salary can't be generated for a month that hasn't started");

  let working_days = workingDaysIn(month);
  if (body.working_days !== undefined && body.working_days !== null && body.working_days !== '') {
    working_days = Number(body.working_days);
    if (!Number.isInteger(working_days) || working_days < 1 || working_days > range.days) {
      throw new PayrollError(`Working days must be a whole number from 1 to ${range.days}`);
    }
  }

  const existing = await prisma.payroll_runs.findFirst({
    where: { company_id, month },
    include: { payslips: { select: { employee_id: true, additions: true, deductions: true, notes: true } } },
  });
  if (existing?.status === FINALIZED) {
    throw new PayrollError(`${month} is already finalized. Reopen it to generate again`, 409);
  }

  const from = parseDay(range.from);
  const to = parseDay(range.to);
  const records = await prisma.attendance.findMany({
    where: { company_id, work_date: { gte: from, lte: to } },
    include: { shifts: true, pieces: { include: { work_types: { select: { name: true } } } } },
  });
  const byEmployee = new Map();
  for (const r of records) {
    if (!byEmployee.has(r.employee_id)) byEmployee.set(r.employee_id, []);
    byEmployee.get(r.employee_id).push(r);
  }
  const employees = await prisma.employees.findMany({
    where: {
      company_id,
      salary_type: { not: null },
      OR: [{ status: 'Active' }, { id: { in: [...byEmployee.keys()] } }],
    },
    select: { id: true, salary_type: true, salary: true },
  });
  if (!employees.length) {
    throw new PayrollError('No employees with a salary type. Set salary types in Employees first');
  }

  const kept = new Map((existing?.payslips ?? []).map((p) => [p.employee_id, p]));
  const run_id = existing?.id ?? prefixedId('PRUN');
  const slips = employees.map((e) => {
    const pay = payFor(e, byEmployee.get(e.id) ?? [], working_days);
    const before = kept.get(e.id);
    const additions = before ? Number(before.additions) : 0;
    const deductions = before ? Math.min(Number(before.deductions), pay.gross + additions) : 0;
    return {
      id: prefixedId('PSLP'),
      run_id,
      company_id,
      employee_id: e.id,
      salary_type: e.salary_type,
      rate: pay.rate,
      units: pay.units,
      days_present: pay.days_present,
      gross: pay.gross,
      additions,
      deductions,
      net: round2(pay.gross + additions - deductions),
      breakdown: pay.breakdown ?? Prisma.DbNull,
      notes: before?.notes ?? null,
    };
  });

  try {
    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.payslips.deleteMany({ where: { run_id } });
        await tx.payroll_runs.update({ where: { id: run_id }, data: { working_days, updated_at: new Date() } });
      } else {
        await tx.payroll_runs.create({
          data: { id: run_id, company_id, month, period_from: from, period_to: to, working_days, created_by: user_id },
        });
      }
      await tx.payslips.createMany({ data: slips });
      await refreshTotals(tx, run_id);
    });
  } catch (err) {
    // Generated by someone else at the same moment.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PayrollError(`Salary for ${month} is being generated already. Refresh and try again`, 409);
    }
    throw err;
  }
  return getRun(run_id, company_id);
}

const money = (v, field) => {
  if (v === undefined) return undefined;
  const n = v === null || v === '' ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_ADJUSTMENT) throw new PayrollError(`${field} must be an amount, 0 or more`);
  return round2(n);
};

// body: { additions?, deductions?, notes? } -- a draft run's payslip only.
async function updatePayslip(id, company_id, body) {
  const slip = await prisma.payslips.findFirst({ where: { id, company_id }, include: { payroll_runs: true } });
  if (!slip) throw new PayrollError('Payslip not found', 404);
  if (slip.payroll_runs.status !== DRAFT) throw new PayrollError('This month is finalized. Reopen it to make changes', 409);

  const additions = money(body.additions, 'Additions') ?? Number(slip.additions);
  const deductions = money(body.deductions, 'Deductions') ?? Number(slip.deductions);
  const gross = Number(slip.gross);
  if (deductions > gross + additions) throw new PayrollError("Deductions can't be more than the pay");
  const notes =
    body.notes === undefined ? slip.notes : typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  await prisma.$transaction(async (tx) => {
    await tx.payslips.update({
      where: { id },
      data: { additions, deductions, notes, net: round2(gross + additions - deductions), updated_at: new Date() },
    });
    await refreshTotals(tx, slip.run_id);
  });
  const fresh = await prisma.payslips.findFirst({ where: { id }, include: { employees: EMPLOYEE, payroll_runs: true } });
  return shapeSlip(fresh);
}

async function finalize(id, company_id) {
  const run = await findRun(id, company_id);
  if (run.status === FINALIZED) throw new PayrollError(`${run.month} is already finalized`, 409);
  const count = await prisma.payslips.count({ where: { run_id: id } });
  if (!count) throw new PayrollError('There are no payslips to finalize. Generate again');
  await prisma.payroll_runs.update({ where: { id }, data: { status: FINALIZED, finalized_at: new Date(), updated_at: new Date() } });
  return getRun(id, company_id);
}

async function reopen(id, company_id) {
  const run = await findRun(id, company_id);
  if (run.status !== FINALIZED) throw new PayrollError(`${run.month} isn't finalized`, 409);
  await prisma.payroll_runs.update({ where: { id }, data: { status: DRAFT, finalized_at: null, updated_at: new Date() } });
  return getRun(id, company_id);
}

async function removeRun(id, company_id) {
  const run = await findRun(id, company_id);
  if (run.status === FINALIZED) throw new PayrollError('A finalized month can\'t be deleted. Reopen it first', 409);
  await prisma.payroll_runs.delete({ where: { id } });
}

// Emails a finalized run's payslips (all, or body.payslip_ids) to the
// employees, as plain text. Returns { sent, skipped: [...], failed: [...] }.
async function send(id, company_id, body = {}) {
  const run = await findRun(id, company_id);
  if (run.status !== FINALIZED) throw new PayrollError('Finalize the month before sending payslips', 409);
  const only = Array.isArray(body.payslip_ids) && body.payslip_ids.length ? body.payslip_ids.map(String) : null;
  const [slips, company] = await Promise.all([
    prisma.payslips.findMany({
      where: { run_id: id, ...(only ? { id: { in: only } } : {}) },
      include: { employees: EMPLOYEE },
    }),
    prisma.companies.findFirst({ where: { id: company_id }, select: { company_name: true } }),
  ]);

  const result = { sent: 0, skipped: [], failed: [] };
  for (const p of slips) {
    const slip = shapeSlip(p, run);
    const name = slip.employee?.name ?? 'Employee';
    if (!slip.employee?.email) {
      result.skipped.push({ payslip_id: p.id, name, reason: 'No email address' });
      continue;
    }
    try {
      await sendPayslipEmail(slip.employee.email, { slip, typeLabel: LABEL[slip.salary_type] ?? slip.salary_type, companyName: company?.company_name });
      await prisma.payslips.update({ where: { id: p.id }, data: { emailed_at: new Date(), email_error: null } });
      result.sent++;
    } catch (err) {
      const message = String(err?.message ?? err).slice(0, 300);
      await prisma.payslips.update({ where: { id: p.id }, data: { email_error: message } });
      result.failed.push({ payslip_id: p.id, name, reason: message });
    }
  }
  return result;
}

// Finalized payslips whose month ends within ?from=&to= (YYYY-MM-DD), for
// the salary report; ?employee_id= narrows to one employee.
async function listPayslips(company_id, q = {}) {
  const from = q.from ? parseDay(q.from) : null;
  const to = q.to ? parseDay(q.to) : null;
  if ((q.from && !from) || (q.to && !to)) throw new PayrollError('Dates must be YYYY-MM-DD');
  const rows = await prisma.payslips.findMany({
    where: {
      company_id,
      ...(q.employee_id ? { employee_id: Number(q.employee_id) || -1 } : {}),
      payroll_runs: {
        status: FINALIZED,
        ...(from || to ? { period_to: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
    },
    include: { employees: EMPLOYEE, payroll_runs: true },
    orderBy: [{ payroll_runs: { month: 'desc' } }, { net: 'desc' }],
    take: 5000,
  });
  return { items: rows.map((p) => shapeSlip(p)) };
}

module.exports = {
  PayrollError,
  listRuns,
  getRun,
  preview,
  generate,
  updatePayslip,
  finalize,
  reopen,
  removeRun,
  send,
  listPayslips,
  shapeSlip,
  FINALIZED,
};
