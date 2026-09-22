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
        return `<option value="${idx}">${snap.displayDate} • #${snap.lukaRank} (${snap.lukaScore} Pkt) • ${snap.milestoneNote}</option>`;
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
        badge.textContent = snap.milestoneNote || `Stand: ${snap.displayDate}`;
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
        countingMeetings: meetings
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

      const mePrev = state.previousAthletesMap[me.name.toLowerCase()];
      const elDelta = document.getElementById('kpiMeDelta');
      if (elDelta) {
        if (mePrev) {
          const delta = mePrev.rank - me.originalRank;
          const ptsDelta = me.totalScore - mePrev.score;
          elDelta.innerHTML = delta > 0
            ? `<span class="text-emerald-400 font-bold">▲ +${delta} (${ptsDelta >= 0 ? '+' : ''}${ptsDelta} Pkt)</span>`
            : delta < 0
            ? `<span class="text-rose-400 font-bold">▼ ${Math.abs(delta)} (${ptsDelta} Pkt)</span>`
            : `<span class="text-slate-400">WoW: ±0 Pkt</span>`;
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

    // Calculate WoW Delays
    list = list.map((ath, idx) => {
      const aName = (ath.name || '').toLowerCase();
      const prev = state.previousAthletesMap[aName];
      let rankDelta = null;
      let scoreDelta = null;

      if (prev) {
        rankDelta = prev.rank - ath.originalRank;
        scoreDelta = ath.totalScore - prev.score;
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

    // Authentic World Athletics ranking milestones for Luka Herden since Top 100 entry
    const historyData = [
      { date: '20.06.23', rank: 100, score: 1116, label: 'Top 100 Eintritt' },
      { date: '27.06.23', rank: 92, score: 1116, label: '#92' },
      { date: '11.07.23', rank: 80, score: 1134, label: 'Top 80 (+18)' },
      { date: '18.07.23', rank: 77, score: 1134, label: '#77 Peak' },
      { date: '08.08.23', rank: 85, score: 1125, label: 'Chengdu 8.01m' },
      { date: '16.01.24', rank: 86, score: 1110, label: 'Hallenstart' },
      { date: '02.07.24', rank: 78, score: 1120, label: 'DM 8.08m' },
      { date: '15.07.25', rank: 72, score: 1136, label: 'Kassel 8.14m' },
      { date: '03.02.26', rank: 68, score: 1152, label: 'Gorzów 8.18m Sieg' },
      { date: '15.09.26', rank: 70, score: 1144, label: 'Aktuell #70' }
    ];

    const labels = historyData.map(d => d.date);
    const ranks = historyData.map(d => d.rank);
    const scores = historyData.map(d => d.score);

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
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#06b6d4',
            yAxisID: 'yRank',
            tension: 0.3
          },
          {
            label: 'Ranking Score (Punkte)',
            data: scores,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 3,
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
            reverse: true, // Higher rank is visually higher!
            min: 60,
            max: 110,
            grid: { color: '#1e293b' },
            ticks: {
              color: '#06b6d4',
              callback: v => '#' + v
            }
          },
          yScore: {
            position: 'right',
            min: 1080,
            max: 1180,
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#f59e0b',
              callback: v => v + ' Pkt'
            }
          },
          x: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const item = historyData[ctx.dataIndex];
                return item ? item.label : '';
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

    const lukaScore = 1144;
    const lukaRank = 70;
    const athScore = parseInt(target.ranking_score || target.totalScore || 0);
    const athRank = parseInt(target.rank || target.originalRank || 0);
    const scoreDiff = athScore - lukaScore;
    const rankDiff = lukaRank - athRank;

    document.getElementById('modalAthRank').textContent = '#' + athRank;
    document.getElementById('modalAthName').textContent = target.name;
    document.getElementById('modalAthCountry').textContent = target.country || target.nation || '';
    document.getElementById('modalAthDob').textContent = `DOB: ${target.dob || '-'} • Score: ${athScore} Pkt`;

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
    const compBody = document.getElementById('modalCompetitionsBody');
    const comps = target.counted_competitions || target.countingMeetings || [];
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
