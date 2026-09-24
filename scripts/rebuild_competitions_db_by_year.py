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

    # Key: (raw_name, year) -> metadata + all collected results
    comps_collected = {}

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
                
                cat = c.get("category", "")
                venue = c.get("venue", "")
                indoor = c.get("indoor", False)
                mark = c.get("mark")
                wind = c.get("wind")
                place = str(c.get("place", "")).strip().replace(".", "")
                pts = c.get("performance_score")
                placing_score = c.get("placing_score")
                remark = c.get("remark", "")

                unique_key = (raw_name, year)
                if unique_key not in comps_collected:
                    comps_collected[unique_key] = {
                        "raw_name": raw_name,
                        "year": int(year),
                        "category": cat,
                        "venue": venue,
                        "indoor": indoor,
                        "dates_seen": set(),
                        "results_map": {}
                    }

                entry = comps_collected[unique_key]
                if date_str:
                    entry["dates_seen"].add(date_str)
                
                res_key = (ath_name, date_str, str(mark))
                if res_key not in entry["results_map"]:
                    entry["results_map"][res_key] = {
                        "athlete": ath_name,
                        "country": ath_country,
                        "date": date_str,
                        "mark": str(mark) if mark is not None else "-",
                        "raw_place": place,
                        "performance_score": int(pts) if pts is not None else 0,
                        "placing_score": placing_score,
                        "remark": remark,
                        "wind": wind
                    }

    final_competitions = []

    for (raw_name, year), data in comps_collected.items():
        name_with_year = make_year_meeting_name(raw_name, str(year))
        dates_sorted = sorted(list(data["dates_seen"]))
        results_list = list(data["results_map"].values())

        # If a competition has multiple dates (or was a major championship with Quali and Final):
        # We separate it into dedicated "(Finale)" and "(Qualifikation)" competition entries!
        is_multi_day = len(dates_sorted) > 1
        is_championship = any(w in raw_name.lower() for w in ["olympic", "championship", "games", "trials", "spiele", "meisterschaft"])

        if is_multi_day and is_championship:
            final_date = dates_sorted[-1]
            quali_dates = set(dates_sorted[:-1])

            final_results = [r for r in results_list if r["date"] == final_date]
            quali_results = [r for r in results_list if r["date"] in quali_dates]

            # 1. Final Entry
            if final_results:
                final_results.sort(key=lambda r: (
                    int(r["raw_place"]) if r["raw_place"].isdigit() else 999,
                    -float(r["mark"]) if r["mark"] not in ["-", None] else 0.0
                ))
                clean_final_res = []
                for r in final_results:
                    p = r["raw_place"]
                    clean_final_res.append({
                        "athlete": r["athlete"],
                        "country": r["country"],
                        "date": r["date"],
                        "mark": r["mark"],
                        "place": f"{p}. F" if p else "F",
                        "performance_score": r["performance_score"],
                        "round": "Finale",
                        "remark": r["remark"],
                        "wind": r["wind"]
                    })
                
                v_marks = [float(r["mark"]) for r in clean_final_res if r["mark"] not in ["-", None]]
                luka_res = [r for r in clean_final_res if "herden" in r["athlete"].lower()]
                final_competitions.append({
                    "name": f"{name_with_year} (Finale)",
                    "raw_name": raw_name,
                    "round": "Finale",
                    "year": data["year"],
                    "category": data["category"],
                    "venue": data["venue"],
                    "indoor": data["indoor"],
                    "dates_seen": [final_date],
                    "results_count": len(clean_final_res),
                    "best_mark": max(v_marks) if v_marks else None,
                    "avg_mark": round(sum(v_marks) / len(v_marks), 2) if v_marks else None,
                    "marks_over_8m": len([m for m in v_marks if m >= 8.00]),
                    "luka_mark": luka_res[0]["mark"] if luka_res else None,
                    "results": clean_final_res
                })

            # 2. Qualifikation Entry
            if quali_results:
                quali_results.sort(key=lambda r: (
                    int(r["raw_place"]) if r["raw_place"].isdigit() else 999,
                    -float(r["mark"]) if r["mark"] not in ["-", None] else 0.0
                ))
                clean_quali_res = []
                for r in quali_results:
                    p = r["raw_place"]
                    clean_quali_res.append({
                        "athlete": r["athlete"],
                        "country": r["country"],
                        "date": r["date"],
                        "mark": r["mark"],
                        "place": f"{p}. Q" if p else "Q",
                        "performance_score": r["performance_score"],
                        "round": "Qualifikation",
                        "remark": r["remark"],
                        "wind": r["wind"]
                    })

                v_marks = [float(r["mark"]) for r in clean_quali_res if r["mark"] not in ["-", None]]
                luka_res = [r for r in clean_quali_res if "herden" in r["athlete"].lower()]
                final_competitions.append({
                    "name": f"{name_with_year} (Qualifikation)",
                    "raw_name": raw_name,
                    "round": "Qualifikation",
                    "year": data["year"],
                    "category": data["category"],
                    "venue": data["venue"],
                    "indoor": data["indoor"],
                    "dates_seen": sorted(list(quali_dates)),
                    "results_count": len(clean_quali_res),
                    "best_mark": max(v_marks) if v_marks else None,
                    "avg_mark": round(sum(v_marks) / len(v_marks), 2) if v_marks else None,
                    "marks_over_8m": len([m for m in v_marks if m >= 8.00]),
                    "luka_mark": luka_res[0]["mark"] if luka_res else None,
                    "results": clean_quali_res
                })

        else:
            # Single-stage or regular meeting (Finale)
            results_list.sort(key=lambda r: (
                int(r["raw_place"]) if r["raw_place"].isdigit() else 999,
                -float(r["mark"]) if r["mark"] not in ["-", None] else 0.0
            ))
            clean_res = []
            for r in results_list:
                p = r["raw_place"]
                clean_res.append({
                    "athlete": r["athlete"],
                    "country": r["country"],
                    "date": r["date"],
                    "mark": r["mark"],
                    "place": f"{p}." if p else "-",
                    "performance_score": r["performance_score"],
                    "round": "Finale",
                    "remark": r["remark"],
                    "wind": r["wind"]
                })

            valid_marks = [float(r["mark"]) for r in clean_res if r["mark"] not in ["-", None]]
            avg_mark = round(sum(valid_marks) / len(valid_marks), 2) if valid_marks else None
            best_mark = max(valid_marks) if valid_marks else None
            marks_over_8m = len([m for m in valid_marks if m >= 8.00])
            luka_results = [r for r in clean_res if "herden" in r["athlete"].lower()]

            final_competitions.append({
                "name": name_with_year,
                "raw_name": data["raw_name"],
                "round": "Finale",
                "year": data["year"],
                "category": data["category"],
                "venue": data["venue"],
                "indoor": data["indoor"],
                "dates_seen": dates_sorted,
                "results_count": len(clean_res),
                "best_mark": best_mark,
                "avg_mark": avg_mark,
                "marks_over_8m": marks_over_8m,
                "luka_mark": luka_results[0]["mark"] if luka_results else None,
                "results": clean_res
            })

    # Sort competitions chronologically descending (newest first)
    final_competitions.sort(key=lambda c: (c["year"], c["dates_seen"][-1] if c["dates_seen"] else ""), reverse=True)

    print(f"Total year-separated competitions (with Quali/Final separated): {len(final_competitions)}")
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
