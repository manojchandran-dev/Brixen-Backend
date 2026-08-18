const employeeService = require('../services/employeeService');
const { success, error } = require('../utils/apiResponse');

async function createEmployee(req, res) {
  try {
    const employee = await employeeService.createEmployee(req.body);
    return success(res, employee, 201);
  } catch (err) {
    if (err instanceof employeeService.EmployeeError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getEmployees(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await employeeService.getEmployees({ page, limit, search });
  return success(res, result);
}

async function getEmployeeById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid employee id', 400);
  }

  const employee = await employeeService.getEmployeeById(id);
  if (!employee) {
    return error(res, 'Employee not found', 404);
  }

  return success(res, employee);
}

async function updateEmployee(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid employee id', 400);
  }

  const existing = await employeeService.getEmployeeById(id);
  if (!existing) {
    return error(res, 'Employee not found', 404);
  }

  try {
    const employee = await employeeService.updateEmployee(id, req.body);
    return success(res, employee);
  } catch (err) {
    if (err instanceof employeeService.EmployeeError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteEmployee(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid employee id', 400);
  }

  const existing = await employeeService.getEmployeeById(id);
  if (!existing) {
    return error(res, 'Employee not found', 404);
  }

  await employeeService.deleteEmployee(id);
  return res.status(204).send();
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
