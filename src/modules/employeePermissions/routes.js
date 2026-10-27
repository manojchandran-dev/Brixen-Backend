const { Router } = require('express');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const prefixedId = require('../../utils/prefixedId');
const { allows } = require('../../middleware/permission.middleware');
const { parseCompanyId } = require('../../utils/companyScope');
const { success, error } = require('../../core/responses/apiResponse');

// A company admin decides which modules each employee may use, and what
// they may do there. Only modules the company has been granted are offered,
// and never an action the company itself may not do. Employee logins never
// reach this (session.middleware), so this is admin-only.

// Modules an employee login can actually use: the ones mounted behind
// requirePermission and allowed by session.middleware's MODULE_ROUTES.
const ASSIGNABLE = new Set([
  'Employees',
  'Sales',
  'Customers',
  'Expenses',
  'Products',
  'Purchases',
  'Attendance',
  'Expense Category',
  'Units',
  'Product Category',
  'Purchase Category',
  'Department',
  'Work Type',
]);
const ACTIONS = ['view', 'create', 'edit', 'delete'];

const router = Router();

// The employee (of the caller's company); null after sending a 400/404.
async function findEmployee(req, res) {
  const company_id = parseCompanyId(req.query.company_id);
  const employee_id = parseInt(req.params.employeeId, 10);
  let problem = null;
  if (!company_id) problem = [400, 'company_id is required and must be a positive integer'];
  else if (!Number.isInteger(employee_id)) problem = [400, 'Invalid employee id'];
  const employee = problem ? null : await prisma.employees.findFirst({ where: { id: employee_id, company_id } });
  if (!problem && !employee) problem = [404, 'Employee not found'];
  if (problem) {
    error(res, problem[1], problem[0]);
    return null;
  }
  return employee;
}

// The company's grantable modules with what the company may do in each.
async function companyModules(company_id) {
  const [modules, rows] = await Promise.all([
    prisma.modules.findMany({ where: { grantable: true }, orderBy: { created_at: 'asc' } }),
    prisma.permissions.findMany({ where: { company_id } }),
  ]);
  const byModule = new Map(rows.map((r) => [r.module_id, r]));
  const parents = new Map(modules.map((m) => [m.id, m.name]));
  return modules
    .filter((m) => ASSIGNABLE.has(m.name) && byModule.get(m.id)?.view)
    .map((m) => {
      const row = byModule.get(m.id);
      return {
        id: m.id,
        name: m.name,
        group: m.parent_id ? (parents.get(m.parent_id) ?? null) : null,
        company: Object.fromEntries(ACTIONS.map((a) => [a, allows(row, a)])),
      };
    });
}

// Every module the company has, with the company's limits and [employee]'s
// current grant (never more than the company has).
async function describe(employee) {
  const [modules, rows] = await Promise.all([
    companyModules(employee.company_id),
    prisma.employee_permissions.findMany({ where: { employee_id: employee.id } }),
  ]);
  const byModule = new Map(rows.map((r) => [r.module_id, r]));
  return {
    employee: {
      id: employee.id,
      employee_code: employee.employee_code,
      name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
    },
    modules: modules.map((m) => ({
      ...m,
      employee: Object.fromEntries(ACTIONS.map((a) => [a, m.company[a] && allows(byModule.get(m.id), a)])),
    })),
  };
}

// GET /employee-permissions/:employeeId
router.get(
  '/:employeeId',
  asyncHandler(async (req, res) => {
    const employee = await findEmployee(req, res);
    return employee ? success(res, await describe(employee)) : undefined;
  })
);

// PUT /employee-permissions/:employeeId { permissions: [{ module_id, view,
// create, edit, delete }] } -- replaces the employee's grants. A module left
// out (or with nothing ticked) is taken away.
router.put(
  '/:employeeId',
  asyncHandler(async (req, res) => {
    const employee = await findEmployee(req, res);
    if (!employee) return undefined;
    const list = req.body?.permissions;
    if (!Array.isArray(list)) return error(res, 'permissions must be a list', 400);

    const available = new Map((await companyModules(employee.company_id)).map((m) => [m.id, m]));
    const errors = [];
    const rows = [];
    const seen = new Set();
    for (const p of list) {
      const m = available.get(String(p?.module_id));
      if (!m) {
        errors.push(`Module ${p?.module_id} isn't available to your company`);
        continue;
      }
      if (seen.has(m.id)) {
        errors.push(`${m.name} is listed twice`);
        continue;
      }
      seen.add(m.id);
      const flags = Object.fromEntries(ACTIONS.map((a) => [a, p[a] === true]));
      // Add / edit / delete need view.
      if (!flags.view && (flags.create || flags.edit || flags.delete)) {
        errors.push(`${m.name}: tick View to allow anything else`);
        continue;
      }
      for (const a of ACTIONS) {
        if (flags[a] && !m.company[a]) errors.push(`Your company can't ${a} ${m.name}, so it can't be given`);
      }
      if (flags.view) rows.push({ module_id: m.id, ...flags });
    }
    if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });

    await prisma.$transaction([
      prisma.employee_permissions.deleteMany({ where: { employee_id: employee.id } }),
      prisma.employee_permissions.createMany({
        data: rows.map((r) => ({ id: prefixedId('EPRM'), company_id: employee.company_id, employee_id: employee.id, ...r })),
      }),
    ]);
    return success(res, await describe(employee));
  })
);

module.exports = router;
