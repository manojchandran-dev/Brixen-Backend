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
  update,
  delete: deleteById,
};
