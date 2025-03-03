// routes/rules.js
const express = require('express');
const router = express.Router();
const clickhouse = require('../config/clickhouse').clickhouse;

// Get all rules
router.get('/', async (req, res) => {
  const username = req.username;

  try {
    // Fetch the hostname for the user
    const q2 = `SELECT hostname FROM users WHERE username = '${username}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const hostname = hostarray[0].hostname;

    // Query to fetch only the rules for the specific hostname
    const query = `SELECT * FROM rules WHERE hostname LIKE '%${hostname}%' ORDER BY creation_time DESC`;
    const rules = await clickhouse.query(query).toPromise();

    res.render('rules', { rules });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching rules');
  }
});

// Create a new rule
router.post('/', async (req, res) => {
  const { rule, name, action_time, action } = req.body;
  const username = req.username;

  try {
    const q2 = `SELECT hostname FROM users WHERE username = '${username}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const hostname = hostarray[0].hostname;

    const result = await clickhouse.query('SELECT max(id) AS maxId FROM rules').toPromise();
    const maxId = result.length > 0 ? result[0].maxId : null;
    let nextId = maxId !== null ? maxId + 1 : 0;

    const creationTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const version = 1;

    const escapedRule = rule.replace(/'/g, "''");
    const escapedAction = action.replace(/'/g, "''");

    const query = `
      INSERT INTO rules (id, rule, hostname, name, creation_time, last_edit_time, version, action_time, action) 
      VALUES (${nextId}, '${escapedRule}', '${hostname}', '${name}', '${creationTime}', '${creationTime}', ${version}, ${action_time}, '${escapedAction}')
    `;

    await clickhouse.query(query).toPromise();
    res.redirect('/rules');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating rule');
  }
});

// Update a rule
router.post('/edit/:id', async (req, res) => {
  const { rule, name, action_time, action } = req.body;
  const { id } = req.params;
  const username = req.username;

  try {
    const q2 = `SELECT hostname FROM users WHERE username = '${username}'`;
    const hostarray = await clickhouse.query(q2).toPromise();
    const hostname = hostarray[0].hostname;

    const result = await clickhouse.query(`SELECT version FROM rules WHERE id = ${id} ORDER BY version DESC LIMIT 1`).toPromise();
    const currentVersion = result.length > 0 ? result[0].version : 0;

    const newVersion = currentVersion + 1;
    const lastEditTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const creationTime = lastEditTime;

    const escapedRule = rule.replace(/'/g, "''");
    const escapedAction = action.replace(/'/g, "''");

    await clickhouse.query(`ALTER TABLE rules DELETE WHERE id = ${id} AND version = ${currentVersion}`).toPromise();

    const insertQuery = `
      INSERT INTO rules (id, rule, hostname, name, creation_time, last_edit_time, version, action_time, action) 
      VALUES (${id}, '${escapedRule}', '${hostname}', '${name}', '${creationTime}', '${lastEditTime}', ${newVersion}, ${action_time}, '${escapedAction}')
    `;

    await clickhouse.query(insertQuery).toPromise();
    res.redirect('/rules');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating rule');
  }
});

// Delete a rule
router.post('/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `ALTER TABLE rules DELETE WHERE id = ${id}`;
    await clickhouse.query(query).toPromise();
    res.redirect('/rules');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting rule');
  }
});

module.exports = router;