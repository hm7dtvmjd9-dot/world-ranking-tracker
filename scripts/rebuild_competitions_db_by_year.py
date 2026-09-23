#!/usr/bin/env python3
"""
scripts/rebuild_competitions_db_by_year.py

Separates recurring competitions in data/competitions_database.json so that each year
is an independent, dedicated competition entry (e.g., Gorzów 2025 vs. Gorzów 2026).
Also computes venue performance benchmarks for Luka and top competitors.
"""

import os
import glob
import json
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANKINGS_DIR = os.path.join(BASE_DIR, "data", "rankings")
COMP_DB_PATH = os.path.join(BASE_DIR, "data", "competitions_database.json")

def extract_year(date_str):
    if not date_str:
        return "2024"
    parts = str(date_str).strip().split()
    for p in reversed(parts):
        if re.match(r"^(19|20)\d{2}$", p):
            return p
    m = re.search(r"(19|20)\d{2}", str(date_str))
    return m.group(0) if m else "2024"

def make_year_meeting_name(base_name, year):
    """
    If base_name already contains the exact year (e.g. 'Budapest 2023' or '2024'), keep it.
    Otherwise, append/insert the year cleanly, e.g. 'Gorzów Jump Festival 2026, Arena Gorzów...'
    """
    if re.search(r'\b' + re.escape(year) + r'\b', base_name):
        return base_name
    
    # Check if there is a comma separating meeting title from venue
    if "," in base_name:
        parts = base_name.split(",", 1)
        return f"{parts[0].strip()} {year},{parts[1]}"
    else:
        return f"{base_name} {year}"

def main():
    ranking_files = sorted(glob.glob(os.path.join(RANKINGS_DIR, "ranking_*.json")))
    print(f"Reading {len(ranking_files)} weekly ranking files to build year-separated competitions catalog...")

    # Key: (comp_name_by_year, year) -> comp_data
    comps_by_year = {}

    for fpath in ranking_files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        for ath in data.get("athletes", []):
            ath_name = ath.get("name", "").strip()
            ath_country = ath.get("country", "").strip()

            for c in ath.get("counted_competitions", []):
                raw_name = c.get("competition", "").strip()
                if not raw_name:
                    continue
                date_str = c.get("date", "").strip()
                year = extract_year(date_str)
                name_with_year = make_year_meeting_name(raw_name, year)
                
                cat = c.get("category", "")
                venue = c.get("venue", "")
                indoor = c.get("indoor", False)
                mark = c.get("mark")
                wind = c.get("wind")
                place = c.get("place", "")
                pts = c.get("performance_score")
                remark = c.get("remark", "")
                round_name = c.get("round", "Finale")
                q_mark = c.get("qualification_mark")
                q_place = c.get("qualification_place")
                q_score = c.get("qualification_score")

                unique_key = (name_with_year, year)
                if unique_key not in comps_by_year:
                    comps_by_year[unique_key] = {
                        "name": name_with_year,
                        "raw_name": raw_name,
                        "year": int(year),
                        "category": cat,
                        "venue": venue,
                        "indoor": indoor,
                        "dates_seen": set(),
                        "results_map": {} # (athlete, date, mark) -> result_obj
                    }

                entry = comps_by_year[unique_key]
                if date_str:
                    entry["dates_seen"].add(date_str)
                
                res_key = (ath_name, date_str, str(mark))
                if res_key not in entry["results_map"]:
                    res_obj = {
                        "athlete": ath_name,
                        "country": ath_country,
                        "date": date_str,
                        "mark": str(mark) if mark is not None else "-",
                        "place": place,
                        "performance_score": int(pts) if pts is not None else 0,
                        "round": round_name,
                        "remark": remark,
                        "wind": wind
                    }
                    if q_mark:
                        res_obj["qualification_mark"] = q_mark
                        res_obj["qualification_place"] = q_place
                        res_obj["qualification_score"] = q_score
                    entry["results_map"][res_key] = res_obj

    final_competitions = []
    for (name_with_year, year), data in comps_by_year.items():
        results_list = list(data["results_map"].values())
        # Sort results: best mark first
        results_list.sort(key=lambda r: float(r["mark"]) if r["mark"] not in ["-", None] else 0.0, reverse=True)
        
        # Calculate summary statistics for runway evaluation
        valid_marks = [float(r["mark"]) for r in results_list if r["mark"] not in ["-", None]]
        avg_mark = round(sum(valid_marks) / len(valid_marks), 2) if valid_marks else None
        best_mark = max(valid_marks) if valid_marks else None
        marks_over_8m = len([m for m in valid_marks if m >= 8.00])
        luka_results = [r for r in results_list if "herden" in r["athlete"].lower()]
        
        dates_sorted = sorted(list(data["dates_seen"]))
        final_competitions.append({
            "name": name_with_year,
            "raw_name": data["raw_name"],
            "year": data["year"],
            "category": data["category"],
            "venue": data["venue"],
            "indoor": data["indoor"],
            "dates_seen": dates_sorted,
            "results_count": len(results_list),
            "best_mark": best_mark,
            "avg_mark": avg_mark,
            "marks_over_8m": marks_over_8m,
            "luka_mark": luka_results[0]["mark"] if luka_results else None,
            "results": results_list
        })

    # Sort competitions chronologically descending (newest first)
    final_competitions.sort(key=lambda c: (c["year"], c["dates_seen"][-1] if c["dates_seen"] else ""), reverse=True)

    print(f"Total year-separated competitions: {len(final_competitions)}")
    with open(COMP_DB_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "total_competitions": len(final_competitions),
            "separated_by_year": True,
            "competitions": final_competitions
        }, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved updated {COMP_DB_PATH} with {len(final_competitions)} competitions.")

if __name__ == "__main__":
    main()
