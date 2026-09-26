const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const roleMiddleware = require('../../../middleware/role.middleware');
const { success } = require('../../../core/responses/apiResponse');
const { getSuperadminDashboard } = require('./service');

const router = Router();

// GET /dashboard/superadmin -- the whole superadmin dashboard in one call.
router.get(
  '/superadmin',
  roleMiddleware,
  asyncHandler(async (req, res) => success(res, await getSuperadminDashboard(Date.now())))
);

module.exports = router;
