const prisma = require('../prisma/client');

function create(data) {
  return prisma.expenses.create({ data });
}

function findMany(params) {
  return prisma.expenses.findMany(params);
}

function count(where = {}) {
  return prisma.expenses.count({ where });
}

function findById(id) {
  return prisma.expenses.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.expenses.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.expenses.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
