const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateProductCategory(req, res, next) {
  const { name, description, status } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  if (status !== undefined) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      req.body.status = status.toUpperCase();
    }
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateProductCategory(req, res, next) {
  const { name, description, status } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    errors.push('name must be a non-empty string');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  if (status !== undefined) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      req.body.status = status.toUpperCase();
    }
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateProductCategory,
  validateUpdateProductCategory,
};
