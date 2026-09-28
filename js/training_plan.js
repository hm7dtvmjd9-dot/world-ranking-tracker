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
  let currentWeekStart = '2026-09-21'; // Monday of the active week
  let currentMonthYear = '2026-09';
  let activeBlockPreset = 'hallenaufbau'; // 'hallenaufbau' | 'hallenvorbereitung' | 'sommeraufbau' | 'sommerwk'
  let activeBlockYears = [2026, 2025, 2024, 2023];
  let planSearchQuery = '';

  function initWeekStart() {
    const d = new Date();
    // Use simulation reference 2026-09-28 (Monday)
    currentWeekStart = '2026-09-21';
  }

  function getMondayOfDate(dStr) {
    const d = new Date(dStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split('T')[0];
  }

  function addDays(dStr, days) {
    const d = new Date(dStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
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
          <button onclick="TrainingPlanModule.jumpToCurrentWeek()" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all">
            📍 Aktuelle Woche (Sep 2026)
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
          <button onclick="TrainingPlanModule.setBlockPreset('hallenaufbau')" class="px-2.5 py-1 rounded transition-all font-bold ${activeBlockPreset === 'hallenaufbau' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            🍂 Hallenaufbau (KW 40 - 51)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('hallenvorbereitung')" class="px-2.5 py-1 rounded transition-all font-bold ${activeBlockPreset === 'hallenvorbereitung' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            ❄️ Hallensaison (KW 01 - 08)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('sommeraufbau')" class="px-2.5 py-1 rounded transition-all font-bold ${activeBlockPreset === 'sommeraufbau' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            🌱 Sommeraufbau (KW 12 - 20)
          </button>
          <button onclick="TrainingPlanModule.setBlockPreset('sommerwk')" class="px-2.5 py-1 rounded transition-all font-bold ${activeBlockPreset === 'sommerwk' ? 'bg-cyan-600 text-slate-950 border border-cyan-400' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}">
            ☀️ Hauptwettkampf (KW 21 - 32)
          </button>
        </div>

        <div class="flex items-center gap-1.5 text-xs font-mono">
          <span class="text-slate-400">Vergleichsjahre:</span>
          ${[2026, 2025, 2024, 2023, 2022].map(y => `
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
      const isToday = dateIso === '2026-09-28';

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
      const isToday = dateIso === '2026-09-28';

      cellsHtml += `
        <div onclick="TrainingPlanModule.openInReadinessTab('${dateIso}')" class="bg-slate-900 border ${isToday ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'} rounded-lg p-2 flex flex-col justify-between min-h-[95px] cursor-pointer transition-all hover:bg-slate-850">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold ${isToday ? 'text-cyan-400 font-black' : 'text-slate-300'}">${day}</span>
            ${dayLogs.length > 0 ? `<span class="w-2 h-2 rounded-full ${dayLogs.some(l => (l.session_type || '').includes('Sprung')) ? 'bg-amber-400' : 'bg-emerald-400'}"></span>` : ''}
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

  // ================= 3. MEHRJAHRES-BLOCKVERGLEICH =================
  function renderBlockComparisonView(state) {
    const logs = state.trainingLogs || [];

    // Define week ranges for presets
    const presetRanges = {
      'hallenaufbau': { minKw: 40, maxKw: 51, title: 'Hallenaufbau (Herbst / ZNS-Akkumulation)' },
      'hallenvorbereitung': { minKw: 1, maxKw: 8, title: 'Spezifische Hallenvorbereitung & Hallensaison' },
      'sommeraufbau': { minKw: 12, maxKw: 20, title: 'Sommeraufbau & Spezifische Zubringer' },
      'sommerwk': { minKw: 21, maxKw: 32, title: 'Hauptwettkampfphase Sommer (DM, EM, WM, Olympia)' }
    };

    const curPreset = presetRanges[activeBlockPreset] || presetRanges['hallenaufbau'];

    // Group logs by year and compute stats
    const yearStats = activeBlockYears.map(year => {
      const yearLogs = logs.filter(l => {
        if (!l.date || !l.date.startsWith(String(year))) return false;
        // Parse week number
        const kwStr = getWeekNumber(l.date);
        const kwNum = parseInt(kwStr.replace(/[^\d]/g, ''), 10);
        return kwNum >= curPreset.minKw && kwNum <= curPreset.maxKw;
      });

      const totalSessions = yearLogs.length;
      const totalMinutes = yearLogs.reduce((sum, l) => sum + (l.duration_min || 0), 0);
      const jumps = yearLogs.filter(l => l.best_mark_m || l.eff_mark_m);
      const bestMark = yearLogs.reduce((max, l) => Math.max(max, l.best_mark_m || 0), 0);
      const peakSpeed = yearLogs.reduce((max, l) => Math.max(max, l.approach_speed_11m_to_1m || 0), 0);
      const peakTrapbar = yearLogs.reduce((max, l) => Math.max(max, l.trapbar_e1rm_kg || 0), 0);
      const recoveries = yearLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
      const avgRecovery = recoveries.length > 0 ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null;

      return {
        year,
        logs: yearLogs,
        totalSessions,
        totalMinutes,
        jumpsCount: jumps.length,
        bestMark: bestMark > 0 ? bestMark.toFixed(2) + 'm' : '-',
        peakSpeed: peakSpeed > 0 ? peakSpeed.toFixed(2) + ' m/s' : '-',
        peakTrapbar: peakTrapbar > 0 ? peakTrapbar + ' kg' : '-',
        avgRecovery: avgRecovery != null ? avgRecovery + '%' : '-'
      };
    });

    return `
      <div class="space-y-4">
        <!-- Comparative KPI Matrix -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 class="text-xs font-black text-white uppercase tracking-wider font-mono">
                📊 BLOCK-VERGLEICH: ${curPreset.title.toUpperCase()}
              </h3>
              <p class="text-[10px] text-slate-400 font-mono mt-0.5">
                Vergleich der gleichen Vorbereitungsphase (KW ${curPreset.minKw} - ${curPreset.maxKw}) über ${activeBlockYears.join(', ')}
              </p>
            </div>
          </div>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-3">Jahr</th>
                  <th class="py-2 px-3 text-center">Einheiten</th>
                  <th class="py-2 px-3 text-center">Gesamtdauer</th>
                  <th class="py-2 px-3 text-center">Ø Whoop Recovery</th>
                  <th class="py-2 px-3 text-right">Top Weite</th>
                  <th class="py-2 px-3 text-right">Peak Vmax Anlauf</th>
                  <th class="py-2 px-3 text-right">Peak Trapbar e1RM</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${yearStats.map(ys => `
                  <tr class="hover:bg-slate-800/30">
                    <td class="py-2.5 px-3 font-bold text-white font-mono text-sm">${ys.year}</td>
                    <td class="py-2.5 px-3 text-center text-cyan-400 font-bold">${ys.totalSessions}</td>
                    <td class="py-2.5 px-3 text-center text-slate-300">${ys.totalMinutes} min</td>
                    <td class="py-2.5 px-3 text-center text-emerald-400 font-bold">${ys.avgRecovery}</td>
                    <td class="py-2.5 px-3 text-right font-black text-amber-400 text-sm">${ys.bestMark}</td>
                    <td class="py-2.5 px-3 text-right text-cyan-300 font-bold">${ys.peakSpeed}</td>
                    <td class="py-2.5 px-3 text-right text-purple-300 font-bold">${ys.peakTrapbar}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detailed Week-by-Week & Weekday Progression Alignment -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider">
            📅 Detaillierte Einheiten nach Kalenderwochen & Wochentagen
          </h4>
          <div class="space-y-3">
            ${yearStats.map(ys => `
              <div class="border border-slate-800 rounded-lg p-3 bg-slate-950/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-mono font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>Jahr ${ys.year} • ${ys.totalSessions} Einheiten im Block</span>
                  <span class="text-slate-400 text-[10px]">KW ${curPreset.minKw} bis KW ${curPreset.maxKw}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  ${ys.logs.slice(0, 9).map(l => `
                    <div class="bg-slate-900 border border-slate-800/80 rounded p-2 text-xs font-mono space-y-1">
                      <div class="flex items-center justify-between text-[10px]">
                        <span class="text-slate-400">${l.weekday || ''} ${formatDisplayDate(l.date)}</span>
                        ${getSessionBadge(l.session_type)}
                      </div>
                      <div class="font-bold text-white text-[11px] truncate">${l.focus || l.session_type || 'Training'}</div>
                      ${l.protocol_text ? `<p class="text-[10px] text-slate-400 line-clamp-2">${l.protocol_text.split('\n')[0]}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
                ${ys.logs.length > 9 ? `<div class="text-[10px] font-mono text-slate-500 italic text-right">+${ys.logs.length - 9} weitere Einheiten in diesem Block</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
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
    currentWeekStart = '2026-09-21';
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
    openInReadinessTab
  };
})();

window.TrainingPlanModule = TrainingPlanModule;
