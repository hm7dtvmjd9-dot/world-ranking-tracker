import zlib
import re
import json

def extract_calendar():
    with open('data/WIT_Europe_Calendar_2027.pdf', 'rb') as f:
        raw = f.read()

    streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL)
    meetings = []
    
    # Let's inspect all strings in calendar
    for s_idx, s in enumerate(streams):
        try:
            decomp = zlib.decompress(s).decode('latin-1', errors='ignore')
        except:
            continue
            
        # extract all strings
        tokens = re.findall(r'\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ', decomp)
        cleaned = []
        for a, b in tokens:
            val = a if a else b
            val = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), val)
            val = re.sub(r'\\([\\()])', r'\1', val)
            val = re.sub(r'\)[-\d\s\.]+\(', '', val)
            val = val.strip()
            if val:
                cleaned.append(val)
        
        joined = " | ".join(cleaned)
        # Check tier
        tier = None
        if "WIT SILVER" in joined or "SILVER 2027" in joined:
            tier = "Silver"
        elif "WIT BRONZE" in joined or "BRONZE 2027" in joined:
            tier = "Bronze"
        elif "WIT CHALLENGER" in joined or "CHALLENGER 2027" in joined:
            tier = "Challenger"
            
        if tier or any(k in joined for k in ["Luxembourg", "Cottbus", "Gorzów", "Berlin", "Paris", "Dortmund", "Erfurt", "Gent", "Jablonec"]):
            print(f"\n--- Stream {s_idx} ({tier if tier else 'Unknown Tier'}) ---")
            print(" | ".join(cleaned))

extract_calendar()
