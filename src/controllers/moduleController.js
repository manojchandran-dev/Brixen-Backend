const moduleService = require('../services/moduleService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

async function getModules(req, res) {
  if (req.query.company_id === undefined) {
    const modules = await moduleService.getModules();
    return success(res, modules);
  }

  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id must be a positive integer', 400);
  }

  const modules = await moduleService.getAccessibleModules(company_id);
  return success(res, modules);
}

module.exports = { getModules };
