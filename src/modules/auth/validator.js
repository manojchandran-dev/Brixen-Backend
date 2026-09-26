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

function validateChangePassword(req, res, next) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
    errors.push('currentPassword is required and must be a non-empty string');
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

const PROFILE_STRING_FIELDS = ['owner_name', 'phone', 'secondary_email', 'website', 'email'];

function validateUpdateMe(req, res, next) {
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  for (const field of PROFILE_STRING_FIELDS) {
    if (req.body[field] !== undefined && req.body[field] !== null && typeof req.body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  if (req.body.email !== undefined && !req.body.email.trim()) {
    errors.push('email must be a non-empty string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Forgot PIN. Errors also carry a message field: the app shows it to the user.
function forgotPinValidator(rules) {
  return (req, res, next) => {
    const errors = rules.filter(([field, ok]) => !ok(req.body[field])).map(([, , msg]) => msg);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });
    next();
  };
}
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const validateForgotPin = forgotPinValidator([['refreshToken', nonEmpty, 'refreshToken is required']]);
const validateVerifyPinOtp = forgotPinValidator([
  ['refreshToken', nonEmpty, 'refreshToken is required'],
  ['otp', (s) => typeof s === 'string' && OTP_REGEX.test(s), 'Enter the 6-digit code'],
]);
const validateResetPin = forgotPinValidator([
  ['resetToken', nonEmpty, 'resetToken is required'],
  ['pin', (s) => typeof s === 'string' && PIN_REGEX.test(s), 'PIN must be exactly 6 digits'],
]);

module.exports = {
  validateForgotPin,
  validateVerifyPinOtp,
  validateResetPin,
  validateLogin,
  validateRefresh,
  validateSetPin,
  validateVerifyPin,
  validateForgotPassword,
  validateVerifyOtp,
  validateResetPassword,
  validateChangePassword,
  validateUpdateMe,
};
