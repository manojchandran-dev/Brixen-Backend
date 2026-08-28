const productCategoryService = require('../services/productCategoryService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

function isValidId(raw) {
  return /^PRCAT\d{11}$/.test(raw);
}

async function createProductCategory(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const category = await productCategoryService.createProductCategory(company_id, req.body);
    return success(res, category, 201);
  } catch (err) {
    if (err instanceof productCategoryService.ProductCategoryError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getProductCategories(req, res) {
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await productCategoryService.getProductCategories(company_id, { page, limit, search });
  return success(res, result);
}

async function getProductCategoryById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const category = await productCategoryService.getProductCategoryById(id, company_id);
  if (!category) {
    return error(res, 'Product category not found', 404);
  }

  return success(res, category);
}

async function updateProductCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const existing = await productCategoryService.getProductCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Product category not found', 404);
  }

  const category = await productCategoryService.updateProductCategory(id, req.body);
  return success(res, category);
}

async function deleteProductCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const existing = await productCategoryService.getProductCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Product category not found', 404);
  }

  await productCategoryService.deleteProductCategory(id);
  return res.status(204).send();
}

module.exports = {
  createProductCategory,
  getProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
};
