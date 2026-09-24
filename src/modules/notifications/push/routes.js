const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const authenticate = require('../../../middleware/auth.middleware');
const roleMiddleware = require('../../../middleware/role.middleware');
const pushNotificationController = require('./controller');

const router = Router();

// A company's own device registration -- any logged-in company account, not
// just superadmin, so these are registered before the gate below.
router.post('/devices', authenticate, asyncHandler(pushNotificationController.registerDevice));
router.delete('/devices', authenticate, asyncHandler(pushNotificationController.unregisterDevice));
router.post('/:id/opened', authenticate, asyncHandler(pushNotificationController.markOpened));

router.use(roleMiddleware);

router.get('/', asyncHandler(pushNotificationController.list));
router.post('/', asyncHandler(pushNotificationController.create));
router.get('/:id', asyncHandler(pushNotificationController.get));
router.put('/:id', asyncHandler(pushNotificationController.update));
router.delete('/:id', asyncHandler(pushNotificationController.remove));
router.post('/:id/duplicate', asyncHandler(pushNotificationController.duplicate));
router.post('/:id/cancel', asyncHandler(pushNotificationController.cancel));

module.exports = router;
