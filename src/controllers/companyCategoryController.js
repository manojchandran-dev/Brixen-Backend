const companyCategoryService = require('../services/companyCategoryService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId, resolveListScope } = require('../utils/companyScope');

function isValidId(raw) {
  return /^COCAT\d{11}$/.test(raw);
}

async function createCompanyCategory(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const category = await companyCategoryService.createCompanyCategory(company_id, req.body);
    return success(res, category, 201);
  } catch (err) {
    if (err instanceof companyCategoryService.CompanyCategoryError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getCompanyCategories(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await companyCategoryService.getCompanyCategories(company_id, { page, limit, search });
  return success(res, result);
}

async function getCompanyCategoryById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const category = await companyCategoryService.getCompanyCategoryById(id, company_id);
  if (!category) {
    return error(res, 'Company category not found', 404);
  }

  return success(res, category);
}

async function updateCompanyCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const existing = await companyCategoryService.getCompanyCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Company category not found', 404);
  }

  const category = await companyCategoryService.updateCompanyCategory(id, req.body);
  return success(res, category);
}

async function deleteCompanyCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const existing = await companyCategoryService.getCompanyCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Company category not found', 404);
  }

  await companyCategoryService.deleteCompanyCategory(id);
  return res.status(204).send();
}

module.exports = {
  createCompanyCategory,
  getCompanyCategories,
  getCompanyCategoryById,
  updateCompanyCategory,
  deleteCompanyCategory,
};
