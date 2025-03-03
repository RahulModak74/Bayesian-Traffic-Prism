const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const name = req.username;
  const customUrl = req.query.custom_url || 'bot';
  const startDate = req.query.start_date || '2024-10-01';
  const endDate = req.query.end_date || '2024-10-31';

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const host = hostarray[0].hostname;

    // Query to get bot requests filtered by host, custom URL, start and end date
    const query = `
      SELECT user_agent, url, count(*) as request_count
      FROM tracking10
      WHERE user_agent LIKE '%bot%'
      AND hostname LIKE '%${host}%'
      AND user_agent LIKE '%${customUrl}%'
      AND timestamp BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY user_agent, url
      ORDER BY request_count DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `;

    const result = await clickhouse.query(query).toPromise();

    // Query to get the total number of records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT user_agent, url
        FROM tracking10
        WHERE user_agent LIKE '%bot%'
        AND hostname LIKE '%${host}%'
        AND url LIKE '%${customUrl}%'
        AND timestamp BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY user_agent, url
      ) AS temp
    `;

    const totalCountResult = await clickhouse.query(countQuery).toPromise();
    const totalRows = totalCountResult[0].total;
    const totalPages = Math.ceil(totalRows / perPage);

    res.render('botRequests', {
      data: result,
      totalPages: totalPages,
      currentPage: page,
      custom_url: customUrl,
      start_date: startDate,
      end_date: endDate,
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;