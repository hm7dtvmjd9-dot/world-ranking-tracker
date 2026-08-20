import os
import json
import re
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://worldathletics.org"
RANKING_URL = f"{BASE_URL}/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def fetch_athlete_breakdown(athlete_url):
    """Holt die 5 gewerteten Meetings aus der Detailansicht des Athleten."""
    if not athlete_url:
        return []
    try:
        res = requests.get(athlete_url, headers=HEADERS, timeout=10)
        if res.status_code != 200:
            return []
        
        soup = BeautifulSoup(res.text, "html.parser")
        competitions = []
        
        # World Athletics rendert die zählenden Wettkämpfe in der Event-Details Tabelle
        table = soup.find("table", class_="records-table")
        if table:
            rows = table.find_all("tr")[1:]
            for r in rows:
                cols = [c.text.strip() for c in r.find_all("td")]
                if len(cols) >= 7:
                    competitions.append({
                        "date": cols[0],
                        "competition": cols[1],
                        "venue": cols[2] if len(cols) > 7 else "",
                        "category": cols[3] if len(cols) > 7 else cols[2],
                        "mark": cols[4] if len(cols) > 7 else cols[3],
                        "wind": cols[5] if len(cols) > 7 else "",
                        "place": cols[6] if len(cols) > 7 else cols[4],
                        "result_score": cols[-3] if len(cols) >= 9 else "",
                        "placing_score": cols[-2] if len(cols) >= 9 else "",
                        "total_score": cols[-1]
                    })
        return competitions
    except Exception as e:
        print(f"Fehler beim Laden von {athlete_url}: {e}")
        return []

def scrape_world_rankings(limit_details=40):
    """
    Scrapt das Men's Long Jump Ranking.
    limit_details: Ruft die vollen 5-Meeting-Breakdowns für die Top N Athleten ab.
    """
    res = requests.get(RANKING_URL, headers=HEADERS)
    if res.status_code != 200:
        print(f"Fehler beim Ranking-Abruf: Status {res.status_code}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    athletes = []
    
    table = soup.find("table")
    if not table:
        print("Keine Tabelle gefunden.")
        return []

    rows = table.find_all("tr")[1:]
    
    for idx, row in enumerate(rows):
        cols = row.find_all("td")
        if len(cols) < 5:
            continue
            
        rank_text = cols[0].text.strip()
        
        # Athleten-Link und Name
        name_cell = cols[1]
        link_tag = name_cell.find("a")
        athlete_name = link_tag.text.strip() if link_tag else name_cell.text.strip()
        athlete_path = link_tag["href"] if link_tag and "href" in link_tag.attrs else ""
        athlete_url = f"{BASE_URL}{athlete_path}" if athlete_path.startswith("/") else athlete_path
        
        # Land & Geburtsdatum
        country = cols[2].text.strip()
        dob = cols[3].text.strip() if len(cols) > 3 else ""
        
        # Gesamtscore (letzte gefüllte Spalte mit Zahlen)
        score_text = cols[-1].text.strip()
        if not score_text.isdigit():
            for c in reversed(cols):
                val = c.text.strip()
                if val.isdigit() and len(val) >= 3:
                    score_text = val
                    break

        athlete_data = {
            "rank": rank_text,
            "name": athlete_name,
            "country": country,
            "dob": dob,
            "ranking_score": score_text,
            "url": athlete_url,
            "counted_competitions": []
        }
        
        # Für die Top-Athleten (und deutsche Starter) die 5 Meetings laden
        if idx < limit_details or country == "GER":
            print(f"Lade Meetings für [{rank_text}] {athlete_name} ({country})...")
            athlete_data["counted_competitions"] = fetch_athlete_breakdown(athlete_url)
            
        athletes.append(athlete_data)

    return athletes

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    rankings = scrape_world_rankings(limit_details=50) # Top 50 + alle Deutschen
    
    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)
        
    print(f"\nErfolgreich {len(rankings)} Athleten mit Detail-Meetings in {output_path} gespeichert.")
