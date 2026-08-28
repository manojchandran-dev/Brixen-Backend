const { Prisma } = require('@prisma/client');
const productCategoryRepository = require('../repositories/productCategoryRepository');
const companyRepository = require('../repositories/companyRepository');
const { generateProductCategoryId } = require('../utils/productCategoryId');

const MAX_ID_ATTEMPTS = 5;

class ProductCategoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new ProductCategoryError('company_id does not reference an existing company');
  }
}

async function createProductCategory(company_id, data) {
  await assertValidCompany(company_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await productCategoryRepository.create({
        id: generateProductCategoryId(),
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

  throw new Error('Failed to generate a unique product category id, please retry');
}

async function getProductCategories(company_id, { page = 1, limit = 20, search = '' }) {
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
    productCategoryRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    productCategoryRepository.count(where),
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

async function getProductCategoryById(id, company_id) {
  return productCategoryRepository.findByIdAndCompany(id, company_id);
}

async function updateProductCategory(id, data) {
  return productCategoryRepository.update(id, data);
}

async function deleteProductCategory(id) {
  return productCategoryRepository.delete(id);
}

module.exports = {
  ProductCategoryError,
  createProductCategory,
  getProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
};
