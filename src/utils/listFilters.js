// Shared query-param filters for the company module list endpoints.
// Every helper returns a Prisma condition, or undefined for "any" (param
// missing/empty). Bad input throws FilterError -> 400 with a message (the
// global error handler uses err.status).

class FilterError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const given = (v) => typeof v === 'string' && v.trim() !== '';

// Free text, exact but case-insensitive: department=sales matches "Sales".
function exact(value) {
  return given(value) ? { equals: value.trim(), mode: 'insensitive' } : undefined;
}

// One of a fixed set of stored values, ignoring case, spaces, '_' and '-':
// on_leave / On Leave / on-leave all match the stored "On Leave".
function choice(field, value, allowed) {
  if (!given(value)) return undefined;
  const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const match = allowed.find((a) => norm(a) === norm(value));
  if (!match) throw new FilterError(`${field} must be one of: ${allowed.join(', ')}`);
  return { equals: match, mode: 'insensitive' };
}

function day(field, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new FilterError(`${field} must be a date as YYYY-MM-DD`);
  }
  return new Date(`${value}T00:00:00Z`);
}

function checkOrder(from, to) {
  if (from && to && from > to) throw new FilterError('from must be on or before to');
}

// For DATE columns (bill_date, expense_date): both days included.
function dateRange(from, to) {
  const f = given(from) ? day('from', from) : undefined;
  const t = given(to) ? day('to', to) : undefined;
  checkOrder(f, t);
  if (!f && !t) return undefined;
  return { ...(f ? { gte: f } : {}), ...(t ? { lte: t } : {}) };
}

// For timestamp columns (created_at): whole IST days, both included.
function dayRangeIST(from, to) {
  const f = given(from) ? day('from', from) : undefined;
  const t = given(to) ? day('to', to) : undefined;
  checkOrder(f, t);
  if (!f && !t) return undefined;
  return {
    ...(f ? { gte: new Date(f.getTime() - IST_OFFSET_MS) } : {}),
    ...(t ? { lt: new Date(t.getTime() + DAY_MS - IST_OFFSET_MS) } : {}),
  };
}

// 'true' / 'false' -> boolean; missing -> undefined.
function bool(field, value) {
  if (!given(value)) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new FilterError(`${field} must be true or false`);
}

// Distinct non-empty values per field, for GET /{module}/filters.
async function distinctValues(delegate, fields, where) {
  const entries = await Promise.all(
    fields.map(async (field) => {
      // Empty/null values are dropped below ("not null" is rejected on required columns).
      const rows = await delegate.groupBy({ by: [field], where });
      const values = rows.map((r) => r[field]).filter((v) => typeof v === 'string' && v.trim() !== '');
      return [field, values.sort((a, b) => a.localeCompare(b))];
    })
  );
  return Object.fromEntries(entries);
}

// Drops undefined conditions so a missing param means "any".
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// GET /{module}/filters: the distinct values that exist for this company, so
// the app's filter choices list every option. `extra(prisma, where)` adds more keys
// (e.g. categories as { id, name }).
function filterOptionsHandler(model, fields, extra) {
  // Required here so this file stays usable without a database (unit use).
  const prisma = require('../prisma/client');
  const { success, error } = require('../core/responses/apiResponse');
  const { resolveListScope } = require('./companyScope');
  return async (req, res) => {
    const { company_id, ok } = resolveListScope(req.query);
    if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);
    const where = company_id ? { company_id } : {};
    const [values, more] = await Promise.all([distinctValues(prisma[model], fields, where), extra ? extra(prisma, where) : {}]);
    return success(res, { ...values, ...more });
  };
}

const categoriesOf = (model) => async (prisma, where) => ({
  categories: await prisma[model].findMany({ where, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
});

module.exports = { FilterError, exact, choice, dateRange, dayRangeIST, bool, distinctValues, compact, filterOptionsHandler, categoriesOf };
