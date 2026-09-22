import zlib
import re

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL)

# In stream 22 (Bronze), let's print EVERY rectangle in LJ column
decomp = zlib.decompress(streams[22]).decode('latin-1', errors='ignore')
commands = re.findall(r'([0-9\.\-]+(?:\s+[0-9\.\-]+)*\s+[a-zA-Z\*\']+)', decomp)

current_color = None
lj_rects = []
for cmd in commands:
    if 'rg' in cmd or 'g' in cmd:
        current_color = cmd.strip()
    elif 're' in cmd:
        parts = cmd.strip().split()
        if len(parts) >= 5 and parts[-1] == 're':
            x, y, w, h = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
            # LJ column is ~586
            if 580 <= x <= 595 and h > 5:
                lj_rects.append((y, h, current_color, w))

print("=== ALL LJ RECTS IN BRONZE (Stream 22) ===")
for y, h, c, w in sorted(lj_rects, key=lambda x: -x[0]):
    print(f"Y={y:6.2f}, H={h:4.2f}, W={w:4.1f}, Color={c}")
