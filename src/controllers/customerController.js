const customerService = require('../services/customerService');
const { success, error } = require('../utils/apiResponse');

function isValidId(raw) {
  return /^CUST\d{12}$/.test(raw);
}

async function createCustomer(req, res) {
  const customer = await customerService.createCustomer(req.body);
  return success(res, customer, 201);
}

async function getCustomers(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await customerService.getCustomers({ page, limit, search });
  return success(res, result);
}

async function getCustomerById(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const customer = await customerService.getCustomerById(id);
  if (!customer) {
    return error(res, 'Customer not found', 404);
  }

  return success(res, customer);
}

async function updateCustomer(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const existing = await customerService.getCustomerById(id);
  if (!existing) {
    return error(res, 'Customer not found', 404);
  }

  const customer = await customerService.updateCustomer(id, req.body);
  return success(res, customer);
}

async function deleteCustomer(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid customer id', 400);
  }

  const existing = await customerService.getCustomerById(id);
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
