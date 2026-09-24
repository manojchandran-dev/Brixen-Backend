const prisma = require('../prisma/client');
const { error } = require('../core/responses/apiResponse');

const ACTION_BY_METHOD = { POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

// Server-side enforcement of the per-company module permissions the
// superadmin sets (the same rows the app uses to show/hide buttons). Mounted
// in front of a module's router; checks company users' writes only --
// superadmin is exempt, and reads are left to company scoping.
//
//   POST -> create, PUT/PATCH -> edit, DELETE and .../restore -> delete.
//   .../stepN is part of a create wizard, so create OR edit allows it.
//
// A module needs a saved row with view + the action. Without a row it's
// allowed only if the module is always_visible (Support, Chatbot) -- the same
// rule the company's menu uses. Superadmin-only modules are always denied.
function requirePermission(moduleName) {
  return async (req, res, next) => {
    if (req.auth?.isSuperadmin) return next();
    const method = ACTION_BY_METHOD[req.method];
    if (!method) return next();

    const path = req.path.replace(/\/+$/, '');
    const actions = /\/restore$/.test(path) ? ['delete'] : /\/step\d+$/.test(path) ? ['create', 'edit'] : [method];

    const module = await prisma.modules.findFirst({ where: { name: moduleName } });
    const row =
      module &&
      (await prisma.permissions.findFirst({ where: { company_id: req.auth.companyId, module_id: module.id } }));

    const allowed =
      module?.grantable &&
      (row ? row.view && actions.some((a) => row[a]) : module.always_visible);
    if (!allowed) {
      return error(res, `You don't have permission to ${actions[0]} ${moduleName.toLowerCase()}`, 403);
    }
    return next();
  };
}

module.exports = requirePermission;
