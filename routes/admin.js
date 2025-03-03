const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;
const { getIpDetails } = require('../utils/ip-details');

router.get('/', async (req, res) => {
  const customUrl = req.query.custom_url || 'Ethnix';
  const name = req.username;
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const startDate = req.query.start_date || '2024-10-01';
  const endDate = req.query.end_date || '2024-10-31';

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${name}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const firstHost = hostarray[0].hostname;

    // Use the hostname in the query
    const query = `
      SELECT 
        session_id,
        ip_address,
        timestamp,
        url,
        session_id,
        browser_id,
        fingerprint_id 
      FROM tracking10 
      WHERE url LIKE '%${customUrl}%' 
        AND timestamp BETWEEN '${startDate}' AND '${endDate}' 
        AND hostname LIKE '%${firstHost}%' 
      ORDER BY timestamp DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Filter unique sessions
    const uniqueSessions = new Set();
    const uniqueData = result.filter(row => {
      if (!uniqueSessions.has(row.session_id[0])) {
        uniqueSessions.add(row.session_id[0]);
        return true;
      }
      return false;
    });

    // Pagination
    const totalRows = uniqueData.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    const paginatedData = uniqueData.slice(startIdx, endIdx);

    // Add IP details
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

      // Process timestamp
      const timestamp = new Date(row.timestamp);
      row.date = timestamp.toISOString().split('T')[0];
      row.time = timestamp.toTimeString().split(' ')[0].substring(0, 8);
      return row;
    }));

    // Get valid sessions based on hostname
    const sessionIds = Object.keys(global.sessions);
    let validSessions = [];

    if (sessionIds.length > 0) {
      const hostnamesQuery = `
        SELECT session_id, hostname 
        FROM tracking10 
        WHERE session_id IN (${sessionIds.map(id => `'${id}'`).join(', ')})
      `;
      const hostnamesResult = await clickhouse.query(hostnamesQuery).toPromise();
      
      validSessions = sessionIds.filter(sessionId => {
        const sessionData = hostnamesResult.find(row => row.session_id === sessionId);
        return sessionData && sessionData.hostname.includes(firstHost);
      });
    }

    const filteredData = paginatedDataWithDetails.filter(row => row !== null);

    res.render('admin', {
      data: filteredData,
      custom_url: customUrl,
      totalPages: totalPages,
      currentPage: page,
      start_date: startDate,
      end_date: endDate,
      sessions: validSessions
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Raw report endpoint for admin
router.get('/rawreport', async (req, res) => {
  const customUrl = req.query.custom_url || 'bluebot';
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

    const query = `
      SELECT 
        session_id,
        ip_address,
        timestamp,
        url,
        session_id,
        browser_id,
        fingerprint_id 
      FROM tracking10 
      WHERE url LIKE '%${customUrl}%' 
        AND timestamp BETWEEN '${startDate}' AND '${endDate}' 
        AND hostname LIKE '%${host}%' 
      ORDER BY timestamp DESC
    `;

    const result = await clickhouse.query(query).toPromise();

    // Process data similar to main admin route
    const uniqueSessions = new Set();
    const uniqueData = result.filter(row => {
      if (!uniqueSessions.has(row.session_id[0])) {
        uniqueSessions.add(row.session_id[0]);
        return true;
      }
      return false;
    });

    const totalRows = uniqueData.length;
    const totalPages = Math.ceil(totalRows / perPage);
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    const paginatedData = uniqueData.slice(startIdx, endIdx);

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

      const timestamp = new Date(row.timestamp);
      row.date = timestamp.toISOString().split('T')[0];
      row.time = timestamp.toTimeString().split(' ')[0].substring(0, 8);
      return row;
    }));

    const filteredData = paginatedDataWithDetails.filter(row => row !== null);

    res.render('report3', {
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