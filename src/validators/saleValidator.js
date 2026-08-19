const PAYMENT_TYPES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partial'];

const OPTIONAL_STRING_FIELDS = ['invoice_type', 'bill_image_url', 'notes'];

function validateOptionalStrings(body, errors) {
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }
}

function validateCustomerId(body, errors) {
  if (body.customer_id === undefined || body.customer_id === null) {
    return;
  }

  if (typeof body.customer_id !== 'string' || !body.customer_id.trim()) {
    errors.push('customer_id must be a non-empty string');
  }
}

function validateBillDate(body, errors) {
  if (body.bill_date === undefined || body.bill_date === null || body.bill_date === '') {
    return;
  }

  const date = new Date(body.bill_date);
  if (Number.isNaN(date.getTime())) {
    errors.push('bill_date must be a valid date');
    return;
  }

  body.bill_date = date;
}

function validateDecimal(body, field, errors, { required, allowNegative = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) {
      errors.push(`${field} is required and must be a number`);
    }
    return;
  }

  const value = Number(body[field]);
  if (Number.isNaN(value) || (!allowNegative && value < 0)) {
    errors.push(`${field} must be a ${allowNegative ? '' : 'non-negative '}number`);
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

function validateCreateSale(req, res, next) {
  const errors = [];

  validateCustomerId(req.body, errors);
  validateBillDate(req.body, errors);
  validateOptionalStrings(req.body, errors);
  validateDecimal(req.body, 'subtotal', errors, { required: true });
  validateDecimal(req.body, 'tax_amount', errors, { required: false });
  validateDecimal(req.body, 'total_amount', errors, { required: false });
  validateEnum(req.body, 'payment_type', PAYMENT_TYPES, errors);
  validateEnum(req.body, 'payment_status', PAYMENT_STATUSES, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateSale(req, res, next) {
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  validateCustomerId(req.body, errors);
  validateBillDate(req.body, errors);
  validateOptionalStrings(req.body, errors);
  validateDecimal(req.body, 'subtotal', errors, { required: false });
  validateDecimal(req.body, 'tax_amount', errors, { required: false });
  validateDecimal(req.body, 'total_amount', errors, { required: false });
  validateEnum(req.body, 'payment_type', PAYMENT_TYPES, errors);
  validateEnum(req.body, 'payment_status', PAYMENT_STATUSES, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateSale,
  validateUpdateSale,
};
