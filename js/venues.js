/**
 * Tab 4: Verifizierter Meeting- & Wettkampfkalender 2027
 * Grounded in European Athletics & World Athletics Tour official documents.
 * Target Discipline: Weitsprung Männer (Men's LJ).
 * Excludes non-Men's LJ meetings via strict GraphQL units inspection.
 * Includes interactive personal season planner (🟢 Sicher / ⭐ Merkliste / 🚫 Ausblenden).
 */
const VenuesModule = (() => {
  const STATUS_STORAGE_KEY = 'athletics_intel_user_meeting_statuses';

  let selectedTier = 'ALL';
  let selectedStatusFilter = 'ALL'; // 'ALL' | 'MY_PLAN' | 'CONFIRMED' | 'WATCHLIST' | 'HIDDEN'
  let hideExcludedMeetings = true; // Hide meetings marked as 'hidden' when not explicitly viewing 'HIDDEN'
  let currentViewMode = 'list'; // 'list' | 'calendar'
  let mensOnly = true;
  let initializedListeners = false;
  let searchQuery = '';
  let expandedMeetingId = null;

  // --- LocalStorage Status Helpers ---
  function getUserStatuses() {
    try {
      const data = localStorage.getItem(STATUS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Error reading meeting statuses from localStorage', e);
      return {};
    }
  }

  function getMeetingStatus(id) {
    const statuses = getUserStatuses();
    return statuses[id] || 'none';
  }

  function setMeetingStatus(meetingId, status) {
    const statuses = getUserStatuses();
    if (!status || status === 'none') {
      delete statuses[meetingId];
    } else {
      statuses[meetingId] = status;
    }
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(statuses));
    } catch (e) {
      console.warn('Error writing meeting statuses to localStorage', e);
    }

    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') {
        renderCalendarMonthGrid(window.App.state);
      }
    }
  }

  function toggleMeetingStatus(meetingId, targetStatus) {
    const current = getMeetingStatus(meetingId);
    if (current === targetStatus) {
      setMeetingStatus(meetingId, 'none');
    } else {
      setMeetingStatus(meetingId, targetStatus);
    }
  }

  function setMeetingStatusAndRefreshModal(meetingId, status) {
    setMeetingStatus(meetingId, status);
    openMeetingInfoModal(meetingId);
  }

  function toggleMeetingRow(id) {
    expandedMeetingId = expandedMeetingId === id ? null : id;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function initListeners() {
    if (initializedListeners) return;

    const filterCheckbox = document.getElementById('filterMensLjOnly');
    if (filterCheckbox) {
      filterCheckbox.checked = mensOnly;
      filterCheckbox.addEventListener('change', (e) => {
        mensOnly = e.target.checked;
        if (window.App && window.App.state) {
          render(window.App.state);
        }
      });
    }

    const tierButtons = document.querySelectorAll('.cal-tier-btn');
    tierButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tierButtons.forEach(b => {
          b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800';
        });
        btn.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
        selectedTier = btn.getAttribute('data-tier') || 'ALL';
        if (window.App && window.App.state) {
          render(window.App.state);
          if (currentViewMode === 'calendar') {
            renderCalendarMonthGrid(window.App.state);
          }
        }
      });
    });

    initializedListeners = true;
  }

  function matchesSelectedTier(m) {
    if (selectedTier === 'ALL') return true;
    if (selectedTier === 'Meisterschaft') {
      return Boolean(
        m.isChampionship ||
        (m.tier && m.tier.toLowerCase() === 'meisterschaft') ||
        (m.championshipType && m.championshipType.length > 0)
      );
    }
    return (m.tier || '').toLowerCase() === selectedTier.toLowerCase();
  }

  function setStatusFilter(filterKey) {
    selectedStatusFilter = filterKey;
    updateStatusFilterButtonsUI();
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') {
        renderCalendarMonthGrid(window.App.state);
      }
    }
  }

  function toggleHideExcluded() {
    const chk = document.getElementById('hideExcludedMeetingsCheckbox');
    hideExcludedMeetings = chk ? chk.checked : !hideExcludedMeetings;
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') {
        renderCalendarMonthGrid(window.App.state);
      }
    }
  }

  function handleSearchInput(query) {
    searchQuery = (query || '').trim();
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') {
        renderCalendarMonthGrid(window.App.state);
      }
    }
  }

  function updateStatusFilterButtonsUI() {
    const buttons = document.querySelectorAll('.cal-status-btn');
    buttons.forEach(btn => {
      const f = btn.getAttribute('data-status-filter');
      if (f === selectedStatusFilter) {
        if (f === 'MY_PLAN') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 font-black shadow-sm flex items-center gap-1';
        } else if (f === 'CONFIRMED') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white font-black shadow-sm flex items-center gap-1';
        } else if (f === 'WATCHLIST') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-amber-400 text-slate-950 font-black shadow-sm flex items-center gap-1';
        } else if (f === 'HIDDEN') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-rose-700 text-white font-black shadow-sm flex items-center gap-1';
        } else {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-slate-950 font-black shadow-sm flex items-center gap-1';
        }
      } else {
        btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800 flex items-center gap-1';
      }
    });
  }

  function updateStatusFilterCounts(meetings, statuses) {
    const confirmedCount = meetings.filter(m => statuses[m.id] === 'confirmed').length;
    const watchlistCount = meetings.filter(m => statuses[m.id] === 'watchlist').length;
    const hiddenCount = meetings.filter(m => statuses[m.id] === 'hidden').length;
    const myPlanCount = confirmedCount + watchlistCount;

    const elAll = document.getElementById('statusCountAll');
    if (elAll) elAll.textContent = meetings.length;
    const elPlan = document.getElementById('statusCountMyPlan');
    if (elPlan) elPlan.textContent = myPlanCount;
    const elConf = document.getElementById('statusCountConfirmed');
    if (elConf) elConf.textContent = confirmedCount;
    const elWatch = document.getElementById('statusCountWatchlist');
    if (elWatch) elWatch.textContent = watchlistCount;
    const elHid = document.getElementById('statusCountHidden');
    if (elHid) elHid.textContent = hiddenCount;
  }

  function renderSeasonPlanCockpit(meetings, statuses) {
    const container = document.getElementById('mySeasonPlanSummaryContainer');
    if (!container) return;

    const confirmedMeets = meetings.filter(m => statuses[m.id] === 'confirmed')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const watchlistMeets = meetings.filter(m => statuses[m.id] === 'watchlist')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const allPlanMeets = [...confirmedMeets, ...watchlistMeets]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (allPlanMeets.length === 0) {
      container.innerHTML = `
        <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">💡</span>
            <div>
              <strong class="text-emerald-300 uppercase tracking-wide">Erstelle dein persönliches Wettkampf-Gerüst 2027:</strong>
              <p class="text-slate-300 text-[11px] font-sans mt-0.5">
                Klicke in der Tabelle oder im Kalender bei deinen Wunsch-Meetings auf <span class="text-emerald-400 font-bold font-mono">🟢 Sicher</span> oder <span class="text-amber-400 font-bold font-mono">⭐ Option</span>. Nicht relevante Wettkämpfe kannst du mit <span class="text-rose-400 font-bold font-mono">🚫 Weg</span> sauber ausblenden.
              </p>
            </div>
          </div>
          <button onclick="VenuesModule.loadDefaultLukaSchedule()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg text-xs font-mono transition-all shadow-sm shrink-0">
            ⚡ Lukas Kern-Wettkämpfe als Basis laden
          </button>
        </div>
      `;
      return;
    }

    // Compute gaps between planned events
    const planGaps = [];
    for (let i = 1; i < allPlanMeets.length; i++) {
      const d1 = new Date(allPlanMeets[i - 1].date);
      const d2 = new Date(allPlanMeets[i].date);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      planGaps.push(diffDays);
    }
    const avgGap = planGaps.length > 0 ? (planGaps.reduce((a, b) => a + b, 0) / planGaps.length).toFixed(1) : '-';

    const firstMeet = allPlanMeets[0];
    const lastMeet = allPlanMeets[allPlanMeets.length - 1];

    container.innerHTML = `
      <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/50 rounded-xl p-3.5 sm:p-4 shadow-lg space-y-3 font-mono">
        <!-- Top Row: Title, KPI & Action Buttons -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏆</span>
            <div>
              <h3 class="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>DEIN WETTKAMPF-GERÜST 2027</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-slate-950">${confirmedMeets.length} FESTE STARTS</span>
                ${watchlistMeets.length > 0 ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950">${watchlistMeets.length} OPTIONEN</span>` : ''}
              </h3>
              <p class="text-[11px] text-slate-300 font-sans mt-0.5">
                Auftakt: <strong>${firstMeet.displayDate || firstMeet.date}</strong> (${firstMeet.city}) • Saisonhöhepunkt: <strong>${lastMeet.displayDate || lastMeet.date}</strong> (${lastMeet.name})
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="VenuesModule.copySeasonPlanText()" class="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-[11px] rounded-lg transition-all shadow-sm flex items-center gap-1">
              <span>📋</span> Plan kopieren (Coach / WhatsApp)
            </button>
            <button onclick="VenuesModule.setStatusFilter('MY_PLAN')" class="px-2.5 py-1.5 ${selectedStatusFilter === 'MY_PLAN' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-emerald-700'} text-[11px] rounded-lg transition-all flex items-center gap-1 font-bold">
              <span>📅</span> ${selectedStatusFilter === 'MY_PLAN' ? '✓ Planansicht aktiv' : 'Nur Plan anzeigen'}
            </button>
          </div>
        </div>

        <!-- Metrics Row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div class="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
            <span class="text-[9px] text-slate-400 block uppercase font-bold">Sichere Starts</span>
            <span class="text-sm font-black text-emerald-400">${confirmedMeets.length}</span>
          </div>
          <div class="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
            <span class="text-[9px] text-slate-400 block uppercase font-bold">Merkliste / Optionen</span>
            <span class="text-sm font-black text-amber-300">${watchlistMeets.length}</span>
          </div>
          <div class="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
            <span class="text-[9px] text-slate-400 block uppercase font-bold">Ø Pause zwischen WKs</span>
            <span class="text-sm font-black text-cyan-400">${avgGap} ${avgGap !== '-' ? 'Tage' : ''}</span>
          </div>
          <div class="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
            <span class="text-[9px] text-slate-400 block uppercase font-bold">Gesamt-Gerüst</span>
            <span class="text-sm font-black text-white">${allPlanMeets.length} Wettkämpfe</span>
          </div>
        </div>

        <!-- Timeline Strip of Planned Competitions -->
        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chronologischer Saison-Fahrplan:</span>
          <div class="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            ${allPlanMeets.map((m, idx) => {
              const isConf = statuses[m.id] === 'confirmed';
              return `
                <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="shrink-0 cursor-pointer p-2 rounded-lg border transition-all hover:scale-[1.02] ${
                  isConf
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                    : 'bg-amber-950/70 border-amber-500/80 text-amber-200'
                }">
                  <div class="flex items-center justify-between gap-1 text-[9px] font-bold mb-0.5">
                    <span>${isConf ? '🟢 SICHER' : '⭐ OPTION'}</span>
                    <span class="text-slate-400">${m.displayDate || m.date}</span>
                  </div>
                  <div class="text-[11px] font-bold text-white truncate max-w-[150px]" title="${m.name}">
                    ${m.shortName || m.name}
                  </div>
                  <div class="flex items-center justify-between gap-1 text-[9px] text-slate-400 mt-1 font-mono">
                    <span>📍 ${m.city}</span>
                    <span class="font-bold text-cyan-400">Kat. ${m.category}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function loadDefaultLukaSchedule() {
    // Sensible core defaults for Luka Herden (DM Halle, Gorzów, Hallen-EM Valencia, Weinheim, CISM, Team-EM, DM Freiluft, WM Peking)
    const defaults = {
      'dlv-dortmund-jnr-indoor-2027': 'watchlist',
      'dlv-dortmund-sparkassen-2027': 'watchlist',
      'wa-gorzow-indoor-2027': 'confirmed', // 8.18m PB track!
      'dlv-karlsruhe-init-2027': 'watchlist',
      'dlv-berlin-istaf-indoor-2027': 'watchlist',
      'champ-dm-halle-2027': 'confirmed',
      'champ-em-indoor-2027': 'confirmed',
      'dlv-weinheim-kurpfalz-2027': 'confirmed',
      'dl-rabat-2027': 'watchlist',
      'dlv-dessau-anhalt-2027': 'watchlist',
      'champ-cism-2027': 'confirmed',
      'champ-team-em-2027': 'confirmed',
      'dlv-essen-springer-2027': 'watchlist',
      'champ-dm-outdoor-2027': 'confirmed',
      'dl-lausanne-2027': 'watchlist',
      'dl-london-2027': 'watchlist',
      'dlv-inneringen-schlossberg-2027': 'confirmed',
      'dl-silesia-2027': 'watchlist',
      'dl-zurich-2027': 'watchlist',
      'champ-wm-outdoor-2027': 'confirmed'
    };

    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(defaults));
    } catch (e) {
      console.warn('Could not save defaults', e);
    }

    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') {
        renderCalendarMonthGrid(window.App.state);
      }
    }
  }

  function copySeasonPlanText() {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const statuses = getUserStatuses();
    const planned = meetings.filter(m => statuses[m.id] === 'confirmed' || statuses[m.id] === 'watchlist')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (planned.length === 0) {
      alert('Du hast noch keine Meetings als sicher (🟢) oder Merkliste (⭐) markiert.');
      return;
    }

    let text = `🏆 WETTKAMPF-SAISONPLAN 2027 • LUKA HERDEN\n`;
    text += `Erstellt via Athletics Intelligence Dashboard (${new Date().toLocaleDateString('de-DE')})\n`;
    text += `Ziel: Hallen-EM Valencia (März) & WM Peking (September)\n`;
    text += `=========================================================\n\n`;

    planned.forEach((m, i) => {
      const statusIcon = statuses[m.id] === 'confirmed' ? '🟢 [FEST EINGEPLANT]' : '⭐ [MERKLISTE / OPTION]';
      text += `${i + 1}. ${m.displayDate || m.date}: ${m.name}\n`;
      text += `   ${statusIcon} • ${m.city} (${m.country}) • Kat. ${m.category} (${m.tier})\n`;
      if (m.promisingRunway) text += `   Anlage: ${m.runwayNote}\n`;
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ Saisonplan in die Zwischenablage kopiert! (${planned.length} Wettkämpfe)`);
    }).catch(() => {
      prompt('Saisonplan kopieren (Strg+C / Cmd+C):', text);
    });
  }

  function render(state) {
    initListeners();

    const container = document.getElementById('calendarScheduleContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];

    if (meetings.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono">
          <p>Lade verifizierten Meeting-Kalender 2027...</p>
        </div>
      `;
      return;
    }

    const statuses = getUserStatuses();
    updateStatusFilterCounts(meetings, statuses);
    renderSeasonPlanCockpit(meetings, statuses);

    // Filter meetings
    const filtered = meetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (!matchesSelectedTier(m)) return false;

      const status = statuses[m.id] || 'none';
      if (hideExcludedMeetings && status === 'hidden' && selectedStatusFilter !== 'HIDDEN') {
        return false;
      }
      if (selectedStatusFilter === 'CONFIRMED' && status !== 'confirmed') return false;
      if (selectedStatusFilter === 'WATCHLIST' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'MY_PLAN' && status !== 'confirmed' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'HIDDEN' && status !== 'hidden') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${m.name} ${m.venue || ''} ${m.city} ${m.country} ${m.tier} ${m.championshipType || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono space-y-2">
          <p class="text-sm font-bold text-slate-300">Keine Meetings gefunden für die ausgewählten Filterkriterien.</p>
          <p class="text-xs text-slate-500">
            ${selectedStatusFilter === 'MY_PLAN' ? 'Tipp: Markiere Meetings mit 🟢 Sicher oder ⭐ Option, um sie in deinen Saisonplan aufzunehmen.' : ''}
          </p>
          <button onclick="VenuesModule.resetFilters()" class="mt-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold font-mono transition-all">
            Filter zurücksetzen
          </button>
        </div>
      `;
      return;
    }

    // Group by Month (preserving chronological order)
    const monthGroups = {};
    filtered.forEach(m => {
      const monthKey = m.month || 'Weitere Termine 2027';
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(m);
    });

    // Render compact list / table view
    let html = '';
    for (const [month, list] of Object.entries(monthGroups)) {
      html += `
        <div class="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3 shadow-sm">
          <!-- Month Header -->
          <div class="flex items-center justify-between px-2 py-1 border-b border-slate-800/80">
            <div class="flex items-center gap-2">
              <span class="text-sm">🗓️</span>
              <h3 class="text-xs font-black uppercase tracking-wider text-white font-mono">${month}</h3>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-400 border border-slate-800">
              ${list.length} ${list.length === 1 ? 'Termin' : 'Termine'}
            </span>
          </div>

          <!-- Compact List (Row by Row) -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5 whitespace-nowrap">Datum</th>
                  <th class="py-2 px-2.5">Meeting & Ort</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Planung / Status</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Kategorie</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Standard (Kat C+)</th>
                  <th class="py-2 px-2 whitespace-nowrap">Anlage & Historie</th>
                  <th class="py-2 px-2.5 text-right whitespace-nowrap">Aktion</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${list.map(m => renderMeetingRow(m, statuses)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function renderMeetingRow(m, statuses) {
    if (!statuses) statuses = getUserStatuses();
    const status = statuses[m.id] || 'none';
    const isConfirmed = status === 'confirmed';
    const isWatchlist = status === 'watchlist';
    const isHidden = status === 'hidden';

    const isGorzow = m.name.toLowerCase().includes('gorzów') || (m.city && m.city.toLowerCase().includes('gorzów'));
    const isPromising = m.promisingRunway;
    const isExpanded = expandedMeetingId === m.id;
    const isChamp = Boolean(m.isChampionship || m.tier === 'Meisterschaft');

    // Tier badge colors
    let tierBadge = 'bg-slate-800 text-slate-300 border-slate-700';
    if (isChamp) {
      tierBadge = 'bg-purple-950 text-purple-300 border-purple-500 shadow-sm';
    } else if (m.tier && m.tier.includes('Diamond League')) {
      tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-sm';
    } else if (m.tier === 'Gold' || m.tier === 'World Athletics Series') {
      tierBadge = 'bg-amber-950 text-amber-300 border-amber-700';
    } else if (m.tier === 'Silver') {
      tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
    } else if (m.tier === 'Bronze') {
      tierBadge = 'bg-amber-900/50 text-amber-400 border-amber-800';
    } else if (m.tier === 'Challenger') {
      tierBadge = 'bg-blue-950 text-blue-300 border-blue-800';
    }

    const hasContacts = m.contactPersons && m.contactPersons.length > 0;
    const contactCount = hasContacts ? m.contactPersons.length : 0;

    // Status visual accents
    let rowStatusClass = '';
    let statusPillHtml = '';

    if (isConfirmed) {
      rowStatusClass = 'border-l-4 border-l-emerald-500 bg-emerald-950/25';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono bg-emerald-500 text-slate-950 shadow-sm flex items-center gap-1 shrink-0">🟢 SICHERER START</span>';
    } else if (isWatchlist) {
      rowStatusClass = 'border-l-4 border-l-amber-400 bg-amber-950/20';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono bg-amber-400 text-slate-950 shadow-sm flex items-center gap-1 shrink-0">⭐ MERKLISTE</span>';
    } else if (isHidden) {
      rowStatusClass = 'border-l-4 border-l-slate-700 bg-slate-950/50 opacity-40 hover:opacity-85 transition-opacity';
      statusPillHtml = '<span class="px-1.5 py-0.2 rounded text-[8px] font-mono text-slate-500 bg-slate-900 border border-slate-800 shrink-0">🚫 Ausgeblendet</span>';
    }

    let mainRow = `
      <tr onclick="VenuesModule.toggleMeetingRow('${m.id}')" class="cursor-pointer hover:bg-slate-800/40 transition-colors ${rowStatusClass} ${
        isExpanded ? 'bg-slate-800/70 border-b border-slate-800' : isChamp && !isConfirmed ? 'bg-purple-950/15' : isGorzow && !isConfirmed ? 'bg-amber-950/15' : ''
      }">
        <!-- Datum -->
        <td class="py-2 px-2.5 whitespace-nowrap font-bold text-white">
          <div class="flex items-center gap-1.5">
            <span class="text-cyan-400">${m.displayDate || m.date}</span>
            ${m.indoor ? '<span class="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-normal">Halle</span>' : ''}
          </div>
        </td>

        <!-- Meeting & Ort -->
        <td class="py-2 px-2.5">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${statusPillHtml}
              <span class="font-bold text-slate-100 font-sans text-xs">${m.name}</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">${m.country}</span>
              ${isChamp ? `<span class="px-1.5 py-0.2 rounded bg-purple-600 text-white font-black text-[9px] font-mono">🏆 ${m.championshipType || 'MEISTERSCHAFT'}</span>` : ''}
              ${m.tour && m.tour.includes('DLV') && !isChamp ? '<span class="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[9px] font-mono">🇩🇪 DLV Plan</span>' : ''}
              ${isGorzow ? '<span class="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] font-mono">LUKA 8.18m</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-sans mt-0.5">
              ${m.venue ? `${m.venue}, ` : ''}${m.city}
            </span>
          </div>
        </td>

        <!-- Planung / Status Controls (1-Click Selector) -->
        <td class="py-2 px-2 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button title="${isConfirmed ? 'Klicken zum Abwählen' : 'Als sicheren Start fest einplanen'}" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'confirmed')" class="px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
              isConfirmed ? 'bg-emerald-500 text-slate-950 font-black shadow-sm ring-1 ring-white/50 scale-105' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
            }">
              🟢 Sicher
            </button>
            <button title="${isWatchlist ? 'Klicken zum Abwählen' : 'Auf die Merkliste / als Option setzen'}" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'watchlist')" class="px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
              isWatchlist ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-1 ring-white/50 scale-105' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900'
            }">
              ⭐ Option
            </button>
            <button title="${isHidden ? 'Klicken zum Wieder-Einblenden' : 'Nicht interessant / Ausblenden'}" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'hidden')" class="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
              isHidden ? 'bg-rose-600 text-white font-black shadow-sm scale-105' : 'text-slate-500 hover:text-rose-400 hover:bg-slate-900'
            }">
              🚫 Weg
            </button>
          </div>
        </td>

        <!-- Kategorie & Tour -->
        <td class="py-2 px-2 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${tierBadge}">
            ${(m.tier || '').toUpperCase()} • Kat. ${m.category}
          </span>
        </td>

        <!-- Standard Eignung -->
        <td class="py-2 px-2 text-center whitespace-nowrap">
          ${m.standardEligible ? `
            <span class="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              Standard C+ ✅
            </span>
          ` : `
            <span class="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px]">
              Punkte (Kat. ${m.category || 'D'})
            </span>
          `}
        </td>

        <!-- Anlage & Historie -->
        <td class="py-2 px-2 whitespace-nowrap">
          ${isPromising ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/80 shadow-sm" title="${m.runwayNote}">
              <span>⭐ Anlage vielversprechend</span>
            </span>
          ` : `
            <span class="text-slate-500 text-[10px]">Solide Anlage</span>
          `}
        </td>

        <!-- Aktionen -->
        <td class="py-2 px-2.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-cyan-950 active:scale-95 border border-slate-700 hover:border-cyan-500 text-cyan-400 font-mono text-[10px] font-bold transition-all shadow-sm flex items-center gap-1">
              <span>ℹ️ Details ${contactCount > 0 ? `(${contactCount})` : ''}</span>
            </button>
            <span class="text-slate-500 text-xs">${isExpanded ? '▲' : '▼'}</span>
          </div>
        </td>
      </tr>
    `;

    if (!isExpanded) {
      return mainRow;
    }

    const accordionRow = `
      <tr class="bg-slate-950/90 border-b border-slate-800">
        <td colspan="7" class="p-3">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-md">
            <!-- 1. Header with Title & Action Shortcuts -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-base">${isPromising ? '⭐' : '🏟️'}</span>
                <div>
                  <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    ${m.name} • ANLAGEN- & WETTKAMPFDETAILS
                  </h4>
                  <span class="text-[10px] text-slate-400 font-mono">${m.displayDate || m.date} • ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country}) • ${m.tier} (Kat. ${m.category})</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="event.stopPropagation(); VenuesModule.copyManagerPitchById('${m.id}')" class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-[10px] rounded transition-all shadow-sm">
                  📋 Pitch für Manager
                </button>
                <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold font-mono text-[10px] rounded transition-all">
                  Vollansicht / Kontakte ↗
                </button>
              </div>
            </div>

            <!-- Status Control Quick-Bar in Accordion -->
            <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <span class="text-[10px] font-bold font-mono uppercase text-slate-400">Dein Status für diesen Termin:</span>
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <button onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'confirmed')" class="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  isConfirmed ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800'
                }">
                  🟢 Fest eingeplant
                </button>
                <button onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'watchlist')" class="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  isWatchlist ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-900 text-slate-400 hover:text-amber-400 border border-slate-800'
                }">
                  ⭐ Merkliste
                </button>
                <button onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'hidden')" class="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  isHidden ? 'bg-rose-600 text-white font-black' : 'bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800'
                }">
                  🚫 Ausblenden
                </button>
              </div>
            </div>

            <!-- 2. Historical Basis & Runway Justification -->
            <div class="${isPromising ? 'bg-amber-950/25 border-amber-600/60' : 'bg-slate-950 border-slate-800'} border rounded-lg p-3 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 font-bold font-mono text-xs ${isPromising ? 'text-amber-300' : 'text-slate-300'}">
                  <span>${isPromising ? '⭐ DATENBASIS: VIELVERSPRECHENDE ANLAGE' : '📊 ANLAGENBEWERTUNG'}</span>
                </div>
                ${m.standardEligible ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Standard C+ berechtigt</span>' : ''}
              </div>
              <p class="text-xs text-slate-200 font-sans leading-relaxed">
                ${m.runwayNote || 'Reguläre Wettkampfanlage mit standardisierten Bedingungen.'}
              </p>

              <!-- Historical Marks Table/Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Lukas bisherige Weiten hier:</span>
                  ${m.lukaHistory && m.lukaHistory.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-1">
                      ${m.lukaHistory.map(h => `
                        <span class="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                          ${typeof h.mark === 'number' ? h.mark.toFixed(2) : h.mark}m (${h.date || h.year}, Pl. ${h.place})
                        </span>
                      `).join('')}
                    </div>
                  ` : '<span class="text-slate-500 text-[10px] italic">Noch kein Wettkampf von Luka dokumentiert.</span>'}
                </div>

                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Top-Weiten bei diesem Meeting:</span>
                  ${m.topHistoricalMarks && m.topHistoricalMarks.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-1">
                      ${m.topHistoricalMarks.map((mk, idx) => `
                        <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold">
                          #${idx + 1}: ${typeof mk === 'number' ? mk.toFixed(2) : mk}m
                        </span>
                      `).join('')}
                    </div>
                  ` : '<span class="text-slate-500 text-[10px] italic">Keine Weiten im WA-Archiv erfasst.</span>'}
                </div>
              </div>
            </div>

            <!-- 3. Organizer Contacts Quick Box -->
            ${m.contactPersons && m.contactPersons.length > 0 ? `
              <div class="space-y-1.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase font-mono block">Veranstalter / Liaison-Kontakte:</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${m.contactPersons.map(cp => `
                    <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
                      <div class="flex items-center justify-between">
                        <strong class="text-white">${cp.name}</strong>
                        <span class="text-[9px] text-cyan-400">${cp.title || 'Organisation'}</span>
                      </div>
                      <div class="flex items-center gap-3 mt-1 text-[11px]">
                        ${cp.email ? `<a href="mailto:${cp.email}" class="text-cyan-400 hover:underline">✉️ ${cp.email}</a>` : ''}
                        ${cp.phone ? `<a href="tel:${cp.phone}" class="text-emerald-400 hover:underline">📞 ${cp.phone}</a>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;

    return mainRow + accordionRow;
  }

  function openMeetingInfoModal(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    const modal = document.getElementById('meetingInfoModal');
    if (!modal) return;

    const status = getMeetingStatus(m.id);
    const isConfirmed = status === 'confirmed';
    const isWatchlist = status === 'watchlist';
    const isHidden = status === 'hidden';

    // Header elements
    const catBadge = document.getElementById('modalMeetingCategoryBadge');
    if (catBadge) {
      catBadge.textContent = `${(m.tier || '').toUpperCase()} • KAT. ${m.category}`;
      let tierBadge = 'bg-slate-800 text-slate-300 border-slate-700';
      if (m.tier === 'Gold') tierBadge = 'bg-amber-950 text-amber-300 border-amber-700';
      else if (m.tier === 'Silver') tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
      else if (m.tier === 'Bronze') tierBadge = 'bg-amber-900/50 text-amber-400 border-amber-800';
      catBadge.className = `px-2 py-0.5 rounded text-xs font-black font-mono border ${tierBadge}`;
    }

    const titleEl = document.getElementById('modalMeetingName');
    if (titleEl) titleEl.textContent = m.name;

    const subEl = document.getElementById('modalMeetingSub');
    if (subEl) {
      subEl.textContent = `📅 ${m.displayDate || m.date} • ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country}) • ${m.tour}`;
    }

    // Modal Body Content
    const bodyEl = document.getElementById('modalMeetingBody');
    if (bodyEl) {
      // Interactive Status Selector Bar
      const statusControlHtml = `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
          <div class="flex items-center gap-2">
            <span class="text-xl">${isConfirmed ? '🟢' : isWatchlist ? '⭐' : isHidden ? '🚫' : '📌'}</span>
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-400 font-mono block">Mein Saison-Planungsstatus:</span>
              <span class="text-xs font-black font-mono ${isConfirmed ? 'text-emerald-400' : isWatchlist ? 'text-amber-400' : isHidden ? 'text-rose-400' : 'text-slate-300'}">
                ${isConfirmed ? 'FEST EINGEPLANT (SICHERER START)' : isWatchlist ? 'AUF DER MERKLISTE (INTERESSANTE OPTION)' : isHidden ? 'NICHT RELEVANT (AUSGEBLENDET)' : 'NOCH OFFEN / NICHT MARKIERT'}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'confirmed')" class="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              isConfirmed ? 'bg-emerald-500 text-slate-950 font-black shadow-md ring-1 ring-white' : 'bg-slate-900 hover:bg-emerald-950 text-slate-300 border border-slate-700 hover:border-emerald-600'
            }">
              🟢 Sicherer Start
            </button>
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'watchlist')" class="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              isWatchlist ? 'bg-amber-400 text-slate-950 font-black shadow-md ring-1 ring-white' : 'bg-slate-900 hover:bg-amber-950 text-slate-300 border border-slate-700 hover:border-amber-600'
            }">
              ⭐ Merkliste
            </button>
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'hidden')" class="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              isHidden ? 'bg-rose-600 text-white font-black shadow-md ring-1 ring-white' : 'bg-slate-900 hover:bg-rose-950 text-slate-300 border border-slate-700 hover:border-rose-600'
            }">
              🚫 Ausblenden
            </button>
            ${status !== 'none' ? `
              <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'none')" class="px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800">
                ✕ Reset
              </button>
            ` : ''}
          </div>
        </div>
      `;

      // Contacts HTML
      let contactsHtml = '';
      if (m.contactPersons && m.contactPersons.length > 0) {
        contactsHtml = m.contactPersons.map(cp => `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-white text-xs">${cp.name || 'Ansprechpartner'}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">${cp.title || 'Veranstalter'}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
              ${cp.email ? `<a href="mailto:${cp.email}" class="text-cyan-400 hover:underline flex items-center gap-1">✉️ ${cp.email}</a>` : ''}
              ${cp.phone ? `<a href="tel:${cp.phone}" class="text-emerald-400 hover:underline flex items-center gap-1">📞 ${cp.phone}</a>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        contactsHtml = '<p class="text-xs text-slate-500 italic">Keine individuellen Kontaktdaten in World Athletics hinterlegt.</p>';
      }

      // Units (Disziplinen) HTML
      const menEvents = m.disciplinesMen || ['Long Jump'];
      const womenEvents = m.disciplinesWomen || [];

      // Historical Benchmark HTML
      let historyHtml = '';
      if (m.promisingRunway) {
        historyHtml = `
          <div class="bg-amber-950/30 border border-amber-600/70 rounded-xl p-3.5 space-y-1.5 shadow-sm">
            <div class="flex items-center gap-1.5 text-amber-300 font-bold text-xs font-mono">
              <span>⭐</span>
              <span>ANLAGEN-BEWERTUNG: VIELVERSPRECHEND</span>
            </div>
            <p class="text-xs text-slate-200 font-sans leading-relaxed">
              ${m.runwayNote}
            </p>
            ${m.lukaHistory && m.lukaHistory.length > 0 ? `
              <div class="mt-2 pt-2 border-t border-amber-800/40 text-[11px] font-mono text-cyan-300">
                <strong>Lukas historische Weiten hier:</strong>
                ${m.lukaHistory.map(h => `<span class="ml-2 font-bold text-white">${h.mark.toFixed(2)}m (${h.date}, Platz ${h.place})</span>`).join(', ')}
              </div>
            ` : ''}
          </div>
        `;
      } else if (m.runwayNote) {
        historyHtml = `
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase font-mono">Anlagen-Notiz:</span>
            <p class="text-xs text-slate-300 font-sans">${m.runwayNote}</p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        ${statusControlHtml}
        ${historyHtml}

        <!-- Organizer Contacts -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span>👤</span>
            <span>VERANSTALTER & ATHLETES LIAISON KONTAKTE</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${contactsHtml}
          </div>
        </div>

        <!-- Offered Disciplines (Units) -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span>🎯</span>
            <span>ANGEBOTENE DISZIPLINEN (UNITS)</span>
          </h4>
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div>
              <span class="text-[10px] font-bold text-cyan-400 uppercase font-mono block mb-1">Männer:</span>
              <div class="flex flex-wrap gap-1.5">
                ${menEvents.map(e => `
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    e.toLowerCase().includes('long jump') || e.toLowerCase().includes('weitsprung')
                      ? 'bg-cyan-500 text-slate-950 border border-cyan-400 shadow-sm'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }">
                    ${e} ${e.toLowerCase().includes('long jump') ? '⭐ (ZIEL)' : ''}
                  </span>
                `).join('')}
              </div>
            </div>
            ${womenEvents.length > 0 ? `
              <div class="pt-2 border-t border-slate-800/80">
                <span class="text-[10px] font-bold text-purple-400 uppercase font-mono block mb-1">Frauen:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${womenEvents.map(e => `
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      ${e}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Pitch Copy Action -->
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div class="text-xs font-mono text-slate-300">
            <strong>Bewerbung beim Veranstalter:</strong>
            <span class="text-slate-400 block text-[11px]">Kopiert einen fertigen Bewerbungs-Pitch für deinen Manager inkl. aller Meeting-Details.</span>
          </div>
          <button onclick="VenuesModule.copyManagerPitchById('${m.id}')" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black font-mono text-xs rounded-lg transition-all shadow-md shrink-0">
            📋 Pitch für Manager kopieren
          </button>
        </div>
      `;
    }

    // Modal Links
    const linksEl = document.getElementById('modalMeetingLinks');
    if (linksEl) {
      const links = [];
      if (m.websiteUrl) links.push(`<a href="${m.websiteUrl}" target="_blank" class="text-cyan-400 hover:underline font-mono text-xs flex items-center gap-1">🌐 Website ↗</a>`);
      if (m.resultsPageUrl) links.push(`<a href="${m.resultsPageUrl}" target="_blank" class="text-cyan-400 hover:underline font-mono text-xs flex items-center gap-1">📊 Resultate ↗</a>`);
      if (m.liveStreamingUrl) links.push(`<a href="${m.liveStreamingUrl}" target="_blank" class="text-emerald-400 hover:underline font-mono text-xs flex items-center gap-1">📺 Livestream ↗</a>`);
      linksEl.innerHTML = links.join('<span class="text-slate-700">•</span>');
    }

    modal.classList.remove('hidden');
  }

  function copyManagerPitchById(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    let text = `Hi, für meine Saisonplanung 2027 möchte ich gerne folgendes Meeting priorisieren:\n\n`;
    text += `🏆 Meeting: ${m.name}\n`;
    text += `📅 Datum: ${m.displayDate || m.date}\n`;
    text += `📍 Ort: ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country})\n`;
    text += `📊 Kategorie: Kat. ${m.category} (${m.tier})\n`;
    if (m.promisingRunway) {
      text += `⭐ Anlage: ${m.runwayNote}\n`;
    }
    if (m.contactPersons && m.contactPersons.length > 0) {
      text += `👤 Ansprechpartner: ${m.contactPersons[0].name} (${m.contactPersons[0].email || m.contactPersons[0].phone})\n`;
    }
    if (m.websiteUrl) {
      text += `🔗 Website: ${m.websiteUrl}\n`;
    }
    text += `\nBitte frage zeitnah einen Startplatz für das Weitsprung-Feld der Männer an!`;

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ Pitch-Text für Manager in die Zwischenablage kopiert!\n\n${text}`);
    }).catch(() => {
      prompt('Pitch-Text kopieren (Strg+C / Cmd+C):', text);
    });
  }

  function resetFilters() {
    selectedTier = 'ALL';
    selectedStatusFilter = 'ALL';
    mensOnly = true;
    searchQuery = '';
    hideExcludedMeetings = true;

    const searchInput = document.getElementById('meetingSearchInput');
    if (searchInput) searchInput.value = '';

    const filterCheckbox = document.getElementById('filterMensLjOnly');
    if (filterCheckbox) filterCheckbox.checked = true;

    const hideChk = document.getElementById('hideExcludedMeetingsCheckbox');
    if (hideChk) hideChk.checked = true;

    updateStatusFilterButtonsUI();

    document.querySelectorAll('.cal-tier-btn').forEach(b => {
      if (b.getAttribute('data-tier') === 'ALL') {
        b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
      } else {
        b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800';
      }
    });

    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    const btnList = document.getElementById('calViewListBtn');
    const btnCal = document.getElementById('calViewCalendarBtn');
    const containerList = document.getElementById('calendarScheduleContainer');
    const containerCal = document.getElementById('calendarMonthGridContainer');

    if (btnList && btnCal) {
      if (mode === 'list') {
        btnList.className = 'px-3 py-1 rounded-md font-bold transition-all bg-cyan-500 text-slate-950 shadow-sm';
        btnCal.className = 'px-3 py-1 rounded-md font-bold transition-all text-slate-400 hover:text-white';
      } else {
        btnCal.className = 'px-3 py-1 rounded-md font-bold transition-all bg-cyan-500 text-slate-950 shadow-sm';
        btnList.className = 'px-3 py-1 rounded-md font-bold transition-all text-slate-400 hover:text-white';
      }
    }

    if (containerList && containerCal) {
      if (mode === 'list') {
        containerList.classList.remove('hidden');
        containerCal.classList.add('hidden');
      } else {
        containerList.classList.add('hidden');
        containerCal.classList.remove('hidden');
        const state = (window.App && window.App.state) || {};
        renderCalendarMonthGrid(state);
      }
    }
  }

  let activeCalendarMonth = 'Januar 2027';
  let showAllMonthsInGrid = false;

  function setCalendarMonth(mName) {
    activeCalendarMonth = mName;
    const state = (window.App && window.App.state) || {};
    renderCalendarMonthGrid(state);
  }

  const CALENDAR_MONTHS = [
    'Dezember 2026',
    'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
    'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027',
    'Oktober 2027', 'November 2027', 'Dezember 2027'
  ];

  const CALENDAR_MONTH_CONFIG = {
    'Dezember 2026': { year: 2026, month: 12, days: 31 },
    'Januar 2027': { year: 2027, month: 1, days: 31 },
    'Februar 2027': { year: 2027, month: 2, days: 28 },
    'März 2027': { year: 2027, month: 3, days: 31 },
    'April 2027': { year: 2027, month: 4, days: 30 },
    'Mai 2027': { year: 2027, month: 5, days: 31 },
    'Juni 2027': { year: 2027, month: 6, days: 30 },
    'Juli 2027': { year: 2027, month: 7, days: 31 },
    'August 2027': { year: 2027, month: 8, days: 31 },
    'September 2027': { year: 2027, month: 9, days: 30 },
    'Oktober 2027': { year: 2027, month: 10, days: 31 },
    'November 2027': { year: 2027, month: 11, days: 30 },
    'Dezember 2027': { year: 2027, month: 12, days: 31 }
  };

  function nextCalendarMonth() {
    const idx = CALENDAR_MONTHS.indexOf(activeCalendarMonth);
    if (idx !== -1 && idx < CALENDAR_MONTHS.length - 1) {
      setCalendarMonth(CALENDAR_MONTHS[idx + 1]);
    }
  }

  function prevCalendarMonth() {
    const idx = CALENDAR_MONTHS.indexOf(activeCalendarMonth);
    if (idx > 0) {
      setCalendarMonth(CALENDAR_MONTHS[idx - 1]);
    }
  }

  function toggleShowAllMonths() {
    showAllMonthsInGrid = !showAllMonthsInGrid;
    const state = (window.App && window.App.state) || {};
    renderCalendarMonthGrid(state);
  }

  function renderCalendarMonthGrid(state) {
    const container = document.getElementById('calendarMonthGridContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const rawMeetings = (calendar && calendar.meetings) ? calendar.meetings : [];

    const statuses = getUserStatuses();

    // Filter according to active filters
    const filtered = rawMeetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (!matchesSelectedTier(m)) return false;

      const status = statuses[m.id] || 'none';
      if (hideExcludedMeetings && status === 'hidden' && selectedStatusFilter !== 'HIDDEN') {
        return false;
      }
      if (selectedStatusFilter === 'CONFIRMED' && status !== 'confirmed') return false;
      if (selectedStatusFilter === 'WATCHLIST' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'MY_PLAN' && status !== 'confirmed' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'HIDDEN' && status !== 'hidden') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${m.name} ${m.venue || ''} ${m.city} ${m.country} ${m.tier} ${m.championshipType || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    // Sort chronologically and compute pauses / rest days between consecutive meetings across the season
    const sorted = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((m, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        const diffDays = Math.round((new Date(m.date) - new Date(prev.date)) / 86400000);
        m.gapSincePrev = diffDays;
        m.prevMeetingName = prev.city || prev.name;
      } else {
        m.gapSincePrev = null;
        m.prevMeetingName = null;
      }
      if (idx < sorted.length - 1) {
        const next = sorted[idx + 1];
        const diffDays = Math.round((new Date(next.date) - new Date(m.date)) / 86400000);
        m.gapUntilNext = diffDays;
        m.nextMeetingName = next.city || next.name;
      } else {
        m.gapUntilNext = null;
        m.nextMeetingName = null;
      }
    });

    const months = CALENDAR_MONTHS;
    const monthConfig = CALENDAR_MONTH_CONFIG;

    const meetingsByDate = {};
    sorted.forEach(m => {
      if (m.date) {
        if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
        meetingsByDate[m.date].push(m);
      }
    });

    const monthsToRender = showAllMonthsInGrid ? months : [activeCalendarMonth];

    // Build Month Selector Controls
    const monthSelectorHtml = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <span class="text-lg">🗓️</span>
            <div>
              <h3 class="text-xs font-black text-white uppercase font-mono tracking-wider">
                MEETING-MONATSKALENDER (WOCHENANSICHT MO–SO)
              </h3>
              <p class="text-[10px] text-slate-400 font-mono">
                Wochenraster mit persönlicher Farbmarkierung (🟢 Sicher / ⭐ Option) & Visualisierung der Wettkampfpausen
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="VenuesModule.prevCalendarMonth()" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono font-bold transition-all">
              ◀ Vorheriger
            </button>
            <button onclick="VenuesModule.toggleShowAllMonths()" class="px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
              showAllMonthsInGrid ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }">
              ${showAllMonthsInGrid ? '✓ Alle Monate aktiv' : 'Alle Monate anzeigen'}
            </button>
            <button onclick="VenuesModule.nextCalendarMonth()" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono font-bold transition-all">
              Nächster ▶
            </button>
          </div>
        </div>

        <!-- Month Navigation Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
          ${months.map(mName => {
            const mCount = sorted.filter(m => m.month === mName).length;
            const isActive = !showAllMonthsInGrid && activeCalendarMonth === mName;
            return `
              <button onclick="VenuesModule.setCalendarMonth('${mName}')" class="px-3 py-1 rounded-lg shrink-0 font-bold transition-all flex items-center gap-1.5 ${
                isActive ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }">
                <span>${mName.replace(' 2027', '').replace(' 2026', ' \'26')}</span>
                <span class="text-[9px] px-1 py-0.2 rounded ${isActive ? 'bg-slate-950 text-cyan-300 font-bold' : 'bg-slate-900 text-slate-500'}">
                  ${mCount}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Render Month Grids
    const gridsHtml = monthsToRender.map(mName => {
      const cfg = monthConfig[mName] || { year: 2027, month: 1, days: 31 };
      const monthMeetings = sorted.filter(m => m.month === mName);

      // Compute statistics on pause duration for this month
      const monthGaps = monthMeetings.map(m => m.gapSincePrev).filter(g => g != null);
      const avgGap = monthGaps.length > 0 ? (monthGaps.reduce((a, b) => a + b, 0) / monthGaps.length).toFixed(1) : '-';
      const minGap = monthGaps.length > 0 ? Math.min(...monthGaps) : '-';
      const maxGap = monthGaps.length > 0 ? Math.max(...monthGaps) : '-';

      // First day of month (Monday=0 ... Sunday=6)
      const firstDayDate = new Date(cfg.year, cfg.month - 1, 1);
      const firstDayWeekday = firstDayDate.getDay(); // 0 is Sunday
      const startOffset = (firstDayWeekday === 0 ? 6 : firstDayWeekday - 1);

      // Generate grid cells
      let cellsHtml = '';

      // Leading padding cells from previous month
      for (let i = 0; i < startOffset; i++) {
        cellsHtml += `
          <div class="bg-slate-950/30 border border-slate-900/60 rounded-xl p-2 min-h-[110px] opacity-25 hidden sm:block"></div>
        `;
      }

      // Actual days of the month
      for (let d = 1; d <= cfg.days; d++) {
        const dateIso = `${cfg.year}-${String(cfg.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayMeetings = meetingsByDate[dateIso] || [];
        const hasMeeting = dayMeetings.length > 0;

        // Day of week for responsive labels
        const dObj = new Date(cfg.year, cfg.month - 1, d);
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const dayName = dayNames[dObj.getDay()];

        cellsHtml += `
          <div class="rounded-xl p-2 flex flex-col justify-between transition-all min-h-[120px] sm:min-h-[145px] border ${
            hasMeeting ? 'bg-slate-900/90 border-slate-700 shadow-md ring-1 ring-cyan-500/20' : 'bg-slate-950/60 border-slate-850/80 hover:border-slate-800'
          }">
            <!-- Day Top Bar -->
            <div class="flex items-center justify-between pb-1 border-b border-slate-800/60 text-xs font-mono">
              <div class="flex items-center gap-1">
                <span class="font-black ${hasMeeting ? 'text-white' : 'text-slate-400'}">${d}.</span>
                <span class="text-[10px] text-slate-500 font-sans">${dayName}</span>
              </div>
              ${hasMeeting ? `
                <span class="px-1.5 py-0.2 rounded text-[9px] font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  ${dayMeetings.length} WK
                </span>
              ` : `
                <span class="text-[9px] text-slate-600 font-mono hidden sm:inline">Pause</span>
              `}
            </div>

            <!-- Meetings Content or Rest Day Indicator -->
            <div class="space-y-1.5 my-1 flex-1 flex flex-col justify-center">
              ${hasMeeting ? dayMeetings.map(m => {
                const mStatus = statuses[m.id] || 'none';
                const isConfirmed = mStatus === 'confirmed';
                const isWatchlist = mStatus === 'watchlist';
                const isHidden = mStatus === 'hidden';

                const isDiamond = Boolean(m.tier && m.tier.includes('Diamond League'));
                const isChampionship = Boolean(m.tier === 'Major' || m.tier === 'World Athletics Series' || m.category === 'OW' || m.category === 'GL' || m.name.includes('DM') || m.name.includes('EM') || m.name.includes('WM') || m.name.includes('CISM'));
                const isGold = m.tier === 'Gold';
                const isSilver = m.tier === 'Silver';
                const isBronze = m.tier === 'Bronze';

                // Color-coded Category Badge
                let badgeStyle = 'bg-slate-850 border-slate-700 text-slate-300';
                let catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-slate-900 border border-slate-700 text-slate-300">Kat. ${m.category}</span>`;

                if (isDiamond) {
                  badgeStyle = 'bg-cyan-950/90 border-cyan-500/90 text-cyan-200 shadow-sm shadow-cyan-950/50 hover:border-cyan-400';
                  catBadge = `<span class="px-1.5 py-0.2 rounded text-[8px] font-black bg-cyan-900 border border-cyan-400 text-cyan-200">💎 DL • ${m.category}</span>`;
                } else if (isChampionship) {
                  badgeStyle = 'bg-purple-950/90 border-purple-500/90 text-purple-200 shadow-sm shadow-purple-950/50 hover:border-purple-400';
                  catBadge = `<span class="px-1.5 py-0.2 rounded text-[8px] font-black bg-purple-900 border border-purple-400 text-purple-200">🏆 ${m.category}</span>`;
                } else if (isGold) {
                  badgeStyle = 'bg-amber-950/90 border-amber-500/90 text-amber-200 hover:border-amber-400';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-amber-900 border border-amber-500 text-amber-200">🥇 Gold • ${m.category}</span>`;
                } else if (isSilver) {
                  badgeStyle = 'bg-slate-900 border-cyan-700 text-cyan-300 hover:border-cyan-500';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-cyan-950 border border-cyan-800 text-cyan-300">🥈 Silver • ${m.category}</span>`;
                } else if (isBronze) {
                  badgeStyle = 'bg-emerald-950/90 border-emerald-600 text-emerald-200 hover:border-emerald-400';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-emerald-900 border border-emerald-600 text-emerald-200">🥉 Bronze • ${m.category}</span>`;
                } else {
                  badgeStyle = 'bg-blue-950/90 border-blue-700 text-blue-200 hover:border-blue-500';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-blue-900 border border-blue-700 text-blue-200">🔹 Chall. • ${m.category}</span>`;
                }

                // Status ring overrides
                if (isConfirmed) {
                  badgeStyle = 'bg-emerald-950 border-emerald-400 text-emerald-100 ring-2 ring-emerald-400 shadow-md shadow-emerald-950/80';
                } else if (isWatchlist) {
                  badgeStyle = 'bg-amber-950 border-amber-400 text-amber-100 ring-2 ring-amber-400 shadow-md shadow-amber-950/80';
                } else if (isHidden) {
                  badgeStyle = 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-30 grayscale hover:opacity-80';
                }

                return `
                  <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="cursor-pointer border rounded-lg p-2 font-mono text-[11px] transition-all hover:scale-[1.02] space-y-1 ${badgeStyle}">
                    <div class="flex items-center justify-between gap-1">
                      <span class="font-bold text-white text-[10px] sm:text-[11px] leading-tight line-clamp-2" title="${m.name}">
                        ${m.shortName || m.name}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-[9px] text-slate-300">
                      <span class="font-mono">📍 ${m.city}</span>
                      ${catBadge}
                    </div>

                    ${m.promisingRunway ? `
                      <div class="text-[8px] font-bold text-amber-300 flex items-center gap-1">
                        <span>⭐</span>
                        <span>Schnelle Bahn</span>
                      </div>
                    ` : ''}

                    <!-- 1-Click Quick Status Pills on Card -->
                    <div class="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80 mt-1" onclick="event.stopPropagation()">
                      <span class="text-[8px] font-bold uppercase truncate ${
                        isConfirmed ? 'text-emerald-300' : isWatchlist ? 'text-amber-300' : isHidden ? 'text-rose-400' : 'text-slate-500'
                      }">
                        ${isConfirmed ? '🟢 Sicher' : isWatchlist ? '⭐ Gemerkt' : isHidden ? '🚫 Weg' : 'Planung:'}
                      </span>
                      <div class="flex items-center gap-0.5">
                        <button title="Sicherer Start" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'confirmed')" class="px-1.5 py-0.2 rounded text-[8px] font-bold font-mono transition-all ${
                          isConfirmed ? 'bg-emerald-500 text-slate-950 font-black scale-105' : 'bg-slate-950 text-slate-400 hover:text-emerald-300 border border-slate-800'
                        }">🟢</button>
                        <button title="Merkliste / Option" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'watchlist')" class="px-1.5 py-0.2 rounded text-[8px] font-bold font-mono transition-all ${
                          isWatchlist ? 'bg-amber-400 text-slate-950 font-black scale-105' : 'bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800'
                        }">⭐</button>
                        <button title="Ausblenden" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'hidden')" class="px-1.5 py-0.2 rounded text-[8px] font-bold font-mono transition-all ${
                          isHidden ? 'bg-rose-600 text-white font-black scale-105' : 'bg-slate-950 text-slate-500 hover:text-rose-300 border border-slate-800'
                        }">🚫</button>
                      </div>
                    </div>

                    <!-- Pause Tracker Badge -->
                    ${m.gapSincePrev != null ? `
                      <div class="text-[8px] px-1 py-0.2 rounded bg-slate-950/80 border border-slate-700/60 text-slate-300 font-mono flex items-center justify-between" title="${m.gapSincePrev} Tage Pause seit ${m.prevMeetingName}">
                        <span>⚡ ${m.gapSincePrev}d Pause</span>
                        <span class="text-slate-500 truncate ml-1">seit ${m.prevMeetingName}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('') : `
                <div class="py-4 text-center text-slate-700 font-mono text-[10px] select-none">
                  —
                </div>
              `}
            </div>

            <!-- Footer: Next Gap Indicator -->
            ${hasMeeting && dayMeetings[0]?.gapUntilNext != null ? `
              <div class="pt-0.5 border-t border-slate-800/50 text-[8px] font-mono text-slate-400 text-right">
                ⏳ Noch ${dayMeetings[0].gapUntilNext}d bis nächstes Event
              </div>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-3">
          <!-- Month Header & Pause Barometer -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-base font-black font-mono uppercase text-white tracking-wider">${mName}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  ${monthMeetings.length} ${monthMeetings.length === 1 ? 'Wettkampf' : 'Wettkämpfe'}
                </span>
              </div>
              <p class="text-[10px] font-mono text-slate-400 mt-0.5">
                Vollständige Wochenansicht Montag bis Sonntag • Kalenderwochen des Monats
              </p>
            </div>

            <!-- Rest Period & Rhythm Barometer -->
            <div class="flex items-center gap-2 flex-wrap font-mono text-[10px]">
              <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                <span class="text-slate-400">Ø Pause:</span>
                <span class="font-bold text-cyan-300">${avgGap} ${avgGap !== '-' ? 'Tage' : ''}</span>
              </div>
              ${minGap !== '-' ? `
                <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                  <span class="text-slate-400">Min / Max Pause:</span>
                  <span class="font-bold text-amber-300">${minGap} / ${maxGap} Tage</span>
                </div>
              ` : ''}
              <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                <span class="text-slate-400">DL & Majors:</span>
                <span class="font-bold text-purple-300">
                  ${monthMeetings.filter(m => (m.tier && m.tier.includes('Diamond League')) || m.tier === 'Major' || m.tier === 'World Athletics Series' || m.category === 'OW' || m.category === 'GL').length}
                </span>
              </div>
            </div>
          </div>

          <!-- Weekday Headers (Mo, Di, Mi, Do, Fr, Sa, So) -->
          <div class="grid grid-cols-2 sm:grid-cols-7 gap-1.5 text-center font-mono font-bold text-xs text-slate-400 pb-1.5 border-b border-slate-800">
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Montag (Mo)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Dienstag (Di)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Mittwoch (Mi)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Donnerstag (Do)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Freitag (Fr)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-cyan-300">Samstag (Sa)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-cyan-300">Sonntag (So)</div>
          </div>

          <!-- Month Grid Cells -->
          <div class="grid grid-cols-1 sm:grid-cols-7 gap-1.5">
            ${cellsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-4">
        ${monthSelectorHtml}
        ${gridsHtml}
      </div>
    `;
  }

  return {
    render,
    openMeetingInfoModal,
    copyManagerPitchById,
    resetFilters,
    toggleMeetingRow,
    setViewMode,
    renderCalendarMonthGrid,
    setCalendarMonth,
    nextCalendarMonth,
    prevCalendarMonth,
    toggleShowAllMonths,
    // Personal Season Planner Exports
    getUserStatuses,
    getMeetingStatus,
    setMeetingStatus,
    toggleMeetingStatus,
    setMeetingStatusAndRefreshModal,
    setStatusFilter,
    toggleHideExcluded,
    handleSearchInput,
    copySeasonPlanText,
    loadDefaultLukaSchedule
  };
})();

window.VenuesModule = VenuesModule;
