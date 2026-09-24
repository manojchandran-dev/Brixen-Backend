const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const roleMiddleware = require('../../../middleware/role.middleware');
const c = require('./controller');

const router = Router();

router.get('/conversations', asyncHandler(c.listConversations));
router.get('/conversations/:companyId/messages', asyncHandler(c.getMessages));
router.post('/conversations/:companyId/messages', asyncHandler(c.sendMessage));
router.delete('/conversations/:companyId', roleMiddleware, asyncHandler(c.deleteConversation));
router.post('/conversations/:companyId/restore', roleMiddleware, asyncHandler(c.restoreConversation));

module.exports = router;
