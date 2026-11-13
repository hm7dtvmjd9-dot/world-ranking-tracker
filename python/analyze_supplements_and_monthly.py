#!/usr/bin/env python3
"""
Automatische Auswertung für Luka Herden:
1. Whoop Journal (journal_entries.csv): Taggenaue Auflistung für AG1, Probiotics, Vitamin C.
2. MacroFactor Food Log (*_Macrofactor.xlsx): Taggenaue Auflistung für alle 22 angefragten Supplements:
   (Ecdysteron, Orthomol Protein, Perform, Recover, Prepare, Collagen, Omega-3, Orthomol Sport,
    Zink, AG1 D3 + K2, AG1, Magnesium, B12, Ashwagandha, Spirulina, Vitamin C, Iron, Kreatin,
    Electrolyte, Kurkuma, Huel, Daily Greens).
3. Monatliche Analyse (Whoop + MacroFactor) & Rollende 90-Tage-Analyse vs. Gesamt-Analyse (inkl. Kollagen aus der Google Sheet Supplements-Spalte).
4. Exportiert CSV-Dateien + data/supplements_and_monthly_analysis.json für die Web-App.
"""

import os
import re
import glob
import json
import zipfile
import datetime
import xml.etree.ElementTree as ET
from collections import defaultdict
import pandas as pd
import numpy as np

HUB_DIR = "/Users/luka/.gemini/antigravity/scratch/luka_performance_hub"
WRT_DATA_DIR = "/Users/luka/.gemini/antigravity/scratch/world-ranking-tracker/data"

WHOOP_JOURNAL_CSV = os.path.join(HUB_DIR, "whoop_raw", "journal_entries.csv")
WHOOP_CYCLES_CSV = os.path.join(HUB_DIR, "whoop_raw", "physiological_cycles.csv")
MACRO_DIR = os.path.join(HUB_DIR, "macrofactor_raw")
MACRO_PARSED_CSV = os.path.join(HUB_DIR, "parsed_macrofactor.csv")
SHEET_CSV = os.path.join(HUB_DIR, "latest_sheet.csv")

OUT_WHOOP_SUPP_CSV = os.path.join(WRT_DATA_DIR, "whoop_supplements_taggenau.csv")
OUT_MACRO_SUPP_CSV = os.path.join(WRT_DATA_DIR, "macrofactor_supplements_taggenau.csv")
OUT_JSON = os.path.join(WRT_DATA_DIR, "supplements_and_monthly_analysis.json")


def parse_xlsx_sheet(z, sheet_xml_path, ss):
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    root = ET.fromstring(z.read(sheet_xml_path))
    rows = []
    for row_el in root.iter(ns + "row"):
        r_dict = {}
        for c_el in row_el.findall(ns + "c"):
            ref = c_el.attrib.get("r", "")
            col = re.sub(r"[0-9]", "", ref)
            t = c_el.attrib.get("t", "")
            v_el = c_el.find(ns + "v")
            is_el = c_el.find(ns + "is")
            val = ""
            if t == "s" and v_el is not None and v_el.text:
                idx = int(v_el.text)
                val = ss[idx] if idx < len(ss) else ""
            elif t == "inlineStr" and is_el is not None:
                val = "".join(x.text or "" for x in is_el.iter(ns + "t"))
            elif v_el is not None and v_el.text:
                val = v_el.text
            r_dict[col] = val
        rows.append(r_dict)
    return rows


def extract_whoop_supplements():
    """Extracts day-exact dates where AG1, Probiotics, or Vitamin C were answered Yes in Whoop Journal."""
    df = pd.read_csv(WHOOP_JOURNAL_CSV)
    # Filter to answered yes
    df_yes = df[df["Answered yes"].astype(str).str.lower() == "true"].copy()
    df_yes["date"] = df_yes["Cycle start time"].astype(str).str[:10]

    target_map = {
        "Did you drink AG1?": "AG1",
        "Took a probiotic?": "Probiotics",
        "Took vitamin C?": "Vitamin C",
    }

    by_supp = {k: set() for k in ["AG1", "Probiotics", "Vitamin C"]}
    by_date = defaultdict(set)

    for _, row in df_yes.iterrows():
        q = str(row.get("Question text", "")).strip()
        dt = str(row.get("date", "")).strip()
        if q in target_map and re.match(r"^\d{4}-\d{2}-\d{2}$", dt):
            sname = target_map[q]
            by_supp[sname].add(dt)
            by_date[dt].add(sname)

    # Save CSV
    all_dates = sorted(by_date.keys())
    csv_rows = []
    for dt in all_dates:
        s_list = sorted(by_date[dt])
        csv_rows.append({
            "Date": dt,
            "AG1": 1 if "AG1" in by_date[dt] else 0,
            "Probiotics": 1 if "Probiotics" in by_date[dt] else 0,
            "Vitamin C": 1 if "Vitamin C" in by_date[dt] else 0,
            "Supplements_List": ", ".join(s_list)
        })
    pd.DataFrame(csv_rows).to_csv(OUT_WHOOP_SUPP_CSV, index=False)

    return {
        "by_supplement": {
            k: {
                "count": len(v),
                "first_date": min(v) if v else None,
                "last_date": max(v) if v else None,
                "dates": sorted(v, reverse=True)
            }
            for k, v in by_supp.items()
        },
        "daily_rows": sorted(csv_rows, key=lambda x: x["Date"], reverse=True)
    }


def classify_macrofactor_food(food_name):
    """Maps a MacroFactor Food Name to all matching supplement & functional nutrition categories.
    Audited across all 1,066 unique Food Name entries in MacroFactor Food Logs (including items
    where MacroFactor omitted the Brand Name column such as 'Chocolate nutritionally complete food' = Huel).
    """
    fn = food_name.strip()
    fl = fn.lower()
    matched = []

    if "ecdysteron" in fl:
        matched.append("Ecdysteron")
    if "orthomol sport protein" in fl or "orthomol protein" in fl:
        matched.append("Orthomol Protein")
    if "orthomol sport perform" in fl or "orthomol performance" in fl:
        matched.append("Perform")
    if "orthomol sport recover" in fl or "orthomol recover" in fl:
        matched.append("Recover")
    if "sport prepare" in fl or "orthomol prepare" in fl:
        matched.append("Prepare")
    if "collagen" in fl or "kollagen" in fl:
        matched.append("Collagen")
    if "omega-3" in fl or "omega 3" in fl:
        matched.append("Omega-3")
    if fn == "Orthomol Sport" or ("orthomol sport" in fl and not any(x in fl for x in ["protein", "perform", "recover", "prepare"])):
        matched.append("Orthomol Sport")
    if "zink" in fl or "zinc" in fl:
        matched.append("Zink")
    if "ag1 d3" in fl or ("d3" in fl and "k2" in fl):
        matched.append("AG1 D3 + K2")
    elif "ag1" in fl or "athletic greens" in fl:
        matched.append("AG1")
    if "magnesium" in fl:
        matched.append("Magnesium")
    if "b12" in fl or "b-12" in fl:
        matched.append("B12")
    if "ashwagandha" in fl or "ashwaghanda" in fl:
        matched.append("Ashwagandha")
    if "spirulina" in fl:
        matched.append("Spirulina")
    if "iron supplement" in fl or "eisen" in fl:
        matched.append("Iron")
    if "vitamin c" in fl and "punch" not in fl:
        matched.append("Vitamin C")
    if "kreatin" in fl or "creatin" in fl:
        matched.append("Kreatin")
    if any(x in fl for x in ["electrolyte", "elektrolyt", "isolight", "vitamin wasser regain", "vitamin water"]):
        matched.append("Electrolyte")
    if "kurkuma" in fl or "turmeric" in fl or "curcum" in fl:
        matched.append("Kurkuma")
    # Huel is stored in MacroFactor Food Log without Brand Name as "Chocolate nutritionally complete food"
    if "huel" in fl or "nutritionally complete food" in fl or "food in a bottle" in fl:
        matched.append("Huel")
    if "daily greens" in fl:
        matched.append("Daily Greens")
    # Additional audited supplement categories discovered across the 1,066 unique food logs:
    if "pro darm" in fl or "probiot" in fl or "actimel" in fl:
        matched.append("Pro Darm / Probiotics")
    if "multivitamin a-z" in fl:
        matched.append("Multivitamin A-Z")
    if "bcaa" in fl:
        matched.append("BCAA")
    if any(x in fl for x in [
        "vanilla vegan protein powder",
        "clear vegan protein",
        "clean whey protein powder",
        "iso-whey hardcore",
        "iso whey clear",
        "whey protein powder isolate",
    ]):
        matched.append("Protein Powder (Vegan/Whey)")
    if "powergel" in fl:
        matched.append("PowerGel")
    if "wheat germ" in fl or "weizenkeim" in fl:
        matched.append("Weizenkeime (Spermidin)")

    return matched


MACRO_SUPP_ORDER = [
    "Ecdysteron",
    "Orthomol Protein",
    "Perform",
    "Recover",
    "Prepare",
    "Collagen",
    "Omega-3",
    "Orthomol Sport",
    "Zink",
    "AG1 D3 + K2",
    "AG1",
    "Magnesium",
    "B12",
    "Ashwagandha",
    "Spirulina",
    "Vitamin C",
    "Iron",
    "Kreatin",
    "Electrolyte",
    "Kurkuma",
    "Huel",
    "Daily Greens",
    "Pro Darm / Probiotics",
    "Multivitamin A-Z",
    "BCAA",
    "Protein Powder (Vegan/Whey)",
    "PowerGel",
    "Weizenkeime (Spermidin)",
]


def normalize_excel_date(val):
    s = str(val).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    # Check if Excel serial date number
    try:
        num = float(s)
        if 40000 <= num <= 50000:
            dt = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(num))
            return dt.isoformat()
    except ValueError:
        pass
    return s[:10]


def extract_macrofactor_supplements():
    by_supp = {k: set() for k in MACRO_SUPP_ORDER}
    by_supp_raw_names = {k: set() for k in MACRO_SUPP_ORDER}
    by_date = defaultdict(set)

    xlsx_files = sorted(glob.glob(os.path.join(MACRO_DIR, "*_Macrofactor.xlsx")))
    for fpath in xlsx_files:
        with zipfile.ZipFile(fpath, "r") as z:
            ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
            ss = []
            if "xl/sharedStrings.xml" in z.namelist():
                r_ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for si in r_ss.findall(ns + "si"):
                    ss.append("".join(t.text or "" for t in si.iter(ns + "t")))
            wb = ET.fromstring(z.read("xl/workbook.xml"))
            rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
            rid_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
            for sh in wb.iter(ns + "sheet"):
                name = sh.attrib.get("name")
                rid = sh.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                if name == "Food Log" and rid in rid_map:
                    target = "xl/" + rid_map[rid].lstrip("/")
                    rows = parse_xlsx_sheet(z, target, ss)
                    for r in rows[1:]:
                        dt = normalize_excel_date(r.get("A", ""))
                        fn = r.get("C", "").strip()
                        if not fn or not re.match(r"^\d{4}-\d{2}-\d{2}$", dt):
                            continue
                        cats = classify_macrofactor_food(fn)
                        for c in cats:
                            by_supp[c].add(dt)
                            by_supp_raw_names[c].add(fn)
                            by_date[dt].add(c)

    all_dates = sorted(by_date.keys())
    csv_rows = []
    for dt in all_dates:
        s_list = [s for s in MACRO_SUPP_ORDER if s in by_date[dt]]
        row_obj = {"Date": dt, "Supplements_List": ", ".join(s_list)}
        for s in MACRO_SUPP_ORDER:
            row_obj[s] = 1 if s in by_date[dt] else 0
        csv_rows.append(row_obj)

    pd.DataFrame(csv_rows).to_csv(OUT_MACRO_SUPP_CSV, index=False)

    return {
        "by_supplement": {
            k: {
                "count": len(by_supp[k]),
                "first_date": min(by_supp[k]) if by_supp[k] else None,
                "last_date": max(by_supp[k]) if by_supp[k] else None,
                "raw_names": sorted(by_supp_raw_names[k]),
                "dates": sorted(by_supp[k], reverse=True)
            }
            for k in MACRO_SUPP_ORDER
        },
        "daily_rows": sorted(csv_rows, key=lambda x: x["Date"], reverse=True)
    }


def compute_rolling_and_monthly_analysis():
    df_sheet = pd.read_csv(SHEET_CSV)
    df_sheet["dt_iso"] = df_sheet["Date"].astype(str).str[:10]
    df_sheet = df_sheet[df_sheet["dt_iso"].str.match(r"^\d{4}-\d{2}-\d{2}$", na=False)].sort_values("dt_iso").reset_index(drop=True)

    df_sheet["Recovery_num"] = pd.to_numeric(df_sheet["Recovery"], errors="coerce")
    df_sheet["Sleep_num"] = pd.to_numeric(df_sheet["Sleep"], errors="coerce")
    df_sheet["Strain_num"] = pd.to_numeric(df_sheet["Strain"], errors="coerce")
    df_sheet["BW_num"] = pd.to_numeric(df_sheet["Körpergewicht"], errors="coerce")
    df_sheet["Kcal_num"] = pd.to_numeric(df_sheet["Calories"], errors="coerce")
    df_sheet["Prot_num"] = pd.to_numeric(df_sheet["Protein"], errors="coerce")

    # Next-day recovery (Tag +1) for daytime supplements & regeneration
    rec_by_date = dict(zip(df_sheet["dt_iso"], df_sheet["Recovery_num"]))
    next_day_rec = []
    for dt_str in df_sheet["dt_iso"]:
        dt_obj = datetime.date.fromisoformat(dt_str)
        next_dt = (dt_obj + datetime.timedelta(days=1)).isoformat()
        next_day_rec.append(rec_by_date.get(next_dt, np.nan))
    df_sheet["Recovery_next_day"] = next_day_rec

    # Cutoffs: Rolling 90 days (from 2026-11-08 -> 2026-08-10)
    cutoff_90d = "2026-08-10"
    df_90 = df_sheet[df_sheet["dt_iso"] >= cutoff_90d].copy()

    factors = [
        # (Label, Column, Keyword, TargetMetricCol, LagLabel)
        ("💊 Kreatin", "Supplements", "Kreatin", "Recovery_next_day", "Tag +1"),
        ("💊 Magnesium", "Supplements", "Magnesium", "Recovery_next_day", "Tag +1"),
        ("💊 Omega-3", "Supplements", "Omega-3", "Recovery_next_day", "Tag +1"),
        ("💊 Zink", "Supplements", "Zink", "Recovery_next_day", "Tag +1"),
        ("💊 Vitamin D", "Supplements", "Vit D", "Recovery_next_day", "Tag +1"),
        ("💊 Elektrolyte", "Supplements", "Elektrolyte", "Recovery_next_day", "Tag +1"),
        ("🧬 Kollagen", "Supplements", "Kollagen", "Recovery_next_day", "Tag +1"),
        ("☕ Koffein", "Supplements", "Koffein", "Recovery_next_day", "Tag +1"),
        ("🧊 Blackroll", "Regeneration", "Blackroll", "Recovery_next_day", "Tag +1"),
        ("🧊 Dehnen", "Regeneration", "Dehnen", "Recovery_next_day", "Tag +1"),
        ("🧊 Spaziergang / Outdoor", "Regeneration", "Spaziergang|Outdoor", "Recovery_next_day", "Tag +1"),
        ("💤 Bett geteilt", "Schlaf", "Bett geteilt", "Recovery_num", "Tag 0"),
        ("💤 Gelesen", "Schlaf", "Gelesen", "Recovery_num", "Tag 0"),
        ("💤 Schlafmaske", "Schlaf", "Schlafmaske", "Recovery_num", "Tag 0"),
        ("💤 Hot-Shower", "Schlaf", "Hot-Shower", "Recovery_num", "Tag 0"),
        ("⚠️ Late Meal (Spät gegessen)", "Schlaf", "Late Meal", "Recovery_num", "Tag 0"),
        ("⚠️ Schlaf-Unterbrechung", "Schlaf", "Unterbrechung", "Recovery_num", "Tag 0"),
        ("⚠️ Anderes Bett / Reise", "Schlaf", "Anderes Bett", "Recovery_num", "Tag 0"),
    ]

    def eval_subset(sub_df):
        out = []
        for label, col, kw, target_col, lag_lbl in factors:
            valid = sub_df[sub_df[target_col].notna() & sub_df[col].notna()].copy()
            if len(valid) < 5:
                continue
            has_kw = valid[col].astype(str).str.contains(kw, case=False, na=False)
            yes_vals = valid.loc[has_kw, target_col]
            no_vals = valid.loc[~has_kw, target_col]
            if len(yes_vals) >= 2 and len(no_vals) >= 2:
                m_yes = float(yes_vals.mean())
                m_no = float(no_vals.mean())
                delta = round(m_yes - m_no, 2)
                out.append({
                    "factor": label,
                    "category": col,
                    "lag": lag_lbl,
                    "n_yes": int(len(yes_vals)),
                    "n_no": int(len(no_vals)),
                    "mean_yes": round(m_yes, 1),
                    "mean_no": round(m_no, 1),
                    "delta_recovery_pct": delta
                })
        out.sort(key=lambda x: x["delta_recovery_pct"], reverse=True)
        return out

    rolling_90_results = eval_subset(df_90)
    all_time_results = eval_subset(df_sheet)

    # Monthly Whoop & MacroFactor Summary (last 6 months)
    df_whoop = pd.read_csv(WHOOP_CYCLES_CSV)
    df_whoop["dt_iso"] = df_whoop["Cycle start time"].astype(str).str[:10]
    df_whoop["month"] = df_whoop["dt_iso"].str[:7]

    df_macro = pd.read_csv(MACRO_PARSED_CSV)
    df_macro["month"] = df_macro["date"].astype(str).str[:7]

    months_list = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
    monthly_summary = []
    for m in months_list:
        w_m = df_whoop[df_whoop["month"] == m]
        s_m = df_sheet[df_sheet["dt_iso"].str[:7] == m]
        mac_m = df_macro[df_macro["month"] == m]

        rec_val = w_m["Recovery score %"].mean() if len(w_m) else s_m["Recovery_num"].mean()
        hrv_val = w_m["Heart rate variability (ms)"].mean() if len(w_m) else np.nan
        rhr_val = w_m["Resting heart rate (bpm)"].mean() if len(w_m) else np.nan
        slp_val = w_m["Sleep performance %"].mean() if len(w_m) else s_m["Sleep_num"].mean()
        str_val = w_m["Day Strain"].mean() if len(w_m) else s_m["Strain_num"].mean()

        kcal_val = mac_m["Calories (kcal)"].mean() if len(mac_m) else s_m["Kcal_num"].mean()
        prot_val = mac_m["Protein (g)"].mean() if len(mac_m) else s_m["Prot_num"].mean()
        carbs_val = mac_m["Carbs (g)"].mean() if len(mac_m) else pd.to_numeric(s_m["Carbs"], errors="coerce").mean()
        exp_val = mac_m["Expenditure"].mean() if len(mac_m) else np.nan
        bw_val = s_m["BW_num"].mean() if s_m["BW_num"].notna().any() else (mac_m["Trend Weight (kg)"].mean() if len(mac_m) else np.nan)

        monthly_summary.append({
            "month": m,
            "days_logged": int(len(s_m)),
            "recovery_pct": round(float(rec_val), 1) if pd.notna(rec_val) else None,
            "hrv_ms": round(float(hrv_val), 1) if pd.notna(hrv_val) else None,
            "rhr_bpm": round(float(rhr_val), 1) if pd.notna(rhr_val) else None,
            "sleep_pct": round(float(slp_val), 1) if pd.notna(slp_val) else None,
            "strain": round(float(str_val), 1) if pd.notna(str_val) else None,
            "kcal": round(float(kcal_val), 0) if pd.notna(kcal_val) else None,
            "protein_g": round(float(prot_val), 1) if pd.notna(prot_val) else None,
            "carbs_g": round(float(carbs_val), 1) if pd.notna(carbs_val) else None,
            "expenditure_kcal": round(float(exp_val), 0) if pd.notna(exp_val) else None,
            "bw_kg": round(float(bw_val), 2) if pd.notna(bw_val) else None,
        })

    return {
        "cutoff_90d": cutoff_90d,
        "rolling_90d_drivers": rolling_90_results,
        "all_time_drivers": all_time_results,
        "monthly_summary": monthly_summary
    }


def main():
    print("=== Running Supplement Extractor (Whoop & MacroFactor) + Monthly & 90-Day Rolling Analysis ===")
    whoop_supp = extract_whoop_supplements()
    print("Whoop Journal Supplements extracted:")
    for k, v in whoop_supp["by_supplement"].items():
        print(f"  - {k}: {v['count']} Tage ({v['first_date']} bis {v['last_date']})")

    macro_supp = extract_macrofactor_supplements()
    print("\nMacroFactor Supplements extracted (22 categories):")
    for k, v in macro_supp["by_supplement"].items():
        print(f"  - {k:<18}: {v['count']:>3} Tage ({v['first_date'] or '-'} bis {v['last_date'] or '-'}) | Raw: {v['raw_names']}")

    analysis = compute_rolling_and_monthly_analysis()
    print("\nRolling 90-Day Top Drivers:")
    for d in analysis["rolling_90d_drivers"][:5]:
        print(f"  + {d['factor']}: {d['delta_recovery_pct']:+.2f}% Recovery ({d['lag']}, n={d['n_yes']})")
    print("Rolling 90-Day Negative Drivers:")
    for d in analysis["rolling_90d_drivers"][-4:]:
        print(f"  - {d['factor']}: {d['delta_recovery_pct']:+.2f}% Recovery ({d['lag']}, n={d['n_yes']})")

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "whoop_supplements": whoop_supp,
        "macrofactor_supplements": macro_supp,
        "analysis": analysis
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Saved complete supplement & monthly/90d analysis to {OUT_JSON}")


if __name__ == "__main__":
    main()
