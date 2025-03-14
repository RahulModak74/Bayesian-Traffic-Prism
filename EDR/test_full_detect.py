#!/usr/bin/env python3
"""
run_detections.py - Execute all detection functions from full_detect.py
"""
import pandas as pd
from datetime import datetime

# Import all detection functions from full_detect.py
from full_detect import (
    load_data,
    detect_long_dwell_time,
    detect_beaconing,
    detect_weekend_exfiltration,
    detect_distributed_reconnaissance,
    detect_service_account_anomaly,
    detect_cross_system_attack_chain
)

def main():
    # Path to the CSV file
    file_path = "attack_file.csv"
    
    # Load and preprocess data
    print(f"Loading data from {file_path}...")
    df = load_data(file_path)
    
    # Record start time
    start_time = datetime.now()
    
    # Run all detection functions with error handling
    print("\nRunning all detection functions...")
    results = {}
    
    # APT with Long-Dwell
    print("\nScenario 1: Advanced Persistent Threat")
    try:
        print("  Running long dwell time detection...")
        results["long_dwell"] = detect_long_dwell_time(df)
    except Exception as e:
        print(f"  Error in long dwell time detection: {e}")
        results["long_dwell"] = pd.DataFrame()
    
    try:
        print("  Running beaconing detection...")
        results["beaconing"] = detect_beaconing(df)
    except Exception as e:
        print(f"  Error in beaconing detection: {e}")
        results["beaconing"] = pd.DataFrame()
    
    try:
        print("  Running weekend exfiltration detection...")
        results["weekend_exfil"] = detect_weekend_exfiltration(df)
    except Exception as e:
        print(f"  Error in weekend exfiltration detection: {e}")
        results["weekend_exfil"] = pd.DataFrame()

    # Lateral Movement
    print("\nScenario 2: Lateral Movement")
    try:
        print("  Running distributed reconnaissance detection...")
        results["recon"] = detect_distributed_reconnaissance(df)
    except Exception as e:
        print(f"  Error in distributed reconnaissance detection: {e}")
        results["recon"] = pd.DataFrame()
    
    try:
        print("  Running service account anomaly detection...")
        results["service_account"] = detect_service_account_anomaly(df)
    except Exception as e:
        print(f"  Error in service account anomaly detection: {e}")
        results["service_account"] = pd.DataFrame()
    
    try:
        print("  Running cross-system attack chain detection...")
        results["attack_chain"] = detect_cross_system_attack_chain(df)
    except Exception as e:
        print(f"  Error in cross-system attack chain detection: {e}")
        results["attack_chain"] = pd.DataFrame()
    
    # Calculate execution time
    end_time = datetime.now()
    execution_time = (end_time - start_time).total_seconds()
    
    # Print results summary
    print("\n===== RESULTS =====")
    total_alerts = 0
    
    for name, result in results.items():
        alert_count = len(result) if isinstance(result, pd.DataFrame) and not result.empty else 0
        total_alerts += alert_count
        print(f"{name}: {alert_count} alerts")
    
    print(f"\nTotal alerts: {total_alerts}")
    print(f"Execution time: {execution_time:.2f} seconds")
    print("\nAnalysis completed!")

if __name__ == "__main__":
    main()
