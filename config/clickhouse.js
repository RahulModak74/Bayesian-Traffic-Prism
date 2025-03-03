const { ClickHouse } = require('clickhouse');

// ClickHouse configuration
const clickhouse = new ClickHouse({
  url: process.env.CLICKHOUSE_URL || 'http://localhost',
  port: process.env.CLICKHOUSE_PORT || 8123,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || ''
  },
  isUseGzip: false,
  format: 'json',
  config: {
    database: process.env.CLICKHOUSE_DATABASE || 'default'
  },
});

// Test the connection
async function testConnection() {
  try {
    await clickhouse.query('SELECT 1').toPromise();
    console.log('ClickHouse connection successful');
  } catch (error) {
    console.error('ClickHouse connection failed:', error);
  }
}

// Initialize database tables
async function initializeTables() {
  try {
    // tracking10 table - Updated with correct DateTime64 type and UTC timezone
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS tracking10 (
        id Int32,
        timestamp DateTime64(3, 'UTC'),
        url String,
        referrer String,
        ip_address String,
        user_agent String,
        platform String,
        language String,
        hostname String,
        session_id String,
        browser_id String,
        fingerprint_id String,
        clickdata String,
        enhanced_data_id Int64
      ) ENGINE = MergeTree()
      ORDER BY id
      SETTINGS index_granularity = 8192
    `).toPromise();

    // region_details table
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS region_details (
        id Int32,
        ip_address String,
        country String,
        region String,
        city String
      ) ENGINE = MergeTree()
      ORDER BY id
      SETTINGS index_granularity = 8192
    `).toPromise();

    console.log('Tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
}

// Export the configured instance and utility functions
module.exports = {
  clickhouse,
  testConnection,
  initializeTables
};