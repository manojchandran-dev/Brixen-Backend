// Every stock change in the app goes through here: purchases (+), sales (-)
// and manual adjustments. It moves products.stock_quantity and writes the
// matching stock_movements row, inside the caller's transaction, so the
// balance and the ledger can never disagree.

const TYPES = ['purchase', 'sale', 'adjustment'];

// Sum of quantities per product: { product_id: qty }.
const qtyByProduct = (lines) =>
  lines.reduce((acc, l) => ({ ...acc, [l.product_id]: (acc[l.product_id] ?? 0) + Number(l.quantity) }), {});

// Applies signed changes. `changes`: [{ product_id, delta }] (delta 0 is skipped).
// `movement`: { company_id, type, reason?, reference_id?, note?, created_by? }.
// Returns [{ product_id, delta, balance_after }].
async function applyStock(tx, changes, movement) {
  if (!TYPES.includes(movement.type)) throw new Error(`unknown stock movement type: ${movement.type}`);
  const results = [];
  for (const { product_id, delta } of changes) {
    if (!delta) continue;
    // One atomic statement: no read-then-write race between two sales.
    // Raw SQL also reaches a product that has since been soft-deleted, so
    // reversing an old sale still puts its stock back.
    const [row] = await tx.$queryRaw`
      UPDATE products SET stock_quantity = stock_quantity + ${delta}
      WHERE id = ${product_id} AND company_id = ${movement.company_id}
      RETURNING stock_quantity`;
    if (!row) continue; // product belongs to another company / no longer exists
    await tx.stock_movements.create({
      data: {
        company_id: movement.company_id,
        product_id,
        type: movement.type,
        reason: movement.reason ?? null,
        quantity: delta,
        balance_after: row.stock_quantity,
        reference_id: movement.reference_id ?? null,
        note: movement.note ?? null,
        created_by: movement.created_by ?? null,
      },
    });
    results.push({ product_id, delta, balance_after: row.stock_quantity });
  }
  return results;
}

// Net change when a document's lines are replaced: sign = +1 for stock IN
// (purchases), -1 for stock OUT (sales). Old lines are undone, new ones applied,
// and only the difference per product is recorded.
function netChanges(oldLines, newLines, sign) {
  const oldQty = qtyByProduct(oldLines);
  const newQty = qtyByProduct(newLines);
  return [...new Set([...Object.keys(oldQty), ...Object.keys(newQty)])].map((product_id) => ({
    product_id,
    delta: sign * ((newQty[product_id] ?? 0) - (oldQty[product_id] ?? 0)),
  }));
}

// Sets a product's stock to an exact count (a stock-take / correction) and
// records the difference as an adjustment. The row is locked while the
// difference is worked out, so a sale at the same moment isn't lost.
async function setStock(tx, { product_id, quantity, ...movement }) {
  const [row] = await tx.$queryRaw`
    SELECT stock_quantity FROM products
    WHERE id = ${product_id} AND company_id = ${movement.company_id} FOR UPDATE`;
  if (!row) return null;
  const [result] = await applyStock(tx, [{ product_id, delta: quantity - row.stock_quantity }], { type: 'adjustment', ...movement });
  return result ?? { product_id, delta: 0, balance_after: row.stock_quantity };
}

module.exports = { applyStock, netChanges, setStock };
