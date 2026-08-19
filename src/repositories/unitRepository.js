const prisma = require('../prisma/client');

function create(data) {
  return prisma.units.create({ data });
}

function findMany(params) {
  return prisma.units.findMany(params);
}

function count(where = {}) {
  return prisma.units.count({ where });
}

function findById(id) {
  return prisma.units.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.units.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.units.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
