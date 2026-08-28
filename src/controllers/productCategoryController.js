const productCategoryService = require('../services/productCategoryService');
const { success, error } = require('../utils/apiResponse');

function isValidId(raw) {
  return /^PRCAT\d{11}$/.test(raw);
}

async function createProductCategory(req, res) {
  const category = await productCategoryService.createProductCategory(req.body);
  return success(res, category, 201);
}

async function getProductCategories(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await productCategoryService.getProductCategories({ page, limit, search });
  return success(res, result);
}

async function getProductCategoryById(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const category = await productCategoryService.getProductCategoryById(id);
  if (!category) {
    return error(res, 'Product category not found', 404);
  }

  return success(res, category);
}

async function updateProductCategory(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const existing = await productCategoryService.getProductCategoryById(id);
  if (!existing) {
    return error(res, 'Product category not found', 404);
  }

  const category = await productCategoryService.updateProductCategory(id, req.body);
  return success(res, category);
}

async function deleteProductCategory(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product category id', 400);
  }

  const existing = await productCategoryService.getProductCategoryById(id);
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
