const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const clickhouse = require('../config/clickhouse').clickhouse;
const { generateEnhancedDataId } = require('../utils/risk-scoring');
const { getGeoLocation } = require('../utils/ip-details');

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const ipAddress = data.ipAddress || '';
    const userAgent = data.deviceInfo ? data.deviceInfo.userAgent.replace(/'/g, "\\'") : '';
    const platform = data.deviceInfo ? data.deviceInfo.platform : '';
    const language = data.deviceInfo ? data.deviceInfo.language : '';
    const hostname = data.hostname || '';
    const sessionId = data.sessionId || '';
    const browser_id = data.browser_id || '';
    const fingerprint_id = data.fingerprint_id || '';
    const timestamp = new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ');
    const clickData = data.clickData || '';
    const clickDataString = JSON.stringify(clickData).replace(/'/g, "''");

    // Generate enhanced data ID
    const enhanced_data_id = generateEnhancedDataId(sessionId);

    // Get geolocation data
    const { country, region, city } = getGeoLocation(ipAddress);

    // Get next IDs
    const result = await clickhouse.query('SELECT max(id) FROM tracking10').toPromise();
    const resultOne = await clickhouse.query('SELECT max(id) FROM region_details').toPromise();

    const maxId = result[0]['max(id)'] || 0;
    const maxIdOne = resultOne[0]['max(id)'] || 0;

    const nextId = maxId + 1;
    const nextIdOne = maxIdOne + 1;

    // Build tracking query
    const trackingQuery = `
      INSERT INTO tracking10 (
        id, timestamp, url, referrer, ip_address, user_agent, 
        platform, language, hostname, session_id, browser_id, 
        fingerprint_id, clickdata, enhanced_data_id
      ) VALUES (
        ${nextId}, 
        '${timestamp}', 
        '${(data.url || '').replace(/'/g, "''")}', 
        '${(data.referrer || '').replace(/'/g, "''")}', 
        '${ipAddress}', 
        '${userAgent}', 
        '${platform}', 
        '${language}', 
        '${hostname}', 
        '${sessionId}',
        '${browser_id}', 
        '${fingerprint_id}', 
        '${clickDataString}', 
        ${enhanced_data_id}
      )`;

    // Build region query
    const regionQuery = `
      INSERT INTO region_details (id, ip_address, country, region, city)
      VALUES (${nextIdOne}, '${ipAddress}', '${country}', '${region}', '${city}')`;

    // Execute queries
    await clickhouse.query(trackingQuery).toPromise();
    await clickhouse.query(regionQuery).toPromise();

    // Update sessions
    global.sessions[sessionId] = Date.now();
    
    res.json({ status: 'success' });
  } catch (error) {
    console.error("Error inserting into database:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;