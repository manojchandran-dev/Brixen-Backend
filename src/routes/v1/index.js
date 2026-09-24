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
const asyncHandler = require('../../middleware/asyncHandler');
const session = require('../../middleware/session.middleware');
const roleMiddleware = require('../../middleware/role.middleware');
const requirePermission = require('../../middleware/permission.middleware');
const { error } = require('../../core/responses/apiResponse');

// Companies are managed by the superadmin; a company user may only read its own record.
function companyAccess(req, res, next) {
  if (req.auth.isSuperadmin) return next();
  const ownRecord = req.method === 'GET' && req.path.replace(/\/+$/, '') === `/${req.auth.companyId}`;
  return ownRecord ? next() : error(res, 'Only superadmin can access this', 403);
}

const router = Router();

// Public (login, refresh, password reset); its private routes check the token themselves.
router.use('/auth', authRoutes);

// Everything below needs a valid access token; identity and company come from it.
router.use(asyncHandler(session));

router.use('/companies', companyAccess, companyRoutes);
router.use('/employees', requirePermission('Employees'), employeeRoutes);
router.use(mastersRoutes);
router.use('/expenses', requirePermission('Expenses'), expenseRoutes);
router.use('/customers', requirePermission('Customers'), customerRoutes);
router.use('/sales', requirePermission('Sales'), saleRoutes);
router.use(dashboardRoutes);
router.use('/products', requirePermission('Products'), productRoutes);
// Companies may read their own permissions; only superadmin changes them.
router.use('/permissions', (req, res, next) => (req.method === 'GET' ? next() : roleMiddleware(req, res, next)), permissionRoutes);
router.use('/uploads', uploadRoutes);
router.use(supportRoutes);
router.use(notificationRoutes);

module.exports = router;
