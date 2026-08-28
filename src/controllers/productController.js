const productService = require('../services/productService');
const { success, error } = require('../utils/apiResponse');

function isValidId(raw) {
  return /^PROD\d{12}$/.test(raw);
}

async function createProduct(req, res) {
  try {
    const product = await productService.createProduct(req.body);
    return success(res, product, 201);
  } catch (err) {
    if (err instanceof productService.ProductError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getProducts(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';
  const category_id = req.query.category_id || undefined;
  const status = req.query.status || undefined;

  const result = await productService.getProducts({ page, limit, search, category_id, status });
  return success(res, result);
}

async function getProductById(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const product = await productService.getProductById(id);
  if (!product) {
    return error(res, 'Product not found', 404);
  }

  return success(res, product);
}

async function updateProduct(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const existing = await productService.getProductById(id);
  if (!existing) {
    return error(res, 'Product not found', 404);
  }

  try {
    const product = await productService.updateProduct(id, req.body);
    return success(res, product);
  } catch (err) {
    if (err instanceof productService.ProductError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function updateProductStep2(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const existing = await productService.getProductById(id);
  if (!existing) {
    return error(res, 'Product not found', 404);
  }

  try {
    const product = await productService.updateProductStep2(id, req.body);
    return success(res, product);
  } catch (err) {
    if (err instanceof productService.ProductError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function updateProductStep3(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const existing = await productService.getProductById(id);
  if (!existing) {
    return error(res, 'Product not found', 404);
  }

  const product = await productService.updateProductStep3(id, req.body);
  return success(res, product);
}

async function updateProductStep4(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const existing = await productService.getProductById(id);
  if (!existing) {
    return error(res, 'Product not found', 404);
  }

  const product = await productService.updateProductStep4(id, req.body);
  return success(res, product);
}

async function deleteProduct(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid product id', 400);
  }

  const existing = await productService.getProductById(id);
  if (!existing) {
    return error(res, 'Product not found', 404);
  }

  await productService.deleteProduct(id);
  return res.status(204).send();
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStep2,
  updateProductStep3,
  updateProductStep4,
  deleteProduct,
};
