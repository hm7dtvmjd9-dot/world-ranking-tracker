/**
 * Tab 5: Trainingsplan & Mehrjahres-Blockarchiv (2019 - 2026)
 * Features:
 * - Weekly View (Montag bis Sonntag mit Einheiten, Schwerpunkt, Whoop & Protokoll)
 * - Monthly Calendar View (Monatsübersicht aller Trainingseinheiten)
 * - Multi-Year Block Comparison (Vergleich von Trainingsblöcken wie Hallenaufbau / Spezifische Vorbereitung über 2019-2026)
 * - Search & Filter across 2,305 authentic training sessions from Google Sheets
 * - Strict adherence to authentic sheet columns: Name (Date), Wochentag, Trainingseinheit, Schwerpunkt, Protokoll
 */
const TrainingPlanModule = (() => {
  let activeView = 'week'; // 'week' | 'month' | 'block' | 'search'
  let currentWeekStart = '2026-10-05'; // Monday of KW 41 (Aktuelle Kalenderwoche)
  let currentMonthYear = '2026-10';
  let activeBlockPreset = 'aufbau_herbst'; // 'hallenaufbau' | 'hallenvorbereitung' | 'sommeraufbau' | 'sommerwk'
  let activeBlockYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];
  let planSearchQuery = '';
  let initializedWeek = false;

  function initWeekStart(state) {
    if (initializedWeek) return;
    const logs = (state && state.trainingLogs) || [];
    if (logs.length > 0) {
      const dates = logs.map(l => l.date).filter(Boolean);
      const latest = dates[dates.length - 1];
      if (latest) {
        currentWeekStart = getMondayOfDate(latest);
      }
    } else {
      currentWeekStart = '2026-10-05';
    }
    initializedWeek = true;
  }

  function getMondayOfDate(dStr) {
    if (!dStr) return '2026-10-05';
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

  function getSessionBadge(typeStr) {
    const s = (typeStr || '').toLowerCase();
    if (s.includes('sprung') || s.includes('weitsprung')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">🦘 Sprung / Technik</span>';
    }
    if (s.includes('kraft') || s.includes('athletik') || s.includes('hantel')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">🏋️ Kraft / VBT</span>';
    }
    if (s.includes('sprint') || s.includes('schnelligkeit') || s.includes('tempo')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">⚡ Sprint / Vmax</span>';
    }
    if (s.includes('wettkampf') || s.includes('wk') || s.includes('finale')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">🏆 Wettkampf</span>';
    }
    if (s.includes('regeneration') || s.includes('ruhe') || s.includes('physio') || s.includes('pause')) {
      return '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-blue-950 text-blue-300 border border-blue-800">🧘‍♂️ Regeneration</span>';
    }
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">📋 ${typeStr || 'Training'}</span>`;
  }

  function render(state) {
    const container = document.getElementById('tabContentPlan');
    if (!container) return;

    const logs = state.trainingLogs || [];

    container.innerHTML = `
      <!-- 1. Header Toolbar: Mode Selector & Filters -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 shadow-lg space-y-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">📋</span>
              <h2 class="text-sm font-black text-white uppercase tracking-wider font-mono">
                TRAININGSPLAN & MEHRJAHRES-ARCHIV (2019 - 2026)
              </h2>
            </div>
            <p class="text-[11px] text-slate-400 font-sans mt-0.5">
              ${logs.length.toLocaleString('de-DE')} dokumentierte Einheiten • Wochenansicht, Monatskalender & Blockvergleich
            </p>
          </div>

          <!-- View Tabs (Woche, Monat, Blockvergleich, Suche) -->
          <div class="flex items-center gap-1.5 flex-wrap bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button onclick="TrainingPlanModule.switchView('week')" id="planViewWeekBtn" class="px-3 py-1.5 rounded-md font-bold transition-all ${activeView === 'week' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              📅 Wochen-Plan
            </button>
            <button onclick="TrainingPlanModule.switchView('month')" id="planViewMonthBtn" class="px-3 py-1.5 rounded-md font-bold transition-all ${activeView === 'month' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              🗓️ Monats-Übersicht
            </button>
            <button onclick="TrainingPlanModule.switchView('block')" id="planViewBlockBtn" class="px-3 py-1.5 rounded-md font-bold transition-all ${activeView === 'block' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              📊 Mehrjahres-Blockvergleich
            </button>
            <button onclick="TrainingPlanModule.switchView('search')" id="planViewSearchBtn" class="px-3 py-1.5 rounded-md font-bold transition-all ${activeView === 'search' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}">
              🔍 Protokoll-Suche
            </button>
          </div>
        </div>

        <!-- Dynamic Control Bar based on Active View -->
        <div id="planDynamicControlBar" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="TrainingPlanModule.navigateWeek(-1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
            ◀ Vorherige Woche
          </button>
          <div class="px-3 py-1 rounded bg-slate-950 border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300">
            ${kw} (${formatDisplayDate(currentWeekStart)} - ${formatDisplayDate(sun)})
          </div>
          <button onclick="TrainingPlanModule.navigateWeek(1)" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold transition-all">
            Nächste Woche ▶
          </button>
          <button onclick="TrainingPlanModule.jumpToWeek('2026-10-05')" class="px-2.5 py-1 rounded transition-all text-xs font-mono font-bold ${currentWeekStart === '2026-10-05' ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-cyan-400 border border-slate-800 hover:bg-slate-800'}">
            📍 KW 41 (Aktuell: 05.10. - 11.10.)
          </button>
          <button onclick="TrainingPlanModule.jumpToWeek('2026-09-28')" class="px-2.5 py-1 rounded transition-all text-xs font-mono font-bold ${currentWeekStart === '2026-09-28' ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            📋 KW 40 (Vorwoche: 28.09. - 04.10.)
          </button>
        </div>

        <div class="flex items-center gap-2 text-xs font-mono">
          <label class="text-slate-400">Direktes Datum:</label>
          <input type="date" value="${currentWeekStart}" onchange="TrainingPlanModule.onWeekDatePicked(this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none" />
        </div>
      `;
    }

    if (activeView === 'month') {
      const parts = currentMonthYear.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      return `
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
      `;
    }

    if (activeView === 'block') {
      return `
        <div class="flex items-center gap-2 flex-wrap text-xs font-mono">
          <span class="text-slate-400 font-bold uppercase">Trainingsblock:</span>
          <button onclick="TrainingPlanModule.setBlockPreset('aufbau_herbst')" class="px-2 py-1 rounded transition-all font-bold ${activeBlockPreset === 'aufbau_herbst' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            🍂 Aufbau (Aug-Nov / KW 32-47)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('hallenvorbereitung_dez')" class="px-2 py-1 rounded transition-all font-bold ${activeBlockPreset === 'hallenvorbereitung_dez' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            ❄️ Vorbereitung (Dez / KW 48-52)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('hallensaison_jan_mar')" class="px-2 py-1 rounded transition-all font-bold ${activeBlockPreset === 'hallensaison_jan_mar' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            🏟️ Hallensaison (Jan-Mär / KW 01-10)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('sommervorbereitung_mar_apr')" class="px-2 py-1 rounded transition-all font-bold ${activeBlockPreset === 'sommervorbereitung_mar_apr' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            🌱 Sommervorbereitung (Mär-Apr / KW 11-17)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('sommersaison_mai_aug')" class="px-2 py-1 rounded transition-all font-bold ${activeBlockPreset === 'sommersaison_mai_aug' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            ☀️ Sommersaison (Mai-Aug / KW 18-35)
          </button>
        </div>

        <div class="flex items-center gap-1.5 text-xs font-mono">
          <span class="text-slate-400">Vergleichsjahre:</span>
          ${[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => `
            <button onclick="TrainingPlanModule.toggleBlockYear(${y})" class="px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${activeBlockYears.includes(y) ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-slate-950 text-slate-500 border border-slate-800'}">
              ${y}
            </button>
          `).join('')}
        </div>
      `;
    }

    if (activeView === 'search') {
      return `
        <div class="w-full relative">
          <input type="text" value="${planSearchQuery}" oninput="TrainingPlanModule.onSearchInput(this.value)" placeholder="Volltextsuche in allen 2.305 Protokollen (z.B. 'Anlauf', 'Trapbar', 'Gorzów', 'Rom', '8.04', 'Umsetzen', 'ZNS')..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono" />
        </div>
      `;
    }

    return '';
  }

  function renderViewportContent(state) {
    if (activeView === 'week') return renderWeekView(state);
    if (activeView === 'month') return renderMonthView(state);
    if (activeView === 'block') return renderBlockComparisonView(state);
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
      const todayIso = new Date().toISOString().split('T')[0];
      const isToday = dateIso === todayIso || dateIso === '2026-10-09' || dateIso === '2026-10-08';

      return `
        <div class="bg-slate-900 border ${isToday ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10' : 'border-slate-800'} rounded-xl p-3 sm:p-4 space-y-3">
          <!-- Day Header -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-sm text-white">${d.name}</span>
              <span class="text-xs font-mono text-slate-400">${formatDisplayDate(dateIso)}</span>
              ${isToday ? '<span class="px-1.5 py-0.2 rounded bg-cyan-900 text-cyan-300 border border-cyan-700 font-mono font-bold text-[9px]">HEUTE</span>' : ''}
            </div>
            <div class="flex items-center gap-2">
              ${hasSession ? `<span class="text-[10px] font-mono font-bold text-slate-400">${dayLogs.length} ${dayLogs.length === 1 ? 'Einheit' : 'Einheiten'}</span>` : '<span class="text-[10px] font-mono text-slate-500 italic">Ruhetag</span>'}
              <button onclick="TrainingPlanModule.openInReadinessTab('${dateIso}')" class="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 font-bold underline" title="Diesen Tag in Tab 1 (Tages-Readiness) öffnen">
                Readiness ➔
              </button>
            </div>
          </div>

          <!-- Day Content -->
          ${hasSession ? dayLogs.map((log, sIdx) => {
            const recovery = log.whoop_recovery_pct;
            const sleep = log.sleep_performance_pct;
            const strain = log.whoop_strain;
            const protocolText = log.protocol_text || log.protocol || '';

            return `
              <div class="bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
                <!-- Session Metadata Row -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    ${dayLogs.length > 1 ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-slate-800 text-white">#${sIdx + 1}</span>` : ''}
                    ${getSessionBadge(log.session_type)}
                    ${log.focus ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-amber-300 border border-amber-900/50">${log.focus}</span>` : ''}
                    ${log.duration_min > 0 ? `<span class="text-[11px] font-mono text-slate-300">⏱️ ${log.duration_min} min</span>` : ''}
                    ${log.venue ? `<span class="text-[10px] font-mono text-cyan-400">📍 ${log.venue}</span>` : ''}
                  </div>

                  <!-- Quick Metric Pills -->
                  <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    ${log.best_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">WK: ${log.best_mark_m}m</span>` : ''}
                    ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">Eff: ${log.eff_mark_m}m</span>` : ''}
                    ${log.approach_speed_11m_to_1m ? `<span class="text-cyan-300 font-bold">Vmax: ${log.approach_speed_11m_to_1m} m/s</span>` : ''}
                    ${log.trapbar_e1rm_kg ? `<span class="text-purple-300 font-bold">Trapbar: ${log.trapbar_e1rm_kg} kg</span>` : ''}
                  </div>
                </div>

                <!-- Whoop Readiness Context if recorded for this day -->
                ${(recovery != null || sleep != null || strain != null) ? `
                  <div class="flex items-center gap-3 text-[10px] font-mono bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
                    <span class="text-slate-400 font-bold">Whoop:</span>
                    ${recovery != null ? `<span class="${recovery >= 67 ? 'text-emerald-400' : (recovery >= 34 ? 'text-amber-400' : 'text-rose-400')} font-bold">Recovery: ${recovery}%</span>` : ''}
                    ${sleep != null ? `<span class="text-cyan-300">Schlaf: ${sleep}%</span>` : ''}
                    ${strain != null ? `<span class="text-purple-300">Strain: ${strain.toFixed ? strain.toFixed(1) : strain}</span>` : ''}
                    ${log.schmerzen ? `<span class="text-slate-400">Schmerz: ${log.schmerzen}</span>` : ''}
                    ${log.tagesform ? `<span class="text-slate-400">Form: ${log.tagesform}</span>` : ''}
                  </div>
                ` : ''}

                <!-- Documented Training Protocol -->
                ${protocolText ? `
                  <div class="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div class="flex items-center justify-between text-[10px] font-mono text-cyan-400 font-bold uppercase">
                      <span>📋 Dokumentiertes Protokoll (Google Sheets)</span>
                    </div>
                    <div class="font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/80">
${protocolText}
                    </div>
                  </div>
                ` : `
                  <div class="text-[11px] font-mono text-slate-500 italic py-1">
                    Kein Freitext-Protokoll für diese Einheit hinterlegt.
                  </div>
                `}

                ${log.learnings ? `
                  <div class="text-[10px] font-mono text-amber-300 bg-amber-950/20 border border-amber-900/40 p-2 rounded">
                    <strong>💡 Learnings:</strong> ${log.learnings}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('') : `
            <div class="py-4 text-center text-slate-500 font-mono text-xs italic bg-slate-950/40 rounded-lg border border-slate-800/40">
              🧘‍♂️ Geplanter Ruhetag / Keine Einheit dokumentiert
            </div>
          `}
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-3">
        ${weekCardsHtml}
      </div>
    `;
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
    const month = parseInt(parts[1], 10); // 1-12

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1); // 0 is Monday

    const dayHeaders = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    let cellsHtml = '';
    // Empty cells before start
    for (let i = 0; i < startOffset; i++) {
      cellsHtml += `<div class="bg-slate-950/40 border border-slate-800/40 rounded-lg p-1.5 opacity-30 min-h-[90px]"></div>`;
    }

    // Actual month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLogs = logsByDate[dateIso] || [];
      const todayIso = new Date().toISOString().split('T')[0];
      const isToday = dateIso === todayIso || dateIso === '2026-10-09' || dateIso === '2026-10-08';

      cellsHtml += `
        <div onclick="TrainingPlanModule.openInReadinessTab('${dateIso}')" class="bg-slate-900 border ${isToday ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'} rounded-lg p-2 flex flex-col justify-between min-h-[95px] cursor-pointer transition-all hover:bg-slate-850">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold ${isToday ? 'text-cyan-400 font-black' : 'text-slate-300'}">${day}</span>
            ${(() => {
              const rec = dayLogs.find(l => l.whoop_recovery_pct != null)?.whoop_recovery_pct;
              if (rec != null) {
                if (rec >= 67) return `<span class="w-2 h-2 rounded-full bg-emerald-400" title="Whoop Recovery: ${rec}% (Optimal)"></span>`;
                if (rec >= 34) return `<span class="w-2 h-2 rounded-full bg-amber-400" title="Whoop Recovery: ${rec}% (Moderat)"></span>`;
                return `<span class="w-2 h-2 rounded-full bg-rose-400" title="Whoop Recovery: ${rec}% (Regenerativ)"></span>`;
              }
              if (dayLogs.length > 0 && dayLogs.some(l => (l.duration_min || 0) > 0)) {
                return '<span class="w-2 h-2 rounded-full bg-cyan-400" title="Trainingseinheit absolviert"></span>';
              }
              return '';
            })()}
          </div>

          <div class="space-y-1 my-1">
            ${dayLogs.slice(0, 2).map(l => `
              <div class="text-[9px] font-mono truncate px-1 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300" title="${l.session_type}: ${l.focus || ''}">
                ${l.session_type || 'Training'}
              </div>
            `).join('')}
            ${dayLogs.length > 2 ? `<span class="text-[8px] font-mono text-slate-500">+${dayLogs.length - 2} weitere</span>` : ''}
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

  // ================= 3. MEHRJAHRES-BLOCKVERGLEICH (2020 - 2026) =================
  function renderBlockComparisonView(state) {
    const logs = state.trainingLogs || [];

    const presetRanges = {
      'aufbau_herbst': { minKw: 32, maxKw: 47, title: 'Allgemeiner Aufbau (August - November / KW 32 - 47)' },
      'hallenvorbereitung_dez': { minKw: 48, maxKw: 52, title: 'Spezifische Hallenvorbereitung (Dezember / KW 48 - 52)' },
      'hallensaison_jan_mar': { minKw: 1, maxKw: 10, title: 'Hallensaison / Wettkämpfe (Januar - März / KW 01 - 10)' },
      'sommervorbereitung_mar_apr': { minKw: 11, maxKw: 17, title: 'Sommervorbereitung (März - April / KW 11 - 17)' },
      'sommersaison_mai_aug': { minKw: 18, maxKw: 35, title: 'Sommer-Wettkampfsaison (Mai - August / KW 18 - 35)' }
    };

    const curPreset = presetRanges[activeBlockPreset] || presetRanges['aufbau_herbst'];

    // Group logs by year and compute stats (strictly excluding rest days from session count)
    const yearStats = activeBlockYears.map(year => {
      const yearLogs = logs.filter(l => {
        if (!l.date || !l.date.startsWith(String(year))) return false;
        const kwStr = getWeekNumber(l.date);
        const kwNum = parseInt(kwStr.replace(/[^\d]/g, ''), 10);
        return kwNum >= curPreset.minKw && kwNum <= curPreset.maxKw;
      });

      // Filter real sessions (Frei ist keine Einheit!)
      const realSessions = yearLogs.filter(l => {
        const sType = (l.session_type || '').toLowerCase();
        const f = (l.focus || '').toLowerCase();
        const dur = l.duration_min || 0;
        return dur > 0 && !sType.includes('frei') && !sType.includes('ruhetag') && !sType.includes('pause') && !f.includes('frei') && !f.includes('ruhetag');
      });

      const totalSessions = realSessions.length;
      const totalMinutes = realSessions.reduce((sum, l) => sum + (l.duration_min || 0), 0);
      
      // Peak 4 main lifts
      const peakUmsetzen = yearLogs.reduce((max, l) => Math.max(max, l.umzetten_e1rm_kg || 0), 0);
      const peakHipthrust = yearLogs.reduce((max, l) => Math.max(max, l.hipthrust_e1rm_kg || 0), 0);
      const peakTrapbar = yearLogs.reduce((max, l) => Math.max(max, l.trapbar_e1rm_kg || 0), 0);
      const peakAufsteiger = yearLogs.reduce((max, l) => Math.max(max, l.aufsteiger_e1rm_kg || 0), 0);

      const peakSpeed = yearLogs.reduce((max, l) => Math.max(max, l.approach_speed_11m_to_1m || 0), 0);
      const recoveries = yearLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
      const avgRecovery = recoveries.length > 0 ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null;

      return {
        year,
        logs: yearLogs,
        realSessions,
        totalSessions,
        totalMinutes,
        peakUmsetzen: peakUmsetzen > 0 ? peakUmsetzen + ' kg' : '-',
        peakHipthrust: peakHipthrust > 0 ? peakHipthrust + ' kg' : '-',
        peakTrapbar: peakTrapbar > 0 ? peakTrapbar + ' kg' : '-',
        peakAufsteiger: peakAufsteiger > 0 ? peakAufsteiger + ' kg' : '-',
        peakSpeed: peakSpeed > 0 ? peakSpeed.toFixed(2) + ' m/s' : '-',
        avgRecovery: avgRecovery != null ? avgRecovery + '%' : '-'
      };
    });

    return `
      <div class="space-y-4">
        <!-- Comparative KPI Matrix with 4 Main Lifts -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 class="text-xs font-black text-white uppercase tracking-wider font-mono">
                📊 BLOCK-VERGLEICH: ${curPreset.title.toUpperCase()}
              </h3>
              <p class="text-[10px] text-slate-400 font-mono mt-0.5">
                Nur echte Trainingseinheiten gezählt (Ruhetage/Frei exkludiert) • Kraftentwicklung der 4 Hauptübungen über 7 Jahre
              </p>
            </div>
          </div>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-3">Jahr</th>
                  <th class="py-2 px-3 text-center">Einheiten (Netto)</th>
                  <th class="py-2 px-3 text-center">Gesamtdauer</th>
                  <th class="py-2 px-3 text-center">Ø Recovery</th>
                  <th class="py-2 px-3 text-right text-amber-400">Peak Umsetzen</th>
                  <th class="py-2 px-3 text-right text-rose-400">Peak Hip-Thrust</th>
                  <th class="py-2 px-3 text-right text-purple-400">Peak Trapbar</th>
                  <th class="py-2 px-3 text-right text-emerald-400">Peak Aufsteiger</th>
                  <th class="py-2 px-3 text-right">Anlauf-Vmax</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${yearStats.map(ys => `
                  <tr class="hover:bg-slate-800/30">
                    <td class="py-2.5 px-3 font-bold text-white font-mono text-sm">${ys.year}</td>
                    <td class="py-2.5 px-3 text-center text-cyan-400 font-bold">${ys.totalSessions}</td>
                    <td class="py-2.5 px-3 text-center text-slate-300">${ys.totalMinutes} min</td>
                    <td class="py-2.5 px-3 text-center text-emerald-400 font-bold">${ys.avgRecovery}</td>
                    <td class="py-2.5 px-3 text-right font-black text-amber-300">${ys.peakUmsetzen}</td>
                    <td class="py-2.5 px-3 text-right font-black text-rose-300">${ys.peakHipthrust}</td>
                    <td class="py-2.5 px-3 text-right font-black text-purple-300">${ys.peakTrapbar}</td>
                    <td class="py-2.5 px-3 text-right font-black text-emerald-300">${ys.peakAufsteiger}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-cyan-400">${ys.peakSpeed}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ================= VERTIKAL GESTAPELTE MEHRJAHRES-ZEILEN (2026 BIS 2019) ================= -->
        <div class="space-y-4 pt-1">
          <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 class="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <span>🔄</span>
                <span>PARALLELER MEHRJAHRES-TAGESBROWSER (2026 BIS 2019 UNTEREINANDER)</span>
              </h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">
                Jedes Jahr als eigenständige Zeile • Tage horizontal nebeneinander • Unabhängig voneinander nach links und rechts wischbar
              </p>
            </div>
            <div class="flex items-center gap-2 text-xs font-mono">
              <span class="text-slate-400 text-[11px]">Tipp:</span>
              <span class="text-cyan-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-[10px]">
                2026 auf Anfang Oktober stellen & 2025 auf Mitte Oktober wischen für direkten Block-Vergleich!
              </span>
            </div>
          </div>

          <!-- Stacking each year from 2026 down to 2019 -->
          <div class="space-y-3.5">
            ${[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].map(yr => {
              // Group logs of this year by date
              const yearLogsByDate = {};
              logs.forEach(l => {
                if (l.date && l.date.startsWith(String(yr))) {
                  yearLogsByDate[l.date] = l;
                }
              });

              // Generate consecutive calendar days from Sep 1 to Nov 15 (covering all of September, October, and mid-November)
              const startDate = new Date(yr, 8, 1); // 01. September
              const endDate = new Date(yr, 10, 15); // 15. November
              const dayCards = [];

              let cur = new Date(startDate);
              while (cur <= endDate) {
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const dateIso = `${y}-${m}-${d}`;

                const log = yearLogsByDate[dateIso] || null;
                const dObj = new Date(cur);
                const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                const dayName = dayNames[dObj.getDay()];
                const kwStr = getWeekNumber(dateIso);
                const isToday = dateIso === '2026-10-09' || dateIso === '2026-10-08' || dateIso === '2026-10-05';

                dayCards.push({
                  dateIso,
                  displayDate: `${dayName}, ${d}.${m}.`,
                  kwStr,
                  isToday,
                  log
                });

                cur.setDate(cur.getDate() + 1);
              }

              // Compute stats for October of this year
              const octLogs = logs.filter(l => l.date && l.date.startsWith(`${yr}-10-`));
              const octRecoveries = octLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
              const avgOctRec = octRecoveries.length > 0 ? Math.round(octRecoveries.reduce((a, b) => a + b, 0) / octRecoveries.length) : null;
              const isRefYear = yr === 2025;

              return `
                <div class="bg-slate-900 border ${isRefYear ? 'border-amber-600/70 shadow-lg shadow-amber-950/20' : yr === 2026 ? 'border-cyan-600/70 shadow-lg shadow-cyan-950/20' : 'border-slate-800'} rounded-xl p-3 sm:p-4 space-y-2.5">
                  <!-- Row Header & Controls -->
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="px-2.5 py-0.5 rounded text-xs font-mono font-black ${
                        yr === 2026 ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                        yr === 2025 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-950 text-slate-300 border border-slate-800'
                      }">
                        JAHR ${yr}
                      </span>
                      ${yr === 2026 ? '<span class="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px] font-mono font-bold">AKTUELLE SAISON</span>' : ''}
                      ${yr === 2025 ? '<span class="px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 text-[10px] font-mono font-bold">⭐ LUKA TRAININGS-REFERENZ (MITTE OKT)</span>' : ''}
                      <span class="text-[11px] font-mono text-slate-400">
                        ${octLogs.length} Einheiten im Okt ${avgOctRec != null ? `• Ø ${avgOctRec}% Recovery` : ''}
                      </span>
                    </div>

                    <!-- Jump Pills & Track Navigation for this specific Year Row -->
                    <div class="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                      <span class="text-slate-500 mr-0.5">Sprung:</span>
                      <button onclick="TrainingPlanModule.jumpYearTrackToDate(${yr}, '${yr}-10-01')" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all">
                        📅 Okt Anfang
                      </button>
                      <button onclick="TrainingPlanModule.jumpYearTrackToDate(${yr}, '${yr}-10-13')" class="px-2.5 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-bold border border-cyan-800 transition-all">
                        ⚡ Mitte Okt (10.-20.10.)
                      </button>
                      <button onclick="TrainingPlanModule.jumpYearTrackToDate(${yr}, '${yr}-10-25')" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all">
                        Ende Okt
                      </button>
                      <button onclick="TrainingPlanModule.jumpYearTrackToDate(${yr}, '${yr}-09-15')" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all">
                        🍂 Sep / Aufbau
                      </button>

                      <div class="flex items-center gap-1 ml-1 border-l border-slate-800 pl-1.5">
                        <button onclick="TrainingPlanModule.scrollYearTrack(${yr}, -450)" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs" title="Nach links wischen">
                          ◀
                        </button>
                        <button onclick="TrainingPlanModule.scrollYearTrack(${yr}, 450)" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs" title="Nach rechts wischen">
                          ▶
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Horizontal Swipeable Track (Days side-by-side, independent scroll) -->
                  <div 
                    id="yearTrack_${yr}" 
                    class="flex gap-2.5 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing px-1"
                    style="scroll-snap-type: x mandatory;"
                  >
                    ${dayCards.map(dc => {
                      const l = dc.log;
                      const hasSession = l != null;
                      const isFrei = !hasSession || (l.session_type || '').toLowerCase().includes('frei') || (l.session_type || '').toLowerCase().includes('ruhetag') || ((l.duration_min || 0) === 0 && !l.protocol_text);
                      const rec = l?.whoop_recovery_pct;
                      const sleep = l?.sleep_performance_pct;
                      const strain = l?.whoop_strain;
                      const weight = l?.body_weight_kg;

                      return `
                        <div 
                          id="dayCard_${yr}_${dc.dateIso}" 
                          class="w-[245px] sm:w-[275px] shrink-0 bg-slate-950 border ${
                            dc.isToday ? 'border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500' :
                            hasSession && !isFrei ? 'border-slate-800 hover:border-slate-700' :
                            'border-slate-900/80 bg-slate-950/60'
                          } rounded-xl p-2.5 space-y-2 flex flex-col justify-between transition-all"
                          style="scroll-snap-align: start;"
                        >
                          <!-- Card Top Bar: Date & KW -->
                          <div class="flex items-center justify-between pb-1.5 border-b border-slate-800/80 font-mono text-xs">
                            <div class="flex items-center gap-1.5">
                              <span class="font-black ${dc.isToday ? 'text-cyan-400' : 'text-white'}">${dc.displayDate}</span>
                              <span class="text-[10px] text-slate-400 font-sans">${dc.dateIso.split('-')[0]}</span>
                            </div>
                            <div class="flex items-center gap-1">
                              <span class="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 text-slate-400 border border-slate-800 font-bold">${dc.kwStr}</span>
                              ${dc.isToday ? '<span class="px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[8px] font-black">HEUTE</span>' : ''}
                            </div>
                          </div>

                          <!-- Card Body: Session Info or Rest Day -->
                          <div class="space-y-1.5 flex-1 flex flex-col justify-between font-mono text-xs">
                            ${(!hasSession || isFrei) ? `
                              <div class="py-4 text-center space-y-1">
                                <span class="text-lg">🧘‍♂️</span>
                                <div class="text-[11px] text-slate-500 font-mono italic">Ruhetag / Erholung</div>
                              </div>
                            ` : `
                              <div class="space-y-1">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                  ${getSessionBadge(l.session_type)}
                                  ${l.focus ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-900/40 truncate max-w-[150px]">${l.focus}</span>` : ''}
                                </div>

                                <div class="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                  ${l.duration_min > 0 ? `<span>⏱️ ${l.duration_min} min</span>` : '<span></span>'}
                                  ${l.venue ? `<span class="truncate ml-1 text-cyan-400">📍 ${l.venue}</span>` : '<span></span>'}
                                </div>
                              </div>
                            `}

                            <!-- Whoop Biometrics Row -->
                            ${(rec != null || sleep != null || weight != null) ? `
                              <div class="flex items-center justify-between text-[10px] font-mono bg-slate-900/90 px-2 py-1 rounded border border-slate-800/80">
                                ${rec != null ? `
                                  <span class="font-bold ${rec >= 67 ? 'text-emerald-400' : (rec >= 34 ? 'text-amber-400' : 'text-rose-400')}">
                                    ${rec}% Rec
                                  </span>
                                ` : '<span class="text-slate-600">-</span>'}
                                ${sleep != null ? `<span class="text-cyan-300 text-[9px]">💤 ${sleep}%</span>` : ''}
                                ${weight != null ? `<span class="text-amber-300 font-bold text-[9px]">⚖️ ${weight}kg</span>` : ''}
                              </div>
                            ` : ''}

                            <!-- Protocol Text Snippet -->
                            ${l && l.protocol_text ? `
                              <div class="text-[10px] text-slate-300 line-clamp-2 italic bg-slate-900/60 border border-slate-800/60 p-1.5 rounded leading-relaxed whitespace-pre-line" title="${l.protocol_text}">
                                "${l.protocol_text}"
                              </div>
                            ` : ''}
                          </div>

                          <!-- Card Footer: Direct Link to Tab 1 Readiness -->
                          <div class="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                            <span class="text-slate-500">${l?.trainer ? '👤 Trainer vor Ort' : ''}</span>
                            <button onclick="TrainingPlanModule.openInReadinessTab('${dc.dateIso}')" class="text-cyan-400 hover:text-cyan-300 font-bold underline">
                              In Tab 1 öffnen ➔
                            </button>
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
      </div>
    `;

    // Attach drag & swipe listeners and set initial horizontal alignment for comparison
    setTimeout(() => {
      [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].forEach(yr => {
        attachTrackDragListeners(yr);
      });
      // Align 2026 to latest October log and 2025 to mid-October for immediate parallel comparison
      jumpYearTrackToDate(2026, '2026-10-08');
      jumpYearTrackToDate(2025, '2025-10-13');
    }, 100);
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

  function attachTrackDragListeners(yr) {
    const track = document.getElementById(`yearTrack_${yr}`);
    if (!track) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    track.addEventListener('mousedown', (e) => {
      isDown = true;
      track.classList.add('cursor-grabbing');
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });

    track.addEventListener('mouseleave', () => {
      isDown = false;
      track.classList.remove('cursor-grabbing');
    });

    track.addEventListener('mouseup', () => {
      isDown = false;
      track.classList.remove('cursor-grabbing');
    });

    track.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 1.5;
      track.scrollLeft = scrollLeft - walk;
    });
  }

  function jumpToWeek(mondayStr) {
    currentWeekStart = mondayStr;
    const state = (window.App && window.App.state) || {};
    render(state);
  }

  function jumpToCurrentWeek() {
    currentWeekStart = '2026-10-05';
    const state = (window.App && window.App.state) || {};
    render(state);
  }

  // ================= 4. VOLLTEXT PROTOKOLL-SUCHE =================
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
    }) : logs.slice(-30);

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <span class="text-xs font-bold font-mono text-white">
            ${query ? `Gefundene Treffer: ${matches.length}` : 'Zuletzt dokumentierte Einheiten (30 von 2.305):'}
          </span>
          ${query ? `<button onclick="TrainingPlanModule.clearSearch()" class="text-xs font-mono text-cyan-400 hover:underline">Suche zurücksetzen ✕</button>` : ''}
        </div>

        <div class="space-y-2.5">
          ${matches.length > 0 ? matches.map(l => `
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs">
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
                  <button onclick="TrainingPlanModule.openInReadinessTab('${l.date}')" class="text-cyan-400 hover:text-cyan-300 text-[10px] font-bold underline">
                    In Tab 1 öffnen ➔
                  </button>
                </div>
              </div>

              ${l.protocol_text ? `
                <div class="text-slate-300 whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/60 text-xs">
${l.protocol_text}
                </div>
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

  // View Navigation Handlers
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

  function jumpToCurrentWeek() {
    currentWeekStart = '2026-09-28';
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

  return {
    render,
    switchView,
    navigateWeek,
    jumpToCurrentWeek,
    onWeekDatePicked,
    navigateMonth,
    onMonthYearSelected,
    setBlockPreset,
    toggleBlockYear,
    onSearchInput,
    clearSearch,
    openInReadinessTab,
    scrollYearTrack,
    jumpYearTrackToDate,
    jumpToWeek
  };
})();

window.TrainingPlanModule = TrainingPlanModule;
