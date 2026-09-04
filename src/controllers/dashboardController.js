const dashboardService = require('../services/dashboardService');
const { success, error } = require('../utils/apiResponse');
const { resolveOptionalScope } = require('../utils/companyScope');

async function getDashboardSummary(req, res) {
  const { company_id, ok } = resolveOptionalScope(req.query);
  if (!ok) {
    return error(res, 'company_id must be a positive integer', 400);
  }

  if (!company_id) {
    const result = await dashboardService.getDashboardSummary();
    return success(res, result);
  }

  const result = await dashboardService.getCompanyDashboardSummary(company_id);
  return success(res, result);
}

module.exports = { getDashboardSummary };
