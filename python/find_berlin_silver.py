import re
import zlib

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

obj_map = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\b(.*?)\bendobj', raw, re.DOTALL):
    oid = int(m.group(1))
    obj_map[oid] = m.group(2)

silver_sids = [2962, 2966, 2967, 2969, 2970, 2971, 2972, 2974]

# Let's inspect text and rects for Silver
for sid in silver_sids:
    sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', obj_map[sid], re.DOTALL)
    if not sm:
        continue
    decomp = zlib.decompress(sm.group(1)).decode('latin-1', errors='ignore')
    if 'Berlin' in decomp or 'ISTAF' in decomp:
        print(f"Found Berlin in stream {sid}!")
        # print lines around Berlin
        for line in decomp.split('\n'):
            if any(k in line for k in ['Berlin', 'ISTAF', 'GER', 'Men', 'Women']):
                print(line[:100])
