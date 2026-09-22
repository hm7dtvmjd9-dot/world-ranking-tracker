import zlib
import re

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL)
print(f"Total streams: {len(streams)}")

def get_stream_tokens_with_pos(decomp):
    # Regex to find commands
    tokens = []
    # match Tm, Td, TD, T*, Tj, TJ, re, rg, g
    # simple scanner
    pos = [0.0, 0.0] # x, y
    color = "0 g"
    
    # We can split by whitespace and operators
    lines = decomp.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.endswith('rg') or line.endswith('g'):
            color = line
        elif line.endswith('re'):
            parts = line.split()
            if len(parts) >= 5:
                try:
                    x, y, w, h = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
                    tokens.append(('re', x, y, w, h, color))
                except:
                    pass
        elif line.endswith('Tm'):
            parts = line.split()
            if len(parts) >= 7:
                try:
                    pos[0] = float(parts[4])
                    pos[1] = float(parts[5])
                except:
                    pass
        elif line.endswith('Td') or line.endswith('TD'):
            parts = line.split()
            if len(parts) >= 3:
                try:
                    pos[0] += float(parts[0])
                    pos[1] += float(parts[1])
                except:
                    pass
        elif line.endswith('T*'):
            pos[1] -= 10
        elif 'Tj' in line or 'TJ' in line:
            # extract text
            text_match = re.findall(r'\((.*?)\)|\[(.*?)\]', line)
            for tm in text_match:
                t = tm[0] if tm[0] else tm[1]
                t = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), t)
                t = re.sub(r'\\([\\()])', r'\1', t)
                t = re.sub(r'[-\d\.\s]+', '', t)
                t = re.sub(r'[()]', '', t)
                if t.strip():
                    tokens.append(('text', pos[0], pos[1], t.strip()))
    return tokens

for s_idx, s in enumerate(streams):
    try:
        decomp = zlib.decompress(s).decode('latin-1', errors='ignore')
    except:
        continue
    if '0.988 0.894 0.839 rg' in decomp:
        print(f"\n=================== Stream {s_idx} has PEACH rects ===================")
        items = get_stream_tokens_with_pos(decomp)
        # find all peach rects in LJ column (x around 586)
        peach_lj = [it for it in items if it[0] == 're' and 580 <= it[1] <= 595 and '0.988 0.894 0.839' in it[5]]
        print(f"Found {len(peach_lj)} peach LJ rects:")
        for r in peach_lj:
            print(f"  Rect at x={r[1]}, y={r[2]}, w={r[3]}, h={r[4]}")
            # find text near this Y
            nearby_text = [it for it in items if it[0] == 'text' and abs(it[2] - r[2]) < 6]
            print(f"    Nearby text (within 6pt Y): {[(t[1], t[2], t[3]) for t in nearby_text]}")
