const prisma = require('../prisma/client');

function create(data) {
  return prisma.employees.create({ data });
}

function findMany(params) {
  return prisma.employees.findMany(params);
}

function count(where = {}) {
  return prisma.employees.count({ where });
}

function findById(id) {
  return prisma.employees.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.employees.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.employees.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.employees.delete({ where: { id } });
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
