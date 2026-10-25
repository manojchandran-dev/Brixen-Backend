const prisma = require('../../prisma/client');

// The customer's name rides along with every sale. Relation includes skip the
// soft-delete filter, so a sale still names a customer deleted since.
const CUSTOMER = { customers: { select: { name: true, shop_name: true } } };

const sales = {
  create(data) {
    return prisma.sales.create({ data });
  },
  findMany(params) {
    return prisma.sales.findMany({ include: CUSTOMER, ...params });
  },
  count(where = {}) {
    return prisma.sales.count({ where });
  },
  findById(id) {
    return prisma.sales.findUnique({ where: { id }, include: { sale_items: true, ...CUSTOMER } });
  },
  findByIdAndCompany(id, company_id) {
    return prisma.sales.findFirst({ where: { id, company_id }, include: { sale_items: true, ...CUSTOMER } });
  },
  update(id, data) {
    return prisma.sales.update({
      where: { id },
      data,
    });
  },
  delete(id) {
    return prisma.sales.delete({ where: { id } });
  },
};

const saleItems = {
  createMany(items) {
    return prisma.sale_items.createMany({ data: items });
  },
  findManyBySaleId(sale_id) {
    return prisma.sale_items.findMany({ where: { sale_id }, orderBy: { created_at: 'asc' } });
  },
  deleteManyBySaleId(sale_id) {
    return prisma.sale_items.deleteMany({ where: { sale_id } });
  },
};

module.exports = { sales, saleItems };
