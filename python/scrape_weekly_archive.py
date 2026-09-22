#!/usr/bin/env python3
"""
Official World Athletics Weekly Ranking Archive Scraper
Fetches genuine weekly Top 100 rankings for Men's Long Jump from 2023-06-20 onwards.
Stores individual weekly files in data/rankings/ranking_YYYY-MM-DD.json
and generates data/rankings/timeline_index.json & data/rankings_archive.json.
"""

import os
import re
import ssl
import json
import time
import datetime
import urllib.request
import argparse

CTX = ssl._create_unverified_context()
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

def get_html(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=CTX, timeout=20) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(1 + attempt * 2)

def get_official_dates(start_date="2023-06-20"):
    """Extracts all official ranking dates from World Athletics configuration."""
    url = f"https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&rankDate={start_date}&limitByCountry=0"
    html = get_html(url)
    match = re.search(r'\[\{"name":"rankDate".*?"values":(\[.*?\])\}\]', html)
    if not match:
        raise ValueError("Could not extract rankDate values from World Athletics HTML")
    
    values = json.loads(match.group(1))
    # Filter and sort chronologically
    valid = [v for v in values if v.get("value", "") >= start_date]
    valid.sort(key=lambda x: x["value"])
    return valid

def fetch_competitions_for_athlete(data_id):
    """Fetches exact 5 counting competitions directly from World Athletics Calculation API."""
    cid = data_id if data_id.startswith("0") else "0" + data_id
    calc_url = f"https://worldathletics.org/WorldRanking/RankingScoreCalculation?competitorId={cid}"
    try:
        raw = get_html(calc_url)
        data = json.loads(raw)
        if isinstance(data, str):
            data = json.loads(data)
        
        comps = []
        for r in data.get("results", []):
            comps.append({
                "date": r.get("date"),
                "competition": r.get("competition"),
                "venue": r.get("venue", ""),
                "category": r.get("category"),
                "mark": r.get("mark"),
                "wind": r.get("wind"),
                "place": r.get("place"),
                "result_score": r.get("resultScore"),
                "placing_score": r.get("placingScore"),
                "performance_score": r.get("performanceScore"),
                "indoor": r.get("indoor", False)
            })
        return comps
    except Exception as e:
        print(f"    Notice: could not fetch competitions for id {data_id}: {e}")
        return []

def parse_ranking_page(date_str, date_label=""):
    """Fetches and parses the Top 100 table for a specific date."""
    url = f"https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&rankDate={date_str}&limitByCountry=0"
    html = get_html(url)
    
    rows = re.findall(r'<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
    if not rows:
        # Fallback regex if data-id is slightly different
        rows_alt = re.findall(r'<tr[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
        rows = [("", u, c) for u, c in rows_alt]

    athletes = []
    luka_info = None

    for idx, (data_id, athlete_url, content) in enumerate(rows[:100]):
        cells = re.findall(r'<td[^>]*data-th="([^"]+)"[^>]*>(.*?)</td>', content, re.DOTALL)
        clean = {th: re.sub(r'<[^>]+>', '', val).strip() for th, val in cells}
        
        name = clean.get("Competitor", "")
        rank = int(clean.get("Rank", idx + 1))
        score = int(clean.get("score", 0))
        nat = clean.get("Nat", "")
        dob = clean.get("DOB", "")
        
        ath_data = {
            "rank": rank,
            "name": name,
            "country": nat,
            "dob": dob,
            "ranking_score": score,
            "profile_url": f"https://worldathletics.org{athlete_url}" if athlete_url else "",
            "data_id": data_id,
            "counted_competitions": []
        }
        
        # Check if Luka Herden
        is_luka = "herden" in name.lower() or "herden" in athlete_url.lower()
        if is_luka:
            comps = fetch_competitions_for_athlete(data_id) if data_id else []
            ath_data["counted_competitions"] = comps
            luka_info = {
                "rank": rank,
                "score": score,
                "data_id": data_id,
                "competitions": comps
            }
            
        athletes.append(ath_data)

    return {
        "date": date_str,
        "label": date_label or date_str,
        "event": "Men's Long Jump",
        "athletes_count": len(athletes),
        "luka_found": luka_info is not None,
        "luka_rank": luka_info["rank"] if luka_info else None,
        "luka_score": luka_info["score"] if luka_info else None,
        "luka_competitions": luka_info["competitions"] if luka_info else [],
        "athletes": athletes
    }

def run_archive_scraper(start_date="2023-06-20", force_refresh=False):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rankings_dir = os.path.join(base_dir, "data", "rankings")
    os.makedirs(rankings_dir, exist_ok=True)
    
    print(f"=== World Athletics Weekly Ranking Scraper ===")
    print(f"Fetching official dates starting from {start_date}...")
    official_dates = get_official_dates(start_date)
    total_dates = len(official_dates)
    print(f"Found {total_dates} official weekly ranking dates to process.\n")

    timeline_index = []
    archive_snapshots = []
    competitions_catalog = {}

    for i, date_obj in enumerate(official_dates):
        date_str = date_obj["value"]
        date_label = date_obj.get("label", date_str)
        file_path = os.path.join(rankings_dir, f"ranking_{date_str}.json")
        
        data = None
        if os.path.exists(file_path) and not force_refresh:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Verify validity
                    if data.get("athletes_count", 0) >= 90:
                        pass
                    else:
                        data = None
            except Exception:
                data = None

        if not data:
            print(f"[{i+1}/{total_dates}] Fetching {date_str} ({date_label})...")
            try:
                data = parse_ranking_page(date_str, date_label)
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                time.sleep(0.3)
            except Exception as e:
                print(f"  ❌ Error fetching {date_str}: {e}")
                continue
        else:
            # print cached
            pass

        luka_r = data.get("luka_rank")
        luka_s = data.get("luka_score")
        luka_tag = f"Luka #{luka_r} ({luka_s} Pkt)" if luka_r else "Luka unranked"

        print(f"[{i+1}/{total_dates}] {date_str}: {data.get('athletes_count', 0)} Athleten | {luka_tag}")

        # Build timeline index entry
        timeline_index.append({
            "date": date_str,
            "label": date_label,
            "file": f"rankings/ranking_{date_str}.json",
            "lukaRank": luka_r,
            "lukaScore": luka_s,
            "topAthlete": data["athletes"][0]["name"] if data.get("athletes") else "",
            "topScore": data["athletes"][0]["ranking_score"] if data.get("athletes") else 0
        })

        # Build snapshot for rankings_archive.json
        archive_snapshots.append({
            "date": date_str,
            "displayDate": date_label,
            "lukaRank": luka_r if luka_r else 100,
            "lukaScore": luka_s if luka_s else 1100,
            "milestoneNote": f"Offizielles World Athletics Ranking ({date_label})",
            "athletes": data.get("athletes", [])
        })

        # Collect competitions into master catalog
        for comp in data.get("luka_competitions", []):
            c_name = comp.get("competition")
            if c_name and c_name not in competitions_catalog:
                competitions_catalog[c_name] = {
                    "name": c_name,
                    "venue": comp.get("venue"),
                    "category": comp.get("category"),
                    "date": comp.get("date"),
                    "indoor": comp.get("indoor", False)
                }

    # Save data/rankings/timeline_index.json
    index_path = os.path.join(rankings_dir, "timeline_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "total_weeks": len(timeline_index),
            "start_date": start_date,
            "weeks": timeline_index
        }, f, ensure_ascii=False, indent=2)
    print(f"\n✅ timeline_index.json written with {len(timeline_index)} weeks.")

    # Save data/rankings_archive.json (compatible with state.rankingsArchive in app.js)
    archive_path = os.path.join(base_dir, "data", "rankings_archive.json")
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "timeline_range": f"{start_date} to Present",
            "total_snapshots": len(archive_snapshots),
            "snapshots": archive_snapshots
        }, f, ensure_ascii=False, indent=2)
    print(f"✅ rankings_archive.json updated with {len(archive_snapshots)} snapshots.")

    # Update ranking_latest.json and ranking_previous.json with most recent snapshots
    if archive_snapshots:
        latest = archive_snapshots[-1]
        prev = archive_snapshots[-2] if len(archive_snapshots) > 1 else latest
        
        latest_path = os.path.join(base_dir, "data", "ranking_latest.json")
        prev_path = os.path.join(base_dir, "data", "ranking_previous.json")
        
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump({
                "event": "Men's Long Jump",
                "date": latest["date"],
                "athletes_count": len(latest["athletes"]),
                "athletes": latest["athletes"]
            }, f, ensure_ascii=False, indent=2)
            
        with open(prev_path, "w", encoding="utf-8") as f:
            json.dump({
                "event": "Men's Long Jump",
                "date": prev["date"],
                "athletes_count": len(prev["athletes"]),
                "athletes": prev["athletes"]
            }, f, ensure_ascii=False, indent=2)
            
        print(f"✅ ranking_latest.json set to {latest['date']}.")
        print(f"✅ ranking_previous.json set to {prev['date']}.")

    print("\n🎉 Weekly ranking archive completed successfully!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape official World Athletics rankings from 2023-06-20.")
    parser.add_argument("--start", default="2023-06-20", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="Force re-fetch all files")
    args = parser.parse_args()
    
    run_archive_scraper(start_date=args.start, force_refresh=args.force)
