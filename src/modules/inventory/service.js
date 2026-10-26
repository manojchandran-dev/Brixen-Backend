const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const { applyStock, setStock } = require('./stock');
const { resolveVariant, variantLabel, VariantError } = require('../products/variants');
const { dayRangeIST, FilterError } = require('../../utils/listFilters');

const STOCK_STATUSES = ['in', 'low', 'out'];
const REASONS = ['correction', 'damage', 'return', 'opening', 'other'];
const MOVEMENT_TYPES = ['purchase', 'sale', 'adjustment'];

const page = (q) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, pageNo, offset: (pageNo - 1) * limit };
};

// One stock row per size/colour; a product without variants is one row of
// its own. QTY/COST are that row's stock and cost (a variant's cost falls
// back to the product's).
const QTY = Prisma.sql`coalesce(v.stock_quantity, p.stock_quantity)`;
const COST = Prisma.sql`coalesce(v.cost_price, p.cost_price)`;

// out = 0 or less, low = at or below the product's threshold, in = above it.
const STATUS_SQL = Prisma.sql`CASE WHEN ${QTY} <= 0 THEN 'out'
  WHEN ${QTY} <= p.low_stock_threshold THEN 'low' ELSE 'in' END`;

// GET /inventory: every product — one row per size/colour — with its
// stock, status and value, plus a summary. Raw SQL skips the soft-delete
// extension, so deleted_at is explicit.
async function overview(company_id, q) {
  if (q.stock_status && !STOCK_STATUSES.includes(q.stock_status)) {
    throw new FilterError(`stock_status must be one of: ${STOCK_STATUSES.join(', ')}`);
  }
  const { limit, pageNo, offset } = page(q);
  const search = q.search?.trim();
  const like = search ? '%' + search + '%' : null;
  const base = Prisma.sql`p.deleted_at IS NULL
    ${company_id ? Prisma.sql`AND p.company_id = ${company_id}` : Prisma.empty}
    ${q.category_id ? Prisma.sql`AND p.category_id = ${q.category_id}` : Prisma.empty}
    ${like ? Prisma.sql`AND (p.product_name ILIKE ${like} OR p.id ILIKE ${like} OR p.product_code ILIKE ${like} OR c.name ILIKE ${like} OR v.sku ILIKE ${like} OR v.size ILIKE ${like} OR v.color ILIKE ${like})` : Prisma.empty}`;
  const where = q.stock_status ? Prisma.sql`${base} AND ${STATUS_SQL} = ${q.stock_status}` : base;
  const from = Prisma.sql`FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.deleted_at IS NULL
    LEFT JOIN product_categories c ON c.id = p.category_id
    LEFT JOIN units u ON u.id = p.unit_id`;

  const [items, [summary]] = await Promise.all([
    prisma.$queryRaw`
      SELECT p.id, v.id AS variant_id, coalesce(v.size, p.size) AS size,
             coalesce(v.color, p.color) AS color, coalesce(v.sku, p.product_code) AS sku,
             p.product_name, p.category_id, c.name AS category_name, u.unit,
             ${QTY} AS stock_quantity, p.low_stock_threshold, ${COST} AS cost_price,
             round(greatest(${QTY}, 0) * coalesce(${COST}, 0), 2)::float AS stock_value,
             ${STATUS_SQL} AS stock_status
      ${from} WHERE ${where}
      ORDER BY ${QTY} ASC, p.product_name ASC, v.size ASC, v.color ASC
      LIMIT ${limit} OFFSET ${offset}`,
    // Summary follows search/category, not the stock_status chip. "products"
    // counts stock rows (each size/colour separately).
    prisma.$queryRaw`
      SELECT count(*)::int AS products,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'in')::int AS in_stock,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'low')::int AS low_stock,
             count(*) FILTER (WHERE ${STATUS_SQL} = 'out')::int AS out_of_stock,
             coalesce(sum(greatest(${QTY}, 0)), 0)::int AS total_units,
             coalesce(round(sum(greatest(${QTY}, 0) * coalesce(${COST}, 0)), 2), 0)::float AS stock_value,
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
    ...(q.variant_id ? { variant_id: q.variant_id } : {}),
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
      include: {
        products: { select: { product_name: true } },
        product_variants: { select: { size: true, color: true } },
      },
    }),
    prisma.stock_movements.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  const actors = actorIds.length ? await prisma.users.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [];
  const email = new Map(actors.map((a) => [a.id, a.email]));
  return {
    items: rows.map(({ products, product_variants, ...m }) => ({
      ...m,
      product_name: products?.product_name ?? null,
      variant_label: product_variants ? variantLabel(product_variants) : null,
      created_by_email: email.get(m.created_by) ?? null,
    })),
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
  // A product with sizes/colours: stock is per size, so one must be named
  // (or the product has just one).
  let variant;
  try {
    variant = await resolveVariant(product_id, body.variant_id || null, company_id);
  } catch (err) {
    if (err instanceof VariantError) throw new InventoryError(err.message, err.status);
    throw err;
  }
  const variant_id = variant?.id ?? null;

  const movement = { company_id, reason, note: note ?? null, created_by: actorId };
  const result = await prisma.$transaction((tx) =>
    hasSet
      ? setStock(tx, { product_id, variant_id, quantity: set_to, ...movement })
      : applyStock(tx, [{ product_id, variant_id, delta: quantity }], { type: 'adjustment', ...movement }).then(([r]) => r)
  );
  return {
    product_id,
    variant_id,
    product_name: product.product_name,
    variant_label: variant ? variantLabel(variant) : null,
    change: result.delta,
    stock_quantity: result.balance_after,
  };
}

module.exports = { overview, movements, adjust, InventoryError };
