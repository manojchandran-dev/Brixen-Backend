const { verifyAccessToken } = require('../utils/jwt');
const { users: userRepository } = require('../modules/auth/repository');
const { error } = require('../core/responses/apiResponse');

const isBlank = (v) => v === undefined || v === null || ['', 'null', 'undefined'].includes(String(v).trim().toLowerCase());

// Guards every /api/v1 route except the public auth ones. Who the caller is
// comes from the access token, never from the request: `user_type`, and for a
// company user `company_id`, are overwritten on req.query from the token's
// user. Controllers keep reading req.query as before, but can no longer be
// pointed at another company or told the caller is a superadmin.
//
// Sets req.auth = { userId, isSuperadmin, companyId }.
async function session(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return error(res, 'Missing bearer access token', 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return error(res, 'Invalid or expired access token', 401);
  }

  // A deleted user (e.g. their company was deleted) is filtered out here.
  const user = await userRepository.findById(payload.sub);
  if (!user) return error(res, 'Invalid or expired access token', 401);
  req.user = payload;

  if (user.user_type === 'superadmin') {
    req.auth = { userId: user.id, isSuperadmin: true, companyId: null };
    req.query.user_type = 'superadmin';
    return next();
  }

  if (!user.company_id) return error(res, 'This account has no company access', 403);

  // A company user may only ever act on its own company.
  for (const claimed of [req.query.company_id, req.body?.company_id]) {
    if (!isBlank(claimed) && Number(claimed) !== user.company_id) {
      return error(res, 'You can only access your own company', 403);
    }
  }
  req.auth = { userId: user.id, isSuperadmin: false, companyId: user.company_id };
  req.query.user_type = 'company';
  req.query.company_id = String(user.company_id);
  return next();
}

module.exports = session;
