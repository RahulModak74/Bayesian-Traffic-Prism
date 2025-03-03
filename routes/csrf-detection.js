const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  try {
    const name = req.username;

    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();

    // Error handling for empty hostname results
    if (!hostarray.length || !hostarray[0].hostname) {
      return res.status(404).send('Hostname not found for the user.');
    }

    const host = hostarray[0].hostname;

    // SQL query to fetch referrer-related data for CSRF detection, filtered by hostname
    const query = `
      SELECT 
        referrer, 
        COUNT(*) AS request_count
      FROM 
        tracking10
      WHERE 
        referrer NOT LIKE '%${host}%' 
        AND referrer IS NOT NULL
      GROUP BY 
        referrer
      ORDER BY 
        request_count DESC limit 100
    `;

    const result = await clickhouse.query(query).toPromise();

    // Pagination logic
    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    const paginatedData = result.slice(startIdx, endIdx);

    res.render('CSRFDetection', {
      data: paginatedData,
      totalPages: totalPages,
      currentPage: page
    });

  } catch (error) {
    console.error('Error fetching CSRF data:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;