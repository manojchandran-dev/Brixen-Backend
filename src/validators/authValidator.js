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

module.exports = {
  validateLogin,
  validateRefresh,
};
