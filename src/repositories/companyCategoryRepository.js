const prisma = require('../prisma/client');

function create(data) {
  return prisma.company_categories.create({ data });
}

function findMany(params) {
  return prisma.company_categories.findMany(params);
}

function count(where = {}) {
  return prisma.company_categories.count({ where });
}

function findById(id) {
  return prisma.company_categories.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.company_categories.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.company_categories.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.company_categories.delete({ where: { id } });
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
