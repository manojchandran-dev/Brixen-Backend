const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const roleMiddleware = require('../../../middleware/role.middleware');
const restoreHandler = require('../../../utils/restore');
const c = require('./controller');

const router = Router();

router.post('/', asyncHandler(c.createTicket));
router.get('/', asyncHandler(c.getTickets));
router.get('/:id', asyncHandler(c.getTicketById));
router.put('/:id/status', asyncHandler(c.updateStatus));
router.put('/:id/assign', asyncHandler(c.assign));
router.post('/:id/messages', asyncHandler(c.addNote));
router.delete('/:id', asyncHandler(c.deleteTicket));
router.post(
  '/:id/restore',
  roleMiddleware,
  asyncHandler(restoreHandler('support_tickets', { label: 'ticket', scoped: false }))
);

module.exports = router;
