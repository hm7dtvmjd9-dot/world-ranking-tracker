import json
import re

with open('data/ranking_latest.json', 'r', encoding='utf-8') as f:
    latest = json.load(f)

raw_athletes = latest.get('athletes', [])
print(f"Loaded {len(raw_athletes)} athletes from ranking_latest.json")

# Find Luka Herden
luka = None
for ath in raw_athletes:
    if "herden" in ath.get('name', '').lower() or "luka" in ath.get('name', '').lower():
        luka = ath
        break

luka_rank = int(luka['rank']) if luka else 70
luka_score = int(luka['ranking_score']) if luka else 1144
luka_competitions = luka.get('counted_competitions', []) if luka else []
luka_comp_names = [c.get('competition', '').lower() for c in luka_competitions]

database = []
for ath in raw_athletes:
    try:
        rank = int(ath.get('rank', 0))
    except:
        rank = 0
    try:
        score = int(ath.get('ranking_score', 0))
    except:
        score = 0
        
    name = ath.get('name', '').strip()
    country = ath.get('country', '').strip()
    dob = ath.get('dob', '').strip()
    profile_url = ath.get('profile_url', '').strip()
    competitions = ath.get('counted_competitions', [])
    
    # Calculate SB (best mark)
    best_mark = 0.0
    for comp in competitions:
        try:
            m = float(comp.get('mark', 0))
            if m > best_mark:
                best_mark = m
        except:
            pass
            
    # Check common competitions with Luka
    common_comps = []
    for comp in competitions:
        comp_name = comp.get('competition', '').lower()
        for lc in luka_competitions:
            lc_name = lc.get('competition', '').lower()
            if any(k in comp_name and k in lc_name for k in ['gorzów', 'wattenscheid', 'dortmund', 'rhede', 'championships', 'chengdu', 'kassel']):
                common_comps.append({
                    "competition": comp.get('competition'),
                    "date": comp.get('date'),
                    "athlete_mark": comp.get('mark'),
                    "athlete_place": comp.get('place'),
                    "luka_mark": lc.get('mark'),
                    "luka_place": lc.get('place')
                })
                break

    # Build unique ID
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    
    database.append({
        "id": slug,
        "rank": rank,
        "name": name,
        "country": country,
        "dob": dob,
        "ranking_score": score,
        "sb": round(best_mark, 2) if best_mark > 0 else None,
        "profile_url": profile_url,
        "competitions_count": len(competitions),
        "counted_competitions": competitions,
        "comparison": {
            "score_gap": score - luka_score,
            "rank_gap": luka_rank - rank,
            "is_ahead_of_luka": rank < luka_rank,
            "common_competitions": common_comps
        }
    })

# Sort by rank ascending
database.sort(key=lambda x: x['rank'])

output_path = 'data/athletes_database.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({
        "event": "Men's Long Jump",
        "total_athletes": len(database),
        "benchmark_athlete": "Luka Herden",
        "benchmark_rank": luka_rank,
        "benchmark_score": luka_score,
        "athletes": database
    }, f, ensure_ascii=False, indent=2)

print(f"Successfully saved {len(database)} athletes to {output_path}!")
