const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const service = require('./service');

// Salary generation, part of Employees (mounted behind its permission).
// Scoped to one company (a superadmin passes company_id).

const router = Router();

// Runs [fn] for the request's company; PayrollError -> its status.
const handle = (fn) =>
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.query.company_id ?? req.body?.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return await fn(req, res, company_id);
    } catch (err) {
      if (err instanceof service.PayrollError) return error(res, err.message, err.status);
      throw err;
    }
  });

router.get('/runs', handle(async (req, res, company_id) => success(res, await service.listRuns(company_id))));

// ?month=YYYY-MM or ?week_start=YYYY-MM-DD: its default working days and
// whether a run exists.
router.get(
  '/preview',
  handle(async (req, res, company_id) => success(res, await service.preview(company_id, req.query)))
);

router.post(
  '/runs',
  handle(async (req, res, company_id) => success(res, await service.generate(company_id, req.auth?.userId ?? null, req.body ?? {}), 201))
);

router.get('/runs/:id', handle(async (req, res, company_id) => success(res, await service.getRun(req.params.id, company_id))));

router.post(
  '/runs/:id/finalize',
  handle(async (req, res, company_id) => success(res, await service.finalize(req.params.id, company_id)))
);

router.post(
  '/runs/:id/reopen',
  handle(async (req, res, company_id) => success(res, await service.reopen(req.params.id, company_id)))
);

router.post(
  '/runs/:id/send',
  handle(async (req, res, company_id) => success(res, await service.send(req.params.id, company_id, req.body ?? {})))
);

router.delete(
  '/runs/:id',
  handle(async (req, res, company_id) => {
    await service.removeRun(req.params.id, company_id);
    return res.status(204).send();
  })
);

router.get('/payslips', handle(async (req, res, company_id) => success(res, await service.listPayslips(company_id, req.query))));

router.put(
  '/payslips/:id',
  handle(async (req, res, company_id) => success(res, await service.updatePayslip(req.params.id, company_id, req.body ?? {})))
);

module.exports = router;
