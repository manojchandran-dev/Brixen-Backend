function validateCreateCompany(req, res, next) {
  const { name, email, phone, address } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  if (email && typeof email !== 'string') {
    errors.push('email must be a string');
  }

  if (phone && typeof phone !== 'string') {
    errors.push('phone must be a string');
  }

  if (address && typeof address !== 'string') {
    errors.push('address must be a string');
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  next();
}

function validateUpdateCompany(req, res, next) {
  const { name, email, phone, address } = req.body;
  const errors = [];

  if (!name && !email && !phone && !address) {
    errors.push('At least one update field is required: name, email, phone, or address');
  }

  if (name && typeof name !== 'string') {
    errors.push('name must be a string');
  }

  if (email && typeof email !== 'string') {
    errors.push('email must be a string');
  }

  if (phone && typeof phone !== 'string') {
    errors.push('phone must be a string');
  }

  if (address && typeof address !== 'string') {
    errors.push('address must be a string');
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  next();
}

module.exports = {
  validateCreateCompany,
  validateUpdateCompany,
};
