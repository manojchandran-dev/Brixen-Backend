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

module.exports = {
  login,
  refresh,
  logout,
};
