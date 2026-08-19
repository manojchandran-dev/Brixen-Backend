const OPTIONAL_STRING_FIELDS = ['shop_name', 'phone', 'email', 'gst_number', 'address'];

function validateOptionalStrings(body, errors) {
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }
}

function validateCreateCustomer(req, res, next) {
  const { name } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateCustomer(req, res, next) {
  const { name } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    errors.push('name must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateCustomer,
  validateUpdateCustomer,
};
