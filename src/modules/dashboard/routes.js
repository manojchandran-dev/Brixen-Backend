const { Router } = require('express');
const summaryRoutes = require('./summary/routes');
const reportRoutes = require('./reports/routes');

const router = Router();

router.use('/dashboard', summaryRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
