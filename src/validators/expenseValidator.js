const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

const OPTIONAL_STRING_FIELDS = ['receipt_url', 'notes'];

function validateOptionalStrings(body, errors) {
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }
}

function validatePaymentMethod(body, errors) {
  if (body.payment_method === undefined || body.payment_method === null) {
    return;
  }

  const match = PAYMENT_METHODS.find((value) => value.toLowerCase() === String(body.payment_method).toLowerCase());
  if (!match) {
    errors.push(`payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
    return;
  }

  body.payment_method = match;
}

function validateExpenseDate(body, errors) {
  if (body.expense_date === undefined || body.expense_date === null || body.expense_date === '') {
    return;
  }

  const date = new Date(body.expense_date);
  if (Number.isNaN(date.getTime())) {
    errors.push('expense_date must be a valid date');
    return;
  }

  body.expense_date = date;
}

function validateAmount(body, errors, { required } = {}) {
  if (body.amount === undefined || body.amount === null || body.amount === '') {
    if (required) {
      errors.push('amount is required and must be a positive number');
    }
    return;
  }

  const amount = Number(body.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }
}

function validateCreateExpense(req, res, next) {
  const { category_id, title } = req.body;
  const errors = [];

  if (!category_id || typeof category_id !== 'string' || !category_id.trim()) {
    errors.push('category_id is required and must be a non-empty string');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('title is required and must be a non-empty string');
  }

  validateAmount(req.body, errors, { required: true });
  validateExpenseDate(req.body, errors);
  validatePaymentMethod(req.body, errors);
  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateExpense(req, res, next) {
  const { category_id, title } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (category_id !== undefined && (typeof category_id !== 'string' || !category_id.trim())) {
    errors.push('category_id must be a non-empty string');
  }

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    errors.push('title must be a non-empty string');
  }

  validateAmount(req.body, errors, { required: false });
  validateExpenseDate(req.body, errors);
  validatePaymentMethod(req.body, errors);
  validateOptionalStrings(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateExpense,
  validateUpdateExpense,
};
