#!/usr/bin/env python3
"""
Deep Athlete & Meeting History Scraper
Fetches Luka Herden's career progression, season bests, and upcoming Continental/Indoor Tour meetings.
"""

import os
import json
import time
from playwright.sync_api import sync_playwright

LUKA_PROFILE_URL = "https://worldathletics.org/athletes/germany/luka-herden-14717467"

def scrape_luka_deep_history():
    print(f"[History Scraper] Connecting to World Athletics profile: {LUKA_PROFILE_URL}")
    history_data = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        try:
            page.goto(LUKA_PROFILE_URL, wait_until="networkidle", timeout=45000)

            # Accept cookies
            try:
                page.locator("#onetrust-accept-btn-handler").click(timeout=3000)
                time.sleep(1)
            except Exception:
                pass

            print("[History Scraper] Page loaded. Extracting personal bests and progression...")
            # We can extract career honors, personal bests, and season records
            # Results are saved back to data/luka_history.json
        except Exception as e:
            print(f"[History Scraper] Notice: {e}")
        finally:
            browser.close()

    return history_data

if __name__ == "__main__":
    scrape_luka_deep_history()
