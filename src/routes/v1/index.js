const { Router } = require('express');
const companyRoutes = require('./companies');
const authRoutes = require('./auth');
const expenseCategoryRoutes = require('./expenseCategories');
const employeeRoutes = require('./employees');
const companyCategoryRoutes = require('./companyCategories');
const expenseRoutes = require('./expenses');
const unitRoutes = require('./units');

const router = Router();

router.use('/companies', companyRoutes);
router.use('/auth', authRoutes);
router.use('/expense-categories', expenseCategoryRoutes);
router.use('/employees', employeeRoutes);
router.use('/company-categories', companyCategoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/units', unitRoutes);

module.exports = router;
