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

function isBlankCompanyId(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return true;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'null' || normalized === 'undefined';
}

// Shared scope resolution. An explicit, valid company_id always wins and
// scopes the request to that company, regardless of user_type -- even a
// superadmin caller that passes company_id gets filtered results. Only
// when company_id is absent/blank does user_type=superadmin (or, for
// optional-scope endpoints, any caller) get the unfiltered "all
// companies" view.
function resolveScope(query, { requireCompanyId }) {
  if (!isBlankCompanyId(query.company_id)) {
    const company_id = parseCompanyId(query.company_id);
    return { company_id, ok: Boolean(company_id) };
  }

  if (query.user_type === 'superadmin' || !requireCompanyId) {
    return { company_id: null, ok: true };
  }

  return { company_id: null, ok: false };
}

// For list endpoints: company/employee callers must pass a valid
// company_id or the request is rejected; superadmin with no company_id
// sees everything.
function resolveListScope(query) {
  return resolveScope(query, { requireCompanyId: true });
}

// For dashboard/reports: company_id is optional. Absent/blank means "no
// filter, all companies" for any caller; a passed company_id always
// scopes the result.
function resolveOptionalScope(query) {
  return resolveScope(query, { requireCompanyId: false });
}

module.exports = { parseCompanyId, resolveListScope, resolveOptionalScope };
