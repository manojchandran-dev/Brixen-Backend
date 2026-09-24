const { error } = require('../core/responses/apiResponse');

// Superadmin only. req.auth comes from the access token (session.middleware),
// not from anything the client sends.
module.exports = (req, res, next) =>
  req.auth?.isSuperadmin ? next() : error(res, 'Only superadmin can access this', 403);
