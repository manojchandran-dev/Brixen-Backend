const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const roleMiddleware = require('../../middleware/role.middleware');
const permissionController = require('./controller');
const {
  validateCreatePermission,
  validateBulkCreatePermissions,
  validateUpdatePermission,
} = require('./validator');

const router = Router();

router.post('/bulk', validateBulkCreatePermissions, asyncHandler(permissionController.createPermissionsBulk));
router.post('/', validateCreatePermission, asyncHandler(permissionController.createPermission));
router.get('/companies', roleMiddleware, asyncHandler(permissionController.getCompanyAccessList));
router.get('/', asyncHandler(permissionController.getPermissions));
router.get('/:id', asyncHandler(permissionController.getPermissionById));
router.put('/:id', validateUpdatePermission, asyncHandler(permissionController.updatePermission));
router.delete('/:id', asyncHandler(permissionController.deletePermission));

module.exports = router;
