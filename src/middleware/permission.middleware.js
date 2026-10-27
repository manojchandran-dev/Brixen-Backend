const prisma = require('../prisma/client');
const { error } = require('../core/responses/apiResponse');

const ACTION_BY_METHOD = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

// Lists a module's screens read to work (a sale picks a customer and
// products). Anyone who may view the module on the left may READ the ones on
// the right -- never change them.
const READ_DEPENDENCIES = {
  Sales: ['Customers', 'Products'],
  Purchases: ['Products', 'Purchase Category', 'Units'],
  Products: ['Product Category', 'Units'],
  Expenses: ['Expense Category'],
  Employees: ['Department'],
  Attendance: ['Employees', 'Work Type'],
};

// Modules whose screens company admins also need view to READ (the staff
// modules). Reads of the older modules stay with company scoping, since the
// company dashboard reads them whatever the menu shows.
const READ_ENFORCED_FOR_ADMINS = new Set(['Employees', 'Attendance', 'Department', 'Work Type']);

// Does [row] allow [action]? Every action needs view as well.
const allows = (row, action) => Boolean(row && row.view && (action === 'view' || row[action]));

// Server-side enforcement of module permissions -- the same rows the app uses
// to show/hide menus and buttons, so hiding a button is never the only guard.
// Mounted in front of a module's router.
//
//   GET -> view, POST -> create, PUT/PATCH -> edit, DELETE and .../restore ->
//   delete. .../stepN and .../variants are part of a create wizard, so create
//   OR edit allows them. An employee's .../login (activate, remove) is edit.
//
// Superadmin: exempt. Company admin: the company's row (a superadmin grant);
// no row = allowed only for always_visible modules (Support, Chatbot).
// Employee: the company's row AND the employee's own row (a company admin
// grant) must both allow the action -- an admin can't give more than the
// company has. Superadmin-only modules are always denied.
function requirePermission(moduleName) {
  return async (req, res, next) => {
    if (req.auth?.isSuperadmin) return next();
    const method = ACTION_BY_METHOD[req.method];
    if (!method) return next();
    const employeeId = req.auth?.employeeId;
    if (method === 'view' && !employeeId && !READ_ENFORCED_FOR_ADMINS.has(moduleName)) return next();

    const path = req.path.replace(/\/+$/, '');
    const actions =
      method === 'view'
        ? ['view']
        : /\/restore$/.test(path)
          ? ['delete']
          : /\/(step\d+|variants)$/.test(path)
            ? ['create', 'edit']
            : /\/login(\/activate)?$/.test(path)
              ? ['edit']
              : [method];

    // Reading a lookup list: viewing any module that needs it is enough.
    const names = [
      moduleName,
      ...(method === 'view'
        ? Object.entries(READ_DEPENDENCIES)
            .filter(([, deps]) => deps.includes(moduleName))
            .map(([name]) => name)
        : []),
    ];

    for (const name of names) {
      if (await mayUse(req.auth, name, name === moduleName ? actions : ['view'], employeeId)) return next();
    }
    const verb = { view: 'view', create: 'add to', edit: 'change', delete: 'delete from' }[actions[0]];
    return error(res, `You don't have permission to ${verb} ${moduleName.toLowerCase()}`, 403);
  };
}

async function mayUse(auth, moduleName, actions, employeeId) {
  const module = await prisma.modules.findFirst({ where: { name: moduleName } });
  if (!module?.grantable) return false;
  const companyRow = await prisma.permissions.findFirst({ where: { company_id: auth.companyId, module_id: module.id } });
  const companyAllows = (a) => (companyRow ? allows(companyRow, a) : module.always_visible);
  if (!employeeId) return actions.some(companyAllows);

  const employeeRow = await prisma.employee_permissions.findFirst({
    where: { employee_id: employeeId, module_id: module.id },
  });
  return actions.some((a) => companyAllows(a) && allows(employeeRow, a));
}

module.exports = requirePermission;
module.exports.allows = allows;
