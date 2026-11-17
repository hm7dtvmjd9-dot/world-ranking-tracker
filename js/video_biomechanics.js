/**
 * Video-Biomechanik, DLV Ground-Truth Modell-Kalibrierung & Persistentes IndexedDB Analyse-Archiv
 * Läuft komplett lokal auf der Apple Silicon / M3 Pro GPU (MediaPipe PoseLandmarker • 0 AI Tokens).
 * Paart offizielle DLV-Diagnostik-PDF-Zeilen (Datum / Versuch) 1:1 mit dem zugehörigen Video (wm...mp4)
 * und kalibriert per-Metrik Offsets so, dass nachfolgende Trainingssprünge auf exakt derselben DLV-Skala landen.
 */
const VideoBiomechanicsModule = (() => {
  const DB_NAME = 'AthleticsVideoArchiveDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'analyses';
  const CAL_STORAGE_KEY = 'luka_dlv_calibration_pairs_v1';
  const CAL_ENABLED_KEY = 'luka_dlv_calibration_enabled_v1';

  const CALIBRATABLE_KEYS = [
    'stemmwinkel_deg',
    'rumpfwinkel_td_deg',
    'rumpfrotation_deg',
    'kniewinkel_min_deg',
    'abflugwinkel_deg',
    'schwungbein_deg_s'
  ];

  let dbPromise = null;
  let calibrationProfile = null;
  let cachedArchive = [];
  let selectedTrialId = 'herden-2026-07-25-v5';
  let archiveFilterType = 'ALL';
  let archiveSearch = '';
  let compareIdA = null;
  let compareIdB = null;
  let initialized = false;
  let currentVideoFilename = '';

  const runtime = {
    getCurrentMetrics: null,
    getPhaseMarks: null,
    getAngleHistory: null,
    getCaptureThumbnail: null,
    loadSavedAnalysisToView: null,
    onCalibrationChange: null
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

  function getCalibrationPairs() {
    try {
      const raw = localStorage.getItem(CAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCalibrationPairs(pairs) {
    try {
      localStorage.setItem(CAL_STORAGE_KEY, JSON.stringify(pairs));
    } catch (e) {}
  }

  function isCalibrationEnabled() {
    try {
      const val = localStorage.getItem(CAL_ENABLED_KEY);
      return val === null ? true : val === 'true';
    } catch (e) {
      return true;
    }
  }

  function setCalibrationEnabled(flag) {
    try {
      localStorage.setItem(CAL_ENABLED_KEY, flag ? 'true' : 'false');
    } catch (e) {}
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    if (runtime.onCalibrationChange) runtime.onCalibrationChange(getActiveOffsets());
    renderCalibrationModelPanel();
  }

  function computeOffsetsFromPairs(pairs) {
    const offsets = {};
    const counts = {};
    CALIBRATABLE_KEYS.forEach(k => {
      const deltas = [];
      (pairs || []).forEach(p => {
        const rawVal = p.rawSummary?.[k];
        const gtVal = p.groundTruth?.[k];
        if (typeof rawVal === 'number' && !Number.isNaN(rawVal) && typeof gtVal === 'number' && !Number.isNaN(gtVal)) {
          deltas.push(gtVal - rawVal);
        }
      });
      if (deltas.length > 0) {
        const avg = deltas.reduce((s, x) => s + x, 0) / deltas.length;
        offsets[k] = Number(avg.toFixed(2));
        counts[k] = deltas.length;
      } else {
        offsets[k] = 0;
        counts[k] = 0;
      }
    });
    return { offsets, counts };
  }

  function getActiveOffsets() {
    const pairs = getCalibrationPairs();
    if (!isCalibrationEnabled() || pairs.length === 0) {
      const zero = {};
      CALIBRATABLE_KEYS.forEach(k => { zero[k] = 0; });
      return zero;
    }
    return computeOffsetsFromPairs(pairs).offsets;
  }

  function applyCalibrationToScalar(metricKey, rawVal) {
    if (rawVal === null || rawVal === undefined || Number.isNaN(rawVal)) return rawVal;
    const off = getActiveOffsets()[metricKey] || 0;
    return Number((rawVal + off).toFixed(1));
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
    if (runtime.onCalibrationChange) runtime.onCalibrationChange(getActiveOffsets());
  }

  function getAllReferenceTrials() {
    const paired = calibrationProfile?.paired_trials || [];
    if (paired.length > 0) return paired;
    return calibrationProfile?.benchmarks || [];
  }

  function getSelectedBenchmark() {
    const list = getAllReferenceTrials();
    return list.find(b => b.id === selectedTrialId) || list[0] || null;
  }

  function autoDetectTrialByFilename(filename) {
    currentVideoFilename = filename || '';
    if (!filename || !calibrationProfile) return null;
    const low = filename.toLowerCase();
    const list = getAllReferenceTrials();
    const match = list.find(t => {
      const rec = t.video_match?.recommended_video?.toLowerCase();
      if (rec && rec === low) return true;
      const all = t.video_match?.all_attempt_videos || [];
      return all.some(a => a.toLowerCase() === low);
    });
    if (match) {
      selectedTrialId = match.id;
      const sel = document.getElementById('dlvBenchmarkSelect');
      if (sel) sel.value = match.id;
      const titleEl = document.getElementById('archiveTitleInput');
      const dateEl = document.getElementById('archiveDateInput');
      const typeEl = document.getElementById('archiveTypeSelect');
      const markEl = document.getElementById('archiveMarkInput');
      if (titleEl && !titleEl.value) titleEl.value = `${match.display_ref} (${filename})`;
      if (dateEl && match.date) dateEl.value = match.date;
      if (typeEl) typeEl.value = 'DLV-Video Vergleich';
      if (markEl && match.offiziell_m) markEl.value = String(match.offiziell_m);
      renderSelectedTrialHint();
      const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
      const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
      updateComparisonTable(marks, hist);
    } else {
      renderSelectedTrialHint();
    }
    return match || null;
  }

  function renderSelectedTrialHint() {
    const hintEl = document.getElementById('dlvMatchedVideoHint');
    if (!hintEl) return;
    const bm = getSelectedBenchmark();
    if (!bm) {
      hintEl.innerHTML = '';
      return;
    }
    const vm = bm.video_match;
    const isMatched = Boolean(
      currentVideoFilename &&
      vm &&
      ((vm.recommended_video || '').toLowerCase() === currentVideoFilename.toLowerCase() ||
        (vm.all_attempt_videos || []).some(v => v.toLowerCase() === currentVideoFilename.toLowerCase()))
    );
    hintEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-slate-950 border ${isMatched ? 'border-emerald-500/70' : 'border-slate-800'} rounded-lg px-3 py-2">
        <div class="space-y-0.5">
          <div>
            <span class="${isMatched ? 'text-emerald-400 font-black' : 'text-amber-300 font-bold'}">
              ${isMatched ? '✅ 1:1 VIDEO-PAAR ERKANNT:' : '🎬 Passendes DLV-Video auf deinem Mac:'}
            </span>
            <code class="text-cyan-300 ml-1">${vm?.local_path_hint || 'Manuelle Zuordnung'}</code>
          </div>
          <div class="text-[10px] text-slate-400">
            PDF Ground-Truth: <b class="text-white">${bm.display_ref || bm.date}</b> • ${bm.color_role || 'DLV-Referenz'} • Quelle: <span class="text-slate-300">${bm.source_pdf || 'DLV Weit PDF'}</span>
          </div>
        </div>
        <button onclick="VideoBiomechanicsModule.saveCalibrationPairFromCurrent()" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 shadow">
          🎯 Auf diesen DLV-Sprung kalibrieren
        </button>
      </div>
    `;
  }

  function computeRawSummaryFromState(phaseMarks, angleHistory) {
    const td = phaseMarks?.TD || null;
    const mkf = phaseMarks?.MKF || null;
    const to = phaseMarks?.TO || null;
    const hist = Array.isArray(angleHistory) ? angleHistory : [];

    const contactSlice = (td && to)
      ? hist.filter(p => p.t >= td.t - 0.01 && p.t <= to.t + 0.01)
      : hist;
    const kneeValues = contactSlice.map(p => p.leftKnee).filter(v => v > 40);
    const minSupportKnee = kneeValues.length ? Math.min(...kneeValues) : (mkf?.leftKnee ?? null);

    const swingKnValues = contactSlice.map(p => p.rightKnee).filter(v => v > 25);
    const minSwingKnee = swingKnValues.length ? Math.min(...swingKnValues) : (to?.rightKnee ?? mkf?.rightKnee ?? null);

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

  function computeSummaryFromState(phaseMarks, angleHistory) {
    const raw = computeRawSummaryFromState(phaseMarks, angleHistory);
    const cal = { ...raw };
    CALIBRATABLE_KEYS.forEach(k => {
      if (raw[k] !== null && raw[k] !== undefined) {
        cal[k] = applyCalibrationToScalar(k, raw[k]);
      }
    });
    return cal;
  }

  function saveCalibrationPairFromCurrent() {
    const bm = getSelectedBenchmark();
    if (!bm) return;
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    const raw = computeRawSummaryFromState(marks, hist);
    if (!marks.TD || !marks.TO) {
      alert('Bitte zuerst Touchdown (TD), Max. Beugung (MKF) und Take-off (TO) im geladenen DLV-Video markieren, damit exakt dieser Sprung gegen die DLV-Zeile kalibriert werden kann.');
      return;
    }

    const pairs = getCalibrationPairs().filter(p => p.trialId !== bm.id);
    const gt = {};
    CALIBRATABLE_KEYS.forEach(k => {
      if (bm[k] !== null && bm[k] !== undefined) gt[k] = Number(bm[k]);
    });

    pairs.unshift({
      trialId: bm.id,
      label: bm.label,
      display_ref: bm.display_ref || bm.date,
      videoFilename: currentVideoFilename || bm.video_match?.recommended_video || 'manuell',
      calibratedAt: new Date().toISOString(),
      rawSummary: raw,
      groundTruth: gt
    });
    saveCalibrationPairs(pairs);
    try { localStorage.setItem(CAL_ENABLED_KEY, 'true'); } catch (e) {}

    updateComparisonTable(marks, hist);
    if (runtime.onCalibrationChange) runtime.onCalibrationChange(getActiveOffsets());
    renderCalibrationModelPanel();
  }

  function removeCalibrationPair(trialId) {
    const pairs = getCalibrationPairs().filter(p => p.trialId !== trialId);
    saveCalibrationPairs(pairs);
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    if (runtime.onCalibrationChange) runtime.onCalibrationChange(getActiveOffsets());
    renderCalibrationModelPanel();
  }

  function renderCalibrationModelPanel() {
    const box = document.getElementById('dlvCalibrationModelBox');
    if (!box) return;
    const pairs = getCalibrationPairs();
    const enabled = isCalibrationEnabled();
    const { offsets, counts } = computeOffsetsFromPairs(pairs);

    if (pairs.length === 0) {
      box.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span class="font-bold text-amber-300 font-mono">🔬 Noch keine DLV-Video-Kalibrierungs-Paare hinterlegt (Roh-Modell aktiv).</span>
            <p class="text-[11px] text-slate-400 mt-0.5">
              So kalibrierst du exakt auf DLV-Niveau: Wähle rechts einen DLV-Versuch (z. B. <b>25.07.2026 / Versuch 5 Bochum</b>), lade rechts oben das angezeigte <code>wm...mp4</code>-Video, markiere <b>TD → MKF → TO</b> und klicke <b>„🎯 Auf diesen DLV-Sprung kalibrieren“</b>.
            </p>
          </div>
        </div>
      `;
      return;
    }

    const offsetBadges = [
      ['Stemm', 'stemmwinkel_deg', '°'],
      ['Rumpf TD', 'rumpfwinkel_td_deg', '°'],
      ['Rumpfrot.', 'rumpfrotation_deg', '°'],
      ['Knie min', 'kniewinkel_min_deg', '°'],
      ['Abflug', 'abflugwinkel_deg', '°'],
      ['Schwung ω', 'schwungbein_deg_s', '°/s']
    ].map(([lbl, k, u]) => {
      const off = offsets[k] || 0;
      const col = Math.abs(off) < 0.5 ? 'text-emerald-400' : 'text-cyan-300';
      return `<span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">${lbl}: <b class="${col}">${off >= 0 ? '+' : ''}${off}${u}</b> <span class="text-slate-500">(n=${counts[k]})</span></span>`;
    }).join(' ');

    const pairsHtml = pairs.map(p => {
      const errs = CALIBRATABLE_KEYS.map(k => {
        const r = p.rawSummary?.[k];
        const gt = p.groundTruth?.[k];
        const cal = (typeof r === 'number') ? (r + (offsets[k] || 0)) : null;
        if (typeof r !== 'number' || typeof gt !== 'number') return null;
        return { k, rawErr: Math.abs(gt - r), calErr: Math.abs(gt - cal) };
      }).filter(Boolean);
      const maeRaw = errs.length ? (errs.filter(e => e.k !== 'schwungbein_deg_s').reduce((s, e) => s + e.rawErr, 0) / Math.max(1, errs.filter(e => e.k !== 'schwungbein_deg_s').length)) : null;
      const maeCal = errs.length ? (errs.filter(e => e.k !== 'schwungbein_deg_s').reduce((s, e) => s + e.calErr, 0) / Math.max(1, errs.filter(e => e.k !== 'schwungbein_deg_s').length)) : null;
      return `
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono">
          <div>
            <strong class="text-white">${p.display_ref}</strong>
            <span class="text-cyan-300 ml-1">(${p.videoFilename})</span>
            ${maeRaw !== null ? `<span class="text-slate-400 ml-2">Winkel-MAE: Roh ${maeRaw.toFixed(1)}° ➔ Kalibriert <b class="text-emerald-400">${maeCal.toFixed(1)}°</b></span>` : ''}
          </div>
          <button onclick="VideoBiomechanicsModule.removeCalibrationPair('${p.trialId}')" class="text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">✕ Entfernen</button>
        </div>
      `;
    }).join('');

    box.innerHTML = `
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black ${enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">
              ${enabled ? `✅ DLV-KALIBRIERUNG AKTIV (${pairs.length} Referenz-Sprünge)` : '⏸️ DLV-Kalibrierung pausiert (Rohwerte)'}
            </span>
            <label class="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-300 cursor-pointer">
              <input type="checkbox" ${enabled ? 'checked' : ''} onchange="VideoBiomechanicsModule.setCalibrationEnabled(this.checked)" class="rounded bg-slate-900 border-slate-700 text-emerald-500">
              <span>Kalibrierte DLV-Skala auf Trainingssprünge anwenden</span>
            </label>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 text-[10px] font-mono">${offsetBadges}</div>
        <div class="space-y-1">${pairsHtml}</div>
      </div>
    `;
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

    const rawSummary = computeRawSummaryFromState(phaseMarks, angleHistory);
    const summary = computeSummaryFromState(phaseMarks, angleHistory);
    const offsets = getActiveOffsets();
    const calActive = isCalibrationEnabled() && getCalibrationPairs().length > 0;
    const bm = getSelectedBenchmark();

    const rows = [
      { key: 'stemmwinkel_deg', label: 'Stemmwinkel TD (Auslage)', raw: rawSummary.stemmwinkel_deg, val: summary.stemmwinkel_deg, bm: bm?.stemmwinkel_deg, unit: '°', norm: '22 – 28°' },
      { key: 'rumpfwinkel_td_deg', label: 'Rumpfwinkel TD (>90° = Rücklage)', raw: rawSummary.rumpfwinkel_td_deg, val: summary.rumpfwinkel_td_deg, bm: bm?.rumpfwinkel_td_deg, unit: '°', norm: '95 – 102°' },
      { key: 'rumpfrotation_deg', label: 'Rumpfrotation (TD → TO)', raw: rawSummary.rumpfrotation_deg, val: summary.rumpfrotation_deg, bm: bm?.rumpfrotation_deg, unit: '°', norm: '4 – 12°' },
      { key: 'kniewinkel_min_deg', label: 'Amortisation Stützbein-Knie min.', raw: rawSummary.kniewinkel_min_deg, val: summary.kniewinkel_min_deg, bm: bm?.kniewinkel_min_deg, unit: '°', norm: '> 134°' },
      { key: 'schwungbein_knie_kompakt_deg', label: 'Schwungbein-Knie Kompaktheit', raw: rawSummary.schwungbein_knie_kompakt_deg, val: summary.schwungbein_knie_kompakt_deg, bm: bm?.schwungbein_knie_kompakt_deg ?? 88, unit: '°', norm: '60 – 95° (eng)' },
      { key: 'schwungbein_deg_s', label: 'Schwungbein Geschwindigkeit max.', raw: rawSummary.schwungbein_deg_s, val: summary.schwungbein_deg_s, bm: bm?.schwungbein_deg_s, unit: '°/s', norm: '> 730 °/s' },
      { key: 'abflugwinkel_deg', label: 'Abflugwinkel (Take-off Vektor)', raw: rawSummary.abflugwinkel_deg, val: summary.abflugwinkel_deg, bm: bm?.abflugwinkel_deg, unit: '°', norm: '> 19,0°' },
      { key: 'kontaktzeit_ms', label: 'Bodenkontaktzeit (TD → TO)', raw: rawSummary.kontaktzeit_ms, val: summary.kontaktzeit_ms, bm: bm?.kontaktzeit_ms ?? 112, unit: 'ms', norm: '100 – 125 ms' }
    ];

    tbody.innerHTML = rows.map(r => {
      const st = statusClass(r.key, r.val);
      const valStr = r.val !== null && r.val !== undefined ? `${r.val} ${r.unit}` : '—';
      const hasOffset = calActive && (offsets[r.key] || 0) !== 0 && r.raw !== null;
      const rawHint = hasOffset ? ` <span class="text-[9px] text-slate-500">(Roh: ${r.raw})</span>` : '';
      const bmStr = r.bm !== null && r.bm !== undefined ? `${r.bm} ${r.unit}` : '—';
      let deltaHtml = '<span class="text-slate-500">—</span>';
      if (r.val !== null && r.bm !== null && r.bm !== undefined) {
        const d = Number((r.val - r.bm).toFixed(1));
        deltaHtml = `<span class="font-bold ${Math.abs(d) < 0.01 ? 'text-emerald-400' : 'text-cyan-300'}">${d > 0 ? '+' : ''}${d} ${r.unit}</span>`;
      }
      return `
        <tr class="border-b border-slate-800/80 text-xs font-mono">
          <td class="py-2 px-2 text-slate-200 font-sans font-semibold">${r.label}</td>
          <td class="py-2 px-2"><span class="px-2 py-0.5 rounded border ${st.cls} font-bold">${valStr}</span>${rawHint}</td>
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
        notes.push(`⚠️ <b>Stützbein knickt ein (${summary.kniewinkel_min_deg}° vs. Norm >134°):</b> Reaktive Exzentrik / Hürden-Stiffness beachten.`);
      }
      if (summary.schwungbein_deg_s !== null && summary.schwungbein_deg_s >= 730) {
        notes.push(`✅ <b>Explosives Schwungbein (${summary.schwungbein_deg_s} °/s):</b> Über DLV-Mindestnorm (> 730 °/s).`);
      }
      if (!notes.length) {
        notes.push('ℹ️ Lade ein DLV-Video (oder Trainingssprung), spiele den Absprung ab und markiere <b>TD</b> + <b>MKF</b> + <b>TO</b> – dann berechnet das System die DLV-Werte & Kalibrierung.');
      }
      feedbackBox.innerHTML = notes.map(n => `<div>${n}</div>`).join('');
    }
  }

  function renderBenchmarkSelector() {
    const sel = document.getElementById('dlvBenchmarkSelect');
    if (!sel || !calibrationProfile) return;
    const list = getAllReferenceTrials();
    if (!list.find(x => x.id === selectedTrialId) && list[0]) {
      selectedTrialId = list[0].id;
    }
    sel.innerHTML = list.map(b =>
      `<option value="${b.id}" ${b.id === selectedTrialId ? 'selected' : ''}>${b.label}</option>`
    ).join('');
    renderSelectedTrialHint();
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
          Noch keine Video-Analysen im Archiv${archiveFilterType !== 'ALL' ? ` (Filter: ${archiveFilterType})` : ''}. Analysiere oben ein Video und klicke <b>„💾 Speichern“</b>!
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
                ${item.calibrated ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700">DLV-kalibriert</span>` : ''}
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

    const rawSummary = computeRawSummaryFromState(phaseMarks, angleHistory);
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
      calibrated: isCalibrationEnabled() && getCalibrationPairs().length > 0,
      phaseMarks,
      rawSummary,
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
      app: 'Athletics Intelligence Video Archive & DLV Calibration (M3 Pro GPU)',
      calibration_enabled: isCalibrationEnabled(),
      calibration_pairs: getCalibrationPairs(),
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
      if (!Array.isArray(parsed) && Array.isArray(parsed.calibration_pairs) && parsed.calibration_pairs.length > 0) {
        saveCalibrationPairs(parsed.calibration_pairs);
      }
      await refreshArchiveList();
      renderCalibrationModelPanel();
      alert(`✅ ${imported} Video-Analysen (+ Kalibrierungs-Paare) erfolgreich importiert!`);
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
    renderCalibrationModelPanel();
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    await refreshArchiveList();
  }

  return {
    render,
    registerEngineBridge,
    autoDetectTrialByFilename,
    updateComparisonTable,
    getActiveOffsets,
    saveCalibrationPairFromCurrent,
    removeCalibrationPair,
    setCalibrationEnabled,
    onBenchmarkChange: (id) => {
      selectedTrialId = id;
      renderSelectedTrialHint();
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
