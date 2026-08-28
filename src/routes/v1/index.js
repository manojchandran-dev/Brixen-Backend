const { Router } = require('express');
const companyRoutes = require('./companies');
const authRoutes = require('./auth');
const expenseCategoryRoutes = require('./expenseCategories');
const employeeRoutes = require('./employees');
const companyCategoryRoutes = require('./companyCategories');
const expenseRoutes = require('./expenses');
const unitRoutes = require('./units');
const customerRoutes = require('./customers');
const saleRoutes = require('./sales');
const dashboardRoutes = require('./dashboard');
const reportRoutes = require('./reports');
const productCategoryRoutes = require('./productCategories');
const productRoutes = require('./products');

const router = Router();

router.use('/companies', companyRoutes);
router.use('/auth', authRoutes);
router.use('/expense-categories', expenseCategoryRoutes);
router.use('/employees', employeeRoutes);
router.use('/company-categories', companyCategoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/units', unitRoutes);
router.use('/customers', customerRoutes);
router.use('/sales', saleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/products', productRoutes);

module.exports = router;
