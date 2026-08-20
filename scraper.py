import os
import json
import re
import time
import requests
from bs4 import BeautifulSoup

API_URL = "https://worldathletics.org/api/graphql"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Origin": "https://worldathletics.org",
    "Referer": "https://worldathletics.org/world-rankings/long-jump/men"
}

def get_athlete_details(athlete_id, event_group="long-jump"):
    """Fragt die 5 gewerteten Wettkämpfe eines Athleten über GraphQL ab."""
    if not athlete_id:
        return []
        
    query = """
    query GetAthleteEventResults($athleteId: Int!, $eventGroup: String!) {
      athleteEventResults(athleteId: $athleteId, eventGroup: $eventGroup) {
        results {
          date
          competition
          venue
          category
          mark
          wind
          place
          resultScore
          placingScore
          totalScore
        }
      }
    }
    """
    
    try:
        payload = {
            "query": query,
            "variables": {
                "athleteId": int(athlete_id),
                "eventGroup": event_group
            }
        }
        res = requests.post(API_URL, json=payload, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return data.get("data", {}).get("athleteEventResults", {}).get("results", [])
    except Exception as e:
        print(f"Fehler bei Detailabruf ID {athlete_id}: {e}")
    return []

def scrape_rankings():
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    res = requests.get(url, headers=HEADERS)
    
    if res.status_code != 200:
        print(f"Fehler beim Laden: Status {res.status_code}")
        return []
        
    soup = BeautifulSoup(res.text, "html.parser")
    table = soup.find("table")
    if not table:
        print("Keine Tabelle gefunden.")
        return []

    athletes = []
    rows = table.find_all("tr")[1:] # Header überspringen
    
    for idx, row in enumerate(rows):
        cols = row.find_all("td")
        if len(cols) < 5:
            continue
        
        # 1. Rang & Name
        rank = cols[0].text.strip()
        link_elem = cols[1].find("a")
        name = link_elem.text.strip() if link_elem else cols[1].text.strip()
        
        # 2. Athleten-ID & URL
        athlete_href = link_elem["href"] if (link_elem and "href" in link_elem.attrs) else ""
        id_match = re.search(r'(\d+)', athlete_href)
        athlete_id = id_match.group(1) if id_match else row.get("data-athlete-id", "")
        
        # 3. Nation & Geburtsdatum parsen
        col_texts = [c.text.strip() for c in cols if c.text.strip()]
        
        country = ""
        for val in col_texts:
            if re.match(r'^[A-Z]{3}$', val):
                country = val
                break
                
        dob = ""
        for val in col_texts:
            if re.search(r'\d{2}\s+[A-Z]{3}\s+\d{4}|\d{4}', val) and val != country:
                dob = val
                break

        # 4. Punktestand finden
        score = ""
        for val in reversed(col_texts):
            if val.isdigit() and 500 <= int(val) <= 2000:
                score = val
                break
                
        # 5. Detail-Meetings für alle Top 100 Athleten laden
        competitions = []
        if idx < 100 and athlete_id:
            print(f"[{idx+1}/100] Lade Meetings: {name} ({country}) - ID {athlete_id}")
            competitions = get_athlete_details(athlete_id)
            time.sleep(0.4) # Schont die World Athletics API vor Rate-Limits
            
        athletes.append({
            "rank": rank,
            "name": name,
            "country": country,
            "dob": dob,
            "ranking_score": score,
            "athlete_id": athlete_id,
            "profile_url": f"https://worldathletics.org{athlete_href}" if athlete_href.startswith("/") else athlete_href,
            "counted_competitions": competitions
        })
        
    return athletes

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    ranking_data = scrape_rankings()
    
    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes_count": len(ranking_data),
            "athletes": ranking_data
        }, f, ensure_ascii=False, indent=2)
        
    print(f"\nFertig! Alle {len(ranking_data)} Athleten inklusive Meetings in {output_path} gespeichert.")
