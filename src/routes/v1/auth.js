const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authController = require('../../controllers/authController');
const {
  validateLogin,
  validateRefresh,
  validateSetPin,
  validateVerifyPin,
} = require('../../validators/authValidator');

const router = Router();

router.post('/login', validateLogin, asyncHandler(authController.login));
router.post('/refresh', validateRefresh, asyncHandler(authController.refresh));
router.post('/logout', validateRefresh, asyncHandler(authController.logout));
router.post('/pin', authenticate, validateSetPin, asyncHandler(authController.setPin));
router.post('/pin/verify', validateVerifyPin, asyncHandler(authController.verifyPin));

module.exports = router;
