CREATE TABLE IF NOT EXISTS default.endpoint_process_telemetry (
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
