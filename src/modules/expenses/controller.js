const expenseService = require('../services/expenseService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId, resolveListScope } = require('../utils/companyScope');

function isValidId(raw) {
  return /^EXP\d{13}$/.test(raw);
}

async function createExpense(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const expense = await expenseService.createExpense(company_id, req.body);
    return success(res, expense, 201);
  } catch (err) {
    if (err instanceof expenseService.ExpenseError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getExpenses(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';
  const category_id = req.query.category_id || undefined;
  const unit_id = req.query.unit_id || undefined;
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;

  const result = await expenseService.getExpenses(company_id, { page, limit, search, category_id, unit_id, from, to });
  return success(res, result);
}

async function getExpenseById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const expense = await expenseService.getExpenseById(id, company_id);
  if (!expense) {
    return error(res, 'Expense not found', 404);
  }

  return success(res, expense);
}

async function updateExpense(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const existing = await expenseService.getExpenseById(id, company_id);
  if (!existing) {
    return error(res, 'Expense not found', 404);
  }

  try {
    const expense = await expenseService.updateExpense(id, company_id, req.body);
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
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense id', 400);
  }

  const existing = await expenseService.getExpenseById(id, company_id);
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
