// Node.js EDR Telemetry Agent
// Reference implementation for Bayesian-EDR

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { ClickHouse } = require('clickhouse');
const si = require('systeminformation');
const commandLineArgs = require('command-line-args');
const winston = require('winston');

// Parse command line arguments
const optionDefinitions = [
  { name: 'host', alias: 'h', type: String, defaultValue: 'localhost' },
  { name: 'port', alias: 'p', type: Number, defaultValue: 8123 },
  { name: 'user', alias: 'u', type: String, defaultValue: 'default' },
  { name: 'password', alias: 'w', type: String, defaultValue: '' },
  { name: 'database', alias: 'd', type: String, defaultValue: 'default' },
  { name: 'interval', alias: 'i', type: Number, defaultValue: 300 },
  { name: 'logfile', alias: 'l', type: String }
];

const options = commandLineArgs(optionDefinitions);

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    options.logfile
      ? new winston.transports.File({ filename: options.logfile })
      : new winston.transports.Console()
  ]
});

// Configuration for the agent
const config = {
  clickhouse: {
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.database
  },
  collectionInterval: options.interval * 1000,
  hostname: os.hostname(),
  osType: os.platform(),
  osVersion: `${os.type()} ${os.release()}`,
  ipAddress: getIPAddress(),
  domain: 'workgroup', // Will be populated later
  endpointId: '', // Will be populated later
  collectorVersion: '1.0.0'
};

// Initialize ClickHouse client
const clickhouse = new ClickHouse({
  url: `http://${config.clickhouse.host}`,
  port: config.clickhouse.port,
  debug: false,
  basicAuth: {
    username: config.clickhouse.user,
    password: config.clickhouse.password
  },
  format: 'json',
  raw: false,
  config: {
    session_timeout: 60,
    output_format_json_quote_64bit_integers: 0,
    enable_http_compression: 0
  }
});

// Main function
async function main() {
  logger.info('==== EDR Telemetry Agent Starting ====');
  logger.info(`Runtime: ${config.osType}/${os.arch()}`);
  logger.info(`EDR Telemetry Agent starting on ${config.hostname} (${config.osType})`);
  logger.info(`Collection interval: ${config.collectionInterval / 1000} seconds`);
  logger.info(`Connecting to ClickHouse at ${config.clickhouse.host}:${config.clickhouse.port}`);

  try {
    // Initialize endpoint information
    await initializeEndpointInfo();
    
    // Create table if it doesn't exist
    await createTableIfNotExists();
    
    // Start collection loop
    startCollectionLoop();
    
    logger.info('Agent initialized successfully');
  } catch (error) {
    logger.error(`Initialization error: ${error.message}`);
    process.exit(1);
  }
}

// Initialize endpoint-specific information
async function initializeEndpointInfo() {
  try {
    // Get domain information
    if (config.osType === 'win32') {
      const domain = await execCommand('wmic computersystem get domain');
      const lines = domain.split('\n').filter(line => line.trim() !== '');
      if (lines.length >= 2) {
        config.domain = lines[1].trim();
      }
    } else if (config.osType === 'linux') {
      try {
        const resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf8');
        const lines = resolvConf.split('\n');
        for (const line of lines) {
          if (line.startsWith('domain') || line.startsWith('search')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
              config.domain = parts[1];
              break;
            }
          }
        }
      } catch (error) {
        logger.warn(`Could not read domain information: ${error.message}`);
      }
    }

    // Generate endpoint ID
    const systemInfo = await si.system();
    config.endpointId = `${systemInfo.uuid || config.hostname}-${config.osType}`;
    
    logger.info(`Endpoint ID: ${config.endpointId}`);
    logger.info(`Domain: ${config.domain}`);
  } catch (error) {
    logger.warn(`Error initializing endpoint info: ${error.message}`);
    // Continue with defaults if we can't get specific info
  }
}

// Create the telemetry table if it doesn't exist
async function createTableIfNotExists() {
  const query = `
    CREATE TABLE IF NOT EXISTS ${config.clickhouse.database}.endpoint_process_telemetry (
      hostname String,
      endpoint_id String,
      os_type Enum8('Windows' = 1, 'Linux' = 2, 'MacOS' = 3, 'Other' = 4),
      os_version String,
      ip_address String,
      domain String,
      
      timestamp DateTime DEFAULT now(),
      collector_version String,
      
      pid UInt32,
      ppid UInt32,
      name String,
      exe_path String,
      cmdline String,
      user String,
      start_time DateTime64(3) DEFAULT now(),
      runtime_secs UInt64,
      
      rss UInt64,
      vms UInt64,
      cpu_percent Float32,
      num_threads UInt32,
      status String,
      exe_hash String,
      exe_signature_valid UInt8,
      exe_signer String,
      exe_mismatch UInt8,
      
      mapped_files_count UInt32,
      anonymous_mem_size UInt64,
      rwx_segments_count UInt32,
      
      integrity_level String DEFAULT '',
      session_id UInt32 DEFAULT 0,
      is_service UInt8 DEFAULT 0,
      service_name String DEFAULT '',
      vad_count UInt32 DEFAULT 0,
      remote_mem_operations UInt32 DEFAULT 0,
      token_manipulation UInt8 DEFAULT 0,
      credential_access UInt8 DEFAULT 0,
      
      cgroup String DEFAULT '',
      capabilities Array(String) DEFAULT [],
      namespaces Array(String) DEFAULT [],
      container_id String DEFAULT '',
      
      file_writes UInt32 DEFAULT 0,
      file_reads UInt32 DEFAULT 0,
      sensitive_file_access Array(String) DEFAULT [],
      
      listening_ports Array(UInt16) DEFAULT [],
      conn_count UInt32 DEFAULT 0,
      dns_queries Array(String) DEFAULT [],
      outbound_bytes UInt64 DEFAULT 0,
      inbound_bytes UInt64 DEFAULT 0,
      remote_ips Array(String) DEFAULT [],
      
      registry_writes UInt32 DEFAULT 0,
      registry_persistence_access UInt8 DEFAULT 0,
      registry_keys_modified Array(String) DEFAULT [],
      
      script_execution UInt8 DEFAULT 0,
      script_type String DEFAULT '',
      script_content_hash String DEFAULT '',
      obfuscated_script UInt8 DEFAULT 0,
      
      task_created UInt8 DEFAULT 0,
      service_created UInt8 DEFAULT 0,
      task_name String DEFAULT '',
      
      logon_type UInt8 DEFAULT 0,
      
      child_processes Array(UInt32) DEFAULT [],
      
      loaded_modules Array(String) DEFAULT [],
      loaded_module_count UInt32 DEFAULT 0
    ) ENGINE = MergeTree 
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (hostname, timestamp, pid)
    SETTINGS index_granularity = 8192
  `;

  try {
    await clickhouse.query(query).toPromise();
    logger.info('Table endpoint_process_telemetry created or already exists');
  } catch (error) {
    logger.error(`Failed to create table: ${error.message}`);
    throw error;
  }
}

// Start the collection loop
function startCollectionLoop() {
  // Collect immediately on startup
  collectAndUploadTelemetry();
  
  // Then collect at the specified interval
  setInterval(collectAndUploadTelemetry, config.collectionInterval);
}

// Collect and upload telemetry data
async function collectAndUploadTelemetry() {
  try {
    logger.info('Collecting process telemetry...');
    const processes = await collectProcesses();
    logger.info(`Collected telemetry for ${processes.length} processes`);
    
    if (processes.length > 0) {
      await uploadTelemetry(processes);
    } else {
      logger.warn('No process data collected, skipping upload');
    }
  } catch (error) {
    logger.error(`Error in collection cycle: ${error.message}`);
  }
}

// Collect information about running processes
async function collectProcesses() {
  let processes = [];
  const now = new Date();
  
  try {
    // Get list of all processes
    const procList = await si.processes();
    logger.info(`Found ${procList.list.length} processes`);
    
    // Collect network connections to match with processes
    const netConnections = await si.networkConnections();
    
    // Process each process (skip inaccessible ones)
    for (const proc of procList.list) {
      try {
        // Basic process telemetry structure
        const telemetry = {
          // Endpoint identification
          hostname: config.hostname,
          endpoint_id: config.endpointId,
          os_type: mapOsTypeToEnum(config.osType),
          os_version: config.osVersion,
          ip_address: config.ipAddress,
          domain: config.domain,
          timestamp: now,
          collector_version: config.collectorVersion,
          
          // Process info
          pid: proc.pid,
          ppid: proc.parentPid || 0,
          name: proc.name,
          exe_path: proc.path || '',
          cmdline: proc.command || '',
          user: proc.user || '',
          start_time: new Date(now.getTime() - (proc.elapsed * 1000)), // Approximate
          runtime_secs: proc.elapsed || 0,
          
          // Resource usage
          rss: proc.memRss || 0,
          vms: proc.memVsz || 0,
          cpu_percent: proc.cpu || 0,
          num_threads: proc.threads || 0,
          status: proc.state || '',
          exe_hash: '',
          exe_signature_valid: 0,
          exe_signer: '',
          exe_mismatch: 0,
          
          // Memory characteristics
          mapped_files_count: 0,
          anonymous_mem_size: 0,
          rwx_segments_count: 0,
          
          // OS-specific fields
          integrity_level: '',
          session_id: 0,
          is_service: 0,
          service_name: '',
          vad_count: 0,
          remote_mem_operations: 0,
          token_manipulation: 0,
          credential_access: 0,
          
          cgroup: '',
          capabilities: [],
          namespaces: [],
          container_id: '',
          
          // File system activity
          file_writes: 0,
          file_reads: 0,
          sensitive_file_access: [],
          
          // Network activity
          listening_ports: [],
          conn_count: 0,
          dns_queries: [],
          outbound_bytes: 0,
          inbound_bytes: 0,
          remote_ips: [],
          
          // Windows registry
          registry_writes: 0,
          registry_persistence_access: 0,
          registry_keys_modified: [],
          
          // Script execution
          script_execution: 0,
          script_type: '',
          script_content_hash: '',
          obfuscated_script: 0,
          
          // Tasks and services
          task_created: 0,
          service_created: 0,
          task_name: '',
          
          // Auth and login
          logon_type: 0,
          
          // Child process info
          child_processes: [],
          
          // Module loading
          loaded_modules: [],
          loaded_module_count: 0
        };
        
        // Calculate executable hash if file exists
        if (telemetry.exe_path && fs.existsSync(telemetry.exe_path)) {
          try {
            telemetry.exe_hash = await calculateFileHash(telemetry.exe_path);
            
            // Check if exe name matches path
            const baseName = path.basename(telemetry.exe_path);
            if (baseName.toLowerCase() !== telemetry.name.toLowerCase() && 
                !baseName.toLowerCase().startsWith(telemetry.name.toLowerCase())) {
              telemetry.exe_mismatch = 1;
            }
          } catch (error) {
            // Ignore file access errors
          }
        }
        
        // Check for script execution based on process name
        const scriptProcesses = [
          { name: 'powershell', type: 'powershell' },
          { name: 'pwsh', type: 'powershell' },
          { name: 'python', type: 'python' },
          { name: 'python3', type: 'python' },
          { name: 'bash', type: 'bash' },
          { name: 'sh', type: 'bash' },
          { name: 'perl', type: 'perl' },
          { name: 'ruby', type: 'ruby' },
          { name: 'node', type: 'javascript' },
          { name: 'nodejs', type: 'javascript' }
        ];
        
        for (const scriptProc of scriptProcesses) {
          if (telemetry.name.toLowerCase().includes(scriptProc.name)) {
            telemetry.script_execution = 1;
            telemetry.script_type = scriptProc.type;
            
            // Basic obfuscation detection
            if (telemetry.cmdline.includes('base64') || 
                telemetry.cmdline.includes('encode') || 
                telemetry.cmdline.includes('-e ') || 
                telemetry.cmdline.includes('-enc') || 
                telemetry.cmdline.includes('frombase64string')) {
              telemetry.obfuscated_script = 1;
            }
            break;
          }
        }
        
        // OS-specific info collection
        if (config.osType === 'win32') {
          collectWindowsSpecificInfo(telemetry);
        } else if (config.osType === 'linux') {
          collectLinuxSpecificInfo(telemetry);
        } else if (config.osType === 'darwin') {
          collectMacOSSpecificInfo(telemetry);
        }
        
        // Collect network connections for this process
        collectNetworkInfo(telemetry, netConnections);
        
        // Calculate memory heuristics
        telemetry.anonymous_mem_size = telemetry.vms - telemetry.rss;
        
        // Add to collection
        processes.push(telemetry);
      } catch (procError) {
        logger.debug(`Error collecting data for process ${proc.pid}: ${procError.message}`);
        // Skip this process and continue with others
      }
    }
    
    return processes;
  } catch (error) {
    logger.error(`Error collecting processes: ${error.message}`);
    return [];
  }
}

// OS-specific collectors
function collectWindowsSpecificInfo(telemetry) {
  // Check if it's a service (crude detection)
  if (telemetry.exe_path.toLowerCase().includes('\\system32\\') && 
      !telemetry.exe_path.toLowerCase().includes('\\system32\\windowsapps\\')) {
    if (telemetry.user.toLowerCase().includes('system') || 
        telemetry.user.toLowerCase().includes('local service')) {
      telemetry.is_service = 1;
      // Extract service name
      let serviceName = telemetry.name;
      if (serviceName.toLowerCase().endsWith('.exe')) {
        serviceName = serviceName.slice(0, -4);
      }
      telemetry.service_name = serviceName;
    }
  }

  // Detect task creation (looking for schtasks.exe)
  if (telemetry.name.toLowerCase() === 'schtasks.exe' && telemetry.cmdline.includes('/create')) {
    telemetry.task_created = 1;
    // Extract task name (crude implementation)
    const tnMatch = telemetry.cmdline.match(/\/tn\s+(\S+)/i);
    if (tnMatch && tnMatch[1]) {
      telemetry.task_name = tnMatch[1].replace(/["']/g, '');
    }
  }

  // Detect service creation (sc.exe)
  if (telemetry.name.toLowerCase() === 'sc.exe' && telemetry.cmdline.includes('create')) {
    telemetry.service_created = 1;
  }

  // Detect registry writes
  if (telemetry.name.toLowerCase() === 'reg.exe' && telemetry.cmdline.includes('add')) {
    telemetry.registry_writes = 1;
    
    // Check for persistence-related registry keys
    if (telemetry.cmdline.includes('\\Run') || 
        telemetry.cmdline.includes('\\RunOnce') || 
        telemetry.cmdline.includes('CurrentVersion\\Windows')) {
      telemetry.registry_persistence_access = 1;
      
      // Extract registry key
      const addMatch = telemetry.cmdline.match(/add\s+(\S+)/i);
      if (addMatch && addMatch[1]) {
        const key = addMatch[1].replace(/["']/g, '');
        telemetry.registry_keys_modified.push(key);
      }
    }
  }

  // Check for sensitive file access
  const sensitiveFiles = ['SAM', 'NTDS.dit', 'SECURITY'];
  for (const file of sensitiveFiles) {
    if (telemetry.cmdline.includes(file)) {
      telemetry.sensitive_file_access.push(file);
    }
  }

  // Credential access detection (simplistic)
  if (telemetry.name.toLowerCase() === 'mimikatz.exe' || 
      telemetry.cmdline.includes('sekurlsa') || 
      telemetry.cmdline.includes('logonPasswords') || 
      (telemetry.name.toLowerCase() === 'procdump.exe' && telemetry.cmdline.includes('lsass'))) {
    telemetry.credential_access = 1;
  }
}

function collectLinuxSpecificInfo(telemetry) {
  // In a real implementation, we'd read from /proc/<pid>/ files
  // For this reference implementation, we'll include placeholder logic
  
  try {
    // Try to get cgroup info if available
    const cgroupPath = `/proc/${telemetry.pid}/cgroup`;
    if (fs.existsSync(cgroupPath)) {
      const cgroups = fs.readFileSync(cgroupPath, 'utf8').split('\n');
      if (cgroups.length > 0) {
        telemetry.cgroup = cgroups[0];
        
        // Try to detect container ID from cgroup
        for (const cg of cgroups) {
          if (cg.includes('docker') || cg.includes('container')) {
            const parts = cg.split('/');
            if (parts.length > 0) {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.length > 8) {
                telemetry.container_id = lastPart;
                break;
              }
            }
          }
        }
      }
    }
    
    // Check namespaces
    const nsDir = `/proc/${telemetry.pid}/ns`;
    if (fs.existsSync(nsDir)) {
      try {
        const entries = fs.readdirSync(nsDir);
        telemetry.namespaces = entries;
      } catch (error) {
        // Ignore access errors
      }
    }
    
    // Basic capabilities check for root processes
    if (telemetry.user === 'root') {
      telemetry.capabilities.push('CAP_SYS_ADMIN');
      if (telemetry.name === 'tcpdump' || telemetry.name === 'wireshark') {
        telemetry.capabilities.push('CAP_NET_RAW');
      }
    }
    
    // Check for sensitive file access
    const sensitiveFiles = ['/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/ssh'];
    for (const file of sensitiveFiles) {
      if (telemetry.cmdline.includes(file)) {
        telemetry.sensitive_file_access.push(file);
      }
    }
    
    // Check for task creation (cron)
    if (telemetry.name === 'crontab' || telemetry.cmdline.includes('/etc/cron')) {
      telemetry.task_created = 1;
      telemetry.task_name = 'cron job';
    }
    
    // Check for service creation (systemd)
    if (telemetry.name === 'systemctl' && telemetry.cmdline.includes('enable')) {
      telemetry.service_created = 1;
    }
  } catch (error) {
    // Ignore errors in Linux-specific collection
  }
}

function collectMacOSSpecificInfo(telemetry) {
  // MacOS-specific collection would go here
  // For now, we'll include a minimal implementation
  
  // Check for sensitive file access
  const sensitiveFiles = ['/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/ssh'];
  for (const file of sensitiveFiles) {
    if (telemetry.cmdline.includes(file)) {
      telemetry.sensitive_file_access.push(file);
    }
  }
  
  // Check for task creation (launchd)
  if (telemetry.cmdline.includes('launchctl') && 
      (telemetry.cmdline.includes('load') || telemetry.cmdline.includes('submit'))) {
    telemetry.task_created = 1;
    telemetry.task_name = 'launchd job';
  }
}

// Collect network information for a process
function collectNetworkInfo(telemetry, netConnections) {
  // Filter connections for this process
  const processConnections = netConnections.filter(conn => conn.pid === telemetry.pid);
  
  // Count connections
  telemetry.conn_count = processConnections.length;
  
  // Extract listening ports and remote IPs
  for (const conn of processConnections) {
    if (conn.state === 'LISTEN') {
      const port = parseInt(conn.localPort, 10);
      if (!isNaN(port) && !telemetry.listening_ports.includes(port)) {
        telemetry.listening_ports.push(port);
      }
    }
    
    if (conn.state === 'ESTABLISHED' && 
        conn.peerAddress !== '0.0.0.0' && 
        conn.peerAddress !== '127.0.0.1' && 
        conn.peerAddress !== '::1') {
      if (!telemetry.remote_ips.includes(conn.peerAddress)) {
        telemetry.remote_ips.push(conn.peerAddress);
      }
      
      // Simplified traffic estimation
      telemetry.outbound_bytes += 1024; // Placeholder
      telemetry.inbound_bytes += 2048;  // Placeholder
    }
  }
}

// Upload telemetry data to ClickHouse
async function uploadTelemetry(processes) {
  if (processes.length === 0) {
    return;
  }
  
  try {
    // Format data for ClickHouse insertion
    const rows = processes.map(p => formatProcessForClickHouse(p));
    
    // Insert into ClickHouse
    const query = `INSERT INTO ${config.clickhouse.database}.endpoint_process_telemetry`;
    await clickhouse.insert(query, rows).toPromise();
    
    logger.info(`Successfully uploaded ${processes.length} process records`);
  } catch (error) {
    logger.error(`Failed to upload telemetry: ${error.message}`);
  }
}

// Format process data for ClickHouse
function formatProcessForClickHouse(proc) {
  // Convert timestamps to ClickHouse format
  const timestamp = formatDate(proc.timestamp);
  const startTime = formatDate(proc.start_time);
  
  // Handle arrays properly
  const capabilities = proc.capabilities || [];
  const namespaces = proc.namespaces || [];
  const sensitiveFileAccess = proc.sensitive_file_access || [];
  const listeningPorts = proc.listening_ports || [];
  const dnsQueries = proc.dns_queries || [];
  const remoteIps = proc.remote_ips || [];
  const registryKeysModified = proc.registry_keys_modified || [];
  const childProcesses = proc.child_processes || [];
  const loadedModules = proc.loaded_modules || [];
  
  return {
    hostname: proc.hostname,
    endpoint_id: proc.endpoint_id,
    os_type: proc.os_type,
    os_version: proc.os_version,
    ip_address: proc.ip_address,
    domain: proc.domain,
    timestamp,
    collector_version: proc.collector_version,
    pid: proc.pid,
    ppid: proc.ppid,
    name: proc.name,
    exe_path: proc.exe_path,
    cmdline: proc.cmdline,
    user: proc.user,
    start_time: startTime,
    runtime_secs: proc.runtime_secs,
    rss: proc.rss,
    vms: proc.vms,
    cpu_percent: proc.cpu_percent,
    num_threads: proc.num_threads,
    status: proc.status,
    exe_hash: proc.exe_hash,
    exe_signature_valid: proc.exe_signature_valid,
    exe_signer: proc.exe_signer,
    exe_mismatch: proc.exe_mismatch,
    mapped_files_count: proc.mapped_files_count,
    anonymous_mem_size: proc.anonymous_mem_size,
    rwx_segments_count: proc.rwx_segments_count,
    integrity_level: proc.integrity_level,
    session_id: proc.session_id,
    is_service: proc.is_service,
    service_name: proc.service_name,
    vad_count: proc.vad_count,
    remote_mem_operations: proc.remote_mem_operations,
    token_manipulation: proc.token_manipulation,
    credential_access: proc.credential_access,
    cgroup: proc.cgroup,
    capabilities: capabilities,
    namespaces: namespaces,
    container_id: proc.container_id,
    file_writes: proc.file_writes,
    file_reads: proc.file_reads,
    sensitive_file_access: sensitiveFileAccess,
    listening_ports: listeningPorts,
    conn_count: proc.conn_count,
    dns_queries: dnsQueries,
    outbound_bytes: proc.outbound_bytes,
    inbound_bytes: proc.inbound_bytes,
    remote_ips: remoteIps,
    registry_writes: proc.registry_writes,
    registry_persistence_access: proc.registry_persistence_access,
    registry_keys_modified: registryKeysModified,
    script_execution: proc.script_execution,
    script_type: proc.script_type,
    script_content_hash: proc.script_content_hash,
    obfuscated_script: proc.obfuscated_script,
    task_created: proc.task_created,
    service_created: proc.service_created,
    task_name: proc.task_name,
    logon_type: proc.logon_type,
    child_processes: childProcesses,
    loaded_modules: loadedModules,
    loaded_module_count: proc.loaded_module_count
  };
}

// Helper functions

// Get the primary IP address
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Calculate SHA-256 hash of a file
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch (error) {
      reject(error);
    }
  });
}

// Map OS type to enum value for ClickHouse
function mapOsTypeToEnum(osType) {
  switch (osType.toLowerCase()) {
    case 'win32':
      return 1; // Windows
    case 'linux':
      return 2; // Linux
    case 'darwin':
      return 3; // MacOS
    default:
      return 4; // Other
  }
}

// Format date for ClickHouse
function formatDate(date) {
  return date.toISOString().replace('T', ' ').substr(0, 19);
}

// Execute a command and return its output
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Start the agent
main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

