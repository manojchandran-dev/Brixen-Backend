const { error } = require('../utils/apiResponse');

module.exports = (req, res, next) =>
  req.query.user_type === 'superadmin' ? next() : error(res, 'Only superadmin can access this', 403);
