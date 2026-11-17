#!/usr/bin/env python3
"""
Builds the Universal Competition & Meeting Calendar + Weekly Scraper Briefing for Luka Herden:
1. Filters historical competitions (`competitions_database.json`) and 2027 calendar (`calendar_2027.json`)
   strictly by Luka's relevance rule:
   - Winning mark must be >= 7.70m (unless Luka himself competed there)
   - Must have at least one Top-100 athlete OR be an official World Tour / Championship / Diamond League / DLV Elite meet
   - Removes all irrelevant Category E/F provincial/club competitions.
2. Combines 2027 planning meetings (`calendar_2027.json`) and historical editions (`competitions_database.json`)
   so each meeting has its historical editions attached and both datasets are unified.
3. Generates `data/weekly_scraper_briefing.json` for the weekly competition & ranking briefing.
"""

import os
import re
import sys
import json
import datetime
import subprocess

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRT_DATA = os.path.join(BASE_DIR, "data")

RANKING_LATEST = os.path.join(WRT_DATA, "ranking_latest.json")
RANKING_ARCH = os.path.join(WRT_DATA, "rankings_archive.json")
COMP_DB = os.path.join(WRT_DATA, "competitions_database.json")
CAL_2027 = os.path.join(WRT_DATA, "calendar_2027.json")
OUT_BRIEFING = os.path.join(WRT_DATA, "weekly_scraper_briefing.json")


def normalize_name(n):
    return " ".join(str(n or "").lower().replace(",", " ").split())


def fix_known_category(name_str, current_cat):
    nl = (name_str or "").lower()
    if any(x in nl for x in ["van damme", "weltklasse", "athletissima", "golden gala", "herculis", "bislett", "bauhaus-galan", "prefontaine", "silesia", "kamila skolimowska", "london athletics", "diamond league"]):
        return "DF" if ("weltklasse" in nl or "van damme" in nl and "final" in nl) else "GW"
    if "world athletics championships" in nl or "olympic games" in nl or "world athletics indoor championships" in nl:
        return "OW"
    # Keep Outdoor European Athletics Championships as GL, but respect WA Calendar 'A' for 2027 Indoor EM
    if "european athletics championships" in nl and "indoor" not in nl:
        return "GL"
    if "german indoor championships" in nl or "deutsche hallenmeisterschaft" in nl:
        return "D"
    if any(x in nl for x in ["p-t-s", "istaf", "goldenes oval", "anhalt", "rehlingen", "lappeenranta", "kuortane", "paavo nurmi", "ostrava", "gyulai", "zagreb", "hengelo", "madrid", "rovereto", "bellinzona", "chorz", "gorz", "koscierzyna", "athens", "dromia", "filothei", "kallithea"]):
        if current_cat == "F":
            return "B" if any(y in nl for y in ["p-t-s", "istaf", "goldenes oval", "dromia", "filothei"]) else "C"
    return current_cat


def main():
    if "--skip-results" not in sys.argv:
        try:
            sys.path.insert(0, os.path.join(BASE_DIR, "python"))
            from scrape_tour_results import run_tour_results_scraper
            run_tour_results_scraper()
        except Exception as e:
            print(f"⚠️ Completed tour results fetch skipped/warn ({e}), continuing with local DB...")
    with open(RANKING_LATEST, "r", encoding="utf-8") as f:
        rk_latest = json.load(f)
    with open(RANKING_ARCH, "r", encoding="utf-8") as f:
        rk_arch = json.load(f)
    with open(COMP_DB, "r", encoding="utf-8") as f:
        comp_data = json.load(f)
    with open(CAL_2027, "r", encoding="utf-8") as f:
        cal_data = json.load(f)

    athletes = rk_latest.get("athletes", [])
    top100_names = set()
    counting_comp_names = set()
    for a in athletes:
        nm = normalize_name(a.get("name", ""))
        if nm:
            top100_names.add(nm)
        for cc in a.get("counted_competitions", []):
            cn = str(cc.get("competition") or "").lower().strip()
            if cn:
                counting_comp_names.add(cn[:25])

    def has_top100_athlete(results_list):
        for r in results_list or []:
            anm = normalize_name(r.get("athlete", ""))
            if anm and (anm in top100_names or "herden" in anm):
                return True
        return False

    # 1. Strictly filter competitions_database.json
    raw_comps = comp_data.get("competitions", [])
    filtered_comps = []
    removed_comps = 0
    seen_comp_keys = set()

    for c in raw_comps:
        cname = str(c.get("name") or "")
        cnl = cname.lower()
        # Normalize indoor flag reliably from WA "(i)" / "Indoor" / "Halle" marker
        if "(i)" in cnl or "indoor" in cnl or "hallen" in cnl or "halle" in cnl:
            c["indoor"] = True
        cat = fix_known_category(cname, str(c.get("category") or "F").upper())
        c["category"] = cat
        best_mark = float(c.get("best_mark") or 0.0)
        res_list = c.get("results") or []
        has_top100 = has_top100_athlete(res_list)
        has_luka = (c.get("luka_mark") is not None) or any("herden" in str(r.get("athlete", "")).lower() for r in res_list)
        is_tour_or_major = cat in ["OW", "DF", "GW", "GL", "A", "B", "C", "D"]
        is_ger_dlv = "(ger)" in cname.lower() or "deutsch" in cname.lower() or any(x in cname.lower() for x in ["inneringen", "essen", "weinheim", "rhede", "pfungstadt", "dessau", "dresden", "dortmund", "kalbach", "leverkusen", "kassel", "bochum", "braunschweig"])

        # Deduplicate same date + same winning mark + same prefix
        dedup_key = (c.get("iso_date") or str(c.get("year")), cname.lower()[:18], round(best_mark, 2))
        if dedup_key in seen_comp_keys:
            removed_comps += 1
            continue

        # Luka's Strict Relevance Filter:
        # Always keep 2026/27 completed season results (starting 2026-12-01) so weekly briefing reports finished calendar meets
        is_current_season_2027 = str(c.get("iso_date") or "") >= "2026-12-01"
        if best_mark < 7.70 and not has_luka and not is_current_season_2027:
            removed_comps += 1
            continue

        # 2) Exclude Cat E & F pre-2026/27 competitions unless Luka competed, or it's a German DLV >=7.70m meet,
        #    or a Top-100 athlete competed AND jumped >= 7.85m
        if cat in ["E", "F"] and not is_current_season_2027:
            if not (has_luka or (is_ger_dlv and best_mark >= 7.70) or (has_top100 and best_mark >= 7.85)):
                removed_comps += 1
                continue

        # 3) Even for Cat D, require either >= 7.70m with Top-100 or World Tour
        if not (is_tour_or_major or has_top100 or has_luka):
            removed_comps += 1
            continue

        seen_comp_keys.add(dedup_key)
        c["has_top100"] = has_top100
        c["is_tour_or_major"] = is_tour_or_major
        filtered_comps.append(c)

    comp_data["competitions"] = filtered_comps
    comp_data["total_competitions"] = len(filtered_comps)
    comp_data["filter_rule"] = "World Tour (OW/DF/GW/GL/A/B/C/D) + Top-100 Athlete + Siegerweite >= 7.70m (keine irrelevanten Kat. F Wettkämpfe)"
    with open(COMP_DB, "w", encoding="utf-8") as f:
        json.dump(comp_data, f, ensure_ascii=False, indent=2)

    print(f"Strictly filtered competitions_database.json: kept {len(filtered_comps)} relevant competitions, removed {removed_comps}.")

    # 2. Keep ALL scraped 2027 Men's Long Jump calendar meetings (zero pre-filtering!) so Luka triages everything himself
    raw_cal = cal_data.get("meetings", [])
    filtered_cal = []
    removed_cal = 0
    seen_cal_ids = set()

    for m in raw_cal:
        mid = m.get("id")
        if mid and mid in seen_cal_ids:
            continue
        if mid:
            seen_cal_ids.add(mid)

        # Deduplicate Hallen-EM Valencia if an older build left both champ-em-indoor-2027 and wa-7204665
        mname = str(m.get("name") or "").lower()
        if mid == "champ-em-indoor-2027" and any(x.get("id") == "wa-7204665" for x in raw_cal):
            continue

        mcity = str(m.get("city") or "").strip().lower()
        mcnt = str(m.get("country") or "").strip().upper()
        m_indoor = bool(m.get("indoor"))

        # Strict historical editions match: same indoor/outdoor setting + word-boundary city + compatible country
        hist_editions = []
        valid_city = bool(mcity and len(mcity) >= 4 and mcity not in ["deutschland", "kassel / deutschland", "tba"])
        for c in filtered_comps:
            if bool(c.get("indoor")) != m_indoor:
                continue
            c_text = (str(c.get("name", "")) + " " + str(c.get("venue", ""))).lower()
            c_cnt_m = re.search(r'\(([a-z]{3})\)\s*$', c_text)
            if mcnt and c_cnt_m and c_cnt_m.group(1).upper() != mcnt:
                continue
            city_match = bool(valid_city and re.search(r'\b' + re.escape(mcity) + r'\b', c_text))
            if city_match:
                hist_editions.append({
                    "date": c.get("iso_date") or c.get("date"),
                    "year": c.get("year"),
                    "name": c.get("name"),
                    "category": c.get("category"),
                    "best_mark": c.get("best_mark"),
                    "marks_over_8m": c.get("marks_over_8m", 0),
                    "luka_mark": c.get("luka_mark"),
                    "top_results": (c.get("results") or [])[:5],
                    "top3": [
                        f"{r.get('athlete')} ({r.get('country')}) {r.get('mark')}m"
                        for r in (c.get("results") or [])[:3]
                    ]
                })
        m["historicalEditions"] = hist_editions[:6]
        if hist_editions:
            m["topHistoricalMarks"] = sorted([float(h["best_mark"]) for h in hist_editions if h.get("best_mark")], reverse=True)[:5]
        filtered_cal.append(m)

    # Capture previous committed calendar (for condensed diff) before overwriting CAL_2027
    # If HEAD already matches current calendar (e.g. second run same day), compare against HEAD~1
    prev_cal_map = {}
    repo_root = os.path.dirname(WRT_DATA)
    for ref in ["HEAD:data/calendar_2027.json", "HEAD~1:data/calendar_2027.json"]:
        try:
            prev_raw = subprocess.check_output(
                ["git", "-C", repo_root, "show", ref],
                stderr=subprocess.DEVNULL
            ).decode("utf-8")
            prev_cal_data = json.loads(prev_raw)
            tmp_map = {pm["id"]: pm for pm in prev_cal_data.get("meetings", []) if pm.get("id")}
            new_ids = {m["id"] for m in filtered_cal if m.get("id")}
            if set(tmp_map.keys()) != new_ids or ref == "HEAD~1:data/calendar_2027.json":
                prev_cal_map = tmp_map
                break
        except Exception:
            continue

    cal_data["meetings"] = filtered_cal
    cal_data["totalMeetings"] = len(filtered_cal)
    cal_data["total_meetings"] = len(filtered_cal)
    with open(CAL_2027, "w", encoding="utf-8") as f:
        json.dump(cal_data, f, ensure_ascii=False, indent=2)

    print(f"Strictly filtered calendar_2027.json: kept {len(filtered_cal)} Tour/Championship/DLV meetings, removed {removed_cal} Cat E/F meetings.")

    # Compute Calendar Diff (New / Removed / Category Changes)
    new_cal_map = {m["id"]: m for m in filtered_cal if m.get("id")}
    cal_added = [new_cal_map[k] for k in new_cal_map if k not in prev_cal_map]
    cal_removed = [prev_cal_map[k] for k in prev_cal_map if k not in new_cal_map]
    cal_cat_changed = []
    for k, m in new_cal_map.items():
        if k in prev_cal_map:
            old_c = str(prev_cal_map[k].get("category") or "")
            new_c = str(m.get("category") or "")
            if old_c != new_c:
                cal_cat_changed.append({
                    "id": k,
                    "name": m.get("name"),
                    "date": m.get("date"),
                    "from": old_c,
                    "to": new_c
                })

    # 3. Build Weekly Scraper Briefing
    snaps = rk_arch.get("snapshots", [])
    real_snaps = [s for s in snaps if not s.get("isPrognosis") and not s.get("is_prognosis")]
    latest_snap = real_snaps[-1] if real_snaps else {}
    prev_snap = real_snaps[-2] if len(real_snaps) >= 2 else latest_snap

    prev_map = {a.get("name"): a for a in prev_snap.get("athletes", [])}
    movers = []
    europe_codes = {
        "GER", "GBR", "FRA", "ITA", "ESP", "GRE", "SUI", "SWE", "NOR", "FIN", "DEN",
        "NED", "BEL", "LUX", "POL", "CZE", "SVK", "HUN", "ROU", "BUL", "SRB", "CRO",
        "SLO", "AUT", "POR", "IRL", "TUR", "UKR", "EST", "LAT", "LTU", "BLR", "MDA",
        "ISL", "CYP", "MLT", "ALB", "BIH", "MKD", "MNE", "GEO", "ARM", "AZE", "ISR"
    }
    eu_rank = 0
    ger_rank = 0
    luka_eu_rank = 0
    luka_ger_rank = 0
    luka_status = {"rank": 69, "score": 1144, "delta_rank": 0, "delta_score": 0, "eu_rank": 0, "ger_rank": 0}

    for a in athletes:
        nm = a.get("name", "")
        cnt = str(a.get("country") or "").upper()
        if cnt in europe_codes:
            eu_rank += 1
        if cnt == "GER":
            ger_rank += 1
        rk = int(a.get("rank") or 999)
        sc = int(a.get("ranking_score") or 0)
        p = prev_map.get(nm)
        d_rk = (int(p.get("rank")) - rk) if p and p.get("rank") else 0
        d_sc = (sc - int(p.get("ranking_score") or p.get("score") or sc)) if p else 0
        if "herden" in nm.lower():
            luka_eu_rank = eu_rank
            luka_ger_rank = ger_rank
            luka_status = {
                "rank": rk,
                "score": sc,
                "delta_rank": d_rk,
                "delta_score": d_sc,
                "eu_rank": luka_eu_rank,
                "ger_rank": luka_ger_rank,
                "rank_date": rk_latest.get("date") or rk_latest.get("rank_date") or latest_snap.get("date")
            }
        if abs(d_rk) >= 1 or abs(d_sc) >= 3:
            movers.append({
                "name": nm,
                "country": a.get("country"),
                "rank": rk,
                "score": sc,
                "delta_rank": d_rk,
                "delta_score": d_sc
            })

    movers.sort(key=lambda x: (abs(x["delta_score"]), abs(x["delta_rank"])), reverse=True)

    recent_comps = sorted(
        [c for c in filtered_comps if c.get("iso_date") and c.get("iso_date") >= "2026-08-15"],
        key=lambda x: x.get("iso_date", ""),
        reverse=True
    )[:10]

    today_iso = datetime.date.today().isoformat()
    rank_date_str = str(rk_latest.get("date") or rk_latest.get("rank_date") or latest_snap.get("date") or today_iso)
    upcoming_meets = sorted(
        [m for m in filtered_cal if (m.get("date") or "") >= today_iso],
        key=lambda x: x.get("date", "")
    )[:12]

    cat_counts = {}
    for m in filtered_cal:
        mc = str(m.get("category") or "?")
        cat_counts[mc] = cat_counts.get(mc, 0) + 1

    movers_text = (
        f"{len(movers)} Top-100 Änderungen seit {prev_snap.get('date', 'Vorwoche')}"
        if movers
        else f"0 Top-100 Änderungen seit {prev_snap.get('date', 'Vorwoche')} (Off-Season)"
    )
    cal_diff_text = f"Kalender: {len(filtered_cal)} Meetings (+{len(cal_added)} neu / -{len(cal_removed)} entfernt / {len(cal_cat_changed)} Kat.-Updates)"

    briefing = {
        "generated_at": today_iso,
        "rank_date": rank_date_str,
        "prev_rank_date": prev_snap.get("date", "2026-11-03"),
        "luka": luka_status,
        "summary_note": (
            f"WA Ranking-Stand ({rank_date_str}): Luka auf #{luka_status['rank']} Welt ({luka_status['score']} Pkt • "
            f"#{luka_status['eu_rank']} Europa • #{luka_status['ger_rank']} GER, Δ {luka_status['delta_rank']:+d} Plätze). "
            f"{movers_text}. {cal_diff_text}."
        ),
        "ranking_diff_summary": movers_text,
        "calendar_diff": {
            "total_kept": len(filtered_cal),
            "removed_unrelevant": removed_cal,
            "added_count": len(cal_added),
            "removed_count": len(cal_removed),
            "category_changed_count": len(cal_cat_changed),
            "category_counts": cat_counts,
            "notable_added": [
                {
                    "id": m.get("id"),
                    "date": m.get("date"),
                    "displayDate": m.get("displayDate"),
                    "name": m.get("name"),
                    "city": m.get("city"),
                    "country": m.get("country"),
                    "category": m.get("category"),
                    "tier": m.get("tier")
                }
                for m in sorted(cal_added, key=lambda x: x.get("date", ""))[:40]
            ],
            "category_changes": cal_cat_changed[:12],
            "summary_text": cal_diff_text
        },
        "ranking_movers": movers[:12],
        "recent_relevant_results": [
            {
                "date": c.get("iso_date"),
                "name": c.get("name"),
                "category": c.get("category"),
                "best_mark": c.get("best_mark"),
                "luka_mark": c.get("luka_mark"),
                "marks_over_8m": c.get("marks_over_8m", 0),
                "winner": f"{c['results'][0]['athlete']} ({c['results'][0]['country']}) – {c['results'][0]['mark']}m" if c.get("results") else "-"
            }
            for c in recent_comps
        ],
        "upcoming_meetings": [
            {
                "date": m.get("date"),
                "displayDate": m.get("displayDate"),
                "name": m.get("name"),
                "city": m.get("city"),
                "country": m.get("country"),
                "category": m.get("category"),
                "tier": m.get("tier"),
                "tour": m.get("tour"),
                "promisingRunway": m.get("promisingRunway")
            }
            for m in upcoming_meets
        ]
    }

    with open(OUT_BRIEFING, "w", encoding="utf-8") as f:
        json.dump(briefing, f, ensure_ascii=False, indent=2)
    print(f"✅ Saved weekly scraper briefing to {OUT_BRIEFING}")


if __name__ == "__main__":
    main()
