const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const supportTicketController = require('../../controllers/supportTicketController');

const router = Router();

router.post('/', asyncHandler(supportTicketController.createTicket));
router.get('/', asyncHandler(supportTicketController.getTickets));
router.get('/:id', asyncHandler(supportTicketController.getTicketById));
router.put('/:id/status', asyncHandler(supportTicketController.updateTicketStatus));
router.delete('/:id', asyncHandler(supportTicketController.deleteTicket));

module.exports = router;
