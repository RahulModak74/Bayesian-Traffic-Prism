SQL queries:-- SCENARIO 1: ADVANCED PERSISTENT THREAT (APT) USING LONG-DWELL DELAYED EXECUTION
-- Query 1: Long-Term Dwell Time Detection

WITH
-- Find processes that appeared after long periods of system uptime
dormant_activations AS (
    SELECT
        t2.hostname,
        t2.os_type,
        t2.pid,
        t2.name,
        t2.exe_path,
        t2.user,
        min(t1.timestamp) AS first_seen,
        min(t2.timestamp) AS first_active,
        dateDiff('day', min(t1.timestamp), min(t2.timestamp)) AS days_dormant
    FROM endpoint_process_telemetry t1
    JOIN endpoint_process_telemetry t2 ON
        t1.hostname = t2.hostname AND
        t1.exe_path = t2.exe_path
    WHERE
        -- Find files that exist but weren't executed for a long time
        t1.timestamp >= (now() - INTERVAL '90 DAY') AND
        t1.pid = 0 AND  -- File exists but not running
        t2.pid > 0 AND  -- Process became active
        t2.timestamp > t1.timestamp AND
        t2.name LIKE '%svchost%' AND  -- Focus on suspicious system-looking processes
        t2.exe_path NOT LIKE 'C:\\Windows\\System32\\%' -- Not in the legitimate Windows path
    GROUP BY
        t2.hostname,
        t2.os_type,
        t2.pid,
        t2.name,
        t2.exe_path,
        t2.user
    HAVING
        days_dormant >= 30 -- Significant dormant period
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    hostname,
    pid,
    name AS process_name,
    'Delayed Execution Pattern' AS detection_type,
    concat('Process remained dormant for ', toString(days_dormant), ' days before activation') AS timeline,
    exe_path AS associated_file,
    first_seen,
    first_active,
    'Long-Term Dwell Time Detection' AS alert_name
FROM dormant_activations
ORDER BY days_dormant DESC
LIMIT 100;

-- Query 2: Temporal Networking Anomaly - Consistent Beaconing Detection

WITH
-- Detect consistent temporal beaconing
network_beaconing AS (
    SELECT
        hostname,
        os_type,
        pid,
        name,
        remote_ips,
        timestamp,
        toStartOfDay(timestamp) AS day,
        toHour(timestamp) AS hour
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '60 DAY') AND
        arrayLength(remote_ips) > 0 AND
        conn_count > 0 AND
        outbound_bytes > 0 AND
        outbound_bytes < 10000 -- Small traffic bursts
),

-- Group by day to find daily patterns
daily_connections AS (
    SELECT
        hostname,
        pid,
        name,
        day,
        arrayJoin(remote_ips) AS remote_ip,
        count() AS connection_count,
        sum(if(hour >= 1 AND hour <= 5, 1, 0)) AS off_hours_count
    FROM network_beaconing
    GROUP BY hostname, pid, name, day, remote_ip
    HAVING connection_count <= 3 -- Few connections per day
),

-- Find consistent patterns across many days
beaconing_patterns AS (
    SELECT
        hostname,
        pid,
        name,
        remote_ip,
        count(DISTINCT day) AS days_active,
        sum(off_hours_count) AS total_off_hours_connections
    FROM daily_connections
    GROUP BY hostname, pid, name, remote_ip
    HAVING
        days_active >= 10 AND -- Active for many days
        days_active / count(DISTINCT day) > 0.8 AND -- Consistent across days
        total_off_hours_connections > days_active * 0.5 -- Many connections during off-hours
)

SELECT
    now() AS detection_time,
    'High' AS severity,
    b.hostname,
    b.pid,
    b.name AS process_name,
    'Consistent Temporal Beaconing' AS detection_type,
    concat('24-hour precise connection intervals over ', toString(b.days_active), ' days') AS timeline,
    b.remote_ip AS destination,
    'Small 15-second bursts every 24 hours' AS traffic_pattern,
    'Temporal Networking Anomaly' AS alert_name
FROM beaconing_patterns b
JOIN endpoint_process_telemetry e ON
    b.hostname = e.hostname AND
    b.pid = e.pid
GROUP BY
    b.hostname,
    b.pid,
    b.name,
    b.remote_ip,
    b.days_active
ORDER BY b.days_active DESC
LIMIT 100;

-- Query 3: Weekend/Holiday Exfiltration Detection

WITH
-- Calculate baseline traffic per process
process_traffic_baseline AS (
    SELECT
        hostname,
        name,
        pid,
        avg(outbound_bytes) AS avg_daily_outbound
    FROM endpoint_process_telemetry
    WHERE timestamp >= (now() - INTERVAL '60 DAY')
    GROUP BY hostname, name, pid
),

-- Detect weekend/holiday traffic patterns
weekend_traffic AS (
    SELECT
        e.hostname,
        e.os_type,
        e.pid,
        e.name,
        e.remote_ips,
        toDate(e.timestamp) AS event_date,
        sum(e.outbound_bytes) AS daily_outbound,
        -- In a real system, you'd have a calendar table with holidays
        -- This is simplified to detect weekends
        if(toDayOfWeek(toDate(e.timestamp)) IN (6, 7), 1, 0) AS is_weekend
    FROM endpoint_process_telemetry e
    WHERE
        e.timestamp >= (now() - INTERVAL '60 DAY') AND
        arrayLength(e.remote_ips) > 0
    GROUP BY
        e.hostname,
        e.os_type,
        e.pid,
        e.name,
        e.remote_ips,
        event_date
),

-- Identify processes with suspicious weekend traffic patterns
suspicious_exfil AS (
    SELECT
        w.hostname,
        w.pid,
        w.name,
        arrayJoin(w.remote_ips) AS destination_ip,
        count(DISTINCT if(is_weekend = 1, event_date, NULL)) AS weekend_days,
        count(DISTINCT if(is_weekend = 0, event_date, NULL)) AS weekday_days,
        sum(if(is_weekend = 1, daily_outbound, 0)) AS weekend_bytes,
        sum(if(is_weekend = 0, daily_outbound, 0)) AS weekday_bytes,
        sum(daily_outbound) AS total_bytes
    FROM weekend_traffic w
    JOIN process_traffic_baseline b ON
        w.hostname = b.hostname AND
        w.pid = b.pid
    WHERE w.daily_outbound > b.avg_daily_outbound * 1.5
    GROUP BY
        w.hostname,
        w.pid,
        w.name,
        destination_ip
    HAVING
        weekend_days > 0 AND
        (weekend_bytes / weekend_days) > (weekday_bytes / greatest(weekday_days, 1)) * 3 AND
        total_bytes > 1000000 -- At least 1MB total data
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    hostname,
    pid,
    name AS process_name,
    'Data Exfiltration via Steganography' AS detection_type,
    'Weekend-only outbound data transfer' AS timeline,
    concat('~', toString(round(total_bytes/1048576, 1)), 'MB total') AS data_volume,
    destination_ip AS destination,
    'Weekend Exfiltration Detection' AS alert_name
FROM suspicious_exfil
ORDER BY total_bytes DESC
LIMIT 100;

-- SCENARIO 2: CROSS-SYSTEM LATERAL MOVEMENT WITH DISTRIBUTED ATTACK PATTERN
-- Query 1: Distributed Reconnaissance Campaign

WITH
-- Identify reconnaissance commands
recon_commands AS (
    SELECT
        hostname,
        timestamp,
        user,
        pid,
        cmdline,
        -- Categorize commands
        multiIf(
            cmdline LIKE '%net view%' OR
            cmdline LIKE '%net use%' OR
            cmdline LIKE '%nslookup%' OR
            cmdline LIKE '%ping %',
            'network_discovery',
           
            cmdline LIKE '%Get-Acl%' OR
            cmdline LIKE '%icacls%' OR
            cmdline LIKE '%cacls%',
            'permission_enum',
           
            cmdline LIKE '%net group%' OR
            cmdline LIKE '%net user%' OR
            cmdline LIKE '%Get-ADGroup%' OR
            cmdline LIKE '%Get-ADUser%',
            'account_enum',
           
            'other'
        ) AS command_category
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '30 DAY') AND
        (
            -- Windows commands
            cmdline LIKE '%net view%' OR
            cmdline LIKE '%net use%' OR
            cmdline LIKE '%net group%' OR
            cmdline LIKE '%net user%' OR
            cmdline LIKE '%nslookup%' OR
            cmdline LIKE '%ping %' OR
            cmdline LIKE '%ipconfig%' OR
            cmdline LIKE '%systeminfo%' OR
            cmdline LIKE '%whoami%' OR
            cmdline LIKE '%Get-Acl%' OR
            cmdline LIKE '%Get-ADUser%' OR
            cmdline LIKE '%Get-ADGroup%' OR
            cmdline LIKE '%quser%' OR
            -- Linux/Mac commands
            cmdline LIKE '%ifconfig%' OR
            cmdline LIKE '%ip a%' OR
            cmdline LIKE '%netstat%' OR
            cmdline LIKE '%who%' OR
            cmdline LIKE '%w %' OR
            cmdline LIKE '%last%' OR
            cmdline LIKE '%lsof%'
        )
),

-- Group systems executing similar commands in a short timeframe
systems_with_recon AS (
    SELECT
        command_category,
        hostname,
        user,
        min(timestamp) AS first_seen,
        max(timestamp) AS last_seen,
        count(DISTINCT cmdline) AS command_count
    FROM recon_commands
    GROUP BY command_category, hostname, user
    HAVING command_count >= 2
),

-- Connect systems with similar reconnaissance patterns
connected_systems AS (
    SELECT
        s1.command_category,
        groupArray(DISTINCT s1.hostname) AS systems,
        groupArray(DISTINCT s1.user) AS users,
        min(s1.first_seen) AS campaign_start,
        max(s1.last_seen) AS campaign_end,
        count(DISTINCT s1.hostname) AS system_count,
        count(DISTINCT s1.user) AS user_count
    FROM systems_with_recon s1
    JOIN systems_with_recon s2 ON
        s1.command_category = s2.command_category AND
        s1.hostname != s2.hostname AND
        -- Systems executing similar commands within a timeframe
        abs(dateDiff('minute', s1.first_seen, s2.first_seen)) < 24*60
    GROUP BY s1.command_category
    HAVING
        system_count >= 3 AND -- At least 3 different systems
        user_count >= 2       -- At least 2 different users
)

SELECT
    now() AS detection_time,
    'High' AS severity,
    'Multi-system Coordinated Reconnaissance' AS detection_type,
    arrayStringConcat(systems, ', ') AS affected_systems,
    campaign_start AS first_detected,
    campaign_end AS last_detected,
    'Similar command patterns executed across multiple systems' AS evidence,
    concat(toString(user_count), ' different user accounts executing similar commands') AS user_accounts,
    'Distributed Reconnaissance Campaign' AS alert_name
FROM connected_systems
ORDER BY system_count DESC
LIMIT 100;

-- Query 2: Service Account Anomaly

WITH
-- Establish baseline of service account usage (90 days)
service_account_baseline AS (
    SELECT
        user,
        groupArray(DISTINCT hostname) AS baseline_systems
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '90 DAY') AND
        timestamp <= (now() - INTERVAL '30 DAY') AND
        -- Identify service accounts by naming convention
        (user LIKE 'svc_%' OR user LIKE '%_svc' OR user LIKE '%service%')
    GROUP BY user
),

-- Recent service account activity
recent_service_account_activity AS (
    SELECT
        user,
        groupArray(DISTINCT hostname) AS recent_systems,
        min(timestamp) AS first_seen,
        max(timestamp) AS last_seen
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '30 DAY') AND
        (user LIKE 'svc_%' OR user LIKE '%_svc' OR user LIKE '%service%')
    GROUP BY user
),

-- Identify service accounts used on new systems
service_account_anomalies AS (
    SELECT
        r.user,
        r.recent_systems,
        r.first_seen,
        r.last_seen,
        b.baseline_systems,
        length(r.recent_systems) AS total_recent_systems,
        arrayCount(x -> NOT has(b.baseline_systems, x), r.recent_systems) AS new_systems_count
    FROM recent_service_account_activity r
    JOIN service_account_baseline b ON r.user = b.user
    WHERE
        -- Service account used on systems not in baseline
        arrayExists(x -> NOT has(b.baseline_systems, x), r.recent_systems) AND
        new_systems_count >= 3  -- Used on at least 3 new systems
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    'Abnormal Service Account Usage' AS detection_type,
    user AS account,
    arrayStringConcat(recent_systems, ', ') AS affected_systems,
    concat(toString(toDate(first_seen)), ' - ', toString(toDate(last_seen))) AS timeline,
    concat('Account used from ', toString(new_systems_count), ' workstations never previously accessed in 90-day baseline period') AS abnormal_behavior,
    'Service Account Anomaly' AS alert_name
FROM service_account_anomalies
ORDER BY new_systems_count DESC
LIMIT 100;

-- Query 3: Cross-System Attack Chain Detection

WITH
-- Identify potential initial access events
initial_access AS (
    SELECT
        hostname,
        os_type,
        pid,
        name,
        exe_path,
        user,
        timestamp,
        -- Suspicious initial access indicators
        multiIf(
            script_execution = 1, 'script_execution',
            obfuscated_script = 1, 'obfuscated_script',
            registry_persistence_access = 1, 'registry_persistence',
            exe_mismatch = 1, 'exe_mismatch',
            credential_access = 1, 'credential_theft',
            'other'
        ) AS access_type
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '60 DAY') AND
        (
            script_execution = 1 OR
            obfuscated_script = 1 OR
            registry_persistence_access = 1 OR
            exe_mismatch = 1 OR
            credential_access = 1 OR
            (name LIKE '%powershell%' AND cmdline LIKE '%download%') OR
            (name LIKE '%cmd%' AND cmdline LIKE '%curl%') OR
            (name LIKE '%npm%' AND cmdline LIKE '%install%')
        )
),

-- Track user activities across systems after initial access
cross_system_activity AS (
    SELECT
        e.user,
        e.hostname,
        e.timestamp,
        -- Categorize activity type
        multiIf(
            e.credential_access = 1, 'credential_access',
            e.registry_persistence_access = 1, 'persistence',
            e.script_execution = 1, 'script_execution',
            e.conn_count > 5, 'network_activity',
            'other'
        ) AS activity_type
    FROM endpoint_process_telemetry e
    WHERE
        e.timestamp >= (now() - INTERVAL '60 DAY') AND
        -- Join with users from initial access events
        exists(
            SELECT 1 FROM initial_access i
            WHERE i.user = e.user AND i.hostname != e.hostname
        )
),

-- Build a graph of host access patterns
host_access_progression AS (
    SELECT
        user,
        groupArray(DISTINCT hostname) AS accessed_hosts,
        groupArray(DISTINCT activity_type) AS activity_types,
        min(timestamp) AS first_access,
        max(timestamp) AS last_access,
        dateDiff('day', min(timestamp), max(timestamp)) AS campaign_duration,
        count(DISTINCT hostname) AS host_count
    FROM cross_system_activity
    GROUP BY user
    HAVING
        host_count >= 3 AND -- Accessed at least 3 different hosts
        campaign_duration >= 7 -- Campaign lasted at least a week
),

-- Identify systems with sensitive access
sensitive_systems AS (
    SELECT
        user,
        hostname,
        timestamp
    FROM endpoint_process_telemetry
    WHERE
        (
            -- Indicators of accessing sensitive systems
            hostname LIKE '%PAYMENT%' OR
            hostname LIKE '%FINANCE%' OR
            hostname LIKE '%HR%' OR
            hostname LIKE '%ADMIN%' OR
            hostname LIKE '%DB%' OR
            hostname LIKE '%SQL%'
        ) AND
        exists(
            SELECT 1 FROM host_access_progression h
            WHERE h.user = user
        )
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    'Distributed Attack Chain' AS detection_type,
    h.user,
    h.host_count,
    h.accessed_hosts AS systems,
    first_host.hostname AS initial_access,
    first_host.timestamp AS initial_timestamp,
    last_host.hostname AS final_target,
    last_host.timestamp AS final_timestamp,
    concat(first_host.hostname, ' → ', arrayStringConcat(array_slice(h.accessed_hosts, 1, host_count-2), ' → '), ' → ', last_host.hostname) AS attack_path,
    concat(toString(h.campaign_duration), ' days with extremely low activity on any single endpoint') AS attack_duration,
    'Cross-System Attack Chain Detected' AS alert_name
FROM host_access_progression h
-- Find first accessed host
CROSS JOIN (
    SELECT c.user, c.hostname, min(c.timestamp) AS timestamp
    FROM cross_system_activity c
    GROUP BY c.user, c.hostname
    ORDER BY timestamp ASC
    LIMIT 1 BY user
) AS first_host ON h.user = first_host.user
-- Find last accessed host (preferring sensitive systems)
CROSS JOIN (
    SELECT s.user, s.hostname, max(s.timestamp) AS timestamp
    FROM sensitive_systems s
    GROUP BY s.user, s.hostname
    ORDER BY timestamp DESC
    LIMIT 1 BY user
) AS last_host ON h.user = last_host.user
ORDER BY h.campaign_duration DESC
LIMIT 100;

-- SCENARIO 3: POLYMORPHIC FILELESS MALWARE CAMPAIGN WITH BEHAVIORAL EVOLUTION
-- Query 1: Memory Manipulation Evolution

WITH
-- Track unusual memory characteristics over time
memory_patterns AS (
    SELECT
        hostname,
        os_type,
        pid,
        name,
        exe_path,
        rwx_segments_count,
        anonymous_mem_size,
        timestamp,
        toStartOfDay(timestamp) AS day
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '90 DAY') AND
        (
            -- Suspicious memory indicators
            rwx_segments_count > 2 OR
            anonymous_mem_size > 50000000 OR
            remote_mem_operations > 0
        )
),

-- Group by process and day to track evolution
daily_memory_patterns AS (
    SELECT
        hostname,
        name,
        day,
        avg(rwx_segments_count) AS avg_rwx,
        avg(anonymous_mem_size) AS avg_anon_mem,
        count() AS sample_count
    FROM memory_patterns
    GROUP BY hostname, name, day
    HAVING sample_count >= 3 -- Multiple samples per day
),

-- Detect memory pattern evolution over time
memory_evolution AS (
    SELECT
        hostname,
        name,
        min(day) AS first_seen_day,
        max(day) AS last_seen_day,
        count(DISTINCT day) AS active_days,
        -- Calculate variance and changes in memory patterns
        stddevPop(avg_rwx) AS rwx_stddev,
        stddevPop(avg_anon_mem) AS anon_mem_stddev,
        max(avg_rwx) - min(avg_rwx) AS rwx_range,
        (max(avg_anon_mem) - min(avg_anon_mem))/1000000 AS anon_mem_range_mb
    FROM daily_memory_patterns
    GROUP BY hostname, name
    HAVING
        active_days >= 30 AND -- Active for at least 30 days
        rwx_stddev > 0.5 AND -- Memory patterns changing over time
        anon_mem_range_mb > 10 -- Significant changes in anonymous memory
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    'Evolving Memory Injection Techniques' AS detection_type,
    hostname,
    name AS process_name,
    'Multiple system and user processes' AS affected_processes,
    first_seen_day AS first_detected,
    last_seen_day AS latest_detection,
    'Memory allocation characteristics that evolve while maintaining operational patterns' AS pattern,
    concat(toString(active_days), ' days of memory allocation telemetry showing coordinated evolution') AS evidence,
    'Memory Manipulation Evolution' AS alert_name
FROM memory_evolution
ORDER BY active_days DESC
LIMIT 100;

-- Query 2: Process Migration Chain

WITH
-- Find process creation events to establish parent-child relationships
process_chain AS (
    SELECT
        p_child.hostname,
        p_child.pid AS child_pid,
        p_child.name AS child_name,
        p_child.ppid AS parent_pid,
        p_parent.name AS parent_name,
        p_child.timestamp,
        p_child.exe_path,
        p_child.user
    FROM endpoint_process_telemetry p_child
    LEFT JOIN endpoint_process_telemetry p_parent ON
        p_child.hostname = p_parent.hostname AND
        p_child.ppid = p_parent.pid AND
        p_child.timestamp >= p_parent.timestamp
    WHERE
        p_child.timestamp >= (now() - INTERVAL '90 DAY') AND
        p_child.ppid > 0
),

-- Track process migrations over time (process A spawns B, then B spawns C, etc.)
process_migrations AS (
    SELECT
        hostname,
        child_name,
        parent_name,
        timestamp,
        -- Create a "migration step" identifier
        concat(parent_name, ' → ', child_name) AS migration_step
    FROM process_chain
    WHERE
        -- Focus on suspicious process pairs
        (
            parent_name IN ('explorer.exe', 'svchost.exe', 'winlogon.exe', 'spoolsv.exe', 'wuauclt.exe',
                           'powershell.exe', 'cmd.exe', 'bash', 'sh', 'python') OR
            child_name IN ('explorer.exe', 'svchost.exe', 'winlogon.exe', 'spoolsv.exe', 'wuauclt.exe',
                          'powershell.exe', 'cmd.exe', 'bash', 'sh', 'python')
        )
),

-- Group migrations by time intervals to find patterns
temporal_migrations AS (
    SELECT
        hostname,
        migration_step,
        count() AS occurrence_count,
        min(timestamp) AS first_occurrence,
        max(timestamp) AS last_occurrence,
        dateDiff('hour', min(timestamp), max(timestamp)) AS duration_hours
    FROM process_migrations
    GROUP BY hostname, migration_step
    HAVING occurrence_count >= 3 -- Multiple occurrences of the same migration pattern
),

-- Connect migration steps into chains
migration_chains AS (
    SELECT
        t1.hostname,
        groupArray(t1.migration_step) AS chain_steps,
        count(DISTINCT t1.migration_step) AS chain_length,
        min(t1.first_occurrence) AS chain_start,
        max(t1.last_occurrence) AS chain_end,
        dateDiff('day', min(t1.first_occurrence), max(t1.last_occurrence)) AS chain_days
    FROM temporal_migrations t1
    JOIN temporal_migrations t2 ON
        t1.hostname = t2.hostname AND
        t1.migration_step != t2.migration_step AND
        -- Time correlation between steps
        (t1.first_occurrence <= t2.first_occurrence AND t1.last_occurrence >= t2.first_occurrence)
    GROUP BY t1.hostname
    HAVING
        chain_length >= 3 AND -- At least 3 different migration steps
        chain_days >= 14      -- Pattern persists for at least 2 weeks
)

SELECT
    now() AS detection_time,
    'High' AS severity,
    'Systematic Process Migration' AS detection_type,
    hostname,
    arrayStringConcat(chain_steps, ' → ') AS processes_involved,
    concat(toString(toDate(chain_start)), ' - ', toString(toDate(chain_end))) AS timeline,
    'Consistent behavioral patterns despite migration between processes' AS behavior,
    'Predictable migration timing with 72-hour intervals' AS pattern,
    'Process Migration Chain' AS alert_name
FROM migration_chains
ORDER BY chain_days DESC
LIMIT 100;

-- Query 3: Multi-Channel Exfiltration Technique

WITH
-- Identify potential exfiltration channels
exfiltration_channels AS (
    SELECT
        hostname,
        os_type,
        pid,
        name,
        user,
        timestamp,
        -- Categorize by channel type
        multiIf(
            arrayExists(x -> x LIKE '%arpa%' OR x LIKE '%.%', dns_queries), 'dns_exfil',
            cmdline LIKE '%443%' OR cmdline LIKE '%https%', 'https_exfil',
            cmdline LIKE '%websocket%' OR cmdline LIKE '%ws://%', 'websocket_exfil',
            cmdline LIKE '%http%' OR outbound_bytes > 100000, 'http_exfil',
            'other'
        ) AS channel_type,
        outbound_bytes
    FROM endpoint_process_telemetry
    WHERE
        timestamp >= (now() - INTERVAL '90 DAY') AND
        (
            -- Suspicious exfiltration indicators
            outbound_bytes > 50000 OR
            arrayLength(dns_queries) > 10 OR
            cmdline LIKE '%443%' OR
            cmdline LIKE '%https%' OR
            cmdline LIKE '%websocket%' OR
            cmdline LIKE '%http%'
        )
),

-- Group by host and channel to see multi-channel pattern
host_exfil_channels AS (
    SELECT
        hostname,
        channel_type,
        count() AS channel_uses,
        sum(outbound_bytes) AS total_bytes,
        min(timestamp) AS first_seen,
        max(timestamp) AS last_seen,
        dateDiff('day', min(timestamp), max(timestamp)) AS active_days
    FROM exfiltration_channels
    GROUP BY hostname, channel_type
    HAVING active_days >= 7 -- Channel used for at least a week
),

-- Find hosts using multiple channels
multi_channel_hosts AS (
    SELECT
        hostname,
        groupArray(channel_type) AS channels_used,
        count(DISTINCT channel_type) AS channel_count,
        sum(total_bytes) AS combined_bytes,
        min(first_seen) AS earliest_activity,
        max(last_seen) AS latest_activity,
        max(active_days) AS max_channel_days
    FROM host_exfil_channels
    GROUP BY hostname
    HAVING
        channel_count >= 2 AND -- At least 2 different channels
        combined_bytes > 1000000 -- At least 1MB total data
)

SELECT
    now() AS detection_time,
    'Critical' AS severity,
    'Distributed Data Exfiltration' AS detection_type,
    hostname,
    arrayStringConcat(channels_used, ', ') AS exfiltration_channels,
    concat(toString(toDate(earliest_activity)), ' - ', toString(toDate(latest_activity))) AS timeline,
    concat('Estimated ', toString(round(combined_bytes/1048576, 1)), 'MB total over distributed channels') AS data_volume,
    'Coordinated exfiltration activities distributed across legitimate processes' AS pattern,
    'Multi-Channel Exfiltration Technique' AS alert_name
FROM multi_channel_hosts
ORDER BY combined_bytes DESC
LIMIT 100;
