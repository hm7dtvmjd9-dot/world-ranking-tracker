/**
 * Master Application State & Routing Controller
 */
const App = (() => {
  const state = {
    activeTab: 'analytics',
    athletes: [],
    previousAthletesMap: {},
    lukaHistory: null,
    trainingLogs: [],
    trainingInsights: null,
    venuesData: null,
    rankingsArchive: null,
    athletesDatabase: null,
    calendarData: null,

    // Tab 1 filters
    cutoffSpots: 32,
    selectedNation: 'ALL',
    searchQuery: '',
    expandedRowId: null,

    // Tab 3 Period Settings (Default: Hallen-EM 2027 Preset)
    isHallenEmPreset: true,
    periodFieldSize: 18,
    periodMaxPerNation: 3,
    periodScope: 'europe', // 'global' | 'europe'
    periodMode: 'toplist', // 'ranking' | 'toplist'
    periodStartDate: '2026-11-01',
    periodEntryStandard: 8.17,
    periodStandardStartDate: '2026-02-22',
    expandedPeriodRowId: null
  };

  async function init() {
    setupNavigation();
    setupFilters();
    setupPeriodControls();
    registerServiceWorker();
    checkIosPwa();

    // Auto-bootstrap data
    await loadInitialData();
  }

  async function loadInitialData() {
    showSyncBadge('Lade Daten...', 'text-slate-400');

    // 1. Rankings Data
    try {
      const res = await fetch('./data/ranking_latest.json?t=' + Date.now());
      if (res.ok) {
        const rawJson = await res.json();
        const rawList = rawJson.athletes || (Array.isArray(rawJson) ? rawJson : []);
        state.athletes = rawList.map((ath, idx) => {
          const meetings = ath.counted_competitions || ath.countingMeetings || [];
          let sb = 0;
          meetings.forEach(m => {
            const markVal = parseFloat(m.mark);
            if (!isNaN(markVal) && markVal > sb) sb = markVal;
          });

          return {
            id: ath.profile_url || ath.athlete_id || 'ath-' + idx,
            originalRank: parseInt(ath.rank) || idx + 1,
            name: ath.name || '',
            nation: ath.country || ath.nation || '',
            dob: ath.dob || '',
            sb: sb > 0 ? sb : null,
            totalScore: parseInt(ath.ranking_score || ath.total_score || 0),
            countingMeetings: meetings.map(c => {
              let cleanWind = c.wind;
              if (cleanWind !== null && cleanWind !== undefined) {
                const nw = parseFloat(cleanWind);
                if (!isNaN(nw) && Math.abs(nw) >= 10) cleanWind = (nw / 10).toFixed(1);
              }
              return { ...c, wind: cleanWind };
            })
          };
        });
      }
    } catch (e) {
      console.warn('Rankings auto-load fallback', e);
    }

    // 2. Previous Week Data for WoW
    try {
      const resPrev = await fetch('./data/ranking_previous.json?t=' + Date.now());
      if (resPrev.ok) {
        const prevJson = await resPrev.json();
        const prevList = prevJson.athletes || (Array.isArray(prevJson) ? prevJson : []);
        state.previousAthletesMap = {};
        prevList.forEach((a, idx) => {
          const aName = (a.name || '').toLowerCase();
          if (aName) {
            state.previousAthletesMap[aName] = {
              rank: parseInt(a.rank) || (idx + 1),
              score: parseInt(a.ranking_score || a.total_score) || 0
            };
          }
        });
      }
    } catch (e) {}

    // 3. Luka History Data
    try {
      const resHist = await fetch('./data/luka_history.json?t=' + Date.now());
      if (resHist.ok) {
        state.lukaHistory = await resHist.json();
      }
    } catch (e) {}

    // 4. Training Insights & Sample Logs
    const customSheetsUrl = localStorage.getItem('sheets_url_key');
    if (customSheetsUrl) {
      try {
        const resSheet = await fetch(customSheetsUrl);
        if (resSheet.ok) {
          const csvText = await resSheet.text();
          state.trainingLogs = AnalyticsModule.parseCsvTrainingLogs(csvText);
          showSheetsBadge('Live Sheets', 'text-emerald-400');
        }
      } catch (e) {
        console.warn('Custom sheets fetch error', e);
      }
    }

    if (!state.trainingLogs || state.trainingLogs.length === 0) {
      try {
        const resSample = await fetch('./data/training_sample.json?t=' + Date.now());
        if (resSample.ok) {
          const sampleJson = await resSample.json();
          state.trainingLogs = sampleJson.sessions || [];
        }
      } catch (e) {}
    }

    try {
      const resInsights = await fetch('./data/training_insights.json?t=' + Date.now());
      if (resInsights.ok) {
        state.trainingInsights = await resInsights.json();
      }
    } catch (e) {}

    // 5. Venues Database
    try {
      const resVenues = await fetch('./data/venues_database.json?t=' + Date.now());
      if (resVenues.ok) {
        state.venuesData = await resVenues.json();
      }
    } catch (e) {}

    // 6. Rankings Archive (Time-Travel Snapshots)
    try {
      const resArch = await fetch('./data/rankings_archive.json?t=' + Date.now());
      if (resArch.ok) {
        state.rankingsArchive = await resArch.json();
      }
    } catch (e) {
      console.warn('Rankings archive auto-load fallback', e);
    }

    // 7. Athletes Database (Top 100 Head-to-Head & Meeting Records)
    try {
      const resDb = await fetch('./data/athletes_database.json?t=' + Date.now());
      if (resDb.ok) {
        state.athletesDatabase = await resDb.json();
      }
    } catch (e) {
      console.warn('Athletes database auto-load fallback', e);
    }

    // 8. Official Calendar 2027 (WIT & WA Tour Grounded)
    try {
      const resCal = await fetch('./data/calendar_2027.json?t=' + Date.now());
      if (resCal.ok) {
        state.calendarData = await resCal.json();
      }
    } catch (e) {
      console.warn('Calendar 2027 auto-load fallback', e);
    }

    showSyncBadge('Live WA (' + state.athletes.length + ')', 'text-emerald-400');
    renderCurrentTab();
  }

  function showSyncBadge(text, colorClass) {
    const badge = document.getElementById('jsonStatusBadge');
    if (badge) {
      badge.textContent = text;
      badge.className = `font-mono font-bold ${colorClass}`;
    }
  }

  function showSheetsBadge(text, colorClass) {
    const badge = document.getElementById('sheetsStatusBadge');
    if (badge) {
      badge.textContent = text;
      badge.className = `font-mono font-bold ${colorClass}`;
    }
  }

  function switchTab(tabId) {
    state.activeTab = tabId;

    // Desktop tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      btn.className = isTarget
        ? 'tab-btn active flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 text-cyan-400 border-b-2 border-cyan-500 shadow-sm'
        : 'tab-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all';
    });

    // Mobile bottom dock buttons
    document.querySelectorAll('.mobile-dock-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      btn.className = isTarget
        ? 'mobile-dock-btn flex flex-col items-center justify-center flex-1 py-1.5 text-cyan-400 font-bold transition-all'
        : 'mobile-dock-btn flex flex-col items-center justify-center flex-1 py-1.5 text-slate-500 hover:text-slate-300 font-medium transition-all';
    });

    // Toggle content views
    document.getElementById('tabContentRankings').classList.toggle('hidden', tabId !== 'rankings');
    document.getElementById('tabContentAnalytics').classList.toggle('hidden', tabId !== 'analytics');
    document.getElementById('tabContentQualification').classList.toggle('hidden', tabId !== 'qualification');
    document.getElementById('tabContentVenues').classList.toggle('hidden', tabId !== 'venues');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (state.activeTab === 'rankings') {
      RankingsModule.render(state);
    } else if (state.activeTab === 'analytics') {
      AnalyticsModule.render(state);
    } else if (state.activeTab === 'qualification') {
      QualificationModule.render(state);
    } else if (state.activeTab === 'venues') {
      VenuesModule.render(state);
    }
  }

  function setupNavigation() {
    document.querySelectorAll('.tab-btn, .mobile-dock-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchTab(tab);
      };
    });

    // Config Drawer Toggle
    const toggleConfigBtn = document.getElementById('toggleConfigBtn');
    const configDrawer = document.getElementById('configDrawer');
    if (toggleConfigBtn && configDrawer) {
      toggleConfigBtn.onclick = () => {
        configDrawer.classList.toggle('hidden');
      };
    }

    // Manual Sync Button
    const syncDataBtn = document.getElementById('syncDataBtn');
    if (syncDataBtn) {
      syncDataBtn.onclick = async () => {
        const spinner = document.getElementById('syncSpinner');
        if (spinner) spinner.classList.add('animate-spin');
        await loadInitialData();
        if (spinner) spinner.classList.remove('animate-spin');
      };
    }

    // Google Sheets Save Input
    const sheetsInput = document.getElementById('inputSheetsUrl');
    if (sheetsInput) {
      sheetsInput.value = localStorage.getItem('sheets_url_key') || '';
      sheetsInput.onchange = (e) => {
        const url = e.target.value.trim();
        if (url) {
          localStorage.setItem('sheets_url_key', url);
        } else {
          localStorage.removeItem('sheets_url_key');
        }
      };
    }

    // Top 100 Competitor Modal Close Handlers
    const closeCompetitorModalBtn = document.getElementById('closeCompetitorModalBtn');
    const competitorModal = document.getElementById('competitorModal');
    if (closeCompetitorModalBtn && competitorModal) {
      closeCompetitorModalBtn.onclick = () => {
        competitorModal.classList.add('hidden');
      };
      competitorModal.onclick = (e) => {
        if (e.target === competitorModal) {
          competitorModal.classList.add('hidden');
        }
      };
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !competitorModal.classList.contains('hidden')) {
          competitorModal.classList.add('hidden');
        }
      });
    }
  }

  function setupFilters() {
    const searchInput = document.getElementById('athleteSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.searchQuery = e.target.value.trim();
        RankingsModule.render(state);
      };
    }

    document.querySelectorAll('.nat-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nat-filter-btn').forEach(b => {
          b.className = 'nat-filter-btn px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 border border-slate-800 bg-slate-950 hover:text-white';
        });
        btn.className = 'nat-filter-btn px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-white';
        state.selectedNation = btn.getAttribute('data-nation') || 'ALL';
        RankingsModule.render(state);
      };
    });

    const cutoffInput = document.getElementById('customCutoffInput');
    if (cutoffInput) {
      cutoffInput.onchange = (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 1 && val <= 100) {
          state.cutoffSpots = val;
          RankingsModule.render(state);
        }
      };
    }
  }

  function setupPeriodControls() {
    const btnHallenEm = document.getElementById('presetHallenEmBtn');
    const btnWm = document.getElementById('presetWm2027Btn');

    if (btnHallenEm) {
      btnHallenEm.onclick = () => {
        state.isHallenEmPreset = true;
        state.periodFieldSize = 18;
        state.periodMaxPerNation = 3;
        state.periodScope = 'europe';
        state.periodMode = 'toplist';
        state.periodStartDate = '2026-11-01';
        state.periodEntryStandard = 8.17;
        state.periodStandardStartDate = '2026-02-22';

        document.getElementById('periodFieldSizeInput').value = 18;
        document.getElementById('periodStartDateInput').value = '2026-11-01';
        document.getElementById('periodInfoRuleBadge').textContent = 'EA Valencia 2027 Modus aktiv (Norm 8.17m ab 22.02.26 + Toplist ab 01.11.26)';
        btnHallenEm.className = 'px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-purple-600 text-white shadow-sm';
        btnWm.className = 'px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300 hover:bg-slate-700';
        updatePeriodButtonStates();
        QualificationModule.render(state);
      };
    }

    if (btnWm) {
      btnWm.onclick = () => {
        state.isHallenEmPreset = false;
        state.periodFieldSize = 36;
        state.periodMaxPerNation = 3;
        state.periodScope = 'global';
        state.periodMode = 'ranking';
        state.periodStartDate = '2026-09-01';

        document.getElementById('periodFieldSizeInput').value = 36;
        document.getElementById('periodStartDateInput').value = '2026-09-01';
        document.getElementById('periodInfoRuleBadge').textContent = 'WA Beijing 2027 Modus aktiv (36 Plätze • 12M World Ranking Rolling)';
        btnWm.className = 'px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-cyan-600 text-white shadow-sm';
        btnHallenEm.className = 'px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300 hover:bg-slate-700';
        updatePeriodButtonStates();
        QualificationModule.render(state);
      };
    }

    // Nat quota
    document.getElementById('periodNatQuota2Btn').onclick = () => {
      state.periodMaxPerNation = 2;
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };
    document.getElementById('periodNatQuota3Btn').onclick = () => {
      state.periodMaxPerNation = 3;
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };

    // Scope
    document.getElementById('periodScopeGlobalBtn').onclick = () => {
      state.periodScope = 'global';
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };
    document.getElementById('periodScopeEuropeBtn').onclick = () => {
      state.periodScope = 'europe';
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };

    // Mode
    document.getElementById('periodModeRankingBtn').onclick = () => {
      state.periodMode = 'ranking';
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };
    document.getElementById('periodModeToplistBtn').onclick = () => {
      state.periodMode = 'toplist';
      updatePeriodButtonStates();
      QualificationModule.render(state);
    };

    document.getElementById('periodFieldSizeInput').onchange = (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 1 && val <= 100) {
        state.periodFieldSize = val;
        QualificationModule.render(state);
      }
    };

    document.getElementById('periodStartDateInput').onchange = (e) => {
      state.periodStartDate = e.target.value;
      QualificationModule.render(state);
    };
  }

  function updatePeriodButtonStates() {
    document.getElementById('periodNatQuota2Btn').className = state.periodMaxPerNation === 2 ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';
    document.getElementById('periodNatQuota3Btn').className = state.periodMaxPerNation === 3 ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';

    document.getElementById('periodScopeGlobalBtn').className = state.periodScope === 'global' ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';
    document.getElementById('periodScopeEuropeBtn').className = state.periodScope === 'europe' ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';

    document.getElementById('periodModeRankingBtn').className = state.periodMode === 'ranking' ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';
    document.getElementById('periodModeToplistBtn').className = state.periodMode === 'toplist' ? 'flex-1 py-1 rounded text-center font-bold bg-cyan-600 text-white' : 'flex-1 py-1 rounded text-center font-bold text-slate-400 hover:text-white';

    document.getElementById('periodValueHeaderCol').textContent = state.periodMode === 'ranking' ? 'Ø Score (Zeitraum)' : 'Toplist Weite / SB';
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('[PWA] ServiceWorker registered with scope:', reg.scope))
          .catch(err => console.warn('[PWA] ServiceWorker registration failed:', err));
      });
    }
  }

  function checkIosPwa() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = ('standalone' in window.navigator) && (window.navigator.standalone);

    if (isIos && !isStandalone) {
      // Show gentle iOS Home Screen install reminder banner on first visits
      const hasDismissed = localStorage.getItem('ios_pwa_banner_dismissed');
      if (!hasDismissed) {
        const banner = document.getElementById('iosInstallBanner');
        if (banner) banner.classList.remove('hidden');
      }
    }
  }

  return { init, state, switchTab, renderCurrentTab, loadInitialData };
})();

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
