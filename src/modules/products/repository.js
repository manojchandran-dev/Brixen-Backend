const prisma = require('../../prisma/client');
const { VARIANTS_INCLUDE } = require('./variants');

function create(data) {
  return prisma.products.create({ data });
}

function findMany(params) {
  return prisma.products.findMany({ include: VARIANTS_INCLUDE, ...params });
}

function count(where = {}) {
  return prisma.products.count({ where });
}

function findById(id) {
  return prisma.products.findUnique({ where: { id }, include: VARIANTS_INCLUDE });
}

function findByIdAndCompany(id, company_id) {
  return prisma.products.findFirst({ where: { id, company_id }, include: VARIANTS_INCLUDE });
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

// Several products of one company at once (e.g. a sale's lines).
function findManyByIdsAndCompany(ids, company_id) {
  return prisma.products.findMany({ where: { id: { in: ids }, company_id } });
}

module.exports = {
  findManyByIdsAndCompany,
  create,
  findMany,
  count,
  findById,
  findByIdAndCompany,
  update,
  delete: deleteById,
};
