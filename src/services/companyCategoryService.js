const { Prisma } = require('@prisma/client');
const companyCategoryRepository = require('../repositories/companyCategoryRepository');
const { generateCompanyCategoryId } = require('../utils/companyCategoryId');

const MAX_ID_ATTEMPTS = 5;

async function createCompanyCategory(data) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await companyCategoryRepository.create({
        id: generateCompanyCategoryId(),
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

  throw new Error('Failed to generate a unique company category id, please retry');
}

async function getCompanyCategories({ page = 1, limit = 20, search = '' }) {
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
    companyCategoryRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    companyCategoryRepository.count(where),
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

async function getCompanyCategoryById(id) {
  return companyCategoryRepository.findById(id);
}

async function updateCompanyCategory(id, data) {
  return companyCategoryRepository.update(id, data);
}

async function deleteCompanyCategory(id) {
  return companyCategoryRepository.delete(id);
}

module.exports = {
  createCompanyCategory,
  getCompanyCategories,
  getCompanyCategoryById,
  updateCompanyCategory,
  deleteCompanyCategory,
};
