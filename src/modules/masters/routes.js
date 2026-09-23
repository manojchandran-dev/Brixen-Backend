const { Router } = require('express');
const companyCategoryRoutes = require('./companyCategories/routes');
const productCategoryRoutes = require('./productCategories/routes');
const expenseCategoryRoutes = require('./expenseCategories/routes');
const unitRoutes = require('./units/routes');
const featureModuleRoutes = require('./featureModules/routes');

const router = Router();

router.use('/company-categories', companyCategoryRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/expense-categories', expenseCategoryRoutes);
router.use('/units', unitRoutes);
router.use('/modules', featureModuleRoutes);

module.exports = router;
