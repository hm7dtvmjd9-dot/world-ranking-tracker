import datetime
import glob
import json
import os
import re
import pypdf

DLV_WEIT_DIR = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub/dlv_diagnostik/Weit"
VIDEOS_ROOT = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub/dlv_diagnostik/Videos"
OUT_JSON = "/Users/luka/.gemini/antigravity/scratch/world-ranking-tracker/data/dlv_calibration_profile.json"


def parse_float(val):
    try:
        return float(str(val).replace(",", "."))
    except Exception:
        return None


def find_video_match(date_ddmmyyyy, attempt_no, is_ehammer=False, offiziell_m=None, source_pdf=""):
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
        # 1. Exact ISO folder date
        for f in folders:
            if f.startswith(iso):
                matched_folder = f
                break
        # 2. Within +/- 8 days of PDF date (handles multi-day champs / Belek training camps)
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
    return {
        "folder": matched_folder,
        "recommended_video": best_file,
        "all_attempt_videos": candidates,
        "local_path_hint": f"dlv_diagnostik/Videos/{matched_folder}/{best_file}" if best_file else f"dlv_diagnostik/Videos/{matched_folder}/"
    }


def main():
    with open(OUT_JSON, "r", encoding="utf-8") as f:
        existing = json.load(f)

    pdf_files = sorted(glob.glob(os.path.join(DLV_WEIT_DIR, "*.pdf")))
    paired_trials = {}

    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        reader = pypdf.PdfReader(pdf_path)
        txt = reader.pages[0].extract_text()
        comps = [re.sub(r"\s+", " ", c).strip() for c in re.findall(r"\d{2}\.\d{2}\.\d{4}\s*/\s*\d+", txt)]
        rows = [
            ln.strip()
            for ln in txt.splitlines()
            if re.match(r"^([+\-]?\d\.\d|k\.A\.|0\.0)\s+\d\.\d{2}", ln.strip())
        ]

        is_ehammer = "ehammer" in fname.lower()
        for idx, (comp_str, row_str) in enumerate(zip(comps, rows)):
            m_c = re.match(r"(\d{2}\.\d{2}\.\d{4})\s*/\s*(\d+)", comp_str)
            if not m_c:
                continue
            dt_str, att_str = m_c.group(1), m_c.group(2)
            att_no = int(att_str)
            toks = row_str.split()
            # Format: wind offiziell erwart effektiv verlust_b abspr entf_6L entf_4L stemm rumpf rumpf_rot amort abflug geschw_bil schwung_v schwung_w ...
            if len(toks) < 15:
                continue

            d, mo, yr = dt_str.split(".")
            iso_date = f"{yr}-{mo}-{d}"
            trial_key = f"{'ehammer' if is_ehammer else 'herden'}-{iso_date}-v{att_no}"

            wind = parse_float(toks[0])
            offiziell = parse_float(toks[1])
            erwartet = parse_float(toks[2])
            effektiv = parse_float(toks[3])
            verlust_balken = parse_float(toks[4])
            # toks[5] = abspr?, toks[6] = entf_6L / or toks[5]=abspr_verlust? Let's preserve known columns cleanly:
            stemm = parse_float(toks[7])
            rumpf_td = parse_float(toks[8])
            rumpf_rot = parse_float(toks[9])
            knie_min = parse_float(toks[10])
            abflug = parse_float(toks[11])
            bilanz = parse_float(toks[12])
            schwung_vel = parse_float(toks[13])
            schwung_weite = parse_float(toks[14])

            # Extract meet label from filename when idx == 0, else infer from date
            meet_title = fname.replace(".pdf", "").replace("Weit ", "").strip() if idx == 0 else dt_str
            vid_info = find_video_match(dt_str, att_no, is_ehammer=is_ehammer, offiziell_m=offiziell, source_pdf=fname)

            if trial_key not in paired_trials:
                paired_trials[trial_key] = {
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
                    "verlust_balken_m": verlust_balken,
                    "stemmwinkel_deg": stemm,
                    "rumpfwinkel_td_deg": rumpf_td,
                    "rumpfrotation_deg": rumpf_rot,
                    "kniewinkel_min_deg": knie_min,
                    "abflugwinkel_deg": abflug,
                    "geschw_bilanz": bilanz,
                    "schwungbein_deg_s": schwung_vel,
                    "schwungbein_weite_m": schwung_weite,
                    "video_match": vid_info
                }

    trials_list = sorted(paired_trials.values(), key=lambda x: (x["date"], x["attempt"]), reverse=True)

    # Also update benchmarks list to keep our top curated entries + flag video_match
    bm_map = {b["id"]: b for b in existing.get("benchmarks", [])}
    for t in trials_list:
        if t["id"] == "herden-2024-06-08-v3" and "dlv-luka-rom-2024" in bm_map:
            bm_map["dlv-luka-rom-2024"]["video_match"] = t["video_match"]
        if t["id"] == "herden-2026-07-25-v5" and "dlv-luka-bochum-2026" in bm_map:
            bm_map["dlv-luka-bochum-2026"]["video_match"] = t["video_match"]
        if t["id"] == "ehammer-2022-05-07-v3" and "dlv-ehammer-2022" in bm_map:
            bm_map["dlv-ehammer-2022"]["video_match"] = t["video_match"]
        if t["id"] == "herden-2023-07-09-v2" and "dlv-luka-kassel-2023" in bm_map:
            bm_map["dlv-luka-kassel-2023"]["video_match"] = t["video_match"]
        if t["id"] == "herden-2025-08-02-v6" and "dlv-luka-dresden-2025" in bm_map:
            bm_map["dlv-luka-dresden-2025"]["video_match"] = t["video_match"]

    existing["calibrated_at"] = "2026-11-17"
    existing["paired_trials"] = trials_list
    existing["benchmarks"] = list(bm_map.values())

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    with_vid = sum(1 for t in trials_list if t.get("video_match") and t["video_match"].get("recommended_video"))
    print(f"Extracted {len(trials_list)} unique paired DLV Ground-Truth trials ({with_vid} with direct side-view MP4 match).")
    for t in trials_list[:10]:
        vm = (t.get("video_match") or {}).get("local_path_hint", "no-video")
        print(f"  - {t['display_ref']:16s} | {t['offiziell_m']}m | Stemm {t['stemmwinkel_deg']}° Rumpf {t['rumpfwinkel_td_deg']}° Rot {t['rumpfrotation_deg']}° Knie {t['kniewinkel_min_deg']}° Abfl {t['abflugwinkel_deg']}° Schw {t['schwungbein_deg_s']}°/s -> {vm}")


if __name__ == "__main__":
    main()
