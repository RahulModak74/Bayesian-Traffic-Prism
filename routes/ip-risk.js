const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const startDate = req.query.start_date || '2024-09-01';
  const endDate = req.query.end_date || '2024-10-31';

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;

    // SQL query for IP activity scores with hostname filtering and updated date range logic
    const query = `
      SELECT 
        \`IP Address\`,
        Hostnames,
        \`Total Risk Score\`,
        \`Bot Detection Score\`,
        \`High Request Frequency Score\`,
        \`Multiple User Agents Score\`,
        \`Suspicious Login Patterns Score\`,
        \`Suspicious Session Patterns Score\`,
        \`Suspicious URL Patterns Score\`,
        \`High Error Rates Score\`,
        \`Requests Per Day\`,
        \`Total Requests\`,
        \`Active Days\`,
        \`First Seen\`,
        \`Last Seen\`,
        \`Is Bot\`,
        \`Bot User Agent Count\`,
        \`User Agents\`,
        \`Recommended Action\`
      FROM default.hist_ip_activity_scores 
      WHERE (
        (\`First Seen\` >= '${startDate}' AND \`First Seen\` <= '${endDate}')
        OR
        (\`Last Seen\` >= '${startDate}' AND \`Last Seen\` <= '${endDate}')
        OR
        (\`First Seen\` <= '${startDate}' AND \`Last Seen\` >= '${endDate}')
      )
      AND Hostnames LIKE '%${host}%'
      ORDER BY \`Last Seen\` DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Sort the results by total risk score in descending order
    result.sort((a, b) => b['Total Risk Score'] - a['Total Risk Score']);

    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    // Paginate the sorted data
    const paginatedData = result.slice(startIdx, endIdx);

    // Process the User Agents field if it's stored as a JSON string
    const parsedData = paginatedData.map((entry) => {
      let userAgents = entry['User Agents'];

      if (typeof userAgents === 'string') {
        try {
          const parsedUserAgents = JSON.parse(userAgents);
          userAgents = JSON.stringify(parsedUserAgents, null, 2);
        } catch (err) {
          console.error('Error parsing user agents:', err);
        }
      }

      return {
        ...entry,
        'User Agents': userAgents
      };
    });

    res.render('ip_risk_scores', {
      results: parsedData,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });

  } catch (error) {
    console.error('Error fetching IP activity scores:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;