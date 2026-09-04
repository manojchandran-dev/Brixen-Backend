const reportService = require('../services/reportService');
const { success, error } = require('../utils/apiResponse');
const { resolveOptionalScope } = require('../utils/companyScope');

async function getReportSummary(req, res) {
  const { company_id, ok } = resolveOptionalScope(req.query);
  if (!ok) {
    return error(res, 'company_id must be a positive integer', 400);
  }

  const period = req.query.period || 'weekly';
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;
  const topCategoriesLimit = req.query.top_categories_limit ? parseInt(req.query.top_categories_limit, 10) : undefined;
  const topCustomersLimit = req.query.top_customers_limit ? parseInt(req.query.top_customers_limit, 10) : undefined;

  try {
    const result = await reportService.getReportSummary({
      company_id,
      period,
      from,
      to,
      topCategoriesLimit,
      topCustomersLimit,
    });
    return success(res, result);
  } catch (err) {
    if (err instanceof reportService.ReportError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

module.exports = { getReportSummary };
