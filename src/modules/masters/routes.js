const { Router } = require('express');
const companyCategoryRoutes = require('./companyCategories/routes');
const productCategoryRoutes = require('./productCategories/routes');
const expenseCategoryRoutes = require('./expenseCategories/routes');
const unitRoutes = require('./units/routes');
const featureModuleRoutes = require('./featureModules/routes');
const requirePermission = require('../../middleware/permission.middleware');

const router = Router();

router.use('/company-categories', requirePermission('Company Category'), companyCategoryRoutes);
router.use('/product-categories', requirePermission('Product Category'), productCategoryRoutes);
router.use('/expense-categories', requirePermission('Expense Category'), expenseCategoryRoutes);
router.use('/units', requirePermission('Units'), unitRoutes);
router.use('/modules', featureModuleRoutes);

module.exports = router;
