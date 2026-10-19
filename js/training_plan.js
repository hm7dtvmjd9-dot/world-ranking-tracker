/**
 * Tab 5: Trainingsplan, Individueller Mehrjahres-Blockvergleich & Karriere-Muster-Analyse (2019 - 2026)
 * Features:
 * - Weekly View (Montag bis Sonntag mit Einheiten, Schwerpunkt, Whoop & Protokoll)
 * - Monthly Calendar View (Monatsübersicht aller Trainingseinheiten mit Direkt-Vorschau)
 * - Multi-Year Block Comparison:
 *   - Jahres-spezifische Block-Definitionen statt starrer Kalenderwochen (z.B. 2025 Spikes am 17.10. vs. 2024 1. Einheit Aufbau am 17.10.)
 *   - Block-Tag-Synchronisation (Tag 1..N des Blocks) vs. Kalender-Tag-Synchronisation + anpassbares Startdatum pro Jahr
 *   - Klickbare Tages-Kacheln für direkte Session-Vorschau (#sessionPreviewModal)
 *   - Granulare Bereichs-Filter (Alle, Sprung/Spikes, Sprint/1080/MaxV, Kraft/FCT, Plyos/Reaktiv, Tempo/Stabi/Regen)
 * - Karriere- & Muster-Analyse (2022 - 2026 -> WM Peking 2027 & LA 2028)
 * - Volltext Protokoll-Suche über alle 2.355 Einheiten
 */
const TrainingPlanModule = (() => {
  let activeView = 'block'; // 'week' | 'month' | 'block' | 'career_lab' | 'search'
  let currentWeekStart = '2026-10-12';
  let currentMonthYear = '2026-10';
  let activeBlockPreset = 'aufbau_gpp'; // 'aufbau_gpp' | 'spezial_fct_spikes' | 'hallenvorbereitung' | 'hallensaison' | 'sommeraufbau' | 'sommersaison'
  let blockSyncMode = 'block_day'; // 'block_day' (Tag 1..N des jeweiligen Blocks) | 'calendar_date'
  let activeDomainFilter = 'ALL'; // 'ALL' | 'JUMP_SPIKES' | 'SPRINT_MAXV' | 'STRENGTH_FCT' | 'PLYO_REACTIVE' | 'TEMPO_REGEN'
  let hideNonMatchingDomainDays = false;
  let activeBlockYears = [2026, 2025, 2024, 2023, 2022];
  let planSearchQuery = '';
  let initializedWeek = false;

  let selectedSeasonEvolution = '2026_current'; // '2026_current' | '2025_2026' | '2024_2025' | '2023_2024' | '2022_2023'
  let benchmarkSimulatorInputs = {
    sprint_30m: 3.78,
    sprint_30_40m: 0.935,
    sprint_40m: 4.70,
    sprint_20m_fly: 1.87,
    squat_rel_bw: 1.65,
    powerclean_rel_bw: 1.65,
    static_vert_jump_inch: 30.0,
    cmj_inch: 32.3,
    depth_jump_inch: 36.0,
    bounds_4_jump_m: 17.20,
    max_4_bounds_jump_m: 24.20,
    rehearsal_12_step_m: 7.55
  };

  const SEASON_CONFIG = {
    '2026_current': {
      title: '🔥 Aktueller Aufbau 2026 / Saison 2026/27',
      shortTitle: '2026/27 (Aktuell)',
      badge: 'Aktuell • Tag 26',
      badgeColor: 'bg-cyan-500 text-slate-950',
      start: '2026-09-23',
      end: '2026-10-18',
      targetCompetition: 'Hallen-EM 2027 / WM Peking 2027',
      focusSummary: 'Grundaufbau, Tempoläufe, Gewichtsoptimierung (86.2kg ➔ 82.5kg!), ab 08.10. 1080 Sprints'
    },
    '2025_2026': {
      title: 'Saison 2025/2026 (8,18m PB Gorzów & FCT)',
      shortTitle: '2025/2026 (8,18m PB)',
      badge: '8,18m PB Gorzów',
      badgeColor: 'bg-emerald-500 text-slate-950',
      start: '2025-10-04',
      end: '2026-08-31',
      targetCompetition: 'Hallen-WM Toruń & DM Bochum',
      focusSummary: 'Start FCT (06.10.25), Spikes (17.10.), BW-Grundausbildung (Nov 25), Grube (02.12.) ➔ Gorzów 8.18m PB!'
    },
    '2024_2025': {
      title: 'Saison 2024/2025 (8,01m Athen & FISU Bronze)',
      shortTitle: '2024/2025 (8,01m Athen)',
      badge: '8,01m Athen',
      badgeColor: 'bg-amber-500 text-slate-950',
      start: '2024-10-17',
      end: '2025-08-31',
      targetCompetition: 'FISU World University Games Bochum',
      focusSummary: 'Erstes volles Jahr Mannheim, 8.01m Athen, 2x 7.96m FISU Games Bronze, hohe Konstanz'
    },
    '2023_2024': {
      title: 'Saison 2023/2024 (8,08m EM Rom & 79,8 kg)',
      shortTitle: '2023/2024 (8,08m Rom)',
      badge: '8,08m EM Rom',
      badgeColor: 'bg-emerald-500 text-slate-950',
      start: '2023-09-04',
      end: '2024-08-31',
      targetCompetition: 'EM Rom 2024',
      focusSummary: 'Trainerwechsel Mannheim, 79.80 kg Wettkampfgewicht, 8.08m & 8.01m in Rom an 2 Tagen'
    },
    '2022_2023': {
      title: 'Saison 2022/2023 (8,14m Inneringen & 6,76s 60m PB)',
      shortTitle: '2022/2023 (8,14m MS)',
      badge: '8,14m Durchbruch',
      badgeColor: 'bg-cyan-500 text-slate-950',
      start: '2022-08-22',
      end: '2023-08-31',
      targetCompetition: 'DM Kassel & WM Budapest',
      focusSummary: 'Durchbruch nach Knie-OP (2019): Aggressiver Aufbau Münster (Pushbull, ZWL, Spikes 20.09., Grube 20.10.)'
    }
  };

  const BENCHMARK_PRESETS = {
    'luka_best': {
      label: 'Lukas All-Time Bestwerte (Google Sheets)',
      values: {
        sprint_30m: 3.78,
        sprint_30_40m: 0.935,
        sprint_40m: 4.70,
        sprint_20m_fly: 1.87,
        squat_rel_bw: 1.65,
        powerclean_rel_bw: 1.65,
        static_vert_jump_inch: 30.0,
        cmj_inch: 32.3,
        depth_jump_inch: 36.0,
        bounds_4_jump_m: 17.20,
        max_4_bounds_jump_m: 24.20,
        rehearsal_12_step_m: 7.55
      }
    },
    'aufbau_2026': {
      label: 'Aktueller Aufbau 2026 (Tag 26 • Basis)',
      values: {
        sprint_30m: 3.82,
        sprint_30_40m: 0.945,
        sprint_40m: 4.74,
        sprint_20m_fly: 1.89,
        squat_rel_bw: 1.39,
        powerclean_rel_bw: 1.50,
        static_vert_jump_inch: 28.0,
        cmj_inch: 30.0,
        depth_jump_inch: 32.0,
        bounds_4_jump_m: 16.50,
        max_4_bounds_jump_m: 23.00,
        rehearsal_12_step_m: 7.30
      }
    },
    'world_class_target': {
      label: '🎯 100% Elite-Benchmark (Weltklasse-Optimum)',
      values: {
        sprint_30m: 3.75,
        sprint_30_40m: 0.920,
        sprint_40m: 4.67,
        sprint_20m_fly: 1.85,
        squat_rel_bw: 2.60,
        powerclean_rel_bw: 2.00,
        static_vert_jump_inch: 37.0,
        cmj_inch: 40.0,
        depth_jump_inch: 43.0,
        bounds_4_jump_m: 18.20,
        max_4_bounds_jump_m: 25.50,
        rehearsal_12_step_m: 7.80
      }
    }
  };

  const ELITE_BENCHMARK_CONFIG = [
    {
      id: 'sprint_30m',
      name: '30m Tiefstart',
      category: 'Sprint & Beschleunigung',
      unit: 's',
      lowerIsBetter: true,
      target: 3.75,
      targetDisplay: '3,75 s',
      lukaBest: 3.78,
      lukaBestDisplay: '~3,78 s (aus 60m 6,76s)',
      lukaAufbau26: 3.82,
      lukaAufbau26Display: '~3,82 s (Tempos)',
      role: 'Antritts- & Reaktionsdynamik aus dem Block (Schritte 1–10). Wichtig für hohe Anlaufkonstanz.'
    },
    {
      id: 'sprint_30_40m',
      name: '30–40m Split',
      category: 'Top End Speed / Vmax',
      unit: 's',
      lowerIsBetter: true,
      target: 0.92,
      targetDisplay: '0,92 s (10,87 m/s)',
      lukaBest: 0.935,
      lukaBestDisplay: '0,935 s (Vmax 10,70 m/s)',
      lukaAufbau26: 0.945,
      lukaAufbau26Display: '0,945 s (1080 ZWL)',
      role: 'Maximale Flug- und Zyklusgeschwindigkeit im Übergang zum Weitsprung-Absprung.'
    },
    {
      id: 'sprint_40m',
      name: '40m Tiefstart',
      category: 'Sprint & Beschleunigung',
      unit: 's',
      lowerIsBetter: true,
      target: 4.67,
      targetDisplay: '4,67 s',
      lukaBest: 4.70,
      lukaBestDisplay: '~4,70 s (aus 60m 6,76s)',
      lukaAufbau26: 4.74,
      lukaAufbau26Display: '~4,74 s',
      role: 'Volle Beschleunigungsphase über die exakte Distanz des Weitsprung-Anlaufs.'
    },
    {
      id: 'sprint_20m_fly',
      name: '20m fliegend',
      category: 'Top End Speed / Vmax',
      unit: 's',
      lowerIsBetter: true,
      target: 1.85,
      targetDisplay: '1,85 s (10,81 m/s)',
      lukaBest: 1.87,
      lukaBestDisplay: '~1,87 s (Anlauf 10,70 m/s)',
      lukaAufbau26: 1.89,
      lukaAufbau26Display: '~1,89 s (10,58 m/s)',
      role: 'Direktes Maß der Anlaufgeschwindigkeit am Brett (Schritt 14 bis 18). Lukas #1 Stärke!'
    },
    {
      id: 'squat_rel_bw',
      name: 'Parallel Squat (Kniebeuge)',
      category: 'Maximalkraft (Relativ)',
      unit: 'x BW',
      lowerIsBetter: false,
      target: 2.60,
      targetDisplay: '2,60x KG (215 kg)',
      lukaBest: 1.65,
      lukaBestDisplay: '~1,65x KG (135 kg)',
      lukaAufbau26: 1.39,
      lukaAufbau26Display: '1,39x KG (115 kg 3x6)',
      role: 'Extremer Kraftwert. Bei Luka limitiert Rücken – strategisch kompensiert durch Trapbar (2,75x) & Hip-Thrust (2,80x)!'
    },
    {
      id: 'powerclean_rel_bw',
      name: 'Power Clean (Umsetzen)',
      category: 'Explosivkraft (Relativ)',
      unit: 'x BW',
      lowerIsBetter: false,
      target: 2.00,
      targetDisplay: '2,00x KG (165 kg)',
      lukaBest: 1.65,
      lukaBestDisplay: '1,65x KG (132,5 kg)',
      lukaAufbau26: 1.50,
      lukaAufbau26Display: '~1,50x KG',
      role: 'Entscheidend für Triple Extension (Knöchel-Knie-Hüfte) & Steifigkeit in der Amortisationsphase am Brett.'
    },
    {
      id: 'static_vert_jump_inch',
      name: 'Static Vertical Jump (SJ)',
      category: 'Vertikale Reaktivität',
      unit: 'inch',
      lowerIsBetter: false,
      target: 37.0,
      targetDisplay: '37,0" (94,0 cm)',
      lukaBest: 30.0,
      lukaBestDisplay: '~30,0" (~76 cm)',
      lukaAufbau26: 28.0,
      lukaAufbau26Display: '~28,0" (~71 cm)',
      role: 'Reine konzentrische Muskelkraft ohne Dehnungs-Verkürzungs-Zyklus (DVZ).'
    },
    {
      id: 'cmj_inch',
      name: 'Countermovement Jump (CMJ)',
      category: 'Vertikale Reaktivität',
      unit: 'inch',
      lowerIsBetter: false,
      target: 40.0,
      targetDisplay: '40,0" (101,6 cm)',
      lukaBest: 32.3,
      lukaBestDisplay: '32,3" (82 cm PB / 67 cm)',
      lukaAufbau26: 30.0,
      lukaAufbau26Display: '~30,0" (~76 cm)',
      role: 'DVZ-Fähigkeit mit Ausholbewegung. Indikator für neuromuskuläre Frische und ZNS-Erholung.'
    },
    {
      id: 'depth_jump_inch',
      name: '60cm Depth Jump',
      category: 'Reaktivkraft / Drop Jump',
      unit: 'inch',
      lowerIsBetter: false,
      target: 43.0,
      targetDisplay: '43,0" (109,2 cm)',
      lukaBest: 36.0,
      lukaBestDisplay: 'DJ50 68,1 W/kg (0,138s)',
      lukaAufbau26: 32.0,
      lukaAufbau26Display: '~32,0" (~81 cm)',
      role: 'Extreme exzentrisch-konzentrische Umschaltkraft bei Bodenkontaktzeiten < 0,140s.'
    },
    {
      id: 'bounds_4_jump_m',
      name: '4 Bounds & Jump',
      category: 'Spezifische Horizontalkraft',
      unit: 'm',
      lowerIsBetter: false,
      target: 18.20,
      targetDisplay: '18,20 m',
      lukaBest: 17.20,
      lukaBestDisplay: '~17,20 m',
      lukaAufbau26: 16.50,
      lukaAufbau26Display: '~16,50 m',
      role: 'Sprint-Sprunglauf mit Grubenlandung. Direkte Verbindung aus horizontaler Kraft und Weitsprungtechnik.'
    },
    {
      id: 'max_4_bounds_jump_m',
      name: 'Max 4 Bounds & Jump',
      category: 'Spezifische Horizontalkraft',
      unit: 'm',
      lowerIsBetter: false,
      target: 25.50,
      targetDisplay: '25,50 m',
      lukaBest: 24.20,
      lukaBestDisplay: '~24,20 m',
      lukaAufbau26: 23.00,
      lukaAufbau26Display: '~23,00 m',
      role: 'Maximaler Mehrfachsprung. Testet maximale Kraftübertragung über mehrere Stützphasen bei hoher Vorwärtsfahrt.'
    },
    {
      id: 'rehearsal_12_step_m',
      name: '12 Schritt Rehearsal',
      category: 'Wettkampf-Spezifisch',
      unit: 'm',
      lowerIsBetter: false,
      target: 7.80,
      targetDisplay: '7,80 m',
      lukaBest: 7.55,
      lukaBestDisplay: '~7,55 m (7–9er 7,40m)',
      lukaAufbau26: 7.30,
      lukaAufbau26Display: '~7,30 m',
      role: 'Weitsprung aus 12 Schritten. 7,80m aus 12 Schritten projiziert bei 18 Schritten direkt auf ≥ 8,35m–8,50m!'
    }
  ];

  // Authentic year-specific block definitions verified from Luka's 2019-2026 Google Sheets logs & milestone dates
  const DEFAULT_YEAR_BLOCKS = {
    'aufbau_gpp': {
      title: '1. Aufbau-Beginn (Block 1: 2022 – 2026)',
      subtitle: 'Exakter Start des Winter-Aufbaus je Jahr (Synchronisiert ab Tag 1 des jeweiligen Aufbaus)',
      durationDays: 45,
      years: {
        2026: { start: '2026-09-23', end: '2026-11-06', note: 'Aufbau 2026 ab 23.09.2026 bis mind. 18.10.2026 (Tag 26) • Ab 08.10. 1080 • Entscheidung KW 43: Pausewoche vorziehen vs. noch 1 Woche gleiches Muster' },
        2025: { start: '2025-10-04', end: '2025-11-17', note: 'Aufbau 2025 ab 04.10.2025 • 06.10. Start FCT • 17.10. erstes Mal Spikes • Sekundenläufe bis 01.11. • Nov: 1 Monat BW-Grundausbildung • Grube ab 02.12.2025' },
        2024: { start: '2024-10-17', end: '2024-11-30', note: 'Aufbau 2024 ab 17.10.2024 (Mannheim) • Erste Sprünge in die Grube am 03.12.2024' },
        2023: { start: '2023-09-04', end: '2023-10-18', note: 'Aufbau 2023 ab 04.09.2023 (noch in Münster bei altem Trainer) • Spikes ab 20.09.23 • Aggressiver Aufbau (spez. Kraft, ZWL, Pushbull) • Grube ab 12.10.2023' },
        2022: { start: '2022-08-22', end: '2022-10-05', note: 'Aufbau 2022 ab 22.08.2022 (Basis für Durchbruchsaison 2023!) • Pushbull/ZWL ab 03.10.2022 • Erste Sprünge in die Grube am 20.10.2022' },
        2021: { start: '2021-10-04', end: '2021-11-17', note: 'Herbst-Aufbau 2021 (Wiederaufbau nach Knie-OP 09/2019 & Corona 2020)' },
        2020: { start: '2020-09-28', end: '2020-11-11', note: 'Herbst-Aufbau 2020 (Corona-Saison)' },
        2019: { start: '2019-09-30', end: '2019-11-13', note: 'Reha-Aufbau Herbst 2019 (OP am Absprungknie wegen Jumpers Knee im Sept 2019)' }
      }
    },
    'spezial_fct_spikes': {
      title: '2. Spezifischer Herbstblock (Erste Spikes, ZWL/1080, Pushbull & FCT)',
      subtitle: 'Übergang in Spikes, Zugwiderstandsläufe (ZWL / 1080), Pushbull & French Contrast Training (FCT vertikal/horizontal)',
      durationDays: 45,
      years: {
        2026: { start: '2026-10-08', end: '2026-11-21', note: 'Ab 08.10.2026 1080-Sprints • Geplanter Übergang in Block 2 (Halle, Spikes & FCT) ab 26.10. oder 02.11.2026' },
        2025: { start: '2025-10-17', end: '2025-11-30', note: '17.10.2025 erstes Mal Spikes + FCT vertikal/horizontal + Sekundenläufe bis 01.11.25 • Danach 1 Monat Bundeswehr-Grundausbildung' },
        2024: { start: '2024-11-04', end: '2024-12-18', note: 'Spezifischer Aufbau Mannheim ab Nov 2024 • Erste Sprünge in die Grube am 03.12.2024' },
        2023: { start: '2023-09-20', end: '2023-11-03', note: '20.09.2023 erstes Mal Spikes (Münster), viel spezifische Kraft, ZWL & Pushbull • 12.10.2023 erste Sprünge in die Grube' },
        2022: { start: '2022-10-03', end: '2022-11-16', note: '03.10.2022 Start Pushbull & ZWL (Münster) • 20.10.2022 erste Sprünge in die Grube (Gewicht ~78.35 kg)' },
        2021: { start: '2021-11-01', end: '2021-12-15', note: 'Spezifischer Herbstblock 2021' },
        2020: { start: '2020-10-26', end: '2020-12-09', note: 'Spezifischer Herbstblock 2020' },
        2019: { start: '2019-10-28', end: '2019-12-11', note: 'Reha-Block Herbst 2019 nach Jumpers-Knee-OP' }
      }
    },
    'hallenvorbereitung': {
      title: '3. Erste Sprünge in die Grube & Hallen-UWV',
      subtitle: 'Synchronisiert ab den ersten Sprüngen in die Grube (3er/5er/7er/9er/11er/13er/15er Anläufe) bis zum Hallen-Einstieg',
      durationDays: 50,
      years: {
        2026: { start: '2025-12-02', end: '2026-01-22', note: '02.12.2025 erste Sprünge in die Grube (nach BW-Grundausbildung) • FCT vertikal/horizontal + 1080 ➔ 8.18m PB Gorzów (31.01.2026)!' },
        2025: { start: '2024-12-03', end: '2025-01-17', note: '03.12.2024 erste Sprünge in die Grube ➔ Hallensaison 2025 (7.71m Sindelfingen, 7.67m DM Dortmund)' },
        2024: { start: '2023-11-27', end: '2024-01-19', note: 'Hallen-UWV nach Trainerwechsel Mannheim ➔ 7.73m DM Halle Leipzig (18.02.2024)' },
        2023: { start: '2022-10-20', end: '2022-12-08', note: '20.10.2022 erste Sprünge in die Grube (Münster) ➔ 7.72m DM Halle Dortmund & 6.76s 60m PB (Feb 2023)' },
        2022: { start: '2021-11-29', end: '2022-01-20', note: 'Hallen-UWV 2021/22 ➔ 7.50m Münster Halle (03.02.2022)' },
        2021: { start: '2020-12-07', end: '2021-01-21', note: 'Hallen-UWV 2020/21' },
        2020: { start: '2019-12-02', end: '2020-01-17', note: 'Aufbau 2019/20 nach Knie-OP' },
        2019: { start: '2019-01-01', end: '2019-01-25', note: 'Hallen-UWV 2019' }
      }
    },
    'hallensaison': {
      title: '4. Hallen-Wettkampfsaison (Indoor)',
      subtitle: 'Alle Hallen-Wettkämpfe, ZNS-Steuerung & Belastungsverlauf zwischen den Meetings',
      durationDays: 55,
      years: {
        2026: { start: '2026-01-23', end: '2026-03-22', note: '5 WKs (Ø 7.80m, Ø 84.94 kg): 31.01. Gorzów 8.18m PB! • 02.–06.02. Krank • Ab 18.02. Achilles L • 28.02. DM Dortmund 7.78m • 22.03. Hallen-WM Toruń 7.68m' },
        2025: { start: '2025-01-18', end: '2025-03-02', note: '6 WKs (Ø 7.52m, Ø 81.05 kg): 18.01. Sindelfingen 7.71m • 09.02. Düsseldorf 7.60m • 22.02. DM Dortmund 7.67m' },
        2024: { start: '2024-01-20', end: '2024-02-25', note: '2 WKs (Ø 7.61m, Ø 80.26 kg): 04.02. Rochlitz 7.49m • 18.02. DM Halle Leipzig 7.73m' },
        2023: { start: '2023-01-15', end: '2023-02-25', note: '4 WKs (Ø 7.50m, Ø 81.27 kg): 18.02. 60m PB 6.76s • 19.02. DM Halle Dortmund 7.72m (7.61m Essen, 7.36m Weinheim, 7.31m Neubrandenburg)' },
        2022: { start: '2022-01-15', end: '2022-02-28', note: '3 WKs (Ø 7.38m, Ø 82.0 kg): 03.02. Münster 7.50m • 29.01. Leverkusen 7.44m • 27.02. DM Leipzig 7.21m' },
        2021: { start: '2021-01-23', end: '2021-02-28', note: 'Hallensaison 2021' },
        2020: { start: '2020-01-18', end: '2020-02-25', note: 'Hallensaison 2020' },
        2019: { start: '2019-01-19', end: '2019-02-24', note: 'Hallensaison 2019' }
      }
    },
    'sommeraufbau': {
      title: '5. Frühjahrs-Aufbau & Trainingslager (März – Mai)',
      subtitle: 'Übergang Halle ➔ Freiluft, Trainingslager & Anlauf-Entwicklung (7er bis 19er)',
      durationDays: 50,
      years: {
        2026: { start: '2026-03-30', end: '2026-05-15', note: 'Frühjahrsblock nach Hallen-WM Toruń (Gewicht ~85.9–87.05 kg, Achilles L & Unterer Rücken)' },
        2025: { start: '2025-03-17', end: '2025-05-14', note: 'Frühjahrsblock 2025 (Mannheim) vor 7.94m Essen & 8.01m Vari/Athen (Gewicht ~83.2–84.3 kg)' },
        2024: { start: '2024-03-11', end: '2024-05-08', note: 'Frühjahrsblock 2024 ➔ gezielte Gewichtsreduktion auf 79.80 kg bis EM Rom (8.08m / 8.01m)!' },
        2023: { start: '2023-03-13', end: '2023-05-19', note: 'Frühjahrsblock 2023 (Münster) ➔ Durchbruch-Sommer mit 7.91m DM Kassel & 8.14m Inneringen!' },
        2022: { start: '2022-03-14', end: '2022-05-15', note: 'Frühjahrsblock 2022' },
        2021: { start: '2021-03-15', end: '2021-05-14', note: 'Frühjahrsblock 2021 ➔ 7.58m Koblenz' },
        2020: { start: '2020-03-16', end: '2020-05-15', note: 'Frühjahrsblock 2020' },
        2019: { start: '2019-03-18', end: '2019-05-15', note: 'Frühjahrsblock 2019' }
      }
    },
    'sommersaison': {
      title: '6. Sommer-Wettkampfsaison & Meisterschaften (Mai – August)',
      subtitle: 'Alle Freiluft-Wettkämpfe, Meisterschaften & Gewichtstrends aus Google Sheets',
      durationDays: 95,
      years: {
        2026: { start: '2026-05-16', end: '2026-08-30', note: '8 WKs (Best 7.86m DM Bochum, 7.84m Rhede, 7.80m Mainz • Ø 7.67m • Ø Gewicht 86.16 kg)' },
        2025: { start: '2025-05-15', end: '2025-08-25', note: '12 WKs (Best 8.01m Vari/Athen 05.07., 2x 7.96m FISU Bochum, 7.94m Essen, 7.91m Dessau • Ø 7.81m / ohne Duisburg Ø 7.86m • Ø Gewicht 84.13 kg)' },
        2024: { start: '2024-05-09', end: '2024-08-05', note: '11 WKs (Best 8.08m EM Rom Q 07.06. & 8.01m EM Rom F 08.06. bei 79.80 kg! 7.84m La Chaux-de-Fonds • Ø 7.78m • Ø Gewicht 80.99 kg)' },
        2023: { start: '2023-05-20', end: '2023-08-15', note: '8 WKs (Durchbruch! Best 8.14m Inneringen 30.07., 7.91m DM Kassel 09.07. + 100m 10.37s, 2x 7.85m • Ø 7.81m • Ø Gewicht 81.03 kg)' },
        2022: { start: '2022-05-15', end: '2022-08-15', note: '2 WKs (7.06m Essen 12.06.22, 6.99m München 21.05.22 • Ø Gewicht ~82.0 kg)' },
        2021: { start: '2021-05-15', end: '2021-08-15', note: '8 WKs (Best 7.58m Koblenz 27.06.21, 7.51m Langenfeld • Ø 7.36m • Ø Gewicht ~83.46 kg)' },
        2020: { start: '2020-06-01', end: '2020-08-30', note: '6 WKs nach Knie-OP (Best 7.13m München, 7.12m Bottrop)' },
        2019: { start: '2019-05-16', end: '2019-08-25', note: 'Vor Knie-OP Sept 2019 (Best 7.35m Münster 12.05.19)' }
      }
    }
  };

  const DOMAIN_FILTERS = {
    'ALL': { label: '🌐 Alle Bereiche', keywords: [] },
    'JUMP_SPIKES': {
      label: '👟 Sprung, Grube & Spikes (3er–19er)',
      keywords: ['sprung', 'weitsprung', 'anlauf', 'spikes', 'grube', 'absprung', 'pop', 'hebung', 'landung', '3er', '5er', '7er', '9er', '11er', '13er', '15er', '17er', '19er', 'technik', 'brett', 'balken', 'sprunglauf', 'imitation']
    },
    'SPRINT_MAXV': {
      label: '⚡ Sprint, 1080, ZWL/ZUL & Pushbull',
      keywords: ['sprint', '1080', 'zwl', 'zul', 'pushbull', 'overspeed', 'assisted', 'resisted', 'fliegend', 'flg', '30m', '40m', '60m', '100m', 'schnelligkeit', 'vmax', 'hochstart', 'tiefstart', 'start', 'beschleunigung', 'frequenzen', 'zugwiderstand', 'sekundenläufe']
    },
    'STRENGTH_FCT': {
      label: '🏋️ Kraft, FCT (vert./hor.) & Explosiv',
      keywords: ['kraft', 'fct', 'fct vertikal', 'fct horizontal', 'umsetzen', 'trapbar', 'hipthrust', 'hip-thrust', 'hip thrust', 'aufsteiger', 'kniebeuge', 'reißen', 'reissen', 'bankdrücken', 'hantelsprünge', 'kettlebell', 'ausfallschritt', 'nordics']
    },
    'PLYO_REACTIVE': {
      label: '🦘 Plyos, Hürden & Reaktiv (DJ/CMJ)',
      keywords: ['hürden', 'hürde', 'plyo', 'mehrfach', 'hop', 'step', 'prell', 'drop jump', 'drop-jump', 'dj', 'cmj', 'broad jump', 'assisted jumps', 'kasten', 'schockwurf', 'medball', 'kugel', 'reaktiv']
    },
    'TEMPO_REGEN': {
      label: '🏃 Tempoläufe, Stabi & Regeneration',
      keywords: ['tempoläufe', 'tempo', 'sekundenläufe', 'ausdauer', 'stabi', 'turnen', 'rumpf', 'fuß', 'fuss', 'dehnen', 'beweglichkeit', 'mobi', 'regeneration', 'physio', 'sauna', 'lympho', 'blackroll']
    }
  };

  function getCustomBlockConfig() {
    try {
      const saved = localStorage.getItem('luka_custom_year_blocks_v7_1');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {};
  }

  function saveCustomBlockStart(presetKey, year, newStartIso) {
    if (!newStartIso || !/^\d{4}-\d{2}-\d{2}$/.test(newStartIso)) return;
    const custom = getCustomBlockConfig();
    if (!custom[presetKey]) custom[presetKey] = {};
    custom[presetKey][year] = newStartIso;
    try {
      localStorage.setItem('luka_custom_year_blocks_v7_1', JSON.stringify(custom));
    } catch (e) { /* ignore */ }
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function shiftYearBlockStart(presetKey, year, deltaDays) {
    const cfg = getBlockDefinitionForYear(presetKey, year);
    const shifted = addDays(cfg.start, deltaDays);
    saveCustomBlockStart(presetKey, year, shifted);
  }

  function resetCustomBlockStarts() {
    try {
      localStorage.removeItem('luka_custom_year_blocks_v7_1');
    } catch (e) { /* ignore */ }
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function getBlockDefinitionForYear(presetKey, year) {
    const preset = DEFAULT_YEAR_BLOCKS[presetKey] || DEFAULT_YEAR_BLOCKS['aufbau_gpp'];
    const base = (preset.years && preset.years[year]) || {
      start: `${year}-10-01`,
      end: `${year}-11-14`,
      note: `Standard-Zeitraum ${year}`
    };
    const custom = getCustomBlockConfig();
    const customStart = custom[presetKey] && custom[presetKey][year];
    if (customStart) {
      const dur = preset.durationDays || 45;
      return {
        start: customStart,
        end: addDays(customStart, dur),
        note: `${base.note} (Start manuell: ${formatDisplayDate(customStart)})`,
        isCustom: true
      };
    }
    return base;
  }

  function matchesDomainFilter(log, domainKey) {
    if (!domainKey || domainKey === 'ALL') return true;
    if (!log) return false;
    const dom = DOMAIN_FILTERS[domainKey];
    if (!dom || !dom.keywords.length) return true;
    const blob = [
      log.session_type,
      log.focus,
      log.protocol_text,
      log.protocol,
      log.learnings
    ].filter(Boolean).join(' ').toLowerCase();
    return dom.keywords.some(kw => blob.includes(kw));
  }

  function initWeekStart(state) {
    if (initializedWeek) return;
    const logs = (state && state.trainingLogs) || [];
    if (logs.length > 0) {
      const dates = logs.map(l => l.date).filter(Boolean).sort();
      const latest = dates[dates.length - 1];
      if (latest) {
        currentWeekStart = getMondayOfDate(latest);
      }
    }
    initializedWeek = true;
  }

  function getMondayOfDate(dStr) {
    if (!dStr) return '2026-10-12';
    const parts = dStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.getFullYear(), d.getMonth(), diff);
    const y = mon.getFullYear();
    const m = String(mon.getMonth() + 1).padStart(2, '0');
    const dayNum = String(mon.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNum}`;
  }

  function addDays(dStr, days) {
    if (!dStr) return '';
    const parts = dStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNum}`;
  }

  function formatDisplayDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  function getWeekNumber(dStr) {
    const d = new Date(dStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `KW ${weekNo}`;
  }

  function formatScore1to4Badge(scoreVal, isInverted = false) {
    if (scoreVal == null || scoreVal === '') return '-';
    let v = Number(scoreVal);
    if (isNaN(v)) return String(scoreVal);
    if (v > 4) v = Math.max(1, Math.min(4, Math.round(v / 2.5)));
    const labelsPos = { 1: '1 (Schlecht)', 2: '2 (Normal)', 3: '3 (Gut)', 4: '4 (Super)' };
    const labelsInv = { 1: '1 (Keine/Wenig)', 2: '2 (Leicht)', 3: '3 (Mittel)', 4: '4 (Stark)' };
    return isInverted ? (labelsInv[v] || `${v}/4`) : (labelsPos[v] || `${v}/4`);
  }

  // Always preserve Luka's exact Trainingseinheit string from Google Sheets!
  function getSessionBadge(typeStr) {
    const label = (typeStr || 'Training').trim();
    const s = label.toLowerCase();
    if (s.includes('wettkampf') || s.includes('wk')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-rose-950 text-rose-300 border border-rose-800">🏆 ${label}</span>`;
    }
    if (s.includes('sprung')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-950 text-amber-300 border border-amber-800">👟 ${label}</span>`;
    }
    if (s.includes('kraft')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-800">🏋️ ${label}</span>`;
    }
    if (s.includes('sprint') || s.includes('koordination')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-purple-950 text-purple-300 border border-purple-800">⚡ ${label}</span>`;
    }
    if (s.includes('tempo') || s.includes('ausdauer')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-800">🏃 ${label}</span>`;
    }
    if (s.includes('stabi') || s.includes('turnen')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-indigo-950 text-indigo-300 border border-indigo-800">🤸 ${label}</span>`;
    }
    if (s.includes('regeneration') || s.includes('frei') || s.includes('pause')) {
      return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-blue-950 text-blue-300 border border-blue-800">🧘‍♂️ ${label}</span>`;
    }
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-800 text-slate-300 border border-slate-700">📋 ${label}</span>`;
  }

  function render(state) {
    initWeekStart(state);
    const container = document.getElementById('tabContentPlan');
    if (!container) return;

    const logs = state.trainingLogs || [];

    container.innerHTML = `
      <!-- 1. Header Toolbar: Mode Selector & Filters -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">📋</span>
              <h2 class="text-sm font-black text-white uppercase tracking-wider font-mono">
                TRAININGSPLAN, INDIVIDUELLER BLOCKVERGLEICH & MUSTER-LABOR (2019 – 2026)
              </h2>
            </div>
            <p class="text-[11px] text-slate-400 font-sans mt-0.5">
              ${logs.length.toLocaleString('de-DE')} dokumentierte Tage • Individuelle Block-Grenzen pro Jahr • Klickbare Session-Vorschau • Karriere-Musteranalyse
            </p>
          </div>

          <!-- View Tabs -->
          <div class="flex items-center gap-1 flex-wrap bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button onclick="TrainingPlanModule.switchView('block')" id="planViewBlockBtn" class="px-2.5 py-1.5 rounded-md font-bold transition-all ${activeView === 'block' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              📊 Blockvergleich
            </button>
            <button onclick="TrainingPlanModule.switchView('career_lab')" id="planViewCareerBtn" class="px-2.5 py-1.5 rounded-md font-bold transition-all ${activeView === 'career_lab' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-amber-300 hover:text-white'}">
              🧬 Muster-Analyse (2022–26)
            </button>
            <button onclick="TrainingPlanModule.switchView('week')" id="planViewWeekBtn" class="px-2.5 py-1.5 rounded-md font-bold transition-all ${activeView === 'week' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              📅 Wochen-Plan
            </button>
            <button onclick="TrainingPlanModule.switchView('month')" id="planViewMonthBtn" class="px-2.5 py-1.5 rounded-md font-bold transition-all ${activeView === 'month' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              🗓️ Monats-Übersicht
            </button>
            <button onclick="TrainingPlanModule.switchView('search')" id="planViewSearchBtn" class="px-2.5 py-1.5 rounded-md font-bold transition-all ${activeView === 'search' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              🔍 Protokoll-Suche
            </button>
          </div>
        </div>

        <!-- Dynamic Control Bar based on Active View -->
        <div id="planDynamicControlBar" class="space-y-2.5">
          ${renderControlsForView(state)}
        </div>
      </div>

      <!-- 2. Main Content Viewport -->
      <div id="planMainViewport" class="space-y-4">
        ${renderViewportContent(state)}
      </div>
    `;
  }

  function renderControlsForView(state) {
    if (activeView === 'week') {
      const kw = getWeekNumber(currentWeekStart);
      const sun = addDays(currentWeekStart, 6);
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="TrainingPlanModule.navigateWeek(-1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
              ◀ Vorherige Woche
            </button>
            <div class="px-3 py-1 rounded bg-slate-950 border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300">
              ${kw} (${formatDisplayDate(currentWeekStart)} – ${formatDisplayDate(sun)})
            </div>
            <button onclick="TrainingPlanModule.navigateWeek(1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
              Nächste Woche ▶
            </button>
            <button onclick="TrainingPlanModule.jumpToWeek('2026-10-12')" class="px-2.5 py-1 rounded transition-all text-xs font-mono font-bold ${currentWeekStart === '2026-10-12' ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-cyan-400 border border-slate-800 hover:bg-slate-800'}">
              📍 KW 42 (12.10.–18.10.)
            </button>
            <button onclick="TrainingPlanModule.jumpToWeek('2026-10-05')" class="px-2.5 py-1 rounded transition-all text-xs font-mono font-bold ${currentWeekStart === '2026-10-05' ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              📋 KW 41 (05.10.–11.10.)
            </button>
          </div>

          <div class="flex items-center gap-2 text-xs font-mono">
            <label class="text-slate-400">Direktes Datum:</label>
            <input type="date" value="${currentWeekStart}" onchange="TrainingPlanModule.onWeekDatePicked(this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none" />
          </div>
        </div>
      `;
    }

    if (activeView === 'month') {
      const parts = currentMonthYear.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      return `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="TrainingPlanModule.navigateMonth(-1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
              ◀ Vorheriger Monat
            </button>
            <div class="px-3 py-1 rounded bg-slate-950 border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300">
              ${monthNames[month - 1]} ${year}
            </div>
            <button onclick="TrainingPlanModule.navigateMonth(1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
              Nächster Monat ▶
            </button>
          </div>

          <div class="flex items-center gap-2 text-xs font-mono">
            <select onchange="TrainingPlanModule.onMonthYearSelected(this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none">
              ${[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].map(y => `
                <option value="${y}" ${y === year ? 'selected' : ''}>Jahr ${y}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    }

    if (activeView === 'block') {
      return `
        <!-- Row 1: Phase / Block Presets (Year-Specific Dates instead of rigid calendar weeks!) -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-slate-800/80 text-xs font-mono">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-slate-400 font-bold uppercase text-[10px]">1. Trainingsphase (Individuell je Jahr):</span>
            <button onclick="TrainingPlanModule.setBlockPreset('aufbau_gpp')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'aufbau_gpp' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              🍂 1. Aufbau (GPP Start)
            </button>
            <button onclick="TrainingPlanModule.setBlockPreset('spezial_fct_spikes')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'spezial_fct_spikes' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              ⚡ 2. Spezialblock (FCT / 1080 / Spikes)
            </button>
            <button onclick="TrainingPlanModule.setBlockPreset('hallenvorbereitung')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'hallenvorbereitung' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              ❄️ 3. Hallen-UWV (Anlauf)
            </button>
            <button onclick="TrainingPlanModule.setBlockPreset('hallensaison')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'hallensaison' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              🏟️ 4. Hallensaison
            </button>
            <button onclick="TrainingPlanModule.setBlockPreset('sommeraufbau')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'sommeraufbau' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              🌱 5. Frühjahrs-TL
            </button>
            <button onclick="TrainingPlanModule.setBlockPreset('sommersaison')" class="px-2.5 py-1 rounded transition-all font-bold text-[11px] ${activeBlockPreset === 'sommersaison' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
              ☀️ 6. Sommersaison
            </button>
          </div>

          <!-- Sync Mode Toggle (Block-Tag 1..N vs Kalender-Datum) -->
          <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button onclick="TrainingPlanModule.setBlockSyncMode('block_day')" class="px-2.5 py-1 rounded font-bold transition-all ${blockSyncMode === 'block_day' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}" title="Synchronisiert Tag 1 des jeweiligen Blocks (z.B. 17.10.2024 = Tag 1 Aufbau direkt unter 15.09.2025 = Tag 1 Aufbau)">
              🎯 Block-Synchron (Tag 1..N)
            </button>
            <button onclick="TrainingPlanModule.setBlockSyncMode('calendar_date')" class="px-2.5 py-1 rounded font-bold transition-all ${blockSyncMode === 'calendar_date' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}" title="Zeigt gleiches Kalenderdatum (z.B. Oktober bis November)">
              📅 Kalender-Synchron
            </button>
          </div>
        </div>

        <!-- Row 2: Granular Domain Filter Presets & Year Toggles -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs font-mono">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-slate-400 font-bold uppercase text-[10px]">2. Trainingsbereich-Fokus:</span>
            ${Object.entries(DOMAIN_FILTERS).map(([key, cfg]) => `
              <button onclick="TrainingPlanModule.setDomainFilter('${key}')" class="px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                activeDomainFilter === key
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
              }">
                ${cfg.label}
              </button>
            `).join('')}
            ${activeDomainFilter !== 'ALL' ? `
              <button onclick="TrainingPlanModule.toggleHideNonMatchingDomainDays()" class="px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                hideNonMatchingDomainDays
                  ? 'bg-cyan-600 text-slate-950 font-black'
                  : 'bg-slate-900 text-cyan-300 border border-cyan-800'
              }">
                ${hideNonMatchingDomainDays ? '✓ Nur Treffer-Tage' : 'Alle Tage (Treffer markiert)'}
              </button>
            ` : ''}
          </div>

          <div class="flex items-center gap-1 flex-wrap">
            <span class="text-slate-400 text-[10px] uppercase font-bold mr-1">Jahre:</span>
            ${[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].map(y => `
              <button onclick="TrainingPlanModule.toggleBlockYear(${y})" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                activeBlockYears.includes(y)
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-slate-950 text-slate-500 border border-slate-800'
              }">
                ${y}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (activeView === 'career_lab') {
      return `
        <div class="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <span class="text-amber-300 font-bold">
            🔬 100% Google-Sheets-verifizierte Tiefenanalyse (2.355 Tage • 57 Weitsprung-WKs • Tag +1 / Tag 0 Korrelationen & KW 43 Entscheidungs-Check)
          </span>
          <button onclick="TrainingPlanModule.switchView('block')" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold">
            ← Zurück zum Blockvergleich
          </button>
        </div>
      `;
    }

    if (activeView === 'search') {
      return `
        <div class="w-full relative">
          <input type="text" value="${planSearchQuery}" oninput="TrainingPlanModule.onSearchInput(this.value)" placeholder="Volltextsuche in allen 2.355 Protokollen (z.B. 'FCT vertikal', 'FCT horizontal', '1080', 'ZWL', 'ZUL', 'Pushbull', '7er', '9er', 'Gorzów', 'Inneringen', 'Rom')..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono" />
        </div>
      `;
    }

    return '';
  }

  function renderViewportContent(state) {
    if (activeView === 'week') return renderWeekView(state);
    if (activeView === 'month') return renderMonthView(state);
    if (activeView === 'block') return renderBlockComparisonView(state);
    if (activeView === 'career_lab') return renderCareerPatternLabView(state);
    if (activeView === 'search') return renderSearchView(state);
    return '';
  }

  // ================= 1. WOCHEN-ANSICHT (MONTAG BIS SONNTAG) =================
  function renderWeekView(state) {
    const logs = state.trainingLogs || [];
    const logsByDate = {};
    logs.forEach(l => {
      if (l.date) {
        if (!logsByDate[l.date]) logsByDate[l.date] = [];
        logsByDate[l.date].push(l);
      }
    });

    const days = [
      { name: 'Montag', offset: 0 },
      { name: 'Dienstag', offset: 1 },
      { name: 'Mittwoch', offset: 2 },
      { name: 'Donnerstag', offset: 3 },
      { name: 'Freitag', offset: 4 },
      { name: 'Samstag', offset: 5 },
      { name: 'Sonntag', offset: 6 }
    ];

    const weekCardsHtml = days.map(d => {
      const dateIso = addDays(currentWeekStart, d.offset);
      const dayLogs = logsByDate[dateIso] || [];
      const hasSession = dayLogs.length > 0;
      const isToday = dateIso === '2026-10-15' || dateIso === '2026-10-17';

      return `
        <div class="bg-slate-900 border ${isToday ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10' : 'border-slate-800'} rounded-xl p-3 sm:p-4 space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-sm text-white">${d.name}</span>
              <span class="text-xs font-mono text-slate-400">${formatDisplayDate(dateIso)}</span>
              ${isToday ? '<span class="px-1.5 py-0.2 rounded bg-cyan-900 text-cyan-300 border border-cyan-700 font-mono font-bold text-[9px]">AKTUELL</span>' : ''}
            </div>
            <div class="flex items-center gap-2">
              ${hasSession ? `<span class="text-[10px] font-mono font-bold text-slate-400">${dayLogs.length} ${dayLogs.length === 1 ? 'Einheit' : 'Einheiten'}</span>` : '<span class="text-[10px] font-mono text-slate-500 italic">Ruhetag</span>'}
              <button onclick="TrainingPlanModule.openInReadinessTab('${dateIso}')" class="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 font-bold underline">
                Readiness ➔
              </button>
            </div>
          </div>

          ${hasSession ? dayLogs.map((log, sIdx) => {
            const recovery = log.whoop_recovery_pct;
            const sleep = log.sleep_performance_pct;
            const strain = log.whoop_strain;
            const protocolText = log.protocol_text || log.protocol || '';

            return `
              <div class="bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    ${dayLogs.length > 1 ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-slate-800 text-white">#${sIdx + 1}</span>` : ''}
                    ${getSessionBadge(log.session_type)}
                    ${log.focus ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-amber-300 border border-amber-900/50">${log.focus}</span>` : ''}
                    ${log.duration_min > 0 ? `<span class="text-[11px] font-mono text-slate-300">⏱️ ${log.duration_min} min</span>` : ''}
                    ${log.venue ? `<span class="text-[10px] font-mono text-cyan-400">📍 ${log.venue}</span>` : ''}
                  </div>

                  <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    ${log.best_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">WK: ${log.best_mark_m}m</span>` : ''}
                    ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">Eff: ${log.eff_mark_m}m</span>` : ''}
                    ${log.approach_speed_11m_to_1m ? `<span class="text-cyan-300 font-bold">Vmax: ${log.approach_speed_11m_to_1m} m/s</span>` : ''}
                    ${log.trapbar_e1rm_kg ? `<span class="text-purple-300 font-bold">Trapbar: ${log.trapbar_e1rm_kg} kg</span>` : ''}
                    ${log.hipthrust_e1rm_kg ? `<span class="text-rose-300 font-bold">HipThrust: ${log.hipthrust_e1rm_kg} kg</span>` : ''}
                  </div>
                </div>

                ${(recovery != null || sleep != null || strain != null) ? `
                  <div class="flex items-center gap-3 text-[10px] font-mono bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800 flex-wrap">
                    <span class="text-slate-400 font-bold">Whoop:</span>
                    ${recovery != null ? `<span class="${recovery >= 67 ? 'text-emerald-400' : (recovery >= 34 ? 'text-amber-400' : 'text-rose-400')} font-bold">Recovery: ${recovery}%</span>` : ''}
                    ${sleep != null ? `<span class="text-cyan-300">Schlaf: ${sleep}%</span>` : ''}
                    ${strain != null ? `<span class="text-purple-300">Strain: ${strain.toFixed ? strain.toFixed(1) : strain}</span>` : ''}
                    ${log.performance_score != null ? `<span class="text-emerald-300">Leistung: ${formatScore1to4Badge(log.performance_score, false)}</span>` : ''}
                  </div>
                ` : ''}

                ${protocolText ? `
                  <div class="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div class="text-[10px] font-mono text-cyan-400 font-bold uppercase">📋 Dokumentiertes Protokoll</div>
                    <div class="font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/80">${protocolText}</div>
                  </div>
                ` : `<div class="text-[11px] font-mono text-slate-500 italic py-1">Kein Freitext-Protokoll hinterlegt.</div>`}
              </div>
            `;
          }).join('') : `
            <div class="py-4 text-center text-slate-500 font-mono text-xs italic bg-slate-950/40 rounded-lg border border-slate-800/40">
              🧘‍♂️ Ruhetag / Keine Einheit dokumentiert
            </div>
          `}
        </div>
      `;
    }).join('');

    return `<div class="space-y-3">${weekCardsHtml}</div>`;
  }

  // ================= 2. MONATS-ÜBERSICHT =================
  function renderMonthView(state) {
    const logs = state.trainingLogs || [];
    const logsByDate = {};
    logs.forEach(l => {
      if (l.date) {
        if (!logsByDate[l.date]) logsByDate[l.date] = [];
        logsByDate[l.date].push(l);
      }
    });

    const parts = currentMonthYear.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);
    const dayHeaders = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    let cellsHtml = '';
    for (let i = 0; i < startOffset; i++) {
      cellsHtml += `<div class="bg-slate-950/40 border border-slate-800/40 rounded-lg p-1.5 opacity-30 min-h-[90px]"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLogs = logsByDate[dateIso] || [];
      const isToday = dateIso === '2026-10-15' || dateIso === '2026-10-17';

      cellsHtml += `
        <div onclick="TrainingPlanModule.openSessionPreviewModal('${dateIso}')" class="bg-slate-900 border ${isToday ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'} rounded-lg p-2 flex flex-col justify-between min-h-[95px] cursor-pointer transition-all hover:bg-slate-850">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold ${isToday ? 'text-cyan-400 font-black' : 'text-slate-300'}">${day}.</span>
            ${(() => {
              const rec = dayLogs.find(l => l.whoop_recovery_pct != null)?.whoop_recovery_pct;
              if (rec != null) {
                if (rec >= 67) return `<span class="w-2 h-2 rounded-full bg-emerald-400" title="Whoop Recovery: ${rec}%"></span>`;
                if (rec >= 34) return `<span class="w-2 h-2 rounded-full bg-amber-400" title="Whoop Recovery: ${rec}%"></span>`;
                return `<span class="w-2 h-2 rounded-full bg-rose-400" title="Whoop Recovery: ${rec}%"></span>`;
              }
              return '';
            })()}
          </div>

          <div class="space-y-1 my-1">
            ${dayLogs.slice(0, 2).map(l => `
              <div class="text-[9px] font-mono truncate px-1 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                ${l.session_type || 'Training'} ${l.focus ? '• ' + l.focus : ''}
              </div>
            `).join('')}
          </div>

          <div class="text-[9px] font-mono text-slate-500 truncate">
            ${dayLogs[0]?.best_mark_m ? `⭐ ${dayLogs[0].best_mark_m}m` : (dayLogs[0]?.duration_min ? `⏱️ ${dayLogs[0].duration_min}m` : '')}
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
        <div class="grid grid-cols-7 gap-1.5 text-center font-mono font-bold text-xs text-slate-400 pb-2 border-b border-slate-800">
          ${dayHeaders.map(h => `<div>${h}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-1.5">
          ${cellsHtml}
        </div>
      </div>
    `;
  }

  // ================= 3. INDIVIDUELLER MEHRJAHRES-BLOCKVERGLEICH (2019 - 2026) =================
  function renderBlockComparisonView(state) {
    const logs = state.trainingLogs || [];
    const logsByDate = {};
    logs.forEach(l => {
      if (l.date) logsByDate[l.date] = l;
    });

    const curPresetObj = DEFAULT_YEAR_BLOCKS[activeBlockPreset] || DEFAULT_YEAR_BLOCKS['aufbau_gpp'];
    const domainObj = DOMAIN_FILTERS[activeDomainFilter] || DOMAIN_FILTERS['ALL'];

    // Compute year-specific block statistics using each year's authentic start & end dates
    const yearStats = activeBlockYears.map(year => {
      const yCfg = getBlockDefinitionForYear(activeBlockPreset, year);
      const startIso = yCfg.start;
      const endIso = yCfg.end;

      const blockLogs = logs.filter(l => l.date && l.date >= startIso && l.date <= endIso);
      const realSessions = blockLogs.filter(l => {
        const sType = (l.session_type || '').toLowerCase();
        const f = (l.focus || '').toLowerCase();
        const dur = l.duration_min || 0;
        const hasProt = Boolean(l.protocol_text && l.protocol_text.trim().length > 2);
        return (dur > 0 || hasProt) && !sType.includes('frei') && !sType.includes('ruhetag') && !f.includes('ruhetag');
      });

      const domainMatches = realSessions.filter(l => matchesDomainFilter(l, activeDomainFilter));
      const jumpSpikesSessions = realSessions.filter(l => matchesDomainFilter(l, 'JUMP_SPIKES')).length;
      const sprintSessions = realSessions.filter(l => matchesDomainFilter(l, 'SPRINT_MAXV')).length;
      const strengthSessions = realSessions.filter(l => matchesDomainFilter(l, 'STRENGTH_FCT')).length;

      const peakUmsetzen = blockLogs.reduce((max, l) => Math.max(max, l.umsetzen_e1rm_kg || 0), 0);
      const peakHipthrust = blockLogs.reduce((max, l) => Math.max(max, l.hipthrust_e1rm_kg || 0), 0);
      const peakTrapbar = blockLogs.reduce((max, l) => Math.max(max, l.trapbar_e1rm_kg || 0), 0);
      const peakAufsteiger = blockLogs.reduce((max, l) => Math.max(max, l.aufsteiger_e1rm_kg || 0), 0);
      const peakMark = blockLogs.reduce((max, l) => Math.max(max, l.best_mark_m || 0), 0);

      const bwsExact = blockLogs.map(l => l.body_weight_kg).filter(v => v != null && v > 50);
      const bwsTrend = blockLogs.map(l => l.body_weight_kg || l.ref_body_weight_kg).filter(v => v != null && v > 50);
      const avgBwVal = bwsExact.length > 0
        ? (bwsExact.reduce((a, b) => a + b, 0) / bwsExact.length)
        : (bwsTrend.length > 0 ? (bwsTrend.reduce((a, b) => a + b, 0) / bwsTrend.length) : null);
      const avgBwStr = avgBwVal != null
        ? `${avgBwVal.toFixed(1)} kg${bwsExact.length === 0 ? ' (Trend)' : ''}`
        : '-';

      const recoveries = blockLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
      const avgRecovery = recoveries.length > 0 ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null;

      return {
        year,
        yCfg,
        blockLogs,
        realSessions,
        domainMatchesCount: domainMatches.length,
        jumpSpikesSessions,
        sprintSessions,
        strengthSessions,
        totalSessions: realSessions.length,
        avgBwStr,
        peakUmsetzen: peakUmsetzen > 0 ? `${peakUmsetzen} kg` : '-',
        peakHipthrust: peakHipthrust > 0 ? `${peakHipthrust} kg` : '-',
        peakTrapbar: peakTrapbar > 0 ? `${peakTrapbar} kg` : '-',
        peakAufsteiger: peakAufsteiger > 0 ? `${peakAufsteiger} kg` : '-',
        peakMark: peakMark > 0 ? `${peakMark.toFixed(2)}m` : '-',
        avgRecovery: avgRecovery != null ? `${avgRecovery}%` : '-'
      };
    });

    return `
      <div class="space-y-4">
        <!-- 1. Comparative KPI & Block Boundary Matrix -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <h3 class="text-xs font-black text-white uppercase tracking-wider font-mono">
                📊 JAHRES-SPEZIFISCHER BLOCKVERGLEICH: ${curPresetObj.title.toUpperCase()}
              </h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">
                ${curPresetObj.subtitle} • Fokus-Filter: <strong class="text-emerald-400">${domainObj.label}</strong>
              </p>
            </div>
            <button onclick="TrainingPlanModule.resetCustomBlockStarts()" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10px] font-mono">
              ↺ Block-Startdaten zurücksetzen
            </button>
          </div>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Jahr</th>
                  <th class="py-2 px-2.5">Individueller Block-Zeitraum & Meilensteine</th>
                  <th class="py-2 px-2 text-center">Einheiten</th>
                  <th class="py-2 px-2 text-center text-cyan-300">⚖️ Ø Gewicht</th>
                  <th class="py-2 px-2 text-center text-amber-300">👟 Sprung/Grube</th>
                  <th class="py-2 px-2 text-center text-purple-300">⚡ Sprint/1080/ZWL</th>
                  <th class="py-2 px-2 text-center text-emerald-300">🏋️ Kraft/FCT</th>
                  <th class="py-2 px-2 text-right">Umsetzen</th>
                  <th class="py-2 px-2 text-right">Hip-Thrust</th>
                  <th class="py-2 px-2 text-right">Trapbar</th>
                  <th class="py-2 px-2.5 text-right">WK-Best</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${yearStats.map(ys => `
                  <tr class="hover:bg-slate-800/30 ${ys.year === 2025 ? 'bg-amber-950/15' : ys.year === 2026 ? 'bg-cyan-950/15' : ''}">
                    <td class="py-2 px-2.5 font-black text-white text-sm">
                      ${ys.year}
                      ${ys.year === 2026 ? '<span class="ml-1 px-1 py-0.2 rounded bg-cyan-500 text-slate-950 text-[8px] font-black">AKT</span>' : ''}
                    </td>
                    <td class="py-2 px-2.5">
                      <div class="text-[11px] font-bold text-cyan-300">${formatDisplayDate(ys.yCfg.start)} – ${formatDisplayDate(ys.yCfg.end)}</div>
                      <div class="text-[9px] text-slate-400 truncate max-w-[330px]" title="${ys.yCfg.note}">${ys.yCfg.note}</div>
                    </td>
                    <td class="py-2 px-2 text-center font-bold text-white">
                      ${activeDomainFilter === 'ALL' ? ys.totalSessions : `<span class="text-emerald-400">${ys.domainMatchesCount}</span> / ${ys.totalSessions}`}
                    </td>
                    <td class="py-2 px-2 text-center font-bold text-cyan-300">${ys.avgBwStr}</td>
                    <td class="py-2 px-2 text-center font-bold text-amber-300">${ys.jumpSpikesSessions}x</td>
                    <td class="py-2 px-2 text-center font-bold text-purple-300">${ys.sprintSessions}x</td>
                    <td class="py-2 px-2 text-center font-bold text-emerald-300">${ys.strengthSessions}x</td>
                    <td class="py-2 px-2 text-right font-bold text-amber-300">${ys.peakUmsetzen}</td>
                    <td class="py-2 px-2 text-right font-bold text-rose-300">${ys.peakHipthrust}</td>
                    <td class="py-2 px-2 text-right font-bold text-purple-300">${ys.peakTrapbar}</td>
                    <td class="py-2 px-2.5 text-right font-black text-cyan-400">${ys.peakMark}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Multi-Year Stacked Rows (Synchronized by Block Day 1..N or Calendar Date) -->
        <div class="space-y-3.5">
          ${yearStats.map(ys => {
            const yr = ys.year;
            const yCfg = ys.yCfg;
            const calendarStartMonthDay = {
              'aufbau_gpp': '09-23',
              'spezial_fct_spikes': '10-17',
              'hallenvorbereitung': '12-02',
              'hallensaison': '01-20',
              'sommeraufbau': '03-15',
              'sommersaison': '05-15'
            }[activeBlockPreset] || '09-23';
            const calYear = (activeBlockPreset === 'hallenvorbereitung' && yr >= 2020) ? (yr - 1) : yr;
            const blockStartIso = blockSyncMode === 'calendar_date'
              ? `${calYear}-${calendarStartMonthDay}`
              : yCfg.start;
            const totalDays = curPresetObj.durationDays || 45;

            const dayCards = [];
            for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
              const dateIso = addDays(blockStartIso, dayIdx);
              const l = logsByDate[dateIso] || null;
              const matchesDom = matchesDomainFilter(l, activeDomainFilter);
              if (activeDomainFilter !== 'ALL' && hideNonMatchingDomainDays && !matchesDom) {
                continue;
              }
              const dParts = dateIso.split('-');
              const dObj = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[2], 10));
              const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
              const dayName = dayNames[dObj.getDay()];
              const kwStr = getWeekNumber(dateIso);
              const blockWeek = Math.floor(dayIdx / 7) + 1;
              const blockDayNum = dayIdx + 1;

              dayCards.push({
                dateIso,
                displayDate: `${dayName}, ${dParts[2]}.${dParts[1]}.${dParts[0].slice(2)}`,
                kwStr,
                blockWeek,
                blockDayNum,
                matchesDom,
                log: l
              });
            }

            return `
              <div class="bg-slate-900 border ${yr === 2025 ? 'border-amber-500/70' : yr === 2026 ? 'border-cyan-500/70' : 'border-slate-800'} rounded-xl p-3 sm:p-4 space-y-2.5">
                <!-- Year Row Header & Custom Block Start Date Controls -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded text-xs font-mono font-black ${
                      yr === 2026 ? 'bg-cyan-500 text-slate-950' :
                      yr === 2025 ? 'bg-amber-500 text-slate-950' :
                      'bg-slate-950 text-slate-200 border border-slate-700'
                    }">
                      ${yr}
                    </span>
                    <span class="text-xs font-mono font-bold text-white">
                      Block-Start (Tag 1): <strong class="text-cyan-300">${formatDisplayDate(blockStartIso)}</strong>
                    </span>
                    <span class="text-[11px] font-mono text-slate-400">
                      • ${ys.yCfg.note}
                    </span>
                  </div>

                  <!-- Per-Year Block Start Customizer & Scroll Buttons -->
                  <div class="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                    <span class="text-slate-400">Block-Start ${yr} anpassen:</span>
                    <button onclick="TrainingPlanModule.shiftYearBlockStart('${activeBlockPreset}', ${yr}, -7)" class="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800" title="Blockstart 1 Woche früher">-7T</button>
                    <button onclick="TrainingPlanModule.shiftYearBlockStart('${activeBlockPreset}', ${yr}, -1)" class="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800" title="Blockstart 1 Tag früher">-1T</button>
                    <input type="date" value="${blockStartIso}" onchange="TrainingPlanModule.saveCustomBlockStart('${activeBlockPreset}', ${yr}, this.value)" class="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-300 text-[10px] font-mono focus:outline-none focus:border-cyan-500" />
                    <button onclick="TrainingPlanModule.shiftYearBlockStart('${activeBlockPreset}', ${yr}, 1)" class="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800" title="Blockstart 1 Tag später">+1T</button>
                    <button onclick="TrainingPlanModule.shiftYearBlockStart('${activeBlockPreset}', ${yr}, 7)" class="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800" title="Blockstart 1 Woche später">+7T</button>

                    <div class="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-800">
                      <button onclick="TrainingPlanModule.scrollYearTrack(${yr}, -520)" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold">◀</button>
                      <button onclick="TrainingPlanModule.scrollYearTrack(${yr}, 520)" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold">▶</button>
                    </div>
                  </div>
                </div>

                <!-- Horizontal Swipeable Track (Click any card to open Session Preview Modal!) -->
                <div
                  id="yearTrack_${yr}"
                  class="flex gap-2.5 overflow-x-auto pb-2 pt-1 scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing"
                  style="scroll-snap-type: x mandatory;"
                >
                  ${dayCards.map(dc => {
                    const l = dc.log;
                    const hasSession = l != null;
                    const isFrei = !hasSession || (l.session_type || '').toLowerCase().includes('frei') || (l.session_type || '').toLowerCase().includes('ruhetag') || ((l.duration_min || 0) === 0 && !l.protocol_text);
                    const rec = l?.whoop_recovery_pct;
                    const weight = l?.body_weight_kg;
                    const refWeight = l?.ref_body_weight_kg;
                    const isDomainHighlighted = activeDomainFilter !== 'ALL' && dc.matchesDom && !isFrei;
                    const isDimmed = activeDomainFilter !== 'ALL' && !dc.matchesDom;

                    return `
                      <div
                        id="dayCard_${yr}_${dc.dateIso}"
                        onclick="TrainingPlanModule.openSessionPreviewModal('${dc.dateIso}')"
                        class="w-[245px] sm:w-[265px] shrink-0 bg-slate-950 border rounded-xl p-2.5 space-y-2 flex flex-col justify-between transition-all cursor-pointer group ${
                          isDomainHighlighted
                            ? 'border-emerald-500 ring-1 ring-emerald-500/40 shadow-md shadow-emerald-950/30'
                            : isDimmed
                              ? 'border-slate-900 opacity-40 hover:opacity-80'
                              : hasSession && !isFrei
                                ? 'border-slate-800 hover:border-cyan-500/70'
                                : 'border-slate-900/80 opacity-75 hover:opacity-100'
                        }"
                        style="scroll-snap-align: start;"
                        title="Klicken für vollständige Session-Vorschau (${dc.displayDate})"
                      >
                        <!-- Card Top Bar: Block-Tag 1..N & Calendar Date -->
                        <div class="flex items-center justify-between pb-1.5 border-b border-slate-800/80 font-mono text-xs">
                          <div class="flex items-center gap-1.5">
                            <span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-950 text-cyan-300 border border-cyan-800">
                              Tag ${dc.blockDayNum} (W${dc.blockWeek})
                            </span>
                            <span class="font-bold text-white group-hover:text-cyan-400 transition-colors">${dc.displayDate}</span>
                          </div>
                          <span class="text-[9px] text-slate-500">${dc.kwStr}</span>
                        </div>

                        <!-- Card Body: Exact Trainingseinheit + Schwerpunkt or Rest Day -->
                        <div class="space-y-1.5 flex-1 flex flex-col justify-between font-mono text-xs">
                          ${(!hasSession || isFrei) ? `
                            <div class="py-3 text-center space-y-0.5">
                              <span class="text-base">🧘‍♂️</span>
                              <div class="text-[10px] text-slate-500 font-mono italic">${l?.session_type || 'Frei'}</div>
                            </div>
                          ` : `
                            <div class="space-y-1">
                              <div class="flex items-center gap-1 flex-wrap">
                                ${getSessionBadge(l.session_type)}
                                ${l.focus ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-900/40 truncate max-w-[140px]" title="Schwerpunkt: ${l.focus}">${l.focus}</span>` : ''}
                              </div>
                              <div class="flex items-center justify-between text-[10px] text-slate-400">
                                ${l.duration_min > 0 ? `<span>⏱️ ${l.duration_min}m</span>` : '<span></span>'}
                                ${l.best_mark_m ? `<span class="text-amber-400 font-black">🏆 ${l.best_mark_m}m</span>` : (l.venue ? `<span class="truncate text-cyan-400">📍 ${l.venue}</span>` : '')}
                              </div>
                            </div>
                          `}

                          ${l && l.protocol_text ? `
                            <div class="text-[10px] text-slate-300 line-clamp-3 bg-slate-900/70 border border-slate-800/70 p-1.5 rounded leading-snug whitespace-pre-line">
                              ${l.protocol_text}
                            </div>
                          ` : ''}
                        </div>

                        <!-- Card Footer: Whoop, Weight (exact or interpolated trend) & Preview Hint -->
                        <div class="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[9px] font-mono">
                          <div class="flex items-center gap-1.5">
                            ${rec != null ? `<span class="font-bold ${rec >= 67 ? 'text-emerald-400' : rec >= 34 ? 'text-amber-400' : 'text-rose-400'}">${rec}% Rec</span>` : '<span class="text-slate-600">-</span>'}
                            ${weight != null ? `<span class="text-slate-300 font-bold">${weight}kg</span>` : (refWeight != null ? `<span class="text-slate-500" title="${l?.interp_body_weight_source || 'Gewichtstrend'}">~${refWeight.toFixed(1)}kg</span>` : '')}
                          </div>
                          <span class="text-cyan-400 group-hover:underline font-bold">Vorschau 🔍</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

// ================= 4A. HELPER METHODS FÜR SAISON-EVOLUTION & BENCHMARK-SIMULATOR =================
  function setSeasonEvolution(seasonKey) {
    if (SEASON_CONFIG[seasonKey]) {
      selectedSeasonEvolution = seasonKey;
      if (window.App && window.App.state) {
        render(window.App.state);
      }
    }
  }

  function calculateProjectedDistance(inputs) {
    const rehearsal = Number(inputs.rehearsal_12_step_m) || 7.50;
    const speedScore = (
      (3.75 / (Number(inputs.sprint_30m) || 3.78)) * 0.25 +
      (0.92 / (Number(inputs.sprint_30_40m) || 0.935)) * 0.30 +
      (4.67 / (Number(inputs.sprint_40m) || 4.70)) * 0.20 +
      (1.85 / (Number(inputs.sprint_20m_fly) || 1.87)) * 0.25
    );
    const conversionDelta = 0.68 * Math.pow(Math.max(0.7, speedScore), 1.8);

    const reactScore = (
      ((Number(inputs.cmj_inch) || 32) / 40.0) * 0.35 +
      ((Number(inputs.depth_jump_inch) || 36) / 43.0) * 0.35 +
      ((Number(inputs.powerclean_rel_bw) || 1.65) / 2.0) * 0.20 +
      (Math.min(Number(inputs.squat_rel_bw) || 1.65, 2.6) / 2.6) * 0.10
    );
    const reactMod = (reactScore - 1.0) * 0.18;

    const proj = rehearsal + conversionDelta + reactMod;
    return Math.max(7.20, Math.min(8.90, Math.round(proj * 100) / 100));
  }

  function calculateBenchmarkFulfillment(inputs) {
    let totalScore = 0;
    ELITE_BENCHMARK_CONFIG.forEach(cfg => {
      const val = Number(inputs[cfg.id]) || cfg.target;
      let pct = 0;
      if (cfg.lowerIsBetter) {
        pct = (cfg.target / val) * 100;
      } else {
        pct = (val / cfg.target) * 100;
      }
      totalScore += pct;
    });
    return Math.round((totalScore / ELITE_BENCHMARK_CONFIG.length) * 10) / 10;
  }

  function setBenchmarkSimulatorPreset(presetKey) {
    const preset = BENCHMARK_PRESETS[presetKey];
    if (preset) {
      benchmarkSimulatorInputs = { ...preset.values };
      if (window.App && window.App.state) {
        render(window.App.state);
      }
    }
  }

  function updateBenchmarkSimulatorInput(key, value) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      benchmarkSimulatorInputs[key] = num;
      const distEl = document.getElementById('benchmarkSimProjectedDistance');
      const scoreEl = document.getElementById('benchmarkSimAvgScore');
      const tierEl = document.getElementById('benchmarkSimTierBadge');
      if (distEl || scoreEl) {
        const proj = calculateProjectedDistance(benchmarkSimulatorInputs);
        const score = calculateBenchmarkFulfillment(benchmarkSimulatorInputs);
        if (distEl) distEl.textContent = `${proj.toFixed(2)} m`;
        if (scoreEl) scoreEl.textContent = `${score.toFixed(1)}%`;
        if (tierEl) {
          if (proj >= 8.40) {
            tierEl.className = 'px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950';
            tierEl.textContent = '🥇 Weltklasse Medaillen-Potenzial (≥ 8.40m)';
          } else if (proj >= 8.15) {
            tierEl.className = 'px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-400 text-slate-950';
            tierEl.textContent = '💎 Internationales Spitzen-Niveau (8.15m–8.39m)';
          } else {
            tierEl.className = 'px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-400 text-slate-950';
            tierEl.textContent = '⚡ Nationale Spitze / Aufbau-Basis (< 8.15m)';
          }
        }
      }
    }
  }

  // ================= 4B. SAISON-ENTWICKLUNGS-COCKPIT =================
  function renderSeasonEvolutionSection(state) {
    const logs = state.trainingLogs || [];
    const conf = SEASON_CONFIG[selectedSeasonEvolution] || SEASON_CONFIG['2026_current'];
    const seasonLogs = logs.filter(l => l.date >= conf.start && l.date <= conf.end);

    const recs = seasonLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
    const avgRec = recs.length ? (recs.reduce((a, b) => a + b, 0) / recs.length).toFixed(1) : '–';
    const rec7d = recs.slice(-7);
    const rec14d = recs.slice(-14);
    const avgRec7d = rec7d.length ? (rec7d.reduce((a, b) => a + b, 0) / rec7d.length).toFixed(1) : avgRec;
    const avgRec14d = rec14d.length ? (rec14d.reduce((a, b) => a + b, 0) / rec14d.length).toFixed(1) : avgRec;
    const recTrendDelta = recs.length >= 7 ? (Number(avgRec7d) - Number(avgRec14d)).toFixed(1) : '0.0';

    const slps = seasonLogs.map(l => l.sleep_performance_pct).filter(v => v != null);
    const avgSlp = slps.length ? (slps.reduce((a, b) => a + b, 0) / slps.length).toFixed(1) : '–';

    const strains = seasonLogs.map(l => l.whoop_strain).filter(v => v != null);
    const avgStrain = strains.length ? (strains.reduce((a, b) => a + b, 0) / strains.length).toFixed(1) : '–';
    const maxStrain = strains.length ? Math.max(...strains).toFixed(1) : '–';

    const weights = seasonLogs.map(l => l.body_weight_kg).filter(v => v != null);
    const avgWeight = weights.length ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2) : '–';
    const minWeight = weights.length ? Math.min(...weights).toFixed(2) : '–';
    const maxWeight = weights.length ? Math.max(...weights).toFixed(2) : '–';
    const startWeight = weights.length ? weights[0].toFixed(2) : '–';
    const endWeight = weights.length ? weights[weights.length - 1].toFixed(2) : '–';
    const deltaWeight = weights.length >= 2 ? (weights[weights.length - 1] - weights[0]).toFixed(2) : '0.00';
    const refBW = Number(avgWeight) || 82.5;

    // Strength records for season
    const tbList = seasonLogs.map(l => l.trapbar_e1rm_kg).filter(v => v != null);
    const htList = seasonLogs.map(l => l.hipthrust_e1rm_kg).filter(v => v != null);
    const cleanList = seasonLogs.map(l => l.umsetzen_e1rm_kg).filter(v => v != null);
    const maxTb = tbList.length ? Math.max(...tbList) : (selectedSeasonEvolution === '2026_current' ? 132 : (selectedSeasonEvolution === '2022_2023' ? 192 : 165));
    const maxHt = htList.length ? Math.max(...htList) : (selectedSeasonEvolution === '2026_current' ? 132 : (selectedSeasonEvolution === '2022_2023' ? 181 : 163));
    const maxClean = cleanList.length ? Math.max(...cleanList) : (selectedSeasonEvolution === '2023_2024' ? 132.5 : (selectedSeasonEvolution === '2025_2026' ? 124 : 120));
    const squatKg = selectedSeasonEvolution === '2026_current' ? 115 : (selectedSeasonEvolution === '2023_2024' ? 135 : 125);

    const relTb = (maxTb / refBW).toFixed(2);
    const relHt = (maxHt / refBW).toFixed(2);
    const relClean = (maxClean / refBW).toFixed(2);
    const relSquat = (squatKg / refBW).toFixed(2);

    // ZNS Zone determination
    const numRec7d = Number(avgRec7d) || 60;
    let znsColor = 'amber';
    let znsTitle = '🟡 ADAPTATIONS- & ERHALTUNGS-FENSTER (GELBE ZONE)';
    let znsBadge = 'Adaptation / Erhalt';
    let znsAction = 'Standard-Umfänge und Kraftausdauer halten. ZWL mit moderatem Widerstand (4–9kg), Tempoläufe, Technik aus 5er–9er Schritten ohne Maximalabsprung. Axiale Rückenlast moderat (Kniebeuge 3x6). Keine ZUL-Overspeed-Schocks oder neue e1RM-Bestversuche!';

    if (numRec7d >= 67) {
      znsColor = 'emerald';
      znsTitle = '🟢 SUPERKOMPENSATION & MAXIMALER ZNS-REIZ (GRÜNE ZONE)';
      znsBadge = 'Maximaler Reiz freigegeben';
      znsAction = 'Neuronales System voll aufnahmefähig! Freigabe für FCT vertikal/horizontal (Trapbar 130–150kg + Plyos), ZUL-Overspeed >11.0 m/s am 1080, Weitsprung-Anläufe aus 11er–19er mit Vollabsprung und e1RM-Tests. Hier entstehen Weltklasse-Adaptationen (vgl. Gorzów 8.18m bei 96% Recovery).';
    } else if (numRec7d < 55) {
      znsColor = 'rose';
      znsTitle = '🔴 DELOAD- & ZNS-SCHUTZ-PROTOKOLL (ROTE ZONE / WARNUNG)';
      znsBadge = 'Deload / Schutz aktiv';
      znsAction = 'Akkumulierte ZNS-Ermüdung! Gesamtumfang sofort um 40% reduzieren. Axiale Kniebeugen (Rücken!) und harte exzentrische Sehnenschläge (Depth Jumps, ZUL-Sprints >11.2 m/s) komplett pausieren. Fokus auf Physio, Lympho, Mobilisation & passive Erholung (Schlaf >90%).';
    }

    // Weekly grouping
    const byKw = {};
    seasonLogs.forEach(l => {
      const kwKey = l.kw || 'KW-Sonstige';
      if (!byKw[kwKey]) byKw[kwKey] = [];
      byKw[kwKey].push(l);
    });

    return `
      <div id="section-season-evolution" class="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-lg">
        <!-- Section Header & Season Switcher -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-amber-400 text-base">📈</span>
              <h3 class="text-xs sm:text-sm font-black uppercase text-amber-300 tracking-wider">
                1. SAISON-ENTWICKLUNGS-COCKPIT (INTRA-SAISON EVOLUTION & ZNS-STEUERUNG)
              </h3>
            </div>
            <p class="text-[11px] text-slate-400 font-sans mt-0.5">
              ${conf.title} • ${seasonLogs.length} Tage analysiert (${conf.start} bis ${conf.end}) • ${conf.focusSummary}
            </p>
          </div>

          <!-- Season Selector Pills -->
          <div class="flex items-center gap-1.5 flex-wrap bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
            ${Object.keys(SEASON_CONFIG).map(sk => {
              const item = SEASON_CONFIG[sk];
              const isSel = sk === selectedSeasonEvolution;
              return `
                <button onclick="TrainingPlanModule.setSeasonEvolution('${sk}')" class="px-2.5 py-1 rounded font-bold transition-all ${
                  isSel ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }">
                  ${item.shortTitle}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4 Key Hero Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <!-- Card 1: Whoop Recovery & ZNS -->
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">💤 WHOOP-RECOVERY & ZNS</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${
                Number(avgRec7d) >= 67 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                Number(avgRec7d) >= 55 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
              }">7d: ${avgRec7d}%</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-white">${avgRec}%</span>
              <span class="text-[10px] text-slate-400">Saison-Ø</span>
            </div>
            <div class="text-[11px] font-sans text-slate-300 space-y-0.5 pt-1 border-t border-slate-800/80">
              <div class="flex justify-between"><span>7d vs 14d Trend:</span><strong class="${Number(recTrendDelta) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${recTrendDelta > 0 ? '+' : ''}${recTrendDelta}%</strong></div>
              <div class="flex justify-between"><span>Ø Schlaf-Performance:</span><strong class="text-cyan-300">${avgSlp}%</strong></div>
              <div class="flex justify-between"><span>Ø Whoop Strain:</span><strong class="text-amber-300">${avgStrain} (Max: ${maxStrain})</strong></div>
            </div>
          </div>

          <!-- Card 2: Körpergewicht & OSP-Hebel -->
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">⚖️ KÖRPERGEWICHT & TREND</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${
                Number(deltaWeight) < 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-300 border border-slate-700'
              }">${Number(deltaWeight) > 0 ? '+' : ''}${deltaWeight} kg</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-cyan-300">${avgWeight} kg</span>
              <span class="text-[10px] text-slate-400">Schnitt</span>
            </div>
            <div class="text-[11px] font-sans text-slate-300 space-y-0.5 pt-1 border-t border-slate-800/80">
              <div class="flex justify-between"><span>Start ➔ Aktuell:</span><strong>${startWeight} kg ➔ ${endWeight} kg</strong></div>
              <div class="flex justify-between"><span>Spannweite (Min–Max):</span><strong class="text-amber-300">${minWeight} – ${maxWeight} kg</strong></div>
              <div class="flex justify-between"><span>Achillessehnen-Last:</span><span class="${Number(avgWeight) <= 82.5 ? 'text-emerald-400 font-bold' : 'text-rose-400'}">${Number(avgWeight) <= 82.5 ? 'Optimal entlastet' : '+Mehrbelastung'}</span></div>
            </div>
          </div>

          <!-- Card 3: OSP-Relativkraft -->
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">🏋️ KRAFT-LAST-VERHÄLTNIS</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-800">OSP-Standard</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-emerald-400">${relTb}x</span>
              <span class="text-[10px] text-slate-400">Trapbar / KG</span>
            </div>
            <div class="text-[11px] font-sans text-slate-300 space-y-0.5 pt-1 border-t border-slate-800/80">
              <div class="flex justify-between"><span>Trapbar e1RM:</span><strong class="text-white">${maxTb} kg (${relTb}x BW)</strong></div>
              <div class="flex justify-between"><span>Hip-Thrust:</span><strong class="text-white">${maxHt} kg (${relHt}x BW)</strong></div>
              <div class="flex justify-between"><span>Power Clean:</span><strong class="text-white">${maxClean} kg (${relClean}x BW)</strong></div>
              <div class="flex justify-between"><span>Kniebeuge parallel:</span><span class="text-slate-400">${squatKg} kg (${relSquat}x BW)</span></div>
            </div>
          </div>

          <!-- Card 4: Diagnostik & Ziel-Fokus -->
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">🎯 DIAGNOSTIK & HIGHLIGHT</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${conf.badgeColor}">${conf.badge}</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-amber-300">${
                selectedSeasonEvolution === '2026_current' ? '8.18m PB' :
                (selectedSeasonEvolution === '2025_2026' ? '8.18m' :
                (selectedSeasonEvolution === '2024_2025' ? '8.01m' :
                (selectedSeasonEvolution === '2023_2024' ? '8.08m' : '8.14m')))
              }</span>
              <span class="text-[10px] text-slate-400">Peak Weite</span>
            </div>
            <div class="text-[11px] font-sans text-slate-300 space-y-0.5 pt-1 border-t border-slate-800/80">
              <div class="flex justify-between"><span>Ziel-Wettkampf:</span><strong class="text-white truncate">${conf.targetCompetition}</strong></div>
              <div class="flex justify-between"><span>Vmax Weit / Anlauf:</span><strong class="text-cyan-300">10.70 m/s (Bochum)</strong></div>
              <div class="flex justify-between"><span>1080 Sprint Speed:</span><strong class="text-emerald-300">bis 11.55 m/s</strong></div>
            </div>
          </div>
        </div>

        <!-- Adaptive ZNS-Steuerungs-Ampel & Handlungsmatrix -->
        <div class="bg-slate-950 border border-${znsColor}-500/50 rounded-xl p-3.5 space-y-2 font-sans">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-${znsColor}-400 animate-pulse"></span>
              <span class="font-mono font-black text-xs text-${znsColor}-300 uppercase">${znsTitle}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-${znsColor}-950 text-${znsColor}-300 border border-${znsColor}-800">
              ${znsBadge}
            </span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed font-sans">
            <strong>Konkrete Handlungsanweisung für deinen Trainingsalltag:</strong> ${znsAction}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 text-[11px] border-t border-slate-800/80">
            <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
              <strong class="text-emerald-400 font-mono">🟢 Wann mehr machen?</strong>
              <p class="text-slate-300 mt-0.5">Whoop Recovery &ge; 67%, Schlaf &ge; 90%, 0 Schmerzpunkte. Perfektes Fenster für FCT 140kg+, ZUL >11 m/s, Anläufe aus 11er–19er mit vollem Absprung.</p>
            </div>
            <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
              <strong class="text-amber-400 font-mono">🟡 Wann adaptieren?</strong>
              <p class="text-slate-300 mt-0.5">Whoop Recovery 45–66%, Strain &gt; 11. Erhaltungsmodus: Umfang halten, aber Intensitätsspitzen deckeln (ZWL 4–9kg, Tempos, verkürzte Anläufe 5er–9er).</p>
            </div>
            <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
              <strong class="text-rose-400 font-mono">🔴 Wann weniger machen?</strong>
              <p class="text-slate-300 mt-0.5">Recovery &lt; 45% ODER 3+ Tage in Folge &lt; 55% trotz 90%+ Schlaf ODER Schmerzen &ge; 2/4. Umfang -40%, keine Kniebeugen (Rücken!), keine Depth Jumps.</p>
            </div>
          </div>
        </div>

        <!-- Weekly Progression Breakdown Table -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase text-slate-300 tracking-wider">
              📅 Wöchentlicher Entwicklungs- & Belastungsverlauf (${Object.keys(byKw).length} Kalenderwochen)
            </span>
            <span class="text-[10px] text-slate-400">Klick auf Datum öffnet Session-Protokoll</span>
          </div>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">KW / Phase</th>
                  <th class="py-2 px-2.5">Einheiten & Schwerpunkte</th>
                  <th class="py-2 px-2.5 text-center">Ø Whoop Rec</th>
                  <th class="py-2 px-2.5 text-center">Ø Schlaf</th>
                  <th class="py-2 px-2.5 text-center">Ø Strain (Peak)</th>
                  <th class="py-2 px-2.5 text-center">⚖️ Gewicht (Trend)</th>
                  <th class="py-2 px-2.5">Kraft & Diagnostik</th>
                  <th class="py-2 px-2.5">ZNS & Besonderheiten</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${Object.keys(byKw).map(kw => {
                  const items = byKw[kw];
                  const wRecs = items.map(i => i.whoop_recovery_pct).filter(v => v != null);
                  const wSlps = items.map(i => i.sleep_performance_pct).filter(v => v != null);
                  const wStrains = items.map(i => i.whoop_strain).filter(v => v != null);
                  const wWeights = items.map(i => i.body_weight_kg).filter(v => v != null);
                  const wSessions = items.filter(i => i.session_type);
                  
                  const kwAvgRec = wRecs.length ? (wRecs.reduce((a, b) => a + b, 0) / wRecs.length).toFixed(1) : '–';
                  const kwAvgSlp = wSlps.length ? (wSlps.reduce((a, b) => a + b, 0) / wSlps.length).toFixed(1) : '–';
                  const kwAvgStrain = wStrains.length ? (wStrains.reduce((a, b) => a + b, 0) / wStrains.length).toFixed(1) : '–';
                  const kwMaxStrain = wStrains.length ? Math.max(...wStrains).toFixed(1) : '–';
                  const kwAvgWeight = wWeights.length ? (wWeights.reduce((a, b) => a + b, 0) / wWeights.length).toFixed(2) : '–';
                  
                  const startDate = items[0].date;
                  const endDate = items[items.length - 1].date;

                  const kwTb = items.map(i => i.trapbar_e1rm_kg).filter(v => v != null);
                  const kwClean = items.map(i => i.umsetzen_e1rm_kg).filter(v => v != null);
                  const kwMark = items.map(i => i.best_mark_m).filter(v => v != null);

                  const painLogs = items.filter(i => (i.pain_score && i.pain_score >= 2) || i.schmerzbereiche || i.probleme);

                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-2 px-2.5 font-bold text-white whitespace-nowrap">
                        ${kw}<br/>
                        <span class="text-[10px] text-slate-400 font-normal font-sans">${startDate.slice(5)} bis ${endDate.slice(5)}</span>
                      </td>
                      <td class="py-2 px-2.5 font-sans">
                        <div class="font-bold text-slate-200">${wSessions.length} Einheiten</div>
                        <div class="text-[10px] text-slate-400 truncate max-w-xs">
                          ${Array.from(new Set(wSessions.map(s => s.session_type))).slice(0, 3).join(', ') || 'Training'}
                        </div>
                      </td>
                      <td class="py-2 px-2.5 text-center font-bold">
                        <span class="px-1.5 py-0.5 rounded text-[11px] ${
                          Number(kwAvgRec) >= 67 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          Number(kwAvgRec) >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }">${kwAvgRec}%</span>
                      </td>
                      <td class="py-2 px-2.5 text-center text-slate-300">${kwAvgSlp}%</td>
                      <td class="py-2 px-2.5 text-center">
                        <span class="text-white font-bold">${kwAvgStrain}</span>
                        ${kwMaxStrain !== '–' ? `<span class="text-[10px] text-slate-400 font-sans"> (Peak ${kwMaxStrain})</span>` : ''}
                      </td>
                      <td class="py-2 px-2.5 text-center font-bold text-cyan-300">
                        ${kwAvgWeight !== '–' ? `${kwAvgWeight} kg` : '–'}
                      </td>
                      <td class="py-2 px-2.5 font-sans">
                        ${kwMark.length ? `<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${Math.max(...kwMark)}m</span> ` : ''}
                        ${kwTb.length ? `<span class="text-emerald-400 font-bold">Trapbar: ${Math.max(...kwTb)}kg</span> ` : ''}
                        ${kwClean.length ? `<span class="text-cyan-400 font-bold">Clean: ${Math.max(...kwClean)}kg</span>` : ''}
                        ${(!kwMark.length && !kwTb.length && !kwClean.length) ? '<span class="text-slate-500 italic">Allgemeiner Aufbau</span>' : ''}
                      </td>
                      <td class="py-2 px-2.5 font-sans text-[11px]">
                        ${painLogs.length ? `
                          <span class="text-rose-400 font-bold">⚠️ ${painLogs.length}x Problem:</span>
                          <span class="text-slate-300">${(painLogs[0].probleme || painLogs[0].schmerzbereiche || 'Schmerzen').slice(0, 35)}</span>
                        ` : '<span class="text-emerald-400">✅ Reizfrei</span>'}
                        <div class="pt-0.5">
                          <button onclick="TrainingPlanModule.openSessionPreviewModal('${startDate}')" class="text-cyan-400 underline font-mono text-[10px]">KW-Start ansehen ➔</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ================= 4C. WELTKLASSE ELITE-TESTINGTABELLE & BENCHMARK-PROFILER =================
  function renderEliteTestingBenchmarkSection(state) {
    const curInputs = benchmarkSimulatorInputs;
    const projDist = calculateProjectedDistance(curInputs);
    const avgScore = calculateBenchmarkFulfillment(curInputs);

    return `
      <div id="section-elite-benchmarks" class="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 border-2 border-emerald-500/70 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                🎯 WELTKLASSE WEITSPRUNG-BENCHMARK
              </span>
              <span class="text-xs text-emerald-400 font-bold">12 Internationale Spitzen-Parameter</span>
            </div>
            <h3 class="text-base sm:text-lg font-black text-white font-sans mt-1">
              Elite-Testingtabelle & Biomechanischer Weiten-Profiler (8,35m – 8,50m+ Standard)
            </h3>
            <p class="text-[11px] text-slate-300 font-sans mt-0.5">
              USATF / Dan Pfaff & Ralph Mann Spitzenmodell für Weltklasse-Weitspringer im Direktabgleich mit deinen verifizierten Google Sheets Daten & Aufbau 2026.
            </p>
          </div>

          <div class="text-right shrink-0">
            <span class="text-[10px] uppercase font-bold text-slate-400">Dein All-Time Weiten-Niveau:</span>
            <div class="text-lg font-black text-amber-300 font-mono">8,18m PB (Gorzów) / 8,14m (Inneringen)</div>
          </div>
        </div>

        <!-- 12 Parameter Comparison Table -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black uppercase text-slate-300 tracking-wider">
              📊 12 Testwerte: Weltklasse-Benchmark vs. Lukas Bestwerte & Aktueller Aufbau 2026
            </span>
            <span class="text-[10px] text-slate-400">Grün = &ge;95% • Gelb = 80–94% • Rot/Cyan = Hebel</span>
          </div>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Parameter & Kategorie</th>
                  <th class="py-2 px-2.5 text-center">🎯 Elite-Benchmark (100%)</th>
                  <th class="py-2 px-2.5 text-center">👑 Lukas All-Time PB</th>
                  <th class="py-2 px-2.5 text-center">⚡ Aufbau 2026 (Tag 26)</th>
                  <th class="py-2 px-2.5 text-center">📊 Erfüllungsgrad</th>
                  <th class="py-2 px-2.5">🧬 Biomechanischer Transfer & Rolle</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${ELITE_BENCHMARK_CONFIG.map(cfg => {
                  const curVal = cfg.lukaBest;
                  let pct = cfg.lowerIsBetter ? (cfg.target / curVal) * 100 : (curVal / cfg.target) * 100;
                  pct = Math.round(pct * 10) / 10;

                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-2 px-2.5 font-bold text-white">
                        ${cfg.name}<br/>
                        <span class="text-[10px] text-slate-400 font-normal font-sans">${cfg.category}</span>
                      </td>
                      <td class="py-2 px-2.5 text-center font-black text-amber-300 whitespace-nowrap">
                        ${cfg.targetDisplay}
                      </td>
                      <td class="py-2 px-2.5 text-center font-bold text-emerald-400 whitespace-nowrap">
                        ${cfg.lukaBestDisplay}
                      </td>
                      <td class="py-2 px-2.5 text-center text-cyan-300 whitespace-nowrap">
                        ${cfg.lukaAufbau26Display}
                      </td>
                      <td class="py-2 px-2.5 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <span class="font-bold ${pct >= 95 ? 'text-emerald-400' : pct >= 80 ? 'text-amber-400' : 'text-cyan-400'}">${pct}%</span>
                          <div class="w-12 bg-slate-800 rounded-full h-1.5 hidden sm:block">
                            <div class="h-1.5 rounded-full ${pct >= 95 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-cyan-400'}" style="width: ${Math.min(100, pct)}%"></div>
                          </div>
                        </div>
                      </td>
                      <td class="py-2 px-2.5 font-sans text-[11px] text-slate-300 leading-snug">
                        ${cfg.role}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Biomechanical Analysis & Answer to Luka's Question ("Wie weit komme ich damit?") -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 font-sans text-xs">
          <!-- Column 1: The 12-Step Rehearsal 7.80m Revelation -->
          <div class="bg-slate-950 border border-amber-500/50 rounded-lg p-3.5 space-y-2">
            <div class="font-mono font-black text-amber-300 uppercase text-[11px] flex items-center gap-1.5">
              <span>📏</span> 12-SCHRITT REHEARSAL (7,80m) ➔ 8,35m–8,50m+
            </div>
            <p class="text-slate-200 leading-relaxed">
              <strong>Die biomechanische Antwort auf deine Frage:</strong> Ein Sprung von <strong>7,80m aus nur 12 Schritten</strong> erfordert ca. 9,9 m/s Anlauf und eine extreme Reaktivkraft am Brett.
            </p>
            <p class="text-slate-300 leading-relaxed">
              Wenn du aus deinem vollen 18-Schritt-Anlauf (wie in Gorzów oder Rom) mit <strong>10,70–10,80 m/s</strong> anläufst, gewinnst du rechnerisch <strong>+0,75 m/s horizontale Geschwindigkeit</strong>. Nach der ballistischen Flugweiten-Formel ergibt das:
            </p>
            <div class="p-2 rounded bg-amber-950/40 border border-amber-700/60 font-mono text-center text-amber-200 font-bold">
              7,80m (12 Schritte) + 0,55m–0,70m = 8,35m – 8,50m+!
            </div>
            <p class="text-[11px] text-slate-400">
              Wer alle 12 Werte dieser Tabelle erfüllt, ist ein <strong>8,40m–8,55m Medaillenspringer bei Olympischen Spielen und Weltmeisterschaften</strong>!
            </p>
          </div>

          <!-- Column 2: Luka's Weapon: The Sprint Engine -->
          <div class="bg-slate-950 border border-emerald-500/50 rounded-lg p-3.5 space-y-2">
            <div class="font-mono font-black text-emerald-300 uppercase text-[11px] flex items-center gap-1.5">
              <span>⚡</span> DEINE WELTKLASSE-WAFFE: DER SPRINT (98–99%)
            </div>
            <p class="text-slate-200 leading-relaxed">
              <strong>Hier bist du bereits absolute Weltspitze:</strong> Deine 60m-Bestzeit von <strong>6,76s / 6,77s</strong> und deine gemessene Anlaufgeschwindigkeit von <strong>10,70 m/s</strong> (sowie bis 11,55 m/s im 1080) decken die Sprint-Parameter fast zu 100% ab:
            </p>
            <ul class="space-y-1 text-slate-300 list-disc pl-4">
              <li><strong>30m Tiefstart:</strong> ~3,78s vs. 3,75s (<strong>99,2%</strong>)</li>
              <li><strong>40m Tiefstart:</strong> ~4,70s vs. 4,67s (<strong>99,3%</strong>)</li>
              <li><strong>20m fliegend:</strong> ~1,87s vs. 1,85s (<strong>98,9%</strong>)</li>
            </ul>
            <p class="text-emerald-300 font-semibold leading-relaxed pt-1">
              💡 Im modernen Weitsprung erklärt die Anlaufgeschwindigkeit zu ~70% die Weite. Du hast die Sprint-Grundlage, die man nicht künstlich erzwingen kann!
            </p>
          </div>

          <!-- Column 3: The 3 Real Levers for Peking 2027 -->
          <div class="bg-slate-950 border border-cyan-500/50 rounded-lg p-3.5 space-y-2">
            <div class="font-mono font-black text-cyan-300 uppercase text-[11px] flex items-center gap-1.5">
              <span>🎯</span> DIE 3 ECHTEN HEBEL FÜR PEKING 2027 & LA 2028
            </div>
            <ul class="space-y-1.5 text-slate-200">
              <li>
                <strong class="text-cyan-300 font-mono">1. Power Clean (1,65x ➔ 1,85x BW):</strong>
                Dein Bestwert liegt bei <strong>132,5 kg (1,65x BW)</strong>. Wenn du auf 145–150 kg kommst, versteift sich das Knie- und Sprunggelenk beim Aufsatz am Brett noch aggressiver gegen das Einknicken.
              </li>
              <li>
                <strong class="text-cyan-300 font-mono">2. Kniebeuge-Rücken-Schutz via Trapbar:</strong>
                Die Tabelle fordert 2,6x Squat (215 kg). Da bei dir der Rücken limitiert, ist es sportwissenschaftlich genial, dass du das über <strong>Trapbar Deadlift (230 kg = 2,75x BW)</strong> und <strong>Hip-Thrust (235 kg = 2,80x BW)</strong> holst! Das schützt die Lendenwirbelsäule.
              </li>
              <li>
                <strong class="text-cyan-300 font-mono">3. Wettkampfgewicht 81,5 – 82,5 kg:</strong>
                Aktuell liegst du bei 82,5 kg. Das senkt die Stoßbelastung auf deine linke Achillessehne um <strong>~35–40 kg pro Schritt</strong> gegenüber dem Sommer 2026 (86,2 kg).
              </li>
            </ul>
          </div>
        </div>

        <!-- Interactive Benchmark Simulator / Calculator -->
        <div class="bg-slate-950 border border-cyan-500/60 rounded-xl p-4 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <h4 class="text-xs font-black uppercase text-cyan-300 font-mono tracking-wider">
                🧪 INTERAKTIVER BENCHMARK-SIMULATOR & WEITEN-RECHNER
              </h4>
              <p class="text-[11px] text-slate-400 font-sans mt-0.5">
                Passe deine Testwerte an oder wähle ein Preset, um live deine prognostizierte Weiten-Decke und den Erfüllungsgrad zu berechnen.
              </p>
            </div>

            <!-- Preset Buttons -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button onclick="TrainingPlanModule.setBenchmarkSimulatorPreset('luka_best')" class="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                👑 Lukas Bestwerte (PB 8,18m)
              </button>
              <button onclick="TrainingPlanModule.setBenchmarkSimulatorPreset('aufbau_2026')" class="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold">
                ⚡ Aktueller Aufbau 2026
              </button>
              <button onclick="TrainingPlanModule.setBenchmarkSimulatorPreset('world_class_target')" class="px-2.5 py-1 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 text-[10px] font-mono font-bold">
                🎯 100% Elite-Benchmark
              </button>
            </div>
          </div>

          <!-- Real-Time Score Banner -->
          <div class="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-emerald-950/40 border border-cyan-700/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-4 flex-wrap">
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-400">Gesamt-Erfüllungsgrad:</span>
                <div id="benchmarkSimAvgScore" class="text-2xl font-black text-cyan-300 font-mono">${avgScore.toFixed(1)}%</div>
              </div>
              <div class="border-l border-slate-800 pl-4">
                <span class="text-[10px] uppercase font-bold text-slate-400">Prognostizierte Weiten-Decke (18 Schritte):</span>
                <div id="benchmarkSimProjectedDistance" class="text-2xl font-black text-amber-300 font-mono">${projDist.toFixed(2)} m</div>
              </div>
            </div>
            <div>
              <span id="benchmarkSimTierBadge" class="px-2.5 py-1 rounded text-[10px] font-black uppercase font-mono ${
                projDist >= 8.40 ? 'bg-amber-400 text-slate-950' : projDist >= 8.15 ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-400 text-slate-950'
              }">
                ${projDist >= 8.40 ? '🥇 Weltklasse Medaillen-Potenzial (≥ 8.40m)' : projDist >= 8.15 ? '💎 Internationales Spitzen-Niveau (8.15m–8.39m)' : '⚡ Nationale Spitze / Aufbau-Basis (< 8.15m)'}
              </span>
            </div>
          </div>

          <!-- 12 Inputs Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
            ${ELITE_BENCHMARK_CONFIG.map(cfg => {
              const val = curInputs[cfg.id];
              return `
                <div class="bg-slate-900 border border-slate-800 rounded-lg p-2 space-y-1">
                  <label class="block text-[10px] font-bold text-slate-400 truncate" title="${cfg.name}">${cfg.name}</label>
                  <div class="flex items-center gap-1">
                    <input type="number" step="${cfg.unit === 's' || cfg.unit === 'm' || cfg.unit === 'x BW' ? '0.01' : '0.1'}" value="${val}" oninput="TrainingPlanModule.updateBenchmarkSimulatorInput('${cfg.id}', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-400" />
                    <span class="text-[10px] text-slate-500 shrink-0">${cfg.unit}</span>
                  </div>
                  <div class="text-[9px] text-slate-500 flex justify-between font-sans">
                    <span>Ziel:</span><strong class="text-amber-300 font-mono">${cfg.target}</strong>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ================= 4. KARRIERE- & MUSTER-ANALYSE (100% VERIFIZIERT AUS GOOGLE SHEETS) =================
  function renderCareerPatternLabView(state) {
    return `
      <div class="space-y-4 font-mono">
        <!-- QUICK NAVIGATION PILLS -->
        <div class="flex items-center gap-1.5 flex-wrap bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px] font-mono">
          <span class="text-slate-400 font-bold px-1 uppercase">Schnellnavigation:</span>
          <a href="#section-kw43-decision" class="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800">⚡ KW 43 Entscheidungs-Check</a>
          <a href="#section-season-evolution" class="px-2 py-1 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800">📈 Saison-Cockpit & ZNS-Ampel</a>
          <a href="#section-elite-benchmarks" class="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800">🎯 Elite-Testing (12 Parameter)</a>
          <a href="#section-career-matrix" class="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">🏆 Verifizierte Weiten & Gewicht</a>
          <a href="#section-aufbau-compare" class="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">🏗️ Aufbau & FCT / 1080</a>
          <a href="#section-time-correlation" class="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">💊 Whoop-Korrelationen (Tag +1)</a>
        </div>

        <!-- 0. ENTSCHEIDUNGS-CHECK FÜR KOMMENDE WOCHE (KW 43: 19.10. – 25.10.2026) -->
        <div id="section-kw43-decision" class="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-amber-950/30 border-2 border-cyan-500/80 rounded-xl p-4 sm:p-5 space-y-3 shadow-xl">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-cyan-500 text-slate-950 uppercase">
              ⚡ AKTUELLER ENTSCHEIDUNGS-CHECK FÜR NÄCHSTE WOCHE (KW 43: MO 19.10. – SO 25.10.2026)
            </span>
            <span class="text-xs text-amber-300 font-bold">Aufbau 2026 (Start 23.09.2026 • Tag 26 am 18.10.2026 abgeschlossen)</span>
          </div>

          <h3 class="text-base sm:text-lg font-black text-white font-sans">
            Pausewoche jetzt vorziehen (19.10.–25.10.) & ab 26.10. in Block 2 starten – oder noch 1 Woche gleiches Muster (Michaels Plan)?
          </h3>

          <!-- Wochenverlauf Aufbau 2026 aus Google Sheets -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
            <div class="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-1">
              <div class="text-[10px] text-slate-400 font-bold uppercase">Intro (23.09. – 27.09.26)</div>
              <div class="text-sm font-black text-white">3 Einheiten • Ø Rec 52.6%</div>
              <div class="text-[11px] font-sans text-slate-300">
                Einstieg am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-09-23')" class="text-cyan-400 underline font-mono">23.09.</button> (Tempoläufe, 83.2 kg), Kraft am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-09-24')" class="text-cyan-400 underline font-mono">24.09.</button>, Tempoläufe am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-09-26')" class="text-cyan-400 underline font-mono">26.09.</button>
              </div>
            </div>
            <div class="bg-slate-950/90 border border-emerald-500/40 rounded-lg p-3 space-y-1">
              <div class="text-[10px] text-emerald-400 font-bold uppercase">Woche 1 (28.09. – 04.10.26)</div>
              <div class="text-sm font-black text-emerald-300">6 Einheiten • Ø Rec 75.6%</div>
              <div class="text-[11px] font-sans text-slate-300">
                <strong>5 grüne Whoop-Tage</strong> (80%, 73%, 91%, 76%, 80%), Ø Schlaf 96.9%, Gewicht 82.85 kg. Körper absorbiert Grundmuster optimal.
              </div>
            </div>
            <div class="bg-slate-950/90 border border-amber-500/40 rounded-lg p-3 space-y-1">
              <div class="text-[10px] text-amber-400 font-bold uppercase">Woche 2 (05.10. – 11.10.26)</div>
              <div class="text-sm font-black text-amber-300">6 Einheiten • Ø Rec 61.3% (-14%)</div>
              <div class="text-[11px] font-sans text-slate-300">
                Mo–Do nur noch gelbe Recovery (52%, 47%, 56%, 49% trotz 100% Schlaf!). Do <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-08')" class="text-cyan-400 underline font-mono">08.10.</button> 1080-Einstieg (<em>Müde</em>), Fr/Sa <em>Unmotiviert</em>.
              </div>
            </div>
            <div class="bg-slate-950/90 border border-rose-500/60 rounded-lg p-3 space-y-1">
              <div class="text-[10px] text-rose-400 font-bold uppercase">Woche 3 (12.10. – 18.10.26)</div>
              <div class="text-sm font-black text-rose-300">Ø Rec 56.3% • 0 grüne Tage!</div>
              <div class="text-[11px] font-sans text-slate-300">
                Mo–Do 56%, 59%, 56%, 54% trotz 97–100% Schlaf! Di <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-13')" class="text-cyan-400 underline font-mono">13.10.</button> Strain <strong>14.9</strong> (Kniebeuge 3x6 115kg: <em>„Rücken limitierender Faktor, nicht Beinmuskeln“</em>).
              </div>
            </div>
          </div>

          <!-- Pro / Contra & Empfehlung -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs font-sans pt-1">
            <div class="bg-emerald-950/25 border border-emerald-500/50 rounded-lg p-3.5 space-y-2">
              <div class="font-mono font-black text-emerald-400 uppercase text-[11px]">
                ✅ PRO PAUSEWOCHE VORZIEHEN (19.10. – 25.10.2026)
              </div>
              <ul class="space-y-1.5 text-slate-200 list-disc pl-4">
                <li><strong>Eindeutiger autonomer Ermüdungstrend:</strong> Trotz perfekter Schlafdisziplin (97–100%) ist deine Whoop-Recovery über 3 volle Wochen linear von <strong>75.6% ➔ 61.3% ➔ 56.3%</strong> (0 grüne Tage in KW 42) gefallen.</li>
                <li><strong>Frühwarnsignal Unterer Rücken (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-13')" class="text-cyan-300 underline font-mono">13.10.26</button>):</strong> Dein Learning <em>„bei Kniebeugen Rücken limitierender Faktor, nicht Beinmuskeln“</em> (bei Erschöpfung 3/4 & Schmerzen 2/4) zeigt, dass die axiale Rumpf-/Rückenstruktur nach 3,5 Wochen Kniebeugen (115kg) & Ausfallschritten lokal gesättigt ist. Im Sommer 2026 war <em>Unterer Rücken</em> an 85 Tagen dein #1 Problemfeld!</li>
                <li><strong>5 Wochen sauberer Block 2 ab 26.10.:</strong> Wenn du nächste Woche entlastest und am <strong>Mo 26.10.2026</strong> frisch in Block 2 (Halle, Spikes, FCT vertikal/horizontal, spezifischer 1080) gehst, hast du bis Anfang Dezember <strong>5 volle Wochen</strong> ununterbrochene spezifische Entwicklung (2025 fiel der gesamte November durch die Bundeswehr-Grundausbildung weg!).</li>
              </ul>
            </div>

            <div class="bg-amber-950/20 border border-amber-500/40 rounded-lg p-3.5 space-y-2">
              <div class="font-mono font-black text-amber-400 uppercase text-[11px]">
                ⚖️ WAS FÜR MICHAELS PLAN SPRICHT (NOCH 1 WOCHE MUSTER)
              </div>
              <ul class="space-y-1.5 text-slate-200 list-disc pl-4">
                <li><strong>Klassischer 4:1-Blockrhythmus:</strong> Da Woche 0 (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-09-23')" class="text-cyan-300 underline font-mono">23.09.–27.09.</button>) nur eine 3-Tage-Einstiegswoche war, hattest du bisher erst <strong>3 komplette 6-Tage-Wochen</strong>. Ein 4. Belastungszyklus vollendet nominell den allgemeinen Kraft-/Tempolauf-Block.</li>
                <li><strong>Gewichtstrend läuft sehr gut:</strong> Dein Gewicht ist von <strong>86.16 kg</strong> (Sommer-WK-Schnitt 2026) bereits auf <strong>82.50 kg</strong> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-13')" class="text-cyan-300 underline font-mono">13.10.26</button>) gesunken (-3.65 kg!). Eine weitere Woche mit allgemeinem Umfang (Tempoläufe/Turnen) verbrennt weiter Kalorien vor dem explosiven Block 2.</li>
                <li><strong>Aber Vorsicht (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-02')" class="text-rose-300 underline font-mono">02.02.26</button> & <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-18')" class="text-rose-300 underline font-mono">18.02.26</button>):</strong> In deinen Logs führte eine 4. Woche in gelber/roter Recovery bei gleichzeitigem Rücken-/Sehnen-Tonus im Februar 2026 erst zu 5 Tagen Infekt und danach zu 33 Tagen <em>Achilles L</em>.</li>
              </ul>
            </div>

            <div class="bg-cyan-950/30 border border-cyan-400/60 rounded-lg p-3.5 space-y-2">
              <div class="font-mono font-black text-cyan-300 uppercase text-[11px]">
                🎯 DATEN-EMPFEHLUNG FÜR DEIN GESPRÄCH MIT MICHAEL
              </div>
              <p class="text-slate-200 leading-relaxed">
                <strong>Empfehlung: Pause-/Entlastungswoche auf KW 43 (19.10.–25.10.) vorziehen (oder als „aktive Übergangswoche“ gestalten) und Block 2 am 26.10. starten!</strong>
              </p>
              <p class="text-slate-300 leading-relaxed">
                <strong>Argumentation für Michael:</strong> Du hast seit dem <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-09-23')" class="text-cyan-300 underline font-mono">23.09.</button> (26 Tage) 21 Einheiten durchgezogen, 100% Schlaf-Compliance geliefert, aber deine Recovery hängt seit 12 Tagen ohne einzigen grünen Tag bei ~55% fest und der untere Rücken limitiert bei den 115kg Kniebeugen (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-13')" class="text-cyan-300 underline font-mono">13.10.</button>).
              </p>
              <p class="text-emerald-300 font-semibold leading-relaxed">
                💡 <strong>Falls Michael auf der Woche besteht (Kompromiss):</strong> Axiale Rückenlast am Di/Sa rausnehmen (keine Kniebeuge 115kg, stattdessen leichtes Tempo/Mobi) und Umfang um 30% kürzen, damit das ZNS vor den ersten Spikes- & FCT-Einheiten wieder über 70% Recovery kommt.
              </p>
            </div>
          </div>
        </div>

        <!-- 1. INTRA-SAISON ENTWICKLUNGS-COCKPIT (FÜR JEDE SAISON & AKTUELLEN AUFBAU 2026) -->
        ${renderSeasonEvolutionSection(state)}

        <!-- 2. WELTKLASSE ELITE-TESTINGTABELLE & BENCHMARK-PROFILER (WEITSPRUNG) -->
        ${renderEliteTestingBenchmarkSection(state)}

        <!-- 3. VERIFIZIERTE SAISON-, WEITEN- & GEWICHTSTREND-MATRIX (2021 – 2026 AUS GOOGLE SHEETS) -->
        <div id="section-career-matrix" class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="text-xs font-black uppercase text-cyan-400 tracking-wider">
              1. VERIFIZIERTE WETTKAMPF-WEITEN & GEWICHTSTRENDS (2021 – 2026 • 100% GOOGLE SHEETS DATEN)
            </h4>
            <span class="text-[10px] text-slate-400">Alle 5 Karriere-Sprünge ≥ 8.00m + Hallen-Bestwerte (Klick auf Datum öffnet Protokoll)</span>
          </div>
          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5">Saison / Phase</th>
                  <th class="py-2 px-2.5 text-right">Halle Best (Ø)</th>
                  <th class="py-2 px-2.5 text-right">Freiluft Best (Ø)</th>
                  <th class="py-2 px-2.5 text-center">Sprünge ≥ 8.00m (Exakt)</th>
                  <th class="py-2 px-2.5 text-center">⚖️ Gewichtstrend (WK-Ø / Peak-WK)</th>
                  <th class="py-2 px-2.5">Verifizierte Einordnung aus deinen Google Sheets</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr class="bg-cyan-950/20">
                  <td class="py-2.5 px-2.5 font-black text-cyan-300">2026 (Mannheim J3)</td>
                  <td class="py-2.5 px-2.5 text-right font-black text-emerald-400">
                    8.18m PB (Ø 7.80m / 5 WK)
                  </td>
                  <td class="py-2.5 px-2.5 text-right font-bold text-rose-300">
                    7.86m (Ø 7.67m / 8 WK)
                  </td>
                  <td class="py-2.5 px-2.5 text-center font-bold text-emerald-300">
                    1x (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-01-31')" class="underline text-cyan-300">31.01.26 Gorzów 8.18m</button>)
                  </td>
                  <td class="py-2.5 px-2.5 text-center">
                    <span class="text-amber-300 font-bold">Halle Ø 84.94 kg</span> (Gorzów ~85.35 kg)<br/>
                    <span class="text-rose-400 font-bold">Sommer Ø 86.16 kg</span> (Peak 87.05 kg!)
                  </td>
                  <td class="py-2.5 px-2.5 font-sans text-slate-200">
                    <strong>Halle:</strong> Nach FCT (vert./hor.) + 1080-Aufbau <strong>8.18m PB in Gorzów</strong>! Direkt danach (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-02')" class="underline text-cyan-300 font-mono">02.02.</button>) trotz Infekt-Vorboten FCT 140kg ➔ 21% Rec & 5 Tage krank, ab <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-18')" class="underline text-cyan-300 font-mono">18.02.</button> <em>Achilles L</em> (7.78m DM Dortmund, 7.68m Hallen-WM Toruń am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-03-22')" class="underline text-cyan-300 font-mono">22.03.</button>).<br/>
                    <strong>Sommer:</strong> Mit <strong>Ø 86.16 kg (+5.1 kg schwerer als 2023/2024!)</strong> plus <em>Unterer Rücken / Sprunggelenk L</em> gingen Anlaufgeschwindigkeit & Reaktivkraft verloren (Best: 7.86m DM Bochum <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-07-25')" class="underline text-cyan-300 font-mono">25.07.</button>, 7.84m Rhede <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-06-28')" class="underline text-cyan-300 font-mono">28.06.</button>).
                  </td>
                </tr>
                <tr class="bg-amber-950/15">
                  <td class="py-2.5 px-2.5 font-bold text-amber-300">2025 (Mannheim J2)</td>
                  <td class="py-2.5 px-2.5 text-right font-bold text-slate-200">
                    7.71m (Ø 7.52m / 6 WK)
                  </td>
                  <td class="py-2.5 px-2.5 text-right font-black text-emerald-400">
                    8.01m (Ø 7.81m / 12 WK)<br/>
                    <span class="text-[10px] text-cyan-300">ohne Duisburg: Ø 7.86m!</span>
                  </td>
                  <td class="py-2.5 px-2.5 text-center font-bold text-emerald-300">
                    1x (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-07-05')" class="underline text-cyan-300">05.07.25 Vari/Athen 8.01m</button>)
                  </td>
                  <td class="py-2.5 px-2.5 text-center">
                    <span class="text-slate-300">Halle Ø 81.05 kg</span><br/>
                    <span class="text-amber-300 font-bold">Sommer Ø 84.13 kg</span> (Athen ~84.72 kg)
                  </td>
                  <td class="py-2.5 px-2.5 font-sans text-slate-200">
                    Halle noch wechselhaft (7.71m Sindelfingen <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-01-18')" class="underline text-cyan-300 font-mono">18.01.</button>, 7.67m DM Dortmund <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-02-22')" class="underline text-cyan-300 font-mono">22.02.</button>). Im Sommer <strong>extrem hohe Konstanz auf 7.90m–8.01m Niveau</strong> trotz ~84.1 kg (+3.1 kg ggü. 2023): <strong>8.01m Vari/Athen</strong> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-07-05')" class="underline text-cyan-300 font-mono">05.07.</button>), 2x <strong>7.96m FISU Games Bochum</strong> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-07-23')" class="underline text-cyan-300 font-mono">23.07.</button> & <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-07-24')" class="underline text-cyan-300 font-mono">24.07.</button> Bronze), 7.94m Essen (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-05-31')" class="underline text-cyan-300 font-mono">31.05.</button>), 7.91m Dessau (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-06-21')" class="underline text-cyan-300 font-mono">21.06.</button>).
                  </td>
                </tr>
                <tr class="bg-emerald-950/15">
                  <td class="py-2.5 px-2.5 font-bold text-emerald-300">2024 (Mannheim J1)</td>
                  <td class="py-2.5 px-2.5 text-right font-bold text-slate-200">
                    7.73m (Ø 7.61m / 2 WK)
                  </td>
                  <td class="py-2.5 px-2.5 text-right font-black text-emerald-400">
                    8.08m (Ø 7.78m / 11 WK)
                  </td>
                  <td class="py-2.5 px-2.5 text-center font-bold text-emerald-300">
                    2x in Rom (<button onclick="TrainingPlanModule.openSessionPreviewModal('2024-06-07')" class="underline text-cyan-300">07.06. 8.08m</button> & <button onclick="TrainingPlanModule.openSessionPreviewModal('2024-06-08')" class="underline text-cyan-300">08.06. 8.01m</button>)
                  </td>
                  <td class="py-2.5 px-2.5 text-center">
                    <span class="text-emerald-300 font-bold">Halle Ø 80.26 kg</span><br/>
                    <span class="text-emerald-400 font-black">Sommer Ø 80.99 kg (Rom: 79.80 kg!)</span>
                  </td>
                  <td class="py-2.5 px-2.5 font-sans text-slate-200">
                    Erstes Jahr in Mannheim: Halle 7.73m DM Leipzig (<button onclick="TrainingPlanModule.openSessionPreviewModal('2024-02-18')" class="underline text-cyan-300 font-mono">18.02.24</button>). Bei der <strong>EM in Rom an zwei aufeinanderfolgenden Tagen 8.08m (-1.2) und 8.01m (-0.3)</strong> beim niedrigsten Saisongesamtgewicht von <strong>79.80 kg</strong> (gewogen am 05.06. & 10.06.24)! Danach 7.84m La Chaux-de-Fonds (<button onclick="TrainingPlanModule.openSessionPreviewModal('2024-07-14')" class="underline text-cyan-300 font-mono">14.07.</button>).
                  </td>
                </tr>
                <tr>
                  <td class="py-2.5 px-2.5 font-bold text-white">2023 (Durchbruch MS)</td>
                  <td class="py-2.5 px-2.5 text-right font-bold text-slate-200">
                    7.72m (Ø 7.50m / 4 WK)<br/>
                    <span class="text-[10px] text-amber-300">+ 60m PB 6.76s (18.02.)</span>
                  </td>
                  <td class="py-2.5 px-2.5 text-right font-black text-emerald-400">
                    8.14m (Ø 7.81m / 8 WK)<br/>
                    <span class="text-[10px] text-amber-300">+ 100m PB 10.37s (08.07.)</span>
                  </td>
                  <td class="py-2.5 px-2.5 text-center font-bold text-emerald-300">
                    1x (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-07-30')" class="underline text-cyan-300">30.07.23 Inneringen 8.14m</button>)
                  </td>
                  <td class="py-2.5 px-2.5 text-center">
                    <span class="text-emerald-300 font-bold">Halle Ø 81.27 kg</span> (Aufbau 78.35 kg)<br/>
                    <span class="text-emerald-300 font-bold">Sommer Ø 81.03 kg</span> (Inneringen ~81.1 kg)
                  </td>
                  <td class="py-2.5 px-2.5 font-sans text-slate-200">
                    <strong>Durchbruchsaison nach Aufbau 2022 (Start 22.08.22):</strong> Halle 7.72m DM Dortmund (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-02-19')" class="underline text-cyan-300 font-mono">19.02.23</button>) & 6.76s über 60m (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-02-18')" class="underline text-cyan-300 font-mono">18.02.23</button>). Draußen 7.91m DM Kassel (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-07-09')" class="underline text-cyan-300 font-mono">09.07.23</button>, Vortag 10.37s 100m PB!) und <strong>8.14m (+1.8) in Inneringen</strong> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-07-30')" class="underline text-cyan-300 font-mono">30.07.23</button>) bei ~81.1 kg!
                  </td>
                </tr>
                <tr>
                  <td class="py-2.5 px-2.5 font-bold text-slate-400">2019 – 2022 (Aufbau)</td>
                  <td class="py-2.5 px-2.5 text-right text-slate-300">2022: 7.50m Münster</td>
                  <td class="py-2.5 px-2.5 text-right text-slate-300">2021: 7.58m Koblenz<br/>2022: 7.06m Essen</td>
                  <td class="py-2.5 px-2.5 text-center text-slate-500">0x</td>
                  <td class="py-2.5 px-2.5 text-center text-slate-400">2021 Ø 83.5 kg<br/>Herbst 2022: 78.35 kg</td>
                  <td class="py-2.5 px-2.5 font-sans text-slate-400">
                    Sept 2019 OP am Absprungknie (Jumpers Knee), 2020 Corona (7.13m), 2021 Wiederaufbau (7.58m Koblenz am <button onclick="TrainingPlanModule.openSessionPreviewModal('2021-06-27')" class="underline text-cyan-400 font-mono">27.06.21</button>), ab 22.08.2022 verletzungsfreier Aufbau für den 2023er Durchbruch.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. SYSTEMVERGLEICH DEINER AUFBAU-PHASEN (2022–2026) & SPEZIFISCHE MITTEL (FCT, 1080, SCHRITTZAHL) -->
        <div id="section-aufbau-compare" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <!-- Left: Aufbau-Architektur 2022-2026 & Körpergewicht-Hebel -->
          <div class="bg-slate-900 border border-emerald-500/50 rounded-xl p-4 space-y-2.5">
            <h4 class="text-xs font-black uppercase text-emerald-400">
              🏗️ AUFBAU-VERGLEICH (2022–2026) & DER GEWICHTS-/KRAFT-HEBEL
            </h4>
            <ul class="space-y-2 text-xs font-sans text-slate-200">
              <li>
                <strong class="text-emerald-300 font-mono">1. Warum Gorzów (8.18m bei 85.35 kg) trotz höherem Gewicht funktionierte – und der Sommer (86.16 kg) nicht:</strong>
                Im Januar 2026 hattest du aus den <strong>FCT-Einheiten (vertikal & horizontal)</strong> seit dem <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-10-06')" class="text-cyan-300 underline font-mono">06.10.2025</button> eine extreme neuronale Potenzierung (CMJ 67.3 cm, DJ50 Reaktivität 68.1 W/kg am <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-12-03')" class="text-cyan-300 underline font-mono">03.12.25</button>; Whoop Recovery am Vortag von Gorzów <strong>96%</strong>, am WK-Tag <strong>85%</strong>). Als im Februar Krankheit (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-02')" class="text-cyan-300 underline font-mono">02.–06.02.</button>) und <em>Achilles L</em> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-18')" class="text-cyan-300 underline font-mono">ab 18.02.</button>) dazukamen und das Gewicht im Mai/Juni auf <strong>86.0–87.05 kg</strong> stieg (+6.3 kg über EM Rom 2024 mit 79.80 kg!), wirkte die zusätzliche Masse bei jedem Absprung als reine Zusatzlast auf Achillessehne, Sprunggelenk L und unteren Rücken.
              </li>
              <li>
                <strong class="text-emerald-300 font-mono">2. Dein Ziel-Korridor für 2027 (81.5 – 82.8 kg mit der Kraftbasis von 2025/26):</strong>
                Aktuell liegst du im Aufbau 2026 schon bei <strong>82.50 kg</strong> (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-13')" class="text-cyan-300 underline font-mono">13.10.26</button>) – also <strong>3.66 kg leichter als im Sommer 2026</strong> und fast 3 kg leichter als bei deinem 8.18m-Sprung in Gorzów (85.35 kg)! Wenn du die FCT-Reaktivkraft aus dem Winter 2025/26 mit einem Wettkampfgewicht von <strong>81.5–82.5 kg</strong> kombinierst, gewinnst du rechnerisch ~0.12–0.15 m/s Anlaufgeschwindigkeit und entlastest deine linke Achillessehne massiv.
              </li>
              <li>
                <strong class="text-emerald-300 font-mono">3. Frühe Grube & Spikes (Münster 2022/23 vs. Mannheim 2024/25/26):</strong>
                2022 (<button onclick="TrainingPlanModule.openSessionPreviewModal('2022-10-20')" class="text-cyan-300 underline font-mono">20.10.22</button>) und 2023 (<button onclick="TrainingPlanModule.openSessionPreviewModal('2023-09-20')" class="text-cyan-300 underline font-mono">20.09.23 Spikes</button>, <button onclick="TrainingPlanModule.openSessionPreviewModal('2023-10-12')" class="text-cyan-300 underline font-mono">12.10.23 Grube</button>) warst du sehr früh technisch am Brett, aber mit extrem hohem spezifischem Volumen (Pushbull, ZWL). In Mannheim kommen die ersten Sprünge in die Grube bewusst später (<button onclick="TrainingPlanModule.openSessionPreviewModal('2024-12-03')" class="text-cyan-300 underline font-mono">03.12.2024</button> bzw. <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-12-02')" class="text-cyan-300 underline font-mono">02.12.2025</button>). Entscheidend war 2025/26, dass du ab <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-10-17')" class="text-cyan-300 underline font-mono">17.10.2025</button> schon Spikes anhattest und in 8 Gruben-Einheiten zwischen 02.12.25 und 27.01.26 systematisch über <strong>ungeradzahlige Einzelschritte (3er ➔ 5er ➔ 7er ➔ 9er ➔ 11er ➔ 13er ➔ 15er)</strong> aufgebaut hast.
              </li>
            </ul>
          </div>

          <!-- Right: Exakte Auswertung FCT vertikal/horizontal, 1080 (ZWL vs ZUL) & Weite effektiv -->
          <div class="bg-slate-900 border border-cyan-500/50 rounded-xl p-4 space-y-2.5">
            <h4 class="text-xs font-black uppercase text-cyan-400">
              ⚡ DEINE SPEZIFISCHEN SYSTEME IN DEN SHEETS: FCT (33x), 1080 (ZWL/ZUL) & ANLAUFSCHRITTE
            </h4>
            <ul class="space-y-2 text-xs font-sans text-slate-200">
              <li>
                <strong class="text-cyan-300 font-mono">1. French Contrast Training (FCT vertikal vs. FCT horizontal – 33 Einheiten ab 06.10.2025):</strong>
                Du hast mit FCT im Aufbau 2025 am <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-10-06')" class="text-cyan-300 underline font-mono">06.10.2025</button> begonnen (15x im Herbst/Winter vor den 8.18m, 3x im Februar, 15x im Frühjahr/Sommer 2026):<br/>
                • <strong>FCT vertikal:</strong> <em>Trapbar (3x 120–150 kg) + Drop-Jumps (4x) + Hantelsprünge (4x 30 kg) + Assisted Jumps (4x)</em>.<br/>
                • <strong>FCT horizontal:</strong> <em>Hip-Thrust (3x 120–140 kg) + Broad Jump (4x) + Kettlebell Swing (4x 20–24 kg) + Sprunglauf 30m</em>.<br/>
                <strong>Wichtiges Muster aus deinen Logs:</strong> Wenn vor FCT deine Whoop-Recovery ≥ 65% lag, war dein Leistungs-Score in 86% der Fälle „Gut (3)“ oder „Super (4)“. Als du am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-02')" class="text-rose-300 underline font-mono">02.02.26</button> (krank/erschöpft) und <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-16')" class="text-rose-300 underline font-mono">16.02.26</button> (50% Rec) trotzdem schweres FCT vertikal gemacht hast, folgte unmittelbar der Einbruch.
              </li>
              <li>
                <strong class="text-cyan-300 font-mono">2. 1080 Sprint (Standard = Resisted / ZWL vs. Overspeed / Assisted / ZUL):</strong>
                Im Aufbau (<button onclick="TrainingPlanModule.openSessionPreviewModal('2025-10-09')" class="text-cyan-300 underline font-mono">09.10.25</button>, <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-08')" class="text-cyan-300 underline font-mono">08.10.26</button>, <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-10-15')" class="text-cyan-300 underline font-mono">15.10.26</button>) nutzt du den 1080 standardmäßig <strong>resisted (ZWL)</strong> über 30m mit progressivem Widerstand (z.B. 12kg ➔ 9kg ➔ 6kg bzw. 16–20kg). In der Hallen-UWV und Saison (<button onclick="TrainingPlanModule.openSessionPreviewModal('2026-01-14')" class="text-cyan-300 underline font-mono">14.01.26</button>, <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-18')" class="text-cyan-300 underline font-mono">18.02.26</button>) kamen Kontraste aus <strong>ZWL + ZUL (Overspeed/Assisted)</strong> bis <strong>11.30–11.55 m/s</strong> dazu. <em>Hinweis:</em> Am <button onclick="TrainingPlanModule.openSessionPreviewModal('2026-02-18')" class="text-rose-300 underline font-mono">18.02.26</button> lösten 3x (50m ZWL 4kg + 50m ZUL bei 11.5 m/s) nach zwei Vorbelastungstagen den akuten <em>Achilles L</em>-Schmerz (4/4) aus – ZUL/Overspeed >11.2 m/s braucht zwingend einen erholten Vortag!
              </li>
              <li>
                <strong class="text-cyan-300 font-mono">3. Ungerade Einzelschritte (3er–19er) & Diagnostik-Marker „Weite effektiv“:</strong>
                Deine Sprung-Protokolle sind jetzt exakt auf deine ungeraden Einzelschritte (<em>3er, 5er, 7er, 9er, 11er, 13er, 15er, 17er, 19er</em>) gefiltert. Die Spalte <em>Weite effektiv</em> wird ausschließlich als biomechanischer Wettkampf-/Diagnostik-Marker (reale Sprungweite unabhängig vom Brett, z.B. <button onclick="TrainingPlanModule.openSessionPreviewModal('2025-07-23')" class="text-cyan-300 underline font-mono">23.07.25 Bochum Q</button>: 7.96m offiziell / 8.05m effektiv bei 10.60 m/s Anlauf) ausgewertet.
              </li>
            </ul>
          </div>
        </div>

        <!-- 5. ZEITVERSETZTE KORRELATIONS-ANALYSE (TAG +1 FOLGETAG vs. SCHLAF TAG 0) -->
        <div id="section-time-correlation" class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <h4 class="text-xs font-black uppercase text-amber-400 tracking-wider">
                3. ZEITVERSETZTE WHOOP-KORRELATIONEN AUS GOOGLE SHEETS (TAG +1 FOLGETAG VS. SCHLAF TAG 0 • N = 939 TAGE AB 05/2023)
              </h4>
              <p class="text-[11px] text-slate-400 font-sans mt-0.5">
                Supplements, Regeneration, Ernährung, Sozial & Trainingsbelastung von <strong>Tag t</strong> wirken auf deinen Whoop-Score am <strong>Folgemorgen (Tag +1)</strong>. Nur die Spalte <strong>Schlaf</strong> bezieht sich direkt auf dieselbe Nacht (<strong>Tag 0</strong>).
              </p>
            </div>
            <button onclick="window.App && window.App.switchTab('analytics')" class="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-[10px] font-mono font-bold shrink-0">
              Interaktive Korrelations-Matrix öffnen ➔
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <!-- Column 1: Supplements & Regeneration (Tag +1) -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div class="text-[10px] font-black uppercase text-emerald-400 border-b border-slate-800 pb-1">
                💊 SUPPLEMENTS & 🧘‍♂️ REGENERATION ➔ RECOVERY (TAG +1)
              </div>
              <div class="space-y-1 text-[11px]">
                <div class="flex justify-between"><span><strong>Kreatin</strong> (n=556 Tage)</span><span class="text-emerald-400 font-bold">+4.2% (71.1% vs 66.9%)</span></div>
                <div class="flex justify-between"><span><strong>Ashwaghanda</strong> (n=173 Tage)</span><span class="text-emerald-400 font-bold">+3.6% (+6.5% im Zeitraum!)</span></div>
                <div class="flex justify-between"><span><strong>Magnesium</strong> (n=555 Tage)</span><span class="text-emerald-400 font-bold">+3.4% (70.7% vs 67.4%)</span></div>
                <div class="flex justify-between"><span><strong>Vitamin B12</strong> (n=174 Tage)</span><span class="text-emerald-400 font-bold">+3.0% (71.8% vs 68.8%)</span></div>
                <div class="flex justify-between"><span><strong>Vitamin D</strong> (n=519 Tage)</span><span class="text-emerald-400 font-bold">+2.4% (70.4% vs 68.0%)</span></div>
                <div class="flex justify-between"><span><strong>Multivitamin</strong> (n=372 Tage)</span><span class="text-emerald-300 font-bold">+2.3% (70.7% vs 68.5%)</span></div>
                <div class="flex justify-between"><span><strong>Zink / Omega-3</strong> (im Zeitraum)</span><span class="text-emerald-300 font-bold">+2.7% / +1.4%</span></div>
                <div class="flex justify-between border-t border-slate-800/80 pt-1"><span><strong>Koffein</strong> (n=125 Tage, WK/MaxV)</span><span class="text-rose-400 font-bold">-1.7% (67.9% vs 69.6%)</span></div>
                <div class="flex justify-between border-t border-slate-800 pt-1.5"><span><strong>Lympho</strong> (n=102 Tage)</span><span class="text-emerald-400 font-bold">+4.0% (72.9% vs 68.9%)</span></div>
                <div class="flex justify-between"><span><strong>Meditation</strong> (n=93 Tage)</span><span class="text-emerald-400 font-bold">+2.7% (71.8% vs 69.1%)</span></div>
                <div class="flex justify-between"><span><strong>Blackroll / Kalte Dusche</strong></span><span class="text-emerald-300 font-bold">+2.7% / +2.4%</span></div>
              </div>
            </div>

            <!-- Column 2: Schlaf (Tag 0 - Gleicher Morgen) -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div class="text-[10px] font-black uppercase text-cyan-400 border-b border-slate-800 pb-1">
                🌙 SCHLAF-FAKTOREN (TAG 0 • GLEICHER MORGEN)
              </div>
              <div class="space-y-1 text-[11px]">
                <div class="flex justify-between"><span><strong>Bett geteilt</strong> (n=611 Nächte)</span><span class="text-emerald-400 font-bold">+4.8% (71.1% vs 66.3%)</span></div>
                <div class="flex justify-between"><span><strong>Zahnspange</strong> (n=119 Nächte)</span><span class="text-emerald-400 font-bold">+3.9% (72.8% vs 68.9%)</span></div>
                <div class="flex justify-between"><span><strong>Gelesen</strong> (n=235 Nächte)</span><span class="text-emerald-400 font-bold">+3.2% (71.8% vs 68.5%)</span></div>
                <div class="flex justify-between"><span><strong>Nasenpflaster</strong> (n=205 Nächte)</span><span class="text-emerald-300 font-bold">+2.7% (71.5% vs 68.8%)</span></div>
                <div class="flex justify-between"><span><strong>Schlafmaske</strong> (n=528 Nächte)</span><span class="text-emerald-300 font-bold">+2.0% (70.2% vs 68.2%)</span></div>
                <div class="flex justify-between border-t border-slate-800 pt-1.5"><span><strong>Unterbrechung</strong> (n=237 Nächte)</span><span class="text-rose-300 font-bold">-2.5% (67.5% vs 70.0%)</span></div>
                <div class="flex justify-between"><span><strong>Anderes Bett / Hotel</strong> (n=277)</span><span class="text-rose-400 font-bold">-3.7% (66.7% vs 70.4%)</span></div>
                <div class="flex justify-between"><span><strong>Late Meal</strong> (n=188 Nächte)</span><span class="text-rose-400 font-bold">-4.0% (66.2% vs 70.2%)</span></div>
                <div class="flex justify-between"><span><strong>Kopfhörer</strong> (n=72 Nächte)</span><span class="text-rose-400 font-bold">-7.9% (62.1% vs 70.0%)</span></div>
                <div class="flex justify-between"><span><strong>Alkohol</strong> (n=7 Nächte)</span><span class="text-rose-500 font-black">-38.1% (31.6% vs 69.7%)</span></div>
              </div>
            </div>

            <!-- Column 3: Ernährung, Sozial & Belastung (Tag +1) -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div class="text-[10px] font-black uppercase text-rose-400 border-b border-slate-800 pb-1">
                🥗 ERNÄHRUNG, 👥 SOZIAL & 🏋️ BELASTUNG (TAG +1)
              </div>
              <div class="space-y-1 text-[11px]">
                <div class="flex justify-between"><span><strong>Ernährung ⭐⭐ (Okay)</strong> (n=181)</span><span class="text-emerald-400 font-bold">70.5% Folgetag-Rec</span></div>
                <div class="flex justify-between"><span><strong>Ernährung ⭐ (Schlecht)</strong> (n=62)</span><span class="text-rose-400 font-bold">-6.3% (63.5% vs 69.8%)</span></div>
                <div class="flex justify-between border-t border-slate-800 pt-1.5"><span><strong>Sozial: Freunde</strong> (n=409 Tage)</span><span class="text-emerald-300 font-bold">+1.1% (70.0% vs 68.9%)</span></div>
                <div class="flex justify-between"><span><strong>Beziehungsstress</strong> (n=157 Tage)</span><span class="text-rose-400 font-bold">-6.1% (64.3% vs 70.4%)</span></div>
                <div class="flex justify-between"><span><strong>Arbeitsstress</strong> (n=14 Tage)</span><span class="text-rose-400 font-bold">-8.5% (61.0% vs 69.5%)</span></div>
                <div class="flex justify-between border-t border-slate-800 pt-1.5"><span><strong>Nach Ruhetag (Frei)</strong> (n=205)</span><span class="text-emerald-400 font-bold">+3.4% (72.0% Rec am Folgetag)</span></div>
                <div class="flex justify-between"><span><strong>Nach Sprung / Kraft</strong></span><span class="text-slate-300">70.3% / 69.5% Rec (Tag +1)</span></div>
                <div class="flex justify-between"><span><strong>Nach Wettkampf</strong> (n=44 WKs)</span><span class="text-rose-400 font-bold">-6.9% (62.8% Rec am Folgetag)</span></div>
                <div class="flex justify-between"><span><strong>Whoop Strain (Tag t) ➔ Rec (t+1)</strong></span><span class="text-rose-300 font-bold">r = -0.105 (p &lt; 0.01)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ================= 5. VOLLTEXT PROTOKOLL-SUCHE =================
  function renderSearchView(state) {
    const logs = state.trainingLogs || [];
    const query = planSearchQuery.toLowerCase().trim();

    const matches = query ? logs.filter(l => {
      const matchText = [
        l.date,
        l.weekday,
        l.session_type,
        l.focus,
        l.protocol_text,
        l.venue,
        l.learnings,
        l.athlete_comments,
        l.best_mark_m,
        l.eff_mark_m
      ].filter(Boolean).join(' ').toLowerCase();

      return matchText.includes(query);
    }) : logs.slice(-30).reverse();

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <span class="text-xs font-bold font-mono text-white">
            ${query ? `Gefundene Treffer für "${planSearchQuery}": ${matches.length}` : 'Zuletzt dokumentierte Einheiten (30 von 2.355):'}
          </span>
          ${query ? `<button onclick="TrainingPlanModule.clearSearch()" class="text-xs font-mono text-cyan-400 hover:underline">Suche zurücksetzen ✕</button>` : ''}
        </div>

        <div class="space-y-2.5">
          ${matches.length > 0 ? matches.map(l => `
            <div onclick="TrainingPlanModule.openSessionPreviewModal('${l.date}')" class="cursor-pointer bg-slate-950 border border-slate-800 hover:border-cyan-500/60 rounded-lg p-3 space-y-2 font-mono text-xs transition-all">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/60 pb-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-white">${formatDisplayDate(l.date)}</span>
                  ${l.weekday ? `<span class="text-slate-400">(${l.weekday})</span>` : ''}
                  ${getSessionBadge(l.session_type)}
                  ${l.focus ? `<span class="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-900/40 text-[10px]">${l.focus}</span>` : ''}
                  ${l.venue ? `<span class="text-cyan-400 text-[10px]">📍 ${l.venue}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                  ${l.best_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${l.best_mark_m}m</span>` : ''}
                  <span class="text-cyan-400 text-[10px] font-bold">Vorschau 🔍</span>
                </div>
              </div>

              ${l.protocol_text ? `
                <div class="text-slate-300 whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/60 text-xs">${l.protocol_text}</div>
              ` : '<div class="text-slate-500 italic text-[11px]">Kein Protokolltext hinterlegt</div>'}
            </div>
          `).join('') : `
            <div class="py-8 text-center text-slate-500 font-mono text-xs">
              Keine Einheiten für den Suchbegriff "${planSearchQuery}" gefunden.
            </div>
          `}
        </div>
      </div>
    `;
  }

  function scrollYearTrack(yr, offset) {
    const el = document.getElementById(`yearTrack_${yr}`);
    if (el) {
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
  }

  function jumpYearTrackToDate(yr, dateTarget) {
    const card = document.getElementById(`dayCard_${yr}_${dateTarget}`);
    const track = document.getElementById(`yearTrack_${yr}`);
    if (card && track) {
      const left = card.offsetLeft - track.offsetLeft - 15;
      track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  function switchView(viewName) {
    activeView = viewName;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function navigateWeek(delta) {
    currentWeekStart = addDays(currentWeekStart, delta * 7);
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function jumpToWeek(mondayStr) {
    currentWeekStart = mondayStr;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function jumpToCurrentWeek() {
    currentWeekStart = '2026-10-12';
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function onWeekDatePicked(dVal) {
    if (!dVal) return;
    currentWeekStart = getMondayOfDate(dVal);
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function navigateMonth(delta) {
    const parts = currentMonthYear.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) + delta;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }
    currentMonthYear = `${year}-${String(month).padStart(2, '0')}`;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function onMonthYearSelected(val) {
    const year = parseInt(val, 10);
    const month = currentMonthYear.split('-')[1];
    currentMonthYear = `${year}-${month}`;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function setBlockPreset(preset) {
    activeBlockPreset = preset;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function setBlockSyncMode(mode) {
    blockSyncMode = mode === 'calendar_date' ? 'calendar_date' : 'block_day';
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function setDomainFilter(domainKey) {
    activeDomainFilter = domainKey || 'ALL';
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function toggleHideNonMatchingDomainDays() {
    hideNonMatchingDomainDays = !hideNonMatchingDomainDays;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function toggleBlockYear(year) {
    if (activeBlockYears.includes(year)) {
      if (activeBlockYears.length > 1) {
        activeBlockYears = activeBlockYears.filter(y => y !== year);
      }
    } else {
      activeBlockYears.push(year);
      activeBlockYears.sort((a, b) => b - a);
    }
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function onSearchInput(val) {
    planSearchQuery = val;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function clearSearch() {
    planSearchQuery = '';
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function openInReadinessTab(dateIso) {
    if (window.App) {
      window.App.switchTab('analytics');
      if (window.AnalyticsModule && window.AnalyticsModule.onDatePicked) {
        window.AnalyticsModule.onDatePicked(dateIso);
      }
    }
  }

  function openSessionPreviewModal(dateIso) {
    const modal = document.getElementById('sessionPreviewModal');
    const dateBadge = document.getElementById('sessionPreviewDateBadge');
    const title = document.getElementById('sessionPreviewTitle');
    const content = document.getElementById('sessionPreviewContent');
    const goBtn = document.getElementById('sessionPreviewGoToTabBtn');
    if (!modal || !content) return;

    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];
    const daySessions = logs.filter(l => l.date === dateIso);

    if (dateBadge) {
      dateBadge.textContent = `📅 ${formatDisplayDate(dateIso)} (${getWeekNumber(dateIso)})`;
    }
    if (title) {
      title.textContent = `SESSION-VORSCHAU • ${formatDisplayDate(dateIso)}`;
    }

    if (goBtn) {
      goBtn.onclick = () => {
        openInReadinessTab(dateIso);
        modal.classList.add('hidden');
      };
    }

    if (daySessions.length === 0 || (daySessions.length === 1 && (daySessions[0].duration_min || 0) === 0 && !daySessions[0].protocol_text)) {
      const rec = daySessions[0]?.whoop_recovery_pct;
      const sleep = daySessions[0]?.sleep_performance_pct;
      const weight = daySessions[0]?.body_weight_kg;
      const refWeight = daySessions[0]?.ref_body_weight_kg;
      content.innerHTML = `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-2">
          <span class="text-3xl">🧘‍♂️</span>
          <h4 class="font-bold text-white uppercase text-xs">${daySessions[0]?.session_type || 'Frei / Ruhetag'}</h4>
          <p class="text-xs text-slate-400">Keine aktive Trainingseinheit für diesen Tag dokumentiert.</p>
          <div class="flex items-center justify-center gap-2 pt-2 flex-wrap">
            ${rec != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Whoop Recovery: ${rec}%</span>` : ''}
            ${sleep != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">Schlaf: ${sleep}%</span>` : ''}
            ${weight != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">Gewicht: ${weight} kg</span>` : (refWeight != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-slate-900 text-slate-300 border border-slate-700" title="${daySessions[0]?.interp_body_weight_source || ''}">Gewicht (Trend): ~${refWeight.toFixed(2)} kg</span>` : '')}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = daySessions.map((log, sIdx) => {
        const protocolText = log.protocol_text || log.protocol || '';
        const trainerText = log.trainer ? '👨‍🏫 Trainer vor Ort' : 'Eigenständig';
        const probs = log.probleme || log.problems || '';
        const weightStr = log.body_weight_kg != null
          ? `⚖️ ${log.body_weight_kg} kg`
          : (log.ref_body_weight_kg != null ? `⚖️ ~${log.ref_body_weight_kg.toFixed(1)} kg (Trend)` : '');

        return `
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 font-mono">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${daySessions.length > 1 ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white">#${sIdx + 1}</span>` : ''}
                ${getSessionBadge(log.session_type)}
                ${log.focus ? `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-bold">Schwerpunkt: ${log.focus}</span>` : ''}
                <span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300">${trainerText}</span>
                ${log.duration_min ? `<span class="font-bold text-white text-xs">⏱️ ${log.duration_min} min</span>` : ''}
                ${log.venue ? `<span class="text-cyan-400 font-bold text-xs">📍 ${log.venue}</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 text-xs font-mono flex-wrap">
                ${weightStr ? `<span class="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700 text-[10px] font-bold" title="${log.interp_body_weight_source || ''}">${weightStr}</span>` : ''}
                ${log.whoop_recovery_pct != null ? `<span class="px-2 py-0.5 rounded bg-slate-900 ${log.whoop_recovery_pct >= 67 ? 'text-emerald-400' : log.whoop_recovery_pct >= 34 ? 'text-amber-400' : 'text-rose-400'} border border-slate-700 text-[10px] font-bold">Rec: ${log.whoop_recovery_pct}%</span>` : ''}
                ${log.best_mark_m ? `<span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${log.best_mark_m}m</span>` : ''}
                ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]" title="Reine Weite unabhängig vom Brett (Diagnostik)">Effektiv: ${log.eff_mark_m}m</span>` : ''}
                ${log.approach_speed_11m_to_1m ? `<span class="text-cyan-300 text-[10px]">Vmax: <strong>${log.approach_speed_11m_to_1m} m/s</strong></span>` : ''}
                ${log.trapbar_e1rm_kg ? `<span class="text-purple-300 text-[10px]">Trapbar: <strong>${log.trapbar_e1rm_kg} kg</strong></span>` : ''}
                ${log.hipthrust_e1rm_kg ? `<span class="text-rose-300 text-[10px]">HipThrust: <strong>${log.hipthrust_e1rm_kg} kg</strong></span>` : ''}
                ${log.umsetzen_e1rm_kg ? `<span class="text-amber-300 text-[10px]">Umsetzen: <strong>${log.umsetzen_e1rm_kg} kg</strong></span>` : ''}
              </div>
            </div>

            <!-- 1-4 Scores & Biometrics -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
              <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span class="text-slate-500 uppercase block font-bold">Leistung (1-4)</span>
                <span class="text-emerald-300 font-bold">${formatScore1to4Badge(log.performance_score, false)}</span>
              </div>
              <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span class="text-slate-500 uppercase block font-bold">Fokus (1-4)</span>
                <span class="text-cyan-300 font-bold">${formatScore1to4Badge(log.focus_score, false)}</span>
              </div>
              <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span class="text-slate-500 uppercase block font-bold">Schmerzen (1-4)</span>
                <span class="text-amber-300 font-bold">${formatScore1to4Badge(log.pain_score, true)}</span>
              </div>
              <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span class="text-slate-500 uppercase block font-bold">Erschöpfung (1-4)</span>
                <span class="text-rose-300 font-bold">${formatScore1to4Badge(log.fatigue_score, true)}</span>
              </div>
            </div>

            ${protocolText ? `
              <div class="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 space-y-1">
                <div class="text-[10px] font-bold uppercase text-cyan-400">📋 Dokumentiertes Protokoll</div>
                <div class="text-slate-200 text-xs whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/80">${protocolText}</div>
              </div>
            ` : '<div class="text-slate-500 italic text-[11px]">Kein Freitext-Protokoll vorhanden</div>'}

            ${(probs || log.learnings || log.tagesform || log.schmerzbereiche) ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                ${log.tagesform ? `<div class="p-2 rounded bg-cyan-950/20 border border-cyan-800/40 text-cyan-300"><strong>⚡ Tagesform:</strong> ${log.tagesform}</div>` : ''}
                ${probs ? `<div class="p-2 rounded bg-rose-950/20 border border-rose-800/40 text-rose-300"><strong>⚠️ Probleme:</strong> ${probs}${log.schmerzbereiche ? ` (${log.schmerzbereiche})` : ''}</div>` : ''}
                ${log.learnings ? `<div class="p-2 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 sm:col-span-2"><strong>💡 Learnings:</strong> ${log.learnings}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    modal.classList.remove('hidden');
  }

  return {
    render,
    switchView,
    navigateWeek,
    jumpToCurrentWeek,
    onWeekDatePicked,
    navigateMonth,
    onMonthYearSelected,
    setBlockPreset,
    setBlockSyncMode,
    setDomainFilter,
    toggleHideNonMatchingDomainDays,
    saveCustomBlockStart,
    shiftYearBlockStart,
    resetCustomBlockStarts,
    toggleBlockYear,
    onSearchInput,
    clearSearch,
    openInReadinessTab,
    openSessionPreviewModal,
    scrollYearTrack,
    jumpYearTrackToDate,
    jumpToWeek,
    setSeasonEvolution,
    setBenchmarkSimulatorPreset,
    updateBenchmarkSimulatorInput,
    calculateProjectedDistance,
    calculateBenchmarkFulfillment
  };
})();

window.TrainingPlanModule = TrainingPlanModule;
