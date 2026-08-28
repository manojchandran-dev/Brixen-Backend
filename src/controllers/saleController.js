const saleService = require('../services/saleService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

function isValidId(raw) {
  return /^SALE\d{12}$/.test(raw);
}

async function createSale(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const sale = await saleService.createSale(company_id, req.body);
    return success(res, sale, 201);
  } catch (err) {
    if (err instanceof saleService.SaleError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getSales(req, res) {
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';
  const customer_id = req.query.customer_id || undefined;
  const payment_status = req.query.payment_status || undefined;
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;

  const result = await saleService.getSales(company_id, { page, limit, search, customer_id, payment_status, from, to });
  return success(res, result);
}

async function getSaleById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid sale id', 400);
  }

  const sale = await saleService.getSaleById(id, company_id);
  if (!sale) {
    return error(res, 'Sale not found', 404);
  }

  return success(res, sale);
}

async function updateSale(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid sale id', 400);
  }

  const existing = await saleService.getSaleById(id, company_id);
  if (!existing) {
    return error(res, 'Sale not found', 404);
  }

  try {
    const sale = await saleService.updateSale(id, company_id, req.body);
    return success(res, sale);
  } catch (err) {
    if (err instanceof saleService.SaleError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteSale(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid sale id', 400);
  }

  const existing = await saleService.getSaleById(id, company_id);
  if (!existing) {
    return error(res, 'Sale not found', 404);
  }

  await saleService.deleteSale(id);
  return res.status(204).send();
}

module.exports = {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
};
