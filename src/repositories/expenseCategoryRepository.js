const prisma = require('../prisma/client');

function create(data) {
  return prisma.expense_categories.create({ data });
}

function findMany(params) {
  return prisma.expense_categories.findMany(params);
}

function count(where = {}) {
  return prisma.expense_categories.count({ where });
}

function findById(id) {
  return prisma.expense_categories.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.expense_categories.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.expense_categories.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
