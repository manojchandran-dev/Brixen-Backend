const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const prefixedId = require('../../utils/prefixedId');
const { dateIn, parseDay } = require('../../utils/timezone');
const { sendPayslipEmail } = require('../../utils/mailer');
const { companyTz } = require('../attendance/service');
const { LABEL } = require('../employees/salary');
const { monthRange, weekRange, periodLabel, workingDaysIn, payFor, round2 } = require('./calc');

// Salary generation: a run per company per period -- a month, or a week
// (Monday to Sunday) -- with a payslip per employee with a salary type
// (active, or anyone with attendance in it). An employee already paid by
// another run covering any of the same days is left out, so nobody is paid
// twice for a day. A DRAFT run can be generated again (additions,
// deductions and notes are kept per employee) and its payslips adjusted;
// FINALIZED locks it, lets payslips be emailed and counts it in the salary
// report. Reopen to change it again.

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

// The period a request names: ?week_start= (a Monday) for a week, else
// ?month= (YYYY-MM). key = the run's month column.
function resolvePeriod(input) {
  if (input.week_start !== undefined && input.week_start !== null && input.week_start !== '') {
    const week = weekRange(String(input.week_start));
    if (!week) throw new PayrollError('week_start must be a Monday as YYYY-MM-DD');
    const month = week.from.slice(0, 7);
    return { key: week.from, period_type: 'WEEK', ...week, month, monthDays: monthRange(month).days };
  }
  const range = monthRange(input.month);
  if (!range) throw new PayrollError('Pick a month (YYYY-MM) or a week');
  return { key: input.month, period_type: 'MONTH', from: range.from, to: range.to, month: input.month, monthDays: range.days };
}

function shapeRun(run) {
  return {
    id: run.id,
    month: run.month,
    period_type: run.period_type ?? 'MONTH',
    label: periodLabel(run.month),
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
    period_type: run?.period_type ?? 'MONTH',
    period_label: run ? periodLabel(run.month) : null,
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
    orderBy: { period_from: 'desc' },
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

// The period's default working days (its month less Sundays: what a monthly
// salary is divided by) and its run if any, for the generate screen.
// ?month=YYYY-MM or ?week_start=YYYY-MM-DD (a Monday).
async function preview(company_id, query) {
  const p = resolvePeriod(query);
  const existing = await prisma.payroll_runs.findFirst({ where: { company_id, month: p.key }, select: { id: true, status: true } });
  return { ...p, label: periodLabel(p.key), working_days: workingDaysIn(p.month), run: existing };
}

// Works out (again) the period's payslips. body: { month: "YYYY-MM" } or
// { week_start: "YYYY-MM-DD" (a Monday) }, working_days?: 1-31 (a monthly
// salary's divisor; default its month less Sundays). The response adds
// `skipped`: employees left out because another run already pays them for
// some of these days.
async function generate(company_id, user_id, body) {
  const p = resolvePeriod(body);
  const label = periodLabel(p.key);
  const today = dateIn(await companyTz(company_id));
  if (p.from > today) throw new PayrollError(`Salary can't be generated for ${label}: it hasn't started`);

  let working_days = workingDaysIn(p.month);
  if (body.working_days !== undefined && body.working_days !== null && body.working_days !== '') {
    working_days = Number(body.working_days);
    if (!Number.isInteger(working_days) || working_days < 1 || working_days > p.monthDays) {
      throw new PayrollError(`Working days must be a whole number from 1 to ${p.monthDays}`);
    }
  }

  const existing = await prisma.payroll_runs.findFirst({
    where: { company_id, month: p.key },
    include: { payslips: { select: { employee_id: true, additions: true, deductions: true, notes: true } } },
  });
  if (existing?.status === FINALIZED) {
    throw new PayrollError(`${label} is already confirmed. Tap Edit again to generate it again`, 409);
  }

  const from = parseDay(p.from);
  const to = parseDay(p.to);
  // Paid by another run that covers any of these days: left out.
  const paidElsewhere = await prisma.payslips.findMany({
    where: {
      company_id,
      ...(existing ? { run_id: { not: existing.id } } : {}),
      payroll_runs: { period_from: { lte: to }, period_to: { gte: from } },
    },
    select: { employee_id: true, payroll_runs: { select: { month: true } }, employees: EMPLOYEE },
  });
  const paidBy = new Map(paidElsewhere.map((s) => [s.employee_id, s]));
  const records = await prisma.attendance.findMany({
    where: { company_id, work_date: { gte: from, lte: to } },
    include: { shifts: true, pieces: { include: { work_types: { select: { name: true } } } } },
  });
  // Lots delivered in the period (piece work counted at delivery).
  const lots = await prisma.piece_lots.findMany({
    where: { company_id, lot_date: { gte: from, lte: to } },
    include: { work_types: { select: { name: true } } },
  });
  const lotsBy = new Map();
  for (const l of lots) {
    if (!lotsBy.has(l.employee_id)) lotsBy.set(l.employee_id, []);
    lotsBy.get(l.employee_id).push(l);
  }
  const byEmployee = new Map();
  for (const r of records) {
    if (!byEmployee.has(r.employee_id)) byEmployee.set(r.employee_id, []);
    byEmployee.get(r.employee_id).push(r);
  }
  const candidates = await prisma.employees.findMany({
    where: {
      company_id,
      salary_type: { not: null },
      OR: [{ status: 'Active' }, { id: { in: [...byEmployee.keys(), ...lotsBy.keys()] } }],
    },
    select: { id: true, salary_type: true, salary: true },
  });
  if (!candidates.length) {
    throw new PayrollError('No employees with a salary type. Set salary types in Employees first');
  }
  const employees = candidates.filter((e) => !paidBy.has(e.id));
  const skipped = candidates
    .filter((e) => paidBy.has(e.id))
    .map((e) => {
      const s = paidBy.get(e.id);
      return { employee_id: e.id, name: fullName(s.employees), paid_in: periodLabel(s.payroll_runs.month) };
    });
  if (!employees.length) {
    throw new PayrollError(`Everyone is already paid for these days (in ${[...new Set(skipped.map((s) => s.paid_in))].join(', ')})`, 409);
  }

  const kept = new Map((existing?.payslips ?? []).map((p) => [p.employee_id, p]));
  const run_id = existing?.id ?? prefixedId('PRUN');
  const slips = employees.map((e) => {
    const pay = payFor(e, byEmployee.get(e.id) ?? [], working_days, lotsBy.get(e.id) ?? []);
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
          data: {
            id: run_id,
            company_id,
            month: p.key,
            period_type: p.period_type,
            period_from: from,
            period_to: to,
            working_days,
            created_by: user_id,
          },
        });
      }
      await tx.payslips.createMany({ data: slips });
      await refreshTotals(tx, run_id);
    });
  } catch (err) {
    // Generated by someone else at the same moment.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PayrollError(`Salary for ${label} is being generated already. Refresh and try again`, 409);
    }
    throw err;
  }
  return { ...(await getRun(run_id, company_id)), skipped };
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
  if (run.status === FINALIZED) throw new PayrollError(`${periodLabel(run.month)} is already confirmed`, 409);
  const count = await prisma.payslips.count({ where: { run_id: id } });
  if (!count) throw new PayrollError('There are no payslips to finalize. Generate again');
  await prisma.payroll_runs.update({ where: { id }, data: { status: FINALIZED, finalized_at: new Date(), updated_at: new Date() } });
  return getRun(id, company_id);
}

async function reopen(id, company_id) {
  const run = await findRun(id, company_id);
  if (run.status !== FINALIZED) throw new PayrollError(`${periodLabel(run.month)} isn't confirmed`, 409);
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
    orderBy: [{ payroll_runs: { period_from: 'desc' } }, { net: 'desc' }],
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
