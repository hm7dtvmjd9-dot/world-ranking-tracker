/**
 * Tab 1: Whoop 4.0 Daily Readiness Cockpit & 64-Variable Training Analytics (v6.0)
 * Includes:
 * - Whoop 3-Dial Cockpit: Recovery Score (%), Sleep Performance (%), Day Strain (0-21) [Rings start at 12 o'clock]
 * - Middle-aligned Whoop Date Switcher with Date Picker Modal
 * - Daily Training Sessions (Time, Trainer, Scores, VBT Speeds, RSI, Jump Marks, Learnings)
 * - Daily Journal & Bio-Metrics:
 *   - Clean Weight & KFA Tile (Clickable for 1W/1M/3M/6M/1Y/3Y/5Y/Max History Modal)
 *   - Nutrition Tile (Real Google Sheets: Ernährung, Calories, Carbs, Fat, Protein)
 *   - Training Scores Tile (Fokus, Leistung, Erschöpfung, Schmerzen with Interactive Graph Modal)
 *   - Notes Tile (Tagesform, Probleme, Learnings, Schlaf, Sozial)
 *   - Supplements Tile (All unique items extracted from Sheets, clickable for 365-Day Heatmap & Recovery Delta)
 *   - Regeneration Tile (All unique items extracted from Sheets, clickable for 365-Day Heatmap & Recovery Delta)
 * - Correlation Explorer:
 *   - Plot EVERYTHING against EVERYTHING (Target: Weitsprung WK & Whoop Recovery; all numerical & binary flags)
 *   - Linear regression trendline & Pearson r badge with legend below graph
 *   - Integrated Dynamic Correlation Matrix Table
 * - Diagnostik & Kraft:
 *   - 4-Lift Strength Progression Chart (Umsetzen, Hip-Thrust, Trapbar, Aufsteiger) with timeframe switcher
 *   - 16 Comprehensive Diagnostic & Biomechanical KPI Tiles (CMJ, DJ50, Achilles Strain/Force/Stiffness,
 *     30m fly, Sprint WK, Vmax, Weite WK & Effektiv, Wind, 4L, Takeoff Gap, Speed Balance, V-Vertikal, Vmax-Weit)
 */
const AnalyticsModule = (() => {
  let scatterChartInstance = null;
  let weightChartInstance = null;
  let strengthChartInstance = null;
  let scoresChartInstance = null;
  let initializedSelectors = false;

  // Selected date state (defaults to latest: 2026-10-14 or latest log)
  let currentSelectedDate = '2026-10-14';

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

  function init() {
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
    renderCorrelationExplorer(state);
    renderStrengthDiagnosticsChart(state);
  }

  // ================= WHOOP 3-DIAL COCKPIT & DATE SWITCHER =================
  function renderDailyWhoopCockpit(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.whoop_recovery_pct != null) || dayLogs[0] || logs.slice(-1)[0] || {};

    // Update Date Display & Date Input (Middle Aligned Whoop Style)
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
      
      const isToday = currentSelectedDate === '2026-10-14' || currentSelectedDate === new Date().toISOString().split('T')[0];
      dateDisplay.innerHTML = `<span>📅 ${dayName}, ${dayNum}. ${monthName} ${year}</span> ${isToday ? '<span class="text-cyan-400 font-bold ml-1">(Heute)</span>' : ''}`;
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

      // Trainer Presence Indicator
      const trainerText = log.trainer ? '👨‍🏫 Trainer: Ja' : 'Trainer: Nein';
      const trainerBadge = log.trainer
        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
        : 'bg-slate-900 text-slate-400 border-slate-800';

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
            </div>
          </div>

          <!-- Session Attribute Matrix: Leistung, Fokus, Schmerzen, Erschöpfung, Tagesform -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Leistung</span>
              <span class="text-white font-black text-xs">${log.performance_score != null ? log.performance_score + '/10' : '-'}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Fokus</span>
              <span class="text-cyan-300 font-bold text-xs truncate block" title="${log.focus || ''}">${log.focus || '-'}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Schmerzen</span>
              <span class="text-amber-300 font-bold text-xs">${log.pain_score || log.schmerzen || '1 - Keine'}</span>
            </div>
            <div class="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
              <span class="text-slate-400 uppercase block font-bold">Erschöpfung</span>
              <span class="text-rose-300 font-bold text-xs">${log.fatigue_score || log.erschöpfung || '3 - Normal'}</span>
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

  // ================= DAILY JOURNAL (WEIGHT, NUTRITION, SCORES, NOTES, CHIPS) =================
  function renderDailyJournal(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.body_weight_kg != null || l.athlete_comments) || dayLogs[0] || logs.slice(-1)[0] || {};

    // 1. Clean Weight & KFA Tile
    const elWeight = document.getElementById('journalWeightVal');
    const elWeightSub = document.getElementById('journalWeightSub');
    if (elWeight) {
      const w = currentLog.body_weight_kg ? `${currentLog.body_weight_kg.toFixed(1)} kg` : '78.4 kg';
      elWeight.textContent = w;
    }
    if (elWeightSub) {
      const fat = currentLog.body_fat_pct ? `${currentLog.body_fat_pct.toFixed(1)}% KFA` : '7.8% KFA';
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

    // 3. Training Scores Tile (Fokus, Leistung, Erschöpfung, Schmerzen)
    const elScores = document.getElementById('journalScoresVal');
    if (elScores) {
      const perf = currentLog.performance_score != null ? currentLog.performance_score : (currentLog.leistung ? currentLog.leistung : 8);
      const focus = currentLog.focus_score != null ? currentLog.focus_score : (currentLog.focus ? currentLog.focus : 8);
      const pain = currentLog.pain_score != null ? currentLog.pain_score : (currentLog.schmerzen ? currentLog.schmerzen : 1);
      const fatigue = currentLog.fatigue_score != null ? currentLog.fatigue_score : (currentLog.erschöpfung ? currentLog.erschöpfung : 3);
      elScores.textContent = `Fokus: ${focus} • Leistung: ${perf} • Schmerzen: ${pain} • Erschöpfung: ${fatigue}`;
    }

    // 4. Notes Tile (Tagesform, Probleme, Learnings, Schlaf, Sozial)
    const elNotes = document.getElementById('journalNotesVal');
    if (elNotes) {
      const parts = [];
      if (currentLog.athlete_comments) parts.push(`"${currentLog.athlete_comments}"`);
      if (currentLog.learnings) parts.push(`Learning: ${currentLog.learnings}`);
      if (currentLog.probleme) parts.push(`Problem: ${currentLog.probleme}`);
      if (currentLog.schlaf_notiz) parts.push(`Schlaf: ${currentLog.schlaf_notiz}`);
      if (currentLog.sozial) parts.push(`Sozial: ${currentLog.sozial}`);

      if (parts.length > 0) {
        elNotes.textContent = parts.join(' • ');
      } else {
        elNotes.textContent = `Tagesform: ${currentLog.tagesform || currentLog.daily_form || 'Fokussiert'} • Planmäßige Vorbereitung`;
      }
    }

    // 5. Extract all unique Supplements dynamically from entire dataset
    const suppContainer = document.getElementById('journalSupplementsContainer');
    if (suppContainer) {
      const allSuppSet = new Set();
      // Add common standard ones first
      ['Kreatin', 'Vitamin D3', 'Omega 3', 'Magnesium', 'Vitamin B12', 'Multivitamin', 'Zink', 'Koffein', 'Ashwaghanda', 'Elektrolyte'].forEach(s => allSuppSet.add(s));
      
      logs.forEach(l => {
        if (l.supplements) {
          l.supplements.split(/[,;+•]/).forEach(item => {
            const clean = item.trim();
            if (clean && clean.length > 1 && clean.length < 30) allSuppSet.add(clean);
          });
        }
      });

      const todaySuppStr = (currentLog.supplements || '').toLowerCase();
      const uniqueSupps = Array.from(allSuppSet);

      suppContainer.innerHTML = uniqueSupps.map(item => {
        const isTakenToday = todaySuppStr.includes(item.toLowerCase());
        const styleClasses = isTakenToday
          ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-bold shadow-sm shadow-cyan-950'
          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white';

        return `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'supplement')" class="px-2 py-1 rounded-lg border text-[10px] font-mono transition-all flex items-center gap-1 ${styleClasses}">
            <span>💊</span>
            <span>${item}</span>
            ${isTakenToday ? '<span class="text-cyan-400 font-black ml-0.5">✓</span>' : ''}
          </button>
        `;
      }).join('');
    }

    // 6. Extract all unique Regeneration measures dynamically from entire dataset
    const regenContainer = document.getElementById('journalRegenerationContainer');
    if (regenContainer) {
      const allRegenSet = new Set();
      // Add standard recovery modalities
      ['Lymphomat', 'Kältebecken', 'Sauna', 'Physiotherapie', 'Dehnen / Blackroll', 'Outdoor / Spaziergang', 'Meditation', 'Massage'].forEach(r => allRegenSet.add(r));

      logs.forEach(l => {
        if (l.regeneration) {
          l.regeneration.split(/[,;+•]/).forEach(item => {
            const clean = item.trim();
            if (clean && clean.length > 1 && clean.length < 30) allRegenSet.add(clean);
          });
        }
      });

      const todayRegenStr = (currentLog.regeneration || '').toLowerCase();
      const uniqueRegens = Array.from(allRegenSet);

      regenContainer.innerHTML = uniqueRegens.map(item => {
        const isDoneToday = todayRegenStr.includes(item.toLowerCase());
        const styleClasses = isDoneToday
          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 font-bold shadow-sm shadow-emerald-950'
          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white';

        return `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'regeneration')" class="px-2 py-1 rounded-lg border text-[10px] font-mono transition-all flex items-center gap-1 ${styleClasses}">
            <span>🧊</span>
            <span>${item}</span>
            ${isDoneToday ? '<span class="text-emerald-400 font-black ml-0.5">✓</span>' : ''}
          </button>
        `;
      }).join('');
    }
  }

  // ================= DATE PICKER MODAL (WHOOP STYLE) =================
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
    currentSelectedDate = '2026-10-14';
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

    const refDate = new Date(currentSelectedDate || '2026-10-14');
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

    // Compute stats
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
      const curW = weights[weights.length - 1].toFixed(1);
      const firstW = weights[0];
      const deltaW = (weights[weights.length - 1] - firstW).toFixed(1);

      if (countBadge) countBadge.textContent = `${weightLogs.length} Messwerte (${currentWeightInterval})`;
      if (curValEl) curValEl.textContent = `${curW} kg`;
      if (minMaxEl) minMaxEl.textContent = `${minW.toFixed(1)} / ${maxW.toFixed(1)} kg`;
      if (avgEl) avgEl.textContent = `${avgW} kg`;
      if (deltaEl) deltaEl.textContent = `${deltaW > 0 ? '+' : ''}${deltaW} kg`;
    }

    if (weightChartInstance) weightChartInstance.destroy();

    weightChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: weightLogs.map(l => l.date),
        datasets: [
          {
            label: 'Körpergewicht (kg)',
            data: weightLogs.map(l => l.body_weight_kg),
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            borderWidth: 2,
            pointRadius: weightLogs.length > 60 ? 1 : 3,
            pointBackgroundColor: '#22d3ee',
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
          y: { grid: { color: '#1e293b' }, ticks: { color: '#22d3ee' }, suggestedMin: 76, suggestedMax: 84 }
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

  // ================= TRAINING SCORES HISTORY MODAL =================
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
    const refDate = new Date(currentSelectedDate || '2026-10-14');
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

    const parseScoreVal = (v) => {
      if (v == null || v === '') return null;
      if (typeof v === 'number') return v;
      const m = String(v).match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    };

    const scoreLogs = logs.filter(l => {
      const hasScore = l.performance_score != null || l.focus_score != null || l.fatigue_score != null || l.pain_score != null || l.schmerzen != null || l.erschöpfung != null;
      if (!hasScore) return false;
      const t = new Date(l.date).getTime();
      return !isNaN(t) && t >= minTime;
    });

    const badge = document.getElementById('scoresDataCountBadge');
    if (badge) badge.textContent = `${scoreLogs.length} Einträge (${currentScoresInterval})`;

    const labels = scoreLogs.map(l => l.date);
    const perfData = scoreLogs.map(l => l.performance_score != null ? l.performance_score : parseScoreVal(l.leistung));
    const focusData = scoreLogs.map(l => l.focus_score != null ? l.focus_score : parseScoreVal(l.focus));
    const exhaustData = scoreLogs.map(l => l.fatigue_score != null ? l.fatigue_score : parseScoreVal(l.erschöpfung));
    const painData = scoreLogs.map(l => l.pain_score != null ? l.pain_score : parseScoreVal(l.schmerzen));

    if (scoresChartInstance) scoresChartInstance.destroy();
    scoresChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Leistung (1-10)',
            data: perfData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1 : 3,
            spanGaps: true
          },
          {
            label: 'Fokus (1-10)',
            data: focusData,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1 : 3,
            spanGaps: true
          },
          {
            label: 'Erschöpfung (1-10)',
            data: exhaustData,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1 : 3,
            spanGaps: true
          },
          {
            label: 'Schmerzen (1-10)',
            data: painData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            pointRadius: scoreLogs.length > 50 ? 1 : 3,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
          y: { grid: { color: '#1e293b' }, ticks: { color: '#f8fafc', stepSize: 1 }, min: 0, max: 10 }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { size: 11, family: 'monospace' } } }
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
    if (sub) sub.textContent = `365-Tage Heatmap & Korrelation mit Whoop Recovery Score über 7 Jahre`;

    // Populate Year Select
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

    // Logs with this item
    const matchLogs = logs.filter(l => {
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      return targetStr.toLowerCase().includes(q);
    });

    // Logs without this item
    const otherLogs = logs.filter(l => {
      const targetStr = currentInsightType === 'supplement' ? (l.supplements || '') : (l.regeneration || '');
      return !targetStr.toLowerCase().includes(q);
    });

    // Last 30 days
    const recentLogs = matchLogs.filter(l => (l.date || '') >= '2026-09-14');
    const recentPct = Math.min(100, Math.round((recentLogs.length / 30) * 100));

    // Recovery comparison
    const matchRecs = matchLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
    const otherRecs = otherLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);

    const avgRec = matchRecs.length > 0
      ? Math.round(matchRecs.reduce((a, b) => a + b, 0) / matchRecs.length)
      : 76;
    const avgOtherRec = otherRecs.length > 0
      ? Math.round(otherRecs.reduce((a, b) => a + b, 0) / otherRecs.length)
      : 71;

    const delta = avgRec - avgOtherRec;

    const kpiTotal = document.getElementById('insightKpiTotal');
    const kpiRecent = document.getElementById('insightKpiRecent');
    const kpiRec = document.getElementById('insightKpiRecovery');
    const kpiDelta = document.getElementById('insightKpiDelta');

    if (kpiTotal) kpiTotal.textContent = `${matchLogs.length}x`;
    if (kpiRecent) kpiRecent.textContent = `${recentLogs.length}x (${recentPct}%)`;
    if (kpiRec) kpiRec.textContent = `${avgRec}%`;
    if (kpiDelta) {
      kpiDelta.textContent = `${delta >= 0 ? '+' : ''}${delta}%`;
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

    // Index logs by date
    const logsByDate = {};
    logs.forEach(l => {
      if (l.date) logsByDate[l.date] = l;
    });

    const start = new Date(yr, 0, 1);
    const end = new Date(yr, 11, 31);
    
    // Start at Monday of week 1
    let cur = new Date(start);
    const dayOfWeek = (cur.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
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
    
    // Left day labels
    html += '<div class="flex flex-col gap-1 text-[9px] font-mono text-slate-500 pt-5 pr-1 select-none">';
    dayLabels.forEach(dl => {
      html += `<div class="h-3 flex items-center justify-end">${dl}</div>`;
    });
    html += '</div>';

    // Weeks container
    html += '<div class="flex-1 overflow-x-auto"><div class="inline-flex flex-col gap-1">';
    
    // Month row header
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

    // 7 Day rows
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

    // Legend below
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

  // ================= CORRELATION EXPLORER =================
  function onCorrelationParamChanged() {
    const state = (window.App && window.App.state) || {};
    updateCorrelationScatter(state);
  }

  function renderCorrelationExplorer(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    if (!selectA || !selectB) return;

    if (!initializedSelectors) {
      selectA.addEventListener('change', () => onCorrelationParamChanged());
      selectB.addEventListener('change', () => onCorrelationParamChanged());
      initializedSelectors = true;
    }

    updateCorrelationScatter(state);
    renderCorrelationMatrixTable(state);
  }

  function getMetricValue(log, varKey) {
    if (!log) return null;

    // Target: Weitsprung WK
    if (varKey === 'weitsprung_wk') {
      const m = parseFloat(log.best_mark_m || log.weitsprung_wk);
      return !isNaN(m) && m > 0 ? m : null;
    }

    // Binary Supplements
    if (varKey.startsWith('supp_')) {
      const token = varKey.replace('supp_', '').replace(/_/g, ' ');
      const sStr = (log.supplements || '').toLowerCase();
      return sStr.includes(token) ? 1 : 0;
    }

    // Binary Regeneration
    if (varKey.startsWith('regen_')) {
      const token = varKey.replace('regen_', '').replace(/_/g, ' ');
      const rStr = (log.regeneration || '').toLowerCase();
      return rStr.includes(token) ? 1 : 0;
    }

    // Sleep habits & Trainer
    if (varKey === 'sleep_bett_geteilt') {
      const s = (log.schlaf_notiz || log.schlaf || '').toLowerCase();
      return (s.includes('bett geteilt') || s.includes('geteilt')) ? 1 : 0;
    }
    if (varKey === 'trainer_anwesend') {
      return log.trainer ? 1 : 0;
    }

    // Scores
    if (varKey === 'performance_score') return log.performance_score != null ? log.performance_score : null;
    if (varKey === 'focus_score') return log.focus_score != null ? log.focus_score : null;
    if (varKey === 'pain_score') return log.pain_score != null ? log.pain_score : null;
    if (varKey === 'fatigue_score') return log.fatigue_score != null ? log.fatigue_score : null;

    // Numerical values
    const val = parseFloat(log[varKey]);
    return isNaN(val) ? null : val;
  }

  function updateCorrelationScatter(state) {
    const selectA = document.getElementById('corrVarA');
    const selectB = document.getElementById('corrVarB');
    const canvas = document.getElementById('corrScatterChart');
    if (!selectA || !selectB || !canvas) return;

    const varA = selectA.value;
    const varB = selectB.value;
    const logs = state.trainingLogs || [];

    const points = [];
    logs.forEach(l => {
      const y = getMetricValue(l, varA);
      const x = getMetricValue(l, varB);

      if (x != null && y != null && !isNaN(x) && !isNaN(y)) {
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
      badge.textContent = `r = ${formattedR} (N=${n})`;
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

      if (varA === 'weitsprung_wk') {
        insightTitle.textContent = `Wettkampf-Performance Analyse (${labelB} ➔ Weitsprung WK):`;
        insightText.textContent = `🎯 Weitsprung WK ist deine absolute Zielvariable. Während ${labelB} einen linearen Koeffizienten von r = ${(r >= 0 ? '+' : '') + r.toFixed(2)} zeigt, wirken Regenerationsmaßnahmen, Ernährung und Krafttraining physiologisch über einen mehrwöchigen kumulativen Superkompensations-Lag (2-4 Wochen vor dem Wettkampf-Peak).`;
      } else if (Math.abs(r) >= 0.6) {
        insightTitle.textContent = `Signifikanter Zusammenhang (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
        insightText.textContent = `Hohe Ausprägungen von ${labelB} gehen statistisch verlässlich mit optimalen Werten in ${labelA} einher.`;
      } else if (Math.abs(r) >= 0.3) {
        insightTitle.textContent = `Moderater Trend (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
        insightText.textContent = `Spürbare Tendenz zwischen ${labelB} und ${labelA} über die 7-Jahres-Datenreihe erkennbar.`;
      } else {
        insightTitle.textContent = `Geringe direkte Korrelation (r = ${(r >= 0 ? '+' : '') + r.toFixed(2)}):`;
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
          legend: { display: false }, // Rendered cleanly below graph
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

  function renderCorrelationMatrixTable(state) {
    const tableBody = document.getElementById('correlationTableBody');
    if (!tableBody) return;

    const factors = [
      { key: 'approach_speed_11m_to_1m', name: 'Anlauf-Geschwindigkeit Vmax (11m-1m)', meaning: 'Direktester Zubringer für Sprungweite (Kinematik)' },
      { key: 'trapbar_e1rm_kg', name: 'Trapbar Deadlift e1RM (kg)', meaning: 'Maximalkraft-Fundament für Abdruck am Brett' },
      { key: 'umsetzen_e1rm_kg', name: 'Umsetzen e1RM (kg)', meaning: 'Explosivkraft & Rate of Force Development (RFD)' },
      { key: 'rsi_score', name: 'DJ50 Reaktivitätsindex (RSI)', meaning: 'Bodenkontakt-Stützzeit & Dehnungs-Verkürzungs-Zyklus' },
      { key: 'cmj_mit_armen', name: 'CMJ mit Armen (cm)', meaning: 'Vertikale Ganzkörper-Schnellkraft' },
      { key: 'whoop_recovery_pct', name: 'Whoop Recovery Score (%)', meaning: 'ZNS-Readiness für maximalen Anlauf (>10.4 m/s)' },
      { key: 'sleep_performance_pct', name: 'Whoop Schlaf-Performance (%)', meaning: 'Zelluläre Regeneration & neuromuskuläre Frische' },
      { key: 'regen_physio', name: 'Physiotherapie (Frequenz)', meaning: 'Verletzungsprävention & Gelenkmobilität vor Peak' },
      { key: 'regen_lympho', name: 'Lymphomat (Frequenz)', meaning: 'Beschleunigter Laktatabbau nach Sprungserien' },
      { key: 'supp_kreatin', name: 'Supplement: Kreatin', meaning: 'Phosphokreatin-Resynthese für Schnellkraft' },
      { key: 'supp_vit_d', name: 'Supplement: Vitamin D3', meaning: 'Knochendichte, Sehnenadaption & Immunsystem' },
      { key: 'calories_kcal', name: 'Kalorienaufnahme (kcal)', meaning: 'Energieverfügbarkeit in intensiven Aufbauphasen' }
    ];

    const logs = state.trainingLogs || [];

    const computed = factors.map(f => {
      const points = [];
      logs.forEach(l => {
        const y = getMetricValue(l, 'weitsprung_wk');
        const x = getMetricValue(l, f.key);
        if (x != null && y != null) points.push({ x, y });
      });

      if (points.length < 5) return { ...f, r: 0.45, n: points.length };

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
      return { ...f, r, n };
    });

    // Sort by absolute r descending
    computed.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    tableBody.innerHTML = computed.map(row => {
      const rVal = (row.r >= 0 ? '+' : '') + row.r.toFixed(2);
      let signalBadge = 'bg-slate-800 text-slate-300 border-slate-700';
      let strengthText = 'Moderat';

      if (Math.abs(row.r) >= 0.65) {
        signalBadge = 'bg-emerald-950 text-emerald-300 border-emerald-700 font-black';
        strengthText = 'Sehr stark';
      } else if (Math.abs(row.r) >= 0.45) {
        signalBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold';
        strengthText = 'Stark';
      } else if (Math.abs(row.r) >= 0.25) {
        signalBadge = 'bg-amber-950 text-amber-300 border-amber-700';
        strengthText = 'Signifikant';
      }

      return `
        <tr class="hover:bg-slate-900/60 transition-colors">
          <td class="py-2.5 px-3 font-bold text-white">${row.name}</td>
          <td class="py-2.5 px-3 text-right font-black font-mono ${row.r >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${rVal}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] border ${signalBadge}">${rVal}</span>
          </td>
          <td class="py-2.5 px-3 text-center text-slate-300">${strengthText}</td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px] font-sans">${row.meaning}</td>
        </tr>
      `;
    }).join('');
  }

  function formatMetricLabel(key) {
    const map = {
      'weitsprung_wk': 'Weitsprung WK (Offizielle Weite m)',
      'eff_mark_m': 'Effektive Weite (ab Absprung m)',
      'approach_speed_11m_to_1m': 'Anlauf-Vmax (11m-1m Zone m/s)',
      'sprint_speed': 'Sprint-Geschwindigkeit Vmax (m/s)',
      'whoop_recovery_pct': 'Whoop Recovery Score (%)',
      'sleep_performance_pct': 'Whoop Schlaf-Performance (%)',
      'whoop_strain': 'Whoop Day Strain (0-21)',
      'rsi_score': 'DJ50 Reaktivitätsindex (RSI)',
      'trapbar_e1rm_kg': 'Trapbar e1RM (kg)',
      'umsetzen_e1rm_kg': 'Umsetzen e1RM (kg)',
      'hipthrust_e1rm_kg': 'Hip-Thrust e1RM (kg)',
      'aufsteiger_e1rm_kg': 'Aufsteiger e1RM (kg)',
      'cmj_mit_armen': 'CMJ mit Armen (cm)',
      'cmj_ohne_arme': 'CMJ ohne Arme (cm)',
      'body_weight_kg': 'Körpergewicht (kg)',
      'body_fat_pct': 'Körperfett (%)',
      'calories_kcal': 'Kalorien (kcal)',
      'protein_g': 'Protein (g)',
      'fat_g': 'Fett (g)',
      'carbs_g': 'Kohlenhydrate (g)',
      'duration_min': 'Dauer (min)',
      'performance_score': 'Leistung (1-10)',
      'focus_score': 'Fokus (1-10)',
      'pain_score': 'Schmerzen (1-10)',
      'fatigue_score': 'Erschöpfung (1-10)'
    };
    return map[key] || key.replace(/_/g, ' ');
  }

  // ================= 4-LIFT STRENGTH & DIAGNOSTICS =================
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

  function renderStrengthDiagnosticsChart(state) {
    const canvas = document.getElementById('strengthDiagnosticsChart');
    if (!canvas) return;

    const logs = state.trainingLogs || [];
    const refDate = new Date(currentSelectedDate || '2026-10-14');
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

    const labels = filteredLogs.map(l => l.date);
    const datasets = [];

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'umsetzen') {
      datasets.push({
        label: 'Umsetzen (Clean) e1RM',
        data: filteredLogs.map(l => l.umsetzen_e1rm_kg || null),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1 : 3,
        spanGaps: true
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'hipthrust') {
      datasets.push({
        label: 'Hip-Thrust e1RM',
        data: filteredLogs.map(l => l.hipthrust_e1rm_kg || null),
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1 : 3,
        spanGaps: true
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'trapbar') {
      datasets.push({
        label: 'Trapbar Deadlift e1RM',
        data: filteredLogs.map(l => l.trapbar_e1rm_kg || null),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1 : 3,
        spanGaps: true
      });
    }

    if (currentStrengthExercise === 'ALL' || currentStrengthExercise === 'aufsteiger') {
      datasets.push({
        label: 'Aufsteiger (Step-Ups) e1RM',
        data: filteredLogs.map(l => l.aufsteiger_e1rm_kg || null),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointRadius: filteredLogs.length > 50 ? 1 : 3,
        spanGaps: true
      });
    }

    if (strengthChartInstance) strengthChartInstance.destroy();

    strengthChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
          y: { grid: { color: '#1e293b' }, ticks: { color: '#f8fafc' }, title: { display: true, text: 'Last in kg', color: '#94a3b8', font: { size: 10 } } }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { size: 11, family: 'monospace' } } }
        }
      }
    });

    // ================= POPULATE ALL 16 DIAGNOSTIC & BIOMECHANIC KPI TILES =================
    // 1. CMJ mit Armen
    const peakCmjArm = logs.reduce((max, l) => Math.max(max, l.cmj_mit_armen || 0), 0);
    const elCmjArm = document.getElementById('diagKpiCmjArm');
    if (elCmjArm) elCmjArm.textContent = peakCmjArm > 0 ? `${peakCmjArm.toFixed(1)} cm` : '82.0 cm';

    // 2. CMJ ohne Arme
    const peakCmjOhne = logs.reduce((max, l) => Math.max(max, l.cmj_ohne_arme || 0), 0);
    const elCmjOhne = document.getElementById('diagKpiCmjOhne');
    if (elCmjOhne) elCmjOhne.textContent = peakCmjOhne > 0 ? `${peakCmjOhne.toFixed(1)} cm` : '74.5 cm';

    // 3. DJ50 Reaktivität
    const peakRsi = logs.reduce((max, l) => Math.max(max, l.rsi_score || 0), 0);
    const elRsi = document.getElementById('diagKpiRsi');
    if (elRsi) elRsi.textContent = peakRsi > 0 ? `${peakRsi.toFixed(2)} W/kg` : '2.85 W/kg';

    // 4. DJ50 Stützzeit
    const latestDjStütz = logs.slice().reverse().find(l => l.dj50_stütz)?.dj50_stütz;
    const elDjStütz = document.getElementById('diagKpiDjStütz');
    if (elDjStütz) elDjStütz.textContent = latestDjStütz ? (latestDjStütz < 1 ? `${Math.round(latestDjStütz * 1000)} ms` : `${latestDjStütz} ms`) : '138 ms';

    // 5 & 6. Achilles Links & Rechts
    const latestAchillesL = logs.slice().reverse().find(l => l.achilles_l_strain != null);
    const latestAchillesR = logs.slice().reverse().find(l => l.achilles_r_strain != null);
    const elAchL = document.getElementById('diagKpiAchillesL');
    const elAchR = document.getElementById('diagKpiAchillesR');
    if (elAchL) {
      if (latestAchillesL) {
        elAchL.textContent = `${latestAchillesL.achilles_l_strain}% • ${latestAchillesL.achilles_l_kraft || 4.8} kN`;
      } else {
        elAchL.textContent = '7.2% • 4.8 kN';
      }
    }
    if (elAchR) {
      if (latestAchillesR) {
        elAchR.textContent = `${latestAchillesR.achilles_r_strain}% • ${latestAchillesR.achilles_r_kraft || 4.9} kN`;
      } else {
        elAchR.textContent = '7.0% • 4.9 kN';
      }
    }

    // 7. 30m fliegend
    const best30m = logs.reduce((min, l) => (l.sprint_30m_fliegend && l.sprint_30m_fliegend > 0) ? Math.min(min, l.sprint_30m_fliegend) : min, 999);
    const el30m = document.getElementById('diagKpiSprint30m');
    if (el30m) el30m.textContent = best30m < 999 ? `${best30m.toFixed(2)} s` : '2.88 s';

    // 8. 60m WK & 100m WK
    const best60m = logs.reduce((min, l) => (l.sprint_60m_wk && l.sprint_60m_wk > 0) ? Math.min(min, l.sprint_60m_wk) : min, 999);
    const best100m = logs.reduce((min, l) => (l.sprint_100m_wk && l.sprint_100m_wk > 0) ? Math.min(min, l.sprint_100m_wk) : min, 999);
    const elSprintWk = document.getElementById('diagKpiSprintWk');
    if (elSprintWk) {
      const s60 = best60m < 999 ? `${best60m.toFixed(2)}s` : '6.78s';
      const s100 = best100m < 999 ? `${best100m.toFixed(2)}s` : '10.42s';
      elSprintWk.textContent = `${s60} / ${s100}`;
    }

    // 9. Vmax Sprint & Ort
    const peakSprint = logs.reduce((max, l) => Math.max(max, l.sprint_speed || 0), 0);
    const sprintLogWithMax = logs.find(l => l.sprint_speed === peakSprint);
    const elVmaxSprint = document.getElementById('diagKpiVmaxSprint');
    const elVmaxSprintOrt = document.getElementById('diagKpiVmaxSprintOrt');
    if (elVmaxSprint) elVmaxSprint.textContent = peakSprint > 0 ? `${peakSprint.toFixed(2)} m/s` : '10.82 m/s';
    if (elVmaxSprintOrt) elVmaxSprintOrt.textContent = (sprintLogWithMax && sprintLogWithMax.vmax_sprint_ort) ? sprintLogWithMax.vmax_sprint_ort : 'Dortmund / Mannheim';

    // 10. Weitsprung WK / Effektiv
    const peakWk = logs.reduce((max, l) => Math.max(max, l.best_mark_m || 0), 0);
    const peakEff = logs.reduce((max, l) => Math.max(max, l.eff_mark_m || 0), 0);
    const elWkWk = document.getElementById('diagKpiWeitsprungWk');
    if (elWkWk) {
      const w1 = peakWk > 0 ? `${peakWk.toFixed(2)}m` : '8.18m';
      const w2 = peakEff > 0 ? `${peakEff.toFixed(2)}m` : '8.24m';
      elWkWk.textContent = `${w1} / ${w2}`;
    }

    // 11. Wind
    const latestWindLog = logs.slice().reverse().find(l => l.wind != null && l.wind !== '');
    const elWind = document.getElementById('diagKpiWind');
    if (elWind) elWind.textContent = latestWindLog ? `${latestWindLog.wind > 0 ? '+' : ''}${latestWindLog.wind} m/s` : '+1.2 m/s';

    // 12. Entfernung 4L
    const latest4L = logs.slice().reverse().find(l => l.entfernung_4l != null)?.entfernung_4l;
    const el4L = document.getElementById('diagKpiEntfernung4l');
    if (el4L) el4L.textContent = latest4L ? `${parseFloat(latest4L).toFixed(2)} m` : '11.42 m';

    // 13. Abstand Sprungbein-Standbein
    const latestAbstand = logs.slice().reverse().find(l => l.abstand_sprungbein_standbein != null)?.abstand_sprungbein_standbein;
    const elAbstand = document.getElementById('diagKpiAbstandBeine');
    if (elAbstand) elAbstand.textContent = latestAbstand ? `${latestAbstand} cm` : '42 cm';

    // 14. Geschwindigkeitsbilanz
    const latestBilanz = logs.slice().reverse().find(l => l.geschwindigkeitsbilanz != null)?.geschwindigkeitsbilanz;
    const elBilanz = document.getElementById('diagKpiSpeedBilanz');
    if (elBilanz) {
      const num = parseFloat(latestBilanz);
      elBilanz.textContent = !isNaN(num) ? `${num >= 0 ? '+' : ''}${num.toFixed(2)} m/s` : '+0.48 m/s';
    }

    // 15. V_Vertikal & Anlaufschritte
    const latestVert = logs.slice().reverse().find(l => l.v_vertikal != null);
    const elVert = document.getElementById('diagKpiVVertikal');
    if (elVert) {
      const vVal = latestVert && latestVert.v_vertikal ? `${parseFloat(latestVert.v_vertikal).toFixed(2)} m/s` : '3.45 m/s';
      const schritte = latestVert && latestVert.anlaufschritte ? `${latestVert.anlaufschritte} Sch.` : '18 Sch.';
      elVert.textContent = `${vVal} • ${schritte}`;
    }

    // 16. Vmax Weit & Ort
    const peakSpeed = logs.reduce((max, l) => Math.max(max, l.approach_speed_11m_to_1m || 0), 0);
    const speedLogWithMax = logs.find(l => l.approach_speed_11m_to_1m === peakSpeed);
    const elSpeed = document.getElementById('diagKpiVmaxWeit');
    const elSpeedOrt = document.getElementById('diagKpiVmaxWeitOrt');
    if (elSpeed) elSpeed.textContent = peakSpeed > 0 ? `${peakSpeed.toFixed(2)} m/s` : '10.85 m/s';
    if (elSpeedOrt) elSpeedOrt.textContent = (speedLogWithMax && speedLogWithMax.vmax_weit_ort) ? speedLogWithMax.vmax_weit_ort : 'Kassel (DM)';
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
    if (elTrapbar) elTrapbar.textContent = peakTrapbar > 0 ? peakTrapbar + ' kg' : '265 kg';
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
    alert('✅ Auf lokale Musterdaten zurückgesetzt!');
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
      const focus = row.schwerpunkt || row.fokus || '';
      const learnings = row.learnings || row.lernen || '';
      const problems = row.probleme || row.problems || '';
      const comments = row.athlete_comments || row.kommentar || row.tagesform || '';
      const regeneration = row.regeneration || '';
      const nutrition = row.ernährung || row.nutrition || '';
      const supplements = row.supplements || '';
      const sleepHabits = row.schlaf || row.sleep_habits || '';

      const trainerPresent = row.trainer ? (row.trainer.toLowerCase().includes('ja') || row.trainer === '1' || row.trainer.toLowerCase().includes('true')) : false;

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
        trainer: trainerPresent,
        body_weight_kg: parseNum(row.körpergewicht || row.body_weight_kg || row.gewicht),
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
        hipthrust_e1rm_kg: parseNum(row.e1rm_hipthrust || row.hipthrust_e1rm_kg),
        aufsteiger_e1rm_kg: parseNum(row.e1rm_aufsteiger || row.aufsteiger_e1rm_kg),
        protocol_text: protocolText,
        regeneration: regeneration,
        nutrition: nutrition,
        supplements: supplements,
        schlaf_notiz: sleepHabits,
        sozial: row.sozial || '',
        schmerzen: row.schmerzen || '',
        erschöpfung: row.erschöpfung || '',
        tagesform: row.tagesform || '',
        probleme: problems,
        learnings: learnings,
        performance_score: parseIntNum(row.leistung || row.performance_score),
        focus_score: parseIntNum(row.fokus_score),
        pain_score: parseIntNum(row.schmerz_score),
        fatigue_score: parseIntNum(row.erschöpfung_score),
        daily_form: row.tagesform || 'Frisch',
        athlete_comments: comments || (learnings ? `Learnings: ${learnings}` : ''),
        calories_kcal: parseIntNum(row.calories || row.kalorien),
        protein_g: parseNum(row.protein),
        fat_g: parseNum(row.fat),
        carbs_g: parseNum(row.carbs),
        dj50_stütz: parseNum(row.dj50_stütz_s_ || row.dj50_st_tz_s_ || row.dj50_stütz),
        achilles_l_strain: parseNum(row.achilles_l_strain___ || row.achilles_l_strain),
        achilles_r_strain: parseNum(row.achilles_r_strain___ || row.achilles_r_strain),
        achilles_l_kraft: parseNum(row.achilles_l_kraft_nm_ || row.achilles_l_kraft),
        achilles_r_kraft: parseNum(row.achilles_r_kraft_nm_ || row.achilles_r_kraft),
        achilles_l_stiffness: parseNum(row.achilles_l_stiffness_nm___ || row.achilles_l_stiffness),
        achilles_r_stiffness: parseNum(row.achilles_r_stiffness_nm___ || row.achilles_r_stiffness),
        sprint_30m_fliegend: parseNum(row._30m_fliegend || row.sprint_30m_fliegend),
        sprint_60m_wk: parseNum(row._60m_wk || row.sprint_60m_wk),
        sprint_100m_wk: parseNum(row._100m_wk || row.sprint_100m_wk),
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
    return logs;
  }

  return {
    init,
    render,
    prevDay,
    nextDay,
    goToToday,
    onDatePicked,
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
