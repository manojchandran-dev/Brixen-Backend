const purchaseCategoryService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');
const { parseCompanyId, resolveListScope } = require('../../../utils/companyScope');

function isValidId(raw) {
  return /^PUCAT\d{11}$/.test(raw);
}

async function createPurchaseCategory(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const category = await purchaseCategoryService.createPurchaseCategory(company_id, req.body);
    return success(res, category, 201);
  } catch (err) {
    if (err instanceof purchaseCategoryService.PurchaseCategoryError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getPurchaseCategories(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await purchaseCategoryService.getPurchaseCategories(company_id, { page, limit, deleted: req.query.deleted === 'true', search, status: req.query.status });
  return success(res, result);
}

async function getPurchaseCategoryById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid purchase category id', 400);
  }

  const category = await purchaseCategoryService.getPurchaseCategoryById(id, company_id);
  if (!category) {
    return error(res, 'Purchase category not found', 404);
  }

  return success(res, category);
}

async function updatePurchaseCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid purchase category id', 400);
  }

  const existing = await purchaseCategoryService.getPurchaseCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Purchase category not found', 404);
  }

  const category = await purchaseCategoryService.updatePurchaseCategory(id, req.body);
  return success(res, category);
}

async function deletePurchaseCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid purchase category id', 400);
  }

  const existing = await purchaseCategoryService.getPurchaseCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Purchase category not found', 404);
  }

  await purchaseCategoryService.deletePurchaseCategory(id);
  return res.status(204).send();
}

module.exports = {
  createPurchaseCategory,
  getPurchaseCategories,
  getPurchaseCategoryById,
  updatePurchaseCategory,
  deletePurchaseCategory,
};
