import urllib.request
import ssl
import re

ctx = ssl._create_unverified_context()
url = "https://worldathletics.org/world-rankings/long-jump/men?regionType=world&page=1&rankDate=2023-06-20&limitByCountry=0"
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print(f"Success! Fetched {len(html)} bytes")
        
        # Check for table rows or athlete links
        rows = re.findall(r'<tr[^>]*data-athlete-url="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL)
        print(f"Found {len(rows)} athlete rows in static HTML!")
        
        for idx, (url_path, row_html) in enumerate(rows[:5]):
            # extract cells
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
            clean_cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            print(f"  #{idx+1}: {clean_cells[:5]} -> {url_path}")
            
        # Check if Luka Herden is in the rows
        for idx, (url_path, row_html) in enumerate(rows):
            if "Herden" in row_html or "herden" in url_path:
                cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
                clean_cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
                print(f"\n FOUND LUKA HERDEN in 2023-06-20 snapshot:")
                print(f"  Rank: #{idx+1}, Data: {clean_cells}, URL: {url_path}")

except Exception as e:
    print(f"Fetch failed: {e}")
