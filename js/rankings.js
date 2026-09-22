/**
 * Tab 1: World Rankings & Historical Backlog Module
 */
const RankingsModule = (() => {
  let rankChartInstance = null;

  function render(state) {
    renderKpiTiles(state);
    renderTable(state);
    renderHistoryTimeline(state);
  }

  function renderKpiTiles(state) {
    const me = state.athletes.find(a => a.name.toLowerCase().includes('herden')) || state.athletes.find(a => a.nation === 'GER');
    const cutoffIdx = Math.min(state.cutoffSpots - 1, state.athletes.length - 1);
    const cutoffAth = state.athletes[cutoffIdx];

    // Athlete Focus (Luka Herden)
    if (me) {
      document.getElementById('kpiMeRank').textContent = '#' + me.originalRank;
      document.getElementById('kpiMeScore').textContent = me.totalScore + ' Pkt';

      const mePrev = state.previousAthletesMap[me.name.toLowerCase()];
      if (mePrev) {
        const delta = mePrev.rank - me.originalRank;
        const ptsDelta = me.totalScore - mePrev.score;
        document.getElementById('kpiMeDelta').innerHTML = delta > 0
          ? `<span class="text-emerald-400 font-bold">▲ +${delta} (${ptsDelta >= 0 ? '+' : ''}${ptsDelta} Pkt)</span>`
          : delta < 0
          ? `<span class="text-rose-400 font-bold">▼ ${Math.abs(delta)} (${ptsDelta} Pkt)</span>`
          : `<span class="text-slate-400">WoW: ±0 Pkt</span>`;
      } else {
        document.getElementById('kpiMeDelta').innerHTML = `<span class="text-cyan-400">SB: ${me.sb ? me.sb.toFixed(2) : '-'}m</span>`;
      }

      if (cutoffAth) {
        const gap = me.totalScore - cutoffAth.totalScore;
        const gapElem = document.getElementById('kpiMeGap');
        gapElem.textContent = (gap >= 0 ? '+' : '') + gap + ' Pkt';
        gapElem.className = gap >= 0 ? 'text-lg font-black font-mono text-emerald-400' : 'text-lg font-black font-mono text-rose-400';
        document.getElementById('kpiMeGapSub').textContent = gap >= 0 ? `Sicher vor Cutoff #${state.cutoffSpots}` : `Rückstand auf #${state.cutoffSpots}`;
      }
    }

    // Cutoff Spot Info
    if (cutoffAth) {
      document.getElementById('kpiCutoffScore').textContent = cutoffAth.totalScore + ' Pkt';
      document.getElementById('kpiCutoffAthName').textContent = `#${state.cutoffSpots}: ${cutoffAth.name} (${cutoffAth.nation})`;
    }

    // German DLV Squad
    const germans = state.athletes.filter(a => a.nation === 'GER');
    document.getElementById('kpiGerCountBadge').textContent = `${germans.length} DLV KADER`;
    const gerListElem = document.getElementById('kpiGerList');
    if (germans.length > 0) {
      gerListElem.innerHTML = germans.map(g => {
        const isLuka = g.name.toLowerCase().includes('herden');
        return `
          <div class="flex items-center justify-between py-1 border-b border-slate-800/40 ${isLuka ? 'text-cyan-400 font-bold' : 'text-slate-300'}">
            <span class="truncate">#${g.originalRank} ${g.name}</span>
            <span class="text-amber-400 font-mono ml-2 text-xs">${g.totalScore} Pkt</span>
          </div>
        `;
      }).join('');
    } else {
      gerListElem.innerHTML = '<span class="text-slate-500 italic">Keine DLV Athleten in der Liste</span>';
    }
  }

  function renderTable(state) {
    const tbody = document.getElementById('rankingTableBody');
    tbody.innerHTML = '';

    let list = [...state.athletes];

    // Calculate WoW Delays
    list = list.map((ath, idx) => {
      const aName = (ath.name || '').toLowerCase();
      const prev = state.previousAthletesMap[aName];
      let rankDelta = null;
      let scoreDelta = null;

      if (prev) {
        rankDelta = prev.rank - (idx + 1);
        scoreDelta = ath.totalScore - prev.score;
      }
      return { ...ath, calculatedRank: idx + 1, rankDelta, scoreDelta };
    });

    if (state.selectedNation !== 'ALL') {
      list = list.filter(a => a.nation === state.selectedNation);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(a => (a.name && a.name.toLowerCase().includes(q)) || (a.nation && a.nation.toLowerCase().includes(q)));
    }

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-500 text-xs">Keine Athleten gefunden.</td></tr>';
      return;
    }

    list.forEach(ath => {
      const isMe = ath.name.toLowerCase().includes('herden');
      const isGerman = ath.nation === 'GER';
      const isExpanded = state.expandedRowId === ath.id;

      let wowBadge = '<span class="text-slate-600 font-mono text-[10px]">-</span>';
      if (ath.rankDelta !== null) {
        if (ath.rankDelta > 0) {
          wowBadge = `<span class="text-emerald-400 font-bold font-mono text-[10px]">▲ +${ath.rankDelta}</span>`;
        } else if (ath.rankDelta < 0) {
          wowBadge = `<span class="text-rose-400 font-bold font-mono text-[10px]">▼ ${Math.abs(ath.rankDelta)}</span>`;
        } else {
          wowBadge = '<span class="text-slate-500 font-mono text-[10px]">±0</span>';
        }
      }

      const tr = document.createElement('tr');
      tr.className = `cursor-pointer transition-colors border-b border-slate-800/40 ${
        isExpanded ? 'bg-slate-800/80' : isMe ? 'bg-cyan-950/40 hover:bg-cyan-950/60 border-l-4 border-l-cyan-400' : isGerman ? 'bg-cyan-950/20 hover:bg-cyan-950/30 border-l-2 border-l-cyan-600' : 'hover:bg-slate-900/60'
      }`;

      tr.onclick = () => {
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
            ath.countingMeetings.length >= 5 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }">
            ${ath.countingMeetings.length}/5 Meets
          </span>
        </td>
        <td class="py-2.5 px-3 text-center text-slate-500 font-bold text-xs">
          ${isExpanded ? '▲' : '▼'}
        </td>
      `;
      tbody.appendChild(tr);

      // Expanded Meetings Row
      if (isExpanded) {
        const accTr = document.createElement('tr');
        accTr.className = 'bg-slate-950/90 border-b border-slate-800';

        let meetsHtml = '';
        if (ath.countingMeetings && ath.countingMeetings.length > 0) {
          meetsHtml = ath.countingMeetings.map(m => `
            <tr class="hover:bg-slate-900/50">
              <td class="py-1.5 px-2 text-slate-400 whitespace-nowrap">${m.date || '-'}</td>
              <td class="py-1.5 px-2 text-slate-200 font-sans font-medium text-xs">${m.competition || '-'}</td>
              <td class="py-1.5 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 border border-slate-700 text-cyan-300">${m.category || '-'}</span></td>
              <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${m.mark}m</td>
              <td class="py-1.5 px-2 text-right text-slate-400">${m.wind !== null && m.wind !== undefined ? m.wind + ' m/s' : '-'}</td>
              <td class="py-1.5 px-2 text-center text-slate-300">${m.place || '-'}</td>
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
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊 5 Gewertete Meetings für ${ath.name}</span>
                </h4>
                <span class="text-[10px] text-slate-400 font-mono">World Athletics Score Engine</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr class="bg-slate-950 text-slate-500 border-b border-slate-800 uppercase font-bold text-[9px]">
                      <th class="py-1.5 px-2">Datum</th>
                      <th class="py-1.5 px-2">Meeting</th>
                      <th class="py-1.5 px-2 text-center">Kat</th>
                      <th class="py-1.5 px-2 text-right">Weite</th>
                      <th class="py-1.5 px-2 text-right">Wind</th>
                      <th class="py-1.5 px-2 text-center">Platz</th>
                      <th class="py-1.5 px-2 text-right">Result Pkt</th>
                      <th class="py-1.5 px-2 text-right">Placing Pkt</th>
                      <th class="py-1.5 px-2 text-right font-bold text-amber-400">Score</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/40">
                    ${meetsHtml}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(accTr);
      }
    });
  }

  function renderHistoryTimeline(state) {
    if (!state.lukaHistory) return;
    const { athlete, seasons, rankProgressionWeekly } = state.lukaHistory;

    // Render summary badge
    const entryElem = document.getElementById('historyEntryDate');
    if (entryElem) {
      entryElem.textContent = `${athlete.top100EntryDate} (Rank #${athlete.top100EntryRank})`;
    }

    // Render Season cards
    const seasonsContainer = document.getElementById('seasonCardsContainer');
    if (seasonsContainer) {
      seasonsContainer.innerHTML = seasons.map(s => `
        <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <span class="font-black text-white text-sm font-mono">${s.year}</span>
            <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold text-[10px]">Peak #${s.peakRank}</span>
          </div>
          <div class="py-2.5 space-y-1 text-[11px] font-mono">
            <div class="flex justify-between"><span class="text-slate-400">Season Best (SB):</span> <strong class="text-cyan-400">${s.sb.toFixed(2)}m</strong></div>
            <div class="flex justify-between"><span class="text-slate-400">Peak Score:</span> <strong class="text-amber-400">${s.peakScore} Pkt</strong></div>
            <div class="flex justify-between"><span class="text-slate-400">Wettkämpfe:</span> <span class="text-slate-200">${s.competitionsCount}</span></div>
          </div>
          <div class="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 font-sans leading-relaxed">
            ${s.highlights}
          </div>
        </div>
      `).join('');
    }

    // Render Historical Progression Chart
    const ctx = document.getElementById('historyChart');
    if (!ctx) return;

    if (rankChartInstance) rankChartInstance.destroy();

    const labels = rankProgressionWeekly.map(r => r.date);
    const ranks = rankProgressionWeekly.map(r => r.rank);
    const scores = rankProgressionWeekly.map(r => r.score);

    rankChartInstance = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'World Ranking Position (Invers)',
            data: ranks,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#06b6d4',
            yAxisID: 'yRank',
            tension: 0.3
          },
          {
            label: 'Ranking Score (Punkte)',
            data: scores,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            yAxisID: 'yScore',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          yRank: {
            position: 'left',
            reverse: true, // Rank 1 is top, 140 is bottom
            min: 50,
            max: 140,
            grid: { color: '#1e293b' },
            ticks: {
              color: '#06b6d4',
              callback: val => '#' + val
            }
          },
          yScore: {
            position: 'right',
            min: 1000,
            max: 1200,
            grid: { drawOnChartArea: false },
            ticks: { color: '#f59e0b' }
          },
          x: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'ui-monospace' } } },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const item = rankProgressionWeekly[ctx.dataIndex];
                return item.event ? `⭐ Meilenstein: ${item.event}` : '';
              }
            }
          }
        }
      }
    });
  }

  return { render };
})();
