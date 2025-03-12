// polyswarm-integration.js
// Add this module to your Traffic-Prism codebase

const axios = require('axios');
const crypto = require('crypto');
const { ClickHouse } = require('clickhouse');

// Configuration
const config = {
  polyswarmApiKey: process.env.POLYSWARM_API_KEY,
  polyswarmApiUrl: 'https://api.polyswarm.network/v2',
  clickhouse: {
    host: 'localhost',
    port: 9000,
    database: 'default'
  },
  // How often to check PolySwarm for new threat intelligence
  updateInterval: 1000 * 60 * 60, // 1 hour
  // Risk score threshold to submit sessions for analysis
  submissionThreshold: 60 // Sessions with risk > 60 but < termination threshold
};

// Initialize ClickHouse client
const clickhouse = new ClickHouse(config.clickhouse);

// Initialize PolySwarm API client
class PolySwarmClient {
  constructor(apiKey, apiUrl) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.axios = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `ApiKey ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get latest threat intelligence from PolySwarm
  async getLatestThreats(limit = 100) {
    try {
      const response = await this.axios.get('/search/metadata', {
        params: {
          limit,
          order_by: 'first_seen',
          direction: 'desc'
        }
      });
      return response.data.result;
    } catch (error) {
      console.error('Error fetching threats from PolySwarm:', error.message);
      return [];
    }
  }

  // Submit a suspicious artifact (e.g., URL, pattern, or payload from a session)
  async submitArtifact(artifact, type = 'url') {
    try {
      const response = await this.axios.post('/consumer/submission', {
        artifact,
        type
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting to PolySwarm:', error.message);
      return null;
    }
  }

  // Get verdict for a previously submitted artifact
  async getVerdict(uuid) {
    try {
      const response = await this.axios.get(`/consumer/submission/${uuid}`);
      return response.data;
    } catch (error) {
      console.error('Error getting verdict from PolySwarm:', error.message);
      return null;
    }
  }
}

// Initialize client
const polyswarmClient = new PolySwarmClient(
  config.polyswarmApiKey,
  config.polyswarmApiUrl
);

// Store threat intelligence in ClickHouse for real-time lookups
async function updateThreatIntelligence() {
  try {
    const threats = await polyswarmClient.getLatestThreats(1000);
    
    if (!threats.length) return;
    
    // Prepare threat data for ClickHouse
    const records = threats.map(threat => ({
      hash: threat.sha256 || threat.sha1 || threat.md5,
      type: threat.extended_type || 'unknown',
      first_seen: new Date(threat.first_seen).toISOString(),
      last_seen: new Date(threat.last_seen).toISOString(),
      confidence: threat.polyscore || 0.5,
      tags: JSON.stringify(threat.tags || []),
      indicators: JSON.stringify(threat.indicators || {}),
      metadata: JSON.stringify(threat)
    }));
    
    // Insert to ClickHouse
    await clickhouse.insert('polyswarm_threats', records).toPromise();
    console.log(`Updated ${records.length} threat indicators from PolySwarm`);
  } catch (error) {
    console.error('Error updating threat intelligence:', error);
  }
}

// Check suspicious sessions and submit them to PolySwarm if needed
async function processSuspiciousSessions() {
  try {
    // Query for sessions with risk scores in the suspicious range
    // but below automatic termination threshold
    const query = `
      SELECT 
        session_id, 
        hostname,
        total_risk_score,
        browser_risk,
        freq_risk,
        geo_risk,
        ip,
        user_agent,
        urls,
        clickevents,
        referrers
      FROM updated_hist_session_risk_scores
      WHERE total_risk_score > ${config.submissionThreshold}
        AND total_risk_score < 80  -- Assuming termination threshold is 80
        AND submitted_to_polyswarm = 0
      LIMIT 10
    `;
    
    const suspiciousSessions = await clickhouse.query(query).toPromise();
    
    for (const session of suspiciousSessions) {
      // Extract relevant data to submit
      const sessionData = {
        session_id: session.session_id,
        ip: session.ip,
        user_agent: session.user_agent,
        risk_score: session.total_risk_score,
        urls: JSON.parse(session.urls || '[]'),
        clicks: JSON.parse(session.clickevents || '[]'),
        referrers: JSON.parse(session.referrers || '[]')
      };
      
      // For URLs, we'll submit each suspicious URL to PolySwarm
      const suspiciousUrls = sessionData.urls.filter(url => 
        url.includes('script') || 
        url.includes('eval') || 
        url.includes('javascript:') || 
        url.includes('.php?id=')
      );
      
      for (const url of suspiciousUrls) {
        const submission = await polyswarmClient.submitArtifact(url, 'url');
        
        if (submission && submission.uuid) {
          // Record the submission in ClickHouse
          await clickhouse.insert('polyswarm_submissions', [{
            session_id: session.session_id,
            submission_uuid: submission.uuid,
            artifact: url,
            type: 'url',
            submission_time: new Date().toISOString()
          }]).toPromise();
          
          // Mark session as submitted
          await clickhouse.query(`
            ALTER TABLE updated_hist_session_risk_scores
            UPDATE submitted_to_polyswarm = 1
            WHERE session_id = '${session.session_id}'
          `).toPromise();
        }
      }
      
      // Also check for suspicious click patterns or DOM manipulations
      // This is just an example - you'd need to adapt to your actual click data structure
      const suspiciousClicks = sessionData.clicks.filter(click => 
        click.target && (
          click.target.includes('eval(') ||
          click.target.includes('document.write') ||
          click.target.includes('script')
        )
      );
      
      for (const click of suspiciousClicks) {
        // Submit the suspicious DOM interaction as a string artifact
        const artifact = JSON.stringify(click);
        const submission = await polyswarmClient.submitArtifact(artifact, 'file');
        
        if (submission && submission.uuid) {
          // Record similarly to URL submissions
          await clickhouse.insert('polyswarm_submissions', [{
            session_id: session.session_id,
            submission_uuid: submission.uuid,
            artifact: artifact.substring(0, 255), // Truncate for storage
            type: 'dom_interaction',
            submission_time: new Date().toISOString()
          }]).toPromise();
        }
      }
    }
  } catch (error) {
    console.error('Error processing suspicious sessions:', error);
  }
}

// Check for verdict updates from PolySwarm
async function checkVerdicts() {
  try {
    // Get submissions waiting for verdicts
    const query = `
      SELECT 
        submission_uuid, 
        session_id,
        artifact,
        type
      FROM polyswarm_submissions
      WHERE verdict IS NULL
        AND submission_time < now() - INTERVAL 10 MINUTE
      LIMIT 50
    `;
    
    const pendingSubmissions = await clickhouse.query(query).toPromise();
    
    for (const submission of pendingSubmissions) {
      const verdict = await polyswarmClient.getVerdict(submission.submission_uuid);
      
      if (verdict) {
        // Update the verdict in our database
        await clickhouse.query(`
          ALTER TABLE polyswarm_submissions
          UPDATE 
            verdict = '${verdict.polyscore || 0}',
            verdict_time = '${new Date().toISOString()}'
          WHERE submission_uuid = '${submission.submission_uuid}'
        `).toPromise();
        
        // If the verdict is highly confident and malicious, add it to rules
        if (verdict.polyscore > 0.8) {
          // Extract signature or pattern
          let pattern = '';
          
          if (submission.type === 'url') {
            // Extract domain or path pattern
            const url = new URL(submission.artifact);
            pattern = url.hostname + url.pathname;
          } else if (submission.type === 'dom_interaction') {
            // Extract pattern from DOM interaction
            const interaction = JSON.parse(submission.artifact);
            pattern = interaction.target || interaction.innerHTML || '';
          }
          
          if (pattern) {
            // Create a rule for future detection
            await clickhouse.insert('rules', [{
              name: `PolySwarm Auto Rule - ${crypto.randomBytes(4).toString('hex')}`,
              condition: `contains(url, '${pattern.replace(/'/g, "\\'")}')`,
              action: 'terminate',
              description: `Automatically created from PolySwarm verdict: ${verdict.polyscore}`,
              created_at: new Date().toISOString(),
              enabled: 1
            }]).toPromise();
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking verdicts:', error);
  }
}

// Add necessary tables to ClickHouse
async function setupDatabase() {
  try {
    // Create table for PolySwarm threat intelligence
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS polyswarm_threats (
        hash String,
        type String,
        first_seen DateTime,
        last_seen DateTime,
        confidence Float64,
        tags String,
        indicators String,
        metadata String,
        added_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (hash, added_at)
      TTL added_at + INTERVAL 30 DAY
    `).toPromise();
    
    // Create table for PolySwarm submissions
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS polyswarm_submissions (
        submission_uuid String,
        session_id String,
        artifact String,
        type String,
        submission_time DateTime,
        verdict Nullable(Float64) DEFAULT NULL,
        verdict_time Nullable(DateTime) DEFAULT NULL
      ) ENGINE = MergeTree()
      ORDER BY (submission_uuid, session_id)
    `).toPromise();
    
    // Add a field to track PolySwarm submissions in sessions table
    await clickhouse.query(`
      ALTER TABLE updated_hist_session_risk_scores
      ADD COLUMN IF NOT EXISTS submitted_to_polyswarm UInt8 DEFAULT 0
    `).toPromise();
    
    console.log('PolySwarm integration database setup complete');
  } catch (error) {
    console.error('Error setting up database for PolySwarm integration:', error);
  }
}

// Start the integration
async function initialize() {
  try {
    // Set up database tables
    await setupDatabase();
    
    // Initial threat intelligence update
    await updateThreatIntelligence();
    
    // Schedule regular updates
    setInterval(updateThreatIntelligence, config.updateInterval);
    
    // Process suspicious sessions every 15 minutes
    setInterval(processSuspiciousSessions, 1000 * 60 * 15);
    
    // Check for verdict updates every 30 minutes
    setInterval(checkVerdicts, 1000 * 60 * 30);
    
    console.log('PolySwarm integration initialized');
  } catch (error) {
    console.error('Error initializing PolySwarm integration:', error);
  }
}

// Export functions for use in Traffic-Prism
module.exports = {
  initialize,
  client: polyswarmClient,
  checkUrl: async (url) => {
    // Quickly check if a URL matches known threats
    const result = await clickhouse.query(`
      SELECT count() as count
      FROM polyswarm_threats
      WHERE indexOf(metadata, '${url.replace(/'/g, "\\'")}') > 0
        AND confidence > 0.7
    `).toPromise();
    
    return result[0].count > 0;
  },
  submitSession: async (sessionId) => {
    // Manually submit a session for analysis
    const session = await clickhouse.query(`
      SELECT * FROM updated_hist_session_risk_scores
      WHERE session_id = '${sessionId}'
    `).toPromise();
    
    if (session.length > 0) {
      await processSuspiciousSessions([session[0]]);
      return true;
    }
    return false;
  }
};
