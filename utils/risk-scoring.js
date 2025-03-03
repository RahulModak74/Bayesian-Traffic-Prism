const clickhouse = require('../config/clickhouse').clickhouse;

/**
 * Generate enhanced data ID from session ID
 */
function generateEnhancedDataId(sessionId) {
  let numericValue = 0;
  for (let i = 0; i < sessionId.length; i++) {
    numericValue += sessionId.charCodeAt(i);
  }
  const timestamp = Date.now();
  return parseInt(`${timestamp}${numericValue % 1000}`);
}

/**
 * Calculate risk score for session
 */
async function calculateSessionRisk(sessionId) {
  try {
    // Get session data from tracking10 table
    const query = `
      SELECT 
        COUNT(*) as request_count,
        uniqExact(browser_id) as browser_count,
        uniqExact(ip_address) as ip_count,
        COUNT(CASE WHEN url LIKE '%login%' THEN 1 END) as login_attempts,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM tracking10 
      WHERE session_id = '${sessionId}'
    `;

    const result = await clickhouse.query(query).toPromise();
    if (!result.length) return 0;

    const data = result[0];
    let riskScore = 0;

    // Multiple browsers
    if (data.browser_count > 1) riskScore += 3;

    // Multiple IPs
    if (data.ip_count > 1) riskScore += 3;

    // Login attempts
    if (data.login_attempts > 2) riskScore += 2;

    // High frequency
    const duration = (new Date(data.last_activity) - new Date(data.first_activity)) / 1000;
    if (data.request_count > 40 && duration < 180) riskScore += 2;

    return Math.min(riskScore, 10);
  } catch (error) {
    console.error('Error calculating session risk:', error);
    return 0;
  }
}

/**
 * Get recommended action based on risk score
 */
function getRecommendedAction(riskScore) {
  if (riskScore >= 8) {
    return {
      "No interference": 0,
      "Send Captcha": 10,
      "Terminate and Redirect": 90
    };
  } else if (riskScore >= 5) {
    return {
      "No interference": 10,
      "Send Captcha": 80,
      "Terminate and Redirect": 10
    };
  } else {
    return {
      "No interference": 90,
      "Send Captcha": 10,
      "Terminate and Redirect": 0
    };
  }
}

module.exports = {
  generateEnhancedDataId,
  calculateSessionRisk,
  getRecommendedAction
};