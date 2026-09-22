import re
import zlib

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

# Map object ID to body
obj_map = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\b(.*?)\bendobj', raw, re.DOTALL):
    oid = int(m.group(1))
    obj_map[oid] = m.group(2)

print(f"Total objects found: {len(obj_map)}")

# Pages
pages = [2961, 1, 5]
for p in pages:
    body = obj_map.get(p, b'')
    # get contents
    contents_match = re.search(rb'/Contents\s*(\[\s*[\d\s\wR]+\s*\]|\d+\s+0\s+R)', body)
    print(f"\nPage {p} contents ref: {contents_match.group(1).decode() if contents_match else 'None'}")
    # find all stream IDs
    if contents_match:
        ref_str = contents_match.group(1).decode()
        stream_ids = [int(x) for x in re.findall(r'(\d+)\s+0\s+R', ref_str)]
        print(f"  Stream Object IDs: {stream_ids}")
        for sid in stream_ids:
            sbody = obj_map.get(sid, b'')
            # find stream data
            sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', sbody, re.DOTALL)
            if sm:
                try:
                    decomp = zlib.decompress(sm.group(1)).decode('latin-1', errors='ignore')
                    print(f"    Stream obj {sid}: decompressed length = {len(decomp)}")
                    # check for peach rects
                    peach_rects = []
                    for line in decomp.split('\n'):
                        if '0.988 0.894 0.839 rg' in line:
                            is_peach = True
                        elif ' g' in line or ' rg' in line:
                            is_peach = False
                        if 're' in line:
                            parts = line.strip().split()
                            if len(parts) >= 5 and parts[-1] == 're':
                                x, y, w, h = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
                                if 580 <= x <= 595 and '0.988 0.894 0.839' in line:
                                    peach_rects.append((x, y, w, h))
                    if peach_rects:
                        print(f"      Peach LJ rects in obj {sid}: {peach_rects}")
                except Exception as e:
                    print(f"    Stream obj {sid} decompress error: {e}")
