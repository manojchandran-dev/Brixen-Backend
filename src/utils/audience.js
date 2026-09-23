const prisma = require('../prisma/client');
const { HttpError } = require('../core/errors/httpError');

const TYPES = ['allCompanies', 'selectedCompanies', 'byPlan', 'byStatus'];

// Validates the audience rule and returns it in its stored shape.
function normalizeAudience(a) {
  if (!a || typeof a !== 'object' || !TYPES.includes(a.type)) {
    throw new HttpError(`audience.type must be one of: ${TYPES.join(', ')}`);
  }

  const out = { type: a.type, company_ids: [], plan: null, active_only: null };

  if (a.type === 'selectedCompanies') {
    const ids = Array.isArray(a.company_ids) ? a.company_ids.map(Number) : [];
    if (!ids.length || !ids.every((n) => Number.isInteger(n) && n > 0)) {
      throw new HttpError('audience.company_ids must be a non-empty array of company ids');
    }
    out.company_ids = [...new Set(ids)];
  }
  if (a.type === 'byPlan') {
    if (typeof a.plan !== 'string' || !a.plan.trim()) throw new HttpError('audience.plan is required');
    out.plan = a.plan.trim();
  }
  if (a.type === 'byStatus') {
    if (typeof a.active_only !== 'boolean') throw new HttpError('audience.active_only must be true or false');
    out.active_only = a.active_only;
  }
  return out;
}

// The server decides recipients from the rule; the client never supplies a count.
async function resolveCompanyIds(a) {
  const where = {
    allCompanies: { status: 'ACTIVE' },
    selectedCompanies: { id: { in: a.company_ids } },
    byPlan: { subscription_plan: { equals: a.plan, mode: 'insensitive' } },
    byStatus: { status: a.active_only ? 'ACTIVE' : 'INACTIVE' },
  }[a.type];

  const rows = await prisma.companies.findMany({ where, select: { id: true } });
  return rows.map((c) => c.id);
}

module.exports = { normalizeAudience, resolveCompanyIds };
