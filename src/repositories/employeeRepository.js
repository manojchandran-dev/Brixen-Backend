const prisma = require('../prisma/client');

function create(data) {
  return prisma.employees.create({ data });
}

function findMany(params) {
  return prisma.employees.findMany(params);
}

function count(where = {}) {
  return prisma.employees.count({ where });
}

function findById(id) {
  return prisma.employees.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.employees.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.employees.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
