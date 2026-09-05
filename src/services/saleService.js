const { Prisma } = require('@prisma/client');
const saleRepository = require('../repositories/saleRepository');
const customerRepository = require('../repositories/customerRepository');
const companyRepository = require('../repositories/companyRepository');
const productRepository = require('../repositories/productRepository');
const saleItemRepository = require('../repositories/saleItemRepository');
const { generateSaleId } = require('../utils/saleId');
const { generateSaleItemId } = require('../utils/saleItemId');

const MAX_ID_ATTEMPTS = 5;

class SaleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new SaleError('company_id does not reference an existing company');
  }
}

async function assertValidCustomer(customer_id, company_id) {
  if (customer_id === undefined || customer_id === null) {
    return;
  }

  const customer = await customerRepository.findByIdAndCompany(customer_id, company_id);
  if (!customer) {
    throw new SaleError('customer_id does not reference an existing customer for this company');
  }
}

async function assertValidProduct(product_id, company_id) {
  const product = await productRepository.findByIdAndCompany(product_id, company_id);
  if (!product) {
    throw new SaleError(`product_id ${product_id} does not reference an existing product for this company`);
  }
}

function resolveTotal(subtotal, tax_amount, total_amount) {
  if (total_amount !== undefined && total_amount !== null) {
    return total_amount;
  }
  return Number(subtotal) + Number(tax_amount || 0);
}

function round2(value) {
  return Number(value.toFixed(2));
}

async function createSale(company_id, data) {
  await assertValidCompany(company_id);
  await assertValidCustomer(data.customer_id, company_id);

  const subtotal = data.subtotal ?? 0;
  const tax_percentage = data.tax_percentage ?? 0;
  const tax_amount = data.tax_amount ?? 0;
  const total_amount = resolveTotal(subtotal, tax_amount, data.total_amount);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await saleRepository.create({
        id: generateSaleId(),
        company_id,
        bill_date: data.bill_date,
        customer_id: data.customer_id,
        invoice_type: data.invoice_type,
        bill_image_url: data.bill_image_url,
        subtotal,
        tax_percentage,
        tax_amount,
        total_amount,
        payment_type: data.payment_type,
        payment_status: data.payment_status || 'Pending',
        notes: data.notes,
      });
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique sale id, please retry');
}

async function getSales(company_id, { page = 1, limit = 20, search = '', customer_id, payment_status, from, to }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(customer_id ? { customer_id } : {}),
    ...(payment_status ? { payment_status } : {}),
    ...(from || to ? { bill_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { invoice_type: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { payment_type: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    saleRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    saleRepository.count(where),
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

async function getSaleItems(id, company_id) {
  const sale = await saleRepository.findByIdAndCompany(id, company_id);
  if (!sale) {
    return null;
  }
  return saleItemRepository.findManyBySaleId(id);
}

async function getSaleById(id, company_id) {
  return saleRepository.findByIdAndCompany(id, company_id);
}

async function updateSale(id, company_id, data) {
  const { id: _id, company_id: _companyId, ...rest } = data;

  if (rest.customer_id !== undefined) {
    await assertValidCustomer(rest.customer_id, company_id);
  }

  if (rest.subtotal !== undefined || rest.tax_amount !== undefined) {
    const existing = await saleRepository.findByIdAndCompany(id, company_id);
    const subtotal = rest.subtotal !== undefined ? rest.subtotal : existing.subtotal;
    const tax_amount = rest.tax_amount !== undefined ? rest.tax_amount : existing.tax_amount;
    if (rest.total_amount === undefined) {
      rest.total_amount = resolveTotal(subtotal, tax_amount, undefined);
    }
  }

  return saleRepository.update(id, rest);
}

async function updateSaleStep2(id, company_id, data) {
  const { items, tax_percentage } = data;

  const preparedItems = [];
  let subtotal = 0;

  for (const item of items) {
    await assertValidProduct(item.product_id, company_id);

    const price = Number(item.price);
    const quantity = Number(item.quantity);
    const line_total = round2(price * quantity);
    subtotal += line_total;

    preparedItems.push({
      id: generateSaleItemId(),
      sale_id: id,
      product_id: item.product_id,
      product_name: item.product_name,
      price_type: item.price_type,
      price,
      quantity,
      line_total,
    });
  }

  subtotal = round2(subtotal);
  const taxPct = tax_percentage !== undefined && tax_percentage !== null ? Number(tax_percentage) : 0;
  const tax_amount = round2((subtotal * taxPct) / 100);
  const total_amount = round2(subtotal + tax_amount);

  await saleItemRepository.deleteManyBySaleId(id);
  await saleItemRepository.createMany(preparedItems);
  await saleRepository.update(id, { subtotal, tax_percentage: taxPct, tax_amount, total_amount });

  return saleRepository.findByIdAndCompany(id, company_id);
}

async function deleteSale(id) {
  return saleRepository.delete(id);
}

module.exports = {
  SaleError,
  createSale,
  getSales,
  getSaleById,
  getSaleItems,
  updateSale,
  updateSaleStep2,
  deleteSale,
};
