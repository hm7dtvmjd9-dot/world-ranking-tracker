/**
 * Tab 2: 7-Year Training Analytics & 64-Variable Correlation Engine
 */
const AnalyticsModule = (() => {
  let jumpChartInstance = null;
  let readinessChartInstance = null;
  let strengthChartInstance = null;

  function render(state) {
    renderStatsSummary(state);
    renderInsightsAndCorrelations(state);
    renderCharts(state);
  }

  function renderStatsSummary(state) {
    const logs = state.trainingLogs || [];
    const jumps = logs.filter(l => l.best_mark_m || l.eff_mark_m);
    const jumpsOver8m = logs.filter(l => l.best_mark_m >= 8.00 || l.eff_mark_m >= 8.00);

    const elTotal = document.getElementById('statTotalSessions');
    if (elTotal) elTotal.textContent = logs.length;

    const elJumps = document.getElementById('statTotalJumps');
    if (elJumps) elJumps.textContent = jumps.length;

    const elOver8m = document.getElementById('statJumpsOver8m');
    if (elOver8m) elOver8m.textContent = jumpsOver8m.length;

    const peakSpeed = Math.max(...logs.map(l => l.approach_speed_11m_to_1m || 0), 0);
    const elSpeed = document.getElementById('statPeakSpeed');
    if (elSpeed) elSpeed.textContent = peakSpeed > 0 ? peakSpeed.toFixed(2) + ' m/s' : '-';

    const peakTrapbar = Math.max(...logs.map(l => l.trapbar_e1rm_kg || 0), 0);
    const elTrapbar = document.getElementById('statPeakTrapbar');
    if (elTrapbar) elTrapbar.textContent = peakTrapbar > 0 ? peakTrapbar + ' kg' : '-';
  }

  function renderInsightsAndCorrelations(state) {
    const insights = state.trainingInsights;
    const tableBody = document.getElementById('correlationTableBody');
    const driversGrid = document.getElementById('eightMeterDriversGrid');

    if (!insights) return;

    // Render 8.00m+ Key Prerequisites
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
            <span class="text-[10px] font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-cyan-400'} bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-center">
              ${d.insight}
            </span>
          </div>
        `;
      }).join('');
    }

    // Render Correlation Matrix Table
    if (tableBody && insights.topCorrelations) {
      tableBody.innerHTML = insights.topCorrelations.map(c => {
        const isPositive = c.correlation > 0;
        const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
        const barWidth = Math.min(100, Math.round(Math.abs(c.correlation) * 100));

        return `
          <tr class="hover:bg-slate-800/40 font-mono text-xs">
            <td class="py-2 px-3 font-semibold text-slate-200">${formatMetricLabel(c.variable)}</td>
            <td class="py-2 px-3 text-right font-black ${colorClass}">
              ${isPositive ? '+' : ''}${c.correlation.toFixed(2)}
            </td>
            <td class="py-2 px-3">
              <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div class="h-1.5 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}" style="width: ${barWidth}%"></div>
              </div>
            </td>
            <td class="py-2 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                c.strength === 'Sehr stark' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'
              }">${c.strength}</span>
            </td>
            <td class="py-2 px-3 text-[10px] text-slate-400 font-sans">${c.direction}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function formatMetricLabel(key) {
    const map = {
      'eff_mark_m': 'Effektive Weite (ab Absprungfuß)',
      'best_mark_m': 'Balkenweite (Offiziell)',
      'approach_speed_11m_to_1m': 'Anlauf-Geschwindigkeit (11m-1m)',
      'whoop_recovery_pct': 'Whoop Recovery Score (%)',
      'whoop_hrv': 'Herzfrequenzvariabilität (HRV)',
      'whoop_rhr': 'Whoop Ruhepuls',
      'sleep_hours': 'Schlafdauer (h)',
      'rsi_score': 'Reactive Strength Index (RSI)',
      'trapbar_e1rm_kg': 'e1RM Trapbar Deadlift',
      'power_clean_e1rm_kg': 'e1RM Umsetzen (Power Clean)',
      'hip_thrust_e1rm_kg': 'e1RM Hip-Thrust',
      'muscle_soreness_1_10': 'Muskelkater / Muskeltonus',
      'body_weight_kg': 'Körpergewicht (kg)',
      'energy_readiness_1_10': 'Subjektive Energie (1-10)'
    };
    return map[key] || key.replace(/_/g, ' ');
  }

  function renderCharts(state) {
    const logs = state.trainingLogs || [];
    if (logs.length === 0) return;

    // Filter recent 40 sessions for smooth display
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
              borderColor: '#f59e0b',
              borderWidth: 2,
              borderDash: [4, 4],
              pointRadius: 4,
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 7.5,
              max: 8.4,
              grid: { color: '#1e293b' },
              ticks: { color: '#94a3b8', callback: v => v.toFixed(2) + 'm' }
            },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }

    // 2. Whoop & Readiness Chart
    const ctxReadiness = document.getElementById('readinessChart');
    if (ctxReadiness) {
      if (readinessChartInstance) readinessChartInstance.destroy();
      const recoveries = recent.map(l => l.whoop_recovery_pct || null);
      const sleeps = recent.map(l => l.sleep_hours || null);

      readinessChartInstance = new Chart(ctxReadiness.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Whoop Recovery (%)',
              data: recoveries,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              borderWidth: 2.5,
              pointRadius: 3,
              yAxisID: 'yRec'
            },
            {
              label: 'Schlafdauer (h)',
              data: sleeps,
              borderColor: '#a855f7',
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: 'ySleep'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            yRec: {
              position: 'left',
              min: 0,
              max: 100,
              grid: { color: '#1e293b' },
              ticks: { color: '#10b981', callback: v => v + '%' }
            },
            ySleep: {
              position: 'right',
              min: 5,
              max: 11,
              grid: { drawOnChartArea: false },
              ticks: { color: '#a855f7', callback: v => v + 'h' }
            },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }

    // 3. Strength e1RM Chart
    const ctxStrength = document.getElementById('strengthChart');
    if (ctxStrength) {
      if (strengthChartInstance) strengthChartInstance.destroy();
      const trapbars = recent.map(l => l.trapbar_e1rm_kg || null);
      const cleans = recent.map(l => l.power_clean_e1rm_kg || null);
      const hipthrusts = recent.map(l => l.hip_thrust_e1rm_kg || null);

      strengthChartInstance = new Chart(ctxStrength.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Trapbar e1RM (kg)', data: trapbars, backgroundColor: '#f59e0b', borderRadius: 3 },
            { label: 'Umsetzen e1RM (kg)', data: cleans, backgroundColor: '#06b6d4', borderRadius: 3 },
            { label: 'Hip-Thrust e1RM (kg)', data: hipthrusts, backgroundColor: '#8b5cf6', borderRadius: 3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 100,
              max: 300,
              grid: { color: '#1e293b' },
              ticks: { color: '#cbd5e1', callback: v => v + 'kg' }
            },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
      });
    }
  }

  function parseCsvTrainingLogs(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 2) continue;

      const obj = {};
      headers.forEach((h, colIdx) => {
        let val = parts[colIdx] !== undefined ? parts[colIdx].trim().replace(/^["']|["']$/g, '') : null;
        if (val !== null && val !== '') {
          const num = Number(val);
          obj[h] = !isNaN(num) ? num : val;
        } else {
          obj[h] = null;
        }
      });
      rows.push(obj);
    }
    return rows;
  }

  return { render, parseCsvTrainingLogs };
})();
