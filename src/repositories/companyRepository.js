const prisma = require('../prisma/client');

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

function deleteById(id) {
  return prisma.companies.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  delete: deleteById,
};
