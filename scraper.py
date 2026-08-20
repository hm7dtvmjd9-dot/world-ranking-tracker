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

def get_top100_ranking():
    """Holt die Übersicht der Top 100 Athleten aus der Haupttabelle."""
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    res = requests.get(url, headers=HEADERS)
    if res.status_code != 200:
        print(f"Fehler beim Laden der Ranking-Tabelle: Status {res.status_code}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    table = soup.find("table")
    if not table:
        print("Tabelle nicht gefunden.")
        return []

    athletes = []
    rows = table.find_all("tr")[1:] # Header überspringen
    
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
            
        rank = cells[0].text.strip()
        link_tag = cells[1].find("a")
        name = link_tag.text.strip() if link_tag else cells[1].text.strip()
        
        # URL-Slug für RankingScoreCalculation (z. B. 'switzerland/simon-ehammer-14730721')
        href = link_tag["href"] if (link_tag and "href" in link_tag.attrs) else ""
        slug = href.replace("/athletes/", "").strip()
        
        # Land & Geburtsdatum
        country = cells[2].text.strip() if len(cells) > 2 else ""
        dob = cells[3].text.strip() if len(cells) > 3 else ""
        score = cells[-1].text.strip()

        athletes.append({
            "rank": rank,
            "name": name,
            "country": country,
            "dob": dob,
            "total_score": score,
            "slug": slug,
            "url": f"https://worldathletics.org{href}" if href.startswith("/") else href
        })
    return athletes

def fetch_score_calculation(slug, rank_date="2026-08-18"):
    """Fragt die 5 Meetings direkt über den RankingScoreCalculation-Endpunkt ab."""
    if not slug:
        return None
        
    calc_url = f"https://worldathletics.org/world-rankings/RankingScoreCalculation?eventGroup=Men%27s%20Long%20Jump&athleteUrlSlug={slug}&rankDate={rank_date}"
    
    try:
        res = requests.get(calc_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Fehler bei Slug {slug}: {e}")
    return None

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    print("Starte Scraping der Top 100 Männer Weitsprung...")
    
    athletes_list = get_top100_ranking()
    print(f"{len(athletes_list)} Athleten in der Liste gefunden. Lade Detail-Meetings...")

    full_ranking_data = []

    for idx, ath in enumerate(athletes_list[:100]):
        name = ath["name"]
        slug = ath["slug"]
        print(f"[{idx+1}/100] Lade Scores für {name} ({ath['country']})...")
        
        details = fetch_score_calculation(slug)
        
        counted_meetings = []
        if details and "results" in details:
            for r in details["results"]:
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
        
        full_ranking_data.append({
            "rank": ath["rank"],
            "name": name,
            "country": details.get("country", ath["country"]) if details else ath["country"],
            "dob": details.get("birthDate", ath["dob"]) if details else ath["dob"],
            "ranking_score": details.get("rankingScore", ath["total_score"]) if details else ath["total_score"],
            "profile_url": ath["url"],
            "counted_competitions": counted_meetings
        })
        
        time.sleep(0.3) # Kurze Pause, um die World Athletics API nicht zu überlasten

    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "updated_at": "18 AUG 2026",
            "athletes_count": len(full_ranking_data),
            "athletes": full_ranking_data
        }, f, ensure_ascii=False, indent=2)

    print(f"\nErfolgreich abgeschlossen! {len(full_ranking_data)} Athleten inklusive aller 5 Meetings in '{output_path}' gespeichert.")
