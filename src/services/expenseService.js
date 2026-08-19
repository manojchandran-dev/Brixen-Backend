const { Prisma } = require('@prisma/client');
const expenseRepository = require('../repositories/expenseRepository');
const expenseCategoryRepository = require('../repositories/expenseCategoryRepository');
const unitRepository = require('../repositories/unitRepository');
const { generateExpenseId } = require('../utils/expenseId');

const MAX_ID_ATTEMPTS = 5;

class ExpenseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCategory(category_id) {
  const category = await expenseCategoryRepository.findById(category_id);
  if (!category) {
    throw new ExpenseError('category_id does not reference an existing expense category');
  }
}

async function assertValidUnit(unit_id) {
  if (unit_id === undefined || unit_id === null) {
    return;
  }

  const unit = await unitRepository.findById(unit_id);
  if (!unit) {
    throw new ExpenseError('unit_id does not reference an existing unit');
  }
}

async function createExpense(data) {
  await assertValidCategory(data.category_id);
  await assertValidUnit(data.unit_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await expenseRepository.create({
        id: generateExpenseId(),
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

async function getExpenses({ page = 1, limit = 20, search = '', category_id, unit_id }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(category_id ? { category_id } : {}),
    ...(unit_id ? { unit_id } : {}),
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

async function getExpenseById(id) {
  return expenseRepository.findById(id);
}

async function updateExpense(id, data) {
  const { id: _id, ...rest } = data;

  if (rest.category_id !== undefined) {
    await assertValidCategory(rest.category_id);
  }

  if (rest.unit_id !== undefined) {
    await assertValidUnit(rest.unit_id);
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
