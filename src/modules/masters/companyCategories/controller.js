const companyCategoryService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');

// Company categories are one global list managed by the superadmin (not per
// company), so no endpoint here takes company_id. Company users can read the
// list; writes are superadmin-only (the 'Company Category' module is not
// grantable -- enforced by requirePermission where the router is mounted).

function isValidId(raw) {
  return /^COCAT\d{11}$/.test(raw);
}

async function createCompanyCategory(req, res) {
  const category = await companyCategoryService.createCompanyCategory(req.body);
  return success(res, category, 201);
}

async function getCompanyCategories(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await companyCategoryService.getCompanyCategories({ page, limit, deleted: req.query.deleted === 'true', search });
  return success(res, result);
}

// Shared by get/update/delete: 400 for a malformed id, 404 if it doesn't exist.
async function findOr404(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    error(res, 'Invalid company category id', 400);
    return null;
  }
  const category = await companyCategoryService.getCompanyCategoryById(id);
  if (!category) error(res, 'Company category not found', 404);
  return category;
}

async function getCompanyCategoryById(req, res) {
  const category = await findOr404(req, res);
  if (category) return success(res, category);
}

async function updateCompanyCategory(req, res) {
  if (!(await findOr404(req, res))) return;
  const category = await companyCategoryService.updateCompanyCategory(req.params.id, req.body);
  return success(res, category);
}

async function deleteCompanyCategory(req, res) {
  if (!(await findOr404(req, res))) return;
  await companyCategoryService.deleteCompanyCategory(req.params.id);
  return res.status(204).send();
}

module.exports = {
  createCompanyCategory,
  getCompanyCategories,
  getCompanyCategoryById,
  updateCompanyCategory,
  deleteCompanyCategory,
};
