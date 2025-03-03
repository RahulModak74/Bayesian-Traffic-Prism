const { ClickHouse } = require('clickhouse');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');

// Initialize ClickHouse client
const clickhouse = new ClickHouse({
  url: 'http://localhost',
  port: 8123,
  debug: false,
  basicAuth: {
    username: 'default',
    password: '',
  },
  isUseGzip: false,
  format: 'json',
  config: {
    session_timeout: 60,
    output_format_json_quote_64bit_integers: 0,
    enable_http_compression: 0,
  },
});

// Create progress bar
const progressBar = new cliProgress.MultiBar({
    format: '{bar} {percentage}% | {value}/{total} Sessions | {status}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true
}, cliProgress.Presets.shades_classic);

async function calculateBatchSessionRisk(sessionIds) {
  if (sessionIds.length === 0) return [];
  
  const results = [];
  const sessionIdList = sessionIds.map(id => `'${id}'`).join(',');
  
  // Main risk factors query - exact same structure as endpoint
  const query = `
    WITH RiskFactors AS (
      SELECT
        t.session_id,
        (uniqExact(t.browser_id) > 1) * 3 AS browser_risk,
        (uniqExact(t.ip_address) > 1) * 3 AS ip_risk,
        (COUNT(CASE WHEN t.url LIKE '%login%' THEN 1 END) > 2) * 2 AS login_risk,
        ((COUNT(DISTINCT t.url) > 40 AND dateDiff('second', MIN(t.timestamp), MAX(t.timestamp)) < 180)) * 2 AS freq_risk,
        (COUNT(CASE WHEN t.user_agent LIKE '%bot%' THEN 1 END) > 0) * 2 AS bot_risk,
        (uniqExact(concat(rd.country, rd.region, rd.city)) > 1) * 3 AS geo_risk,
        -- New attack detection risks
        (COUNT(CASE WHEN t.url LIKE '%script%' OR t.url LIKE '%</script>%' THEN 1 END) > 0) * 8 AS xss_risk,
        (COUNT(CASE WHEN t.url LIKE '%redirect%' OR t.url LIKE '%target=%' THEN 1 END) > 0) * 8 AS redirect_risk,
        (COUNT(CASE WHEN t.url LIKE '%localhost%' OR t.url LIKE '%127.0.0.1%' THEN 1 END) > 0) * 8 AS ssrf_risk,
        (COUNT(CASE WHEN t.url LIKE '% OR %=% OR %' OR t.url LIKE '%1=1%' THEN 1 END) > 0) * 8 AS sqli_risk,
        COUNT(DISTINCT concat(t.url, toString(t.timestamp))) AS request_count,
        uniqExact(t.ip_address) AS distinct_ip_count,
        COUNT(CASE WHEN t.url LIKE '%login%' THEN 1 END) AS login_attempts,
        dateDiff('second', MIN(t.timestamp), MAX(t.timestamp)) AS session_duration,
        MIN(t.timestamp) AS session_start,
        t.hostname
      FROM tracking10 t
      LEFT JOIN region_details rd ON t.ip_address = rd.ip_address
      WHERE t.session_id IN (${sessionIdList})
      GROUP BY t.session_id, t.hostname
    ),
    RiskScores AS (
      SELECT
        *,
        least(browser_risk + ip_risk + login_risk + freq_risk + bot_risk + geo_risk +
              xss_risk + redirect_risk + ssrf_risk + sqli_risk, 10) AS total_risk_score
      FROM RiskFactors
    )
    SELECT *
    FROM RiskScores
  `;

  try {
    const queryResult = await clickhouse.query(query).toPromise();
    
    // Separate URL Changes query - exact same as endpoint
    const urlChangesQuery = `
    SELECT
      session_id,
      COUNT(*) AS url_change_count
    FROM (
      SELECT
        session_id,
        url,
        lagInFrame(url) OVER (PARTITION BY session_id ORDER BY timestamp) AS prev_url
      FROM tracking10
      WHERE session_id IN (${sessionIdList})
    ) 
    WHERE (url != prev_url) OR (prev_url IS NULL)
    GROUP BY session_id`;
    
    const urlChangesResult = await clickhouse.query(urlChangesQuery).toPromise();
    
    // Create a map of session_id to url_change_count - same approach as endpoint
    const urlChangeMap = {};
    urlChangesResult.forEach(row => {
      urlChangeMap[row.session_id] = row.url_change_count;
    });
    
    // Merge the results
    for (const row of queryResult) {
      // Determine action recommendations based on total risk score
      let action;
      if (row.total_risk_score >= 8) {
        action = {
          "No interference": 0,
          "Send Captcha": 10,
          "Terminate and Redirect": 90
        };
      } else if (row.total_risk_score >= 5) {
        action = {
          "No interference": 10,
          "Send Captcha": 80,
          "Terminate and Redirect": 10
        };
      } else {
        action = {
          "No interference": 90,
          "Send Captcha": 10,
          "Terminate and Redirect": 0
        };
      }

      results.push({
        session_id: row.session_id,
        total_risk_score: row.total_risk_score,
        browser_risk: row.browser_risk,
        login_risk: row.login_risk,
        ip_risk: row.ip_risk,
        freq_risk: row.freq_risk,
        bot_risk: row.bot_risk,
        geo_risk: row.geo_risk,
        xss_risk: row.xss_risk,
        redirect_risk: row.redirect_risk,
        ssrf_risk: row.ssrf_risk,
        sqli_risk: row.sqli_risk,
        request_count: row.request_count,
        distinct_ip_count: row.distinct_ip_count,
        login_attempts: row.login_attempts,
        session_duration: row.session_duration,
        url_change_count: urlChangeMap[row.session_id] || 0,
        action_recommendations: JSON.stringify(action),
        host: row.hostname,
        timestamp: row.session_start
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error calculating risk for batch of sessions:`, error);
    return [];
  }
}

async function generateEnhancedRiskCSV() {
  const BATCH_SIZE = 500; // Process 500 sessions at a time
  const host = 'abc';  // Hardcoded hostname
  const startDate = '2024-08-24';  // Hardcoded start date
  const endDate = '2024-12-24';  // Hardcoded end date
  const currentDate = new Date().toISOString().split('T')[0];
  const outputFile = path.join(__dirname, `enhanced_risk_data_${host}_${currentDate}.csv`);

  // Fetch distinct session IDs and timestamp based on hostname and timestamp range
  const sessionIdsQuery = `
    SELECT DISTINCT session_id, MIN(timestamp) AS session_timestamp
    FROM tracking10
    WHERE hostname LIKE '%${host}%' 
    AND timestamp BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY session_id
  `;
  console.log(`Executing session IDs query: ${sessionIdsQuery}`);

  try {
    const sessionIdsResult = await clickhouse.query(sessionIdsQuery).toPromise();
    const sessionIds = sessionIdsResult.map(row => row.session_id);

    if (sessionIds.length === 0) {
      console.log("No sessions found for the specified host and date range.");
      return;
    }

    // Print the table structure that should be created in ClickHouse
    console.log(`
CREATE TABLE IF NOT EXISTS default.updated_hist_session_risk_scores (
  session_id String,
  total_risk_score Float64,
  browser_risk Float64,
  login_risk Float64,
  ip_risk Float64,
  freq_risk Float64,
  bot_risk Float64,
  geo_risk Float64,
  xss_risk Float64,
  redirect_risk Float64,
  ssrf_risk Float64,
  sqli_risk Float64,
  request_count UInt32,
  distinct_ip_count UInt32,
  login_attempts UInt32,
  session_duration UInt32,
  url_change_count UInt32,
  action_recommendations String,
  host String,
  timestamp DateTime
) ENGINE = MergeTree()
ORDER BY (session_id, timestamp);
    `);

    // Create CSV file with headers
    const headers = [
      'session_id', 'total_risk_score', 
      'browser_risk', 'login_risk', 'ip_risk', 
      'freq_risk', 'bot_risk', 'geo_risk',
      'xss_risk', 'redirect_risk', 'ssrf_risk', 'sqli_risk',
      'request_count', 'distinct_ip_count', 'login_attempts', 'session_duration', 'url_change_count',
      'action_recommendations', 'host', 'timestamp'
    ].join(',');
    
    fs.writeFileSync(outputFile, headers + '\n');
    console.log(`Created CSV file with headers at ${outputFile}`);
    console.log(`\nFound ${sessionIds.length} total sessions to process for ${host}.`);
    console.log('\nProcessing sessions in batches...\n');

    const bar = progressBar.create(sessionIds.length, 0, { status: 'Starting...' });
    let processedCount = 0;
    
    // Process in batches
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      const batch = sessionIds.slice(i, i + BATCH_SIZE);
      bar.update(processedCount, { 
        status: `Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sessionIds.length/BATCH_SIZE)}` 
      });
      
      const batchResults = await calculateBatchSessionRisk(batch);

      // Write batch results to CSV
      let csvContent = '';
      for (const result of batchResults) {
        // Format timestamps in YYYY-MM-DD HH:MM:SS format that ClickHouse accepts
        const date = new Date(result.timestamp);
        // Format as YYYY-MM-DD HH:MM:SS
        const timestamp = date.getFullYear() + '-' + 
                         String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(date.getDate()).padStart(2, '0') + ' ' + 
                         String(date.getHours()).padStart(2, '0') + ':' + 
                         String(date.getMinutes()).padStart(2, '0') + ':' + 
                         String(date.getSeconds()).padStart(2, '0');
        
        // Create CSV row with all fields
        const row = [
          `"${result.session_id}"`,
          result.total_risk_score,
          result.browser_risk,
          result.login_risk,
          result.ip_risk,
          result.freq_risk,
          result.bot_risk,
          result.geo_risk,
          result.xss_risk,
          result.redirect_risk,
          result.ssrf_risk,
          result.sqli_risk,
          result.request_count,
          result.distinct_ip_count,
          result.login_attempts,
          result.session_duration,
          result.url_change_count,
          `"${result.action_recommendations.replace(/"/g, '""')}"`,
          `"${result.host}"`,
          `"${timestamp}"`
        ].join(',');
        
        csvContent += row + '\n';
      }
      
      // Append batch results to the CSV file
      if (csvContent) {
        fs.appendFileSync(outputFile, csvContent);
      }
      
      processedCount += batch.length;
      bar.update(processedCount, { 
        status: `Processed ${batchResults.length} sessions in batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sessionIds.length/BATCH_SIZE)}` 
      });
    }
    
    bar.update(sessionIds.length, { status: 'Processing complete!' });
    progressBar.stop();
    
    console.log(`\nEnhanced risk data CSV generation completed.`);
    console.log(`CSV file saved at: ${outputFile}`);
    
    // Generate the SQL command to import the CSV
    console.log(`
To import this CSV into ClickHouse, you can use the following command:

clickhouse-client --query="INSERT INTO default.updated_hist_session_risk_scores FORMAT CSVWithNames" < ${outputFile}
    `);
  } catch (error) {
    console.error('Error generating CSV:', error);
    progressBar.stop();
  }
}

// Execute the enhanced risk analysis to generate CSV
generateEnhancedRiskCSV().catch(console.error);