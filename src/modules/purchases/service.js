const prisma = require('../../prisma/client');
const prefixedId = require('../../utils/prefixedId');
const { applyStock, netChanges } = require('../inventory/stock');
const { exact, choice, dateRange, compact } = require('../../utils/listFilters');

// Supplier bills. Saving a purchase's lines adds their quantities to stock
// (through the ledger); editing moves stock by the net change; deleting takes
// it back out. Payment fields mirror sales.

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partial'];
const PAYMENT_TYPES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const HEADER_FIELDS = ['supplier_name', 'bill_no', 'bill_date', 'invoice_type', 'bill_image_url', 'payment_type', 'payment_status', 'notes'];

class PurchaseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;
const INCLUDE = { purchase_items: { orderBy: { created_at: 'asc' } } };

function validHeader(body, { creating }) {
  const out = {};
  for (const f of HEADER_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (creating || out.supplier_name !== undefined) {
    if (typeof out.supplier_name !== 'string' || !out.supplier_name.trim()) throw new PurchaseError('supplier_name is required');
    out.supplier_name = out.supplier_name.trim();
  }
  for (const f of ['bill_no', 'invoice_type', 'bill_image_url', 'notes']) {
    if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') throw new PurchaseError(`${f} must be a string`);
  }
  if (out.bill_date !== undefined && out.bill_date !== null) {
    const d = new Date(out.bill_date);
    if (Number.isNaN(d.getTime())) throw new PurchaseError('bill_date must be a valid date');
    out.bill_date = d;
  }
  if (out.payment_status !== undefined) out.payment_status = choice('payment_status', out.payment_status, PAYMENT_STATUSES).equals;
  if (out.payment_type !== undefined && out.payment_type !== null) out.payment_type = choice('payment_type', out.payment_type, PAYMENT_TYPES).equals;
  return out;
}

// Lines -> prepared rows + subtotal. Every product must belong to the company.
async function prepareLines(company_id, purchase_id, items) {
  if (!Array.isArray(items)) throw new PurchaseError('items must be an array');
  const ids = [...new Set(items.map((i) => i?.product_id))];
  const products = await prisma.products.findMany({ where: { id: { in: ids.filter(Boolean) }, company_id } });
  const byId = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;
  const lines = items.map((item, i) => {
    const product = byId.get(item?.product_id);
    if (!product) throw new PurchaseError(`items[${i}].product_id is not a product of this company`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new PurchaseError(`items[${i}].quantity must be a whole number above 0`);
    const unit_cost = Number(item.unit_cost);
    if (item.unit_cost === undefined || Number.isNaN(unit_cost) || unit_cost < 0) throw new PurchaseError(`items[${i}].unit_cost must be 0 or more`);
    const line_total = round2(unit_cost * item.quantity);
    subtotal += line_total;
    return { id: prefixedId('PURI'), purchase_id, company_id, product_id: product.id, product_name: product.product_name, quantity: item.quantity, unit_cost, line_total };
  });
  return { lines, subtotal: round2(subtotal) };
}

function totals(subtotal, taxPct) {
  const tax_amount = round2((subtotal * taxPct) / 100);
  return { subtotal, tax_percentage: taxPct, tax_amount, total_amount: round2(subtotal + tax_amount) };
}

function taxPercent(body, fallback) {
  if (body.tax_percentage === undefined || body.tax_percentage === null) return fallback;
  const t = Number(body.tax_percentage);
  if (Number.isNaN(t) || t < 0 || t > 100) throw new PurchaseError('tax_percentage must be between 0 and 100');
  return t;
}

// Paid means fully paid unless an amount is given; never above the total.
function amountPaid(body, status, total, current) {
  let paid = body.amount_paid !== undefined ? Number(body.amount_paid) : status === 'Paid' ? total : current;
  if (Number.isNaN(paid) || paid < 0) throw new PurchaseError('amount_paid must be 0 or more');
  if (status === 'Paid' && body.amount_paid === undefined) paid = total;
  if (paid > total) throw new PurchaseError('amount_paid cannot be more than the purchase total');
  return paid;
}

async function create(company_id, body, actorId) {
  const header = validHeader(body, { creating: true });
  const id = prefixedId('PUR');
  const { lines, subtotal } = await prepareLines(company_id, id, body.items ?? []);
  const t = totals(subtotal, taxPercent(body, 0));
  const status = header.payment_status ?? 'Pending';

  await prisma.$transaction(
    async (tx) => {
      await tx.purchases.create({
        data: { id, company_id, ...header, payment_status: status, ...t, amount_paid: amountPaid(body, status, t.total_amount, 0), created_by: actorId },
      });
      if (lines.length) await tx.purchase_items.createMany({ data: lines });
      await applyStock(tx, netChanges([], lines, +1), { company_id, type: 'purchase', reference_id: id, created_by: actorId });
    },
    { timeout: 30000, maxWait: 10000 }
  );
  return get(id, company_id);
}

async function list(company_id, q) {
  const take = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);
  const search = q.search?.trim();
  const where = {
    ...(company_id ? { company_id } : {}),
    ...compact({
      payment_status: choice('payment_status', q.payment_status, PAYMENT_STATUSES),
      payment_type: exact(q.payment_type),
      bill_date: dateRange(q.from, q.to),
    }),
    ...(q.product_id ? { purchase_items: { some: { product_id: q.product_id } } } : {}),
    ...(search
      ? {
          OR: [
            { supplier_name: { contains: search, mode: 'insensitive' } },
            { bill_no: { contains: search, mode: 'insensitive' } },
            { invoice_type: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { purchase_items: { some: { product_name: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.purchases.findMany({ where, include: INCLUDE, orderBy: [{ bill_date: 'desc' }, { created_at: 'desc' }], skip: (pageNo - 1) * take, take }),
    prisma.purchases.count({ where }),
  ]);
  return { items, meta: { page: pageNo, limit: take, total, pages: Math.ceil(total / take) } };
}

async function get(id, company_id) {
  const purchase = await prisma.purchases.findFirst({ where: { id, company_id }, include: INCLUDE });
  if (!purchase) throw new PurchaseError('Purchase not found', 404);
  return purchase;
}

// Header fields always; lines only when `items` is sent (replaces them all).
async function update(id, company_id, body, actorId) {
  const current = await get(id, company_id);
  const header = validHeader(body, { creating: false });
  const newLines = body.items !== undefined ? (await prepareLines(company_id, id, body.items)).lines : null;
  const subtotal = newLines ? round2(newLines.reduce((n, l) => n + l.line_total, 0)) : Number(current.subtotal);
  const t = totals(subtotal, taxPercent(body, Number(current.tax_percentage ?? 0)));
  const status = header.payment_status ?? current.payment_status;

  await prisma.$transaction(
    async (tx) => {
      if (newLines) {
        await applyStock(tx, netChanges(current.purchase_items, newLines, +1), { company_id, type: 'purchase', reference_id: id, created_by: actorId });
        await tx.purchase_items.deleteMany({ where: { purchase_id: id } });
        if (newLines.length) await tx.purchase_items.createMany({ data: newLines });
      }
      await tx.purchases.update({
        where: { id },
        data: { ...header, ...t, amount_paid: amountPaid(body, status, t.total_amount, Number(current.amount_paid)) },
      });
    },
    { timeout: 30000, maxWait: 10000 }
  );
  return get(id, company_id);
}

// Takes the purchase's quantities back out of stock, then deletes it.
async function remove(id, company_id, actorId) {
  const current = await get(id, company_id);
  await prisma.$transaction(
    async (tx) => {
      await applyStock(tx, netChanges(current.purchase_items, [], +1), { company_id, type: 'purchase', reference_id: id, created_by: actorId, note: 'Purchase deleted' });
      await tx.purchases.delete({ where: { id } });
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

module.exports = { PurchaseError, create, list, get, update, remove };
