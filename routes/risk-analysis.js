// routes/risk-analysis.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;
    
    const riskAnalysisQuery = `
    WITH RiskFactors AS (
    SELECT
      t.session_id,
      (uniqExact(t.browser_id) > 1) * 3 AS browser_risk,
      (uniqExact(t.ip_address) > 1) * 3 AS ip_risk,
      (COUNT(CASE WHEN t.url LIKE '%login%' THEN 1 END) > 2) * 2 AS login_risk,
      ((COUNT(DISTINCT t.url) > 40 AND dateDiff('second', MIN(t.first_activity), MAX(t.last_activity)) < 180)) * 2 AS freq_risk,
      (COUNT(CASE WHEN t.user_agent LIKE '%bot%' THEN 1 END) > 0) * 2 AS bot_risk,
      (uniqExact(concat(rd.country, rd.region, rd.city)) > 1) * 3 AS geo_risk,
      -- New attack detection risks
      (COUNT(CASE WHEN t.url LIKE '%script%' OR t.url LIKE '%</script>%' OR t.url LIKE '%src%' THEN 1 END) > 0) * 8 AS xss_risk,
      (COUNT(CASE WHEN t.url LIKE '%redirect%' OR t.url LIKE '%target=%' THEN 1 END) > 0) * 8 AS redirect_risk,
      (COUNT(CASE WHEN t.url LIKE '%localhost%' OR t.url LIKE '%127.0.0.1%' THEN 1 END) > 0) * 8 AS ssrf_risk,
      (COUNT(CASE WHEN t.url LIKE '% OR %=% OR %' OR t.url LIKE '%1=1%' THEN 1 END) > 0) * 8 AS sqli_risk,
      COUNT(DISTINCT concat(t.url, toString(t.last_activity))) AS request_count,
      uniqExact(t.ip_address) AS distinct_ip_count,
      COUNT(CASE WHEN t.url LIKE '%login%' THEN 1 END) AS login_attempts,
      dateDiff('second', MIN(t.first_activity), MAX(t.last_activity)) AS session_duration
    FROM live_sessions_mv t
    LEFT JOIN region_details rd ON t.ip_address = rd.ip_address
    WHERE t.hostname LIKE '%${host}%'
    GROUP BY t.session_id
  ),
  RiskScores AS (
    SELECT
      *,
      least(browser_risk + ip_risk + login_risk + freq_risk + bot_risk + geo_risk +
            xss_risk + redirect_risk + ssrf_risk + sqli_risk, 10) AS total_risk_score
    FROM RiskFactors
  )
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
    session_duration
  FROM RiskScores
  ORDER BY total_risk_score DESC;`;
  
    const result = await clickhouse.query(riskAnalysisQuery).toPromise();
    
    // URL Changes Query
    const urlChangesQuery = `
    SELECT
      session_id,
      COUNT(*) AS url_change_count
    FROM (
      SELECT
        session_id,
        url,
        lagInFrame(url) OVER (PARTITION BY session_id ORDER BY last_activity) AS prev_url
      FROM live_sessions_mv
      WHERE hostname LIKE '%${host}%'
    ) 
    WHERE (url != prev_url) OR (prev_url IS NULL)
    GROUP BY session_id`;
    
    const urlChanges = await clickhouse.query(urlChangesQuery).toPromise();
    
    // Create a map of session_id to url_change_count
    const urlChangeMap = {};
    urlChanges.forEach(row => {
      urlChangeMap[row.session_id] = row.url_change_count;
    });
    
    // Merge the URL change data with the risk analysis data
    const mergedResults = result.map(row => {
      return {
        ...row,
        url_change_count: urlChangeMap[row.session_id] || 0,
        // Add a dummy action_recommendations if needed by your template
        action_recommendations: {}
      };
    });
    
    // Calculate pagination
    const totalRows = mergedResults.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    
    // Get paginated data
    const paginatedData = mergedResults.slice(startIdx, endIdx);
    
    res.render('risk_analysis', {
      data: paginatedData,
      hostname: host,
      messages: req.flash ? req.flash() : {},
      totalPages: totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error('Error in risk analysis:', error);
    if (req.flash) {
      req.flash('error', 'Failed to load risk analysis data');
      res.redirect('/dashboard');
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
});


// Update the session termination POST handler in risk-analysis.js
router.post('/', async (req, res) => {
  const { sessionId } = req.body;
  const username = req.username;
  try {
    // Basic validation
    if (!sessionId) {
      req.flash('error', 'Session ID is required');
      return res.redirect('/risk-analysis');
    }
    // Verify the session exists
    if (!global.sessions[sessionId]) {
      req.flash('error', 'Session not found or already terminated');
      return res.redirect('/risk-analysis');
    }
    try {
      // First, verify session belongs to user's hostname
      const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
      const userResult = await clickhouse.query(userQuery).toPromise();
      const userHostname = userResult[0].hostname;
      const sessionQuery = `
        SELECT hostname
        FROM live_sessions_mv
        WHERE session_id = '${sessionId}'
        LIMIT 1
      `;
      const sessionResult = await clickhouse.query(sessionQuery).toPromise();
      if (sessionResult.length === 0 || !sessionResult[0].hostname.includes(userHostname)) {
        req.flash('error', 'Unauthorized to terminate this session');
        return res.redirect('/risk-analysis');
      }

      // Delete from materialized views
      const deleteQueries = [
        `ALTER TABLE live_sessions_mv
         DELETE WHERE session_id = '${sessionId}'`,
        `ALTER TABLE live_security_headers_mv
         DELETE WHERE session_id = '${sessionId}'`
      ];

      // Execute deletion queries
      for (const query of deleteQueries) {
        await clickhouse.query(query).toPromise();
      }

      // Important: Get io from request app and emit termination event
      const io = req.app.get('io');
      io.to(sessionId).emit('session-terminated', {
        message: 'Your session has been terminated by an administrator.',
        redirectUrl: 'https://google.com'
      });
      
      // Remove from sessions object
      delete global.sessions[sessionId];
      
      // Log successful termination
      console.log(`Session ${sessionId} terminated by admin`);
      
      req.flash('success', 'Session terminated successfully');
      res.redirect('/risk-analysis');
    } catch (dbError) {
      console.error('Database error:', dbError);
      req.flash('error', 'Failed to process session termination');
      res.redirect('/risk-analysis');
    }
  } catch (error) {
    console.error('Error terminating session:', error);
    req.flash('error', 'Failed to terminate session');
    res.redirect('/risk-analysis');
  }
});

// Add this route alongside your existing risk-analysis routes
router.post('/send-captcha-session', async (req, res) => {
  const { sessionId } = req.body;
  const username = req.username;

  try {
    // Basic validation
    if (!sessionId) {
      req.flash('error', 'Session ID is required');
      return res.redirect('/risk-analysis');
    }

    // Verify the session exists
    if (!global.sessions[sessionId]) {
      req.flash('error', 'Session not found');
      return res.redirect('/risk-analysis');
    }

    try {
      // First, verify session belongs to user's hostname
      const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
      const userResult = await clickhouse.query(userQuery).toPromise();
      const userHostname = userResult[0].hostname;

      const sessionQuery = `
        SELECT hostname
        FROM live_sessions_mv
        WHERE session_id = '${sessionId}'
        LIMIT 1
      `;
      const sessionResult = await clickhouse.query(sessionQuery).toPromise();

      if (sessionResult.length === 0 || !sessionResult[0].hostname.includes(userHostname)) {
        req.flash('error', 'Unauthorized to send captcha to this session');
        return res.redirect('/risk-analysis');
      }

      // Send CAPTCHA challenge to the session
      const io = req.app.get('io');
      io.to(sessionId).emit('captcha-required', {
        message: 'Solve the CAPTCHA to continue.'
      });

      req.flash('success', 'CAPTCHA sent successfully');
      res.redirect('/risk-analysis');

    } catch (dbError) {
      console.error('Database error:', dbError);
      req.flash('error', 'Failed to process captcha request');
      res.redirect('/risk-analysis');
    }
  } catch (error) {
    console.error('Error sending CAPTCHA:', error);
    req.flash('error', 'Failed to send CAPTCHA');
    res.redirect('/risk-analysis');
  }
});

// Update your endpoint to handle both AJAX and direct requests
router.post('/internal-algo-check', async (req, res) => {
  const { sessionId } = req.body;
  const username = req.username;

  // Check if this is an AJAX request
  const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';

  try {
    // Verify session belongs to user's hostname
    const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
    const userResult = await clickhouse.query(userQuery).toPromise();
    const userHostname = userResult[0].hostname;

    const sessionQuery = `
      SELECT hostname
      FROM live_sessions_mv
      WHERE session_id = '${sessionId}'
      LIMIT 1
    `;
    const sessionResult = await clickhouse.query(sessionQuery).toPromise();

    if (sessionResult.length === 0 || !sessionResult[0].hostname.includes(userHostname)) {
      if (isAjax) {
        return res.status(403).json({ error: 'Unauthorized to check this session' });
      } else {
        req.flash('error', 'Unauthorized to check this session');
        return res.redirect('/risk-analysis');
      }
    }

    // Get URLs for this session
    const urlQuery = `
      SELECT url
      FROM tracking10
      WHERE session_id LIKE '%${sessionId}%'
      ORDER BY timestamp;
    `;
    const urlResult = await clickhouse.query(urlQuery).toPromise();

    // Create temporary file with URLs
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `session_${sessionId}.txt`);
    const urlContent = urlResult.map(row => row.url).join('\n');

    await fs.writeFile(tempFile, urlContent);

    // Execute curl command
    const result = await new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const curlCommand = `curl -X POST https://8e34-103-182-131-199.ngrok-free.app/score -F "file=@${tempFile}"`;

      exec(curlCommand, { shell: 'bash' }, async (error, stdout, stderr) => {
        try {
          await fs.unlink(tempFile);  // Clean up temp file
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }

        if (error) {
          console.error('Curl error:', error);
          reject(error);
          return;
        }

        try {
          console.log('Raw curl response:', stdout); // Log raw response
          const result = JSON.parse(stdout);
          console.log('Parsed result:', result); // Log parsed result
          resolve(result);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });

    // Handle response based on request type
    if (isAjax) {
      return res.json(result);
    } else {
      req.flash('success', `Algorithm check completed: ${JSON.stringify(result)}`);
      return res.redirect('/risk-analysis');
    }

  } catch (error) {
    console.error('Error in internal algo check:', error);
    if (isAjax) {
      return res.status(500).json({
        error: 'Failed to process internal algorithm check',
        details: error.message
      });
    } else {
      req.flash('error', 'Failed to process internal algorithm check');
      return res.redirect('/risk-analysis');
    }
  }
});

module.exports = router;