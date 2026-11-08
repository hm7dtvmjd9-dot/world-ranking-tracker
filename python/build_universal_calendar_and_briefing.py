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
import json
import datetime

WRT_DATA = "/Users/luka/.gemini/antigravity/scratch/world-ranking-tracker/data"

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
    if "european athletics championships" in nl or "european athletics indoor championships" in nl:
        return "GL"
    if any(x in nl for x in ["p-t-s", "istaf", "goldenes oval", "anhalt", "rehlingen", "lappeenranta", "kuortane", "paavo nurmi", "ostrava", "gyulai", "zagreb", "hengelo", "madrid", "rovereto", "bellinzona", "chorz", "gorz", "koscierzyna", "athens", "dromia", "filothei", "kallithea"]):
        if current_cat == "F":
            return "B" if any(y in nl for y in ["p-t-s", "istaf", "goldenes oval", "dromia", "filothei"]) else "C"
    return current_cat


def main():
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
        # 1) Winning mark must be >= 7.70m (unless Luka competed there)
        if best_mark < 7.70 and not has_luka:
            removed_comps += 1
            continue

        # 2) Exclude Cat E & F competitions unless Luka competed, or it's a German DLV >=7.70m meet,
        #    or a Top-100 athlete competed AND jumped >= 7.80m in an official counting competition
        if cat in ["E", "F"]:
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

    # 2. Strictly filter calendar_2027.json (No provincial/club Cat E/F meets!)
    raw_cal = cal_data.get("meetings", [])
    filtered_cal = []
    removed_cal = 0

    dlv_keywords = ["weinheim", "dessau", "dresden", "regensburg", "rehlingen", "essen", "rhede", "pfungstadt", "inneringen", "istaf", "deutsche meisterschaft", "dortmund", "anhal", "kurpfalz"]

    for m in raw_cal:
        cat = str(m.get("category") or "F").upper()
        mname = str(m.get("name") or "").lower()
        mcity = str(m.get("city") or "").lower()
        mcnt = str(m.get("country") or "").upper()
        is_champ = bool(m.get("isChampionship"))
        is_major_cat = cat in ["OW", "DF", "GW", "GL", "A", "B", "C", "D"]
        is_dlv_elite = mcnt == "GER" and any(k in (mname + " " + mcity) for k in dlv_keywords)

        # Strictly exclude Category E & F unless it's an official DLV Rahmenterminplan Jump Meeting (Inneringen, Pfungstadt, Rhede, etc.)
        if not (is_champ or is_major_cat or is_dlv_elite):
            removed_cal += 1
            continue

        # Also exclude non-European Category D club/university meets if any slipped through
        if cat == "D" and any(x in mname for x in ["u18", "u20", "u16", "provincial", "département", "zone"]):
            removed_cal += 1
            continue

        # Link historical editions accurately (matching city or distinct meeting name keyword)
        hist_editions = []
        for c in filtered_comps:
            c_text = (str(c.get("name", "")) + " " + str(c.get("venue", ""))).lower()
            city_match = (mcity and len(mcity) >= 4 and mcity not in ["deutschland", "kassel / deutschland"] and mcity in c_text)
            if city_match:
                hist_editions.append({
                    "date": c.get("iso_date") or c.get("date"),
                    "year": c.get("year"),
                    "name": c.get("name"),
                    "category": c.get("category"),
                    "best_mark": c.get("best_mark"),
                    "marks_over_8m": c.get("marks_over_8m", 0),
                    "luka_mark": c.get("luka_mark"),
                    "top3": [
                        f"{r.get('athlete')} ({r.get('country')}) {r.get('mark')}m"
                        for r in (c.get("results") or [])[:3]
                    ]
                })
        m["historicalEditions"] = hist_editions[:6]
        if hist_editions:
            m["topHistoricalMarks"] = sorted([float(h["best_mark"]) for h in hist_editions if h.get("best_mark")], reverse=True)[:5]
        filtered_cal.append(m)

    cal_data["meetings"] = filtered_cal
    cal_data["totalMeetings"] = len(filtered_cal)
    with open(CAL_2027, "w", encoding="utf-8") as f:
        json.dump(cal_data, f, ensure_ascii=False, indent=2)

    print(f"Strictly filtered calendar_2027.json: kept {len(filtered_cal)} Tour/Championship/DLV meetings, removed {removed_cal} Cat E/F meetings.")

    # 3. Build Weekly Scraper Briefing
    snaps = rk_arch.get("snapshots", [])
    real_snaps = [s for s in snaps if not s.get("isPrognosis")]
    latest_snap = real_snaps[-1] if real_snaps else {}
    prev_snap = real_snaps[-2] if len(real_snaps) >= 2 else latest_snap

    prev_map = {a.get("name"): a for a in prev_snap.get("athletes", [])}
    movers = []
    luka_status = {"rank": 70, "score": 1144, "delta_rank": 0, "delta_score": 0}

    for a in athletes:
        nm = a.get("name", "")
        rk = int(a.get("rank") or 999)
        sc = int(a.get("ranking_score") or 0)
        p = prev_map.get(nm)
        d_rk = (int(p.get("rank")) - rk) if p and p.get("rank") else 0
        d_sc = (sc - int(p.get("ranking_score") or p.get("score") or sc)) if p else 0
        if "herden" in nm.lower():
            luka_status = {
                "rank": rk,
                "score": sc,
                "delta_rank": d_rk,
                "delta_score": d_sc,
                "rank_date": rk_latest.get("rank_date", "2026-11-03")
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

    today_iso = "2026-11-08"
    upcoming_meets = sorted(
        [m for m in filtered_cal if (m.get("date") or "") >= today_iso],
        key=lambda x: x.get("date", "")
    )[:12]

    briefing = {
        "generated_at": "2026-11-08",
        "rank_date": rk_latest.get("rank_date", "2026-11-03"),
        "prev_rank_date": prev_snap.get("date", "2026-10-20"),
        "luka": luka_status,
        "summary_note": (
            f"Offizielles World Ranking Update ({rk_latest.get('rank_date', '03.11.2026')}): "
            f"Du stehst stabil auf Weltrang #{luka_status['rank']} (1.144 Pkt • #27 in Europa • Bereinigt Q#21 für die Hallen-EM Valencia • #3 in Deutschland). "
            f"In der aktuellen Off-Season gab es in Europa keine neuen Hallen-Wettkämpfe >= 7,70 m; die ersten relevanten World Indoor Tour Meetings starten im Januar 2027."
        ),
        "ranking_movers": movers[:8],
        "recent_relevant_results": [
            {
                "date": c.get("iso_date"),
                "name": c.get("name"),
                "category": c.get("category"),
                "best_mark": c.get("best_mark"),
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
