/**
 * Tab 1: Whoop 4.0 Daily Readiness Cockpit & 64-Variable Training Analytics (v7.0)
 * Includes:
 * - Whoop 3-Dial Cockpit: Recovery Score (%), Sleep Performance (%), Day Strain (0-21) [Rings start at 12 o'clock]
 * - Centered Whoop Date Switcher with Direct Native Calendar Picker (showPicker)
 * - 1–4 Subjective Training Scores Scale (1 = Schlecht/Keine, 2 = Normal/Wenig, 3 = Gut/Mittel, 4 = Super/Stark)
 * - Statistical Correlation Engine:
 *   - Auto-detects 0/1 binary variables (Supplements, Regeneration, Sleep, Trainer) vs. continuous variables
 *   - Renders Grouped Mean Comparison Bar/Point Chart (Nein vs. Ja) for 0/1 variables and Scatter + Linear Trendline for continuous pairs
 *   - Computes Point-Biserial r_pb, Group Mean Delta (Δ), Welch's t / Cohen's d effect size, and Next-Day Recovery Lag (t+1)
 * - OSP Strength & Diagnostics Progression:
 *   - Mode Switcher: Absolut (kg) | Relativ (x BW / Kraft-Last-Verhältnis) | % Entwicklung (Δ%)
 *   - 4-Lift Focus Radar Cards with automatic ≥5% drop warning badges
 *   - 16 Diagnostic & Biomechanic KPI Tiles with Δ% development badges & relative force metrics
 */
const AnalyticsModule = (() => {
  let scatterChartInstance = null;
  let weightChartInstance = null;
  let strengthChartInstance = null;
  let scoresChartInstance = null;
  let initializedSelectors = false;

  // Selected date state (defaults to latest log date)
  let currentSelectedDate = '2026-10-15';

  // Modal intervals
  let currentWeightInterval = 'ALL';
  let currentScoresInterval = 'ALL';

  // Insight calendar modal state (365-day heatmap)
  let currentInsightItem = '';
  let currentInsightType = 'regeneration'; // 'supplement' | 'regeneration'
  let currentInsightYear = '2026';

  // Strength chart state
  let currentStrengthInterval = 'ALL';
  let currentStrengthExercise = 'ALL'; // 'ALL' | 'umsetzen' | 'hipthrust' | 'trapbar' | 'aufsteiger'
  let currentStrengthMode = 'ABS'; // 'ABS' | 'REL' | 'PCT'

  function isLightTheme() {
    return document.documentElement.classList.contains('light-theme');
  }

  function getChartColors() {
    const light = isLightTheme();
    return {
      grid: light ? 'rgba(148, 163, 184, 0.25)' : '#1e293b',
      ticks: light ? '#334155' : '#94a3b8',
      title: light ? '#0f172a' : '#cbd5e1',
      legend: light ? '#1e293b' : '#cbd5e1'
    };
  }

  // Helper: Parse 1-4 score from string ("1 - Schlecht", "3 - Gut", "4 - Super", etc.) or number
  function parseScore1to4(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      if (isNaN(v)) return null;
      return Math.max(1, Math.min(4, Math.round(v)));
    }
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^([1-4])\b/) || s.match(/\b([1-4])\b/);
    if (m) return parseInt(m[1], 10);
    const low = s.toLowerCase();
    if (low.includes('schlecht') || low.includes('keine')) return 1;
    if (low.includes('normal') || low.includes('wenig')) return 2;
    if (low.includes('gut') || low.includes('mittel')) return 3;
    if (low.includes('super') || low.includes('stark') || low.includes('sehr')) return 4;
    const num = parseFloat(s);
    if (!isNaN(num)) return Math.max(1, Math.min(4, Math.round(num)));
    return null;
  }

  function formatScoreLabel1to4(score, type = 'perf') {
    if (score == null || isNaN(score)) return '-';
    const s = Math.round(score);
    if (type === 'pain') {
      const map = { 1: '1 - Keine', 2: '2 - Wenig', 3: '3 - Mittel', 4: '4 - Stark' };
      return map[s] || `${s}/4`;
    }
    if (type === 'fatigue') {
      const map = { 1: '1 - Keine', 2: '2 - Wenig', 3: '3 - Mittel', 4: '4 - Stark' };
      return map[s] || `${s}/4`;
    }
    const map = { 1: '1 - Schlecht', 2: '2 - Normal', 3: '3 - Gut', 4: '4 - Super' };
    return map[s] || `${s}/4`;
  }

  function init() {
    const savedUrl = localStorage.getItem('googleSheetsCsvUrl');
    const label = document.getElementById('sheetsSyncLabel');
    const dot = document.getElementById('sheetsSyncDot');

    if (savedUrl) {
      if (label) label.textContent = 'Google Sheets (Live)';
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    } else {
      if (label) label.textContent = 'Lokale DB (Synchronisiert)';
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-cyan-400';
    }
  }

  function render(state) {
    init();

    const logs = state.trainingLogs || [];
    if (logs.length > 0) {
      const dates = logs.map(l => l.date).filter(Boolean).sort();
      if (dates.length > 0 && !dates.includes(currentSelectedDate)) {
        // Default to latest date with an actual entry or latest date in logs
        const latestWithSession = logs.filter(l => (l.duration_min && l.duration_min > 0) || l.whoop_recovery_pct != null || l.body_weight_kg != null).slice(-1)[0];
        currentSelectedDate = latestWithSession ? latestWithSession.date : dates[dates.length - 1];
      }
    }

    renderDailyWhoopCockpit(state);
    renderDailyTrainingSessions(state);
    renderDailyJournal(state);
    renderStatsSummary(state);
    renderCorrelationExplorer(state);
    renderStrengthDiagnosticsChart(state);
  }

  // ================= WHOOP 3-DIAL COCKPIT & DIRECT CENTERED DATE SWITCHER =================
  function renderDailyWhoopCockpit(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.whoop_recovery_pct != null) || dayLogs[0] || logs.slice(-1)[0] || {};

    const dateLabel = document.getElementById('trainingDateLabel');
    const dateSub = document.getElementById('trainingDateSub');
    const dateDisplayLegacy = document.getElementById('selectedTrainingDayDisplay');
    const dateInput = document.getElementById('trainingDatePicker');

    if (dateInput) {
      dateInput.value = currentSelectedDate;
    }

    const d = new Date(currentSelectedDate + 'T12:00:00');
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const dayName = isNaN(d.getDay()) ? '' : days[d.getDay()];
    const dayNum = isNaN(d.getDate()) ? '' : d.getDate();
    const monthName = isNaN(d.getMonth()) ? '' : months[d.getMonth()];
    const year = isNaN(d.getFullYear()) ? '' : d.getFullYear();

    const latestAvailableDate = logs.length > 0 ? logs[logs.length - 1].date : '2026-10-15';
    const isToday = currentSelectedDate === latestAvailableDate || currentSelectedDate === new Date().toISOString().split('T')[0];

    if (dateLabel) {
      dateLabel.innerHTML = `📅 ${dayName}, ${dayNum}. ${monthName} ${year}`;
    }
    if (dateSub) {
      dateSub.textContent = isToday ? 'Aktuellster Eintrag • Klick für Kalender' : 'Klick für direkte Kalender-Auswahl';
    }
    if (!dateLabel && dateDisplayLegacy) {
      dateDisplayLegacy.innerHTML = `<span>📅 ${dayName}, ${dayNum}. ${monthName} ${year}</span> ${isToday ? '<span class="text-cyan-400 font-bold ml-1">(Aktuell)</span>' : ''}`;
    }

    // Real Whoop & Sheet Metrics
    const recovery = currentLog.whoop_recovery_pct != null ? currentLog.whoop_recovery_pct : 74;
    const sleepPerf = currentLog.sleep_performance_pct != null ? currentLog.sleep_performance_pct : 91;
    const strain = currentLog.whoop_strain != null ? currentLog.whoop_strain : (currentLog.duration_min > 0 ? (currentLog.duration_min > 60 ? 14.8 : 9.5) : 0.0);

    // 1. Recovery Ring & Val (Middle Dial)
    const elRec = document.getElementById('whoopRecoveryVal');
    const recRing = document.getElementById('recoveryRingSvg');
    const recStatus = document.getElementById('whoopRecoveryStatus');

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

    // 2. Sleep Ring & Val (Left Dial)
    const elSleepPerf = document.getElementById('whoopSleepPerfVal');
    const sleepRing = document.getElementById('sleepRingSvg');
    const elSleep = document.getElementById('whoopSleepVal');

    if (elSleepPerf) elSleepPerf.textContent = sleepPerf + '%';
    if (sleepRing) sleepRing.setAttribute('stroke-dasharray', `${sleepPerf}, 100`);
    if (elSleep) {
      elSleep.textContent = `${sleepPerf}% Performance`;
    }

    // 3. Strain Ring & Val (Right Dial)
    const elStrain = document.getElementById('whoopStrainVal');
    const strainRing = document.getElementById('strainRingSvg');
    const strainCat = document.getElementById('whoopStrainCategory');

    if (elStrain) elStrain.textContent = typeof strain === 'number' ? strain.toFixed(1) : strain;
    if (strainRing) {
      const strainPct = Math.min(100, Math.round(((parseFloat(strain) || 0) / 21) * 100));
      strainRing.setAttribute('stroke-dasharray', `${strainPct}, 100`);
    }

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
  }

  function triggerDirectDatePicker(evt) {
    if (evt) evt.stopPropagation();
    const dateInput = document.getElementById('trainingDatePicker');
    if (dateInput) {
      dateInput.value = currentSelectedDate;
      try {
        if (typeof dateInput.showPicker === 'function') {
          dateInput.showPicker();
          return;
        }
      } catch (err) {
        // Fallback if browser blocks showPicker
      }
      dateInput.focus();
      dateInput.click();
    } else {
      openDatePickerModal();
    }
  }

  // ================= TRAINING SESSIONS =================
  function renderDailyTrainingSessions(state) {
    const container = document.getElementById('dailyTrainingSessionsContainer');
    const badge = document.getElementById('trainingSessionsCountBadge');
    if (!container) return;

    const logs = state.trainingLogs || [];
    const daySessions = logs.filter(l => l.date === currentSelectedDate);
    const primaryLog = daySessions[0] || logs.slice(-1)[0] || {};

    const isRest = daySessions.length === 0 || (daySessions.length === 1 && (primaryLog.duration_min === 0 || (primaryLog.session_type || '').includes('Regeneration') || (primaryLog.session_type || '').includes('Ruhetag')));

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

    const sessionsToRender = daySessions.length > 0 ? daySessions : [primaryLog];

    container.innerHTML = sessionsToRender.map((log, sIdx) => {
      let typeBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
      if ((log.session_type || '').includes('Sprung')) {
        typeBadge = 'bg-amber-950 text-amber-300 border-amber-700';
      } else if ((log.session_type || '').includes('Kraft')) {
        typeBadge = 'bg-emerald-950 text-emerald-300 border-emerald-700';
      } else if ((log.session_type || '').includes('Sprint')) {
        typeBadge = 'bg-purple-950 text-purple-300 border-purple-700';
      }

      const protocolText = log.protocol_text || log.protocol || '';
      const trainerText = log.trainer ? '👨‍🏫 Trainer: Ja' : 'Trainer: Nein';
      const trainerBadge = log.trainer
        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
        : 'bg-slate-900 text-slate-400 border-slate-800';

      const pScore = log.performance_score != null ? log.performance_score : parseScore1to4(log.leistung);
      const fScore = log.focus_score != null ? log.focus_score : parseScore1to4(log.focus);
      const painVal = log.pain_score != null ? log.pain_score : parseScore1to4(log.schmerzen);
      const fatVal = log.fatigue_score != null ? log.fatigue_score : parseScore1to4(log.erschöpfung);

      return `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <!-- Session Header & Meta Information -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div class="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
              ${sessionsToRender.length > 1 ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white">Einheit ${sIdx + 1}</span>` : ''}
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase border ${typeBadge}">
                ${log.session_type || 'Training'}
              </span>
              ${log.time_of_day ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-cyan-300 border border-slate-800">🕒 ${log.time_of_day}</span>` : ''}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${trainerBadge}">
                ${trainerText}
              </span>
              <span class="font-bold text-white text-xs">
                ⏱️ ${log.duration_min || 90} Min.
              </span>
              ${log.venue ? `<span class="text-cyan-400 font-bold">📍 ${log.venue}</span>` : ''}
              ${log.weather ? `<span class="text-slate-400 text-[10px]">🌤️ ${log.weather}</span>` : ''}
            </div>

            <!-- Performance Numbers & Zubringer -->
            <div class="flex items-center gap-2 text-[11px] font-mono flex-wrap">
              ${log.best_mark_m ? `<span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">WK: ${log.best_mark_m}m</span>` : ''}
              ${log.eff_mark_m ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">Effektiv: ${log.eff_mark_m}m</span>` : ''}
              ${log.approach_speed_11m_to_1m ? `<span class="text-cyan-300">Vmax: <strong>${log.approach_speed_11m_to_1m} m/s</strong></span>` : ''}
              ${log.rsi_score ? `<span class="text-amber-300">RSI: <strong>${log.rsi_score}</strong></span>` : ''}
              ${log.trapbar_e1rm_kg ? `<span class="text-purple-300">Trapbar: <strong>${log.trapbar_e1rm_kg} kg</strong></span>` : ''}
              ${log.umsetzen_e1rm_kg ? `<span class="text-amber-300">Umsetzen: <strong>${log.umsetzen_e1rm_kg} kg</strong></span>` : ''}
              ${log.hipthrust_e1rm_kg ? `<span class="text-rose-300">Hip-Thrust: <strong>${log.hipthrust_e1rm_kg} kg</strong></span>` : ''}
              ${log.aufsteiger_e1rm_kg ? `<span class="text-emerald-300">Aufsteiger: <strong>${log.aufsteiger_e1rm_kg} kg</strong></span>` : ''}
            </div>
          </div>

          <!-- Session Attribute Matrix (1-4 Scale): Leistung, Fokus, Schmerzen, Erschöpfung, Tagesform -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Leistung (1-4)</span>
              <span class="text-emerald-300 font-black text-xs">${log.leistung || formatScoreLabel1to4(pScore, 'perf')}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Fokus (1-4)</span>
              <span class="text-cyan-300 font-bold text-xs truncate block" title="${log.focus || ''}">${log.focus || formatScoreLabel1to4(fScore, 'perf')}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Schmerzen (1-4)</span>
              <span class="text-amber-300 font-bold text-xs">${log.schmerzen || formatScoreLabel1to4(painVal || 1, 'pain')}${log.schmerzbereiche ? ` (${log.schmerzbereiche})` : ''}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Erschöpfung (1-4)</span>
              <span class="text-rose-300 font-bold text-xs">${log.erschöpfung || formatScoreLabel1to4(fatVal || 2, 'fatigue')}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg col-span-2 sm:col-span-1">
              <span class="text-slate-400 uppercase block font-bold">Tagesform</span>
              <span class="text-emerald-300 font-bold text-xs truncate block" title="${log.daily_form || log.tagesform || ''}">${log.daily_form || log.tagesform || 'Frisch'}</span>
            </div>
          </div>

          <!-- Documented Training Protocol -->
          ${protocolText ? `
            <div class="bg-slate-900/80 border border-slate-800/90 rounded-lg p-3 space-y-1.5">
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
            <div class="p-2.5 bg-slate-900/40 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 italic">
              Kein Freitext-Protokoll für diese Einheit hinterlegt.
            </div>
          `}

          <!-- Problems & Learnings -->
          ${(log.problems || log.probleme || log.learnings) ? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              ${(log.problems || log.probleme) ? `
                <div class="p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 flex items-start gap-2">
                  <span class="text-sm">⚠️</span>
                  <div>
                    <strong class="text-rose-200 block text-[10px] uppercase font-bold">Probleme & Herausforderungen</strong>
                    <span>${log.problems || log.probleme}</span>
                  </div>
                </div>
              ` : ''}
              ${log.learnings ? `
                <div class="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 flex items-start gap-2">
                  <span class="text-sm">💡</span>
                  <div>
                    <strong class="text-amber-200 block text-[10px] uppercase font-bold">Learnings & Erkenntnisse</strong>
                    <span>${log.learnings}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('<div class="h-2"></div>');
  }

  // ================= DAILY JOURNAL (WEIGHT, NUTRITION, 1-4 SCORES, NOTES, CHIPS) =================
  function renderDailyJournal(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.body_weight_kg != null || l.athlete_comments) || dayLogs[0] || logs.slice(-1)[0] || {};

    // Carry-forward weight if today has no weigh-in
    const latestWeightLog = logs.filter(l => l.date <= currentSelectedDate && l.body_weight_kg != null).slice(-1)[0] || currentLog;

    // 1. Clean Weight & KFA Tile
    const elWeight = document.getElementById('journalWeightVal');
    const elWeightSub = document.getElementById('journalWeightSub');
    if (elWeight) {
      const w = currentLog.body_weight_kg != null
        ? `${currentLog.body_weight_kg.toFixed(2)} kg`
        : (latestWeightLog && latestWeightLog.body_weight_kg != null ? `${latestWeightLog.body_weight_kg.toFixed(2)} kg` : '82.65 kg');
      elWeight.textContent = w;
    }
    if (elWeightSub) {
      const fatVal = currentLog.body_fat_pct != null ? currentLog.body_fat_pct : (latestWeightLog ? latestWeightLog.body_fat_pct : null);
      const fat = fatVal != null ? `${fatVal.toFixed(1)}% KFA` : '12.5% KFA';
      elWeightSub.textContent = fat;
    }

    // 2. Nutrition Tile (Real Google Sheets: calories_kcal, carbs_g, fat_g, protein_g, nutrition)
    const elNutr = document.getElementById('journalNutritionVal');
    const elMacros = document.getElementById('journalNutritionMacros');
    if (elNutr) {
      if (currentLog.calories_kcal) {
        elNutr.textContent = `${currentLog.calories_kcal.toLocaleString('de-DE')} kcal`;
      } else {
        elNutr.textContent = currentLog.nutrition ? currentLog.nutrition : 'Nicht getrackt';
      }
    }
    if (elMacros) {
      const p = currentLog.protein_g ? `${Math.round(currentLog.protein_g)}g P` : null;
      const f = currentLog.fat_g ? `${Math.round(currentLog.fat_g)}g F` : null;
      const c = currentLog.carbs_g ? `${Math.round(currentLog.carbs_g)}g C` : null;

      const parts = [c, f, p].filter(Boolean);
      if (parts.length > 0) {
        elMacros.textContent = parts.join(' • ');
      } else if (currentLog.nutrition && !currentLog.calories_kcal) {
        elMacros.textContent = 'Mahlzeiten dokumentiert';
      } else {
        elMacros.textContent = 'Hydration & Makros offen';
      }
    }

    // 3. Training Scores Tile (1-4 Scale: Fokus, Leistung, Erschöpfung, Schmerzen)
    const elScores = document.getElementById('journalScoresVal');
    if (elScores) {
      const perf = currentLog.performance_score != null ? currentLog.performance_score : parseScore1to4(currentLog.leistung);
      const focus = currentLog.focus_score != null ? currentLog.focus_score : parseScore1to4(currentLog.focus);
      const pain = currentLog.pain_score != null ? currentLog.pain_score : parseScore1to4(currentLog.schmerzen);
      const fatigue = currentLog.fatigue_score != null ? currentLog.fatigue_score : parseScore1to4(currentLog.erschöpfung);

      const pStr = perf != null ? `${perf}/4` : '-';
      const fStr = focus != null ? `${focus}/4` : '-';
      const painStr = pain != null ? `${pain}/4` : '1/4';
      const fatStr = fatigue != null ? `${fatigue}/4` : '-';
      elScores.textContent = `Fokus: ${fStr} • Leistung: ${pStr} • Schmerzen: ${painStr} • Erschöpfung: ${fatStr}`;
    }

    // 4. Notes Tile (Tagesform, Probleme, Learnings, Schlaf, Sozial)
    const elNotes = document.getElementById('journalNotesVal');
    if (elNotes) {
      const parts = [];
      if (currentLog.tagesform) parts.push(`Tagesform: ${currentLog.tagesform}`);
      if (currentLog.learnings) parts.push(`Learning: ${currentLog.learnings}`);
      if (currentLog.probleme) parts.push(`Problem: ${currentLog.probleme}`);
      if (currentLog.schlaf_notiz) parts.push(`Schlaf: ${currentLog.schlaf_notiz}`);
      if (currentLog.sozial) parts.push(`Sozial: ${currentLog.sozial}`);

      if (parts.length > 0) {
        elNotes.textContent = parts.join(' • ');
      } else {
        elNotes.textContent = `Tagesform: ${currentLog.daily_form || 'Fokussiert'} • Planmäßige Vorbereitung`;
      }
    }

    // 5. Extract all unique Supplements dynamically from entire Google Sheets dataset
    const suppContainer = document.getElementById('journalSupplementsContainer');
    if (suppContainer) {
      const suppCounts = {};
      logs.forEach(l => {
        if (l.supplements) {
          l.supplements.split(/[,;+•]/).forEach(item => {
            const clean = item.trim();
            if (clean && clean.length > 1 && clean.length < 30) {
              suppCounts[clean] = (suppCounts[clean] || 0) + 1;
            }
          });
        }
      });

      const todaySuppItems = (currentLog.supplements || '').split(/[,;+•]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const uniqueSupps = Object.keys(suppCounts).sort((a, b) => suppCounts[b] - suppCounts[a]);

      suppContainer.innerHTML = uniqueSupps.map(item => {
        const isTakenToday = todaySuppItems.includes(item.toLowerCase());
        const styleClasses = isTakenToday
          ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-bold shadow-sm shadow-cyan-950'
          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white';

        return `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'supplement')" class="px-2 py-1 rounded-lg border text-[10px] font-mono transition-all flex items-center gap-1 ${styleClasses}" title="${suppCounts[item]}x in Google Sheets dokumentiert">
            <span>💊</span>
            <span>${item}</span>
            ${isTakenToday ? '<span class="text-cyan-400 font-black ml-0.5">✓</span>' : ''}
          </button>
        `;
      }).join('');
    }

    // 6. Extract all unique Regeneration measures dynamically from entire Google Sheets dataset
    const regenContainer = document.getElementById('journalRegenerationContainer');
    if (regenContainer) {
      const regenCounts = {};
      logs.forEach(l => {
        if (l.regeneration) {
          l.regeneration.split(/[,;+•]/).forEach(item => {
            const clean = item.trim();
            if (clean && clean.length > 1 && clean.length < 30) {
              regenCounts[clean] = (regenCounts[clean] || 0) + 1;
            }
          });
        }
      });

      const todayRegenItems = (currentLog.regeneration || '').split(/[,;+•]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const uniqueRegens = Object.keys(regenCounts).sort((a, b) => regenCounts[b] - regenCounts[a]);

      regenContainer.innerHTML = uniqueRegens.map(item => {
        const isDoneToday = todayRegenItems.includes(item.toLowerCase());
        const styleClasses = isDoneToday
          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 font-bold shadow-sm shadow-emerald-950'
          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white';

        return `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'regeneration')" class="px-2 py-1 rounded-lg border text-[10px] font-mono transition-all flex items-center gap-1 ${styleClasses}" title="${regenCounts[item]}x in Google Sheets dokumentiert">
            <span>🧊</span>
            <span>${item}</span>
            ${isDoneToday ? '<span class="text-emerald-400 font-black ml-0.5">✓</span>' : ''}
          </button>
        `;
      }).join('');
    }
  }

  // ================= DATE PICKER MODAL & NAVIGATION =================
  function openDatePickerModal() {
    const modal = document.getElementById('datePickerModal');
    const input = document.getElementById('modalDatePickerInput');
    if (input) input.value = currentSelectedDate;
    if (modal) modal.classList.remove('hidden');
  }

  function applyModalPickedDate() {
    const input = document.getElementById('modalDatePickerInput');
    if (input && input.value) {
      onDatePicked(input.value);
    }
    const modal = document.getElementById('datePickerModal');
    if (modal) modal.classList.add('hidden');
  }

  function prevDay() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    const dates = Array.from(new Set(logs.map(l => l.date).filter(Boolean))).sort();
    const idx = dates.indexOf(currentSelectedDate);
    if (idx > 0) {
      currentSelectedDate = dates[idx - 1];
    } else {
      const d = new Date(currentSelectedDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      currentSelectedDate = d.toISOString().split('T')[0];
    }
    if (window.App && window.App.state) render(window.App.state);
  }

  function nextDay() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    const dates = Array.from(new Set(logs.map(l => l.date).filter(Boolean))).sort();
    const idx = dates.indexOf(currentSelectedDate);
    if (idx >= 0 && idx < dates.length - 1) {
      currentSelectedDate = dates[idx + 1];
    } else {
      const d = new Date(currentSelectedDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      currentSelectedDate = d.toISOString().split('T')[0];
    }
    if (window.App && window.App.state) render(window.App.state);
  }

  function goToToday() {
    const logs = (window.App && window.App.state && window.App.state.trainingLogs) || [];
    const latestWithData = logs.filter(l => (l.duration_min && l.duration_min > 0) || l.whoop_recovery_pct != null || l.body_weight_kg != null).slice(-1)[0];
    currentSelectedDate = latestWithData ? latestWithData.date : '2026-10-15';
    if (window.App && window.App.state) render(window.App.state);
  }

  function onDatePicked(val) {
    if (!val) return;
    currentSelectedDate = val;
    if (window.App && window.App.state) render(window.App.state);
  }

  // ================= BODY WEIGHT MODAL =================
  function openWeightModal(interval = 'ALL') {
    const modal = document.getElementById('weightHistoryModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setWeightInterval(interval);
  }

  function setWeightInterval(interval) {
    currentWeightInterval = interval;
    ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'].forEach(k => {
      const btn = document.getElementById(`weightBtn${k}`);
      if (btn) {
        if (k === interval) {
          btn.className = 'px-2 py-0.5 rounded bg-cyan-600 text-slate-950 font-black transition-all';
        } else {
          btn.className = 'px-2 py-0.5 rounded text-slate-400 hover:text-white transition-all';
        }
      }
    });

    renderWeightChart();
  }

  function renderWeightChart() {
    const canvas = document.getElementById('modalWeightChart');
    if (!canvas) return;

    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];

    const refDate = new Date((currentSelectedDate || '2026-10-15') + 'T12:00:00');
    const dayOffsets = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '3Y': 1095,
      '5Y': 1825,
      'ALL': 99999
    };
    const maxDays = dayOffsets[currentWeightInterval] || 99999;
    const minTime = refDate.getTime() - maxDays * 86400000;

    const weightLogs = logs.filter(l => {
      if (l.body_weight_kg == null) return false;
      const t = new Date(l.date).getTime();
      return !isNaN(t) && t >= minTime;
    });

    const countBadge = document.getElementById('weightDataCountBadge');
    const curValEl = document.getElementById('modalWeightCurrent');
    const minMaxEl = document.getElementById('modalWeightMinMax');
    const avgEl = document.getElementById('modalWeightAvg');
    const deltaEl = document.getElementById('modalWeightDelta');

    if (weightLogs.length > 0) {
      const weights = weightLogs.map(l => l.body_weight_kg);
      const minW = Math.min(...weights);
      const maxW = Math.max(...weights);
      const avgW = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
      const curW = weights[weights.length - 1].toFixed(2);
      const firstW = weights[0];
      const deltaW = (weights[weights.length - 1] - firstW).toFixed(1);

      if (countBadge) countBadge.textContent = `${weightLogs.length} Messwerte (${currentWeightInterval})`;
      if (curValEl) curValEl.textContent = `${curW} kg`;
      if (minMaxEl) minMaxEl.textContent = `${minW.toFixed(1)} / ${maxW.toFixed(1)} kg`;
      if (avgEl) avgEl.textContent = `${avgW} kg`;
      if (deltaEl) deltaEl.textContent = `${deltaW > 0 ? '+' : ''}${deltaW} kg`;
    }

    const colors = getChartColors();
    if (weightChartInstance) weightChartInstance.destroy();

    weightChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: weightLogs.map(l => l.date),
        datasets: [
          {
            label: 'Körpergewicht (kg)',
            data: weightLogs.map(l => l.body_weight_kg),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            borderWidth: 2,
            pointRadius: weightLogs.length > 60 ? 1 : 3,
            pointBackgroundColor: '#06b6d4',
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.ticks, maxTicksLimit: 12 } },
          y: { grid: { color: colors.grid }, ticks: { color: '#06b6d4' }, suggestedMin: 76, suggestedMax: 86 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Gewicht: ${ctx.raw} kg`
            }
          }
        }
      }
    });
  }

  // ================= TRAINING SCORES HISTORY MODAL (1-4 SCALE) =================
  function openScoresHistoryModal(interval = 'ALL') {
    const modal = document.getElementById('trainingScoresModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setScoresInterval(interval);
  }

  function setScoresInterval(interval) {
    currentScoresInterval = interval;
    ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'].forEach(k => {
      const btn = document.getElementById(`scoresBtn${k}`);
      if (btn) {
        if (k === interval) {
          btn.className = 'px-2 py-0.5 rounded bg-cyan-600 text-slate-950 font-black transition-all';
        } else {
          btn.className = 'px-2 py-0.5 rounded text-slate-400 hover:text-white transition-all';
        }
      }
    });
    renderScoresChart();
  }

  function renderScoresChart() {
    const canvas = document.getElementById('modalScoresChart');
    if (!canvas) return;

    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];
    const refDate = new Date((currentSelectedDate || '2026-10-15') + 'T12:00:00');
    const dayOffsets = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '3Y': 1095,
      '5Y': 1825,
      'ALL': 99999
    };
    const maxDays = dayOffsets[currentScoresInterval] || 99999;
    const minTime = refDate.getTime() - maxDays * 86400000;

    const scoreLogs = logs.filter(l => {
      const p = l.performance_score != null ? l.performance_score : parseScore1to4(l.leistung);
      const f = l.focus_score != null ? l.focus_score : parseScore1to4(l.focus);
      const e = l.fatigue_score != null ? l.fatigue_score : parseScore1to4(l.erschöpfung);
      const s = l.pain_score != null ? l.pain_score : parseScore1to4(l.schmerzen);
      if (p == null && f == null && e == null && s == null) return false;
      const t = new Date(l.date).getTime();
      return !isNaN(t) && t >= minTime;
    });

    const badge = document.getElementById('scoresDataCountBadge');
    if (badge) badge.textContent = `${scoreLogs.length} Einträge (${currentScoresInterval})`;

    const labels = scoreLogs.map(l => l.date);
    const perfData = scoreLogs.map(l => l.performance_score != null ? Math.min(4, Math.max(1, l.performance_score)) : parseScore1to4(l.leistung));
    const focusData = scoreLogs.map(l => l.focus_score != null ? Math.min(4, Math.max(1, l.focus_score)) : parseScore1to4(l.focus));
    const exhaustData = scoreLogs.map(l => l.fatigue_score != null ? Math.min(4, Math.max(1, l.fatigue_score)) : parseScore1to4(l.erschöpfung));
    const painData = scoreLogs.map(l => l.pain_score != null ? Math.min(4, Math.max(1, l.pain_score)) : parseScore1to4(l.schmerzen));

    const colors = getChartColors();
    if (scoresChartInstance) scoresChartInstance.destroy();
    scoresChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Leistung (1=Schlecht .. 4=Super)',
            data: perfData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1.5 : 3,
            spanGaps: true,
            tension: 0.15
          },
          {
            label: 'Fokus (1=Schlecht .. 4=Super)',
            data: focusData,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1.5 : 3,
            spanGaps: true,
            tension: 0.15
          },
          {
            label: 'Erschöpfung (1=Keine .. 4=Stark)',
            data: exhaustData,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1.5 : 3,
            spanGaps: true,
            tension: 0.15
          },
          {
            label: 'Schmerzen (1=Keine .. 4=Stark)',
            data: painData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1.5 : 3,
            spanGaps: true,
            tension: 0.15
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.ticks, maxTicksLimit: 12 } },
          y: {
            grid: { color: colors.grid },
            min: 1,
            max: 4,
            ticks: {
              color: colors.title,
              stepSize: 1,
              callback: (v) => {
                const map = {
                  1: '1 (Schlecht / Keine)',
                  2: '2 (Normal / Wenig)',
                  3: '3 (Gut / Mittel)',
                  4: '4 (Super / Stark)'
                };
                return map[v] || v;
              }
            }
          }
        },
        plugins: {
          legend: { labels: { color: colors.legend, font: { size: 11, family: 'monospace' } } }
        }
      }
    });
  }

  // ================= 365-DAY HEATMAP & RECOVERY INSIGHT MODAL =================
  function openInsightModal(item, type = 'regeneration') {
    currentInsightItem = item;
    currentInsightType = type;
    const modal = document.getElementById('insightCalendarModal');
    if (!modal) return;

    const badge = document.getElementById('insightModalBadge');
    const title = document.getElementById('insightModalTitle');
    const sub = document.getElementById('insightModalSub');

    if (badge) {
      if (type === 'supplement') {
        badge.className = 'px-2 py-0.5 rounded text-xs font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-800';
        badge.textContent = 'SUPPLEMENT';
      } else {
        badge.className = 'px-2 py-0.5 rounded text-xs font-black font-mono bg-emerald-950 text-emerald-300 border border-emerald-800';
        badge.textContent = 'REGENERATION';
      }
    }

    if (title) title.textContent = `INSIGHTS: ${item.toUpperCase()}`;
    if (sub) sub.textContent = `365-Tage Heatmap & Punktbiseriale Korrelation mit Whoop Recovery Score`;

    const yearSelect = document.getElementById('insightYearSelect');
    if (yearSelect) {
      const years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
      yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === currentInsightYear ? 'selected' : ''}>Jahr ${y}</option>`).join('');
    }

    updateInsightModalStats();
    renderInsightHeatmap();
    renderInsightCalendar();
    modal.classList.remove('hidden');
  }

  function onInsightYearChanged(year) {
    currentInsightYear = year;
    renderInsightHeatmap();
    renderInsightCalendar();
  }

  function updateInsightModalStats() {
    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];
    const q = currentInsightItem.toLowerCase().trim();

    const matchLogs = logs.filter(l => {
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      return targetStr.toLowerCase().includes(q);
    });

    const otherLogs = logs.filter(l => {
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      return !targetStr.toLowerCase().includes(q);
    });

    const recentLogs = matchLogs.filter(l => (l.date || '') >= '2026-09-18');
    const recentPct = Math.min(100, Math.round((recentLogs.length / 30) * 100));

    // Next-day (Tag +1 / Folgetag) recovery comparison within active Whoop + Tag tracking era (>= 2023-05-06)
    const byDate = {};
    logs.forEach(l => { if (l.date) byDate[l.date] = l; });

    const nextDayRecsWith = [];
    const nextDayRecsWithout = [];
    logs.forEach(l => {
      if (!l.date || l.date < '2023-05-06') return;
      const d = new Date(l.date + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      const nextIso = d.toISOString().split('T')[0];
      const nextLog = byDate[nextIso];
      if (!nextLog || nextLog.whoop_recovery_pct == null) return;
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      if (targetStr.toLowerCase().includes(q)) {
        nextDayRecsWith.push(nextLog.whoop_recovery_pct);
      } else {
        nextDayRecsWithout.push(nextLog.whoop_recovery_pct);
      }
    });

    const matchRecs = nextDayRecsWith.length >= 3
      ? nextDayRecsWith
      : matchLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
    const otherRecs = nextDayRecsWithout.length >= 3
      ? nextDayRecsWithout
      : otherLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);

    const avgRec = matchRecs.length > 0
      ? (matchRecs.reduce((a, b) => a + b, 0) / matchRecs.length)
      : 70.0;
    const avgOtherRec = otherRecs.length > 0
      ? (otherRecs.reduce((a, b) => a + b, 0) / otherRecs.length)
      : 68.0;

    const delta = avgRec - avgOtherRec;

    const kpiTotal = document.getElementById('insightKpiTotal');
    const kpiRecent = document.getElementById('insightKpiRecent');
    const kpiRec = document.getElementById('insightKpiRecovery');
    const kpiDelta = document.getElementById('insightKpiDelta');

    if (kpiTotal) kpiTotal.textContent = `${matchLogs.length}x`;
    if (kpiRecent) kpiRecent.textContent = `${recentLogs.length}x (${recentPct}%)`;
    if (kpiRec) kpiRec.textContent = `${avgRec.toFixed(1)}% (Tag +1)`;
    if (kpiDelta) {
      kpiDelta.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      kpiDelta.className = delta >= 0 ? 'text-base font-black text-emerald-300' : 'text-base font-black text-rose-300';
    }
  }

  function renderInsightHeatmap() {
    const grid = document.getElementById('insightHeatmapGrid');
    if (!grid) return;

    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];
    const q = currentInsightItem.toLowerCase().trim();
    const yr = parseInt(currentInsightYear, 10) || 2026;

    const logsByDate = {};
    logs.forEach(l => {
      if (l.date) logsByDate[l.date] = l;
    });

    const start = new Date(yr, 0, 1);
    const end = new Date(yr, 11, 31);

    let cur = new Date(start);
    const dayOfWeek = (cur.getDay() + 6) % 7;
    cur.setDate(cur.getDate() - dayOfWeek);

    const weeks = [];
    while (cur <= end || weeks.length < 52) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${day}`;
        const isInYear = cur.getFullYear() === yr;

        const log = logsByDate[iso] || null;
        let used = false;
        if (log) {
          const targetStr = currentInsightType === 'supplement' ? (log.supplements || '') : (log.regeneration || '');
          used = targetStr.toLowerCase().includes(q);
        }

        week.push({
          iso,
          isInYear,
          used,
          recovery: log ? log.whoop_recovery_pct : null,
          session: log ? (log.session_type || 'Training') : null
        });

        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      if (cur > end && weeks.length >= 52) break;
    }

    const monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const dayLabels = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];

    let html = '<div class="flex items-start gap-2">';
    html += '<div class="flex flex-col gap-1 text-[9px] font-mono text-slate-500 pt-5 pr-1 select-none">';
    dayLabels.forEach(dl => {
      html += `<div class="h-3 flex items-center justify-end">${dl}</div>`;
    });
    html += '</div>';

    html += '<div class="flex-1 overflow-x-auto"><div class="inline-flex flex-col gap-1">';
    html += '<div class="flex gap-1 h-4 text-[9px] font-mono text-slate-400 mb-0.5 select-none">';
    let lastMonth = -1;
    weeks.forEach((w) => {
      const firstDay = w.find(d => d.isInYear);
      if (firstDay) {
        const m = parseInt(firstDay.iso.split('-')[1], 10) - 1;
        if (m !== lastMonth) {
          html += `<div class="w-3 text-left overflow-visible whitespace-nowrap text-cyan-400 font-bold">${monthLabels[m]}</div>`;
          lastMonth = m;
        } else {
          html += '<div class="w-3"></div>';
        }
      } else {
        html += '<div class="w-3"></div>';
      }
    });
    html += '</div>';

    for (let r = 0; r < 7; r++) {
      html += '<div class="flex gap-1">';
      weeks.forEach(w => {
        const day = w[r];
        if (!day.isInYear) {
          html += '<div class="w-3 h-3 rounded-[2px] bg-slate-950 opacity-20"></div>';
        } else if (day.used) {
          const colorClass = currentInsightType === 'supplement'
            ? 'bg-cyan-400 border border-cyan-300 shadow-sm shadow-cyan-400/50'
            : 'bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-400/50';
          const tooltip = `${day.iso}: ${currentInsightItem} aktiv! ${day.recovery != null ? `(Recovery: ${day.recovery}%)` : ''}`;
          html += `<div onclick="AnalyticsModule.onDatePicked('${day.iso}'); document.getElementById('insightCalendarModal').classList.add('hidden');" title="${tooltip}" class="w-3 h-3 rounded-[2px] ${colorClass} cursor-pointer hover:scale-125 transition-transform"></div>`;
        } else if (day.session) {
          const tooltip = `${day.iso}: ${day.session} (ohne ${currentInsightItem})`;
          html += `<div onclick="AnalyticsModule.onDatePicked('${day.iso}'); document.getElementById('insightCalendarModal').classList.add('hidden');" title="${tooltip}" class="w-3 h-3 rounded-[2px] bg-slate-800 border border-slate-700/60 cursor-pointer hover:bg-slate-700 transition-colors"></div>`;
        } else {
          const tooltip = `${day.iso}: Ruhetag`;
          html += `<div title="${tooltip}" class="w-3 h-3 rounded-[2px] bg-slate-950 border border-slate-900"></div>`;
        }
      });
      html += '</div>';
    }

    html += '</div></div></div>';
    html += `
      <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80 mt-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="w-2.5 h-2.5 rounded-[2px] bg-slate-950 border border-slate-900"></span>
          <span>Ruhetag</span>
          <span class="w-2.5 h-2.5 rounded-[2px] bg-slate-800 border border-slate-700 ml-2"></span>
          <span>Training (Nicht genutzt)</span>
          <span class="w-2.5 h-2.5 rounded-[2px] ${currentInsightType === 'supplement' ? 'bg-cyan-400' : 'bg-emerald-400'} ml-2"></span>
          <span class="text-white font-bold">${currentInsightItem} genutzt</span>
        </div>
        <span class="text-slate-500 text-[9px]">Klicke auf Tag für Details</span>
      </div>
    `;

    grid.innerHTML = html;
  }

  function renderInsightCalendar() {
    const container = document.getElementById('insightCalendarGridContainer');
    if (!container) return;

    const state = (window.App && window.App.state) || {};
    const logs = state.trainingLogs || [];
    const q = currentInsightItem.toLowerCase().trim();

    const yearMatches = logs.filter(l => {
      if (!l.date || !l.date.startsWith(currentInsightYear)) return false;
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      return targetStr.toLowerCase().includes(q);
    });

    if (yearMatches.length === 0) {
      container.innerHTML = `
        <div class="py-6 text-center text-slate-500 font-mono text-xs italic">
          Keine protokollierten Einträge für "${currentInsightItem}" im Jahr ${currentInsightYear} gefunden.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="divide-y divide-slate-800/60 font-mono text-xs">
        ${yearMatches.slice(-20).reverse().map(m => `
          <div class="py-1.5 px-2 flex items-center justify-between hover:bg-slate-900/60 rounded transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-cyan-400 font-bold">${m.date}</span>
              <span class="text-[10px] text-slate-400">${m.weekday || ''}</span>
              ${m.session_type ? `<span class="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 border border-slate-800 text-slate-300">${m.session_type}</span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              ${m.whoop_recovery_pct != null ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                  m.whoop_recovery_pct >= 67 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  m.whoop_recovery_pct >= 34 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-rose-950 text-rose-300 border border-rose-800'
                }">
                  ${m.whoop_recovery_pct}% Recovery
                </span>
              ` : ''}
              <button onclick="AnalyticsModule.onDatePicked('${m.date}'); document.getElementById('insightCalendarModal').classList.add('hidden');" class="text-cyan-400 hover:text-cyan-300 text-[10px] underline">
                Tag anzeigen ➔
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ================= CORRELATION EXPLORER (0/1 POINT-BISERIAL + TAG+1 STANDARD + 14D TREND) =================
  function onCorrelationParamChanged() {
    const state = (window.App && window.App.state) || {};
    updateCorrelationScatter(state);
    renderCorrelationMatrixTable(state);
  }

  function renderCorrelationExplorer(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    const selectLag = document.getElementById('corrLagModeSelect');
    if (!selectA || !selectB) return;

    if (!initializedSelectors) {
      selectA.addEventListener('change', () => onCorrelationParamChanged());
      selectB.addEventListener('change', () => onCorrelationParamChanged());
      if (selectLag) selectLag.addEventListener('change', () => onCorrelationParamChanged());
      initializedSelectors = true;
    }

    updateCorrelationScatter(state);
    renderCorrelationMatrixTable(state);
  }

  function isBinaryVarKey(varKey) {
    if (!varKey) return false;
    return (
      varKey.startsWith('supp_') ||
      varKey.startsWith('regen_') ||
      varKey.startsWith('sleep_') ||
      varKey.startsWith('nutr_') ||
      varKey.startsWith('social_') ||
      varKey.startsWith('te_') ||
      varKey === 'prot_fct' ||
      varKey === 'prot_1080' ||
      varKey === 'trainer_anwesend'
    );
  }

  // Determine active tracking start date for each binary category in Google Sheets
  function getCategoryTrackingStartDate(varKey) {
    if (!varKey) return '2019-01-01';
    if (varKey.startsWith('supp_')) return '2023-05-06';
    if (varKey.startsWith('regen_')) return '2023-05-06';
    if (varKey.startsWith('sleep_')) return '2023-05-06';
    if (varKey.startsWith('nutr_')) return '2024-04-16';
    if (varKey.startsWith('social_')) return '2023-05-06';
    if (varKey === 'prot_fct') return '2025-10-01';
    if (varKey === 'prot_1080') return '2021-04-01';
    return '2019-01-01';
  }

  // Smart Lag logic as specified by Luka:
  // - Entries in column 'Schlaf' refer to the SAME day's morning Whoop score -> Tag 0 (lag = 0)
  // - Supplements, Regeneration, Ernährung, Sozial, Trainingseinheit, Strain, Macros refer to NEXT day's morning Whoop score -> Tag +1 (lag = 1)
  function getEffectiveLagMode(varY, varX) {
    const lagSelect = document.getElementById('corrLagModeSelect');
    const mode = (lagSelect && lagSelect.value) ? lagSelect.value : 'smart';
    if (mode === 'rolling14') return { mode: 'rolling14', lagDays: 0, label: '14-Tage Saison-Trend' };
    if (mode === 'lag1') return { mode: 'lag1', lagDays: 1, label: 'Tag +1 (Folgetag)' };
    if (mode === 'lag0') return { mode: 'lag0', lagDays: 0, label: 'Tag 0 (Gleicher Tag)' };

    // mode === 'smart'
    if (varX && varX.startsWith('sleep_')) {
      return { mode: 'smart', lagDays: 0, label: 'Tag 0 (Gleicher Morgen • Schlaf-Spalte)' };
    }
    const isDayInterventionX = (
      isBinaryVarKey(varX) ||
      varX === 'whoop_strain' ||
      varX === 'duration_min' ||
      varX === 'calories_kcal' ||
      varX === 'protein_g' ||
      varX === 'carbs_g' ||
      varX === 'fat_g'
    );
    const isMorningReadinessY = (
      varY === 'whoop_recovery_pct' ||
      varY === 'sleep_performance_pct' ||
      varY === 'body_weight_kg' ||
      varY === 'ref_body_weight_kg'
    );
    if (isDayInterventionX && isMorningReadinessY) {
      return { mode: 'smart', lagDays: 1, label: 'Tag +1 (Folgetag-Wirkung Standard)' };
    }
    return { mode: 'smart', lagDays: 0, label: 'Tag 0 (Direktvergleich)' };
  }

  function hasExactTagInList(csvStr, targetTag) {
    if (!csvStr) return false;
    const tLower = targetTag.toLowerCase().trim();
    return csvStr.split(',').some(part => {
      const p = part.trim().toLowerCase();
      return p === tLower || p.includes(tLower);
    });
  }

  function getMetricValue(log, varKey) {
    if (!log || !varKey) return null;

    if (varKey === 'weitsprung_wk') {
      const m = parseFloat(log.best_mark_m || log.weitsprung_wk);
      return !isNaN(m) && m > 6.0 ? m : null;
    }

    if (varKey === 'ref_body_weight_kg') {
      const w = parseFloat(log.body_weight_kg || log.ref_body_weight_kg);
      return !isNaN(w) && w > 60 ? w : null;
    }

    const minStartDate = getCategoryTrackingStartDate(varKey);
    if ((log.date || '') < minStartDate) return null;

    if (varKey.startsWith('supp_')) {
      const token = varKey.slice(5).replace(/_/g, ' ');
      return hasExactTagInList(log.supplements, token) ? 1 : 0;
    }

    if (varKey.startsWith('regen_')) {
      const token = varKey.slice(6).replace(/_/g, ' ');
      return hasExactTagInList(log.regeneration, token) ? 1 : 0;
    }

    if (varKey.startsWith('sleep_')) {
      const token = varKey.slice(6).replace(/_/g, ' ');
      return hasExactTagInList(log.schlaf_notiz || log.schlaf, token) ? 1 : 0;
    }

    if (varKey.startsWith('nutr_')) {
      if (!log.nutrition) return null; // Only evaluate on days where Ernährung was rated
      const token = varKey.slice(5);
      return (log.nutrition || '').toLowerCase().includes(token.toLowerCase()) ? 1 : 0;
    }

    if (varKey.startsWith('social_')) {
      const token = varKey.slice(7).replace(/_/g, ' ');
      return hasExactTagInList(log.sozial, token) ? 1 : 0;
    }

    if (varKey.startsWith('te_')) {
      const token = varKey.slice(3).replace(/_/g, ' ');
      return hasExactTagInList(log.session_type, token) ? 1 : 0;
    }

    if (varKey === 'prot_fct') {
      const p = (log.protocol_text || '').toLowerCase();
      return (/\bfct\b/.test(p) || p.includes('french contrast')) ? 1 : 0;
    }

    if (varKey === 'prot_1080') {
      const p = (log.protocol_text || '').toLowerCase();
      return p.includes('1080') ? 1 : 0;
    }

    if (varKey === 'trainer_anwesend') {
      if (!log.duration_min && !log.protocol_text) return null;
      return log.trainer ? 1 : 0;
    }

    // 1-4 Scores
    if (varKey === 'performance_score') return log.performance_score != null ? log.performance_score : parseScore1to4(log.leistung);
    if (varKey === 'focus_score') return log.focus_score != null ? log.focus_score : parseScore1to4(log.fokus_label || log.focus);
    if (varKey === 'pain_score') return log.pain_score != null ? log.pain_score : parseScore1to4(log.schmerzen);
    if (varKey === 'fatigue_score') return log.fatigue_score != null ? log.fatigue_score : parseScore1to4(log.erschöpfung);

    const val = parseFloat(log[varKey]);
    return isNaN(val) ? null : val;
  }

  function addCalendarDays(isoDate, deltaDays) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    return d.toISOString().split('T')[0];
  }

  // Statistical engine supporting Smart Tag+1 / Tag 0 AND 14-day Rolling Seasonal Trend
  function computePairStatistics(logs, varY, varX, overrideLagCfg = null) {
    const lagCfg = overrideLagCfg || getEffectiveLagMode(varY, varX);
    const byDate = {};
    logs.forEach(l => { if (l.date) byDate[l.date] = l; });

    const points = [];

    if (lagCfg.mode === 'rolling14') {
      // 14-day rolling window average for long-term seasonal effects
      const sorted = [...logs].filter(l => l.date).sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 13; i < sorted.length; i += 3) { // step by 3 days to avoid excessive autocorrelation
        const windowLogs = sorted.slice(i - 13, i + 1);
        const xValsWin = windowLogs.map(w => getMetricValue(w, varX)).filter(v => v != null && !isNaN(v));
        const yValsWin = windowLogs.map(w => getMetricValue(w, varY)).filter(v => v != null && !isNaN(v));
        if (xValsWin.length >= 4 && yValsWin.length >= 4) {
          const xMean = xValsWin.reduce((a, b) => a + b, 0) / xValsWin.length;
          const yMean = yValsWin.reduce((a, b) => a + b, 0) / yValsWin.length;
          points.push({
            x: isBinaryVarKey(varX) ? Number((xMean * 100).toFixed(1)) : Number(xMean.toFixed(2)),
            y: Number(yMean.toFixed(2)),
            altY: null,
            date: sorted[i].date
          });
        }
      }
    } else {
      const primaryLag = lagCfg.lagDays;
      const altLag = primaryLag === 1 ? 0 : 1;

      logs.forEach(l => {
        if (!l.date) return;
        const x = getMetricValue(l, varX);
        if (x == null || isNaN(x)) return;

        const targetDate = primaryLag === 0 ? l.date : addCalendarDays(l.date, primaryLag);
        const targetLog = byDate[targetDate];
        const y = targetLog ? getMetricValue(targetLog, varY) : null;

        const altDate = altLag === 0 ? l.date : addCalendarDays(l.date, altLag);
        const altLog = byDate[altDate];
        const altY = altLog ? getMetricValue(altLog, varY) : null;

        if (y != null && !isNaN(y)) {
          points.push({
            x,
            y,
            altY,
            date: l.date,
            targetDate
          });
        }
      });
    }

    const n = points.length;
    const isBinaryX = lagCfg.mode !== 'rolling14' && isBinaryVarKey(varX);
    const isBinaryY = lagCfg.mode !== 'rolling14' && isBinaryVarKey(varY);

    if (n < 3) {
      return { n, r: 0, slope: 0, intercept: 0, isBinaryX, isBinaryY, points, lagCfg };
    }

    const xVals = points.map(p => p.x);
    const yVals = points.map(p => p.y);
    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = xVals.reduce((acc, x) => acc + x * x, 0);
    const sumY2 = yVals.reduce((acc, y) => acc + y * y, 0);

    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const r = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const slope = (n * sumX2 - sumX * sumX) === 0 ? 0 : (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    let group0 = [];
    let group1 = [];
    let altGroup0 = [];
    let altGroup1 = [];
    let firstUsedDate = '';
    let lastUsedDate = '';

    if (isBinaryX && !isBinaryY) {
      const g1Pts = points.filter(p => p.x === 1);
      group0 = points.filter(p => p.x === 0).map(p => p.y);
      group1 = g1Pts.map(p => p.y);
      altGroup0 = points.filter(p => p.x === 0 && p.altY != null).map(p => p.altY);
      altGroup1 = g1Pts.filter(p => p.altY != null).map(p => p.altY);
      if (g1Pts.length > 0) {
        firstUsedDate = g1Pts[0].date;
        lastUsedDate = g1Pts[g1Pts.length - 1].date;
      }
    } else if (isBinaryY && !isBinaryX) {
      group0 = points.filter(p => p.y === 0).map(p => p.x);
      group1 = points.filter(p => p.y === 1).map(p => p.x);
    }

    const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const variance = (arr, m) => arr.length > 1 ? arr.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (arr.length - 1) : 0;

    const mean0 = mean(group0);
    const mean1 = mean(group1);
    const sd0 = Math.sqrt(variance(group0, mean0));
    const sd1 = Math.sqrt(variance(group1, mean1));
    const delta = mean1 - mean0;
    const pctDelta = mean0 !== 0 ? ((mean1 - mean0) / Math.abs(mean0)) * 100 : 0;

    const pooledVar = (group0.length + group1.length > 2)
      ? (((group0.length - 1) * sd0 * sd0) + ((group1.length - 1) * sd1 * sd1)) / (group0.length + group1.length - 2)
      : 1;
    const cohensD = pooledVar > 0 ? delta / Math.sqrt(pooledVar) : 0;

    const seWelch = Math.sqrt((group0.length > 0 ? (sd0 * sd0) / group0.length : 0) + (group1.length > 0 ? (sd1 * sd1) / group1.length : 0));
    const welchT = seWelch > 0 ? delta / seWelch : 0;

    const altMean0 = mean(altGroup0);
    const altMean1 = mean(altGroup1);
    const altDelta = (altGroup0.length >= 2 && altGroup1.length >= 2) ? (altMean1 - altMean0) : null;

    return {
      n,
      r,
      slope,
      intercept,
      isBinaryX,
      isBinaryY,
      points,
      lagCfg,
      n0: group0.length,
      n1: group1.length,
      mean0,
      mean1,
      sd0,
      sd1,
      delta,
      pctDelta,
      cohensD,
      welchT,
      altMean0,
      altMean1,
      altDelta,
      firstUsedDate,
      lastUsedDate
    };
  }

  function updateCorrelationScatter(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    const canvas = document.getElementById('corrScatterChart');
    if (!selectA || !selectB || !canvas) return;

    const varA = selectA.value; // Y-Axis (Target)
    const varB = selectB.value; // X-Axis (Factor)
    const logs = state.trainingLogs || [];

    const stats = computePairStatistics(logs, varA, varB);
    const { n, r, slope, intercept, isBinaryX, isBinaryY, points, lagCfg } = stats;

    const modeBadge = document.getElementById('corrChartModeBadge');
    const badge = document.getElementById('corrPearsonVal');
    const statREl = document.getElementById('corrStatR');
    const statDeltaEl = document.getElementById('corrStatDelta');
    const statEffectEl = document.getElementById('corrStatEffect');
    const statLagEl = document.getElementById('corrStatLag');
    const legendContainer = document.getElementById('corrLegendContainer');

    const formattedR = (r >= 0 ? '+' : '') + r.toFixed(2);
    const isBinaryPair = isBinaryX || isBinaryY;
    const primaryLagTag = lagCfg.mode === 'rolling14'
      ? '14-Tage Trend'
      : (lagCfg.lagDays === 1 ? 'Tag +1 (Folgetag)' : 'Tag 0 (Gleicher Tag)');
    const altLagTag = lagCfg.lagDays === 1 ? 'Tag 0 (Gleicher Tag)' : 'Tag +1 (Folgetag)';

    if (modeBadge) {
      if (isBinaryPair) {
        modeBadge.textContent = `0/1 Gruppen-Vergleich • ${primaryLagTag}`;
        modeBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-950 text-purple-300 border border-purple-700';
      } else {
        modeBadge.textContent = `Scatter & Regression • ${primaryLagTag}`;
        modeBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800';
      }
    }

    if (badge) {
      badge.textContent = `${isBinaryPair ? 'r_pb' : 'r'} = ${formattedR} (N=${n})`;
      if (Math.abs(r) >= 0.25) {
        badge.className = r > 0
          ? 'px-2.5 py-1 rounded text-xs font-black font-mono bg-emerald-950 text-emerald-300 border border-emerald-700'
          : 'px-2.5 py-1 rounded text-xs font-black font-mono bg-rose-950 text-rose-300 border border-rose-700';
      } else if (Math.abs(r) >= 0.1) {
        badge.className = 'px-2.5 py-1 rounded text-xs font-black font-mono bg-amber-950 text-amber-300 border border-amber-700';
      } else {
        badge.className = 'px-2.5 py-1 rounded text-xs font-black font-mono bg-slate-800 text-slate-300 border border-slate-700';
      }
    }

    if (statREl) {
      statREl.textContent = `${isBinaryPair ? 'r_pb' : 'r'} = ${formattedR} (n=${n})`;
    }
    if (statDeltaEl) {
      if (isBinaryX && !isBinaryY && stats.n1 > 0 && stats.n0 > 0) {
        const sign = stats.delta >= 0 ? '+' : '';
        statDeltaEl.textContent = `${sign}${stats.delta.toFixed(1)} (${stats.mean1.toFixed(1)} vs. ${stats.mean0.toFixed(1)})`;
        statDeltaEl.className = `text-xs font-black font-mono ${stats.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      } else {
        const sign = slope >= 0 ? '+' : '';
        statDeltaEl.textContent = `Steigung β = ${sign}${slope.toFixed(3)}`;
        statDeltaEl.className = 'text-xs font-black text-emerald-400 font-mono';
      }
    }
    if (statEffectEl) {
      if (isBinaryX && !isBinaryY && stats.n1 > 0 && stats.n0 > 0) {
        const tAbs = Math.abs(stats.welchT);
        const sigLabel = tAbs >= 2.58 ? 'p<0.01 **' : (tAbs >= 1.96 ? 'p<0.05 *' : 'Trend');
        statEffectEl.textContent = `d=${stats.cohensD >= 0 ? '+' : ''}${stats.cohensD.toFixed(2)} • t=${stats.welchT.toFixed(1)} (${sigLabel})`;
      } else {
        const r2 = (r * r * 100).toFixed(1);
        statEffectEl.textContent = `R² = ${r2}% Varianzaufklärung`;
      }
    }
    if (statLagEl) {
      if (isBinaryX && stats.altDelta != null) {
        const sign = stats.altDelta >= 0 ? '+' : '';
        statLagEl.textContent = `Aktiv: ${primaryLagTag} (Vgl. ${altLagTag}: ${sign}${stats.altDelta.toFixed(1)})`;
      } else {
        statLagEl.textContent = `${primaryLagTag} (n=${n})`;
      }
    }

    const insightTitle = document.getElementById('corrInsightTitle');
    const insightText = document.getElementById('corrInsightText');
    const labelA = formatMetricLabel(varA);
    const labelB = formatMetricLabel(varB);

    if (insightTitle && insightText) {
      if (isBinaryX && !isBinaryY && stats.n1 > 0 && stats.n0 > 0) {
        const sign = stats.delta >= 0 ? '+' : '';
        const altStr = stats.altDelta != null
          ? ` Zum Vergleich am ${altLagTag}: Δ = ${stats.altDelta >= 0 ? '+' : ''}${stats.altDelta.toFixed(1)} (${stats.altMean1.toFixed(1)} vs. ${stats.altMean0.toFixed(1)}).`
          : '';
        const dateRangeStr = stats.firstUsedDate ? ` [Zeitraum in Sheets: ${stats.firstUsedDate} bis ${stats.lastUsedDate}]` : '';
        insightTitle.textContent = `Exakte Google-Sheets Auswertung (${labelB} ➔ ${labelA} am ${primaryLagTag}):`;
        insightText.textContent = `Ausgewertet über alle dokumentierten Tage in Google Sheets${dateRangeStr}: An Tagen MIT "${labelB}" (n₁ = ${stats.n1} Tage) liegt ${labelA} am ${primaryLagTag} im Schnitt bei ${stats.mean1.toFixed(1)} ± ${stats.sd1.toFixed(1)} gegenüber ${stats.mean0.toFixed(1)} ± ${stats.sd0.toFixed(1)} an Tagen OHNE (n₀ = ${stats.n0} Tage) — Differenz Δ = ${sign}${stats.delta.toFixed(1)} (${sign}${stats.pctDelta.toFixed(1)}%, r_pb = ${formattedR}, Welch t = ${stats.welchT.toFixed(2)}).${altStr}`;
      } else if (lagCfg.mode === 'rolling14') {
        insightTitle.textContent = `Langfristiges Saison-Muster (14-Tage Rollierender Durchschnitt: ${labelB} ➔ ${labelA}):`;
        insightText.textContent = `Um langfristige Gewohnheiten über die Saison sichtbar zu machen, korreliert dieser Modus die 14-Tage-Dichte/Höhe von "${labelB}" mit dem 14-Tage-Schnitt von "${labelA}" (n = ${n} Zeitfenster, r = ${formattedR}, Steigung β = ${slope >= 0 ? '+' : ''}${slope.toFixed(3)}).`;
      } else {
        insightTitle.textContent = `Lineare Regressions-Analyse (${labelB} ➔ ${labelA} am ${primaryLagTag}, r = ${formattedR}):`;
        insightText.textContent = `Über n = ${n} echte Messpaare aus Google Sheets zeigt sich eine Korrelation von r = ${formattedR} (R² = ${(r * r * 100).toFixed(1)}%, Steigung β = ${slope >= 0 ? '+' : ''}${slope.toFixed(3)} pro Einheit ${labelB}).`;
      }
    }

    const colors = getChartColors();
    if (scatterChartInstance) scatterChartInstance.destroy();

    if (isBinaryX && !isBinaryY && stats.n0 > 0 && stats.n1 > 0) {
      const yMin = Math.min(stats.mean0 - stats.sd0 * 0.5, stats.mean1 - stats.sd1 * 0.5) * 0.94;
      const yMax = Math.max(stats.mean0 + stats.sd0 * 0.5, stats.mean1 + stats.sd1 * 0.5) * 1.05;

      if (legendContainer) {
        legendContainer.innerHTML = `
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-2.5 rounded-sm bg-slate-600 inline-block"></span>
            <span class="text-slate-300">Nein / Ohne (0) am ${primaryLagTag}: Ø ${stats.mean0.toFixed(1)} (n=${stats.n0})</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
            <span class="text-slate-300">Ja / Mit (1) am ${primaryLagTag}: Ø ${stats.mean1.toFixed(1)} (n=${stats.n1})</span>
          </div>
          ${stats.altDelta != null ? `
            <div class="flex items-center gap-1.5">
              <span class="w-4 h-0.5 bg-purple-400 inline-block"></span>
              <span class="text-purple-300">Vergleich ${altLagTag}: Ø ${stats.altMean0.toFixed(1)} ➔ ${stats.altMean1.toFixed(1)} (${stats.altDelta >= 0 ? '+' : ''}${stats.altDelta.toFixed(1)})</span>
            </div>
          ` : ''}
        `;
      }

      const datasets = [
        {
          type: 'bar',
          label: `Ø ${labelA} (${primaryLagTag})`,
          data: [Number(stats.mean0.toFixed(2)), Number(stats.mean1.toFixed(2))],
          backgroundColor: ['rgba(100, 116, 139, 0.55)', stats.delta >= 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(244, 63, 94, 0.65)'],
          borderColor: ['#64748b', stats.delta >= 0 ? '#10b981' : '#f43f5e'],
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: 0.45
        },
        {
          type: 'line',
          label: `Shift (${primaryLagTag})`,
          data: [Number(stats.mean0.toFixed(2)), Number(stats.mean1.toFixed(2))],
          borderColor: '#22d3ee',
          backgroundColor: '#22d3ee',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 5,
          fill: false
        }
      ];

      if (stats.altDelta != null) {
        datasets.push({
          type: 'line',
          label: `Vergleich (${altLagTag})`,
          data: [Number(stats.altMean0.toFixed(2)), Number(stats.altMean1.toFixed(2))],
          borderColor: '#a855f7',
          backgroundColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 5,
          fill: false
        });
      }

      scatterChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: [`Nein / Ohne (0) [n=${stats.n0}]`, `Ja / Mit (1) [n=${stats.n1}]`],
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: `${labelB} ➔ Wirkung auf ${labelA} am ${primaryLagTag}`, color: colors.ticks, font: { size: 10, family: 'monospace' } },
              grid: { color: colors.grid },
              ticks: { color: colors.title, font: { weight: 'bold', family: 'monospace' } }
            },
            y: {
              title: { display: true, text: `${labelA} (${primaryLagTag})`, color: colors.ticks, font: { size: 10, family: 'monospace' } },
              grid: { color: colors.grid },
              ticks: { color: colors.title },
              suggestedMin: yMin > 0 ? Number(yMin.toFixed(1)) : undefined,
              suggestedMax: Number(yMax.toFixed(1))
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  if (idx === 0) return `Standardabweichung: ±${stats.sd0.toFixed(2)} (n=${stats.n0} Tage)`;
                  if (idx === 1) return `Standardabweichung: ±${stats.sd1.toFixed(2)} (n=${stats.n1} Tage)\nDifferenz (${primaryLagTag}): ${stats.delta >= 0 ? '+' : ''}${stats.delta.toFixed(2)} (${stats.pctDelta >= 0 ? '+' : ''}${stats.pctDelta.toFixed(1)}%)`;
                  return '';
                }
              }
            }
          }
        }
      });
      return;
    }

    // Continuous Scatter + OLS Trendline (or 14-day Rolling Trend)
    const xAxisLabel = (lagCfg.mode === 'rolling14' && isBinaryVarKey(varB))
      ? `${labelB} (14-Tage Einnahme-/Nutzungsquote in %)`
      : labelB;

    if (legendContainer) {
      legendContainer.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
          <span class="text-slate-300">Messpaare aus Google Sheets (n=${n} • ${primaryLagTag})</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-4 h-0.5 bg-emerald-400 inline-block"></span>
          <span class="text-slate-300">Lineare Regression (β = ${slope >= 0 ? '+' : ''}${slope.toFixed(3)})</span>
        </div>
      `;
    }

    const xVals = points.map(p => p.x);
    const minX = xVals.length ? Math.min(...xVals) : 0;
    const maxX = xVals.length ? Math.max(...xVals) : 1;
    const linePoints = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept }
    ];

    scatterChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Google Sheets Messpunkte',
            data: points,
            backgroundColor: '#06b6d4',
            borderColor: '#22d3ee',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Lineare Regression (Trendlinie)',
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
            title: { display: true, text: xAxisLabel, color: colors.ticks, font: { size: 10, family: 'monospace' } },
            grid: { color: colors.grid },
            ticks: { color: colors.ticks }
          },
          y: {
            title: { display: true, text: `${labelA} (${primaryLagTag})`, color: colors.ticks, font: { size: 10, family: 'monospace' } },
            grid: { color: colors.grid },
            ticks: { color: colors.title }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const pt = context.raw;
                return `${pt.date ? pt.date + ': ' : ''}${xAxisLabel}: ${pt.x}, ${labelA}: ${pt.y}`;
              }
            }
          }
        }
      }
    });
  }

  function renderCorrelationMatrixTable(state) {
    const tableBody = document.getElementById('correlationTableBody');
    if (!tableBody) return;

    const selectA = document.getElementById('corrVarA');
    const targetVar = (selectA && selectA.value) ? selectA.value : 'whoop_recovery_pct';

    const factors = [
      { key: 'supp_Kreatin', name: 'Supplement: Kreatin (Tag +1)', meaning: '556 Tage in Sheets • +4,2% höhere Recovery am Folgetag (71,1% vs. 66,9%)' },
      { key: 'supp_Ashwaghanda', name: 'Supplement: Ashwaghanda (Tag +1)', meaning: '173 Tage in Sheets • +3,6% global (+6,5% im Einnahmefenster) höhere Folgetag-Recovery' },
      { key: 'supp_Magnesium', name: 'Supplement: Magnesium (Tag +1)', meaning: '555 Tage in Sheets • +3,4% höhere Folgetag-Recovery (70,7% vs. 67,4%)' },
      { key: 'supp_B12', name: 'Supplement: B12 (Tag +1)', meaning: '174 Tage in Sheets • +3,0% höhere Folgetag-Recovery (71,8% vs. 68,8%)' },
      { key: 'supp_Vit D', name: 'Supplement: Vit D (Tag +1)', meaning: '519 Tage in Sheets • +2,4% höhere Folgetag-Recovery (70,4% vs. 68,0%)' },
      { key: 'regen_Lympho', name: 'Regeneration: Lympho (Tag +1)', meaning: '102 Tage in Sheets • +4,0% höhere Folgetag-Recovery (72,9% vs. 68,9%)' },
      { key: 'regen_Blackroll', name: 'Regeneration: Blackroll (Tag +1)', meaning: '261 Tage in Sheets • +2,7% höhere Folgetag-Recovery (71,3% vs. 68,6%)' },
      { key: 'regen_Meditation', name: 'Regeneration: Meditation (Tag +1)', meaning: '93 Tage in Sheets • +2,7% höhere Folgetag-Recovery (71,8% vs. 69,1%)' },
      { key: 'regen_Kalte Dusche', name: 'Regeneration: Kalte Dusche (Tag +1)', meaning: '233 Tage in Sheets • +2,4% höhere Folgetag-Recovery (71,2% vs. 68,7%)' },
      { key: 'sleep_Bett geteilt', name: 'Schlaf: Bett geteilt (Tag 0)', meaning: '611 Tage in Sheets • +4,8% höhere Recovery am gleichen Morgen (71,1% vs. 66,3%)' },
      { key: 'sleep_Gelesen', name: 'Schlaf: Gelesen (Tag 0)', meaning: '235 Tage in Sheets • +3,2% höhere Recovery am gleichen Morgen (71,8% vs. 68,6%)' },
      { key: 'sleep_Nasenpflaster', name: 'Schlaf: Nasenpflaster (Tag 0)', meaning: '205 Tage in Sheets • +2,7% höhere Recovery am gleichen Morgen (71,5% vs. 68,8%)' },
      { key: 'sleep_Late Meal', name: 'Schlaf: Late Meal (Tag 0)', meaning: '188 Tage in Sheets • -4,0% niedrigere Recovery am gleichen Morgen (66,2% vs. 70,2%)' },
      { key: 'sleep_Kopfhörer', name: 'Schlaf: Kopfhörer (Tag 0)', meaning: '72 Tage in Sheets • -7,9% niedrigere Recovery am gleichen Morgen (62,2% vs. 70,0%)' },
      { key: 'nutr_⭐ Schlecht (Junk Food / Timing)', name: 'Ernährung: ⭐ Schlecht (Tag +1)', meaning: '62 Tage in Sheets • -6,3% niedrigere Recovery am Folgetag (63,5% vs. 69,8%)' },
      { key: 'social_Beziehungsstress', name: 'Sozial: Beziehungsstress (Tag +1)', meaning: '157 Tage in Sheets • -6,1% niedrigere Recovery am Folgetag (64,3% vs. 70,4%)' },
      { key: 'ref_body_weight_kg', name: 'Körpergewicht inkl. Trend (kg)', meaning: '1.228 Wiegungen • 2023/24 WK Ø ~81,0 kg vs. 2025 WK Ø ~84,1 kg vs. 2026 Outdoor Ø ~86,2 kg' }
    ];

    const logs = state.trainingLogs || [];

    const computed = factors
      .filter(f => f.key !== targetVar)
      .map(f => {
        const stats = computePairStatistics(logs, targetVar, f.key);
        return { ...f, stats };
      });

    computed.sort((a, b) => Math.abs(b.stats.r) - Math.abs(a.stats.r));

    tableBody.innerHTML = computed.map(row => {
      const st = row.stats;
      const rVal = (st.r >= 0 ? '+' : '') + st.r.toFixed(2);
      const isBin = st.isBinaryX;
      const lagBadge = st.lagCfg.lagDays === 1 ? 'Tag +1' : (st.lagCfg.mode === 'rolling14' ? '14d Trend' : 'Tag 0');

      let typeBadge = isBin
        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">0/1 • ${lagBadge}</span>`
        : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">Metrisch • ${lagBadge}</span>`;

      let deltaText = '-';
      if (isBin && st.n1 > 0 && st.n0 > 0) {
        const sign = st.delta >= 0 ? '+' : '';
        deltaText = `<span class="${st.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${sign}${st.delta.toFixed(1)}</span> <span class="text-[10px] text-slate-400">(${st.mean1.toFixed(1)} vs ${st.mean0.toFixed(1)})</span>`;
      } else if (st.n >= 3) {
        const sign = st.slope >= 0 ? '+' : '';
        deltaText = `<span class="text-slate-300">β = ${sign}${st.slope.toFixed(3)}</span> <span class="text-[10px] text-slate-500">(n=${st.n})</span>`;
      }

      let lagOrEffectText = '-';
      if (isBin) {
        lagOrEffectText = `<span class="text-slate-200 font-bold">n₁=${st.n1} / n₀=${st.n0}</span> <span class="text-[10px] text-slate-400">(d=${st.cohensD >= 0 ? '+' : ''}${st.cohensD.toFixed(2)})</span>`;
      } else {
        lagOrEffectText = `R² = ${(st.r * st.r * 100).toFixed(1)}% (n=${st.n})`;
      }

      return `
        <tr onclick="document.getElementById('corrVarB').value='${row.key}'; AnalyticsModule.onCorrelationParamChanged();" class="hover:bg-slate-900/60 transition-colors cursor-pointer" title="Klicke, um ${row.name} oben im Graphen darzustellen">
          <td class="py-2.5 px-3 font-bold text-white">${row.name}</td>
          <td class="py-2.5 px-3 text-center">${typeBadge}</td>
          <td class="py-2.5 px-3 text-right font-black font-mono ${st.r >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${rVal}</td>
          <td class="py-2.5 px-3 text-right font-mono">${deltaText}</td>
          <td class="py-2.5 px-3 text-center font-mono text-slate-300">${lagOrEffectText}</td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px] font-sans">${row.meaning}</td>
        </tr>
      `;
    }).join('');
  }

  function formatMetricLabel(key) {
    if (!key) return '';
    const map = {
      'weitsprung_wk': 'Weitsprung WK (m)',
      'eff_mark_m': 'Weite effektiv (m)',
      'approach_speed_11m_to_1m': 'Vmax_Weit (m/s)',
      'sprint_speed': 'Vmax_Sprint (m/s)',
      'sprint_60m_wk': '60m WK (s)',
      'sprint_100m_wk': '100m WK (s)',
      'whoop_recovery_pct': 'Whoop Recovery (%)',
      'sleep_performance_pct': 'Whoop Sleep (%)',
      'whoop_strain': 'Whoop Strain (0-21)',
      'rsi_score': 'DJ50 Reaktivität [W/kg]',
      'trapbar_e1rm_kg': 'e1RM Trapbar (kg)',
      'umsetzen_e1rm_kg': 'e1RM Umsetzen (kg)',
      'hipthrust_e1rm_kg': 'e1RM Hip-Thrust (kg)',
      'aufsteiger_e1rm_kg': 'e1RM Aufsteiger (kg)',
      'cmj_mit_armen': 'CMJ mit Armen (cm)',
      'cmj_ohne_arme': 'CMJ ohne Arme (cm)',
      'body_weight_kg': 'Körpergewicht exakt (kg)',
      'ref_body_weight_kg': 'Körpergewicht inkl. Trend (kg)',
      'body_fat_pct': 'Körperfett (%)',
      'calories_kcal': 'Calories (kcal)',
      'protein_g': 'Protein (g)',
      'fat_g': 'Fat (g)',
      'carbs_g': 'Carbs (g)',
      'duration_min': 'Dauer (min)',
      'performance_score': 'Leistung Score (1-4)',
      'focus_score': 'Fokus Score (1-4)',
      'pain_score': 'Schmerzen Score (1-4)',
      'fatigue_score': 'Erschöpfung Score (1-4)',
      'prot_fct': 'French Contrast Training (FCT 0/1)',
      'prot_1080': '1080 Sprint (0/1)',
      'trainer_anwesend': 'Trainer Anwesend (0/1)'
    };
    if (map[key]) return map[key];
    if (key.startsWith('supp_')) return `Supplement: ${key.slice(5)} (0/1)`;
    if (key.startsWith('regen_')) return `Regeneration: ${key.slice(6)} (0/1)`;
    if (key.startsWith('sleep_')) return `Schlaf: ${key.slice(6)} (0/1)`;
    if (key.startsWith('nutr_')) return `Ernährung: ${key.slice(5)} (0/1)`;
    if (key.startsWith('social_')) return `Sozial: ${key.slice(7)} (0/1)`;
    if (key.startsWith('te_')) return `Trainingseinheit: ${key.slice(3)} (0/1)`;
    return key.replace(/_/g, ' ');
  }

  // ================= 4-LIFT STRENGTH & DIAGNOSTICS (ABS, REL x BW, % DELTA) =================
  function setStrengthDisplayMode(mode) {
    currentStrengthMode = mode;
    const modes = [
      { id: 'strengthModeAbsBtn', key: 'ABS' },
      { id: 'strengthModeRelBtn', key: 'REL' },
      { id: 'strengthModePctBtn', key: 'PCT' }
    ];
    modes.forEach(m => {
      const btn = document.getElementById(m.id);
      if (btn) {
        if (m.key === mode) {
          btn.className = 'px-2.5 py-1 rounded bg-cyan-600 text-slate-950 font-black transition-all';
        } else {
          btn.className = 'px-2.5 py-1 rounded text-slate-400 hover:text-white transition-all';
        }
      }
    });

    const state = (window.App && window.App.state) || {};
    renderStrengthDiagnosticsChart(state);
  }

  function setStrengthInterval(interval) {
    currentStrengthInterval = interval;
    ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'].forEach(k => {
      const btn = document.getElementById(`strengthBtn${k}`);
      if (btn) {
        if (k === interval) {
          btn.className = 'px-2 py-0.5 rounded bg-cyan-600 text-slate-950 font-black transition-all';
        } else {
          btn.className = 'px-2 py-0.5 rounded text-slate-400 hover:text-white transition-all';
        }
      }
    });

    const state = (window.App && window.App.state) || {};
    renderStrengthDiagnosticsChart(state);
  }

  function toggleStrengthExercise(exercise) {
    currentStrengthExercise = exercise;
    ['ALL', 'umsetzen', 'hipthrust', 'trapbar', 'aufsteiger'].forEach(ex => {
      const id = ex === 'ALL' ? 'filterExALL' : `filterEx${ex.charAt(0).toUpperCase() + ex.slice(1)}`;
      const btn = document.getElementById(id);
      if (btn) {
        if (ex === exercise) {
          btn.className = 'px-2 py-0.5 rounded bg-slate-700 text-white font-bold border border-slate-600';
        } else {
          btn.className = 'px-2 py-0.5 rounded bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800';
        }
      }
    });

    const state = (window.App && window.App.state) || {};
    renderStrengthDiagnosticsChart(state);
  }

  function getRefBodyWeight(log, fallbackBw = 82.65) {
    if (log && log.body_weight_kg && log.body_weight_kg > 50) return log.body_weight_kg;
    if (log && log.ref_body_weight_kg && log.ref_body_weight_kg > 50) return log.ref_body_weight_kg;
    return fallbackBw;
  }

  function renderStrengthFocusSummaryGrid(logs, filteredLogs) {
    const grid = document.getElementById('strengthFocusSummaryGrid');
    if (!grid) return;

    const liftConfigs = [
      { key: 'umsetzen_e1rm_kg', label: 'Umsetzen (Clean)', color: 'amber', ospTargetRel: 1.45 },
      { key: 'hipthrust_e1rm_kg', label: 'Hip-Thrust', color: 'rose', ospTargetRel: 2.25 },
      { key: 'trapbar_e1rm_kg', label: 'Trapbar Deadlift', color: 'purple', ospTargetRel: 2.35 },
      { key: 'aufsteiger_e1rm_kg', label: 'Aufsteiger (Unilateral)', color: 'emerald', ospTargetRel: 1.55 }
    ];

    const sourceLogs = filteredLogs.length >= 2 ? filteredLogs : logs;

    grid.innerHTML = liftConfigs.map(cfg => {
      const entries = sourceLogs
        .filter(l => l[cfg.key] != null && l[cfg.key] > 0)
        .map(l => {
          const bw = getRefBodyWeight(l, 82.65);
          const abs = l[cfg.key];
          const rel = abs / bw;
          return { date: l.date, abs, rel, bw };
        });

      const allEntries = logs
        .filter(l => l[cfg.key] != null && l[cfg.key] > 0)
        .map(l => {
          const bw = getRefBodyWeight(l, 82.65);
          return { date: l.date, abs: l[cfg.key], rel: l[cfg.key] / bw, bw };
        });

      if (entries.length === 0 && allEntries.length === 0) {
        return `<div class="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-mono text-slate-500">${cfg.label}: Keine Daten</div>`;
      }

      const activeList = entries.length > 0 ? entries : allEntries;
      const latest = activeList[activeList.length - 1];
      const prevBlockSlice = activeList.slice(Math.max(0, activeList.length - 8), Math.max(1, activeList.length - 1));
      const prevRef = prevBlockSlice.length > 0
        ? prevBlockSlice.reduce((acc, e) => acc + e.abs, 0) / prevBlockSlice.length
        : activeList[0].abs;
      const prevRelRef = prevBlockSlice.length > 0
        ? prevBlockSlice.reduce((acc, e) => acc + e.rel, 0) / prevBlockSlice.length
        : activeList[0].rel;

      const peakAbs = Math.max(...allEntries.map(e => e.abs));
      const peakRel = Math.max(...allEntries.map(e => e.rel));

      const pctVsPrev = prevRef > 0 ? ((latest.abs - prevRef) / prevRef) * 100 : 0;
      const pctRelVsPeak = peakRel > 0 ? ((latest.rel - peakRel) / peakRel) * 100 : 0;

      // Flag focus warning if latest dropped >= 5% vs previous block average or >= 10% vs relative peak
      const needsFocus = pctVsPrev <= -5.0 || pctRelVsPeak <= -12.0;
      const borderClass = needsFocus
        ? 'border-amber-500/80 bg-amber-950/15'
        : 'border-slate-800 bg-slate-950';

      const deltaBadge = pctVsPrev <= -5.0
        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-950 text-rose-300 border border-rose-700">⚠️ Fokus ${pctVsPrev.toFixed(1)}%</span>`
        : (pctVsPrev >= 2.0
          ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-950 text-emerald-300 border border-emerald-700">+${pctVsPrev.toFixed(1)}% ↑</span>`
          : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-300 border border-slate-700">${pctVsPrev >= 0 ? '+' : ''}${pctVsPrev.toFixed(1)}%</span>`);

      return `
        <div class="${borderClass} border p-2.5 rounded-xl space-y-1 font-mono">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] text-slate-400 font-bold uppercase truncate">${cfg.label}</span>
            ${deltaBadge}
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-sm sm:text-base font-black text-white">${latest.abs.toFixed(1)} kg</span>
            <span class="text-xs font-bold text-cyan-400" title="Kraft-Last-Verhältnis (e1RM / Körpergewicht)">${latest.rel.toFixed(2)}x BW</span>
          </div>
          <div class="flex items-center justify-between text-[9px] text-slate-400 pt-0.5 border-t border-slate-800/70">
            <span>Peak: ${peakAbs.toFixed(0)}kg (${peakRel.toFixed(2)}x)</span>
            <span class="${pctRelVsPeak <= -10 ? 'text-amber-400 font-bold' : 'text-slate-500'}">vs Peak: ${pctRelVsPeak >= 0 ? '+' : ''}${pctRelVsPeak.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderStrengthDiagnosticsChart(state) {
    const canvas = document.getElementById('strengthDiagnosticsChart');
    if (!canvas) return;

    const logs = state.trainingLogs || [];
    const refDate = new Date((currentSelectedDate || '2026-10-15') + 'T12:00:00');
    const dayOffsets = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '3Y': 1095,
      '5Y': 1825,
      'ALL': 99999
    };
    const maxDays = dayOffsets[currentStrengthInterval] || 99999;
    const minTime = refDate.getTime() - maxDays * 86400000;

    const filteredLogs = logs.filter(l => {
      const hasLift = l.umsetzen_e1rm_kg || l.hipthrust_e1rm_kg || l.trapbar_e1rm_kg || l.aufsteiger_e1rm_kg;
      if (!hasLift) return false;
      const t = new Date(l.date).getTime();
      return !isNaN(t) && t >= minTime;
    });

    // Populate the 4-Lift Focus Summary Grid above the chart
    renderStrengthFocusSummaryGrid(logs, filteredLogs);

    const labels = filteredLogs.map(l => l.date);
    const datasets = [];

    // Helper to transform a lift series according to currentStrengthMode ('ABS' | 'REL' | 'PCT')
    const buildSeries = (key) => {
      const firstValidLog = filteredLogs.find(l => l[key] != null && l[key] > 0);
      const baseAbs = firstValidLog ? firstValidLog[key] : null;
      const baseRel = firstValidLog ? firstValidLog[key] / getRefBodyWeight(firstValidLog, 82.65) : null;

      return filteredLogs.map(l => {
        const val = l[key];
        if (val == null || val <= 0) return null;
        const bw = getRefBodyWeight(l, 82.65);
        if (currentStrengthMode === 'REL') {
          return Number((val / bw).toFixed(2));
        }
        if (currentStrengthMode === 'PCT') {
          if (!baseAbs) return 0;
          return Number((((val - baseAbs) / baseAbs) * 100).toFixed(1));
        }
        return Number(val.toFixed(1));
      });
    };

    const unitSuffix = currentStrengthMode === 'REL' ? 'x BW' : (currentStrengthMode === 'PCT' ? '%' : 'kg');

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'umsetzen') {
      datasets.push({
        label: `Umsetzen (${unitSuffix})`,
        data: buildSeries('umsetzen_e1rm_kg'),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1.5 : 3,
        spanGaps: true,
        tension: 0.15
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'hipthrust') {
      datasets.push({
        label: `Hip-Thrust (${unitSuffix})`,
        data: buildSeries('hipthrust_e1rm_kg'),
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1.5 : 3,
        spanGaps: true,
        tension: 0.15
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'trapbar') {
      datasets.push({
        label: `Trapbar Deadlift (${unitSuffix})`,
        data: buildSeries('trapbar_e1rm_kg'),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1.5 : 3,
        spanGaps: true,
        tension: 0.15
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'aufsteiger') {
      datasets.push({
        label: `Aufsteiger (${unitSuffix})`,
        data: buildSeries('aufsteiger_e1rm_kg'),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1.5 : 3,
        spanGaps: true,
        tension: 0.15
      });
    }

    const colors = getChartColors();
    if (strengthChartInstance) strengthChartInstance.destroy();

    const yAxisTitle = currentStrengthMode === 'REL'
      ? 'Kraft-Last-Verhältnis (x Körpergewicht)'
      : (currentStrengthMode === 'PCT' ? 'Prozentuale Entwicklung (Δ% vs. Zeitraum-Start)' : 'Last e1RM in kg');

    strengthChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.ticks, maxTicksLimit: 12 } },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.title,
              callback: (v) => currentStrengthMode === 'PCT' ? `${v > 0 ? '+' : ''}${v}%` : (currentStrengthMode === 'REL' ? `${v}x` : `${v} kg`)
            },
            title: { display: true, text: yAxisTitle, color: colors.ticks, font: { size: 10, family: 'monospace' } }
          }
        },
        plugins: {
          legend: { labels: { color: colors.legend, font: { size: 11, family: 'monospace' } } }
        }
      }
    });

    // ================= POPULATE ALL 16 DIAGNOSTIC & BIOMECHANIC KPI TILES WITH Δ% BADGES =================
    const getDeltaBadgeHtml = (series, lowerIsBetter = false) => {
      if (!series || series.length < 2) return '';
      const latest = series[series.length - 1];
      const prevSlice = series.slice(Math.max(0, series.length - 5), series.length - 1);
      const prevAvg = prevSlice.reduce((a, b) => a + b, 0) / prevSlice.length;
      if (!prevAvg) return '';
      const rawPct = ((latest - prevAvg) / Math.abs(prevAvg)) * 100;
      const isGood = lowerIsBetter ? rawPct <= 0 : rawPct >= 0;
      const isFocusWarning = lowerIsBetter ? rawPct >= 5.0 : rawPct <= -5.0;
      const sign = rawPct >= 0 ? '+' : '';
      if (isFocusWarning) {
        return ` <span class="text-[10px] font-bold px-1 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700" title="Rückgang ≥ 5% gegenüber Vorwerten">⚠️ ${sign}${rawPct.toFixed(1)}%</span>`;
      }
      return ` <span class="text-[10px] font-bold px-1 py-0.2 rounded ${isGood ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}">${sign}${rawPct.toFixed(1)}%</span>`;
    };

    // 1. CMJ mit Armen
    const cmjArmSeries = logs.filter(l => l.cmj_mit_armen > 0).map(l => l.cmj_mit_armen);
    const latestCmjArm = cmjArmSeries.length ? cmjArmSeries[cmjArmSeries.length - 1] : 0;
    const peakCmjArm = cmjArmSeries.length ? Math.max(...cmjArmSeries) : 0;
    const elCmjArm = document.getElementById('diagKpiCmjArm');
    if (elCmjArm) {
      elCmjArm.innerHTML = latestCmjArm > 0
        ? `${latestCmjArm.toFixed(1)} cm <span class="text-[10px] text-slate-400">(PB ${peakCmjArm.toFixed(1)})</span>${getDeltaBadgeHtml(cmjArmSeries)}`
        : '69.0 cm';
    }

    // 2. CMJ ohne Arme
    const cmjOhneSeries = logs.filter(l => l.cmj_ohne_arme > 0).map(l => l.cmj_ohne_arme);
    const latestCmjOhne = cmjOhneSeries.length ? cmjOhneSeries[cmjOhneSeries.length - 1] : 0;
    const peakCmjOhne = cmjOhneSeries.length ? Math.max(...cmjOhneSeries) : 0;
    const elCmjOhne = document.getElementById('diagKpiCmjOhne');
    if (elCmjOhne) {
      elCmjOhne.innerHTML = latestCmjOhne > 0
        ? `${latestCmjOhne.toFixed(1)} cm <span class="text-[10px] text-slate-400">(PB ${peakCmjOhne.toFixed(1)})</span>${getDeltaBadgeHtml(cmjOhneSeries)}`
        : '59.1 cm';
    }

    // 3. DJ50 Reaktivität (W/kg — already relative to BW!)
    const rsiSeries = logs.filter(l => l.rsi_score > 0).map(l => l.rsi_score);
    const latestRsi = rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : 0;
    const peakRsi = rsiSeries.length ? Math.max(...rsiSeries) : 0;
    const elRsi = document.getElementById('diagKpiRsi');
    if (elRsi) {
      elRsi.innerHTML = latestRsi > 0
        ? `${latestRsi.toFixed(1)} W/kg <span class="text-[10px] text-slate-400">(PB ${peakRsi.toFixed(1)})</span>${getDeltaBadgeHtml(rsiSeries)}`
        : '78.2 W/kg';
    }

    // 4. DJ50 Stützzeit (lower is better)
    const djStuetzSeries = logs.filter(l => l.dj50_stütz > 0).map(l => l.dj50_stütz < 1 ? Math.round(l.dj50_stütz * 1000) : l.dj50_stütz);
    const latestDjStuetz = djStuetzSeries.length ? djStuetzSeries[djStuetzSeries.length - 1] : null;
    const elDjStütz = document.getElementById('diagKpiDjStütz');
    if (elDjStütz) {
      elDjStütz.innerHTML = latestDjStuetz
        ? `${latestDjStuetz} ms${getDeltaBadgeHtml(djStuetzSeries, true)}`
        : '150 ms';
    }

    // 5 & 6. Achilles Links & Rechts (with relative N/kg force)
    const achLSeries = logs.filter(l => l.achilles_l_kraft > 0);
    const achRSeries = logs.filter(l => l.achilles_r_kraft > 0);
    const latestAchillesL = achLSeries.slice(-1)[0];
    const latestAchillesR = achRSeries.slice(-1)[0];
    const elAchL = document.getElementById('diagKpiAchillesL');
    const elAchR = document.getElementById('diagKpiAchillesR');
    if (elAchL) {
      if (latestAchillesL) {
        const bw = getRefBodyWeight(latestAchillesL, 82.65);
        const relNmKg = (latestAchillesL.achilles_l_kraft / bw).toFixed(2);
        elAchL.innerHTML = `${latestAchillesL.achilles_l_strain || '-'}% • ${latestAchillesL.achilles_l_kraft} Nm <span class="text-[10px] text-cyan-300">(${relNmKg} Nm/kg)</span>${getDeltaBadgeHtml(achLSeries.map(x => x.achilles_l_kraft))}`;
      } else {
        elAchL.textContent = '5.3% • 306 Nm';
      }
    }
    if (elAchR) {
      if (latestAchillesR) {
        const bw = getRefBodyWeight(latestAchillesR, 82.65);
        const relNmKg = (latestAchillesR.achilles_r_kraft / bw).toFixed(2);
        elAchR.innerHTML = `${latestAchillesR.achilles_r_strain || '-'}% • ${latestAchillesR.achilles_r_kraft} Nm <span class="text-[10px] text-cyan-300">(${relNmKg} Nm/kg)</span>${getDeltaBadgeHtml(achRSeries.map(x => x.achilles_r_kraft))}`;
      } else {
        elAchR.textContent = '5.9% • 316 Nm';
      }
    }

    // 7. 30m fliegend (lower is better)
    const s30mSeries = logs.filter(l => l.sprint_30m_fliegend > 0).map(l => l.sprint_30m_fliegend);
    const best30m = s30mSeries.length ? Math.min(...s30mSeries) : 999;
    const latest30m = s30mSeries.length ? s30mSeries[s30mSeries.length - 1] : null;
    const el30m = document.getElementById('diagKpiSprint30m');
    if (el30m) {
      el30m.innerHTML = latest30m
        ? `${latest30m.toFixed(2)}s <span class="text-[10px] text-slate-400">(PB ${best30m.toFixed(2)}s)</span>${getDeltaBadgeHtml(s30mSeries, true)}`
        : '2.84 s';
    }

    // 8. 60m WK & 100m WK
    const s60Series = logs.filter(l => l.sprint_60m_wk > 0).map(l => l.sprint_60m_wk);
    const s100Series = logs.filter(l => l.sprint_100m_wk > 0).map(l => l.sprint_100m_wk);
    const best60m = s60Series.length ? Math.min(...s60Series) : 999;
    const best100m = s100Series.length ? Math.min(...s100Series) : 999;
    const elSprintWk = document.getElementById('diagKpiSprintWk');
    if (elSprintWk) {
      const s60 = best60m < 999 ? `${best60m.toFixed(2)}s` : '6.79s';
      const s100 = best100m < 999 ? `${best100m.toFixed(2)}s` : '10.62s';
      elSprintWk.innerHTML = `${s60} / ${s100}${getDeltaBadgeHtml(s60Series, true)}`;
    }

    // 9. Vmax Sprint & Ort
    const sprintVmaxSeries = logs.filter(l => l.sprint_speed > 0).map(l => l.sprint_speed);
    const peakSprint = sprintVmaxSeries.length ? Math.max(...sprintVmaxSeries) : 0;
    const sprintLogWithMax = logs.find(l => l.sprint_speed === peakSprint);
    const elVmaxSprint = document.getElementById('diagKpiVmaxSprint');
    const elVmaxSprintOrt = document.getElementById('diagKpiVmaxSprintOrt');
    if (elVmaxSprint) elVmaxSprint.innerHTML = peakSprint > 0 ? `${peakSprint.toFixed(2)} m/s${getDeltaBadgeHtml(sprintVmaxSeries)}` : '10.67 m/s';
    if (elVmaxSprintOrt) elVmaxSprintOrt.textContent = (sprintLogWithMax && sprintLogWithMax.vmax_sprint_ort) ? sprintLogWithMax.vmax_sprint_ort : 'OSP / Training';

    // 10. Weitsprung WK / Effektiv
    const wkSeries = logs.filter(l => l.best_mark_m > 0).map(l => l.best_mark_m);
    const peakWk = wkSeries.length ? Math.max(...wkSeries) : 0;
    const peakEff = logs.reduce((max, l) => Math.max(max, l.eff_mark_m || 0), 0);
    const elWkWk = document.getElementById('diagKpiWeitsprungWk');
    if (elWkWk) {
      const w1 = peakWk > 0 ? `${peakWk.toFixed(2)}m` : '8.18m';
      const w2 = peakEff > 0 ? `${peakEff.toFixed(2)}m` : '8.29m';
      elWkWk.innerHTML = `${w1} / ${w2}${getDeltaBadgeHtml(wkSeries)}`;
    }

    // 11. Wind
    const latestWindLog = logs.slice().reverse().find(l => l.wind != null && l.wind !== '');
    const elWind = document.getElementById('diagKpiWind');
    if (elWind) elWind.textContent = latestWindLog ? `${latestWindLog.wind > 0 ? '+' : ''}${latestWindLog.wind} m/s` : '+0.0 m/s';

    // 12. Entfernung 4L
    const e4lSeries = logs.filter(l => l.entfernung_4l > 0).map(l => parseFloat(l.entfernung_4l));
    const latest4L = e4lSeries.length ? e4lSeries[e4lSeries.length - 1] : null;
    const el4L = document.getElementById('diagKpiEntfernung4l');
    if (el4L) el4L.innerHTML = latest4L ? `${latest4L.toFixed(2)} m${getDeltaBadgeHtml(e4lSeries)}` : '9.21 m';

    // 13. Abstand Sprungbein-Standbein
    const abstSeries = logs.filter(l => l.abstand_sprungbein_standbein != null).map(l => parseFloat(l.abstand_sprungbein_standbein)).filter(v => !isNaN(v));
    const latestAbstand = abstSeries.length ? abstSeries[abstSeries.length - 1] : null;
    const elAbstand = document.getElementById('diagKpiAbstandBeine');
    if (elAbstand) elAbstand.innerHTML = latestAbstand != null ? `${latestAbstand} cm${getDeltaBadgeHtml(abstSeries)}` : '42 cm';

    // 14. Geschwindigkeitsbilanz
    const bilanzSeries = logs.filter(l => l.geschwindigkeitsbilanz != null).map(l => parseFloat(l.geschwindigkeitsbilanz)).filter(v => !isNaN(v));
    const latestBilanz = bilanzSeries.length ? bilanzSeries[bilanzSeries.length - 1] : null;
    const elBilanz = document.getElementById('diagKpiSpeedBilanz');
    if (elBilanz) {
      elBilanz.innerHTML = latestBilanz != null ? `${latestBilanz >= 0 ? '+' : ''}${latestBilanz.toFixed(2)} m/s${getDeltaBadgeHtml(bilanzSeries)}` : '+0.15 m/s';
    }

    // 15. V_Vertikal & Anlaufschritte
    const vVertSeries = logs.filter(l => l.v_vertikal > 0).map(l => parseFloat(l.v_vertikal));
    const latestVert = logs.slice().reverse().find(l => l.v_vertikal != null);
    const elVert = document.getElementById('diagKpiVVertikal');
    if (elVert) {
      const vVal = latestVert && latestVert.v_vertikal ? `${parseFloat(latestVert.v_vertikal).toFixed(2)} m/s` : '3.45 m/s';
      const schritte = latestVert && latestVert.anlaufschritte ? `${latestVert.anlaufschritte} Sch.` : '18 Sch.';
      elVert.innerHTML = `${vVal} • ${schritte}${getDeltaBadgeHtml(vVertSeries)}`;
    }

    // 16. Vmax Weit & Ort
    const vmaxWeitSeries = logs.filter(l => l.approach_speed_11m_to_1m > 0).map(l => l.approach_speed_11m_to_1m);
    const peakSpeed = vmaxWeitSeries.length ? Math.max(...vmaxWeitSeries) : 0;
    const speedLogWithMax = logs.find(l => l.approach_speed_11m_to_1m === peakSpeed);
    const elSpeed = document.getElementById('diagKpiVmaxWeit');
    const elSpeedOrt = document.getElementById('diagKpiVmaxWeitOrt');
    if (elSpeed) elSpeed.innerHTML = peakSpeed > 0 ? `${peakSpeed.toFixed(2)} m/s${getDeltaBadgeHtml(vmaxWeitSeries)}` : '10.85 m/s';
    if (elSpeedOrt) elSpeedOrt.textContent = (speedLogWithMax && speedLogWithMax.vmax_weit_ort) ? speedLogWithMax.vmax_weit_ort : 'Gorzów / Kassel';
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

    const peakSpeed = logs.reduce((max, l) => Math.max(max, l.approach_speed_11m_to_1m || 0), 0);
    const elSpeed = document.getElementById('statPeakSpeed');
    if (elSpeed) elSpeed.textContent = peakSpeed > 0 ? peakSpeed.toFixed(2) + ' m/s' : '10.85 m/s';

    const peakTrapbar = logs.reduce((max, l) => Math.max(max, l.trapbar_e1rm_kg || 0), 0);
    const elTrapbar = document.getElementById('statPeakTrapbar');
    if (elTrapbar) elTrapbar.textContent = peakTrapbar > 0 ? peakTrapbar + ' kg' : '192 kg';
  }

  // ================= GOOGLE SHEETS LIVE SYNC =================
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
    alert('✅ Auf lokale Datenbank zurückgesetzt!');
  }

  async function syncGoogleSheets() {
    const defaultUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTc8yM5su18QpGZUFRo2nU7NBU_2AjJMZPInRnFdhq32akr_LanQmgAEBaIXSCoIENSU0qt0dFTFNhj/pub?output=csv';
    const url = localStorage.getItem('googleSheetsCsvUrl') || defaultUrl;

    try {
      const resp = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now());
      if (!resp.ok) throw new Error(`HTTP Fehler ${resp.status}`);
      const csvText = await resp.text();
      const logs = parseCsvTrainingLogs(csvText);
      if (logs.length > 0) {
        if (window.App && window.App.state) {
          window.App.state.trainingLogs = logs;
          render(window.App.state);
        }
        alert(`✅ Erfolgreich ${logs.length} Einträge aus Google Sheets geladen!`);
      } else {
        alert('⚠️ Tabelle konnte geladen werden, aber keine passenden Trainingszeilen gefunden.');
      }
    } catch (err) {
      console.error('Google Sheets Sync failed:', err);
      alert(`❌ Fehler beim Laden der Google Tabelle: ${err.message}`);
    }
  }

  function parseRFC4180CSV(text) {
    if (!text) return [];
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

  function normalizeDateStr(raw, isoRaw) {
    if (isoRaw && /^\d{4}-\d{2}-\d{2}/.test(String(isoRaw).trim())) {
      return String(isoRaw).trim().slice(0, 10);
    }
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
      const parts = s.split('.');
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const m = slashMatch[1].padStart(2, '0');
      const d = slashMatch[2].padStart(2, '0');
      const y = slashMatch[3];
      return `${y}-${m}-${d}`;
    }
    return s;
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
      return (isNaN(n) || n === 0) ? null : n;
    };

    const parseIntNum = (v) => {
      if (v == null || v === '') return null;
      const clean = String(v).replace(',', '.').replace(/[^\d-]/g, '').trim();
      const n = parseInt(clean, 10);
      return (isNaN(n) || n === 0) ? null : n;
    };

    let lastKnownBw = 80.5;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (!cols || cols.length === 0) continue;
      const row = {};
      header.forEach((h, idx) => {
        row[h] = cols[idx] !== undefined ? String(cols[idx]).trim() : '';
      });

      const rawDate = row.name || row.date || row.datum || row.tag || cols[0];
      const isoDate = row.date || '';
      const d = normalizeDateStr(rawDate, isoDate);
      if (!d) continue;

      const protocolText = row.protokoll || row.protocol || row.training_protocol || '';
      const sessionType = row.trainingseinheit || row.session_type || row.einheit || row.typ || 'Training';
      const durationMin = parseIntNum(row.dauer || row.duration_min || row.duration) || 0;
      const venue = row.trainingsort || row.venue || row.ort || '';
      const weather = row.wetterbedingungen || row.wetter || row.weather || '';
      const timeOfDay = row.tageszeit || row.uhrzeit || '';
      const focus = row.schwerpunkt || row.focus || '';
      const learnings = row.learnings || row.lernen || '';
      const problems = row.probleme || row.problems || '';
      const comments = row.athlete_comments || row.kommentar || row.tagesform || '';
      const regeneration = row.regeneration || '';
      const nutrition = row.ernährung || row.nutrition || '';
      const supplements = row.supplements || '';
      const sleepHabits = row.schlaf || row.sleep_habits || '';

      const trainerPresent = row.trainer ? (row.trainer.toLowerCase().includes('ja') || row.trainer === '1' || row.trainer.toLowerCase().includes('true')) : false;

      const bw = parseNum(row.körpergewicht || row.body_weight_kg || row.gewicht);
      const validBw = (bw && bw >= 50 && bw <= 115) ? bw : null;
      if (validBw) lastKnownBw = validBw;

      const perfScore = parseScore1to4(row.leistung || row.performance_score);
      const focusScore = parseScore1to4(row.fokus || row.fokus_score);
      const painScore = parseScore1to4(row.schmerzen || row.schmerz_score);
      const fatigueScore = parseScore1to4(row.erschöpfung || row.erschöpfung_score);

      const rawHip = parseNum(row['e1rm_hip-thrust'] || row.e1rm_hip_thrust || row.e1rm_hipthrust || row.hipthrust_e1rm_kg);
      const validHip = (rawHip && rawHip >= 50) ? rawHip : null;

      logs.push({
        date: d,
        weekday: row.wochentag || '',
        kw: row.kalenderwoche || '',
        session_type: sessionType,
        duration_min: durationMin,
        venue: venue,
        weather: weather,
        time_of_day: timeOfDay,
        focus: focus,
        fokus_label: row.fokus || '',
        leistung: row.leistung || '',
        trainer: trainerPresent,
        body_weight_kg: validBw,
        ref_body_weight_kg: lastKnownBw,
        body_fat_pct: parseNum(row.körperfett || row.body_fat_pct || row.kfa),
        sleep_performance_pct: parseIntNum(row.sleep || row.sleep_performance_pct || row.schlafeffizienz),
        whoop_recovery_pct: parseIntNum(row.recovery || row.whoop_recovery_pct || row.erholung),
        whoop_strain: parseNum(row.strain || row.whoop_strain || row.belastung),
        approach_speed_11m_to_1m: parseNum(row.vmax_weit || row.approach_speed_11m_to_1m || row.speed),
        sprint_speed: parseNum(row.vmax_sprint || row.sprint_speed),
        rsi_score: parseNum(row.dj50_reaktivität_w_kg_ || row.dj50_reaktivit_t_w_kg_ || row.rsi_score || row.dj50_reaktivität),
        cmj_mit_armen: parseNum(row.cmj_mit_armen_cm_ || row.cmj_mit_armen),
        cmj_ohne_arme: parseNum(row.cmj_ohne_arme_cm_ || row.cmj_ohne_arme),
        best_mark_m: parseNum(row.weitsprung_wk || row.best_mark_m || row.weite),
        eff_mark_m: parseNum(row.weite_effektiv || row.eff_mark_m),
        trapbar_e1rm_kg: parseNum(row.e1rm_trapbar || row.trapbar_e1rm_kg),
        umsetzen_e1rm_kg: parseNum(row.e1rm_umsetzen || row.umsetzen_e1rm_kg),
        hipthrust_e1rm_kg: validHip,
        aufsteiger_e1rm_kg: parseNum(row.e1rm_aufsteiger || row.aufsteiger_e1rm_kg),
        protocol_text: protocolText,
        regeneration: regeneration,
        nutrition: nutrition,
        supplements: supplements,
        schlaf_notiz: sleepHabits,
        sozial: row.sozial || '',
        schmerzen: row.schmerzen || '',
        schmerzbereiche: row.schmerzbereiche || '',
        erschöpfung: row.erschöpfung || '',
        tagesform: row.tagesform || '',
        probleme: problems,
        learnings: learnings,
        performance_score: perfScore,
        focus_score: focusScore,
        pain_score: painScore,
        fatigue_score: fatigueScore,
        daily_form: row.tagesform || 'Frisch',
        athlete_comments: comments || (learnings ? `Learnings: ${learnings}` : ''),
        calories_kcal: parseIntNum(row.calories || row.kalorien),
        protein_g: parseNum(row.protein),
        fat_g: parseNum(row.fat),
        carbs_g: parseNum(row.carbs),
        dj50_stütz: parseNum(row.dj50_stütz_s_ || row.dj50_st_tz_s_ || row.dj50_stütz),
        achilles_l_strain: parseNum(row.achilles_l_strain_ || row.achilles_l_strain___ || row.achilles_l_strain),
        achilles_r_strain: parseNum(row.achilles_r_strain_ || row.achilles_r_strain___ || row.achilles_r_strain),
        achilles_l_kraft: parseNum(row.achilles_l_kraft_nm_ || row.achilles_l_kraft),
        achilles_r_kraft: parseNum(row.achilles_r_kraft_nm_ || row.achilles_r_kraft),
        achilles_l_stiffness: parseNum(row.achilles_l_stiffness_nm_ || row.achilles_l_stiffness_nm___ || row.achilles_l_stiffness),
        achilles_r_stiffness: parseNum(row.achilles_r_stiffness_nm_ || row.achilles_r_stiffness_nm___ || row.achilles_r_stiffness),
        sprint_30m_fliegend: parseNum(row['30m_fliegend'] || row._30m_fliegend || row.sprint_30m_fliegend),
        sprint_60m_wk: parseNum(row['60m_wk'] || row._60m_wk || row.sprint_60m_wk),
        sprint_100m_wk: parseNum(row['100m_wk'] || row._100m_wk || row.sprint_100m_wk),
        vmax_sprint_ort: row.vmax_sprint_ort || '',
        wind: row.wind || '',
        entfernung_4l: parseNum(row.entfernung_4l),
        abstand_sprungbein_standbein: parseNum(row.abstand_sprungbein_standbein),
        geschwindigkeitsbilanz: parseNum(row.geschwindigkeitsbilanz),
        v_vertikal: parseNum(row.v_vertikal),
        anlaufschritte: parseIntNum(row.anlaufschritte),
        vmax_weit_ort: row.vmax_weit_ort || ''
      });
    }

    logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Linear body weight trend interpolation between nearest weighed entries before & after
    const bwPoints = logs
      .map(l => (l.body_weight_kg != null && l.date) ? { t: new Date(l.date + 'T12:00:00').getTime(), d: l.date, bw: l.body_weight_kg } : null)
      .filter(Boolean);

    if (bwPoints.length > 0) {
      let ptr = 0;
      logs.forEach(l => {
        if (l.body_weight_kg != null) {
          l.ref_body_weight_kg = l.body_weight_kg;
          l.interp_body_weight_source = `Exakt (${l.date})`;
          return;
        }
        const curT = new Date((l.date || '2026-01-01') + 'T12:00:00').getTime();
        while (ptr < bwPoints.length - 1 && bwPoints[ptr + 1].t <= curT) {
          ptr++;
        }
        const prevPt = bwPoints[ptr];
        const nextPt = ptr + 1 < bwPoints.length ? bwPoints[ptr + 1] : null;
        if (curT <= prevPt.t) {
          l.ref_body_weight_kg = prevPt.bw;
          l.interp_body_weight_source = `Trend vor ${prevPt.d} (${prevPt.bw} kg)`;
        } else if (!nextPt) {
          l.ref_body_weight_kg = prevPt.bw;
          l.interp_body_weight_source = `Trend ab ${prevPt.d} (${prevPt.bw} kg)`;
        } else {
          const span = Math.max(1, nextPt.t - prevPt.t);
          const ratio = (curT - prevPt.t) / span;
          const interp = Math.round((prevPt.bw + ratio * (nextPt.bw - prevPt.bw)) * 100) / 100;
          l.ref_body_weight_kg = interp;
          l.interp_body_weight_source = `Trend ${prevPt.d} (${prevPt.bw}kg) → ${nextPt.d} (${nextPt.bw}kg)`;
        }
      });
    }

    return logs;
  }

  return {
    init,
    render,
    prevDay,
    nextDay,
    goToToday,
    onDatePicked,
    triggerDirectDatePicker,
    openDatePickerModal,
    applyModalPickedDate,
    openWeightModal,
    setWeightInterval,
    renderWeightChart,
    openScoresHistoryModal,
    setScoresInterval,
    renderScoresChart,
    openInsightModal,
    onInsightYearChanged,
    renderInsightHeatmap,
    renderInsightCalendar,
    onCorrelationParamChanged,
    updateCorrelationScatter,
    setStrengthDisplayMode,
    setStrengthInterval,
    toggleStrengthExercise,
    renderStrengthDiagnosticsChart,
    openSheetsModal,
    saveSheetsUrl,
    resetToSampleData,
    syncGoogleSheets,
    parseCsvTrainingLogs
  };
})();

window.AnalyticsModule = AnalyticsModule;
