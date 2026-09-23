const unitService = require('../services/unitService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId, resolveListScope } = require('../utils/companyScope');

function isValidId(raw) {
  return /^UNIT\d{12}$/.test(raw);
}

async function createUnit(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  try {
    const unit = await unitService.createUnit(company_id, req.body);
    return success(res, unit, 201);
  } catch (err) {
    if (err instanceof unitService.UnitError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getUnits(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await unitService.getUnits(company_id, { page, limit, search });
  return success(res, result);
}

async function getUnitById(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid unit id', 400);
  }

  const unit = await unitService.getUnitById(id, company_id);
  if (!unit) {
    return error(res, 'Unit not found', 404);
  }

  return success(res, unit);
}

async function updateUnit(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid unit id', 400);
  }

  const existing = await unitService.getUnitById(id, company_id);
  if (!existing) {
    return error(res, 'Unit not found', 404);
  }

  try {
    const unit = await unitService.updateUnit(id, req.body);
    return success(res, unit);
  } catch (err) {
    if (err instanceof unitService.UnitError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteUnit(req, res) {
  const { id } = req.params;
  const company_id = parseCompanyId(req.query.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid unit id', 400);
  }

  const existing = await unitService.getUnitById(id, company_id);
  if (!existing) {
    return error(res, 'Unit not found', 404);
  }

  await unitService.deleteUnit(id);
  return res.status(204).send();
}

module.exports = {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
};
