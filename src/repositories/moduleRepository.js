const prisma = require('../prisma/client');

function create(data) {
  return prisma.modules.create({ data });
}

function findMany(params) {
  return prisma.modules.findMany(params);
}

function findByName(name) {
  return prisma.modules.findFirst({ where: { name } });
}

module.exports = {
  create,
  findMany,
  findByName,
};
