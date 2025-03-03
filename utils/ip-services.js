const axios = require('axios');

const IP_QUALITY_SCORE_API_KEY = process.env.IP_QUALITY_SCORE_API_KEY;
const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const FRAUD_GUARD_USERNAME = process.env.FRAUD_GUARD_USERNAME;
const FRAUD_GUARD_PASSWORD = process.env.FRAUD_GUARD_PASSWORD;

/**
 * Check IP Quality Score
 */
async function checkIpQualityScore(ip) {
  try {
    const response = await axios.get(`https://ipqualityscore.com/api/json/ip/${IP_QUALITY_SCORE_API_KEY}/${ip}`);
    return response.data;
  } catch (error) {
    console.error(`Error checking IP ${ip} with IPQualityScore:`, error.message);
    return null;
  }
}

/**
 * Check AbuseIPDB
 */
async function checkAbuseIpDB(ip) {
  try {
    const response = await axios.get(`https://api.abuseipdb.com/api/v2/check`, {
      params: {
        ipAddress: ip,
        maxAgeInDays: 90
      },
      headers: {
        'Key': ABUSEIPDB_API_KEY,
        'Accept': 'application/json'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error(`Error checking IP ${ip} with AbuseIPDB:`, error.message);
    return null;
  }
}

/**
 * Check VirusTotal
 */
async function checkVirusTotal(ip) {
  try {
    const response = await axios.get(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const lastAnalysisStats = response.data.data.attributes.last_analysis_stats;
    const totalDetections = Object.values(lastAnalysisStats).reduce((a, b) => a + b, 0);
    const maliciousDetections = lastAnalysisStats.malicious || 0;
    const score = (totalDetections > 0) ? (maliciousDetections / totalDetections) * 100 : 0;
    return { ip, score, lastAnalysisStats };
  } catch (error) {
    console.error(`Error checking IP ${ip} with VirusTotal:`, error.message);
    return null;
  }
}

/**
 * Check FraudGuard
 */
async function checkFraudGuard(ip) {
  try {
    const authToken = Buffer.from(`${FRAUD_GUARD_USERNAME}:${FRAUD_GUARD_PASSWORD}`).toString('base64');
    const response = await axios.get(`https://api.fraudguard.io/v2/ip/${ip}`, {
      headers: {
        'Authorization': `Basic ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error checking IP ${ip} with FraudGuard:`, error.message);
    return null;
  }
}

module.exports = {
  checkIpQualityScore,
  checkAbuseIpDB,
  checkVirusTotal,
  checkFraudGuard
};