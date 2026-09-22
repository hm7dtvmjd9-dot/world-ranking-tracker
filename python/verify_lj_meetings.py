import zlib
import re

def parse_streams(pdf_path):
    with open(pdf_path, 'rb') as f:
        content = f.read()

    streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', content, re.DOTALL)
    results = []
    for idx, s in enumerate(streams):
        try:
            decomp = zlib.decompress(s).decode('latin-1', errors='ignore')
            lines = re.findall(r'\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ', decomp)
            cleaned = []
            for a, b in lines:
                val = a if a else b
                val = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), val)
                val = re.sub(r'\\([\\()])', r'\1', val)
                val = re.sub(r'\)[-\d\s\.]+\(', '', val)
                val = val.strip()
                if len(val) > 0:
                    cleaned.append(val)
            if cleaned:
                results.append((idx, cleaned, decomp))
        except Exception:
            pass
    return results

print("=== Analyzing WIT Europe Calendar 2027 ===")
cal_streams = parse_streams('data/WIT_Europe_Calendar_2027.pdf')
for idx, tokens, _ in cal_streams:
    combined = " | ".join(tokens)
    if any(k in combined for k in ["Aarhus", "Dortmund", "Erfurt", "Gorzów", "Paris", "Berlin", "Sabadell", "Gent", "Jablonec"]):
        print(f"\n--- Stream {idx} ---")
        for i in range(0, len(tokens), 10):
            print(" | ".join(tokens[i:i+10]))

print("\n=== Analyzing WIT Europe Events 2027 ===")
evt_streams = parse_streams('data/WIT_Europe_Events_2027.pdf')
for idx, tokens, decomp in evt_streams:
    combined = " | ".join(tokens)
    if "Total" in combined or "LJ" in combined or "Berlin" in combined or "Paris" in combined:
        print(f"\n--- Stream {idx} (Tokens: {len(tokens)}) ---")
        for i in range(0, min(len(tokens), 120), 10):
            print(" | ".join(tokens[i:i+10]))
