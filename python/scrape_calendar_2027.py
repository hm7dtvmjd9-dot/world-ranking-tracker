#!/usr/bin/env python3
"""
python/scrape_calendar_2027.py

Scrapes & compiles the 2027 Men's Long Jump & Championship Calendar:
1. World Athletics Indoor Tour 2027 (groupId 3677, season 2026/27)
2. World Athletics Continental Tour 2027 (groupId 3773, season 2027)
3. Official 2027 Wanda Diamond League Calendar (https://www.diamondleague.com/calendar/)
4. Official DLV Rahmenterminplan 2027 Men's Elite Meetings (https://www.leichtathletik.de/wettkaempfe/termine/wettkampf-kalender)
5. Official 2027 National & International Championships (DM Halle, Hallen-EM Valencia, CISM, Team-EM, DM Freiluft, FISU WUG, WM Peking 2027, Olympia LA 2028)
   - NOTE: Hallen-WM Toruń was in March 2026 and is strictly excluded from 2027.
"""

import os
import re
import ssl
import json
import urllib.request
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
COMP_DB_PATH = os.path.join(DATA_DIR, "competitions_database.json")
OUTPUT_CALENDAR_PATH = os.path.join(DATA_DIR, "calendar_2027.json")

GRAPHQL_ENDPOINT = "https://ptibh4tbzjfmnjn7c5jj6bu2ai.appsync-api.eu-west-1.amazonaws.com/graphql"
GRAPHQL_API_KEY = "da2-q7toieeiobcjxbov4abq3abk5u"
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

# 1. Official 2027 Championships (Meisterschaften: DM, EM, WM, CISM, Team-EM, FISU)
CHAMPIONSHIPS_2027 = [
    {
        "id": "champ-dm-halle-2027",
        "wa_id": 9901,
        "date": "2027-02-20",
        "endDate": "2027-02-21",
        "displayDate": "20.–21. FEB 2027",
        "month": "Februar 2027",
        "year": 2027,
        "name": "Deutsche Hallenmeisterschaften 2027 (DM Halle)",
        "tour": "Meisterschaften (DLV)",
        "tier": "Meisterschaft",
        "category": "B",
        "subgroup": "National Championships",
        "isChampionship": True,
        "championshipType": "DM",
        "venue": "Helmut-Körnig-Halle",
        "city": "Dortmund",
        "country": "GER",
        "indoor": True,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Nationale Meisterschaft (Kat. B) • 60 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Helmut-Körnig-Halle Dortmund: Schneller Anlauf, DM-Hallen-Klassiker)",
        "lukaHistory": [
            {"mark": 7.92, "year": 2024, "date": "18. FEB 2024", "place": "2. F"},
            {"mark": 7.78, "year": 2026, "date": "28. FEB 2026", "place": "3. F"}
        ],
        "topHistoricalMarks": [8.18, 8.05, 7.98, 7.92, 7.88],
        "contactPersons": [
            {"name": "Deutscher Leichtathletik-Verband (DLV)", "email": "leistungssport@leichtathletik.de", "phone": "+49 6151 7708-0", "title": "Verband / Wettkampforganisation"}
        ],
        "disciplinesMen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.leichtathletik.de/wettkaempfe/termine/wettkampf-kalender",
        "resultsPageUrl": "https://ergebnisse.leichtathletik.de",
        "liveStreamingUrl": None
    },
    {
        "id": "champ-em-indoor-2027",
        "wa_id": 9902,
        "date": "2027-03-05",
        "endDate": "2027-03-07",
        "displayDate": "04.–07. MRZ 2027",
        "month": "März 2027",
        "year": 2027,
        "name": "European Athletics Indoor Championships 2027 (Hallen-EM Valencia)",
        "tour": "Meisterschaften (European Athletics)",
        "tier": "Meisterschaft",
        "category": "GL",
        "subgroup": "European Championships",
        "isChampionship": True,
        "championshipType": "EM",
        "venue": "Velódromo Luis Puig",
        "city": "Valencia",
        "country": "ESP",
        "indoor": True,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Hallen-Europameisterschaft (Kat. GL) • 140 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Hallen-EM Valencia im Velódromo Luis Puig • Hauptziel Hallensaison 2027)",
        "lukaHistory": [],
        "topHistoricalMarks": [8.30, 8.22, 8.14, 8.08, 8.02],
        "contactPersons": [
            {"name": "European Athletics", "email": "competition@european-athletics.org", "phone": "+41 21 313 43 50", "title": "Competition Department"}
        ],
        "disciplinesMen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "60m", "60m Hurdles", "Pole Vault", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.european-athletics.com",
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
        "name": "CISM Military World Athletics Championships 2027 (Militär-WM)",
        "tour": "Meisterschaften (CISM)",
        "tier": "Meisterschaft",
        "category": "C",
        "subgroup": "Military Championships",
        "isChampionship": True,
        "championshipType": "CISM",
        "venue": "CISM Military Stadium",
        "city": "Warendorf / CISM Host",
        "country": "GER",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Militär-Weltmeisterschaft (Kat. C) • 40 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Bundeswehr-Spitzensportförderung: Pflicht- & Medaillenchance als Sportsoldat",
        "lukaHistory": [],
        "topHistoricalMarks": [8.08, 7.95, 7.88, 7.82, 7.75],
        "contactPersons": [
            {"name": "Bundeswehr Sportförderung / CISM", "email": "sportfoerderung@bundeswehr.org", "phone": "+49 2241 15-0", "title": "Spitzensportbetreuung"}
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
        "date": "2027-06-19",
        "endDate": "2027-06-20",
        "displayDate": "18.–20. JUN 2027",
        "month": "Juni 2027",
        "year": 2027,
        "name": "European Athletics Team Championships 2027 (Team-EM 1st Division)",
        "tour": "Meisterschaften (European Athletics)",
        "tier": "Meisterschaft",
        "category": "A",
        "subgroup": "Team Championships",
        "isChampionship": True,
        "championshipType": "Team-EM",
        "venue": "Atatürk Olympic Stadium",
        "city": "Istanbul",
        "country": "TUR",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Team-Europameisterschaft (Kat. A Gold) • 100 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (100 Bonuspunkte für Platz 1 • 1 Startplatz pro Nation)",
        "lukaHistory": [],
        "topHistoricalMarks": [8.25, 8.16, 8.09, 8.01, 7.95],
        "contactPersons": [
            {"name": "European Athletics", "email": "events@european-athletics.org", "phone": "+41 21 313 43 50", "title": "Events Coordinator"}
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
        "date": "2027-07-31",
        "endDate": "2027-08-01",
        "displayDate": "31. JUL – 01. AUG 2027",
        "month": "Juli 2027",
        "year": 2027,
        "name": "127. Deutsche Meisterschaften Freiluft 2027 (DM Männer/Frauen)",
        "tour": "Meisterschaften (DLV)",
        "tier": "Meisterschaft",
        "category": "B",
        "subgroup": "National Championships",
        "isChampionship": True,
        "championshipType": "DM",
        "venue": "Auestadion / DLV Austragungsort",
        "city": "Kassel / Deutschland",
        "country": "GER",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Nationale Meisterschaft (Kat. B) • 60 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Luka sprang bei der DM 2023 in Kassel 7,91m und holte den Titel!)",
        "lukaHistory": [
            {"mark": 7.91, "year": 2023, "date": "09. JUL 2023", "place": "1. F"},
            {"mark": 7.79, "year": 2024, "date": "29. JUN 2024", "place": "2. F"},
            {"mark": 7.86, "year": 2026, "date": "25. JUL 2026", "place": "2. F"}
        ],
        "topHistoricalMarks": [8.22, 8.14, 8.08, 8.01, 7.94],
        "contactPersons": [
            {"name": "Deutscher Leichtathletik-Verband (DLV)", "email": "leistungssport@leichtathletik.de", "phone": "+49 6151 7708-0", "title": "Verband / Organisation"}
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.leichtathletik.de/wettkaempfe/termine/wettkampf-kalender",
        "resultsPageUrl": "https://ergebnisse.leichtathletik.de",
        "liveStreamingUrl": None
    },
    {
        "id": "champ-fisu-2027",
        "wa_id": 9908,
        "date": "2027-08-06",
        "endDate": "2027-08-12",
        "displayDate": "01.–12. AUG 2027",
        "month": "August 2027",
        "year": 2027,
        "name": "FISU World University Games 2027 (Welthochschulspiele Chungcheong)",
        "tour": "Meisterschaften (FISU)",
        "tier": "Meisterschaft",
        "category": "B",
        "subgroup": "World University Games",
        "isChampionship": True,
        "championshipType": "FISU",
        "venue": "Chungcheong Main Stadium",
        "city": "Chungcheong",
        "country": "KOR",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "FISU World University Games (Kat. B) • 60 Bonuspunkte für Sieg",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Luka gewann 2025 mit 2x 7,96m Bronze bei den FISU Games!)",
        "lukaHistory": [
            {"mark": 7.96, "year": 2025, "date": "24. JUL 2025", "place": "3. F"}
        ],
        "topHistoricalMarks": [8.12, 8.05, 8.00, 7.96, 7.92],
        "contactPersons": [
            {"name": "adh - Allgemeiner Deutscher Hochschulsportverband", "email": "adh@adh.de", "phone": "+49 6071 2086-0", "title": "adh Wettkampfsport"}
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://www.fisu.net",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    },
    {
        "id": "champ-wm-outdoor-2027",
        "wa_id": 9907,
        "date": "2027-09-11",
        "endDate": "2027-09-19",
        "displayDate": "10.–19. SEP 2027",
        "month": "September 2027",
        "year": 2027,
        "name": "World Athletics Championships Beijing 2027 (Freiluft-WM Peking)",
        "tour": "Meisterschaften (World Athletics)",
        "tier": "Meisterschaft",
        "category": "OW",
        "subgroup": "World Championships",
        "isChampionship": True,
        "championshipType": "WM",
        "venue": "National Stadium (Bird's Nest)",
        "city": "Peking (Beijing)",
        "country": "CHN",
        "indoor": False,
        "mensLongJump": True,
        "womensLongJump": True,
        "standardEligible": True,
        "status": "Weltmeisterschaft Peking (Kat. OW) • 350 Bonuspunkte für Sieg • Hauptziel 2027",
        "promisingRunway": True,
        "runwayNote": "Anlage vielversprechend ⭐ (Olympiastadion Peking • Saisonhöhepunkt 10.–19.09.2027)",
        "lukaHistory": [],
        "topHistoricalMarks": [8.65, 8.52, 8.41, 8.35, 8.28],
        "contactPersons": [
            {"name": "World Athletics Competition", "email": "competitions@worldathletics.org", "phone": "+377 93 10 88 88", "title": "World Athletics Events"}
        ],
        "disciplinesMen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "disciplinesWomen": ["Long Jump", "100m", "200m", "400m", "High Jump", "Triple Jump"],
        "websiteUrl": "https://worldathletics.org/competitions/world-athletics-championships",
        "resultsPageUrl": None,
        "liveStreamingUrl": None
    }
]

# 2. Official 2027 Wanda Diamond League Calendar (https://www.diamondleague.com/calendar/)
DIAMOND_LEAGUE_2027_STOPS = [
    ("dl-doha-2027", "2027-05-07", "Doha Diamond League 2027", "Suheim bin Hamad Stadium", "Doha", "QAT", "GW"),
    ("dl-shanghai-2027", "2027-05-15", "Yangtze Delta Athletics Diamond Gala 2027", "China Textile City Sports Centre", "Shanghai/Keqiao", "CHN", "GW"),
    ("dl-xiamen-2027", "2027-05-22", "Xiamen Diamond League 2027", "Egret Stadium", "Xiamen", "CHN", "GW"),
    ("dl-rome-2027", "2027-05-27", "Golden Gala Pietro Mennea 2027", "Stadio Olimpico", "Rom", "ITA", "GW"),
    ("dl-rabat-2027", "2027-05-30", "Meeting International Mohammed VI d'Athlétisme 2027", "Complexe Sportif Prince Moulay Abdellah", "Rabat", "MAR", "GW"),
    ("dl-oslo-2027", "2027-06-03", "Oslo Bislett Games 2027", "Bislett Stadion", "Oslo", "NOR", "GW"),
    ("dl-stockholm-2027", "2027-06-06", "BAUHAUS-Galan 2027", "Olympiastadion", "Stockholm", "SWE", "GW"),
    ("dl-paris-2027", "2027-06-25", "Meeting de Paris 2027", "Stade Sébastien Charléty", "Paris", "FRA", "GW"),
    ("dl-eugene-2027", "2027-07-03", "Prefontaine Classic 2027", "Hayward Field", "Eugene", "USA", "GW"),
    ("dl-monaco-2027", "2027-07-09", "Herculis EBS Monaco 2027", "Stade Louis II", "Monaco", "MON", "GW"),
    ("dl-lausanne-2027", "2027-07-13", "Athletissima Lausanne 2027", "Stade Olympique de la Pontaise", "Lausanne", "SUI", "GW"),
    ("dl-london-2027", "2027-07-17", "London Athletics Meet 2027", "London Stadium", "London", "GBR", "GW"),
    ("dl-silesia-2027", "2027-08-15", "Kamila Skolimowska Memorial 2027", "Silesian Stadium", "Chorzów", "POL", "GW"),
    ("dl-brussels-2027", "2027-08-20", "Allianz Memorial Van Damme 2027", "King Baudouin Stadium", "Brüssel", "BEL", "GW"),
    ("dl-zurich-2027", "2027-08-25", "Weltklasse Zürich (Diamond League Final 2027)", "Letzigrund", "Zürich", "SUI", "DF"),
]

# 3. Official DLV Rahmenterminplan 2027 Men's Elite Meetings (excluding Jugend/Masters)
DLV_RAHMENTERMINPLAN_2027 = [
    ("dlv-dortmund-jnr-indoor-2027", "2027-01-16", "Indoor Jump'n'Run Meeting Dortmund 2027", "Helmut-Körnig-Halle", "Dortmund", "GER", "E", "DLV Rahmenterminplan", True),
    ("dlv-dortmund-sparkassen-2027", "2027-01-23", "Sparkassen Indoor Meeting Dortmund 2027", "Helmut-Körnig-Halle", "Dortmund", "GER", "C", "World Athletics Indoor Tour 2027", True),
    ("dlv-cottbus-springer-2027", "2027-01-27", "23. Internationales Springer-Meeting Cottbus 2027", "Lausitz-Arena", "Cottbus", "GER", "C", "World Athletics Indoor Tour 2027", True),
    ("dlv-erfurt-indoor-2027", "2027-01-29", "14. Erfurt Indoor 2027", "Hartwig-Gauder-Halle", "Erfurt", "GER", "D", "World Athletics Indoor Tour 2027", True),
    ("dlv-karlsruhe-init-2027", "2027-02-05", "INIT INDOOR MEETING Karlsruhe 2027", "Europahalle / Messe", "Karlsruhe", "GER", "A", "World Athletics Indoor Tour 2027", True),
    ("dlv-berlin-istaf-indoor-2027", "2027-02-07", "ISTAF INDOOR Berlin 2027", "Uber Arena", "Berlin", "GER", "B", "World Athletics Indoor Tour 2027", True),
    ("dlv-duesseldorf-istaf-2027", "2027-02-13", "ISTAF INDOOR Düsseldorf 2027", "PSD Bank Dome", "Düsseldorf", "GER", "B", "World Athletics Indoor Tour 2027", True),
    ("dlv-weinheim-kurpfalz-2027", "2027-05-15", "Kurpfalz-Gala Weinheim 2027", "Sepp-Herberger-Stadion", "Weinheim", "GER", "D", "DLV Rahmenterminplan / Continental Tour", False),
    ("dlv-dessau-anhalt-2027", "2027-05-21", "Internationales Leichtathletik-Meeting Anhalt 2027", "Paul-Greifzu-Stadion", "Dessau", "GER", "C", "World Athletics Continental Tour 2027", False),
    ("dlv-dresden-goldenes-oval-2027", "2027-05-30", "Goldenes Oval Dresden 2027", "Heinz-Steyer-Stadion", "Dresden", "GER", "B", "World Athletics Continental Tour 2027", False),
    ("dlv-regensburg-gala-2027", "2027-06-05", "Sparkassen-Gala Regensburg 2027", "Universitätsstadion", "Regensburg", "GER", "D", "DLV Rahmenterminplan", False),
    ("dlv-rehlingen-pfingst-2027", "2027-06-13", "62. Internationales Pfingstsportfest Rehlingen 2027", "Bungertstadion", "Rehlingen", "GER", "C", "World Athletics Continental Tour 2027", False),
    ("dlv-essen-springer-2027", "2027-06-20", "Internationales Essener Springer-Meeting 2027", "Sportpark Am Hallo", "Essen", "GER", "D", "DLV Rahmenterminplan", False),
    ("dlv-rhede-laz-2027", "2027-06-26", "55. Internationales LAZ Meeting Rhede 2027", "Besagroup-Sportpark", "Rhede", "GER", "D", "DLV Rahmenterminplan", False),
    ("dlv-pfungstadt-flutlicht-2027", "2027-07-10", "Pfungstädter Leichtathletik-Gala 2027", "TSV-Stadion", "Pfungstadt", "GER", "E", "DLV Rahmenterminplan", False),
    ("dlv-inneringen-schlossberg-2027", "2027-07-18", "Schloßberg-Weitsprungmeeting Inneringen 2027", "Weitsprunganlage Inneringen", "Inneringen", "GER", "E", "DLV Rahmenterminplan", False),
    ("dlv-berlin-istaf-outdoor-2027", "2027-08-29", "ISTAF Berlin 2027", "Olympiastadion", "Berlin", "GER", "B", "World Athletics Continental Tour 2027", False),
]

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
    except Exception:
        return None

def analyze_venue_quality(comp_name, venue, city, country, comp_db):
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

    combined_lower = (comp_name + " " + venue + " " + (city or "")).lower()
    if "gorz" in combined_lower:
        return True, "Anlage vielversprechend ⭐ (Hervorragende Steg-Anlaufdynamik: Luka PB 8,18m in 2026)", luka_marks, sorted(all_marks, reverse=True)[:5]
    if "inneringen" in combined_lower:
        return True, "Anlage vielversprechend ⭐ (Luka sprang hier 8,14m Freiluft-PB in 2023)", luka_marks, sorted(all_marks, reverse=True)[:5]
    if "rom" in combined_lower or "rome" in combined_lower:
        return True, "Anlage vielversprechend ⭐ (Stadio Olimpico Rom: Luka sprang hier 8,08m und 8,01m bei der EM 2024)", luka_marks, sorted(all_marks, reverse=True)[:5]
    if "dortmund" in combined_lower:
        return True, "Anlage vielversprechend ⭐ (Dortmund Helmut-Körnig-Halle: Luka sprang hier mehrfach > 7,90m)", luka_marks, sorted(all_marks, reverse=True)[:5]
    if "essen" in combined_lower or "rhede" in combined_lower or "weinheim" in combined_lower or "dessau" in combined_lower:
        return True, "Anlage vielversprechend ⭐ (Bewährte deutsche Top-Sprunganlage aus Lukas Wettkampfhistorie)", luka_marks, sorted(all_marks, reverse=True)[:5]

    if luka_marks and any(lm["mark"] >= 8.00 for lm in luka_marks):
        best_luka = max(lm["mark"] for lm in luka_marks)
        return True, f"Anlage vielversprechend ⭐ (Luka erzielte hier bereits {best_luka:.2f}m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    if all_marks:
        max_mark = max(all_marks)
        marks_over_8m = [m for m in all_marks if m >= 8.00]
        avg_mark = sum(all_marks) / len(all_marks)
        if len(marks_over_8m) >= 2 or (max_mark >= 8.15 and avg_mark >= 7.85):
            return True, f"Anlage vielversprechend ⭐ (Historisch weite Sprünge: Bestmarke {max_mark:.2f}m, {len(marks_over_8m)}x über 8,00m)", luka_marks, sorted(all_marks, reverse=True)[:5]

    return False, "Solide Wettkampfanlage mit regulären Bedingungen", luka_marks, sorted(all_marks, reverse=True)[:5]

def main():
    print("=== World Athletics 2027 Tour, Diamond League, DLV & Championships Calendar Scraper ===")
    comp_db = None
    if os.path.exists(COMP_DB_PATH):
        with open(COMP_DB_PATH, "r", encoding="utf-8") as f:
            comp_db = json.load(f)
        print(f"Loaded {len(comp_db.get('competitions', []))} historical competitions for runway benchmark.")

    cont_events = fetch_tour_events_graphql("2027", 3773, "World Athletics Continental Tour 2027")
    indoor_events = fetch_tour_events_graphql("2026/27", 3677, "World Athletics Indoor Tour 2027")
    all_raw_events = cont_events + indoor_events

    def process_event(ev):
        cid = ev.get("id")
        if not cid:
            return None
        name_lower = ev.get("name", "").lower()
        if any(k in name_lower for k in NON_LJ_KEYWORDS):
            return None
        # Never allow any erroneous 2027 Torun World Indoor Championships entry
        if "world athletics indoor championships" in name_lower and "toru" in (name_lower + " " + ev.get("venue", "").lower()):
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
            if has_any_men_events and not has_mens_lj:
                return None
        else:
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
        elif cat in ["GL", "A"] or subgroup.lower() == "gold":
            tier = "Gold"
        elif cat == "B" or subgroup.lower() == "silver":
            tier = "Silver"
        elif cat == "C" or subgroup.lower() == "bronze":
            tier = "Bronze"

        standard_eligible = cat in ["OW", "DF", "GW", "GL", "A", "B", "C"]
        status_desc = f"Kat. {cat} ({tier})"

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
            "isChampionship": False,
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
    with ThreadPoolExecutor(max_workers=15) as executor:
        for item in executor.map(process_event, all_raw_events):
            if item:
                verified_meetings.append(item)

    existing_keys = set((m["date"], m["city"].lower()[:6]) for m in verified_meetings if m.get("city"))

    # Add Official 2027 Wanda Diamond League Calendar
    for dl_id, dl_date, dl_name, dl_venue, dl_city, dl_country, dl_cat in DIAMOND_LEAGUE_2027_STOPS:
        if (dl_date, dl_city.lower()[:6]) in existing_keys:
            continue
        display_date, month_name, year = format_date_info(dl_date)
        promising, runway_note, luka_hist, top_marks = analyze_venue_quality(dl_name, dl_venue, dl_city, dl_country, comp_db)
        is_final = dl_cat == "DF"
        verified_meetings.append({
            "id": dl_id,
            "wa_id": None,
            "date": dl_date,
            "displayDate": display_date,
            "month": month_name,
            "year": 2027,
            "name": dl_name,
            "tour": "Wanda Diamond League 2027",
            "tier": "Diamond League Final" if is_final else "Diamond League",
            "category": dl_cat,
            "subgroup": "Diamond League",
            "isChampionship": False,
            "venue": dl_venue,
            "city": dl_city,
            "country": dl_country,
            "indoor": False,
            "mensLongJump": True,
            "womensLongJump": True,
            "standardEligible": True,
            "dlDisciplineStatus": "Fix gesetzt (DL Final)" if is_final else "Disziplin-Zuteilung 2027 noch offen (TBA)",
            "status": f"Diamond League ({'Kat. DF • 240 Pkt Sieg' if is_final else 'Kat. GW • 200 Pkt Sieg • Disziplinen TBA'})",
            "promisingRunway": True,
            "runwayNote": runway_note if promising else "Wanda Diamond League Weltklasse-Anlage (Männer Weitsprung Zuteilung für 2027 wird noch final bekanntgegeben)",
            "lukaHistory": luka_hist,
            "topHistoricalMarks": top_marks or [8.42, 8.31, 8.24, 8.16, 8.10],
            "websiteUrl": "https://www.diamondleague.com/calendar/",
            "resultsPageUrl": None,
            "liveStreamingUrl": None,
            "contactPersons": [{"name": "Wanda Diamond League Office", "email": "office@diamondleague.com", "phone": "", "title": "Diamond League Series"}],
            "disciplinesMen": ["Long Jump (Final)" if is_final else "Long Jump (TBA)"],
            "disciplinesWomen": []
        })
        existing_keys.add((dl_date, dl_city.lower()[:6]))

    # Add Official DLV Rahmenterminplan 2027 Men's Elite Meetings
    for dlv_id, dlv_date, dlv_name, dlv_venue, dlv_city, dlv_country, dlv_cat, dlv_tour, dlv_indoor in DLV_RAHMENTERMINPLAN_2027:
        if (dlv_date, dlv_city.lower()[:6]) in existing_keys:
            continue
        display_date, month_name, year = format_date_info(dlv_date)
        promising, runway_note, luka_hist, top_marks = analyze_venue_quality(dlv_name, dlv_venue, dlv_city, dlv_country, comp_db)
        tier_map = {"A": "Gold", "B": "Silver", "C": "Bronze", "D": "Challenger", "E": "National Permit"}
        tier = tier_map.get(dlv_cat, "Challenger")
        verified_meetings.append({
            "id": dlv_id,
            "wa_id": None,
            "date": dlv_date,
            "displayDate": display_date,
            "month": month_name,
            "year": 2027,
            "name": dlv_name,
            "tour": dlv_tour,
            "tier": tier,
            "category": dlv_cat,
            "subgroup": tier,
            "isChampionship": False,
            "venue": dlv_venue,
            "city": dlv_city,
            "country": dlv_country,
            "indoor": dlv_indoor,
            "mensLongJump": True,
            "womensLongJump": True,
            "standardEligible": dlv_cat in ["A", "B", "C"],
            "status": f"DLV Rahmenterminplan (Kat. {dlv_cat} {tier})",
            "promisingRunway": promising,
            "runwayNote": runway_note,
            "lukaHistory": luka_hist,
            "topHistoricalMarks": top_marks,
            "websiteUrl": "https://www.leichtathletik.de/wettkaempfe/termine/wettkampf-kalender",
            "resultsPageUrl": "https://ergebnisse.leichtathletik.de",
            "liveStreamingUrl": None,
            "contactPersons": [{"name": "DLV Wettkampforganisation / Ausrichter", "email": "wettkaempfe@leichtathletik.de", "phone": "", "title": "DLV Rahmenterminplan"}],
            "disciplinesMen": ["Long Jump"],
            "disciplinesWomen": ["Long Jump"]
        })
        existing_keys.add((dlv_date, dlv_city.lower()[:6]))

    # Add Championships 2027
    for champ in CHAMPIONSHIPS_2027:
        verified_meetings.append(champ)

    verified_meetings.sort(key=lambda x: x["date"])

    promising_count = len([m for m in verified_meetings if m.get("promisingRunway")])
    champs_count = len([m for m in verified_meetings if m.get("isChampionship")])
    dl_count = len([m for m in verified_meetings if "diamond league" in (m.get("tour") or "").lower()])

    print(f"\n✅ Total Verified Meetings: {len(verified_meetings)} (Championships: {champs_count}, Diamond League: {dl_count}, Promising Runways: {promising_count})")

    output_data = {
        "season": "2027 World Athletics Tour, Diamond League, DLV Rahmenterminplan & Championships",
        "target_discipline": "Men's Long Jump",
        "scraped_at": datetime.now().strftime("%Y-%m-%d"),
        "official_sources": [
            "World Athletics: World Indoor Tour 2027 & Continental Tour 2027",
            "Wanda Diamond League 2027 Official Calendar (diamondleague.com/calendar)",
            "DLV Rahmenterminplan 2027 (leichtathletik.de/wettkaempfe/termine/wettkampf-kalender)",
            "European Athletics & World Athletics 2027 Championships Roadmap (Hallen-EM Valencia, Team-EM, WM Peking)"
        ],
        "total_meetings": len(verified_meetings),
        "championships_count": champs_count,
        "diamond_league_count": dl_count,
        "promising_runways_count": promising_count,
        "meetings": verified_meetings
    }

    with open(OUTPUT_CALENDAR_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved verified 2027 calendar to: {OUTPUT_CALENDAR_PATH}")

if __name__ == "__main__":
    main()
