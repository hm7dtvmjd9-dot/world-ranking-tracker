/**
 * Tab 3: Qualification & Nomination Hub (Hallen-EM Valencia 2027 & WM Beijing 2027)
 */
const QualificationModule = (() => {
  const EUROPEAN_COUNTRIES = new Set([
    'ALB','AND','ARM','AUT','AZE','BEL','BIH','BLR','BUL','CRO','CYP','CZE','DEN','ESP','EST',
    'FIN','FRA','GBR','GEO','GER','GIB','GRE','HUN','IRL','ISL','ISR','ITA','KOS','LAT','LIE',
    'LTU','LUX','MDA','MKD','MLT','MNE','MON','NED','NOR','POL','POR','ROU','SMR','SRB','SUI',
    'SVK','SLO','SWE','TUR','UKR'
  ]);

  function isEuropean(countryCode) {
    return EUROPEAN_COUNTRIES.has((countryCode || '').toUpperCase().trim());
  }

  function parseSafeDate(dStr) {
    if (!dStr) return null;
    const months = { 'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11 };
    const parts = dStr.trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const mIdx = months[parts[1].toUpperCase()];
      const year = parseInt(parts[2]);
      if (!isNaN(day) && mIdx !== undefined && !isNaN(year)) {
        return new Date(year, mIdx, day);
      }
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function render(state) {
    const tbody = document.getElementById('periodTableBody');
    if (!tbody) return;

    if (!state.athletes || state.athletes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-500 text-xs">Keine Daten geladen. Bitte Sync Data ausführen.</td></tr>';
      return;
    }

    const toplistStartDate = new Date(state.periodStartDate);
    const standardStartDate = new Date(state.periodStandardStartDate);

    // 1. Filter by Region (Europe vs Global)
    let pool = state.athletes;
    if (state.periodScope === 'europe') {
      pool = pool.filter(a => isEuropean(a.nation));
    }

    // 2. Process meetings and qualification standard
    // World Athletics Rule: Direct Entry Standard is ONLY valid in Category C or higher!
    const VALID_STANDARD_CATS = new Set(['OW', 'GL', 'GW', 'A', 'B', 'C', 'DF']);

    let processedList = pool.map(ath => {
      const validPeriodMeetings = [];
      let hasDirectStandard = false;
      let bestStandardMark = 0;

      // DLV-Richtwert check (7.90m Hallen-EM / 8.05m WM, counts at any official meeting)
      const dlvThreshold = state.isHallenEmPreset ? 7.90 : 8.05;
      let hasDlvStandard = false;
      let bestDlvMark = 0;

      (ath.countingMeetings || []).forEach(m => {
        const mDate = parseSafeDate(m.date);
        const cat = (m.category || '').toUpperCase().trim();
        const markVal = parseFloat(m.mark) || 0;

        // WA/EA Rule: Automatic Norm (Hallen-EM >= 8.17m) ONLY valid in Kat. C or higher!
        const isEligibleCategory = VALID_STANDARD_CATS.has(cat);
        if (state.isHallenEmPreset && mDate && mDate >= standardStartDate && markVal >= state.periodEntryStandard && isEligibleCategory) {
          hasDirectStandard = true;
          if (markVal > bestStandardMark) bestStandardMark = markVal;
        }

        // DLV-Richtwert (Germany national standard, independent of category)
        if (ath.nation === 'GER' && markVal >= dlvThreshold) {
          hasDlvStandard = true;
          if (markVal > bestDlvMark) bestDlvMark = markVal;
        }

        if (state.periodMode === 'ranking') {
          // World Athletics 2.8: Protected Major events (OW / GL)
          const isProtectedMajor = (cat === 'OW' || cat === 'GL');
          if (mDate && (mDate >= toplistStartDate || isProtectedMajor)) {
            validPeriodMeetings.push({ ...m, parsedDate: mDate, isMajorProtected: mDate < toplistStartDate });
          }
        } else {
          // Toplist: Events from cutoff date
          if (mDate && mDate >= toplistStartDate) {
            validPeriodMeetings.push({ ...m, parsedDate: mDate });
          }
        }
      });

      // Also check athlete SB for DLV standard
      if (ath.nation === 'GER' && ath.sb && ath.sb >= dlvThreshold) {
        hasDlvStandard = true;
        if (ath.sb > bestDlvMark) bestDlvMark = ath.sb;
      }

      const totalCountedMeetings = (ath.countingMeetings || []).length;
      const isCountComplete = totalCountedMeetings >= 5;

      const scores = validPeriodMeetings.map(m => parseInt(m.performance_score) || 0);
      const marks = validPeriodMeetings.map(m => parseFloat(m.mark) || 0);

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const maxMark = marks.length > 0 ? Math.max(...marks) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      const displayMark = Math.max(maxMark, bestStandardMark);

      return {
        ...ath,
        periodMeetings: validPeriodMeetings,
        periodAvgScore: avgScore,
        periodMaxMark: displayMark,
        periodMaxScore: maxScore,
        hasDirectStandard,
        hasDlvStandard,
        bestDlvMark,
        totalCountedMeetings,
        isCountComplete
      };
    });

    // 3. Sort
    if (state.periodMode === 'ranking') {
      processedList.sort((a, b) => {
        if (b.periodAvgScore !== a.periodAvgScore) return b.periodAvgScore - a.periodAvgScore;
        return b.periodMaxScore - a.periodMaxScore;
      });
    } else {
      processedList.sort((a, b) => {
        if (a.hasDirectStandard && !b.hasDirectStandard) return -1;
        if (!a.hasDirectStandard && b.hasDirectStandard) return 1;
        if (b.periodMaxMark !== a.periodMaxMark) return b.periodMaxMark - a.periodMaxMark;
        return b.periodAvgScore - a.periodAvgScore;
      });
    }

    // 4. Nation Quotas (Max 2 or 3 per country)
    const nationCounts = {};
    let quotaCounter = 1;

    processedList = processedList.map((ath, idx) => {
      const nat = ath.nation || 'UNK';
      nationCounts[nat] = (nationCounts[nat] || 0) + 1;
      const slot = nationCounts[nat];

      let quotaRank = null;
      let quotaStatus = 'outside';

      if (slot <= state.periodMaxPerNation) {
        quotaRank = quotaCounter++;
        if (ath.hasDirectStandard) {
          quotaStatus = 'standard_qualified';
        } else {
          quotaStatus = quotaRank <= state.periodFieldSize ? 'qualified' : (quotaRank <= state.periodFieldSize + 3 ? 'bubble' : 'outside');
        }
      } else {
        quotaStatus = 'quota_full';
      }

      return { ...ath, periodRank: idx + 1, quotaRank, quotaStatus, nationSlot: slot };
    });

    renderKpiTiles(state, processedList);
    renderTableRows(state, processedList, tbody);
  }

  function renderKpiTiles(state, processedList) {
    const mePeriod = processedList.find(a => a.name.toLowerCase().includes('herden'));
    const cutoffPeriodAth = processedList.find(a => a.quotaRank === state.periodFieldSize);

    document.getElementById('periodCutoffBadge').textContent = `TOP ${state.periodFieldSize} (MAX ${state.periodMaxPerNation}/NAT)`;

    if (mePeriod) {
      document.getElementById('kpiPeriodMeRank').textContent = mePeriod.quotaRank ? `#${mePeriod.quotaRank}` : `Slot #${mePeriod.nationSlot}`;
      document.getElementById('kpiPeriodMeScore').textContent = state.periodMode === 'ranking'
        ? (mePeriod.periodAvgScore > 0 ? mePeriod.periodAvgScore + ' Pkt' : '-')
        : (mePeriod.periodMaxMark > 0 ? mePeriod.periodMaxMark.toFixed(2) + 'm' : '-');
      document.getElementById('kpiPeriodMeCount').textContent = mePeriod.hasDirectStandard ? 'NORM ERFÜLLT' : `${mePeriod.periodMeetings.length} Meets`;

      if (cutoffPeriodAth) {
        if (state.periodMode === 'ranking') {
          const gap = mePeriod.periodAvgScore - cutoffPeriodAth.periodAvgScore;
          const gapElem = document.getElementById('kpiPeriodMeGap');
          gapElem.textContent = (gap >= 0 ? '+' : '') + gap + ' Pkt';
          gapElem.className = gap >= 0 ? 'text-lg font-black font-mono text-emerald-400' : 'text-lg font-black font-mono text-rose-400';
          document.getElementById('kpiPeriodMeGapSub').textContent = gap >= 0 ? `Vorsprung auf Platz #${state.periodFieldSize}` : `Rückstand auf Platz #${state.periodFieldSize}`;
        } else {
          const gapM = mePeriod.periodMaxMark - cutoffPeriodAth.periodMaxMark;
          const gapElem = document.getElementById('kpiPeriodMeGap');
          gapElem.textContent = (gapM >= 0 ? '+' : '') + gapM.toFixed(2) + 'm';
          gapElem.className = gapM >= 0 ? 'text-lg font-black font-mono text-emerald-400' : 'text-lg font-black font-mono text-rose-400';
          document.getElementById('kpiPeriodMeGapSub').textContent = gapM >= 0 ? `Vorsprung auf Platz #${state.periodFieldSize}` : `Rückstand auf Platz #${state.periodFieldSize}`;
        }
      }
    }

    if (cutoffPeriodAth) {
      document.getElementById('kpiPeriodCutoffScore').textContent = state.periodMode === 'ranking'
        ? `${cutoffPeriodAth.periodAvgScore} PKT`
        : `${cutoffPeriodAth.periodMaxMark.toFixed(2)}m`;
      document.getElementById('kpiPeriodCutoffAthName').textContent = `#${state.periodFieldSize}: ${cutoffPeriodAth.name} (${cutoffPeriodAth.nation})`;
    }

    // DLV Squad
    const germansPeriod = processedList.filter(a => a.nation === 'GER');
    document.getElementById('kpiPeriodGerCount').textContent = `${germansPeriod.length} DLV KADER`;
    const gerListPeriodElem = document.getElementById('kpiPeriodGerList');
    if (germansPeriod.length > 0) {
      gerListPeriodElem.innerHTML = germansPeriod.map((g) => {
        const isLuka = g.name.toLowerCase().includes('herden');
        const valDisplay = state.periodMode === 'ranking' ? `${g.periodAvgScore} Pkt` : `${g.periodMaxMark.toFixed(2)}m`;
        return `
          <div class="flex items-center justify-between py-1 border-b border-slate-800/40 ${isLuka ? 'text-cyan-400 font-bold' : 'text-slate-300'}">
            <span class="truncate text-xs">${g.quotaRank ? `#${g.quotaRank}` : `(Max ${state.periodMaxPerNation})`} ${g.name} ${g.hasDirectStandard ? '(NORM)' : ''}</span>
            <span class="text-amber-400 font-mono ml-2 text-xs">${valDisplay}</span>
          </div>
        `;
      }).join('');
    }
  }

  function renderTableRows(state, processedList, tbody) {
    tbody.innerHTML = '';

    processedList.forEach((ath, idx) => {
      const isCutoff = ath.quotaRank === state.periodFieldSize;
      const isExpanded = state.expandedPeriodRowId === ath.id;
      const isMe = ath.name.toLowerCase().includes('herden');
      const isGerman = ath.nation === 'GER';

      let statusBadge = '';
      if (ath.quotaStatus === 'standard_qualified') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black tracking-wide">NORM (8.17m Kat. C+)</span>';
      } else if (ath.quotaStatus === 'qualified') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">QUALIFIED</span>';
      } else if (ath.quotaStatus === 'bubble') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold">BUBBLE</span>';
      } else if (ath.quotaStatus === 'quota_full') {
        statusBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800 text-[9px]">MAX ${state.periodMaxPerNation} NAT</span>`;
      } else {
        statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-950/30 text-rose-400 border border-rose-900/40 text-[9px]">OUTSIDE</span>';
      }

      const displayValue = state.periodMode === 'ranking'
        ? (ath.periodAvgScore > 0 ? `${ath.periodAvgScore} PKT` : '-')
        : (ath.periodMaxMark > 0 ? `${ath.periodMaxMark.toFixed(2)}m` : '-');

      const tr = document.createElement('tr');
      tr.className = `cursor-pointer transition-colors border-b border-slate-800/40 ${
        isExpanded ? 'bg-slate-800/80' : isMe ? 'bg-cyan-950/40 hover:bg-cyan-950/60 border-l-4 border-l-cyan-400 font-bold' : isGerman ? 'bg-cyan-950/20 hover:bg-cyan-950/30 border-l-2 border-l-cyan-500' : 'hover:bg-slate-900/60'
      }`;

      tr.onclick = () => {
        state.expandedPeriodRowId = state.expandedPeriodRowId === ath.id ? null : ath.id;
        render(state);
      };

      const meetsBadge = ath.hasDirectStandard
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 font-mono">NORM 8.17m (Kat. C+)</span>'
        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono ${ath.isCountComplete ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}">
            ${ath.totalCountedMeetings}/5 ${ath.isCountComplete ? 'Vollständig' : 'Provisorisch'}
          </span>`;

      tr.innerHTML = `
        <td class="py-2 px-3 text-center font-bold text-slate-300">#${idx + 1}</td>
        <td class="py-2 px-3 text-center">
          ${ath.quotaRank ? `<span class="inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] ${ath.quotaRank <= state.periodFieldSize ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">#${ath.quotaRank}</span>` : `<span class="text-[9px] text-slate-500 italic">Slot ${ath.nationSlot}</span>`}
        </td>
        <td class="py-2 px-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="uppercase font-bold text-white tracking-tight text-xs">${ath.name}</span>
            ${isMe ? '<span class="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono">YOU</span>' : ''}
            ${!isMe && isGerman ? '<span class="px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold text-[9px] font-mono">GER</span>' : ''}
            ${ath.hasDlvStandard ? `<span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[9px] font-mono">DLV ${ath.bestDlvMark.toFixed(2)}m</span>` : ''}
          </div>
        </td>
        <td class="py-2 px-3 text-center">
          <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-300 text-[10px]">${ath.nation}</span>
        </td>
        <td class="py-2 px-3 text-center">
          ${meetsBadge}
        </td>
        <td class="py-2 px-3 text-right font-black text-amber-400 font-mono text-sm">${displayValue}</td>
        <td class="py-2 px-3 text-center">${statusBadge}</td>
        <td class="py-2 px-3 text-center text-slate-500 text-xs">${isExpanded ? '▲' : '▼'}</td>
      `;
      tbody.appendChild(tr);

      // Cutoff Divider Line
      if (isCutoff) {
        const cutTr = document.createElement('tr');
        cutTr.className = 'border-t-2 border-b-2 border-amber-500/70 bg-amber-500/10';
        cutTr.innerHTML = `<td colspan="8" class="py-1.5 px-3 text-center font-black text-amber-400 text-[10px] tracking-widest uppercase font-mono">NOMINIERUNGS-CUT-OFF (PLATZ ${state.periodFieldSize} • MAX ${state.periodMaxPerNation}/NAT)</td>`;
        tbody.appendChild(cutTr);
      }

      // Expanded Meetings Breakdown
      if (isExpanded && ath.periodMeetings.length > 0) {
        const accTr = document.createElement('tr');
        accTr.className = 'bg-slate-950/90 border-b border-slate-800';

        const mHtml = ath.periodMeetings.map(m => `
          <tr class="hover:bg-slate-900/50">
            <td class="py-1.5 px-2 text-slate-400 whitespace-nowrap">${m.date || '-'}</td>
            <td class="py-1.5 px-2 font-sans font-medium text-slate-200 text-xs">
              ${m.competition || '-'}
              ${m.isMajorProtected ? '<span class="ml-1 text-[8px] bg-purple-950 border border-purple-800 text-purple-300 px-1 py-0.2 rounded font-mono font-bold">WA 2.8 PROTECTED (' + m.category + ')</span>' : ''}
            </td>
            <td class="py-1.5 px-2 text-center"><span class="px-1.5 py-0.5 rounded border text-[8px] font-bold bg-slate-800 border-slate-700 text-cyan-300">${m.category || '-'}</span></td>
            <td class="py-1.5 px-2 text-right font-bold text-cyan-400 text-xs">${m.mark}m</td>
            <td class="py-1.5 px-2 text-right text-slate-400">${m.wind ? m.wind + ' m/s' : '-'}</td>
            <td class="py-1.5 px-2 text-center text-slate-300">${m.place || '-'}</td>
            <td class="py-1.5 px-2 text-right font-black text-amber-400 text-xs">${m.performance_score} Pkt</td>
          </tr>
        `).join('');

        accTr.innerHTML = `
          <td colspan="8" class="p-3">
            <div class="bg-slate-900 rounded-lg border border-slate-800 p-3 shadow-md">
              <h4 class="font-bold text-white text-xs uppercase tracking-wider font-sans mb-2">
                Gezählte Wertungs-Meetings für ${ath.name} (${displayValue})
              </h4>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr class="bg-slate-950 text-slate-500 border-b border-slate-800 uppercase font-bold text-[9px]">
                      <th class="py-1 px-2">Datum</th>
                      <th class="py-1 px-2">Meeting</th>
                      <th class="py-1 px-2 text-center">Kat</th>
                      <th class="py-1 px-2 text-right">Weite</th>
                      <th class="py-1 px-2 text-right">Wind</th>
                      <th class="py-1 px-2 text-center">Platz</th>
                      <th class="py-1 px-2 text-right font-bold text-amber-400">Score</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/40">
                    ${mHtml}
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

  return { render };
})();
