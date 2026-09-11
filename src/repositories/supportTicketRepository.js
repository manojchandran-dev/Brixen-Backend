const prisma = require('../prisma/client');

function create(data) {
  return prisma.support_tickets.create({ data });
}

function findMany(params) {
  return prisma.support_tickets.findMany(params);
}

function count(where = {}) {
  return prisma.support_tickets.count({ where });
}

function findById(id) {
  return prisma.support_tickets.findUnique({ where: { id } });
}

function findByIdAndCompany(id, company_id) {
  return prisma.support_tickets.findFirst({ where: { id, company_id } });
}

function update(id, data) {
  return prisma.support_tickets.update({
    where: { id },
    data,
  });
}

function deleteById(id) {
  return prisma.support_tickets.delete({ where: { id } });
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
