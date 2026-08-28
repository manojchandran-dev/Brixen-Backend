const prisma = require('../prisma/client');

function create(data) {
  return prisma.product_categories.create({ data });
}

function findMany(params) {
  return prisma.product_categories.findMany(params);
}

function count(where = {}) {
  return prisma.product_categories.count({ where });
}

function findById(id) {
  return prisma.product_categories.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.product_categories.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.product_categories.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.product_categories.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  findByIdAndCompany,
  update,
  delete: deleteById,
};
