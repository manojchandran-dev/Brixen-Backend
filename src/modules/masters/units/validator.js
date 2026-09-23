function validateCreateUnit(req, res, next) {
  const { unit, full_form, description, company_id } = req.body;
  const errors = [];

  if (company_id === undefined || company_id === null || !/^\d+$/.test(String(company_id))) {
    errors.push('company_id is required and must be a positive integer');
  }

  if (!unit || typeof unit !== 'string' || !unit.trim()) {
    errors.push('unit is required and must be a non-empty string');
  }

  if (full_form !== undefined && full_form !== null && typeof full_form !== 'string') {
    errors.push('full_form must be a string');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateUnit(req, res, next) {
  const { unit, full_form, description } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (unit !== undefined && (typeof unit !== 'string' || !unit.trim())) {
    errors.push('unit must be a non-empty string');
  }

  if (full_form !== undefined && full_form !== null && typeof full_form !== 'string') {
    errors.push('full_form must be a string');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateUnit,
  validateUpdateUnit,
};
