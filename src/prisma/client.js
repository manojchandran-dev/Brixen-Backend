const { PrismaClient } = require('@prisma/client');

const base = new PrismaClient();

// Models that are soft-deleted: a row is "deleted" when deleted_at is set, and
// can be restored later with the same id.
const SOFT_DELETE_MODELS = new Set([
  'companies',
  'users',
  'employees',
  'customers',
  'products',
  'product_categories',
  'company_categories',
  'expense_categories',
  'units',
  'announcements',
  'chat_conversations',
  'support_tickets',
]);

// Operations that get `deleted_at: null` added, so deleted rows are invisible
// to every read and can't be updated. A query that names deleted_at itself
// (e.g. restore looking for `deleted_at: { not: null }`) is left untouched.
// Relation includes aren't filtered: a sale still shows its deleted customer.
const FILTERED = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
]);

const prisma = base.$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args);

        // delete/deleteMany become "set deleted_at". Unlike the filtered ops
        // these can't go through query(), so they run on the base client --
        // don't call them inside a $transaction (use updateMany there).
        if (operation === 'delete') {
          return base[model].update({ ...args, data: { deleted_at: new Date() } });
        }
        if (operation === 'deleteMany') {
          return base[model].updateMany({
            where: { ...args?.where, deleted_at: null },
            data: { deleted_at: new Date() },
          });
        }

        if (FILTERED.has(operation) && !('deleted_at' in (args?.where ?? {}))) {
          return query({ ...args, where: { ...args?.where, deleted_at: null } });
        }
        return query(args);
      },
    },
  },
});

module.exports = prisma;
module.exports.SOFT_DELETE_MODELS = SOFT_DELETE_MODELS;
