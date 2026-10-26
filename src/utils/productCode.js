// Readable codes for products and their sizes/colours, unique within a
// company and fixed once given (renaming a product keeps its code):
//   product  "C53-BILLASHORTS"        (company 53, product name)
//   variant  "C53-BILLASHORTS-S-BLUE" (product code, size, colour)
// A clash gets the next free number on the end: "C53-BILLASHORTS-2".

// "Billa shorts (kids)" -> "BILLASHORTSKIDS", at most [max] characters.
const slug = (s, max) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, max);

async function firstFree(base, isTaken) {
  if (!(await isTaken(base))) return base;
  for (let n = 2; ; n += 1) {
    const code = `${base}-${n}`;
    if (!(await isTaken(code))) return code;
  }
}

// Naming deleted_at (as undefined, which Prisma ignores) turns off the
// soft-delete filter in src/prisma/client.js, so deleted rows count as
// taken: they keep their codes and can be restored.
const ANY = { deleted_at: undefined };

// [client] is the Prisma client or a transaction.
function newProductCode(client, company_id, product_name) {
  const base = `C${company_id}-${slug(product_name, 20) || 'ITEM'}`;
  return firstFree(base, async (code) =>
    Boolean(
      await client.products.findFirst({
        where: { company_id, product_code: code, ...ANY },
        select: { id: true },
      })
    )
  );
}

// [used] holds codes already handed out in the same save; [selfId] is the
// variant being coded, which doesn't clash with itself. Only live sizes
// count: a removed size frees its code, so adding it back reuses it.
function newVariantSku(client, company_id, productCode, { size, color }, used = new Set(), selfId = null) {
  const base = [productCode, slug(size, 10), slug(color, 12)].filter(Boolean).join('-');
  return firstFree(
    base,
    async (sku) =>
      used.has(sku) ||
      Boolean(
        await client.product_variants.findFirst({
          where: { company_id, sku, ...(selfId ? { id: { not: selfId } } : {}) },
          select: { id: true },
        })
      )
  );
}

module.exports = { newProductCode, newVariantSku, slug };
