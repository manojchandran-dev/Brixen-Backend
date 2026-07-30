const prisma = require('../prisma/client');

function create(data) {
  return prisma.refresh_tokens.create({ data });
}

function findValidByHash(token_hash) {
  return prisma.refresh_tokens.findFirst({
    where: { token_hash, revoked_at: null, expires_at: { gt: new Date() } },
  });
}

function revoke(id) {
  return prisma.refresh_tokens.update({
    where: { id },
    data: { revoked_at: new Date() },
  });
}

module.exports = {
  create,
  findValidByHash,
  revoke,
};
