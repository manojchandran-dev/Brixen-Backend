const { Router } = require('express');
const companyRoutes = require('../../modules/companies/routes');
const authRoutes = require('../../modules/auth/routes');
const employeeRoutes = require('../../modules/employees/routes');
const mastersRoutes = require('../../modules/masters/routes');
const expenseRoutes = require('../../modules/expenses/routes');
const customerRoutes = require('../../modules/customers/routes');
const saleRoutes = require('../../modules/sales/routes');
const dashboardRoutes = require('../../modules/dashboard/routes');
const productRoutes = require('../../modules/products/routes');
const permissionRoutes = require('../../modules/permissions/routes');
const uploadRoutes = require('../../modules/uploads/routes');
const supportRoutes = require('../../modules/support/routes');
const notificationRoutes = require('../../modules/notifications/routes');

const router = Router();

router.use('/companies', companyRoutes);
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use(mastersRoutes);
router.use('/expenses', expenseRoutes);
router.use('/customers', customerRoutes);
router.use('/sales', saleRoutes);
router.use(dashboardRoutes);
router.use('/products', productRoutes);
router.use('/permissions', permissionRoutes);
router.use('/uploads', uploadRoutes);
router.use(supportRoutes);
router.use(notificationRoutes);

module.exports = router;
