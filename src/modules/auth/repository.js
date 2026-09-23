const prisma = require('../../prisma/client');

const users = {
  findByEmail(email) {
    return prisma.users.findUnique({ where: { email } });
  },
  findById(id) {
    return prisma.users.findUnique({ where: { id } });
  },
  findByCompanyId(company_id) {
    return prisma.users.findFirst({ where: { company_id } });
  },
  create(data) {
    return prisma.users.create({ data });
  },
  update(id, data) {
    return prisma.users.update({ where: { id }, data });
  },
};

const refreshTokens = {
  create(data) {
    return prisma.refresh_tokens.create({ data });
  },
  findValidByHash(token_hash) {
    return prisma.refresh_tokens.findFirst({
      where: { token_hash, revoked_at: null, expires_at: { gt: new Date() } },
    });
  },
  revoke(id) {
    return prisma.refresh_tokens.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
  },
  revokeAllForUser(user_id) {
    return prisma.refresh_tokens.updateMany({
      where: { user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  },
};

const passwordResets = {
  create(data) {
    return prisma.password_resets.create({ data });
  },
  findLatestActiveByUserId(user_id) {
    return prisma.password_resets.findFirst({
      where: { user_id, consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
  },
  findValidByResetTokenHash(reset_token_hash) {
    return prisma.password_resets.findFirst({
      where: {
        reset_token_hash,
        consumed_at: null,
        token_expires_at: { gt: new Date() },
      },
    });
  },
  update(id, data) {
    return prisma.password_resets.update({ where: { id }, data });
  },
  markConsumed(id) {
    return passwordResets.update(id, { consumed_at: new Date() });
  },
};

module.exports = { users, refreshTokens, passwordResets };
