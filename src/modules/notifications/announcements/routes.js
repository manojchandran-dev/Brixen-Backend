const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const restoreHandler = require('../../../utils/restore');
const roleMiddleware = require('../../../middleware/role.middleware');
const announcementController = require('./controller');

const router = Router();

// The one route companies call (registered before the superadmin gate).
router.post('/:id/view', asyncHandler(announcementController.recordView));

router.use(roleMiddleware);

router.get('/', asyncHandler(announcementController.list));
router.post('/', asyncHandler(announcementController.create));
router.get('/:id', asyncHandler(announcementController.get));
router.put('/:id', asyncHandler(announcementController.update));
router.delete('/:id', asyncHandler(announcementController.remove));
router.post('/:id/restore', asyncHandler(restoreHandler('announcements', { label: 'announcement', scoped: false })));
router.post('/:id/duplicate', asyncHandler(announcementController.duplicate));
router.post('/:id/unpublish', asyncHandler(announcementController.unpublish));

module.exports = router;
