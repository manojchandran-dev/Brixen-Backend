const permissionService = require('../services/permissionService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

function isValidId(raw) {
  return /^PERM\d{12}$/.test(raw);
}

async function createPermission(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const permission = await permissionService.createPermission(company_id, req.body);
    return success(res, permission, 201);
  } catch (err) {
    if (err instanceof permissionService.PermissionError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getPermissions(req, res) {
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const module_id = req.query.module_id || undefined;

  const result = await permissionService.getPermissions(company_id, { page, limit, module_id });
  return success(res, result);
}

async function getPermissionById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid permission id', 400);
  }

  const permission = await permissionService.getPermissionById(id, company_id);
  if (!permission) {
    return error(res, 'Permission not found', 404);
  }

  return success(res, permission);
}

async function updatePermission(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid permission id', 400);
  }

  const existing = await permissionService.getPermissionById(id, company_id);
  if (!existing) {
    return error(res, 'Permission not found', 404);
  }

  const permission = await permissionService.updatePermission(id, req.body);
  return success(res, permission);
}

async function deletePermission(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid permission id', 400);
  }

  const existing = await permissionService.getPermissionById(id, company_id);
  if (!existing) {
    return error(res, 'Permission not found', 404);
  }

  await permissionService.deletePermission(id);
  return res.status(204).send();
}

module.exports = {
  createPermission,
  getPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
};
