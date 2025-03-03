// routes/genai.js
const express = require('express');
const router = express.Router();

// GET route to render the GenAI interface
router.get('/', (req, res) => {
  res.render('GenAI');
});

module.exports = router;
