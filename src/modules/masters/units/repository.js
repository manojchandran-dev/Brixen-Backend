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

function findByIdAndCompany(id, company_id) {
  return prisma.units.findFirst({ where: { id, company_id } });
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
  findByIdAndCompany,
  update,
  delete: deleteById,
};
