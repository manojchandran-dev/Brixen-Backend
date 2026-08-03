const { Prisma } = require('@prisma/client');
const expenseCategoryRepository = require('../repositories/expenseCategoryRepository');
const { generateExpenseCategoryId } = require('../utils/expenseCategoryId');

const MAX_ID_ATTEMPTS = 5;

async function createExpenseCategory(data) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await expenseCategoryRepository.create({
        id: generateExpenseCategoryId(),
        name: data.name,
        description: data.description,
        status: data.status || 'ACTIVE',
      });
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique expense category id, please retry');
}

async function getExpenseCategories({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    expenseCategoryRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    expenseCategoryRepository.count(where),
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

async function getExpenseCategoryById(id) {
  return expenseCategoryRepository.findById(id);
}

async function updateExpenseCategory(id, data) {
  return expenseCategoryRepository.update(id, data);
}

async function deleteExpenseCategory(id) {
  return expenseCategoryRepository.delete(id);
}

module.exports = {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
};
