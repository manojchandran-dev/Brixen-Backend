const prisma = require('../../prisma/client');

// Every employee read carries its department (name, status) and its login
// (email; deleted_at set = access removed), for the app's form and list.
const INCLUDE = {
  departments: { select: { id: true, name: true, status: true } },
  users: { select: { email: true, deleted_at: true } },
};

function create(data) {
  return prisma.employees.create({ data, include: INCLUDE });
}

function findMany(params) {
  return prisma.employees.findMany({ include: INCLUDE, ...params });
}

function count(where = {}) {
  return prisma.employees.count({ where });
}

function findById(id) {
  return prisma.employees.findUnique({ where: { id }, include: INCLUDE });
}

function findByIdAndCompany(id, company_id) {
  return prisma.employees.findFirst({ where: { id, company_id }, include: INCLUDE });
}

function update(id, data) {
  return prisma.employees.update({
    where: { id },
    data,
    include: INCLUDE,
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
