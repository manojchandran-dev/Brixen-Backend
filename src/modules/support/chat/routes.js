const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const c = require('./controller');

const router = Router();

router.get('/conversations', asyncHandler(c.listConversations));
router.get('/conversations/:companyId/messages', asyncHandler(c.getMessages));
router.post('/conversations/:companyId/messages', asyncHandler(c.sendMessage));

module.exports = router;
