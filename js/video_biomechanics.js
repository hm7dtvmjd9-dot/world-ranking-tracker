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
  const CAL_MODEL_VERSION = 2;
  const GH_SYNC_TOKEN_KEY = 'luka_gh_triage_pat_v1';
  const VIDEO_SYNC_API = 'https://api.github.com/repos/hm7dtvmjd9-dot/world-ranking-tracker/contents/data/video_biomechanics_sync.json';
  const VIDEO_SYNC_RAW = 'https://raw.githubusercontent.com/hm7dtvmjd9-dot/world-ranking-tracker/main/data/video_biomechanics_sync.json';
  const DELETED_IDS_KEY = 'luka_video_deleted_ids_v1';
  let videoAutoPushTimer = null;
  let lastVideoSyncNote = '';
  const dlvChartInstances = {};

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
    'lande_hueftwinkel_deg',
    'landeweite_m',
    'landeindex',
    'knie_abstand_vorletzter_m',
    'step_2L_m',
    'step_1L_m',
    'v_1L_ms',
    'v_flug_ms',
    'ksp_absenkung_m'
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

  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
  }

  function isMeterOrSpeedKey(k) {
    return k.endsWith('_m') || k.endsWith('_ms') || k === 'landeindex';
  }

  function computeCalibrationModels(pairs) {
    const models = {};
    const offsets = {};
    const counts = {};
    const allPairs = Array.isArray(pairs) ? pairs : [];
    const v2Pairs = allPairs.filter(p => (p.modelVersion || 1) >= CAL_MODEL_VERSION);
    const activePairs = v2Pairs.length > 0 ? v2Pairs : allPairs;
    const usingLegacyV1 = v2Pairs.length === 0 && allPairs.length > 0;

    CALIBRATABLE_KEYS.forEach(k => {
      const pts = [];
      activePairs.forEach(p => {
        const rawVal = p.rawSummary?.[k];
        const gtVal = p.groundTruth?.[k];
        if (typeof rawVal === 'number' && !Number.isNaN(rawVal) && typeof gtVal === 'number' && !Number.isNaN(gtVal)) {
          const d = gtVal - rawVal;
          // Schutz vor kaputten v1-Alt-Ausreißern
          if (usingLegacyV1 && k !== 'schwungbein_deg_s' && !isMeterOrSpeedKey(k) && Math.abs(d) > 22) return;
          if (usingLegacyV1 && k === 'schwungbein_deg_s' && Math.abs(d) > 350) return;
          if (usingLegacyV1 && isMeterOrSpeedKey(k) && Math.abs(d) > 2.5) return;
          pts.push({ x: rawVal, y: gtVal, d });
        }
      });

      if (pts.length === 0) {
        models[k] = { slope: 1, intercept: 0, mode: 'identity', count: 0 };
        offsets[k] = 0;
        counts[k] = 0;
        return;
      }

      // Outlier-Filter über Residuen erst ab >= 5 Paaren, damit bei 3–4 Sprüngen kein echter Winkel-Trend weggeschnitten wird
      const medD = median(pts.map(p => p.d));
      const cleanPts = pts.length >= 5
        ? pts.filter(p => {
            const tol = k === 'schwungbein_deg_s' ? 240 : (isMeterOrSpeedKey(k) ? 1.8 : 22);
            return Math.abs(p.d - medD) <= tol;
          })
        : pts;
      const used = cleanPts.length ? cleanPts : pts;
      const n = used.length;
      const mx = used.reduce((s, p) => s + p.x, 0) / n;
      const my = used.reduce((s, p) => s + p.y, 0) / n;

      if (n >= 3) {
        // Selbstlernende Ridge Regression: passt Steigung + Offset automatisch an Kamera-/DLV-Geometrie an
        const varX = used.reduce((s, p) => s + (p.x - mx) ** 2, 0);
        const cov = used.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
        const lamBase = k === 'schwungbein_deg_s' ? 4000 : (isMeterOrSpeedKey(k) ? 0.25 : 4.0);
        const lam = lamBase / Math.max(1, n / 3);
        let slope = varX > 1e-6 ? ((cov + lam * 1.0) / (varX + lam)) : 1.0;
        slope = Math.max(0.20, Math.min(1.80, slope));
        const intercept = my - slope * mx;
        models[k] = {
          slope: Number(slope.toFixed(4)),
          intercept: Number(intercept.toFixed(3)),
          mode: 'ridge',
          count: n
        };
        offsets[k] = Number((my - mx).toFixed(2));
        counts[k] = n;
      } else {
        const bias = my - mx;
        models[k] = { slope: 1, intercept: Number(bias.toFixed(3)), mode: 'offset', count: n };
        offsets[k] = Number(bias.toFixed(2));
        counts[k] = n;
      }
    });
    return { models, offsets, counts, usingLegacyV1, v2Count: v2Pairs.length };
  }

  function computeOffsetsFromPairs(pairs) {
    return computeCalibrationModels(pairs);
  }

  function getActiveModels() {
    const pairs = getCalibrationPairs();
    if (!isCalibrationEnabled() || pairs.length === 0) {
      const idModels = {};
      CALIBRATABLE_KEYS.forEach(k => { idModels[k] = { slope: 1, intercept: 0, mode: 'identity', count: 0 }; });
      return idModels;
    }
    return computeCalibrationModels(pairs).models;
  }

  function getActiveOffsets() {
    const pairs = getCalibrationPairs();
    if (!isCalibrationEnabled() || pairs.length === 0) {
      const zero = {};
      CALIBRATABLE_KEYS.forEach(k => { zero[k] = 0; });
      return zero;
    }
    return computeCalibrationModels(pairs).offsets;
  }

  function applyCalibrationToScalar(metricKey, rawVal) {
    if (rawVal === null || rawVal === undefined || Number.isNaN(rawVal)) return rawVal;
    const mod = getActiveModels()[metricKey];
    const decimals = isMeterOrSpeedKey(metricKey) ? 2 : (metricKey === 'schwungbein_deg_s' ? 0 : 1);
    if (!mod) return Number(Number(rawVal).toFixed(decimals));
    const val = mod.slope * rawVal + mod.intercept;
    return Number(val.toFixed(decimals));
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

  function predictExpectedDistanceFromSpeed(vApproach) {
    if (!vApproach || Number.isNaN(vApproach)) return null;
    const trials = getAllReferenceTrials();
    const pts = trials
      .map(t => {
        const vmax = Math.max(t.v_3L_ms || 0, t.v_2L_ms || 0, t.v_1L_ms || 0);
        return (vmax > 7 && t.erwartet_m > 5) ? { x: vmax, y: t.erwartet_m } : null;
      })
      .filter(Boolean);
    if (pts.length >= 3) {
      const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
      const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
      if (den > 1e-4) {
        const slope = num / den;
        const intercept = my - slope * mx;
        return Number((slope * vApproach + intercept).toFixed(2));
      }
    }
    return Number((0.2656 * vApproach + 5.2304).toFixed(2));
  }

  function extractSupportKnee(p) {
    if (!p) return null;
    if (typeof p.supportKnee === 'number' && p.supportKnee > 105) return p.supportKnee;
    const l = p.leftKnee, r = p.rightKnee;
    if (typeof l === 'number' && typeof r === 'number') {
      if (l < 105 && r > 115) return r;
      if (r < 105 && l > 115) return l;
      return Math.max(l, r);
    }
    return l ?? r ?? null;
  }

  function extractSwingKnee(p) {
    if (!p) return null;
    if (typeof p.swingKnee === 'number' && p.swingKnee > 20) return p.swingKnee;
    const l = p.leftKnee, r = p.rightKnee;
    if (typeof l === 'number' && typeof r === 'number') {
      if (r > 125 && l < 105) return l;
      return Math.min(l, r);
    }
    return r ?? l ?? null;
  }

  function getWorldPt(mk, pointKey = 'hipPx') {
    if (!mk) return null;
    const pt = mk[pointKey] || mk.hipPx;
    if (!pt) return null;
    return {
      x: pt.x + (mk.panWorldPx || 0),
      y: pt.y + (mk.panWorldPy || 0)
    };
  }

  function calcAngleArr2D(a, b, c) {
    if (!a || !b || !c) return null;
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
    if (m1 < 1e-5 || m2 < 1e-5) return null;
    return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)))) * (180 / Math.PI);
  }

  function recomputePhaseFromRawPts(mk) {
    if (!mk || !Array.isArray(mk.rawPts) || mk.rawPts.length < 33) return mk;
    const vw = mk.vw || 960, vh = mk.vh || 540, dirSign = mk.dirSign || 1;
    const gPt = idx => ({ x: mk.rawPts[idx][0], y: mk.rawPts[idx][1], visibility: mk.rawPts[idx][2] ?? 1 });
    const sPt = idx => ({ x: mk.rawPts[idx][0] * vw, y: mk.rawPts[idx][1] * vh });

    const pNose = gPt(0), pLEye = gPt(2), pREye = gPt(5), pLEar = gPt(7), pREar = gPt(8);
    const pLS = gPt(11), pRS = gPt(12), pLH = gPt(23), pRH = gPt(24);
    const pLK = gPt(25), pRK = gPt(26), pLA = gPt(27), pRA = gPt(28);
    const pLHeel = gPt(29), pRHeel = gPt(30), pLFoot = gPt(31), pRFoot = gPt(32);

    const leftKnee = calcAngleArr2D(sPt(23), sPt(25), sPt(27));
    const rightKnee = calcAngleArr2D(sPt(24), sPt(26), sPt(28));
    const ankDiffY = pLA.y - pRA.y;
    let isLeftSupport = Math.abs(ankDiffY) > 0.025 ? ankDiffY > 0 : (leftKnee >= rightKnee);
    if (isLeftSupport && leftKnee < 105 && rightKnee > 118) isLeftSupport = false;
    else if (!isLeftSupport && rightKnee < 105 && leftKnee > 118) isLeftSupport = true;

    const pSupK = isLeftSupport ? pLK : pRK, pSupA = isLeftSupport ? pLA : pRA, pSupHeel = isLeftSupport ? pLHeel : pRHeel, pSupFoot = isLeftSupport ? pLFoot : pRFoot;
    const pSwH = isLeftSupport ? pRH : pLH, pSwK = isLeftSupport ? pRK : pLK;
    const supportKnee = isLeftSupport ? leftKnee : rightKnee;
    const swingKnee = isLeftSupport ? rightKnee : leftKnee;

    const midHip = { x: 0.5 * (pLH.x + pRH.x) * vw, y: 0.5 * (pLH.y + pRH.y) * vh };
    const midSh = { x: 0.5 * (pLS.x + pRS.x) * vw, y: 0.5 * (pLS.y + pRS.y) * vh };
    const kspPx = { x: 0.90 * midHip.x + 0.10 * midSh.x, y: 0.90 * midHip.y + 0.10 * midSh.y };

    const supFootMidPx = { x: (0.65 * pSupA.x + 0.35 * pSupHeel.x) * vw, y: (0.65 * pSupA.y + 0.35 * pSupHeel.y) * vh };
    const dlvStemm = Math.atan2(dirSign * (supFootMidPx.x - kspPx.x), Math.max(1e-5, supFootMidPx.y - kspPx.y)) * (180 / Math.PI);
    const dlvRumpf = 90 + Math.atan2(dirSign * (midHip.x - midSh.x), Math.max(1e-5, midHip.y - midSh.y)) * (180 / Math.PI);
    const dxTh = dirSign * (pSwK.x - pSwH.x) * vw;
    const dyTh = (pSwH.y - pSwK.y) * vh;
    const swingThighHorizDeg = Math.atan2(dyTh, Math.abs(dxTh) > 2 ? dxTh : 2) * (180 / Math.PI);

    const ear = [pLEar, pREar].filter(p => p.visibility > 0.2);
    const midEar = ear.length ? { x: ear.reduce((s, p) => s + p.x, 0) / ear.length, y: ear.reduce((s, p) => s + p.y, 0) / ear.length } : { x: pNose.x - dirSign * 0.018, y: pNose.y };
    const eyes = [pLEye, pREye].filter(p => p.visibility > 0.2);
    const gaze = eyes.length ? { x: 0.5 * pNose.x + 0.5 * eyes.reduce((s, p) => s + p.x, 0) / eyes.length, y: 0.45 * pNose.y + 0.55 * eyes.reduce((s, p) => s + p.y, 0) / eyes.length } : pNose;
    const kopfBlickDeg = Math.atan2((midEar.y - gaze.y) * vh, Math.max(4, dirSign * (gaze.x - midEar.x) * vw)) * (180 / Math.PI);

    const useLeftLead = (dirSign * pLHeel.x) >= (dirSign * pRHeel.x);
    const lH = useLeftLead ? sPt(23) : sPt(24), lK = useLeftLead ? sPt(25) : sPt(26), lA = useLeftLead ? sPt(27) : sPt(28);
    const lHeel = useLeftLead ? pLHeel : pRHeel;
    const landeRumpfDeg = Math.atan2(Math.max(1e-5, midHip.y - midSh.y), dirSign * (midSh.x - midHip.x)) * (180 / Math.PI);
    const landeKnieDeg = calcAngleArr2D(lH, lK, lA);
    const landeHuefteDeg = calcAngleArr2D(midSh, lH, lK);
    const landeReachPx = Math.max(0, dirSign * (lHeel.x * vw - kspPx.x));
    const landeIndex = Number((Math.max(10, lHeel.y * vh - kspPx.y) / Math.max(20, landeReachPx)).toFixed(2));
    const kneeGapPx = dirSign * (pSwK.x - pSupK.x) * vw;
    const lowAnkY = Math.max(pLA.y, pRA.y) * vh;

    return {
      ...mk,
      supSide: isLeftSupport ? 'L' : 'R',
      leftKnee,
      rightKnee,
      supportKnee,
      swingKnee,
      dlvRumpf,
      dlvStemm,
      swingThighHorizDeg,
      kopfBlickDeg: Number(kopfBlickDeg.toFixed(1)),
      landeRumpfDeg,
      landeKnieDeg,
      landeHuefteDeg,
      landeIndex,
      landeReachPx,
      kneeGapPx,
      hipPx: kspPx,
      kspPx,
      supAnklePx: { x: pSupA.x * vw, y: pSupA.y * vh },
      hipHeightPx: Math.max(0, lowAnkY - kspPx.y),
      supportFootPx: { x: pSupFoot.x * vw, y: pSupFoot.y * vh }
    };
  }

  function computeRawSummaryFromState(rawPhaseMarks, angleHistory, overrideScaleInfo = null) {
    const m2L = recomputePhaseFromRawPts(rawPhaseMarks?.['2L'] || null);
    const m1L = recomputePhaseFromRawPts(rawPhaseMarks?.['1L'] || null);
    const td = recomputePhaseFromRawPts(rawPhaseMarks?.TD || null);
    const mkf = recomputePhaseFromRawPts(rawPhaseMarks?.MKF || null);
    const to = recomputePhaseFromRawPts(rawPhaseMarks?.TO || null);
    const land = recomputePhaseFromRawPts(rawPhaseMarks?.LAND || null);
    const hist = Array.isArray(angleHistory) ? angleHistory : [];
    const scaleInfo = overrideScaleInfo || (runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : { pxPerMeter: null, timeScale: 1, fpsKnown: false });
    const tScale = scaleInfo.timeScale || 1;
    const pxM = scaleInfo.pxPerMeter || null;

    const contactSlice = (td && to)
      ? hist.filter(p => p.t >= td.t - 0.01 && p.t <= to.t + 0.01)
      : hist;

    // MKF Priorität: Wenn Luka MKF explizit markiert hat, vertraue MKF (max ±25 ms Nachbarschaft) statt unsauberem Übergangsframe!
    let minSupportKnee = null;
    const mkfSupKnee = extractSupportKnee(mkf);
    if (mkf && mkfSupKnee !== null && mkfSupKnee >= 105) {
      const nearMkf = hist
        .filter(p => Math.abs(p.t - mkf.t) <= 0.025 / Math.max(0.15, tScale))
        .map(extractSupportKnee)
        .filter(v => typeof v === 'number' && v >= 108 && Math.abs(v - mkfSupKnee) <= 8);
      minSupportKnee = nearMkf.length ? Math.min(mkfSupKnee, ...nearMkf) : mkfSupKnee;
    } else {
      const supKneeVals = contactSlice.map(extractSupportKnee).filter(v => typeof v === 'number' && v >= 108);
      if (supKneeVals.length) minSupportKnee = Math.min(...supKneeVals);
      else if (mkfSupKnee !== null) minSupportKnee = mkfSupKnee;
    }

    // Bonus metric (Swing Knee Kompaktheit)
    const swingKnValues = contactSlice.map(extractSwingKnee).filter(v => typeof v === 'number' && v > 25 && v < 145);
    const minSwingKnee = swingKnValues.length ? Math.min(...swingKnValues) : extractSwingKnee(to || mkf);

    const stemmTd = td?.dlvStemm ?? null;
    const rumpfTd = td?.dlvRumpf ?? null;
    const rumpfTo = to?.dlvRumpf ?? null;
    const rumpfRot = (rumpfTd !== null && rumpfTo !== null) ? Number((rumpfTd - rumpfTo).toFixed(1)) : null;

    // OSP Info 3: Schwungbein-Oberschenkelwinkel gegenüber Horizontaler bei TO
    const swingThighDeg = to?.swingThighHorizDeg ?? null;

    // Kopf-Blickachse bei TO & kurz nach Abflug (0..150 ms real)
    let kopfBlickTo = to?.kopfBlickDeg ?? null;
    if (to && hist.length) {
      const postSlice = hist.filter(p => p.t >= to.t - 0.005 && p.t <= to.t + 0.16 / Math.max(0.1, tScale) && typeof p.kopfBlickDeg === 'number');
      if (postSlice.length) {
        kopfBlickTo = Number(Math.min(...postSlice.map(p => p.kopfBlickDeg)).toFixed(1));
      }
    }

    // Bodenkontaktzeit (rein informativ / FPS-abhängig!)
    const realContactSec = (td && to && scaleInfo.fpsKnown) ? (to.t - td.t) * tScale : null;
    const kontaktMs = (realContactSec !== null && realContactSec > 0.03 && realContactSec < 0.45)
      ? Math.round(realContactSec * 1000)
      : null;

    // Schwungbein-Geschwindigkeit Ø (TD -> TO)
    let swingVel = null;
    if (td && to && td.swingThighHorizDeg != null && to.swingThighHorizDeg != null && realContactSec && realContactSec > 0.02) {
      swingVel = Math.round(Math.abs(to.swingThighHorizDeg - td.swingThighHorizDeg) / realContactSec);
    } else {
      const velValues = contactSlice.map(p => Math.abs(p.swingVelDegS || 0)).filter(v => v > 50 && v < 1800);
      if (velValues.length) swingVel = Math.round(velValues.reduce((s, x) => s + x, 0) / velValues.length);
    }

    // KSP Abflugwinkel in WELT-Koordinaten (inkl. Kamera-Pan-Kompensation MKF -> TO!)
    let abflugTo = to?.takeoffAngle ?? null;
    if (mkf && to) {
      const wMkf = getWorldPt(mkf, 'kspPx');
      const wTo = getWorldPt(to, 'kspPx');
      if (wMkf && wTo) {
        const dirS = to.dirSign || mkf.dirSign || 1;
        const dxW = dirS * (wTo.x - wMkf.x);
        const dyUp = wMkf.y - wTo.y;
        if (dxW > 4) {
          abflugTo = Number((Math.atan2(dyUp, dxW) * (180 / Math.PI)).toFixed(1));
        }
      }
    }

    // Landing (OSP Info 4 & 5)
    const landeRumpf = land?.landeRumpfDeg ?? null;
    const landeKnie = land?.landeKnieDeg ?? null;
    const landeHuefte = land?.landeHuefteDeg ?? null;
    const landeIndex = land?.landeIndex ?? null;
    const landeWeite = (land && land.landeReachPx != null && pxM)
      ? Number((land.landeReachPx / pxM).toFixed(2))
      : null;

    // OSP Info 6: Knie-Knie-Abstand im vorletzten Stütz (2L Mid-Stance wenn in AngleHistory vorhanden!)
    let knieAbstand2L = (m2L && m2L.kneeGapPx != null && pxM)
      ? Number((m2L.kneeGapPx / pxM).toFixed(2))
      : null;
    if (m2L && m1L && hist.length && pxM) {
      const midSlice = hist.filter(p => p.t >= m2L.t && p.t <= m1L.t && typeof p.kneeGapPx === 'number');
      if (midSlice.length >= 2 && m2L.supAnklePx) {
        let bestMid = midSlice[0], bestDist = 1e9;
        midSlice.forEach(p => {
          const d = Math.abs((p.hipPx?.x || 0) - m2L.supAnklePx.x);
          if (d < bestDist) { bestDist = d; bestMid = p; }
        });
        const midIdx = midSlice[Math.floor(midSlice.length * 0.35)];
        const cand = Math.abs(bestMid.kneeGapPx) < 0.65 * pxM ? bestMid : midIdx;
        if (cand) knieAbstand2L = Number((cand.kneeGapPx / pxM).toFixed(2));
      }
    }

    // Welt-basierte Schrittlängen, Geschwindigkeiten & KSP-Höhen (Pan-Kompensiert!)
    let step2Lm = null, step1Lm = null, step1Lpct = null;
    let v2Lms = null, v1Lms = null, vFlugMs = null, vVertikalMs = null, vVerlustMs = null, geschwBilanz = null;
    let ksp2Lm = null, ksp1Lm = null, kspTdM = null, kspAbsenkungM = null;
    let erwartetM = null, effektivM = null;

    if (pxM) {
      if (m2L && m1L) {
        const wF2 = getWorldPt(m2L, 'supportFootPx'), wF1 = getWorldPt(m1L, 'supportFootPx');
        if (wF2 && wF1 && (m2L.panWorldPx !== undefined || m1L.panWorldPx !== undefined || Math.abs(wF1.x - wF2.x) > pxM * 0.8)) {
          step2Lm = Number((Math.abs(wF1.x - wF2.x) / pxM).toFixed(2));
        }
        if (scaleInfo.fpsKnown && m1L.t > m2L.t) {
          const wK2 = getWorldPt(m2L, 'kspPx'), wK1 = getWorldPt(m1L, 'kspPx');
          const dt2 = (m1L.t - m2L.t) * tScale;
          if (wK2 && wK1 && dt2 > 0.05) {
            const v2 = Math.abs(wK1.x - wK2.x) / pxM / dt2;
            if (v2 > 5 && v2 < 12.5) v2Lms = Number(v2.toFixed(2));
          }
        }
      }
      if (m1L && td) {
        const wF1 = getWorldPt(m1L, 'supportFootPx'), wFTd = getWorldPt(td, 'supportFootPx');
        if (wF1 && wFTd && (m1L.panWorldPx !== undefined || td.panWorldPx !== undefined || Math.abs(wFTd.x - wF1.x) > pxM * 0.8)) {
          step1Lm = Number((Math.abs(wFTd.x - wF1.x) / pxM).toFixed(2));
          if (step2Lm && step2Lm > 1.2) {
            step1Lpct = Math.round(((step1Lm - step2Lm) / step2Lm) * 100);
          }
        }
        if (scaleInfo.fpsKnown && td.t > m1L.t) {
          const wK1 = getWorldPt(m1L, 'kspPx'), wKTd = getWorldPt(td, 'kspPx');
          const dt1 = (td.t - m1L.t) * tScale;
          if (wK1 && wKTd && dt1 > 0.05) {
            const v1 = Math.abs(wKTd.x - wK1.x) / pxM / dt1;
            if (v1 > 5 && v1 < 12.5) v1Lms = Number(v1.toFixed(2));
          }
        }
      }
      if (to && land && scaleInfo.fpsKnown && land.t > to.t) {
        const wKTo = getWorldPt(to, 'kspPx'), wKLand = getWorldPt(land, 'kspPx');
        const dtF = (land.t - to.t) * tScale;
        if (wKTo && wKLand && dtF > 0.15) {
          const vf = Math.abs(wKLand.x - wKTo.x) / pxM / dtF;
          if (vf > 5.5 && vf < 11.5) vFlugMs = Number(vf.toFixed(2));
        }
      }
      if (vFlugMs && abflugTo && abflugTo > 5 && abflugTo < 40) {
        vVertikalMs = Number((vFlugMs * Math.tan((abflugTo * Math.PI) / 180)).toFixed(2));
      } else if (mkf && to && scaleInfo.fpsKnown && to.t > mkf.t) {
        const wMkf = getWorldPt(mkf, 'kspPx'), wTo = getWorldPt(to, 'kspPx');
        const dtUp = (to.t - mkf.t) * tScale;
        if (wMkf && wTo && dtUp > 0.02) {
          const vv = (wMkf.y - wTo.y) / pxM / dtUp;
          if (vv > 1.2 && vv < 4.5) vVertikalMs = Number(vv.toFixed(2));
        }
      }
      if (v1Lms && vFlugMs) {
        vVerlustMs = Number((v1Lms - vFlugMs).toFixed(2));
        if (vVertikalMs) geschwBilanz = Number((vVertikalMs - vVerlustMs).toFixed(2));
      }
      if (v1Lms || v2Lms) {
        erwartetM = predictExpectedDistanceFromSpeed(Math.max(v1Lms || 0, v2Lms || 0));
      }
      if (vFlugMs && vVertikalMs) {
        const g = 9.81;
        const dh = 0.42;
        const flightR = (vFlugMs / g) * (vVertikalMs + Math.sqrt(vVertikalMs * vVertikalMs + 2 * g * dh));
        effektivM = Number((flightR + (landeWeite || 0.58) + 0.15).toFixed(2));
      }

      if (m2L?.hipHeightPx) ksp2Lm = Number((m2L.hipHeightPx / pxM).toFixed(2));
      if (m1L?.hipHeightPx) ksp1Lm = Number((m1L.hipHeightPx / pxM).toFixed(2));
      if (td?.hipHeightPx) kspTdM = Number((td.hipHeightPx / pxM).toFixed(2));
      if (m2L?.hipHeightPx && td?.hipHeightPx) {
        const panDiffY = (td.panWorldPy || 0) - (m2L.panWorldPy || 0);
        kspAbsenkungM = Number(((m2L.hipHeightPx - td.hipHeightPx - 0.15 * panDiffY) / pxM).toFixed(2));
      }
    }

    return {
      stemmwinkel_deg: stemmTd !== null ? Number(stemmTd.toFixed(1)) : null,
      rumpfwinkel_td_deg: rumpfTd !== null ? Number(rumpfTd.toFixed(1)) : null,
      rumpfrotation_deg: rumpfRot,
      kniewinkel_min_deg: minSupportKnee !== null ? Number(minSupportKnee.toFixed(1)) : null,
      abflugwinkel_deg: abflugTo,
      schwungbein_winkel_deg: swingThighDeg !== null ? Number(swingThighDeg.toFixed(1)) : null,
      schwungbein_deg_s: swingVel,
      kopf_blickwinkel_to_deg: kopfBlickTo,
      lande_rumpfwinkel_deg: landeRumpf !== null ? Number(landeRumpf.toFixed(1)) : null,
      lande_kniewinkel_deg: landeKnie !== null ? Number(landeKnie.toFixed(1)) : null,
      lande_hueftwinkel_deg: landeHuefte !== null ? Number(landeHuefte.toFixed(1)) : null,
      landeweite_m: landeWeite,
      landeindex: landeIndex !== null ? Number(landeIndex.toFixed(2)) : null,
      knie_abstand_vorletzter_m: knieAbstand2L,
      step_2L_m: step2Lm,
      step_1L_m: step1Lm,
      step_1L_pct: step1Lpct,
      v_2L_ms: v2Lms,
      v_1L_ms: v1Lms,
      v_flug_ms: vFlugMs,
      v_vertikal_ms: vVertikalMs,
      v_verlust_absprung_ms: vVerlustMs,
      geschw_bilanz: geschwBilanz,
      erwartet_m: erwartetM,
      effektiv_m: effektivM,
      ksp_2L_m: ksp2Lm,
      ksp_1L_m: ksp1Lm,
      ksp_td_m: kspTdM,
      ksp_absenkung_m: kspAbsenkungM,
      schwungbein_knie_kompakt_deg: minSwingKnee !== null ? Number(minSwingKnee.toFixed(1)) : null,
      kontaktzeit_ms: kontaktMs
    };
  }

  function computeSummaryFromState(phaseMarks, angleHistory, overrideScaleInfo = null) {
    const raw = computeRawSummaryFromState(phaseMarks, angleHistory, overrideScaleInfo);
    const cal = { ...raw };
    CALIBRATABLE_KEYS.forEach(k => {
      if (raw[k] !== null && raw[k] !== undefined) {
        cal[k] = applyCalibrationToScalar(k, raw[k]);
      }
    });
    return cal;
  }

  function matchTrialForAnalysis(item) {
    const trials = getAllReferenceTrials();
    if (!item || !trials.length) return null;
    if (item.trialId) {
      const exact = trials.find(t => t.id === item.trialId);
      if (exact) return exact;
    }
    const titleLow = (item.title || '').toLowerCase();
    // 1. Match Video Filename
    const byVid = trials.find(t => {
      const rec = t.video_match?.recommended_video?.toLowerCase();
      if (rec && titleLow.includes(rec)) return true;
      return (t.video_match?.all_attempt_videos || []).some(v => titleLow.includes(v.toLowerCase()));
    });
    if (byVid) return byVid;
    // 2. Match DLV display_ref (z.B. "23.05.2026 / Versuch 5")
    return trials.find(t => t.display_ref && titleLow.includes(t.display_ref.toLowerCase())) || null;
  }

  function compactPhaseMarksForCal(marks) {
    const out = {};
    ['2L', '1L', 'TD', 'MKF', 'TO', 'LAND'].forEach(ph => {
      if (marks && marks[ph]) out[ph] = marks[ph];
    });
    return out;
  }

  function upsertCalibrationPair(bm, marks, hist, scaleInfo, videoName) {
    if (!bm || !marks || !marks.TD || !marks.TO) return false;
    const raw = computeRawSummaryFromState(marks, hist, scaleInfo);
    const gt = {};
    CALIBRATABLE_KEYS.forEach(k => {
      if (bm[k] !== null && bm[k] !== undefined) gt[k] = Number(bm[k]);
    });
    const pairs = getCalibrationPairs().filter(p => p.trialId !== bm.id);
    pairs.unshift({
      trialId: bm.id,
      modelVersion: CAL_MODEL_VERSION,
      label: bm.label,
      display_ref: bm.display_ref || bm.date,
      videoFilename: videoName || bm.video_match?.recommended_video || 'manuell',
      calibratedAt: new Date().toISOString(),
      scaleInfo: scaleInfo || null,
      phaseMarks: compactPhaseMarksForCal(marks),
      angleHistory: (hist || []).filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 80)) === 0),
      rawSummary: raw,
      groundTruth: gt
    });
    saveCalibrationPairs(pairs);
    try { localStorage.setItem(CAL_ENABLED_KEY, 'true'); } catch (e) {}
    return true;
  }

  async function retroactivelyUpgradeDatabase() {
    if (!calibrationProfile) return 0;
    const items = await dbGetAll();
    const pairs = getCalibrationPairs();
    const pairMap = new Map(pairs.map(p => [p.trialId, p]));
    let upgradedCount = 0;

    // 1. Re-evaluate any saved calibration_pairs that already carry phaseMarks
    pairMap.forEach((p, tId) => {
      const bm = getAllReferenceTrials().find(t => t.id === tId);
      if (p.phaseMarks && p.phaseMarks.TD && p.phaseMarks.TO) {
        const newRaw = computeRawSummaryFromState(p.phaseMarks, p.angleHistory || [], p.scaleInfo || null);
        const gt = {};
        if (bm) CALIBRATABLE_KEYS.forEach(k => { if (bm[k] != null) gt[k] = Number(bm[k]); });
        pairMap.set(tId, {
          ...p,
          modelVersion: CAL_MODEL_VERSION,
          rawSummary: newRaw,
          groundTruth: Object.keys(gt).length ? gt : p.groundTruth
        });
        upgradedCount++;
      }
    });

    // 2. Link & re-extract EVERY archived OSP analysis (so already marked videos NEVER need re-clicking!)
    for (const item of items) {
      const bm = matchTrialForAnalysis(item);
      if (bm && item.phaseMarks && item.phaseMarks.TD && item.phaseMarks.TO) {
        const newRaw = computeRawSummaryFromState(item.phaseMarks, item.angleHistory || [], item.scaleInfo || null);
        const gt = {};
        CALIBRATABLE_KEYS.forEach(k => { if (bm[k] != null) gt[k] = Number(bm[k]); });
        const prev = pairMap.get(bm.id) || {};
        pairMap.set(bm.id, {
          ...prev,
          trialId: bm.id,
          modelVersion: CAL_MODEL_VERSION,
          label: bm.label,
          display_ref: bm.display_ref || bm.date,
          videoFilename: prev.videoFilename || item.title || bm.video_match?.recommended_video || 'archiv',
          calibratedAt: prev.calibratedAt || item.createdAt || new Date().toISOString(),
          scaleInfo: item.scaleInfo || prev.scaleInfo || null,
          phaseMarks: compactPhaseMarksForCal(item.phaseMarks),
          rawSummary: newRaw,
          groundTruth: gt
        });
        upgradedCount++;
      }
    }

    const updatedPairs = [...pairMap.values()];
    if (updatedPairs.length > 0) saveCalibrationPairs(updatedPairs);

    // 3. Refresh all archived summaries with latest calibrated model
    for (const item of items) {
      if (item.phaseMarks && (item.phaseMarks.TD || item.phaseMarks.TO)) {
        const newRaw = computeRawSummaryFromState(item.phaseMarks, item.angleHistory || [], item.scaleInfo || null);
        const newSum = computeSummaryFromState(item.phaseMarks, item.angleHistory || [], item.scaleInfo || null);
        const matched = matchTrialForAnalysis(item);
        const changed = (item.modelVersion || 1) < CAL_MODEL_VERSION || JSON.stringify(item.summary) !== JSON.stringify(newSum);
        if (changed) {
          await dbPut({
            ...item,
            trialId: item.trialId || matched?.id || null,
            modelVersion: CAL_MODEL_VERSION,
            rawSummary: newRaw,
            summary: newSum,
            calibrated: updatedPairs.length > 0 && isCalibrationEnabled()
          });
        }
      }
    }
    return upgradedCount;
  }

  function saveCalibrationPairFromCurrent() {
    const bm = getSelectedBenchmark();
    if (!bm) return;
    const marks = runtime.getPhaseMarks ? runtime.getPhaseMarks() : {};
    const hist = runtime.getAngleHistory ? runtime.getAngleHistory() : [];
    const scaleInfo = runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : {};
    if (!marks.TD || !marks.TO) {
      alert('Bitte mindestens Touchdown (TD), Max. Beugung (MKF) und Take-off (TO) — idealerweise auch 🏖️ Landung (LAND) — markieren, um gegen die DLV-Zeile zu kalibrieren.');
      return;
    }

    upsertCalibrationPair(bm, marks, hist, scaleInfo, currentVideoFilename);
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
    const { models, offsets, counts, usingLegacyV1, v2Count } = computeCalibrationModels(pairs);

    if (pairs.length === 0) {
      box.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span class="font-bold text-amber-300 font-mono">🔬 Noch keine DLV-Kalibrierungs-Paare hinterlegt (Roh-Modell v2 aktiv).</span>
            <p class="text-[11px] text-slate-400 mt-0.5">
              1️⃣ Wähle rechts deinen DLV-Referenzsprung &amp; lade das <code>wm...mp4</code>.<br>
              2️⃣ Markiere <b>(2L / 1L →) TD → MKF → TO → Landung</b> ➔ Speichern oder <b>„🎯 Auf diesen DLV-Sprung kalibrieren“</b> lernt automatisch in die Datenbank!
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
      const mod = models[k] || { slope: 1, intercept: 0, mode: 'identity' };
      const off = offsets[k] || 0;
      const col = Math.abs(off) < 1.0 ? 'text-emerald-400' : 'text-cyan-300';
      const labelTxt = mod.mode === 'ridge'
        ? `${mod.slope.toFixed(2)}x${mod.intercept >= 0 ? '+' : ''}${mod.intercept.toFixed(1)}`
        : `${off >= 0 ? '+' : ''}${off}${u}`;
      return `<span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">${lbl}: <b class="${col}">${labelTxt}</b> <span class="text-slate-500">(n=${counts[k]})</span></span>`;
    }).join(' ');

    const pairsHtml = pairs.map(p => {
      const isV2 = (p.modelVersion || 1) >= CAL_MODEL_VERSION;
      const angKeys = CALIBRATABLE_KEYS.filter(k => !isMeterOrSpeedKey(k) && k !== 'schwungbein_deg_s');
      const errs = angKeys.map(k => {
        const r = p.rawSummary?.[k];
        const gt = p.groundTruth?.[k];
        if (typeof r !== 'number' || typeof gt !== 'number') return null;
        const mod = models[k];
        const cal = mod ? (mod.slope * r + mod.intercept) : r;
        return { rawErr: Math.abs(gt - r), calErr: Math.abs(gt - cal) };
      }).filter(Boolean);
      const maeRaw = errs.length ? (errs.reduce((s, e) => s + e.rawErr, 0) / errs.length) : null;
      const maeCal = errs.length ? (errs.reduce((s, e) => s + e.calErr, 0) / errs.length) : null;
      return `
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border ${isV2 ? 'border-emerald-800/70' : 'border-amber-800/60'} rounded-lg px-2.5 py-1.5 text-[10px] font-mono">
          <div>
            <span class="px-1 py-0.5 rounded mr-1 text-[9px] font-bold ${isV2 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}">${isV2 ? 'Ridge v2' : 'v1'}</span>
            <strong class="text-white">${p.display_ref}</strong>
            <span class="text-cyan-300 ml-1">(${p.videoFilename})</span>
            ${maeRaw !== null ? `<span class="text-slate-400 ml-2">Winkel-MAE: Roh ${maeRaw.toFixed(1)}° ➔ Modell <b class="text-emerald-400">${maeCal.toFixed(1)}°</b></span>` : ''}
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
              ${enabled ? `✅ OSP/DLV-KALIBRIERUNG v2 (${v2Count > 0 ? v2Count + 'x v2' : pairs.length + 'x v1'})` : '⏸️ DLV-Kalibrierung pausiert (Rohwerte)'}
            </span>
            <label class="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-300 cursor-pointer">
              <input type="checkbox" ${enabled ? 'checked' : ''} onchange="VideoBiomechanicsModule.setCalibrationEnabled(this.checked)" class="rounded bg-slate-900 border-slate-700 text-emerald-500">
              <span>Kalibrierte DLV-Skala auf Trainingssprünge anwenden</span>
            </label>
          </div>
        </div>
        ${usingLegacyV1 ? `<div class="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded px-2.5 py-1.5 font-sans">⚠️ Einzelne Alt-Paare besitzen noch keine gespeicherten Raw-Phasenmarker. Alle neu oder im Archiv mit Phasen markierten OSP-Videos verbessern ab sofort automatisch &amp; rückwirkend das Ridge-Modell.</div>` : ''}
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

  function updateComparisonTable(phaseMarks, angleHistory, overrideScaleInfo = null) {
    const tbody = document.getElementById('dlvComparisonBody');
    const feedbackBox = document.getElementById('dlvAutoDiagnosisBox');
    if (!tbody) return;

    const rawSummary = computeRawSummaryFromState(phaseMarks, angleHistory, overrideScaleInfo);
    const summary = computeSummaryFromState(phaseMarks, angleHistory, overrideScaleInfo);
    const { offsets, models } = computeCalibrationModels(getCalibrationPairs());
    const calActive = isCalibrationEnabled() && getCalibrationPairs().length > 0;
    const bm = getSelectedBenchmark();
    const scaleInfo = overrideScaleInfo || (runtime.getVideoScaleInfo ? runtime.getVideoScaleInfo() : { fpsKnown: false, pxPerMeter: null, isManualScale: false });

    const groups = [
      {
        title: '🚀 ABSPRUNG-BIOMECHANIK (OSP INFO 2 & 3)',
        rows: [
          { key: 'stemmwinkel_deg', label: 'Stemmwinkel beim TD', raw: rawSummary.stemmwinkel_deg, val: summary.stemmwinkel_deg, bm: bm?.stemmwinkel_deg, unit: '°', norm: '22 – 28°' },
          { key: 'rumpfwinkel_td_deg', label: 'Rumpfwinkel TD (>90° = Rücklage)', raw: rawSummary.rumpfwinkel_td_deg, val: summary.rumpfwinkel_td_deg, bm: bm?.rumpfwinkel_td_deg, unit: '°', norm: '95 – 102°' },
          { key: 'rumpfrotation_deg', label: 'Rumpfrotation (TD → TO)', raw: rawSummary.rumpfrotation_deg, val: summary.rumpfrotation_deg, bm: bm?.rumpfrotation_deg, unit: '°', norm: '4 – 12°' },
          { key: 'kniewinkel_min_deg', label: 'Amortisation Stützbein-Knie min.', raw: rawSummary.kniewinkel_min_deg, val: summary.kniewinkel_min_deg, bm: bm?.kniewinkel_min_deg, unit: '°', norm: '> 134°' },
          { key: 'abflugwinkel_deg', label: 'Abflugwinkel des KSP (Welt-Pan)', raw: rawSummary.abflugwinkel_deg, val: summary.abflugwinkel_deg, bm: bm?.abflugwinkel_deg, unit: '°', norm: '> 19°' },
          { key: 'schwungbein_winkel_deg', label: 'Schwungbein-Oberschenkel vs. Horiz.', raw: rawSummary.schwungbein_winkel_deg, val: summary.schwungbein_winkel_deg, bm: bm?.schwungbein_winkel_deg, unit: '°', norm: '> -13°' },
          { key: 'schwungbein_deg_s', label: 'Schwungbein-Geschw. Ø (TD → TO)', raw: rawSummary.schwungbein_deg_s, val: summary.schwungbein_deg_s, bm: bm?.schwungbein_deg_s, unit: '°/s', norm: '> 730 °/s' },
          { key: 'kopf_blickwinkel_to_deg', label: 'Kopf-Blickachse nach Abflug (TO+)', raw: rawSummary.kopf_blickwinkel_to_deg, val: summary.kopf_blickwinkel_to_deg, bm: null, unit: '°', norm: '≥ 0° stabil (< -10° ↓)' }
        ]
      },
      {
        title: '⚡ GESCHWINDIGKEIT, SCHRITTLÄNGE & WEITEN-BILANZ (OSP INFO 1 & 6)',
        rows: [
          { key: 'erwartet_m', label: 'Erwartete / Eff. Weite (aus V_Anlauf & Flug)', raw: null, val: summary.erwartet_m !== null ? `${summary.erwartet_m} m${summary.effektiv_m ? ` / eff. ~${summary.effektiv_m} m` : ''}` : null, bm: bm?.erwartet_m ? `${bm.erwartet_m} m / eff. ${bm.effektiv_m} m` : null, unit: '', norm: 'DLV-Regression' },
          { key: 'v_1L_ms', label: 'Anlauf-Speed V_2L / V_1L (Welt-Pan)', raw: null, val: summary.v_1L_ms !== null ? `${summary.v_2L_ms ?? '—'} / ${summary.v_1L_ms}` : null, bm: bm?.v_1L_ms ? `${bm.v_2L_ms ?? '—'} / ${bm.v_1L_ms}` : null, unit: 'm/s', norm: '> 10,30 m/s' },
          { key: 'v_flug_ms', label: 'Abflugspeed Horizontal (V_Flug) / Vertikal', raw: null, val: summary.v_flug_ms !== null ? `${summary.v_flug_ms} / ${summary.v_vertikal_ms ?? '—'}` : null, bm: bm?.v_flug_ms ? `${bm.v_flug_ms} / ${bm.v_vertikal_ms ?? '—'}` : null, unit: 'm/s', norm: 'V_v > 3,20 m/s' },
          { key: 'geschw_bilanz', label: 'V-Verlust / Geschw.-Bilanz (V_vert − V_verl)', raw: null, val: summary.v_verlust_absprung_ms !== null ? `${summary.v_verlust_absprung_ms} / ${summary.geschw_bilanz !== null ? (summary.geschw_bilanz >= 0 ? '+' : '') + summary.geschw_bilanz : '—'}` : null, bm: bm?.geschw_bilanz != null ? `${bm.v_verlust_absprung_ms} / ${bm.geschw_bilanz >= 0 ? '+' : ''}${bm.geschw_bilanz}` : null, unit: 'm/s', norm: '> 0,0 m/s' },
          { key: 'step_2L_m', label: 'Schrittlänge vorletzter (2L) / letzter (1L)', raw: null, val: summary.step_2L_m !== null ? `${summary.step_2L_m} / ${summary.step_1L_m ?? '—'}${summary.step_1L_pct != null ? ` (${summary.step_1L_pct >= 0 ? '+' : ''}${summary.step_1L_pct}%)` : ''}` : null, bm: bm?.step_2L_m ? `${bm.step_2L_m} / ${bm.step_1L_m} (${bm.step_1L_pct ?? '—'}%)` : null, unit: 'm', norm: '2L > 1L' },
          { key: 'knie_abstand_vorletzter_m', label: 'Knie-Knie-Abstand im vorletzten Stütz (2L)', raw: rawSummary.knie_abstand_vorletzter_m, val: summary.knie_abstand_vorletzter_m, bm: bm?.knie_abstand_vorletzter_m, unit: 'm', norm: '-0,05 – +0,05 m' },
          { key: 'ksp_absenkung_m', label: 'KSP-Absenkung (2L → TD)', raw: rawSummary.ksp_absenkung_m, val: summary.ksp_absenkung_m, bm: bm?.ksp_absenkung_m, unit: 'm', norm: '0,03 – 0,06 m' }
        ]
      },
      {
        title: '🏖️ LANDUNG & ZUSATZ-INDIKATOREN (OSP INFO 4 & 5)',
        rows: [
          { key: 'landeweite_m', label: 'Landeweite (Ferse vs. KSP-Projektion)', raw: rawSummary.landeweite_m, val: summary.landeweite_m, bm: bm?.landeweite_m, unit: 'm', norm: '> 0,43 m' },
          { key: 'landeindex', label: 'Landeindex (Körperlage zu Ferse)', raw: rawSummary.landeindex, val: summary.landeindex, bm: bm?.landeindex, unit: '', norm: '1,5 – 2,2' },
          { key: 'lande_rumpfwinkel_deg', label: 'Rumpfwinkel Landung', raw: rawSummary.lande_rumpfwinkel_deg, val: summary.lande_rumpfwinkel_deg, bm: bm?.lande_rumpfwinkel_deg, unit: '°', norm: '64 – 104°' },
          { key: 'lande_kniewinkel_deg', label: 'Kniewinkel Landebein', raw: rawSummary.lande_kniewinkel_deg, val: summary.lande_kniewinkel_deg, bm: bm?.lande_kniewinkel_deg, unit: '°', norm: '> 125°' },
          { key: 'lande_hueftwinkel_deg', label: 'Hüftwinkel Landebein', raw: rawSummary.lande_hueftwinkel_deg, val: summary.lande_hueftwinkel_deg, bm: bm?.lande_hueftwinkel_deg, unit: '°', norm: '70 – 114°' },
          { key: 'schwungbein_knie_kompakt_deg', label: 'Zusatz: Schwungbein-Kniewinkel (Kompaktheit)', raw: rawSummary.schwungbein_knie_kompakt_deg, val: summary.schwungbein_knie_kompakt_deg, bm: 88, unit: '°', norm: '60 – 95° (eng)' },
          { key: 'kontaktzeit_ms', label: `Zusatz (kein DLV-Vergleich): Bodenkontakt TD → TO ${scaleInfo.fpsKnown ? '' : '(FPS ?)'}`, raw: rawSummary.kontaktzeit_ms, val: summary.kontaktzeit_ms, bm: null, unit: 'ms', norm: 'Informativ (FPS-abh.)', customTag: 'ℹ️ FPS-Richtwert' }
        ]
      }
    ];

    let html = '';
    groups.forEach(g => {
      html += `<tr class="bg-slate-950/90"><td colspan="6" class="py-1.5 px-2 text-[10px] font-mono font-black text-cyan-400 tracking-wider border-b border-slate-800">${g.title}</td></tr>`;
      g.rows.forEach(r => {
        const isNumericVal = typeof r.val === 'number';
        const st = r.customTag
          ? { cls: 'text-amber-300 border-amber-700/60 bg-amber-950/20', tag: r.customTag }
          : (isNumericVal ? statusClass(r.key, r.val) : { cls: 'text-cyan-300 border-slate-700', tag: 'Info' });
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
      if (summary.kopf_blickwinkel_to_deg !== null && summary.kopf_blickwinkel_to_deg !== undefined) {
        if (summary.kopf_blickwinkel_to_deg < -10) {
          notes.push(`🔴 <b>Kopf / Blickachse sinkt nach Abflug ab (${summary.kopf_blickwinkel_to_deg}°):</b> Blick stabil nach schräg-oben/vorn halten statt Kinn einzuziehen!`);
        } else {
          notes.push(`✅ <b>Kopf / Blickachse stabil (${summary.kopf_blickwinkel_to_deg >= 0 ? '+' : ''}${summary.kopf_blickwinkel_to_deg}°):</b> Aufrechte Kopf-Hals-Führung direkt nach dem Take-off.`);
        }
      }
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
      if (summary.kontaktzeit_ms !== null) {
        notes.push(`ℹ️ <b>Bodenkontaktzeit (${summary.kontaktzeit_ms} ms):</b> Rein informativer Richtwert (im DLV-Protokoll nicht gemessen; ±1 Frame entspricht bei 50 fps ≈ 20 ms, bei 200 fps ≈ 5 ms).`);
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
    renderGraphicalDlvCharts(summary, bm);
  }

  function renderGraphicalDlvCharts(summary, bm) {
    const box = document.getElementById('dlvGraphicalChartsBox');
    if (!box || !calibrationProfile || typeof Chart === 'undefined') return;
    if (!box.querySelector('#dlvChartSpeedDist')) {
      box.innerHTML = `
        <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-xs font-black text-cyan-300 font-mono uppercase">📊 OSP/DLV GRAFISCHE GESAMT-AUSWERTUNG (DEINE 31 DLV-SPRÜNGE + AKTUELLES VIDEO)</h4>
            <span id="dlvExpectedDistBadge" class="text-[11px] font-mono font-bold text-emerald-300"></span>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <div class="text-[11px] font-mono font-bold text-amber-300 mb-1">1. Trend V-Anlauf / Eff. Weite (+ Erwartete Weite)</div>
              <div class="h-52"><canvas id="dlvChartSpeedDist"></canvas></div>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <div class="text-[11px] font-mono font-bold text-amber-300 mb-1">2. Trend V-vertikal / V-Verlust (Geschw.-Bilanz)</div>
              <div class="h-52"><canvas id="dlvChartVertLoss"></canvas></div>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <div class="text-[11px] font-mono font-bold text-cyan-300 mb-1">3. Geschwindigkeit &amp; Verlust (3L → 2L → 1L → Flug)</div>
              <div class="h-48"><canvas id="dlvChartVelProfile"></canvas></div>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <div class="text-[11px] font-mono font-bold text-cyan-300 mb-1">4. Schrittlänge (3L / 2L / 1L) &amp; Knie-Knie 2L</div>
              <div class="h-48"><canvas id="dlvChartSteps"></canvas></div>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 lg:col-span-2">
              <div class="text-[11px] font-mono font-bold text-emerald-300 mb-1">5. KSP-Höhe (3L → 2L → 1L → TD) &amp; Absenkung vor Absprung (Norm: 0,03–0,06 m)</div>
              <div class="h-44"><canvas id="dlvChartKspHeight"></canvas></div>
            </div>
          </div>
        </div>
      `;
    }

    const expBadge = document.getElementById('dlvExpectedDistBadge');
    if (expBadge) {
      const refTxt = bm?.erwartet_m ? `Ref Erwartet ${bm.erwartet_m} m / Eff. ${bm.effektiv_m} m` : '';
      const vidTxt = summary?.erwartet_m ? `Video Erwartet ${summary.erwartet_m} m${summary.effektiv_m ? ` / Eff. ~${summary.effektiv_m} m` : ''}` : 'Video: 2L/1L/TD/LAND markieren für V & Erwartet';
      expBadge.textContent = refTxt ? `${refTxt} • ${vidTxt}` : vidTxt;
    }

    const trials = getAllReferenceTrials();
    const destroyChart = (id) => { if (dlvChartInstances[id]) { dlvChartInstances[id].destroy(); delete dlvChartInstances[id]; } };

    // 1. Scatter: V_Anlauf vs Eff. Weite
    destroyChart('speedDist');
    const c1 = document.getElementById('dlvChartSpeedDist');
    if (c1) {
      const ptsHist = trials.map(t => {
        const vx = Math.max(t.v_3L_ms || 0, t.v_2L_ms || 0, t.v_1L_ms || 0);
        return (vx > 8 && t.effektiv_m > 6.5) ? { x: vx, y: t.effektiv_m, lbl: t.display_ref } : null;
      }).filter(Boolean);
      const ptsRef = bm ? (() => {
        const vx = Math.max(bm.v_3L_ms || 0, bm.v_2L_ms || 0, bm.v_1L_ms || 0);
        return (vx > 8 && bm.effektiv_m) ? [{ x: vx, y: bm.effektiv_m, lbl: 'Ref: ' + bm.display_ref }] : [];
      })() : [];
      const curVx = Math.max(summary?.v_2L_ms || 0, summary?.v_1L_ms || 0);
      const ptsCur = (curVx > 7 && summary?.effektiv_m) ? [{ x: curVx, y: summary.effektiv_m, lbl: 'Aktuelles Video' }] : [];
      const linePts = [9.8, 10.2, 10.6, 10.9].map(v => ({ x: v, y: predictExpectedDistanceFromSpeed(v) }));
      dlvChartInstances.speedDist = new Chart(c1, {
        type: 'scatter',
        data: {
          datasets: [
            { label: 'Erwartete Weite (DLV-Trend)', type: 'line', data: linePts, borderColor: '#10b981', borderDash: [5, 4], borderWidth: 2, pointRadius: 0 },
            { label: 'Luka DLV-Historie', data: ptsHist, backgroundColor: 'rgba(148, 163, 184, 0.7)', pointRadius: 4.5 },
            { label: 'Ausgewählte Ref.', data: ptsRef, backgroundColor: '#f59e0b', borderColor: '#fff', borderWidth: 1.5, pointRadius: 7 },
            { label: 'Dein Video', data: ptsCur, backgroundColor: '#22d3ee', borderColor: '#fff', borderWidth: 2, pointRadius: 8, pointStyle: 'rectRot' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
          scales: {
            x: { title: { display: true, text: 'V_Anlauf max (m/s)', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { title: { display: true, text: 'Eff. Weite (m)', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
          }
        }
      });
    }

    // 2. Scatter: V_vertikal vs V_Verlust
    destroyChart('vertLoss');
    const c2 = document.getElementById('dlvChartVertLoss');
    if (c2) {
      const ptsH = trials.filter(t => t.v_verlust_absprung_ms && t.v_vertikal_ms).map(t => ({ x: t.v_verlust_absprung_ms, y: t.v_vertikal_ms }));
      const ptsR = (bm?.v_verlust_absprung_ms && bm?.v_vertikal_ms) ? [{ x: bm.v_verlust_absprung_ms, y: bm.v_vertikal_ms }] : [];
      const ptsC = (summary?.v_verlust_absprung_ms && summary?.v_vertikal_ms) ? [{ x: summary.v_verlust_absprung_ms, y: summary.v_vertikal_ms }] : [];
      const balLine = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0].map(x => ({ x, y: Math.min(3.8, x + 1.6) })); // +1.6 m/s Richt-Band
      const zeroBal = [1.0, 1.5, 2.0, 2.5, 3.0].map(x => ({ x, y: x }));
      dlvChartInstances.vertLoss = new Chart(c2, {
        type: 'scatter',
        data: {
          datasets: [
            { label: 'Top-Bilanz (+1,6)', type: 'line', data: balLine, borderColor: '#10b981', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
            { label: 'Bilanz = 0 (Grenze)', type: 'line', data: zeroBal, borderColor: '#f43f5e', borderDash: [3, 3], borderWidth: 1.2, pointRadius: 0 },
            { label: 'Luka DLV-Historie', data: ptsH, backgroundColor: 'rgba(148, 163, 184, 0.7)', pointRadius: 4.5 },
            { label: 'Ref.', data: ptsR, backgroundColor: '#f59e0b', pointRadius: 7 },
            { label: 'Dein Video', data: ptsC, backgroundColor: '#22d3ee', pointRadius: 8, pointStyle: 'rectRot' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
          scales: {
            x: { title: { display: true, text: 'V-Verlust Absprung (m/s)', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { title: { display: true, text: 'V-vertikal Abflug (m/s)', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
          }
        }
      });
    }

    // 3. Velocity Profile 3L -> 2L -> 1L -> Flug
    destroyChart('velProf');
    const c3 = document.getElementById('dlvChartVelProfile');
    if (c3) {
      dlvChartInstances.velProf = new Chart(c3, {
        type: 'line',
        data: {
          labels: ['3L', '2L', '1L', 'Flug (Horiz)'],
          datasets: [
            { label: 'Ref (' + (bm?.display_ref || 'DLV') + ')', data: [bm?.v_3L_ms ?? null, bm?.v_2L_ms ?? null, bm?.v_1L_ms ?? null, bm?.v_flug_ms ?? null], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', tension: 0.25, spanGaps: true, pointRadius: 4 },
            { label: 'Dein Video (Welt-Pan)', data: [null, summary?.v_2L_ms ?? null, summary?.v_1L_ms ?? null, summary?.v_flug_ms ?? null], borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.15)', tension: 0.25, spanGaps: true, pointRadius: 5 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { min: 7.5, max: 11.4, title: { display: true, text: 'm/s', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
          }
        }
      });
    }

    // 4. Step lengths 3L / 2L / 1L
    destroyChart('steps');
    const c4 = document.getElementById('dlvChartSteps');
    if (c4) {
      dlvChartInstances.steps = new Chart(c4, {
        type: 'bar',
        data: {
          labels: ['3L (m)', '2L (m)', '1L (m)', 'Knie-Knie 2L (m)'],
          datasets: [
            { label: 'Ref (' + (bm?.display_ref || 'DLV') + ')', data: [bm?.step_3L_m ?? 0, bm?.step_2L_m ?? 0, bm?.step_1L_m ?? 0, bm?.knie_abstand_vorletzter_m ?? 0], backgroundColor: 'rgba(245,158,11,0.75)' },
            { label: 'Dein Video (Welt-Pan)', data: [0, summary?.step_2L_m ?? 0, summary?.step_1L_m ?? 0, summary?.knie_abstand_vorletzter_m ?? 0], backgroundColor: 'rgba(34,211,238,0.85)' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
          }
        }
      });
    }

    // 5. KSP Height Profile (3L -> 2L -> 1L -> TD)
    destroyChart('kspH');
    const c5 = document.getElementById('dlvChartKspHeight');
    if (c5) {
      dlvChartInstances.kspH = new Chart(c5, {
        type: 'line',
        data: {
          labels: ['3L', '2L', '1L', 'TD (Brett)'],
          datasets: [
            { label: 'Ref KSP-Höhe (' + (bm?.display_ref || 'DLV') + ')', data: [bm?.ksp_3L_m ?? null, bm?.ksp_2L_m ?? null, bm?.ksp_1L_m ?? null, bm?.ksp_td_m ?? null], borderColor: '#f59e0b', tension: 0.25, spanGaps: true, pointRadius: 5 },
            { label: 'Dein Video KSP-Höhe', data: [null, summary?.ksp_2L_m ?? null, summary?.ksp_1L_m ?? null, summary?.ksp_td_m ?? null], borderColor: '#10b981', tension: 0.25, spanGaps: true, pointRadius: 5 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { suggestedMin: 0.80, suggestedMax: 1.05, title: { display: true, text: 'KSP-Höhe (m)', color: '#94a3b8', font: { size: 10 } }, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
          }
        }
      });
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
      modelVersion: CAL_MODEL_VERSION,
      trialId: matchTrialForAnalysis({ title: (titleEl?.value || '').trim() })?.id || (currentVideoFilename ? matchTrialForAnalysis({ title: currentVideoFilename })?.id : null) || null,
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

    // Selbstlernende DB: Wenn Analyse zu einem ausgewerteten DLV-Sprung gehört, Modell direkt erweitern!
    const matchedBm = matchTrialForAnalysis(record) || ((currentVideoFilename && getSelectedBenchmark()) ? autoDetectTrialByFilename(currentVideoFilename) : null);
    if (matchedBm && phaseMarks.TD && phaseMarks.TO) {
      record.trialId = matchedBm.id;
      upsertCalibrationPair(matchedBm, phaseMarks, angleHistory, scaleInfo, currentVideoFilename || record.title);
      record.summary = computeSummaryFromState(phaseMarks, angleHistory, scaleInfo);
      record.calibrated = isCalibrationEnabled();
    }

    await dbPut(record);
    if (titleEl) titleEl.value = '';
    if (markEl) markEl.value = '';
    if (notesEl) notesEl.value = '';
    renderCalibrationModelPanel();
    updateComparisonTable(phaseMarks, angleHistory, scaleInfo);
    await refreshArchiveList();
    scheduleVideoAutoPush();
    const btn = document.getElementById('saveArchiveBtn');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = matchedBm ? '✅ Gespeichert + Kalibriert!' : '✅ Gespeichert!';
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
      if (!p || !p.trialId) return;
      const existing = pairMap.get(p.trialId);
      if (!existing) {
        pairMap.set(p.trialId, p);
      } else {
        const mvNew = p.modelVersion || 1;
        const mvOld = existing.modelVersion || 1;
        if (mvNew > mvOld || (mvNew === mvOld && (p.calibratedAt || '') >= (existing.calibratedAt || ''))) {
          pairMap.set(p.trialId, p);
        }
      }
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

    await retroactivelyUpgradeDatabase();
    lastVideoSyncNote = `☁️ Sync ${new Date(remote.updated_at || Date.now()).toLocaleDateString('de-DE')} (${added > 0 ? `+${added} neu` : 'aktuell'})`;
    renderCalibrationModelPanel();
    await refreshArchiveList();
    renderVideoSyncStatusBar();
    if (forceAlert) alert(`✅ Video-Archiv & Kalibrierung synchronisiert! (${getCalibrationPairs().length} Kalibrier-Paare, +${added} Analysen übernommen)`);
    return true;
  }

  async function pushVideoBioToGitHub(quiet = false) {
    clearTimeout(videoAutoPushTimer);
    videoAutoPushTimer = null;
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
      lastVideoSyncNote = '⏳ Auto-Push gebündelt (25s)...';
      renderVideoSyncStatusBar();
      videoAutoPushTimer = setTimeout(() => { pushVideoBioToGitHub(true); }, 25000);
    }
  }

  async function loadFromArchive(id) {
    const item = cachedArchive.find(x => x.id === id);
    if (!item) return;
    const matched = matchTrialForAnalysis(item);
    if (matched) {
      selectedTrialId = matched.id;
      const sel = document.getElementById('dlvBenchmarkSelect');
      if (sel) sel.value = matched.id;
      renderSelectedTrialHint();
    }
    if (runtime.loadSavedAnalysisToView) runtime.loadSavedAnalysisToView(item);
    updateComparisonTable(item.phaseMarks || {}, item.angleHistory || [], item.scaleInfo || null);
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
    await retroactivelyUpgradeDatabase();
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
    applyCalibrationToScalar,
    retroactivelyUpgradeDatabase,
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
