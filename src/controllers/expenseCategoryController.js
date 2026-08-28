const expenseCategoryService = require('../services/expenseCategoryService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

function isValidId(raw) {
  return /^EXCAT\d{11}$/.test(raw);
}

async function createExpenseCategory(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const category = await expenseCategoryService.createExpenseCategory(company_id, req.body);
    return success(res, category, 201);
  } catch (err) {
    if (err instanceof expenseCategoryService.ExpenseCategoryError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getExpenseCategories(req, res) {
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await expenseCategoryService.getExpenseCategories(company_id, { page, limit, search });
  return success(res, result);
}

async function getExpenseCategoryById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense category id', 400);
  }

  const category = await expenseCategoryService.getExpenseCategoryById(id, company_id);
  if (!category) {
    return error(res, 'Expense category not found', 404);
  }

  return success(res, category);
}

async function updateExpenseCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense category id', 400);
  }

  const existing = await expenseCategoryService.getExpenseCategoryById(id, company_id);
  if (!existing) {
    return error(res, 'Expense category not found', 404);
  }

  const category = await expenseCategoryService.updateExpenseCategory(id, req.body);
  return success(res, category);
}

async function deleteExpenseCategory(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid expense category id', 400);
  }

  const existing = await expenseCategoryService.getExpenseCategoryById(id, company_id);
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
