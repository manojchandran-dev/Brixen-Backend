function parseCompanyId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null;
  }
  if (!/^\d+$/.test(String(raw).trim())) {
    return null;
  }
  const id = parseInt(raw, 10);
  return id > 0 ? id : null;
}

// For list endpoints: superadmin (no company_id, sees everything) gets
// company_id: null and ok: true; company/employee callers must pass a
// valid company_id or the request is rejected.
function resolveListScope(query) {
  if (query.user_type === 'superadmin') {
    return { company_id: null, ok: true };
  }

  const company_id = parseCompanyId(query.company_id);
  return { company_id, ok: Boolean(company_id) };
}

function isBlankCompanyId(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return true;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'null' || normalized === 'undefined';
}

// For dashboard/reports: company_id is optional. superadmin, or an
// absent/blank/"null" company_id, means "no filter, all companies".
// Anything else must parse to a valid positive integer.
function resolveOptionalScope(query) {
  if (query.user_type === 'superadmin' || isBlankCompanyId(query.company_id)) {
    return { company_id: null, ok: true };
  }

  const company_id = parseCompanyId(query.company_id);
  return { company_id, ok: Boolean(company_id) };
}

module.exports = { parseCompanyId, resolveListScope, resolveOptionalScope };
