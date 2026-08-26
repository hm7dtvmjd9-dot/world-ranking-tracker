import os
import json
import time
from playwright.sync_api import sync_playwright

def scrape_rankings_with_retry():
    url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&limitByCountry=0"
    athletes_data = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        print("Öffne World Athletics Ranking-Seite...")
        page.goto(url, wait_until="networkidle", timeout=60000)

        # Cookie-Banner schließen
        try:
            page.locator("#onetrust-accept-btn-handler").click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        rows = page.locator("tr[data-athlete-url]").all()
        total_rows = min(len(rows), 100)
        print(f"Gefundene Athleten: {len(rows)}. Starte Extraktion für Top {total_rows}...")

        for idx in range(total_rows):
            # Zeile frisch referenzieren gegen stale elements
            row = page.locator("tr[data-athlete-url]").nth(idx)
            
            athlete_url = row.get_attribute("data-athlete-url") or ""
            clean_slug = athlete_url.replace("/athletes/", "").strip().strip("/")
            
            rank = row.locator("td[data-th='Rank']").inner_text().strip()
            name = row.locator("td[data-th='Competitor']").inner_text().strip()
            dob = row.locator("td[data-th='DOB']").inner_text().strip()
            country = row.locator("td[data-th='Nat']").inner_text().strip()
            score = row.locator("td[data-th='score']").inner_text().strip()

            print(f"[{idx+1}/{total_rows}] Lade Details für #{rank} {name}...")

            counted_meetings = []
            success = False

            # Bis zu 2 Versuche pro Athlet
            for attempt in range(2):
                try:
                    # Zeile exakt in die Mitte des Bildschirms scrollen
                    row.evaluate("el => el.scrollIntoView({block: 'center', inline: 'center'})")
                    page.wait_for_timeout(100)

                    # Klick mit Netzwerk-Erwartung
                    with page.expect_response(
                        lambda r: "RankingScoreCalculation" in r.url and r.status == 200,
                        timeout=4000
                    ) as response_info:
                        row.click(force=True)

                    response = response_info.value
                    text_data = response.text()
                    
                    if text_data.startswith('"') and text_data.endswith('"'):
                        text_data = json.loads(text_data)
                    calc_data = json.loads(text_data)

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
                        success = True
                        break
                except Exception as e:
                    if attempt == 0:
                        print(f"  -> Retry 2 für #{rank} {name}...")
                        page.wait_for_timeout(300)
                    else:
                        print(f"  -> Fehlgeschlagen bei #{rank} {name}: {e}")

                # Nach jedem Versuch eventuelle Modals abräumen
                page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('.modal, .modal-backdrop, [role="dialog"], .fade');
                        elements.forEach(el => el.remove());
                        document.body.classList.remove('modal-open');
                    }
                """)
                page.wait_for_timeout(100)

            # Abschließendes Aufräumen vor dem nächsten Athleten
            page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('.modal, .modal-backdrop, [role="dialog"], .fade');
                    elements.forEach(el => el.remove());
                    document.body.classList.remove('modal-open');
                }
            """)
            page.wait_for_timeout(100)

            athletes_data.append({
                "rank": rank,
                "name": name,
                "country": country,
                "dob": dob,
                "ranking_score": score,
                "profile_url": f"https://worldathletics.org{athlete_url}" if athlete_url else "",
                "counted_competitions": counted_meetings
            })

        browser.close()
    return athletes_data

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    rankings = scrape_rankings_with_retry()

    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes_count": len(rankings),
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)

    print(f"\nFertig! {len(rankings)} Athleten erfolgreich in '{output_path}' gespeichert.")

import shutil

# Falls schon ein altes Ranking existiert -> als Vorwoche sichern
if os.path.exists("data/ranking_latest.json"):
    shutil.copy("data/ranking_latest.json", "data/ranking_previous.json")
