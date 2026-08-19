const prisma = require('../prisma/client');

function create(data) {
  return prisma.customers.create({ data });
}

function findMany(params) {
  return prisma.customers.findMany(params);
}

function count(where = {}) {
  return prisma.customers.count({ where });
}

function findById(id) {
  return prisma.customers.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.customers.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.customers.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
