const prisma = require('../prisma/client');
const { success, error } = require('../core/responses/apiResponse');
const { parseCompanyId } = require('./companyScope');

// Handler for `POST /:id/restore` on a soft-deleted model (see
// prisma/client.js). Brings the row back with the same id. Company-owned
// models need ?company_id=, the same scoping as their DELETE endpoint.
function restoreHandler(model, { label, intId = false, scoped = true }) {
  return async (req, res) => {
    const id = intId ? parseInt(req.params.id, 10) : req.params.id;
    if (intId && Number.isNaN(id)) return error(res, `Invalid ${label} id`, 400);

    const where = { id, deleted_at: { not: null } };
    if (scoped) {
      const company_id = parseCompanyId(req.query.company_id);
      if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
      where.company_id = company_id;
    }

    const { count } = await prisma[model].updateMany({ where, data: { deleted_at: null } });
    if (!count) return error(res, `Deleted ${label} not found`, 404);
    return success(res, await prisma[model].findUnique({ where: { id } }));
  };
}

module.exports = restoreHandler;
