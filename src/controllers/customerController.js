const customerService = require('../services/customerService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId, resolveListScope } = require('../utils/companyScope');

function isValidId(raw) {
  return /^CUST\d{12}$/.test(raw);
}

async function createCustomer(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const customer = await customerService.createCustomer(company_id, req.body);
    return success(res, customer, 201);
  } catch (err) {
    if (err instanceof customerService.CustomerError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getCustomers(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await customerService.getCustomers(company_id, { page, limit, search });
  return success(res, result);
}

async function getCustomerById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const customer = await customerService.getCustomerById(id, company_id);
  if (!customer) {
    return error(res, 'Customer not found', 404);
  }

  return success(res, customer);
}

async function updateCustomer(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const existing = await customerService.getCustomerById(id, company_id);
  if (!existing) {
    return error(res, 'Customer not found', 404);
  }

  const customer = await customerService.updateCustomer(id, req.body);
  return success(res, customer);
}

async function deleteCustomer(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const existing = await customerService.getCustomerById(id, company_id);
  if (!existing) {
    return error(res, 'Customer not found', 404);
  }

  await customerService.deleteCustomer(id);
  return res.status(204).send();
}

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
