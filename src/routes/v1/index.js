const { Router } = require('express');
const companyRoutes = require('./companies');

const router = Router();

router.use('/companies', companyRoutes);

module.exports = router;
