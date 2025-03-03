// routes/updated-session-risk-analysis.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const startDate = req.query.start_date || '2024-08-24';
  const endDate = req.query.end_date || '2025-12-15';
 
  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;
   
    // SQL query for enhanced session risk scores with hostname and date filtering
    const query = `
      SELECT
        session_id,
        total_risk_score,
        browser_risk,
        login_risk,
        ip_risk,
        freq_risk,
        bot_risk,
        geo_risk,
        xss_risk,
        redirect_risk,
        ssrf_risk,
        sqli_risk,
        request_count,
        distinct_ip_count,
        login_attempts,
        session_duration,
        url_change_count,
        action_recommendations,
        host,
        timestamp
      FROM default.updated_hist_session_risk_scores
      WHERE timestamp BETWEEN '${startDate}' AND '${endDate}'
      AND host LIKE '%${host}%'
      ORDER BY timestamp DESC
    `;
   
    const result = await clickhouse.query(query).toPromise();
   
    // Sort the results by total_risk_score in descending order
    result.sort((a, b) => b.total_risk_score - a.total_risk_score);
   
    // Calculate pagination
    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
   
    // Paginate the sorted data
    const paginatedData = result.slice(startIdx, endIdx);
   
    // Parse action_recommendations JSON for each entry
    const parsedData = paginatedData.map((entry) => {
      let actionRecommendations = entry.action_recommendations;
     
      // Check if action_recommendations is a stringified JSON and parse it
      if (typeof actionRecommendations === 'string') {
        try {
          actionRecommendations = JSON.parse(actionRecommendations);
        } catch (err) {
          console.error('Error parsing action recommendations:', err);
          actionRecommendations = {};
        }
      }
     
      return {
        ...entry,
        action_recommendations: actionRecommendations
      };
    });
   
    console.log(`Found ${totalRows} sessions for hostname: ${host}`);
   
    res.render('updated_session_risk_analysis', {
      data: parsedData,
      hostname: host,
      messages: req.flash ? req.flash() : {},
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });
  } catch (error) {
    console.error('Error in enhanced risk analysis:', error);
    if (req.flash) {
      req.flash('error', 'Failed to load risk analysis data');
      res.redirect('/dashboard');
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
});

module.exports = router;