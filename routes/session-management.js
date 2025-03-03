// routes/session-management.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

// Add this GET handler to session-management.js
router.get('/terminate-session', async (req, res) => {
  const username = req.username;
  
  try {
    // Fetch the hostname for the user
    const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
    const userResult = await clickhouse.query(userQuery).toPromise();
    const hostname = userResult[0].hostname;
    
    // Get active sessions filtered by hostname
    const sessionIds = Object.keys(global.sessions);
    let validSessions = [];
    
    if (sessionIds.length > 0) {
      const hostnamesQuery = `
        SELECT session_id, hostname 
        FROM tracking10 
        WHERE session_id IN (${sessionIds.map(id => `'${id}'`).join(', ')})
      `;
      const hostnamesResult = await clickhouse.query(hostnamesQuery).toPromise();
      
      validSessions = sessionIds.filter(sessionId => {
        const sessionData = hostnamesResult.find(row => row.session_id === sessionId);
        return sessionData && sessionData.hostname.includes(hostname);
      });
    }
    
    res.render('terminateSession', { sessions: validSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to load session data' });
  }
});

router.post('/terminate-session', async (req, res) => {
  const { sessionId } = req.body;
  const username = req.username;

  try {
    // Verify session belongs to user's hostname
    const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
    const userResult = await clickhouse.query(userQuery).toPromise();
    const hostname = userResult[0].hostname;

    const sessionQuery = `
      SELECT hostname
      FROM live_sessions_mv_new
      WHERE session_id = '${sessionId}'
      LIMIT 1
    `;
    const sessionResult = await clickhouse.query(sessionQuery).toPromise();

    if (sessionResult.length === 0 || !sessionResult[0].hostname.includes(hostname)) {
      return res.status(403).json({ error: 'Unauthorized to terminate this session' });
    }

    // Delete from both materialized views
    const deleteQueries = [
      `ALTER TABLE live_sessions_mv_new
       DELETE WHERE session_id = '${sessionId}'`,
      `ALTER TABLE live_security_headers_mv
       DELETE WHERE session_id = '${sessionId}'`
    ];

    // Execute both deletion queries
    for (const query of deleteQueries) {
      await clickhouse.query(query).toPromise();
    }

    // Emit termination event via Socket.IO
    const io = req.app.get('io');
    io.to(sessionId).emit('session-terminated', {
      message: 'Your session has been terminated by an administrator.',
      redirectUrl: 'https://google.com'
    });

    // Remove from sessions object
    delete global.sessions[sessionId];

    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Add this GET handler for the send-captcha route
router.get('/send-captcha', async (req, res) => {
  const username = req.username;
  
  try {
    // Fetch the hostname for the user
    const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
    const userResult = await clickhouse.query(userQuery).toPromise();
    const hostname = userResult[0].hostname;
    
    // Get active sessions filtered by hostname
    const sessionIds = Object.keys(global.sessions);
    let validSessions = [];
    
    if (sessionIds.length > 0) {
      const hostnamesQuery = `
        SELECT session_id, hostname 
        FROM tracking10 
        WHERE session_id IN (${sessionIds.map(id => `'${id}'`).join(', ')})
      `;
      const hostnamesResult = await clickhouse.query(hostnamesQuery).toPromise();
      
      validSessions = sessionIds.filter(sessionId => {
        const sessionData = hostnamesResult.find(row => row.session_id === sessionId);
        return sessionData && sessionData.hostname.includes(hostname);
      });
    }
    
    res.render('sendCaptcha', { sessions: validSessions });
  } catch (error) {
    console.error('Error fetching sessions for captcha:', error);
    res.status(500).json({ error: 'Failed to load session data' });
  }
});

router.post('/send-captcha', async (req, res) => {
  const { sessionId } = req.body;
  const username = req.username;

  try {
    const userQuery = `SELECT hostname FROM users WHERE username = '${username}'`;
    const userResult = await clickhouse.query(userQuery).toPromise();
    const hostname = userResult[0].hostname;

    const sessionQuery = `
      SELECT hostname 
      FROM live_sessions_mv_new
      WHERE session_id = '${sessionId}'
      LIMIT 1
    `;
    const sessionResult = await clickhouse.query(sessionQuery).toPromise();

    if (sessionResult.length === 0 || !sessionResult[0].hostname.includes(hostname)) {
      return res.status(403).json({ error: 'Unauthorized to send CAPTCHA to this session' });
    }

    const io = req.app.get('io');
    io.to(sessionId).emit('captcha-required', {
      message: 'Please solve the CAPTCHA to continue.'
    });

    res.json({ success: true, message: 'CAPTCHA sent successfully' });
  } catch (error) {
    console.error('Error sending CAPTCHA:', error);
    res.status(500).json({ error: 'Failed to send CAPTCHA' });
  }
});

module.exports = router;