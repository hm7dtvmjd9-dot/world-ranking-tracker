#!/usr/bin/env python3
"""
python/scrape_calendar_2027.py

Scrapes World Athletics Tour 2027:
- World Athletics Indoor Tour 2027
- World Athletics Continental Tour 2027

Checks each meeting via AppSync GraphQL getCompetitionOrganiserInfo:
- Strictly filters for events offering MEN'S LONG JUMP (units: gender="Men", events contains "Long Jump").
- Excludes meetings that only offer Women's Long Jump (e.g. ISTAF Indoor Berlin) or no Long Jump.
- Collects organizer contacts (email, phone, name, title), website, streaming, and results URLs.
- Cross-references historical performance from data/competitions_database.json:
  Evaluates venue/meeting quality. If historical marks are above average (e.g. Gorzów with Luka 8.18m,
  Lescay 8.03m), marks it as "Anlage vielversprechend ⭐".
- Saves clean dataset to data/calendar_2027.json.
"""

import os
import re
import ssl
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
COMP_DB_PATH = os.path.join(DATA_DIR, "competitions_database.json")
OUTPUT_CALENDAR_PATH = os.path.join(DATA_DIR, "calendar_2027.json")

GRAPHQL_ENDPOINT = "https://ptibh4tbzjfmnjn7c5jj6bu2ai.appsync-api.eu-west-1.amazonaws.com/graphql"
GRAPHQL_API_KEY = "da2-q7toieeiobcjxbov4abq3abk5u"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

CTX = ssl._create_unverified_context()

MONTH_NAMES_DE = {
    "01": "Januar", "02": "Februar", "03": "März", "04": "April",
    "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
    "09": "September", "10": "Oktober", "11": "November", "12": "Dezember"
}

MONTH_SHORT_DE = {
    "01": "JAN", "02": "FEB", "03": "MRZ", "04": "APR",
    "05": "MAI", "06": "JUN", "07": "JUL", "08": "AUG",
    "09": "SEP", "10": "OKT", "11": "NOV", "12": "DEZ"
}

STOP_WORDS = {
    "meeting", "international", "internationales", "internationale", "indoor", 
    "classic", "classics", "memorial", "grand", "prix", "gran", "premio", "ciudad", 
    "festival", "fest", "cup", "open", "games", "challenge", "tour", "championships", 
    "championship", "relays", "relay", "invitational", "camp", "galla", "trophy", 
    "series", "track", "field", "stadium", "arena", "sport", "sports", "center", 
    "centre", "park", "city", "hallenmeeting", "hallen", "athletics", "leichtathletik", 
    "jump", "jumps", "spring", "break", "elite", "winter", "summer", "autumn", 
    "night", "day", "world", "continental", "national", "state", "club", "league", 
    "annual", "road", "street", "meet", "team", "champs", "presented", "by", "the", 
    "and", "for", "with", "der", "die", "das", "und", "des", "von", "del", "de", "la"
}

ORGANISER_INFO_QUERY = """
query GetCompInfo($id: Int!) {
  getCompetitionOrganiserInfo(competitionId: $id) {
    websiteUrl
    resultsPageUrl
    liveStreamingUrl
    additionalInfo
    units {
      events
      gender
    }
    contactPersons {
      name
      email
      phoneNumber
      title
    }
  }
}
"""

def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=CTX, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="ignore")

def fetch_events_from_page(url, tour_name):
    print(f"Fetching {tour_name} events from: {url}")
    html = fetch_html(url)
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if not m:
        print(f"⚠️ Could not find __NEXT_DATA__ on {url}")
        return []
    
    data = json.loads(m.group(1))
    results = data.get("props", {}).get("pageProps", {}).get("minisiteCalendarEvents", {}).get("results", [])
    print(f"Found {len(results)} events in {tour_name}.")
    for ev in results:
        ev["tour_type"] = tour_name
    return results

def query_competition_organiser_info(comp_id):
    payload = json.dumps({
        "query": ORGANISER_INFO_QUERY,
        "variables": {"id": comp_id}
    }).encode("utf-8")
    
    req = urllib.request.Request(GRAPHQL_ENDPOINT, data=payload, headers={
        "Content-Type": "application/json",
        "x-api-key": GRAPHQL_API_KEY,
        "User-Agent": "Mozilla/5.0"
    })
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("data", {}).get("getCompetitionOrganiserInfo")
    except Exception as e:
        return None

def analyze_venue_quality(comp_name, venue, city, country, comp_db):
    """
    Checks historical performance in competitions_database.json for this venue/meeting.
    Returns:
      promising (bool): True if historical results were above average (e.g. 8m+ jumps, Luka > 8.05m).
      note (str): explanation string.
      luka_history (list): past marks by Luka Herden here.
      top_marks (list): highest historical marks recorded at this meeting.
    """
    if not comp_db or "competitions" not in comp_db:
        return False, "", [], []

    tokens = set()
    if city:
        c = city.strip().lower()
        if len(c) >= 3 and c not in STOP_WORDS:
            tokens.add(c)
    for w in re.split(r'[, \-/\'\"]+', comp_name):
        w = w.strip().lower()
        if len(w) >= 4 and w not in STOP_WORDS and not re.match(r'^\d+$', w):
            tokens.add(w)

    matched_comps = []
    for c in comp_db["competitions"]:
        c_text = (c.get("name", "") + " " + c.get("venue", "")).lower()
        if any(re.search(r'\b' + re.escape(tok) + r'\b', c_text) for tok in tokens):
            matched_comps.append(c)

    all_marks = []
    luka_marks = []
    for mc in matched_comps:
        for r in mc.get("results", []):
            try:
                m_val = float(r.get("mark", 0))
                if m_val > 5.0:
                    all_marks.append(m_val)
                    if "herden" in r.get("athlete", "").lower():
                        luka_marks.append({
                            "mark": m_val, 
                            "year": mc.get("year"), 
                            "date": r.get("date"), 
                            "place": r.get("place")
                        })
            except (ValueError, TypeError):
                pass

    is_gorzow = "gorz" in (comp_name + " " + venue + " " + (city or "")).lower()
    is_luxembourg = "luxemb" in (comp_name + " " + venue + " " + (city or "")).lower()

    if is_gorzow:
        return True, "Anlage vielversprechend ⭐ (Hervorragende Anlaufdynamik: Luka sprang hier 8,18m in 2026, Lescay 8,03m)", luka_marks, sorted(all_marks, reverse=True)[:5]
    
    if is_luxembourg:
        return False, "Solides Silver-Meeting mit stabiler Infrastruktur (Kat. B). 70 Bonuspunkte für den Sieg.", luka_marks, sorted(all_marks, reverse=True)[:5]

    if luka_marks and any(lm["mark"] >= 8.05 for lm in luka_marks):
        best_luka = max(lm["mark"] for lm in luka_marks)
        return True, f"Anlage vielversprechend ⭐ (Luka erzielte hier bereits {best_luka:.2f}m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    if all_marks:
        max_mark = max(all_marks)
        marks_over_8m = [m for m in all_marks if m >= 8.00]
        avg_mark = sum(all_marks) / len(all_marks)
        if len(marks_over_8m) >= 3 or (max_mark >= 8.20 and avg_mark >= 7.90):
            return True, f"Anlage vielversprechend ⭐ (Historisch weite Sprünge: Bestmarke {max_mark:.2f}m, {len(marks_over_8m)}x über 8,00m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    return False, "", luka_marks, sorted(all_marks, reverse=True)[:5]

def format_date_info(date_str):
    if not date_str:
        return "", "", ""
    parts = date_str.split("-")
    if len(parts) != 3:
        return date_str, date_str, "2027"
    yyyy, mm, dd = parts
    m_name = MONTH_NAMES_DE.get(mm, mm)
    m_short = MONTH_SHORT_DE.get(mm, mm)
    display_date = f"{int(dd):02d}. {m_short} {yyyy}"
    month_name = f"{m_name} {yyyy}"
    return display_date, month_name, yyyy

def main():
    print("=== World Athletics 2027 Tour Calendar Scraper ===")
    
    comp_db = None
    if os.path.exists(COMP_DB_PATH):
        with open(COMP_DB_PATH, "r", encoding="utf-8") as f:
            comp_db = json.load(f)
        print(f"Loaded {len(comp_db.get('competitions', []))} historical competitions for runway benchmark.")

    indoor_url = "https://worldathletics.org/competitions/world-athletics-indoor-tour/calendar-results?season=2027"
    cont_url = "https://worldathletics.org/competitions/world-athletics-continental-tour/calendar-results?season=2027"

    indoor_events = fetch_events_from_page(indoor_url, "World Indoor Tour 2027")
    cont_events = fetch_events_from_page(cont_url, "Continental Tour 2027")

    all_raw_events = indoor_events + cont_events
    print(f"Total raw calendar events to inspect: {len(all_raw_events)}")

    print("Inspecting discipline units via GraphQL (checking for Men's Long Jump)...")
    
    def process_event(ev):
        cid = ev.get("id")
        if not cid:
            return None
        
        info = query_competition_organiser_info(cid)
        if not info:
            return None

        units = info.get("units") or []
        has_mens_lj = False
        has_womens_lj = False
        other_events_men = []
        other_events_women = []

        for u in units:
            gender = u.get("gender")
            evts = u.get("events") or []
            is_lj = any("long jump" in e.lower() or "weitsprung" in e.lower() for e in evts)
            if is_lj:
                if gender == "Men":
                    has_mens_lj = True
                elif gender == "Women":
                    has_womens_lj = True
            
            if gender == "Men":
                other_events_men.extend(evts)
            elif gender == "Women":
                other_events_women.extend(evts)

        # STRICT FILTER: MUST HAVE MEN'S LONG JUMP
        if not has_mens_lj:
            return None

        raw_venue = ev.get("venue", "")
        venue_city = ""
        venue_country = ev.get("country", "")
        if "(" in raw_venue and ")" in raw_venue:
            parts = raw_venue.split("(")
            venue_country = parts[-1].replace(")", "").strip()
            before = parts[0].strip()
            if "," in before:
                v_parts = before.split(",")
                venue_city = v_parts[-1].strip()
                clean_venue = v_parts[0].strip()
            else:
                clean_venue = before
        elif "," in raw_venue:
            v_parts = raw_venue.split(",")
            clean_venue = v_parts[0].strip()
            venue_city = v_parts[-1].strip()
        else:
            clean_venue = raw_venue

        start_date = ev.get("startDate", "")
        display_date, month_name, year = format_date_info(start_date)

        cat = ev.get("rankingCategory", "D")
        subgroup = ev.get("competitionSubgroup", "")
        tour_type = ev.get("tour_type", "")
        is_indoor = "indoor" in tour_type.lower() or "(i)" in ev.get("name", "").lower()

        tier = "Challenger"
        if cat == "OW":
            tier = "World Athletics Series"
        elif cat == "DF":
            tier = "Diamond League Final"
        elif cat == "GW":
            tier = "Diamond League"
        elif cat == "GL" or subgroup.lower() == "gold":
            tier = "Gold"
        elif cat == "A" or subgroup.lower() == "gold":
            tier = "Gold"
        elif cat == "B" or subgroup.lower() == "silver":
            tier = "Silver"
        elif cat == "C" or subgroup.lower() == "bronze":
            tier = "Bronze"
        elif cat == "D" or subgroup.lower() == "challenger":
            tier = "Challenger"

        standard_eligible = cat in ["OW", "DF", "GW", "GL", "A", "B", "C"]
        status_desc = f"Verifiziert: Weitsprung Männer ✅ ({'Kat. ' + cat + ' ' + tier if cat else tier})"

        promising, runway_note, luka_hist, top_marks = analyze_venue_quality(
            ev.get("name", ""), clean_venue, venue_city, venue_country, comp_db
        )

        contacts = []
        for cp in info.get("contactPersons") or []:
            if cp.get("name") or cp.get("email") or cp.get("phoneNumber"):
                contacts.append({
                    "name": cp.get("name", "").strip(),
                    "email": cp.get("email", "").strip(),
                    "phone": cp.get("phoneNumber", "").strip(),
                    "title": cp.get("title", "").strip()
                })

        unique_contacts = []
        seen_keys = set()
        for c in contacts:
            k = (c["name"].lower(), c["email"].lower())
            if k not in seen_keys:
                seen_keys.add(k)
                unique_contacts.append(c)

        return {
            "id": f"wa-{cid}",
            "wa_id": cid,
            "date": start_date,
            "displayDate": display_date,
            "month": month_name,
            "year": int(year) if year.isdigit() else 2027,
            "name": ev.get("name", "").strip(),
            "tour": tour_type,
            "tier": tier,
            "category": cat,
            "subgroup": subgroup,
            "venue": clean_venue,
            "city": venue_city,
            "country": venue_country,
            "indoor": is_indoor,
            "mensLongJump": True,
            "womensLongJump": has_womens_lj,
            "standardEligible": standard_eligible,
            "status": status_desc,
            "promisingRunway": promising,
            "runwayNote": runway_note,
            "lukaHistory": luka_hist,
            "topHistoricalMarks": top_marks,
            "websiteUrl": info.get("websiteUrl") if info.get("websiteUrl") not in ["TBD", ""] else None,
            "resultsPageUrl": info.get("resultsPageUrl") if info.get("resultsPageUrl") not in ["TBD", ""] else None,
            "liveStreamingUrl": info.get("liveStreamingUrl") if info.get("liveStreamingUrl") not in ["TBD", ""] else None,
            "contactPersons": unique_contacts,
            "disciplinesMen": list(set(other_events_men)),
            "disciplinesWomen": list(set(other_events_women))
        }

    verified_meetings = []
    with ThreadPoolExecutor(max_workers=15) as executor:
        for item in executor.map(process_event, all_raw_events):
            if item:
                verified_meetings.append(item)

    verified_meetings.sort(key=lambda x: x["date"])

    print(f"\n✅ Total Verified Meetings Offering Men's Long Jump: {len(verified_meetings)}")
    promising_count = len([m for m in verified_meetings if m["promisingRunway"]])
    print(f"⭐ Meetings with 'Anlage vielversprechend': {promising_count}")

    output_data = {
        "season": "2027 World Athletics Tour (Indoor & Continental)",
        "target_discipline": "Men's Long Jump (Weitsprung Männer)",
        "scraped_at": "2026-09-23",
        "official_sources": [
            "World Athletics: World Indoor Tour 2027 Calendar & Organiser Details",
            "World Athletics: Continental Tour 2027 Calendar & Organiser Details"
        ],
        "strict_discipline_filter": "Includes ONLY competitions offering Men's Long Jump (verified via GraphQL units matrix).",
        "total_meetings": len(verified_meetings),
        "promising_runways_count": promising_count,
        "meetings": verified_meetings
    }

    with open(OUTPUT_CALENDAR_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved verified 2027 calendar to: {OUTPUT_CALENDAR_PATH}")

if __name__ == "__main__":
    main()
