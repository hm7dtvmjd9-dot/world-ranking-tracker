#!/usr/bin/env python3
"""
scripts/normalize_wind_and_rebuild_db.py

1. Normalizes wind in all data/rankings/ranking_*.json files:
   - World Athletics stores raw wind in dm/s (decimeters/s): e.g. -12.0 = -1.2 m/s, -3.0 = -0.3 m/s, +18.0 = +1.8 m/s, +2.0 = +0.2 m/s.
   - Converts to clean '+X.X m/s' / '-X.X m/s' or None for indoor/unmeasured.
2. Updates data/athletes_database.json with clean wind values for all counted competitions.
3. Updates data/competitions_database.json with clean wind values for all competitor results.
4. Updates data/ranking_latest.json and data/ranking_previous.json.
5. Updates data/rankings_archive.json.
"""

import os
import glob
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANKINGS_DIR = os.path.join(BASE_DIR, "data", "rankings")

def normalize_wind(raw):
    if raw is None or raw == "" or str(raw).lower() in ["none", "null", "nan", "-", "none m/s"]:
        return None
    try:
        s = str(raw).replace("m/s", "").strip()
        val = float(s)
        # If absolute value was in dm/s (WA raw format, e.g. -12.0, +18.0, +3.0)
        # Note: if "m/s" was NOT already in the string, it's raw dm/s from WA!
        if "m/s" not in str(raw):
            val = val / 10.0
        if abs(val) < 0.01:
            return "0.0 m/s"
        return f"{val:+.1f} m/s"
    except (ValueError, TypeError):
        return None

def main():
    ranking_files = sorted(glob.glob(os.path.join(RANKINGS_DIR, "ranking_*.json")))
    print(f"Normalizing wind in {len(ranking_files)} weekly ranking files...")

    # Key -> normalized wind mapping: (date, competition_name, mark, athlete_name) -> wind
    wind_lookup = {}

    for fpath in ranking_files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        modified = False
        for ath in data.get("athletes", []):
            ath_name = ath.get("name", "").strip()
            for comp in ath.get("counted_competitions", []):
                raw_w = comp.get("wind")
                clean_w = normalize_wind(raw_w)
                if clean_w != raw_w:
                    comp["wind"] = clean_w
                    modified = True

                c_date = comp.get("date", "").strip()
                c_name = comp.get("competition", "").strip()
                c_mark = str(comp.get("mark", "")).strip()

                if clean_w:
                    key = (c_date, c_name, c_mark, ath_name)
                    wind_lookup[key] = clean_w

        if modified:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ All weekly ranking files normalized. Collected {len(wind_lookup)} wind records.")

    # Update data/athletes_database.json
    ath_db_path = os.path.join(BASE_DIR, "data", "athletes_database.json")
    if os.path.exists(ath_db_path):
        with open(ath_db_path, "r", encoding="utf-8") as f:
            ath_db = json.load(f)

        updated_comps = 0
        for ath in ath_db.get("athletes", []):
            ath_name = ath.get("name", "").strip()
            for comp in ath.get("counted_competitions", []):
                c_date = comp.get("date", "").strip()
                c_name = comp.get("competition", "").strip()
                c_mark = str(comp.get("mark", "")).strip()
                key = (c_date, c_name, c_mark, ath_name)

                if key in wind_lookup:
                    comp["wind"] = wind_lookup[key]
                    updated_comps += 1
                elif comp.get("wind"):
                    comp["wind"] = normalize_wind(comp.get("wind"))

        with open(ath_db_path, "w", encoding="utf-8") as f:
            json.dump(ath_db, f, ensure_ascii=False, indent=2)
        print(f"✅ Updated data/athletes_database.json ({updated_comps} wind values populated).")

    # Update data/competitions_database.json
    comp_db_path = os.path.join(BASE_DIR, "data", "competitions_database.json")
    if os.path.exists(comp_db_path):
        with open(comp_db_path, "r", encoding="utf-8") as f:
            comp_db = json.load(f)

        updated_results = 0
        for meet in comp_db.get("competitions", []):
            c_name = meet.get("name", "").strip()
            for res in meet.get("results", []):
                r_date = res.get("date", "").strip()
                r_mark = str(res.get("mark", "")).strip()
                r_ath = res.get("athlete", "").strip()
                key = (r_date, c_name, r_mark, r_ath)

                if key in wind_lookup:
                    res["wind"] = wind_lookup[key]
                    updated_results += 1
                elif res.get("wind"):
                    res["wind"] = normalize_wind(res.get("wind"))

        with open(comp_db_path, "w", encoding="utf-8") as f:
            json.dump(comp_db, f, ensure_ascii=False, indent=2)
        print(f"✅ Updated data/competitions_database.json ({updated_results} wind values populated).")

    # Update ranking_latest.json and ranking_previous.json
    latest_path = os.path.join(BASE_DIR, "data", "ranking_latest.json")
    if os.path.exists(latest_path):
        with open(latest_path, "r", encoding="utf-8") as f:
            latest_d = json.load(f)
        for ath in latest_d.get("athletes", []):
            for c in ath.get("counted_competitions", []):
                c["wind"] = normalize_wind(c.get("wind"))
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(latest_d, f, ensure_ascii=False, indent=2)

    prev_path = os.path.join(BASE_DIR, "data", "ranking_previous.json")
    if os.path.exists(prev_path):
        with open(prev_path, "r", encoding="utf-8") as f:
            prev_d = json.load(f)
        for ath in prev_d.get("athletes", []):
            for c in ath.get("counted_competitions", []):
                c["wind"] = normalize_wind(c.get("wind"))
        with open(prev_path, "w", encoding="utf-8") as f:
            json.dump(prev_d, f, ensure_ascii=False, indent=2)

    # Update rankings_archive.json
    arch_path = os.path.join(BASE_DIR, "data", "rankings_archive.json")
    if os.path.exists(arch_path):
        with open(arch_path, "r", encoding="utf-8") as f:
            arch_d = json.load(f)
        for snap in arch_d.get("snapshots", []):
            for ath in snap.get("top_athletes", []):
                for c in ath.get("counted_competitions", []):
                    c["wind"] = normalize_wind(c.get("wind"))
        with open(arch_path, "w", encoding="utf-8") as f:
            json.dump(arch_d, f, ensure_ascii=False, indent=2)
        print("✅ Updated data/rankings_archive.json.")

if __name__ == "__main__":
    main()
