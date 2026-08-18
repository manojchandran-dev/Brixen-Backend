const GENDERS = ['Male', 'Female', 'Other'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'];
const STATUSES = ['Active', 'Inactive', 'On Leave'];

const OPTIONAL_STRING_FIELDS = [
  'last_name',
  'email',
  'phone',
  'address',
  'department',
  'designation',
  'pan_number',
  'aadhaar_number',
  'bank_name',
  'account_number',
  'ifsc_code',
  'emergency_contact_name',
  'emergency_contact_phone',
];

function validateOptionalStrings(body, errors) {
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }
}

function validateEnum(body, field, allowed, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }

  const match = allowed.find((value) => value.toLowerCase() === String(body[field]).toLowerCase());
  if (!match) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}`);
    return;
  }

  body[field] = match;
}

function validateDate(body, field, errors) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    return;
  }

  const date = new Date(body[field]);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid date`);
    return;
  }

  body[field] = date;
}

function validateManagerId(body, errors) {
  if (body.manager_id === undefined || body.manager_id === null) {
    return;
  }

  const managerId = Number(body.manager_id);
  if (!Number.isInteger(managerId) || managerId <= 0) {
    errors.push('manager_id must be a positive integer');
    return;
  }

  body.manager_id = managerId;
}

function validateSalary(body, errors) {
  if (body.salary === undefined || body.salary === null || body.salary === '') {
    return;
  }

  const salary = Number(body.salary);
  if (Number.isNaN(salary) || salary < 0) {
    errors.push('salary must be a non-negative number');
  }
}

function validateCreateEmployee(req, res, next) {
  const { first_name } = req.body;
  const errors = [];

  if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
    errors.push('first_name is required and must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors);
  validateEnum(req.body, 'gender', GENDERS, errors);
  validateEnum(req.body, 'employment_type', EMPLOYMENT_TYPES, errors);
  validateEnum(req.body, 'status', STATUSES, errors);
  validateDate(req.body, 'date_of_birth', errors);
  validateDate(req.body, 'joining_date', errors);
  validateManagerId(req.body, errors);
  validateSalary(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateEmployee(req, res, next) {
  const { first_name } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (first_name !== undefined && (typeof first_name !== 'string' || !first_name.trim())) {
    errors.push('first_name must be a non-empty string');
  }

  validateOptionalStrings(req.body, errors);
  validateEnum(req.body, 'gender', GENDERS, errors);
  validateEnum(req.body, 'employment_type', EMPLOYMENT_TYPES, errors);
  validateEnum(req.body, 'status', STATUSES, errors);
  validateDate(req.body, 'date_of_birth', errors);
  validateDate(req.body, 'joining_date', errors);
  validateManagerId(req.body, errors);
  validateSalary(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateEmployee,
  validateUpdateEmployee,
};
