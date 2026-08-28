const { Prisma } = require('@prisma/client');
const expenseCategoryRepository = require('../repositories/expenseCategoryRepository');
const companyRepository = require('../repositories/companyRepository');
const { generateExpenseCategoryId } = require('../utils/expenseCategoryId');

const MAX_ID_ATTEMPTS = 5;

class ExpenseCategoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new ExpenseCategoryError('company_id does not reference an existing company');
  }
}

async function createExpenseCategory(company_id, data) {
  await assertValidCompany(company_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await expenseCategoryRepository.create({
        id: generateExpenseCategoryId(),
        company_id,
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

async function getExpenseCategories(company_id, { page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    company_id,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

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

async function getExpenseCategoryById(id, company_id) {
  return expenseCategoryRepository.findByIdAndCompany(id, company_id);
}

async function updateExpenseCategory(id, data) {
  return expenseCategoryRepository.update(id, data);
}

async function deleteExpenseCategory(id) {
  try {
    return await expenseCategoryRepository.delete(id);
  } catch (err) {
    const isForeignKeyRestrict =
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') ||
      /foreign key constraint/i.test(err.message || '');

    if (isForeignKeyRestrict) {
      throw new ExpenseCategoryError('Cannot delete this category while expenses still reference it', 409);
    }
    throw err;
  }
}

module.exports = {
  ExpenseCategoryError,
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
};
