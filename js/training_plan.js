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
  let activeBlockPreset = 'spezial_fct_spikes'; // 'aufbau_gpp' | 'spezial_fct_spikes' | 'hallenvorbereitung' | 'hallensaison' | 'sommeraufbau' | 'sommersaison'
  let blockSyncMode = 'block_day'; // 'block_day' (Tag 1..N des jeweiligen Blocks) | 'calendar_date'
  let activeDomainFilter = 'ALL'; // 'ALL' | 'JUMP_SPIKES' | 'SPRINT_MAXV' | 'STRENGTH_FCT' | 'PLYO_REACTIVE' | 'TEMPO_REGEN'
  let hideNonMatchingDomainDays = false;
  let activeBlockYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];
  let planSearchQuery = '';
  let initializedWeek = false;

  // Authentic year-specific block definitions derived from Luka's 2019-2026 Google Sheets logs
  const DEFAULT_YEAR_BLOCKS = {
    'aufbau_gpp': {
      title: '1. Allgemeiner Aufbau / GPP (Herbst-Einstieg)',
      subtitle: 'Grundlagenblock nach Saisonpause (individueller Start je nach Saisonende / WM / Olympia)',
      durationDays: 42,
      years: {
        2026: { start: '2026-09-23', end: '2026-11-03', note: 'Einstieg 23.09. / 28.09.26 • Frühe 1080-Integration ab Tag 15 (08.10.)' },
        2025: { start: '2025-09-15', end: '2025-10-26', note: 'Früher Aufbau-Start 15.09.25 • Ab 06.10. FCT+1080 • 17.10. schon Spikes!' },
        2024: { start: '2024-10-17', end: '2024-11-27', note: 'Später Start nach Olympia Paris: 17.10.24 war Tag 1 im Aufbau!' },
        2023: { start: '2023-09-12', end: '2023-10-23', note: 'Früher Aufbau-Start 12.09.23 vor Olympia-/EM-Saison (8.14m)' },
        2022: { start: '2022-10-03', end: '2022-11-13', note: 'Klassischer Oktober-Aufbau nach 8.00m Durchbruchs-Saison' },
        2021: { start: '2021-10-04', end: '2021-11-14', note: 'Herbst-Aufbau 2021' },
        2020: { start: '2020-09-28', end: '2020-11-08', note: 'Herbst-Aufbau 2020' },
        2019: { start: '2019-09-30', end: '2019-11-10', note: 'Herbst-Aufbau 2019' }
      }
    },
    'spezial_fct_spikes': {
      title: '2. Spezifischer Aufbau / FCT, 1080 & Erste Spikes',
      subtitle: 'Übergang in FCT-Kraftblöcke, 1080-Widerstandssprints & erste Spikes-Technikeinheiten (Referenz: Mitte Okt 2025)',
      durationDays: 45,
      years: {
        2026: { start: '2026-10-05', end: '2026-11-18', note: 'Aktueller Block (KW 41/42) • Angelehnt an Mitte Oktober 2025 (1080 & FCT)' },
        2025: { start: '2025-10-06', end: '2025-11-19', note: 'Referenz-Block 8.18m-Saison! 06.10. FCT-Start • 17.10. Spikes & KSP' },
        2024: { start: '2024-11-11', end: '2024-12-22', note: 'Wegen Aufbau-Start am 17.10.24 erst ab 11.11.24 im spezifischen Block!' },
        2023: { start: '2023-10-23', end: '2023-12-06', note: 'Spezifischer Herbstblock 2023 (Trapbar & Sprint-Technik)' },
        2022: { start: '2022-10-31', end: '2022-12-14', note: 'Spezifischer Herbstblock 2022' },
        2021: { start: '2021-11-01', end: '2021-12-15', note: 'Spezifischer Herbstblock 2021' },
        2020: { start: '2020-10-26', end: '2020-12-09', note: 'Spezifischer Herbstblock 2020' },
        2019: { start: '2019-10-28', end: '2019-12-11', note: 'Spezifischer Herbstblock 2019' }
      }
    },
    'hallenvorbereitung': {
      title: '3. Unmittelbare Hallen-UWV (Anlauf, Pop-Up & MaxV)',
      subtitle: 'Feinschliff vor dem Hallen-Saisoneinstieg (Dezember bis Ende Januar)',
      durationDays: 45,
      years: {
        2026: { start: '2025-12-08', end: '2026-01-22', note: 'UWV für Hallensaison 2026 ➔ 8.18m PB in Gorzów am 01.02.2026!' },
        2025: { start: '2024-12-09', end: '2025-01-23', note: 'UWV für Hallensaison 2025 ➔ 8.06m Düsseldorf' },
        2024: { start: '2023-12-04', end: '2024-01-19', note: 'UWV für Hallensaison 2024 ➔ 7.93m DM Leipzig' },
        2023: { start: '2022-12-05', end: '2023-01-20', note: 'UWV für Hallensaison 2023 ➔ 7.91m Dortmund' },
        2022: { start: '2021-12-06', end: '2022-01-20', note: 'UWV für Hallensaison 2022' },
        2021: { start: '2020-12-07', end: '2021-01-21', note: 'UWV für Hallensaison 2021' },
        2020: { start: '2019-12-02', end: '2020-01-17', note: 'UWV für Hallensaison 2020' },
        2019: { start: '2019-01-01', end: '2019-01-25', note: 'UWV 2019' }
      }
    },
    'hallensaison': {
      title: '4. Hallen-Wettkampfsaison (Indoor Peaks)',
      subtitle: 'Wettkampf-Steuerung, CNS-Tapering & Peak-Sprünge in der Halle',
      durationDays: 50,
      years: {
        2026: { start: '2026-01-23', end: '2026-03-22', note: '8.18m PB Gorzów • 8.10m Banská Bystrica • 8.08m Hallen-WM Toruń!' },
        2025: { start: '2025-01-24', end: '2025-03-10', note: '8.06m ISTAF Düsseldorf • Hallen-EM Apeldoorn' },
        2024: { start: '2024-01-20', end: '2024-02-26', note: '7.93m DM Halle Leipzig' },
        2023: { start: '2023-01-21', end: '2023-02-26', note: '7.91m Indoor Dortmund' },
        2022: { start: '2022-01-22', end: '2022-02-28', note: 'Hallensaison 2022' },
        2021: { start: '2021-01-23', end: '2021-02-28', note: 'Hallensaison 2021' },
        2020: { start: '2020-01-18', end: '2020-02-25', note: 'Hallensaison 2020' },
        2019: { start: '2019-01-19', end: '2019-02-24', note: 'Hallensaison 2019' }
      }
    },
    'sommeraufbau': {
      title: '5. Frühjahr-Aufbau & Trainingslager (März – Mai)',
      subtitle: 'Übergang Halle ➔ Freiluft, Trainingslager (Belek / Chula Vista) & Anlauf-Aufbau',
      durationDays: 50,
      years: {
        2026: { start: '2026-03-30', end: '2026-05-15', note: 'Aufbau nach Hallen-WM Toruń • Einstieg Freiluft (8.03m Athen)' },
        2025: { start: '2025-03-24', end: '2025-05-14', note: 'Frühjahrsblock 2025 vor 8.07m Athen' },
        2024: { start: '2024-03-11', end: '2024-05-08', note: 'Gold-Aufbau 2024 ➔ direkt zu 8.14m PB in Inneringen (11.05.24)!' },
        2023: { start: '2023-03-13', end: '2023-05-12', note: 'Frühjahrsblock 2023 ➔ 8.00m Weinheim & 8.14m DM Kassel!' },
        2022: { start: '2022-03-14', end: '2022-05-13', note: 'Frühjahrsblock 2022 ➔ 8.00m Durchbruch!' },
        2021: { start: '2021-03-15', end: '2021-05-14', note: 'Frühjahrsblock 2021' },
        2020: { start: '2020-03-16', end: '2020-05-15', note: 'Frühjahrsblock 2020' },
        2019: { start: '2019-03-18', end: '2019-05-15', note: 'Frühjahrsblock 2019' }
      }
    },
    'sommersaison': {
      title: '6. Sommer-Wettkampfsaison & Meisterschaften (Mai – Sep)',
      subtitle: 'Freiluft-Meetings, DM, EM, WM & Olympische Spiele',
      durationDays: 95,
      years: {
        2026: { start: '2026-05-16', end: '2026-08-30', note: '8.03m Athen • 7.98m DM Bochum • 7.92m Pfungstadt' },
        2025: { start: '2025-05-15', end: '2025-09-14', note: '8.07m Athen • 8.01m Warschau • WM Tokio Zyklus' },
        2024: { start: '2024-05-09', end: '2024-08-15', note: '8.14m PB Inneringen • 8.08m EM Rom Finale • Olympia Paris' },
        2023: { start: '2023-05-13', end: '2023-08-25', note: '8.14m PB & Deutscher Meister Kassel • 8.00m Weinheim' },
        2022: { start: '2022-05-14', end: '2022-08-20', note: 'Erster 8.00m Sprung • EM München' },
        2021: { start: '2021-05-15', end: '2021-08-15', note: 'Sommersaison 2021 (U23 EM Tallinn)' },
        2020: { start: '2020-06-01', end: '2020-08-30', note: 'Sommersaison 2020' },
        2019: { start: '2019-05-16', end: '2019-08-25', note: 'Sommersaison 2019 (U20 EM Borås)' }
      }
    }
  };

  const DOMAIN_FILTERS = {
    'ALL': { label: '🌐 Alle Bereiche', keywords: [] },
    'JUMP_SPIKES': {
      label: '👟 Sprung, Anlauf & Spikes',
      keywords: ['sprung', 'weitsprung', 'anlauf', 'al ', 'spikes', 'ksp', 'kurzsprung', 'tisch', 'absprung', 'pop', 'hebung', 'landung', '6er', '8er', '10er', '12er', '14er', '16er', '18er', '20er', 'technik', 'brett', 'balken']
    },
    'SPRINT_MAXV': {
      label: '⚡ Sprint, MaxV & 1080',
      keywords: ['sprint', '1080', 'fliegend', 'flg', '30m', '40m', '60m', '100m', 'schnelligkeit', 'vmax', 'hochstart', 'tiefstart', 'start', 'beschleunigung', 'frequenzen', 'zugwiderstand', 'schlitten']
    },
    'STRENGTH_FCT': {
      label: '🏋️ Kraft, FCT & Explosiv',
      keywords: ['kraft', 'fct', 'umsetzen', 'trapbar', 'hipthrust', 'hip-thrust', 'hip thrust', 'aufsteiger', 'kniebeuge', 'kb', 'reißen', 'reissen', 'bankdrücken', 'komplex', 'hantel', 'vbt', 'exzentrisch', 'isometrisch', 'gewicht']
    },
    'PLYO_REACTIVE': {
      label: '🦘 Plyos, Hürden & Würfe',
      keywords: ['hürden', 'hürde', 'plyo', 'mehrfach', 'sprunglauf', 'hop', 'step', 'prell', 'drop jump', 'dj', 'cmj', 'kasten', 'schockwurf', 'medball', 'kugel', 'reaktiv', 'seil']
    },
    'TEMPO_REGEN': {
      label: '🏃 Tempos, Stabi & Regen',
      keywords: ['tempo', 'tl ', 'ausdauer', 'stabi', 'rumpf', 'fuß', 'fuss', 'dehnen', 'beweglichkeit', 'mobi', 'regeneration', 'physio', 'sauna', 'lymphomat', 'rad', 'ergometer', 'erwärmung']
    }
  };

  function getCustomBlockConfig() {
    try {
      const saved = localStorage.getItem('luka_custom_year_blocks_v7');
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
      localStorage.setItem('luka_custom_year_blocks_v7', JSON.stringify(custom));
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
      localStorage.removeItem('luka_custom_year_blocks_v7');
    } catch (e) { /* ignore */ }
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function getBlockDefinitionForYear(presetKey, year) {
    const preset = DEFAULT_YEAR_BLOCKS[presetKey] || DEFAULT_YEAR_BLOCKS['spezial_fct_spikes'];
    const base = (preset.years && preset.years[year]) || {
      start: `${year}-10-01`,
      end: `${year}-11-14`,
      note: `Standard-Zeitraum ${year}`
    };
    const custom = getCustomBlockConfig();
    const customStart = custom[presetKey] && custom[presetKey][year];
    if (customStart) {
      const dur = preset.durationDays || 42;
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

  function getSessionBadge(typeStr) {
    const s = (typeStr || '').toLowerCase();
    if (s.includes('sprung') || s.includes('weitsprung')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">👟 Sprung / Technik</span>';
    }
    if (s.includes('kraft') || s.includes('athletik') || s.includes('hantel')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">🏋️ Kraft / FCT</span>';
    }
    if (s.includes('sprint') || s.includes('schnelligkeit') || s.includes('tempo')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">⚡ Sprint / MaxV</span>';
    }
    if (s.includes('wettkampf') || s.includes('wk') || s.includes('finale')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-rose-950 text-rose-300 border border-rose-800">🏆 Wettkampf</span>';
    }
    if (s.includes('regeneration') || s.includes('ruhe') || s.includes('physio') || s.includes('pause')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-blue-950 text-blue-300 border border-blue-800">🧘‍♂️ Regeneration</span>';
    }
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">📋 ${typeStr || 'Training'}</span>`;
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
            🔬 Empirische Tiefenanalyse aller 2.355 Trainingsprotokolle (2019–2026) & 69 Wettkämpfe für deine Saison 2027 (Hallen-EM Valencia & WM Peking)
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
          <input type="text" value="${planSearchQuery}" oninput="TrainingPlanModule.onSearchInput(this.value)" placeholder="Volltextsuche in allen 2.355 Protokollen (z.B. 'FCT', '1080', 'Spikes', 'KSP', 'Trapbar', 'Gorzów', 'Inneringen', 'Belek')..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono" />
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

    const curPresetObj = DEFAULT_YEAR_BLOCKS[activeBlockPreset] || DEFAULT_YEAR_BLOCKS['spezial_fct_spikes'];
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
      const peakMark = blockLogs.reduce((max, l) => Math.max(max, l.best_mark_m || l.eff_mark_m || 0), 0);

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
                  <th class="py-2 px-2.5">Individueller Block-Zeitraum</th>
                  <th class="py-2 px-2 text-center">Einheiten</th>
                  <th class="py-2 px-2 text-center text-amber-300">👟 Sprung/Spikes</th>
                  <th class="py-2 px-2 text-center text-purple-300">⚡ Sprint/1080</th>
                  <th class="py-2 px-2 text-center text-emerald-300">🏋️ Kraft/FCT</th>
                  <th class="py-2 px-2 text-right">Umsetzen</th>
                  <th class="py-2 px-2 text-right">Hip-Thrust</th>
                  <th class="py-2 px-2 text-right">Trapbar</th>
                  <th class="py-2 px-2.5 text-right">Top-Weite</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${yearStats.map(ys => `
                  <tr class="hover:bg-slate-800/30 ${ys.year === 2025 ? 'bg-amber-950/15' : ys.year === 2026 ? 'bg-cyan-950/15' : ''}">
                    <td class="py-2 px-2.5 font-black text-white text-sm">
                      ${ys.year}
                      ${ys.year === 2025 ? '<span class="ml-1 px-1 py-0.2 rounded bg-amber-500 text-slate-950 text-[8px] font-black">REF</span>' : ''}
                    </td>
                    <td class="py-2 px-2.5">
                      <div class="text-[11px] font-bold text-cyan-300">${formatDisplayDate(ys.yCfg.start)} – ${formatDisplayDate(ys.yCfg.end)}</div>
                      <div class="text-[9px] text-slate-400 truncate max-w-[290px]" title="${ys.yCfg.note}">${ys.yCfg.note}</div>
                    </td>
                    <td class="py-2 px-2 text-center font-bold text-white">
                      ${activeDomainFilter === 'ALL' ? ys.totalSessions : `<span class="text-emerald-400">${ys.domainMatchesCount}</span> / ${ys.totalSessions}`}
                    </td>
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
              'aufbau_gpp': '09-15',
              'spezial_fct_spikes': '10-05',
              'hallenvorbereitung': '12-05',
              'hallensaison': '01-20',
              'sommeraufbau': '03-15',
              'sommersaison': '05-15'
            }[activeBlockPreset] || '10-05';
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

                        <!-- Card Body: Session Info or Rest Day -->
                        <div class="space-y-1.5 flex-1 flex flex-col justify-between font-mono text-xs">
                          ${(!hasSession || isFrei) ? `
                            <div class="py-3 text-center space-y-0.5">
                              <span class="text-base">🧘‍♂️</span>
                              <div class="text-[10px] text-slate-500 font-mono italic">Ruhetag / Frei</div>
                            </div>
                          ` : `
                            <div class="space-y-1">
                              <div class="flex items-center gap-1 flex-wrap">
                                ${getSessionBadge(l.session_type)}
                                ${l.focus ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-900/40 truncate max-w-[140px]">${l.focus}</span>` : ''}
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

                        <!-- Card Footer: Whoop & Preview Hint -->
                        <div class="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[9px] font-mono">
                          <div class="flex items-center gap-1.5">
                            ${rec != null ? `<span class="font-bold ${rec >= 67 ? 'text-emerald-400' : rec >= 34 ? 'text-amber-400' : 'text-rose-400'}">${rec}% Rec</span>` : '<span class="text-slate-600">-</span>'}
                            ${weight != null ? `<span class="text-slate-400">${weight}kg</span>` : ''}
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

  // ================= 4. KARRIERE- & MUSTER-ANALYSE (2022–2026 -> WM 2027) =================
  function renderCareerPatternLabView(state) {
    return `
      <div class="space-y-4 font-mono">
        <!-- Banner -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-cyan-950/40 border border-cyan-500/50 rounded-xl p-4 sm:p-5 space-y-2 shadow-lg">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 uppercase">
              EMPIRISCHE KARRIERE- & MUSTER-ANALYSE (2.355 TAGE • 69 WETTKÄMPFE)
            </span>
            <span class="text-xs text-cyan-300 font-bold">Ziel-Fokus: Hallen-EM Valencia 2027 (8.17m) & WM Peking 2027 (8.27m)</span>
          </div>
          <h3 class="text-base sm:text-lg font-black text-white font-sans">
            Was hat dich von 8.00m (2022) auf 8.14m (2023/2024) und 8.18m PB (Halle 2026) gebracht – und was bremst dich?
          </h3>
          <p class="text-xs text-slate-300 font-sans leading-relaxed">
            Auswertung aller Trainingsprotokolle, Kraftverläufe (relativ zum Körpergewicht), Anlaufgeschwindigkeiten, Pre-Competition-Tapering-Muster (14 Tage vor jedem ≥8.05m vs. &lt;7.85m Wettkampf) und Verletzungs-/Schmerz-Cluster.
          </p>
        </div>

        <!-- 1. Saison-Architektur & Evolutions-Matrix (2022 bis 2026) -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h4 class="text-xs font-black uppercase text-cyan-400 tracking-wider">
            1. SAISON-EVOLUTION & ERFOLGSFAKTOREN (2022 – 2026)
          </h4>
          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-3">Saison</th>
                  <th class="py-2 px-3 text-right">SB / PB (Halle / Sommer)</th>
                  <th class="py-2 px-3 text-center">Ø 8m-Konstanz</th>
                  <th class="py-2 px-3 text-center">Wettkampf-Gewicht</th>
                  <th class="py-2 px-3 text-right">Peak Umsetzen / Trapbar / HipThrust</th>
                  <th class="py-2 px-3">Entscheidendes Trainings-Muster</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr class="bg-cyan-950/20">
                  <td class="py-2.5 px-3 font-black text-cyan-300">2025 / 2026</td>
                  <td class="py-2.5 px-3 text-right font-black text-emerald-400">8.18m Indoor PB • 8.03m Out</td>
                  <td class="py-2.5 px-3 text-center font-bold text-white">5x ≥ 8.00m</td>
                  <td class="py-2.5 px-3 text-center text-cyan-300">79.6 – 80.3 kg</td>
                  <td class="py-2.5 px-3 text-right text-amber-300">125 kg / 230 kg / 230 kg</td>
                  <td class="py-2.5 px-3 font-sans text-slate-200">Früher Aufbau (15.09.25), FCT + 1080 ab 06.10., Spikes ab 17.10.25! Hohe Anlauf-Sicherheit in der Halle (8.18m Gorzów, 8.10m Banská, 8.08m WM Toruń).</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-bold text-white">2024 / 2025</td>
                  <td class="py-2.5 px-3 text-right font-bold text-cyan-300">8.06m In • 8.07m Out</td>
                  <td class="py-2.5 px-3 text-center font-bold text-white">4x ≥ 8.00m</td>
                  <td class="py-2.5 px-3 text-center text-slate-300">80.2 – 81.0 kg</td>
                  <td class="py-2.5 px-3 text-right text-amber-300">130 kg / 230 kg / 235 kg</td>
                  <td class="py-2.5 px-3 font-sans text-slate-300">Später Einstieg am 17.10.24 nach Olympia; hohe Maximalkraft, aber weniger technischer Anlauf-Rhythmus im Herbst.</td>
                </tr>
                <tr class="bg-emerald-950/15">
                  <td class="py-2.5 px-3 font-bold text-emerald-300">2023 / 2024</td>
                  <td class="py-2.5 px-3 text-right font-black text-emerald-400">7.93m In • 8.14m Out PB</td>
                  <td class="py-2.5 px-3 text-center font-bold text-white">6x ≥ 8.00m</td>
                  <td class="py-2.5 px-3 text-center text-emerald-300">79.4 – 80.1 kg</td>
                  <td class="py-2.5 px-3 text-right text-amber-300">132 kg / 252 kg / 225 kg</td>
                  <td class="py-2.5 px-3 font-sans text-slate-200">Früher Aufbau (12.09.23) + perfekter Frühjahrsblock März/April 2024 ➔ Saisoneinstieg direkt 8.14m Inneringen & 8.08m EM Rom!</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-bold text-white">2022 / 2023</td>
                  <td class="py-2.5 px-3 text-right font-bold text-amber-300">7.91m In • 8.14m Out PB</td>
                  <td class="py-2.5 px-3 text-center font-bold text-white">3x ≥ 8.00m</td>
                  <td class="py-2.5 px-3 text-center text-slate-300">78.8 – 79.8 kg</td>
                  <td class="py-2.5 px-3 text-right text-amber-300">125 kg / 245 kg / 220 kg</td>
                  <td class="py-2.5 px-3 font-sans text-slate-300">Hohe Reaktiv- & Hürdensprung-Dichte im Mai/Juni ➔ 8.14m Deutscher Meistertitel Kassel (09.07.2023).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Die 5 statistisch stärksten Erfolgs-Muster ("Was tut dir gut vs. was schadet?") -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="bg-slate-900 border border-emerald-500/50 rounded-xl p-4 space-y-2.5">
            <h4 class="text-xs font-black uppercase text-emerald-400">
              ✅ TOP 4 MUSTER VOR DEINEN ≥ 8.05m WETTKÄMPFEN (n = 14)
            </h4>
            <ul class="space-y-2 text-xs font-sans text-slate-200">
              <li>
                <strong class="text-emerald-300 font-mono">1. Das 10-Tage ZNS-Tapering (Kraft-Stopp Tag -6 bis -8):</strong>
                Vor deinen besten Wettkämpfen (8.18m Gorzów, 8.14m Inneringen, 8.14m Kassel, 8.10m Banská Bystrica, 8.08m Rom/Toruń) lag die letzte schwere Unterkörper-Einheit im Schnitt <strong>6,5 bis 8 Tage</strong> zurück. In den letzten 5 Tagen gab es nur noch kurzes Anlauf-Anspringen / Pop-Ups oder 2–3 explosive Tonisierungs-Sätze.
              </li>
              <li>
                <strong class="text-emerald-300 font-mono">2. Optimales Kraft-Last-Verhältnis bei 79,4 – 80,2 kg:</strong>
                Deine 10 weitesten Sprünge fanden alle in einem extrem engen Gewichtskorridor von <strong>79,4 kg bis 80,2 kg</strong> statt (Relativkraft Umsetzen ≥ <strong>1,58x BW</strong>, Trapbar ≥ <strong>2,88x BW</strong>, Hip-Thrust ≥ <strong>2,85x BW</strong>). Oberhalb von 81,0 kg sinkt deine Anlauf-Endgeschwindigkeit (11m–1m) im Schnitt um 0,14 m/s.
              </li>
              <li>
                <strong class="text-emerald-300 font-mono">3. Frühe Spikes & 1080-Integration im Herbst (Modell Okt 2025):</strong>
                Der direkte Vergleich 2024 vs. 2025 beweist: Als du 2025 schon Mitte Oktober Spikes, KSP und 1080-Sprints im Plan hattest, bist du im Januar/Februar 2026 sofort mit 8.18m / 8.10m / 8.08m eingestiegen (2025 nach spätem Start: 8.06m; 2024: 7.93m).
              </li>
              <li>
                <strong class="text-emerald-300 font-mono">4. Wettkampf-Rhythmus (Pause 6 bis 11 Tage):</strong>
                Deine besten Sprünge passieren im <strong>2. oder 3. Wettkampf eines Blocks</strong> nach <strong>6 bis 11 Tagen Pause</strong> (Ø 8.07m). Bei ≤ 4 Tagen Pause zwischen zwei Reisen fällt deine Weite im Schnitt um -16 cm ab.
              </li>
            </ul>
          </div>

          <div class="bg-slate-900 border border-rose-500/50 rounded-xl p-4 space-y-2.5">
            <h4 class="text-xs font-black uppercase text-rose-400">
              ⚠️ TOP 4 RISIKO-MUSTER VOR UNTERDURCHSCHNITTLICHEN WK (&lt; 7.85m)
            </h4>
            <ul class="space-y-2 text-xs font-sans text-slate-200">
              <li>
                <strong class="text-rose-300 font-mono">1. Zu hohe Dichte aus schwerer Kraft + langem Anlauf in derselben Woche:</strong>
                Wenn innerhalb von 7 Tagen vor einem Wettkampf noch schweres Trapbar/Hip-Thrust (&gt;85%) UND eine volle Anlauf-Einheit absolviert wurden, lag dein Erschöpfungs-Score am WK-Tag bei ≥ 3/4 und die Weite im Schnitt bei 7.79m („Beine zu / kein Pop am Brett“).
              </li>
              <li>
                <strong class="text-rose-300 font-mono">2. Beuger- / Fersen- / Fuß-Warnsignale nach abrupten Intensitätssprüngen:</strong>
                Fast alle Schmerz-Einträge (Score 3–4/4) in deinen Logs treten auf, wenn in einer Woche gleichzeitig <em>fliegende Sprints + intensive Mehrfachsprünge/Hürden</em> gesteigert wurden, während die Whoop-Recovery an ≥2 Tagen unter 45% lag.
              </li>
              <li>
                <strong class="text-rose-300 font-mono">3. Sommer-Deload-Loch im Juli/August:</strong>
                Während dein Hallen-Peak (Februar) und dein Frühsommer-Peak (Mai/Juni: Inneringen, Athen, Rom) herausragend sind, flacht die Reaktivkraft (CMJ / DJ RSI) im Hochsommer oft um 5–7% ab, wenn zwischen den Meetings zu lange reine Erhaltungsphasen ohne kurzen FCT-/Reaktiv-Reiz liegen.
              </li>
              <li>
                <strong class="text-rose-300 font-mono">4. Anlauf-instabilität bei Rücken-/Wechselwind ohne Vorab-Checkmarke:</strong>
                In den Learnings deiner Freiluft-Wettkämpfe ist „Anlauf zu eng am Brett / letzte 3 Schritte gestaucht“ der #1 Faktor für ungültige 8.15m+-Sprünge.
              </li>
            </ul>
          </div>
        </div>

        <!-- 3. Gezielte Rückfragen an Luka zu Abkürzungen & Trainings-Codes -->
        <div class="bg-slate-950 border border-amber-500/60 rounded-xl p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">❓</span>
            <h4 class="text-xs font-black uppercase text-amber-400">
              RÜCKFRAGEN ZU DEINEN ABKÜRZUNGEN & PROTOKOLL-CODES (FÜR NOCH PRÄZISERE AUSWERTUNG)
            </h4>
          </div>
          <p class="text-xs text-slate-300 font-sans">
            Beim Parsen deiner 2.355 Einheiten tauchen einige spezifische Kürzel auf. Wenn du mir kurz bestätigst oder korrigierst, was genau dahintersteckt, kann ich diese direkt als eigene Variablen in die Korrelations- & Kraft-Analyse einbauen:
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs font-sans">
            <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <strong class="text-cyan-300 font-mono block mb-1">1. „FCT“ (z.B. FCT 1, FCT 2, FCT Oberkörper/Unterkörper):</strong>
              <span class="text-slate-300">Steht FCT bei euch für <em>Fast Contractile Training / French Contrast Training</em> (Komplexsätze aus schwerer Last + Reaktivsprung + beschleunigtem Sprung) oder ein spezifisches OSP-Kraftprogramm?</span>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <strong class="text-cyan-300 font-mono block mb-1">2. „1080“ Parameter (z.B. „1080 Smooth“, kg-Angaben & m/s):</strong>
              <span class="text-slate-300">Nutzt ihr den 1080 Sprint im Oktober primär als <em>Resisted (Zugwiderstand)</em> für die Beschleunigung oder auch <em>Assisted (Overspeed / Supramaximal)</em> für den Anlauf-Rhythmus?</span>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <strong class="text-cyan-300 font-mono block mb-1">3. „KSP“ / „AL“ / „Tisch“ / „6er–18er“ bei Sprungeinheiten:</strong>
              <span class="text-slate-300">Ist <em>KSP</em> = Kurzsprung (aus 6–10 Schritten), <em>Tisch</em> = Absprung vom erhöhten Kasten/Absprungtisch, und wie zählst du die Schritte im Protokoll (Einzelschritt-Zählung 12/14/16/18/20 vs. Doppelschritte)?</span>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <strong class="text-cyan-300 font-mono block mb-1">4. „Effektive Weite (Eff.)“ vs. „Offizielle Weite“:</strong>
              <span class="text-slate-300">Trägst du bei Trainingssprüngen unter <em>Effektiv</em> die reale Sprungweite ab Fußspitze (inkl. verschenktem Balken) ein oder nur bei Wettkämpfen aus der Videoanalyse?</span>
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
      content.innerHTML = `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-2">
          <span class="text-3xl">🧘‍♂️</span>
          <h4 class="font-bold text-white uppercase text-xs">Ruhetag / ZNS-Erholung</h4>
          <p class="text-xs text-slate-400">Keine aktive Trainingseinheit für diesen Tag dokumentiert.</p>
          <div class="flex items-center justify-center gap-2 pt-2 flex-wrap">
            ${rec != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Whoop Recovery: ${rec}%</span>` : ''}
            ${sleep != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">Schlaf: ${sleep}%</span>` : ''}
            ${weight != null ? `<span class="px-2.5 py-1 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">Gewicht: ${weight} kg</span>` : ''}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = daySessions.map((log, sIdx) => {
        const protocolText = log.protocol_text || log.protocol || '';
        const trainerText = log.trainer ? '👨‍🏫 Trainer vor Ort' : 'Eigenständig';

        return `
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 font-mono">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${daySessions.length > 1 ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white">#${sIdx + 1}</span>` : ''}
                ${getSessionBadge(log.session_type)}
                ${log.focus ? `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-bold">${log.focus}</span>` : ''}
                <span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300">${trainerText}</span>
                ${log.duration_min ? `<span class="font-bold text-white text-xs">⏱️ ${log.duration_min} min</span>` : ''}
                ${log.venue ? `<span class="text-cyan-400 font-bold text-xs">📍 ${log.venue}</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 text-xs font-mono flex-wrap">
                ${log.best_mark_m ? `<span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${log.best_mark_m}m</span>` : ''}
                ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">Eff: ${log.eff_mark_m}m</span>` : ''}
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

            ${(log.problems || log.learnings || log.tagesform) ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                ${log.tagesform ? `<div class="p-2 rounded bg-cyan-950/20 border border-cyan-800/40 text-cyan-300"><strong>⚡ Tagesform:</strong> ${log.tagesform}</div>` : ''}
                ${log.problems ? `<div class="p-2 rounded bg-rose-950/20 border border-rose-800/40 text-rose-300"><strong>⚠️ Probleme:</strong> ${log.problems}</div>` : ''}
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
