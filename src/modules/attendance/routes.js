const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const service = require('./service');
const lots = require('./lots');

// Company admins record their employees' attendance. Scoped to one company
// (a superadmin passes company_id).

const router = Router();

// Runs [fn] for the request's company; AttendanceError -> its status.
const handle = (fn) =>
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.query.company_id ?? req.body?.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return await fn(req, res, company_id);
    } catch (err) {
      if (err instanceof service.AttendanceError) return error(res, err.message, err.status);
      throw err;
    }
  });

// Lots delivered (piece work counted at delivery); before /:id.
router.use('/lots', lots.router);

// The company's time zone and today's date in it (for the date picker).
router.get(
  '/meta',
  handle(async (req, res, company_id) => {
    const { meta } = await service.list(company_id, { employee_id: -1 });
    return success(res, { ...meta, shift_units: service.SHIFT_UNITS, max_shifts: service.MAX_SHIFTS, max_hours: service.MAX_HOURS });
  })
);

router.get(
  '/',
  handle(async (req, res, company_id) => success(res, await service.list(company_id, req.query)))
);

router.get(
  '/:id',
  handle(async (req, res, company_id) => {
    const record = await service.getOne(req.params.id, company_id);
    return record ? success(res, record) : error(res, 'Attendance not found', 404);
  })
);

router.post(
  '/',
  handle(async (req, res, company_id) => success(res, await service.create(company_id, req.auth?.userId ?? null, req.body ?? {}), 201))
);

router.put(
  '/:id',
  handle(async (req, res, company_id) =>
    success(res, await service.update(req.params.id, company_id, req.auth?.userId ?? null, req.body ?? {}))
  )
);

router.delete(
  '/:id',
  handle(async (req, res, company_id) => {
    await service.remove(req.params.id, company_id);
    return res.status(204).send();
  })
);

module.exports = router;
