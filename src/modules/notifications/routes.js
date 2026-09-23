const { Router } = require('express');
const inAppRoutes = require('./inApp/routes');
const pushRoutes = require('./push/routes');
const announcementRoutes = require('./announcements/routes');

const router = Router();

router.use('/notifications/push', pushRoutes);
router.use('/notifications', inAppRoutes);
router.use('/announcements', announcementRoutes);

module.exports = router;
