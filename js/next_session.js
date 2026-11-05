/**
 * Tab 1: Next Session & Programm + Tab 2 Extensions:
 * - Season-Based Testing Standards (Halbjahres-Saison mit ≈ Annäherungen & ausgegrauten All-Time PBs, strikte Trennung 12-Step Rehearsal vs 19-Step WK PB)
 * - Universal Parameter Time-Series Graph & Heatmap Explorer (1W, 1M, 3M, 6M, Aktuelle Saison, 1J, 3J, 5J, Max für JEDEN Journal- & Diagnostik-Parameter)
 * - DLV Biomechanik-Vergleich: Luka Herden vs. Simon Ehammer (8.30m / 8.40m eff.) + Alle 68 DLV-Berichte & 87x 1080 Sprint-Läufe
 */
const NextSessionModule = (() => {
  let activeSeasonKey = 'winter_26_27';
  let uniTimeframe = 'SAISON'; // '1W' | '1M' | '3M' | '6M' | 'SAISON' | '1Y' | '3Y' | '5Y' | 'ALL'
  let uniParamKey = 'whoop_recovery_pct';
  let uniViewMode = 'both'; // 'both' | 'chart' | 'heatmap'
  let uniChartInstance = null;
  let ehammerCompareJump = 'bochum_2026';
  let dlvSubTab = 'ehammer'; // 'ehammer' | 'weit' | 'anlauf' | 'sprint1080'
  let filter1080Query = '';
  let dlv1080Bundle = null;

  const SEMI_ANNUAL_SEASONS = {
    'winter_26_27': {
      label: '❄️ Winter/Halle 2026/27 (Aktuelle Saison • ab Sept 2026)',
      shortLabel: 'Winter 2026/27 (Aktuell)',
      start: '2026-09-01',
      end: '2027-03-25',
      bw: 83.2,
      note: 'Aktueller Aufbau Block 2 (FCT + 1080 + Spikes). Noch keine isolierte Lichtschranken-/KMP-Diagnostik in dieser Halbjahressaison – Annäherungen (≈ Est.) werden transparent aus deinen aktuellen Trainingswerten (40/50/60m Handstoppung vom 29.10., 1080-Vmax 9.19 m/s, Hürdensprünge 91cm, Umsetzen 2x100kg & FCT Trapbar 3x120kg) berechnet.'
    },
    'sommer_26': {
      label: '☀️ Sommer 2026 (Ende März – Sept 2026 • DM Bochum 7.86m / 8.07m eff.)',
      shortLabel: 'Sommer 2026',
      start: '2026-03-25',
      end: '2026-09-15',
      bw: 85.8,
      note: 'Freiluftsaison 2026: 7.86m DM Bochum (8.07m effektiv, Vmax Anlauf 10.76 m/s!), Trapbar e1RM 154 kg, Hip-Thrust e1RM 144 kg, Umsetzen 120 kg (124 kg e1RM).'
    },
    'winter_25_26': {
      label: '❄️ Winter/Halle 2025/26 (Sept 2025 – März 2026 • 8.18m PB Gorzów)',
      shortLabel: 'Winter 2025/26 (8.18m PB)',
      start: '2025-09-01',
      end: '2026-03-24',
      bw: 84.5,
      note: 'Hallensaison 2025/26: 8.18m Hallen-PB in Gorzów (31.01.2026, 8.21m effektiv, Vmax 10.70 m/s), 1080 ZUL Vmax 10.72 m/s, 60m 6.91s.'
    },
    'sommer_25': {
      label: '☀️ Sommer 2025 (Ende März – Sept 2025 • 8.01m Athen & FISU Bronze)',
      shortLabel: 'Sommer 2025 (8.01m)',
      start: '2025-03-25',
      end: '2025-09-15',
      bw: 83.8,
      note: 'Freiluftsaison 2025: 8.01m Vari/Athen, 2x 7.96m FISU Games Bochum Bronze, 7.94m Essen (8.00m eff.), hohe Wettkampfkonstanz (Ø 7.86m).'
    },
    'sommer_24': {
      label: '☀️ Sommer 2024 (Ende März – Sept 2024 • 8.08m EM Rom @ 79.8 kg)',
      shortLabel: 'Sommer 2024 (8.08m Rom)',
      start: '2024-03-25',
      end: '2024-09-15',
      bw: 79.8,
      note: 'EM-Saison 2024: 8.08m EM Rom Quali & 8.01m EM Rom Finale (8.11m effektiv) bei 79.80 kg Wettkampfgewicht!'
    }
  };

  // Season-specific Diagnostic Standards Data (Rows 1-4 of Luka's table)
  // Strictly separates 12-Step Event Rehearsal (>=7.50m) from 19-Step Competition PB (8.18m)!
  const SEASON_STANDARDS_DATA = {
    'winter_26_27': [
      {
        category: '1. Acceleration',
        name: '30m Sprint (elektr. / Block)',
        target: 3.87,
        unit: 's',
        lowerIsBetter: true,
        val: 3.92,
        isApprox: true,
        sourceBadge: '≈ Annäherung (aus 40m 4.91s Hand @ 90% & 1080 30m)',
        pbDisplay: 'All-Time PB: ~3.82s (100m 10.37s / 60m 6.76s)',
        pct: 96
      },
      {
        category: '1. Acceleration',
        name: '30–40m Split (Übergang)',
        target: 0.96,
        unit: 's',
        lowerIsBetter: true,
        val: 0.98,
        isApprox: true,
        sourceBadge: '≈ Annäherung (aus 40–50m Split 0.87s @ 90% am 29.10.)',
        pbDisplay: 'All-Time PB: 0.93s (10.75 m/s)',
        pct: 97
      },
      {
        category: '2. Max Velocity',
        name: '40m Sprint (elektr. Äquivalent)',
        target: 4.75,
        unit: 's',
        lowerIsBetter: true,
        val: 4.89,
        isApprox: true,
        sourceBadge: '≈ Annäherung (4.91s Hand 1. Bew. @ 90% am 29.10.26)',
        pbDisplay: 'All-Time PB: ~4.74s',
        pct: 95
      },
      {
        category: '2. Max Velocity',
        name: '20m Flying Sprint',
        target: 1.91,
        unit: 's',
        lowerIsBetter: true,
        val: 1.94,
        isApprox: true,
        sourceBadge: '≈ Annäherung (50–60m Split 0.85s @ 90% & 1080 9.19 m/s)',
        pbDisplay: 'All-Time PB: 1.86s (Vmax Anlauf 10.76 m/s)',
        pct: 97
      },
      {
        category: '3. Power & Kraft (Relativ)',
        name: 'Squat / Beinkraft-Äquivalent (Trapbar & Aufsteiger)',
        target: 2.30,
        unit: 'x BW',
        lowerIsBetter: false,
        val: 1.80,
        isApprox: true,
        sourceBadge: '≈ Annäherung (Trapbar FCT 3x120kg / Aufsteiger 3x4x90kg • Squat wegen Rücken ersetzt)',
        pbDisplay: 'All-Time Peak: 1.92x BW (Trapbar 160kg / Squat 115kg 3x6)',
        pct: 78
      },
      {
        category: '3. Power & Kraft (Relativ)',
        name: 'Power Clean (Umsetzen)',
        target: 1.70,
        unit: 'x BW',
        lowerIsBetter: false,
        val: 1.32,
        isApprox: false,
        sourceBadge: '✅ Gemessen am 29.10.26: 2x 100kg (e1RM ~107–110kg @ 83.2kg)',
        pbDisplay: 'All-Time PB: 1.48x BW (120kg 1RM / 124kg e1RM)',
        pct: 78
      },
      {
        category: '4. Reactive & Rehearsal',
        name: 'Countermovement Jump (CMJ)',
        target: 37.5,
        unit: 'inch',
        lowerIsBetter: false,
        val: 27.2,
        isApprox: true,
        sourceBadge: '≈ Annäherung (~69 cm aus Hürdensprüngen 91cm & FCT am 29.10.)',
        pbDisplay: 'All-Time PB: 28.0" (71.0 cm m.A. / 61.9 cm o.A.)',
        pct: 73
      },
      {
        category: '4. Reactive & Rehearsal',
        name: '4 Bounds (4er Sprunglauf aus Stand/Anlauf)',
        target: 17.10,
        unit: 'm',
        lowerIsBetter: false,
        val: 16.30,
        isApprox: true,
        sourceBadge: '≈ Annäherung (aus SPL / Pen1 & 1080 Sprungläufen Okt 26)',
        pbDisplay: 'All-Time PB: ~16.85m',
        pct: 95
      },
      {
        category: '4. Reactive & Rehearsal',
        name: 'Event Rehearsal (12 Schritte!) — NICHT 19-Schritt WK',
        target: 7.50,
        unit: 'm',
        lowerIsBetter: false,
        val: 7.15,
        isApprox: true,
        sourceBadge: '≈ Annäherung (Projektiert aus aktuellem Aufbau-Speed • Erste Grube folgt Dez)',
        pbDisplay: '12-Step PB: ~7.42m  |  [19-Step WK PB: 8.18m Gorzów]',
        pct: 95
      }
    ],
    'sommer_26': [
      { category: '1. Acceleration', name: '30m Sprint', target: 3.87, unit: 's', lowerIsBetter: true, val: 3.86, isApprox: true, sourceBadge: '≈ Annäherung (aus DM Bochum Anlauf-Dynamik)', pbDisplay: 'All-Time PB: ~3.82s', pct: 100 },
      { category: '1. Acceleration', name: '30–40m Split', target: 0.96, unit: 's', lowerIsBetter: true, val: 0.93, isApprox: false, sourceBadge: '✅ Gemessen DLV Bochum (10.76 m/s Peak)', pbDisplay: 'All-Time PB: 0.93s', pct: 100 },
      { category: '2. Max Velocity', name: '40m Sprint', target: 4.75, unit: 's', lowerIsBetter: true, val: 4.76, isApprox: true, sourceBadge: '≈ Annäherung (aus Vmax 10.76 m/s)', pbDisplay: 'All-Time PB: ~4.74s', pct: 99 },
      { category: '2. Max Velocity', name: '20m Flying Sprint', target: 1.91, unit: 's', lowerIsBetter: true, val: 1.86, isApprox: false, sourceBadge: '✅ Gemessen DLV Bochum (6–1m: 10.70 m/s, Peak 10.76 m/s)', pbDisplay: 'All-Time PB: 1.86s', pct: 100 },
      { category: '3. Power & Kraft (Relativ)', name: 'Squat / Trapbar-Äquivalent', target: 2.30, unit: 'x BW', lowerIsBetter: false, val: 1.80, isApprox: false, sourceBadge: '✅ Gemessen 06.07.26: Trapbar 3x140kg (154kg e1RM @ 85.8kg)', pbDisplay: 'All-Time Peak: 1.92x BW', pct: 78 },
      { category: '3. Power & Kraft (Relativ)', name: 'Power Clean (Umsetzen)', target: 1.70, unit: 'x BW', lowerIsBetter: false, val: 1.45, isApprox: false, sourceBadge: '✅ Gemessen 05.05.26: 124 kg e1RM (120kg 1RM)', pbDisplay: 'All-Time PB: 1.48x BW', pct: 85 },
      { category: '4. Reactive & Rehearsal', name: 'Countermovement Jump (CMJ)', target: 37.5, unit: 'inch', lowerIsBetter: false, val: 27.6, isApprox: true, sourceBadge: '≈ Annäherung (~70.0 cm Sommer-Peak)', pbDisplay: 'All-Time PB: 28.0" (71.0 cm)', pct: 74 },
      { category: '4. Reactive & Rehearsal', name: '4 Bounds', target: 17.10, unit: 'm', lowerIsBetter: false, val: 16.65, isApprox: true, sourceBadge: '≈ Annäherung (Stütz/Bounds Sommer 26)', pbDisplay: 'All-Time PB: ~16.85m', pct: 97 },
      { category: '4. Reactive & Rehearsal', name: 'Event Rehearsal (12 Schritte!) — NICHT 19-Schritt WK', target: 7.50, unit: 'm', lowerIsBetter: false, val: 7.35, isApprox: true, sourceBadge: '≈ Annäherung (12er Trainingssprünge • 19er WK Bochum: 7.86m / 8.07m eff.)', pbDisplay: '12-Step PB: ~7.42m  |  [19-Step WK PB: 8.18m]', pct: 98 }
    ],
    'winter_25_26': [
      { category: '1. Acceleration', name: '30m Sprint', target: 3.87, unit: 's', lowerIsBetter: true, val: 3.84, isApprox: true, sourceBadge: '≈ Annäherung (60m WK 6.91s & Gorzów Anlauf)', pbDisplay: 'All-Time PB: ~3.82s', pct: 100 },
      { category: '1. Acceleration', name: '30–40m Split', target: 0.96, unit: 's', lowerIsBetter: true, val: 0.935, isApprox: false, sourceBadge: '✅ Gemessen Gorzów (10.70 m/s Anlauf)', pbDisplay: 'All-Time PB: 0.93s', pct: 100 },
      { category: '2. Max Velocity', name: '40m Sprint', target: 4.75, unit: 's', lowerIsBetter: true, val: 4.74, isApprox: true, sourceBadge: '≈ Annäherung (Gorzów 8.18m Peak-Form)', pbDisplay: 'All-Time PB: ~4.74s', pct: 100 },
      { category: '2. Max Velocity', name: '20m Flying Sprint', target: 1.91, unit: 's', lowerIsBetter: true, val: 1.87, isApprox: false, sourceBadge: '✅ Gemessen Gorzów (10.70 m/s) & 1080 ZUL (10.72 m/s)', pbDisplay: 'All-Time PB: 1.86s', pct: 100 },
      { category: '3. Power & Kraft (Relativ)', name: 'Squat / Trapbar-Äquivalent', target: 2.30, unit: 'x BW', lowerIsBetter: false, val: 1.82, isApprox: false, sourceBadge: '✅ Gemessen FCT Trapbar 154kg e1RM', pbDisplay: 'All-Time Peak: 1.92x BW', pct: 79 },
      { category: '3. Power & Kraft (Relativ)', name: 'Power Clean (Umsetzen)', target: 1.70, unit: 'x BW', lowerIsBetter: false, val: 1.42, isApprox: false, sourceBadge: '✅ Gemessen 120 kg 1RM', pbDisplay: 'All-Time PB: 1.48x BW', pct: 84 },
      { category: '4. Reactive & Rehearsal', name: 'Countermovement Jump (CMJ)', target: 37.5, unit: 'inch', lowerIsBetter: false, val: 28.0, isApprox: true, sourceBadge: '≈ Annäherung (~71 cm Hallen-Peak)', pbDisplay: 'All-Time PB: 28.0" (71.0 cm)', pct: 75 },
      { category: '4. Reactive & Rehearsal', name: '4 Bounds', target: 17.10, unit: 'm', lowerIsBetter: false, val: 16.85, isApprox: true, sourceBadge: '≈ Annäherung (Hallen-UWV Peak)', pbDisplay: 'All-Time PB: ~16.85m', pct: 99 },
      { category: '4. Reactive & Rehearsal', name: 'Event Rehearsal (12 Schritte!) — NICHT 19-Schritt WK', target: 7.50, unit: 'm', lowerIsBetter: false, val: 7.42, isApprox: true, sourceBadge: '≈ Annäherung (12er/15er UWV vor 8.18m Gorzów • 19er WK PB: 8.18m!)', pbDisplay: '12-Step PB: ~7.42m  |  [19-Step WK PB: 8.18m]', pct: 99 }
    ],
    'sommer_25': [
      { category: '1. Acceleration', name: '30m Sprint', target: 3.87, unit: 's', lowerIsBetter: true, val: 3.86, isApprox: true, sourceBadge: '≈ Annäherung (1080 Sprints Juni 25)', pbDisplay: 'All-Time PB: ~3.82s', pct: 100 },
      { category: '1. Acceleration', name: '30–40m Split', target: 0.96, unit: 's', lowerIsBetter: true, val: 0.95, isApprox: false, sourceBadge: '✅ Gemessen DLV Essen/Dessau (10.50–10.60 m/s)', pbDisplay: 'All-Time PB: 0.93s', pct: 100 },
      { category: '2. Max Velocity', name: '40m Sprint', target: 4.75, unit: 's', lowerIsBetter: true, val: 4.77, isApprox: true, sourceBadge: '≈ Annäherung (Athen 8.01m Form)', pbDisplay: 'All-Time PB: ~4.74s', pct: 99 },
      { category: '2. Max Velocity', name: '20m Flying Sprint', target: 1.91, unit: 's', lowerIsBetter: true, val: 1.89, isApprox: false, sourceBadge: '✅ Gemessen DLV Anlauf (10.58 m/s)', pbDisplay: 'All-Time PB: 1.86s', pct: 100 },
      { category: '3. Power & Kraft (Relativ)', name: 'Squat / Trapbar-Äquivalent', target: 2.30, unit: 'x BW', lowerIsBetter: false, val: 1.79, isApprox: false, sourceBadge: '✅ Gemessen Trapbar 150 kg e1RM', pbDisplay: 'All-Time Peak: 1.92x BW', pct: 78 },
      { category: '3. Power & Kraft (Relativ)', name: 'Power Clean (Umsetzen)', target: 1.70, unit: 'x BW', lowerIsBetter: false, val: 1.43, isApprox: false, sourceBadge: '✅ Gemessen 120 kg e1RM', pbDisplay: 'All-Time PB: 1.48x BW', pct: 84 },
      { category: '4. Reactive & Rehearsal', name: 'Countermovement Jump (CMJ)', target: 37.5, unit: 'inch', lowerIsBetter: false, val: 27.2, isApprox: false, sourceBadge: '✅ Gemessen OSP (69.0 cm m.A.)', pbDisplay: 'All-Time PB: 28.0" (71.0 cm)', pct: 73 },
      { category: '4. Reactive & Rehearsal', name: '4 Bounds', target: 17.10, unit: 'm', lowerIsBetter: false, val: 16.60, isApprox: true, sourceBadge: '≈ Annäherung (Sommer 25)', pbDisplay: 'All-Time PB: ~16.85m', pct: 97 },
      { category: '4. Reactive & Rehearsal', name: 'Event Rehearsal (12 Schritte!) — NICHT 19-Schritt WK', target: 7.50, unit: 'm', lowerIsBetter: false, val: 7.35, isApprox: true, sourceBadge: '≈ Annäherung (12er Training • 19er WK Athen: 8.01m)', pbDisplay: '12-Step PB: ~7.42m  |  [19-Step WK PB: 8.18m]', pct: 98 }
    ],
    'sommer_24': [
      { category: '1. Acceleration', name: '30m Sprint', target: 3.87, unit: 's', lowerIsBetter: true, val: 3.84, isApprox: true, sourceBadge: '≈ Annäherung (@ 79.8 kg EM Rom Form)', pbDisplay: 'All-Time PB: ~3.82s', pct: 100 },
      { category: '1. Acceleration', name: '30–40m Split', target: 0.96, unit: 's', lowerIsBetter: true, val: 0.945, isApprox: false, sourceBadge: '✅ Gemessen EM Rom (10.58 m/s)', pbDisplay: 'All-Time PB: 0.93s', pct: 100 },
      { category: '2. Max Velocity', name: '40m Sprint', target: 4.75, unit: 's', lowerIsBetter: true, val: 4.75, isApprox: true, sourceBadge: '≈ Annäherung (EM Rom 8.08m)', pbDisplay: 'All-Time PB: ~4.74s', pct: 100 },
      { category: '2. Max Velocity', name: '20m Flying Sprint', target: 1.91, unit: 's', lowerIsBetter: true, val: 1.89, isApprox: false, sourceBadge: '✅ Gemessen EM Rom (10.58 m/s)', pbDisplay: 'All-Time PB: 1.86s', pct: 100 },
      { category: '3. Power & Kraft (Relativ)', name: 'Squat / Trapbar-Äquivalent', target: 2.30, unit: 'x BW', lowerIsBetter: false, val: 1.92, isApprox: false, sourceBadge: '✅ Gemessen @ 79.8kg (Relativkraft-Peak durch Idealgewicht!)', pbDisplay: 'All-Time Peak: 1.92x BW', pct: 83 },
      { category: '3. Power & Kraft (Relativ)', name: 'Power Clean (Umsetzen)', target: 1.70, unit: 'x BW', lowerIsBetter: false, val: 1.48, isApprox: false, sourceBadge: '✅ Gemessen @ 79.8kg (118 kg e1RM)', pbDisplay: 'All-Time PB: 1.48x BW', pct: 87 },
      { category: '4. Reactive & Rehearsal', name: 'Countermovement Jump (CMJ)', target: 37.5, unit: 'inch', lowerIsBetter: false, val: 27.5, isApprox: false, sourceBadge: '✅ Gemessen OSP (69.8 cm m.A. / DJ50 78.2 W/kg)', pbDisplay: 'All-Time PB: 28.0" (71.0 cm)', pct: 73 },
      { category: '4. Reactive & Rehearsal', name: '4 Bounds', target: 17.10, unit: 'm', lowerIsBetter: false, val: 16.75, isApprox: true, sourceBadge: '≈ Annäherung (Rom UWV)', pbDisplay: 'All-Time PB: ~16.85m', pct: 98 },
      { category: '4. Reactive & Rehearsal', name: 'Event Rehearsal (12 Schritte!) — NICHT 19-Schritt WK', target: 7.50, unit: 'm', lowerIsBetter: false, val: 7.40, isApprox: true, sourceBadge: '≈ Annäherung (12er UWV • 19er WK EM Rom: 8.08m / 8.11m eff.)', pbDisplay: '12-Step PB: ~7.42m  |  [19-Step WK PB: 8.18m]', pct: 99 }
    ]
  };

  // Detailed Biomechanical Comparison: Simon Ehammer vs Luka Herden's Key Jumps
  const EHAMMER_BIOMECH = {
    ehammer_2022: {
      title: '🇨🇭 Simon Ehammer (Ratingen 07.05.2022 • V3)',
      offiziell: 8.30,
      erwartet: 8.29,
      effektiv: 8.40,
      wind: '+0.0',
      balken_verlust: 0.10,
      v_max: 10.79,
      v_3L: 10.62,
      v_2L: 10.79,
      v_1L: 10.62,
      v_abflug_hor: 9.18,
      v_verlust_hor: -1.44,
      v_vertikal: 3.27,
      geschw_bilanz: +0.2,
      s_3L: 2.26,
      s_2L: 2.34,
      s_1L: 2.30,
      entf_4L: 9.39,
      abstand_knie_2L: -0.12,
      stemmwinkel: 24,
      rumpfwinkel_abspr: 99,
      rumpfrotation: 6,
      kniewinkel_min: 144,
      abflugwinkel: 19.6,
      schwungbein_w: 833,
      landeweite: 0.59,
      lande_index: 1.6,
      landeverlust: -0.11,
      lande_rumpf: 71,
      lande_knie: 141,
      lande_huefte: 80
    },
    bochum_2026: {
      title: '🇩🇪 Luka Herden — DM Bochum (25.07.2026 • V5)',
      offiziell: 7.86,
      erwartet: 8.21,
      effektiv: 8.07,
      wind: '+1.3',
      balken_verlust: 0.21,
      v_max: 10.76,
      v_3L: 10.60,
      v_2L: 10.70,
      v_1L: 10.59,
      v_abflug_hor: 9.12,
      v_verlust_hor: -1.47,
      v_vertikal: 3.30,
      geschw_bilanz: +0.2,
      s_3L: 2.10,
      s_2L: 2.55,
      s_1L: 2.25,
      entf_4L: 9.60,
      abstand_knie_2L: 0.00,
      stemmwinkel: 27,
      rumpfwinkel_abspr: 100,
      rumpfrotation: 9,
      kniewinkel_min: 143,
      abflugwinkel: 19.9,
      schwungbein_w: 841,
      landeweite: 0.63,
      lande_index: 1.8,
      landeverlust: -0.25,
      lande_rumpf: 110,
      lande_knie: 143,
      lande_huefte: 122
    },
    rom_2024: {
      title: '🇩🇪 Luka Herden — EM Rom Finale (08.06.2024 • V3)',
      offiziell: 8.01,
      erwartet: 8.06,
      effektiv: 8.11,
      wind: '-0.3',
      balken_verlust: 0.10,
      v_max: 10.58,
      v_3L: 10.42,
      v_2L: 10.54,
      v_1L: 10.39,
      v_abflug_hor: 8.88,
      v_verlust_hor: -1.51,
      v_vertikal: 3.28,
      geschw_bilanz: 0.0,
      s_3L: 2.22,
      s_2L: 2.45,
      s_1L: 2.39,
      entf_4L: 9.49,
      abstand_knie_2L: 0.00,
      stemmwinkel: 23,
      rumpfwinkel_abspr: 97,
      rumpfrotation: 3,
      kniewinkel_min: 145,
      abflugwinkel: 20.3,
      schwungbein_w: 862,
      landeweite: 0.51,
      lande_index: 2.0,
      landeverlust: -0.17,
      lande_rumpf: 110,
      lande_knie: 115,
      lande_huefte: 106
    },
    kassel_2023: {
      title: '🇩🇪 Luka Herden — DM Kassel (09.07.2023 • V2)',
      offiziell: 7.91,
      erwartet: 8.11,
      effektiv: 7.97,
      wind: '+0.3',
      balken_verlust: 0.06,
      v_max: 10.60,
      v_3L: 10.53,
      v_2L: 10.60,
      v_1L: 10.43,
      v_abflug_hor: 8.94,
      v_verlust_hor: -1.49,
      v_vertikal: 3.15,
      geschw_bilanz: -0.4,
      s_3L: 2.46,
      s_2L: 2.78,
      s_1L: 2.33,
      entf_4L: 10.11,
      abstand_knie_2L: -0.05,
      stemmwinkel: 26,
      rumpfwinkel_abspr: 99,
      rumpfrotation: 3,
      kniewinkel_min: 140,
      abflugwinkel: 19.4,
      schwungbein_w: 746,
      landeweite: 0.50,
      lande_index: 1.9,
      landeverlust: -0.23,
      lande_rumpf: 95,
      lande_knie: 135,
      lande_huefte: 99
    }
  };

  async function ensureDlv1080BundleLoaded() {
    if (dlv1080Bundle) return dlv1080Bundle;
    if (window.__EMBEDDED_DLV_1080_BUNDLE__) {
      dlv1080Bundle = window.__EMBEDDED_DLV_1080_BUNDLE__;
      return dlv1080Bundle;
    }
    try {
      const res = await fetch('./data/dlv_1080_bundle.json?t=' + Date.now());
      if (res.ok) {
        dlv1080Bundle = await res.json();
      }
    } catch (e) {
      console.warn('Could not load dlv_1080_bundle.json', e);
    }
    return dlv1080Bundle || { dlv_weit: [], dlv_anlauf: [], runs_1080: [] };
  }

  // ================= TAB 1: NEXT SESSION & PROGRAMM =================
  function renderTab1(state) {
    const container = document.getElementById('tabContentNext');
    if (!container) return;

    container.innerHTML = `
      <!-- 1. Coaching Briefing Banner: Worauf du diese Woche achten musst -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/50 rounded-xl p-4 shadow-lg space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">🎯</span>
            <div>
              <h2 class="text-sm sm:text-base font-black text-white uppercase tracking-wider font-mono">
                COACHING-BRIEFING & FOKUS • KW 45 (START MO 02.11.2026)
              </h2>
              <p class="text-xs text-cyan-300 font-mono">
                Block 2 (Spezialblock Halle: 1080 Sprint/Sprung + French Contrast Training + Abläufe) • Aktuelles Gewicht: ~83.2 kg
              </p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-black text-xs self-start sm:self-auto">
            🟢 Achilles L stabil (5.3% Strain • 306 Nm)
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-sans">
          <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <div class="font-mono font-black text-cyan-400 text-[11px] uppercase flex items-center gap-1.5">
              <span>⚡</span> 1. 1080 Speed-Loss & ZNS
            </div>
            <p class="text-slate-300 leading-relaxed text-[11px]">
              Deine 1080-Analyse zeigt: In Top-Sessions liegt dein Geschwindigkeitsverlust über 6 Läufe bei nur <strong>3.7%</strong> (statt 6.0%). Sobald deine Peak-Velocity am Montag um <strong>&gt; 4.5%</strong> unter deinen Tages-Bestwert fällt (z.B. von 7.35 auf &lt;7.02 m/s bei 12kg), Satz sofort beenden!
            </p>
          </div>

          <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <div class="font-mono font-black text-amber-400 text-[11px] uppercase flex items-center gap-1.5">
              <span>🏋️</span> 2. Umsetzen & FCT-Gewichte
            </div>
            <p class="text-slate-300 leading-relaxed text-[11px]">
              Donnerstag waren <strong>80 / 90 / 100 kg (5/4/2 Wdh.)</strong> stark – bei 100 kg aus dem Hang hat nur die 3. Wdh. gefehlt. Bleib diese Woche bei <strong>80 / 90 / 100 kg</strong> mit Fokus auf maximalen Zug-Speed, um die <strong>3x 100 kg</strong> souverän vollzumachen, bevor wir in KW 46 auf 102.5–105 kg gehen.
            </p>
          </div>

          <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <div class="font-mono font-black text-emerald-400 text-[11px] uppercase flex items-center gap-1.5">
              <span>⏱️</span> 3. Einordnung deiner Sprintzeiten
            </div>
            <p class="text-slate-300 leading-relaxed text-[11px]">
              Deine handgestoppten <strong>4.91s (40m) / 5.78s (50m) / 6.63s (60m)</strong> auf 1. Bewegung bei 90% entsprechen starken <strong>0.87s</strong> (40–50m) und <strong>0.85s</strong> (50–60m = 11.76 m/s Hand bzw. ~10.35 m/s real bei 90%). Genau im Korridor für November!
            </p>
          </div>

          <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <div class="font-mono font-black text-purple-400 text-[11px] uppercase flex items-center gap-1.5">
              <span>🦶</span> 4. Sprunggelenk & Hürden (76–91cm)
            </div>
            <p class="text-slate-300 leading-relaxed text-[11px]">
              Progression über <strong>76 → 84 → 91 cm</strong> lief perfekt. Achte am Montag bei den einbeinigen Fußgelenkssprüngen und im FCT Vertikal auf ultrakurze Bodenkontaktzeiten (&lt;150 ms) und aktives Greifen unter den KSP (Vorbereitung gegen zu langen vorletzten Schritt!).
            </p>
          </div>
        </div>
      </div>

      <!-- 2. Detailed Next Training Sessions (Montag & Dienstag + Wochenstruktur) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Montag Session Card -->
        <div class="bg-slate-900 border-2 border-cyan-500/60 rounded-xl p-4 shadow-md space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span class="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono font-black text-[10px] uppercase">NÄCHSTE EINHEIT • MONTAG 02.11.2026</span>
              <h3 class="text-sm font-black text-white font-mono mt-1">⚡ SPRINT / SPRUNG (1080) + FCT VERTIKAL</h3>
            </div>
            <span class="text-xs font-mono text-slate-400">⏱️ ~135 Min. • OSP Halle</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Block / Übung</th>
                  <th class="py-2 px-2">Sätze × Wdh.</th>
                  <th class="py-2 px-2">Last / Zielwert</th>
                  <th class="py-2 px-2">Pause & Technik-Fokus</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">1. Warm-up & Fußgelenkssprünge</td>
                  <td class="py-2 px-2 text-cyan-300">3×10 beidb.<br>3×10 einb. (L/R)</td>
                  <td class="py-2 px-2 text-slate-300">Körpergewicht</td>
                  <td class="py-2 px-2 text-slate-400 text-[11px]">Steifes Sprunggelenk, Ferse bleibt oben, Knie gestreckt</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-purple-300">2. 1080 Resisted Beschleunigung</td>
                  <td class="py-2 px-2 text-cyan-300">2–3 × 20–30m</td>
                  <td class="py-2 px-2 text-amber-300 font-bold">12 kg NFW / 4 kg Iso<br>(v_max &gt; 7.30 m/s)</td>
                  <td class="py-2 px-2 text-slate-400 text-[11px]">LP: 3–4 Min. • Volle Hüftstreckung, Druck horizontal in die Bahn</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-amber-300">3. 1080 Spezifische Sprungläufe (HPL / SPL / Pen1)</td>
                  <td class="py-2 px-2 text-cyan-300">2× HPL, 2× SPL,<br>2× Pen1 (25–30m)</td>
                  <td class="py-2 px-2 text-amber-300 font-bold">3–4 kg Widerstand</td>
                  <td class="py-2 px-2 text-slate-400 text-[11px]">LP: 3 Min. • Pen1: Absprung L → Landung/Vorbereitung R → direkt L!</td>
                </tr>
                <tr class="bg-emerald-950/20">
                  <td class="py-2 px-2.5 font-bold text-emerald-300">4a. FCT Vertikal — A1: Trapbar Deadlift</td>
                  <td class="py-2 px-2 text-cyan-300 font-bold">4 Sätze × 3 Wdh.</td>
                  <td class="py-2 px-2 text-emerald-300 font-black">120 – 125 kg</td>
                  <td class="py-2 px-2 text-slate-300 text-[11px]">Rücken neutral, konzentrisch maximal explosiv, ~20s Übergang zu A2</td>
                </tr>
                <tr class="bg-emerald-950/20">
                  <td class="py-2 px-2.5 font-bold text-emerald-300">4b. FCT Vertikal — A2: Hürdensprünge / Drop Jump</td>
                  <td class="py-2 px-2 text-cyan-300 font-bold">4 Sätze × 4 Sprünge</td>
                  <td class="py-2 px-2 text-emerald-300 font-bold">84 – 91 cm Hürden</td>
                  <td class="py-2 px-2 text-slate-300 text-[11px]">Reaktiv (&lt;150ms Kontakt), Knie aktiv zur Brust, ~20s zu A3</td>
                </tr>
                <tr class="bg-emerald-950/20">
                  <td class="py-2 px-2.5 font-bold text-emerald-300">4c. FCT Vertikal — A3: Kettlebell Swings / Hantelspr.</td>
                  <td class="py-2 px-2 text-cyan-300 font-bold">4 Sätze × 3–4 Wdh.</td>
                  <td class="py-2 px-2 text-emerald-300 font-bold">24 – 32 kg KB / 30kg</td>
                  <td class="py-2 px-2 text-slate-300 text-[11px]">Explosiver Hüft-Snap (Gluteus/Hamstrings), ~20s zu A4</td>
                </tr>
                <tr class="bg-emerald-950/20">
                  <td class="py-2 px-2.5 font-bold text-emerald-300">4d. FCT Vertikal — A4: Assisted Jumps (Band)</td>
                  <td class="py-2 px-2 text-cyan-300 font-bold">4 Sätze × 4 Sprünge</td>
                  <td class="py-2 px-2 text-emerald-300 font-bold">Zugunterstützt</td>
                  <td class="py-2 px-2 text-slate-300 text-[11px]">Overspeed-Reaktivität am Boden • Danach <strong>5 Min. Satzpause!</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Dienstag & Restwoche Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[10px] uppercase">VORSCHAU • DIENSTAG 03.11. & KW 45</span>
              <h3 class="text-sm font-black text-white font-mono mt-1">👟 TECHNIK / FCT HORIZONTAL & WOCHEN-FAHRPLAN</h3>
            </div>
            <span class="text-xs font-mono text-slate-400">Block 2 • Woche 2</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Tag & Schwerpunkt</th>
                  <th class="py-2 px-2">Kern-Programm</th>
                  <th class="py-2 px-2">Ziel-Gewichte / Ziel-Zeiten</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr class="bg-amber-950/15">
                  <td class="py-2 px-2.5 font-bold text-amber-300">Dienstag, 03.11.<br><span class="text-[10px] text-slate-400">Sprung / FCT Hor.</span></td>
                  <td class="py-2 px-2 text-slate-200">
                    • Kurzanlauf / Imitation (5er/7er/9er)<br>
                    • <strong>FCT Horizontal (4 Runden):</strong><br>
                      1. Hip-Thrust (3 Wdh.)<br>
                      2. Standweitsprünge / Bounds (4x)<br>
                      3. Banded Horizontal Drive (4x)<br>
                    • Wadenheben (3×6)
                  </td>
                  <td class="py-2 px-2 text-emerald-300 font-bold">
                    • Hip-Thrust: <strong>4×3 @ 120–125 kg</strong><br>
                    • Wadenheben: <strong>3×6 @ 110–120 kg</strong><br>
                    • Fokus: Aktives Greifen im vorletzten Schritt
                  </td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-slate-300">Mittwoch, 04.11.<br><span class="text-[10px] text-slate-500">Regeneration / Stabi</span></td>
                  <td class="py-2 px-2 text-slate-300">Rumpf/Turnen, Mobility, Physio / Lymphomat</td>
                  <td class="py-2 px-2 text-cyan-300">ZNS-Erholung für Donnerstag</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-purple-300">Donnerstag, 05.11.<br><span class="text-[10px] text-slate-400">Sprint + Explosivkraft</span></td>
                  <td class="py-2 px-2 text-slate-200">
                    • Hürdensprünge 3×3×6 (76–91cm)<br>
                    • Abläufe 40 / 50 / 60m (90%, LP 4', SP 5')<br>
                    • Umsetzen (Power / Hang Clean) <strong>5 / 4 / 3</strong><br>
                    • Aufsteiger (30cm Box) <strong>3×4</strong>
                  </td>
                  <td class="py-2 px-2 text-amber-300 font-bold">
                    • 40m: <strong>~4.88s</strong> | 50m: <strong>~5.75s</strong> | 60m: <strong>~6.60s</strong><br>
                    • Umsetzen: <strong>80 / 90 / 100 kg</strong> (Ziel: alle 3 Wdh. @ 100kg!)<br>
                    • Aufsteiger: <strong>85 / 90 / 92.5 kg</strong>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-cyan-300">Samstag, 07.11.<br><span class="text-[10px] text-slate-400">Speed Endurance & Hüfte</span></td>
                  <td class="py-2 px-2 text-slate-200">
                    • 2×3×80m @ 90% (LP 3', SP 8')<br>
                    • 2×150m @ 90% (LP 15')<br>
                    • Plank-Circuit + Hüftmaschine (Add/Abd/Glut/Flex)
                  </td>
                  <td class="py-2 px-2 text-cyan-300 font-bold">
                    • 80m (1. Schritt): <strong>8.65 – 8.75s</strong><br>
                    • 150m (Hallenkurve): <strong>16.3 – 16.6s</strong><br>
                    • Hüftmaschine: <strong>3×8 @ 35 / 50 / 50 kg</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 3. Sprint Target Times Matrix (1. Bewegung vs 1. Schritt) -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span class="text-purple-400">⏱️</span>
              <span>SPRINT-ZIELZEITEN MATRIX (HANDSTOPPUNG: 1. BEWEGUNG VS. 1. SCHRITT / ELEKTR.)</span>
            </h3>
            <p class="text-[11px] text-slate-400 font-mono">
              Abgeglichen mit deinen Donnerstags- (40m 4.91s, 50m 5.78s, 60m 6.63s auf 1. Bewegung) und Samstags-Zeiten (80m 8.7s auf 1. Schritt, 150m 16.4s)
            </p>
          </div>
          <span class="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold">
            Δ Stopp-Differenz: ~0.22s (1. Bew. vs. 1. Schritt) • ~0.24s (Hand vs. Lichtschranke)
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <th class="py-2 px-3">Distanz</th>
                <th class="py-2 px-2.5 text-center">Stopp-Modus</th>
                <th class="py-2 px-2.5 text-center text-slate-300">85% (Locker / Ext.)</th>
                <th class="py-2 px-2.5 text-center bg-cyan-950/40 text-cyan-300 border-x border-cyan-800/50">90% (Aktuell Soll)</th>
                <th class="py-2 px-2.5 text-center text-amber-300">95% (Sub-Max UWV)</th>
                <th class="py-2 px-2.5 text-center text-emerald-300">100% (Peak / Ziel)</th>
                <th class="py-2 px-3">Dein Ist-Wert (KW 44) & Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr>
                <td class="py-2 px-3 font-bold text-white">30m Ablauf</td>
                <td class="py-2 px-2.5 text-center text-slate-400">1. Bewegung (Hand)<br><span class="text-[10px] text-cyan-400">Elektr. Äquiv.</span></td>
                <td class="py-2 px-2.5 text-center">4.15 s<br><span class="text-[10px] text-slate-500">4.39 s</span></td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">3.90 – 3.95 s<br><span class="text-[10px] text-cyan-400">4.14 – 4.19 s</span></td>
                <td class="py-2 px-2.5 text-center text-amber-300">3.72 s<br><span class="text-[10px] text-slate-500">3.96 s</span></td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">3.58 – 3.63 s<br><span class="text-[10px] text-emerald-400">≤ 3.87 s (Ziel!)</span></td>
                <td class="py-2 px-3 text-emerald-300">Im 40m-Durchgang ~3.92s (Hand) ✅ Voll im Soll</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-bold text-white">40m Ablauf</td>
                <td class="py-2 px-2.5 text-center text-slate-400">1. Bewegung (Hand)</td>
                <td class="py-2 px-2.5 text-center">5.18 s</td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">4.88 – 4.95 s</td>
                <td class="py-2 px-2.5 text-center text-amber-300">4.65 s</td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">4.48 s (≤4.75s el.)</td>
                <td class="py-2 px-3 text-emerald-300 font-bold">29.10.: 4.91 s ✅ Punktlandung</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-bold text-white">50m Ablauf</td>
                <td class="py-2 px-2.5 text-center text-slate-400">1. Bewegung (Hand)</td>
                <td class="py-2 px-2.5 text-center">6.10 s</td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">5.75 – 5.85 s</td>
                <td class="py-2 px-2.5 text-center text-amber-300">5.50 s</td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">5.30 s</td>
                <td class="py-2 px-3 text-emerald-300 font-bold">29.10.: 5.78 s (Split 40-50m: 0.87s!) ✅ Stark</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-bold text-white">60m Ablauf</td>
                <td class="py-2 px-2.5 text-center text-slate-400">1. Bewegung (Hand)</td>
                <td class="py-2 px-2.5 text-center">7.02 s</td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">6.60 – 6.72 s</td>
                <td class="py-2 px-2.5 text-center text-amber-300">6.35 s</td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">6.12 s (6.76s WK)</td>
                <td class="py-2 px-3 text-emerald-300 font-bold">29.10.: 6.63 s (Split 50-60m: 0.85s!) ✅ Top-Speed</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-bold text-white">80m Tempolauf</td>
                <td class="py-2 px-2.5 text-center text-cyan-300">1. Schritt (Michael)</td>
                <td class="py-2 px-2.5 text-center">9.20 s</td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">8.65 – 8.80 s</td>
                <td class="py-2 px-2.5 text-center text-amber-300">8.25 s</td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">7.90 s</td>
                <td class="py-2 px-3 text-emerald-300 font-bold">31.10.: 8.70 s (2×2×80m) ✅ Exakt bei 90%</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-bold text-white">150m Hallenkurve</td>
                <td class="py-2 px-2.5 text-center text-cyan-300">1. Schritt (Halle)</td>
                <td class="py-2 px-2.5 text-center">17.40 s</td>
                <td class="py-2 px-2.5 text-center bg-cyan-950/20 font-bold text-cyan-300">16.30 – 16.70 s</td>
                <td class="py-2 px-2.5 text-center text-amber-300">15.60 s</td>
                <td class="py-2 px-2.5 text-center font-bold text-emerald-300">14.95 s (Freiluft)</td>
                <td class="py-2 px-3 text-emerald-300 font-bold">31.10.: 16.4s & 16.7s ✅ Stark trotz enger Kurve</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Kraft-Progressions-Tabelle (KW 44–47) + WIEDERHOLUNGS-PERIODISIERUNGS-MATRIX (Block 1 -> Wettkampfphase) -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <!-- 4A: Gewichts-Progression KW 44-47 -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
          <div class="pb-2 border-b border-slate-800">
            <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span class="text-emerald-400">🏋️</span>
              <span>KRAFT-GEWICHTS-PROGRESSION (BLOCK 2: KW 44 – KW 47)</span>
            </h3>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">
              Zielgewichte je Woche inkl. All-Time PB & Saison-Zielwert
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Übung</th>
                  <th class="py-2 px-2 text-center">KW 44 (Ist)</th>
                  <th class="py-2 px-2 text-center bg-cyan-950/40 text-cyan-300 border-x border-cyan-800/50">KW 45 (Jetzt)</th>
                  <th class="py-2 px-2 text-center">KW 46</th>
                  <th class="py-2 px-2 text-center">KW 47 (Peak B2)</th>
                  <th class="py-2 px-2 text-right text-amber-300">PB / Ziel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Umsetzen (Power/Hang)</td>
                  <td class="py-2 px-2 text-center text-slate-300">80/90/100<br><span class="text-[9px] text-amber-300">(5/4/2 Wdh.)</span></td>
                  <td class="py-2 px-2 text-center bg-cyan-950/20 font-black text-cyan-300">80 / 90 / 100 kg<br><span class="text-[9px] text-emerald-300">(Ziel: 5/4/3 voll!)</span></td>
                  <td class="py-2 px-2 text-center text-slate-200">85 / 95 / 102.5 kg</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">85 / 95 / 105 kg</td>
                  <td class="py-2 px-2 text-right text-amber-300">PB: 120 kg<br><span class="text-[9px] text-slate-400">Ziel: 140 kg</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">FCT Trapbar Deadlift</td>
                  <td class="py-2 px-2 text-center text-slate-300">4×3 @ 120 kg</td>
                  <td class="py-2 px-2 text-center bg-cyan-950/20 font-black text-cyan-300">4×3 @ 120–125 kg</td>
                  <td class="py-2 px-2 text-center text-slate-200">4×3 @ 125–130 kg</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">4×3 @ 135 kg</td>
                  <td class="py-2 px-2 text-right text-amber-300">PB: 3×140 kg<br><span class="text-[9px] text-slate-400">(154kg e1RM)</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">FCT Hip-Thrust</td>
                  <td class="py-2 px-2 text-center text-slate-300">4×3 @ 120 kg</td>
                  <td class="py-2 px-2 text-center bg-cyan-950/20 font-black text-cyan-300">4×3 @ 120–125 kg</td>
                  <td class="py-2 px-2 text-center text-slate-200">4×3 @ 130 kg</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">4×3 @ 135 kg</td>
                  <td class="py-2 px-2 text-right text-amber-300">PB: 144 kg<br><span class="text-[9px] text-slate-400">e1RM</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Aufsteiger (30cm Box)</td>
                  <td class="py-2 px-2 text-center text-slate-300">80 / 85 / 90 kg<br><span class="text-[9px] text-slate-400">(3×4 je Bein)</span></td>
                  <td class="py-2 px-2 text-center bg-cyan-950/20 font-black text-cyan-300">85 / 90 / 92.5 kg<br><span class="text-[9px] text-cyan-400">(3×4 explosiv!)</span></td>
                  <td class="py-2 px-2 text-center text-slate-200">85 / 90 / 95 kg</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">90 / 95 / 100 kg</td>
                  <td class="py-2 px-2 text-right text-amber-300">PB: 110 kg<br><span class="text-[9px] text-slate-400">(124kg e1RM)</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Hüftmaschine (Add/Abd/Glut/Flex)</td>
                  <td class="py-2 px-2 text-center text-slate-300">Add/Abd: 30/30/35<br>Glut: 30/50/50<br>Flex: 40/40/50</td>
                  <td class="py-2 px-2 text-center bg-cyan-950/20 font-black text-cyan-300">Add/Abd: 35/35/40<br>Glut: 40/50/55<br>Flex: 45/45/50</td>
                  <td class="py-2 px-2 text-center text-slate-200">3×8 @ +2.5–5 kg</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">3×6 @ Peak</td>
                  <td class="py-2 px-2 text-right text-amber-300">Becken-Stabi<br><span class="text-[9px] text-slate-400">Sprint/Absprung</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4B: NEU — Wiederholungs-Periodisierungs-Matrix (Block 1 -> Block 2 -> Block 3 -> Wettkampf) -->
        <div class="bg-slate-900 border-2 border-amber-500/40 rounded-xl p-4 shadow-md space-y-3">
          <div class="pb-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <span class="text-amber-400">📉</span>
                <span>WIEDERHOLUNGS-MATRIX (REPS-REDUKTION RICHTUNG WETTKAMPFPHASE)</span>
              </h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">
                Systematische Reduktion des Volumens bei steigender Hantelgeschwindigkeit & Intensität (Block 1 ➔ Wettkampf)
              </p>
            </div>
            <span class="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-mono font-bold">
              Aktuell: Block 2 (Spezial / FCT)
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Übung / Komplex</th>
                  <th class="py-2 px-2 text-center text-slate-400">Block 1: Aufbau (GPP)<br><span class="text-[9px]">Sept – Okt</span></th>
                  <th class="py-2 px-2 text-center bg-amber-950/40 text-amber-300 border-x border-amber-700/60">Block 2: Spezial / FCT<br><span class="text-[9px]">Nov – Anfang Dez (Jetzt)</span></th>
                  <th class="py-2 px-2 text-center text-cyan-300">Block 3: UWV / Pre-Comp<br><span class="text-[9px]">Dez – Mitte Jan</span></th>
                  <th class="py-2 px-2 text-center text-emerald-300">Block 4: Wettkampf-Peak<br><span class="text-[9px]">Ende Jan – März (Halle)</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Trapbar / Kniebeuge</td>
                  <td class="py-2 px-2 text-center text-slate-400">3–4 × <strong>6–8 Wdh.</strong><br><span class="text-[9px]">(Hypertrophie/Basis)</span></td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300">4 × <strong>3 Wdh.</strong> (im FCT)<br><span class="text-[9px]">(~80–85% • schwer)</span></td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold">3–4 × <strong>2–3 Wdh.</strong><br><span class="text-[9px]">(~85–90% • max RFD)</span></td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">2–3 × <strong>1–2 Wdh.</strong><br><span class="text-[9px]">(Tonisierung ~90%)</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Hip-Thrust (Horizontalkraft)</td>
                  <td class="py-2 px-2 text-center text-slate-400">3–4 × <strong>6–8 Wdh.</strong></td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300">4 × <strong>3 Wdh.</strong> (im FCT)</td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold">3–4 × <strong>2–3 Wdh.</strong></td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">2 × <strong>2 Wdh.</strong> (Explosiv)</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Umsetzen (Power / Hang Clean)</td>
                  <td class="py-2 px-2 text-center text-slate-400">4 × <strong>5 Wdh.</strong><br><span class="text-[9px]">oder 5 / 5 / 4</span></td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300"><strong>5 / 4 / 3 Wdh.</strong><br><span class="text-[9px]">(Pyramide 80/90/100kg)</span></td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold"><strong>4 / 3 / 2 Wdh.</strong><br><span class="text-[9px]">(oder 3 / 2 / 1 @ 90–115kg)</span></td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold"><strong>3 / 2 / 1</strong> oder <strong>3×2</strong><br><span class="text-[9px]">(@ 85–92% • Max-Speed!)</span></td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Aufsteiger (Step-Ups 30cm)</td>
                  <td class="py-2 px-2 text-center text-slate-400">3 × <strong>6 Wdh.</strong> je Bein</td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300">3 × <strong>4 Wdh.</strong> je Bein</td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold">3 × <strong>3 Wdh.</strong> je Bein</td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">2 × <strong>2–3 Wdh.</strong> (Spezifisch)</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Wadenheben & Hüftmaschine</td>
                  <td class="py-2 px-2 text-center text-slate-400">3 × <strong>8–10 Wdh.</strong></td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300">Waden <strong>3×6</strong> • Hüfte <strong>3×8</strong></td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold">Waden <strong>3×4–5</strong> • Hüfte <strong>3×6</strong></td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">2 × <strong>4 Wdh.</strong> (Sehnen-Tonus)</td>
                </tr>
                <tr>
                  <td class="py-2 px-2.5 font-bold text-white">Hürdensprünge / Plyos (Reaktiv)</td>
                  <td class="py-2 px-2 text-center text-slate-400">3×4×6 (72 Kontakte)<br><span class="text-[9px]">Niedrige Hürden</span></td>
                  <td class="py-2 px-2 text-center bg-amber-950/20 font-black text-amber-300">3×3×6 (54) bzw. FCT 4×4<br><span class="text-[9px]">(76 → 84 → 91 cm)</span></td>
                  <td class="py-2 px-2 text-center text-cyan-300 font-bold">3×2×5 (30 Kontakte)<br><span class="text-[9px]">Maximale Höhe & Reaktivität</span></td>
                  <td class="py-2 px-2 text-center text-emerald-300 font-bold">2×4–5 (8–10 Kontakte)<br><span class="text-[9px]">ZNS-Aktivierung vor WK</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ================= TAB 2 EXTENSION: SEASON-BASED TESTING STANDARDS & UNIVERSAL EXPLORER & DLV/1080 =================
  async function renderTab2Extensions(state) {
    const container = document.getElementById('tab2CustomExtensionsContainer');
    if (!container) return;

    await ensureDlv1080BundleLoaded();

    container.innerHTML = `
      <!-- A. SEASON-BASED TESTING STANDARDS (Halbjahres-Saison mit ≈ Annäherungen & ausgegrauten PBs) -->
      <div id="seasonStandardsCard" class="bg-slate-900 border-2 border-cyan-500/40 rounded-xl p-4 shadow-lg space-y-3.5">
        ${renderSeasonStandardsInnerHtml()}
      </div>

      <!-- B. UNIVERSAL PARAMETER GRAPH & HEATMAP EXPLORER (Für JEDEN Journal- & Diagnostik-Eintrag) -->
      <div id="universalExplorerCard" class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3.5">
        ${renderUniversalExplorerInnerHtml(state)}
      </div>

      <!-- C. DLV BIOMECHANIK: SIMON EHAMMER (8.30m / 8.40m eff.) VS. LUKA HERDEN + 68 DLV PDFs & 87x 1080 SPRINTS -->
      <div id="dlvAnd1080MasterCard" class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3.5">
        ${renderDlvAnd1080InnerHtml()}
      </div>
    `;

    renderUniversalChartAndHeatmap(state);
  }

  function setSeasonStandardKey(key) {
    activeSeasonKey = key;
    const card = document.getElementById('seasonStandardsCard');
    if (card) {
      card.innerHTML = renderSeasonStandardsInnerHtml();
    }
  }

  function renderSeasonStandardsInnerHtml() {
    const cfg = SEMI_ANNUAL_SEASONS[activeSeasonKey] || SEMI_ANNUAL_SEASONS['winter_26_27'];
    const rows = SEASON_STANDARDS_DATA[activeSeasonKey] || SEASON_STANDARDS_DATA['winter_26_27'];

    return `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-lg">🎯</span>
            <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono">
              DIAGNOSTIK-ZIELPARAMETER (DEINE 4 BEREICHE) • BEZOGEN AUF DIE AKTUELLE HALBJAHRES-SAISON
            </h3>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              Halle: Sept–März | Sommer: Ende März–Sept
            </span>
          </div>
          <p class="text-[11px] text-slate-400 font-sans mt-0.5">
            ${cfg.note}
          </p>
        </div>

        <!-- Semi-Annual Season Selector -->
        <div class="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
          ${Object.entries(SEMI_ANNUAL_SEASONS).map(([k, s]) => `
            <button onclick="NextSessionModule.setSeasonStandardKey('${k}')" class="px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeSeasonKey === k
                ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }">
              ${s.shortLabel}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Legend for Measured vs Approximation vs Grayed-out PB -->
      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
        <div class="flex flex-wrap items-center gap-4">
          <span class="flex items-center gap-1.5 text-emerald-300 font-bold">
            <span class="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
            ✅ Direkt gemessen (in gewählter Saison)
          </span>
          <span class="flex items-center gap-1.5 text-amber-300 font-bold">
            <span class="w-3 h-3 rounded-sm bg-amber-500/80 border border-dashed border-amber-300 inline-block"></span>
            ≈ Annäherung / Est. (aus Handstoppung / 1080 / Alternativübung der Saison)
          </span>
          <span class="flex items-center gap-1.5 text-slate-500">
            <span class="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700 inline-block"></span>
            Ausgegraut = All-Time PB (Historische Referenz)
          </span>
        </div>
        <span class="text-[10px] text-rose-300 font-bold">
          ⚠️ Event Rehearsal = 12 Schritte (Ziel ≥ 7.50m) ≠ 19 Schritte WK (PB 8.18m)!
        </span>
      </div>

      <!-- 9 Parameters Progress Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${rows.map(r => {
          const barColor = r.isApprox
            ? 'bg-gradient-to-r from-amber-600/80 to-amber-400/80'
            : (r.pct >= 98 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-cyan-600 to-cyan-400');
          const borderStyle = r.isApprox ? 'border-amber-500/40' : 'border-slate-800';
          return `
            <div class="bg-slate-950 border ${borderStyle} rounded-xl p-3 space-y-2 flex flex-col justify-between">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] font-mono">
                  <span class="text-slate-400 uppercase font-bold">${r.category}</span>
                  <span class="px-1.5 py-0.2 rounded font-bold ${
                    r.isApprox
                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }">
                    ${r.isApprox ? '≈ Annäherung (Est.)' : '✅ Saison-Messwert'}
                  </span>
                </div>
                <div class="text-xs font-black text-white font-mono">${r.name}</div>
                <div class="flex items-baseline justify-between pt-0.5 font-mono">
                  <div>
                    <span class="text-base font-black ${r.isApprox ? 'text-amber-300' : 'text-cyan-300'}">
                      ${r.isApprox ? '≈ ' : ''}${r.val} ${r.unit}
                    </span>
                    <span class="text-[10px] text-slate-400 ml-1">
                      / Ziel: <strong class="text-white">${r.lowerIsBetter ? '≤' : '≥'} ${r.target} ${r.unit}</strong>
                    </span>
                  </div>
                  <span class="text-xs font-black ${r.pct >= 98 ? 'text-emerald-400' : 'text-cyan-400'}">${r.pct}%</span>
                </div>
              </div>

              <!-- Progress Bar + Grayed-out PB Background Marker -->
              <div class="space-y-1.5 pt-1">
                <div class="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                  <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width: ${Math.min(100, r.pct)}%"></div>
                </div>
                <div class="text-[10px] font-mono text-slate-300 leading-tight">
                  ${r.sourceBadge}
                </div>
                <!-- Grayed-out All-Time PB -->
                <div class="text-[10px] font-mono text-slate-500 bg-slate-900/60 border border-slate-800/80 rounded px-2 py-0.5 flex items-center justify-between opacity-75">
                  <span>🏛️ Historisch (ausgegraut):</span>
                  <span class="font-bold text-slate-400">${r.pbDisplay}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ================= B. UNIVERSAL PARAMETER GRAPH & HEATMAP EXPLORER =================
  function getAllUniversalOptions(state) {
    const logs = (state && state.trainingLogs) || [];
    const suppSet = new Set();
    const regenSet = new Set();
    const sleepSet = new Set();
    const socialSet = new Set();
    const probSet = new Set();

    logs.forEach(l => {
      const addTokens = (str, set) => {
        if (!str) return;
        str.split(/[,;+•]/).forEach(t => {
          const c = t.trim();
          if (c && c.length > 1 && c.length < 35) set.add(c);
        });
      };
      addTokens(l.supplements, suppSet);
      addTokens(l.regeneration, regenSet);
      addTokens(l.schlaf_notiz, sleepSet);
      addTokens(l.sozial, socialSet);
      addTokens(l.schmerzbereiche, probSet);
      addTokens(l.probleme, probSet);
    });

    return {
      supps: Array.from(suppSet).sort(),
      regens: Array.from(regenSet).sort(),
      sleeps: Array.from(sleepSet).sort(),
      socials: Array.from(socialSet).sort(),
      probs: Array.from(probSet).sort()
    };
  }

  function renderUniversalExplorerInnerHtml(state) {
    const opts = getAllUniversalOptions(state);
    const tfButtons = [
      { id: '1W', label: '1W' },
      { id: '1M', label: '1M' },
      { id: '3M', label: '3M' },
      { id: '6M', label: '6M' },
      { id: 'SAISON', label: '🔥 Aktuelle Saison' },
      { id: '1Y', label: '1J' },
      { id: '3Y', label: '3J' },
      { id: '5Y', label: '5J' },
      { id: 'ALL', label: 'Max' }
    ];

    return `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <span class="text-cyan-400">📈</span>
            <span>UNIVERSAL-GRAPH & KALENDER-HEATMAP (JEDER JOURNAL-, WHOOP- & DIAGNOSTIK-PARAMETER)</span>
          </h3>
          <p class="text-[11px] text-slate-400 font-mono mt-0.5">
            Wähle jeden beliebigen Eintrag aus deiner Datenbank (Whoop, Gewicht, Ernährung, Supplements, Regeneration, Schlaf, Sozial, Probleme, Kraft, Sprint, DLV) und passe den Zeitrahmen flexibel an
          </p>
        </div>

        <!-- Timeframe Selector -->
        <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-mono flex-wrap">
          <span class="text-slate-500 px-1 font-bold">Zeitraum:</span>
          ${tfButtons.map(b => `
            <button onclick="NextSessionModule.setUniTimeframe('${b.id}')" class="px-2 py-0.5 rounded font-bold transition-all ${
              uniTimeframe === b.id ? 'bg-cyan-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
            }">
              ${b.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Parameter Dropdown & View Mode Selector -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center font-mono text-xs">
        <div class="md:col-span-8">
          <label class="text-[10px] text-cyan-400 font-bold uppercase block mb-1">Parameter aus Datenbank / Journal / Diagnostik wählen:</label>
          <select id="uniParamSelect" onchange="NextSessionModule.setUniParam(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500">
            <optgroup label="⚡ Whoop, Körpergewicht & Ernährung (Metrisch)">
              <option value="whoop_recovery_pct" ${uniParamKey === 'whoop_recovery_pct' ? 'selected' : ''}>⚡ Whoop Recovery Score (%)</option>
              <option value="sleep_performance_pct" ${uniParamKey === 'sleep_performance_pct' ? 'selected' : ''}>💤 Whoop Sleep Performance (%)</option>
              <option value="whoop_strain" ${uniParamKey === 'whoop_strain' ? 'selected' : ''}>🔥 Whoop Day Strain (0–21)</option>
              <option value="body_weight_kg" ${uniParamKey === 'body_weight_kg' ? 'selected' : ''}>⚖️ Körpergewicht gemessen (kg)</option>
              <option value="body_fat_pct" ${uniParamKey === 'body_fat_pct' ? 'selected' : ''}>📉 Körperfett (%)</option>
              <option value="calories_kcal" ${uniParamKey === 'calories_kcal' ? 'selected' : ''}>🥗 Kalorien (kcal)</option>
              <option value="protein_g" ${uniParamKey === 'protein_g' ? 'selected' : ''}>🥩 Protein (g)</option>
              <option value="carbs_g" ${uniParamKey === 'carbs_g' ? 'selected' : ''}>🍚 Kohlenhydrate (g)</option>
              <option value="fat_g" ${uniParamKey === 'fat_g' ? 'selected' : ''}>🥑 Fett (g)</option>
              <option value="duration_min" ${uniParamKey === 'duration_min' ? 'selected' : ''}>⏱️ Trainingsdauer (Minuten)</option>
            </optgroup>
            <optgroup label="📊 Subjektive Trainings-Scores (Skala 1–4)">
              <option value="performance_score" ${uniParamKey === 'performance_score' ? 'selected' : ''}>⭐ Leistungs-Score (1–4)</option>
              <option value="focus_score" ${uniParamKey === 'focus_score' ? 'selected' : ''}>🎯 Fokus-Score (1–4)</option>
              <option value="pain_score" ${uniParamKey === 'pain_score' ? 'selected' : ''}>⚠️ Schmerz-Score (1–4)</option>
              <option value="fatigue_score" ${uniParamKey === 'fatigue_score' ? 'selected' : ''}>🔋 Erschöpfungs-Score (1–4)</option>
            </optgroup>
            <optgroup label="🏋️ Kraftwerte (e1RM in kg) & Diagnostik / Biomechanik">
              <option value="trapbar_e1rm_kg" ${uniParamKey === 'trapbar_e1rm_kg' ? 'selected' : ''}>🏋️ Trapbar Deadlift e1RM (kg)</option>
              <option value="umsetzen_e1rm_kg" ${uniParamKey === 'umsetzen_e1rm_kg' ? 'selected' : ''}>🏋️ Umsetzen (Power Clean) e1RM (kg)</option>
              <option value="hipthrust_e1rm_kg" ${uniParamKey === 'hipthrust_e1rm_kg' ? 'selected' : ''}>🏋️ Hip-Thrust e1RM (kg)</option>
              <option value="aufsteiger_e1rm_kg" ${uniParamKey === 'aufsteiger_e1rm_kg' ? 'selected' : ''}>🏋️ Aufsteiger e1RM (kg)</option>
              <option value="best_mark_m" ${uniParamKey === 'best_mark_m' ? 'selected' : ''}>👟 Weitsprung Wettkampf-Weite (m)</option>
              <option value="eff_mark_m" ${uniParamKey === 'eff_mark_m' ? 'selected' : ''}>📐 Weitsprung Effektive Weite DLV (m)</option>
              <option value="approach_speed_11m_to_1m" ${uniParamKey === 'approach_speed_11m_to_1m' ? 'selected' : ''}>⚡ Vmax Weitsprung-Anlauf (m/s)</option>
              <option value="sprint_speed" ${uniParamKey === 'sprint_speed' ? 'selected' : ''}>⚡ Vmax Sprint (m/s)</option>
              <option value="sprint_30m_fliegend" ${uniParamKey === 'sprint_30m_fliegend' ? 'selected' : ''}>⏱️ 30m fliegend (s)</option>
              <option value="sprint_60m_wk" ${uniParamKey === 'sprint_60m_wk' ? 'selected' : ''}>⏱️ 60m Wettkampf (s)</option>
              <option value="sprint_100m_wk" ${uniParamKey === 'sprint_100m_wk' ? 'selected' : ''}>⏱️ 100m Wettkampf (s)</option>
              <option value="cmj_mit_armen" ${uniParamKey === 'cmj_mit_armen' ? 'selected' : ''}>🦘 CMJ mit Armen (cm)</option>
              <option value="cmj_ohne_arme" ${uniParamKey === 'cmj_ohne_arme' ? 'selected' : ''}>🦘 CMJ ohne Arme (cm)</option>
              <option value="rsi_score" ${uniParamKey === 'rsi_score' ? 'selected' : ''}>⚡ DJ50 Reaktivität (W/kg)</option>
              <option value="dj50_stütz" ${uniParamKey === 'dj50_stütz' ? 'selected' : ''}>⏱️ DJ50 Stützzeit (ms/s)</option>
              <option value="achilles_l_kraft" ${uniParamKey === 'achilles_l_kraft' ? 'selected' : ''}>🦶 Achilles Links Kraft (Nm)</option>
              <option value="achilles_r_kraft" ${uniParamKey === 'achilles_r_kraft' ? 'selected' : ''}>🦶 Achilles Rechts Kraft (Nm)</option>
              <option value="achilles_l_strain" ${uniParamKey === 'achilles_l_strain' ? 'selected' : ''}>🦶 Achilles Links Strain (%)</option>
              <option value="entfernung_4l" ${uniParamKey === 'entfernung_4l' ? 'selected' : ''}>📏 DLV Entfernung 4L (m)</option>
              <option value="v_vertikal" ${uniParamKey === 'v_vertikal' ? 'selected' : ''}>🚀 DLV V-Vertikal Absprung (m/s)</option>
            </optgroup>
            <optgroup label="💊 Supplements (Journal-Einträge 0/1)">
              ${opts.supps.map(s => `<option value="tag_supp_${s}" ${uniParamKey === 'tag_supp_' + s ? 'selected' : ''}>💊 Supplement: ${s}</option>`).join('')}
            </optgroup>
            <optgroup label="🧊 Regenerationsmaßnahmen (Journal-Einträge 0/1)">
              ${opts.regens.map(s => `<option value="tag_regen_${s}" ${uniParamKey === 'tag_regen_' + s ? 'selected' : ''}>🧊 Regeneration: ${s}</option>`).join('')}
            </optgroup>
            <optgroup label="💤 Schlaf-Faktoren (Journal-Einträge 0/1)">
              ${opts.sleeps.map(s => `<option value="tag_sleep_${s}" ${uniParamKey === 'tag_sleep_' + s ? 'selected' : ''}>💤 Schlaf: ${s}</option>`).join('')}
            </optgroup>
            <optgroup label="👥 Soziale Faktoren (Journal-Einträge 0/1)">
              ${opts.socials.map(s => `<option value="tag_social_${s}" ${uniParamKey === 'tag_social_' + s ? 'selected' : ''}>👥 Sozial: ${s}</option>`).join('')}
            </optgroup>
            <optgroup label="⚠️ Probleme & Schmerzbereiche (Journal-Einträge 0/1)">
              ${opts.probs.map(s => `<option value="tag_prob_${s}" ${uniParamKey === 'tag_prob_' + s ? 'selected' : ''}>⚠️ Problem/Schmerz: ${s}</option>`).join('')}
            </optgroup>
          </select>
        </div>

        <div class="md:col-span-4 flex flex-col justify-end">
          <span class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Darstellung:</span>
          <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button onclick="NextSessionModule.setUniViewMode('both')" class="flex-1 py-1 rounded text-[11px] font-bold transition-all ${uniViewMode === 'both' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">📈 Graph + 🗓️ Heatmap</button>
            <button onclick="NextSessionModule.setUniViewMode('chart')" class="flex-1 py-1 rounded text-[11px] font-bold transition-all ${uniViewMode === 'chart' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">Nur Graph</button>
            <button onclick="NextSessionModule.setUniViewMode('heatmap')" class="flex-1 py-1 rounded text-[11px] font-bold transition-all ${uniViewMode === 'heatmap' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">Nur Heatmap</button>
          </div>
        </div>
      </div>

      <!-- Summary KPI Strip for Selected Parameter -->
      <div id="uniSummaryKpiRow" class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs"></div>

      <!-- Universal Chart Canvas -->
      <div id="uniChartWrapper" class="${uniViewMode === 'heatmap' ? 'hidden' : ''} h-64 sm:h-72 w-full pt-1">
        <canvas id="uniExplorerChartCanvas"></canvas>
      </div>

      <!-- Universal Heatmap Grid -->
      <div id="uniHeatmapWrapper" class="${uniViewMode === 'chart' ? 'hidden' : ''} bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto">
        <div id="uniExplorerHeatmapContainer" class="min-w-[580px]"></div>
      </div>
    `;
  }

  function setUniTimeframe(tf) {
    uniTimeframe = tf;
    const state = (window.App && window.App.state) || {};
    const card = document.getElementById('universalExplorerCard');
    if (card) {
      card.innerHTML = renderUniversalExplorerInnerHtml(state);
      renderUniversalChartAndHeatmap(state);
    }
  }

  function setUniParam(param) {
    uniParamKey = param;
    const state = (window.App && window.App.state) || {};
    renderUniversalChartAndHeatmap(state);
  }

  function setUniViewMode(mode) {
    uniViewMode = mode;
    const state = (window.App && window.App.state) || {};
    const card = document.getElementById('universalExplorerCard');
    if (card) {
      card.innerHTML = renderUniversalExplorerInnerHtml(state);
      renderUniversalChartAndHeatmap(state);
    }
  }

  function filterLogsByTimeframe(logs, tf) {
    if (!logs || !logs.length) return [];
    const latestDateStr = logs[logs.length - 1].date || '2026-11-01';
    const refDate = new Date(latestDateStr + 'T12:00:00');
    if (tf === 'SAISON') {
      // Current semi-annual season: starts Sept 1, 2026
      return logs.filter(l => l.date >= '2026-09-01');
    }
    const dayMap = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825, 'ALL': 99999 };
    const days = dayMap[tf] || 99999;
    if (days >= 99999) return logs;
    const minT = refDate.getTime() - days * 86400000;
    return logs.filter(l => {
      const t = new Date((l.date || '') + 'T12:00:00').getTime();
      return !isNaN(t) && t >= minT;
    });
  }

  function extractUniValue(log, key) {
    if (!log || !key) return null;
    if (key.startsWith('tag_supp_')) {
      const tok = key.slice(9).toLowerCase();
      return (log.supplements || '').toLowerCase().includes(tok) ? 1 : 0;
    }
    if (key.startsWith('tag_regen_')) {
      const tok = key.slice(10).toLowerCase();
      return (log.regeneration || '').toLowerCase().includes(tok) ? 1 : 0;
    }
    if (key.startsWith('tag_sleep_')) {
      const tok = key.slice(10).toLowerCase();
      return (log.schlaf_notiz || '').toLowerCase().includes(tok) ? 1 : 0;
    }
    if (key.startsWith('tag_social_')) {
      const tok = key.slice(11).toLowerCase();
      return (log.sozial || '').toLowerCase().includes(tok) ? 1 : 0;
    }
    if (key.startsWith('tag_prob_')) {
      const tok = key.slice(9).toLowerCase();
      const combined = `${log.schmerzbereiche || ''} ${log.probleme || ''}`.toLowerCase();
      return combined.includes(tok) ? 1 : 0;
    }
    const v = log[key];
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function renderUniversalChartAndHeatmap(state) {
    const logs = (state && state.trainingLogs) || [];
    const tfLogs = filterLogsByTimeframe(logs, uniTimeframe);
    const isBinaryTag = uniParamKey.startsWith('tag_');

    const points = [];
    tfLogs.forEach(l => {
      const v = extractUniValue(l, uniParamKey);
      if (isBinaryTag) {
        points.push({ date: l.date, val: v, rec: l.whoop_recovery_pct, session: l.session_type });
      } else if (v !== null && !isNaN(v)) {
        points.push({ date: l.date, val: v, rec: l.whoop_recovery_pct, session: l.session_type });
      }
    });

    // Update KPI row
    const kpiRow = document.getElementById('uniSummaryKpiRow');
    if (kpiRow) {
      if (isBinaryTag) {
        const activePts = points.filter(p => p.val === 1);
        const inactivePts = points.filter(p => p.val === 0);
        const recWith = activePts.map(p => p.rec).filter(r => r != null);
        const recWithout = inactivePts.map(p => p.rec).filter(r => r != null);
        const avgWith = recWith.length ? (recWith.reduce((a, b) => a + b, 0) / recWith.length).toFixed(1) : '-';
        const avgWithout = recWithout.length ? (recWithout.reduce((a, b) => a + b, 0) / recWithout.length).toFixed(1) : '-';
        const pctActive = points.length ? ((activePts.length / points.length) * 100).toFixed(1) : '0.0';
        kpiRow.innerHTML = `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Einträge im Zeitraum</span>
            <span class="text-sm font-black text-cyan-400">${activePts.length}x / ${points.length} Tage (${pctActive}%)</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Ø Recovery (Mit Faktor)</span>
            <span class="text-sm font-black text-emerald-400">${avgWith}%</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Ø Recovery (Ohne Faktor)</span>
            <span class="text-sm font-black text-slate-300">${avgWithout}%</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Zuletzt dokumentiert</span>
            <span class="text-sm font-black text-amber-300">${activePts.length ? activePts[activePts.length - 1].date : 'Keine'}</span>
          </div>
        `;
      } else {
        const vals = points.map(p => p.val);
        const latest = vals.length ? vals[vals.length - 1] : '-';
        const minV = vals.length ? Math.min(...vals).toFixed(2) : '-';
        const maxV = vals.length ? Math.max(...vals).toFixed(2) : '-';
        const avgV = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '-';
        kpiRow.innerHTML = `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Messwerte (${uniTimeframe})</span>
            <span class="text-sm font-black text-cyan-400">${vals.length} Einträge</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Aktuellster Wert</span>
            <span class="text-sm font-black text-emerald-400">${latest}</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Ø Durchschnitt</span>
            <span class="text-sm font-black text-amber-300">${avgV}</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <span class="text-[9px] text-slate-400 uppercase block">Min / Peak im Zeitraum</span>
            <span class="text-sm font-black text-white">${minV} / ${maxV}</span>
          </div>
        `;
      }
    }

    // Render Chart.js Canvas
    const canvas = document.getElementById('uniExplorerChartCanvas');
    if (canvas && uniViewMode !== 'heatmap') {
      if (uniChartInstance) uniChartInstance.destroy();
      const selectEl = document.getElementById('uniParamSelect');
      const labelText = selectEl && selectEl.options[selectEl.selectedIndex] ? selectEl.options[selectEl.selectedIndex].text : uniParamKey;

      uniChartInstance = new Chart(canvas.getContext('2d'), {
        type: isBinaryTag ? 'bar' : 'line',
        data: {
          labels: points.map(p => p.date),
          datasets: [{
            label: labelText,
            data: points.map(p => p.val),
            borderColor: '#06b6d4',
            backgroundColor: isBinaryTag ? 'rgba(16, 185, 129, 0.7)' : 'rgba(6, 182, 212, 0.15)',
            borderWidth: 2,
            pointRadius: points.length > 60 ? 1.5 : 3.5,
            fill: !isBinaryTag,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
            y: {
              grid: { color: '#1e293b' },
              ticks: { color: '#06b6d4' },
              min: isBinaryTag ? 0 : undefined,
              max: isBinaryTag ? 1 : undefined
            }
          },
          plugins: {
            legend: { labels: { color: '#cbd5e1', font: { size: 11, family: 'monospace' } } }
          }
        }
      });
    }

    // Render Calendar Heatmap for the selected timeframe
    const hmContainer = document.getElementById('uniExplorerHeatmapContainer');
    if (hmContainer && uniViewMode !== 'chart') {
      const recentSlice = tfLogs.slice(-365); // Show up to 365 days in the heatmap grid
      const vals = points.map(p => p.val).filter(v => v != null);
      const minV = vals.length ? Math.min(...vals) : 0;
      const maxV = vals.length ? Math.max(...vals) : 1;

      const byDate = {};
      tfLogs.forEach(l => {
        if (l.date) byDate[l.date] = extractUniValue(l, uniParamKey);
      });

      const cells = recentSlice.map(l => {
        const v = byDate[l.date];
        let color = 'bg-slate-900 border-slate-800';
        if (v !== null && v !== undefined && (!isBinaryTag || v === 1)) {
          if (isBinaryTag) {
            color = 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-500/40';
          } else {
            const ratio = maxV > minV ? (v - minV) / (maxV - minV) : 0.8;
            if (ratio >= 0.75) color = 'bg-emerald-400 border-emerald-300';
            else if (ratio >= 0.5) color = 'bg-cyan-400 border-cyan-300';
            else if (ratio >= 0.25) color = 'bg-cyan-700 border-cyan-600';
            else color = 'bg-slate-700 border-slate-600';
          }
        }
        const tip = `${l.date}: ${v !== null && v !== undefined ? v : 'Kein Eintrag'} (${l.session_type || 'Tag'})`;
        return `<div onclick="AnalyticsModule.onDatePicked('${l.date}')" title="${tip}" class="w-3.5 h-3.5 rounded-[3px] border ${color} cursor-pointer hover:scale-125 transition-transform"></div>`;
      }).join('');

      hmContainer.innerHTML = `
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
          <span>🗓️ Interaktive Tages-Heatmap (${recentSlice.length} Tage im gewählten Fenster • Klicke auf ein Kästchen, um den Tag oben im Readiness-Cockpit zu öffnen)</span>
          <span class="text-cyan-300 font-bold">${recentSlice.length ? recentSlice[0].date : ''} bis ${recentSlice.length ? recentSlice[recentSlice.length - 1].date : ''}</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${cells}
        </div>
      `;
    }
  }

  // ================= C. DLV BIOMECHANIK (EHAMMER VS LUKA) & 87x 1080 SPRINTS =================
  function setDlvSubTab(tab) {
    dlvSubTab = tab;
    const card = document.getElementById('dlvAnd1080MasterCard');
    if (card) card.innerHTML = renderDlvAnd1080InnerHtml();
  }

  function setEhammerCompareJump(jumpKey) {
    ehammerCompareJump = jumpKey;
    const card = document.getElementById('dlvAnd1080MasterCard');
    if (card) card.innerHTML = renderDlvAnd1080InnerHtml();
  }

  function on1080FilterInput(val) {
    filter1080Query = val || '';
    const card = document.getElementById('dlvAnd1080MasterCard');
    if (card) card.innerHTML = renderDlvAnd1080InnerHtml();
  }

  function renderDlvAnd1080InnerHtml() {
    const eh = EHAMMER_BIOMECH.ehammer_2022;
    const lk = EHAMMER_BIOMECH[ehammerCompareJump] || EHAMMER_BIOMECH.bochum_2026;
    const bundle = dlv1080Bundle || { dlv_weit: [], dlv_anlauf: [], runs_1080: [] };

    return `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <span class="text-amber-400">🧬</span>
            <span>DLV BIOMECHANIK-VERGLEICH (LUKA VS. SIMON EHAMMER 8.40m EFF.) & 1080 SPRINT-DATENBANK</span>
          </h3>
          <p class="text-[11px] text-slate-400 font-mono mt-0.5">
            Direkter Parameter-Abgleich mit Simon Ehammer (07.05.2022 Ratingen • 8.30m / 8.40m eff.) + Alle 68 DLV-PDFs & 87 Läufe am 1080 Sprint
          </p>
        </div>

        <!-- Sub-Tab Buttons -->
        <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono flex-wrap">
          <button onclick="NextSessionModule.setDlvSubTab('ehammer')" class="px-2.5 py-1 rounded font-bold transition-all ${dlvSubTab === 'ehammer' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">
            🇨🇭 Luka vs. Simon Ehammer (8.40m)
          </button>
          <button onclick="NextSessionModule.setDlvSubTab('weit')" class="px-2.5 py-1 rounded font-bold transition-all ${dlvSubTab === 'weit' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">
            📐 Alle DLV Weit-Berichte (${bundle.dlv_weit.length})
          </button>
          <button onclick="NextSessionModule.setDlvSubTab('anlauf')" class="px-2.5 py-1 rounded font-bold transition-all ${dlvSubTab === 'anlauf' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">
            ⚡ DLV Anlauf (${bundle.dlv_anlauf.length})
          </button>
          <button onclick="NextSessionModule.setDlvSubTab('sprint1080')" class="px-2.5 py-1 rounded font-bold transition-all ${dlvSubTab === 'sprint1080' ? 'bg-purple-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}">
            🚀 1080 Sprint-Läufe (${bundle.runs_1080.length})
          </button>
        </div>
      </div>

      ${dlvSubTab === 'ehammer' ? `
        <!-- Simon Ehammer vs Luka Herden Comparison View -->
        <div class="space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div class="text-xs font-mono text-slate-300">
              <strong class="text-amber-300">Wähle deinen DLV-Sprung zum Direktvergleich gegen Simon Ehammer (8.30m off. / 8.40m eff.):</strong>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap font-mono text-xs">
              <button onclick="NextSessionModule.setEhammerCompareJump('bochum_2026')" class="px-2.5 py-1 rounded font-bold ${ehammerCompareJump === 'bochum_2026' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 border border-slate-800'}">
                DM Bochum 2026 (7.86m / 8.07m eff. • 10.76 m/s)
              </button>
              <button onclick="NextSessionModule.setEhammerCompareJump('rom_2024')" class="px-2.5 py-1 rounded font-bold ${ehammerCompareJump === 'rom_2024' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 border border-slate-800'}">
                EM Rom 2024 (8.01m / 8.11m eff.)
              </button>
              <button onclick="NextSessionModule.setEhammerCompareJump('kassel_2023')" class="px-2.5 py-1 rounded font-bold ${ehammerCompareJump === 'kassel_2023' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 border border-slate-800'}">
                DM Kassel 2023 (7.91m / 7.97m eff.)
              </button>
            </div>
          </div>

          <!-- 3 Key Biomechanical Takeaways from Ehammer vs Luka -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="bg-emerald-950/20 border border-emerald-700/50 rounded-xl p-3 space-y-1">
              <div class="font-mono font-black text-emerald-300 uppercase text-[11px]">✅ 1. Anlauf-Speed & V-Vertikal auf 8.40m-Niveau!</div>
              <p class="text-slate-300 text-[11px] leading-relaxed">
                In Bochum erreichst du <strong>10.76 m/s Peak (10.70 m/s im 2L)</strong> – fast identisch zu Ehammers <strong>10.79 m/s</strong>! Deine <strong>Vertikalgeschwindigkeit (3.30 m/s in Bochum / 3.28 m/s in Rom)</strong> und dein <strong>Schwungbein (841–862 °/s)</strong> sind sogar höher als bei Ehammer (3.27 m/s & 833 °/s)!
              </p>
            </div>
            <div class="bg-amber-950/20 border border-amber-700/50 rounded-xl p-3 space-y-1">
              <div class="font-mono font-black text-amber-300 uppercase text-[11px]">🔧 2. Schlüssel-Hebel A: Vorletzter Schritt (2L)</div>
              <p class="text-slate-300 text-[11px] leading-relaxed">
                Ehammer läuft extrem flach durch die letzten 3 Schritte: <strong>2.26m ➔ 2.34m ➔ 2.30m</strong> (Entf. 4L: <strong>9.39m</strong>, Stemmwinkel <strong>24°</strong>, Abflug-Speed <strong>9.18 m/s</strong>). In Bochum war dein 2L auf <strong>2.55m</strong> überstreckt (2.10 ➔ 2.55 ➔ 2.25m, Stemmwinkel <strong>27°</strong>). In Rom (23° Stemmwinkel, 9.49m 4L) warst du viel näher an Ehammer!
              </p>
            </div>
            <div class="bg-cyan-950/20 border border-cyan-700/50 rounded-xl p-3 space-y-1">
              <div class="font-mono font-black text-cyan-300 uppercase text-[11px]">🔧 3. Schlüssel-Hebel B: Landung (+14 cm Reserve!)</div>
              <p class="text-slate-300 text-[11px] leading-relaxed">
                Ehammer klappt den Rumpf bei der Landung weit nach vorn auf die Oberschenkel (<strong>Rumpfwinkel 71°, Hüftwinkel 80°</strong>) und verliert nur <strong>-0.11m</strong>. Bei dir bleibt der Rumpf aufrechter (<strong>110° Rumpf / 106–122° Hüfte</strong>), was <strong>-0.17m bis -0.25m</strong> kostet – hier liegen sofortige <strong>10–14 cm</strong> Gratis-Weite!
              </p>
            </div>
          </div>

          <!-- Side-by-Side Parameter Table -->
          <div class="overflow-x-auto border border-slate-800 rounded-xl">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-3">DLV Biomechanik-Parameter</th>
                  <th class="py-2 px-2.5 text-center">DLV Norm</th>
                  <th class="py-2 px-3 text-center bg-amber-950/30 text-amber-300 border-x border-amber-800/40">${eh.title}</th>
                  <th class="py-2 px-3 text-center bg-cyan-950/30 text-cyan-300 border-r border-cyan-800/40">${lk.title}</th>
                  <th class="py-2 px-3 text-right">Differenz (Luka vs. Ehammer)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Weite Offiziell / Effektiv (Erwartet)</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">Max</td>
                  <td class="py-2 px-3 text-center font-black text-amber-300">${eh.offiziell.toFixed(2)}m / <strong>${eh.effektiv.toFixed(2)}m</strong> (${eh.erwartet.toFixed(2)}m)</td>
                  <td class="py-2 px-3 text-center font-black text-cyan-300">${lk.offiziell.toFixed(2)}m / <strong>${lk.effektiv.toFixed(2)}m</strong> (${lk.erwartet.toFixed(2)}m)</td>
                  <td class="py-2 px-3 text-right text-slate-300">${(lk.effektiv - eh.effektiv).toFixed(2)}m effektiv (Erwartet nur ${(lk.erwartet - eh.erwartet).toFixed(2)}m!)</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Anlaufgeschwindigkeit 3L ➔ 2L ➔ 1L</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">&gt; 10.5 m/s</td>
                  <td class="py-2 px-3 text-center text-amber-200">${eh.v_3L} ➔ <strong>${eh.v_2L}</strong> ➔ ${eh.v_1L} m/s</td>
                  <td class="py-2 px-3 text-center text-cyan-200">${lk.v_3L} ➔ <strong>${lk.v_2L}</strong> ➔ ${lk.v_1L} m/s (Peak ${lk.v_max})</td>
                  <td class="py-2 px-3 text-right text-emerald-400 font-bold">${(lk.v_max - eh.v_max >= 0 ? '+' : '') + (lk.v_max - eh.v_max).toFixed(2)} m/s Peak (Fast identisch!)</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Abflug Horizontal-Speed & V-Verlust</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">Verlust &lt; 1.5</td>
                  <td class="py-2 px-3 text-center text-amber-200"><strong>${eh.v_abflug_hor} m/s</strong> (${eh.v_verlust_hor} m/s)</td>
                  <td class="py-2 px-3 text-center text-cyan-200"><strong>${lk.v_abflug_hor} m/s</strong> (${lk.v_verlust_hor} m/s)</td>
                  <td class="py-2 px-3 text-right text-slate-300">${(lk.v_abflug_hor - eh.v_abflug_hor).toFixed(2)} m/s Horizontal-Abflug</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Vertikalgeschwindigkeit (V-Vertikal) & Abflugwinkel</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">&gt; 19°</td>
                  <td class="py-2 px-3 text-center text-amber-200"><strong>${eh.v_vertikal} m/s</strong> (${eh.abflugwinkel}°)</td>
                  <td class="py-2 px-3 text-center text-emerald-300 font-bold"><strong>${lk.v_vertikal} m/s</strong> (${lk.abflugwinkel}°)</td>
                  <td class="py-2 px-3 text-right text-emerald-400 font-bold">+${(lk.v_vertikal - eh.v_vertikal).toFixed(2)} m/s (Luka höher!)</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Schrittlängen 3L ➔ 2L ➔ 1L (Entf. 4L)</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">kurz-lang-kurz</td>
                  <td class="py-2 px-3 text-center text-amber-200">${eh.s_3L}m ➔ ${eh.s_2L}m ➔ ${eh.s_1L}m (<strong>${eh.entf_4L}m</strong>)</td>
                  <td class="py-2 px-3 text-center text-cyan-200">${lk.s_3L}m ➔ <strong>${lk.s_2L}m</strong> ➔ ${lk.s_1L}m (<strong>${lk.entf_4L}m</strong>)</td>
                  <td class="py-2 px-3 text-right text-amber-300">2L bei Luka +${(lk.s_2L - eh.s_2L).toFixed(2)}m länger</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Stemmwinkel / Min. Kniewinkel (Amortisation)</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">22–28° / &gt;134°</td>
                  <td class="py-2 px-3 text-center text-amber-200"><strong>${eh.stemmwinkel}°</strong> / ${eh.kniewinkel_min}°</td>
                  <td class="py-2 px-3 text-center text-cyan-200"><strong>${lk.stemmwinkel}°</strong> / ${lk.kniewinkel_min}°</td>
                  <td class="py-2 px-3 text-right text-slate-300">Stemmwinkel ${(lk.stemmwinkel - eh.stemmwinkel >= 0 ? '+' : '') + (lk.stemmwinkel - eh.stemmwinkel)}°</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Schwungbein-Winkelgeschwindigkeit</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">&gt; 730 °/s</td>
                  <td class="py-2 px-3 text-center text-amber-200">${eh.schwungbein_w} °/s</td>
                  <td class="py-2 px-3 text-center text-emerald-300 font-bold">${lk.schwungbein_w} °/s</td>
                  <td class="py-2 px-3 text-right text-emerald-400 font-bold">${(lk.schwungbein_w - eh.schwungbein_w >= 0 ? '+' : '') + (lk.schwungbein_w - eh.schwungbein_w)} °/s</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-bold text-white">Landeverlust & Landewinkel (Rumpf / Knie / Hüfte)</td>
                  <td class="py-2 px-2.5 text-center text-slate-500">64–104° Rumpf</td>
                  <td class="py-2 px-3 text-center text-emerald-300 font-bold"><strong>${eh.landeverlust}m</strong> (${eh.lande_rumpf}° / ${eh.lande_knie}° / ${eh.lande_huefte}°)</td>
                  <td class="py-2 px-3 text-center text-rose-300 font-bold"><strong>${lk.landeverlust}m</strong> (${lk.lande_rumpf}° / ${lk.lande_knie}° / ${lk.lande_huefte}°)</td>
                  <td class="py-2 px-3 text-right text-rose-300 font-bold">${(lk.landeverlust - eh.landeverlust).toFixed(2)}m durch aufrechteren Rumpf (${lk.lande_rumpf}° vs ${eh.lande_rumpf}°)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${dlvSubTab === 'weit' ? `
        <div class="overflow-x-auto max-h-96 border border-slate-800 rounded-xl">
          <table class="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr class="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <th class="py-2 px-2.5">Bericht / Wettkampf</th>
                <th class="py-2 px-2 text-right">Offiziell</th>
                <th class="py-2 px-2 text-right text-emerald-300">Effektiv</th>
                <th class="py-2 px-2 text-right text-cyan-300">Erwartet</th>
                <th class="py-2 px-2 text-center">Balken</th>
                <th class="py-2 px-2 text-center">Entf. 4L</th>
                <th class="py-2 px-2 text-center">Stemm° / Knie°</th>
                <th class="py-2 px-2 text-center">Abflug°</th>
                <th class="py-2 px-2 text-center">Schwungbein</th>
                <th class="py-2 px-2 text-right">Landeverlust</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              ${bundle.dlv_weit.map(w => {
                const isEh = (w.file || '').includes('Ehammer');
                return `
                  <tr class="${isEh ? 'bg-amber-950/30 font-bold' : 'hover:bg-slate-800/40'}">
                    <td class="py-1.5 px-2.5 ${isEh ? 'text-amber-300' : 'text-white'}">${(w.file || '').replace('.pdf', '')}</td>
                    <td class="py-1.5 px-2 text-right font-bold text-white">${w.offiziell_m}m</td>
                    <td class="py-1.5 px-2 text-right font-bold text-emerald-300">${w.effektiv_m}m</td>
                    <td class="py-1.5 px-2 text-right text-cyan-300">${w.erwartet_m}m</td>
                    <td class="py-1.5 px-2 text-center text-slate-300">${w.verlust_balken_m}m</td>
                    <td class="py-1.5 px-2 text-center text-slate-300">${w.entf_4L_m}m</td>
                    <td class="py-1.5 px-2 text-center text-slate-300">${w.stemmwinkel_deg}° / ${w.kniewinkel_min_deg}°</td>
                    <td class="py-1.5 px-2 text-center text-amber-300">${w.abflugwinkel_deg}°</td>
                    <td class="py-1.5 px-2 text-center text-purple-300">${w.schwungbein_deg_s} °/s</td>
                    <td class="py-1.5 px-2 text-right text-rose-300">${w.lande_verlust_m}m</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${dlvSubTab === 'anlauf' ? `
        <div class="overflow-x-auto max-h-96 border border-slate-800 rounded-xl">
          <table class="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr class="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <th class="py-2 px-3">DLV Anlauf-Bericht</th>
                <th class="py-2 px-2 text-center">Bester Versuch</th>
                <th class="py-2 px-2 text-right">Weite</th>
                <th class="py-2 px-2 text-center">Wind</th>
                <th class="py-2 px-2 text-right text-cyan-300">Peak Vmax (m/s)</th>
                <th class="py-2 px-2 text-right text-emerald-300">V (6–1m vor Balken)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              ${bundle.dlv_anlauf.map(a => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-1.5 px-3 text-white font-bold">${(a.file || '').replace('.pdf', '')}</td>
                  <td class="py-1.5 px-2 text-center text-slate-400">V${a.attempt}</td>
                  <td class="py-1.5 px-2 text-right font-bold text-amber-300">${a.mark_m}m</td>
                  <td class="py-1.5 px-2 text-center text-slate-300">${a.wind}</td>
                  <td class="py-1.5 px-2 text-right font-black text-cyan-300">${a.vmax_ms} m/s</td>
                  <td class="py-1.5 px-2 text-right font-bold text-emerald-300">${a.v_6_1m_ms} m/s</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${dlvSubTab === 'sprint1080' ? `
        <div class="space-y-2.5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <input type="text" value="${filter1080Query}" oninput="NextSessionModule.on1080FilterInput(this.value)" placeholder="Suche nach Datum (z.B. 2025-10-08, 2026-10-28, 2025-06-11), ZUL, Assisted, Resisted, 12kg..." class="w-full sm:w-96 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500" />
            <span class="text-[10px] font-mono text-purple-300">✅ Inkl. Datums-Korrektur 08.10.2025 (alle 12 Läufe) & 11.06.2025</span>
          </div>
          <div class="overflow-x-auto max-h-96 border border-slate-800 rounded-xl">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Session / Datum</th>
                  <th class="py-2 px-2">Uhrzeit</th>
                  <th class="py-2 px-2">Klassifikation / Modus</th>
                  <th class="py-2 px-2 text-center">Last</th>
                  <th class="py-2 px-2 text-right text-cyan-300">Vmax (m/s)</th>
                  <th class="py-2 px-2 text-right text-emerald-300">Pmax (W)</th>
                  <th class="py-2 px-2 text-right text-amber-300">Fmax (N)</th>
                  <th class="py-2 px-2 text-center">10m / 20m / 30m</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${bundle.runs_1080.filter(r => {
                  if (!filter1080Query) return true;
                  const q = filter1080Query.toLowerCase();
                  return `${r.folder} ${r.rep_date} ${r.direction} ${r.mode} ${r.set_load_kg}kg ${r.auto_class}`.toLowerCase().includes(q);
                }).map(r => `
                  <tr class="hover:bg-slate-800/40">
                    <td class="py-1.5 px-2.5 font-bold text-white">${r.folder} <span class="text-[10px] text-slate-400">(${r.rep_date})</span></td>
                    <td class="py-1.5 px-2 text-slate-400">${r.rep_clock}</td>
                    <td class="py-1.5 px-2">
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        (r.direction || '').includes('Assisted') ? 'bg-purple-950 text-purple-300 border border-purple-700' : 'bg-slate-900 text-cyan-300 border border-slate-800'
                      }">${r.auto_class || r.direction}</span>
                    </td>
                    <td class="py-1.5 px-2 text-center text-slate-200 font-bold">${r.set_load_kg} kg</td>
                    <td class="py-1.5 px-2 text-right font-black text-cyan-300">${r.v_max_ms} m/s</td>
                    <td class="py-1.5 px-2 text-right font-bold text-emerald-300">${r.p_max_W} W</td>
                    <td class="py-1.5 px-2 text-right text-amber-300">${r.f_max_N} N</td>
                    <td class="py-1.5 px-2 text-center text-slate-300">${r.t_10m || '-'} / ${r.t_20m || '-'} / ${r.t_30m || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  }

  return {
    renderTab1,
    renderTab2Extensions,
    setSeasonStandardKey,
    setUniTimeframe,
    setUniParam,
    setUniViewMode,
    setDlvSubTab,
    setEhammerCompareJump,
    on1080FilterInput
  };
})();

window.NextSessionModule = NextSessionModule;
