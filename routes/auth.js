const express = require('express');
const router = express.Router();
const path = require('path');
const { verifyCredentials } = require('../middleware/auth');
const clickhouse = require('../config/clickhouse').clickhouse;

// Root route (login page)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

// Content route (post-login)
router.post('/content', async (req, res) => {
  try {
    const user = await verifyCredentials(req);
    if (user) {
      req.session.authenticated = true;
      req.session.username = req.body.username;
      res.sendFile(path.join(__dirname, '../public', 'my_content2.html'));
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Signup routes
router.get('/signup', (req, res) => {
  res.render('signup', { errorMessage: null });
});

router.post('/signup', async (req, res) => {
  const { username, password, hostname, version } = req.body;

  try {
    const query = 'SELECT hostname FROM users';
    const result = await clickhouse.query(query).toPromise();
    const existingHostnames = result.map(row => row.hostname);
    
    const isHostnameConflict = existingHostnames.some(existing => {
      return existing.includes(hostname) || hostname.includes(existing);
    });

    if (isHostnameConflict) {
      res.render('signup', { 
        errorMessage: 'Hostname too similar to an existing one. Please choose a different one.' 
      });
    } else {
      const insertQuery = `
        INSERT INTO users (username, passwordHash, hostname, version)
        VALUES ({username:String}, {passwordHash:String}, {hostname:String}, {version:UInt32})
      `;

      await clickhouse.query(insertQuery, {
        params: {
          username,
          passwordHash: password,
          hostname,
          version: version || 1,
        },
      }).toPromise();

      res.redirect('/?signupSuccess=true');
    }
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).render('signup', { 
      errorMessage: 'An error occurred during signup. Please try again.' 
    });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Could not log out.');
    }
    res.redirect('/');
  });
});

// Protected content route
router.get('/content.html', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.sendFile(path.join(__dirname, '../public', 'content.html'));
  } else {
    res.redirect('/');
  }
});

module.exports = router;