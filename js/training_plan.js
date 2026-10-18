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

  // ================= 4. KARRIERE- & MUSTER-ANALYSE (100% VERIFIZIERT AUS GOOGLE SHEETS) =================
  function renderCareerPatternLabView(state) {
    return `
      <div class="space-y-4 font-mono">
        <!-- 0. ENTSCHEIDUNGS-CHECK FÜR KOMMENDE WOCHE (KW 43: 19.10. – 25.10.2026) -->
        <div class="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-amber-950/30 border-2 border-cyan-500/80 rounded-xl p-4 sm:p-5 space-y-3 shadow-xl">
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

        <!-- 1. VERIFIZIERTE SAISON-, WEITEN- & GEWICHTSTREND-MATRIX (2021 – 2026 AUS GOOGLE SHEETS) -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
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

        <!-- 2. SYSTEMVERGLEICH DEINER AUFBAU-PHASEN (2022–2026) & SPEZIFISCHE MITTEL (FCT, 1080, SCHRITTZAHL) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
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

        <!-- 3. ZEITVERSETZTE KORRELATIONS-ANALYSE (TAG +1 FOLGETAG vs. SCHLAF TAG 0) -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
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
    jumpToWeek
  };
})();

window.TrainingPlanModule = TrainingPlanModule;
