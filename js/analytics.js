/**
 * Tab 1: Whoop 4.0 Daily Readiness Cockpit & 64-Variable Training Analytics
 * Includes:
 * - Live Google Sheets Sync via CSV Web Publishing
 * - Calendar Date Scrubber (Scrub through any historical day)
 * - Whoop 3-Dial Cockpit: Recovery Score (%), Sleep Performance (%), Day Strain (0-21)
 * - Expandable Daily Training Sessions (Time, Trainer, Scores, VBT Speeds, RSI, Jump Marks, Learnings)
 * - Daily Journal & Bio-Metrics (Clickable Bodyweight Modal, Clickable Supplements & Regeneration Insights)
 * - Interactive 4-Lift Strength Progression Chart (Umsetzen, Hip-Thrust, Trapbar, Aufsteiger) & Zubringer KPIs
 * - 2-Variable Factor Correlation Explorer (Target: Weitsprung WK & Whoop Recovery)
 */
const AnalyticsModule = (() => {
  let scatterChartInstance = null;
  let weightChartInstance = null;
  let strengthChartInstance = null;
  let initializedSelectors = false;

  // Selected date state (defaults to today: 2026-10-02)
  let currentSelectedDate = '2026-10-02';

  // Weight history modal state
  let currentWeightInterval = 'ALL';

  // Insight calendar modal state
  let currentInsightItem = '';
  let currentInsightType = 'regeneration';
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
      
      const isToday = currentSelectedDate === '2026-10-02';
      dateDisplay.innerHTML = `<span>📅 ${dayName}, ${dayNum}. ${monthName} ${year}</span> ${isToday ? '<span class="text-cyan-400 font-bold ml-1">(Heute)</span>' : ''}`;
    }

    // Real Whoop & Sheet Metrics
    const recovery = currentLog.whoop_recovery_pct != null ? currentLog.whoop_recovery_pct : 74;
    const sleepPerf = currentLog.sleep_performance_pct != null ? currentLog.sleep_performance_pct : 91;
    const strain = currentLog.whoop_strain != null ? currentLog.whoop_strain : (currentLog.duration_min > 0 ? (currentLog.duration_min > 60 ? 14.8 : 9.5) : 0.0);
    const pain = currentLog.schmerzen || currentLog.pain_score || '1 - Keine';
    const exhaust = currentLog.erschöpfung || currentLog.fatigue_score || '3 - Normal';
    const form = currentLog.tagesform || currentLog.daily_form || 'Motiviert, Frisch';
    const sleepHabits = currentLog.schlaf_notiz || currentLog.sleep_habits || 'Regulär';
    const targetStrain = currentLog.target_strain || (recovery >= 67 ? '14.0 - 16.5' : (recovery >= 34 ? '10.0 - 13.5' : '0.0 - 9.0'));

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

    const elPain = document.getElementById('whoopPainVal');
    if (elPain) elPain.textContent = pain;

    const elExhaust = document.getElementById('whoopExhaustVal');
    if (elExhaust) elExhaust.textContent = exhaust;

    // 2. Sleep Ring & Val
    const elSleepPerf = document.getElementById('whoopSleepPerfVal');
    const sleepRing = document.getElementById('sleepRingSvg');
    const elSleep = document.getElementById('whoopSleepVal');
    
    if (elSleepPerf) elSleepPerf.textContent = sleepPerf + '%';
    if (sleepRing) sleepRing.setAttribute('stroke-dasharray', `${sleepPerf}, 100`);
    if (elSleep) {
      elSleep.textContent = `${sleepPerf}% Performance`;
    }
    const elSleepHabits = document.getElementById('whoopSleepHabitsVal');
    if (elSleepHabits) {
      elSleepHabits.textContent = sleepHabits.length > 25 ? sleepHabits.substring(0, 23) + '...' : sleepHabits;
      elSleepHabits.title = sleepHabits;
    }

    // 3. Strain Ring & Val
    const elStrain = document.getElementById('whoopStrainVal');
    const strainRing = document.getElementById('strainRingSvg');
    const strainCat = document.getElementById('whoopStrainCategory');
    const strainTarget = document.getElementById('whoopTargetStrainVal');
    const elForm = document.getElementById('whoopFormVal');

    if (elStrain) elStrain.textContent = typeof strain === 'number' ? strain.toFixed(1) : strain;
    if (strainRing) {
      const strainPct = Math.min(100, Math.round(((parseFloat(strain) || 0) / 21) * 100));
      strainRing.setAttribute('stroke-dasharray', `${strainPct}, 100`);
    }
    if (strainTarget) strainTarget.textContent = targetStrain;
    if (elForm) elForm.textContent = form;

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
        coachBanner.innerHTML = `<span>🚀</span><span><strong>Readiness-Empfehlung:</strong> Volle ZNS-Freigabe für maximale Anlaufgeschwindigkeit (>10.3 m/s) und hohe Reaktivität (RSI > 2.8). Maximallast im Krafttraining freigegeben.</span>`;
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

          <!-- Problems & Learnings (Regeneration separated into tile below) -->
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

  function renderDailyJournal(state) {
    const logs = state.trainingLogs || [];
    const dayLogs = logs.filter(l => l.date === currentSelectedDate);
    const currentLog = dayLogs.find(l => l.body_weight_kg != null || l.athlete_comments) || dayLogs[0] || logs.slice(-1)[0] || {};

    // 1. Clickable Bodyweight
    const elWeight = document.getElementById('journalWeightVal');
    const elWeightSub = document.getElementById('journalWeightSub');
    if (elWeight) {
      const w = currentLog.body_weight_kg ? currentLog.body_weight_kg.toFixed(1) + ' kg' : '82.4 kg';
      const fat = currentLog.body_fat_pct ? ` (${currentLog.body_fat_pct}% KFA)` : '';
      elWeight.textContent = w + fat;
    }
    if (elWeightSub) {
      elWeightSub.innerHTML = `<span>Klicke für 1W-Max Verlauf</span><span class="text-cyan-400 font-bold">📈 Öffnen ↗</span>`;
    }

    // 2. Nutrition
    const elNutr = document.getElementById('journalNutritionVal');
    const elMacros = document.getElementById('journalNutritionMacros');
    if (elNutr) {
      const cal = currentLog.calories_kcal ? `${currentLog.calories_kcal.toLocaleString('de-DE')} kcal` : '3.450 kcal';
      const hydr = currentLog.hydration_l ? ` • ${currentLog.hydration_l}L` : ' • 4.0L';
      elNutr.textContent = `${cal}${hydr}`;
    }
    if (elMacros) {
      const p = currentLog.protein_g ? `${currentLog.protein_g}g P` : '185g P';
      const f = currentLog.fat_g ? `${currentLog.fat_g}g F` : '72g F';
      const c = currentLog.carbs_g ? `${currentLog.carbs_g}g C` : '460g C';
      const desc = currentLog.nutrition || 'Diszipliniert';
      elMacros.textContent = `${p} • ${f} • ${c} • ${desc}`;
    }

    // 3. Soreness & Energy
    const elSoreness = document.getElementById('journalSorenessVal');
    if (elSoreness) {
      const pain = currentLog.schmerzen || currentLog.pain_score || '1 - Keine';
      const exhaust = currentLog.erschöpfung || currentLog.fatigue_score || '3 - Normal';
      elSoreness.textContent = `Schmerzen: ${pain} • Erschöpfung: ${exhaust}`;
    }

    // 4. Notes & Comments
    const elNotes = document.getElementById('journalNotesVal');
    if (elNotes) {
      const habits = currentLog.schlaf_notiz ? `💤 ${currentLog.schlaf_notiz}\n` : '';
      const notes = currentLog.athlete_comments || currentLog.learnings || 'Planmäßige Trainingseinheit.';
      elNotes.textContent = habits ? `${habits}"${notes}"` : `"${notes}"`;
    }

    // 5. Interactive Supplements Chips (Clickable -> open calendar modal)
    const suppContainer = document.getElementById('journalSupplementsContainer');
    if (suppContainer) {
      const suppStr = currentLog.supplements || 'Kreatin, Vitamin D3, Omega 3, Magnesium, Vitamin B12';
      const suppItems = suppStr.split(/[,;+•]/).map(s => s.trim()).filter(Boolean);
      if (suppItems.length > 0) {
        suppContainer.innerHTML = suppItems.map(item => `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'supplement')" class="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <span>💊</span>
            <span>${item}</span>
            <span class="text-[9px] text-cyan-500 ml-0.5">📅</span>
          </button>
        `).join('');
      } else {
        suppContainer.innerHTML = '<span class="text-xs text-slate-500 font-mono italic">Keine Supplements erfasst</span>';
      }
    }

    // 6. Interactive Regeneration Chips (Clickable -> open calendar modal)
    const regenContainer = document.getElementById('journalRegenerationContainer');
    if (regenContainer) {
      const regenStr = currentLog.regeneration || 'Lymphomat, Kältebecken, Sauna, Physiotherapie';
      const regenItems = regenStr.split(/[,;+•]/).map(r => r.trim()).filter(Boolean);
      if (regenItems.length > 0) {
        regenContainer.innerHTML = regenItems.map(item => `
          <button onclick="AnalyticsModule.openInsightModal('${item.replace(/'/g, "\\'")}', 'regeneration')" class="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <span>🧊</span>
            <span>${item}</span>
            <span class="text-[9px] text-emerald-500 ml-0.5">📅</span>
          </button>
        `).join('');
      } else {
        regenContainer.innerHTML = '<span class="text-xs text-slate-500 font-mono italic">Keine Maßnahmen erfasst</span>';
      }
    }
  }

  // ================= INTERACTIVE BODY WEIGHT MODAL =================
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

    // Filter by interval relative to current date (2026-10-02)
    const refDate = new Date('2026-10-02');
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
          y: { grid: { color: '#1e293b' }, ticks: { color: '#22d3ee' }, suggestedMin: 80, suggestedMax: 85 }
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

  // ================= SUPPLEMENTS & REGENERATION CALENDAR INSIGHT MODAL =================
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
    if (sub) sub.textContent = `Historische Dokumentation & Einfluss auf Erholung über 7 Jahre`;

    // Populate Year Select
    const yearSelect = document.getElementById('insightYearSelect');
    if (yearSelect) {
      const years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
      yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === currentInsightYear ? 'selected' : ''}>Jahr ${y}</option>`).join('');
    }

    updateInsightModalStats();
    renderInsightCalendar();
    modal.classList.remove('hidden');
  }

  function onInsightYearChanged(year) {
    currentInsightYear = year;
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

    const recentLogs = matchLogs.filter(l => (l.date || '') >= '2026-09-01');
    const matchRecoveries = matchLogs.map(l => l.whoop_recovery_pct).filter(v => v != null);
    const avgRec = matchRecoveries.length > 0
      ? Math.round(matchRecoveries.reduce((a, b) => a + b, 0) / matchRecoveries.length)
      : 76;

    const kpiTotal = document.getElementById('insightKpiTotal');
    const kpiRecent = document.getElementById('insightKpiRecent');
    const kpiRec = document.getElementById('insightKpiRecovery');

    if (kpiTotal) kpiTotal.textContent = `${matchLogs.length}x`;
    if (kpiRecent) kpiRecent.textContent = `${recentLogs.length}x`;
    if (kpiRec) kpiRec.textContent = `${avgRec}%`;
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
        <div class="py-8 text-center text-slate-500 font-mono text-xs italic">
          Keine protokollierten Einträge für "${currentInsightItem}" im Jahr ${currentInsightYear} gefunden.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="divide-y divide-slate-800/60 font-mono text-xs">
        ${yearMatches.map(m => `
          <div class="py-2 px-2 flex items-center justify-between hover:bg-slate-900/40 rounded transition-colors">
            <div class="flex items-center gap-2.5">
              <span class="text-cyan-400 font-bold">${m.date}</span>
              <span class="text-[10px] text-slate-400">KW ${m.kw || '-'} • ${m.weekday || ''}</span>
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
      let y = parseFloat(l[varA]);
      let x = parseFloat(l[varB]);

      // Special handling for target 'weitsprung_wk'
      if (varA === 'weitsprung_wk') {
        y = parseFloat(l.best_mark_m || l.weitsprung_wk);
      }

      // Special handling for frequency indicators
      if (varB === 'regeneration_freq') {
        x = l.regeneration ? 1 : 0;
      } else if (varB === 'supplements_freq') {
        x = l.supplements ? 1 : 0;
      }

      if (!isNaN(x) && !isNaN(y) && x !== null && y !== null) {
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
      'duration_min': 'Dauer (min)',
      'regeneration_freq': 'Regenerations-Maßnahmen (Frequenz)',
      'supplements_freq': 'Supplements (Frequenz)'
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
    const refDate = new Date('2026-10-02');
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

    // Update Leistungsdiagnostik Zubringer KPIs
    const peakRsi = logs.reduce((max, l) => Math.max(max, l.rsi_score || 0), 0);
    const peakCmjArm = logs.reduce((max, l) => Math.max(max, l.cmj_mit_armen || 0), 0);
    const peakCmjOhne = logs.reduce((max, l) => Math.max(max, l.cmj_ohne_arme || 0), 0);
    const peakSpeed = logs.reduce((max, l) => Math.max(max, l.approach_speed_11m_to_1m || 0), 0);
    const peakSprint = logs.reduce((max, l) => Math.max(max, l.sprint_speed || 0), 0);

    const elRsi = document.getElementById('diagKpiRsi');
    const elCmjArm = document.getElementById('diagKpiCmjArm');
    const elCmjOhne = document.getElementById('diagKpiCmjOhne');
    const elSpeed = document.getElementById('diagKpiAnlaufSpeed');
    const elSprint = document.getElementById('diagKpiSprintSpeed');

    if (elRsi) elRsi.textContent = peakRsi > 0 ? `${peakRsi.toFixed(2)} W/kg` : '2.85 W/kg';
    if (elCmjArm) elCmjArm.textContent = peakCmjArm > 0 ? `${peakCmjArm.toFixed(1)} cm` : '82.0 cm';
    if (elCmjOhne) elCmjOhne.textContent = peakCmjOhne > 0 ? `${peakCmjOhne.toFixed(1)} cm` : '74.5 cm';
    if (elSpeed) elSpeed.textContent = peakSpeed > 0 ? `${peakSpeed.toFixed(2)} m/s` : '10.85 m/s';
    if (elSprint) elSprint.textContent = peakSprint > 0 ? `${peakSprint.toFixed(2)} m/s` : '10.42 m/s';
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
    currentSelectedDate = '2026-10-02';
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
    if (!url) {
      openSheetsModal();
      return;
    }

    try {
      const resp = await fetch(url);
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
        rsi_score: parseNum(row.dj50_reaktivität_w_kg_ || row.rsi_score || row.dj50_reaktivität),
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
        carbs_g: parseNum(row.carbs)
      });
    }

    logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return logs;
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
    parseCsvTrainingLogs,
    openWeightModal,
    setWeightInterval,
    openInsightModal,
    onInsightYearChanged,
    onCorrelationParamChanged,
    updateCorrelationScatter,
    setStrengthInterval,
    toggleStrengthExercise,
    renderStrengthDiagnosticsChart
  };
})();

window.AnalyticsModule = AnalyticsModule;
