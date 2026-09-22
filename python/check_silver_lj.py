import re
import zlib

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

obj_map = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\b(.*?)\bendobj', raw, re.DOTALL):
    oid = int(m.group(1))
    obj_map[oid] = m.group(2)

silver_sids = [2962, 2966, 2967, 2969, 2970, 2971, 2972, 2974]

# Let's inspect all rects and texts for Silver
all_lines = []
for sid in silver_sids:
    sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', obj_map[sid], re.DOTALL)
    if not sm:
        continue
    decomp = zlib.decompress(sm.group(1)).decode('latin-1', errors='ignore')
    all_lines.extend(decomp.split('\n'))

# Let's see: in Silver, how are rows indexed?
# Each meeting has an index number: 1, 2, 3, 4, 5, 6, 7 (Berlin), 8, 9, 10, 11, 12, 13, 14, 15 (Paris)...
# Let's find every occurrence of '(5)', '(7)', '(15)' or meeting index numbers!
from parse_page_events import inspect_stream_ops

rects, texts = [], []
for sid in silver_sids:
    sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', obj_map[sid], re.DOTALL)
    r, t = inspect_stream_ops(sm.group(1))
    rects.extend(r)
    texts.extend(t)

# Sort texts by Y descending
print("=== All text elements with Men or Women on Silver page ===")
men_women = [t for t in texts if t[2] in ('Men', 'Women')]
men_women = sorted(men_women, key=lambda x: -x[1])
for idx, mw in enumerate(men_women):
    # Check if there is a peach LJ rect matching this Y (+/- 4pt)
    peach_matches = [r for r in rects if 580 <= r[0] <= 595 and '0.988' in r[4] and abs(r[1] - mw[1]) < 6]
    # Also find any text within +/- 6pt to see meeting number or name
    row_text = [t[2] for t in texts if abs(t[1] - mw[1]) < 6]
    has_peach = len(peach_matches) > 0
    flag = "🍑 PEACH LJ (INCLUDED!)" if has_peach else ""
    print(f"Row {idx:2d} | Y={mw[1]:.1f} | {mw[2]:5s} | {flag}")
    if row_text:
        print(f"       Texts: {' | '.join(row_text)}")
