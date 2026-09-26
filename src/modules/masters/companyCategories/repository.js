const prisma = require('../../../prisma/client');

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

function findGlobalById(id) {
  return prisma.company_categories.findFirst({ where: { id, company_id: null } });
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
  findGlobalById,
  update,
  delete: deleteById,
};
