const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toUserResponse(user) {
  return { id: user.id, email: user.email, role: user.role, hasPin: Boolean(user.pin_hash) };
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

  const tokens = await issueTokens(user);
  return {
    user: toUserResponse(user),
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
    user: toUserResponse(user),
    ...tokens,
  };
}

module.exports = {
  AuthError,
  login,
  refresh,
  logout,
  setPin,
  verifyPin,
};
