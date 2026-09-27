const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId, resolveListScope } = require('../../utils/companyScope');
const inventoryService = require('./service');

// Mounted at /inventory behind the 'Products' permission (stock is part of a
// product): reads need view, adjustments need create.
const router = Router();

const listScope = (handler) =>
  asyncHandler(async (req, res) => {
    const { company_id, ok } = resolveListScope(req.query);
    if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);
    return success(res, await handler(company_id, req.query));
  });

router.get('/', listScope(inventoryService.overview));
router.get('/movements', listScope(inventoryService.movements));

router.post(
  '/adjustments',
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.body.company_id ?? req.query.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return success(res, await inventoryService.adjust(company_id, req.body, req.auth?.userId), 201);
    } catch (err) {
      if (err instanceof inventoryService.InventoryError) return error(res, err.message, err.status);
      throw err;
    }
  })
);

module.exports = router;
