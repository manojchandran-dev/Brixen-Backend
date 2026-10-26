const prisma = require('../../prisma/client');
const prefixedId = require('../../utils/prefixedId');
const { applyStock, setStock } = require('../inventory/stock');
const { newProductCode, newVariantSku } = require('../../utils/productCode');

// A product's sizes/colours ("variants"), each with its own code, prices
// and stock. See product_variants in schema.prisma.

class VariantError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Relation includes skip the soft-delete filter, so it's explicit here.
const VARIANTS_INCLUDE = {
  product_variants: { where: { deleted_at: null }, orderBy: { created_at: 'asc' } },
};

const text = (v, field, i, max) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) {
    throw new VariantError(`variants[${i}].${field} must be text of up to ${max} characters`);
  }
  return v.trim();
};

const price = (v, field, i) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) throw new VariantError(`variants[${i}].${field} must be 0 or more`);
  return n;
};

/** "M / Blue" — what a sale line or the stock list shows. */
const variantLabel = (v) => [v.size, v.color].filter(Boolean).join(' / ');

// Checks the body and returns clean rows. Each needs a size or a colour, and
// no two may share both.
function clean(variants) {
  if (!Array.isArray(variants)) throw new VariantError('variants must be an array');
  const seen = new Set();
  return variants.map((v, i) => {
    if (!v || typeof v !== 'object') throw new VariantError(`variants[${i}] must be an object`);
    const row = {
      id: v.id ? String(v.id) : null,
      size: text(v.size, 'size', i, 50),
      color: text(v.color, 'color', i, 50),
      sku: text(v.sku, 'sku', i, 60),
      cost_price: price(v.cost_price, 'cost_price', i),
      retail_price: price(v.retail_price, 'retail_price', i),
      wholesale_price: price(v.wholesale_price, 'wholesale_price', i),
      opening_stock: v.opening_stock ?? 0,
    };
    if (!row.size && !row.color) throw new VariantError(`variants[${i}] needs a size or a colour`);
    if (!Number.isInteger(row.opening_stock) || row.opening_stock < 0) {
      throw new VariantError(`variants[${i}].opening_stock must be a whole number, 0 or more`);
    }
    const key = `${(row.size ?? '').toLowerCase()}|${(row.color ?? '').toLowerCase()}`;
    if (seen.has(key)) throw new VariantError(`"${variantLabel(row)}" is listed twice`);
    seen.add(key);
    return row;
  });
}

// PUT /products/:id/variants — replaces the product's sizes/colours:
//   - a row with the id of an existing variant updates its size, colour,
//     code and prices (its stock only changes through stock entries);
//   - a row without an id is a new variant, with opening_stock as its
//     opening stock (recorded in the ledger);
//   - an existing variant left out is removed: its stock is zeroed with a
//     correction entry, then it's soft-deleted (past sales keep it).
// The first time a product gets variants, its own stock is zeroed the same
// way, so its total stays the sum of its variants.
async function replaceVariants(product_id, company_id, body, actorId = null) {
  const product = await prisma.products.findFirst({ where: { id: product_id, company_id }, include: VARIANTS_INCLUDE });
  if (!product) throw new VariantError('Product not found', 404);
  const rows = clean(body?.variants);
  const existing = new Map(product.product_variants.map((v) => [v.id, v]));
  for (const r of rows) {
    if (r.id && !existing.has(r.id)) throw new VariantError(`Variant ${r.id} is not part of this product`);
  }
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
  const movement = { company_id, created_by: actorId };

  // A typed-in code must not be another live size's, on this product or
  // another (sizes removed in this same save don't count).
  const typed = new Set();
  for (const r of rows) {
    if (!r.sku) continue;
    const other = await prisma.product_variants.findFirst({
      where: { company_id, sku: r.sku, ...(r.id ? { id: { not: r.id } } : {}) },
      select: { id: true, product_id: true },
    });
    const freed = other && other.product_id === product_id && !keep.has(other.id);
    if ((other && !freed) || typed.has(r.sku)) {
      throw new VariantError(`Code "${r.sku}" is already used by another size`);
    }
    typed.add(r.sku);
  }

  await prisma.$transaction(
    async (tx) => {
      if (!existing.size && rows.length && product.stock_quantity !== 0) {
        await setStock(tx, { product_id, quantity: 0, ...movement, reason: 'correction', note: 'Moved to sizes' });
      }
      for (const v of existing.values()) {
        if (keep.has(v.id)) continue;
        await setStock(tx, { product_id, variant_id: v.id, quantity: 0, ...movement, reason: 'correction', note: `Size ${variantLabel(v)} removed` });
        await tx.product_variants.update({ where: { id: v.id }, data: { deleted_at: new Date() } });
      }
      // Older products get their code the first time their sizes are saved.
      let code = product.product_code;
      if (!code && rows.length) {
        code = await newProductCode(tx, company_id, product.product_name);
        await tx.products.update({ where: { id: product_id }, data: { product_code: code } });
      }
      // Sizes left without a code get one: product code + size + colour.
      for (const r of rows) {
        if (!r.sku) {
          r.sku = await newVariantSku(tx, company_id, code, r, typed, r.id);
          typed.add(r.sku);
        }
      }
      for (const r of rows) {
        const { id, opening_stock, ...fields } = r;
        if (id) {
          await tx.product_variants.update({ where: { id }, data: fields });
          continue;
        }
        const created = await tx.product_variants.create({
          data: { id: prefixedId('PVAR'), product_id, company_id, ...fields },
        });
        if (opening_stock) {
          await applyStock(tx, [{ product_id, variant_id: created.id, delta: opening_stock }], {
            type: 'adjustment',
            reason: 'opening',
            ...movement,
          });
        }
      }
    },
    { timeout: 30000, maxWait: 10000 }
  );
  return prisma.products.findFirst({ where: { id: product_id, company_id }, include: VARIANTS_INCLUDE });
}

// For a sale/purchase/stock line: the variant to move, checked against the
// product. A product with variants needs one picked — except when it has
// exactly one, which is used. A product without variants takes none.
async function resolveVariant(product_id, variant_id, company_id, client = prisma) {
  const variants = await client.product_variants.findMany({ where: { product_id, company_id, deleted_at: null } });
  if (!variants.length) {
    if (variant_id) throw new VariantError('This product has no sizes or colours');
    return null;
  }
  if (!variant_id) {
    if (variants.length === 1) return variants[0];
    throw new VariantError('Pick a size or colour for this product');
  }
  const v = variants.find((x) => x.id === variant_id);
  if (!v) throw new VariantError('That size or colour is not part of this product');
  return v;
}

module.exports = { VariantError, VARIANTS_INCLUDE, replaceVariants, resolveVariant, variantLabel, cleanVariants: clean };
