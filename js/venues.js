/**
 * Tab 4: Verifizierter Meeting- & Wettkampfkalender 2027
 * Grounded in European Athletics & World Athletics Tour official documents.
 * Target Discipline: Weitsprung Männer (Men's LJ).
 * Excludes Women's-only events (e.g. ISTAF Berlin) when filter is active.
 */
const VenuesModule = (() => {
  let selectedTier = 'ALL';
  let mensOnly = true;
  let initializedListeners = false;

  function initListeners() {
    if (initializedListeners) return;

    const filterCheckbox = document.getElementById('filterMensLjOnly');
    if (filterCheckbox) {
      filterCheckbox.checked = mensOnly;
      filterCheckbox.addEventListener('change', (e) => {
        mensOnly = e.target.checked;
        if (window.App && window.App.state) {
          render(window.App.state);
        }
      });
    }

    const tierButtons = document.querySelectorAll('.cal-tier-btn');
    tierButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tierButtons.forEach(b => {
          b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800';
        });
        btn.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
        selectedTier = btn.getAttribute('data-tier') || 'ALL';
        if (window.App && window.App.state) {
          render(window.App.state);
        }
      });
    });

    initializedListeners = true;
  }

  function render(state) {
    initListeners();

    const container = document.getElementById('calendarScheduleContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];

    if (meetings.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono">
          <p>Lade Meeting-Kalender 2027...</p>
        </div>
      `;
      return;
    }

    // Filter meetings
    const filtered = meetings.filter(m => {
      // 1. Discipline filter
      if (mensOnly && !m.mensLongJump) {
        return false;
      }
      // 2. Tier filter
      if (selectedTier !== 'ALL') {
        if (m.tier.toLowerCase() !== selectedTier.toLowerCase()) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono">
          <p>Keine Meetings gefunden für die Filterkriterien.</p>
          <button onclick="VenuesModule.resetFilters()" class="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold font-mono">
            Filter zurücksetzen
          </button>
        </div>
      `;
      return;
    }

    // Group by Month (preserving chronological order)
    const monthGroups = {};
    filtered.forEach(m => {
      const monthKey = m.month || 'Weitere Meetings';
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(m);
    });

    // Render monthly sections
    let html = '';
    for (const [month, list] of Object.entries(monthGroups)) {
      html += `
        <div class="space-y-3">
          <!-- Month Section Header -->
          <div class="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-sm">
            <div class="flex items-center gap-2">
              <span class="text-sm">🗓️</span>
              <h3 class="text-xs font-black uppercase tracking-wider text-white font-mono">${month}</h3>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-400 border border-slate-800">
              ${list.length} ${list.length === 1 ? 'Meeting' : 'Meetings'}
            </span>
          </div>

          <!-- Meeting Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${list.map(m => renderMeetingCard(m)).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function renderMeetingCard(m) {
    const isPrio1 = m.priority === 'PRIO 1' || m.priority === 'MAJOR CHAMPIONSHIP';
    const isGorzow = m.id === 'wit-gorzow-2027';
    const isValencia = m.id === 'ea-valencia-2027';
    const isMadrid = m.id === 'wa-madrid-2027';
    const isNoMens = !m.mensLongJump;

    // Border and accent styling
    let cardClasses = 'bg-slate-900 border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all hover:border-cyan-500/50 ';
    if (isValencia) {
      cardClasses += 'border-purple-500/80 shadow-lg shadow-purple-950/40 bg-gradient-to-b from-purple-950/20 to-slate-900';
    } else if (isGorzow) {
      cardClasses += 'border-amber-500/80 shadow-lg shadow-amber-950/40 bg-gradient-to-b from-amber-950/20 to-slate-900';
    } else if (isMadrid) {
      cardClasses += 'border-cyan-500/80 shadow-lg shadow-cyan-950/40 bg-gradient-to-b from-cyan-950/20 to-slate-900';
    } else if (isNoMens) {
      cardClasses += 'border-rose-900/60 opacity-60 bg-rose-950/10';
    } else {
      cardClasses += 'border-slate-800 shadow-sm';
    }

    // Tier badge colors
    let tierBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
    if (m.tier === 'Gold') {
      tierBadgeClass = 'bg-amber-950 text-amber-300 border-amber-700';
    } else if (m.tier === 'Silver') {
      tierBadgeClass = 'bg-slate-800 text-cyan-300 border-cyan-700';
    } else if (m.tier === 'Bronze') {
      tierBadgeClass = 'bg-amber-900/50 text-amber-400 border-amber-800';
    } else if (m.tier === 'Challenger') {
      tierBadgeClass = 'bg-blue-950 text-blue-300 border-blue-800';
    } else if (m.tier === 'Championship') {
      tierBadgeClass = 'bg-purple-900 text-purple-200 border-purple-600 animate-pulse';
    }

    return `
      <div class="${cardClasses}">
        <div>
          <!-- Header: Badges & Tags -->
          <div class="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase border ${tierBadgeClass}">
                ${m.tier.toUpperCase()} • KAT. ${m.category}
              </span>
              ${isGorzow ? '<span class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] font-mono tracking-tight">🔥 8.18m REKORDBAHN</span>' : ''}
              ${isMadrid ? '<span class="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-black text-[9px] font-mono tracking-tight">🏔️ 667m HÖHENLAGE</span>' : ''}
              ${isValencia ? '<span class="px-1.5 py-0.5 rounded bg-purple-500 text-white font-black text-[9px] font-mono tracking-tight animate-pulse">🎯 SAISONZIEL</span>' : ''}
              ${isNoMens ? '<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] font-mono">⚠️ NUR FRAUEN</span>' : ''}
            </div>
            ${m.managerAlert ? '<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] font-mono tracking-wider animate-pulse">PRIO 1</span>' : ''}
          </div>

          <!-- Meeting Name & Date/Venue -->
          <h4 class="font-bold text-white text-sm leading-snug font-sans">${m.name}</h4>
          <p class="text-xs text-slate-400 font-mono mt-1 flex flex-wrap items-center gap-2">
            <span class="text-cyan-400 font-bold">📅 ${m.displayDate || m.date}</span>
            <span class="text-slate-600">•</span>
            <span>📍 ${m.venue} (${m.city}, ${m.country})</span>
          </p>
        </div>

        <!-- Technical Venue Radar: Surface & Pit -->
        <div class="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-[11px] font-mono space-y-1.5">
          <div class="flex justify-between items-center text-slate-400">
            <span>Gruben-Index (Sand):</span>
            <strong class="${m.pitRating >= 9.5 ? 'text-emerald-400 font-black' : m.pitRating >= 9.0 ? 'text-amber-400 font-bold' : 'text-slate-300'}">
              ${m.pitRating ? m.pitRating.toFixed(1) + ' / 10' : '-'}
            </strong>
          </div>
          <div class="flex justify-between items-start text-slate-400 gap-2">
            <span class="whitespace-nowrap">Anlaufbelag:</span>
            <span class="text-slate-200 text-right truncate font-sans text-[10px]">${m.surface || '-'}</span>
          </div>
          <div class="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/60">
            <span>Status:</span>
            <span class="text-[10px] ${isNoMens ? 'text-rose-400 font-bold' : 'text-emerald-400 font-medium'}">${m.status || '-'}</span>
          </div>
        </div>

        <!-- Notes / Tactical Insights -->
        <div class="text-[11px] text-slate-300 font-sans leading-relaxed bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
          ${m.notes || ''}
        </div>

        <!-- Action: Copy Pitch for Manager -->
        ${!isNoMens ? `
          <button onclick="VenuesModule.copyManagerPitchById('${m.id}')" class="w-full py-2 bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-700 hover:border-cyan-500 rounded-lg text-cyan-400 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm">
            <span>📋 Pitch für Manager kopieren</span>
          </button>
        ` : `
          <div class="w-full py-1.5 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-400 font-mono text-[10px] text-center font-bold">
            Keine Männer-Disziplin (Keine Bewerbung)
          </div>
        `}
      </div>
    `;
  }

  function copyManagerPitchById(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    let text = `Hi, für meine Saisonplanung 2027 möchte ich gerne folgendes Meeting priorisieren:\n\n`;
    text += `🏆 Meeting: ${m.name}\n`;
    text += `📅 Datum: ${m.displayDate || m.date}\n`;
    text += `📍 Ort: ${m.venue} (${m.city}, ${m.country})\n`;
    text += `📊 Kategorie: Kat. ${m.category} (${m.tier})\n`;
    if (m.managerPitch) {
      text += `⚡ Relevanz: ${m.managerPitch}\n`;
    }
    if (m.notes) {
      text += `ℹ️ Notiz: ${m.notes}\n`;
    }
    text += `\nBitte frage zeitnah einen Startplatz für das Weitsprung-Feld der Männer an!`;

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ Pitch-Text für Manager in die Zwischenablage kopiert!\n\n${text}`);
    }).catch(() => {
      prompt('Pitch-Text kopieren (Strg+C / Cmd+C):', text);
    });
  }

  function resetFilters() {
    selectedTier = 'ALL';
    mensOnly = true;
    const filterCheckbox = document.getElementById('filterMensLjOnly');
    if (filterCheckbox) filterCheckbox.checked = true;
    document.querySelectorAll('.cal-tier-btn').forEach(b => {
      if (b.getAttribute('data-tier') === 'ALL') {
        b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600 text-white shadow-sm';
      } else {
        b.className = 'cal-tier-btn px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700 bg-slate-950 hover:bg-slate-800';
      }
    });
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

  return { render, copyManagerPitchById, resetFilters };
})();
