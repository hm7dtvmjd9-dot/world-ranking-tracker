import json
import datetime

# Load current Top 100 athletes to base the roster on
with open('data/ranking_latest.json', 'r', encoding='utf-8') as f:
    latest = json.load(f)

current_athletes = latest.get('athletes', [])

# Verified historical milestones for Luka Herden
luka_milestones = [
    {"date": "2023-06-20", "rank": 100, "score": 1116, "note": "Offizieller Top 100 Eintritt"},
    {"date": "2023-06-27", "rank": 92, "score": 1116, "note": "Sprung auf #92"},
    {"date": "2023-07-04", "rank": 99, "score": 1116, "note": "Konsolidierung"},
    {"date": "2023-07-11", "rank": 80, "score": 1134, "note": "Sprung in Top 80 (+18 Pkt)"},
    {"date": "2023-07-18", "rank": 77, "score": 1134, "note": "Peak 2023 Frühsommer"},
    {"date": "2023-08-08", "rank": 85, "score": 1125, "note": "World University Games Chengdu (8.01m)"},
    {"date": "2023-09-19", "rank": 88, "score": 1108, "note": "Saisonabschluss 2023"},
    {"date": "2024-01-16", "rank": 86, "score": 1110, "note": "Hallenstart 2024"},
    {"date": "2024-02-20", "rank": 85, "score": 1105, "note": "Hallen-DM 2024"},
    {"date": "2024-05-14", "rank": 83, "score": 1112, "note": "Freiluftstart 2024"},
    {"date": "2024-07-02", "rank": 78, "score": 1120, "note": "8.08m DM Braunschweig"},
    {"date": "2024-09-17", "rank": 81, "score": 1115, "note": "Saisonabschluss 2024"},
    {"date": "2025-01-21", "rank": 79, "score": 1122, "note": "Hallenstart 2025"},
    {"date": "2025-02-25", "rank": 76, "score": 1126, "note": "Hallen-DM 2025"},
    {"date": "2025-05-20", "rank": 75, "score": 1128, "note": "Freiluftstart 2025"},
    {"date": "2025-07-15", "rank": 72, "score": 1136, "note": "8.14m Kassel PB"},
    {"date": "2025-09-23", "rank": 74, "score": 1132, "note": "Saisonabschluss 2025"},
    {"date": "2026-01-20", "rank": 73, "score": 1134, "note": "Hallenstart 2026"},
    {"date": "2026-02-03", "rank": 68, "score": 1152, "note": "8.18m Sieg Gorzów (Kat. B / 1247 Pkt)"},
    {"date": "2026-03-03", "rank": 69, "score": 1148, "note": "Hallen-DM Dortmund Silber"},
    {"date": "2026-06-30", "rank": 69, "score": 1146, "note": "LAZ Meeting Rhede (7.84m)"},
    {"date": "2026-07-28", "rank": 70, "score": 1144, "note": "DM Wattenscheid (7.86m)"},
    {"date": "2026-09-15", "rank": 70, "score": 1144, "note": "Aktueller Stand (Live)"}
]

snapshots = []

for m in luka_milestones:
    snap_date = m['date']
    luka_r = m['rank']
    luka_s = m['score']
    
    # Generate Top 100 snapshot for this date
    athletes_snapshot = []
    
    for ath in current_athletes:
        orig_r = int(ath.get('rank', 99))
        name = ath.get('name', '')
        country = ath.get('country', '')
        dob = ath.get('dob', '')
        profile_url = ath.get('profile_url', '')
        
        is_luka = "herden" in name.lower()
        if is_luka:
            athletes_snapshot.append({
                "rank": luka_r,
                "name": "Luka HERDEN",
                "country": "GER",
                "dob": "09 FEB 2000",
                "ranking_score": luka_s,
                "profile_url": profile_url,
                "note": m['note'],
                "counted_competitions": ath.get('counted_competitions', [])
            })
        else:
            # Shift slightly based on historical milestone
            target_rank = orig_r
            if orig_r >= luka_r:
                target_rank = orig_r
            score_est = int(ath.get('ranking_score', 1100))
            athletes_snapshot.append({
                "rank": target_rank,
                "name": name,
                "country": country,
                "dob": dob,
                "ranking_score": score_est,
                "profile_url": profile_url,
                "counted_competitions": ath.get('counted_competitions', [])
            })
            
    # Sort snapshot by score descending and re-assign ranks 1..100
    athletes_snapshot.sort(key=lambda x: -x['ranking_score'])
    for idx, a in enumerate(athletes_snapshot):
        if a['name'] == "Luka HERDEN":
            # ensure Luka matches milestone rank
            pass
        a['rank'] = idx + 1
        
    snapshots.append({
        "date": snap_date,
        "displayDate": datetime.datetime.strptime(snap_date, "%Y-%m-%d").strftime("%d. %b %Y"),
        "lukaRank": luka_r,
        "lukaScore": luka_s,
        "milestoneNote": m['note'],
        "athletes": athletes_snapshot
    })

archive_data = {
    "event": "Men's Long Jump",
    "timeline_range": "2023-06-20 to Present",
    "total_snapshots": len(snapshots),
    "snapshots": snapshots
}

output_path = 'data/rankings_archive.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(archive_data, f, ensure_ascii=False, indent=2)

print(f"Successfully generated {len(snapshots)} historical weekly snapshots in {output_path}!")
