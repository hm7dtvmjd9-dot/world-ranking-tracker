import os
import json
import time
from playwright.sync_api import sync_playwright

def scrape_rankings_with_robust_clicks():
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

        # Cookie-Banner schließen
        try:
            page.locator("#onetrust-accept-btn-handler").click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        rows = page.locator("tr[data-athlete-url]").all()
        print(f"Gefundene Athleten auf Seite 1: {len(rows)}")

        for idx, row in enumerate(rows[:100]):
            athlete_url = row.get_attribute("data-athlete-url") or ""
            clean_slug = athlete_url.replace("/athletes/", "").strip().strip("/")
            
            rank = row.locator("td[data-th='Rank']").inner_text().strip()
            name = row.locator("td[data-th='Competitor']").inner_text().strip()
            dob = row.locator("td[data-th='DOB']").inner_text().strip()
            country = row.locator("td[data-th='Nat']").inner_text().strip()
            score = row.locator("td[data-th='score']").inner_text().strip()

            print(f"[{idx+1}/{min(len(rows), 100)}] Klicke für #{rank} {name}...")

            counted_meetings = []
            try:
                # Zeile sichtbar machen
                row.scroll_into_view_if_needed()
                
                # Wir warten gezielt auf die Netzwerk-Antwort des Klicks
                with page.expect_response(lambda r: "RankingScoreCalculation" in r.url and r.status == 200, timeout=5000) as response_info:
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
            except Exception as e:
                print(f"  -> Hinweis bei #{rank} {name}: {e}")

            # Wichtig: Modal und Overlays sofort hart per JS löschen, damit Zeile frei ist
            page.evaluate("""
                () => {
                    const modals = document.querySelectorAll('.modal, .modal-backdrop, [role="dialog"], .fade');
                    modals.forEach(m => m.remove());
                    document.body.classList.remove('modal-open');
                }
            """)
            page.wait_for_timeout(150)

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
    rankings = scrape_rankings_with_robust_clicks()

    output_path = "data/ranking_latest.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "event": "Men's Long Jump",
            "athletes_count": len(rankings),
            "athletes": rankings
        }, f, ensure_ascii=False, indent=2)

    print(f"\nErfolgreich! {len(rankings)} Athleten inklusive aller Meetings in '{output_path}' gespeichert.")
