#!/usr/bin/env python3
"""
python/scrape_tour_results.py

Scrapes complete Men's Long Jump competition result lists from World Athletics:
- World Athletics Indoor Tour (seasons 2024/25, 2025/26, 2026/27)
- World Athletics Continental Tour (seasons 2025, 2026, 2027)
Merges with data/competitions_database.json, cleans HTML entities, computes ISO dates,
deduplicates athlete results, and sorts strictly chronologically.
"""

import os
import re
import ssl
import json
import html
import urllib.request
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMP_DB_PATH = os.path.join(BASE_DIR, "data", "competitions_database.json")

GRAPHQL_ENDPOINT = "https://ptibh4tbzjfmnjn7c5jj6bu2ai.appsync-api.eu-west-1.amazonaws.com/graphql"
GRAPHQL_API_KEY = "da2-q7toieeiobcjxbov4abq3abk5u"
CTX = ssl._create_unverified_context()

MONTHS = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04",
    "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08",
    "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
}
INV_MONTHS = {v: k for k, v in MONTHS.items()}

RESULTS_QUERY = """
query GetRes($cid: Int!) {
  getCalendarCompetitionResults(competitionId: $cid) {
    eventTitles {
      rankingCategory
      events {
        event
        gender
        races {
          date
          race
          results {
            place
            mark
            wind
            points
            nationality
            competitor { name }
          }
        }
      }
    }
  }
}
"""

def parse_to_iso(d_str):
    if not d_str:
        return ""
    s = str(d_str).strip().upper()
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    m = re.match(r"^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})", s)
    if m:
        dd = int(m.group(1))
        mm = MONTHS.get(m.group(2), "01")
        yyyy = m.group(3)
        return f"{yyyy}-{mm}-{dd:02d}"
    return ""

def iso_to_display(iso_str):
    if not iso_str or not re.match(r"^\d{4}-\d{2}-\d{2}$", iso_str):
        return iso_str
    y, m, d = iso_str.split("-")
    return f"{int(d):02d} {INV_MONTHS.get(m, m)} {y}"

def fetch_tour_events_graphql(season, group_id, tour_name):
    query = f'''query {{
      getMinisiteCalendarEvents(season: "{season}", competitionGroupId: {group_id}) {{
        results {{
          id
          name
          startDate
          venue
          country
          rankingCategory
          competitionSubgroup
        }}
      }}
    }}'''
    payload = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(GRAPHQL_ENDPOINT, data=payload, headers={
        "Content-Type": "application/json",
        "x-api-key": GRAPHQL_API_KEY,
        "User-Agent": "Mozilla/5.0"
    })
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("data", {}).get("getMinisiteCalendarEvents", {}).get("results", [])
            for ev in results:
                ev["tour_type"] = tour_name
            return results
    except Exception as e:
        print(f"⚠️ Error fetching {tour_name} ({season}): {e}")
        return []

def fetch_lj_results_for_event(ev):
    cid = ev.get("id")
    if not cid:
        return None
    payload = json.dumps({"query": RESULTS_QUERY, "variables": {"cid": cid}}).encode("utf-8")
    req = urllib.request.Request(GRAPHQL_ENDPOINT, data=payload, headers={
        "Content-Type": "application/json",
        "x-api-key": GRAPHQL_API_KEY,
        "User-Agent": "Mozilla/5.0"
    })
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        res_obj = (data.get("data") or {}).get("getCalendarCompetitionResults")
        if not res_obj:
            return None
        lj_results = []
        cat = ev.get("rankingCategory") or "D"
        for et in res_obj.get("eventTitles") or []:
            if et.get("rankingCategory"):
                cat = et["rankingCategory"]
            for e_item in et.get("events") or []:
                ev_name = (e_item.get("event") or "").lower()
                gender = (e_item.get("gender") or "").upper()
                if "long jump" in ev_name and gender in ["M", "MEN"]:
                    for race in e_item.get("races") or []:
                        r_name = race.get("race") or "Finale"
                        r_date = race.get("date") or iso_to_display(ev.get("startDate", ""))
                        for r in race.get("results") or []:
                            comp_name_ath = html.unescape(((r.get("competitor") or {}).get("name") or "").strip())
                            mark_str = str(r.get("mark") or "").strip()
                            if not comp_name_ath or not mark_str:
                                continue
                            pts = r.get("points")
                            try:
                                m_val = float(mark_str.replace(",", ".").replace("m", ""))
                                if not pts and m_val > 5.0:
                                    pts = int(round((m_val - 7.89) * 218 + 1156))
                            except Exception:
                                pass
                            lj_results.append({
                                "athlete": comp_name_ath,
                                "country": r.get("nationality") or "",
                                "date": r_date,
                                "mark": mark_str,
                                "place": r.get("place") or "",
                                "performance_score": pts,
                                "round": r_name,
                                "remark": "",
                                "wind": r.get("wind")
                            })
        if not lj_results:
            return None
        iso_d = ev.get("startDate", "")
        yr = int(iso_d[:4]) if iso_d and len(iso_d) >= 4 else 2026
        is_ind = "indoor" in (ev.get("tour_type") or "").lower() or "(i)" in (ev.get("name") or "").lower()
        ev_title = ev.get("name", "")
        ev_venue = ev.get("venue", "")
        return {
            "wa_id": cid,
            "name": f"{ev_title}, {ev_venue}" if ev_venue and ev_venue not in ev_title else ev_title,
            "raw_name": ev_title,
            "tour": ev.get("tour_type"),
            "round": "Finale",
            "year": yr,
            "iso_date": iso_d,
            "category": cat,
            "venue": ev_venue,
            "indoor": is_ind,
            "dates_seen": [iso_to_display(iso_d)] if iso_d else [],
            "results": lj_results
        }
    except Exception:
        return None

def run_tour_results_scraper():
    print("=== World Athletics Tour (Indoor & Continental) Men's Long Jump Results Scraper ===")
    comp_db = {"event": "Men's Long Jump", "competitions": []}
    if os.path.exists(COMP_DB_PATH):
        with open(COMP_DB_PATH, "r", encoding="utf-8") as f:
            comp_db = json.load(f)

    existing_comps = comp_db.get("competitions", [])
    print(f"Loaded {len(existing_comps)} existing competitions from database.")

    tours = [
        ("2025/26", 3677, "World Athletics Indoor Tour"),
        ("2026", 3773, "World Athletics Continental Tour"),
        ("2024/25", 3677, "World Athletics Indoor Tour"),
        ("2025", 3773, "World Athletics Continental Tour"),
    ]
    all_tour_events = []
    seen_ids = set()
    for season, gid, tname in tours:
        evts = fetch_tour_events_graphql(season, gid, tname)
        for e in evts:
            if e.get("id") not in seen_ids:
                seen_ids.add(e.get("id"))
                all_tour_events.append(e)

    print(f"Inspecting {len(all_tour_events)} World Indoor Tour & Continental Tour meetings for Men's Long Jump results...")
    with ThreadPoolExecutor(max_workers=25) as ex:
        scraped_tour_comps = [r for r in ex.map(fetch_lj_results_for_event, all_tour_events) if r]

    print(f"✅ Scraped full Men's Long Jump result lists from {len(scraped_tour_comps)} Tour meetings!")

    merged_by_key = {}
    for c in existing_comps + scraped_tour_comps:
        iso_d = c.get("iso_date") or ""
        if not iso_d:
            for ds in (c.get("dates_seen") or []):
                parsed = parse_to_iso(ds)
                if parsed:
                    iso_d = parsed
                    break
        if not iso_d and c.get("results"):
            for r in c["results"]:
                parsed = parse_to_iso(r.get("date"))
                if parsed:
                    iso_d = parsed
                    break
        yr_fallback = c.get("year") or 2025
        c["iso_date"] = iso_d or f"{yr_fallback}-01-01"
        c["year"] = int(c["iso_date"][:4]) if len(c["iso_date"]) >= 4 and c["iso_date"][:4].isdigit() else yr_fallback
        c["name"] = html.unescape(c.get("name", ""))
        c["raw_name"] = html.unescape(c.get("raw_name", c["name"]))

        norm_name = re.sub(r"[^a-z0-9]", "", c["raw_name"].lower())[:24]
        norm_key = (c["iso_date"], norm_name)
        if norm_key not in merged_by_key:
            merged_by_key[norm_key] = c
        else:
            existing = merged_by_key[norm_key]
            if c.get("tour"):
                existing["tour"] = c["tour"]
            if c.get("wa_id"):
                existing["wa_id"] = c["wa_id"]
            if c.get("venue") and not existing.get("venue"):
                existing["venue"] = c["venue"]
            existing["results"].extend(c.get("results", []))

    def mark_float(res_item):
        try:
            return float(str(res_item.get("mark", 0)).replace(",", ".").replace("m", ""))
        except Exception:
            return 0.0

    final_comps = []
    for _, c in merged_by_key.items():
        seen_res = set()
        clean_res = []
        for r in c.get("results", []):
            ath_name = html.unescape(str(r.get("athlete") or "").strip())
            r["athlete"] = ath_name
            mark_str = str(r.get("mark") or "").strip()
            rk = (ath_name.lower(), mark_str)
            if rk in seen_res:
                continue
            seen_res.add(rk)
            clean_res.append(r)

        clean_res.sort(key=mark_float, reverse=True)
        marks_f = [mark_float(r) for r in clean_res if mark_float(r) > 5.0]
        luka_m = next((mark_float(r) for r in clean_res if "herden" in r["athlete"].lower()), None)

        c["results"] = clean_res
        c["results_count"] = len(clean_res)
        c["total_results_count"] = len(clean_res)
        c["best_mark"] = round(max(marks_f), 2) if marks_f else None
        c["avg_mark"] = round(sum(marks_f) / len(marks_f), 2) if marks_f else None
        c["marks_over_8m"] = sum(1 for m in marks_f if m >= 8.0)
        c["luka_mark"] = round(luka_m, 2) if luka_m else None
        if not c.get("dates_seen") and c.get("iso_date"):
            c["dates_seen"] = [iso_to_display(c["iso_date"])]
        final_comps.append(c)

    # Sort strictly chronologically descending by iso_date
    final_comps.sort(key=lambda x: (x.get("iso_date", ""), x.get("best_mark") or 0), reverse=True)

    comp_db["total_competitions"] = len(final_comps)
    comp_db["updated_at"] = datetime.now().isoformat()
    comp_db["competitions"] = final_comps

    with open(COMP_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(comp_db, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved {len(final_comps)} chronologically sorted competitions to {COMP_DB_PATH}!")

if __name__ == "__main__":
    run_tour_results_scraper()
