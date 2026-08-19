const companyCategoryService = require('../services/companyCategoryService');
const { success, error } = require('../utils/apiResponse');

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

  const result = await companyCategoryService.getCompanyCategories({ page, limit, search });
  return success(res, result);
}

async function getCompanyCategoryById(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const category = await companyCategoryService.getCompanyCategoryById(id);
  if (!category) {
    return error(res, 'Company category not found', 404);
  }

  return success(res, category);
}

async function updateCompanyCategory(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const existing = await companyCategoryService.getCompanyCategoryById(id);
  if (!existing) {
    return error(res, 'Company category not found', 404);
  }

  const category = await companyCategoryService.updateCompanyCategory(id, req.body);
  return success(res, category);
}

async function deleteCompanyCategory(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid company category id', 400);
  }

  const existing = await companyCategoryService.getCompanyCategoryById(id);
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
