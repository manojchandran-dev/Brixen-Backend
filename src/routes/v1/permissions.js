const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const permissionController = require('../../controllers/permissionController');
const {
  validateCreatePermission,
  validateBulkCreatePermissions,
  validateUpdatePermission,
} = require('../../validators/permissionValidator');

const router = Router();

router.post('/bulk', validateBulkCreatePermissions, asyncHandler(permissionController.createPermissionsBulk));
router.post('/', validateCreatePermission, asyncHandler(permissionController.createPermission));
router.get('/', asyncHandler(permissionController.getPermissions));
router.get('/:id', asyncHandler(permissionController.getPermissionById));
router.put('/:id', validateUpdatePermission, asyncHandler(permissionController.updatePermission));
router.delete('/:id', asyncHandler(permissionController.deletePermission));

module.exports = router;
