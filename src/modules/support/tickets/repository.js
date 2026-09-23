const prisma = require('../../../prisma/client');

const INCLUDE = {
  companies: { select: { company_name: true } },
  messages: { orderBy: { sent_at: 'asc' } },
};

function create(data) {
  return prisma.support_tickets.create({ data, include: INCLUDE });
}

function findMany(params) {
  return prisma.support_tickets.findMany({ ...params, include: INCLUDE });
}

function count(where = {}) {
  return prisma.support_tickets.count({ where });
}

function findById(id) {
  return prisma.support_tickets.findUnique({ where: { id }, include: INCLUDE });
}

function update(id, data) {
  return prisma.support_tickets.update({ where: { id }, data, include: INCLUDE });
}

module.exports = { create, findMany, count, findById, update };
