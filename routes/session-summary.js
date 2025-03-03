// routes/session-summary.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

router.get('/', async (req, res) => {
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  try {
    const hostQuery = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostResult = await clickhouse.query(hostQuery).toPromise();
    const host = hostResult[0]?.hostname;

    if (!host) {
      return res.status(400).send('Hostname not found for the user.');
    }

    const query = `
      SELECT
        session_id,
        browser_id,
        max(last_activity) AS last_seen,
        min(first_activity) AS session_start,
        count() AS hits,
        any(referrer) AS came_from,
        any(url) AS current_url,
        any(ip_address) AS ip_address,
        (max(last_activity) - min(first_activity)) AS session_duration
      FROM live_sessions_mv
      WHERE hostname LIKE '%${host}%'
      GROUP BY session_id, browser_id
      ORDER BY last_seen DESC;
    `;

    const result = await clickhouse.query(query).toPromise();

    // Filter unique sessions
    const uniqueSessions = new Set();
    const uniqueData = result.filter(row => {
      if (!uniqueSessions.has(row.session_id)) {
        uniqueSessions.add(row.session_id);
        return true;
      }
      return false;
    });

    // Calculate pagination
    const totalRows = uniqueData.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    const paginatedData = uniqueData.slice(startIdx, endIdx);

    // Format timestamps and durations
    const formattedData = paginatedData.map(row => ({
      ...row,
      last_seen: new Date(row.last_seen).toLocaleString(),
      session_start: new Date(row.session_start).toLocaleString(),
      session_duration: formatDuration(row.session_duration)
    }));

    res.render('session_summary', {
      data: formattedData,
      currentPage: page,
      totalPages: totalPages,
      perPage: perPage,
    });

  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

module.exports = router;