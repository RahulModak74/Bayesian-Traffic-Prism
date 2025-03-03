const clickhouse = require('../config/clickhouse').clickhouse;

/**
 * Authentication middleware to check if user is logged in
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) {
    req.username = req.session.username;
    next();
  } else {
    res.redirect('/');
  }
}

/**
 * Verify user credentials against database
 */
async function verifyCredentials(req) {
  const { username, password } = req.body;

  const query = `
    SELECT username, passwordHash, hostname, version
    FROM users
    WHERE username = {username:String}
    LIMIT 1
  `;

  try {
    const result = await clickhouse.query(query, { params: { username } }).toPromise();

    if (result.length === 0) {
      return false;
    }

    const user = result[0];
    return password === user.passwordHash ? user : false;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return false;
  }
}

module.exports = {
  isAuthenticated,
  verifyCredentials
};