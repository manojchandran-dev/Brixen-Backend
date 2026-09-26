const { Prisma } = require('@prisma/client');
const companyCategoryRepository = require('./repository');
const { generateCompanyCategoryId } = require('../../../utils/companyCategoryId');

const MAX_ID_ATTEMPTS = 5;
const EDITABLE_FIELDS = ['name', 'description', 'status'];

class CompanyCategoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Global master list: company_id is always null (see controller.js).
async function createCompanyCategory(data) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await companyCategoryRepository.create({
        id: generateCompanyCategoryId(),
        company_id: null,
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

async function getCompanyCategories({ page = 1, deleted = false, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    company_id: null,
    // deleted=true lists the soft-deleted rows instead (to restore them).
    ...(deleted ? { deleted_at: { not: null } } : {}),
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
  return companyCategoryRepository.findGlobalById(id);
}

// Only name/description/status can change; anything else in the body is ignored.
async function updateCompanyCategory(id, data) {
  const changes = Object.fromEntries(EDITABLE_FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]]));
  return companyCategoryRepository.update(id, changes);
}

async function deleteCompanyCategory(id) {
  return companyCategoryRepository.delete(id);
}

module.exports = {
  CompanyCategoryError,
  createCompanyCategory,
  getCompanyCategories,
  getCompanyCategoryById,
  updateCompanyCategory,
  deleteCompanyCategory,
};
