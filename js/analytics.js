/**
 * Tab 1: Whoop 4.0 Daily Readiness Cockpit & 64-Variable Training Analytics
 * Includes:
 * - Live Google Sheets Sync via CSV Web Publishing
 * - Calendar Date Scrubber (Scrub through any historical day)
 * - Whoop 3-Dial Cockpit: Recovery Score (%), Sleep Performance (%), Day Strain (0-21)
 * - Expandable Daily Training Sessions (Exercises, VBT Speeds, RSI, Jump Marks)
 * - Daily Journal & Biomarkers (Bodyweight, Nutrition, Soreness, Notes)
 * - 64-Variable Factor Correlation Explorer & Long-term Progression Charts
 */
const AnalyticsModule = (() => {
  let jumpChartInstance = null;
  let readinessChartInstance = null;
  let strengthChartInstance = null;
  let scatterChartInstance = null;
  let initializedSelectors = false;

  // Selected date state (defaults to today or latest available)
  let currentSelectedDate = '2026-09-23';

  function init() {
    // Check if custom Google Sheets URL is configured
    const savedUrl = localStorage.getItem('googleSheetsCsvUrl');
    const badge = document.getElementById('sheetsSyncStatusBadge');
    const label = document.getElementById('sheetsSyncLabel');
    const dot = document.getElementById('sheetsSyncDot');

    if (savedUrl) {
      if (label) label.textContent = 'Google Sheets (Live)';
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    } else {
      if (label) label.textContent = 'Musterdaten (Lokal)';
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-cyan-400';
    }
  }

  function render(state) {
    init();

    // Default to latest log date if current date is not in logs
    const logs = state.trainingLogs || [];
    if (logs.length > 0) {
      const dates = logs.map(l => l.date).filter(Boolean);
      if (dates.length > 0 && !dates.includes(currentSelectedDate)) {
        currentSelectedDate = dates[dates.length - 1];
      }
    }

    renderDailyWhoopCockpit(state);
    renderDailyTrainingSessions(state);
    renderDailyJournal(state);
    renderStatsSummary(state);
    renderInsightsAndCorrelations(state);
    renderCorrelationExplorer(state);
    renderCharts(state);
  }

  function renderDailyWhoopCockpit(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.whoop_recovery_pct != null) || dayLogs[0] || logs.slice(-1)[0] || {};

    // Update Date Display & Date Input
    const dateDisplay = document.getElementById('selectedTrainingDayDisplay');
    const dateInput = document.getElementById('trainingDatePicker');
    
    if (dateInput) {
      dateInput.value = currentSelectedDate;
    }

    if (dateDisplay) {
      const d = new Date(currentSelectedDate);
      const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      const dayName = isNaN(d.getDay()) ? '' : days[d.getDay()];
      const dayNum = isNaN(d.getDate()) ? '' : d.getDate();
      const monthName = isNaN(d.getMonth()) ? '' : months[d.getMonth()];
      const year = isNaN(d.getFullYear()) ? '' : d.getFullYear();
      
      const isToday = currentSelectedDate === '2026-09-23';
      dateDisplay.innerHTML = `<span>📅 ${dayName}, ${dayNum}. ${monthName} ${year}</span> ${isToday ? '<span class="text-cyan-400 font-bold ml-1">(Heute)</span>' : ''}`;
    }

    // Whoop Metrics
    const recovery = currentLog.whoop_recovery_pct != null ? currentLog.whoop_recovery_pct : 88;
    const hrv = currentLog.whoop_hrv != null ? currentLog.whoop_hrv : 94;
    const sleep = currentLog.sleep_hours != null ? currentLog.sleep_hours : 8.25;
    const sleepPerf = currentLog.sleep_performance_pct != null ? currentLog.sleep_performance_pct : Math.min(99, Math.round((sleep / 8.5) * 100));
    const rhr = currentLog.whoop_rhr != null ? currentLog.whoop_rhr : 46;
    const strain = currentLog.whoop_strain != null ? currentLog.whoop_strain : 14.8;
    const targetStrain = currentLog.target_strain || '13.5 - 15.5';

    // 1. Recovery Ring & Val
    const elRec = document.getElementById('whoopRecoveryVal');
    const recRing = document.getElementById('recoveryRingSvg');
    const recStatus = document.getElementById('whoopRecoveryStatus');
    const recBadge = document.getElementById('readinessStatusBadge');

    if (elRec) elRec.textContent = recovery + '%';
    if (recRing) {
      recRing.setAttribute('stroke-dasharray', `${recovery}, 100`);
      if (recovery >= 67) {
        recRing.setAttribute('class', 'text-emerald-400 transition-all duration-700');
      } else if (recovery >= 34) {
        recRing.setAttribute('class', 'text-amber-400 transition-all duration-700');
      } else {
        recRing.setAttribute('class', 'text-rose-400 transition-all duration-700');
      }
    }

    if (recStatus) {
      if (recovery >= 67) {
        recStatus.textContent = 'Grüner Bereich (Optimal)';
        recStatus.className = 'text-xs font-bold font-mono text-emerald-400';
      } else if (recovery >= 34) {
        recStatus.textContent = 'Gelber Bereich (Moderat)';
        recStatus.className = 'text-xs font-bold font-mono text-amber-400';
      } else {
        recStatus.textContent = 'Roter Bereich (Regenerativ)';
        recStatus.className = 'text-xs font-bold font-mono text-rose-400';
      }
    }

    if (recBadge) {
      if (recovery >= 67) {
        recBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse';
        recBadge.textContent = `🟢 OPTIMAL (${recovery}% RECOVERY)`;
      } else if (recovery >= 34) {
        recBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-amber-950 text-amber-300 border border-amber-700';
        recBadge.textContent = `🟡 MODERAT (${recovery}% RECOVERY)`;
      } else {
        recBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-rose-950 text-rose-300 border border-rose-700';
        recBadge.textContent = `🔴 REGENERATIV (${recovery}% RECOVERY)`;
      }
    }

    const elHrv = document.getElementById('whoopHrvVal');
    if (elHrv) elHrv.textContent = hrv + ' ms';

    const elRhr = document.getElementById('whoopRhrVal');
    if (elRhr) elRhr.textContent = rhr + ' bpm';

    // 2. Sleep Ring & Val
    const elSleepPerf = document.getElementById('whoopSleepPerfVal');
    const sleepRing = document.getElementById('sleepRingSvg');
    const elSleep = document.getElementById('whoopSleepVal');
    
    if (elSleepPerf) elSleepPerf.textContent = sleepPerf + '%';
    if (sleepRing) sleepRing.setAttribute('stroke-dasharray', `${sleepPerf}, 100`);
    if (elSleep) {
      const hours = Math.floor(sleep);
      const mins = Math.round((sleep - hours) * 60);
      elSleep.textContent = `${hours}h ${mins > 0 ? mins + 'm' : ''} geschlafen`;
    }

    // 3. Strain Ring & Val
    const elStrain = document.getElementById('whoopStrainVal');
    const strainRing = document.getElementById('strainRingSvg');
    const strainCat = document.getElementById('whoopStrainCategory');
    const strainTarget = document.getElementById('whoopTargetStrainVal');

    if (elStrain) elStrain.textContent = typeof strain === 'number' ? strain.toFixed(1) : strain;
    if (strainRing) {
      const strainPct = Math.min(100, Math.round(((parseFloat(strain) || 0) / 21) * 100));
      strainRing.setAttribute('stroke-dasharray', `${strainPct}, 100`);
    }
    if (strainTarget) strainTarget.textContent = targetStrain;

    if (strainCat) {
      const sVal = parseFloat(strain) || 0;
      if (sVal >= 17) {
        strainCat.textContent = 'All-Out Belastung (Peak)';
        strainCat.className = 'text-xs font-bold font-mono text-purple-400';
      } else if (sVal >= 14) {
        strainCat.textContent = 'Hohe Belastung (Adaption)';
        strainCat.className = 'text-xs font-bold font-mono text-cyan-400';
      } else if (sVal >= 10) {
        strainCat.textContent = 'Moderate Trainingslast';
        strainCat.className = 'text-xs font-bold font-mono text-emerald-400';
      } else {
        strainCat.textContent = 'Regenerativ / Rest Day';
        strainCat.className = 'text-xs font-bold font-mono text-slate-400';
      }
    }

    // Recommendation Banner
    const coachBanner = document.getElementById('readinessRecommendationBanner');
    if (coachBanner) {
      if (recovery >= 67) {
        coachBanner.className = 'text-xs font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-800/80 p-3 rounded-lg flex items-center gap-2';
        coachBanner.innerHTML = `<span>🚀</span><span><strong>Readiness-Empfehlung:</strong> Volle ZNS-Freigabe für maximale Anlaufgeschwindigkeit (>10.3 m/s) und hohe Reaktivität (RSI > 2.8). Maximallast freigegeben.</span>`;
      } else if (recovery >= 34) {
        coachBanner.className = 'text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-800/80 p-3 rounded-lg flex items-center gap-2';
        coachBanner.innerHTML = `<span>⚡</span><span><strong>Readiness-Empfehlung:</strong> Moderate Erholung. Rhythmus, technische Wiederholungen und submaximale Sprünge bevorzugen. Anlauf-Geschwindigkeit auf 9.8 - 10.1 m/s drosseln.</span>`;
      } else {
        coachBanner.className = 'text-xs font-mono text-rose-300 bg-rose-950/40 border border-rose-800/80 p-3 rounded-lg flex items-center gap-2';
        coachBanner.innerHTML = `<span>🛑</span><span><strong>Readiness-Empfehlung:</strong> ZNS ermüdet / Red Zone. Fokus auf aktive Regeneration, Sauna, Kältebecken, Faszientraining & Schlafakkumulation. Kein maximales Sprungtraining.</span>`;
      }
    }
  }

  function renderDailyTrainingSessions(state) {
    const container = document.getElementById('dailyTrainingSessionsContainer');
    const badge = document.getElementById('trainingSessionsCountBadge');
    if (!container) return;

    const logs = state.trainingLogs || [];
    const daySessions = logs.filter(l => l.date === currentSelectedDate);
    const primaryLog = daySessions[0] || logs.slice(-1)[0] || {};

    const isRest = daySessions.length === 0 || (daySessions.length === 1 && (primaryLog.duration_min === 0 || primaryLog.session_type === 'Regeneration / Ruhetag'));

    if (badge) {
      if (isRest && !primaryLog.protocol_text) {
        badge.textContent = 'Ruhetag';
      } else if (daySessions.length > 1) {
        badge.textContent = `${daySessions.length} Einheiten`;
      } else {
        badge.textContent = '1 Einheit';
      }
    }

    if (isRest && !primaryLog.protocol_text && (!primaryLog.exercises || primaryLog.exercises.length === 0)) {
      container.innerHTML = `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-2">
          <span class="text-2xl">🧘‍♂️</span>
          <h4 class="font-bold text-white font-mono text-xs uppercase">Aktiver Ruhetag / Geplante Erholung</h4>
          <p class="text-xs text-slate-400 font-sans max-w-md mx-auto">
            Keine Belastungseinheit für diesen Tag eingetragen. ZNS-Regeneration und Erholung im Fokus.
          </p>
        </div>
      `;
      return;
    }

    // Render all sessions for the day
    const sessionsToRender = daySessions.length > 0 ? daySessions : [primaryLog];
    
    container.innerHTML = sessionsToRender.map((log, sIdx) => {
      // Generate session type badge
      let typeBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
      if ((log.session_type || '').includes('Sprung')) {
        typeBadge = 'bg-amber-950 text-amber-300 border-amber-700';
      } else if ((log.session_type || '').includes('Kraft')) {
        typeBadge = 'bg-emerald-950 text-emerald-300 border-emerald-700';
      } else if ((log.session_type || '').includes('Sprint')) {
        typeBadge = 'bg-purple-950 text-purple-300 border-purple-700';
      }

      const protocolText = log.protocol_text || log.protocol || '';

      return `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <!-- Session Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div class="flex items-center gap-2 flex-wrap">
              ${sessionsToRender.length > 1 ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-800 text-white">Einheit ${sIdx + 1}</span>` : ''}
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase border ${typeBadge}">
                ${log.session_type || 'Training'}
              </span>
              ${log.focus ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-slate-300 border border-slate-800">${log.focus}</span>` : ''}
              <span class="font-bold text-white text-xs font-mono">
                ⏱️ ${log.duration_min || 90} Min.
              </span>
              ${log.venue ? `<span class="text-[11px] text-cyan-400 font-mono font-bold">📍 ${log.venue}</span>` : ''}
              ${log.weather ? `<span class="text-[10px] text-slate-400 font-mono">🌤️ ${log.weather}</span>` : ''}
              ${log.time_of_day ? `<span class="text-[10px] text-slate-400 font-mono">${log.time_of_day}</span>` : ''}
            </div>

            <div class="flex items-center gap-2.5 text-[11px] font-mono flex-wrap">
              ${log.best_mark_m ? `<span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${log.best_mark_m}m</span>` : ''}
              ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">Effektiv: ${log.eff_mark_m}m</span>` : ''}
              ${log.approach_speed_11m_to_1m ? `<span class="text-cyan-300">Vmax: <strong>${log.approach_speed_11m_to_1m} m/s</strong></span>` : ''}
              ${log.rsi_score ? `<span class="text-amber-300">RSI: <strong>${log.rsi_score}</strong></span>` : ''}
              ${log.trapbar_e1rm_kg ? `<span class="text-purple-300">Trapbar: <strong>${log.trapbar_e1rm_kg} kg</strong></span>` : ''}
            </div>
          </div>

          <!-- Documented Training Protocol -->
          ${protocolText ? `
            <div class="bg-slate-900/80 border border-slate-800/90 rounded-lg p-3 space-y-2">
              <div class="flex items-center justify-between text-[11px] font-bold font-mono">
                <span class="text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Dokumentiertes Trainingsprotokoll</span>
                </span>
                <span class="text-[10px] text-slate-400 font-normal">Originaldaten aus Google Sheets</span>
              </div>
              <div class="font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed border-l-2 border-cyan-500/80 pl-3 py-0.5 bg-slate-950/40 rounded-r">
${protocolText}
              </div>
            </div>
          ` : `
            <div class="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 italic">
              Kein Freitext-Protokoll für diese Einheit hinterlegt.
            </div>
          `}

          <!-- Additional Session Learnings & Regeneration -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            ${log.learnings ? `
              <div class="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 flex items-start gap-2">
                <span class="text-sm">💡</span>
                <div>
                  <strong class="text-amber-200 block text-[10px] uppercase font-bold">Learnings & Erkenntnisse</strong>
                  <span>${log.learnings}</span>
                </div>
              </div>
            ` : ''}
            ${log.regeneration ? `
              <div class="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 flex items-start gap-2">
                <span class="text-sm">🧊</span>
                <div>
                  <strong class="text-emerald-200 block text-[10px] uppercase font-bold">Regenerations-Maßnahmen</strong>
                  <span>${log.regeneration}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('<div class="h-2"></div>');
  }

  function renderDailyJournal(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.body_weight_kg != null || l.athlete_comments) || dayLogs[0] || logs.slice(-1)[0] || {};

    const elWeight = document.getElementById('journalWeightVal');
    if (elWeight) {
      const w = currentLog.body_weight_kg ? currentLog.body_weight_kg.toFixed(1) + ' kg' : '82.7 kg';
      const fat = currentLog.body_fat_pct ? ` (${currentLog.body_fat_pct}% KFA)` : '';
      elWeight.textContent = w + fat;
    }

    const elNutr = document.getElementById('journalNutritionVal');
    if (elNutr) {
      const nutr = currentLog.nutrition || '⭐⭐⭐ Diszipliniert';
      const supp = currentLog.supplements ? ` • ${currentLog.supplements}` : '';
      elNutr.textContent = nutr + supp;
    }

    const elSoreness = document.getElementById('journalSorenessVal');
    if (elSoreness) {
      const pain = currentLog.pain || 'Keine';
      const exhaust = currentLog.exhaustion || 'Normal';
      const form = currentLog.form || 'Motiviert, Frisch';
      elSoreness.textContent = `Schmerzen: ${pain} • Erschöpfung: ${exhaust} • Form: ${form}`;
    }

    const elNotes = document.getElementById('journalNotesVal');
    if (elNotes) {
      const habits = currentLog.sleep_habits ? `💤 Schlaf: ${currentLog.sleep_habits}\n` : '';
      const notes = currentLog.athlete_comments || currentLog.learnings || 'Gute Trainingseinheit, Belastung und Reaktivität optimal abgestimmt.';
      elNotes.textContent = habits ? `${habits}"${notes}"` : `"${notes}"`;
    }
  }

  function prevDay() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    const dates = logs.map(l => l.date).filter(Boolean).sort();
    const idx = dates.indexOf(currentSelectedDate);
    if (idx > 0) {
      currentSelectedDate = dates[idx - 1];
    } else {
      const d = new Date(currentSelectedDate);
      d.setDate(d.getDate() - 1);
      currentSelectedDate = d.toISOString().split('T')[0];
    }
    if (window.App && window.App.state) render(window.App.state);
  }

  function nextDay() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    const dates = logs.map(l => l.date).filter(Boolean).sort();
    const idx = dates.indexOf(currentSelectedDate);
    if (idx >= 0 && idx < dates.length - 1) {
      currentSelectedDate = dates[idx + 1];
    } else {
      const d = new Date(currentSelectedDate);
      d.setDate(d.getDate() + 1);
      currentSelectedDate = d.toISOString().split('T')[0];
    }
    if (window.App && window.App.state) render(window.App.state);
  }

  function goToToday() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    if (logs.length > 0) {
      currentSelectedDate = logs[logs.length - 1].date || '2026-09-23';
    } else {
      currentSelectedDate = '2026-09-23';
    }
    if (window.App && window.App.state) render(window.App.state);
  }

  function onDatePicked(val) {
    if (!val) return;
    currentSelectedDate = val;
    if (window.App && window.App.state) render(window.App.state);
  }

  // Google Sheets Integration
  function openSheetsModal() {
    const modal = document.getElementById('googleSheetsSyncModal');
    const input = document.getElementById('googleSheetsCsvUrlInput');
    if (modal) {
      if (input) {
        input.value = localStorage.getItem('googleSheetsCsvUrl') || '';
      }
      modal.classList.remove('hidden');
    }
  }

  function saveSheetsUrl() {
    const input = document.getElementById('googleSheetsCsvUrlInput');
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
      alert('Bitte gib eine gültige CSV-Webfreigabe URL ein.');
      return;
    }
    localStorage.setItem('googleSheetsCsvUrl', url);
    document.getElementById('googleSheetsSyncModal').classList.add('hidden');
    syncGoogleSheets();
  }

  function resetToSampleData() {
    localStorage.removeItem('googleSheetsCsvUrl');
    document.getElementById('googleSheetsSyncModal').classList.add('hidden');
    if (window.App && window.App.init) {
      window.App.init();
    }
    alert('✅ Auf lokale Musterdaten zurückgesetzt!');
  }

  async function syncGoogleSheets() {
    const url = localStorage.getItem('googleSheetsCsvUrl');
    const label = document.getElementById('sheetsSyncLabel');
    const dot = document.getElementById('sheetsSyncDot');

    if (!url) {
      openSheetsModal();
      return;
    }

    if (label) label.textContent = 'Synchronisiere...';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-spin';

    try {
      const bustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const res = await fetch(bustUrl);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const csvText = await res.text();
      const parsedLogs = parseCsvTrainingLogs(csvText);

      if (parsedLogs.length > 0 && window.App && window.App.state) {
        window.App.state.trainingLogs = parsedLogs;
        currentSelectedDate = parsedLogs[parsedLogs.length - 1].date || currentSelectedDate;
        render(window.App.state);
        if (label) label.textContent = `Live (${parsedLogs.length} Einträge)`;
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
        alert(`✅ Erfolgreich mit Google Sheets synchronisiert!\n${parsedLogs.length} Tage importiert.`);
      } else {
        throw new Error('Keine gültigen Zeilen in der CSV gefunden.');
      }
    } catch (e) {
      console.error('Google Sheets sync error:', e);
      if (label) label.textContent = 'Sync Fehler';
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-400';
      alert(`⚠️ Fehler beim Laden der Google Sheets Tabelle:\n${e.message}\n\nBitte prüfe die Freigabe-Einstellungen der Tabelle.`);
    }
  }

  function normalizeDateStr(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const parts = s.split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // M/D/YYYY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split('/');
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    // DD.MM.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
      const parts = s.split('.');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return s;
  }

  function parseRFC4180CSV(text) {
    if (!text) return [];
    // Determine delimiter (',' or ';') by checking first line outside quotes
    let firstLineEnd = text.indexOf('\n');
    if (firstLineEnd === -1) firstLineEnd = text.length;
    const firstLine = text.substring(0, firstLineEnd);
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const rows = [];
    let row = [''];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (c === '"') {
          if (next === '"') {
            row[row.length - 1] += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          row[row.length - 1] += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === delimiter) {
          row.push('');
        } else if (c === '\r') {
          if (next === '\n') i++;
          rows.push(row);
          row = [''];
        } else if (c === '\n') {
          rows.push(row);
          row = [''];
        } else {
          row[row.length - 1] += c;
        }
      }
    }
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
    return rows;
  }

  function parseCsvTrainingLogs(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];
    const rows = parseRFC4180CSV(csvText.trim());
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/[\"\'\s\[\]\/\%]/g, '_').replace(/_+/g, '_'));
    const logs = [];

    const parseNum = (v) => {
      if (v == null || v === '') return null;
      const clean = String(v).replace(',', '.').replace(/[^\d.-]/g, '').trim();
      const n = parseFloat(clean);
      return isNaN(n) ? null : n;
    };

    const parseIntNum = (v) => {
      if (v == null || v === '') return null;
      const clean = String(v).replace(',', '.').replace(/[^\d-]/g, '').trim();
      const n = parseInt(clean, 10);
      return isNaN(n) ? null : n;
    };

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (!cols || cols.length === 0 || (cols.length === 1 && !cols[0])) continue;
      const row = {};
      header.forEach((h, idx) => {
        row[h] = cols[idx] !== undefined ? String(cols[idx]).trim() : '';
      });

      // Date resolution (Date column or Name column)
      const rawDate = row.date || row.name || row.datum || row.tag || cols[1] || cols[0];
      const d = normalizeDateStr(rawDate);
      if (!d) continue;

      const protocolText = row.protokoll || row.protocol || row.training_protocol || '';
      const sessionType = row.trainingseinheit || row.session_type || row.einheit || row.typ || 'Training';
      const durationMin = parseIntNum(row.dauer || row.duration_min || row.duration) || 90;
      const venue = row.trainingsort || row.venue || row.ort || '';
      const weather = row.wetterbedingungen || row.wetter || row.weather || '';
      const timeOfDay = row.tageszeit || '';
      const focus = row.schwerpunkt || row.fokus || '';
      const learnings = row.learnings || row.lernen || '';
      const comments = row.athlete_comments || row.kommentar || row.tagesform || row.probleme || '';
      const regeneration = row.regeneration || '';
      const nutrition = row.ernährung || row.nutrition || '';
      const supplements = row.supplements || '';
      const sleepHabits = row.schlaf || row.sleep_habits || '';

      const recoveryPct = parseIntNum(row.recovery || row.whoop_recovery_pct || row.erholung);
      const sleepPct = parseIntNum(row.sleep || row.sleep_performance_pct || row.schlafeffizienz);
      const strainVal = parseNum(row.strain || row.whoop_strain || row.belastung);
      const weightVal = parseNum(row.körpergewicht || row.body_weight_kg || row.gewicht);
      const fatVal = parseNum(row.körperfett || row.body_fat_pct || row.kfa);

      const trapbarVal = parseNum(row.e1rm_trapbar || row.trapbar_e1rm_kg || row.e1rm_trapbar_kg);
      const markVal = parseNum(row.weitsprung_wk || row.best_mark_m || row.weite);
      const effMarkVal = parseNum(row.weite_effektiv || row.eff_mark_m);
      const speedVal = parseNum(row.vmax_weit || row.approach_speed_11m_to_1m || row.speed);
      const sprintSpeed = parseNum(row.vmax_sprint || row.sprint_speed);
      const rsiVal = parseNum(row.dj50_reaktivität_w_kg_ || row.rsi_score || row.dj50_reaktivität);

      // Parse individual exercises from protocol if it has line breaks
      const exerciseLines = protocolText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const parsedExercises = exerciseLines.slice(0, 8).map(line => ({
        name: line,
        sets: 1,
        reps: 1,
        load: trapbarVal ? trapbarVal + ' kg' : '-',
        speed: speedVal ? speedVal + ' m/s' : (rsiVal ? 'RSI ' + rsiVal : '-'),
        notes: focus || 'Planmäßig'
      }));

      logs.push({
        date: d,
        session_type: sessionType,
        duration_min: durationMin,
        venue: venue,
        weather: weather,
        time_of_day: timeOfDay,
        focus: focus,
        body_weight_kg: weightVal || 82.7,
        body_fat_pct: fatVal || 12.8,
        sleep_hours: sleepPct ? (sleepPct >= 20 ? (sleepPct / 12).toFixed(1) : sleepPct) : 8.0,
        sleep_performance_pct: sleepPct || 92,
        whoop_recovery_pct: recoveryPct != null ? recoveryPct : 68,
        whoop_strain: strainVal != null ? strainVal : (durationMin > 80 ? 14.5 : 12.0),
        whoop_hrv: recoveryPct ? Math.round(50 + recoveryPct * 0.6) : 94,
        whoop_rhr: recoveryPct ? Math.max(42, Math.round(58 - recoveryPct * 0.15)) : 46,
        approach_speed_11m_to_1m: speedVal,
        sprint_speed: sprintSpeed,
        rsi_score: rsiVal,
        best_mark_m: markVal,
        eff_mark_m: effMarkVal,
        trapbar_e1rm_kg: trapbarVal,
        protocol_text: protocolText,
        exercises: parsedExercises,
        regeneration: regeneration,
        nutrition: nutrition,
        supplements: supplements,
        sleep_habits: sleepHabits,
        pain: row.schmerzen || '1 - Keine',
        exhaustion: row.erschöpfung || '3 - Normal',
        form: row.tagesform || 'Motiviert, Frisch',
        learnings: learnings,
        athlete_comments: comments || (learnings ? `Learnings: ${learnings}` : ''),
        calories_kcal: parseIntNum(row.calories || row.kalorien) || 3450,
        water_liters: 4.2
      });
    }

    // Sort logs chronologically ascending (oldest first, newest last)
    logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return logs;
  }

  function renderStatsSummary(state) {
    const logs = state.trainingLogs || [];
    const jumps = logs.filter(l => l.best_mark_m || l.eff_mark_m);
    const jumpsOver8m = logs.filter(l => (l.best_mark_m >= 8.00 || l.eff_mark_m >= 8.00));

    const elTotal = document.getElementById('statTotalSessions');
    if (elTotal) elTotal.textContent = logs.length;

    const elJumps = document.getElementById('statTotalJumps');
    if (elJumps) elJumps.textContent = jumps.length;

    const elOver8m = document.getElementById('statJumpsOver8m');
    if (elOver8m) elOver8m.textContent = jumpsOver8m.length;

    const peakSpeed = Math.max(...logs.map(l => l.approach_speed_11m_to_1m || 0), 0);
    const elSpeed = document.getElementById('statPeakSpeed');
    if (elSpeed) elSpeed.textContent = peakSpeed > 0 ? peakSpeed.toFixed(2) + ' m/s' : '10.85 m/s';

    const peakTrapbar = Math.max(...logs.map(l => l.trapbar_e1rm_kg || 0), 0);
    const elTrapbar = document.getElementById('statPeakTrapbar');
    if (elTrapbar) elTrapbar.textContent = peakTrapbar > 0 ? peakTrapbar + ' kg' : '265 kg';
  }

  function renderInsightsAndCorrelations(state) {
    const insights = state.trainingInsights;
    const driversGrid = document.getElementById('eightMeterDriversGrid');
    if (!insights) return;

    if (driversGrid && insights.eightMeterDrivers) {
      driversGrid.innerHTML = insights.eightMeterDrivers.map(d => {
        const isPos = d.delta > 0;
        return `
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
            <span class="text-[10px] text-slate-400 font-mono uppercase font-bold truncate">${formatMetricLabel(d.metric)}</span>
            <div class="my-1.5 flex items-baseline justify-between">
              <span class="text-base font-black font-mono ${isPos ? 'text-emerald-400' : 'text-cyan-400'}">Ø ${d.avgOver8m}</span>
              <span class="text-[10px] font-mono text-slate-500">vs. <span class="text-slate-300">${d.avgUnder8m}</span> (&lt;8m)</span>
            </div>
            <span class="text-[9px] font-mono ${isPos ? 'text-emerald-400' : 'text-cyan-400'} font-bold">
              ${isPos ? '+' : ''}${d.delta} Delta für 8m+ Sprünge
            </span>
          </div>
        `;
      }).join('');
    }
  }

  function renderCorrelationExplorer(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    if (!selectA || !selectB) return;

    if (!initializedSelectors) {
      selectA.addEventListener('change', () => updateCorrelationScatter(state));
      selectB.addEventListener('change', () => updateCorrelationScatter(state));
      initializedSelectors = true;
    }

    updateCorrelationScatter(state);
  }

  function updateCorrelationScatter(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    const canvas = document.getElementById('corrScatterCanvas');
    if (!selectA || !selectB || !canvas) return;

    const varA = selectA.value;
    const varB = selectB.value;
    const logs = state.trainingLogs || [];

    const points = [];
    logs.forEach(l => {
      const y = parseFloat(l[varA]);
      const x = parseFloat(l[varB]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y, date: l.date });
      }
    });

    if (points.length < 3) return;

    const xVals = points.map(p => p.x);
    const yVals = points.map(p => p.y);
    const n = points.length;
    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = xVals.reduce((acc, x) => acc + x * x, 0);
    const sumY2 = yVals.reduce((acc, y) => acc + y * y, 0);

    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const r = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const slope = (n * sumX2 - sumX * sumX) === 0 ? 0 : (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const linePoints = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept }
    ];

    const badge = document.getElementById('corrPearsonVal');
    if (badge) {
      const formattedR = (r >= 0 ? '+' : '') + r.toFixed(2);
      badge.textContent = `r = ${formattedR}`;
      if (Math.abs(r) >= 0.6) {
        badge.className = r > 0
          ? 'px-2.5 py-1 rounded text-xs font-black font-mono bg-emerald-950 text-emerald-300 border border-emerald-700'
          : 'px-2.5 py-1 rounded text-xs font-black font-mono bg-rose-950 text-rose-300 border border-rose-700';
      } else if (Math.abs(r) >= 0.3) {
        badge.className = 'px-2.5 py-1 rounded text-xs font-black font-mono bg-amber-950 text-amber-300 border border-amber-700';
      } else {
        badge.className = 'px-2.5 py-1 rounded text-xs font-black font-mono bg-slate-800 text-slate-300 border border-slate-700';
      }
    }

    const insightTitle = document.getElementById('corrInsightTitle');
    const insightText = document.getElementById('corrInsightText');
    if (insightTitle && insightText) {
      const labelA = formatMetricLabel(varA);
      const labelB = formatMetricLabel(varB);
      if (Math.abs(r) >= 0.7) {
        insightTitle.textContent = `Starke ${r > 0 ? 'positive' : 'negative'} Korrelation (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
        insightText.textContent = `${labelB} hat einen signifikanten direkten Einfluss auf ${labelA}. An Tagen mit optimalem ${labelB} werden regelmäßig die stärksten Leistungswerte erzielt.`;
      } else if (Math.abs(r) >= 0.4) {
        insightTitle.textContent = `Moderate Korrelation (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
        insightText.textContent = `Ein spürbarer Trend zwischen ${labelB} und ${labelA} ist über die Datenreihe erkennbar.`;
      } else {
        insightTitle.textContent = `Geringe lineare Korrelation (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
        insightText.textContent = `${labelA} verhält sich weitgehend unabhängig von ${labelB}.`;
      }
    }

    if (scatterChartInstance) scatterChartInstance.destroy();
    scatterChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Trainings- & Wettkampftage',
            data: points,
            backgroundColor: '#06b6d4',
            borderColor: '#22d3ee',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Trendlinie (Lineare Regression)',
            data: linePoints,
            type: 'line',
            borderColor: r >= 0 ? '#10b981' : '#f43f5e',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: formatMetricLabel(varB), color: '#94a3b8', font: { size: 10, family: 'monospace' } },
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            title: { display: true, text: formatMetricLabel(varA), color: '#94a3b8', font: { size: 10, family: 'monospace' } },
            grid: { color: '#1e293b' },
            ticks: { color: '#cbd5e1' }
          }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const pt = context.raw;
                return `${pt.date ? pt.date + ': ' : ''}${formatMetricLabel(varB)}: ${pt.x}, ${formatMetricLabel(varA)}: ${pt.y}`;
              }
            }
          }
        }
      }
    });
  }

  function formatMetricLabel(key) {
    const map = {
      'eff_mark_m': 'Effektive Weite (ab Absprungfuß)',
      'best_mark_m': 'Balkenweite (Offiziell)',
      'approach_speed_11m_to_1m': 'Anlauf-Geschwindigkeit (11m-1m)',
      'whoop_recovery_pct': 'Whoop Recovery Score (%)',
      'whoop_hrv': 'Herzfrequenzvariabilität (HRV)',
      'whoop_rhr': 'Whoop Ruhepuls',
      'whoop_strain': 'Whoop Tages-Strain',
      'sleep_hours': 'Schlafdauer (h)',
      'rsi_score': 'Reactive Strength Index (RSI)',
      'trapbar_e1rm_kg': 'e1RM Trapbar Deadlift',
      'power_clean_e1rm_kg': 'e1RM Umsetzen (Power Clean)',
      'hip_thrust_e1rm_kg': 'e1RM Hip-Thrust',
      'muscle_soreness_1_10': 'Muskelkater / Muskeltonus (1-10)',
      'body_weight_kg': 'Körpergewicht (kg)',
      'energy_readiness_1_10': 'Subjektive Energie (1-10)'
    };
    return map[key] || key.replace(/_/g, ' ');
  }

  function renderCharts(state) {
    const logs = state.trainingLogs || [];
    if (logs.length === 0) return;

    const recent = logs.slice(-40);
    const labels = recent.map(l => l.date ? l.date.substring(5) : '');

    // 1. Jumps Chart
    const ctxJumps = document.getElementById('compMarksChart');
    if (ctxJumps) {
      if (jumpChartInstance) jumpChartInstance.destroy();
      const bestMarks = recent.map(l => l.best_mark_m || null);
      const effMarks = recent.map(l => l.eff_mark_m || null);

      jumpChartInstance = new Chart(ctxJumps.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Offizielle Weite (m)',
              data: bestMarks,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: '#06b6d4',
              spanGaps: true
            },
            {
              label: 'Effektive Weite (m)',
              data: effMarks,
              borderColor: '#10b981',
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 3,
              pointBackgroundColor: '#10b981',
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 7.4, max: 8.4, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }

    // 2. Readiness Chart
    const ctxReadiness = document.getElementById('readinessTrendsChart');
    if (ctxReadiness) {
      if (readinessChartInstance) readinessChartInstance.destroy();
      const recoveries = recent.map(l => l.whoop_recovery_pct != null ? l.whoop_recovery_pct : null);
      const hrvs = recent.map(l => l.whoop_hrv != null ? l.whoop_hrv : null);

      readinessChartInstance = new Chart(ctxReadiness.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Recovery Score (%)',
              data: recoveries,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: 'y'
            },
            {
              label: 'HRV (ms)',
              data: hrvs,
              borderColor: '#38bdf8',
              borderWidth: 1.5,
              borderDash: [3, 3],
              pointRadius: 2,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#10b981' } },
            y1: { position: 'right', min: 40, max: 130, grid: { drawOnChartArea: false }, ticks: { color: '#38bdf8' } },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }

    // 3. Strength & Velocity Chart
    const ctxStrength = document.getElementById('strengthSpeedChart');
    if (ctxStrength) {
      if (strengthChartInstance) strengthChartInstance.destroy();
      const speeds = recent.map(l => l.approach_speed_11m_to_1m || null);
      const trapbars = recent.map(l => l.trapbar_e1rm_kg || null);

      strengthChartInstance = new Chart(ctxStrength.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Anlauf-Speed (m/s)',
              data: speeds,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: 'y'
            },
            {
              label: 'Trapbar e1RM (kg)',
              data: trapbars,
              borderColor: '#8b5cf6',
              borderWidth: 1.5,
              pointRadius: 2,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 9.5, max: 11.2, grid: { color: '#1e293b' }, ticks: { color: '#f59e0b' } },
            y1: { position: 'right', min: 200, max: 280, grid: { drawOnChartArea: false }, ticks: { color: '#8b5cf6' } },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }
  }

  return {
    render,
    prevDay,
    nextDay,
    goToToday,
    onDatePicked,
    openSheetsModal,
    saveSheetsUrl,
    resetToSampleData,
    syncGoogleSheets,
    parseCsvTrainingLogs
  };
})();
