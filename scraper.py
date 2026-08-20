import os
import json
import requests
from bs4 import BeautifulSoup

def fetch_wa_rankings():
    # World Athletics Ranking URL
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
    }
    
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print("Fehler beim Laden der Seite.")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    athletes = []
    
    # Tabelle auslesen
    table = soup.find("table", class_="records-table")
    if not table:
        # Fallback Suche nach Standardtabelle
        table = soup.find("table")
        
    if table:
        rows = table.find_all("tr")[1:] # Header überspringen
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 4:
                rank = cols[0].text.strip()
                name = cols[1].text.strip()
                country = cols[2].text.strip() if len(cols) > 2 else ""
                score = cols[-1].text.strip()
                
                # Detail-Link für die 5 Meetings
                link_elem = cols[1].find("a")
                athlete_url = f"https://worldathletics.org{link_elem['href']}" if link_elem and 'href' in link_elem.attrs else ""
                
                athletes.append({
                    "rank": rank,
                    "name": name,
                    "country": country,
                    "total_score": score,
                    "profile_url": athlete_url
                })
                
    return athletes

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    rankings = fetch_wa_rankings()
    
    # Speichern der Daten
    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": "2026-08-18",
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)
        
    print(f"Fertig! {len(rankings)} Athleten erfolgreich in {output_path} gespeichert.")
