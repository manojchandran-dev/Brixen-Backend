const prisma = require('../prisma/client');

function create(data) {
  return prisma.sales.create({ data });
}

function findMany(params) {
  return prisma.sales.findMany(params);
}

function count(where = {}) {
  return prisma.sales.count({ where });
}

function findById(id) {
  return prisma.sales.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.sales.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.sales.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.sales.delete({ where: { id } });
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
