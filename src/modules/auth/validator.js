function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('email is required and must be a non-empty string');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('password is required and must be a non-empty string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateRefresh(req, res, next) {
  const { refreshToken } = req.body;
  const errors = [];

  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
    errors.push('refreshToken is required and must be a non-empty string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

const PIN_REGEX = /^\d{6}$/;

function validateSetPin(req, res, next) {
  const { pin, currentPin } = req.body;
  const errors = [];

  if (!pin || !PIN_REGEX.test(pin)) {
    errors.push('pin is required and must be exactly 6 digits');
  }

  if (currentPin !== undefined && !PIN_REGEX.test(currentPin)) {
    errors.push('currentPin must be exactly 6 digits');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateVerifyPin(req, res, next) {
  const { refreshToken, pin } = req.body;
  const errors = [];

  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
    errors.push('refreshToken is required and must be a non-empty string');
  }

  if (!pin || !PIN_REGEX.test(pin)) {
    errors.push('pin is required and must be exactly 6 digits');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

const OTP_REGEX = /^\d{6}$/;

function validateForgotPassword(req, res, next) {
  const { email } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('email is required and must be a non-empty string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateVerifyOtp(req, res, next) {
  const { email, otp } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('email is required and must be a non-empty string');
  }

  if (!otp || !OTP_REGEX.test(otp)) {
    errors.push('otp is required and must be exactly 6 digits');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateResetPassword(req, res, next) {
  const { resetToken, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!resetToken || typeof resetToken !== 'string' || !resetToken.trim()) {
    errors.push('resetToken is required and must be a non-empty string');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    errors.push('newPassword is required and must be at least 8 characters');
  }

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    errors.push('confirmPassword must match newPassword');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateLogin,
  validateRefresh,
  validateSetPin,
  validateVerifyPin,
  validateForgotPassword,
  validateVerifyOtp,
  validateResetPassword,
};
