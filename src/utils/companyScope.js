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

module.exports = { parseCompanyId };
