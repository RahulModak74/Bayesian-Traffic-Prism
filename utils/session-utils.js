const clickhouse = require('../config/clickhouse').clickhouse;

const SESSION_TIMEOUT = 900000; // 15 minutes in milliseconds

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const sessionId in global.sessions) {
    if (now - global.sessions[sessionId] > SESSION_TIMEOUT) {
      delete global.sessions[sessionId];
    }
  }
}

/**
 * Verify if session belongs to hostname
 */
async function verifySessionHostname(sessionId, hostname) {
  try {
    const query = `
      SELECT hostname 
      FROM tracking10 
      WHERE session_id = '${sessionId}'
      LIMIT 1
    `;
    const result = await clickhouse.query(query).toPromise();
    return result.length > 0 && result[0].hostname.includes(hostname);
  } catch (error) {
    console.error('Error verifying session hostname:', error);
    return false;
  }
}

/**
 * Get session details with paging
 */
async function getSessionDetails(hostname, page = 1, perPage = 10) {
  try {
    const offset = (page - 1) * perPage;
    const query = `
      SELECT 
        session_id,
        browser_id,
        MAX(timestamp) as last_activity,
        MIN(timestamp) as first_activity,
        COUNT(*) as hits,
        any(referrer) as came_from,
        any(url) as current_url,
        any(ip_address) as ip_address
      FROM tracking10
      WHERE hostname LIKE '%${hostname}%'
      GROUP BY session_id, browser_id
      ORDER BY last_activity DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

    return await clickhouse.query(query).toPromise();
  } catch (error) {
    console.error('Error getting session details:', error);
    return [];
  }
}

/**
 * Get journey for a specific session
 */
async function getSessionJourney(sessionId, hostname) {
  try {
    const query = `
      SELECT url, timestamp, clickdata
      FROM tracking10
      WHERE session_id LIKE '%${sessionId}%'
        AND hostname LIKE '%${hostname}%'
      ORDER BY timestamp
    `;

    const result = await clickhouse.query(query).toPromise();
    return result.map(row => ({
      ...row,
      date: new Date(row.timestamp).toISOString().split('T')[0],
      time: new Date(row.timestamp).toTimeString().split(' ')[0].substring(0, 8)
    }));
  } catch (error) {
    console.error('Error getting session journey:', error);
    return [];
  }
}

module.exports = {
  cleanupExpiredSessions,
  verifySessionHostname,
  getSessionDetails,
  getSessionJourney
};