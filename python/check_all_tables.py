import zlib
import re

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

# Let's inspect the exact lines in Stream 6, 22, 25 of Events PDF
streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL)

def inspect_meeting_table(s_idx, name):
    decomp = zlib.decompress(streams[s_idx]).decode('latin-1', errors='ignore')
    # find lines with (Men) or (Women)
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
    print(f"\n==================== {name} (Stream {s_idx}) ====================")
    # The table has alternating Men / Women rows.
    # Each row starts with (Men) or (Women), then total count, then '1' for each included discipline.
    # Disciplines: 60 | 200 | 400 | 800 | 1500 | 3000 | 60H | HJ | PV | LJ | TJ | SP
    # Let's group by Men/Women
    rows = []
    cur_row = []
    for t in cleaned:
        if t in ('(Men)', '(Women)', 'Men', 'Women'):
            if cur_row:
                rows.append(cur_row)
            cur_row = [t]
        else:
            if cur_row:
                cur_row.append(t)
    if cur_row:
        rows.append(cur_row)
        
    print(f"Total rows found: {len(rows)}")
    for idx, r in enumerate(rows):
        print(f"Row {idx:2d}: {' | '.join(r)}")

inspect_meeting_table(6, "SILVER")
inspect_meeting_table(22, "BRONZE")
inspect_meeting_table(25, "CHALLENGER")
