const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const roleMiddleware = require('../../../middleware/role.middleware');
const { success, error } = require('../../../core/responses/apiResponse');
const { parseRange, RangeError400 } = require('./range');
const { TABS } = require('./service');

const router = Router();

// GET /reports/superadmin/:tab?range=week|month|custom|all&from&to&tz
router.get(
  '/superadmin/:tab',
  roleMiddleware,
  asyncHandler(async (req, res) => {
    const build = TABS[req.params.tab];
    if (!build) return error(res, `tab must be one of: ${Object.keys(TABS).join(', ')}`, 404);

    let range;
    try {
      range = parseRange(req.query);
    } catch (err) {
      if (err instanceof RangeError400) return error(res, err.message, 400);
      throw err;
    }
    return success(res, await build(range));
  })
);

module.exports = router;
