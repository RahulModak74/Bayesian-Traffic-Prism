// routes/suspicious-referrers.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const customUrl = req.query.custom_url || 'bot';
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const startDate = req.query.start_date || '2024-10-01';
  const endDate = req.query.end_date || '2024-10-01';

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();

    // Error handling for empty hostname results
    if (!hostarray.length || !hostarray[0].hostname) {
      return res.status(404).send('Hostname not found for the user.');
    }

    const host = hostarray[0].hostname;

    // SQL query to fetch bot-related data filtered by hostname, customUrl, and date range
    const query = `
      SELECT user_agent, referrer, count(*) as request_count
      FROM tracking10
      WHERE user_agent LIKE '%bot%'
        AND user_agent LIKE '%${customUrl}%'
        AND referrer != ''
        AND hostname LIKE '%${host}%'
        AND timestamp BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY user_agent, referrer
      ORDER BY request_count DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Pagination logic
    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    const paginatedData = result.slice(startIdx, endIdx);

    // Render the EJS template with paginated result
    res.render('SuspiciousReferrersforBots', {
      data: paginatedData,
      custom_url: customUrl,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });
  } catch (error) {
    console.error('Error fetching bot data:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;