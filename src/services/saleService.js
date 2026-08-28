const { Prisma } = require('@prisma/client');
const saleRepository = require('../repositories/saleRepository');
const customerRepository = require('../repositories/customerRepository');
const companyRepository = require('../repositories/companyRepository');
const { generateSaleId } = require('../utils/saleId');

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

function resolveTotal(subtotal, tax_amount, total_amount) {
  if (total_amount !== undefined && total_amount !== null) {
    return total_amount;
  }
  return Number(subtotal) + Number(tax_amount || 0);
}

async function createSale(company_id, data) {
  await assertValidCompany(company_id);
  await assertValidCustomer(data.customer_id, company_id);

  const tax_amount = data.tax_amount ?? 0;
  const total_amount = resolveTotal(data.subtotal, tax_amount, data.total_amount);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await saleRepository.create({
        id: generateSaleId(),
        company_id,
        bill_date: data.bill_date,
        customer_id: data.customer_id,
        invoice_type: data.invoice_type,
        bill_image_url: data.bill_image_url,
        subtotal: data.subtotal,
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
    company_id,
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

async function deleteSale(id) {
  return saleRepository.delete(id);
}

module.exports = {
  SaleError,
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
};
