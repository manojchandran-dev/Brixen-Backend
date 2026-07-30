const authService = require('../services/authService');
const { success, error } = require('../utils/apiResponse');

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await authService.login(email, password);
    return success(res, result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function refresh(req, res) {
  const { refreshToken } = req.body;

  try {
    const result = await authService.refresh(refreshToken);
    return success(res, result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  return res.status(204).send();
}

async function setPin(req, res) {
  const { pin, currentPin } = req.body;

  try {
    await authService.setPin(req.user.sub, pin, currentPin);
    return success(res, { message: 'PIN saved' });
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function verifyPin(req, res) {
  const { refreshToken, pin } = req.body;

  try {
    const result = await authService.verifyPin(refreshToken, pin);
    return success(res, result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

module.exports = {
  login,
  refresh,
  logout,
  setPin,
  verifyPin,
};
