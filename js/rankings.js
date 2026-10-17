/**
 * Tab 2: World Athletics Rankings, Historical Time-Travel & Competitor Database
 */
const RankingsModule = (() => {
  let rankChartInstance = null;
  let prognosisChartInstance = null;
  let initializedControls = false;
  let currentSnapshotIdx = null;
  let selectedHistoryInterval = 'ALL'; // 'YTD' | '1Y' | '3Y' | 'ALL'

  // Sub-tabs & Search State
  let activeSubTab = 'ranking'; // 'ranking' | 'athletes' | 'meetings'
  let athleteSearchQuery = '';
  let athleteSelectedNation = 'ALL';
  let athleteSortBy = 'latest_rank';
  let displayedAthletesLimit = 50;

  let meetingSearchQuery = '';
  let meetingSelectedCategory = 'ALL';
  let meetingSortBy = 'date_desc';
  let displayedMeetingsLimit = 40;
  let competitionsViewMode = 'list'; // 'list' | 'calendar'
  let competitionsYearFilter = 'ALL'; // 'ALL' | '2026' | '2025' | '2024' | '2023'
  let compCalendarYearMonth = '2026-06';

  let expandedAthleteDbId = null;
  let expandedMeetingDbName = null;

  function formatWindBadge(w) {
    if (!w || w === '-' || w === 'null' || w === 'None' || w === 'none') {
      return '<span class="text-slate-600 font-mono text-[10px]">-</span>';
    }
    let str = String(w).trim();
    let num = parseFloat(str.replace(/[^\d.-]/g, ''));
    if (isNaN(num)) return '<span class="text-slate-600 font-mono text-[10px]">-</span>';

    // If magnitude >= 4.0 m/s, it's missing decimal point (e.g. 16 -> 1.6 m/s, -12 -> -1.2 m/s)
    if (Math.abs(num) >= 4.0) {
      num = num / 10;
    }
    const sign = num > 0 ? '+' : (num < 0 ? '-' : '');
    const formatted = `${sign}${Math.abs(num).toFixed(1)} m/s`;

    if (num < 0) {
      return `<span class="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800" title="Gegenwind (${formatted})">${formatted} 🌬️</span>`;
    }
    if (num > 2.05) {
      return `<span class="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-amber-950 text-amber-300 border border-amber-800" title="Rückenwind über +2.0 m/s (${formatted})">${formatted}</span>`;
    }
    return `<span class="text-slate-300 font-mono text-[9px]">${formatted}</span>`;
  }

  function formatPlaceBadge(c) {
    if (!c) return '<span class="text-slate-500 font-mono text-[10px]">-</span>';
    let place = String(c.place_display || c.place || '-').trim();
    const compName = (c.competition || '').toLowerCase();
    const dateStr = String(c.date || '').toUpperCase();

    let isQuali = false;
    let isFinal = false;

    if (place.includes('Q') || (c.round === 'Q') || compName.includes('quali') || compName.includes('qualification')) {
      isQuali = true;
    } else if (place.includes('F') || (c.round === 'F') || compName.includes('finale')) {
      isFinal = true;
    }

    // Olympic Games Paris 2024
    if (compName.includes('olympic') || compName.includes('paris')) {
      if (dateStr.includes('04 AUG') || dateStr.includes('4 AUG') || dateStr.includes('2024-08-04')) {
        isQuali = true;
      } else if (dateStr.includes('06 AUG') || dateStr.includes('6 AUG') || dateStr.includes('2024-08-06')) {
        isFinal = true;
      }
    }
    // European Championships Rome 2024
    if (compName.includes('roma') || compName.includes('rome') || compName.includes('rom')) {
      if (dateStr.includes('07 JUN') || dateStr.includes('7 JUN') || dateStr.includes('2024-06-07')) {
        isQuali = true;
      } else if (dateStr.includes('08 JUN') || dateStr.includes('8 JUN') || dateStr.includes('2024-06-08')) {
        isFinal = true;
      }
    }
    // World Championships Tokyo 2025
    if (compName.includes('tokyo') || compName.includes('tokio')) {
      if (dateStr.includes('13 SEP') || dateStr.includes('14 SEP') || dateStr.includes('2025-09-13') || dateStr.includes('2025-09-14')) {
        isQuali = true;
      } else if (dateStr.includes('15 SEP') || dateStr.includes('2025-09-15')) {
        isFinal = true;
      }
    }

    const numPart = place.replace(/[^\d.]/g, '');
    const cleanNum = numPart ? (numPart.endsWith('.') ? numPart : numPart + '.') : place;

    if (isQuali) {
      return `<span class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 font-bold text-[9px]" title="Qualifikationswettkampf">${cleanNum} Q</span>`;
    }
    if (isFinal) {
      return `<span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold text-[9px]" title="Finalwettkampf">${cleanNum} F</span>`;
    }
    if (place.includes('Q')) {
      return `<span class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 font-bold text-[9px]">${place}</span>`;
    }
    if (place.includes('F')) {
      return `<span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold text-[9px]">${place}</span>`;
    }
    return `<span class="font-bold text-slate-200">${place}</span>`;
  }

  function parseAthleteDob(dobStr) {
    if (!dobStr) return 0;
    const parts = dobStr.trim().split(/\s+/);
    const months = { 'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11 };
    if (parts.length === 3) {
      const day = parseInt(parts[0]) || 1;
      const mIdx = months[parts[1].toUpperCase()] !== undefined ? months[parts[1].toUpperCase()] : 0;
      const year = parseInt(parts[2]) || 2000;
      return new Date(year, mIdx, day).getTime();
    }
    const d = new Date(dobStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function parseDateStr(str) {
    if (!str) return 0;
    const trimmed = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
    }
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'MRZ': 2, 'MÄR': 2, 'APR': 3, 'MAY': 4, 'MAI': 4,
      'JUN': 5, 'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'OKT': 9, 'NOV': 10, 'DEC': 11, 'DEZ': 11
    };
    const parts = trimmed.split(/[\s.]+/);
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10) || 1;
      const mStr = parts[1].toUpperCase();
      const m = months[mStr] !== undefined ? months[mStr] : (parseInt(mStr, 10) ? parseInt(mStr, 10) - 1 : 0);
      const y = parseInt(parts[2], 10) || 2024;
      return new Date(y, m, d).getTime();
    }
    const dt = new Date(trimmed);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  }

  function cleanFloatMark(val) {
    if (val == null || val === '' || val === '-') return 0;
    const clean = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  function getMeetingIsoDate(meet) {
    if (meet.iso_date && /^\d{4}-\d{2}-\d{2}$/.test(meet.iso_date)) {
      return meet.iso_date;
    }
    const ts = getMeetingSortDate(meet, true);
    if (!ts) return '';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function getMeetingSortDate(meet, newest = true) {
    if (meet.iso_date) {
      const t = parseDateStr(meet.iso_date);
      if (t > 0) return t;
    }
    const dates = (meet.dates_seen || []).map(parseDateStr).filter(t => t > 0);
    if (dates.length === 0) return 0;
    return newest ? Math.max(...dates) : Math.min(...dates);
  }

  function getMeetingTopMark(meet) {
    let top = 0;
    (meet.results || []).forEach(r => {
      const v = cleanFloatMark(r.mark);
      if (v > top) top = v;
    });
    return top;
  }

  const athleteTableSorts = {};
  const athleteDbSorts = {};
  let currentModalAthleteName = null;
  let currentModalSort = 'date';

  function sortAthleteCompetitions(comps, sortKey = 'date') {
    if (!comps || !comps.length) return [];
    const list = [...comps];

    if (sortKey === 'mark') {
      return list.sort((a, b) => cleanFloatMark(b.mark) - cleanFloatMark(a.mark));
    } else if (sortKey === 'mark-asc') {
      return list.sort((a, b) => cleanFloatMark(a.mark) - cleanFloatMark(b.mark));
    } else if (sortKey === 'score') {
      return list.sort((a, b) => {
        const sA = parseInt(a.performance_score || a.performanceScore || a.result_score || 0);
        const sB = parseInt(b.performance_score || b.performanceScore || b.result_score || 0);
        return sB - sA;
      });
    } else if (sortKey === 'score-asc') {
      return list.sort((a, b) => {
        const sA = parseInt(a.performance_score || a.performanceScore || a.result_score || 0);
        const sB = parseInt(b.performance_score || b.performanceScore || b.result_score || 0);
        return sA - sB;
      });
    } else if (sortKey === 'date-asc') {
      return list.sort((a, b) => parseDateStr(a.date) - parseDateStr(b.date));
    } else {
      // Default: date descending (newest first)
      return list.sort((a, b) => parseDateStr(b.date) - parseDateStr(a.date));
    }
  }

  function setAthleteRowSort(encodedName, sortKey) {
    const athName = decodeURIComponent(encodedName);
    const baseKey = sortKey.replace('-asc', '');
    const cur = athleteTableSorts[athName] || 'date';
    if (cur === baseKey) {
      athleteTableSorts[athName] = `${baseKey}-asc`;
    } else {
      athleteTableSorts[athName] = baseKey;
    }
    if (window.App && window.App.state) {
      renderTable(window.App.state);
    }
  }

  function setAthleteDbSort(encodedId, sortKey) {
    const athId = decodeURIComponent(encodedId);
    const baseKey = sortKey.replace('-asc', '');
    const cur = athleteDbSorts[athId] || 'date';
    if (cur === baseKey) {
      athleteDbSorts[athId] = `${baseKey}-asc`;
    } else {
      athleteDbSorts[athId] = baseKey;
    }
    if (window.App && window.App.state) {
      renderAthletesDatabase(window.App.state);
    }
  }

  function setHistoryInterval(interval) {
    selectedHistoryInterval = interval;
    ['YTD', '1Y', '3Y', 'ALL'].forEach(k => {
      const btn = document.getElementById(`histInterval${k.toLowerCase()}Btn`);
      if (btn) {
        if (k === interval) {
          btn.className = 'hist-interval-btn px-2 py-0.5 rounded bg-cyan-900 text-cyan-300 border border-cyan-700 font-bold transition-all';
        } else {
          btn.className = 'hist-interval-btn px-2 py-0.5 rounded text-slate-400 hover:text-white transition-all font-bold';
        }
      }
    });
    if (window.App && window.App.state) {
      renderCompactHistoryChart(window.App.state);
    }
  }

  function setModalAthleteSort(sortKey) {
    const baseKey = sortKey.replace('-asc', '');
    if (currentModalSort === baseKey) {
      currentModalSort = `${baseKey}-asc`;
    } else {
      currentModalSort = baseKey;
    }
    ['date', 'mark', 'score'].forEach(k => {
      const btn = document.getElementById('modalSort' + k.charAt(0).toUpperCase() + k.slice(1) + 'Btn');
      if (btn) {
        const isCurrent = currentModalSort.startsWith(k);
        const isAsc = currentModalSort === `${k}-asc`;
        const label = k === 'date' ? 'Datum' : (k === 'mark' ? 'Weite' : 'Score');
        btn.textContent = `${label} ${isCurrent ? (isAsc ? '▲' : '▼') : '↕'}`;
        if (isCurrent) {
          btn.className = 'px-2 py-0.5 rounded bg-cyan-900 text-cyan-300 font-bold border border-cyan-700 transition-all';
        } else {
          btn.className = 'px-2 py-0.5 rounded bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition-all';
        }
      }
    });
    if (currentModalAthleteName) {
      openCompetitorModal(currentModalAthleteName, false);
    }
  }

  function selectPrognosisDate(dateStr) {
    const archive = (window.App && window.App.state && window.App.state.rankingsArchive) || null;
    if (!archive || !archive.snapshots) return;
    const idx = archive.snapshots.findIndex(s => s.date === dateStr || (s.date && s.date.startsWith(dateStr)));
    if (idx >= 0) {
      const sel = document.getElementById('rankingSnapshotSelect');
      const slider = document.getElementById('rankingTimelineSlider');
      if (sel) sel.value = idx;
      if (slider) slider.value = idx;
      loadSnapshot(window.App.state, idx);
    }
  }

  function render(state) {
    initSubTabs(state);
    initTimeTravelControls(state);
    renderKpiTiles(state);
    renderTable(state);
    renderPrognosisCard(state);
    renderCompactHistoryChart(state);
    if (activeSubTab === 'athletes') renderAthletesDatabase(state);
    if (activeSubTab === 'meetings') renderMeetingsDatabase(state);
  }

  function initSubTabs(state) {
    const btnRanking = document.getElementById('subTabRankingBtn');
    const btnAthletes = document.getElementById('subTabAthletesBtn');
    const btnMeetings = document.getElementById('subTabMeetingsBtn');

    if (!btnRanking || !btnAthletes || !btnMeetings) return;

    btnRanking.onclick = () => switchSubTab(state, 'ranking');
    btnAthletes.onclick = () => switchSubTab(state, 'athletes');
    btnMeetings.onclick = () => switchSubTab(state, 'meetings');

    // Athlete Search & Sort Listeners
    const athInput = document.getElementById('athleteDbSearchInput');
    if (athInput && !athInput.dataset.bound) {
      athInput.dataset.bound = 'true';
      athInput.oninput = (e) => {
        athleteSearchQuery = e.target.value;
        displayedAthletesLimit = 50;
        renderAthletesDatabase(state);
      };
    }

    const athSort = document.getElementById('athleteDbSortSelect');
    if (athSort && !athSort.dataset.bound) {
      athSort.dataset.bound = 'true';
      athSort.onchange = (e) => {
        athleteSortBy = e.target.value;
        displayedAthletesLimit = 50;
        renderAthletesDatabase(state);
      };
    }

    document.querySelectorAll('.dbnat-filter-btn').forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.onclick = () => {
          document.querySelectorAll('.dbnat-filter-btn').forEach(b => {
            b.className = 'dbnat-filter-btn px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-950';
          });
          btn.className = 'dbnat-filter-btn px-2.5 py-0.5 rounded font-bold bg-slate-700 text-white';
          athleteSelectedNation = btn.dataset.dbnation;
          displayedAthletesLimit = 50;
          renderAthletesDatabase(state);
        };
      }
    });

    // Meeting Search & Sort Listeners
    const meetInput = document.getElementById('meetingsDbSearchInput');
    if (meetInput && !meetInput.dataset.bound) {
      meetInput.dataset.bound = 'true';
      meetInput.oninput = (e) => {
        meetingSearchQuery = e.target.value;
        displayedMeetingsLimit = 40;
        renderMeetingsDatabase(state);
      };
    }

    const meetSort = document.getElementById('meetingDbSortSelect');
    if (meetSort && !meetSort.dataset.bound) {
      meetSort.dataset.bound = 'true';
      meetSort.onchange = (e) => {
        meetingSortBy = e.target.value;
        displayedMeetingsLimit = 40;
        renderMeetingsDatabase(state);
      };
    }

    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.onclick = () => {
          document.querySelectorAll('.cat-filter-btn').forEach(b => {
            b.className = 'cat-filter-btn px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-950';
          });
          btn.className = 'cat-filter-btn px-2.5 py-0.5 rounded font-bold bg-slate-700 text-white';
          meetingSelectedCategory = btn.dataset.catfilter;
          displayedMeetingsLimit = 40;
          renderMeetingsDatabase(state);
        };
      }
    });
  }

  function switchSubTab(state, tabName) {
    activeSubTab = tabName;
    const vRank = document.getElementById('subViewRanking');
    const vAth = document.getElementById('subViewAthletes');
    const vMeet = document.getElementById('subViewMeetings');

    const bRank = document.getElementById('subTabRankingBtn');
    const bAth = document.getElementById('subTabAthletesBtn');
    const bMeet = document.getElementById('subTabMeetingsBtn');

    if (vRank) vRank.classList.toggle('hidden', tabName !== 'ranking');
    if (vAth) vAth.classList.toggle('hidden', tabName !== 'athletes');
    if (vMeet) vMeet.classList.toggle('hidden', tabName !== 'meetings');

    const activeCls = 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-cyan-500 text-slate-950 transition-all flex items-center gap-1.5 shadow-sm';
    const inactiveCls = 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center gap-1.5';

    if (bRank) bRank.className = tabName === 'ranking' ? activeCls : inactiveCls;
    if (bAth) bAth.className = tabName === 'athletes' ? activeCls : inactiveCls;
    if (bMeet) bMeet.className = tabName === 'meetings' ? activeCls : inactiveCls;

    if (tabName === 'athletes') renderAthletesDatabase(state);
    if (tabName === 'meetings') renderMeetingsDatabase(state);
  }

  function initTimeTravelControls(state) {
    const sel = document.getElementById('rankingSnapshotSelect');
    const slider = document.getElementById('rankingTimelineSlider');
    const badge = document.getElementById('rankingMilestoneBadge');
    if (!sel || !slider) return;

    const archive = state.rankingsArchive;
    if (!archive || !archive.snapshots || archive.snapshots.length === 0) return;

    if (!initializedControls) {
      sel.innerHTML = archive.snapshots.map((snap, idx) => {
        const lukaTxt = snap.lukaRank ? `Luka #${snap.lukaRank} (${snap.lukaScore} Pkt)` : `Luka außerhalb Top 100`;
        return `<option value="${idx}">${snap.displayDate} • ${lukaTxt}</option>`;
      }).join('');

      slider.min = 0;
      slider.max = archive.snapshots.length - 1;

      // Enforce default snapshot to the latest official snapshot (never future prognosis)
      const todayStr = new Date().toISOString().split('T')[0];
      let defaultIdx = 0;
      for (let i = archive.snapshots.length - 1; i >= 0; i--) {
        const s = archive.snapshots[i];
        if (!s.is_prognosis && !s.isPrognosis && (s.date || '') <= todayStr) {
          defaultIdx = i;
          break;
        }
      }

      currentSnapshotIdx = defaultIdx;
      slider.value = defaultIdx;
      sel.value = defaultIdx;
      loadSnapshot(state, defaultIdx);

      sel.onchange = () => {
        const idx = parseInt(sel.value);
        slider.value = idx;
        loadSnapshot(state, idx);
      };

      slider.oninput = () => {
        const idx = parseInt(slider.value);
        sel.value = idx;
        loadSnapshot(state, idx);
      };

      initializedControls = true;
    }

    // Update active badge
    if (badge && currentSnapshotIdx !== null) {
      const snap = archive.snapshots[currentSnapshotIdx];
      if (snap) {
        const lukaTxt = snap.lukaRank ? `Luka #${snap.lukaRank} (${snap.lukaScore} Pkt)` : `Luka außerhalb Top 100`;
        badge.textContent = `${snap.displayDate} • ${lukaTxt}`;
      }
    }
  }

  function loadSnapshot(state, idx) {
    const archive = state.rankingsArchive;
    if (!archive || !archive.snapshots[idx]) return;

    currentSnapshotIdx = idx;
    const snap = archive.snapshots[idx];

    // Map snapshot athletes
    state.athletes = snap.athletes.map((ath, i) => {
      const meetings = (ath.counted_competitions || []).map(m => ({
        ...m,
        place_display: m.place_display || m.place || '-',
        round: m.round || (m.competition && (m.competition.toLowerCase().includes('quali') || m.competition.toLowerCase().includes(' q')) ? 'Q' : 'F')
      }));
      let sb = 0;
      meetings.forEach(m => {
        const markVal = cleanFloatMark(m.mark);
        if (markVal > sb) sb = markVal;
      });

      return {
        id: ath.profile_url || `ath-${idx}-${i}`,
        originalRank: parseInt(ath.rank, 10) || i + 1,
        name: ath.name || '',
        nation: ath.country || '',
        dob: ath.dob || '',
        sb: sb > 0 ? sb : null,
        totalScore: parseInt(ath.ranking_score, 10) || 0,
        profile_url: ath.profile_url || '',
        countingMeetings: meetings,
        rankDelta: ath.rank_delta !== undefined ? ath.rank_delta : null,
        scoreDelta: ath.score_delta !== undefined ? ath.score_delta : null
      };
    });

    // Update milestone badge
    const badge = document.getElementById('rankingMilestoneBadge');
    if (badge) {
      if (snap.milestoneNote) {
        badge.innerHTML = `<span class="text-amber-400 font-bold">${snap.is_prognosis ? '🔮 PROGNOSE ' : ''}${snap.displayDate}:</span> ${snap.milestoneNote}`;
      } else {
        badge.textContent = snap.is_prognosis ? `🔮 PROGNOSE: ${snap.displayDate}` : `Stand: ${snap.displayDate}`;
      }
    }

    renderKpiTiles(state);
    renderTable(state);
    renderPrognosisCard(state);
  }

  function renderKpiTiles(state) {
    const me = state.athletes.find(a => a.name.toLowerCase().includes('herden')) || state.athletes.find(a => a.nation === 'GER');
    const cutoffIdx = Math.min(state.cutoffSpots - 1, state.athletes.length - 1);
    const cutoffAth = state.athletes[cutoffIdx];

    // Athlete Focus (Luka Herden)
    if (me) {
      const elRank = document.getElementById('kpiMeRank');
      if (elRank) elRank.textContent = '#' + me.originalRank;

      const elScore = document.getElementById('kpiMeScore');
      if (elScore) elScore.textContent = me.totalScore + ' Pkt';

      const elDelta = document.getElementById('kpiMeDelta');
      if (elDelta) {
        if (me.rankDelta !== null && me.rankDelta !== undefined) {
          const delta = me.rankDelta;
          const ptsDelta = me.scoreDelta || 0;
          elDelta.innerHTML = delta > 0
            ? `<span class="text-emerald-400 font-bold">▲ +${delta} (${ptsDelta >= 0 ? '+' : ''}${ptsDelta} Pkt)</span>`
            : delta < 0
            ? `<span class="text-rose-400 font-bold">▼ ${Math.abs(delta)} (${ptsDelta} Pkt)</span>`
            : `<span class="text-slate-400">WoW: ±0 (${ptsDelta >= 0 ? '+' : ''}${ptsDelta} Pkt)</span>`;
        } else {
          elDelta.innerHTML = `<span class="text-cyan-400">SB: ${me.sb ? me.sb.toFixed(2) : '8.18'}m</span>`;
        }
      }

      if (cutoffAth) {
        const gap = me.totalScore - cutoffAth.totalScore;
        const gapElem = document.getElementById('kpiMeGap');
        if (gapElem) {
          gapElem.textContent = (gap >= 0 ? '+' : '') + gap + ' Pkt';
          gapElem.className = gap >= 0 ? 'text-lg font-black font-mono text-emerald-400' : 'text-lg font-black font-mono text-rose-400';
        }
        const gapSub = document.getElementById('kpiMeGapSub');
        if (gapSub) {
          gapSub.textContent = gap >= 0 ? `Sicher vor Cutoff #${state.cutoffSpots}` : `Rückstand auf #${state.cutoffSpots}`;
        }
      }
    }

    // Cutoff Spot Info
    if (cutoffAth) {
      const elCutScore = document.getElementById('kpiCutoffScore');
      if (elCutScore) elCutScore.textContent = cutoffAth.totalScore + ' Pkt';
      const elCutName = document.getElementById('kpiCutoffAthName');
      if (elCutName) elCutName.textContent = `#${state.cutoffSpots}: ${cutoffAth.name} (${cutoffAth.nation})`;
    }

    // German DLV Squad
    const germans = state.athletes.filter(a => a.nation === 'GER');
    const elGerBadge = document.getElementById('kpiGerCountBadge');
    if (elGerBadge) elGerBadge.textContent = `${germans.length} DLV KADER`;

    const gerListElem = document.getElementById('kpiGerList');
    if (gerListElem) {
      if (germans.length > 0) {
        gerListElem.innerHTML = germans.map(g => {
          const isLuka = g.name.toLowerCase().includes('herden');
          return `
            <div class="flex items-center justify-between py-0.5 border-b border-slate-800/40 ${isLuka ? 'text-cyan-400 font-bold' : 'text-slate-300'}">
              <span class="truncate">#${g.originalRank} ${g.name}</span>
              <span class="text-amber-400 font-mono ml-2 text-xs">${g.totalScore} Pkt</span>
            </div>
          `;
        }).join('');
      } else {
        gerListElem.innerHTML = '<span class="text-slate-500 italic">Keine DLV Athleten in der Liste</span>';
      }
    }
  }

  function renderPrognosisCard(state) {
    const container = document.getElementById('prognosisCockpitContainer');
    if (!container) return;

    const snap = (state.rankingsArchive && state.rankingsArchive.snapshots && currentSnapshotIdx !== null)
      ? state.rankingsArchive.snapshots[currentSnapshotIdx]
      : null;
    const snapDate = snap ? parseDateStr(snap.date) : new Date(2026, 9, 13).getTime();

    const luka = state.athletes.find(a => a.name.toLowerCase().includes('herden'));
    const meets = (luka && luka.countingMeetings) ? luka.countingMeetings : [];

    // Calculate meeting expiration details (365 days after date) and sort by expiration date ascending
    const meetsWithExpiry = meets.map(m => {
      const meetTime = parseDateStr(m.date);
      const expiryTime = meetTime > 0 ? meetTime + (365 * 24 * 60 * 60 * 1000) : 0;
      const expiryDate = new Date(expiryTime);
      const daysLeft = expiryTime > 0 ? Math.ceil((expiryTime - snapDate) / (1000 * 60 * 60 * 24)) : 0;
      const expDateStr = expiryTime > 0
        ? `${String(expiryDate.getDate()).padStart(2, '0')}.${String(expiryDate.getMonth() + 1).padStart(2, '0')}.${expiryDate.getFullYear()}`
        : '-';

      let statusBadge = '';
      if (daysLeft <= 0) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">⚠️ Verfallen (${expDateStr})</span>`;
      } else if (daysLeft <= 120) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">⏳ Noch ${daysLeft} Tage (${expDateStr})</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">✅ Aktiv (${daysLeft} Tage bis ${expDateStr})</span>`;
      }

      return {
        ...m,
        meetTime,
        expiryTime,
        expDateStr,
        daysLeft,
        statusBadge
      };
    }).sort((a, b) => a.expiryTime - b.expiryTime);

    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base">⏱️</span>
              <h3 class="text-xs font-black text-white uppercase tracking-wider font-mono">
                ABLAUFDATEN (365-TAGE-REGEL) & PUNKTERECHNER
              </h3>
            </div>
            <p class="text-[10px] text-slate-400 font-mono mt-0.5">
              Ablaufdaten deiner 5 Wertungs-Meetings & Simulation neuer Wettkampfergebnisse nach offizieller WA-Formel
            </p>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meetsWithExpiry.length >= 5 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}">
            Status: ${meetsWithExpiry.length}/5 Meetings in Wertung
          </span>
        </div>

        <!-- 1. Expiration Dates Table (Ablaufdaten) -->
        <div>
          <h4 class="text-[11px] font-bold text-slate-300 uppercase font-mono mb-2 flex items-center gap-1.5">
            <span>📅</span>
            <span>Ablaufdaten von Lukas gewerteten Meetings (chronologisch nach Verfall):</span>
          </h4>
          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-left border-collapse text-[10px] font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] uppercase">
                  <th class="py-1.5 px-2.5">Wettkampf</th>
                  <th class="py-1.5 px-2 text-center">Wettkampf-Datum</th>
                  <th class="py-1.5 px-2 text-center">Kat.</th>
                  <th class="py-1.5 px-2 text-right">Weite</th>
                  <th class="py-1.5 px-2 text-right">Punkte</th>
                  <th class="py-1.5 px-2 text-center">Ablaufdatum (WA 365d)</th>
                  <th class="py-1.5 px-2 text-center">Restlaufzeit</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${meetsWithExpiry.length > 0 ? meetsWithExpiry.map(m => `
                  <tr class="hover:bg-slate-800/30 ${m.daysLeft <= 0 ? 'opacity-60 bg-rose-950/10' : ''}">
                    <td class="py-1.5 px-2.5 text-white font-sans font-medium text-xs">
                      ${m.competition || '-'}
                      ${m.competition && m.competition.toLowerCase().includes('gorz') ? '<span class="ml-1 px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px]">PEAK 1247</span>' : ''}
                    </td>
                    <td class="py-1.5 px-2 text-center text-slate-400 whitespace-nowrap">${m.date || '-'}</td>
                    <td class="py-1.5 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">${m.category || '-'}</span></td>
                    <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${m.mark}m</td>
                    <td class="py-1.5 px-2 text-right font-black text-amber-400">${m.performance_score || m.performanceScore || '-'} Pkt</td>
                    <td class="py-1.5 px-2 text-center text-white whitespace-nowrap font-bold">${m.expDateStr}</td>
                    <td class="py-1.5 px-2 text-center whitespace-nowrap">${m.statusBadge}</td>
                  </tr>
                `).join('') : '<tr><td colspan="7" class="py-3 text-center text-slate-500 italic">Keine Meetings für diesen Zeitpunkt hinterlegt.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Interactive WA Score Calculator (Punkterechner) -->
        <div class="pt-3 border-t border-slate-800/80">
          <div class="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-sm">🧮</span>
              <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider">
                PUNKTERECHNER & MEETING-ERSATZ SIMULATOR
              </h4>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">Offizielle World Athletics Scoring Tables + Platzierungs-Bonus</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">Ziel-Weite (m):</label>
              <input id="simMarkInput" type="number" step="0.01" value="8.05" oninput="RankingsModule.simulateNewMeeting()" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none" />
            </div>
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">Wind (m/s):</label>
              <input id="simWindInput" type="number" step="0.1" value="0.0" oninput="RankingsModule.simulateNewMeeting()" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none" />
            </div>
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">Meeting-Kategorie:</label>
              <select id="simCatSelect" onchange="RankingsModule.simulateNewMeeting()" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none">
                <option value="OW">Kat. OW (Olympia / WM) • +350 max</option>
                <option value="DF">Kat. DF (DL Finale) • +240 max</option>
                <option value="GW">Kat. GW (Diamond League / Hallen-WM) • +170 max</option>
                <option value="GL">Kat. GL (Hallen-EM / EM) • +140 max</option>
                <option value="A" selected>Kat. A (Gold Tour) • +100 max</option>
                <option value="B">Kat. B (Silver Tour / DM) • +60 max</option>
                <option value="C">Kat. C (Bronze Tour) • +40 max</option>
                <option value="D">Kat. D (Challenger) • +25 max</option>
                <option value="E">Kat. E (National) • +15 max</option>
                <option value="F">Kat. F (Regional) • 0 Bonus</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">Platzierung:</label>
              <select id="simPlaceSelect" onchange="RankingsModule.simulateNewMeeting()" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none">
                <option value="1">1. Platz</option>
                <option value="2">2. Platz</option>
                <option value="3">3. Platz</option>
                <option value="4">4. Platz</option>
                <option value="5">5. Platz</option>
                <option value="6">6. Platz</option>
                <option value="7">7. Platz</option>
                <option value="8">8. Platz</option>
                <option value="9">Kein Platz-Bonus (&gt;8.)</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1 flex items-end">
              <button onclick="RankingsModule.simulateNewMeeting()" class="w-full py-1.5 px-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black font-mono text-xs rounded transition-all shadow-sm">
                Berechnen ➔
              </button>
            </div>
          </div>

          <div id="simResultBox" class="mt-2.5 bg-slate-950 border border-cyan-500/40 rounded-lg p-2.5 text-xs font-mono text-slate-300">
            <!-- Populated automatically by simulateNewMeeting -->
          </div>
        </div>
      </div>
    `;

    // Immediately populate the score calculator preview
    simulateNewMeeting();
  }

  function simulateNewMeeting() {
    const markInput = document.getElementById('simMarkInput');
    const windInput = document.getElementById('simWindInput');
    const catSelect = document.getElementById('simCatSelect');
    const placeSelect = document.getElementById('simPlaceSelect');
    const resultBox = document.getElementById('simResultBox');
    if (!markInput || !catSelect || !placeSelect || !resultBox) return;

    const mark = parseFloat(markInput.value) || 8.05;
    const wind = windInput ? (parseFloat(windInput.value) || 0.0) : 0.0;
    const cat = catSelect.value || 'A';
    const place = parseInt(placeSelect.value, 10) || 1;

    const bonuses = {
      'OW': [350, 300, 260, 230, 200, 175, 150, 130],
      'DF': [240, 210, 185, 165, 145, 130, 115, 100],
      'GW': [170, 140, 120, 100, 85, 75, 65, 55],
      'GL': [140, 120, 100, 85, 75, 65, 55, 45],
      'A':  [100, 80, 70, 60, 50, 40, 35, 30],
      'B':  [60, 50, 45, 40, 35, 30, 25, 20],
      'C':  [40, 35, 30, 25, 20, 15, 12, 10],
      'D':  [25, 20, 15, 10, 8, 5, 0, 0],
      'E':  [15, 10, 5, 0, 0, 0, 0, 0],
      'F':  [0, 0, 0, 0, 0, 0, 0, 0]
    };

    const placeIdx = place - 1;
    const bonus = (placeIdx >= 0 && placeIdx < 8 && bonuses[cat] && bonuses[cat][placeIdx] !== undefined)
      ? bonuses[cat][placeIdx]
      : 0;

    // Official WA Hungarian Scoring Table calibration for Men's Long Jump (7.80m=1076, 8.00m=1120, 8.18m=1160)
    let resultPoints = Math.round(1076 + (mark - 7.80) * 220);
    let windDeduction = 0;
    if (wind > 2.0) {
      windDeduction = Math.round((wind - 2.0) * 6);
      resultPoints -= windDeduction;
    }
    const totalNewScore = resultPoints + bonus;

    const state = (window.App && window.App.state) || null;
    if (!state) return;

    const luka = state.athletes.find(a => a.name.toLowerCase().includes('herden'));
    const currentMeets = (luka && luka.countingMeetings) ? [...luka.countingMeetings] : [];
    const currentScores = currentMeets.map(m => parseInt(m.performance_score || m.performanceScore || 0, 10)).filter(s => s > 0);

    let updatedScores = [];
    let replaceNote = '';
    const oldAvg = currentScores.length > 0 ? Math.round(currentScores.reduce((a, b) => a + b, 0) / currentScores.length) : 1144;

    if (currentScores.length < 5) {
      updatedScores = [...currentScores, totalNewScore];
      replaceNote = `Füllt den fehlenden 5. Wettkampf auf (aktuell nur ${currentScores.length}/5 Meets aktiv).`;
    } else {
      currentScores.sort((a, b) => a - b);
      const lowest = currentScores[0];
      if (totalNewScore > lowest) {
        updatedScores = [...currentScores.slice(1), totalNewScore];
        replaceNote = `Ersetzt dein schwächstes zählendes Meeting (${lowest} Pkt) durch ${totalNewScore} Pkt (+${totalNewScore - lowest} Pkt Einzeldifferenz).`;
      } else {
        updatedScores = [...currentScores];
        replaceNote = `Liegt unter deinem schwächsten zählenden Meeting (${lowest} Pkt) und dient als Backup, sobald ein älteres Meeting abläuft.`;
      }
    }

    const newAvg = updatedScores.length > 0
      ? Math.round(updatedScores.reduce((a, b) => a + b, 0) / updatedScores.length)
      : totalNewScore;
    const delta = newAvg - oldAvg;

    const projectedRank = state.athletes.filter(a => !a.name.toLowerCase().includes('herden') && a.totalScore >= newAvg).length + 1;
    const currentRank = luka ? luka.originalRank : 70;
    const rankDelta = currentRank - projectedRank;

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <span class="font-bold text-white text-xs">
          🎯 Berechnung: ${mark.toFixed(2)}m (${wind >= 0 ? '+' : ''}${wind.toFixed(1)} m/s) • Kat. ${cat} (${place <= 8 ? place + '. Platz' : '>8. Platz'})
        </span>
        <span class="px-2 py-0.5 rounded font-black text-amber-400 bg-amber-950/80 border border-amber-800">
          Performance-Score: ${totalNewScore} Pkt (${resultPoints} Result${windDeduction > 0 ? ` [-${windDeduction} Wind]` : ''} + ${bonus} Platz)
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        <div class="bg-slate-900 border border-slate-800 rounded p-2">
          <span class="text-[10px] text-slate-400 uppercase block">Neuer 5er-Schnitt (Ranking Score):</span>
          <span class="text-base font-black text-white font-mono">${newAvg} Pkt</span>
          <span class="text-[10px] font-mono ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'} block">
            ${delta >= 0 ? '+' : ''}${delta} Pkt gegenüber ${oldAvg} Pkt
          </span>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded p-2">
          <span class="text-[10px] text-slate-400 uppercase block">Simulierter Weltranglisten-Platz:</span>
          <span class="text-base font-black text-cyan-400 font-mono">#${projectedRank} weltweit</span>
          <span class="text-[10px] font-mono ${rankDelta > 0 ? 'text-emerald-400' : 'text-slate-400'} block">
            ${rankDelta > 0 ? `▲ +${rankDelta} Plätze Aufstieg (von #${currentRank})` : `Aktueller Rang #${currentRank} gehalten`}
          </span>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded p-2">
          <span class="text-[10px] text-slate-400 uppercase block">Wertungseffekt:</span>
          <span class="text-[11px] text-slate-300 font-sans leading-tight block mt-0.5">${replaceNote}</span>
        </div>
      </div>
    `;
  }

  function renderTable(state) {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = [...state.athletes];

    // Ensure WoW Delays are populated
    list = list.map((ath, idx) => {
      let rankDelta = ath.rankDelta;
      let scoreDelta = ath.scoreDelta;
      if (rankDelta === undefined || rankDelta === null) {
        const aName = (ath.name || '').toLowerCase();
        const prev = state.previousAthletesMap[aName];
        if (prev) {
          rankDelta = prev.rank - ath.originalRank;
          scoreDelta = ath.totalScore - prev.score;
        }
      }
      return { ...ath, rankDelta, scoreDelta };
    });

    if (state.selectedNation !== 'ALL') {
      list = list.filter(a => a.nation === state.selectedNation);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(a => (a.name && a.name.toLowerCase().includes(q)) || (a.nation && a.nation.toLowerCase().includes(q)));
    }

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500 text-xs">Keine Athleten gefunden.</td></tr>';
      return;
    }

    list.forEach(ath => {
      const isMe = ath.name.toLowerCase().includes('herden');
      const isGerman = ath.nation === 'GER';
      const isExpanded = state.expandedRowId === ath.id;

      let wowBadge = '<span class="text-slate-600 font-mono text-[10px]">-</span>';
      if (ath.rankDelta !== null && ath.rankDelta !== undefined) {
        const ptsTxt = ath.scoreDelta !== null && ath.scoreDelta !== undefined && ath.scoreDelta !== 0
          ? ` (${ath.scoreDelta > 0 ? '+' : ''}${ath.scoreDelta})`
          : '';
        if (ath.rankDelta > 0) {
          wowBadge = `<span class="text-emerald-400 font-bold font-mono text-[10px]" title="Aufstieg um ${ath.rankDelta} Plätze">▲ +${ath.rankDelta}${ptsTxt}</span>`;
        } else if (ath.rankDelta < 0) {
          wowBadge = `<span class="text-rose-400 font-bold font-mono text-[10px]" title="Abstieg um ${Math.abs(ath.rankDelta)} Plätze">▼ ${Math.abs(ath.rankDelta)}${ptsTxt}</span>`;
        } else {
          wowBadge = `<span class="text-slate-400 font-mono text-[10px]">±0${ptsTxt}</span>`;
        }
      }

      const tr = document.createElement('tr');
      tr.className = `cursor-pointer transition-colors border-b border-slate-800/40 ${
        isExpanded ? 'bg-slate-800/80' : isMe ? 'bg-cyan-950/40 hover:bg-cyan-950/60 border-l-4 border-l-cyan-400' : isGerman ? 'bg-cyan-950/20 hover:bg-cyan-950/30 border-l-2 border-l-cyan-600' : 'hover:bg-slate-900/60'
      }`;

      tr.onclick = (e) => {
        // Toggle inline expansion on tr click
        state.expandedRowId = state.expandedRowId === ath.id ? null : ath.id;
        renderTable(state);
      };

      tr.innerHTML = `
        <td class="py-2.5 px-3 text-center">
          <span class="font-bold text-slate-200">#${ath.originalRank}</span>
          <div class="mt-0.5">${wowBadge}</div>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-white uppercase tracking-tight text-xs">${ath.name}</span>
            ${isMe ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">YOU</span>' : ''}
            ${!isMe && isGerman ? '<span class="px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold text-[9px] font-mono">GER</span>' : ''}
          </div>
          <span class="text-[10px] text-slate-500 font-mono">${ath.dob || '-'}</span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-300 text-[10px]">${ath.nation}</span>
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-cyan-400 text-xs">
          ${ath.sb ? ath.sb.toFixed(2) + 'm' : '-'}
        </td>
        <td class="py-2.5 px-3 text-right">
          <span class="font-black text-amber-400 font-mono text-sm">${ath.totalScore}</span>
          <span class="text-[9px] text-slate-500 font-mono block">PKT</span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
            (ath.countingMeetings || []).length >= 5 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }">
            ${(ath.countingMeetings || []).length}/5 Meets
          </span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="event.stopPropagation(); RankingsModule.openCompetitorModal('${ath.name}')" class="px-2 py-1 rounded bg-slate-950 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-cyan-400 font-mono text-[10px] font-bold transition-all shadow-sm">
            Vergleich ⚖️
          </button>
        </td>
      `;
      tbody.appendChild(tr);

      // Expanded Meetings Row
      if (isExpanded) {
        const accTr = document.createElement('tr');
        accTr.className = 'bg-slate-950/90 border-b border-slate-800';

        const athRowSort = athleteTableSorts[ath.name] || 'date';
        const sortedMeets = sortAthleteCompetitions(ath.countingMeetings || [], athRowSort);

        let meetsHtml = '';
        if (sortedMeets && sortedMeets.length > 0) {
          meetsHtml = sortedMeets.map(m => `
            <tr class="hover:bg-slate-900/50">
              <td class="py-1.5 px-2 text-slate-400 whitespace-nowrap">${m.date || '-'}</td>
              <td class="py-1.5 px-2 text-slate-200 font-sans font-medium text-xs">
                <span>${m.competition || '-'}</span>
                ${m.remark ? `<span class="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">${m.remark}</span>` : ''}
              </td>
              <td class="py-1.5 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 border border-slate-700 text-cyan-300">${m.category || '-'}</span></td>
              <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${m.mark}m</td>
              <td class="py-1.5 px-2 text-center">${formatWindBadge(m.wind)}</td>
              <td class="py-1.5 px-2 text-center text-slate-300">
                ${formatPlaceBadge(m)}
              </td>
              <td class="py-1.5 px-2 text-right text-slate-300">${m.result_score || '-'}</td>
              <td class="py-1.5 px-2 text-right text-slate-300">${m.placing_score || '-'}</td>
              <td class="py-1.5 px-2 text-right font-black text-amber-400 text-xs">${m.performance_score} Pkt</td>
            </tr>
          `).join('');
        } else {
          meetsHtml = '<tr><td colspan="9" class="py-3 text-center text-slate-500 italic">Keine detaillierten Meeting-Ergebnisse verfügbar</td></tr>';
        }

        accTr.innerHTML = `
          <td colspan="7" class="p-3">
            <div class="bg-slate-900 rounded-lg border border-slate-800 p-3 shadow-md">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>📊 Gewertete Meetings für ${ath.name}</span>
                  </h4>
                  <div class="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
                    <span class="text-slate-500">Sortieren:</span>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'date')" class="px-1.5 py-0.2 rounded ${athRowSort.startsWith('date') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Datum ${athRowSort === 'date-asc' ? '▲' : '▼'}</button>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'mark')" class="px-1.5 py-0.2 rounded ${athRowSort.startsWith('mark') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Weite ${athRowSort === 'mark-asc' ? '▲' : '▼'}</button>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'score')" class="px-1.5 py-0.2 rounded ${athRowSort.startsWith('score') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Score ${athRowSort === 'score-asc' ? '▲' : '▼'}</button>
                  </div>
                </div>
                <button onclick="event.stopPropagation(); RankingsModule.openCompetitorModal('${ath.name.replace(/'/g, "\\'")}')" class="text-cyan-400 hover:text-cyan-300 font-mono text-[10px] font-bold underline">
                  Im direkten Vergleich mit Luka öffnen ↗
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr class="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th class="py-1.5 px-2 cursor-pointer hover:text-white select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'date')">
                        Datum ${athRowSort.startsWith('date') ? (athRowSort === 'date-asc' ? '▲' : '▼') : '↕'}
                      </th>
                      <th class="py-1.5 px-2">Wettkampf</th>
                      <th class="py-1.5 px-2 text-center">Kat.</th>
                      <th class="py-1.5 px-2 text-right cursor-pointer hover:text-white select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'mark')">
                        Weite ${athRowSort.startsWith('mark') ? (athRowSort === 'mark-asc' ? '▲' : '▼') : '↕'}
                      </th>
                      <th class="py-1.5 px-2 text-center">Wind</th>
                      <th class="py-1.5 px-2 text-center">Pl.</th>
                      <th class="py-1.5 px-2 text-right">Result</th>
                      <th class="py-1.5 px-2 text-right">Platz</th>
                      <th class="py-1.5 px-2 text-right font-bold text-white cursor-pointer hover:text-cyan-400 select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteRowSort('${encodeURIComponent(ath.name)}', 'score')">
                        Gesamt ${athRowSort.startsWith('score') ? (athRowSort === 'score-asc' ? '▲' : '▼') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/40">${meetsHtml}</tbody>
                </table>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(accTr);
      }
    });
  }

  function renderCompactHistoryChart(state) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;

    const snapshots = (state.rankingsArchive && state.rankingsArchive.snapshots) || [];
    let historyData = [];

    if (snapshots.length > 0) {
      // Exclude future prognosis snapshots from the historical career progression chart!
      let filtered = snapshots.filter(s => !s.is_prognosis && (s.date || '') <= '2026-10-02');

      if (selectedHistoryInterval === 'YTD') {
        filtered = filtered.filter(s => (s.date || '') >= '2026-01-01');
      } else if (selectedHistoryInterval === '1Y') {
        filtered = filtered.filter(s => (s.date || '') >= '2025-09-28');
      } else if (selectedHistoryInterval === '3Y') {
        filtered = filtered.filter(s => (s.date || '') >= '2023-09-28');
      }

      historyData = filtered.map(s => {
        const parts = (s.date || '').split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0].slice(2)}` : s.date;
        return {
          date: shortDate,
          fullDate: s.displayDate || s.date,
          rank: s.lukaRank || 100,
          score: s.lukaScore || 1100
        };
      });
    }

    if (historyData.length === 0) {
      historyData = [
        { date: '20.06.23', fullDate: '20.06.2023', rank: 100, score: 1116 },
        { date: '12.06.24', fullDate: '12.06.2024', rank: 39, score: 1186 },
        { date: '29.07.25', fullDate: '29.07.2025', rank: 35, score: 1192 },
        { date: '03.02.26', fullDate: '03.02.2026', rank: 26, score: 1194 },
        { date: '15.09.26', fullDate: '15.09.2026', rank: 70, score: 1144 }
      ];
    }

    const labels = historyData.map(d => d.date);
    const ranks = historyData.map(d => d.rank);
    const scores = historyData.map(d => d.score);

    const minRank = Math.max(1, ranks.reduce((min, r) => Math.min(min, r), 100) - 5);
    const maxRank = Math.min(105, ranks.reduce((max, r) => Math.max(max, r), 1) + 5);

    const minScore = scores.reduce((min, s) => Math.min(min, s), 1100) - 15;
    const maxScore = scores.reduce((max, s) => Math.max(max, s), 1200) + 15;

    if (rankChartInstance) rankChartInstance.destroy();

    rankChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'World Ranking Position (Invertiert)',
            data: ranks,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            borderWidth: 2,
            pointRadius: historyData.length > 50 ? 1.5 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#06b6d4',
            yAxisID: 'yRank',
            tension: 0.25
          },
          {
            label: 'Ranking Score (Punkte)',
            data: scores,
            borderColor: '#f59e0b',
            borderWidth: 1.8,
            borderDash: [3, 3],
            pointRadius: historyData.length > 50 ? 1 : 2.5,
            pointHoverRadius: 4,
            yAxisID: 'yScore',
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          yRank: {
            position: 'left',
            reverse: true, // Higher rank is visually higher!
            min: minRank,
            max: maxRank,
            grid: { color: '#1e293b' },
            ticks: {
              color: '#06b6d4',
              callback: v => '#' + v
            }
          },
          yScore: {
            position: 'right',
            min: minScore,
            max: maxScore,
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#f59e0b',
              callback: v => v + ' Pkt'
            }
          },
          x: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#94a3b8',
              font: { size: 9 },
              maxTicksLimit: 14
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const item = historyData[items[0].dataIndex];
                return item ? item.fullDate : '';
              },
              label: (ctx) => {
                if (ctx.datasetIndex === 0) {
                  return `World Ranking: #${ctx.parsed.y}`;
                } else {
                  return `Punkte: ${ctx.parsed.y} Pkt`;
                }
              }
            }
          }
        }
      }
    });
  }

  function openCompetitorModal(athleteName, updateSortButtons = true) {
    const modal = document.getElementById('competitorModal');
    if (!modal) return;
    currentModalAthleteName = athleteName;

    // Find in athletes database first (contains full 27-38 career competitions) or state.athletes
    let target = null;
    const cleanQuery = athleteName.toLowerCase().trim();
    const db = (window.App && window.App.state && window.App.state.athletesDatabase) || null;
    if (db && db.athletes) {
      target = db.athletes.find(a => {
        const aName = a.name.toLowerCase();
        return aName === cleanQuery || aName.includes(cleanQuery) || cleanQuery.includes(aName);
      });
    }

    const stateAthletes = (window.App && window.App.state && window.App.state.athletes) || [];
    const stateTarget = stateAthletes.find(a => {
      const aName = a.name.toLowerCase();
      return aName === cleanQuery || aName.includes(cleanQuery) || cleanQuery.includes(aName);
    });

    if (!target && stateTarget) {
      target = stateTarget;
    } else if (target && stateTarget) {
      target = {
        ...target,
        rank: stateTarget.originalRank || target.rank,
        ranking_score: stateTarget.totalScore || target.ranking_score,
        sb: stateTarget.sb || target.sb,
        counted_competitions: (target.counted_competitions && target.counted_competitions.length >= (stateTarget.countingMeetings || []).length)
          ? target.counted_competitions
          : (stateTarget.countingMeetings || target.counted_competitions || [])
      };
    }

    if (!target) return;

    const me = (window.App && window.App.state && window.App.state.athletes && window.App.state.athletes.find(a => a.name.toLowerCase().includes('herden')));
    const lukaScore = me ? me.totalScore : 1144;
    const lukaRank = me ? me.originalRank : 69;
    const athScore = parseInt(target.ranking_score || target.totalScore || target.latest_score || 0);
    const athRank = parseInt(target.rank || target.originalRank || target.latest_rank || 0);
    const scoreDiff = athScore - lukaScore;
    const rankDiff = lukaRank - athRank;

    document.getElementById('modalAthRank').textContent = '#' + athRank;
    document.getElementById('modalAthName').textContent = target.name;
    document.getElementById('modalAthCountry').textContent = target.country || target.nation || '';
    
    const peakTxt = target.peak_rank ? ` • Peak: #${target.peak_rank} (${target.peak_score || 0} Pkt)` : '';
    const weeksTxt = target.weeks_in_top100 ? ` • ${target.weeks_in_top100} Wo. Top 100` : '';
    document.getElementById('modalAthDob').textContent = `DOB: ${target.dob || '-'} • Score: ${athScore} Pkt${peakTxt}${weeksTxt}`;

    const diffRankEl = document.getElementById('modalDiffRank');
    if (diffRankEl) {
      if (rankDiff > 0) {
        diffRankEl.innerHTML = `<span class="text-rose-400 font-bold">${rankDiff} Ränge vor Luka</span>`;
      } else if (rankDiff < 0) {
        diffRankEl.innerHTML = `<span class="text-emerald-400 font-bold">${Math.abs(rankDiff)} Ränge hinter Luka</span>`;
      } else {
        diffRankEl.innerHTML = `<span class="text-cyan-400 font-bold">Gleichauf (#${lukaRank})</span>`;
      }
    }

    const diffScoreEl = document.getElementById('modalDiffScore');
    if (diffScoreEl) {
      diffScoreEl.innerHTML = scoreDiff >= 0
        ? `<span class="text-amber-400 font-bold">+${scoreDiff} Pkt</span>`
        : `<span class="text-emerald-400 font-bold">${scoreDiff} Pkt</span>`;
    }

    const sbEl = document.getElementById('modalAthSb');
    if (sbEl) {
      sbEl.textContent = target.sb ? `${target.sb.toFixed(2)}m` : '-';
    }

    // Populate competitions
    const compTitle = document.getElementById('modalCompetitionsTitle');
    const compBody = document.getElementById('modalCompetitionsBody');
    const rawComps = target.counted_competitions || target.countingMeetings || [];
    const comps = sortAthleteCompetitions(rawComps, currentModalSort);
    
    if (compTitle) {
      compTitle.textContent = `🏆 ERFASSTE WETTKÄMPFE (${comps.length} Wettkämpfe in der WA-Datenbank)`;
    }

    if (updateSortButtons) {
      ['date', 'mark', 'score'].forEach(k => {
        const btn = document.getElementById('modalSort' + k.charAt(0).toUpperCase() + k.slice(1) + 'Btn');
        if (btn) {
          if (k === currentModalSort) {
            btn.className = 'px-2 py-0.5 rounded bg-cyan-900 text-cyan-300 font-bold border border-cyan-700 transition-all';
          } else {
            btn.className = 'px-2 py-0.5 rounded bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition-all';
          }
        }
      });
    }

    if (compBody) {
      if (comps.length > 0) {
        compBody.innerHTML = comps.map(c => `
          <tr class="hover:bg-slate-800/40">
            <td class="py-2 px-2.5 text-slate-400 whitespace-nowrap">${c.date || '-'}</td>
            <td class="py-2 px-2.5 text-slate-200 font-sans font-medium text-xs">
              <span>${c.competition || '-'}</span>
              ${c.remark ? `<span class="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">${c.remark}</span>` : ''}
            </td>
            <td class="py-2 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">${c.category || '-'}</span></td>
            <td class="py-2 px-2 text-right font-bold text-cyan-400 text-xs">${c.mark}m</td>
            <td class="py-2 px-2 text-center">${formatWindBadge(c.wind)}</td>
            <td class="py-2 px-2 text-center text-slate-300">${formatPlaceBadge(c)}</td>
            <td class="py-2 px-2 text-right font-black text-amber-400">${c.performance_score || c.result_score || '-'} Pkt</td>
          </tr>
        `).join('');
      } else {
        compBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-500 italic">Keine Meeting-Ergebnisse hinterlegt.</td></tr>';
      }
    }

    const waLink = document.getElementById('modalWaProfileLink');
    if (waLink) {
      waLink.href = target.profile_url || `https://worldathletics.org/athletes/search?q=${encodeURIComponent(target.name)}`;
    }

    modal.classList.remove('hidden');
  }

  function loadMoreAthletes(count = 50) {
    displayedAthletesLimit += count;
    if (window.App && window.App.state) {
      renderAthletesDatabase(window.App.state);
    }
  }

  function showAllAthletes(total) {
    displayedAthletesLimit = total;
    if (window.App && window.App.state) {
      renderAthletesDatabase(window.App.state);
    }
  }

  function loadMoreMeetings(count = 40) {
    displayedMeetingsLimit += count;
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function showAllMeetings(total) {
    displayedMeetingsLimit = total;
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function renderAthletesDatabase(state) {
    const container = document.getElementById('athletesDbContainer');
    const badge = document.getElementById('athletesDbCountBadge');
    if (!container) return;

    const db = state.athletesDatabase;
    if (!db || !db.athletes) {
      container.innerHTML = '<div class="py-12 text-center text-slate-500 font-mono text-xs">Lade Gesamtdatenbank aller Athleten...</div>';
      return;
    }

    let list = [...db.athletes];

    if (athleteSelectedNation !== 'ALL') {
      list = list.filter(a => a.country === athleteSelectedNation);
    }

    if (athleteSearchQuery) {
      const q = athleteSearchQuery.toLowerCase().trim();
      list = list.filter(a => (a.name && a.name.toLowerCase().includes(q)) || (a.country && a.country.toLowerCase().includes(q)));
    }

    // Sort athletes
    list.sort((a, b) => {
      if (athleteSortBy === 'latest_rank') {
        const rA = (a.latest_rank && a.latest_rank <= 100) ? a.latest_rank : 999;
        const rB = (b.latest_rank && b.latest_rank <= 100) ? b.latest_rank : 999;
        if (rA !== rB) return rA - rB;
        return (a.peak_rank || 999) - (b.peak_rank || 999);
      }
      if (athleteSortBy === 'peak_rank') {
        return (a.peak_rank || 999) - (b.peak_rank || 999);
      }
      if (athleteSortBy === 'peak_score') {
        return (b.peak_score || 0) - (a.peak_score || 0);
      }
      if (athleteSortBy === 'best_mark') {
        const mA = parseFloat(a.sb || 0);
        const mB = parseFloat(b.sb || 0);
        return mB - mA;
      }
      if (athleteSortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (athleteSortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (athleteSortBy === 'dob_asc') {
        const dA = parseAthleteDob(a.dob);
        const dB = parseAthleteDob(b.dob);
        return dA - dB;
      }
      if (athleteSortBy === 'dob_desc') {
        const dA = parseAthleteDob(a.dob);
        const dB = parseAthleteDob(b.dob);
        return dB - dA;
      }
      if (athleteSortBy === 'weeks') {
        return (b.weeks_in_top100 || 0) - (a.weeks_in_top100 || 0);
      }
      if (athleteSortBy === 'nation') {
        return (a.country || '').localeCompare(b.country || '');
      }
      return 0;
    });

    if (badge) {
      badge.textContent = `${list.length} von ${db.athletes.length} Athleten`;
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="py-12 text-center text-slate-500 font-mono text-xs">Keine Athleten gefunden für diesen Filter.</div>';
      return;
    }

    const totalAthletes = list.length;
    const slicedAthletes = list.slice(0, displayedAthletesLimit);

    const cardsHtml = slicedAthletes.map(ath => {
      const isLuka = ath.name.toLowerCase().includes('herden');
      const isGerman = ath.country === 'GER';
      const isExpanded = expandedAthleteDbId === ath.id;
      const comps = ath.counted_competitions || [];

      let compsHtml = '';
      if (isExpanded) {
        if (comps.length > 0) {
          const athDbSort = athleteDbSorts[ath.id] || 'date';
          const sortedComps = sortAthleteCompetitions(comps, athDbSort);

          compsHtml = `
            <div class="mt-3 pt-3 border-t border-slate-800/80">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[11px] font-bold text-slate-300 uppercase font-mono">
                    📊 Alle ${comps.length} dokumentierten Wettkämpfe (2023 - 2026)
                  </span>
                  <div class="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
                    <span class="text-slate-500">Sortieren:</span>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'date')" class="px-1.5 py-0.2 rounded ${athDbSort.startsWith('date') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Datum ${athDbSort === 'date-asc' ? '▲' : '▼'}</button>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'mark')" class="px-1.5 py-0.2 rounded ${athDbSort.startsWith('mark') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Weite ${athDbSort === 'mark-asc' ? '▲' : '▼'}</button>
                    <button onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'score')" class="px-1.5 py-0.2 rounded ${athDbSort.startsWith('score') ? 'bg-cyan-900 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400 hover:text-white'}">Score ${athDbSort === 'score-asc' ? '▲' : '▼'}</button>
                  </div>
                </div>
                <button onclick="event.stopPropagation(); RankingsModule.openCompetitorModal('${ath.name.replace(/'/g, "\\'")}')" class="text-cyan-400 hover:text-cyan-300 text-[10px] font-mono font-bold underline">
                  Direkter Vergleich mit Luka ↗
                </button>
              </div>
              <div class="overflow-x-auto border border-slate-800 rounded-lg">
                <table class="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] uppercase">
                      <th class="py-1.5 px-2 cursor-pointer hover:text-white select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'date')">
                        Datum ${athDbSort.startsWith('date') ? (athDbSort === 'date-asc' ? '▲' : '▼') : '↕'}
                      </th>
                      <th class="py-1.5 px-2">Wettkampf / Ort</th>
                      <th class="py-1.5 px-2 text-center">Kat.</th>
                      <th class="py-1.5 px-2 text-right cursor-pointer hover:text-white select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'mark')">
                        Weite ${athDbSort.startsWith('mark') ? (athDbSort === 'mark-asc' ? '▲' : '▼') : '↕'}
                      </th>
                      <th class="py-1.5 px-2 text-center">Wind</th>
                      <th class="py-1.5 px-2 text-center">Pl.</th>
                      <th class="py-1.5 px-2 text-right font-bold text-white cursor-pointer hover:text-cyan-400 select-none" onclick="event.stopPropagation(); RankingsModule.setAthleteDbSort('${encodeURIComponent(ath.id || ath.name)}', 'score')">
                        Score ${athDbSort.startsWith('score') ? (athDbSort === 'score-asc' ? '▲' : '▼') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/40">
                    ${sortedComps.map(c => `
                      <tr class="hover:bg-slate-800/30">
                        <td class="py-1.5 px-2 text-slate-400 whitespace-nowrap">${c.date || '-'}</td>
                        <td class="py-1.5 px-2 text-slate-200 font-sans font-medium text-xs">
                          <span>${c.competition || '-'}</span>
                          ${c.remark ? `<span class="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">${c.remark}</span>` : ''}
                        </td>
                        <td class="py-1.5 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">${c.category || '-'}</span></td>
                        <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${c.mark}m</td>
                        <td class="py-1.5 px-2 text-center">${formatWindBadge(c.wind)}</td>
                        <td class="py-1.5 px-2 text-center text-slate-300">
                          ${formatPlaceBadge(c)}
                        </td>
                        <td class="py-1.5 px-2 text-right font-black text-amber-400">${c.performance_score || '-'} Pkt</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        } else {
          compsHtml = '<div class="mt-2 text-[10px] text-slate-500 italic">Keine Wettkämpfe hinterlegt.</div>';
        }
      }

      return `
        <div class="bg-slate-900 border rounded-xl p-3.5 shadow-sm transition-all ${
          isLuka ? 'border-cyan-500/80 bg-cyan-950/20' : isGerman ? 'border-cyan-800/50 bg-slate-900/90' : 'border-slate-800 hover:border-slate-700'
        }">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div class="flex items-start gap-3">
              <div class="text-center min-w-10">
                <span class="text-xs font-mono font-bold text-slate-400 block uppercase">Rang</span>
                <span class="text-base font-black font-mono ${isLuka ? 'text-cyan-400' : 'text-white'}">#${ath.latest_rank <= 100 ? ath.latest_rank : ath.peak_rank}</span>
              </div>
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-white text-sm uppercase tracking-tight">${ath.name}</span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-300 text-[10px] font-mono">${ath.country}</span>
                  ${isLuka ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">YOU</span>' : ''}
                  ${!isLuka && isGerman ? '<span class="px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold text-[9px] font-mono">GER</span>' : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                  <span class="text-amber-400 font-bold">⭐ Peak: #${ath.peak_rank} (${ath.peak_score} Pkt)</span>
                  <span>•</span>
                  <span>🗓️ ${ath.weeks_in_top100} Wo. Top 100</span>
                  <span>•</span>
                  <span class="text-cyan-300 font-bold">Bestleistung: ${ath.sb ? ath.sb.toFixed(2) + 'm' : '-'}</span>
                  <span>•</span>
                  <span>Geb: ${ath.dob || '-'}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center font-mono">
              <button onclick="RankingsModule.toggleAthleteDbRow('${ath.id}')" class="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1">
                <span>${isExpanded ? 'Ausblenden ▴' : `Wettkämpfe (${comps.length}) ▾`}</span>
              </button>
              <button onclick="RankingsModule.openCompetitorModal('${ath.name}')" class="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-bold transition-all">
                Vergleich ⚖️
              </button>
            </div>
          </div>

          ${compsHtml}
        </div>
      `;
    }).join('');

    const paginationHtml = totalAthletes > displayedAthletesLimit ? `
      <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-sm">
        <div class="text-xs font-mono text-slate-400">
          Zeige <strong class="text-white">${slicedAthletes.length}</strong> von <strong class="text-cyan-400">${totalAthletes}</strong> Athleten
        </div>
        <div class="flex items-center gap-2">
          <button onclick="RankingsModule.loadMoreAthletes(50)" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black font-mono text-xs shadow-md transition-all">
            Mehr anzeigen (+50) ▾
          </button>
          <button onclick="RankingsModule.showAllAthletes(${totalAthletes})" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold font-mono text-xs transition-all">
            Alle ${totalAthletes} anzeigen
          </button>
        </div>
      </div>
    ` : '';

    container.innerHTML = cardsHtml + paginationHtml;
  }

  function setCompetitionsViewMode(mode) {
    competitionsViewMode = mode === 'calendar' ? 'calendar' : 'list';
    const listBtn = document.getElementById('compDbViewListBtn');
    const calBtn = document.getElementById('compDbViewCalBtn');
    if (listBtn && calBtn) {
      if (competitionsViewMode === 'list') {
        listBtn.className = 'px-2.5 py-1 rounded font-bold bg-amber-500 text-slate-950 transition-all';
        calBtn.className = 'px-2.5 py-1 rounded font-bold text-slate-400 hover:text-white transition-all';
      } else {
        calBtn.className = 'px-2.5 py-1 rounded font-bold bg-amber-500 text-slate-950 transition-all';
        listBtn.className = 'px-2.5 py-1 rounded font-bold text-slate-400 hover:text-white transition-all';
      }
    }
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function setCompetitionsYearFilter(year) {
    competitionsYearFilter = year || 'ALL';
    ['ALL', '2026', '2025', '2024', '2023'].forEach(y => {
      const btn = document.getElementById(`compYearBtn${y}`);
      if (!btn) return;
      if (y === competitionsYearFilter) {
        btn.className = 'comp-year-btn px-2 py-0.5 rounded font-bold bg-amber-500 text-slate-950';
      } else {
        btn.className = 'comp-year-btn px-2 py-0.5 rounded text-slate-400 hover:text-white border border-slate-800 bg-slate-950';
      }
    });
    if (competitionsYearFilter !== 'ALL' && !compCalendarYearMonth.startsWith(competitionsYearFilter)) {
      compCalendarYearMonth = `${competitionsYearFilter}-06`;
    }
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function setCompetitionsCalMonth(ym) {
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      compCalendarYearMonth = ym;
      if (window.App && window.App.state) {
        renderMeetingsDatabase(window.App.state);
      }
    }
  }

  function changeCompetitionsCalMonth(delta) {
    const [yStr, mStr] = compCalendarYearMonth.split('-');
    let y = parseInt(yStr, 10) || 2026;
    let m = parseInt(mStr, 10) || 6;
    m += delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    compCalendarYearMonth = `${y}-${String(m).padStart(2, '0')}`;
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function openCompetitionResultsModal(encodedName) {
    const name = decodeURIComponent(encodedName);
    const modal = document.getElementById('competitionResultsModal');
    if (!modal) return;

    const state = (window.App && window.App.state) || {};
    const db = state.competitionsDatabase;
    if (!db || !db.competitions) return;

    const meet = db.competitions.find(c => c.name === name);
    if (!meet) return;

    const catBadge = document.getElementById('compResModalCatBadge');
    const tourBadge = document.getElementById('compResModalTourBadge');
    const titleEl = document.getElementById('compResModalTitle');
    const subEl = document.getElementById('compResModalSub');
    const bestMarkEl = document.getElementById('compResModalBestMark');
    const countEl = document.getElementById('compResModalCount');
    const topScoreEl = document.getElementById('compResModalTopScore');
    const tbody = document.getElementById('compResModalTableBody');

    if (catBadge) {
      catBadge.textContent = `KAT. ${meet.category || '-'}`;
    }
    if (tourBadge) {
      if (meet.tour_label) {
        tourBadge.textContent = meet.tour_label;
        tourBadge.classList.remove('hidden');
      } else {
        tourBadge.classList.add('hidden');
      }
    }
    if (titleEl) titleEl.textContent = meet.name || '-';

    const isoDate = getMeetingIsoDate(meet);
    const dispDate = isoDate
      ? isoDate.split('-').reverse().join('.')
      : ((meet.dates_seen || []).join(', ') || '-');
    if (subEl) {
      subEl.textContent = `📅 ${dispDate} • 📍 ${meet.venue || '-'} • ${meet.indoor ? 'Indoor (Halle)' : 'Outdoor (Freiluft)'}`;
    }

    const results = [...(meet.results || [])];
    results.sort((a, b) => {
      const mA = cleanFloatMark(a.mark);
      const mB = cleanFloatMark(b.mark);
      if (mB !== mA) return mB - mA;
      return (b.performance_score || 0) - (a.performance_score || 0);
    });

    const topMark = getMeetingTopMark(meet);
    const topScore = results.reduce((max, r) => Math.max(max, parseInt(r.performance_score || 0, 10) || 0), 0);

    if (bestMarkEl) bestMarkEl.textContent = topMark > 0 ? `${topMark.toFixed(2)}m` : '-';
    if (countEl) countEl.textContent = `${results.length} Athleten`;
    if (topScoreEl) topScoreEl.textContent = topScore > 0 ? `${topScore} Pkt` : '-';

    if (tbody) {
      if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500">Keine Einzelergebnisse hinterlegt.</td></tr>';
      } else {
        tbody.innerHTML = results.map((r, idx) => {
          const isMe = r.athlete && r.athlete.toLowerCase().includes('herden');
          const isGer = r.country === 'GER';
          const placeStr = r.place || `${idx + 1}.`;
          const scoreStr = r.performance_score ? `${r.performance_score} Pkt` : '-';
          return `
            <tr class="hover:bg-slate-800/40 ${isMe ? 'bg-cyan-950/40 font-bold text-cyan-300' : ''}">
              <td class="py-2 px-3 text-center font-bold text-slate-300">${placeStr}</td>
              <td class="py-2 px-3 font-bold text-white">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <button onclick="document.getElementById('competitionResultsModal').classList.add('hidden'); RankingsModule.openCompetitorModal('${(r.athlete || '').replace(/'/g, "\\'")}');" class="hover:text-cyan-400 hover:underline text-left uppercase">
                    ${r.athlete || '-'}
                  </button>
                  ${isMe ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">YOU</span>' : ''}
                  ${!isMe && isGer ? '<span class="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold text-[9px] font-mono">GER</span>' : ''}
                  ${r.round === 'Qualifikation' ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">Quali</span>' : ''}
                </div>
              </td>
              <td class="py-2 px-2 text-center">
                <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-300 text-[10px]">${r.country || '-'}</span>
              </td>
              <td class="py-2 px-3 text-right font-bold text-cyan-400">${r.mark}m</td>
              <td class="py-2 px-2 text-center">${formatWindBadge(r.wind)}</td>
              <td class="py-2 px-3 text-right font-black text-amber-400">${scoreStr}</td>
            </tr>
          `;
        }).join('');
      }
    }

    modal.classList.remove('hidden');
  }

  function renderMeetingsCalendarView(list, totalDbCount) {
    const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    // Collect available year-months across filtered list
    const ymCounts = {};
    list.forEach(m => {
      const iso = getMeetingIsoDate(m);
      if (iso && iso.length >= 7) {
        const ym = iso.slice(0, 7);
        ymCounts[ym] = (ymCounts[ym] || 0) + 1;
      }
    });

    const availableYMs = Object.keys(ymCounts).sort().reverse();
    if (availableYMs.length > 0 && !ymCounts[compCalendarYearMonth]) {
      compCalendarYearMonth = availableYMs[0];
    }

    const [yStr, mStr] = compCalendarYearMonth.split('-');
    const year = parseInt(yStr, 10) || 2026;
    const month = parseInt(mStr, 10) || 6; // 1..12

    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Monday = 0 .. Sunday = 6
    const startWeekday = (firstDay.getDay() + 6) % 7;

    // Group meetings in this month by day
    const dayMap = {};
    const monthMeetings = [];
    list.forEach(m => {
      const iso = getMeetingIsoDate(m);
      if (iso && iso.startsWith(compCalendarYearMonth)) {
        const dNum = parseInt(iso.slice(8, 10), 10);
        if (!dayMap[dNum]) dayMap[dNum] = [];
        dayMap[dNum].push(m);
        monthMeetings.push(m);
      }
    });

    const quickMonthChips = availableYMs.slice(0, 14).map(ym => {
      const [yy, mm] = ym.split('-');
      const shortM = MONTH_NAMES[parseInt(mm, 10) - 1].slice(0, 3);
      const isAct = ym === compCalendarYearMonth;
      return `
        <button onclick="RankingsModule.setCompetitionsCalMonth('${ym}')" class="px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
          isAct
            ? 'bg-amber-500 text-slate-950 shadow-sm'
            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
        }">
          ${shortM} ${yy.slice(2)} <span class="opacity-75">(${ymCounts[ym]})</span>
        </button>
      `;
    }).join('');

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) {
      cellsHtml += `<div class="min-h-[88px] bg-slate-950/30 border border-slate-800/40 rounded-lg p-1.5 opacity-40"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayMeets = dayMap[day] || [];
      const pillsHtml = dayMeets.map(m => {
        const enc = encodeURIComponent(m.name);
        const hasLuka = (m.results || []).some(r => r.athlete && r.athlete.toLowerCase().includes('herden'));
        const topM = getMeetingTopMark(m);
        let colorCls = 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400';
        if (hasLuka) {
          colorCls = 'bg-cyan-950/90 border-cyan-500 text-cyan-200 hover:bg-cyan-900';
        } else if (['OW', 'GL', 'GW', 'A'].includes(m.category)) {
          colorCls = 'bg-amber-950/80 border-amber-600/80 text-amber-200 hover:bg-amber-900';
        } else if (m.category === 'B') {
          colorCls = 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200 hover:bg-emerald-900';
        }
        return `
          <button onclick="RankingsModule.openCompetitionResultsModal('${enc}')" class="w-full text-left px-1.5 py-1 rounded border text-[9px] font-mono leading-tight transition-all truncate ${colorCls}" title="${m.name} (${m.venue || '-'}) • Top: ${topM ? topM.toFixed(2) + 'm' : '-'}">
            <span class="font-black">[${m.category || '-'}]</span> ${m.name}
          </button>
        `;
      }).join('');

      cellsHtml += `
        <div class="min-h-[92px] bg-slate-950/80 border ${dayMeets.length > 0 ? 'border-slate-700' : 'border-slate-800/60'} rounded-lg p-1.5 flex flex-col justify-between">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-mono font-bold ${dayMeets.length > 0 ? 'text-white' : 'text-slate-600'}">${String(day).padStart(2, '0')}.</span>
            ${dayMeets.length > 0 ? `<span class="text-[9px] font-mono text-amber-400 font-bold">${dayMeets.length} WK</span>` : ''}
          </div>
          <div class="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
            ${pillsHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <button onclick="RankingsModule.changeCompetitionsCalMonth(-1)" class="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold">◀</button>
            <h3 class="text-sm sm:text-base font-black text-white font-mono min-w-[160px] text-center">
              📅 ${MONTH_NAMES[month - 1]} ${year}
            </h3>
            <button onclick="RankingsModule.changeCompetitionsCalMonth(1)" class="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold">▶</button>
          </div>
          <span class="text-xs font-mono text-amber-400 font-bold">
            ${monthMeetings.length} Wettkämpfe im ${MONTH_NAMES[month - 1]} ${year} (Klick öffnet Ergebnisse)
          </span>
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <span class="text-[10px] font-mono text-slate-500 uppercase font-bold mr-1 shrink-0">Monate mit WK:</span>
          ${quickMonthChips}
        </div>

        <div class="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] font-bold text-slate-400 uppercase pt-1">
          <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
          ${cellsHtml}
        </div>
      </div>
    `;
  }

  function renderMeetingsDatabase(state) {
    const container = document.getElementById('meetingsDbContainer');
    const badge = document.getElementById('meetingsDbCountBadge');
    if (!container) return;

    const db = state.competitionsDatabase;
    if (!db || !db.competitions) {
      container.innerHTML = '<div class="py-12 text-center text-slate-500 font-mono text-xs">Lade Wettkampf-Archiv...</div>';
      return;
    }

    let list = [...db.competitions];

    if (meetingSelectedCategory !== 'ALL') {
      if (meetingSelectedCategory === 'GL') {
        list = list.filter(c => ['OW', 'GL', 'GW', 'DL'].includes(c.category));
      } else {
        list = list.filter(c => c.category === meetingSelectedCategory);
      }
    }

    if (competitionsYearFilter !== 'ALL') {
      list = list.filter(c => {
        const iso = getMeetingIsoDate(c);
        return iso && iso.startsWith(competitionsYearFilter);
      });
    }

    if (meetingSearchQuery) {
      const q = meetingSearchQuery.toLowerCase().trim();
      list = list.filter(c => {
        const nameMatch = c.name && c.name.toLowerCase().includes(q);
        const venueMatch = c.venue && c.venue.toLowerCase().includes(q);
        const tourMatch = c.tour_label && c.tour_label.toLowerCase().includes(q);
        const athMatch = (c.results || []).some(r => r.athlete && r.athlete.toLowerCase().includes(q));
        return nameMatch || venueMatch || tourMatch || athMatch;
      });
    }

    // Sort meetings (Chronological newest first by default)
    const CAT_WEIGHT = { 'OW': 10, 'GL': 9, 'GW': 8, 'DF': 7, 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1 };
    list.sort((a, b) => {
      if (meetingSortBy === 'density') {
        const countA = (a.results || []).length;
        const countB = (b.results || []).length;
        if (countA !== countB) return countB - countA;
        return (CAT_WEIGHT[b.category] || 0) - (CAT_WEIGHT[a.category] || 0);
      }
      if (meetingSortBy === 'category') {
        const cA = CAT_WEIGHT[a.category] || 0;
        const cB = CAT_WEIGHT[b.category] || 0;
        if (cA !== cB) return cB - cA;
        return getMeetingSortDate(b, true) - getMeetingSortDate(a, true);
      }
      if (meetingSortBy === 'date_asc') {
        const dA = getMeetingSortDate(a, false);
        const dB = getMeetingSortDate(b, false);
        return dA - dB;
      }
      if (meetingSortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (meetingSortBy === 'top_mark') {
        const mA = getMeetingTopMark(a);
        const mB = getMeetingTopMark(b);
        return mB - mA;
      }
      // Default: date_desc (chronological newest first)
      const dA = getMeetingSortDate(a, true);
      const dB = getMeetingSortDate(b, true);
      return dB - dA;
    });

    if (badge) {
      badge.textContent = `${list.length} von ${db.competitions.length} Meetings`;
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="py-12 text-center text-slate-500 font-mono text-xs">Keine Wettkämpfe gefunden für diesen Filter.</div>';
      return;
    }

    if (competitionsViewMode === 'calendar') {
      container.innerHTML = renderMeetingsCalendarView(list, db.competitions.length);
      return;
    }

    const totalMeetings = list.length;
    const slicedMeetings = list.slice(0, displayedMeetingsLimit);

    const cardsHtml = slicedMeetings.map(meet => {
      const isExpanded = expandedMeetingDbName === meet.name || list.length <= 3;
      const results = meet.results || [];
      const hasLuka = results.some(r => r.athlete && r.athlete.toLowerCase().includes('herden'));
      const isoDate = getMeetingIsoDate(meet);
      const dispDate = isoDate
        ? isoDate.split('-').reverse().join('.')
        : ((meet.dates_seen || [])[0] || '-');
      const topMark = getMeetingTopMark(meet);
      const encodedName = encodeURIComponent(meet.name);

      let resultsHtml = '';
      if (isExpanded && results.length > 0) {
        resultsHtml = `
          <div class="mt-3 pt-3 border-t border-slate-800">
            <div class="overflow-x-auto border border-slate-800 rounded-lg">
              <table class="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <th class="py-1.5 px-2 text-center w-12">Platz</th>
                    <th class="py-1.5 px-2.5">Athlet</th>
                    <th class="py-1.5 px-2 text-center">Nation</th>
                    <th class="py-1.5 px-2 text-right">Weite</th>
                    <th class="py-1.5 px-2 text-center">Wind</th>
                    <th class="py-1.5 px-2 text-right font-bold text-white">WA Score</th>
                    <th class="py-1.5 px-2 text-center">Aktion</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/40">
                  ${results.map((r, idx) => {
                    const isMe = r.athlete && r.athlete.toLowerCase().includes('herden');
                    const isGer = r.country === 'GER';
                    return `
                      <tr class="hover:bg-slate-800/30 ${isMe ? 'bg-cyan-950/40 font-bold text-cyan-300' : ''}">
                        <td class="py-1.5 px-2 text-center font-bold text-slate-300">${r.place || (idx + 1) + '.'}</td>
                        <td class="py-1.5 px-2.5 font-bold uppercase tracking-tight text-white flex items-center gap-1.5 flex-wrap">
                          <span>${r.athlete}</span>
                          ${isMe ? '<span class="px-1 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">YOU</span>' : ''}
                          ${!isMe && isGer ? '<span class="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold text-[9px] font-mono">GER</span>' : ''}
                          ${r.remark ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">${r.remark}</span>` : ''}
                          ${r.round === 'Qualifikation' && !r.remark ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">Qualifikation</span>` : ''}
                        </td>
                        <td class="py-1.5 px-2 text-center">
                          <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-300 text-[10px]">${r.country || '-'}</span>
                        </td>
                        <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${r.mark}m</td>
                        <td class="py-1.5 px-2 text-center">${formatWindBadge(r.wind)}</td>
                        <td class="py-1.5 px-2 text-right font-black text-amber-400 text-xs">${r.performance_score ? r.performance_score + ' Pkt' : '-'}</td>
                        <td class="py-1.5 px-2 text-center">
                          <button onclick="RankingsModule.openCompetitorModal('${(r.athlete || '').replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded bg-slate-950 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-cyan-400 font-mono text-[10px] font-bold transition-all">
                            Profil ↗
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      return `
        <div class="bg-slate-900 border rounded-xl p-3.5 shadow-sm transition-all ${
          hasLuka ? 'border-cyan-500/70 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'
        }">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="cursor-pointer group" onclick="RankingsModule.openCompetitionResultsModal('${encodedName}')">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-slate-950 text-amber-400 border border-slate-800">
                  📅 ${dispDate}
                </span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-cyan-300 border border-slate-700">
                  Kat. ${meet.category || '-'}
                </span>
                ${meet.tour_label ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-800/70">${meet.tour_label}</span>` : ''}
                <h3 class="font-bold text-white group-hover:text-cyan-400 transition-colors text-sm font-sans tracking-tight">${meet.name}</h3>
                ${meet.indoor ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">Indoor</span>' : ''}
                ${hasLuka ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">MIT LUKA</span>' : ''}
              </div>
              <p class="text-[11px] text-slate-400 font-mono mt-1">
                📍 ${meet.venue || '-'} ${topMark > 0 ? `• Sieger/Top: <strong class="text-emerald-400">${topMark.toFixed(2)}m</strong>` : ''}
              </p>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center font-mono">
              <span class="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-bold text-amber-400">
                ${results.length} Springer
              </span>
              <button onclick="RankingsModule.openCompetitionResultsModal('${encodedName}')" class="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold transition-all">
                Ergebnisse ↗
              </button>
              <button onclick="RankingsModule.toggleMeetingDbRow('${encodedName}')" class="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all" title="Inline ausklappen">
                ${isExpanded ? '▴' : '▾'}
              </button>
            </div>
          </div>

          ${resultsHtml}
        </div>
      `;
    }).join('');

    const paginationHtml = totalMeetings > displayedMeetingsLimit ? `
      <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-sm">
        <div class="text-xs font-mono text-slate-400">
          Zeige <strong class="text-white">${slicedMeetings.length}</strong> von <strong class="text-amber-400">${totalMeetings}</strong> Meetings (Chronologisch)
        </div>
        <div class="flex items-center gap-2">
          <button onclick="RankingsModule.loadMoreMeetings(40)" class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono text-xs shadow-md transition-all">
            Mehr anzeigen (+40) ▾
          </button>
          <button onclick="RankingsModule.showAllMeetings(${totalMeetings})" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold font-mono text-xs transition-all">
            Alle ${totalMeetings} anzeigen
          </button>
        </div>
      </div>
    ` : '';

    container.innerHTML = cardsHtml + paginationHtml;
  }

  function toggleAthleteDbRow(id) {
    expandedAthleteDbId = expandedAthleteDbId === id ? null : id;
    if (window.App && window.App.state) {
      renderAthletesDatabase(window.App.state);
    }
  }

  function toggleMeetingDbRow(encodedName) {
    const name = decodeURIComponent(encodedName);
    expandedMeetingDbName = expandedMeetingDbName === name ? null : name;
    if (window.App && window.App.state) {
      renderMeetingsDatabase(window.App.state);
    }
  }

  function searchAthleteDirect(name) {
    if (window.App && window.App.state) {
      switchSubTab(window.App.state, 'athletes');
      const input = document.getElementById('athleteDbSearchInput');
      if (input) {
        input.value = name;
        athleteSearchQuery = name;
        renderAthletesDatabase(window.App.state);
      }
    }
  }

  function searchMeetingDirect(name) {
    if (window.App && window.App.state) {
      switchSubTab(window.App.state, 'meetings');
      const input = document.getElementById('meetingsDbSearchInput');
      if (input) {
        input.value = name;
        meetingSearchQuery = name;
        renderMeetingsDatabase(window.App.state);
      }
    }
  }

  function openGermanAthletesModal() {
    const modal = document.getElementById('germanAthletesModal');
    const body = document.getElementById('germanAthletesModalBody');
    if (!modal || !body) return;

    const state = (window.App && window.App.state) || {};
    const stateAthletes = state.athletes || [];
    const dbAthletes = (state.athletesDatabase && state.athletesDatabase.athletes) || [];

    // Filter German athletes from state.athletes or athletesDatabase
    let gers = stateAthletes.filter(a => a.nation === 'GER' || a.country === 'GER');
    if (gers.length === 0 && dbAthletes.length > 0) {
      gers = dbAthletes.filter(a => a.country === 'GER' || a.nation === 'GER').map(a => ({
        originalRank: a.rank,
        name: a.name,
        nation: 'GER',
        totalScore: a.ranking_score || a.total_score,
        sb: a.sb
      }));
    }

    // Sort by rank ascending
    gers.sort((a, b) => (a.originalRank || 999) - (b.originalRank || 999));

    const me = gers.find(a => a.name.toLowerCase().includes('herden')) || { originalRank: 70, totalScore: 1144 };
    const lukaScore = me.totalScore || 1144;

    body.innerHTML = gers.map(ath => {
      const isLuka = ath.name.toLowerCase().includes('herden');
      const diffScore = (ath.totalScore || 0) - lukaScore;

      let diffBadge = '';
      if (isLuka) {
        diffBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-800">DU (LUKA)</span>';
      } else if (diffScore > 0) {
        diffBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800">+${diffScore} Pkt vor dir</span>`;
      } else {
        diffBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">${diffScore} Pkt hinter dir</span>`;
      }

      return `
        <div class="bg-slate-950 border ${isLuka ? 'border-cyan-500/80 shadow-md shadow-cyan-950' : 'border-slate-800 hover:border-slate-700'} rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-cyan-400">
              #${ath.originalRank || '-'}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm font-sans">${ath.name}</span>
                <span class="text-xs">🇩🇪</span>
                ${isLuka ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500 text-slate-950">DU</span>' : ''}
              </div>
              <div class="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Score: <strong class="text-white">${ath.totalScore || '-'} Pkt</strong></span>
                <span>•</span>
                <span>SB: <strong class="text-cyan-300">${ath.sb ? ath.sb.toFixed(2) + 'm' : '-'}</strong></span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            ${diffBadge}
            <button onclick="document.getElementById('germanAthletesModal').classList.add('hidden'); RankingsModule.openCompetitorModal('${ath.name.replace(/'/g, "\\'")}');" class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-cyan-300 hover:text-white text-xs font-mono font-bold transition-all shadow-sm flex items-center gap-1">
              <span>Profil & WK</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    modal.classList.remove('hidden');
  }

  return {
    render,
    setHistoryInterval,
    openCompetitorModal,
    openGermanAthletesModal,
    setModalAthleteSort,
    setAthleteRowSort,
    setAthleteDbSort,
    toggleAthleteDbRow,
    toggleMeetingDbRow,
    searchAthleteDirect,
    searchMeetingDirect,
    loadMoreAthletes,
    showAllAthletes,
    loadMoreMeetings,
    showAllMeetings,
    selectPrognosisDate,
    simulateNewMeeting,
    renderPrognosisCard,
    setCompetitionsViewMode,
    setCompetitionsYearFilter,
    setCompetitionsCalMonth,
    changeCompetitionsCalMonth,
    openCompetitionResultsModal
  };
})();

window.RankingsModule = RankingsModule;
