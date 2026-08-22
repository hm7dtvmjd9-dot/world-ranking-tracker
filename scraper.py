import os
import json
import time
from playwright.sync_api import sync_playwright

def scrape_rankings():
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    athletes_data = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        print("Öffne World Athletics Ranking-Seite...")
        page.goto(url, wait_until="networkidle", timeout=60000)

        # Cookie-Banner schließen falls vorhanden
        try:
            page.locator("#onetrust-accept-btn-handler").click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        # 1. Basis-Informationen aller Zeilen auslesen
        rows = page.locator("tr[data-athlete-url]").all()
        print(f"Gefundene Athleten auf der Seite: {len(rows)}")

        raw_athletes = []
        for idx, row in enumerate(rows[:100]):
            athlete_url = row.get_attribute("data-athlete-url") or ""
            clean_slug = athlete_url.replace("/athletes/", "").strip().strip("/")
            
            rank = row.locator("td[data-th='Rank']").inner_text().strip()
            name = row.locator("td[data-th='Competitor']").inner_text().strip()
            dob = row.locator("td[data-th='DOB']").inner_text().strip()
            country = row.locator("td[data-th='Nat']").inner_text().strip()
            score = row.locator("td[data-th='score']").inner_text().strip()

            raw_athletes.append({
                "rank": rank,
                "name": name,
                "country": country,
                "dob": dob,
                "ranking_score": score,
                "slug": clean_slug,
                "profile_url": f"https://worldathletics.org{athlete_url}" if athlete_url else ""
            })

        print(f"Starte internen Daten-Abruf für alle {len(raw_athletes)} Athleten...")

        # 2. Detail-Ergebnisse direkt über den Browser-Kontext abfragen (ohne UI-Klicks)
        for idx, ath in enumerate(raw_athletes):
            slug = ath["slug"]
            print(f"[{idx+1}/{len(raw_athletes)}] Lade Scores für #{ath['rank']} {ath['name']}...")

            counted_meetings = []
            if slug:
                try:
                    # Direkter API-Aufruf innerhalb des authentifizierten Browser-Tabs
                    js_code = f"""
                        async () => {{
                            try {{
                                const res = await fetch('/world-rankings/RankingScoreCalculation?eventGroup=Men%27s%20Long%20Jump&athleteUrlSlug={slug}');
                                if (!res.ok) return null;
                                let data = await res.json();
                                if (typeof data === 'string') data = JSON.parse(data);
                                return data;
                            }} catch (e) {{
                                return null;
                            }}
                        }}
                    """
                    calc_data = page.evaluate(js_code)

                    if calc_data and "results" in calc_data:
                        for r in calc_data["results"]:
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
                except Exception as e:
                    print(f"Fehler bei {ath['name']}: {e}")

            athletes_data.append({
                "rank": ath["rank"],
                "name": ath["name"],
                "country": ath["country"],
                "dob": ath["dob"],
                "ranking_score": ath["ranking_score"],
                "profile_url": ath["profile_url"],
                "counted_competitions": counted_meetings
            })

            # Kurze Pause, um die Serverlast gering zu halten
            time.sleep(0.08)

        browser.close()

    return athletes_data

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    rankings = scrape_rankings()

    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes_count": len(rankings),
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)

    print(f"\nErfolgreich abgeschlossen! Alle {len(rankings)} Athleten mit vollständigen Meetings in '{output_path}' gespeichert.")
