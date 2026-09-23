import json
import datetime
import random

with open("data/training_sample.json", "r") as f:
    data = json.load(f)

sessions = data.get("sessions", [])
existing_dates = set(s["date"] for s in sessions)

# Generate entries from 2026-08-25 to 2026-09-23
start_date = datetime.date(2026, 8, 25)
end_date = datetime.date(2026, 9, 23)

current = start_date
day_count = 0
while current <= end_date:
    d_str = current.strftime("%Y-%m-%d")
    weekday = current.strftime("%A")
    
    # Generate realistic training sessions
    is_rest_day = current.weekday() in [6] # Sunday rest
    is_jump_day = current.weekday() in [1, 4] # Tuesday, Friday
    is_strength_day = current.weekday() in [0, 3] # Monday, Thursday
    is_sprint_day = current.weekday() in [2, 5] # Wednesday, Saturday

    recovery = random.randint(70, 96) if not is_rest_day else random.randint(85, 98)
    hrv = random.randint(88, 115)
    rhr = random.randint(43, 49)
    sleep = round(random.uniform(7.8, 8.9), 2)
    strain = round(random.uniform(13.5, 17.2), 1) if not is_rest_day else round(random.uniform(6.0, 9.5), 1)
    weight = round(random.uniform(78.2, 78.8), 1)
    calories = random.randint(3200, 3600)
    water = round(random.uniform(3.8, 4.8), 1)

    exercises = []
    session_type = "Regeneration / Ruhetag" if is_rest_day else "Technik Sprung" if is_jump_day else "Kraft / VBT" if is_strength_day else "Sprint & Reaktiv"

    best_mark = None
    eff_mark = None
    approach_speed = None
    rsi = None

    if is_jump_day:
        approach_speed = round(random.uniform(10.35, 10.65), 2)
        best_mark = round(random.uniform(7.98, 8.16), 2)
        eff_mark = round(best_mark + random.uniform(0.04, 0.12), 2)
        rsi = round(random.uniform(2.70, 3.10), 2)
        exercises = [
            {"name": "Dynamisches Einlaufen & Mobility", "sets": "1", "reps": "20 Min", "load": "-", "speed": "-", "notes": "Hüftbeuger & Sprunggelenke frei"},
            {"name": "Kurzanlauf-Sprünge (6-Schritt)", "sets": "4", "reps": "1", "load": "BW", "speed": "9.4 m/s", "notes": "Aktiver Fußaufsatz am Brett"},
            {"name": "Volllauf-Sprünge (14-Schritt)", "sets": "5", "reps": "1", "load": "BW", "speed": f"{approach_speed} m/s", "notes": f"Tagesbestweite: {best_mark}m (effektiv {eff_mark}m)"},
            {"name": "Drop Jumps von 40cm Kasten", "sets": "3", "reps": "4", "load": "BW", "speed": f"RSI: {rsi}", "notes": "Bodenkontaktzeit < 145ms"}
        ]
    elif is_strength_day:
        trapbar = round(random.uniform(240, 265), 1)
        clean = round(random.uniform(142, 150), 1)
        exercises = [
            {"name": "Trap Bar Deadlift (VBT)", "sets": "4", "reps": "3", "load": f"{trapbar} kg", "speed": "0.78 m/s", "notes": "VBT Mean Velocity im Zielbereich"},
            {"name": "Hang Power Clean", "sets": "4", "reps": "2", "load": f"{clean} kg", "speed": "1.42 m/s", "notes": "Explosiver zweiter Zug"},
            {"name": "Bulgarian Split Squats", "sets": "3", "reps": "5", "load": "90 kg", "speed": "0.65 m/s", "notes": "Stabil im Kniegelenk"},
            {"name": "Rumpf & Rotationskraft", "sets": "3", "reps": "12", "load": "Cable 35kg", "speed": "-", "notes": "Anti-Rotation & Beckenstabilität"}
        ]
    elif is_sprint_day:
        speed_max = round(random.uniform(10.60, 10.95), 2)
        exercises = [
            {"name": "Beschleunigungsläufe aus dem Block (30m)", "sets": "4", "reps": "1", "load": "BW", "speed": "Split: 3.82s", "notes": "Projektion im Antritt"},
            {"name": "Fliegende Sprints (20m mit 30m Anlauf)", "sets": "3", "reps": "1", "load": "BW", "speed": f"Top Speed: {speed_max} m/s", "notes": "Hohe Schrittfrequenz"},
            {"name": "Hürdensprünge (5 Hürden)", "sets": "4", "reps": "1", "load": "BW", "speed": "RSI: 2.85", "notes": "Kurze Bodenkontaktzeiten"}
        ]
    else: # rest
        exercises = [
            {"name": "Mobility & Faszientraining", "sets": "1", "reps": "30 Min", "load": "BW", "speed": "-", "notes": "Wade, Achillessehne, Beinbeuger"},
            {"name": "Sauna & Kälteanwendung", "sets": "2", "reps": "15 Min", "load": "-", "speed": "-", "notes": "85°C Sauna + 10°C Kaltwasserbecken"}
        ]

    comments = [
        "Sehr gute Anlaufdynamik, Druck am Brett konstant.",
        "Beine fühlen sich leicht und reaktiv an. ZNS voll erholt.",
        "Kraftwerte stabil im oberen Bereich, VBT-Geschwindigkeit top.",
        "Hohes Tempo im Fliegend-Bereich, Frequenz sehr gut kontrolliert.",
        "Aktive Regeneration, Schlafqualität und HRV optimal."
    ]

    new_session = {
        "date": d_str,
        "weekday": weekday,
        "season_year": 2026,
        "period": "Outdoor / Spätsommer",
        "session_type": session_type,
        "duration_min": 0 if is_rest_day else 105,
        "body_weight_kg": weight,
        "sleep_hours": sleep,
        "sleep_performance_pct": random.randint(88, 97),
        "whoop_recovery_pct": recovery,
        "whoop_hrv": hrv,
        "whoop_rhr": rhr,
        "whoop_strain": strain,
        "target_strain": f"{strain-1.0:.1f} - {strain+1.0:.1f}",
        "calories_kcal": calories,
        "water_liters": water,
        "energy_readiness_1_10": random.randint(7, 10),
        "muscle_soreness_1_10": random.randint(1, 4),
        "approach_speed_11m_to_1m": approach_speed,
        "rsi_score": rsi,
        "jumps_count": len([e for e in exercises if "Sprung" in e["name"]]) * 4,
        "best_mark_m": best_mark,
        "eff_mark_m": eff_mark,
        "trapbar_e1rm_kg": round(random.uniform(240, 260), 1),
        "recovery_sauna_min": 15 if is_rest_day else 0,
        "recovery_cold_min": 8 if is_rest_day else 0,
        "athlete_comments": random.choice(comments),
        "exercises": exercises
    }
    
    sessions.append(new_session)
    current += datetime.timedelta(days=1)

data["sessions"] = sessions
with open("data/training_sample.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ Extended training_sample.json up to {end_date.strftime('%Y-%m-%d')}. Total sessions: {len(sessions)}")
