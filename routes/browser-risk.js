const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const name = req.username;
  const startDate = req.query.start_date || '2024-09-12';
  const endDate = req.query.end_date || '2024-09-15';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;

    // SQL query to fetch browser activity scores with hostname filtering and date range logic
    const query = `
      SELECT 
        \`Browser ID\`,
        \`Risk Score\`,
        \`Bot Activity Score\`,
        \`Request Pattern Score\`,
        \`Platform Mismatch Score\`,
        \`Auth Attempts Score\`,
        \`Error Pattern Score\`,
        \`API Usage Score\`,
        \`Admin Access Score\`,
        \`Session Pattern Score\`,
        \`Total Requests\`,
        \`Requests/Hour\`,
        \`Bot Requests\`,
        \`Bot Ratio\`,
        \`Auth Attempts\`,
        \`Error Rate\`,
        \`Unique IPs\`,
        \`API Requests\`,
        \`Recommended Action\`
      FROM default.hist_browser_activity_scores
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

    // Sort the results by Risk Score in descending order
    result.sort((a, b) => b['Risk Score'] - a['Risk Score']);

    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    // Get paginated data
    const paginatedData = result.slice(startIdx, endIdx);

    // Process the Platforms field if it's stored as a JSON string
    const parsedData = paginatedData.map((entry) => {
      let platforms = entry['Platforms'];

      if (typeof platforms === 'string') {
        try {
          const parsedPlatforms = JSON.parse(platforms);
          platforms = JSON.stringify(parsedPlatforms, null, 2);
        } catch (err) {
          console.error('Error parsing platforms:', err);
        }
      }

      return {
        ...entry,
        'Platforms': platforms
      };
    });

    res.render('browser_risk_scores', {
      results: parsedData,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });

  } catch (error) {
    console.error('Error fetching browser activity scores:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;