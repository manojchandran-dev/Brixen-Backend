const { Router } = require('express');
const companyRoutes = require('./companies');
const authRoutes = require('./auth');
const expenseCategoryRoutes = require('./expenseCategories');
const employeeRoutes = require('./employees');

const router = Router();

router.use('/companies', companyRoutes);
router.use('/auth', authRoutes);
router.use('/expense-categories', expenseCategoryRoutes);
router.use('/employees', employeeRoutes);

module.exports = router;
