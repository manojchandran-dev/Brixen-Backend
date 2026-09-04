const prisma = require('../prisma/client');

function createMany(items) {
  return prisma.sale_items.createMany({ data: items });
}

function findManyBySaleId(sale_id) {
  return prisma.sale_items.findMany({ where: { sale_id }, orderBy: { created_at: 'asc' } });
}

function deleteManyBySaleId(sale_id) {
  return prisma.sale_items.deleteMany({ where: { sale_id } });
}

module.exports = {
  createMany,
  findManyBySaleId,
  deleteManyBySaleId,
};
