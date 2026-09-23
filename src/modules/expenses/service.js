const { Prisma } = require('@prisma/client');
const expenseRepository = require('../repositories/expenseRepository');
const expenseCategoryRepository = require('../repositories/expenseCategoryRepository');
const unitRepository = require('../repositories/unitRepository');
const companyRepository = require('../repositories/companyRepository');
const { generateExpenseId } = require('../utils/expenseId');

const MAX_ID_ATTEMPTS = 5;

class ExpenseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new ExpenseError('company_id does not reference an existing company');
  }
}

async function assertValidCategory(category_id, company_id) {
  const category = await expenseCategoryRepository.findByIdAndCompany(category_id, company_id);
  if (!category) {
    throw new ExpenseError('category_id does not reference an existing expense category for this company');
  }
}

async function assertValidUnit(unit_id, company_id) {
  if (unit_id === undefined || unit_id === null) {
    return;
  }

  const unit = await unitRepository.findByIdAndCompany(unit_id, company_id);
  if (!unit) {
    throw new ExpenseError('unit_id does not reference an existing unit for this company');
  }
}

async function createExpense(company_id, data) {
  await assertValidCompany(company_id);
  await assertValidCategory(data.category_id, company_id);
  await assertValidUnit(data.unit_id, company_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await expenseRepository.create({
        id: generateExpenseId(),
        company_id,
        category_id: data.category_id,
        unit_id: data.unit_id,
        title: data.title,
        amount: data.amount,
        expense_date: data.expense_date,
        payment_method: data.payment_method,
        receipt_url: data.receipt_url,
        notes: data.notes,
      });
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique expense id, please retry');
}

async function getExpenses(company_id, { page = 1, limit = 20, search = '', category_id, unit_id, from, to }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(category_id ? { category_id } : {}),
    ...(unit_id ? { unit_id } : {}),
    ...(from || to
      ? { expense_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { payment_method: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    expenseRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    expenseRepository.count(where),
  ]);

  return {
    items: data,
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
  };
}

async function getExpenseById(id, company_id) {
  return expenseRepository.findByIdAndCompany(id, company_id);
}

async function updateExpense(id, company_id, data) {
  const { id: _id, company_id: _companyId, ...rest } = data;

  if (rest.category_id !== undefined) {
    await assertValidCategory(rest.category_id, company_id);
  }

  if (rest.unit_id !== undefined) {
    await assertValidUnit(rest.unit_id, company_id);
  }

  return expenseRepository.update(id, rest);
}

async function deleteExpense(id) {
  return expenseRepository.delete(id);
}

module.exports = {
  ExpenseError,
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
