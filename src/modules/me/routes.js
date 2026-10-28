const { Router } = require('express');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { dateIn } = require('../../utils/timezone');
const attendance = require('../attendance/service');
const payroll = require('../payroll/service');
const { allows } = require('../../middleware/permission.middleware');

// An employee's own data, read-only: who they are, their attendance and
// payslips.
// The employee comes from the access token (req.auth.employeeId), never
// from the request.

const router = Router();

router.use((req, res, next) => (req.auth?.employeeId ? next() : error(res, 'Only an employee login can use this', 403)));

router.get(
  '/employee',
  asyncHandler(async (req, res) => {
    const e = await prisma.employees.findFirst({
      where: { id: req.auth.employeeId, company_id: req.auth.companyId },
      include: {
        departments: { select: { id: true, name: true } },
        companies: { select: { company_name: true, timezone: true } },
      },
    });
    if (!e) return error(res, 'Employee not found', 404);
    // Bank and ID numbers stay with the admin.
    return success(res, {
      id: e.id,
      employee_code: e.employee_code,
      first_name: e.first_name,
      last_name: e.last_name,
      email: e.email,
      phone: e.phone,
      designation: e.designation,
      department: e.departments?.name ?? e.department,
      department_id: e.department_id,
      joining_date: e.joining_date,
      employment_type: e.employment_type,
      salary_type: e.salary_type,
      salary_period: e.salary_period,
      salary: e.salary === null ? null : Number(e.salary),
      status: e.status,
      company_name: e.companies?.company_name ?? null,
      timezone: e.companies?.timezone ?? null,
    });
  })
);

// What this employee may do in each module: their own grant AND their
// company's, like permission.middleware decides. Shaped like /permissions
// rows, for the app's buttons and menu.
router.get(
  '/permissions',
  asyncHandler(async (req, res) => {
    const [mine, company] = await Promise.all([
      prisma.employee_permissions.findMany({ where: { employee_id: req.auth.employeeId } }),
      prisma.permissions.findMany({ where: { company_id: req.auth.companyId } }),
    ]);
    const companyBy = new Map(company.map((p) => [p.module_id, p]));
    const items = mine.map((p) => {
      const c = companyBy.get(p.module_id);
      const both = (a) => allows(p, a) && allows(c, a);
      return { module_id: p.module_id, view: both('view'), create: both('create'), edit: both('edit'), delete: both('delete') };
    });
    return success(res, { items });
  })
);

// ?from=&to= (YYYY-MM-DD); default: this month so far, in the company's zone.
router.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const tz = await attendance.companyTz(req.auth.companyId);
    const today = dateIn(tz);
    const from = req.query.from ?? `${today.slice(0, 8)}01`;
    const to = req.query.to ?? today;
    try {
      const { items, meta } = await attendance.list(req.auth.companyId, { from, to, employee_id: req.auth.employeeId });
      const totals = items.reduce(
        (a, r) => ({
          // Days worked; absent days are counted on their own.
          days: a.days + (r.status === 'ABSENT' ? 0 : 1),
          absent: a.absent + (r.status === 'ABSENT' ? 1 : 0),
          shifts: a.shifts + r.total_shifts,
          pieces: a.pieces + r.total_pieces,
          hours: a.hours + (r.hours ?? 0),
          day_units: a.day_units + (r.day_units ?? 0),
          amount: r.total_amount === null ? a.amount : Math.round((a.amount + r.total_amount) * 100) / 100,
        }),
        { days: 0, absent: 0, shifts: 0, pieces: 0, hours: 0, day_units: 0, amount: 0 }
      );
      return success(res, { items, totals, meta: { ...meta, from, to } });
    } catch (err) {
      if (err instanceof attendance.AttendanceError) return error(res, err.message, err.status);
      throw err;
    }
  })
);

// This employee's payslips from finalized salary months, newest first.
router.get(
  '/payslips',
  asyncHandler(async (req, res) => {
    const rows = await prisma.payslips.findMany({
      where: { employee_id: req.auth.employeeId, company_id: req.auth.companyId, payroll_runs: { status: payroll.FINALIZED } },
      include: {
        payroll_runs: true,
        employees: {
          select: { id: true, employee_code: true, first_name: true, last_name: true, email: true, department: true, designation: true },
        },
      },
      orderBy: { payroll_runs: { period_from: 'desc' } },
      take: 60,
    });
    return success(res, { items: rows.map((p) => payroll.shapeSlip(p)) });
  })
);

module.exports = router;
