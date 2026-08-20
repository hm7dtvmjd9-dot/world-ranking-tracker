import os
import json
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://worldathletics.org/world-rankings/long-jump/men"
}

def fetch_score_calculation(slug):
    """Ruft die 5 zählenden Meetings für einen Athleten ab."""
    if not slug:
        return None
    # Bereinige den Slug (entferne führendes '/athletes/')
    clean_slug = slug.replace("/athletes/", "").strip()
    url = f"https://worldathletics.org/world-rankings/RankingScoreCalculation?eventGroup=Men%27s%20Long%20Jump&athleteUrlSlug={clean_slug}"
    
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Fehler beim Laden von {clean_slug}: {e}")
    return None

def scrape_world_rankings():
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    res = requests.get(url, headers=HEADERS)
    
    if res.status_code != 200:
        print(f"Fehler beim Laden der Hauptseite: {res.status_code}")
        return []
        
    soup = BeautifulSoup(res.text, "html.parser")
    rows = soup.find_all("tr", attrs={"data-ctx-click": "toplists.rankingScoreCalculationModal"})
    
    # Fallback falls data-ctx-click variiert
    if not rows:
        rows = [r for r in soup.find_all("tr") if r.has_attr("data-athlete-url")]

    print(f"Gefundene Athleten-Zeilen: {len(rows)}")
    
    athletes_data = []
    
    for idx, row in enumerate(rows[:100]): # Top 100
        # Präzises Auslesen über data-th Attribute
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
            if calc_data and "results" in calc_data:
                for r in calc_data["results"]:
                    counted_meetings.append({
                        "date": r.get("date"),
                        "competition": r.get("competition"),
                        "category": r.get("category"),
                        "mark": r.get("mark"),
                        "wind": r.get("wind"),
                        "place": r.get("place"),
                        "result_score": r.get("resultScore"),
                        "placing_score": r.get("placingScore"),
                        "performance_score": r.get("performanceScore"),
                        "indoor": r.get("indoor", False)
                    })
            time.sleep(0.2) # Schont die API
            
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
        
    print(f"\nErfolgreich! {len(rankings)} Athleten mit allen Meetings in {output_path} gespeichert.")
