const { Router } = require('express');
const summaryRoutes = require('./summary/routes');
const reportRoutes = require('./reports/routes');
const superadminRoutes = require('./superadmin/routes');

const router = Router();

router.use('/dashboard', summaryRoutes);
router.use('/dashboard', superadminRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
