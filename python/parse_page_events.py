import re
import zlib

with open('data/WIT_Europe_Events_2027.pdf', 'rb') as f:
    raw = f.read()

obj_map = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\b(.*?)\bendobj', raw, re.DOTALL):
    oid = int(m.group(1))
    obj_map[oid] = m.group(2)

def inspect_stream_ops(stream_bytes):
    decomp = zlib.decompress(stream_bytes).decode('latin-1', errors='ignore')
    tokens = []
    # match patterns
    # 1. string in parentheses or brackets: ( ... ) or [ ... ]
    # 2. regular tokens separated by whitespace
    raw_tokens = re.findall(r'(\((?:[^()\\]|\\.)*\)|\[.*?\]|[^\s()\[\]]+)', decomp)
    
    text_entries = []
    rect_entries = []
    
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
                    rect_entries.append((x, y, w, h, cur_color))
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
                # clean up s
                s = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), s)
                s = re.sub(r'\\([\\()])', r'\1', s)
                s = re.sub(r'[-\d\.\s]+', '', s)
                s = re.sub(r'[()]', '', s)
                if s.strip():
                    text_entries.append((cur_x, cur_y, s.strip()))
            stack = []
        else:
            stack.append(t)
            if len(stack) > 10:
                stack = stack[-10:]
                
    return rect_entries, text_entries

pages = {
    'Page 1 (SILVER)': [2962, 2966, 2967, 2969, 2970, 2971, 2972, 2974],
    'Page 2 (BRONZE)': [2],
    'Page 3 (CHALLENGER)': [6]
}

for page_name, sids in pages.items():
    print(f"\n=====================================")
    print(f"       {page_name}")
    print(f"=====================================")
    all_rects = []
    all_texts = []
    for sid in sids:
        sbody = obj_map.get(sid, b'')
        sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', sbody, re.DOTALL)
        if sm:
            r, t = inspect_stream_ops(sm.group(1))
            all_rects.extend(r)
            all_texts.extend(t)
            
    print(f"Total rects: {len(all_rects)}, total texts: {len(all_texts)}")
    peach_lj = [r for r in all_rects if 580 <= r[0] <= 595 and '0.988' in r[4]]
    print(f"Total peach LJ rects: {len(peach_lj)}")
    for r in sorted(peach_lj, key=lambda x: -x[1]):
        y = r[1]
        print(f"\nPeach LJ Rect at Y={y:.2f} (w={r[2]:.1f}):")
        nearby = [t for t in all_texts if abs(t[1] - y) < 12]
        nearby = sorted(nearby, key=lambda x: x[0])
        print("  Row text: " + " | ".join(f"[{t[0]:.1f}, {t[1]:.1f}] {t[2]}" for t in nearby))
        
        # Find who is in this row (Men or Women)
        gender = [t[2] for t in nearby if t[2] in ('Men', 'Women')]
        print(f"  --> GENDER: {gender}")
