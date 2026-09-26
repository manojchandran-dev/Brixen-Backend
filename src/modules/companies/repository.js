const prisma = require('../../prisma/client');

function create(data) {
  return prisma.companies.create({ data });
}

function findMany(params) {
  return prisma.companies.findMany(params);
}

function groupBy(params) {
  return prisma.companies.groupBy(params);
}

function count(where = {}) {
  return prisma.companies.count({ where });
}

function findFirst(where) {
  return prisma.companies.findFirst({ where, select: { id: true } });
}

function findById(id) {
  return prisma.companies.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.companies.update({
    where: { id },
    data,
  });
}

// The company's own soft-deletable rows go with it (its login user included,
// which blocks sign-in), all stamped with the same deleted_at. Restore brings
// back exactly that set, not rows that were deleted separately before.
// Sales and expenses aren't soft-deletable and are left untouched.
const COMPANY_CHILDREN = [
  'users',
  'employees',
  'customers',
  'products',
  'product_categories',
  'expense_categories',
  'units',
  'chat_conversations',
  'support_tickets',
];

function deleteById(id) {
  const deleted_at = new Date();
  return prisma.$transaction([
    ...COMPANY_CHILDREN.map((m) =>
      prisma[m].updateMany({ where: { company_id: id, deleted_at: null }, data: { deleted_at } })
    ),
    prisma.companies.updateMany({ where: { id, deleted_at: null }, data: { deleted_at } }),
  ]);
}

// Returns the restored company, or null if there's no deleted company with this id.
async function restoreById(id) {
  const company = await prisma.companies.findFirst({ where: { id, deleted_at: { not: null } } });
  if (!company) return null;

  const { deleted_at } = company;
  await prisma.$transaction([
    ...COMPANY_CHILDREN.map((m) =>
      prisma[m].updateMany({ where: { company_id: id, deleted_at }, data: { deleted_at: null } })
    ),
    prisma.companies.updateMany({ where: { id, deleted_at }, data: { deleted_at: null } }),
  ]);
  return findById(id);
}

module.exports = {
  create,
  findMany,
  count,
  groupBy,
  findFirst,
  findById,
  update,
  delete: deleteById,
  restore: restoreById,
};
