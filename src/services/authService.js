const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const companyRepository = require('../repositories/companyRepository');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { sendOtpEmail } = require('../utils/mailer');

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function toUserResponse(user) {
  const base = {
    id: user.id,
    email: user.email,
    role: user.role,
    user_type: user.user_type,
    company_id: user.company_id,
    hasPin: Boolean(user.pin_hash),
  };

  if (user.user_type === 'company' && user.company_id) {
    base.company = await companyRepository.findById(user.company_id);
  }

  // user_type 'employee' has no login system yet (employees table has no
  // credentials, and users has no employee_id link), so there's nothing to
  // attach here yet. 'superadmin' has no separate table -- the user record
  // above is already the full picture for that role.

  return base;
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const { exp } = jwt.decode(refreshToken);

  await refreshTokenRepository.create({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(exp * 1000),
  });

  return { accessToken, refreshToken };
}

async function login(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AuthError('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AuthError('Invalid email or password');
  }

  if (user.company_id) {
    const company = await companyRepository.findById(user.company_id);
    if (!company || company.status !== 'ACTIVE') {
      throw new AuthError('Your company account is inactive. Please contact your administrator.', 403);
    }
  }

  const tokens = await issueTokens(user);
  return {
    user: await toUserResponse(user),
    ...tokens,
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await refreshTokenRepository.findValidByHash(tokenHash);
  if (!stored) {
    throw new AuthError('Invalid or expired refresh token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new AuthError('Invalid or expired refresh token');
  }

  await refreshTokenRepository.revoke(stored.id);
  return issueTokens(user);
}

async function logout(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const stored = await refreshTokenRepository.findValidByHash(tokenHash);
  if (stored) {
    await refreshTokenRepository.revoke(stored.id);
  }
}

async function setPin(userId, pin, currentPin) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (user.pin_hash) {
    const currentPinMatches = currentPin && (await bcrypt.compare(currentPin, user.pin_hash));
    if (!currentPinMatches) {
      throw new AuthError('Current PIN is incorrect');
    }
  }

  const pin_hash = await bcrypt.hash(pin, 10);
  await userRepository.update(userId, { pin_hash });
}

async function verifyPin(refreshToken, pin) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await refreshTokenRepository.findValidByHash(tokenHash);
  if (!stored) {
    throw new AuthError('Invalid or expired refresh token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new AuthError('Invalid or expired refresh token');
  }

  if (!user.pin_hash) {
    throw new AuthError('PIN is not set for this user', 400);
  }

  const pinMatches = await bcrypt.compare(pin, user.pin_hash);
  if (!pinMatches) {
    throw new AuthError('Invalid PIN');
  }

  await refreshTokenRepository.revoke(stored.id);
  const tokens = await issueTokens(user);
  return {
    user: await toUserResponse(user),
    ...tokens,
  };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Don't reveal whether the email exists.
    return;
  }

  const latest = await passwordResetRepository.findLatestActiveByUserId(user.id);
  if (latest && Date.now() - latest.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new AuthError('Please wait before requesting another code', 429);
  }

  const otp = generateOtp();
  await passwordResetRepository.create({
    user_id: user.id,
    otp_hash: hashToken(otp),
    otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendOtpEmail(user.email, otp);
}

async function verifyOtp(email, otp) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AuthError('Invalid or expired code');
  }

  const record = await passwordResetRepository.findLatestActiveByUserId(user.id);
  if (!record || record.otp_expires_at < new Date()) {
    throw new AuthError('Invalid or expired code');
  }

  if (record.otp_hash !== hashToken(otp)) {
    throw new AuthError('Invalid or expired code');
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  await passwordResetRepository.update(record.id, {
    reset_token_hash: hashToken(resetToken),
    token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  return { resetToken };
}

async function resetPassword(resetToken, newPassword) {
  const record = await passwordResetRepository.findValidByResetTokenHash(hashToken(resetToken));
  if (!record) {
    throw new AuthError('Invalid or expired reset token');
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(record.user_id, { password_hash });
  await passwordResetRepository.markConsumed(record.id);
  await refreshTokenRepository.revokeAllForUser(record.user_id);
}

module.exports = {
  AuthError,
  login,
  refresh,
  logout,
  setPin,
  verifyPin,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
