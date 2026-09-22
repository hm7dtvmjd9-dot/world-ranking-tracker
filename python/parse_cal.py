import re
import zlib

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

obj_map = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\b(.*?)\bendobj', raw, re.DOTALL):
    oid = int(m.group(1))
    obj_map[oid] = m.group(2)

def parse_full_page(sids):
    rects = []
    texts = []
    
    for sid in sids:
        sbody = obj_map.get(sid, b'')
        sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', sbody, re.DOTALL)
        if not sm:
            continue
        decomp = zlib.decompress(sm.group(1)).decode('latin-1', errors='ignore')
        
        raw_tokens = re.findall(r'(\((?:[^()\\]|\\.)*\)|\[.*?\]|[^\s()\[\]]+)', decomp)
        cur_x, cur_y = 0.0, 0.0
        cur_color = ""
        stack = []
        for t in raw_tokens:
            if t in ('g', 'rg'):
                cur_color = " ".join(stack) + " " + t
                stack = []
            elif t == 're':
                if len(stack) >= 4:
                    try:
                        x, y, w, h = float(stack[-4]), float(stack[-3]), float(stack[-2]), float(stack[-1])
                        rects.append((x, y, w, h, cur_color))
                    except:
                        pass
                stack = []
            elif t == 'Tm':
                if len(stack) >= 6:
                    try:
                        cur_x, cur_y = float(stack[-2]), float(stack[-1])
                    except:
                        pass
                stack = []
            elif t in ('Td', 'TD'):
                if len(stack) >= 2:
                    try:
                        cur_x += float(stack[-2])
                        cur_y += float(stack[-1])
                    except:
                        pass
                stack = []
            elif t == 'T*':
                cur_y -= 10
                stack = []
            elif t in ('Tj', 'TJ'):
                if stack:
                    s = stack[-1]
                    s = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), s)
                    s = re.sub(r'\\([\\()])', r'\1', s)
                    # keep readable characters
                    s_clean = re.sub(r'[-\d\.\s]+', '', s)
                    s_clean = re.sub(r'[()]', '', s_clean)
                    texts.append((cur_x, cur_y, s_clean.strip(), s))
                stack = []
            else:
                stack.append(t)
                if len(stack) > 10:
                    stack = stack[-10:]
    return rects, texts

# Also parse Calendar to get the exact meeting numbers and dates!
with open('data/WIT_Europe_Calendar_2027.pdf', 'rb') as f:
    cal_raw = f.read()

print("=== PARSING CALENDAR ===")
# Calendar has meetings numbered 1 to N in Silver, Bronze, Challenger
cal_streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', cal_raw, re.DOTALL)
for idx, s in enumerate(cal_streams):
    try:
        decomp = zlib.decompress(s).decode('latin-1', errors='ignore')
        if any(k in decomp for k in ['Berlin', 'Gorzów', 'Paris', 'Dortmund', 'Erfurt']):
            print(f"Cal stream {idx}:")
            # print all ( ... ) strings
            strings = re.findall(r'\((.*?)\)', decomp)
            print(" | ".join(strings))
    except:
        pass
