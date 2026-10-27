const { Router } = require('express');
const companyCategoryRoutes = require('./companyCategories/routes');
const productCategoryRoutes = require('./productCategories/routes');
const purchaseCategoryRoutes = require('./purchaseCategories/routes');
const expenseCategoryRoutes = require('./expenseCategories/routes');
const unitRoutes = require('./units/routes');
const featureModuleRoutes = require('./featureModules/routes');
const requirePermission = require('../../middleware/permission.middleware');
const prisma = require('../../prisma/client');
const { companyMasterRouter } = require('./companyMaster');

const router = Router();

router.use('/company-categories', requirePermission('Company Category'), companyCategoryRoutes);
router.use('/product-categories', requirePermission('Product Category'), productCategoryRoutes);
router.use('/purchase-categories', requirePermission('Purchase Category'), purchaseCategoryRoutes);
router.use('/expense-categories', requirePermission('Expense Category'), expenseCategoryRoutes);
router.use('/units', requirePermission('Units'), unitRoutes);
// The company's own lists for staff: departments, and piece-rate work types.
router.use(
  '/departments',
  requirePermission('Department'),
  companyMasterRouter({
    model: 'departments',
    prefix: 'DEPT',
    label: 'department',
    // Deactivate instead: employees keep pointing at it.
    inUse: async (id) => {
      const n = await prisma.employees.count({ where: { department_id: id } });
      return n ? `${n} employee(s) are in this department. Move them first, or set it Inactive.` : null;
    },
  })
);
router.use(
  '/work-types',
  requirePermission('Work Type'),
  companyMasterRouter({ model: 'work_types', prefix: 'WTYP', label: 'work type', rate: true })
);
router.use('/modules', featureModuleRoutes);

module.exports = router;
