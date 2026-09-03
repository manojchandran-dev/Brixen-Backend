const moduleService = require('../services/moduleService');
const employeeRepository = require('../repositories/employeeRepository');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

async function getModules(req, res) {
  const { user_type } = req.query;

  if (user_type === 'superadmin') {
    const modules = await moduleService.getModules();
    return success(res, modules);
  }

  if (user_type === 'company') {
    const company_id = parseCompanyId(req.query.company_id);
    if (!company_id) {
      return error(res, 'company_id is required and must be a positive integer', 400);
    }
    const modules = await moduleService.getAccessibleModules(company_id);
    return success(res, modules);
  }

  if (user_type === 'employee') {
    const employee_id = parseInt(req.query.employee_id, 10);
    if (!Number.isInteger(employee_id) || employee_id <= 0) {
      return error(res, 'employee_id is required and must be a positive integer', 400);
    }

    const employee = await employeeRepository.findById(employee_id);
    if (!employee) {
      return error(res, 'employee_id does not reference an existing employee', 404);
    }

    // Employees don't have their own permission rows yet -- they inherit
    // whatever menu access their company has been granted.
    const modules = await moduleService.getAccessibleModules(employee.company_id);
    return success(res, modules);
  }

  // Backward-compatible fallback for callers not yet passing user_type.
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
