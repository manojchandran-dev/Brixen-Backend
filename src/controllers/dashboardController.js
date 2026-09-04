const dashboardService = require('../services/dashboardService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

async function getDashboardSummary(req, res) {
  if (req.query.company_id === undefined) {
    const result = await dashboardService.getDashboardSummary();
    return success(res, result);
  }

  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id must be a positive integer', 400);
  }

  const result = await dashboardService.getCompanyDashboardSummary(company_id);
  return success(res, result);
}

module.exports = { getDashboardSummary };
