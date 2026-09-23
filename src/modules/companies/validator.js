const OPTIONAL_STRING_FIELDS = [
  'phone',
  'email',
  'gst_number',
  'address',
  'city',
  'state',
  'pincode',
  'industry_type',
  'subscription_plan',
  'status',
  'entity_type',
  'pan_card',
  'employee_count',
  'secondary_email',
  'website',
];

function validateOptionalStrings(body, errors, fields = OPTIONAL_STRING_FIELDS) {
  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }
}

// Step 1 — Identity
function validateCreateCompany(req, res, next) {
  const { company_name, entity_type, founded_year } = req.body;
  const errors = [];

  if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
    errors.push('company_name is required and must be a non-empty string');
  }

  if (!entity_type || typeof entity_type !== 'string' || !entity_type.trim()) {
    errors.push('entity_type is required and must be a non-empty string');
  }

  if (founded_year !== undefined && founded_year !== null && !Number.isInteger(founded_year)) {
    errors.push('founded_year must be an integer');
  }

  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateCompany(req, res, next) {
  const { company_name } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (company_name !== undefined && (typeof company_name !== 'string' || !company_name.trim())) {
    errors.push('company_name must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Step 2 — Contact
function validateStep2(req, res, next) {
  const { owner_name, email } = req.body;
  const errors = [];

  if (!owner_name || typeof owner_name !== 'string' || !owner_name.trim()) {
    errors.push('owner_name is required and must be a non-empty string');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('email is required and must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors, ['phone', 'secondary_email', 'website']);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Step 3 — Location
function validateStep3(req, res, next) {
  const { address, city, state, pincode } = req.body;
  const errors = [];

  if (!address || typeof address !== 'string' || !address.trim()) {
    errors.push('address is required and must be a non-empty string');
  }

  if (!city || typeof city !== 'string' || !city.trim()) {
    errors.push('city is required and must be a non-empty string');
  }

  if (!state || typeof state !== 'string' || !state.trim()) {
    errors.push('state is required and must be a non-empty string');
  }

  if (!pincode || typeof pincode !== 'string' || !pincode.trim()) {
    errors.push('pincode is required and must be a non-empty string');
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateUpdateStatus(req, res, next) {
  const { status } = req.body;
  const errors = [];

  if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status.toUpperCase())) {
    errors.push(`status is required and must be one of: ${VALID_STATUSES.join(', ')}`);
  } else {
    req.body.status = status.toUpperCase();
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateCompany,
  validateUpdateCompany,
  validateStep2,
  validateStep3,
  validateUpdateStatus,
};
