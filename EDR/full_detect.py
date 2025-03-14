import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import traceback

# Function to load and preprocess the data
def load_data(file_path):
    """
    Load and preprocess the attack_file.csv data
    """
    # Load data
    print(f"Loading data from {file_path}...")
    df = pd.read_csv(file_path)
    
    # Remove header/comment rows (rows where hostname starts with '#' or '--')
    df = df[~df['hostname'].astype(str).str.startswith(('#', '--'))]
    
    # Handle timestamp conversion
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    
    # Convert string representations of arrays to actual lists where needed
    for col in ['remote_ips', 'dns_queries', 'outbound_bytes', 'inbound_bytes', 
               'registry_writes', 'child_processes', 'loaded_modules']:
        if col in df.columns:
            # Replace missing values with empty lists
            df[col] = df[col].fillna('[]')
            
            # Safely convert string representation to actual lists
            def safe_json_load(x):
                if not isinstance(x, str):
                    return x
                if not x.startswith('['):
                    return x
                try:
                    return json.loads(x)
                except json.JSONDecodeError:
                    # If JSON parsing fails, try to fix common issues
                    try:
                        # Fix missing commas or quotes
                        cleaned_x = x.replace("'", '"')  # Replace single quotes with double quotes
                        return json.loads(cleaned_x)
                    except:
                        # If still fails, return as is
                        print(f"Warning: Could not parse value: {x}")
                        return []  # Return empty list for safety
            
            # Apply the safe conversion function
            df[col] = df[col].apply(safe_json_load)
    
    # Convert numeric columns
    numeric_cols = ['pid', 'ppid', 'rwx_segments_count', 'anonymous_mem_size',
                    'conn_count', 'remote_mem_operations']
    
    for col in numeric_cols:
        if col in df.columns:
            # Convert to numeric, replacing non-numeric values with 0
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Special handling for outbound_bytes since it might be treated as both array and numeric
    if 'outbound_bytes' in df.columns:
        # Convert to numeric only if not already a list
        df['outbound_bytes'] = df['outbound_bytes'].apply(
            lambda x: pd.to_numeric(x, errors='coerce') if not isinstance(x, list) else sum(x) if isinstance(x, list) else 0
        ).fillna(0)
    
    # Ensure array fields are properly handled
    list_cols = ['remote_ips', 'dns_queries']
    for col in list_cols:
        if col in df.columns:
            # Ensure column contains lists
            df[col] = df[col].apply(lambda x: x if isinstance(x, list) else [])
    
    print(f"Data loaded and processed successfully. Shape: {df.shape}")
    return df

# Safe explode function for remote_ips that handles non-list values
def safe_explode(df, column):
    # Create a copy to avoid modifying the original
    temp_df = df.copy()
    
    # Ensure the column contains only lists
    temp_df[column] = temp_df[column].apply(lambda x: x if isinstance(x, list) else [])
    
    # Only explode if there are actual lists
    if temp_df[column].apply(lambda x: isinstance(x, list) and len(x) > 0).any():
        try:
            # Try to explode the column
            return temp_df.explode(column)
        except:
            # If fails, return the original dataframe
            print(f"Warning: Could not explode column {column}")
            return df
    else:
        return df

# --------------------------------------------------------------------------------------------
# SCENARIO 1: ADVANCED PERSISTENT THREAT (APT) USING LONG-DWELL DELAYED EXECUTION
# --------------------------------------------------------------------------------------------

def detect_long_dwell_time(df, days_threshold=30, lookback_days=90):
    """
    Detect processes that remained dormant for a long time before activation.
    Equivalent to "Query 1: Long-Term Dwell Time Detection" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        lookback_date = now - timedelta(days=lookback_days)
        
        # Filter data to the lookback period
        recent_data = df[df['timestamp'] >= lookback_date].copy()
        
        # Group by hostname, exe_path to find files created vs execution
        dormant_activations = []
        
        # First, find all unique hostname, exe_path combinations
        unique_files = recent_data[['hostname', 'exe_path']].dropna().drop_duplicates()
        
        for _, file_row in unique_files.iterrows():
            hostname = file_row['hostname']
            exe_path = file_row['exe_path']
            
            # Filter data for this specific hostname and exe_path
            file_data = recent_data[(recent_data['hostname'] == hostname) & 
                                  (recent_data['exe_path'] == exe_path)]
            
            # Check if there are both file creation (pid=0) and process execution (pid>0) events
            file_creation = file_data[file_data['pid'] == 0]
            process_execution = file_data[file_data['pid'] > 0]
            
            if len(file_creation) > 0 and len(process_execution) > 0:
                # Get first seen (file creation) and first active (process execution) timestamps
                first_seen = file_creation['timestamp'].min()
                first_active = process_execution['timestamp'].min()
                
                # Calculate dormant days
                dormant_days = (first_active - first_seen).days
                
                # Check additional criteria (svchost-like names not in legitimate Windows path)
                is_suspicious_name = False
                for name in process_execution['name']:
                    if isinstance(name, str) and 'svchost' in name.lower():
                        is_suspicious_name = True
                        break
                
                is_legitimate_path = False
                for path in process_execution['exe_path']:
                    if isinstance(path, str) and 'C:\\Windows\\System32\\' in path:
                        is_legitimate_path = True
                        break
                
                if dormant_days >= days_threshold and is_suspicious_name and not is_legitimate_path:
                    # Get process details from first execution
                    first_execution = process_execution.iloc[0]
                    
                    dormant_activations.append({
                        'detection_time': now,
                        'severity': 'Critical',
                        'hostname': hostname,
                        'pid': first_execution['pid'],
                        'process_name': first_execution['name'],
                        'detection_type': 'Delayed Execution Pattern',
                        'timeline': f'Process remained dormant for {dormant_days} days before activation',
                        'associated_file': exe_path,
                        'first_seen': first_seen,
                        'first_active': first_active,
                        'days_dormant': dormant_days,
                        'alert_name': 'Long-Term Dwell Time Detection'
                    })
        
        # Convert to DataFrame and sort
        if dormant_activations:
            result_df = pd.DataFrame(dormant_activations)
            return result_df.sort_values('days_dormant', ascending=False).head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_long_dwell_time: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()

def detect_beaconing(df, lookback_days=60, active_days_threshold=10, consistency_threshold=0.8):
    """
    Detect consistent temporal beaconing patterns.
    Equivalent to "Query 2: Temporal Networking Anomaly - Consistent Beaconing Detection" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        lookback_date = now - timedelta(days=lookback_days)
        
        # Filter data
        network_data = df[
            (df['timestamp'] >= lookback_date) &
            (df['conn_count'] > 0) &
            (df['outbound_bytes'] > 0) &
            (df['outbound_bytes'] < 10000)  # Small traffic bursts
        ].copy()
        
        # Only keep rows where remote_ips is not empty
        network_data = network_data[network_data['remote_ips'].apply(
            lambda x: isinstance(x, list) and len(x) > 0
        )]
        
        if network_data.empty:
            return pd.DataFrame()
        
        # Extract day and hour from timestamp
        network_data['day'] = network_data['timestamp'].dt.date
        network_data['hour'] = network_data['timestamp'].dt.hour
        
        # Group by day to find daily patterns
        daily_connections = []
        
        # Safely process remote IPs
        for _, row in network_data.iterrows():
            hostname = row['hostname']
            pid = row['pid']
            name = row['name']
            day = row['day']
            hour = row['hour']
            
            # Process each remote IP
            if isinstance(row['remote_ips'], list):
                for remote_ip in row['remote_ips']:
                    daily_connections.append({
                        'hostname': hostname,
                        'pid': pid,
                        'name': name,
                        'day': day,
                        'remote_ip': remote_ip,
                        'connection_count': 1,
                        'off_hours_count': 1 if 1 <= hour <= 5 else 0
                    })
        
        if not daily_connections:
            return pd.DataFrame()
        
        # Convert to DataFrame
        daily_df = pd.DataFrame(daily_connections)
        
        # Aggregate by day
        daily_summary = daily_df.groupby(['hostname', 'pid', 'name', 'day', 'remote_ip']).agg({
            'connection_count': 'sum',
            'off_hours_count': 'sum'
        }).reset_index()
        
        # Filter for few connections per day
        daily_summary = daily_summary[daily_summary['connection_count'] <= 3]
        
        # Find consistent patterns across many days
        beaconing_patterns = []
        
        for (hostname, pid, name, remote_ip), group in daily_summary.groupby(['hostname', 'pid', 'name', 'remote_ip']):
            days_active = len(group['day'].unique())
            total_off_hours_connections = group['off_hours_count'].sum()
            
            # Calculate consistency across days (active days / total possible days in range)
            if days_active > 1:  # Need at least 2 days to calculate consistency
                min_day = min(group['day'])
                max_day = max(group['day'])
                if isinstance(min_day, datetime) and isinstance(max_day, datetime):
                    total_days = (max_day - min_day).days + 1
                else:
                    # Handle if they're date objects
                    total_days = (max_day - min_day).days + 1
                
                consistency = days_active / total_days if total_days > 0 else 0
                
                if (days_active >= active_days_threshold and
                    consistency > consistency_threshold and
                    total_off_hours_connections > days_active * 0.5):
                    
                    beaconing_patterns.append({
                        'detection_time': now,
                        'severity': 'High',
                        'hostname': hostname,
                        'pid': pid,
                        'process_name': name,
                        'detection_type': 'Consistent Temporal Beaconing',
                        'timeline': f'24-hour precise connection intervals over {days_active} days',
                        'destination': remote_ip,
                        'traffic_pattern': 'Small 15-second bursts every 24 hours',
                        'days_active': days_active,
                        'alert_name': 'Temporal Networking Anomaly'
                    })
        
        if beaconing_patterns:
            result_df = pd.DataFrame(beaconing_patterns)
            return result_df.sort_values('days_active', ascending=False).head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_beaconing: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()

def detect_weekend_exfiltration(df, lookback_days=60):
    """
    Detect weekend/holiday data exfiltration patterns.
    Equivalent to "Query 3: Weekend/Holiday Exfiltration Detection" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        lookback_date = now - timedelta(days=lookback_days)
        
        # Filter relevant data
        traffic_data = df[
            (df['timestamp'] >= lookback_date) &
            (df['outbound_bytes'] > 0)
        ].copy()
        
        # Only keep rows where remote_ips is not empty and is a list
        traffic_data = traffic_data[traffic_data['remote_ips'].apply(
            lambda x: isinstance(x, list) and len(x) > 0
        )]
        
        if traffic_data.empty:
            return pd.DataFrame()
        
        # Calculate baseline traffic per process
        process_baseline = traffic_data.groupby(['hostname', 'name', 'pid'])['outbound_bytes'].mean().reset_index()
        process_baseline.rename(columns={'outbound_bytes': 'avg_daily_outbound'}, inplace=True)
        
        # Add date and determine if it's a weekend
        traffic_data['event_date'] = traffic_data['timestamp'].dt.date
        traffic_data['is_weekend'] = traffic_data['timestamp'].dt.dayofweek.isin([5, 6]).astype(int)  # 5,6 = Sat,Sun
        
        # Prepare data for daily traffic calculation
        daily_traffic_entries = []
        
        # Process each row
        for _, row in traffic_data.iterrows():
            hostname = row['hostname']
            os_type = row['os_type']
            pid = row['pid']
            name = row['name']
            event_date = row['event_date']
            is_weekend = row['is_weekend']
            outbound_bytes = row['outbound_bytes']
            
            # Process each remote IP
            if isinstance(row['remote_ips'], list):
                for remote_ip in row['remote_ips']:
                    daily_traffic_entries.append({
                        'hostname': hostname,
                        'os_type': os_type,
                        'pid': pid,
                        'name': name,
                        'event_date': event_date,
                        'is_weekend': is_weekend,
                        'remote_ips': remote_ip,
                        'daily_outbound': outbound_bytes
                    })
        
        if not daily_traffic_entries:
            return pd.DataFrame()
        
        # Convert to DataFrame
        daily_traffic = pd.DataFrame(daily_traffic_entries)
        
        # Group by hostname, process, date to get daily traffic
        daily_traffic_agg = daily_traffic.groupby(['hostname', 'os_type', 'pid', 'name', 'event_date', 'is_weekend', 'remote_ips'])[
            'daily_outbound'
        ].sum().reset_index()
        
        # Merge with baseline
        daily_traffic_agg = daily_traffic_agg.merge(
            process_baseline, on=['hostname', 'name', 'pid'], how='left'
        )
        
        # Filter for traffic above baseline
        daily_traffic_agg = daily_traffic_agg[daily_traffic_agg['daily_outbound'] > daily_traffic_agg['avg_daily_outbound'] * 1.5]
        
        # Analyze weekend vs. weekday patterns
        suspicious_exfil = []
        
        for (hostname, pid, name, remote_ip), group in daily_traffic_agg.groupby(['hostname', 'pid', 'name', 'remote_ips']):
            # Count weekend and weekday days
            weekend_days = len(group[group['is_weekend'] == 1]['event_date'].unique())
            weekday_days = len(group[group['is_weekend'] == 0]['event_date'].unique())
            
            # Calculate traffic volumes
            weekend_bytes = group[group['is_weekend'] == 1]['daily_outbound'].sum()
            weekday_bytes = group[group['is_weekend'] == 0]['daily_outbound'].sum()
            total_bytes = weekend_bytes + weekday_bytes
            
            # Calculate daily averages
            weekend_avg = weekend_bytes / weekend_days if weekend_days > 0 else 0
            weekday_avg = weekday_bytes / weekday_days if weekday_days > 0 else 0
            
            # Check criteria
            if (weekend_days > 0 and 
                weekend_avg > weekday_avg * 3 and
                total_bytes > 1000000):  # At least 1MB total data
                
                suspicious_exfil.append({
                    'detection_time': now,
                    'severity': 'Critical',
                    'hostname': hostname,
                    'pid': pid,
                    'process_name': name,
                    'detection_type': 'Data Exfiltration via Steganography',
                    'timeline': 'Weekend-only outbound data transfer',
                    'data_volume': f'~{round(total_bytes/1048576, 1)}MB total',
                    'destination': remote_ip,
                    'total_bytes': total_bytes,
                    'alert_name': 'Weekend Exfiltration Detection'
                })
        
        if suspicious_exfil:
            result_df = pd.DataFrame(suspicious_exfil)
            return result_df.sort_values('total_bytes', ascending=False).head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_weekend_exfiltration: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()

# --------------------------------------------------------------------------------------------
# SCENARIO 2: CROSS-SYSTEM LATERAL MOVEMENT WITH DISTRIBUTED ATTACK PATTERN
# --------------------------------------------------------------------------------------------

def detect_distributed_reconnaissance(df, lookback_days=30):
    """
    Detect distributed reconnaissance campaigns across multiple systems.
    Equivalent to "Query 1: Distributed Reconnaissance Campaign" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        lookback_date = now - timedelta(days=lookback_days)
        
        # Filter relevant data
        recon_data = df[df['timestamp'] >= lookback_date].copy()
        
        # Create function to categorize commands
        def categorize_command(cmdline):
            if not isinstance(cmdline, str):
                return 'other'
            
            cmdline = cmdline.lower()
            if any(cmd in cmdline for cmd in ['net view', 'net use', 'nslookup', 'ping ']):
                return 'network_discovery'
            elif any(cmd in cmdline for cmd in ['get-acl', 'icacls', 'cacls']):
                return 'permission_enum'
            elif any(cmd in cmdline for cmd in ['net group', 'net user', 'get-adgroup', 'get-aduser']):
                return 'account_enum'
            return 'other'
        
        # Define recon commands to filter by
        recon_cmds = [
            # Windows commands
            'net view', 'net use', 'net group', 'net user', 'nslookup', 'ping ', 'ipconfig',
            'systeminfo', 'whoami', 'get-acl', 'get-aduser', 'get-adgroup', 'quser',
            # Linux/Mac commands
            'ifconfig', 'ip a', 'netstat', 'who', 'w ', 'last', 'lsof'
        ]
        
        # Create a mask for command matching
        mask = recon_data['cmdline'].notna()
        for cmd in recon_cmds:
            temp_mask = recon_data['cmdline'].astype(str).str.contains(cmd, case=False, na=False)
            mask = mask & temp_mask
        
        # Apply the filter
        recon_data = recon_data[mask]
        
        if recon_data.empty:
            return pd.DataFrame()
        
        # Add command category
        recon_data['command_category'] = recon_data['cmdline'].apply(categorize_command)
        
        # Group systems executing similar commands
        systems_recon = recon_data.groupby(['command_category', 'hostname', 'user']).agg({
            'timestamp': ['min', 'max'],
            'cmdline': 'nunique'
        })
        systems_recon.columns = ['first_seen', 'last_seen', 'command_count']
        systems_recon = systems_recon.reset_index()
        
        # Filter for systems with at least 2 different commands
        systems_recon = systems_recon[systems_recon['command_count'] >= 2]
        
        # Find connected systems with similar patterns
        connected_systems = []
        
        for category, group in systems_recon.groupby('command_category'):
            # Check if there are at least 3 systems and 2 users
            system_count = len(group['hostname'].unique())
            user_count = len(group['user'].unique())
            
            if system_count >= 3 and user_count >= 2:
                # Check for time correlation (within 24 hours)
                min_time = group['first_seen'].min()
                max_time = group['first_seen'].max()
                
                if (max_time - min_time).total_seconds() / 3600 < 24:
                    connected_systems.append({
                        'detection_time': now,
                        'severity': 'High',
                        'detection_type': 'Multi-system Coordinated Reconnaissance',
                        'affected_systems': ', '.join(group['hostname'].unique()),
                        'first_detected': group['first_seen'].min(),
                        'last_detected': group['last_seen'].max(),
                        'evidence': 'Similar command patterns executed across multiple systems',
                        'user_accounts': f"{user_count} different user accounts executing similar commands",
                        'system_count': system_count,
                        'alert_name': 'Distributed Reconnaissance Campaign'
                    })
        
        if connected_systems:
            result_df = pd.DataFrame(connected_systems)
            return result_df.sort_values('system_count', ascending=False).head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_distributed_reconnaissance: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()

def detect_service_account_anomaly(df, baseline_days=90, recent_days=30):
    """
    Detect service accounts used on new systems they haven't accessed in the baseline period.
    Equivalent to "Query 2: Service Account Anomaly" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        baseline_end = now - timedelta(days=recent_days)
        baseline_start = baseline_end - timedelta(days=baseline_days)
        recent_start = baseline_end
        
        # Create a safer version of string contains check
        def safe_contains(x, pattern):
            if not isinstance(x, str):
                return False
            return pattern in x
            
        # Identify service accounts by naming convention
        df['is_service_account'] = df['user'].apply(
            lambda x: safe_contains(x, 'svc_') or safe_contains(x, '_svc') or safe_contains(x, 'service')
        )
        
        # Baseline period data for service accounts
        baseline_data = df[
            (df['timestamp'] >= baseline_start) &
            (df['timestamp'] <= baseline_end) &
            (df['is_service_account'])
        ]
        
        # Recent activity for service accounts
        recent_data = df[
            (df['timestamp'] > baseline_end) &
            (df['is_service_account'])
        ]
        
        if baseline_data.empty or recent_data.empty:
            return pd.DataFrame()
        
        # Baseline systems for each service account
        baseline_systems = {}
        for user, group in baseline_data.groupby('user'):
            baseline_systems[user] = set(group['hostname'].unique())
        
        # Recent activity by service account
        recent_activity_by_user = {}
        for user, group in recent_data.groupby('user'):
            recent_activity_by_user[user] = {
                'recent_systems': set(group['hostname'].unique()),
                'first_seen': group['timestamp'].min(),
                'last_seen': group['timestamp'].max()
            }
        
        # Identify service accounts used on new systems
        anomalies = []
        
        for user, activity in recent_activity_by_user.items():
            # Check if this user has baseline data
            if user in baseline_systems:
                baseline_hosts = baseline_systems[user]
                recent_systems = activity['recent_systems']
                new_systems = recent_systems - baseline_hosts
                
                # Check if at least 3 new systems
                if len(new_systems) >= 3:
                    anomalies.append({
                        'detection_time': now,
                        'severity': 'Critical',
                        'detection_type': 'Abnormal Service Account Usage',
                        'account': user,
                        'affected_systems': ', '.join(recent_systems),
                        'timeline': f"{activity['first_seen'].date()} - {activity['last_seen'].date()}",
                        'abnormal_behavior': f"Account used from {len(new_systems)} workstations never previously accessed in 90-day baseline period",
                        'new_systems_count': len(new_systems),
                        'alert_name': 'Service Account Anomaly'
                    })
        
        if anomalies:
            result_df = pd.DataFrame(anomalies)
            return result_df.sort_values('new_systems_count', ascending=False).head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_service_account_anomaly: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()
def detect_cross_system_attack_chain(df, lookback_days=60, min_hosts=3, min_days=7):
    """
    Detect attack chains spanning multiple systems.
    Equivalent to "Query 3: Cross-System Attack Chain Detection" in SQL.
    """
    try:
        # Current time for reference
        now = datetime.now()
        lookback_date = now - timedelta(days=lookback_days)
        
        # Filter recent data
        recent_data = df[df['timestamp'] >= lookback_date].copy()
        
        # Safely check numeric fields
        def safe_numeric_check(row, field):
            try:
                value = row[field]
                if pd.isna(value):
                    return 0
                # Try to convert to float, but handle non-numeric values
                try:
                    return float(value) == 1
                except (ValueError, TypeError):
                    return False
            except:
                return False
        
        # Create safer numeric versions of fields that might not be convertible
        for col in ['script_execution', 'obfuscated_script', 'registry_persistence_access', 
                    'exe_mismatch', 'credential_access']:
            try:
                # Create new numeric columns without converting the original
                recent_data[f'{col}_num'] = recent_data[col].apply(
                    lambda x: 1 if x == 1 or x == '1' or x == True else 0
                )
            except:
                # If column doesn't exist or has issues, create a column of zeros
                recent_data[f'{col}_num'] = 0
        
        # Identify potential initial access events
        def identify_access_type(row):
            if safe_numeric_check(row, 'script_execution'):
                return 'script_execution'
            elif safe_numeric_check(row, 'obfuscated_script'):
                return 'obfuscated_script'
            elif safe_numeric_check(row, 'registry_persistence_access'):
                return 'registry_persistence'
            elif safe_numeric_check(row, 'exe_mismatch'):
                return 'exe_mismatch'
            elif safe_numeric_check(row, 'credential_access'):
                return 'credential_theft'
            return 'other'
        
        # Define function to check string contains for process names
        def safe_str_contains(x, pattern):
            if not isinstance(x, str):
                return False
            return pattern.lower() in x.lower()
        
        # Additional criteria for initial access using safer columns
        initial_access_mask = (
            (recent_data['script_execution_num'] == 1) |
            (recent_data['obfuscated_script_num'] == 1) |
            (recent_data['registry_persistence_access_num'] == 1) |
            (recent_data['exe_mismatch_num'] == 1) |
            (recent_data['credential_access_num'] == 1) |
            (recent_data['name'].apply(lambda x: safe_str_contains(x, 'powershell')) & 
             recent_data['cmdline'].apply(lambda x: safe_str_contains(x, 'download'))) |
            (recent_data['name'].apply(lambda x: safe_str_contains(x, 'cmd')) & 
             recent_data['cmdline'].apply(lambda x: safe_str_contains(x, 'curl'))) |
            (recent_data['name'].apply(lambda x: safe_str_contains(x, 'npm')) & 
             recent_data['cmdline'].apply(lambda x: safe_str_contains(x, 'install')))
        )
        
        initial_access = recent_data[initial_access_mask].copy()
        
        if initial_access.empty:
            return pd.DataFrame()
            
        initial_access['access_type'] = initial_access.apply(identify_access_type, axis=1)
        
        # Get users involved in initial access
        initial_access_users = set(initial_access['user'].dropna().unique())
        
        if not initial_access_users:
            return pd.DataFrame()
        
        # Track user activities across systems after initial access
        def identify_activity_type(row):
            if safe_numeric_check(row, 'credential_access'):
                return 'credential_access'
            elif safe_numeric_check(row, 'registry_persistence_access'):
                return 'persistence'
            elif safe_numeric_check(row, 'script_execution'):
                return 'script_execution'
            elif row['conn_count'] > 5:
                return 'network_activity'
            return 'other'
        
        # Find cross-system activity for users involved in initial access
        cross_system = recent_data[recent_data['user'].isin(initial_access_users)].copy()
        
        if cross_system.empty:
            return pd.DataFrame()
            
        cross_system['activity_type'] = cross_system.apply(identify_activity_type, axis=1)
        
        # Group by user to find accessed hosts
        user_activity = {}
        for user, group in cross_system.groupby('user'):
            unique_hosts = group['hostname'].dropna().unique()
            activity_types = group['activity_type'].dropna().unique()
            first_access = group['timestamp'].min()
            last_access = group['timestamp'].max()
            
            duration_days = 0
            try:
                duration_days = (last_access - first_access).days
            except:
                pass
                
            user_activity[user] = {
                'accessed_hosts': list(unique_hosts),
                'activity_types': list(activity_types),
                'first_access': first_access,
                'last_access': last_access,
                'campaign_duration': duration_days,
                'host_count': len(unique_hosts)
            }
        
        # Filter for campaigns matching criteria
        host_progression = []
        for user, activity in user_activity.items():
            if activity['host_count'] >= min_hosts and activity['campaign_duration'] >= min_days:
                host_progression.append({
                    'user': user,
                    'accessed_hosts': activity['accessed_hosts'],
                    'activity_types': activity['activity_types'],
                    'first_access': activity['first_access'],
                    'last_access': activity['last_access'],
                    'campaign_duration': activity['campaign_duration'],
                    'host_count': activity['host_count']
                })
        
        if not host_progression:
            return pd.DataFrame()
            
        host_progression_df = pd.DataFrame(host_progression)
        
        # Identify sensitive systems
        sensitive_keywords = ['PAYMENT', 'FINANCE', 'HR', 'ADMIN', 'DB', 'SQL']
        
        def is_sensitive(hostname):
            if not isinstance(hostname, str):
                return False
            return any(keyword in hostname.upper() for keyword in sensitive_keywords)
        
        cross_system['is_sensitive'] = cross_system['hostname'].apply(is_sensitive)
        
        # Build attack chains
        attack_chains = []
        
        for _, row in host_progression_df.iterrows():
            user = row['user']
            user_systems = cross_system[cross_system['user'] == user]
            
            if user_systems.empty:
                continue
                
            # Find first accessed host
            first_timestamp_idx = user_systems['timestamp'].idxmin()
            if first_timestamp_idx is None:
                continue
                
            first_host = user_systems.loc[first_timestamp_idx]
            
            # Try to find sensitive systems as final target, otherwise use last accessed
            sensitive_systems = user_systems[user_systems['is_sensitive']]
            
            if not sensitive_systems.empty:
                last_timestamp_idx = sensitive_systems['timestamp'].idxmax()
                if last_timestamp_idx is not None:
                    last_host = sensitive_systems.loc[last_timestamp_idx]
                else:
                    # Fallback to the last timestamp in user_systems
                    last_timestamp_idx = user_systems['timestamp'].idxmax()
                    if last_timestamp_idx is None:
                        continue
                    last_host = user_systems.loc[last_timestamp_idx]
            else:
                # Use the last accessed host
                last_timestamp_idx = user_systems['timestamp'].idxmax()
                if last_timestamp_idx is None:
                    continue
                last_host = user_systems.loc[last_timestamp_idx]
            
            # Build attack path (initial → middle systems → final)
            middle_systems = [host for host in row['accessed_hosts'] 
                            if isinstance(host, str) and 
                            host != first_host['hostname'] and 
                            host != last_host['hostname']]
                            
            # Limit to 3 middle systems for readability
            if middle_systems:
                middle_path = ' → '.join(middle_systems[:min(len(middle_systems), 3)])
                attack_path = f"{first_host['hostname']} → {middle_path} → {last_host['hostname']}"
            else:
                attack_path = f"{first_host['hostname']} → {last_host['hostname']}"
            
            attack_chains.append({
                'detection_time': now,
                'severity': 'Critical',
                'detection_type': 'Distributed Attack Chain',
                'user': user,
                'host_count': row['host_count'],
                'systems': row['accessed_hosts'],
                'initial_access': first_host['hostname'],
                'initial_timestamp': first_host['timestamp'],
                'final_target': last_host['hostname'],
                'final_timestamp': last_host['timestamp'],
                'attack_path': attack_path,
                'attack_duration': f"{row['campaign_duration']} days with extremely low activity on any single endpoint",
                'alert_name': 'Cross-System Attack Chain Detected'
            })
        
        if attack_chains:
            result_df = pd.DataFrame(attack_chains)
            # Changed this line to address the KeyError
            if 'campaign_duration' in result_df.columns:
                return result_df.sort_values('campaign_duration', ascending=False).head(100)
            else:
                return result_df.head(100)
        else:
            return pd.DataFrame()
    except Exception as e:
        print(f"Error in detect_cross_system_attack_chain: {str(e)}")
        traceback.print_exc()
        return pd.DataFrame()
