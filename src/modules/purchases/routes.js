const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId, resolveListScope } = require('../../utils/companyScope');
const purchaseService = require('./service');

// Mounted at /purchases behind the 'Purchases' permission.
const router = Router();

// Runs a service call for one company, mapping PurchaseError to its status.
const forCompany = (pickCompany, fn, status = 200) =>
  asyncHandler(async (req, res) => {
    const company_id = pickCompany(req);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      const data = await fn(company_id, req);
      return status === 204 ? res.status(204).send() : success(res, data, status);
    } catch (err) {
      if (err instanceof purchaseService.PurchaseError) return error(res, err.message, err.status);
      throw err;
    }
  });
const fromBody = (req) => parseCompanyId(req.body.company_id ?? req.query.company_id);
const fromQuery = (req) => parseCompanyId(req.query.company_id);

router.post('/', forCompany(fromBody, (cid, req) => purchaseService.create(cid, req.body, req.auth?.userId), 201));
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { company_id, ok } = resolveListScope(req.query);
    if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);
    return success(res, await purchaseService.list(company_id, req.query));
  })
);
router.get('/:id', forCompany(fromQuery, (cid, req) => purchaseService.get(req.params.id, cid)));
router.put('/:id', forCompany(fromQuery, (cid, req) => purchaseService.update(req.params.id, cid, req.body, req.auth?.userId)));
router.delete('/:id', forCompany(fromQuery, (cid, req) => purchaseService.remove(req.params.id, cid, req.auth?.userId), 204));

module.exports = router;
