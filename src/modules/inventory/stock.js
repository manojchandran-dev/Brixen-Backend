// Every stock change in the app goes through here: purchases (+), sales (-)
// and manual adjustments. It moves the stock and writes the matching
// stock_movements row, inside the caller's transaction, so the balance and
// the ledger can never disagree.
//
// A change for a size/colour (variant_id set) moves that variant's stock
// AND its product's total by the same amount, so products.stock_quantity
// stays the sum of its variants. Without variant_id it moves the product's
// own stock (a product that has no variants).

const TYPES = ['purchase', 'sale', 'adjustment'];

const keyOf = (l) => `${l.product_id}|${l.variant_id ?? ''}`;

// Sum of quantities per product/variant: { "product|variant": qty }.
const qtyByKey = (lines) =>
  lines.reduce((acc, l) => ({ ...acc, [keyOf(l)]: (acc[keyOf(l)] ?? 0) + Number(l.quantity) }), {});

// Applies signed changes. `changes`: [{ product_id, variant_id?, delta }]
// (delta 0 is skipped). `movement`: { company_id, type, reason?,
// reference_id?, note?, created_by? }. Returns
// [{ product_id, variant_id, delta, balance_after }] — balance_after is the
// variant's stock for a variant change, else the product's.
async function applyStock(tx, changes, movement) {
  if (!TYPES.includes(movement.type)) throw new Error(`unknown stock movement type: ${movement.type}`);
  const results = [];
  for (const { product_id, variant_id = null, delta } of changes) {
    if (!delta) continue;
    // One atomic statement per row: no read-then-write race between two
    // sales. Raw SQL also reaches a soft-deleted product/variant, so
    // reversing an old sale still puts its stock back.
    let balance;
    if (variant_id) {
      const [v] = await tx.$queryRaw`
        UPDATE product_variants SET stock_quantity = stock_quantity + ${delta}
        WHERE id = ${variant_id} AND product_id = ${product_id} AND company_id = ${movement.company_id}
        RETURNING stock_quantity`;
      if (!v) continue; // not this product's variant / another company
      balance = v.stock_quantity;
    }
    const [p] = await tx.$queryRaw`
      UPDATE products SET stock_quantity = stock_quantity + ${delta}
      WHERE id = ${product_id} AND company_id = ${movement.company_id}
      RETURNING stock_quantity`;
    if (!p) continue; // product belongs to another company / no longer exists
    balance ??= p.stock_quantity;
    await tx.stock_movements.create({
      data: {
        company_id: movement.company_id,
        product_id,
        variant_id,
        type: movement.type,
        reason: movement.reason ?? null,
        quantity: delta,
        balance_after: balance,
        reference_id: movement.reference_id ?? null,
        note: movement.note ?? null,
        created_by: movement.created_by ?? null,
      },
    });
    results.push({ product_id, variant_id, delta, balance_after: balance });
  }
  return results;
}

// Net change when a document's lines are replaced: sign = +1 for stock IN
// (purchases), -1 for stock OUT (sales). Old lines are undone, new ones
// applied, and only the difference per product/variant is recorded.
function netChanges(oldLines, newLines, sign) {
  const oldQty = qtyByKey(oldLines);
  const newQty = qtyByKey(newLines);
  return [...new Set([...Object.keys(oldQty), ...Object.keys(newQty)])].map((key) => {
    const [product_id, variant] = key.split('|');
    return {
      product_id,
      variant_id: variant || null,
      delta: sign * ((newQty[key] ?? 0) - (oldQty[key] ?? 0)),
    };
  });
}

// Sets a product's (or a variant's) stock to an exact count (a stock-take /
// correction) and records the difference as an adjustment. The row is
// locked while the difference is worked out, so a sale at the same moment
// isn't lost.
async function setStock(tx, { product_id, variant_id = null, quantity, ...movement }) {
  const [row] = variant_id
    ? await tx.$queryRaw`
        SELECT stock_quantity FROM product_variants
        WHERE id = ${variant_id} AND product_id = ${product_id} AND company_id = ${movement.company_id} FOR UPDATE`
    : await tx.$queryRaw`
        SELECT stock_quantity FROM products
        WHERE id = ${product_id} AND company_id = ${movement.company_id} FOR UPDATE`;
  if (!row) return null;
  const [result] = await applyStock(
    tx,
    [{ product_id, variant_id, delta: quantity - row.stock_quantity }],
    { type: 'adjustment', ...movement }
  );
  return result ?? { product_id, variant_id, delta: 0, balance_after: row.stock_quantity };
}

module.exports = { applyStock, netChanges, setStock };
