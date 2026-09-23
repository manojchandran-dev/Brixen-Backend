const { Router } = require('express');
const ticketRoutes = require('./tickets/routes');
const chatRoutes = require('./chat/routes');

const router = Router();

router.use('/support/tickets', ticketRoutes);
router.use('/chat', chatRoutes);

module.exports = router;
