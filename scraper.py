#!/usr/bin/env python3
"""
World Athletics Ranking Scraper (Official HTTP Engine)
Fetches genuine official rankings for Men's Long Jump from World Athletics.
No headless browser / playwright required — 100% standard library (urllib.request).

Usage:
  python3 scraper.py                  # Fetches latest ranking and updates latest/previous
  python3 scraper.py --date 2023-06-20 # Fetches a specific date into data/rankings/
  python3 scraper.py --backfill       # Scrapes all weekly dates since 2023-06-20
"""

import os
import re
import sys
import ssl
import json
import time
import shutil
import argparse
import urllib.request

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
        return []

def scrape_rankings(date_str=None, fetch_all_competitions=False):
    """Scrapes Men's Long Jump rankings from World Athletics."""
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    if date_str:
        url += f"&rankDate={date_str}"

    print(f"Connecting to World Athletics: {url}")
    html = get_html(url)

    rows = re.findall(r'<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
    if not rows:
        rows_alt = re.findall(r'<tr[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
        rows = [("", u, c) for u, c in rows_alt]

    total_rows = min(len(rows), 100)
    print(f"Found {len(rows)} athletes. Extracting Top {total_rows}...")

    athletes = []
    for idx, (data_id, athlete_url, content) in enumerate(rows[:total_rows]):
        cells = re.findall(r'<td[^>]*data-th="([^"]+)"[^>]*>(.*?)</td>', content, re.DOTALL)
        clean = {th: re.sub(r'<[^>]+>', '', val).strip() for th, val in cells}

        rank = int(clean.get("Rank", idx + 1))
        name = clean.get("Competitor", "")
        country = clean.get("Nat", "")
        dob = clean.get("DOB", "")
        score = int(clean.get("score", 0))

        # Determine if we should fetch competitions:
        # Always fetch for Luka Herden and German squad; fetch top 10 or all if requested
        is_luka = "herden" in name.lower() or "herden" in athlete_url.lower()
        is_ger = country == "GER"
        should_fetch_comps = fetch_all_competitions or is_luka or is_ger or idx < 10

        counted_meetings = []
        if should_fetch_comps and data_id:
            counted_meetings = fetch_competitions_for_athlete(data_id)
            time.sleep(0.05)

        athletes.append({
            "rank": rank,
            "name": name,
            "country": country,
            "dob": dob,
            "ranking_score": score,
            "profile_url": f"https://worldathletics.org{athlete_url}" if athlete_url else "",
            "data_id": data_id,
            "counted_competitions": counted_meetings
        })

    return athletes

def main():
    parser = argparse.ArgumentParser(description="World Athletics Ranking Scraper")
    parser.add_argument("--date", help="Specific ranking date (YYYY-MM-DD)")
    parser.add_argument("--backfill", action="store_true", help="Scrape all weeks from 2023-06-20")
    parser.add_argument("--all-comps", action="store_true", help="Fetch counting competitions for all 100 athletes")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    if args.backfill:
        from python.scrape_weekly_archive import run_archive_scraper
        run_archive_scraper()
        return

    if args.date:
        rankings_dir = os.path.join(data_dir, "rankings")
        os.makedirs(rankings_dir, exist_ok=True)
        athletes = scrape_rankings(date_str=args.date, fetch_all_competitions=args.all_comps)
        out_path = os.path.join(rankings_dir, f"ranking_{args.date}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({
                "date": args.date,
                "event": "Men's Long Jump",
                "athletes_count": len(athletes),
                "athletes": athletes
            }, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(athletes)} athletes to {out_path}")
        return

    # Default: scrape latest ranking
    latest_path = os.path.join(data_dir, "ranking_latest.json")
    prev_path = os.path.join(data_dir, "ranking_previous.json")

    if os.path.exists(latest_path):
        try:
            shutil.copy(latest_path, prev_path)
            print(f"Previous ranking backed up to {prev_path}")
        except Exception as e:
            print(f"Notice: could not backup previous: {e}")

    athletes = scrape_rankings(fetch_all_competitions=args.all_comps)
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "date": time.strftime("%Y-%m-%d"),
            "athletes_count": len(athletes),
            "athletes": athletes
        }, f, ensure_ascii=False, indent=2)

    print(f"\nSuccessfully updated {latest_path} with {len(athletes)} athletes!")

if __name__ == "__main__":
    main()
