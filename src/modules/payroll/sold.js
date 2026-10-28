const prisma = require('../../prisma/client');

// What each piece-rate maker sold in a period: every sale line (by the
// sale's bill date) of a product they make (product_makers), in pieces -- a
// product whose unit is a dozen counts x 12. Every maker of a product is
// credited with all its pieces sold.

// "Dozen", "DOZ", "dz", "DZN" -> sold by the dozen.
const isDozen = (unit) => /doz|dzn|\bdz\b/i.test(`${unit?.unit ?? ''} ${unit?.full_form ?? ''}`);

// Map employee_id -> [{ product_id, name, sold, dozen, pieces }], one entry
// per product. [from], [to]: Dates (both days included). [employee_id]
// narrows to one maker.
async function soldBy(company_id, from, to, employee_id = null) {
  const lines = await prisma.sale_items.findMany({
    where: {
      sales: { company_id, bill_date: { gte: from, lte: to } },
      products: {
        product_makers: { some: employee_id ? { employee_id } : {} },
      },
    },
    select: {
      product_id: true,
      quantity: true,
      products: {
        select: {
          product_name: true,
          units: { select: { unit: true, full_form: true } },
          product_makers: { select: { employee_id: true } },
        },
      },
    },
  });

  const byEmployee = new Map();
  for (const l of lines) {
    const dozen = isDozen(l.products.units);
    for (const { employee_id: maker } of l.products.product_makers) {
      if (employee_id && maker !== employee_id) continue;
      if (!byEmployee.has(maker)) byEmployee.set(maker, new Map());
      const products = byEmployee.get(maker);
      const entry = products.get(l.product_id) ?? {
        product_id: l.product_id,
        name: l.products.product_name,
        sold: 0,
        dozen,
        pieces: 0,
      };
      entry.sold += l.quantity;
      entry.pieces += l.quantity * (dozen ? 12 : 1);
      products.set(l.product_id, entry);
    }
  }
  return new Map([...byEmployee].map(([id, products]) => [id, [...products.values()]]));
}

module.exports = { soldBy, isDozen };
