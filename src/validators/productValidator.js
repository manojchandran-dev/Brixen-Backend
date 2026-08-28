const GENDERS = ['Men', 'Women', 'Unisex', 'Kids'];
const STATUSES = ['Active', 'Inactive'];

function validateEnum(body, field, allowed, errors, { required } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) {
      errors.push(`${field} is required and must be one of: ${allowed.join(', ')}`);
    }
    return;
  }

  const match = allowed.find((value) => value.toLowerCase() === String(body[field]).toLowerCase());
  if (!match) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}`);
    return;
  }

  body[field] = match;
}

function validateOptionalString(body, field, errors) {
  if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
    errors.push(`${field} must be a string`);
  }
}

function validateId(body, field, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }
  if (typeof body[field] !== 'string' || !body[field].trim()) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validatePrice(body, field, errors, { required } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) {
      errors.push(`${field} is required and must be a non-negative number`);
    }
    return;
  }

  const value = Number(body[field]);
  if (Number.isNaN(value) || value < 0) {
    errors.push(`${field} must be a non-negative number`);
  }
}

function validateGalleryUrls(body, errors) {
  if (body.gallery_urls === undefined || body.gallery_urls === null) {
    return;
  }

  if (!Array.isArray(body.gallery_urls) || !body.gallery_urls.every((url) => typeof url === 'string')) {
    errors.push('gallery_urls must be an array of strings');
  }
}

// Step 1 — Basic Info
function validateCreateProduct(req, res, next) {
  const { product_name } = req.body;
  const errors = [];

  if (!product_name || typeof product_name !== 'string' || !product_name.trim()) {
    errors.push('product_name is required and must be a non-empty string');
  }

  validateId(req.body, 'category_id', errors);
  validateEnum(req.body, 'gender', GENDERS, errors, { required: true });
  validateOptionalString(req.body, 'design_pattern', errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

function validateUpdateProduct(req, res, next) {
  const { product_name } = req.body;
  const errors = [];

  if (Object.keys(req.body).length === 0) {
    errors.push('At least one field is required to update');
  }

  if (product_name !== undefined && (typeof product_name !== 'string' || !product_name.trim())) {
    errors.push('product_name must be a non-empty string');
  }

  validateId(req.body, 'category_id', errors);
  validateId(req.body, 'unit_id', errors);
  validateEnum(req.body, 'gender', GENDERS, errors);
  validateEnum(req.body, 'status', STATUSES, errors);
  validateOptionalString(req.body, 'design_pattern', errors);
  validateOptionalString(req.body, 'color', errors);
  validateOptionalString(req.body, 'size', errors);
  validatePrice(req.body, 'cost_price', errors);
  validatePrice(req.body, 'retail_price', errors);
  validatePrice(req.body, 'wholesale_price', errors);
  validateGalleryUrls(req.body, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Step 2 — Attributes
function validateProductStep2(req, res, next) {
  const errors = [];

  validateId(req.body, 'unit_id', errors);
  validateOptionalString(req.body, 'color', errors);
  validateOptionalString(req.body, 'size', errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Step 3 — Pricing
function validateProductStep3(req, res, next) {
  const errors = [];

  validatePrice(req.body, 'cost_price', errors, { required: true });
  validatePrice(req.body, 'retail_price', errors, { required: true });
  validatePrice(req.body, 'wholesale_price', errors, { required: true });

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

// Step 4 — Gallery & Status
function validateProductStep4(req, res, next) {
  const errors = [];

  validateGalleryUrls(req.body, errors);
  validateEnum(req.body, 'status', STATUSES, errors);

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductStep2,
  validateProductStep3,
  validateProductStep4,
};
