const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const reportController = require('../../controllers/reportController');

const router = Router();

router.get('/summary', asyncHandler(reportController.getReportSummary));

module.exports = router;
