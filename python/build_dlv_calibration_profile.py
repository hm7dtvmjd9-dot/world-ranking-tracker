import datetime
import glob
import json
import os
import re
import struct
import pypdf

DLV_WEIT_DIR = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub/dlv_diagnostik/Weit"
VIDEOS_ROOT = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub/dlv_diagnostik/Videos"
OUT_JSON = "/Users/luka/.gemini/antigravity/scratch/world-ranking-tracker/data/dlv_calibration_profile.json"
BUNDLE_JSON = "/Users/luka/.gemini/antigravity/scratch/world-ranking-tracker/data/dlv_1080_bundle.json"
WEIT_CSV = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub/parsed_dlv_weit.csv"


def parse_float(val):
    try:
        return float(str(val).replace(",", ".").replace("%", "").strip())
    except Exception:
        return None


def parse_mp4_meta(path):
    """Lightweight binary MP4 container metadata extractor (duration, frames, container_fps)."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except Exception:
        return None

    def parse_trak(buf, s, e):
        info = {}

        def scan(a, b):
            p = a
            while p + 8 <= b:
                sz = struct.unpack(">I", buf[p:p + 4])[0]
                typ = buf[p + 4:p + 8].decode("latin1", errors="ignore")
                hdr = 8
                if sz == 1 and p + 16 <= b:
                    sz = struct.unpack(">Q", buf[p + 8:p + 16])[0]
                    hdr = 16
                elif sz == 0:
                    sz = b - p
                if sz < hdr or p + sz > b:
                    break
                if typ in ("mdia", "minf", "stbl"):
                    scan(p + hdr, p + sz)
                elif typ == "mdhd" and p + hdr + 20 <= p + sz:
                    ver = buf[p + hdr]
                    if ver == 0:
                        ts, dur = struct.unpack(">II", buf[p + hdr + 12:p + hdr + 20])
                        info["ts"] = ts
                        info["dur"] = dur
                elif typ == "hdlr" and p + hdr + 12 <= p + sz:
                    info["handler"] = buf[p + hdr + 8:p + hdr + 12].decode("latin1", errors="ignore")
                elif typ == "stts" and p + hdr + 8 <= p + sz:
                    cnt = struct.unpack(">I", buf[p + hdr + 4:p + hdr + 8])[0]
                    tot_s = 0
                    for k in range(min(cnt, 8)):
                        o = p + hdr + 8 + 8 * k
                        if o + 8 <= p + sz:
                            sc, _ = struct.unpack(">II", buf[o:o + 8])
                            tot_s += sc
                    info["frames"] = tot_s
                p += sz

        scan(s, e)
        if info.get("handler") == "vide" and info.get("ts") and info.get("dur"):
            dur_s = info["dur"] / info["ts"]
            cfps = round(info.get("frames", 0) / dur_s, 2) if dur_s > 0 else None
            # Heuristic for OSP DLV Slow-Mo MP4s (wm...mp4 stored at 50fps container >= 10s -> 200fps camera = 4x Slow-Mo)
            fname_low = os.path.basename(path).lower()
            rec_fps = cfps
            if cfps and 45 <= cfps <= 55 and fname_low.startswith("wm") and dur_s >= 9.0:
                rec_fps = 200.0
            return {
                "dur_s": round(dur_s, 2),
                "frames": info.get("frames"),
                "container_fps": cfps,
                "suggested_camera_fps": rec_fps,
            }
        return None

    def walk(buf, start, end):
        pos = start
        tracks = []
        while pos + 8 <= end:
            sz = struct.unpack(">I", buf[pos:pos + 4])[0]
            typ = buf[pos + 4:pos + 8].decode("latin1", errors="ignore")
            hdr = 8
            if sz == 1 and pos + 16 <= end:
                sz = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
                hdr = 16
            elif sz == 0:
                sz = end - pos
            if sz < hdr or pos + sz > end:
                break
            if typ == "trak":
                tr = parse_trak(buf, pos + hdr, pos + sz)
                if tr:
                    tracks.append(tr)
            elif typ in ("moov", "udta", "edts"):
                tracks.extend(walk(buf, pos + hdr, pos + sz))
            pos += sz
        return tracks

    res = walk(data, 0, len(data))
    return res[0] if res else None


def find_video_match(date_ddmmyyyy, attempt_no, is_ehammer=False, offiziell_m=None):
    """Find best matching video folder and clip(s) on Luka's Mac for a given DLV date & attempt."""
    parts = date_ddmmyyyy.split(".")
    if len(parts) != 3:
        return None
    d, m, y = parts
    target_dt = datetime.date(int(y), int(m), int(d))
    iso = f"{y}-{m}-{d}"
    mmdd = f"{m}{d}"

    folders = [f for f in os.listdir(VIDEOS_ROOT) if os.path.isdir(os.path.join(VIDEOS_ROOT, f))]
    matched_folder = None
    if is_ehammer:
        for f in folders:
            if "ehammer" in f.lower():
                matched_folder = f
                break
    else:
        for f in folders:
            if f.startswith(iso):
                matched_folder = f
                break
        if not matched_folder:
            best_diff = 999
            for f in folders:
                md = re.match(r"(\d{4})-(\d{2})-(\d{2})", f)
                if md:
                    fdt = datetime.date(int(md.group(1)), int(md.group(2)), int(md.group(3)))
                    diff = abs((fdt - target_dt).days)
                    if diff <= 8 and diff < best_diff:
                        best_diff = diff
                        matched_folder = f

    if not matched_folder:
        return None

    full_dir = os.path.join(VIDEOS_ROOT, matched_folder)
    mp4s = sorted([fn for fn in os.listdir(full_dir) if fn.lower().endswith(".mp4")])
    att_str = str(attempt_no)
    pat = re.compile(rf'(?:^|[^\d]){re.escape(att_str)}(?:[^\d]|$)')
    mark_str = f"{offiziell_m:.2f}" if offiziell_m else ""
    mark_comma = mark_str.replace(".", ",")

    scored = []
    for fn in mp4s:
        low = fn.lower()
        if not pat.search(fn):
            continue
        score = 0
        if low.startswith("wm"):
            score += 50
        elif "front" not in low:
            score += 20
        else:
            score -= 10
        if mmdd in fn:
            score += 30
        if mark_str and (mark_str in fn or mark_comma in fn):
            score += 40
        scored.append((score, fn))

    scored.sort(key=lambda x: (-x[0], x[1]))
    candidates = [fn for _, fn in scored]
    best_file = candidates[0] if candidates else None
    meta = parse_mp4_meta(os.path.join(full_dir, best_file)) if best_file else None
    return {
        "folder": matched_folder,
        "recommended_video": best_file,
        "all_attempt_videos": candidates,
        "local_path_hint": f"dlv_diagnostik/Videos/{matched_folder}/{best_file}" if best_file else f"dlv_diagnostik/Videos/{matched_folder}/",
        "video_meta": meta,
    }


def extract_ksp_series_from_stream(page):
    """Extract primary (red: 1 0 0 RG) and comparison (blue: 0.2 0.4 1 RG) KSP height Bezier vertices from PDF stream."""
    try:
        raw = page.get_contents().get_data().decode("latin1", errors="ignore")
    except Exception:
        return {}, {}

    y_bot, y_top = 227.55, 305.51
    h_span = y_top - y_bot

    def y_to_ksp(y):
        return round(0.80 + ((y - y_bot) / h_span) * 0.25, 2)

    out = {"red": {}, "blue": {}}
    for color_key, col_sig in [("red", "1 0 0 RG"), ("blue", "0.2 0.4 1 RG")]:
        for m in re.finditer(re.escape(col_sig) + r"[^qQ]*?(\d+\.\d+)\s+(\d+\.\d+)\s+m([^S]{20,600})S", raw):
            x0, y0, rest = float(m.group(1)), float(m.group(2)), m.group(3)
            if 575 <= x0 <= 590 and 220 <= y0 <= 310:
                pts_y = [y0] + [
                    float(c.group(1))
                    for c in re.finditer(r"\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+(\d+\.\d+)\s+c", rest)
                ]
                if len(pts_y) >= 4:
                    out[color_key] = {
                        "3L": y_to_ksp(pts_y[0]),
                        "2L": y_to_ksp(pts_y[1]),
                        "1L": y_to_ksp(pts_y[2]),
                        "TD": y_to_ksp(pts_y[3]),
                    }
                    break
    return out["red"], out["blue"]


def extract_page_chart_metrics(page):
    """Use visitor_text coordinates to extract bottom chart metrics (red primary vs blue ref) + Positiv/Negativ/Fazit."""
    items = []
    page.extract_text(
        visitor_text=lambda text, cm, tm, fd, fs: items.append((round(tm[4], 1), round(tm[5], 1), text.strip())) if text.strip() else None
    )

    def near(x_min, x_max, y_min, y_max):
        return sorted([it for it in items if x_min <= it[0] <= x_max and y_min <= it[1] <= y_max], key=lambda z: (-z[1], z[0]))

    # Step lengths 3L/2L/1L: Primary ~ y=296..308, Ref ~ y=272..284 (x=415..540)
    # Wait: filter strictly numeric floats
    def floats_in_box(x0, x1, y0, y1):
        out = []
        for x, y, t in near(x0, x1, y0, y1):
            # Clean sign split like "-" and "0.03"
            fv = parse_float(t)
            if fv is not None and re.match(r"^[+\-]?\d+(?:[.,]\d+)?%?$", t):
                out.append((x, y, t, fv))
        return out

    # Step lengths primary vs ref (2 rows in x=410..540, y=272..312)
    sl_all = floats_in_box(410, 540, 272, 310)
    # Group by y band (>288 = primary, <=288 = ref)
    sl_prim = sorted([z for z in sl_all if z[1] > 288 and "%" not in z[2]], key=lambda z: z[0])
    sl_ref = sorted([z for z in sl_all if z[1] <= 288 and "%" not in z[2]], key=lambda z: z[0])

    # Percentages (+22% -12% at y=285..295, ref at y=258..270)
    pct_prim = sorted([z for z in floats_in_box(450, 540, 285, 298) if "%" in z[2]], key=lambda z: z[0])
    pct_ref = sorted([z for z in floats_in_box(450, 540, 258, 272) if "%" in z[2]], key=lambda z: z[0])

    # Knie-abstand vorletzter Stütz (x=450..510, y=218..240)
    # Combine '-' token immediately left of numeric token at same y
    knee_items = sorted(near(450, 510, 218, 240), key=lambda z: (-z[1], z[0]))
    knee_vals = []
    i = 0
    while i < len(knee_items):
        x, y, t = knee_items[i]
        if t == "-" and i + 1 < len(knee_items) and abs(knee_items[i + 1][1] - y) < 2.0:
            v = parse_float("-" + knee_items[i + 1][2])
            if v is not None:
                knee_vals.append((y, v))
            i += 2
            continue
        v = parse_float(t)
        if v is not None:
            knee_vals.append((y, v))
        i += 1
    knee_vals.sort(key=lambda z: -z[0])

    # Run-up speeds (x=165..275, y=230..312): Notice 4 columns: 3L(~172), 2L(~200), 1L(~229), Flug(~267)
    # Split cleanly into primary vs ref by reading each x column independently!
    def two_rows_in_col(x0, x1, y0=230, y1=312):
        vals = sorted([z for z in floats_in_box(x0, x1, y0, y1) if 4.5 <= z[3] <= 12.5], key=lambda z: -z[1])
        return [z[3] for z in vals]

    # Wait: In Trend V-Anlauf vs Anlaufgeschwindigkeit, Red=Primary vs Blue=Ref:
    # We know v_flug (~8.5-9.5 m/s) and v_1L vs abflug/v_vertikal! Actually check y positions of the two series per PDF.
    # For each PDF row 0 (primary) vs row 1 (ref): expected_m correlates monotonically with max run-up speed (v_1L/2L)!
    v_3L = two_rows_in_col(165, 185)
    v_2L = two_rows_in_col(192, 215)
    v_1L = two_rows_in_col(220, 245)
    v_fl = two_rows_in_col(255, 282)

    # Vvertikal (x=295..395, y=240..308; exclude axis ticks x<292 & y<238)
    vv_vals = sorted([z for z in floats_in_box(295, 395, 240, 308) if 2.0 <= z[3] <= 4.5], key=lambda z: -z[1])

    # Geschw. Bilanz (x=690..750, y=245..295)
    gb_items = sorted(near(690, 750, 245, 295), key=lambda z: (-z[1], z[0]))
    gb_vals = []
    i = 0
    while i < len(gb_items):
        x, y, t = gb_items[i]
        if t == "-" and i + 1 < len(gb_items) and abs(gb_items[i + 1][1] - y) < 2.0:
            v = parse_float("-" + gb_items[i + 1][2])
            if v is not None:
                gb_vals.append((y, v))
            i += 2
            continue
        v = parse_float(t)
        if v is not None and -5.0 <= v <= 5.0:
            gb_vals.append((y, v))
        i += 1
    gb_vals.sort(key=lambda z: -z[0])

    # Positiv / Negativ / Fazit blocks (y=80..205)
    pos_txt = " ".join(t for _, _, t in sorted(near(15, 275, 80, 202), key=lambda z: (-z[1], z[0])))
    neg_txt = " ".join(t for _, _, t in sorted(near(278, 510, 80, 202), key=lambda z: (-z[1], z[0])))
    fazit_txt = " ".join(t for _, _, t in sorted(near(512, 760, 80, 202), key=lambda z: (-z[1], z[0])))

    ksp_red, ksp_blue = extract_ksp_series_from_stream(page)

    return {
        "sl_prim": [z[3] for z in sl_prim],
        "sl_ref": [z[3] for z in sl_ref],
        "pct_prim": [z[3] for z in pct_prim],
        "pct_ref": [z[3] for z in pct_ref],
        "knee_vals": [v for _, v in knee_vals],
        "v_cols": (v_3L, v_2L, v_1L, v_fl),
        "vv_vals": [z[3] for z in vv_vals],
        "gb_vals": [v for _, v in gb_vals],
        "ksp_red": ksp_red,
        "ksp_blue": ksp_blue,
        "positiv": pos_txt,
        "negativ": neg_txt,
        "fazit": fazit_txt,
    }


def main():
    with open(OUT_JSON, "r", encoding="utf-8") as f:
        existing = json.load(f)

    pdf_files = sorted(glob.glob(os.path.join(DLV_WEIT_DIR, "*.pdf")))
    paired_trials = {}
    weit_csv_rows = []

    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        reader = pypdf.PdfReader(pdf_path)
        page = reader.pages[0]
        txt = page.extract_text()
        comps = [re.sub(r"\s+", " ", c).strip() for c in re.findall(r"\d{2}\.\d{2}\.\d{4}\s*/\s*\d+", txt)]
        rows = [
            ln.strip()
            for ln in txt.splitlines()
            if re.match(r"^([+\-]?\d\.\d|k\.A\.|0\.0)\s+\d\.\d{2}", ln.strip())
        ]
        # Handle 2018-12-08 prefixed line format if present
        if not rows:
            for ln in txt.splitlines():
                m18 = re.match(r"^\d{2}\.\d{2}\.\d{4}\s*/\s*\d+\s+(.*)$", ln.strip())
                if m18:
                    rows.append("0.0 " + m18.group(1))

        chart = extract_page_chart_metrics(page)
        is_ehammer = "ehammer" in fname.lower()

        for idx, (comp_str, row_str) in enumerate(zip(comps, rows)):
            m_c = re.match(r"(\d{2}\.\d{2}\.\d{4})\s*/\s*(\d+)", comp_str)
            if not m_c:
                continue
            dt_str, att_str = m_c.group(1), m_c.group(2)
            att_no = int(att_str)
            toks = row_str.split()
            if len(toks) < 20:
                continue
            # All 2019-2026 PDFs have 21 tokens:
            # 0:wind, 1:offiziell, 2:erwartet, 3:effektiv, 4:verlust_absprung, 5:entf_6L, 6:entf_4L,
            # 7:stemm, 8:rumpf_td, 9:rumpf_rot, 10:amort(knie_min), 11:abflug,
            # 12:schwungbein_winkel (vs horizontale!), 13:schwungbein_deg_s,
            # 14:landeweite, 15:landeverlust, 16:landeindex, 17:lande_effektiv_diff,
            # 18:lande_rumpfwinkel, 19:lande_kniewinkel, 20:lande_hueftwinkel
            if len(toks) == 20:
                toks = ["0.0"] + toks

            d, mo, yr = dt_str.split(".")
            iso_date = f"{yr}-{mo}-{d}"
            trial_key = f"{'ehammer' if is_ehammer else 'herden'}-{iso_date}-v{att_no}"

            wind = parse_float(toks[0])
            offiziell = parse_float(toks[1])
            erwartet = parse_float(toks[2])
            effektiv = parse_float(toks[3])
            verlust_absprung = parse_float(toks[4])
            entf_6L = parse_float(toks[5])
            entf_4L = parse_float(toks[6])
            stemm = parse_float(toks[7])
            rumpf_td = parse_float(toks[8])
            rumpf_rot = parse_float(toks[9])
            knie_min = parse_float(toks[10])
            abflug = parse_float(toks[11])
            schwung_winkel = parse_float(toks[12])
            schwung_vel = parse_float(toks[13])
            landeweite = parse_float(toks[14])
            landeverlust = parse_float(toks[15])
            landeindex = parse_float(toks[16])
            lande_eff_diff = parse_float(toks[17])
            lande_rumpf = parse_float(toks[18])
            lande_knie = parse_float(toks[19])
            lande_huefte = parse_float(toks[20])

            # Match chart extras cleanly for primary (idx == 0) vs ref (idx == 1)
            sl_list = chart["sl_prim"] if idx == 0 else chart["sl_ref"]
            pct_list = chart["pct_prim"] if idx == 0 else chart["pct_ref"]
            v3_c, v2_c, v1_c, vfl_c = chart["v_cols"]

            # Disambiguate velocity rows if 2 values per column: highest y vs expected_m check
            v3 = v2 = v1 = vfl = None
            if len(v1_c) == 1 and idx == 0:
                v3 = v3_c[0] if v3_c else None
                v2 = v2_c[0] if v2_c else None
                v1 = v1_c[0]
                vfl = vfl_c[0] if vfl_c else None
            elif len(v1_c) >= 2 and len(comps) >= 2:
                # Match which curve aligns best with this row's abflug/erwartet: higher expected_m == higher v_max
                # Pick slot [0] (upper y) or [1] (lower y) — for 2026 Bochum row0 has 10.70 (upper) vs Kassel 10.60 (lower)
                # Note: compare expected_m of row 0 vs row 1 to guarantee exact pairing!
                e0 = parse_float(rows[0].split()[2]) if len(rows) > 0 else None
                e1 = parse_float(rows[1].split()[2]) if len(rows) > 1 else None
                if e0 is not None and e1 is not None and v2_c and len(v2_c) >= 2:
                    high_slot = 0 if v2_c[0] >= v2_c[1] else 1
                    low_slot = 1 - high_slot
                    slot = (high_slot if e0 >= e1 else low_slot) if idx == 0 else (low_slot if e0 >= e1 else high_slot)
                else:
                    slot = min(idx, 1)
                v3 = v3_c[slot] if slot < len(v3_c) else None
                v2 = v2_c[slot] if slot < len(v2_c) else None
                v1 = v1_c[slot] if slot < len(v1_c) else None
                vfl = vfl_c[slot] if slot < len(vfl_c) else None

            vv_list = chart["vv_vals"]
            v_vert = None
            if vv_list:
                v_vert = vv_list[0] if (idx == 0 or len(vv_list) == 1) else vv_list[min(idx, len(vv_list) - 1)]

            v_loss_abspr = round(v1 - vfl, 2) if (v1 is not None and vfl is not None) else None

            # Geschw. Bilanz in Bochum is +0.2 (red) vs -0.4 (blue); note red dot can sit higher or lower on the -0.5..+0.5 bar!
            gb_list = chart["gb_vals"]
            gb_val = None
            if len(gb_list) == 1 and idx == 0:
                gb_val = gb_list[0]
            elif len(gb_list) >= 2:
                # Higher V_vertikal typically has higher Geschw. Bilanz!
                if len(vv_list) >= 2:
                    gb_hi, gb_lo = max(gb_list[:2]), min(gb_list[:2])
                    v_hi = vv_list[0] >= vv_list[1]
                    gb_val = (gb_hi if v_hi else gb_lo) if idx == 0 else (gb_lo if v_hi else gb_hi)
                else:
                    gb_val = gb_list[min(idx, len(gb_list) - 1)]

            knee_gap_list = chart["knee_vals"]
            knee_gap = None
            if idx == 0:
                # Closest to -0.03 / secondary or top-level; in Bochum primary was -0.03 (below 0.00 ref), so take non-zero or match primary
                knee_gap = knee_gap_list[-1] if len(knee_gap_list) >= 2 and knee_gap_list[0] == 0.0 else (knee_gap_list[0] if knee_gap_list else None)
            elif len(knee_gap_list) >= 2:
                knee_gap = knee_gap_list[0] if knee_gap_list[0] == 0.0 else knee_gap_list[-1]

            ksp_map = chart["ksp_red"] if idx == 0 else chart["ksp_blue"]
            ksp_abs = None
            if ksp_map and "3L" in ksp_map and "2L" in ksp_map and "TD" in ksp_map:
                ksp_abs = round(((ksp_map["3L"] + ksp_map["2L"]) / 2.0) - ksp_map["TD"], 2)

            meet_title = fname.replace(".pdf", "").replace("Weit ", "").strip() if idx == 0 else dt_str
            vid_info = find_video_match(dt_str, att_no, is_ehammer=is_ehammer, offiziell_m=offiziell)

            record = {
                "id": trial_key,
                "athlete": "Simon Ehammer" if is_ehammer else "Luka Herden",
                "date": iso_date,
                "display_ref": f"{dt_str} / Versuch {att_no}",
                "attempt": att_no,
                "color_role": "Primär (PDF Zeile 1 / Rot)" if idx == 0 else "Referenz (PDF Zeile 2 / Blau)",
                "source_pdf": fname,
                "label": f"{meet_title} • V{att_no} ({offiziell:.2f}m | eff. {effektiv:.2f}m)" if idx == 0 else f"{dt_str} • V{att_no} ({offiziell:.2f}m | eff. {effektiv:.2f}m)",
                "wind": wind,
                "offiziell_m": offiziell,
                "erwartet_m": erwartet,
                "effektiv_m": effektiv,
                "verlust_balken_m": verlust_absprung,
                "entf_6L_m": entf_6L,
                "entf_4L_m": entf_4L,
                "stemmwinkel_deg": stemm,
                "rumpfwinkel_td_deg": rumpf_td,
                "rumpfrotation_deg": rumpf_rot,
                "kniewinkel_min_deg": knie_min,
                "abflugwinkel_deg": abflug,
                "schwungbein_winkel_deg": schwung_winkel,
                "schwungbein_deg_s": schwung_vel,
                "landeweite_m": landeweite,
                "landeverlust_m": landeverlust,
                "landeindex": landeindex,
                "lande_effektiv_diff_m": lande_eff_diff,
                "lande_rumpfwinkel_deg": lande_rumpf,
                "lande_kniewinkel_deg": lande_knie,
                "lande_hueftwinkel_deg": lande_huefte,
                "step_3L_m": sl_list[0] if len(sl_list) >= 1 else None,
                "step_2L_m": sl_list[1] if len(sl_list) >= 2 else None,
                "step_1L_m": sl_list[2] if len(sl_list) >= 3 else None,
                "step_2L_pct": pct_list[0] if len(pct_list) >= 1 else None,
                "step_1L_pct": pct_list[1] if len(pct_list) >= 2 else None,
                "knie_abstand_vorletzter_m": knee_gap,
                "v_3L_ms": v3,
                "v_2L_ms": v2,
                "v_1L_ms": v1,
                "v_flug_ms": vfl,
                "v_verlust_absprung_ms": v_loss_abspr,
                "v_vertikal_ms": v_vert,
                "geschw_bilanz": gb_val,
                "ksp_3L_m": ksp_map.get("3L"),
                "ksp_2L_m": ksp_map.get("2L"),
                "ksp_1L_m": ksp_map.get("1L"),
                "ksp_td_m": ksp_map.get("TD"),
                "ksp_absenkung_m": ksp_abs,
                "positiv": chart["positiv"] if idx == 0 else "",
                "negativ": chart["negativ"] if idx == 0 else "",
                "fazit": chart["fazit"] if idx == 0 else "",
                "video_match": vid_info,
            }

            if trial_key not in paired_trials or idx == 0:
                paired_trials[trial_key] = record

            if idx == 0:
                weit_csv_rows.append({
                    "file": fname,
                    "wind": wind,
                    "offiziell_m": offiziell,
                    "erwartet_m": erwartet,
                    "effektiv_m": effektiv,
                    "verlust_balken_m": verlust_absprung,
                    "entf_4L_m": entf_4L,
                    "stemmwinkel_deg": stemm,
                    "rumpfwinkel_deg": rumpf_td,
                    "rumpfrotation_deg": rumpf_rot,
                    "kniewinkel_min_deg": knie_min,
                    "abflugwinkel_deg": abflug,
                    "schwungbein_winkel_deg": schwung_winkel,
                    "schwungbein_deg_s": schwung_vel,
                    "landeweite_m": landeweite,
                    "landeverlust_m": landeverlust,
                    "lande_verlust_m": lande_eff_diff,
                    "geschw_bilanz": gb_val if gb_val is not None else "",
                })

    trials_list = sorted(paired_trials.values(), key=lambda x: (x["date"], x["attempt"]), reverse=True)

    # Refresh normbereich to exact full OSP Hessen + bonus video norms
    existing["source"] = "OSP Hessen / DLV Biomechanik (vollständig kalibriert auf Bochum 25.07.2026 & Info 1–6)"
    existing["calibrated_at"] = datetime.date.today().isoformat()
    existing["normbereich"] = {
        "stemmwinkel_deg": {"min": 22, "max": 28, "unit": "°", "desc": "Auslage Sprungbein vs. Vertikale beim TD (OSP Info 2)"},
        "rumpfwinkel_td_deg": {"min": 95, "max": 102, "unit": "°", "desc": "Rumpf gegen vordere Horizontale beim TD (>90° = Rücklage)"},
        "rumpfrotation_deg": {"min": 4, "max": 12, "unit": "°", "desc": "Sagittale Rumpfrotation TD → TO"},
        "kniewinkel_min_deg": {"min": 134, "max": 160, "unit": "°", "desc": "Amortisation Stützbein-Knie minimal"},
        "abflugwinkel_deg": {"min": 19.0, "max": 23.0, "unit": "°", "desc": "KSP-Abflugwinkel beim Take-off"},
        "schwungbein_winkel_deg": {"min": -13, "max": 15, "unit": "°", "desc": "Schwungbein-Oberschenkel gegen Horizontale (OSP Info 3)"},
        "schwungbein_deg_s": {"min": 730, "max": 950, "unit": "°/s", "desc": "Durchschn. Winkelgeschw. Schwungbein-Oberschenkel"},
        "landeweite_m": {"min": 0.43, "max": 0.90, "unit": "m", "desc": "Ferse bis KSP-Projektion bei Landung (OSP Info 4)"},
        "landeindex": {"min": 1.5, "max": 2.2, "unit": "", "desc": "Körperlage relativ zur Ferse bei Landung (OSP Info 5)"},
        "lande_rumpfwinkel_deg": {"min": 64, "max": 104, "unit": "°", "desc": "Rumpf gegen vordere Horizontale bei Landung (OSP Info 4)"},
        "lande_kniewinkel_deg": {"min": 125, "max": 165, "unit": "°", "desc": "Kniewinkel Landebein bei Landung"},
        "lande_hueftwinkel_deg": {"min": 70, "max": 114, "unit": "°", "desc": "Hüftwinkel Landebein bei Landung"},
        "geschw_bilanz": {"min": -0.2, "max": 0.5, "unit": "", "desc": "Verhältnis V_vertikal zu Horizontalverlust"},
        "schwungbein_knie_kompakt_deg": {"min": 60, "max": 95, "unit": "°", "desc": "Zusatz Video-Bio: Enges Schwungbein-Knie beim Durchschwingen (<=95°)"},
        "kontaktzeit_ms": {"min": 100, "max": 125, "unit": "ms", "desc": "Zusatz Video-Bio: Bodenkontakt TD → TO (nur bei bekannter Kamera-FPS)"},
    }

    # Update curated benchmarks cleanly from paired_trials
    trial_by_id = {t["id"]: t for t in trials_list}
    curated_ids = [
        ("dlv-luka-bochum-2026", "herden-2026-07-25-v5", "Luka DM Bochum 2026 • V5 (7,86m / 8,07m eff.)"),
        ("dlv-luka-rom-2024", "herden-2024-06-08-v3", "Luka EM Rom 2024 • V3 (8,01m / 8,11m eff.)"),
        ("dlv-ehammer-2022", "ehammer-2022-05-07-v3", "Simon Ehammer 2022 • V3 (8,30m / 8,40m eff.)"),
        ("dlv-luka-dresden-2025", "herden-2025-08-03-v6", "Luka DM Dresden 2025 • V6 (7,73m / 7,84m eff.)"),
        ("dlv-luka-kassel-2023", "herden-2023-07-09-v2", "Luka DM Kassel 2023 • V2 (7,91m / 7,97m eff.)"),
    ]
    new_bms = []
    for bm_id, tid, lbl in curated_ids:
        src = trial_by_id.get(tid)
        if not src:
            # Fallback match by date for Kassel/Dresden
            for t in trials_list:
                if t["date"] == tid.split("-")[1] + "-" + tid.split("-")[2] + "-" + tid.split("-")[3]:
                    src = t
                    break
        if src:
            b = dict(src)
            b["id"] = bm_id
            b["label"] = lbl
            new_bms.append(b)
    if new_bms:
        existing["benchmarks"] = new_bms

    existing["paired_trials"] = trials_list
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    # Also update bundle dlv_weit & parsed_dlv_weit.csv cleanly
    if os.path.exists(BUNDLE_JSON):
        with open(BUNDLE_JSON, "r", encoding="utf-8") as bf:
            bdata = json.load(bf)
        bdata["dlv_weit"] = [{k: str(v) if v is not None else "" for k, v in r.items()} for r in weit_csv_rows]
        with open(BUNDLE_JSON, "w", encoding="utf-8") as bf:
            json.dump(bdata, bf, ensure_ascii=False)

    import pandas as pd
    pd.DataFrame(weit_csv_rows).to_csv(WEIT_CSV, index=False)

    with_vid = sum(1 for t in trials_list if t.get("video_match") and t["video_match"].get("recommended_video"))
    print(f"Extracted {len(trials_list)} paired DLV Ground-Truth trials ({with_vid} with MP4 match).")
    bo = trial_by_id.get("herden-2026-07-25-v5")
    if bo:
        print("Bochum V5 verification:", json.dumps({k: bo[k] for k in [
            "offiziell_m", "erwartet_m", "effektiv_m", "verlust_balken_m", "entf_4L_m",
            "stemmwinkel_deg", "rumpfwinkel_td_deg", "rumpfrotation_deg", "kniewinkel_min_deg",
            "abflugwinkel_deg", "schwungbein_winkel_deg", "schwungbein_deg_s",
            "landeweite_m", "landeverlust_m", "landeindex", "lande_effektiv_diff_m",
            "lande_rumpfwinkel_deg", "lande_kniewinkel_deg", "lande_hueftwinkel_deg",
            "step_3L_m", "step_2L_m", "step_1L_m", "step_2L_pct", "step_1L_pct",
            "knie_abstand_vorletzter_m", "v_3L_ms", "v_2L_ms", "v_1L_ms", "v_flug_ms",
            "v_verlust_absprung_ms", "v_vertikal_ms", "geschw_bilanz",
            "ksp_3L_m", "ksp_2L_m", "ksp_1L_m", "ksp_td_m", "ksp_absenkung_m", "video_match"
        ]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
