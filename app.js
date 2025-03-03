const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('express-flash');
const http = require('http');
require('dotenv').config();

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Import configurations
const { clickhouse, testConnection, initializeTables } = require('./config/clickhouse');
const { initializeSocket } = require('./config/socket_io');
const { isAuthenticated } = require('./middleware/auth');

// Initialize Socket.IO
const io = initializeSocket(server);

// Make io accessible to routes
app.set('io', io);

// Middleware Configuration
app.use(flash());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Global session store
global.sessions = [];

// Initialize database and test connection
(async () => {
  try {
    await testConnection();
    await initializeTables();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
})();

// Define route modules
const routes = {
  auth: require('./routes/auth'),
  admin: require('./routes/admin'),
  botDetails: require('./routes/bot-details'),
  botOverview: require('./routes/bot-overview'),
  botRequests: require('./routes/bot-requests'),
  browserRisk: require('./routes/browser-risk'),
  csrfDetection: require('./routes/csrf-detection'),
  ipRisk: require('./routes/ip-risk'),
  maliciousRequests: require('./routes/malicious-requests'),
  mimicBot: require('./routes/mimic-bot'),
  riskAnalysis: require('./routes/risk-analysis'),
  sessionJourney: require('./routes/session-journey'),
  sessionManagement: require('./routes/session-management'),
  sessionSummary: require('./routes/session-summary'),
  suspiciousReferrers: require('./routes/suspicious-referrers'),
  tracking: require('./routes/tracking'),
  genai: require('./routes/genai'),
  suspiciousActivity: require('./routes/suspicious-activity'),
  highFrequency: require('./routes/high-frequency'),
  potentialScraping: require('./routes/potential-scraping'),
  sessionsWithoutIp: require('./routes/sessions-without-ip'),
  suspiciousUserAgents: require('./routes/suspicious-user-agents'),
  rules: require('./routes/rules'),
  unusualBotActivity: require('./routes/unusual-bot-activity'),
  scrapingAnalysis: require('./routes/scraping-analysis'),
  updatedSessionRiskAnalysis: require('./routes/updated-session-risk-analysis'),
};

// Mount routes with error handling
const mountRoute = (path, router, requireAuth = true) => {
  try {
    app.use(path, requireAuth ? isAuthenticated : (req, res, next) => next(), router);
  } catch (error) {
    console.error(`Error mounting route ${path}:`, error);
  }
};

// Mount all routes
mountRoute('/', routes.auth, false);
mountRoute('/admin', routes.admin);
mountRoute('/bot-details', routes.botDetails);
mountRoute('/bot-overview', routes.botOverview);
mountRoute('/bot-requests', routes.botRequests);
mountRoute('/browser-risk', routes.browserRisk);
mountRoute('/csrf-detection', routes.csrfDetection);
mountRoute('/ip-risk', routes.ipRisk);
mountRoute('/malicious-requests', routes.maliciousRequests);
mountRoute('/mimic-bot', routes.mimicBot);
mountRoute('/risk-analysis', routes.riskAnalysis);
mountRoute('/session-journey', routes.sessionJourney);
mountRoute('/session-management', routes.sessionManagement);
mountRoute('/session-summary', routes.sessionSummary);
mountRoute('/suspicious-referrers', routes.suspiciousReferrers);
mountRoute('/track', routes.tracking, false); 
mountRoute('/genai', routes.genai);
mountRoute('/suspicious-activity', routes.suspiciousActivity);
mountRoute('/highfrequencyreport', routes.highFrequency);
mountRoute('/potentialscraping', routes.potentialScraping);
mountRoute('/sessionswithoutip', routes.sessionsWithoutIp);
mountRoute('/suspicioususeragents', routes.suspiciousUserAgents);
mountRoute('/rules', routes.rules);
mountRoute('/unusualbotactivity', routes.unusualBotActivity);
mountRoute('/scrapinganalysis', routes.scrapingAnalysis);
mountRoute('/updated-session-risk-analysis', routes.updatedSessionRiskAnalysis);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: 'Page not found',
    error: { status: 404 }
  });
});

// Export server and app for testing/importing
module.exports = { app, server };

// Optional: Start server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}