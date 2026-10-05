/**
 * Tab 4: Verifizierter Meeting- & Wettkampfkalender 2027
 * Grounded in European Athletics & World Athletics Tour official documents.
 * Target Discipline: Weitsprung Männer (Men's LJ).
 * Excludes non-Men's LJ meetings via strict GraphQL units inspection.
 */
const VenuesModule = (() => {
  let selectedTier = 'ALL';
  let currentViewMode = 'list'; // 'list' | 'calendar'
  let mensOnly = true;
  let initializedListeners = false;
  let searchQuery = '';
  let expandedMeetingId = null;

  function toggleMeetingRow(id) {
    expandedMeetingId = expandedMeetingId === id ? null : id;
    if (window.App && window.App.state) {
      render(window.App.state);
    }
  }

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
          <p>Lade verifizierten Meeting-Kalender 2027...</p>
        </div>
      `;
      return;
    }

    // Filter meetings
    const filtered = meetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (selectedTier !== 'ALL') {
        if (m.tier.toLowerCase() !== selectedTier.toLowerCase()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${m.name} ${m.venue} ${m.city} ${m.country} ${m.tier}`.toLowerCase();
        if (!str.includes(q)) return false;
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
      const monthKey = m.month || 'Weitere Termine 2027';
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(m);
    });

    // Render compact list / table view
    let html = '';
    for (const [month, list] of Object.entries(monthGroups)) {
      html += `
        <div class="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3 shadow-sm">
          <!-- Month Header -->
          <div class="flex items-center justify-between px-2 py-1 border-b border-slate-800/80">
            <div class="flex items-center gap-2">
              <span class="text-sm">🗓️</span>
              <h3 class="text-xs font-black uppercase tracking-wider text-white font-mono">${month}</h3>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-400 border border-slate-800">
              ${list.length} ${list.length === 1 ? 'Meeting' : 'Meetings'} mit Weitsprung Männer
            </span>
          </div>

          <!-- Compact List (Row by Row) -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr class="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <th class="py-2 px-2.5 whitespace-nowrap">Datum</th>
                  <th class="py-2 px-2.5">Meeting & Ort</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Kategorie</th>
                  <th class="py-2 px-2 text-center whitespace-nowrap">Standard (Kat C+)</th>
                  <th class="py-2 px-2 whitespace-nowrap">Anlage & Historie</th>
                  <th class="py-2 px-2.5 text-right whitespace-nowrap">Aktion</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${list.map(m => renderMeetingRow(m)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function renderMeetingRow(m) {
    const isGorzow = m.name.toLowerCase().includes('gorzów') || (m.city && m.city.toLowerCase().includes('gorzów'));
    const isPromising = m.promisingRunway;
    const isExpanded = expandedMeetingId === m.id;

    // Tier badge colors
    let tierBadge = 'bg-slate-800 text-slate-300 border-slate-700';
    if (m.tier === 'Diamond League') {
      tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-sm';
    } else if (m.tier === 'Gold' || m.tier === 'World Athletics Series') {
      tierBadge = 'bg-amber-950 text-amber-300 border-amber-700';
    } else if (m.tier === 'Silver') {
      tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
    } else if (m.tier === 'Bronze') {
      tierBadge = 'bg-amber-900/50 text-amber-400 border-amber-800';
    } else if (m.tier === 'Challenger') {
      tierBadge = 'bg-blue-950 text-blue-300 border-blue-800';
    }

    const hasContacts = m.contactPersons && m.contactPersons.length > 0;
    const contactCount = hasContacts ? m.contactPersons.length : 0;

    let mainRow = `
      <tr onclick="VenuesModule.toggleMeetingRow('${m.id}')" class="cursor-pointer hover:bg-slate-800/40 transition-colors ${
        isExpanded ? 'bg-slate-800/70 border-b border-slate-800' : isGorzow ? 'bg-amber-950/15' : ''
      }">
        <!-- Datum -->
        <td class="py-2 px-2.5 whitespace-nowrap font-bold text-white">
          <div class="flex items-center gap-1.5">
            <span class="text-cyan-400">${m.displayDate || m.date}</span>
            ${m.indoor ? '<span class="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-normal">Halle</span>' : ''}
          </div>
        </td>

        <!-- Meeting & Ort -->
        <td class="py-2 px-2.5">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-100 font-sans text-xs">${m.name}</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">${m.country}</span>
              ${isGorzow ? '<span class="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] font-mono">LUKA 8.18m</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-sans mt-0.5">
              ${m.venue ? `${m.venue}, ` : ''}${m.city}
            </span>
          </div>
        </td>

        <!-- Kategorie & Tour -->
        <td class="py-2 px-2 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${tierBadge}">
            ${m.tier.toUpperCase()} • Kat. ${m.category}
          </span>
        </td>

        <!-- Standard Eignung -->
        <td class="py-2 px-2 text-center whitespace-nowrap">
          ${m.standardEligible ? `
            <span class="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              Standard C+ ✅
            </span>
          ` : `
            <span class="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px]">
              Punkte (Kat. D)
            </span>
          `}
        </td>

        <!-- Anlage & Historie -->
        <td class="py-2 px-2 whitespace-nowrap">
          ${isPromising ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/80 shadow-sm" title="${m.runwayNote}">
              <span>⭐ Anlage vielversprechend</span>
            </span>
          ` : `
            <span class="text-slate-500 text-[10px]">Solide Anlage</span>
          `}
        </td>

        <!-- Aktionen -->
        <td class="py-2 px-2.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-cyan-950 active:scale-95 border border-slate-700 hover:border-cyan-500 text-cyan-400 font-mono text-[10px] font-bold transition-all shadow-sm flex items-center gap-1">
              <span>ℹ️ Details ${contactCount > 0 ? `(${contactCount})` : ''}</span>
            </button>
            <span class="text-slate-500 text-xs">${isExpanded ? '▲' : '▼'}</span>
          </div>
        </td>
      </tr>
    `;

    if (!isExpanded) {
      return mainRow;
    }

    const accordionRow = `
      <tr class="bg-slate-950/90 border-b border-slate-800">
        <td colspan="6" class="p-3">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-md">
            <!-- 1. Header with Title & Action Shortcuts -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-base">${isPromising ? '⭐' : '🏟️'}</span>
                <div>
                  <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    ${m.name} • ANLAGEN- & WETTKAMPFDETAILS
                  </h4>
                  <span class="text-[10px] text-slate-400 font-mono">${m.displayDate || m.date} • ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country}) • ${m.tier} (Kat. ${m.category})</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="event.stopPropagation(); VenuesModule.copyManagerPitchById('${m.id}')" class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-[10px] rounded transition-all shadow-sm">
                  📋 Pitch für Manager
                </button>
                <button onclick="event.stopPropagation(); VenuesModule.openMeetingInfoModal('${m.id}')" class="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold font-mono text-[10px] rounded transition-all">
                  Vollansicht / Kontakte ↗
                </button>
              </div>
            </div>

            <!-- 2. Historical Basis & Runway Justification -->
            <div class="${isPromising ? 'bg-amber-950/25 border-amber-600/60' : 'bg-slate-950 border-slate-800'} border rounded-lg p-3 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 font-bold font-mono text-xs ${isPromising ? 'text-amber-300' : 'text-slate-300'}">
                  <span>${isPromising ? '⭐ DATENBASIS: VIELVERSPRECHENDE ANLAGE' : '📊 ANLAGENBEWERTUNG'}</span>
                </div>
                ${m.standardEligible ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Standard C+ berechtigt</span>' : ''}
              </div>
              <p class="text-xs text-slate-200 font-sans leading-relaxed">
                ${m.runwayNote || 'Reguläre Wettkampfanlage mit standardisierten Bedingungen.'}
              </p>

              <!-- Historical Marks Table/Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Lukas bisherige Weiten hier:</span>
                  ${m.lukaHistory && m.lukaHistory.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-1">
                      ${m.lukaHistory.map(h => `
                        <span class="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                          ${typeof h.mark === 'number' ? h.mark.toFixed(2) : h.mark}m (${h.date || h.year}, Pl. ${h.place})
                        </span>
                      `).join('')}
                    </div>
                  ` : '<span class="text-slate-500 text-[10px] italic">Noch kein Wettkampf von Luka dokumentiert.</span>'}
                </div>

                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Top-Weiten bei diesem Meeting:</span>
                  ${m.topHistoricalMarks && m.topHistoricalMarks.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-1">
                      ${m.topHistoricalMarks.map((mk, idx) => `
                        <span class="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold">
                          #${idx + 1}: ${typeof mk === 'number' ? mk.toFixed(2) : mk}m
                        </span>
                      `).join('')}
                    </div>
                  ` : '<span class="text-slate-500 text-[10px] italic">Keine Weiten im WA-Archiv erfasst.</span>'}
                </div>
              </div>
            </div>

            <!-- 3. Organizer Contacts Quick Box -->
            ${m.contactPersons && m.contactPersons.length > 0 ? `
              <div class="space-y-1.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase font-mono block">Veranstalter / Liaison-Kontakte:</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${m.contactPersons.map(cp => `
                    <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
                      <div class="flex items-center justify-between">
                        <strong class="text-white">${cp.name}</strong>
                        <span class="text-[9px] text-cyan-400">${cp.title || 'Organisation'}</span>
                      </div>
                      <div class="flex items-center gap-3 mt-1 text-[11px]">
                        ${cp.email ? `<a href="mailto:${cp.email}" class="text-cyan-400 hover:underline">✉️ ${cp.email}</a>` : ''}
                        ${cp.phone ? `<a href="tel:${cp.phone}" class="text-emerald-400 hover:underline">📞 ${cp.phone}</a>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;

    return mainRow + accordionRow;
  }

  function openMeetingInfoModal(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    const modal = document.getElementById('meetingInfoModal');
    if (!modal) return;

    // Header elements
    const catBadge = document.getElementById('modalMeetingCategoryBadge');
    if (catBadge) {
      catBadge.textContent = `${m.tier.toUpperCase()} • KAT. ${m.category}`;
      let tierBadge = 'bg-slate-800 text-slate-300 border-slate-700';
      if (m.tier === 'Gold') tierBadge = 'bg-amber-950 text-amber-300 border-amber-700';
      else if (m.tier === 'Silver') tierBadge = 'bg-cyan-950 text-cyan-300 border-cyan-700';
      else if (m.tier === 'Bronze') tierBadge = 'bg-amber-900/50 text-amber-400 border-amber-800';
      catBadge.className = `px-2 py-0.5 rounded text-xs font-black font-mono border ${tierBadge}`;
    }

    const titleEl = document.getElementById('modalMeetingName');
    if (titleEl) titleEl.textContent = m.name;

    const subEl = document.getElementById('modalMeetingSub');
    if (subEl) {
      subEl.textContent = `📅 ${m.displayDate || m.date} • ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country}) • ${m.tour}`;
    }

    // Modal Body Content
    const bodyEl = document.getElementById('modalMeetingBody');
    if (bodyEl) {
      // Contacts HTML
      let contactsHtml = '';
      if (m.contactPersons && m.contactPersons.length > 0) {
        contactsHtml = m.contactPersons.map(cp => `
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-white text-xs">${cp.name || 'Ansprechpartner'}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">${cp.title || 'Veranstalter'}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
              ${cp.email ? `<a href="mailto:${cp.email}" class="text-cyan-400 hover:underline flex items-center gap-1">✉️ ${cp.email}</a>` : ''}
              ${cp.phone ? `<a href="tel:${cp.phone}" class="text-emerald-400 hover:underline flex items-center gap-1">📞 ${cp.phone}</a>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        contactsHtml = '<p class="text-xs text-slate-500 italic">Keine individuellen Kontaktdaten in World Athletics hinterlegt.</p>';
      }

      // Units (Disziplinen) HTML
      const menEvents = m.disciplinesMen || ['Long Jump'];
      const womenEvents = m.disciplinesWomen || [];

      // Historical Benchmark HTML
      let historyHtml = '';
      if (m.promisingRunway) {
        historyHtml = `
          <div class="bg-amber-950/30 border border-amber-600/70 rounded-xl p-3.5 space-y-1.5 shadow-sm">
            <div class="flex items-center gap-1.5 text-amber-300 font-bold text-xs font-mono">
              <span>⭐</span>
              <span>ANLAGEN-BEWERTUNG: VIELVERSPRECHEND</span>
            </div>
            <p class="text-xs text-slate-200 font-sans leading-relaxed">
              ${m.runwayNote}
            </p>
            ${m.lukaHistory && m.lukaHistory.length > 0 ? `
              <div class="mt-2 pt-2 border-t border-amber-800/40 text-[11px] font-mono text-cyan-300">
                <strong>Lukas historische Weiten hier:</strong>
                ${m.lukaHistory.map(h => `<span class="ml-2 font-bold text-white">${h.mark.toFixed(2)}m (${h.date}, Platz ${h.place})</span>`).join(', ')}
              </div>
            ` : ''}
          </div>
        `;
      } else if (m.runwayNote) {
        historyHtml = `
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase font-mono">Anlagen-Notiz:</span>
            <p class="text-xs text-slate-300 font-sans">${m.runwayNote}</p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        ${historyHtml}

        <!-- Organizer Contacts -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span>👤</span>
            <span>VERANSTALTER & ATHLETES LIAISON KONTAKTE</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${contactsHtml}
          </div>
        </div>

        <!-- Offered Disciplines (Units) -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span>🎯</span>
            <span>ANGEBOTENE DISZIPLINEN (UNITS)</span>
          </h4>
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div>
              <span class="text-[10px] font-bold text-cyan-400 uppercase font-mono block mb-1">Männer:</span>
              <div class="flex flex-wrap gap-1.5">
                ${menEvents.map(e => `
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    e.toLowerCase().includes('long jump') || e.toLowerCase().includes('weitsprung')
                      ? 'bg-cyan-500 text-slate-950 border border-cyan-400 shadow-sm'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }">
                    ${e} ${e.toLowerCase().includes('long jump') ? '⭐ (ZIEL)' : ''}
                  </span>
                `).join('')}
              </div>
            </div>
            ${womenEvents.length > 0 ? `
              <div class="pt-2 border-t border-slate-800/80">
                <span class="text-[10px] font-bold text-purple-400 uppercase font-mono block mb-1">Frauen:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${womenEvents.map(e => `
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      ${e}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Pitch Copy Action -->
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div class="text-xs font-mono text-slate-300">
            <strong>Bewerbung beim Veranstalter:</strong>
            <span class="text-slate-400 block text-[11px]">Kopiert einen fertigen Bewerbungs-Pitch für deinen Manager inkl. aller Meeting-Details.</span>
          </div>
          <button onclick="VenuesModule.copyManagerPitchById('${m.id}')" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black font-mono text-xs rounded-lg transition-all shadow-md shrink-0">
            📋 Pitch für Manager kopieren
          </button>
        </div>
      `;
    }

    // Modal Links
    const linksEl = document.getElementById('modalMeetingLinks');
    if (linksEl) {
      const links = [];
      if (m.websiteUrl) links.push(`<a href="${m.websiteUrl}" target="_blank" class="text-cyan-400 hover:underline font-mono text-xs flex items-center gap-1">🌐 Website ↗</a>`);
      if (m.resultsPageUrl) links.push(`<a href="${m.resultsPageUrl}" target="_blank" class="text-cyan-400 hover:underline font-mono text-xs flex items-center gap-1">📊 Resultate ↗</a>`);
      if (m.liveStreamingUrl) links.push(`<a href="${m.liveStreamingUrl}" target="_blank" class="text-emerald-400 hover:underline font-mono text-xs flex items-center gap-1">📺 Livestream ↗</a>`);
      linksEl.innerHTML = links.join('<span class="text-slate-700">•</span>');
    }

    modal.classList.remove('hidden');
  }

  function copyManagerPitchById(meetingId) {
    const calendar = (window.App && window.App.state && window.App.state.calendarData) || null;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];
    const m = meetings.find(item => item.id === meetingId);
    if (!m) return;

    let text = `Hi, für meine Saisonplanung 2027 möchte ich gerne folgendes Meeting priorisieren:\n\n`;
    text += `🏆 Meeting: ${m.name}\n`;
    text += `📅 Datum: ${m.displayDate || m.date}\n`;
    text += `📍 Ort: ${m.venue ? m.venue + ', ' : ''}${m.city} (${m.country})\n`;
    text += `📊 Kategorie: Kat. ${m.category} (${m.tier})\n`;
    if (m.promisingRunway) {
      text += `⭐ Anlage: ${m.runwayNote}\n`;
    }
    if (m.contactPersons && m.contactPersons.length > 0) {
      text += `👤 Ansprechpartner: ${m.contactPersons[0].name} (${m.contactPersons[0].email || m.contactPersons[0].phone})\n`;
    }
    if (m.websiteUrl) {
      text += `🔗 Website: ${m.websiteUrl}\n`;
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
    searchQuery = '';
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


  function setViewMode(mode) {
    currentViewMode = mode;
    const btnList = document.getElementById('calViewListBtn');
    const btnCal = document.getElementById('calViewCalendarBtn');
    const containerList = document.getElementById('calendarScheduleContainer');
    const containerCal = document.getElementById('calendarMonthGridContainer');

    if (btnList && btnCal) {
      if (mode === 'list') {
        btnList.className = 'px-3 py-1 rounded-md font-bold transition-all bg-cyan-500 text-slate-950 shadow-sm';
        btnCal.className = 'px-3 py-1 rounded-md font-bold transition-all text-slate-400 hover:text-white';
      } else {
        btnCal.className = 'px-3 py-1 rounded-md font-bold transition-all bg-cyan-500 text-slate-950 shadow-sm';
        btnList.className = 'px-3 py-1 rounded-md font-bold transition-all text-slate-400 hover:text-white';
      }
    }

    if (containerList && containerCal) {
      if (mode === 'list') {
        containerList.classList.remove('hidden');
        containerCal.classList.add('hidden');
      } else {
        containerList.classList.add('hidden');
        containerCal.classList.remove('hidden');
        const state = (window.App && window.App.state) || {};
        renderCalendarMonthGrid(state);
      }
    }
  }

  let activeCalendarMonth = 'Januar 2027';
  let showAllMonthsInGrid = false;

  function setCalendarMonth(mName) {
    activeCalendarMonth = mName;
    const state = (window.App && window.App.state) || {};
    renderCalendarMonthGrid(state);
  }

  function nextCalendarMonth() {
    const months = [
      'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
      'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027'
    ];
    const idx = months.indexOf(activeCalendarMonth);
    if (idx !== -1 && idx < months.length - 1) {
      setCalendarMonth(months[idx + 1]);
    }
  }

  function prevCalendarMonth() {
    const months = [
      'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
      'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027'
    ];
    const idx = months.indexOf(activeCalendarMonth);
    if (idx > 0) {
      setCalendarMonth(months[idx - 1]);
    }
  }

  function toggleShowAllMonths() {
    showAllMonthsInGrid = !showAllMonthsInGrid;
    const state = (window.App && window.App.state) || {};
    renderCalendarMonthGrid(state);
  }

  function renderCalendarMonthGrid(state) {
    const container = document.getElementById('calendarMonthGridContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const rawMeetings = (calendar && calendar.meetings) ? calendar.meetings : [];

    // Filter according to active filters
    const filtered = rawMeetings.filter(m => {
      if (mensOnly && !m.mensLongJump) return false;
      if (selectedTier !== 'ALL') {
        if (m.tier.toLowerCase() !== selectedTier.toLowerCase()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${m.name} ${m.venue} ${m.city} ${m.country} ${m.tier}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    // Sort chronologically and compute pauses / rest days between consecutive meetings across the season
    const sorted = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((m, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        const diffDays = Math.round((new Date(m.date) - new Date(prev.date)) / 86400000);
        m.gapSincePrev = diffDays;
        m.prevMeetingName = prev.city || prev.name;
      } else {
        m.gapSincePrev = null;
        m.prevMeetingName = null;
      }
      if (idx < sorted.length - 1) {
        const next = sorted[idx + 1];
        const diffDays = Math.round((new Date(next.date) - new Date(m.date)) / 86400000);
        m.gapUntilNext = diffDays;
        m.nextMeetingName = next.city || next.name;
      } else {
        m.gapUntilNext = null;
        m.nextMeetingName = null;
      }
    });

    const months = [
      'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
      'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027'
    ];

    const monthConfig = {
      'Januar 2027': { year: 2027, month: 1, days: 31 },
      'Februar 2027': { year: 2027, month: 2, days: 28 },
      'März 2027': { year: 2027, month: 3, days: 31 },
      'April 2027': { year: 2027, month: 4, days: 30 },
      'Mai 2027': { year: 2027, month: 5, days: 31 },
      'Juni 2027': { year: 2027, month: 6, days: 30 },
      'Juli 2027': { year: 2027, month: 7, days: 31 },
      'August 2027': { year: 2027, month: 8, days: 31 },
      'September 2027': { year: 2027, month: 9, days: 30 }
    };

    const meetingsByDate = {};
    sorted.forEach(m => {
      if (m.date) {
        if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
        meetingsByDate[m.date].push(m);
      }
    });

    const monthsToRender = showAllMonthsInGrid ? months : [activeCalendarMonth];

    // Build Month Selector Controls
    const monthSelectorHtml = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <span class="text-lg">🗓️</span>
            <div>
              <h3 class="text-xs font-black text-white uppercase font-mono tracking-wider">
                MEETING-MONATSKALENDER (WOCHENANSICHT MO–SO)
              </h3>
              <p class="text-[10px] text-slate-400 font-mono">
                Wochenraster mit Farbkodierung der Meetingkategorien & Visualisierung der Wettkampfpausen
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="VenuesModule.prevCalendarMonth()" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono font-bold transition-all">
              ◀ Vorheriger
            </button>
            <button onclick="VenuesModule.toggleShowAllMonths()" class="px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
              showAllMonthsInGrid ? 'bg-cyan-600 text-slate-950 font-black' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }">
              ${showAllMonthsInGrid ? '✓ Alle 9 Monate aktiv' : 'Alle 9 Monate anzeigen'}
            </button>
            <button onclick="VenuesModule.nextCalendarMonth()" class="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono font-bold transition-all">
              Nächster ▶
            </button>
          </div>
        </div>

        <!-- Month Navigation Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
          ${months.map(mName => {
            const mCount = sorted.filter(m => m.month === mName).length;
            const isActive = !showAllMonthsInGrid && activeCalendarMonth === mName;
            return `
              <button onclick="VenuesModule.setCalendarMonth('${mName}')" class="px-3 py-1 rounded-lg shrink-0 font-bold transition-all flex items-center gap-1.5 ${
                isActive ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }">
                <span>${mName.replace(' 2027', '')}</span>
                <span class="text-[9px] px-1 py-0.2 rounded ${isActive ? 'bg-slate-950 text-cyan-300' : 'bg-slate-900 text-slate-500'}">
                  ${mCount}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Render Month Grids
    const gridsHtml = monthsToRender.map(mName => {
      const cfg = monthConfig[mName] || { year: 2027, month: 1, days: 31 };
      const monthMeetings = sorted.filter(m => m.month === mName);

      // Compute statistics on pause duration for this month
      const monthGaps = monthMeetings.map(m => m.gapSincePrev).filter(g => g != null);
      const avgGap = monthGaps.length > 0 ? (monthGaps.reduce((a, b) => a + b, 0) / monthGaps.length).toFixed(1) : '-';
      const minGap = monthGaps.length > 0 ? Math.min(...monthGaps) : '-';
      const maxGap = monthGaps.length > 0 ? Math.max(...monthGaps) : '-';

      // First day of month (Monday=0 ... Sunday=6)
      const firstDayDate = new Date(cfg.year, cfg.month - 1, 1);
      const firstDayWeekday = firstDayDate.getDay(); // 0 is Sunday
      const startOffset = (firstDayWeekday === 0 ? 6 : firstDayWeekday - 1);

      // Generate grid cells
      let cellsHtml = '';

      // Leading padding cells from previous month
      for (let i = 0; i < startOffset; i++) {
        cellsHtml += `
          <div class="bg-slate-950/30 border border-slate-900/60 rounded-xl p-2 min-h-[110px] opacity-25 hidden sm:block"></div>
        `;
      }

      // Actual days of the month
      for (let d = 1; d <= cfg.days; d++) {
        const dateIso = `${cfg.year}-${String(cfg.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayMeetings = meetingsByDate[dateIso] || [];
        const hasMeeting = dayMeetings.length > 0;

        // Day of week for responsive labels
        const dObj = new Date(cfg.year, cfg.month - 1, d);
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const dayName = dayNames[dObj.getDay()];

        cellsHtml += `
          <div class="rounded-xl p-2 flex flex-col justify-between transition-all min-h-[115px] sm:min-h-[135px] border ${
            hasMeeting ? 'bg-slate-900/90 border-slate-700 shadow-md ring-1 ring-cyan-500/20' : 'bg-slate-950/60 border-slate-850/80 hover:border-slate-800'
          }">
            <!-- Day Top Bar -->
            <div class="flex items-center justify-between pb-1 border-b border-slate-800/60 text-xs font-mono">
              <div class="flex items-center gap-1">
                <span class="font-black ${hasMeeting ? 'text-white' : 'text-slate-400'}">${d}.</span>
                <span class="text-[10px] text-slate-500 font-sans">${dayName}</span>
              </div>
              ${hasMeeting ? `
                <span class="px-1.5 py-0.2 rounded text-[9px] font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  ${dayMeetings.length} WK
                </span>
              ` : `
                <span class="text-[9px] text-slate-600 font-mono hidden sm:inline">Pause</span>
              `}
            </div>

            <!-- Meetings Content or Rest Day Indicator -->
            <div class="space-y-1.5 my-1 flex-1 flex flex-col justify-center">
              ${hasMeeting ? dayMeetings.map(m => {
                const isDiamond = m.tier === 'Diamond League';
                const isChampionship = (m.tier === 'Major' || m.tier === 'World Athletics Series' || m.category === 'OW' || m.category === 'GL' || m.category === 'GW' || m.name.includes('DM') || m.name.includes('EM') || m.name.includes('WM') || m.name.includes('CISM'));
                const isGold = m.tier === 'Gold';
                const isSilver = m.tier === 'Silver';
                const isBronze = m.tier === 'Bronze';

                // Color-coded Category Badge
                let badgeStyle = 'bg-slate-850 border-slate-700 text-slate-300';
                let catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-slate-900 border border-slate-700 text-slate-300">Kat. ${m.category}</span>`;
                
                if (isDiamond) {
                  badgeStyle = 'bg-cyan-950/90 border-cyan-500/90 text-cyan-200 shadow-sm shadow-cyan-950/50 hover:border-cyan-400';
                  catBadge = `<span class="px-1.5 py-0.2 rounded text-[8px] font-black bg-cyan-900 border border-cyan-400 text-cyan-200">💎 DL • ${m.category}</span>`;
                } else if (isChampionship) {
                  badgeStyle = 'bg-purple-950/90 border-purple-500/90 text-purple-200 shadow-sm shadow-purple-950/50 hover:border-purple-400';
                  catBadge = `<span class="px-1.5 py-0.2 rounded text-[8px] font-black bg-purple-900 border border-purple-400 text-purple-200">🏆 ${m.category}</span>`;
                } else if (isGold) {
                  badgeStyle = 'bg-amber-950/90 border-amber-500/90 text-amber-200 hover:border-amber-400';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-amber-900 border border-amber-500 text-amber-200">🥇 Gold • ${m.category}</span>`;
                } else if (isSilver) {
                  badgeStyle = 'bg-slate-900 border-cyan-700 text-cyan-300 hover:border-cyan-500';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-cyan-950 border border-cyan-800 text-cyan-300">🥈 Silver • ${m.category}</span>`;
                } else if (isBronze) {
                  badgeStyle = 'bg-emerald-950/90 border-emerald-600 text-emerald-200 hover:border-emerald-400';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-emerald-900 border border-emerald-600 text-emerald-200">🥉 Bronze • ${m.category}</span>`;
                } else {
                  badgeStyle = 'bg-blue-950/90 border-blue-700 text-blue-200 hover:border-blue-500';
                  catBadge = `<span class="px-1 py-0.2 rounded text-[8px] font-black bg-blue-900 border border-blue-700 text-blue-200">🔹 Chall. • ${m.category}</span>`;
                }

                return `
                  <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="cursor-pointer border rounded-lg p-2 font-mono text-[11px] transition-all hover:scale-[1.02] space-y-1 ${badgeStyle}">
                    <div class="flex items-center justify-between gap-1">
                      <span class="font-bold text-white text-[10px] sm:text-[11px] leading-tight line-clamp-2" title="${m.name}">
                        ${m.name}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-[9px] text-slate-300">
                      <span class="font-mono">📍 ${m.city} (${m.country})</span>
                      ${catBadge}
                    </div>

                    ${m.promisingRunway ? `
                      <div class="text-[8px] font-bold text-amber-400 flex items-center gap-1">
                        <span>⭐</span>
                        <span>Schnelle Bahn</span>
                      </div>
                    ` : ''}

                    <!-- Pause Tracker Badge -->
                    ${m.gapSincePrev != null ? `
                      <div class="text-[8px] px-1 py-0.2 rounded bg-slate-950/80 border border-slate-700/60 text-slate-300 font-mono flex items-center justify-between" title="${m.gapSincePrev} Tage Pause seit ${m.prevMeetingName}">
                        <span>⚡ ${m.gapSincePrev} Tage Pause</span>
                        <span class="text-slate-500 truncate ml-1">seit ${m.prevMeetingName}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('') : `
                <div class="py-4 text-center text-slate-700 font-mono text-[10px] select-none">
                  —
                </div>
              `}
            </div>

            <!-- Footer: Next Gap Indicator -->
            ${hasMeeting && dayMeetings[0]?.gapUntilNext != null ? `
              <div class="pt-0.5 border-t border-slate-800/50 text-[8px] font-mono text-slate-400 text-right">
                ⏳ Noch ${dayMeetings[0].gapUntilNext} Tage bis nächstes Event
              </div>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-3">
          <!-- Month Header & Pause Barometer -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-base font-black font-mono uppercase text-white tracking-wider">${mName}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  ${monthMeetings.length} ${monthMeetings.length === 1 ? 'Wettkampf' : 'Wettkämpfe'}
                </span>
              </div>
              <p class="text-[10px] font-mono text-slate-400 mt-0.5">
                Vollständige Wochenansicht Montag bis Sonntag • Kalenderwochen des Monats
              </p>
            </div>

            <!-- Rest Period & Rhythm Barometer -->
            <div class="flex items-center gap-2 flex-wrap font-mono text-[10px]">
              <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                <span class="text-slate-400">Ø Pause:</span>
                <span class="font-bold text-cyan-300">${avgGap} ${avgGap !== '-' ? 'Tage' : ''}</span>
              </div>
              ${minGap !== '-' ? `
                <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                  <span class="text-slate-400">Min / Max Pause:</span>
                  <span class="font-bold text-amber-300">${minGap} / ${maxGap} Tage</span>
                </div>
              ` : ''}
              <div class="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                <span class="text-slate-400">DL & Majors:</span>
                <span class="font-bold text-purple-300">
                  ${monthMeetings.filter(m => m.tier === 'Diamond League' || m.tier === 'Major' || m.tier === 'World Athletics Series' || m.category === 'OW' || m.category === 'GL').length}
                </span>
              </div>
            </div>
          </div>

          <!-- Weekday Headers (Mo, Di, Mi, Do, Fr, Sa, So) -->
          <div class="grid grid-cols-2 sm:grid-cols-7 gap-1.5 text-center font-mono font-bold text-xs text-slate-400 pb-1.5 border-b border-slate-800">
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Montag (Mo)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Dienstag (Di)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Mittwoch (Mi)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Donnerstag (Do)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-slate-300">Freitag (Fr)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-cyan-300">Samstag (Sa)</div>
            <div class="hidden sm:block py-1 rounded bg-slate-950/60 text-cyan-300">Sonntag (So)</div>
          </div>

          <!-- Month Grid Cells -->
          <div class="grid grid-cols-1 sm:grid-cols-7 gap-1.5">
            ${cellsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Changes Notification Banner -->
        <div class="bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          <div class="flex items-center gap-2">
            <span class="text-base">💎</span>
            <div>
              <strong class="text-cyan-300">Tour- & Diamond League Update 2027:</strong>
              <span class="text-slate-300 ml-1">Wanda Diamond League Meetings mit Weitsprung Männer integriert • Pausenberechnung aktiv • Kalenderwochen Mo–So.</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold shrink-0">Wöchentlich verifiziert</span>
        </div>

        ${monthSelectorHtml}
        ${gridsHtml}
      </div>
    `;
  }

  return {
    render,
    openMeetingInfoModal,
    copyManagerPitchById,
    resetFilters,
    toggleMeetingRow,
    setViewMode,
    renderCalendarMonthGrid,
    setCalendarMonth,
    nextCalendarMonth,
    prevCalendarMonth,
    toggleShowAllMonths
  };
})();

window.VenuesModule = VenuesModule;
