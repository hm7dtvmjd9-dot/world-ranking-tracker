import os
import json
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://worldathletics.org/world-rankings/long-jump/men"
}

def fetch_score_calculation(athlete_url):
    """Ruft die 5 zählenden Meetings ab und entpackt den rohen Text-String."""
    if not athlete_url:
        return None
        
    clean_slug = athlete_url.replace("/athletes/", "").strip().strip("/")
    url = "https://worldathletics.org/world-rankings/RankingScoreCalculation"
    params = {
        "eventGroup": "Men's Long Jump",
        "athleteUrlSlug": clean_slug
    }
    
    try:
        res = requests.get(url, params=params, headers=HEADERS, timeout=10)
        if res.status_code != 200:
            print(f"  -> HTTP Fehler {res.status_code} für {clean_slug}")
            return None

        text = res.text.strip()
        
        # World Athletics gibt diesen Endpunkt als in Anführungszeichen verpackten String zurück
        if text.startswith('"') and text.endswith('"'):
            text = json.loads(text)
            
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"  -> Parsing-Fehler bei {clean_slug}: {e}")
        return None

def scrape_world_rankings():
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    res = requests.get(url, headers=HEADERS)
    
    if res.status_code != 200:
        print(f"Fehler beim Laden der Übersichtsseite: Status {res.status_code}")
        return []
        
    soup = BeautifulSoup(res.text, "html.parser")
    rows = soup.find_all("tr", attrs={"data-athlete-url": True})
    
    if not rows:
        rows = [r for r in soup.find_all("tr") if r.has_attr("data-ctx-click")]

    print(f"Gefundene Athleten auf Seite 1: {len(rows)}")
    athletes_data = []
    
    for idx, row in enumerate(rows[:100]):
        rank_td = row.find("td", attrs={"data-th": "Rank"})
        name_td = row.find("td", attrs={"data-th": "Competitor"})
        dob_td = row.find("td", attrs={"data-th": "DOB"})
        nat_td = row.find("td", attrs={"data-th": "Nat"})
        score_td = row.find("td", attrs={"data-th": "score"})
        
        rank = rank_td.get_text(strip=True) if rank_td else str(idx + 1)
        name = name_td.get_text(strip=True) if name_td else ""
        dob = dob_td.get_text(strip=True) if dob_td else ""
        country = nat_td.get_text(strip=True) if nat_td else ""
        score = score_td.get_text(strip=True) if score_td else ""
        
        athlete_url = row.get("data-athlete-url", "")
        
        print(f"[{idx+1}/100] Lade Meetings für #{rank} {name} ({country})...")
        
        counted_meetings = []
        if athlete_url:
            calc_data = fetch_score_calculation(athlete_url)
            if calc_data and isinstance(calc_data, dict):
                results_list = calc_data.get("results", [])
                for r in results_list:
                    counted_meetings.append({
                        "date": r.get("date"),
                        "competition": r.get("competition"),
                        "venue": r.get("venue", ""),
                        "category": r.get("category"),
                        "mark": r.get("mark"),
                        "wind": r.get("wind"),
                        "place": r.get("place"),
                        "result_score": r.get("resultScore"),
                        "placing_score": r.get("placingScore"),
                        "performance_score": r.get("performanceScore"),
                        "indoor": r.get("indoor", False)
                    })
            time.sleep(0.25)
            
        athletes_data.append({
            "rank": rank,
            "name": name,
            "country": country,
            "dob": dob,
            "ranking_score": score,
            "profile_url": f"https://worldathletics.org{athlete_url}" if athlete_url else "",
            "counted_competitions": counted_meetings
        })
        
    return athletes_data

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    rankings = scrape_world_rankings()
    
    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes_count": len(rankings),
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)
        
    print(f"\nFertig! {len(rankings)} Athleten erfolgreich in '{output_path}' gespeichert.")
