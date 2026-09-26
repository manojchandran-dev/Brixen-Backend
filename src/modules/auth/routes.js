const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/auth.middleware');
const authController = require('./controller');
const {
  validateLogin,
  validateRefresh,
  validateSetPin,
  validateVerifyPin,
  validateForgotPassword,
  validateVerifyOtp,
  validateResetPassword,
  validateChangePassword,
  validateUpdateMe,
  validateForgotPin,
  validateVerifyPinOtp,
  validateResetPin,
} = require('./validator');

const router = Router();

router.post('/login', validateLogin, asyncHandler(authController.login));
router.post('/refresh', validateRefresh, asyncHandler(authController.refresh));
router.post('/logout', validateRefresh, asyncHandler(authController.logout));
router.post('/pin', authenticate, validateSetPin, asyncHandler(authController.setPin));
router.post('/pin/verify', validateVerifyPin, asyncHandler(authController.verifyPin));
// Forgot PIN (lock screen): identified by refreshToken, like /pin/verify.
router.post('/pin/forgot', validateForgotPin, asyncHandler(authController.forgotPin));
router.post('/pin/forgot/verify', validateVerifyPinOtp, asyncHandler(authController.verifyPinOtp));
router.post('/pin/reset', validateResetPin, asyncHandler(authController.resetPin));
router.post('/forgot-password', validateForgotPassword, asyncHandler(authController.forgotPassword));
router.post('/verify-otp', validateVerifyOtp, asyncHandler(authController.verifyOtp));
router.post('/reset-password', validateResetPassword, asyncHandler(authController.resetPassword));
router.post('/change-password', authenticate, validateChangePassword, asyncHandler(authController.changePassword));
router.get('/me', authenticate, asyncHandler(authController.me));
router.put('/me', authenticate, validateUpdateMe, asyncHandler(authController.updateMe));

module.exports = router;
