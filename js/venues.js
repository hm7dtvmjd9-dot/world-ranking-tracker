/**
 * Tab 4: Meeting & Venue Intelligence Radar (Sandpit & Runway Index)
 */
const VenuesModule = (() => {
  function render(state) {
    const container = document.getElementById('venuesListContainer');
    const upcomingContainer = document.getElementById('upcomingMeetingsGrid');
    if (!container || !state.venuesData) return;

    const venues = state.venuesData.venues || [];

    // 1. Render Manager Target Meetings Grid
    if (upcomingContainer) {
      const allUpcoming = [];
      venues.forEach(v => {
        (v.upcomingMeetings || []).forEach(m => {
          allUpcoming.push({ ...m, venue: v });
        });
      });

      // Sort by date
      allUpcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

      upcomingContainer.innerHTML = allUpcoming.map(item => {
        const isGorzow = item.venue.id === 'gorzow-arena';
        return `
          <div class="bg-slate-900 border ${isGorzow ? 'border-amber-500/70 shadow-lg shadow-amber-950/30' : 'border-slate-800'} rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/50 transition-all">
            <div>
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase ${
                  item.category === 'GW' ? 'bg-purple-950 text-purple-300 border border-purple-700' :
                  item.category === 'A' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                  item.category === 'B' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' :
                  'bg-slate-800 text-slate-300 border border-slate-700'
                }">
                  Kat. ${item.category} • ${item.tour}
                </span>
                ${item.managerAlert ? '<span class="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] tracking-wider animate-pulse font-mono">MANAGER PRIO 1</span>' : ''}
              </div>
              <h3 class="font-bold text-white text-sm leading-snug">${item.name}</h3>
              <p class="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                <span>📍 ${item.venue.name} (${item.venue.city}, ${item.venue.country})</span>
                <span class="text-slate-600">|</span>
                <span class="text-cyan-400 font-bold">📅 ${item.date}</span>
              </p>
            </div>

            <div class="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-[11px] font-mono space-y-1">
              <div class="flex justify-between text-slate-400">
                <span>Gruben-Index:</span>
                <strong class="text-amber-400">${item.venue.pitRating} / 10.0</strong>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>Anlaufbelag:</span>
                <span class="text-slate-200 truncate max-w-[180px]">${item.venue.runwaySurface}</span>
              </div>
              ${item.venue.herdenHistory.bestMark ? `
                <div class="flex justify-between text-slate-400 pt-1 border-t border-slate-800/50">
                  <span>Luka PB hier:</span>
                  <strong class="text-emerald-400">${item.venue.herdenHistory.bestMark.toFixed(2)}m (${item.venue.herdenHistory.avgScore} Pkt)</strong>
                </div>
              ` : ''}
            </div>

            <div class="text-[11px] text-slate-300 font-sans leading-relaxed bg-slate-800/40 p-2 rounded border border-slate-800">
              ${item.managerNote}
            </div>

            <button onclick="VenuesModule.copyManagerPitch('${item.name}', '${item.date}', '${item.venue.name}', '${item.venue.city}', '${item.venue.herdenHistory.bestMark || ''}', '${item.category}')" class="w-full py-2 bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-700 hover:border-cyan-500 rounded-lg text-cyan-400 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span>📋 Pitch für Manager kopieren</span>
            </button>
          </div>
        `;
      }).join('');
    }

    // 2. Render Full Venues Database Breakdown
    container.innerHTML = venues.map(v => {
      const isGorzow = v.id === 'gorzow-arena';
      return `
        <div class="bg-slate-900 border ${isGorzow ? 'border-cyan-500/70 bg-cyan-950/10' : 'border-slate-800'} rounded-xl p-4 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-white">${v.name}</h3>
                <span class="px-2 py-0.5 rounded text-[10px] font-black font-mono ${v.indoor ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}">
                  ${v.indoor ? 'INDOOR' : 'OUTDOOR'}
                </span>
                ${isGorzow ? '<span class="px-2 py-0.5 rounded bg-cyan-600 text-white font-mono font-black text-[10px]">LUKA 8.18m BENCHMARK</span>' : ''}
              </div>
              <p class="text-xs text-slate-400 font-mono mt-0.5">📍 ${v.city}, ${v.country}</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <span class="text-[9px] text-slate-500 font-mono block uppercase">Sandpit Score</span>
                <span class="text-lg font-black text-amber-400 font-mono">${v.pitRating}</span><span class="text-slate-600 text-xs font-mono">/10</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div class="space-y-2">
              <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <span class="text-[10px] text-slate-400 uppercase font-mono font-bold block mb-1">🏃 Anlaufbahn & Elastizität</span>
                <p class="text-slate-200 font-medium">${v.runwaySurface}</p>
              </div>
              <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <span class="text-[10px] text-slate-400 uppercase font-mono font-bold block mb-1">🏖️ Sandgrube & Landung</span>
                <p class="text-slate-300 leading-relaxed">${v.pitDescription}</p>
              </div>
            </div>

            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
              <div>
                <span class="text-[10px] text-cyan-400 uppercase font-mono font-bold block mb-1">⭐ Luka Herden Track Record</span>
                <div class="space-y-1 font-mono text-xs mt-1.5">
                  <div class="flex justify-between"><span class="text-slate-400">Beste Weite hier:</span> <strong class="text-white">${v.herdenHistory.bestMark ? v.herdenHistory.bestMark.toFixed(2) + 'm' : 'Noch kein Start'}</strong></div>
                  <div class="flex justify-between"><span class="text-slate-400">Gezählte Starts:</span> <span class="text-slate-300">${v.herdenHistory.jumpsCount}</span></div>
                  ${v.herdenHistory.avgScore ? `<div class="flex justify-between"><span class="text-slate-400">Performance Score:</span> <strong class="text-amber-400">${v.herdenHistory.avgScore} Pkt</strong></div>` : ''}
                </div>
              </div>
              <p class="text-[11px] text-slate-400 italic font-sans mt-2 pt-2 border-t border-slate-800/60">
                "${v.herdenHistory.notes}"
              </p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function copyManagerPitch(meetingName, date, venueName, city, bestMark, cat) {
    let text = `Hi, für meine Saisonplanung möchte ich gerne folgendes Meeting priorisieren:\n\n`;
    text += `🏆 Meeting: ${meetingName}\n`;
    text += `📅 Datum: ${date}\n`;
    text += `📍 Ort: ${venueName} (${city})\n`;
    text += `📊 Kategorie: ${cat}\n`;
    if (bestMark) {
      text += `⚡ Performance-Historie: Ich habe auf dieser Anlage bereits ${bestMark}m gesprungen (hervorragender Steg/Grube).\n`;
    }
    text += `\nBitte frage zeitnah einen Startplatz für das Weitsprung-Feld an!`;

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ Pitch-Text für Manager in die Zwischenablage kopiert!\n\n${text}`);
    }).catch(() => {
      prompt('Pitch-Text kopieren (Strg+C / Cmd+C):', text);
    });
  }

  return { render, copyManagerPitch };
})();
