const { Router } = require('express');
const companyRoutes = require('./companies');
const authRoutes = require('./auth');

const router = Router();

router.use('/companies', companyRoutes);
router.use('/auth', authRoutes);

module.exports = router;
