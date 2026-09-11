const prisma = require('../prisma/client');

function create(data) {
  return prisma.notifications.create({ data });
}

function findMany(params) {
  return prisma.notifications.findMany(params);
}

function count(where = {}) {
  return prisma.notifications.count({ where });
}

function findById(id) {
  return prisma.notifications.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.notifications.update({
    where: { id },
    data,
  });
}

function updateMany(where, data) {
  return prisma.notifications.updateMany({ where, data });
}

function deleteById(id) {
  return prisma.notifications.delete({ where: { id } });
}

module.exports = {
  create,
  findMany,
  count,
  findById,
  update,
  updateMany,
  delete: deleteById,
};
