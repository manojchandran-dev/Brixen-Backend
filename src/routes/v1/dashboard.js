const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const dashboardController = require('../../controllers/dashboardController');

const router = Router();

router.get('/summary', asyncHandler(dashboardController.getDashboardSummary));

module.exports = router;
