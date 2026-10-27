const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  users: userRepository,
  refreshTokens: refreshTokenRepository,
  passwordResets: passwordResetRepository,
} = require('./repository');
const companyRepository = require('../companies/repository');
const prisma = require('../../prisma/client');
const { isValidTz } = require('../../utils/timezone');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { sendOtpEmail, sendPinResetOtpEmail } = require('../../utils/mailer');

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
    // Drop the plaintext temporary password stored on the company row.
    const { password, ...company } = (await companyRepository.findById(user.company_id)) || {};
    base.company = company.id ? company : null;
  }

  // An employee's own login: who they are, and their company's name (never
  // the company's own record, which carries admin-only details).
  if (user.user_type === 'employee' && user.employee_id) {
    const employee = await prisma.employees.findFirst({
      where: { id: user.employee_id },
      include: {
        departments: { select: { name: true } },
        companies: { select: { id: true, company_name: true, company_code: true, status: true, timezone: true } },
      },
    });
    base.employee_id = user.employee_id;
    base.employee = employee && {
      id: employee.id,
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      last_name: employee.last_name,
      department: employee.departments?.name ?? employee.department,
      salary_type: employee.salary_type,
    };
    base.company = employee?.companies ?? null;
  }

  // 'superadmin' has no separate table -- the user record above is already
  // the full picture for that role.

  return base;
}

// An employee may sign in only while their record exists and is Active.
async function assertEmployeeActive(user) {
  if (user.user_type !== 'employee') return;
  const employee =
    user.employee_id &&
    (await prisma.employees.findFirst({ where: { id: user.employee_id, company_id: user.company_id }, select: { status: true } }));
  if (!employee || employee.status !== 'Active') {
    throw new AuthError('Your employee access is turned off. Please contact your company admin.', 403);
  }
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

const { logActivity } = require('../../utils/activityLog');

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
  await assertEmployeeActive(user);

  const tokens = await issueTokens(user);
  const title = { superadmin: 'Superadmin login', employee: 'Employee login' }[user.user_type] ?? 'Admin login';
  logActivity({ type: user.user_type === 'employee' ? 'employee_login' : 'admin_login', title, detail: user.email, ref_id: user.id, actor_user_id: user.id, company_id: user.company_id });
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

// The lock screen identifies the user by their refresh token (the access
// token may have expired). 401 when it's invalid, expired or revoked.
async function userFromRefreshToken(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }

  const stored = await refreshTokenRepository.findValidByHash(hashToken(refreshToken));
  if (!stored) {
    throw new AuthError('Invalid or expired refresh token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new AuthError('Invalid or expired refresh token');
  }
  return { user, stored };
}

async function verifyPin(refreshToken, pin) {
  const { user, stored } = await userFromRefreshToken(refreshToken);

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

// Cryptographically random 6-digit code.
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

// ---------- Forgot PIN (lock screen) ----------

const PIN_CODES_PER_HOUR = 5;
const PIN_OTP_MAX_ATTEMPTS = 5;

// "manoj@gmail.com" -> "m***@gmail.com"
function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}

// 1. Email a 6-digit code for resetting the app PIN.
async function forgotPin(refreshToken) {
  const { user } = await userFromRefreshToken(refreshToken);
  if (!user.pin_hash) throw new AuthError('PIN is not set for this user', 400);

  const latest = await passwordResetRepository.findLatestActiveByUserId(user.id, 'pin');
  if (latest && Date.now() - latest.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new AuthError('Please wait 30 seconds before requesting another code', 429);
  }
  const sentLastHour = await passwordResetRepository.countSince(user.id, 'pin', new Date(Date.now() - 60 * 60 * 1000));
  if (sentLastHour >= PIN_CODES_PER_HOUR) {
    throw new AuthError('Too many codes requested. Please try again in an hour.', 429);
  }

  // A new code replaces any earlier unused one.
  if (latest) await passwordResetRepository.markConsumed(latest.id);
  const otp = generateOtp();
  await passwordResetRepository.create({
    user_id: user.id,
    purpose: 'pin',
    otp_hash: hashToken(otp),
    otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendPinResetOtpEmail(user.email, otp);

  return { email: maskEmail(user.email) };
}

// 2. Check the code; returns a single-use reset token (10 minutes).
async function verifyPinOtp(refreshToken, otp) {
  const { user } = await userFromRefreshToken(refreshToken);
  const record = await passwordResetRepository.findLatestActiveByUserId(user.id, 'pin');

  // A code that already produced a reset token can't be used again.
  if (!record || record.reset_token_hash || record.otp_expires_at < new Date()) {
    throw new AuthError('This code has expired. Please request a new one.', 400);
  }

  if (record.otp_hash !== hashToken(otp)) {
    const attempts = record.attempts + 1;
    if (attempts >= PIN_OTP_MAX_ATTEMPTS) {
      await passwordResetRepository.update(record.id, { attempts, consumed_at: new Date() });
      throw new AuthError('Too many incorrect attempts. Please request a new code.', 429);
    }
    await passwordResetRepository.update(record.id, { attempts });
    const left = PIN_OTP_MAX_ATTEMPTS - attempts;
    throw new AuthError(`Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`, 400);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  await passwordResetRepository.update(record.id, {
    reset_token_hash: hashToken(resetToken),
    token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  return { resetToken };
}

// 3. Save the new PIN and start a fresh session (same shape as /pin/verify).
async function resetPin(resetToken, pin) {
  const record = await passwordResetRepository.findValidByResetTokenHash(hashToken(resetToken), 'pin');
  if (!record) throw new AuthError('This reset link has expired or was already used. Please start again.', 400);

  const user = await userRepository.findById(record.user_id);
  if (!user) throw new AuthError('Invalid or expired refresh token');

  await passwordResetRepository.markConsumed(record.id);
  await userRepository.update(user.id, { pin_hash: await bcrypt.hash(pin, 10) });
  logActivity({ type: 'pin_reset', title: 'PIN reset', detail: user.email, ref_id: user.id, actor_user_id: user.id, company_id: user.company_id });

  const tokens = await issueTokens(user);
  return { user: await toUserResponse(user), ...tokens };
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

// Authenticated password change: requires knowing the current password, unlike
// the forgot-password OTP flow above. Revokes other sessions the same way.
async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentMatches) {
    throw new AuthError('Current password is incorrect');
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(userId, { password_hash });
  await refreshTokenRepository.revokeAllForUser(userId);
}

async function getMe(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }
  return toUserResponse(user);
}

// Self-service profile fields, editable per role -- deliberately narrower than
// the admin-facing company update (no status/company_code/onboarding fields).
// timezone: the company's working day for attendance (an IANA zone name).
const COMPANY_PROFILE_FIELDS = ['owner_name', 'phone', 'secondary_email', 'website', 'timezone'];

async function updateMe(userId, data) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (user.user_type === 'company' && user.company_id) {
    if (data.timezone !== undefined && !isValidTz(data.timezone)) {
      throw new AuthError('timezone must be a time zone name, e.g. Asia/Kolkata', 400);
    }
    const payload = COMPANY_PROFILE_FIELDS.reduce((acc, field) => {
      if (data[field] !== undefined) acc[field] = data[field];
      return acc;
    }, {});
    if (Object.keys(payload).length) {
      await companyRepository.update(user.company_id, payload);
    }
  } else if (user.user_type === 'employee') {
    // An employee's login is set up by their company admin.
    throw new AuthError('Ask your company admin to change your login details', 403);
  } else if (data.email !== undefined) {
    await userRepository.update(userId, { email: data.email });
  }

  return getMe(userId);
}

module.exports = {
  AuthError,
  login,
  refresh,
  logout,
  setPin,
  verifyPin,
  forgotPin,
  verifyPinOtp,
  resetPin,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  getMe,
  updateMe,
};
