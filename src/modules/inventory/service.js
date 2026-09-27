const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const { applyStock, setStock } = require('./stock');
const { dayRangeIST, FilterError } = require('../../utils/listFilters');

const STOCK_STATUSES = ['in', 'low', 'out'];
const REASONS = ['correction', 'damage', 'return', 'opening', 'other'];
const MOVEMENT_TYPES = ['purchase', 'sale', 'adjustment'];

const page = (q) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, pageNo, offset: (pageNo - 1) * limit };
};

// out = 0 or less, low = at or below the product's threshold, in = above it.
const STATUS_SQL = Prisma.sql`CASE WHEN p.stock_quantity <= 0 THEN 'out'
  WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low' ELSE 'in' END`;

// GET /inventory: every product with its stock, status and value, plus a
// summary. Raw SQL skips the soft-delete extension, so deleted_at is explicit.
async function overview(company_id, q) {
  if (q.stock_status && !STOCK_STATUSES.includes(q.stock_status)) {
    throw new FilterError(`stock_status must be one of: ${STOCK_STATUSES.join(', ')}`);
  }
  const { limit, pageNo, offset } = page(q);
  const search = q.search?.trim();
  const base = Prisma.sql`p.deleted_at IS NULL
    ${company_id ? Prisma.sql`AND p.company_id = ${company_id}` : Prisma.empty}
    ${q.category_id ? Prisma.sql`AND p.category_id = ${q.category_id}` : Prisma.empty}
    ${search ? Prisma.sql`AND (p.product_name ILIKE ${'%' + search + '%'} OR p.id ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'})` : Prisma.empty}`;
  const where = q.stock_status ? Prisma.sql`${base} AND ${STATUS_SQL} = ${q.stock_status}` : base;
  const from = Prisma.sql`FROM products p LEFT JOIN product_categories c ON c.id = p.category_id LEFT JOIN units u ON u.id = p.unit_id`;

  const [items, [summary]] = await Promise.all([
    prisma.$queryRaw`
      SELECT p.id, p.product_name, p.category_id, c.name AS category_name, u.unit,
             p.stock_quantity, p.low_stock_threshold, p.cost_price,
             round(greatest(p.stock_quantity, 0) * coalesce(p.cost_price, 0), 2)::float AS stock_value,
             ${STATUS_SQL} AS stock_status
      ${from} WHERE ${where}
      ORDER BY p.stock_quantity ASC, p.product_name ASC
      LIMIT ${limit} OFFSET ${offset}`,
    // Summary follows search/category, not the stock_status chip.
    prisma.$queryRaw`
      SELECT count(*)::int AS products,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'in')::int AS in_stock,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'low')::int AS low_stock,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'out')::int AS out_of_stock,
             coalesce(sum(greatest(p.stock_quantity, 0)), 0)::int AS total_units,
             coalesce(round(sum(greatest(p.stock_quantity, 0) * coalesce(p.cost_price, 0)), 2), 0)::float AS stock_value,
             count(*) FILTER (WHERE ${where})::int AS matching
      ${from} WHERE ${base}`,
  ]);
  const { matching, ...totals } = summary;
  return { items, summary: totals, meta: { page: pageNo, limit, total: matching, pages: Math.ceil(matching / limit) } };
}

// GET /inventory/movements: the stock ledger, newest first.
async function movements(company_id, q) {
  if (q.type && !MOVEMENT_TYPES.includes(q.type)) throw new FilterError(`type must be one of: ${MOVEMENT_TYPES.join(', ')}`);
  const { limit, pageNo } = page(q);
  const where = {
    ...(company_id ? { company_id } : {}),
    ...(q.product_id ? { product_id: q.product_id } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.reason ? { reason: q.reason } : {}),
    ...(dayRangeIST(q.from, q.to) ? { created_at: dayRangeIST(q.from, q.to) } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.stock_movements.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (pageNo - 1) * limit,
      take: limit,
      include: { products: { select: { product_name: true } } },
    }),
    prisma.stock_movements.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  const actors = actorIds.length ? await prisma.users.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [];
  const email = new Map(actors.map((a) => [a.id, a.email]));
  return {
    items: rows.map(({ products, ...m }) => ({ ...m, product_name: products?.product_name ?? null, created_by_email: email.get(m.created_by) ?? null })),
    meta: { page: pageNo, limit, total, pages: Math.ceil(total / limit) },
  };
}

class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// POST /inventory/adjustments -- either { quantity: +n/-n } (a change) or
// { set_to: n } (a stock-take count). reason is required.
async function adjust(company_id, body, actorId) {
  const { product_id, quantity, set_to, reason, note } = body;
  if (typeof product_id !== 'string' || !product_id) throw new InventoryError('product_id is required');
  if (!REASONS.includes(reason)) throw new InventoryError(`reason must be one of: ${REASONS.join(', ')}`);
  const hasQty = quantity !== undefined;
  const hasSet = set_to !== undefined;
  if (hasQty === hasSet) throw new InventoryError('send either quantity (a +/- change) or set_to (the counted stock)');
  if (hasQty && !(Number.isInteger(quantity) && quantity !== 0)) throw new InventoryError('quantity must be a whole number other than 0');
  if (hasSet && !(Number.isInteger(set_to) && set_to >= 0)) throw new InventoryError('set_to must be a whole number, 0 or more');
  if (note !== undefined && note !== null && typeof note !== 'string') throw new InventoryError('note must be a string');

  const product = await prisma.products.findFirst({ where: { id: product_id, company_id } });
  if (!product) throw new InventoryError('Product not found', 404);

  const movement = { company_id, reason, note: note ?? null, created_by: actorId };
  const result = await prisma.$transaction((tx) =>
    hasSet
      ? setStock(tx, { product_id, quantity: set_to, ...movement })
      : applyStock(tx, [{ product_id, delta: quantity }], { type: 'adjustment', ...movement }).then(([r]) => r)
  );
  return { product_id, product_name: product.product_name, change: result.delta, stock_quantity: result.balance_after };
}

module.exports = { overview, movements, adjust, InventoryError };
