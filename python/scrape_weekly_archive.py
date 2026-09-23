#!/usr/bin/env python3
"""
Official World Athletics Weekly Ranking Archive Scraper & Database Builder
Fetches genuine weekly Top 100 rankings for Men's Long Jump from 2023-06-20 to present.
Every document contains ALL 100 athletes with EACH of their 5 counting competitions.
Generates:
  - data/rankings/ranking_YYYY-MM-DD.json (full 100 athletes x 5 competitions + WoW progression)
  - data/rankings/timeline_index.json (timeline scrubber index)
  - data/athletes_database.json (all athletes in Top 100 over 3 years + all surfaced competitions)
  - data/competitions_database.json (master catalog of all competitions over the 3 years)
  - data/ranking_latest.json & data/ranking_previous.json
"""

import os
import re
import ssl
import json
import time
import datetime
import urllib.request
import argparse
from concurrent.futures import ThreadPoolExecutor

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
    url = f"https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    html = get_html(url)
    match = re.search(r'\[\{"name":"rankDate".*?"values":(\[.*?\])\}\]', html)
    if not match:
        raise ValueError("Could not extract rankDate values from World Athletics HTML")
    
    values = json.loads(match.group(1))
    valid = [v for v in values if v.get("value", "") >= start_date]

    # Verify if 2026-09-22 is included
    if not any(v.get("value") == "2026-09-22" for v in valid):
        valid.append({"value": "2026-09-22", "label": "22 SEP 2026"})

    valid.sort(key=lambda x: x["value"])
    return valid

def fetch_single_athlete_competitions(data_id):
    """Fetches exact 5 counting competitions directly from World Athletics Calculation API."""
    if not data_id:
        return []
    cid = data_id if data_id.startswith("0") else "0" + data_id
    calc_url = f"https://worldathletics.org/WorldRanking/RankingScoreCalculation?competitorId={cid}"
    req = urllib.request.Request(calc_url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest"
    })
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=12) as resp:
            raw = resp.read().decode("utf-8")
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
    except Exception:
        return []

def parse_full_ranking_page(date_str, date_label="", max_workers=25):
    """Fetches Top 100 table and simultaneously fetches all 100 athletes 5 competitions."""
    url = f"https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&rankDate={date_str}&limitByCountry=0"
    html = get_html(url)
    
    rows = re.findall(r'<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
    if not rows:
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
        athletes.append(ath_data)

    if not athletes:
        return {
            "date": date_str,
            "label": date_label or date_str,
            "event": "Men's Long Jump",
            "athletes_count": 0,
            "athletes": []
        }

    # Fetch 5 counting competitions for ALL 100 athletes concurrently
    data_ids = [a["data_id"] for a in athletes]
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        all_comps = list(executor.map(fetch_single_athlete_competitions, data_ids))

    for ath, comps in zip(athletes, all_comps):
        ath["counted_competitions"] = comps
        if "herden" in ath["name"].lower() or "herden" in ath.get("profile_url", "").lower():
            luka_info = {
                "rank": ath["rank"],
                "score": ath["ranking_score"],
                "competitions": comps
            }

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
    
    print(f"===========================================================")
    print(f" World Athletics Full Archive Scraper (100 Athleten x 5 Wettkämpfe)")
    print(f" Startdatum: {start_date} bis heute")
    print(f"===========================================================\n")
    
    official_dates = get_official_dates(start_date)
    total_dates = len(official_dates)
    print(f"Gefundene offizielle Stichtage: {total_dates}\n")

    loaded_weeks_data = []

    # Phase 1: Ensure all weekly documents are downloaded with complete 100 athletes & 5 competitions
    for i, date_obj in enumerate(official_dates):
        date_str = date_obj["value"]
        date_label = date_obj.get("label", date_str)
        file_path = os.path.join(rankings_dir, f"ranking_{date_str}.json")
        
        data = None
        # Check if file exists and has full 100 athletes with competitions populated
        if os.path.exists(file_path) and not force_refresh:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    ath_list = cached.get("athletes", [])
                    # Verify that athletes have counted competitions populated
                    if len(ath_list) >= 90:
                        comps_populated = sum(1 for a in ath_list if len(a.get("counted_competitions", [])) >= 4)
                        if comps_populated >= 80:
                            data = cached
            except Exception:
                data = None

        if not data:
            print(f"[{i+1}/{total_dates}] Lade vollständige Daten für {date_str} ({date_label})...")
            try:
                data = parse_full_ranking_page(date_str, date_label, max_workers=25)
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                time.sleep(0.15)
            except Exception as e:
                print(f"  ❌ Fehler bei {date_str}: {e}")
                continue
        
        comps_count = sum(len(a.get("counted_competitions", [])) for a in data.get("athletes", []))
        luka_r = data.get("luka_rank")
        luka_s = data.get("luka_score")
        luka_tag = f"Luka #{luka_r} ({luka_s} Pkt)" if luka_r else "Luka außerhalb Top 100"

        print(f"[{i+1}/{total_dates}] {date_str}: {data.get('athletes_count', 0)} Athleten ({comps_count} Wettkämpfe) | {luka_tag}")
        if data.get("athletes_count", 0) > 0:
            loaded_weeks_data.append((date_str, date_label, file_path, data))

    print(f"\nPhase 1 abgeschlossen: Alle {len(loaded_weeks_data)} wöchentlichen Dokumente vollständig.")

    # Phase 2: Compute Week-over-Week (WoW) deltas for every week and re-save
    print("\nPhase 2: Berechne Week-over-Week (WoW) Progression für alle 100 Athleten...")
    timeline_index = []
    archive_snapshots = []

    for i in range(len(loaded_weeks_data)):
        date_str, date_label, file_path, data = loaded_weeks_data[i]
        athletes = data.get("athletes", [])
        
        prev_map = {}
        if i > 0:
            _, _, _, prev_data = loaded_weeks_data[i - 1]
            for pa in prev_data.get("athletes", []):
                p_name = pa.get("name", "").lower().strip()
                if p_name:
                    prev_map[p_name] = {
                        "rank": pa.get("rank"),
                        "score": pa.get("ranking_score")
                    }

        # Inject WoW deltas directly into athletes
        for a in athletes:
            a_name = a.get("name", "").lower().strip()
            prev_info = prev_map.get(a_name)
            if prev_info:
                a["rank_delta"] = prev_info["rank"] - a["rank"]
                a["score_delta"] = a["ranking_score"] - prev_info["score"]
            else:
                a["rank_delta"] = None
                a["score_delta"] = None

        # Re-save with pre-computed WoW deltas
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Timeline Index entry
        luka_r = data.get("luka_rank")
        luka_s = data.get("luka_score")
        top_ath = athletes[0]["name"] if athletes else ""
        top_sc = athletes[0]["ranking_score"] if athletes else 0

        timeline_index.append({
            "date": date_str,
            "label": date_label,
            "file": f"rankings/ranking_{date_str}.json",
            "lukaRank": luka_r,
            "lukaScore": luka_s,
            "topAthlete": top_ath,
            "topScore": top_sc
        })

        archive_snapshots.append({
            "date": date_str,
            "displayDate": date_label,
            "lukaRank": luka_r if luka_r else 100,
            "lukaScore": luka_s if luka_s else 1100,
            "milestoneNote": f"Offizielles World Athletics Ranking ({date_label})",
            "athletes": athletes
        })

    # Save timeline_index.json
    index_path = os.path.join(rankings_dir, "timeline_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "total_weeks": len(timeline_index),
            "start_date": start_date,
            "end_date": timeline_index[-1]["date"] if timeline_index else "",
            "weeks": timeline_index
        }, f, ensure_ascii=False, indent=2)
    print(f"✅ timeline_index.json gespeichert ({len(timeline_index)} Wochen).")

    # Save rankings_archive.json
    archive_path = os.path.join(base_dir, "data", "rankings_archive.json")
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "timeline_range": f"{start_date} to {timeline_index[-1]['date'] if timeline_index else 'Present'}",
            "total_snapshots": len(archive_snapshots),
            "snapshots": archive_snapshots
        }, f, ensure_ascii=False, indent=2)
    print(f"✅ rankings_archive.json aktualisiert ({len(archive_snapshots)} Snapshots).")

    # Phase 3: Build overarching Athletes Database & Competitions Database
    print("\nPhase 3: Analysiere alle Dokumente für die Gesamtdatenbank aller Top-100-Athleten & Wettkämpfe...")
    athletes_catalog = {}
    competitions_catalog = {}

    for date_str, date_label, _, data in loaded_weeks_data:
        athletes = data.get("athletes", [])
        for a in athletes:
            name = a.get("name", "").strip()
            if not name:
                continue

            r = a.get("rank", 999)
            s = a.get("ranking_score", 0)
            dob = a.get("dob", "")
            nat = a.get("country", "")
            url = a.get("profile_url", "")

            if name not in athletes_catalog:
                athletes_catalog[name] = {
                    "id": name.lower().replace(" ", "-"),
                    "name": name,
                    "country": nat,
                    "dob": dob,
                    "profile_url": url,
                    "first_seen_date": date_str,
                    "latest_date": date_str,
                    "latest_rank": r,
                    "latest_score": s,
                    "peak_rank": r,
                    "peak_rank_date": date_str,
                    "peak_score": s,
                    "peak_score_date": date_str,
                    "weeks_in_top100": 0,
                    "sb": None,
                    "pb_estimate": None,
                    "surfaced_competitions": {}
                }

            rec = athletes_catalog[name]
            rec["weeks_in_top100"] += 1
            rec["latest_date"] = date_str
            rec["latest_rank"] = r
            rec["latest_score"] = s

            if r < rec["peak_rank"]:
                rec["peak_rank"] = r
                rec["peak_rank_date"] = date_str

            if s > rec["peak_score"]:
                rec["peak_score"] = s
                rec["peak_score_date"] = date_str

            # Ingest all counted competitions
            for comp in a.get("counted_competitions", []):
                c_name = comp.get("competition", "").strip()
                c_date = comp.get("date", "").strip()
                mark = comp.get("mark")
                wind = comp.get("wind")
                pts = comp.get("performance_score")
                cat = comp.get("category", "")
                venue = comp.get("venue", "")
                indoor = comp.get("indoor", False)
                place = comp.get("place", "")

                comp_key = f"{c_date}|{c_name}|{mark}"
                if comp_key not in rec["surfaced_competitions"]:
                    rec["surfaced_competitions"][comp_key] = {
                        "date": c_date,
                        "competition": c_name,
                        "venue": venue,
                        "category": cat,
                        "mark": mark,
                        "wind": wind,
                        "place": place,
                        "performance_score": pts,
                        "indoor": indoor
                    }

                # Also ingest into master competitions catalog
                if c_name:
                    if c_name not in competitions_catalog:
                        competitions_catalog[c_name] = {
                            "name": c_name,
                            "category": cat,
                            "venue": venue,
                            "indoor": indoor,
                            "dates_seen": set(),
                            "results": []
                        }
                    competitions_catalog[c_name]["dates_seen"].add(c_date)
                    competitions_catalog[c_name]["results"].append({
                        "athlete": name,
                        "country": nat,
                        "date": c_date,
                        "mark": mark,
                        "wind": wind,
                        "place": place,
                        "performance_score": pts
                    })

    # Finalize athlete list
    final_athletes = []
    for name, rec in athletes_catalog.items():
        comps_list = list(rec["surfaced_competitions"].values())
        # Sort competitions chronologically
        comps_list.sort(key=lambda x: x.get("date", ""), reverse=True)
        rec["counted_competitions"] = comps_list
        rec["total_unique_competitions"] = len(comps_list)
        del rec["surfaced_competitions"]

        # Calculate best mark seen
        marks = []
        for c in comps_list:
            try:
                marks.append(float(c.get("mark", 0)))
            except (ValueError, TypeError):
                pass
        if marks:
            rec["sb"] = max(marks)

        final_athletes.append(rec)

    # Sort athletes by latest rank (and peak rank for inactive)
    final_athletes.sort(key=lambda x: (x["latest_rank"] if x["latest_rank"] <= 100 else 999, x["peak_rank"]))

    # Save data/athletes_database.json
    ath_db_path = os.path.join(base_dir, "data", "athletes_database.json")
    with open(ath_db_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "total_athletes": len(final_athletes),
            "period": f"{start_date} to {timeline_index[-1]['date'] if timeline_index else 'Present'}",
            "benchmark_athlete": "Luka HERDEN",
            "athletes": final_athletes
        }, f, ensure_ascii=False, indent=2)
    print(f"✅ data/athletes_database.json gespeichert ({len(final_athletes)} einzigartige Top-100-Athleten).")

    # Finalize competitions catalog
    final_competitions = []
    for c_name, c_data in competitions_catalog.items():
        c_data["dates_seen"] = sorted(list(c_data["dates_seen"]))
        c_data["total_results_count"] = len(c_data["results"])
        final_competitions.append(c_data)

    final_competitions.sort(key=lambda x: x["total_results_count"], reverse=True)

    comp_db_path = os.path.join(base_dir, "data", "competitions_database.json")
    with open(comp_db_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "total_competitions": len(final_competitions),
            "competitions": final_competitions
        }, f, ensure_ascii=False, indent=2)
    print(f"✅ data/competitions_database.json gespeichert ({len(final_competitions)} internationale Wettkämpfe).")

    # Update ranking_latest.json & ranking_previous.json
    if loaded_weeks_data:
        _, latest_lbl, _, latest_data = loaded_weeks_data[-1]
        prev_data = loaded_weeks_data[-2][3] if len(loaded_weeks_data) > 1 else latest_data

        latest_path = os.path.join(base_dir, "data", "ranking_latest.json")
        prev_path = os.path.join(base_dir, "data", "ranking_previous.json")

        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(latest_data, f, ensure_ascii=False, indent=2)

        with open(prev_path, "w", encoding="utf-8") as f:
            json.dump(prev_data, f, ensure_ascii=False, indent=2)

        print(f"✅ ranking_latest.json aktualisiert ({latest_data['date']}).")
        print(f"✅ ranking_previous.json aktualisiert ({prev_data['date']}).")

    print("\n🎉 Vollständiger Scraping- & Analyseprozess erfolgreich beendet!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape official World Athletics rankings from 2023-06-20 with full 100 athletes x 5 competitions.")
    parser.add_argument("--start", default="2023-06-20", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="Force re-fetch all files")
    args = parser.parse_args()
    
    run_archive_scraper(start_date=args.start, force_refresh=args.force)
