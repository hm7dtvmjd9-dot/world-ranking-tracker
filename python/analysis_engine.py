#!/usr/bin/env python3
"""
Athletics Intelligence • Correlation & Factor Analysis Engine
Created for Luka Herden (Long Jump)
Analyzes 64-variable training log transcripts (2019-present) to uncover key performance drivers.
"""

import sys
import os
import json
import csv
import math
import urllib.request
from collections import defaultdict

def pearson_correlation(x, y):
    """Calculates Pearson correlation coefficient between two numeric lists."""
    pairs = [(a, b) for a, b in zip(x, y) if a is not None and b is not None]
    if len(pairs) < 5:
        return 0.0
    
    n = len(pairs)
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    
    var_x = sum((a - mean_x) ** 2 for a in xs)
    var_y = sum((b - mean_y) ** 2 for b in ys)
    
    if var_x == 0 or var_y == 0:
        return 0.0
        
    cov = sum((a - mean_x) * (b - mean_y) for a, b in pairs)
    return round(cov / math.sqrt(var_x * var_y), 3)

def load_data(source_path_or_url):
    """Loads training data from CSV file, URL, or JSON."""
    raw_rows = []
    
    if source_path_or_url.startswith("http://") or source_path_or_url.startswith("https://"):
        print(f"[Analysis Engine] Fetching remote dataset from {source_path_or_url}...")
        req = urllib.request.Request(source_path_or_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode('utf-8')
            reader = csv.DictReader(content.splitlines())
            raw_rows = list(reader)
    elif source_path_or_url.endswith(".json"):
        with open(source_path_or_url, 'r', encoding='utf-8') as f:
            data = json.load(f)
            raw_rows = data.get("sessions", data if isinstance(data, list) else [])
    elif source_path_or_url.endswith(".csv"):
        with open(source_path_or_url, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            raw_rows = list(reader)
    else:
        raise ValueError(f"Unsupported format for {source_path_or_url}")
        
    print(f"[Analysis Engine] Loaded {len(raw_rows)} records.")
    return raw_rows

def run_factor_analysis(records, target_metric="best_mark_m"):
    """Performs correlation analysis of all metrics against target jump mark."""
    numeric_columns = defaultdict(list)
    
    # Extract numerical series
    for row in records:
        for k, v in row.items():
            if v is None or v == "":
                continue
            try:
                val = float(v)
                numeric_columns[k].append(val)
            except (ValueError, TypeError):
                pass
                
    if target_metric not in numeric_columns:
        # Fallback to eff_mark_m
        if "eff_mark_m" in numeric_columns:
            target_metric = "eff_mark_m"
        else:
            print(f"[Warning] Target metric '{target_metric}' not found in data.")
            return {}

    target_vals = []
    aligned_data = defaultdict(list)
    
    for row in records:
        t_val = row.get(target_metric)
        if t_val is None or t_val == "":
            continue
        try:
            t_num = float(t_val)
        except (ValueError, TypeError):
            continue
            
        target_vals.append(t_num)
        for col_name, _ in numeric_columns.items():
            c_val = row.get(col_name)
            try:
                aligned_data[col_name].append(float(c_val) if c_val not in (None, "") else None)
            except (ValueError, TypeError):
                aligned_data[col_name].append(None)
                
    correlations = []
    
    for col_name, values in aligned_data.items():
        if col_name == target_metric or col_name.endswith("_id") or col_name == "season_year":
            continue
            
        r = pearson_correlation(values, target_vals)
        valid_count = sum(1 for v in values if v is not None)
        
        if valid_count >= 5 and abs(r) >= 0.05:
            direction = "Positiv (Leistungssteigernd)" if r > 0 else "Negativ (Hemmend / Ermüdung)"
            correlations.append({
                "variable": col_name,
                "correlation": r,
                "sampleSize": valid_count,
                "direction": direction,
                "strength": "Sehr stark" if abs(r) >= 0.7 else "Stark" if abs(r) >= 0.5 else "Moderat" if abs(r) >= 0.3 else "Schwach"
            })
            
    # Sort by absolute correlation
    correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    
    # 8.00m+ Benchmark Driver Analysis
    threshold_8m_drivers = []
    jump_8m_sessions = [r for r in records if r.get(target_metric) and float(r[target_metric]) >= 8.00]
    sub_8m_sessions = [r for r in records if r.get(target_metric) and float(r[target_metric]) < 8.00]
    
    print(f"\n[Analysis Engine] 8.00m+ Analysis: {len(jump_8m_sessions)} Sprünge >= 8.00m vs {len(sub_8m_sessions)} Sprünge < 8.00m")
    
    compare_keys = [
        "approach_speed_11m_to_1m", "rsi_score", "whoop_recovery_pct", 
        "whoop_hrv", "sleep_hours", "trapbar_e1rm_kg", "body_weight_kg"
    ]
    
    for k in compare_keys:
        vals_8m = [float(r[k]) for r in jump_8m_sessions if r.get(k) is not None and r[k] != ""]
        vals_sub = [float(r[k]) for r in sub_8m_sessions if r.get(k) is not None and r[k] != ""]
        
        if vals_8m and vals_sub:
            avg_8m = round(sum(vals_8m) / len(vals_8m), 2)
            avg_sub = round(sum(vals_sub) / len(vals_sub), 2)
            diff = round(avg_8m - avg_sub, 2)
            threshold_8m_drivers.append({
                "metric": k,
                "avgOver8m": avg_8m,
                "avgUnder8m": avg_sub,
                "delta": diff,
                "insight": f"{'+' if diff > 0 else ''}{diff} bei Sprüngen >= 8.00m"
            })
            
    results = {
        "targetMetric": target_metric,
        "totalSessions": len(records),
        "jumpsLogged": len(target_vals),
        "jumpsOver8mCount": len(jump_8m_sessions),
        "topCorrelations": correlations[:15],
        "eightMeterDrivers": threshold_8m_drivers,
        "generatedAt": "2026-09-22"
    }
    
    return results

def main():
    data_source = sys.argv[1] if len(sys.argv) > 1 else "data/training_sample.json"
    target = sys.argv[2] if len(sys.argv) > 2 else "best_mark_m"
    
    print(f"[Analysis Engine] Starting training factor analysis for Luka Herden...")
    print(f"  Source: {data_source}")
    print(f"  Target: {target}")
    
    records = load_data(data_source)
    insights = run_factor_analysis(records, target_metric=target)
    
    output_path = "data/training_insights.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(insights, f, indent=2, ensure_ascii=False)
        
    print(f"[Analysis Engine] Successfully generated {output_path}")
    print("\n--- TOP CORRELATIONS WITH JUMP PERFORMANCE ---")
    for item in insights.get("topCorrelations", [])[:8]:
        print(f" • {item['variable']:<28} r = {item['correlation']:>+5.2f}  ({item['strength']})")
        
    print("\n--- 8.00m+ PERFORMANCE PREREQUISITES ---")
    for item in insights.get("eightMeterDrivers", []):
        print(f" • {item['metric']:<26}: Ø {item['avgOver8m']} (vs. Ø {item['avgUnder8m']} bei <8m) -> {item['insight']}")

if __name__ == "__main__":
    main()
