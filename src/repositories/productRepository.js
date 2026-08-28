const prisma = require('../prisma/client');

function create(data) {
  return prisma.products.create({ data });
}

function findMany(params) {
  return prisma.products.findMany(params);
}

function count(where = {}) {
  return prisma.products.count({ where });
}

function findById(id) {
  return prisma.products.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.products.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.products.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
