const prisma = require('../prisma/client');

function findByEmail(email) {
  return prisma.users.findUnique({ where: { email } });
}

function findById(id) {
  return prisma.users.findUnique({ where: { id } });
}

function create(data) {
  return prisma.users.create({ data });
}

module.exports = {
  findByEmail,
  findById,
  create,
};
