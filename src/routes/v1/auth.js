const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authController = require('../../controllers/authController');
const { validateLogin, validateRefresh } = require('../../validators/authValidator');

const router = Router();

router.post('/login', validateLogin, asyncHandler(authController.login));
router.post('/refresh', validateRefresh, asyncHandler(authController.refresh));
router.post('/logout', validateRefresh, asyncHandler(authController.logout));

module.exports = router;
