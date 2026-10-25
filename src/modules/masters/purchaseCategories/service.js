const { Prisma } = require('@prisma/client');
const { choice, compact } = require('../../../utils/listFilters');
const purchaseCategoryRepository = require('./repository');
const companyRepository = require('../../companies/repository');
const { generatePurchaseCategoryId } = require('../../../utils/purchaseCategoryId');

const MAX_ID_ATTEMPTS = 5;

class PurchaseCategoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new PurchaseCategoryError('company_id does not reference an existing company');
  }
}

async function createPurchaseCategory(company_id, data) {
  await assertValidCompany(company_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await purchaseCategoryRepository.create({
        id: generatePurchaseCategoryId(),
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

  throw new Error('Failed to generate a unique purchase category id, please retry');
}

async function getPurchaseCategories(company_id, { page = 1, deleted = false, limit = 20, search = '', status }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    // deleted=true lists the soft-deleted rows instead (to restore them).
    ...(deleted ? { deleted_at: { not: null } } : {}),
    // status=ACTIVE/INACTIVE (any case); missing = any.
    ...compact({ status: choice('status', status, ['ACTIVE', 'INACTIVE']) }),
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
    purchaseCategoryRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    purchaseCategoryRepository.count(where),
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

async function getPurchaseCategoryById(id, company_id) {
  return purchaseCategoryRepository.findByIdAndCompany(id, company_id);
}

async function updatePurchaseCategory(id, data) {
  return purchaseCategoryRepository.update(id, data);
}

async function deletePurchaseCategory(id) {
  return purchaseCategoryRepository.delete(id);
}

module.exports = {
  PurchaseCategoryError,
  createPurchaseCategory,
  getPurchaseCategories,
  getPurchaseCategoryById,
  updatePurchaseCategory,
  deletePurchaseCategory,
};
