const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;
const { checkIpQualityScore, checkAbuseIpDB, checkVirusTotal, checkFraudGuard } = require('../utils/ip-services');

router.get('/', async (req, res) => {
  const name = req.username;
  const ipAddress = req.query.ip; // Get IP from the query parameter (if any)

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;

    // SQL query to get suspicious activity (including timestamp)
    const query = `
      SELECT
        ip_address,
        session_id,
        COUNT(*) AS total_actions,
        SUM(multiIf(url LIKE '%form-submit-url%', 1, 0)) AS form_submissions,
        SUM(multiIf(url LIKE '%login%', 1, 0)) AS login_attempts,
        MIN(timestamp) AS first_timestamp
      FROM tracking10
      WHERE timestamp >= (now() - toIntervalMinute(60))
        AND hostname LIKE '%${host}%'
      GROUP BY
        ip_address,
        session_id
      HAVING (form_submissions > 10) OR (login_attempts > 5)
      ORDER BY total_actions DESC
    `;

    // Execute the query for suspicious activity
    const result = await clickhouse.query(query).toPromise();

    // Process the data for the view
    const processedData = result.map(row => {
      const timestamp = row.first_timestamp ? new Date(row.first_timestamp) : null;
      return {
        ...row,
        date: timestamp ? timestamp.toISOString().split('T')[0] : 'Unknown',
        time: timestamp ? timestamp.toTimeString().split(' ')[0].substring(0, 8) : 'Unknown',
      };
    });

    // Check for IP data if submitted
    let ipReport = {};
    if (ipAddress) {
      ipReport = {
        ipQualityScoreData: await checkIpQualityScore(ipAddress),
        abuseIpDBData: await checkAbuseIpDB(ipAddress),
        virusTotalData: await checkVirusTotal(ipAddress),
        fraudGuardData: await checkFraudGuard(ipAddress),
      };
    }

    res.render('suspicious_activity', {
      data: processedData,
      ip: ipAddress,
      ...ipReport,
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;