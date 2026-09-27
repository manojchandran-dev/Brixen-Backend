const { Prisma } = require('@prisma/client');
const { exact, choice, dateRange, dayRangeIST, bool, compact } = require('../../utils/listFilters');
const prisma = require('../../prisma/client');
const { applyStock, netChanges } = require('../inventory/stock');
const { sales: saleRepository, saleItems: saleItemRepository } = require('./repository');
const customerRepository = require('../customers/repository');
const companyRepository = require('../companies/repository');
const productRepository = require('../products/repository');
const { generateSaleId } = require('../../utils/saleId');
const { generateSaleItemId } = require('../../utils/saleItemId');

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
        // Paid means fully paid unless an amount is given.
        amount_paid: data.amount_paid ?? ((data.payment_status || 'Pending') === 'Paid' ? total_amount : 0),
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

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partial'];

// filters: payment_status, payment_type, invoice_type, from/to on bill_date.
async function getSales(company_id, { page = 1, limit = 20, search = '', customer_id, filters = {} }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(customer_id ? { customer_id } : {}),
    ...compact({
      payment_status: choice('payment_status', filters.payment_status, PAYMENT_STATUSES),
      payment_type: exact(filters.payment_type),
      invoice_type: exact(filters.invoice_type),
      bill_date: dateRange(filters.from, filters.to),
    }),
    ...(search
      ? {
          OR: [
            { customers: { name: { contains: search, mode: 'insensitive' } } },
            { customers: { shop_name: { contains: search, mode: 'insensitive' } } },
            { invoice_type: { contains: search, mode: 'insensitive' } },
            { payment_status: { contains: search, mode: 'insensitive' } },
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

  // Marking a sale Paid without an amount means it's fully paid; the amount
  // paid can't exceed the total.
  if (rest.amount_paid !== undefined || rest.payment_status === 'Paid') {
    const existing = await saleRepository.findByIdAndCompany(id, company_id);
    const total = Number(rest.total_amount ?? existing.total_amount ?? 0);
    if (rest.amount_paid === undefined) rest.amount_paid = total;
    if (Number(rest.amount_paid) > total) throw new SaleError('amount_paid cannot be more than the sale total');
  }

  return saleRepository.update(id, rest);
}

// Sales move stock OUT (sign -1) through the shared ledger. Stock may go
// negative: an oversell shows as out of stock rather than blocking the sale.
const saleStock = (tx, oldItems, newItems, { company_id, reference_id, created_by }) =>
  applyStock(tx, netChanges(oldItems, newItems, -1), { company_id, type: 'sale', reference_id, created_by });

// Replaces the sale's lines. In one transaction: stock moves by the net
// change, and each line snapshots cost_price -- a product already on the
// sale keeps its original cost, so editing an old sale doesn't reprice it.
async function updateSaleStep2(id, company_id, data, actorId = null) {
  const { items, tax_percentage } = data;

  for (const item of items) {
    await assertValidProduct(item.product_id, company_id);
  }
  const products = await productRepository.findManyByIdsAndCompany([...new Set(items.map((i) => i.product_id))], company_id);
  const currentCost = new Map(products.map((p) => [p.id, p.cost_price]));

  let subtotal = 0;
  const preparedItems = items.map((item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    const line_total = round2(price * quantity);
    subtotal += line_total;
    return {
      id: generateSaleItemId(),
      sale_id: id,
      company_id,
      product_id: item.product_id,
      product_name: item.product_name,
      price_type: item.price_type,
      price,
      quantity,
      line_total,
    };
  });

  subtotal = round2(subtotal);
  const taxPct = tax_percentage !== undefined && tax_percentage !== null ? Number(tax_percentage) : 0;
  const tax_amount = round2((subtotal * taxPct) / 100);
  const total_amount = round2(subtotal + tax_amount);

  await prisma.$transaction(
    async (tx) => {
      const sale = await tx.sales.findUnique({ where: { id }, select: { payment_status: true } });
      const oldItems = await tx.sale_items.findMany({ where: { sale_id: id } });
      const keptCost = new Map(oldItems.map((i) => [i.product_id, i.cost_price]));
      for (const item of preparedItems) {
        item.cost_price = keptCost.has(item.product_id) ? keptCost.get(item.product_id) : currentCost.get(item.product_id) ?? null;
      }

      await saleStock(tx, oldItems, preparedItems, { company_id, reference_id: id, created_by: actorId });
      await tx.sale_items.deleteMany({ where: { sale_id: id } });
      await tx.sale_items.createMany({ data: preparedItems });
      await tx.sales.update({
        where: { id },
        data: {
          subtotal,
          tax_percentage: taxPct,
          tax_amount,
          total_amount,
          // A paid sale stays fully paid when its total changes.
          ...(sale.payment_status === 'Paid' ? { amount_paid: total_amount } : {}),
        },
      });
    },
    { timeout: 30000, maxWait: 10000 }
  );

  return saleRepository.findByIdAndCompany(id, company_id);
}

// Deleting a sale puts its quantities back in stock (same transaction).
async function deleteSale(id, actorId = null) {
  return prisma.$transaction(
    async (tx) => {
      const { company_id } = await tx.sales.findUnique({ where: { id }, select: { company_id: true } });
      const oldItems = await tx.sale_items.findMany({ where: { sale_id: id } });
      await saleStock(tx, oldItems, [], { company_id, reference_id: id, created_by: actorId });
      return tx.sales.delete({ where: { id } });
    },
    { timeout: 30000, maxWait: 10000 }
  );
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
