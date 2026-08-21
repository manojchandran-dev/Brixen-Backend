const dashboardService = require('../services/dashboardService');
const { success } = require('../utils/apiResponse');

async function getDashboardSummary(req, res) {
  const result = await dashboardService.getDashboardSummary();
  return success(res, result);
}

module.exports = { getDashboardSummary };
