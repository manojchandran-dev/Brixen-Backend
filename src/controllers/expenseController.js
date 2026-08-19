const expenseService = require('../services/expenseService');
const { success, error } = require('../utils/apiResponse');

function isValidId(raw) {
  return /^EXP\d{13}$/.test(raw);
}

async function createExpense(req, res) {
  try {
    const expense = await expenseService.createExpense(req.body);
    return success(res, expense, 201);
  } catch (err) {
    if (err instanceof expenseService.ExpenseError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getExpenses(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';
  const category_id = req.query.category_id || undefined;
  const unit_id = req.query.unit_id || undefined;

  const result = await expenseService.getExpenses({ page, limit, search, category_id, unit_id });
  return success(res, result);
}

async function getExpenseById(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const expense = await expenseService.getExpenseById(id);
  if (!expense) {
    return error(res, 'Expense not found', 404);
  }

  return success(res, expense);
}

async function updateExpense(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const existing = await expenseService.getExpenseById(id);
  if (!existing) {
    return error(res, 'Expense not found', 404);
  }

  try {
    const expense = await expenseService.updateExpense(id, req.body);
    return success(res, expense);
  } catch (err) {
    if (err instanceof expenseService.ExpenseError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteExpense(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const existing = await expenseService.getExpenseById(id);
  if (!existing) {
    return error(res, 'Expense not found', 404);
  }

  await expenseService.deleteExpense(id);
  return res.status(204).send();
}

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
