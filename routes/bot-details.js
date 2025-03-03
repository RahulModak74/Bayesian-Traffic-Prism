const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;
const { getIpDetails } = require('../utils/ip-details');

router.get('/', async (req, res) => {
  const customUrl = req.query.custom_url || 'bot';
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const startDate = req.query.start_date || '2024-10-01';
  const endDate = req.query.end_date || '2024-10-31';

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;

    // SQL query for detailed bot analysis
    const query = `
      SELECT 
        t.session_id,
        t.ip_address,
        t.timestamp,
        t.url,
        t.session_id,
        t.browser_id,
        t.fingerprint_id,
        t.user_agent
      FROM tracking10 t
      WHERE t.user_agent LIKE '%bot%'
        AND t.user_agent LIKE '%${customUrl}%'
        AND t.timestamp BETWEEN '${startDate}' AND '${endDate}'
        AND t.hostname LIKE '%${host}%'
      ORDER BY t.timestamp DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Filter unique sessions
    const uniqueSessions = new Set();
    const uniqueData = result.filter(row => {
      if (!uniqueSessions.has(row.session_id[0])) {
        uniqueSessions.add(row.session_id[0]);
        return true;
      }
      return false;
    });

    // Calculate pagination
    const totalRows = uniqueData.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    // Get paginated data
    const paginatedData = uniqueData.slice(startIdx, endIdx);

    // Add IP details and format timestamps
    const paginatedDataWithDetails = await Promise.all(paginatedData.map(async row => {
      const ipDetails = await getIpDetails(row.ip_address);
      if (ipDetails) {
        row.country = ipDetails.country;
        row.region = ipDetails.region;
        row.city = ipDetails.city;
      } else {
        row.country = 'Unknown';
        row.region = 'Unknown';
        row.city = 'Unknown';
      }

      // Process timestamp
      const timestamp = new Date(row.timestamp);
      row.date = timestamp.toISOString().split('T')[0];
      row.time = timestamp.toTimeString().split(' ')[0].substring(0, 8);

      return row;
    }));

    const filteredData = paginatedDataWithDetails.filter(row => row !== null);

    // Get active sessions for real-time monitoring
    const activeSessions = Object.keys(global.sessions).filter(sessionId => {
      const session = result.find(row => row.session_id === sessionId);
      return session && session.user_agent.toLowerCase().includes('bot');
    });

    res.render('botdetailsreport', {
      data: filteredData,
      custom_url: customUrl,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate,
      activeSessions: activeSessions
    });

  } catch (error) {
    console.error('Error in bot details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Detailed analysis of specific bot
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const name = req.username;

  try {
    // Fetch the hostname for the user
    const hostQuery = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostResult = await clickhouse.query(hostQuery).toPromise();
    const host = hostResult[0].hostname;

    // Get detailed bot activity
    const query = `
      SELECT 
        t.*,
        sh.dom_changes_count,
        sh.dom_security_violations,
        sh.dom_added_elements,
        sh.dom_removed_elements,
        sh.dom_modified_attributes
      FROM tracking10 t
      LEFT JOIN security_headers sh ON t.enhanced_data_id = sh.tracking_id
      WHERE t.session_id = '${sessionId}'
        AND t.hostname LIKE '%${host}%'
      ORDER BY t.timestamp ASC
    `;

    const result = await clickhouse.query(query).toPromise();

    if (result.length === 0) {
      return res.status(404).send('Bot session not found');
    }

    // Analyze bot behavior
    const behaviorAnalysis = {
      requestCount: result.length,
      uniqueUrls: new Set(result.map(row => row.url)).size,
      domChanges: result.reduce((sum, row) => sum + (row.dom_changes_count || 0), 0),
      securityViolations: result.filter(row => row.dom_security_violations !== '[]').length,
      avgRequestInterval: calculateAverageInterval(result.map(row => new Date(row.timestamp))),
      patterns: analyzeBehaviorPatterns(result)
    };

    res.render('bot_session_details', {
      data: result,
      sessionId: sessionId,
      analysis: behaviorAnalysis
    });

  } catch (error) {
    console.error('Error fetching bot details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Helper function to calculate average interval between requests
function calculateAverageInterval(timestamps) {
  if (timestamps.length < 2) return 0;
  
  let totalInterval = 0;
  for (let i = 1; i < timestamps.length; i++) {
    totalInterval += timestamps[i] - timestamps[i-1];
  }
  
  return totalInterval / (timestamps.length - 1);
}

// Helper function to analyze behavior patterns
function analyzeBehaviorPatterns(data) {
  const patterns = {
    repeatedUrls: {},
    rapidRequests: 0,
    suspiciousPatterns: []
  };

  // Count repeated URLs
  data.forEach(row => {
    patterns.repeatedUrls[row.url] = (patterns.repeatedUrls[row.url] || 0) + 1;
  });

  // Check for rapid requests (more than 3 requests per second)
  for (let i = 1; i < data.length; i++) {
    const interval = new Date(data[i].timestamp) - new Date(data[i-1].timestamp);
    if (interval < 1000) {
      patterns.rapidRequests++;
    }
  }

  // Check for suspicious patterns
  if (patterns.rapidRequests > 5) {
    patterns.suspiciousPatterns.push('High frequency requests detected');
  }

  Object.entries(patterns.repeatedUrls).forEach(([url, count]) => {
    if (count > 10) {
      patterns.suspiciousPatterns.push(`Excessive requests to ${url}`);
    }
  });

  return patterns;
}

module.exports = router;