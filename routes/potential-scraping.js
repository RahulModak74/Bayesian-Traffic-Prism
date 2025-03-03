const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;
const { getIpDetails } = require('../utils/ip-details');

router.get('/', async (req, res) => {
  const customUrl = req.query.custom_url || 'bluebot';
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

    // Query to detect potential scraping activity
    const query = `
      SELECT url, ip_address, COUNT(*) AS request_count
      FROM tracking10
      WHERE url LIKE '%${customUrl}%' 
        AND timestamp BETWEEN '${startDate}' AND '${endDate}' 
        AND hostname LIKE '%${host}%'
      GROUP BY url, ip_address
      HAVING COUNT(*) > 50
      ORDER BY request_count DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    const paginatedData = result.slice(startIdx, endIdx);

    const paginatedDataWithDetails = await Promise.all(paginatedData.map(async row => {
      const ipDetails = await getIpDetails(row.ip_address);
      if (ipDetails) {
        row.country = ipDetails.country;
        row.region = ipDetails.region;
        row.city = ipDetails.city;
      } else {
        row.country = 'Unknown';
        row.region = 'Unknown';
        row.city = 'Unknown';
      }

      return row;
    }));

    const filteredData = paginatedDataWithDetails.filter(row => row !== null);

    res.render('potentialscraping', {
      data: filteredData,
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