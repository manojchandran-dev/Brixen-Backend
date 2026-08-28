const prisma = require('../prisma/client');

function findByEmail(email) {
  return prisma.users.findUnique({ where: { email } });
}

function findById(id) {
  return prisma.users.findUnique({ where: { id } });
}

function findByCompanyId(company_id) {
  return prisma.users.findFirst({ where: { company_id } });
}

function create(data) {
  return prisma.users.create({ data });
}

function update(id, data) {
  return prisma.users.update({ where: { id }, data });
}

module.exports = {
  findByEmail,
  findById,
  findByCompanyId,
  create,
  update,
};
