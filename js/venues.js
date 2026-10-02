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
    if (m.tier === 'Gold' || m.tier === 'World Athletics Series') {
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

  function renderCalendarMonthGrid(state) {
    const container = document.getElementById('calendarMonthGridContainer');
    if (!container) return;

    const calendar = state.calendarData;
    const meetings = (calendar && calendar.meetings) ? calendar.meetings : [];

    // Filter according to active filters
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

    const months = [
      'Januar 2027', 'Februar 2027', 'März 2027', 'April 2027',
      'Mai 2027', 'Juni 2027', 'Juli 2027', 'August 2027', 'September 2027'
    ];

    const meetingsByMonth = {};
    months.forEach(m => meetingsByMonth[m] = []);
    filtered.forEach(m => {
      const monthKey = m.month || 'Januar 2027';
      if (!meetingsByMonth[monthKey]) meetingsByMonth[monthKey] = [];
      meetingsByMonth[monthKey].push(m);
    });

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Changes Notification Banner -->
        <div class="bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          <div class="flex items-center gap-2">
            <span class="text-base">🔔</span>
            <div>
              <strong class="text-cyan-300">Wöchentliches Tour-Update (02.10.2026):</strong>
              <span class="text-slate-300 ml-1">Continental Tour 2027 aktualisiert • WM 2027 Peking (11.–19.09.2027) bestätigt • Meisterschaften hervorgehoben.</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold shrink-0">Wöchentlich Sync</span>
        </div>

        <!-- 9-Month Calendar Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${months.map(month => {
            const list = meetingsByMonth[month] || [];
            return `
              <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 flex flex-col justify-between shadow-sm">
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span class="text-xs font-black font-mono uppercase text-white tracking-wide">${month}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-slate-800">
                    ${list.length} ${list.length === 1 ? 'Event' : 'Events'}
                  </span>
                </div>

                <div class="space-y-1.5 flex-1 min-h-[140px] max-h-60 overflow-y-auto no-scrollbar">
                  ${list.length > 0 ? list.map(m => {
                    const isChampionship = (m.tier === 'Major' || m.category === 'OW' || m.category === 'GL' || m.category === 'GW' || m.name.includes('DM') || m.name.includes('EM') || m.name.includes('WM') || m.name.includes('CISM'));
                    let badgeColor = 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700';
                    if (isChampionship) {
                      badgeColor = 'bg-purple-950/70 text-purple-200 border-purple-800 hover:border-purple-600 shadow-sm';
                    } else if (m.tier === 'Gold') {
                      badgeColor = 'bg-amber-950/70 text-amber-300 border-amber-800 hover:border-amber-600';
                    } else if (m.tier === 'Silver') {
                      badgeColor = 'bg-cyan-950/70 text-cyan-300 border-cyan-800 hover:border-cyan-600';
                    } else if (m.tier === 'Bronze') {
                      badgeColor = 'bg-emerald-950/70 text-emerald-300 border-emerald-800 hover:border-emerald-600';
                    }

                    return `
                      <div onclick="VenuesModule.openMeetingInfoModal('${m.id}')" class="cursor-pointer border rounded-lg p-2 text-xs font-mono transition-all hover:scale-[1.01] ${badgeColor}">
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-bold text-white text-[11px] truncate" title="${m.name}">${m.name}</span>
                          <span class="text-[9px] font-black shrink-0 px-1 py-0.2 rounded bg-slate-900 border border-slate-700">${m.category}</span>
                        </div>
                        <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>📅 ${m.displayDate || m.date}</span>
                          <span class="truncate ml-1">📍 ${m.city} (${m.country})</span>
                        </div>
                        ${m.promisingRunway ? `
                          <div class="mt-1 text-[9px] text-amber-400 flex items-center gap-1">
                            <span>⭐</span>
                            <span class="truncate">Schnelle Anlage (Holzunterbau)</span>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('') : `
                    <div class="py-10 text-center text-slate-600 font-mono text-[11px] italic">
                      Keine Wettkämpfe in diesem Monat
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  return { render, openMeetingInfoModal, copyManagerPitchById, resetFilters, toggleMeetingRow, setViewMode, renderCalendarMonthGrid };
})();

window.VenuesModule = VenuesModule;
