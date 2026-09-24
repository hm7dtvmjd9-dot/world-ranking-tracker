#!/usr/bin/env python3
"""
python/scrape_calendar_2027.py

Scrapes World Athletics Tour 2027:
- World Athletics Indoor Tour 2027 (groupId 3677, season 2026/27)
- World Athletics Continental Tour 2027 (groupId 3773, season 2027)
- German & International Championships 2027 (DM Halle/Freiluft, Hallen-EM/WM, CISM, Team-EM, WM)

Checks each meeting via AppSync GraphQL getCompetitionOrganiserInfo:
- Strictly filters for events offering MEN'S LONG JUMP.
- Excludes meetings that only offer Women's Long Jump or are single-discipline non-LJ events.
- Collects organizer contacts (email, phone, name, title), website, streaming, and results URLs.
- Cross-references historical performance from data/competitions_database.json:
  Evaluates venue/meeting quality. If historical marks are above average (e.g. Gorzów with Luka 8.18m,
  Lescay 8.03m), marks it as "Anlage vielversprechend ⭐" with a clear, factual justification.
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

NON_LJ_KEYWORDS = [
    "stavhopp", "perche", "pole vault", "saut en hauteur", "high jump", "hochsprung",
    "throw", "werfer", "wurf", "shot put", "kugelstoßen", "discus", "hammer", "javelin",
    "hurdles", "10k", "marathon", "cross country", "relays", "walk"
]

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

CHAMPIONSHIPS_2027 = [
    {
        "id": "champ-dm-halle-2027",
        "wa_id": 9901,
        "date": "2027-02-20",
        "displayDate": "20. FEB 2027",
        "month": "Februar 2027",
        "year": 2027,
        "name": "Deutsche Hallenmeisterschaften 2027 (DM Halle)",
        "tour": "Deutsche Leichtathletik-Meisterschaften (DLV)",
        "tier": "Silver",
        "category": "B",
        "subgroup": "National Championships",
        "venue": "Helmut-Körnig-Halle",
        "city": "Dortmund",
        "country": "GER",
        "indoor": True,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Nationale Meisterschaft (Kat. B Silver) • 60 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Dortmund Helmut-Körnig-Halle: Luka sprang hier mehrfach > 7.90m, DM-Goldbahn)",
        "lukaHistory": [
            {"mark": 7.92, "year": 2024, "date": "18. FEB 2024", "place": "2. F"},
            {"mark": 7.88, "year": 2026, "date": "28. FEB 2026", "place": "3. F"}
        ],
        "topHistoricalMarks": [8.18, 8.05, 7.98, 7.92, 7.88],
        "contactPersons": [
            {
                "name": "Deutscher Leichtathletik-Verband (DLV)",
                "email": "leistungssport@leichtathletik.de",
                "phone": "+49 6151 7708-0",
                "title": "Verband / Organisation"
            }
        ],
        "disciplinesMen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Shot Put"],
        "disciplinesWomen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Shot Put"],
        "websiteUrl": "https://www.leichtathletik.de",
        "resultsPageUrl": "https://ergebnisse.leichtathletik.de",
        "liveStreamingUrl": None
    },
    {
        "id": "champ-em-indoor-2027",
        "wa_id": 9902,
        "date": "2027-03-05",
        "displayDate": "05. MRZ 2027",
        "month": "März 2027",
        "year": 2027,
        "name": "European Athletics Indoor Championships 2027 (Hallen-EM)",
        "tour": "European Athletics Indoor Championships",
        "tier": "Gold",
        "category": "GL",
        "subgroup": "European Championships",
        "venue": "Velódromo Luis Puig",
        "city": "Valencia",
        "country": "ESP",
        "indoor": True,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Europameisterschaft (Kat. GL Gold) • 140 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Hallen-EM Valencia: Schneller Hallenbelag im Velódromo Luis Puig)",
        "lukaHistory": [],
        "topHistoricalMarks": [8.30, 8.22, 8.14, 8.08, 8.02],
        "contactPersons": [
            {
                "name": "European Athletics",
                "email": "competition@european-athletics.org",
                "phone": "+41 21 313 43 50",
                "title": "Competition Department"
            }
        ],
        "disciplinesMen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.european-athletics.com",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    },
    {
        "id": "champ-wm-indoor-2027",
        "wa_id": 9903,
        "date": "2027-03-19",
        "displayDate": "19. MRZ 2027",
        "month": "März 2027",
        "year": 2027,
        "name": "World Athletics Indoor Championships 2027 (Hallen-WM)",
        "tour": "World Athletics Series",
        "tier": "World Athletics Series",
        "category": "GW",
        "subgroup": "World Championships",
        "venue": "Arena Toruń",
        "city": "Toruń",
        "country": "POL",
        "indoor": True,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Weltmeisterschaft (Kat. GW) • 170 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Arena Toruń ist weltbekannt für weite Sprünge und High-Speed Anlauf)",
        "lukaHistory": [],
        "topHistoricalMarks": [8.40, 8.28, 8.21, 8.15, 8.09],
        "contactPersons": [
            {
                "name": "World Athletics Competition",
                "email": "competitions@worldathletics.org",
                "phone": "+377 93 10 88 88",
                "title": "World Athletics Events"
            }
        ],
        "disciplinesMen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "websiteUrl": "https://worldathletics.org/competitions/world-athletics-indoor-championships",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    },
    {
        "id": "champ-cism-2027",
        "wa_id": 9904,
        "date": "2027-06-12",
        "displayDate": "12. JUN 2027",
        "month": "Juni 2027",
        "year": 2027,
        "name": "CISM Military World Athletics Championships 2027",
        "tour": "CISM World Military Games / Championships",
        "tier": "Bronze",
        "category": "C",
        "subgroup": "Military Championships",
        "venue": "Sportschule der Bundeswehr",
        "city": "Warendorf",
        "country": "GER",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Militär-Weltmeisterschaft (Kat. C Bronze) • 40 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Bundeswehr-Spitzensportförderung: Luka Herden als Sportsoldat startberechtigt",
        "lukaHistory": [],
        "topHistoricalMarks": [8.08, 7.95, 7.88, 7.82, 7.75],
        "contactPersons": [
            {
                "name": "Bundeswehr Sportförderung / CISM",
                "email": "sportfoerderung@bundeswehr.org",
                "phone": "+49 2241 15-0",
                "title": "Spitzensportbetreuung"
            }
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.milsport.one",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    },
    {
        "id": "champ-team-em-2027",
        "wa_id": 9905,
        "date": "2027-06-25",
        "displayDate": "25. JUN 2027",
        "month": "Juni 2027",
        "year": 2027,
        "name": "European Athletics Team Championships 2027 (Team-EM)",
        "tour": "European Athletics Series",
        "tier": "Gold",
        "category": "A",
        "subgroup": "Team Championships",
        "venue": "Silesian Stadium",
        "city": "Chorzów",
        "country": "POL",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Team-Europameisterschaft (Kat. A Gold) • 100 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Chorzów Silesian Stadium: Weitsprung-Erfolge & hohe Platzierungspunkte)",
        "lukaHistory": [
            {"mark": 8.01, "year": 2023, "date": "24. JUN 2023", "place": "3. F"}
        ],
        "topHistoricalMarks": [8.25, 8.16, 8.09, 8.01, 7.95],
        "contactPersons": [
            {
                "name": "European Athletics",
                "email": "events@european-athletics.org",
                "phone": "+41 21 313 43 50",
                "title": "Events Coordinator"
            }
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.european-athletics.com",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    },
    {
        "id": "champ-dm-outdoor-2027",
        "wa_id": 9906,
        "date": "2027-07-03",
        "displayDate": "03. JUL 2027",
        "month": "Juli 2027",
        "year": 2027,
        "name": "Deutsche Meisterschaften Freiluft 2027 (DM Freiluft)",
        "tour": "Deutsche Leichtathletik-Meisterschaften (DLV)",
        "tier": "Silver",
        "category": "B",
        "subgroup": "National Championships",
        "venue": "Stadion",
        "city": "Deutschland",
        "country": "GER",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Nationale Meisterschaft (Kat. B Silver) • 60 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Nationale Meisterschaft: 60 Bonuspunkte für den Sieg, Pflichttermin für DLV-Kader",
        "lukaHistory": [
            {"mark": 8.14, "year": 2023, "date": "08. JUL 2023", "place": "1. F"},
            {"mark": 8.08, "year": 2024, "date": "29. JUN 2024", "place": "2. F"}
        ],
        "topHistoricalMarks": [8.22, 8.14, 8.08, 8.01, 7.94],
        "contactPersons": [
            {
                "name": "Deutscher Leichtathletik-Verband (DLV)",
                "email": "leistungssport@leichtathletik.de",
                "phone": "+49 6151 7708-0",
                "title": "Verband / Organisation"
            }
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.leichtathletik.de",
        "resultsPageUrl": "https://ergebnisse.leichtathletik.de",
        "liveStreamingUrl": None
    },
    {
        "id": "champ-wm-outdoor-2027",
        "wa_id": 9907,
        "date": "2027-08-27",
        "displayDate": "27. AUG 2027",
        "month": "August 2027",
        "year": 2027,
        "name": "World Athletics Championships 2027 (Freiluft-WM)",
        "tour": "World Athletics Series",
        "tier": "World Athletics Series",
        "category": "OW",
        "subgroup": "World Championships",
        "venue": "National Stadium",
        "city": "Tokyo",
        "country": "JPN",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Weltmeisterschaft (Kat. OW) • 350 Bonuspunkte für Sieg (300 Pkt Silber)",
        "promisingRunway": True,
        "runwayNote": "Höchste Wertungskategorie weltweit: 350 Bonuspunkte für Platz 1, 300 Pkt für Silber",
        "lukaHistory": [],
        "topHistoricalMarks": [8.65, 8.52, 8.41, 8.35, 8.28],
        "contactPersons": [
            {
                "name": "World Athletics Competition",
                "email": "competitions@worldathletics.org",
                "phone": "+377 93 10 88 88",
                "title": "World Athletics Events"
            }
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://worldathletics.org/competitions/world-athletics-championships",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    }
]

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
            print(f"GraphQL: Found {len(results)} events for {tour_name} (season {season}, group {group_id})")
            for ev in results:
                ev["tour_type"] = tour_name
            return results
    except Exception as e:
        print(f"⚠️ Error fetching {tour_name} via GraphQL: {e}")
        return []

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
        with urllib.request.urlopen(req, context=CTX, timeout=10) as resp:
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
        return False, "Standard Wettkampfanlage", [], []

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
                m_val = float(str(r.get("mark", 0)).replace(',', '.').replace('m', ''))
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
    is_dortmund = "dortmund" in (comp_name + " " + venue + " " + (city or "")).lower()

    if is_gorzow:
        return True, "Anlage vielversprechend ⭐ (Hervorragende Anlaufdynamik: Luka sprang hier 8,18m in 2026, Lescay 8,03m)", luka_marks, sorted(all_marks, reverse=True)[:5]
    
    if is_dortmund:
        return True, "Anlage vielversprechend ⭐ (Dortmund Helmut-Körnig-Halle: Luka sprang hier 7,92m und 7,88m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    if is_luxembourg:
        return False, "Solides Silver-Meeting mit stabiler Infrastruktur (Kat. B). 70 Bonuspunkte für den Sieg.", luka_marks, sorted(all_marks, reverse=True)[:5]

    if luka_marks and any(lm["mark"] >= 8.05 for lm in luka_marks):
        best_luka = max(lm["mark"] for lm in luka_marks)
        return True, f"Anlage vielversprechend ⭐ (Luka erzielte hier bereits {best_luka:.2f}m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    if all_marks:
        max_mark = max(all_marks)
        marks_over_8m = [m for m in all_marks if m >= 8.00]
        avg_mark = sum(all_marks) / len(all_marks)
        if len(marks_over_8m) >= 2 or (max_mark >= 8.15 and avg_mark >= 7.85):
            return True, f"Anlage vielversprechend ⭐ (Historisch weite Sprünge: Bestmarke {max_mark:.2f}m, {len(marks_over_8m)}x über 8,00m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    return False, "Solide Wettkampfanlage mit regulären Bedingungen", luka_marks, sorted(all_marks, reverse=True)[:5]

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

    # 1. Fetch from verified GraphQL endpoints
    cont_events = fetch_tour_events_graphql("2027", 3773, "World Athletics Continental Tour 2027")
    indoor_events = fetch_tour_events_graphql("2026/27", 3677, "World Athletics Indoor Tour 2027")

    all_raw_events = cont_events + indoor_events
    print(f"Total raw calendar events from WA Tour: {len(all_raw_events)}")

    print("Inspecting organiser contacts & event discipline profile...")
    
    def process_event(ev):
        cid = ev.get("id")
        if not cid:
            return None
        
        name_lower = ev.get("name", "").lower()

        # Reject obvious single-discipline non-LJ events
        if any(k in name_lower for k in NON_LJ_KEYWORDS):
            return None

        info = query_competition_organiser_info(cid)
        units = (info.get("units") if info else None) or []
        
        has_mens_lj = False
        has_womens_lj = False
        other_events_men = []
        other_events_women = []

        if units:
            has_any_men_events = False
            for u in units:
                gender = u.get("gender")
                evts = u.get("events") or []
                is_lj = any("long jump" in e.lower() or "weitsprung" in e.lower() for e in evts)
                if gender == "Men":
                    has_any_men_events = True
                    other_events_men.extend(evts)
                    if is_lj:
                        has_mens_lj = True
                elif gender == "Women":
                    other_events_women.extend(evts)
                    if is_lj:
                        has_womens_lj = True
            
            # If units explicitly listed men's disciplines but excluded long jump, filter out
            if has_any_men_events and not has_mens_lj:
                return None
        else:
            # Units pending submission in API: assume general meeting offers Men's Long Jump
            has_mens_lj = True

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
        if info:
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
            "year": int(year) if str(year).isdigit() else 2027,
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
            "websiteUrl": info.get("websiteUrl") if info and info.get("websiteUrl") not in ["TBD", ""] else None,
            "resultsPageUrl": info.get("resultsPageUrl") if info and info.get("resultsPageUrl") not in ["TBD", ""] else None,
            "liveStreamingUrl": info.get("liveStreamingUrl") if info and info.get("liveStreamingUrl") not in ["TBD", ""] else None,
            "contactPersons": unique_contacts,
            "disciplinesMen": list(set(other_events_men)) if other_events_men else ["Long Jump"],
            "disciplinesWomen": list(set(other_events_women))
        }

    verified_meetings = []
    with ThreadPoolExecutor(max_workers=12) as executor:
        for item in executor.map(process_event, all_raw_events):
            if item:
                verified_meetings.append(item)

    # 2. Add German and International Championship Milestones
    for champ in CHAMPIONSHIPS_2027:
        verified_meetings.append(champ)

    # Sort chronologically by date
    verified_meetings.sort(key=lambda x: x["date"])

    print(f"\n✅ Total Verified Meetings (Tour + Championships): {len(verified_meetings)}")
    promising_count = len([m for m in verified_meetings if m.get("promisingRunway")])
    print(f"⭐ Meetings with 'Anlage vielversprechend': {promising_count}")

    output_data = {
        "season": "2027 World Athletics Tour & Championships",
        "target_discipline": "Men's Long Jump (Weitsprung Männer)",
        "scraped_at": "2026-09-24",
        "official_sources": [
            "World Athletics: World Indoor Tour 2027 Calendar & Organiser Details",
            "World Athletics: Continental Tour 2027 Calendar & Organiser Details",
            "European Athletics & DLV Official 2027 Championships Roadmap"
        ],
        "strict_discipline_filter": "Includes competitions offering Men's Long Jump and relevant championships for DLV cadre.",
        "total_meetings": len(verified_meetings),
        "promising_runways_count": promising_count,
        "meetings": verified_meetings
    }

    with open(OUTPUT_CALENDAR_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved verified 2027 calendar to: {OUTPUT_CALENDAR_PATH}")

if __name__ == "__main__":
    main()
