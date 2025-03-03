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
    const hostQuery = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostResult = await clickhouse.query(hostQuery).toPromise();
    const host = hostResult[0].hostname;

    // SQL query to get bot request overview
    const query = `
      WITH BotMetrics AS (
        SELECT 
          user_agent,
          url,
          count(*) AS request_count,
          uniqExact(ip_address) as unique_ips,
          uniqExact(session_id) as unique_sessions,
          MIN(timestamp) as first_seen,
          MAX(timestamp) as last_seen
        FROM tracking10
        WHERE user_agent LIKE '%bot%'
          AND user_agent LIKE '%${customUrl}%'
          AND timestamp BETWEEN '${startDate}' AND '${endDate}'
          AND hostname LIKE '%${host}%'
        GROUP BY user_agent, url
      )
      SELECT 
        user_agent,
        url,
        request_count,
        unique_ips,
        unique_sessions,
        first_seen,
        last_seen,
        multiIf(
          request_count > 1000 AND unique_ips < 3, 'High',
          request_count > 500 AND unique_ips < 5, 'Medium',
          'Low'
        ) as risk_level
      FROM BotMetrics
      ORDER BY request_count DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Calculate pagination
    const totalRows = result.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;

    // Get paginated data
    const paginatedData = result.slice(startIdx, endIdx).map(row => ({
      ...row,
      first_seen: new Date(row.first_seen).toLocaleString(),
      last_seen: new Date(row.last_seen).toLocaleString()
    }));

    // Get aggregated statistics
    const statsQuery = `
      SELECT
        count(*) as total_requests,
        uniqExact(session_id) as total_sessions,
        uniqExact(ip_address) as total_ips,
        uniqExact(user_agent) as unique_bots,
        round(avg(length(url))) as avg_url_length,
        countIf(user_agent LIKE '%Googlebot%') as google_bots,
        countIf(user_agent LIKE '%bingbot%') as bing_bots,
        countIf(user_agent NOT LIKE '%Googlebot%' AND user_agent NOT LIKE '%bingbot%') as other_bots
      FROM tracking10
      WHERE user_agent LIKE '%bot%'
        AND timestamp BETWEEN '${startDate}' AND '${endDate}'
        AND hostname LIKE '%${host}%'
    `;

    const statsResult = await clickhouse.query(statsQuery).toPromise();
    const stats = statsResult[0];

    // Get hourly distribution
    const hourlyQuery = `
      SELECT
        toHour(timestamp) as hour,
        count(*) as requests
      FROM tracking10
      WHERE user_agent LIKE '%bot%'
        AND timestamp BETWEEN '${startDate}' AND '${endDate}'
        AND hostname LIKE '%${host}%'
      GROUP BY hour
      ORDER BY hour
    `;

    const hourlyData = await clickhouse.query(hourlyQuery).toPromise();

    res.render('botoverviewreport', {
      data: paginatedData,
      stats: stats,
      hourlyData: hourlyData,
      custom_url: customUrl,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate
    });

  } catch (error) {
    console.error('Error in bot overview:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;