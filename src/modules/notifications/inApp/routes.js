const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const notificationController = require('./controller');

const router = Router();

router.get('/', asyncHandler(notificationController.getNotifications));
router.put('/read-all', asyncHandler(notificationController.markAllAsRead));
router.put('/:id/read', asyncHandler(notificationController.markAsRead));
router.delete('/:id', asyncHandler(notificationController.deleteNotification));

module.exports = router;
