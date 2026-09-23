const { verifyAccessToken } = require('./jwt');

// Who made the request: the login token's email when present, else "superadmin".
module.exports = (req) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  try {
    return token ? verifyAccessToken(token).email : 'superadmin';
  } catch {
    return 'superadmin';
  }
};
