const { Prisma } = require('@prisma/client');
const productRepository = require('../repositories/productRepository');
const productCategoryRepository = require('../repositories/productCategoryRepository');
const unitRepository = require('../repositories/unitRepository');
const { generateProductId } = require('../utils/productId');

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

async function assertValidCategory(category_id) {
  if (category_id === undefined || category_id === null) {
    return;
  }

  const category = await productCategoryRepository.findById(category_id);
  if (!category) {
    throw new ProductError('category_id does not reference an existing product category');
  }
}

async function assertValidUnit(unit_id) {
  if (unit_id === undefined || unit_id === null) {
    return;
  }

  const unit = await unitRepository.findById(unit_id);
  if (!unit) {
    throw new ProductError('unit_id does not reference an existing unit');
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

async function createProduct(data) {
  const { id, onboarding_status, ...rest } = data;
  await assertValidCategory(rest.category_id);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await productRepository.create({
        id: generateProductId(),
        product_name: rest.product_name,
        category_id: rest.category_id,
        gender: rest.gender,
        design_pattern: rest.design_pattern,
        onboarding_status: 'pending',
      });
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique product id, please retry');
}

async function getProducts({ page = 1, limit = 20, search = '', category_id, status }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(category_id ? { category_id } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { product_name: { contains: search, mode: 'insensitive' } },
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

async function getProductById(id) {
  return productRepository.findById(id);
}

async function updateProduct(id, data) {
  const { id: _id, onboarding_status, ...rest } = data;

  if (rest.category_id !== undefined) {
    await assertValidCategory(rest.category_id);
  }
  if (rest.unit_id !== undefined) {
    await assertValidUnit(rest.unit_id);
  }

  await productRepository.update(id, rest);
  return recomputeOnboardingStatus(id);
}

async function updateProductStep2(id, data) {
  if (data.unit_id !== undefined) {
    await assertValidUnit(data.unit_id);
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
