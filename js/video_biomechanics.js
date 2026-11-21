/**
 * Video-Biomechanik, vollständiges OSP/DLV-Modell & Persistentes IndexedDB Analyse-Archiv
 * Läuft komplett lokal auf Apple Silicon / M3 Pro GPU (MediaPipe PoseLandmarker • 0 AI Tokens).
 * Schema 1:1 kalibriert auf OSP Hessen / DLV Weitsprung-Diagnostik (Info 1–6 & Bochum 25.07.2026).
 */
const VideoBiomechanicsModule = (() => {
  const DB_NAME = 'AthleticsVideoArchiveDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'analyses';
  const CAL_STORAGE_KEY = 'luka_dlv_calibration_pairs_v2';
  const CAL_ENABLED_KEY = 'luka_dlv_calibration_enabled_v1';
  const GH_SYNC_TOKEN_KEY = 'luka_gh_triage_pat_v1';
  const VIDEO_SYNC_API = 'https://api.github.com/repos/hm7dtvmjd9-dot/world-ranking-tracker/contents/data/video_biomechanics_sync.json';
  const VIDEO_SYNC_RAW = 'https://raw.githubusercontent.com/hm7dtvmjd9-dot/world-ranking-tracker/main/data/video_biomechanics_sync.json';
  const DELETED_IDS_KEY = 'luka_video_deleted_ids_v1';
  let videoAutoPushTimer = null;
  let lastVideoSyncNote = '';

  const CALIBRATABLE_KEYS = [
    'stemmwinkel_deg',
    'rumpfwinkel_td_deg',
    'rumpfrotation_deg',
    'kniewinkel_min_deg',
    'abflugwinkel_deg',
    'schwungbein_winkel_deg',
    'schwungbein_deg_s',
    'lande_rumpfwinkel_deg',
    'lande_kniewinkel_deg',
    'lande_hueftwinkel_deg'
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
    getPhaseSnaps: null,
    getAngleHistory: null,
    getCaptureThumbnail: null,
    getVideoScaleInfo: null,
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
    const vmeta = vm?.video_meta;
    const isMatched = Boolean(
      currentVideoFilename &&
      vm &&
      ((vm.recommended_video || '').toLowerCase() === currentVideoFilename.toLowerCase() ||
        (vm.all_attempt_videos || []).some(v => v.toLowerCase() === currentVideoFilename.toLowerCase()))
    );
    const metaHint = vmeta
      ? ` • Container ${vmeta.container_fps}fps / Kamera ~${vmeta.suggested_camera_fps}fps (${vmeta.frames}F)`
      : '';
    hintEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-slate-950 border ${isMatched ? 'border-emerald-500/70' : 'border-slate-800'} rounded-lg px-3 py-2">
        <div class="space-y-0.5">
          <div>
            <span class="${isMatched ? 'text-emerald-400 font-black' : 'text-amber-300 font-bold'}">
              ${isMatched ? '✅ 1:1 VIDEO-PAAR ERKANNT:' : '🎬 Passendes DLV-Video auf deinem Mac:'}
            </span>
            <code class="text-cyan-300 ml-1">${vm?.local_path_hint || 'Manuelle Zuordnung'}</code><span class="text-slate-400">${metaHint}</span>
          </div>
          <div class="text-[10px] text-slate-400">
            PDF Ground-Truth: <b class="text-white">${bm.display_ref || bm.date}</b> • Offiziell <b>${bm.offiziell_m ?? '—'}m</b> / Eff. <b>${bm.effektiv_m ?? '—'}m</b> / Erw. <b>${bm.erwartet_m ?? '—'}m</b> • Quelle: <span class="text-slate-300">${bm.source_pdf || 'DLV Weit PDF'}</span>
          </div>
        </div>
        <button onclick="VideoBiomechanicsModule.saveCalibrationPairFromCurrent()" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 shadow">
          🎯 Auf diesen DLV-Sprung kalibrieren
        </button>
      </div>
    `;
  }

  function computeRawSummaryFromState(phaseMarks, angleHistory) {
    const m2L = phaseMarks?.['2L'] || null;
    const m1L = phaseMarks?.['1L'] || null;
    const td = phaseMarks?.TD || null;
    const mkf = phaseMarks?.MKF || null;
    const to = phaseMarks?.TO || null;
    const land = phaseMarks?.LAND || null;
    const hist = Array.isArray(angleHistory) ? angleHistory : [];
    const scaleInfo = runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : { pxPerMeter: null, timeScale: 1, fpsKnown: false };
    const tScale = scaleInfo.timeScale || 1;

    const contactSlice = (td && to)
      ? hist.filter(p => p.t >= td.t - 0.01 && p.t <= to.t + 0.01)
      : hist;

    const kneeValues = contactSlice.map(p => p.leftKnee).filter(v => v > 40);
    const minSupportKnee = kneeValues.length ? Math.min(...kneeValues) : (mkf?.leftKnee ?? null);

    // Bonus metric (separately tracked from OSP swing thigh angle!)
    const swingKnValues = contactSlice.map(p => p.rightKnee).filter(v => v > 25);
    const minSwingKnee = swingKnValues.length ? Math.min(...swingKnValues) : (to?.rightKnee ?? mkf?.rightKnee ?? null);

    const stemmTd = td?.dlvStemm ?? null;
    const rumpfTd = td?.dlvRumpf ?? null;
    const rumpfTo = to?.dlvRumpf ?? null;
    const rumpfRot = (rumpfTd !== null && rumpfTo !== null) ? Number((rumpfTd - rumpfTo).toFixed(1)) : null;

    // OSP Info 3: Swing thigh angle relative to horizontal at TO (e.g. -4° when just below horizontal, +° when above)
    const swingThighDeg = to?.swingThighHorizDeg ?? null;

    // Real-time contact duration using container-to-camera timeScale!
    const realContactSec = (td && to && scaleInfo.fpsKnown) ? (to.t - td.t) * tScale : null;
    const kontaktMs = (realContactSec !== null && realContactSec > 0.02 && realContactSec < 0.6)
      ? Math.round(realContactSec * 1000)
      : null;

    // OSP Definition: Mean angular velocity of swing thigh across takeoff movement (TD -> TO)
    let swingVel = null;
    if (td && to && td.swingThighHorizDeg != null && to.swingThighHorizDeg != null && realContactSec && realContactSec > 0.02) {
      swingVel = Math.round(Math.abs(to.swingThighHorizDeg - td.swingThighHorizDeg) / realContactSec);
    } else {
      const velValues = contactSlice.map(p => Math.abs(p.swingVelDegS || 0)).filter(v => v > 50 && v < 1800);
      if (velValues.length) swingVel = Math.round(velValues.reduce((s, x) => s + x, 0) / velValues.length);
    }

    // Take-off COM vector from MKF -> TO (more stable than 1-frame velocity!)
    let abflugTo = to?.takeoffAngle ?? null;
    if (mkf && to && mkf.hipPx && to.hipPx) {
      const dx = (to.dirSign || 1) * (to.hipPx.x - mkf.hipPx.x);
      const dyUp = mkf.hipPx.y - to.hipPx.y;
      if (dx > 2) abflugTo = Number((Math.atan2(dyUp, dx) * (180 / Math.PI)).toFixed(1));
    }

    // Landing (OSP Info 4 & 5)
    const landeRumpf = land?.landeRumpfDeg ?? null;
    const landeKnie = land?.landeKnieDeg ?? null;
    const landeHuefte = land?.landeHuefteDeg ?? null;
    const landeIndex = land?.landeIndex ?? null;
    let landeWeite = null;
    if (land && land.landeReachPx != null && scaleInfo.pxPerMeter) {
      landeWeite = Number((land.landeReachPx / scaleInfo.pxPerMeter).toFixed(2));
    }

    // Approach & penultimate step (OSP Info 6)
    let knieAbstand2L = null;
    if (m2L && m2L.kneeGapPx != null && scaleInfo.pxPerMeter) {
      knieAbstand2L = Number((m2L.kneeGapPx / scaleInfo.pxPerMeter).toFixed(2));
    }

    let step2Lm = null;
    let step1Lm = null;
    let v1Lms = null;
    let vFlugMs = null;
    let kspAbsenkungM = null;
    if (m2L && m1L && td && scaleInfo.pxPerMeter) {
      if (m2L.supportFootPx && m1L.supportFootPx) {
        step2Lm = Number((Math.abs(m1L.supportFootPx.x - m2L.supportFootPx.x) / scaleInfo.pxPerMeter).toFixed(2));
      }
      if (m1L.supportFootPx && td.supportFootPx) {
        step1Lm = Number((Math.abs(td.supportFootPx.x - m1L.supportFootPx.x) / scaleInfo.pxPerMeter).toFixed(2));
      }
      if (scaleInfo.fpsKnown && m1L.hipPx && td.hipPx && td.t > m1L.t) {
        const dt1L = (td.t - m1L.t) * tScale;
        if (dt1L > 0.05) {
          v1Lms = Number((Math.abs(td.hipPx.x - m1L.hipPx.x) / scaleInfo.pxPerMeter / dt1L).toFixed(2));
        }
      }
    }
    if (to && land && scaleInfo.fpsKnown && to.hipPx && land.hipPx && land.t > to.t && scaleInfo.pxPerMeter) {
      const dtF = (land.t - to.t) * tScale;
      if (dtF > 0.15) {
        vFlugMs = Number((Math.abs(land.hipPx.x - to.hipPx.x) / scaleInfo.pxPerMeter / dtF).toFixed(2));
      }
    }
    if (m2L && td && m2L.hipHeightPx && td.hipHeightPx && scaleInfo.pxPerMeter) {
      kspAbsenkungM = Number(((m2L.hipHeightPx - td.hipHeightPx) / scaleInfo.pxPerMeter).toFixed(2));
    }

    return {
      stemmwinkel_deg: stemmTd !== null ? Number(stemmTd.toFixed(1)) : null,
      rumpfwinkel_td_deg: rumpfTd !== null ? Number(rumpfTd.toFixed(1)) : null,
      rumpfrotation_deg: rumpfRot,
      kniewinkel_min_deg: minSupportKnee !== null ? Number(minSupportKnee.toFixed(1)) : null,
      abflugwinkel_deg: abflugTo,
      schwungbein_winkel_deg: swingThighDeg !== null ? Number(swingThighDeg.toFixed(1)) : null,
      schwungbein_deg_s: swingVel,
      lande_rumpfwinkel_deg: landeRumpf !== null ? Number(landeRumpf.toFixed(1)) : null,
      lande_kniewinkel_deg: landeKnie !== null ? Number(landeKnie.toFixed(1)) : null,
      lande_hueftwinkel_deg: landeHuefte !== null ? Number(landeHuefte.toFixed(1)) : null,
      landeweite_m: landeWeite,
      landeindex: landeIndex !== null ? Number(landeIndex.toFixed(2)) : null,
      knie_abstand_vorletzter_m: knieAbstand2L,
      step_2L_m: step2Lm,
      step_1L_m: step1Lm,
      v_1L_ms: v1Lms,
      v_flug_ms: vFlugMs,
      ksp_absenkung_m: kspAbsenkungM,
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
      alert('Bitte mindestens Touchdown (TD), Max. Beugung (MKF) und Take-off (TO) — idealerweise auch 🏖️ Landung (LAND) — markieren, um gegen die DLV-Zeile zu kalibrieren.');
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
    scheduleVideoAutoPush();
  }

  function removeCalibrationPair(trialId) {
    const pairs = getCalibrationPairs().filter(p => p.trialId !== trialId);
    saveCalibrationPairs(pairs);
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    if (runtime.onCalibrationChange) runtime.onCalibrationChange(getActiveOffsets());
    renderCalibrationModelPanel();
    scheduleVideoAutoPush();
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
            <span class="font-bold text-amber-300 font-mono">🔬 Noch keine DLV-Kalibrierungs-Paare hinterlegt (Roh-Modell aktiv).</span>
            <p class="text-[11px] text-slate-400 mt-0.5">
              1️⃣ Wähle rechts deinen DLV-Referenzsprung (Start: <b>25.07.2026 / V5 Bochum</b>) &amp; lade das <code>wm...mp4</code>.<br>
              2️⃣ Optional <b>📏 Meter-Aufsteller</b> kalibrieren (oder 1,85m Auto-Skala) • Markiere <b>(2L / 1L →) TD → MKF → TO → Landung</b> ➔ Klicke <b>„🎯 Auf diesen DLV-Sprung kalibrieren“</b>.
            </p>
          </div>
        </div>
      `;
      return;
    }

    const offsetBadges = [
      ['Stemm', 'stemmwinkel_deg', '°'],
      ['Rumpf TD', 'rumpfwinkel_td_deg', '°'],
      ['Rot.', 'rumpfrotation_deg', '°'],
      ['Amort.', 'kniewinkel_min_deg', '°'],
      ['Abflug', 'abflugwinkel_deg', '°'],
      ['Schwung-W', 'schwungbein_winkel_deg', '°'],
      ['Schwung ω', 'schwungbein_deg_s', '°/s'],
      ['Land-Rumpf', 'lande_rumpfwinkel_deg', '°'],
      ['Land-Knie', 'lande_kniewinkel_deg', '°'],
      ['Land-Hüfte', 'lande_hueftwinkel_deg', '°']
    ].map(([lbl, k, u]) => {
      const off = offsets[k] || 0;
      const col = Math.abs(off) < 1.0 ? 'text-emerald-400' : 'text-cyan-300';
      return `<span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">${lbl}: <b class="${col}">${off >= 0 ? '+' : ''}${off}${u}</b> <span class="text-slate-500">(n=${counts[k]})</span></span>`;
    }).join(' ');

    const pairsHtml = pairs.map(p => {
      const angKeys = CALIBRATABLE_KEYS.filter(k => k !== 'schwungbein_deg_s');
      const errs = angKeys.map(k => {
        const r = p.rawSummary?.[k];
        const gt = p.groundTruth?.[k];
        const cal = (typeof r === 'number') ? (r + (offsets[k] || 0)) : null;
        if (typeof r !== 'number' || typeof gt !== 'number') return null;
        return { rawErr: Math.abs(gt - r), calErr: Math.abs(gt - cal) };
      }).filter(Boolean);
      const maeRaw = errs.length ? (errs.reduce((s, e) => s + e.rawErr, 0) / errs.length) : null;
      const maeCal = errs.length ? (errs.reduce((s, e) => s + e.calErr, 0) / errs.length) : null;
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
              ${enabled ? `✅ OSP/DLV-KALIBRIERUNG AKTIV (${pairs.length} Referenz-Sprünge)` : '⏸️ DLV-Kalibrierung pausiert (Rohwerte)'}
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
    const span = Math.max(1, norm.max - norm.min);
    const dist = val < norm.min ? (norm.min - val) : (val - norm.max);
    if (dist <= span * 0.25 + 1.5) return { cls: 'text-amber-300 border-amber-700/70 bg-amber-950/30', tag: '⚠️ Grenz' };
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
    const scaleInfo = runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : { fpsKnown: false, pxPerMeter: null, isManualScale: false };

    const groups = [
      {
        title: '🚀 ABSPRUNG-BIOMECHANIK (OSP INFO 2 & 3)',
        rows: [
          { key: 'stemmwinkel_deg', label: 'Stemmwinkel beim TD', raw: rawSummary.stemmwinkel_deg, val: summary.stemmwinkel_deg, bm: bm?.stemmwinkel_deg, unit: '°', norm: '22 – 28°' },
          { key: 'rumpfwinkel_td_deg', label: 'Rumpfwinkel TD (>90° = Rücklage)', raw: rawSummary.rumpfwinkel_td_deg, val: summary.rumpfwinkel_td_deg, bm: bm?.rumpfwinkel_td_deg, unit: '°', norm: '95 – 102°' },
          { key: 'rumpfrotation_deg', label: 'Rumpfrotation (TD → TO)', raw: rawSummary.rumpfrotation_deg, val: summary.rumpfrotation_deg, bm: bm?.rumpfrotation_deg, unit: '°', norm: '4 – 12°' },
          { key: 'kniewinkel_min_deg', label: 'Amortisation Sprungbein-Knie min.', raw: rawSummary.kniewinkel_min_deg, val: summary.kniewinkel_min_deg, bm: bm?.kniewinkel_min_deg, unit: '°', norm: '> 134°' },
          { key: 'abflugwinkel_deg', label: 'Abflugwinkel des KSP', raw: rawSummary.abflugwinkel_deg, val: summary.abflugwinkel_deg, bm: bm?.abflugwinkel_deg, unit: '°', norm: '> 19°' },
          { key: 'schwungbein_winkel_deg', label: 'Schwungbein-Oberschenkel vs. Horiz.', raw: rawSummary.schwungbein_winkel_deg, val: summary.schwungbein_winkel_deg, bm: bm?.schwungbein_winkel_deg, unit: '°', norm: '> -13°' },
          { key: 'schwungbein_deg_s', label: 'Schwungbein-Geschw. Ø (TD → TO)', raw: rawSummary.schwungbein_deg_s, val: summary.schwungbein_deg_s, bm: bm?.schwungbein_deg_s, unit: '°/s', norm: '> 730 °/s' }
        ]
      },
      {
        title: '🏖️ LANDUNG (OSP INFO 4 & 5)',
        rows: [
          { key: 'landeweite_m', label: 'Landeweite (Ferse vs. KSP-Projektion)', raw: rawSummary.landeweite_m, val: summary.landeweite_m, bm: bm?.landeweite_m, unit: 'm', norm: '> 0,43 m' },
          { key: 'landeindex', label: 'Landeindex (Körperlage zu Ferse)', raw: rawSummary.landeindex, val: summary.landeindex, bm: bm?.landeindex, unit: '', norm: '1,5 – 2,2' },
          { key: 'lande_rumpfwinkel_deg', label: 'Rumpfwinkel Landung', raw: rawSummary.lande_rumpfwinkel_deg, val: summary.lande_rumpfwinkel_deg, bm: bm?.lande_rumpfwinkel_deg, unit: '°', norm: '64 – 104°' },
          { key: 'lande_kniewinkel_deg', label: 'Kniewinkel Landebein', raw: rawSummary.lande_kniewinkel_deg, val: summary.lande_kniewinkel_deg, bm: bm?.lande_kniewinkel_deg, unit: '°', norm: '> 125°' },
          { key: 'lande_hueftwinkel_deg', label: 'Hüftwinkel Landebein', raw: rawSummary.lande_hueftwinkel_deg, val: summary.lande_hueftwinkel_deg, bm: bm?.lande_hueftwinkel_deg, unit: '°', norm: '70 – 114°' }
        ]
      },
      {
        title: '📏 ANLAUF, KSP & ZUSATZ-METRIKEN',
        rows: [
          { key: 'knie_abstand_vorletzter_m', label: 'Knie-Knie-Abstand im vorletzten Stütz (2L)', raw: rawSummary.knie_abstand_vorletzter_m, val: summary.knie_abstand_vorletzter_m, bm: bm?.knie_abstand_vorletzter_m, unit: 'm', norm: '-0,05 – +0,05 m' },
          { key: 'step_2L_m', label: 'Schrittlänge vorletzter (2L) / letzter (1L)', raw: null, val: summary.step_2L_m !== null ? `${summary.step_2L_m} / ${summary.step_1L_m ?? '—'}` : null, bm: bm?.step_2L_m ? `${bm.step_2L_m} / ${bm.step_1L_m}` : null, unit: 'm', norm: '2L > 1L' },
          { key: 'ksp_absenkung_m', label: 'KSP-Absenkung (2L → TD)', raw: rawSummary.ksp_absenkung_m, val: summary.ksp_absenkung_m, bm: bm?.ksp_absenkung_m, unit: 'm', norm: '0,03 – 0,06 m' },
          { key: 'schwungbein_knie_kompakt_deg', label: 'Zusatz: Schwungbein-Kniewinkel (Kompaktheit)', raw: rawSummary.schwungbein_knie_kompakt_deg, val: summary.schwungbein_knie_kompakt_deg, bm: 88, unit: '°', norm: '60 – 95° (eng)' },
          { key: 'kontaktzeit_ms', label: `Zusatz: Bodenkontakt TD → TO ${scaleInfo.fpsKnown ? '' : '(FPS ?)'}`, raw: rawSummary.kontaktzeit_ms, val: summary.kontaktzeit_ms, bm: bm?.kontaktzeit_ms ?? 112, unit: 'ms', norm: '100 – 125 ms' }
        ]
      }
    ];

    let html = '';
    groups.forEach(g => {
      html += `<tr class="bg-slate-950/90"><td colspan="6" class="py-1.5 px-2 text-[10px] font-mono font-black text-cyan-400 tracking-wider border-b border-slate-800">${g.title}</td></tr>`;
      g.rows.forEach(r => {
        const isNumericVal = typeof r.val === 'number';
        const st = isNumericVal ? statusClass(r.key, r.val) : { cls: 'text-cyan-300 border-slate-700', tag: 'Info' };
        const valStr = r.val !== null && r.val !== undefined ? `${r.val}${r.unit ? ' ' + r.unit : ''}` : '—';
        const hasOffset = calActive && (offsets[r.key] || 0) !== 0 && r.raw !== null;
        const rawHint = hasOffset ? ` <span class="text-[9px] text-slate-500">(Roh: ${r.raw})</span>` : '';
        const bmStr = r.bm !== null && r.bm !== undefined ? `${r.bm}${r.unit ? ' ' + r.unit : ''}` : '—';
        let deltaHtml = '<span class="text-slate-500">—</span>';
        if (isNumericVal && typeof r.bm === 'number') {
          const d = Number((r.val - r.bm).toFixed(2));
          deltaHtml = `<span class="font-bold ${Math.abs(d) < 0.01 ? 'text-emerald-400' : 'text-cyan-300'}">${d > 0 ? '+' : ''}${d}${r.unit ? ' ' + r.unit : ''}</span>`;
        }
        html += `
          <tr class="border-b border-slate-800/70 text-xs font-mono">
            <td class="py-1.5 px-2 text-slate-200 font-sans font-semibold">${r.label}</td>
            <td class="py-1.5 px-2"><span class="px-2 py-0.5 rounded border ${st.cls} font-bold">${valStr}</span>${rawHint}</td>
            <td class="py-1.5 px-2 text-amber-300 font-bold">${bmStr}</td>
            <td class="py-1.5 px-2">${deltaHtml}</td>
            <td class="py-1.5 px-2 text-slate-400">${r.norm}</td>
            <td class="py-1.5 px-2 text-right">${st.tag}</td>
          </tr>
        `;
      });
    });
    tbody.innerHTML = html;

    if (feedbackBox) {
      const notes = [];
      if (summary.schwungbein_winkel_deg !== null) {
        notes.push(`${summary.schwungbein_winkel_deg >= -13 ? '✅' : '⚠️'} <b>Schwungbein-Oberschenkelwinkel (${summary.schwungbein_winkel_deg}° vs. Horiz.):</b> ${bm?.schwungbein_winkel_deg !== undefined ? `Referenz ${bm.schwungbein_winkel_deg}°` : 'Norm > -13°'}.`);
      }
      if (summary.schwungbein_knie_kompakt_deg !== null) {
        if (summary.schwungbein_knie_kompakt_deg > 110) {
          notes.push(`🔴 <b>Zusatz Schwungbein-Knie offen (${summary.schwungbein_knie_kompakt_deg}°):</b> Ferse beim Durchschwingen enger unter das Gesäß blockieren (Ziel ≤ 95°).`);
        } else if (summary.schwungbein_knie_kompakt_deg <= 95) {
          notes.push(`✅ <b>Zusatz Schwungbein-Knie kompakt (${summary.schwungbein_knie_kompakt_deg}°):</b> Perfekt im Zielkorridor (≤ 95°).`);
        }
      }
      if (summary.lande_rumpfwinkel_deg !== null) {
        if (summary.lande_rumpfwinkel_deg > 104) {
          notes.push(`⚠️ <b>Landung zu aufrecht (${summary.lande_rumpfwinkel_deg}° vs. Norm 64–104°):</b> Risiko für vorzeitiges Aufsetzen / Rückfallen — aktiver Oberkörper-Vorklapp nach vorn.`);
        } else {
          notes.push(`✅ <b>Lande-Rumpfwinkel (${summary.lande_rumpfwinkel_deg}°):</b> Im OSP-Zielkorridor (64–104°).`);
        }
      }
      if (summary.rumpfrotation_deg !== null) {
        notes.push(`${summary.rumpfrotation_deg <= 12 ? '✅' : '🔴'} <b>Rumpfrotation (${summary.rumpfrotation_deg}°):</b> ${summary.rumpfrotation_deg > 12 ? 'Überrotation (>12°)! Aufrechte Blockade halten.' : 'Stabil in Norm (4–12°).'}`);
      }
      if (!notes.length) {
        notes.push('ℹ️ Lade ein Video, wähle ggf. die Kamera-FPS &amp; <b>📏 Meter-Aufsteller</b> und markiere <b>(2L / 1L →) TD → MKF → TO → Landung</b> für das komplette OSP-Profil + Anlaufbahn-Kinogramm.');
      }
      if (bm && (bm.positiv || bm.negativ || bm.fazit)) {
        notes.push(`
          <div class="mt-2 pt-2 border-t border-slate-800 text-[11px] space-y-1 text-slate-300">
            <div class="text-amber-300 font-mono font-bold">📋 Original-OSP-Diagnose (${bm.display_ref}):</div>
            ${bm.positiv ? `<div><span class="text-emerald-400 font-bold">Positiv:</span> ${bm.positiv}</div>` : ''}
            ${bm.negativ ? `<div><span class="text-rose-400 font-bold">Negativ:</span> ${bm.negativ}</div>` : ''}
            ${bm.fazit ? `<div><span class="text-cyan-300 font-bold">Fazit:</span> ${bm.fazit}</div>` : ''}
          </div>
        `);
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
              ? `<img src="${item.thumbnail}" alt="${item.title}" class="w-24 h-14 object-cover rounded-lg border border-slate-700 shrink-0" />`
              : `<div class="w-24 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">🎥</div>`
            }
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-bold text-white truncate">${item.title || 'Unbenannter Sprung'}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">${item.type || 'Training'}</span>
                ${item.mark_m ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-700">${item.mark_m} m</span>` : ''}
                ${item.calibrated ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700">OSP-kalibriert</span>` : ''}
                <span class="text-[10px] font-mono text-slate-400">${item.date || ''}</span>
              </div>
              <div class="flex flex-wrap gap-2 text-[10px] font-mono text-slate-300">
                <span>Stemm: <b class="text-cyan-300">${m.stemmwinkel_deg ?? '—'}°</b></span>
                <span>Rumpf: <b class="text-amber-300">${m.rumpfwinkel_td_deg ?? '—'}°</b> (Rot ${m.rumpfrotation_deg ?? '—'}°)</span>
                <span>Amort: <b class="text-emerald-300">${m.kniewinkel_min_deg ?? '—'}°</b></span>
                <span>Schwung: <b class="text-purple-300">${m.schwungbein_winkel_deg ?? '—'}°</b> / ${m.schwungbein_deg_s ?? '—'} °/s</span>
                <span>Land-Rumpf: <b class="text-sky-300">${m.lande_rumpfwinkel_deg ?? '—'}°</b></span>
                <span>Knie-Zusatz: <b>${m.schwungbein_knie_kompakt_deg ?? '—'}°</b></span>
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
      box.innerHTML = `<div class="text-[11px] text-slate-400 font-mono">Wähle oben im Archiv zwei Sprünge über <b>[A]</b> und <b>[B]</b> für einen kompletten OSP/DLV-Vergleich.</div>`;
      return;
    }
    const keys = [
      ['Stemmwinkel TD', 'stemmwinkel_deg', '°'],
      ['Rumpfwinkel TD', 'rumpfwinkel_td_deg', '°'],
      ['Rumpfrotation', 'rumpfrotation_deg', '°'],
      ['Amortisation Knie min.', 'kniewinkel_min_deg', '°'],
      ['Abflugwinkel KSP', 'abflugwinkel_deg', '°'],
      ['Schwungbein-Obersch. Horiz.', 'schwungbein_winkel_deg', '°'],
      ['Schwungbein ω (TD→TO)', 'schwungbein_deg_s', '°/s'],
      ['Landung: Rumpfwinkel', 'lande_rumpfwinkel_deg', '°'],
      ['Landung: Kniewinkel', 'lande_kniewinkel_deg', '°'],
      ['Landung: Hüftwinkel', 'lande_hueftwinkel_deg', '°'],
      ['Landeweite', 'landeweite_m', 'm'],
      ['Landeindex', 'landeindex', ''],
      ['Zusatz: Schwungbein-Knie', 'schwungbein_knie_kompakt_deg', '°'],
      ['Zusatz: Kontaktzeit', 'kontaktzeit_ms', 'ms']
    ];
    box.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse font-mono text-[11px]">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400">
              <th class="py-1.5 px-2">OSP / DLV Parameter</th>
              <th class="py-1.5 px-2 text-amber-300">🅰️ ${itemA.title} (${itemA.date})</th>
              <th class="py-1.5 px-2 text-purple-300">🅱️ ${itemB.title} (${itemB.date})</th>
              <th class="py-1.5 px-2">Δ (B − A)</th>
            </tr>
          </thead>
          <tbody>
            ${keys.map(([lbl, k, u]) => {
              const a = itemA.summary?.[k];
              const b = itemB.summary?.[k];
              const delta = (typeof a === 'number' && typeof b === 'number')
                ? `${(b - a) > 0 ? '+' : ''}${Number((b - a).toFixed(2))}${u ? ' ' + u : ''}`
                : '—';
              return `
                <tr class="border-b border-slate-800/60">
                  <td class="py-1.5 px-2 text-slate-300 font-sans">${lbl}</td>
                  <td class="py-1.5 px-2 font-bold text-white">${a ?? '—'}${a !== null && a !== undefined && u ? ' ' + u : ''}</td>
                  <td class="py-1.5 px-2 font-bold text-white">${b ?? '—'}${b !== null && b !== undefined && u ? ' ' + u : ''}</td>
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
    const dirEl = document.getElementById('bioRunDirSelect');

    const phaseMarks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const angleHistory = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    if ((!angleHistory || angleHistory.length === 0) && !phaseMarks.TD && !phaseMarks.TO) {
      alert('Bitte zuerst ein Video analysieren (mindestens TD/MKF/TO markieren), bevor du speicherst.');
      return;
    }

    const rawSummary = computeRawSummaryFromState(phaseMarks, angleHistory);
    const summary = computeSummaryFromState(phaseMarks, angleHistory);
    const thumbnail = runtime.getCaptureThumbnail ? runtime.getCaptureThumbnail() : null;
    const scaleInfo = runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : {};

    const record = {
      id: 'vid-' + Date.now(),
      createdAt: new Date().toISOString(),
      title: (titleEl?.value || '').trim() || `Analyse ${new Date().toLocaleDateString('de-DE')}`,
      date: dateEl?.value || new Date().toISOString().slice(0, 10),
      type: typeEl?.value || 'Training Sprung',
      mark_m: (markEl?.value || '').trim() || null,
      notes: (notesEl?.value || '').trim(),
      scaleInfo,
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
    scheduleVideoAutoPush();
    const btn = document.getElementById('saveArchiveBtn');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✅ Gespeichert!';
      setTimeout(() => { btn.textContent = old; }, 1800);
    }
  }

  function getDeletedIds() {
    try { return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || '[]'); } catch (e) { return []; }
  }

  function recordDeletedId(id) {
    try {
      const cur = new Set(getDeletedIds());
      cur.add(id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...cur].slice(-100)));
    } catch (e) {}
  }

  function renderVideoSyncStatusBar() {
    const el = document.getElementById('videoSyncStatusBar');
    if (!el) return;
    const hasPat = Boolean((localStorage.getItem(GH_SYNC_TOKEN_KEY) || '').trim());
    el.innerHTML = `
      <span class="px-1.5 py-0.5 rounded ${hasPat ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-900 text-slate-400 border border-slate-700'}">
        ${hasPat ? '✅ Cloud-Sync aktiv (wie Meetings)' : '⚪ Token unter Meetings einrichten'}
      </span>
      ${lastVideoSyncNote ? `<span class="text-slate-400">${lastVideoSyncNote}</span>` : ''}
      <button onclick="VideoBiomechanicsModule.syncVideoBioFromCloud(true)" class="px-2 py-1 rounded bg-slate-950 border border-slate-700 hover:border-cyan-500 text-cyan-300 font-bold">⬇️ Abrufen</button>
      <button onclick="VideoBiomechanicsModule.pushVideoBioToGitHub(false)" class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black">☁️ Jetzt pushen</button>
    `;
  }

  function compactRecordForCloud(rec) {
    const hist = Array.isArray(rec.angleHistory) ? rec.angleHistory : [];
    const step = Math.max(1, Math.ceil(hist.length / 120));
    const sampled = hist.filter((_, idx) => idx % step === 0);
    // Strip heavy fullFrame / bbox snapshots before pushing JSON to GitHub
    return {
      ...rec,
      angleHistory: sampled
    };
  }

  async function syncVideoBioFromCloud(forceAlert = false) {
    let remote = null;
    for (const u of [VIDEO_SYNC_RAW + '?t=' + Date.now(), './data/video_biomechanics_sync.json?t=' + Date.now()]) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && (Array.isArray(parsed.analyses) || Array.isArray(parsed.calibration_pairs))) {
            if (!remote || (parsed.updated_at || '') >= (remote.updated_at || '')) remote = parsed;
          }
        }
      } catch (e) {}
    }
    if (!remote) return false;

    const deletedSet = new Set([...getDeletedIds(), ...(remote.deleted_ids || [])]);
    const localPairs = getCalibrationPairs();
    const pairMap = new Map();
    [...(remote.calibration_pairs || []), ...localPairs].forEach(p => {
      if (p && p.trialId) pairMap.set(p.trialId, p);
    });
    const mergedPairs = [...pairMap.values()];
    if (mergedPairs.length > 0) saveCalibrationPairs(mergedPairs);

    const localItems = await dbGetAll();
    const localIds = new Set(localItems.map(x => x.id));
    let added = 0;
    for (const rec of (remote.analyses || [])) {
      if (rec && rec.id && !deletedSet.has(rec.id) && !localIds.has(rec.id)) {
        await dbPut(rec);
        added++;
      }
    }
    // Also remove locally any item explicitly tombstoned remotely
    for (const loc of localItems) {
      if ((remote.deleted_ids || []).includes(loc.id)) {
        await dbDelete(loc.id);
      }
    }

    lastVideoSyncNote = `☁️ Sync ${new Date(remote.updated_at || Date.now()).toLocaleDateString('de-DE')} (${added > 0 ? `+${added} neu` : 'aktuell'})`;
    renderCalibrationModelPanel();
    await refreshArchiveList();
    renderVideoSyncStatusBar();
    if (forceAlert) alert(`✅ Video-Archiv & Kalibrierung synchronisiert! (${mergedPairs.length} Kalibrier-Paare, +${added} Analysen übernommen)`);
    return true;
  }

  async function pushVideoBioToGitHub(quiet = false) {
    const pat = (localStorage.getItem(GH_SYNC_TOKEN_KEY) || '').trim();
    if (!pat) {
      if (!quiet) {
        if (window.VenuesModule && VenuesModule.configureGitHubSyncToken) {
          VenuesModule.configureGitHubSyncToken();
        } else {
          alert('Bitte hinterlege zuerst unter „📅 Meetings ➔ 🔑 Auto-Sync einrichten“ dein GitHub Token.');
        }
      }
      return false;
    }
    try {
      const allLocal = await dbGetAll();
      const payloadObj = {
        updated_at: new Date().toISOString(),
        source: 'Web-App Video-Bio & OSP Kalibrierung',
        deleted_ids: getDeletedIds(),
        calibration_pairs: getCalibrationPairs(),
        analyses: allLocal.map(compactRecordForCloud)
      };
      const jsonStr = JSON.stringify(payloadObj, null, 2) + '\n';
      const contentB64 = btoa(unescape(encodeURIComponent(jsonStr)));

      let sha = null;
      const getRes = await fetch(VIDEO_SYNC_API + '?t=' + Date.now(), {
        headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github+json' }
      });
      if (getRes.ok) {
        const meta = await getRes.json();
        sha = meta.sha;
      }
      const putRes = await fetch(VIDEO_SYNC_API, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Sync Video-Biomechanik (${payloadObj.calibration_pairs.length} Cal, ${payloadObj.analyses.length} Analysen)`,
          content: contentB64,
          branch: 'main',
          ...(sha ? { sha } : {})
        })
      });
      if (!putRes.ok) {
        const err = await putRes.text();
        if (!quiet) alert('Video-Sync Fehler (' + putRes.status + '): ' + err.slice(0, 180));
        return false;
      }
      lastVideoSyncNote = `✅ Gepusht (${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`;
      renderVideoSyncStatusBar();
      if (!quiet) alert(`✅ Video-Kalibrierung (${payloadObj.calibration_pairs.length}x) & Analysen (${payloadObj.analyses.length}x) auf GitHub gespeichert! Auf deinen anderen Geräten jetzt abrufbar.`);
      return true;
    } catch (e) {
      if (!quiet) alert('Video-Sync Fehler: ' + e.message);
      return false;
    }
  }

  function scheduleVideoAutoPush() {
    if ((localStorage.getItem(GH_SYNC_TOKEN_KEY) || '').trim()) {
      clearTimeout(videoAutoPushTimer);
      videoAutoPushTimer = setTimeout(() => { pushVideoBioToGitHub(true); }, 5000);
    }
  }

  async function loadFromArchive(id) {
    const item = cachedArchive.find(x => x.id === id);
    if (!item) return;
    if (runtime.loadSavedAnalysisToView) runtime.loadSavedAnalysisToView(item);
    updateComparisonTable(item.phaseMarks || {}, item.angleHistory || []);
  }

  async function deleteFromArchive(id) {
    if (!confirm('Diese Video-Analyse dauerhaft aus dem lokalen Archiv löschen?')) return;
    recordDeletedId(id);
    await dbDelete(id);
    if (compareIdA === id) compareIdA = null;
    if (compareIdB === id) compareIdB = null;
    await refreshArchiveList();
    scheduleVideoAutoPush();
  }

  function setCompareSlot(slot, id) {
    if (slot === 'A') compareIdA = (compareIdA === id) ? null : id;
    if (slot === 'B') compareIdB = (compareIdB === id) ? null : id;
    refreshArchiveList();
  }

  function exportArchiveJson() {
    const payload = {
      exported_at: new Date().toISOString(),
      app: 'Athletics Intelligence OSP/DLV Video Archive (M3 Pro GPU)',
      calibration_enabled: isCalibrationEnabled(),
      calibration_pairs: getCalibrationPairs(),
      count: cachedArchive.length,
      analyses: cachedArchive
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Luka_OSP_Biomechanik_Archiv_${new Date().toISOString().slice(0, 10)}.json`;
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
    renderVideoSyncStatusBar();
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    updateComparisonTable(marks, hist);
    await refreshArchiveList();
    syncVideoBioFromCloud(false);
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
    syncVideoBioFromCloud,
    pushVideoBioToGitHub,
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
