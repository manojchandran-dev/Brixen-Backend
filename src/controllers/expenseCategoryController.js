const expenseCategoryService = require('../services/expenseCategoryService');
const { success, error } = require('../utils/apiResponse');

function isValidId(raw) {
  return /^EXCAT\d{11}$/.test(raw);
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
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid expense category id', 400);
  }

  const category = await expenseCategoryService.getExpenseCategoryById(id);
  if (!category) {
    return error(res, 'Expense category not found', 404);
  }

  return success(res, category);
}

async function updateExpenseCategory(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
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
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid expense category id', 400);
  }

  const existing = await expenseCategoryService.getExpenseCategoryById(id);
  if (!existing) {
    return error(res, 'Expense category not found', 404);
  }

  try {
    await expenseCategoryService.deleteExpenseCategory(id);
  } catch (err) {
    if (err instanceof expenseCategoryService.ExpenseCategoryError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }

  return res.status(204).send();
}

module.exports = {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
};
