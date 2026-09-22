import json
import random
from datetime import datetime, timedelta

def generate_training_sample():
    start_date = datetime(2025, 11, 1)
    sessions = []
    
    types = ["Technik Sprung", "Kraft / e1RM", "Sprint / Anlauf", "Reaktivkraft / Plyo", "Regeneration / Prehab"]
    
    for i in range(75):
        cur_date = start_date + timedelta(days=i * 4)
        date_str = cur_date.strftime("%Y-%m-%d")
        
        # Biometrics with correlation: Good sleep -> High Whoop -> High RSI -> High approach speed -> Longer jumps
        sleep_h = round(random.uniform(7.0, 9.4), 1)
        whoop_rec = int(min(98, max(28, (sleep_h - 6.5) * 26 + random.gauss(0, 10))))
        whoop_hrv = int(whoop_rec * 1.1 + random.uniform(35, 55))
        whoop_rhr = int(54 - (whoop_rec / 100.0) * 12 + random.gauss(0, 2))
        body_weight = round(random.uniform(78.2, 80.4), 1)
        
        # Neuromuscular status
        energy = min(10, max(4, int(whoop_rec / 10 + random.uniform(-1, 1))))
        rsi = round(1.8 + (whoop_rec / 100.0) * 1.2 + random.uniform(-0.15, 0.15), 2)
        approach_speed = round(9.8 + (rsi / 3.0) * 0.9 + random.uniform(-0.1, 0.15), 2)
        
        stype = types[i % len(types)]
        
        # Jump marks only on jump sessions
        best_mark = None
        eff_mark = None
        jumps_count = 0
        if stype == "Technik Sprung" or (i % 3 == 0):
            # Base mark around 7.85m to 8.20m depending on approach speed and recovery
            mark_raw = 6.0 + (approach_speed - 9.0) * 1.15 + (whoop_rec / 100.0) * 0.45 + random.uniform(-0.1, 0.12)
            best_mark = round(min(8.22, max(7.60, mark_raw)), 2)
            board_acc = random.randint(2, 14)
            eff_mark = round(best_mark + board_acc / 100.0, 2)
            jumps_count = random.randint(6, 12)
            
        # Strength e1RM
        trapbar = round(215 + (whoop_rec / 100.0) * 45 + random.uniform(-5, 10), 1)
        clean = round(130 + (whoop_rec / 100.0) * 25 + random.uniform(-3, 5), 1)
        hipthrust = round(240 + (whoop_rec / 100.0) * 50 + random.uniform(-10, 15), 1)
        
        s_rpe = random.randint(6, 9)
        duration = random.choice([75, 90, 105, 120])
        
        session = {
            "date": date_str,
            "weekday": cur_date.strftime("%A"),
            "season_year": 2026 if cur_date.year == 2026 else 2025,
            "period": "Indoor" if cur_date.month in [1, 2, 11, 12] else "Wettkampf",
            "session_type": stype,
            "duration_min": duration,
            "body_weight_kg": body_weight,
            "sleep_hours": sleep_h,
            "whoop_recovery_pct": whoop_rec,
            "whoop_hrv": whoop_hrv,
            "whoop_rhr": whoop_rhr,
            "energy_readiness_1_10": energy,
            "muscle_soreness_1_10": max(1, 10 - int(whoop_rec / 11)),
            "approach_speed_11m_to_1m": approach_speed,
            "rsi_score": rsi,
            "jumps_count": jumps_count,
            "best_mark_m": best_mark,
            "eff_mark_m": eff_mark,
            "trapbar_e1rm_kg": trapbar,
            "power_clean_e1rm_kg": clean,
            "hip_thrust_e1rm_kg": hipthrust,
            "recovery_sauna_min": random.choice([0, 0, 15, 20]),
            "recovery_cold_min": random.choice([0, 5, 8, 10]),
            "session_rpe_1_10": s_rpe,
            "session_training_load": s_rpe * duration,
            "athlete_comments": "Sehr dynamischer Stemmschritt" if (best_mark and best_mark >= 8.05) else "Solide Reaktivität"
        }
        sessions.append(session)
        
    with open("data/training_sample.json", "w", encoding="utf-8") as f:
        json.dump({"sessions": sessions}, f, indent=2)
    print(f"Generated {len(sessions)} training sample sessions.")

if __name__ == "__main__":
    generate_training_sample()
