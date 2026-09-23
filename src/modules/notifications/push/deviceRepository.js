const prisma = require('../../../prisma/client');

function upsert(company_id, token, platform) {
  return prisma.device_tokens.upsert({
    where: { token },
    update: { company_id, platform },
    create: { company_id, token, platform },
  });
}

function removeByToken(token) {
  return prisma.device_tokens.deleteMany({ where: { token } });
}

function findManyByCompanyIds(companyIds) {
  return prisma.device_tokens.findMany({ where: { company_id: { in: companyIds } } });
}

module.exports = { upsert, removeByToken, findManyByCompanyIds };
