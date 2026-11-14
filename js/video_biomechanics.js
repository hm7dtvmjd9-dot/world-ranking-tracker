/**
 * Video-Biomechanik, DLV-Kalibrierung & Persistentes IndexedDB Analyse-Archiv
 * Läuft komplett lokal auf der Apple Silicon / M3 Pro GPU (MediaPipe PoseLandmarker • 0 AI Tokens).
 * Winkel-Konvention 1:1 kalibriert auf OSP Hessen / DLV Biomechanik (Rom 2024, Bochum 2026, Ehammer 2022).
 */
const VideoBiomechanicsModule = (() => {
  const DB_NAME = 'AthleticsVideoArchiveDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'analyses';

  let dbPromise = null;
  let calibrationProfile = null;
  let cachedArchive = [];
  let selectedBenchmarkId = 'dlv-luka-rom-2024';
  let archiveFilterType = 'ALL';
  let archiveSearch = '';
  let compareIdA = null;
  let compareIdB = null;
  let initialized = false;

  // Engine bridge state (populated by the ES module script inside index.html)
  const runtime = {
    getCurrentMetrics: null,
    getPhaseMarks: null,
    getAngleHistory: null,
    getCaptureThumbnail: null,
    loadSavedAnalysisToView: null
  };

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function dbGetAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbDelete(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadCalibration() {
    if (calibrationProfile) return calibrationProfile;
    try {
      const res = await fetch('./data/dlv_calibration_profile.json?t=' + Date.now());
      if (res.ok) {
        calibrationProfile = await res.json();
      }
    } catch (e) {
      console.warn('Could not load DLV calibration profile:', e);
    }
    return calibrationProfile;
  }

  function registerEngineBridge(bridge) {
    Object.assign(runtime, bridge);
  }

  function getSelectedBenchmark() {
    const bms = calibrationProfile?.benchmarks || [];
    return bms.find(b => b.id === selectedBenchmarkId) || bms[0] || null;
  }

  function computeSummaryFromState(phaseMarks, angleHistory) {
    const td = phaseMarks?.TD || null;
    const mkf = phaseMarks?.MKF || null;
    const to = phaseMarks?.TO || null;
    const hist = Array.isArray(angleHistory) ? angleHistory : [];

    // Minimum support knee flexion during contact window (or full clip if phases unset)
    const contactSlice = (td && to)
      ? hist.filter(p => p.t >= td.t - 0.01 && p.t <= to.t + 0.01)
      : hist;
    const kneeValues = contactSlice.map(p => p.leftKnee).filter(v => v > 40);
    const minSupportKnee = kneeValues.length ? Math.min(...kneeValues) : (mkf?.leftKnee ?? null);

    // Swing leg knee compactness during drive (min rightKnee around MKF..TO)
    const swingKnValues = contactSlice.map(p => p.rightKnee).filter(v => v > 25);
    const minSwingKnee = swingKnValues.length ? Math.min(...swingKnValues) : (to?.rightKnee ?? mkf?.rightKnee ?? null);

    // Peak swing thigh angular velocity [deg/s]
    const velValues = contactSlice.map(p => Math.abs(p.swingVelDegS || 0)).filter(v => v > 0 && v < 1800);
    const maxSwingVel = velValues.length ? Math.max(...velValues) : (to?.swingVelDegS || mkf?.swingVelDegS || null);

    const stemmTd = td?.dlvStemm ?? null;
    const rumpfTd = td?.dlvRumpf ?? null;
    const rumpfTo = to?.dlvRumpf ?? null;
    const rumpfRot = (rumpfTd !== null && rumpfTo !== null) ? Number((rumpfTd - rumpfTo).toFixed(1)) : null;
    const abflugTo = to?.takeoffAngle ?? null;
    const kontaktMs = (td && to) ? Math.round((to.t - td.t) * 1000) : null;

    return {
      stemmwinkel_deg: stemmTd !== null ? Number(stemmTd.toFixed(1)) : null,
      rumpfwinkel_td_deg: rumpfTd !== null ? Number(rumpfTd.toFixed(1)) : null,
      rumpfrotation_deg: rumpfRot,
      kniewinkel_min_deg: minSupportKnee !== null ? Number(minSupportKnee.toFixed(1)) : null,
      abflugwinkel_deg: abflugTo !== null ? Number(abflugTo.toFixed(1)) : null,
      schwungbein_deg_s: maxSwingVel !== null ? Math.round(maxSwingVel) : null,
      schwungbein_knie_kompakt_deg: minSwingKnee !== null ? Number(minSwingKnee.toFixed(1)) : null,
      kontaktzeit_ms: kontaktMs
    };
  }

  function statusClass(metricKey, val) {
    if (val === null || val === undefined || Number.isNaN(val)) return { cls: 'text-slate-400 border-slate-700', tag: '—' };
    const norm = calibrationProfile?.normbereich?.[metricKey];
    if (!norm) return { cls: 'text-cyan-300 border-slate-700', tag: 'Info' };
    if (val >= norm.min && val <= norm.max) return { cls: 'text-emerald-400 border-emerald-700/70 bg-emerald-950/30', tag: '✅ Norm' };
    const dist = val < norm.min ? (norm.min - val) : (val - norm.max);
    if (dist <= (norm.max - norm.min) * 0.25 + 2) return { cls: 'text-amber-300 border-amber-700/70 bg-amber-950/30', tag: '⚠️ Grenz' };
    return { cls: 'text-rose-400 border-rose-700/70 bg-rose-950/30', tag: '🔴 Fokus' };
  }

  function updateComparisonTable(phaseMarks, angleHistory) {
    const tbody = document.getElementById('dlvComparisonBody');
    const feedbackBox = document.getElementById('dlvAutoDiagnosisBox');
    if (!tbody) return;

    const summary = computeSummaryFromState(phaseMarks, angleHistory);
    const bm = getSelectedBenchmark();
    const norm = calibrationProfile?.normbereich || {};

    const rows = [
      { key: 'stemmwinkel_deg', label: 'Stemmwinkel TD (Auslage)', val: summary.stemmwinkel_deg, bm: bm?.stemmwinkel_deg, unit: '°', norm: '22 – 28°' },
      { key: 'rumpfwinkel_td_deg', label: 'Rumpfwinkel TD (>90° = Rücklage)', val: summary.rumpfwinkel_td_deg, bm: bm?.rumpfwinkel_td_deg, unit: '°', norm: '95 – 102°' },
      { key: 'rumpfrotation_deg', label: 'Rumpfrotation (TD → TO)', val: summary.rumpfrotation_deg, bm: bm?.rumpfrotation_deg, unit: '°', norm: '4 – 12°' },
      { key: 'kniewinkel_min_deg', label: 'Amortisation Stützbein-Knie min.', val: summary.kniewinkel_min_deg, bm: bm?.kniewinkel_min_deg, unit: '°', norm: '> 134°' },
      { key: 'schwungbein_knie_kompakt_deg', label: 'Schwungbein-Knie Kompaktheit', val: summary.schwungbein_knie_kompakt_deg, bm: bm?.schwungbein_knie_kompakt_deg, unit: '°', norm: '60 – 95° (eng)' },
      { key: 'schwungbein_deg_s', label: 'Schwungbein Geschwindigkeit max.', val: summary.schwungbein_deg_s, bm: bm?.schwungbein_deg_s, unit: '°/s', norm: '> 730 °/s' },
      { key: 'abflugwinkel_deg', label: 'Abflugwinkel (Take-off Vektor)', val: summary.abflugwinkel_deg, bm: bm?.abflugwinkel_deg, unit: '°', norm: '> 19,0°' },
      { key: 'kontaktzeit_ms', label: 'Bodenkontaktzeit (TD → TO)', val: summary.kontaktzeit_ms, bm: bm?.kontaktzeit_ms, unit: 'ms', norm: '100 – 125 ms' }
    ];

    tbody.innerHTML = rows.map(r => {
      const st = statusClass(r.key, r.val);
      const valStr = r.val !== null && r.val !== undefined ? `${r.val} ${r.unit}` : '—';
      const bmStr = r.bm !== null && r.bm !== undefined ? `${r.bm} ${r.unit}` : '—';
      let deltaHtml = '<span class="text-slate-500">—</span>';
      if (r.val !== null && r.bm !== null && r.bm !== undefined) {
        const d = Number((r.val - r.bm).toFixed(1));
        deltaHtml = `<span class="font-bold ${Math.abs(d) < 0.01 ? 'text-emerald-400' : 'text-cyan-300'}">${d > 0 ? '+' : ''}${d} ${r.unit}</span>`;
      }
      return `
        <tr class="border-b border-slate-800/80 text-xs font-mono">
          <td class="py-2 px-2 text-slate-200 font-sans font-semibold">${r.label}</td>
          <td class="py-2 px-2"><span class="px-2 py-0.5 rounded border ${st.cls} font-bold">${valStr}</span></td>
          <td class="py-2 px-2 text-amber-300 font-bold">${bmStr}</td>
          <td class="py-2 px-2">${deltaHtml}</td>
          <td class="py-2 px-2 text-slate-400">${r.norm}</td>
          <td class="py-2 px-2 text-right">${st.tag}</td>
        </tr>
      `;
    }).join('');

    if (feedbackBox) {
      const notes = [];
      if (summary.schwungbein_knie_kompakt_deg !== null) {
        if (summary.schwungbein_knie_kompakt_deg > 110) {
          notes.push(`🔴 <b>Schwungbein zu offen (${summary.schwungbein_knie_kompakt_deg}°):</b> Ferse beim Durchschwingen enger unter das Gesäß blockieren (Ziel ≤ 95°, wie Rom 88° / Ehammer 85°), sonst geht der Drehimpuls nach vorn verloren.`);
        } else if (summary.schwungbein_knie_kompakt_deg <= 95) {
          notes.push(`✅ <b>Schwungbein-Pendel kompakt (${summary.schwungbein_knie_kompakt_deg}°):</b> Perfekt im Zielkorridor (≤ 95°)!`);
        }
      }
      if (summary.rumpfrotation_deg !== null) {
        if (summary.rumpfrotation_deg > 12) {
          notes.push(`🔴 <b>Vorwärts-Überrotation (${summary.rumpfrotation_deg}°):</b> Rumpf kippt im Absprung zu stark vor (DLV-Norm 4–12°, Rom 3°). Mehr aufrechte Blockade ohne aktives Stemmen!`);
        } else {
          notes.push(`✅ <b>Rumpfrotation kontrolliert (${summary.rumpfrotation_deg}°):</b> Stabil im Absprung (Norm 4–12°).`);
        }
      }
      if (summary.rumpfwinkel_td_deg !== null && summary.rumpfwinkel_td_deg < 95) {
        notes.push(`⚠️ <b>Zu wenig Rücklage am Brett (${summary.rumpfwinkel_td_deg}° vs. Norm 95–102°):</b> Risiko für zu flachen Abflug / Vorrotation.`);
      }
      if (summary.kniewinkel_min_deg !== null && summary.kniewinkel_min_deg < 134) {
        notes.push(`⚠️ <b>Stützbein knickt ein (${summary.kniewinkel_min_deg}° vs. Norm >134°):</b> Reaktive Exzentrik / Hürden-Stiffnes beachten.`);
      }
      if (summary.schwungbein_deg_s !== null && summary.schwungbein_deg_s >= 730) {
        notes.push(`✅ <b>Explosives Schwungbein (${summary.schwungbein_deg_s} °/s):</b> Über DLV-Mindestnorm (> 730 °/s).`);
      }
      if (!notes.length) {
        notes.push('ℹ️ Lade ein Trainings- oder DLV-Video, spiele den Absprung ab und markiere <b>TD</b> + <b>MKF</b> + <b>TO</b> – dann berechnet das System deine exakte DLV-Kalibrierung.');
      }
      feedbackBox.innerHTML = notes.map(n => `<div>${n}</div>`).join('');
    }
  }

  function renderBenchmarkSelector() {
    const sel = document.getElementById('dlvBenchmarkSelect');
    if (!sel || !calibrationProfile) return;
    sel.innerHTML = (calibrationProfile.benchmarks || []).map(b =>
      `<option value="${b.id}" ${b.id === selectedBenchmarkId ? 'selected' : ''}>${b.label}</option>`
    ).join('');
  }

  async function refreshArchiveList() {
    try {
      cachedArchive = await dbGetAll();
    } catch (e) {
      console.error('IndexedDB load failed:', e);
      cachedArchive = [];
    }
    const countBadge = document.getElementById('videoArchiveCountBadge');
    if (countBadge) countBadge.textContent = `${cachedArchive.length} Analysen`;

    const listEl = document.getElementById('videoArchiveList');
    if (!listEl) return;

    const filtered = cachedArchive.filter(item => {
      if (archiveFilterType !== 'ALL' && item.type !== archiveFilterType) return false;
      if (archiveSearch) {
        const hay = `${item.title} ${item.date} ${item.notes} ${item.type}`.toLowerCase();
        if (!hay.includes(archiveSearch.toLowerCase())) return false;
      }
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 font-sans">
          Noch keine Video-Analysen im Archiv${archiveFilterType !== 'ALL' ? ` (Filter: ${archiveFilterType})` : ''}. Analysiere oben ein Video und klicke <b>„💾 Ins Archiv speichern“</b>!
        </div>
      `;
      renderSideBySideCompare();
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      const m = item.summary || {};
      const isA = compareIdA === item.id;
      const isB = compareIdB === item.id;
      return `
        <div class="bg-slate-950 border ${isA || isB ? 'border-cyan-500' : 'border-slate-800'} rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            ${item.thumbnail
              ? `<img src="${item.thumbnail}" alt="${item.title}" class="w-20 h-14 object-cover rounded-lg border border-slate-700 shrink-0" />`
              : `<div class="w-20 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">🎥</div>`
            }
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-bold text-white truncate">${item.title || 'Unbenannter Sprung'}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">${item.type || 'Training'}</span>
                ${item.mark_m ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-700">${item.mark_m} m</span>` : ''}
                <span class="text-[10px] font-mono text-slate-400">${item.date || ''}</span>
              </div>
              <div class="flex flex-wrap gap-2 text-[10px] font-mono text-slate-300">
                <span>Stemm: <b class="text-cyan-300">${m.stemmwinkel_deg ?? '—'}°</b></span>
                <span>Rumpf TD: <b class="text-amber-300">${m.rumpfwinkel_td_deg ?? '—'}°</b></span>
                <span>Knie min: <b class="text-emerald-300">${m.kniewinkel_min_deg ?? '—'}°</b></span>
                <span>Schwung: <b class="text-sky-300">${m.schwungbein_knie_kompakt_deg ?? '—'}°</b> (${m.schwungbein_deg_s ?? '—'} °/s)</span>
                <span>Kontakt: <b>${m.kontaktzeit_ms ?? '—'} ms</b></span>
              </div>
              ${item.notes ? `<div class="text-[11px] text-slate-400 font-sans truncate max-w-2xl">${item.notes}</div>` : ''}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 shrink-0 font-mono text-[10px]">
            <button onclick="VideoBiomechanicsModule.loadFromArchive('${item.id}')" class="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black transition-all">📂 Laden</button>
            <button onclick="VideoBiomechanicsModule.setCompareSlot('A','${item.id}')" class="px-2 py-1 rounded border ${isA ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'}">A</button>
            <button onclick="VideoBiomechanicsModule.setCompareSlot('B','${item.id}')" class="px-2 py-1 rounded border ${isB ? 'bg-purple-500 text-white border-purple-400 font-black' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-purple-400'}">B</button>
            <button onclick="VideoBiomechanicsModule.deleteFromArchive('${item.id}')" class="px-2 py-1 rounded bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-800 hover:border-rose-700">🗑</button>
          </div>
        </div>
      `;
    }).join('');
    renderSideBySideCompare();
  }

  function renderSideBySideCompare() {
    const box = document.getElementById('videoArchiveCompareBox');
    if (!box) return;
    const itemA = cachedArchive.find(x => x.id === compareIdA);
    const itemB = cachedArchive.find(x => x.id === compareIdB);
    if (!itemA || !itemB) {
      box.innerHTML = `<div class="text-[11px] text-slate-400 font-mono">Wähle oben im Archiv zwei Sprünge über <b>[A]</b> und <b>[B]</b> für einen direkten Parameter-Vergleich (z. B. Training vs. DLV-Video).</div>`;
      return;
    }
    const keys = [
      ['Stemmwinkel TD', 'stemmwinkel_deg', '°'],
      ['Rumpfwinkel TD', 'rumpfwinkel_td_deg', '°'],
      ['Rumpfrotation', 'rumpfrotation_deg', '°'],
      ['Stützbein min.', 'kniewinkel_min_deg', '°'],
      ['Schwungbein-Knie', 'schwungbein_knie_kompakt_deg', '°'],
      ['Schwungbein ω', 'schwungbein_deg_s', '°/s'],
      ['Abflugwinkel', 'abflugwinkel_deg', '°'],
      ['Kontaktzeit', 'kontaktzeit_ms', 'ms']
    ];
    box.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse font-mono text-[11px]">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400">
              <th class="py-1.5 px-2">Parameter</th>
              <th class="py-1.5 px-2 text-amber-300">🅰️ ${itemA.title} (${itemA.date})</th>
              <th class="py-1.5 px-2 text-purple-300">🅱️ ${itemB.title} (${itemB.date})</th>
              <th class="py-1.5 px-2">Δ (B − A)</th>
            </tr>
          </thead>
          <tbody>
            ${keys.map(([lbl, k, u]) => {
              const a = itemA.summary?.[k];
              const b = itemB.summary?.[k];
              const delta = (a !== null && a !== undefined && b !== null && b !== undefined)
                ? `${(b - a) > 0 ? '+' : ''}${Number((b - a).toFixed(1))} ${u}`
                : '—';
              return `
                <tr class="border-b border-slate-800/60">
                  <td class="py-1.5 px-2 text-slate-300 font-sans">${lbl}</td>
                  <td class="py-1.5 px-2 font-bold text-white">${a ?? '—'} ${a !== null && a !== undefined ? u : ''}</td>
                  <td class="py-1.5 px-2 font-bold text-white">${b ?? '—'} ${b !== null && b !== undefined ? u : ''}</td>
                  <td class="py-1.5 px-2 font-bold text-cyan-300">${delta}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function saveCurrentToArchive() {
    const titleEl = document.getElementById('archiveTitleInput');
    const dateEl = document.getElementById('archiveDateInput');
    const typeEl = document.getElementById('archiveTypeSelect');
    const markEl = document.getElementById('archiveMarkInput');
    const notesEl = document.getElementById('archiveNotesInput');
    const fpsEl = document.getElementById('bioFpsSelect');
    const dirEl = document.getElementById('bioRunDirSelect');

    const phaseMarks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const angleHistory = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    if ((!angleHistory || angleHistory.length === 0) && !phaseMarks.TD && !phaseMarks.TO) {
      alert('Bitte zuerst ein Video abspielen/analysieren (oder Phasen TD/MKF/TO markieren), bevor du speicherst.');
      return;
    }

    const summary = computeSummaryFromState(phaseMarks, angleHistory);
    const thumbnail = runtime.getCaptureThumbnail ? runtime.getCaptureThumbnail() : null;

    const record = {
      id: 'vid-' + Date.now(),
      createdAt: new Date().toISOString(),
      title: (titleEl?.value || '').trim() || `Analyse ${new Date().toLocaleDateString('de-DE')}`,
      date: dateEl?.value || new Date().toISOString().slice(0, 10),
      type: typeEl?.value || 'Training Sprung',
      mark_m: (markEl?.value || '').trim() || null,
      notes: (notesEl?.value || '').trim(),
      fps: parseFloat(fpsEl?.value || '120'),
      runDirection: dirEl?.value || 'ltr',
      phaseMarks,
      summary,
      angleHistory: (angleHistory || []).slice(-600),
      thumbnail
    };

    await dbPut(record);
    if (titleEl) titleEl.value = '';
    if (markEl) markEl.value = '';
    if (notesEl) notesEl.value = '';
    await refreshArchiveList();
    const btn = document.getElementById('saveArchiveBtn');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✅ Gespeichert!';
      setTimeout(() => { btn.textContent = old; }, 1800);
    }
  }

  async function loadFromArchive(id) {
    const item = cachedArchive.find(x => x.id === id);
    if (!item) return;
    if (runtime.loadSavedAnalysisToView) {
      runtime.loadSavedAnalysisToView(item);
    }
    updateComparisonTable(item.phaseMarks || {}, item.angleHistory || []);
  }

  async function deleteFromArchive(id) {
    if (!confirm('Diese Video-Analyse dauerhaft aus dem lokalen Archiv löschen?')) return;
    await dbDelete(id);
    if (compareIdA === id) compareIdA = null;
    if (compareIdB === id) compareIdB = null;
    await refreshArchiveList();
  }

  function setCompareSlot(slot, id) {
    if (slot === 'A') compareIdA = (compareIdA === id) ? null : id;
    if (slot === 'B') compareIdB = (compareIdB === id) ? null : id;
    refreshArchiveList();
  }

  function exportArchiveJson() {
    const payload = {
      exported_at: new Date().toISOString(),
      app: 'Athletics Intelligence Video Archive (M3 Pro GPU)',
      count: cachedArchive.length,
      analyses: cachedArchive
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Luka_Video_Biomechanik_Archiv_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  async function importArchiveJson(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed.analyses || []);
      let imported = 0;
      for (const rec of list) {
        if (rec && rec.id) {
          await dbPut(rec);
          imported++;
        }
      }
      await refreshArchiveList();
      alert(`✅ ${imported} Video-Analysen erfolgreich ins lokale Archiv importiert!`);
    } catch (e) {
      alert('Fehler beim JSON-Import: ' + e.message);
    }
  }

  async function render() {
    await loadCalibration();
    if (!initialized) {
      initialized = true;
      const dEl = document.getElementById('archiveDateInput');
      if (dEl && !dEl.value) dEl.value = new Date().toISOString().slice(0, 10);
      renderBenchmarkSelector();
    }
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    await refreshArchiveList();
  }

  return {
    render,
    registerEngineBridge,
    updateComparisonTable,
    onBenchmarkChange: (id) => {
      selectedBenchmarkId = id;
      const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
      const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
      updateComparisonTable(marks, hist);
    },
    setArchiveFilter: (t) => { archiveFilterType = t; refreshArchiveList(); },
    setArchiveSearch: (q) => { archiveSearch = q; refreshArchiveList(); },
    saveCurrentToArchive,
    loadFromArchive,
    deleteFromArchive,
    setCompareSlot,
    exportArchiveJson,
    importArchiveJson
  };
})();
window.VideoBiomechanicsModule = VideoBiomechanicsModule;
