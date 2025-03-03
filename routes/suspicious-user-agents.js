const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

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

    // Query to get suspicious user agents
    const query = `
          SELECT user_agent, COUNT(*) AS request_count 
          FROM tracking10 
          WHERE user_agent LIKE '%${customUrl}%' 
            AND timestamp BETWEEN '${startDate}' AND '${endDate}' 
            AND hostname LIKE '%${host}%' 
            AND user_agent NOT LIKE '%Mozilla%' 
            AND user_agent NOT LIKE '%Chrome%' 
            AND user_agent NOT LIKE '%Safari%' 
          GROUP BY user_agent 
          ORDER BY request_count DESC`;

    const result = await clickhouse.query(query).toPromise();

    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    const paginatedData = result.slice(startIdx, endIdx);

    res.render('suspiciousUserAgents', {
      data: paginatedData,
      custom_url: customUrl,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;