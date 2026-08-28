const prisma = require('../prisma/client');

function create(data) {
  return prisma.permissions.create({ data });
}

function findMany(params) {
  return prisma.permissions.findMany(params);
}

function count(where = {}) {
  return prisma.permissions.count({ where });
}

function findByIdAndCompany(id, company_id) {
  return prisma.permissions.findFirst({ where: { id, company_id } });
}

function findByCompanyAndModule(company_id, module_id) {
  return prisma.permissions.findFirst({ where: { company_id, module_id } });
}

function update(id, data) {
  return prisma.permissions.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.permissions.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findByIdAndCompany,
  findByCompanyAndModule,
  update,
  delete: deleteById,
};
