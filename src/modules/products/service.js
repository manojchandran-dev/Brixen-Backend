const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const { setStock } = require('../inventory/stock');
const { exact, choice, dateRange, dayRangeIST, bool, compact } = require('../../utils/listFilters');
const productRepository = require('./repository');
const productCategoryRepository = require('../masters/productCategories/repository');
const unitRepository = require('../masters/units/repository');
const companyRepository = require('../companies/repository');
const { generateProductId } = require('../../utils/productId');

const MAX_ID_ATTEMPTS = 5;

const STEP2_FIELDS = ['unit_id', 'color', 'size'];
const STEP3_FIELDS = ['cost_price', 'retail_price', 'wholesale_price'];
const STEP4_FIELDS = ['gallery_urls', 'status'];

class ProductError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new ProductError('company_id does not reference an existing company');
  }
}

async function assertValidCategory(category_id, company_id) {
  if (category_id === undefined || category_id === null) {
    return;
  }

  const category = await productCategoryRepository.findByIdAndCompany(category_id, company_id);
  if (!category) {
    throw new ProductError('category_id does not reference an existing product category for this company');
  }
}

async function assertValidUnit(unit_id, company_id) {
  if (unit_id === undefined || unit_id === null) {
    return;
  }

  const unit = await unitRepository.findByIdAndCompany(unit_id, company_id);
  if (!unit) {
    throw new ProductError('unit_id does not reference an existing unit for this company');
  }
}

function isStepComplete(product, fields) {
  return fields.every((field) => product[field] !== null && product[field] !== undefined && product[field] !== '');
}

function computeOnboardingStatus(product) {
  return isStepComplete(product, STEP3_FIELDS) ? 'completed' : 'pending';
}

async function recomputeOnboardingStatus(id) {
  const product = await productRepository.findById(id);
  const onboarding_status = computeOnboardingStatus(product);

  if (product.onboarding_status === onboarding_status) {
    return product;
  }

  return productRepository.update(id, { onboarding_status });
}

async function createProduct(company_id, data, actorId = null) {
  const { id, onboarding_status, company_id: _companyId, ...rest } = data;
  await assertValidCompany(company_id);
  await assertValidCategory(rest.category_id, company_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      const product = await productRepository.create({
        id: generateProductId(),
        company_id,
        product_name: rest.product_name,
        category_id: rest.category_id,
        gender: rest.gender,
        design_pattern: rest.design_pattern,
        ...(rest.low_stock_threshold !== undefined ? { low_stock_threshold: rest.low_stock_threshold } : {}),
        onboarding_status: 'pending',
      });
      // Opening stock goes through the ledger like any other stock change.
      if (Number.isInteger(rest.stock_quantity) && rest.stock_quantity !== 0) {
        await prisma.$transaction((tx) =>
          setStock(tx, { product_id: product.id, quantity: rest.stock_quantity, company_id, reason: 'opening', created_by: actorId })
        );
        return productRepository.findById(product.id);
      }
      return product;
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique product id, please retry');
}

const PRODUCT_STATUSES = ['Active', 'Inactive'];
const PRODUCT_GENDERS = ['Men', 'Women', 'Unisex', 'Kids'];

// filters: category_id, status, gender.
async function getProducts(company_id, { page = 1, deleted = false, limit = 20, search = '', category_id, status, filters = {} }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    // deleted=true lists the soft-deleted rows instead (to restore them).
    ...(deleted ? { deleted_at: { not: null } } : {}),
    ...(category_id ? { category_id } : {}),
    ...compact({
      status: choice('status', status, PRODUCT_STATUSES),
      gender: choice('gender', filters.gender, PRODUCT_GENDERS),
    }),
    ...(search
      ? {
          OR: [
            { product_name: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
            { product_categories: { name: { contains: search, mode: 'insensitive' } } },
            { color: { contains: search, mode: 'insensitive' } },
            { design_pattern: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    productRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    productRepository.count(where),
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

async function getProductById(id, company_id) {
  return productRepository.findByIdAndCompany(id, company_id);
}

async function updateProduct(id, company_id, data, actorId = null) {
  // stock_quantity is not written directly: setting it records a 'correction'
  // in the stock ledger (see inventory/stock.js).
  const { id: _id, onboarding_status, company_id: _companyId, stock_quantity, ...rest } = data;

  if (rest.category_id !== undefined) {
    await assertValidCategory(rest.category_id, company_id);
  }
  if (rest.unit_id !== undefined) {
    await assertValidUnit(rest.unit_id, company_id);
  }

  if (Object.keys(rest).length) await productRepository.update(id, rest);
  if (stock_quantity !== undefined) {
    await prisma.$transaction((tx) =>
      setStock(tx, { product_id: id, quantity: stock_quantity, company_id, reason: 'correction', created_by: actorId })
    );
  }
  return recomputeOnboardingStatus(id);
}

async function updateProductStep2(id, company_id, data) {
  if (data.unit_id !== undefined) {
    await assertValidUnit(data.unit_id, company_id);
  }

  const payload = STEP2_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await productRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
}

async function updateProductStep3(id, data) {
  const payload = STEP3_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await productRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
}

async function updateProductStep4(id, data) {
  const payload = STEP4_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await productRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
}

async function deleteProduct(id) {
  return productRepository.delete(id);
}

module.exports = {
  ProductError,
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStep2,
  updateProductStep3,
  updateProductStep4,
  deleteProduct,
};
