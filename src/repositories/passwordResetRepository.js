const prisma = require('../prisma/client');

function create(data) {
  return prisma.password_resets.create({ data });
}

function findLatestActiveByUserId(user_id) {
  return prisma.password_resets.findFirst({
    where: { user_id, consumed_at: null },
    orderBy: { created_at: 'desc' },
  });
}

function findValidByResetTokenHash(reset_token_hash) {
  return prisma.password_resets.findFirst({
    where: {
      reset_token_hash,
      consumed_at: null,
      token_expires_at: { gt: new Date() },
    },
  });
}

function update(id, data) {
  return prisma.password_resets.update({ where: { id }, data });
}

function markConsumed(id) {
  return update(id, { consumed_at: new Date() });
}

module.exports = {
  create,
  findLatestActiveByUserId,
  findValidByResetTokenHash,
  update,
  markConsumed,
};
