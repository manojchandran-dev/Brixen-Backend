const { Router } = require('express');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const { parseDay } = require('../../utils/timezone');
const { PayrollError, resolvePeriod } = require('./service');
const { periodLabel, workingDaysIn, payFor, round2 } = require('./calc');

// What the Salary screen shows before (and beside) making salary:
//   GET /summary -- each employee's work in a month or week: days present,
//     absent, shifts, hours, pieces (piece pay), and their pay so far.
//   GET /sales   -- what sold, day by day and product by product (combos
//     counted in pieces), so piece pay can be entered from it.
// Mounted at /payroll (the Employees permission).

const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');

const router = Router();

const handle = (fn) =>
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.query.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return await fn(req, res, company_id);
    } catch (err) {
      if (err instanceof PayrollError) return error(res, err.message, err.status);
      throw err;
    }
  });

// ?month=YYYY-MM or ?week_start=YYYY-MM-DD (a Monday).
router.get(
  '/summary',
  handle(async (req, res, company_id) => {
    const p = resolvePeriod(req.query);
    const from = parseDay(p.from);
    const to = parseDay(p.to);
    const working_days = workingDaysIn(p.month);

    const [records, piecePays, run] = await Promise.all([
      prisma.attendance.findMany({
        where: { company_id, work_date: { gte: from, lte: to } },
        include: { shifts: true },
      }),
      prisma.piece_pays.findMany({ where: { company_id, pay_date: { gte: from, lte: to } } }),
      prisma.payroll_runs.findFirst({
        where: { company_id, month: p.key },
        include: { payslips: { select: { employee_id: true, net: true } } },
      }),
    ]);
    const group = (rows) => {
      const m = new Map();
      for (const r of rows) {
        if (!m.has(r.employee_id)) m.set(r.employee_id, []);
        m.get(r.employee_id).push(r);
      }
      return m;
    };
    const byEmployee = group(records);
    const piecesBy = group(piecePays);
    const slipBy = new Map((run?.payslips ?? []).map((s) => [s.employee_id, Number(s.net)]));

    const employees = await prisma.employees.findMany({
      where: {
        company_id,
        salary_type: { not: null },
        OR: [{ status: 'Active' }, { id: { in: [...byEmployee.keys(), ...piecesBy.keys()] } }],
      },
      select: {
        id: true,
        employee_code: true,
        first_name: true,
        last_name: true,
        department: true,
        salary_type: true,
        salary: true,
      },
      orderBy: { first_name: 'asc' },
    });

    const items = employees.map((e) => {
      const rows = byEmployee.get(e.id) ?? [];
      const present = rows.filter((r) => r.status !== 'ABSENT');
      const pays = piecesBy.get(e.id) ?? [];
      const isPiece = e.salary_type === 'PIECE_RATE';
      const pay = isPiece ? null : payFor(e, rows, working_days);
      const pieceAmount = round2(pays.reduce((a, x) => a + Number(x.amount), 0));
      return {
        id: e.id,
        employee_code: e.employee_code,
        name: fullName(e),
        department: e.department,
        salary_type: e.salary_type,
        rate: e.salary === null ? null : Number(e.salary),
        days_present: round2(present.reduce((a, r) => a + (r.day_units === null ? 1 : Number(r.day_units)), 0)),
        absent: rows.length - present.length,
        shifts: round2(present.reduce((a, r) => a + r.shifts.reduce((b, s) => b + Number(s.units), 0), 0)),
        hours: round2(present.reduce((a, r) => a + (r.hours === null ? 0 : Number(r.hours)), 0)),
        pieces: pays.reduce((a, x) => a + x.pieces, 0),
        piece_entries: pays.length,
        piece_unconfirmed: pays.filter((x) => x.status !== 'CONFIRMED').length,
        // Pay so far: what attendance earns (salary types), or the piece
        // pay entered (piece rate).
        amount: isPiece ? pieceAmount : pay.gross,
        // Net on this period's payslip, once salary is made.
        payslip_net: slipBy.has(e.id) ? slipBy.get(e.id) : null,
      };
    });
    return success(res, {
      key: p.key,
      period_type: p.period_type,
      label: periodLabel(p.key),
      from: p.from,
      to: p.to,
      working_days,
      run: run ? { id: run.id, status: run.status } : null,
      items,
      totals: {
        employees: items.length,
        pieces: items.reduce((a, i) => a + i.pieces, 0),
        amount: round2(items.reduce((a, i) => a + i.amount, 0)),
      },
    });
  })
);

// ?from=&to= (YYYY-MM-DD): sale lines by bill date and product, with the
// quantity sold and, for a combo product, the pieces (x its combo size).
router.get(
  '/sales',
  handle(async (req, res, company_id) => {
    const from = parseDay(String(req.query.from ?? ''));
    const to = parseDay(String(req.query.to ?? ''));
    if (!from || !to) throw new PayrollError('from and to are needed as YYYY-MM-DD');
    const lines = await prisma.sale_items.findMany({
      where: {
        sales: {
          company_id,
          bill_date: { gte: from, lte: to },
          // A GST bill that also has a secondary bill is the same sale twice;
          // like the sales reports, count it once (the secondary bill).
          NOT: { bill_type: 'GST', has_secondary_bill: true },
        },
      },
      select: {
        sale_id: true,
        product_id: true,
        product_name: true,
        quantity: true,
        sales: { select: { bill_date: true } },
        products: { select: { combo_size: true } },
      },
    });
    const rows = new Map();
    for (const l of lines) {
      const date = l.sales.bill_date.toISOString().slice(0, 10);
      const key = `${date}|${l.product_id}`;
      const combo = l.products?.combo_size ?? null;
      const row = rows.get(key) ?? {
        date,
        product_id: l.product_id,
        product_name: l.product_name,
        combo_size: combo,
        quantity: 0,
        pieces: 0,
        bills: new Set(),
      };
      row.quantity += l.quantity;
      row.pieces += l.quantity * (combo ?? 1);
      row.bills.add(l.sale_id);
      rows.set(key, row);
    }
    const items = [...rows.values()]
      .map(({ bills, ...r }) => ({ ...r, bills: bills.size }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.product_name.localeCompare(b.product_name));
    return success(res, { items });
  })
);

module.exports = router;
