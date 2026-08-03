const expenseCategoryService = require('../services/expenseCategoryService');
const { success, error } = require('../utils/apiResponse');

function parseId(raw) {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return BigInt(raw);
}

async function createExpenseCategory(req, res) {
  const category = await expenseCategoryService.createExpenseCategory(req.body);
  return success(res, category, 201);
}

async function getExpenseCategories(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await expenseCategoryService.getExpenseCategories({ page, limit, search });
  return success(res, result);
}

async function getExpenseCategoryById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return error(res, 'Invalid expense category id', 400);
  }

  const category = await expenseCategoryService.getExpenseCategoryById(id);
  if (!category) {
    return error(res, 'Expense category not found', 404);
  }

  return success(res, category);
}

async function updateExpenseCategory(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return error(res, 'Invalid expense category id', 400);
  }

  const existing = await expenseCategoryService.getExpenseCategoryById(id);
  if (!existing) {
    return error(res, 'Expense category not found', 404);
  }

  const category = await expenseCategoryService.updateExpenseCategory(id, req.body);
  return success(res, category);
}

async function deleteExpenseCategory(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return error(res, 'Invalid expense category id', 400);
  }

  const existing = await expenseCategoryService.getExpenseCategoryById(id);
  if (!existing) {
    return error(res, 'Expense category not found', 404);
  }

  await expenseCategoryService.deleteExpenseCategory(id);
  return res.status(204).send();
}

module.exports = {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
};
