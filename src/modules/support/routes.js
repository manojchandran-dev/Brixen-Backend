const { Router } = require('express');
const ticketRoutes = require('./tickets/routes');
const chatRoutes = require('./chat/routes');
const requirePermission = require('../../middleware/permission.middleware');

const router = Router();

router.use('/support/tickets', requirePermission('Support Ticket'), ticketRoutes);
router.use('/chat', requirePermission('Chatbot'), chatRoutes);

module.exports = router;
