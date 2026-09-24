const prisma = require('../../prisma/client');

function create(data) {
  return prisma.companies.create({ data });
}

function findMany(params) {
  return prisma.companies.findMany(params);
}

function count(where = {}) {
  return prisma.companies.count({ where });
}

function findById(id) {
  return prisma.companies.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.companies.update({
    where: { id },
    data,
  });
}

// Most company-owned tables are onDelete: Restrict, so their rows go first,
// children before the rows they reference (sales -> products, expenses ->
// categories). Tables marked Cascade in the schema clean themselves up.
function deleteById(id) {
  const where = { company_id: id };
  return prisma.$transaction([
    prisma.sales.deleteMany({ where }),
    prisma.expenses.deleteMany({ where }),
    prisma.products.deleteMany({ where }),
    prisma.customers.deleteMany({ where }),
    prisma.employees.deleteMany({ where }),
    prisma.expense_categories.deleteMany({ where }),
    prisma.product_categories.deleteMany({ where }),
    prisma.units.deleteMany({ where }),
    prisma.company_categories.deleteMany({ where }),
    prisma.companies.delete({ where: { id } }),
  ]);
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
