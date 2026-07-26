const prisma = require('../prisma/client');

function create(data) {
  return prisma.company.create({ data });
}

function findMany(params) {
  return prisma.company.findMany(params);
}

function count(where = {}) {
  return prisma.company.count({ where });
}

function findById(id) {
  return prisma.company.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.company.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.company.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
