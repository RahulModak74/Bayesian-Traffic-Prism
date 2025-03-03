// routes/session-journey.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const sessionid = req.query.session_id || '5bnrzox1eatq1k3yew';
  const name = req.username;
  
  try {
    // Get the hostname associated with the user
    const hostQuery = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostResult = await clickhouse.query(hostQuery).toPromise();
    const host = hostResult[0].hostname;
    
    // Use the hostname to filter the data in the tracking10 table
    const query = `SELECT url, timestamp, clickdata
                   FROM tracking10
                   WHERE session_id LIKE '%${sessionid}%' AND hostname LIKE '%${host}%'
                   ORDER BY timestamp;`;
                   
    const result = await clickhouse.query(query).toPromise();
    
    // Process each row to break down the timestamp
    const enhancedData = result.map(row => {
      // Create a Date object from the timestamp
      const timestamp = new Date(row.timestamp);
      // Extract and format date
      row.date = timestamp.toISOString().split('T')[0];
      // Extract and format time, rounding to the nearest second
      row.time = timestamp.toTimeString().split(' ')[0].substring(0, 8);
      return row;
    });
    
    res.render('report4', { 
      data: enhancedData, 
      session_id: sessionid 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;