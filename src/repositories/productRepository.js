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

function findByIdAndCompany(id, company_id) {
  return prisma.products.findFirst({ where: { id, company_id } });
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
  findByIdAndCompany,
  update,
  delete: deleteById,
};
