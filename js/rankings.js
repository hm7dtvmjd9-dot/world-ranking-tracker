/**
 * Tab 2: World Athletics Rankings, Historical Time-Travel & Competitor Database
 */
const RankingsModule = (() => {
  let rankChartInstance = null;
  let initializedControls = false;
  let currentSnapshotIdx = null;

  function render(state) {
    initTimeTravelControls(state);
    renderKpiTiles(state);
    renderTable(state);
    renderCompactHistoryChart(state);
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
      slider.value = archive.snapshots.length - 1;
      currentSnapshotIdx = archive.snapshots.length - 1;
      sel.value = currentSnapshotIdx;

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
      const meetings = ath.counted_competitions || [];
      let sb = 0;
      meetings.forEach(m => {
        const markVal = parseFloat(m.mark);
        if (!isNaN(markVal) && markVal > sb) sb = markVal;
      });

      return {
        id: ath.profile_url || `ath-${idx}-${i}`,
        originalRank: parseInt(ath.rank) || i + 1,
        name: ath.name || '',
        nation: ath.country || '',
        dob: ath.dob || '',
        sb: sb > 0 ? sb : null,
        totalScore: parseInt(ath.ranking_score) || 0,
        profile_url: ath.profile_url || '',
        countingMeetings: meetings,
        rankDelta: ath.rank_delta !== undefined ? ath.rank_delta : null,
        scoreDelta: ath.score_delta !== undefined ? ath.score_delta : null
      };
    });

    // Update milestone badge
    const badge = document.getElementById('rankingMilestoneBadge');
    if (badge) {
      badge.textContent = snap.milestoneNote ? `${snap.displayDate}: ${snap.milestoneNote}` : `Stand: ${snap.displayDate}`;
    }

    renderKpiTiles(state);
    renderTable(state);
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
                  <span>📊 Gewertete Meetings für ${ath.name}</span>
                </h4>
                <button onclick="event.stopPropagation(); RankingsModule.openCompetitorModal('${ath.name}')" class="text-cyan-400 hover:text-cyan-300 font-mono text-[10px] font-bold underline">
                  Im direkten Vergleich mit Luka öffnen ↗
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr class="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th class="py-1.5 px-2">Datum</th>
                      <th class="py-1.5 px-2">Wettkampf</th>
                      <th class="py-1.5 px-2 text-center">Kat.</th>
                      <th class="py-1.5 px-2 text-right">Weite</th>
                      <th class="py-1.5 px-2 text-right">Wind</th>
                      <th class="py-1.5 px-2 text-center">Pl.</th>
                      <th class="py-1.5 px-2 text-right">Result</th>
                      <th class="py-1.5 px-2 text-right">Platz</th>
                      <th class="py-1.5 px-2 text-right font-bold text-white">Gesamt</th>
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
      historyData = snapshots.map(s => {
        const parts = (s.date || '').split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0].slice(2)}` : s.date;
        return {
          date: shortDate,
          fullDate: s.displayDate || s.date,
          rank: s.lukaRank || 100,
          score: s.lukaScore || 1100
        };
      });
    } else {
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

    const minRank = Math.max(1, Math.min(...ranks) - 5);
    const maxRank = Math.min(105, Math.max(...ranks) + 5);

    const minScore = Math.min(...scores) - 20;
    const maxScore = Math.max(...scores) + 20;

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
                  return `Ranking Score: ${ctx.parsed.y} Pkt`;
                }
              }
            }
          }
        }
      }
    });
  }

  function openCompetitorModal(athleteName) {
    const modal = document.getElementById('competitorModal');
    if (!modal) return;

    // Find in athletes database or state.athletes
    let target = null;
    const db = (window.App && window.App.state && window.App.state.athletesDatabase) || null;
    if (db && db.athletes) {
      target = db.athletes.find(a => a.name.toLowerCase() === athleteName.toLowerCase());
    }

    if (!target) {
      const stateAthletes = (window.App && window.App.state && window.App.state.athletes) || [];
      target = stateAthletes.find(a => a.name.toLowerCase().includes(athleteName.toLowerCase()));
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
    const comps = target.counted_competitions || target.countingMeetings || [];
    
    if (compTitle) {
      compTitle.textContent = `🏆 ERFASSTE WETTKÄMPFE (${comps.length} Wettkämpfe in der WA-Datenbank)`;
    }

    if (compBody) {
      if (comps.length > 0) {
        compBody.innerHTML = comps.map(c => `
          <tr class="hover:bg-slate-800/40">
            <td class="py-2 px-2.5 text-slate-400 whitespace-nowrap">${c.date || '-'}</td>
            <td class="py-2 px-2.5 text-slate-200 font-sans font-medium text-xs">${c.competition || '-'}</td>
            <td class="py-2 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">${c.category || '-'}</span></td>
            <td class="py-2 px-2 text-right font-bold text-cyan-400 text-xs">${c.mark}m ${c.wind ? '(' + c.wind + ')' : ''}</td>
            <td class="py-2 px-2 text-center text-slate-300">${c.place || '-'}</td>
            <td class="py-2 px-2 text-right font-black text-amber-400">${c.performance_score || c.result_score || '-'} Pkt</td>
          </tr>
        `).join('');
      } else {
        compBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500 italic">Keine Meeting-Ergebnisse hinterlegt.</td></tr>';
      }
    }

    const waLink = document.getElementById('modalWaProfileLink');
    if (waLink) {
      waLink.href = target.profile_url || `https://worldathletics.org/athletes/search?q=${encodeURIComponent(target.name)}`;
    }

    modal.classList.remove('hidden');
  }

  return { render, openCompetitorModal };
})();
