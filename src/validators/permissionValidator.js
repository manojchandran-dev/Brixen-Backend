const FLAG_FIELDS = ['view', 'create', 'edit', 'delete'];

function validateFlags(body, errors) {
  for (const field of FLAG_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors.push(`${field} must be true or false`);
    }
  }
}

function validateCreatePermission(req, res, next) {
  const { module_id } = req.body;
  const errors = [];

  if (!module_id || typeof module_id !== 'string' || !module_id.trim()) {
    errors.push('module_id is required and must be a non-empty string');
  }

  validateFlags(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdatePermission(req, res, next) {
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  validateFlags(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreatePermission,
  validateUpdatePermission,
};
