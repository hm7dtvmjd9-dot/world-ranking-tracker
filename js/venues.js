/**
 * Universal Meeting-, Ergebnis- & Wettkampfkalender (2023–2027)
 * Kombiniert den verifizierten Planungskalender 2027 (86 Tour/Meisterschafts/DLV-Meetings)
 * mit dem bereinigten Ergebnis-Archiv 2023–2026 (1.020 relevante Top-100-Wettkämpfe >= 7,70m).
 *
 * Exakte Farb-Kodierung nach Lukas Vorgabe:
 * - Kategorien:
 *   Kat. A = Gold (#eab308) | Kat. B = Silber (#cbd5e1) | Kat. C = Bronze (#d97706)
 *   Kat. D = Holz/Braun (#a16207) | Kat. E & F = Grau (#64748b)
 *   Diamond League = Türkis (#06b6d4) | EM = Blau (#3b82f6) | WM = Rot (#ef4444) | Olympia = Weiß (#ffffff)
 * - Saisonplanung (unabhängig von der Kategorie):
 *   Sicher = Grün (#10b981) | Option = Gelb (#eab308) | Weg = Rot (#ef4444) | Ziel & Rahmen (EM/WM/DM) = Weiß (#ffffff)
 */
const VenuesModule = (() => {
  const STATUS_STORAGE_KEY = 'athletics_intel_user_meeting_statuses';

  let selectedTier = 'ALL';
  let selectedStatusFilter = 'ALL'; // 'ALL' | 'MY_PLAN' | 'CONFIRMED' | 'WATCHLIST' | 'GOAL' | 'HIDDEN'
  let hideExcludedMeetings = true;
  let currentViewMode = 'list'; // 'list' (2027 Plan + Historie) | 'calendar' (Monatsraster) | 'results' (1.020 relevante Ergebnisse 2023-2026)
  let mensOnly = true;
  let initializedListeners = false;
  let searchQuery = '';
  let expandedMeetingId = null;

  // Historical Results View filters (inside Universal Calendar)
  let histCategoryFilter = 'ALL';
  let histYearFilter = 'ALL';
  let histSortBy = 'date_desc';
  let histLimit = 45;
  let expandedHistCompName = null;

  // --- Universal Category Color Helper ---
  function getCategoryColorSpec(cat, tier, name) {
    const c = String(cat || '').toUpperCase().trim();
    const t = String(tier || '').toLowerCase();
    const n = String(name || '').toLowerCase();

    // 1. Olympia = Weiß
    if (n.includes('olympic') || n.includes('olympia') || n.includes('jeux olympiques')) {
      return {
        label: `⚪ OLYMPIA (${c || 'OW'})`,
        shortLabel: `⚪ OLY`,
        style: 'background:#ffffff;color:#0f172a;border:1px solid #ffffff;font-weight:900;box-shadow:0 0 8px rgba(255,255,255,0.35)'
      };
    }
    // 2. WM = Rot
    if (c === 'OW' || n.includes('world athletics championships') || n.includes('world athletics indoor championships') || n.includes('wm peking') || n.includes('wm ')) {
      return {
        label: `🔴 WM (${c || 'OW'})`,
        shortLabel: `🔴 WM`,
        style: 'background:rgba(239,68,68,0.22);color:#fca5a5;border:1px solid #ef4444;font-weight:900'
      };
    }
    // 3. EM = Blau
    if (c === 'GL' || n.includes('european athletics') || n.includes('hallen-em') || n.includes('team-em') || n.includes('em rom') || n.includes('em apeldoorn') || n.includes('em valencia')) {
      return {
        label: `🔵 EM (${c || 'GL'})`,
        shortLabel: `🔵 EM`,
        style: 'background:rgba(59,130,246,0.24);color:#93c5fd;border:1px solid #3b82f6;font-weight:900'
      };
    }
    // 4. Diamond League = Türkis
    if (c === 'GW' || c === 'DF' || t.includes('diamond league') || n.includes('diamond league') || n.includes('weltklasse') || n.includes('golden gala') || n.includes('herculis') || n.includes('athletissima') || n.includes('bauhaus-galan') || n.includes('memorial van damme') || n.includes('prefontaine') || n.includes('bislett') || n.includes('kamila skolimowska')) {
      return {
        label: `💎 DL (${c || 'GW'})`,
        shortLabel: `💎 DL`,
        style: 'background:rgba(6,182,212,0.22);color:#67e8f9;border:1px solid #06b6d4;font-weight:900'
      };
    }
    // 5. Kat. A = Gold
    if (c === 'A' || t === 'gold') {
      return {
        label: `🥇 KAT. A (GOLD)`,
        shortLabel: `🥇 Kat. A`,
        style: 'background:rgba(234,179,8,0.22);color:#fde047;border:1px solid #eab308;font-weight:800'
      };
    }
    // 6. Kat. B = Silber
    if (c === 'B' || t === 'silver') {
      return {
        label: `🥈 KAT. B (SILBER)`,
        shortLabel: `🥈 Kat. B`,
        style: 'background:rgba(203,213,225,0.20);color:#e2e8f0;border:1px solid #cbd5e1;font-weight:800'
      };
    }
    // 7. Kat. C = Bronze
    if (c === 'C' || t === 'bronze') {
      return {
        label: `🥉 KAT. C (BRONZE)`,
        shortLabel: `🥉 Kat. C`,
        style: 'background:rgba(217,119,6,0.24);color:#fdba74;border:1px solid #d97706;font-weight:800'
      };
    }
    // 8. Kat. D = Holz/Braun
    if (c === 'D' || t === 'challenger') {
      return {
        label: `🪵 KAT. D (HOLZ)`,
        shortLabel: `🪵 Kat. D`,
        style: 'background:rgba(133,77,14,0.36);color:#fbbf24;border:1px solid #a16207;font-weight:800'
      };
    }
    // 9. Kat. E & F = Grau
    return {
      label: `⬜ KAT. ${c || 'E/F'}`,
      shortLabel: `Kat. ${c || 'E/F'}`,
      style: 'background:rgba(100,116,139,0.22);color:#94a3b8;border:1px solid #64748b;font-weight:700'
    };
  }

  function getCategoryBadgeHtml(cat, tier, name, compact = false) {
    const spec = getCategoryColorSpec(cat, tier, name);
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1" style="${spec.style}">${compact ? spec.shortLabel : spec.label}</span>`;
  }

  // --- Season Planning Status Helpers (Sicher=Grün, Option=Gelb, Weg=Rot, Ziel/Rahmen=Weiß) ---
  function isDefaultGoalChampionship(m) {
    if (!m) return false;
    const n = (m.name || '').toLowerCase();
    return Boolean(
      m.isChampionship ||
      m.tier === 'Meisterschaft' ||
      m.category === 'OW' ||
      m.category === 'GL' ||
      n.includes('deutsche') ||
      n.includes('dm ') ||
      n.includes('hallen-em') ||
      n.includes('wm peking') ||
      n.includes('team-em') ||
      n.includes('cism')
    );
  }

  function getUserStatuses() {
    try {
      const data = localStorage.getItem(STATUS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function getEffectiveStatus(m, statuses) {
    if (!statuses) statuses = getUserStatuses();
    if (!m) return 'none';
    const saved = statuses[m.id];
    if (saved) return saved;
    if (isDefaultGoalChampionship(m)) return 'goal';
    return 'none';
  }

  function getMeetingStatus(id) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(x => x.id === id);
    return getEffectiveStatus(m, getUserStatuses());
  }

  function setMeetingStatus(meetingId, status) {
    const statuses = getUserStatuses();
    if (!status || status === 'none') {
      statuses[meetingId] = 'none';
    } else {
      statuses[meetingId] = status;
    }
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(statuses));
    } catch (e) {}

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
        if (window.App && window.App.state) render(window.App.state);
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
          if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
        }
      });
    });

    initializedListeners = true;
  }

  function matchesSelectedTier(m) {
    if (selectedTier === 'ALL') return true;
    if (selectedTier === 'Meisterschaft') {
      return isDefaultGoalChampionship(m);
    }
    if (selectedTier === 'Diamond League') {
      return Boolean((m.tier && m.tier.includes('Diamond League')) || m.category === 'GW' || m.category === 'DF');
    }
    if (selectedTier === 'Gold') return m.category === 'A' || m.tier === 'Gold';
    if (selectedTier === 'Silver') return m.category === 'B' || m.tier === 'Silver';
    if (selectedTier === 'Bronze') return m.category === 'C' || m.tier === 'Bronze';
    if (selectedTier === 'Challenger') return m.category === 'D' || m.tier === 'Challenger';
    return (m.tier || '').toLowerCase() === selectedTier.toLowerCase();
  }

  function setStatusFilter(filterKey) {
    selectedStatusFilter = filterKey;
    updateStatusFilterButtonsUI();
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
    }
  }

  function toggleHideExcluded() {
    const chk = document.getElementById('hideExcludedMeetingsCheckbox');
    hideExcludedMeetings = chk ? chk.checked : !hideExcludedMeetings;
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
    }
  }

  function handleSearchInput(query) {
    searchQuery = (query || '').trim();
    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
    }
  }

  function updateStatusFilterButtonsUI() {
    const buttons = document.querySelectorAll('.cal-status-btn');
    buttons.forEach(btn => {
      const f = btn.getAttribute('data-status-filter');
      if (f === selectedStatusFilter) {
        if (f === 'CONFIRMED' || f === 'MY_PLAN') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 font-black shadow-sm flex items-center gap-1';
        } else if (f === 'WATCHLIST') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-yellow-400 text-slate-950 font-black shadow-sm flex items-center gap-1';
        } else if (f === 'GOAL') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-white text-slate-950 font-black shadow-sm flex items-center gap-1';
        } else if (f === 'HIDDEN') {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-red-600 text-white font-black shadow-sm flex items-center gap-1';
        } else {
          btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-slate-950 font-black shadow-sm flex items-center gap-1';
        }
      } else {
        btn.className = 'cal-status-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800 flex items-center gap-1';
      }
    });
  }

  function updateStatusFilterCounts(meetings, statuses) {
    let confirmedCount = 0, watchlistCount = 0, goalCount = 0, hiddenCount = 0;
    meetings.forEach(m => {
      const st = getEffectiveStatus(m, statuses);
      if (st === 'confirmed') confirmedCount++;
      else if (st === 'watchlist') watchlistCount++;
      else if (st === 'goal') goalCount++;
      else if (st === 'hidden') hiddenCount++;
    });
    const myPlanCount = confirmedCount + watchlistCount + goalCount;

    const elAll = document.getElementById('statusCountAll');
    if (elAll) elAll.textContent = meetings.length;
    const elPlan = document.getElementById('statusCountMyPlan');
    if (elPlan) elPlan.textContent = myPlanCount;
    const elConf = document.getElementById('statusCountConfirmed');
    if (elConf) elConf.textContent = confirmedCount;
    const elWatch = document.getElementById('statusCountWatchlist');
    if (elWatch) elWatch.textContent = watchlistCount;
    const elGoal = document.getElementById('statusCountGoal');
    if (elGoal) elGoal.textContent = goalCount;
    const elHid = document.getElementById('statusCountHidden');
    if (elHid) elHid.textContent = hiddenCount;
  }

  // --- Weekly Competition & Scraper Briefing ---
  function renderWeeklyBriefingBanner(state) {
    const el = document.getElementById('calendarChangelogNotice');
    if (!el) return;
    const wb = state.weeklyBriefing || {};
    const recent = wb.recent_highlights || [];
    const upcoming = wb.upcoming_highlights || [];

    const recentHtml = recent.slice(0, 5).map(r => `
      <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px]">
        <div class="truncate">
          ${getCategoryBadgeHtml(r.category, '', r.name, true)}
          <strong class="text-white ml-1">${r.name}</strong>
          <span class="text-slate-400">(${r.date})</span>
        </div>
        <div class="shrink-0 font-mono text-right">
          <span class="text-emerald-400 font-bold">${r.winner} • ${Number(r.best_mark).toFixed(2)}m</span>
          ${r.luka_mark ? `<span class="ml-1 px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px]">Luka: ${r.luka_mark}m</span>` : ''}
        </div>
      </div>
    `).join('');

    const upcomingHtml = upcoming.slice(0, 5).map(u => `
      <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px]">
        <div class="truncate">
          ${getCategoryBadgeHtml(u.category, u.tier, u.name, true)}
          <strong class="text-white ml-1">${u.name}</strong>
        </div>
        <span class="text-cyan-400 font-mono font-bold shrink-0">${u.date} (${u.city})</span>
      </div>
    `).join('');

    el.innerHTML = `
      <details class="w-full" open>
        <summary class="cursor-pointer list-none flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base">🗞️</span>
            <span class="font-black text-emerald-400 uppercase tracking-wider text-xs font-mono">
              WÖCHENTLICHES SCRAPER- & RANKING-BRIEFING (STAND: 08.11.2026 • KW 45/46)
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
              Luka: #70 Welt (1.144 Pkt) • #23 Europa • #2 GER
            </span>
          </div>
          <span class="text-[10px] text-slate-400 font-mono">Ein-/Ausklappen ▾</span>
        </summary>
        <div class="mt-3 pt-3 border-t border-slate-800 space-y-3 font-mono text-xs">
          <p class="text-[11px] text-slate-300 font-sans leading-relaxed">
            ${wb.summary_text || 'Alle inoffiziellen Kleinstwettkämpfe (< 7,70 m oder ohne Top-100-Beteiligung) wurden entfernt. Der Universal-Kalender bündelt jetzt deine 86 Planungs-Meetings 2027 und alle 1.020 relevanten Top-100-Wettkämpfe (2023–2026).'}
          </p>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <span class="text-[10px] font-bold text-amber-400 uppercase block">🏆 Letzte Top-100-Ergebnisse (≥ 7,70 m):</span>
              ${recentHtml || '<span class="text-slate-500 text-[11px]">Off-Season / Hallenvorbereitung läuft.</span>'}
            </div>
            <div class="space-y-1.5">
              <span class="text-[10px] font-bold text-cyan-400 uppercase block">📅 Nächste Schlüssel-Termine (Saison 2026/27):</span>
              ${upcomingHtml}
            </div>
          </div>
          <!-- Farb-Legende -->
          <div class="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-slate-400 font-bold uppercase">Kategorie-Farben:</span>
              <span class="px-1.5 py-0.5 rounded font-black" style="background:#ffffff;color:#0f172a">Olympia=Weiß</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(239,68,68,0.22);color:#fca5a5;border:1px solid #ef4444">WM=Rot</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(59,130,246,0.24);color:#93c5fd;border:1px solid #3b82f6">EM=Blau</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(6,182,212,0.22);color:#67e8f9;border:1px solid #06b6d4">DL=Türkis</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(234,179,8,0.22);color:#fde047;border:1px solid #eab308">A=Gold</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(203,213,225,0.2);color:#e2e8f0;border:1px solid #cbd5e1">B=Silber</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(217,119,6,0.24);color:#fdba74;border:1px solid #d97706">C=Bronze</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(133,77,14,0.36);color:#fbbf24;border:1px solid #a16207">D=Holz/Braun</span>
              <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(100,116,139,0.22);color:#94a3b8;border:1px solid #64748b">E/F=Grau</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-slate-400 font-bold uppercase">Planungs-Farben:</span>
              <span class="px-1.5 py-0.5 rounded font-black" style="background:#10b981;color:#0f172a">🟢 Sicher=Grün</span>
              <span class="px-1.5 py-0.5 rounded font-black" style="background:#eab308;color:#0f172a">🟡 Option=Gelb</span>
              <span class="px-1.5 py-0.5 rounded font-black" style="background:#ef4444;color:#ffffff">🔴 Weg=Rot</span>
              <span class="px-1.5 py-0.5 rounded font-black" style="background:#ffffff;color:#0f172a">⚪ Ziel/Rahmen (EM/WM/DM)=Weiß</span>
            </div>
          </div>
        </div>
      </details>
    `;
  }

  function renderSeasonPlanCockpit(meetings, statuses) {
    const container = document.getElementById('mySeasonPlanSummaryContainer');
    if (!container) return;

    const confirmedMeets = meetings.filter(m => getEffectiveStatus(m, statuses) === 'confirmed')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const watchlistMeets = meetings.filter(m => getEffectiveStatus(m, statuses) === 'watchlist')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const goalMeets = meetings.filter(m => getEffectiveStatus(m, statuses) === 'goal')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const allPlanMeets = [...confirmedMeets, ...watchlistMeets, ...goalMeets]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (confirmedMeets.length === 0 && watchlistMeets.length === 0) {
      container.innerHTML = `
        <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">💡</span>
            <div>
              <strong class="text-emerald-300 uppercase tracking-wide">Saisonplanung 2027 (${goalMeets.length} Ziel-/Rahmen-Meisterschaften in ⚪ Weiß vorselektiert):</strong>
              <p class="text-slate-300 text-[11px] font-sans mt-0.5">
                Markiere deine Meetings mit <span class="text-emerald-400 font-bold font-mono">🟢 Sicher (Grün)</span>, <span class="text-yellow-400 font-bold font-mono">🟡 Option (Gelb)</span>, <span class="text-red-400 font-bold font-mono">🔴 Weg (Rot)</span> oder <span class="text-white font-bold font-mono">⚪ Ziel/Rahmen (Weiß)</span>.
              </p>
            </div>
          </div>
          <button onclick="VenuesModule.loadDefaultLukaSchedule()" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs font-mono transition-all shadow-sm shrink-0">
            ⚡ Lukas Kern-Saisonplan 2027 laden
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <details class="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/50 rounded-xl p-3.5 shadow-lg font-mono">
        <summary class="cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-lg">🏆</span>
            <span class="text-xs sm:text-sm font-black text-white uppercase tracking-wider">DEIN SAISON-FAHRPLAN 2027</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-slate-950">🟢 ${confirmedMeets.length} SICHER</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-yellow-400 text-slate-950">🟡 ${watchlistMeets.length} OPTION</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-white text-slate-950">⚪ ${goalMeets.length} ZIEL/RAHMEN</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation(); VenuesModule.copySeasonPlanText()" class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-[10px] rounded-lg">
              📋 Plan kopieren
            </button>
            <span class="text-[10px] text-slate-400">Timeline ausklappen ▾</span>
          </div>
        </summary>
        <div class="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
          ${allPlanMeets.map(m => {
            const st = getEffectiveStatus(m, statuses);
            let cardStyle = 'border:#10b981;background:rgba(16,185,129,0.16);color:#d1fae5';
            let stLabel = '🟢 SICHER';
            if (st === 'watchlist') {
              cardStyle = 'border:#eab308;background:rgba(234,179,8,0.16);color:#fef08a';
              stLabel = '🟡 OPTION';
            } else if (st === 'goal') {
              cardStyle = 'border:#ffffff;background:rgba(255,255,255,0.14);color:#ffffff';
              stLabel = '⚪ ZIEL/RAHMEN';
            }
            return `
              <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="shrink-0 cursor-pointer p-2 rounded-lg border transition-all hover:scale-[1.02]" style="${cardStyle}">
                <div class="flex items-center justify-between gap-2 text-[9px] font-black mb-0.5">
                  <span>${stLabel}</span>
                  <span class="opacity-80">${m.displayDate || m.date}</span>
                </div>
                <div class="text-[11px] font-bold text-white truncate max-w-[160px]" title="${m.name}">
                  ${m.shortName || m.name}
                </div>
                <div class="flex items-center justify-between gap-1 text-[9px] mt-1">
                  <span>📍 ${m.city}</span>
                  ${getCategoryBadgeHtml(m.category, m.tier, m.name, true)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  function loadDefaultLukaSchedule() {
    const defaults = {
      'wa-7244484': 'watchlist',           // Chemnitz Indoor
      'wa-7244518': 'confirmed',           // Gorzów Jump Festival (8.18m PB!)
      'wa-7238588': 'watchlist',           // Ostrava Czech Indoor Gala
      'wa-7240482': 'watchlist',           // Madrid Indoor
      'wa-7244475': 'watchlist',           // Paris Indoor
      'champ-dm-halle-2027': 'goal',       // DM Halle Dortmund (Weiß: Ziel/Rahmen)
      'champ-em-indoor-2027': 'goal',      // Hallen-EM Valencia (Weiß: Ziel/Rahmen)
      'dlv-weinheim-kurpfalz-2027': 'confirmed',
      'dl-rabat-2027': 'watchlist',
      'dlv-dessau-anhalt-2027': 'watchlist',
      'dlv-dresden-goldenes-oval-2027': 'watchlist',
      'champ-cism-2027': 'goal',           // CISM Militär-WM (Weiß: Ziel/Rahmen)
      'champ-team-em-2027': 'goal',        // Team-EM (Weiß: Ziel/Rahmen)
      'dlv-essen-springer-2027': 'watchlist',
      'champ-dm-outdoor-2027': 'goal',     // DM Freiluft (Weiß: Ziel/Rahmen)
      'dl-lausanne-2027': 'watchlist',
      'dl-london-2027': 'watchlist',
      'dlv-inneringen-schlossberg-2027': 'confirmed',
      'dl-silesia-2027': 'watchlist',
      'dl-zurich-2027': 'watchlist',
      'champ-wm-outdoor-2027': 'goal'      // WM Peking (Weiß: Ziel/Rahmen)
    };

    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(defaults));
    } catch (e) {}

    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
    }
  }

  function copySeasonPlanText() {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const statuses = getUserStatuses();
    const planned = meetings.filter(m => {
      const st = getEffectiveStatus(m, statuses);
      return st === 'confirmed' || st === 'watchlist' || st === 'goal';
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (planned.length === 0) {
      alert('Noch keine Meetings markiert.');
      return;
    }

    let text = `🏆 WETTKAMPF-SAISONPLAN 2027 • LUKA HERDEN\n`;
    text += `=========================================================\n\n`;

    planned.forEach((m, i) => {
      const st = getEffectiveStatus(m, statuses);
      const statusIcon = st === 'confirmed' ? '🟢 [SICHER]' : (st === 'goal' ? '⚪ [ZIEL / RAHMEN]' : '🟡 [OPTION]');
      text += `${i + 1}. ${m.displayDate || m.date}: ${m.name}\n`;
      text += `   ${statusIcon} • ${m.city} (${m.country}) • Kat. ${m.category} (${m.tier})\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ Saisonplan kopiert! (${planned.length} Termine)`);
    });
  }

  function render(state) {
    initListeners();
    renderWeeklyBriefingBanner(state);

    const container = document.getElementById('calendarScheduleContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const statuses = getUserStatuses();

    updateStatusFilterCounts(meetings, statuses);
    renderSeasonPlanCockpit(meetings, statuses);

    if (currentViewMode === 'results') {
      renderHistoricalResultsUniversalView(state, container);
      return;
    }

    if (meetings.length === 0) {
      container.innerHTML = `<div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono">Lade Universal-Kalender...</div>`;
      return;
    }

    const filtered = meetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (!matchesSelectedTier(m)) return false;

      const status = getEffectiveStatus(m, statuses);
      if (hideExcludedMeetings && status === 'hidden' && selectedStatusFilter !== 'HIDDEN') {
        return false;
      }
      if (selectedStatusFilter === 'CONFIRMED' && status !== 'confirmed') return false;
      if (selectedStatusFilter === 'WATCHLIST' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'GOAL' && status !== 'goal') return false;
      if (selectedStatusFilter === 'MY_PLAN' && status !== 'confirmed' && status !== 'watchlist' && status !== 'goal') return false;
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
          <p class="text-sm font-bold text-slate-300">Keine Meetings für diesen Filter gefunden.</p>
          <button onclick="VenuesModule.resetFilters()" class="mt-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold font-mono">Filter zurücksetzen</button>
        </div>
      `;
      return;
    }

    const monthGroups = {};
    filtered.forEach(m => {
      const monthKey = m.month || 'Weitere Termine 2027';
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(m);
    });

    let html = '';
    for (const [month, list] of Object.entries(monthGroups)) {
      html += `
        <div class="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3 shadow-sm">
          <div class="flex items-center justify-between px-2 py-1 border-b border-slate-800/80">
            <div class="flex items-center gap-2">
              <span class="text-sm">🗓️</span>
              <h3 class="text-xs font-black uppercase tracking-wider text-white font-mono">${month}</h3>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-400 border border-slate-800">
              ${list.length} ${list.length === 1 ? 'Termin' : 'Termine'}
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5 whitespace-nowrap">Datum</th>
                  <th class="py-2 px-2.5">Meeting & Ort</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Planung (Sicher / Option / Weg / Ziel)</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Kategorie</th>
                  <th class="py-2 px-2 whitespace-nowrap">Historie (2023–2026) & Anlage</th>
                  <th class="py-2 px-2.5 text-right whitespace-nowrap">Details</th>
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
    const status = getEffectiveStatus(m, statuses);
    const isConfirmed = status === 'confirmed';
    const isWatchlist = status === 'watchlist';
    const isGoal = status === 'goal';
    const isHidden = status === 'hidden';

    const isExpanded = expandedMeetingId === m.id;
    const histEds = m.historicalEditions || [];
    const bestHistMark = histEds.length > 0 ? Math.max(...histEds.map(h => Number(h.best_mark || 0))) : 0;

    // Exact Season Planning Status Visuals (Sicher=Grün, Option=Gelb, Weg=Rot, Ziel/Rahmen=Weiß)
    let rowStatusStyle = '';
    let statusPillHtml = '';

    if (isConfirmed) {
      rowStatusStyle = 'border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.12);';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono shrink-0" style="background:#10b981;color:#0f172a">🟢 SICHER</span>';
    } else if (isWatchlist) {
      rowStatusStyle = 'border-left: 4px solid #eab308; background: rgba(234, 179, 8, 0.10);';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono shrink-0" style="background:#eab308;color:#0f172a">🟡 OPTION</span>';
    } else if (isGoal) {
      rowStatusStyle = 'border-left: 4px solid #ffffff; background: rgba(255, 255, 255, 0.08);';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono shrink-0" style="background:#ffffff;color:#0f172a">⚪ ZIEL / RAHMEN</span>';
    } else if (isHidden) {
      rowStatusStyle = 'border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08); opacity: 0.45;';
      statusPillHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-black font-mono shrink-0" style="background:#ef4444;color:#ffffff">🔴 WEG</span>';
    }

    let mainRow = `
      <tr onclick="VenuesModule.toggleMeetingRow('${m.id}')" style="${rowStatusStyle}" class="cursor-pointer hover:bg-slate-800/40 transition-colors">
        <td class="py-2 px-2.5 whitespace-nowrap font-bold text-white">
          <div class="flex items-center gap-1.5">
            <span class="text-cyan-400">${m.displayDate || m.date}</span>
            ${m.indoor ? '<span class="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-normal">Halle</span>' : ''}
          </div>
        </td>

        <td class="py-2 px-2.5">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${statusPillHtml}
              <span class="font-bold text-slate-100 font-sans text-xs">${m.name}</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">${m.country}</span>
            </div>
            <span class="text-[10px] text-slate-400 font-sans mt-0.5">
              📍 ${m.venue ? `${m.venue}, ` : ''}${m.city}
            </span>
          </div>
        </td>

        <!-- 4-Button Planning Status Selector: Sicher (Grün) | Option (Gelb) | Ziel/Rahmen (Weiß) | Weg (Rot) -->
        <td class="py-2 px-2 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button title="Sicherer Start (Grün)" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'confirmed')" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all" style="${
              isConfirmed ? 'background:#10b981;color:#0f172a;font-weight:900' : 'color:#94a3b8'
            }">🟢 Sicher</button>
            <button title="Option / Merkliste (Gelb)" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'watchlist')" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all" style="${
              isWatchlist ? 'background:#eab308;color:#0f172a;font-weight:900' : 'color:#94a3b8'
            }">🟡 Option</button>
            <button title="Ziel & Rahmen wie EM/WM/DM (Weiß)" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'goal')" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all" style="${
              isGoal ? 'background:#ffffff;color:#0f172a;font-weight:900' : 'color:#94a3b8'
            }">⚪ Ziel</button>
            <button title="Weg / Ausblenden (Rot)" onclick="VenuesModule.toggleMeetingStatus('${m.id}', 'hidden')" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all" style="${
              isHidden ? 'background:#ef4444;color:#ffffff;font-weight:900' : 'color:#94a3b8'
            }">🔴 Weg</button>
          </div>
        </td>

        <!-- Exact Category Color Coding -->
        <td class="py-2 px-2 text-center whitespace-nowrap">
          ${getCategoryBadgeHtml(m.category, m.tier, m.name, false)}
        </td>

        <!-- Combined Historical Results & Runway Info -->
        <td class="py-2 px-2 whitespace-nowrap">
          <div class="flex flex-col gap-0.5">
            ${bestHistMark > 0 ? `
              <span class="text-[10px] text-emerald-400 font-bold">
                🏆 ${histEds.length}x in DB (Best: ${bestHistMark.toFixed(2)}m)
              </span>
            ` : (m.promisingRunway ? '<span class="text-[10px] text-amber-300 font-bold">⭐ Schnelle Anlage</span>' : '<span class="text-[10px] text-slate-400">Standard C+</span>')}
            ${m.lukaHistory && m.lukaHistory.length > 0 ? `<span class="text-[9.5px] text-cyan-300 font-bold">Luka: ${m.lukaHistory[0].mark}m</span>` : ''}
          </div>
        </td>

        <td class="py-2 px-2.5 text-right whitespace-nowrap">
          <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-cyan-400 font-mono text-[10px] font-bold">
            ℹ️ Ergebnisse & Details
          </button>
        </td>
      </tr>
    `;

    if (!isExpanded) return mainRow;

    const histInlineHtml = histEds.length > 0 ? `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        ${histEds.slice(0, 4).map(h => `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] font-mono">
            <div class="flex justify-between items-center mb-1">
              <strong class="text-white truncate">${h.name} (${h.date || h.year})</strong>
              <span class="text-emerald-400 font-bold">Best: ${Number(h.best_mark).toFixed(2)}m</span>
            </div>
            <div class="text-slate-400 truncate">
              ${(h.top_results || []).slice(0, 3).map(r => `${r.athlete}: <b class="text-slate-200">${r.mark}m</b>`).join(' • ')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    return mainRow + `
      <tr class="bg-slate-950/90 border-b border-slate-800">
        <td colspan="6" class="p-3">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <strong class="text-white font-mono">${m.name} • ${m.city} (${m.country})</strong>
              <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 bg-cyan-600 text-slate-950 font-black font-mono text-[10px] rounded">
                Alle Ergebnisse 2023–2026 & Kontakte öffnen ↗
              </button>
            </div>
            <p class="text-slate-300 text-[11px]">${m.runwayNote || 'Offizielles World Athletics / DLV Meeting.'}</p>
            ${histInlineHtml}
          </div>
        </td>
      </tr>
    `;
  }

  // --- Historical Results Universal View (1,020 strictly relevant competitions >= 7.70m) ---
  function setHistFilter(type, val) {
    if (type === 'cat') histCategoryFilter = val;
    if (type === 'year') histYearFilter = val;
    if (type === 'sort') histSortBy = val;
    if (type === 'more') histLimit += 50;
    if (window.App && window.App.state) render(window.App.state);
  }

  function renderHistoricalResultsUniversalView(state, container) {
    const db = state.competitionsDatabase;
    const allComps = (db && db.competitions) ? db.competitions : [];

    let list = allComps.filter(c => {
      if (histCategoryFilter !== 'ALL') {
        if (histCategoryFilter === 'WM_OLY' && c.category !== 'OW') return false;
        if (histCategoryFilter === 'EM' && c.category !== 'GL') return false;
        if (histCategoryFilter === 'DL' && c.category !== 'GW' && c.category !== 'DF') return false;
        if (['A', 'B', 'C', 'D'].includes(histCategoryFilter) && c.category !== histCategoryFilter) return false;
      }
      if (histYearFilter !== 'ALL') {
        const y = String(c.year || (c.iso_date || '').slice(0, 4));
        if (y !== histYearFilter) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = `${c.name || ''} ${c.venue || ''} ${c.tour_label || ''} ${(c.results || []).map(r => r.athlete).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (histSortBy === 'mark_desc') return (Number(b.best_mark) || 0) - (Number(a.best_mark) || 0);
      if (histSortBy === 'density') return ((b.results || []).length) - ((a.results || []).length);
      return String(b.iso_date || '').localeCompare(String(a.iso_date || ''));
    });

    const sliced = list.slice(0, histLimit);

    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800 font-mono">
          <div>
            <h3 class="text-xs sm:text-sm font-black text-white uppercase">
              🏆 BEREINIGTES ERGEBNIS-ARCHIV 2023–2026 (${list.length} RELEVANTE WETTKÄMPFE ≥ 7,70M)
            </h3>
            <p class="text-[11px] text-slate-400">
              Alle irrelevanten Kat.-E/F-Wettkämpfe wurden entfernt • Nur World Tour / Meisterschaften mit Top-100-Startern & Siegerweite ≥ 7,70 m
            </p>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap text-[10px]">
            <select onchange="VenuesModule.setHistFilter('year', this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold">
              <option value="ALL" ${histYearFilter === 'ALL' ? 'selected' : ''}>Alle Jahre (2023–2026)</option>
              <option value="2026" ${histYearFilter === '2026' ? 'selected' : ''}>Saison 2026</option>
              <option value="2025" ${histYearFilter === '2025' ? 'selected' : ''}>Saison 2025</option>
              <option value="2024" ${histYearFilter === '2024' ? 'selected' : ''}>Saison 2024</option>
              <option value="2023" ${histYearFilter === '2023' ? 'selected' : ''}>Saison 2023</option>
            </select>
            <select onchange="VenuesModule.setHistFilter('cat', this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold">
              <option value="ALL" ${histCategoryFilter === 'ALL' ? 'selected' : ''}>Alle Kategorien</option>
              <option value="WM_OLY" ${histCategoryFilter === 'WM_OLY' ? 'selected' : ''}>⚪/🔴 Olympia & WM (OW)</option>
              <option value="EM" ${histCategoryFilter === 'EM' ? 'selected' : ''}>🔵 EM (GL)</option>
              <option value="DL" ${histCategoryFilter === 'DL' ? 'selected' : ''}>💎 Diamond League (GW/DF)</option>
              <option value="A" ${histCategoryFilter === 'A' ? 'selected' : ''}>🥇 Kat. A (Gold)</option>
              <option value="B" ${histCategoryFilter === 'B' ? 'selected' : ''}>🥈 Kat. B (Silber)</option>
              <option value="C" ${histCategoryFilter === 'C' ? 'selected' : ''}>🥉 Kat. C (Bronze)</option>
              <option value="D" ${histCategoryFilter === 'D' ? 'selected' : ''}>🪵 Kat. D (Holz/Challenger)</option>
            </select>
            <select onchange="VenuesModule.setHistFilter('sort', this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold">
              <option value="date_desc" ${histSortBy === 'date_desc' ? 'selected' : ''}>Chronologisch (Neueste)</option>
              <option value="mark_desc" ${histSortBy === 'mark_desc' ? 'selected' : ''}>Beste Siegerweite</option>
              <option value="density" ${histSortBy === 'density' ? 'selected' : ''}>Meiste Top-100-Starter</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-[11px] font-mono">
            <thead>
              <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <th class="py-2 px-2.5">Datum</th>
                <th class="py-2 px-2.5">Wettkampf & Ort</th>
                <th class="py-2 px-2 text-center">Kategorie</th>
                <th class="py-2 px-2 text-right">Siegerweite</th>
                <th class="py-2 px-2">Top-Ergebnisse (Top 100)</th>
                <th class="py-2 px-2.5 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              ${sliced.map(c => {
                const enc = encodeURIComponent(c.name);
                const results = c.results || [];
                const hasLuka = results.some(r => (r.athlete || '').toLowerCase().includes('herden'));
                const dispDate = (c.iso_date || '').split('-').reverse().join('.') || (c.dates_seen && c.dates_seen[0]) || c.year;
                const top3 = results.slice(0, 3).map(r => `${r.athlete}: <b class="text-white">${r.mark}m</b>`).join(' • ');
                return `
                  <tr onclick="RankingsModule.openCompetitionResultsModal('${enc}')" class="cursor-pointer hover:bg-slate-800/40 ${hasLuka ? 'bg-cyan-950/25 border-l-4 border-l-cyan-400' : ''}">
                    <td class="py-2 px-2.5 whitespace-nowrap font-bold text-cyan-400">${dispDate}</td>
                    <td class="py-2 px-2.5">
                      <div class="font-bold text-white font-sans text-xs flex items-center gap-1.5 flex-wrap">
                        <span>${c.name}</span>
                        ${hasLuka ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">MIT LUKA</span>' : ''}
                      </div>
                      <div class="text-[10px] text-slate-400">📍 ${c.venue || '-'}</div>
                    </td>
                    <td class="py-2 px-2 text-center whitespace-nowrap">
                      ${getCategoryBadgeHtml(c.category, c.tour_label, c.name, false)}
                    </td>
                    <td class="py-2 px-2 text-right font-black text-emerald-400 whitespace-nowrap">
                      ${c.best_mark ? Number(c.best_mark).toFixed(2) + ' m' : '-'}
                    </td>
                    <td class="py-2 px-2 text-[10px] text-slate-300 max-w-xs truncate">
                      ${top3}
                    </td>
                    <td class="py-2 px-2.5 text-right whitespace-nowrap">
                      <button class="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 text-[10px] font-bold">
                        Alle ${results.length} ↗
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${list.length > sliced.length ? `
          <div class="pt-2 text-center">
            <button onclick="VenuesModule.setHistFilter('more')" class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black font-mono text-xs">
              Weitere 50 Wettkämpfe laden (${sliced.length} / ${list.length}) ▾
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function openMeetingInfoModal(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    const modal = document.getElementById('meetingInfoModal');
    if (!modal) return;

    const status = getEffectiveStatus(m, getUserStatuses());
    const isConfirmed = status === 'confirmed';
    const isWatchlist = status === 'watchlist';
    const isGoal = status === 'goal';
    const isHidden = status === 'hidden';

    const catBadge = document.getElementById('modalMeetingCategoryBadge');
    if (catBadge) {
      const spec = getCategoryColorSpec(m.category, m.tier, m.name);
      catBadge.textContent = spec.label;
      catBadge.setAttribute('style', spec.style);
    }

    const titleEl = document.getElementById('modalMeetingName');
    if (titleEl) titleEl.textContent = m.name;

    const subEl = document.getElementById('modalMeetingSub');
    if (subEl) {
      subEl.textContent = `📅 ${m.displayDate || m.date} • ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country}) • ${m.tour}`;
    }

    const bodyEl = document.getElementById('modalMeetingBody');
    if (bodyEl) {
      const statusControlHtml = `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 font-mono block">Saison-Planungsstatus (Farbmarkierung):</span>
            <span class="text-xs font-black font-mono text-white">
              ${isConfirmed ? '🟢 SICHERER START (GRÜN)' : isWatchlist ? '🟡 OPTION / MERKLISTE (GELB)' : isGoal ? '⚪ ZIEL & RAHMEN (WEISS)' : isHidden ? '🔴 AUSGEBLENDET (ROT)' : 'OFFEN'}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap font-mono text-xs">
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'confirmed')" class="px-2.5 py-1 rounded-lg font-bold" style="${isConfirmed ? 'background:#10b981;color:#0f172a;font-weight:900' : 'background:#0f172a;color:#10b981;border:1px solid #10b981'}">🟢 Sicher</button>
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'watchlist')" class="px-2.5 py-1 rounded-lg font-bold" style="${isWatchlist ? 'background:#eab308;color:#0f172a;font-weight:900' : 'background:#0f172a;color:#eab308;border:1px solid #eab308'}">🟡 Option</button>
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'goal')" class="px-2.5 py-1 rounded-lg font-bold" style="${isGoal ? 'background:#ffffff;color:#0f172a;font-weight:900' : 'background:#0f172a;color:#ffffff;border:1px solid #ffffff'}">⚪ Ziel/Rahmen</button>
            <button onclick="VenuesModule.setMeetingStatusAndRefreshModal('${m.id}', 'hidden')" class="px-2.5 py-1 rounded-lg font-bold" style="${isHidden ? 'background:#ef4444;color:#ffffff;font-weight:900' : 'background:#0f172a;color:#ef4444;border:1px solid #ef4444'}">🔴 Weg</button>
          </div>
        </div>
      `;

      const matchedComps = m.historicalEditions || [];
      let dbCompsHtml = '';
      if (matchedComps.length > 0) {
        dbCompsHtml = `
          <div class="bg-slate-950 border border-cyan-800/70 rounded-xl p-3.5 space-y-2.5 shadow-sm">
            <div class="text-cyan-400 font-black text-xs font-mono uppercase">
              🏟️ HISTORISCHE ERGEBNISSE BEI DIESEM MEETING (${matchedComps.length} Editionen 2023–2026)
            </div>
            <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
              ${matchedComps.map(c => `
                <div class="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 font-mono text-xs">
                  <div class="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div>
                      <span class="font-bold text-white">${c.name}</span>
                      <span class="text-[10px] text-slate-400 ml-1">(${c.date || c.year})</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      ${getCategoryBadgeHtml(c.category, '', c.name, true)}
                      <span class="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-bold">Sieger: ${Number(c.best_mark).toFixed(2)}m</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    ${(c.top_results || []).map(r => {
                      const isLuka = (r.athlete || '').toLowerCase().includes('herden');
                      return `
                        <span class="px-2 py-0.5 rounded text-[10px] ${isLuka ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800'}">
                          ${r.place || ''} ${r.athlete} (${r.country || ''}): <strong>${r.mark}m</strong> · ${r.performance_score || ''}p
                        </span>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      let contactsHtml = '';
      if (m.contactPersons && m.contactPersons.length > 0) {
        contactsHtml = m.contactPersons.map(cp => `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-white text-xs">${cp.name || 'Ansprechpartner'}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">${cp.title || 'Veranstalter'}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
              ${cp.email ? `<a href="mailto:${cp.email}" class="text-cyan-400 hover:underline">✉️ ${cp.email}</a>` : ''}
              ${cp.phone ? `<a href="tel:${cp.phone}" class="text-emerald-400 hover:underline">📞 ${cp.phone}</a>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        contactsHtml = '<p class="text-xs text-slate-500 italic">Keine direkten Kontaktdaten hinterlegt.</p>';
      }

      bodyEl.innerHTML = `
        ${statusControlHtml}
        ${m.runwayNote ? `<div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200">${m.runwayNote}</div>` : ''}
        ${dbCompsHtml}
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase font-mono">👤 VERANSTALTER & KONTAKTE</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${contactsHtml}</div>
        </div>
      `;
    }

    modal.classList.remove('hidden');
  }

  function copyManagerPitchById(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    let text = `Hi, für meine Saisonplanung 2027 möchte ich gerne folgendes Meeting priorisieren:\n\n`;
    text += `🏆 Meeting: ${m.name}\n📅 Datum: ${m.displayDate || m.date}\n📍 Ort: ${m.city} (${m.country})\n📊 Kategorie: Kat. ${m.category} (${m.tier})\n`;
    navigator.clipboard.writeText(text).then(() => alert('✅ Pitch kopiert!'));
  }

  function resetFilters() {
    selectedTier = 'ALL';
    selectedStatusFilter = 'ALL';
    mensOnly = true;
    searchQuery = '';
    hideExcludedMeetings = true;
    histCategoryFilter = 'ALL';
    histYearFilter = 'ALL';

    const searchInput = document.getElementById('meetingSearchInput');
    if (searchInput) searchInput.value = '';
    updateStatusFilterButtonsUI();

    if (window.App && window.App.state) {
      render(window.App.state);
      if (currentViewMode === 'calendar') renderCalendarMonthGrid(window.App.state);
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    const btnList = document.getElementById('calViewListBtn');
    const btnCal = document.getElementById('calViewCalendarBtn');
    const btnRes = document.getElementById('calViewResultsBtn');
    const containerList = document.getElementById('calendarScheduleContainer');
    const containerCal = document.getElementById('calendarMonthGridContainer');

    [btnList, btnCal, btnRes].forEach(b => {
      if (b) b.className = 'px-2.5 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white transition-all';
    });
    if (mode === 'list' && btnList) btnList.className = 'px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
    if (mode === 'calendar' && btnCal) btnCal.className = 'px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
    if (mode === 'results' && btnRes) btnRes.className = 'px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500 text-slate-950 font-black shadow-sm';

    if (containerList && containerCal) {
      if (mode === 'calendar') {
        containerList.classList.add('hidden');
        containerCal.classList.remove('hidden');
        renderCalendarMonthGrid((window.App && window.App.state) || {});
      } else {
        containerList.classList.remove('hidden');
        containerCal.classList.add('hidden');
        render((window.App && window.App.state) || {});
      }
    }
  }

  let activeCalendarMonth = 'Januar 2027';
  let showAllMonthsInGrid = false;

  const CALENDAR_MONTHS = [
    'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
    'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027'
  ];

  const CALENDAR_MONTH_CONFIG = {
    'Januar 2027': { year: 2027, month: 1, days: 31 },
    'Februar 2027': { year: 2027, month: 2, days: 28 },
    'März 2027': { year: 2027, month: 3, days: 31 },
    'April 2027': { year: 2027, month: 4, days: 30 },
    'Mai 2027': { year: 2027, month: 5, days: 31 },
    'Juni 2027': { year: 2027, month: 6, days: 30 },
    'Juli 2027': { year: 2027, month: 7, days: 31 },
    'August 2027': { year: 2027, month: 8, days: 31 },
    'September 2027': { year: 2027, month: 9, days: 30 }
  };

  function setCalendarMonth(mName) {
    activeCalendarMonth = mName;
    renderCalendarMonthGrid((window.App && window.App.state) || {});
  }

  function nextCalendarMonth() {
    const idx = CALENDAR_MONTHS.indexOf(activeCalendarMonth);
    if (idx !== -1 && idx < CALENDAR_MONTHS.length - 1) setCalendarMonth(CALENDAR_MONTHS[idx + 1]);
  }

  function prevCalendarMonth() {
    const idx = CALENDAR_MONTHS.indexOf(activeCalendarMonth);
    if (idx > 0) setCalendarMonth(CALENDAR_MONTHS[idx - 1]);
  }

  function toggleShowAllMonths() {
    showAllMonthsInGrid = !showAllMonthsInGrid;
    renderCalendarMonthGrid((window.App && window.App.state) || {});
  }

  function renderCalendarMonthGrid(state) {
    const container = document.getElementById('calendarMonthGridContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const rawMeetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const statuses = getUserStatuses();

    const filtered = rawMeetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (!matchesSelectedTier(m)) return false;
      const status = getEffectiveStatus(m, statuses);
      if (hideExcludedMeetings && status === 'hidden' && selectedStatusFilter !== 'HIDDEN') return false;
      if (selectedStatusFilter === 'CONFIRMED' && status !== 'confirmed') return false;
      if (selectedStatusFilter === 'WATCHLIST' && status !== 'watchlist') return false;
      if (selectedStatusFilter === 'GOAL' && status !== 'goal') return false;
      if (selectedStatusFilter === 'MY_PLAN' && status !== 'confirmed' && status !== 'watchlist' && status !== 'goal') return false;
      if (selectedStatusFilter === 'HIDDEN' && status !== 'hidden') return false;
      return true;
    });

    const meetingsByDate = {};
    filtered.forEach(m => {
      if (m.date) {
        if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
        meetingsByDate[m.date].push(m);
      }
    });

    const monthsToRender = showAllMonthsInGrid ? CALENDAR_MONTHS : [activeCalendarMonth];

    const monthSelectorHtml = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
            ${CALENDAR_MONTHS.map(mName => {
              const mCount = filtered.filter(m => m.month === mName).length;
              const isActive = !showAllMonthsInGrid && activeCalendarMonth === mName;
              return `
                <button onclick="VenuesModule.setCalendarMonth('${mName}')" class="px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all ${
                  isActive ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }">
                  ${mName.replace(' 2027', '')} (${mCount})
                </button>
              `;
            }).join('')}
          </div>
          <button onclick="VenuesModule.toggleShowAllMonths()" class="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-950 text-cyan-300 border border-slate-800">
            ${showAllMonthsInGrid ? 'Einzelmonat' : 'Alle Monate'}
          </button>
        </div>
      </div>
    `;

    const gridsHtml = monthsToRender.map(mName => {
      const cfg = CALENDAR_MONTH_CONFIG[mName] || { year: 2027, month: 1, days: 31 };
      const firstDayWeekday = new Date(cfg.year, cfg.month - 1, 1).getDay();
      const startOffset = (firstDayWeekday === 0 ? 6 : firstDayWeekday - 1);

      let cellsHtml = '';
      for (let i = 0; i < startOffset; i++) {
        cellsHtml += `<div class="bg-slate-950/30 border border-slate-900/60 rounded-xl p-2 min-h-[100px] opacity-25 hidden sm:block"></div>`;
      }

      for (let d = 1; d <= cfg.days; d++) {
        const dateIso = `${cfg.year}-${String(cfg.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayMeetings = meetingsByDate[dateIso] || [];
        const hasMeeting = dayMeetings.length > 0;

        cellsHtml += `
          <div class="rounded-xl p-2 flex flex-col justify-between min-h-[115px] border ${
            hasMeeting ? 'bg-slate-900/90 border-slate-700' : 'bg-slate-950/60 border-slate-850/80'
          }">
            <div class="flex items-center justify-between pb-1 border-b border-slate-800/60 text-xs font-mono">
              <span class="font-black ${hasMeeting ? 'text-white' : 'text-slate-500'}">${d}.</span>
              ${hasMeeting ? `<span class="text-[9px] text-cyan-300 font-mono">${dayMeetings.length} WK</span>` : ''}
            </div>
            <div class="space-y-1.5 my-1 flex-1">
              ${dayMeetings.map(m => {
                const st = getEffectiveStatus(m, statuses);
                let borderStyle = 'border:1px solid #334155;background:#0f172a';
                if (st === 'confirmed') borderStyle = 'border:2px solid #10b981;background:rgba(16,185,129,0.18)';
                else if (st === 'watchlist') borderStyle = 'border:2px solid #eab308;background:rgba(234,179,8,0.16)';
                else if (st === 'goal') borderStyle = 'border:2px solid #ffffff;background:rgba(255,255,255,0.15)';
                else if (st === 'hidden') borderStyle = 'border:1px solid #ef4444;background:rgba(239,68,68,0.12);opacity:0.45';

                return `
                  <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="cursor-pointer rounded-lg p-1.5 font-mono text-[10px] space-y-1" style="${borderStyle}">
                    <div class="font-bold text-white leading-tight truncate" title="${m.name}">${m.shortName || m.name}</div>
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-[9px] text-slate-300 truncate">${m.city}</span>
                      ${getCategoryBadgeHtml(m.category, m.tier, m.name, true)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
          <div class="font-black font-mono text-sm text-white uppercase">${mName}</div>
          <div class="grid grid-cols-2 sm:grid-cols-7 gap-1.5 text-center font-mono font-bold text-[10px] text-slate-400">
            <div class="hidden sm:block">Mo</div><div class="hidden sm:block">Di</div><div class="hidden sm:block">Mi</div>
            <div class="hidden sm:block">Do</div><div class="hidden sm:block">Fr</div><div class="hidden sm:block text-cyan-300">Sa</div><div class="hidden sm:block text-cyan-300">So</div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-7 gap-1.5">${cellsHtml}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="space-y-4">${monthSelectorHtml}${gridsHtml}</div>`;
  }

  return {
    render,
    getCategoryColorSpec,
    getCategoryBadgeHtml,
    openMeetingInfoModal,
    copyManagerPitchById,
    resetFilters,
    toggleMeetingRow,
    setViewMode,
    setHistFilter,
    renderCalendarMonthGrid,
    setCalendarMonth,
    nextCalendarMonth,
    prevCalendarMonth,
    toggleShowAllMonths,
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
window.getUniversalCategoryBadge = VenuesModule.getCategoryBadgeHtml;
