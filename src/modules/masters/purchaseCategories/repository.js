const prisma = require('../../../prisma/client');

function create(data) {
  return prisma.purchase_categories.create({ data });
}

function findMany(params) {
  return prisma.purchase_categories.findMany(params);
}

function count(where = {}) {
  return prisma.purchase_categories.count({ where });
}

function findById(id) {
  return prisma.purchase_categories.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.purchase_categories.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.purchase_categories.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.purchase_categories.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  findByIdAndCompany,
  update,
  delete: deleteById,
};
