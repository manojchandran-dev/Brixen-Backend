const { Router } = require('express');
const summaryRoutes = require('./summary/routes');
const reportRoutes = require('./reports/routes');
const superadminRoutes = require('./superadmin/routes');
const superadminReportRoutes = require('./superadminReports/routes');

const router = Router();

router.use('/dashboard', summaryRoutes);
router.use('/dashboard', superadminRoutes);
router.use('/reports', reportRoutes);
router.use('/reports', superadminReportRoutes);

module.exports = router;
