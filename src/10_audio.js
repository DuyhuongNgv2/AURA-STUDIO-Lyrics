/* ============================================================
   JIZURA — audio: decode, energy envelope, onset, BPM & beat grid
   ============================================================ */
(() => {
'use strict';

J.analyzeAudio = async (file) => {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let audioBuffer;
  try { audioBuffer = await ac.decodeAudioData(buf.slice(0)); } finally { try { ac.close(); } catch (e) {} }
  const sr = audioBuffer.sampleRate, len = audioBuffer.length, ch = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = audioBuffer.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const rate = 50, hop = Math.round(sr / rate), n = Math.floor(len / hop);
  const energy = new Float32Array(n), flux = new Float32Array(n);
  let prevHP = 0, prevX = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, eh = 0;
    for (let i = f * hop, end = Math.min(len, (f + 1) * hop); i < end; i++) {
      const x = mono[i]; e += x * x;
      const hp = 0.92 * (prevHP + x - prevX); prevHP = hp; prevX = x; eh += hp * hp;
    }
    energy[f] = Math.sqrt(e / hop);
    flux[f] = Math.sqrt(eh / hop);
  }
  // onset strength: positive change of log high-passed energy vs local mean
  const onset = new Float32Array(n);
  for (let f = 1; f < n; f++) {
    const cur = Math.log(1e-4 + flux[f]);
    let m = 0, k = 0; for (let j = Math.max(0, f - 4); j < f; j++) { m += Math.log(1e-4 + flux[j]); k++; }
    onset[f] = Math.max(0, cur - m / Math.max(1, k));
  }
  // tempo via autocorrelation (70..180 BPM)
  const minLag = Math.round(rate * 60 / 180), maxLag = Math.round(rate * 60 / 70);
  let best = 0, bestLag = Math.round(rate * 0.5);
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let f = lag; f < n; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 * rate / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.7, 2));
    s *= w; scores[lag] = s;
    if (s > best) { best = s; bestLag = lag; }
  }
  let lagF = bestLag;
  if (scores[bestLag - 1] != null && scores[bestLag + 1] != null) {
    const a = scores[bestLag - 1], b = scores[bestLag], c = scores[bestLag + 1];
    const d = (a - 2 * b + c); if (d !== 0) lagF = bestLag + 0.5 * (a - c) / d;
  }
  const period = lagF / rate;
  // phase
  let bestPh = 0, bestPS = -1;
  for (let ph = 0; ph < lagF; ph += 0.5) {
    let s = 0; for (let t = ph; t < n; t += lagF) s += onset[Math.round(t)] || 0;
    if (s > bestPS) { bestPS = s; bestPh = ph; }
  }
  const beats = [];
  for (let t = bestPh / rate; t < audioBuffer.duration; t += period) beats.push(+t.toFixed(4));
  // normalised energy (0..1, 95th percentile)
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const energyN = new Float32Array(n);
  for (let f = 0; f < n; f++) energyN[f] = Math.min(1, energy[f] / p95);
  // waveform peaks for the timeline (v0.16.0: 8192 bins, normalised to the 95th percentile like energyN,
  // so quiet songs still show a readable wave and loud/clipped ones never flatten past 1.0)
  const bins = 8192, peaks = new Float32Array(bins), per = Math.max(1, Math.floor(len / bins));
  for (let b = 0; b < bins; b++) { let m = 0; for (let i = b * per, e = Math.min(len, (b + 1) * per); i < e; i += 4) { const v = Math.abs(mono[i]); if (v > m) m = v; } peaks[b] = m; }
  const psorted = Array.from(peaks).sort((a, b) => a - b);
  const pp95 = psorted[Math.floor(psorted.length * 0.95)] || 1;
  for (let b = 0; b < bins; b++) peaks[b] = Math.min(1, peaks[b] / pp95);
  return {
    name: file.name, duration: audioBuffer.duration, sampleRate: sr, buffer: audioBuffer,
    bpm: Math.round(60 / period * 10) / 10, beats, energy: energyN, energyRate: rate, peaks,
  };
};

/* 16-bit PCM WAV of an AudioBuffer, cut / padded to `duration` seconds (the soundtrack next to an MP4 whose
   audio track some players cannot play, or when the browser has no audio encoder) */
J.audioWav = (buffer, duration, offset = 0) => {
  const sr = buffer.sampleRate, chn = Math.min(2, buffer.numberOfChannels);
  const n = Math.max(1, Math.round((duration > 0 ? duration : buffer.duration) * sr));
  const bytes = n * chn * 2, ab = new ArrayBuffer(44 + bytes), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chn, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * chn * 2, true); v.setUint16(32, chn * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, bytes, true);
  const ch = []; for (let c = 0; c < chn; c++) ch.push(buffer.getChannelData(c));
  const L = buffer.length, i0 = Math.max(0, Math.round(offset * sr)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < chn; c++) {
    const j = i + i0, x = j < L ? Math.max(-1, Math.min(1, ch[c][j])) : 0;
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
};

/* the last song, kept in this browser (IndexedDB) so a reload does not silently drop the audio from exports */
const IDB = { db: null };
/* v0.11.0 moved the song store from 'jizura' to 'aura' — copy every record once, then drop the old db */
IDB.open = () => IDB.db || (IDB.db = new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
  const r = indexedDB.open('aura', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('files'); };
  r.onsuccess = async () => {
    const db = r.result;
    try {
      if (localStorage.getItem('aura.idbMigrated') !== '1') {
        const old = await new Promise((rs) => { const ro = indexedDB.open('jizura', 1); ro.onsuccess = () => rs(ro.result); ro.onerror = () => rs(null); });
        if (old && old.objectStoreNames.contains('files')) {
          const keys = await new Promise((rs, rj) => { const q = old.transaction('files', 'readonly').objectStore('files').getAllKeys(); q.onsuccess = () => rs(q.result || []); q.onerror = () => rj(q.error); });
          for (const k of keys) {
            const rec = await new Promise((rs, rj) => { const q = old.transaction('files', 'readonly').objectStore('files').get(k); q.onsuccess = () => rs(q.result); q.onerror = () => rj(q.error); });
            if (rec !== undefined) await new Promise((rs, rj) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(rec, k); tx.oncomplete = rs; tx.onerror = () => rj(tx.error); });
          }
          try { indexedDB.deleteDatabase('jizura'); } catch (e) {}
        }
        try { old && old.close(); } catch (e) {}
        try { localStorage.setItem('aura.idbMigrated', '1'); } catch (e) {}
      }
    } catch (e) {}
    res(db);
  };
  r.onerror = () => rej(r.error);
}));
J.saveSong = async (file) => {
  try {
    const db = await IDB.open(), data = await file.arrayBuffer();
    await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ name: file.name, type: file.type, data }, 'song'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch (e) { return false; }
};
J.loadSong = async () => {
  try {
    const db = await IDB.open();
    const rec = await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get('song'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (!rec || !rec.data) return null;
    return new File([rec.data], rec.name || 'song', { type: rec.type || '' });
  } catch (e) { return null; }
};
J.saveFontData = async (key, data) => {
  try { const db = await IDB.open(); await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ data }, 'font:' + key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return true; } catch (e) { return false; }
};
J.loadFontData = async (key) => {
  try { const db = await IDB.open(); const rec = await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get('font:' + key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); return rec && rec.data ? rec.data : null; } catch (e) { return null; }
};
J.forgetSong = async () => {
  try { const db = await IDB.open(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete('song'); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {}
};
/* ---- M4 v0.29.0: per-track audio for the playlist ----
   Same store as the single song ('song'), but keyed per playlist item
   ('song:' + item id) so each track keeps its own file. The legacy 'song'
   key is untouched: a playlist-less project still restores exactly as before. */
J.saveSongKey = async (key, file) => {
  if (!key || !file) return false;
  try {
    const db = await IDB.open(), data = await file.arrayBuffer();
    await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ name: file.name, type: file.type, data }, String(key)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch (e) { return false; }
};
J.loadSongKey = async (key) => {
  if (!key) return null;
  try {
    const db = await IDB.open();
    const rec = await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get(String(key)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (!rec || !rec.data) return null;
    return new File([rec.data], rec.name || 'song', { type: rec.type || '' });
  } catch (e) { return null; }
};
J.forgetSongKey = async (key) => {
  if (!key) return;
  try { const db = await IDB.open(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(String(key)); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {}
};

/* rebuild a beat grid from a user BPM + first-beat offset */
J.beatGrid = (bpm, offset, duration) => {
  const out = []; if (!(bpm > 0)) return out;
  const p = 60 / bpm;
  for (let t = offset; t < duration + 0.01; t += p) if (t >= 0) out.push(+t.toFixed(4));
  return out;
};

/* ---- Whisper alignment helpers (v0.18.0, pure functions — node-tested) ---- */
/* Lightweight energy VAD: 20 ms frames, RMS against a peak-relative threshold. This is a silence
   filter, NOT a voice detector — a loud music-only passage still counts as "voiced". Lines are never
   written on VAD alone; the per-line match ratio and the review screen are what keep wrong times out. */
J.whisperVad = (data, sr) => {
  const s = sr || 16000, frame = Math.max(1, Math.round(s * 0.02)), len = data ? data.length : 0;
  const n = Math.floor(len / frame), rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0; const end = Math.min(len, (f + 1) * frame);
    for (let i = f * frame; i < end; i++) e += data[i] * data[i];
    rms[f] = Math.sqrt(e / frame);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] || 0 : 0;
  const thr = Math.max(p95 * 0.08, 0.003);
  const voiced = new Uint8Array(n);
  let vc = 0;
  for (let f = 0; f < n; f++) if (rms[f] > thr) { voiced[f] = 1; vc++; }
  // merge into spans, bridging gaps shorter than 0.3 s (breaths between phrases stay one span)
  const spans = [], gap = Math.round(0.3 / 0.02);
  let a = -1, last = -1;
  for (let f = 0; f < n; f++) {
    if (!voiced[f]) continue;
    if (a < 0) { a = f; last = f; continue; }
    if (f - last <= gap) { last = f; continue; }
    spans.push([+((a * 0.02).toFixed(3)), +(((last + 1) * 0.02).toFixed(3))]); a = f; last = f;
  }
  if (a >= 0) spans.push([+((a * 0.02).toFixed(3)), +(((last + 1) * 0.02).toFixed(3))]);
  return { spans, voicedRatio: n ? vc / n : 0, frames: n };
};
/* fraction of [t0, t1] covered by voiced spans */
J.whisperSpanRatio = (spans, t0, t1) => {
  if (!spans || !spans.length || !(t1 > t0)) return 0;
  let c = 0;
  for (const sp of spans) { const lo = Math.max(sp[0], t0), hi = Math.min(sp[1], t1); if (hi > lo) c += hi - lo; }
  return c / (t1 - t0);
};
/* keep only words overlapping a voiced span (pad: seconds of tolerance on both sides) */
J.whisperFilterWords = (words, spans, pad) => {
  const p = pad == null ? 0.1 : pad;
  if (!spans || !spans.length) return [];
  return (words || []).filter(w => w && w.start != null && spans.some(sp => w.start <= sp[1] + p && (w.end != null ? w.end : w.start) >= sp[0] - p));
};
/* per-line verdict: 'good' (applied by default), 'check' (needs a human listen), 'novoice' (no voice in its span) */
J.whisperLineStatus = (matched, total, voicedRatio) => {
  if (voicedRatio < 0.1) return 'novoice';
  if (!total) return 'check';
  return (matched / total) >= 0.5 ? 'good' : 'check';
};
/* the end of a line is the NEXT fixed time after it — new lineTimes take precedence over the old plan.
   v0.18.0 fix: the old code used the OLD plan's lineEnd here, which dropped every word whenever the new
   line start had moved past the old (estimated) end — the QA-018 bug (0 wordTimes on a real song). */
J.whisperLineEnd = (lt, L, index, durMax) => {
  const n = L ? L.length : 0;
  for (let j = index + 1; j < n; j++) {
    let f = (lt && lt[j] != null && isFinite(+lt[j])) ? +lt[j] : null;
    if (f == null && L[j] && L[j].lrc != null) f = +L[j].lrc;
    if (f != null) return Math.max(0, f - 0.05);
  }
  return Math.max(0, durMax || 0);
};
/* clamp matched words inside the NEW line span [lineStart, lineEnd], keep them in order, min 0.05 s each */
J.whisperClampWords = (pairs, flat, wWords, toks, lineStart, lineEnd) => {
  const clean = [];
  let prev = lineStart;
  for (const p of pairs || []) {
    const u = flat[p.u], w = wWords[p.w];
    if (!u || !w || w.start == null || !isFinite(+w.start)) continue;
    const tok = toks ? toks[u.k] : null;
    let a = Math.max(lineStart, Math.min(+w.start, lineEnd));
    let b = (w.end != null && isFinite(+w.end)) ? +w.end : a + 0.3;
    if (a < prev) a = prev;
    if (a >= lineEnd) continue;
    b = Math.max(b, a + 0.05); b = Math.min(b, lineEnd);
    clean.push({ start: +a.toFixed(3), end: +b.toFixed(3), text: tok ? tok.text : u.text });
    prev = b;
  }
  return clean;
};
J.whisperReviewStats = (rows) => {
  let good = 0, check = 0, novoice = 0, mw = 0, tw = 0;
  for (const r of rows || []) { if (r.status === 'good') good++; else if (r.status === 'novoice') novoice++; else check++; mw += r.matched || 0; tw += r.total || 0; }
  return { good, check, novoice, matchedWords: mw, totalWords: tw, total: (rows || []).length };
};
/* ---- M2 v0.27.0: precomputed frequency spectrum for the 2D visualizers ----
   No live AnalyserNode exists in the preview path (the song plays from a
   decoded AudioBuffer), so the spectrum is computed once, offline, from the
   buffer itself: 2048-point FFT, 30 fps, 64 log-spaced bins. The result is
   cached per AudioBuffer (WeakMap) so every replan reuses it, and shared by
   Preview and offline export — both read the same frames at the same t, so
   what you see is what the MP4 gets. Pure JS, no model, no library. */
const _vizCache = new WeakMap();
/* iterative radix-2 FFT, in place on re/im (length must be a power of two) */
const _vizFFT = (re, im) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + half] * cwr - im[i + k + half] * cwi;
        const vi = re[i + k + half] * cwi + im[i + k + half] * cwr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const nwr = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nwr;
      }
    }
  }
};
/* { sr, rate, bins, frames, spec: Float32Array(frames*64), mono, monoSr } —
   spec is normalised per bin to its 95th percentile over the whole song
   (like energyN), so quiet bands still move and loud ones never clip past 1. */
J.vizData = (audio) => {
  if (!audio || !audio.buffer) return null;
  const buf = audio.buffer;
  if (_vizCache.has(buf)) return _vizCache.get(buf);
  const sr = buf.sampleRate, ch = buf.numberOfChannels, len = buf.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const BINS = 64, WIN = 2048, rate = 30, hop = Math.max(1, Math.round(sr / rate));
  const nF = Math.max(1, Math.floor((len - WIN) / hop) + 1);
  const spec = new Float32Array(nF * BINS);
  const hann = new Float64Array(WIN);
  for (let i = 0; i < WIN; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (WIN - 1)));
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  const fMin = 20, fMax = Math.min(16000, sr / 2), fRatio = fMax / fMin;
  const loBin = new Int32Array(BINS), hiBin = new Int32Array(BINS);
  for (let b = 0; b < BINS; b++) {
    const fLo = fMin * Math.pow(fRatio, b / BINS), fHi = fMin * Math.pow(fRatio, (b + 1) / BINS);
    loBin[b] = Math.max(1, Math.floor(fLo * WIN / sr));
    hiBin[b] = Math.min(WIN / 2, Math.ceil(fHi * WIN / sr));
  }
  for (let f = 0; f < nF; f++) {
    const off = f * hop;
    for (let i = 0; i < WIN; i++) { re[i] = (off + i < len ? mono[off + i] : 0) * hann[i]; im[i] = 0; }
    _vizFFT(re, im);
    for (let b = 0; b < BINS; b++) {
      let m = 0;
      for (let k = loBin[b]; k <= hiBin[b]; k++) { const v = Math.hypot(re[k], im[k]); if (v > m) m = v; }
      spec[f * BINS + b] = m;
    }
  }
  // per-bin 95th percentile normalisation, then light one-pole smoothing over time.
  // The per-bin divisor has a floor at 5% of the GLOBAL 95th percentile: without
  // it a pure tone's window leakage would normalise every distant bin up to ~1
  // and all 64 bars would light up the same. Quiet bands still get headroom,
  // but a band with (nearly) no energy stays (nearly) dark.
  const allSorted = Array.from(spec).sort((x, y) => x - y);
  const gP95 = allSorted[Math.floor(allSorted.length * 0.95)] || 1;
  const floor = 0.05 * gP95;
  for (let b = 0; b < BINS; b++) {
    const col = new Float32Array(nF);
    for (let f = 0; f < nF; f++) col[f] = spec[f * BINS + b];
    const sorted = Array.from(col).sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    const inv = 1 / Math.max(p95, floor, 1e-6);
    let s = 0;
    for (let f = 0; f < nF; f++) {
      s += 0.5 * (Math.min(1, col[f] * inv) - s);
      spec[f * BINS + b] = s;
    }
  }
  const viz = { sr, rate, bins: BINS, frames: nF, spec, mono, monoSr: sr };
  _vizCache.set(buf, viz);
  audio._viz = viz;
  return viz;
};
/* the spectrum + waveform slice at time t (freq is a view into the cached
   frames — read-only; wave is a fresh 128-sample slice of mono around t) */
J.vizFrame = (viz, t) => {
  if (!viz) return null;
  const fi = Math.min(viz.frames - 1, Math.max(0, Math.floor(t * viz.rate)));
  const freq = viz.spec.subarray(fi * viz.bins, (fi + 1) * viz.bins);
  const wave = new Float32Array(128);
  const c = Math.min(viz.mono.length - 1, Math.max(0, Math.round(t * viz.monoSr)));
  const span = Math.max(1, Math.round(viz.monoSr * 0.025));
  for (let i = 0; i < 128; i++) {
    const idx = Math.min(viz.mono.length - 1, Math.max(0, c - span + Math.floor(i * 2 * span / 127)));
    wave[i] = viz.mono[idx];
  }
  return { freq, wave, fi };
};

/* ---- M6 v0.31.0: 10-band Master EQ (SonaWave audioEngine.ts, rewritten) ----
   Chain: preamp (Gain) -> lowCut (highpass) -> 10 BiquadFilter bands ->
   highCut (lowpass). Same chain for preview, fast export (via the AP tap)
   and offline export (via resample in 11_export.js) — one builder for all
   three, so what you hear is what the MP4 gets. Pure data (bands/presets/
   normalize) is node-testable; buildEqChain / eqBandEnergies need Web Audio. */
J.EQ_BANDS = [
  { id: 'b32', freq: 32, type: 'lowshelf', label: '32Hz' },
  { id: 'b64', freq: 64, type: 'peaking', label: '64Hz' },
  { id: 'b125', freq: 125, type: 'peaking', label: '125Hz' },
  { id: 'b250', freq: 250, type: 'peaking', label: '250Hz' },
  { id: 'b500', freq: 500, type: 'peaking', label: '500Hz' },
  { id: 'b1k', freq: 1000, type: 'peaking', label: '1kHz' },
  { id: 'b2k', freq: 2000, type: 'peaking', label: '2kHz' },
  { id: 'b4k', freq: 4000, type: 'peaking', label: '4kHz' },
  { id: 'b8k', freq: 8000, type: 'peaking', label: '8kHz' },
  { id: 'b16k', freq: 16000, type: 'highshelf', label: '16kHz' },
];
/* band gains in dB — exactly SonaWave's MASTER_EQ_PRESETS_DATA values */
J.EQ_PRESETS = [
  { id: 'flat', name: 'フラット', vi: 'Mặc Định Gốc (Flat)', en: 'Flat / Bypass', zhHans: '平坦 / 直通', zhHant: '平坦 / 直通', ko: '플랫 / 기본', preamp: 0, lowCut: 0, highCut: 20000, bands: { b32: 0, b64: 0, b125: 0, b250: 0, b500: 0, b1k: 0, b2k: 0, b4k: 0, b8k: 0, b16k: 0 } },
  { id: 'bass-boost', name: 'バスブースト', vi: 'Tăng Cường Bass', en: 'Bass Booster', zhHans: '低音增强', zhHant: '低音增強', ko: '베이스 부스트', preamp: -2, lowCut: 20, highCut: 20000, bands: { b32: 6.5, b64: 8.0, b125: 4.5, b250: 1.5, b500: 0, b1k: 0, b2k: 1.0, b4k: 2.0, b8k: 3.5, b16k: 2.0 } },
  { id: 'sub-punch', name: 'サブパンチ', vi: 'Trống Sub Nặng', en: 'Sub-Punch', zhHans: '超低音冲击', zhHant: '超低音衝擊', ko: '서브 펀치', preamp: -2.5, lowCut: 20, highCut: 20000, bands: { b32: 8.5, b64: 9.0, b125: 3.5, b250: -1.0, b500: 0, b1k: 0.5, b2k: 1.5, b4k: 3.0, b8k: 2.5, b16k: 1.5 } },
  { id: 'vocal-clarity', name: 'ボーカルクリア', vi: 'Sáng Giọng Ca', en: 'Vocal Clarity & Air', zhHans: '人声清晰', zhHant: '人聲清晰', ko: '보컬 선명', preamp: -1, lowCut: 40, highCut: 20000, bands: { b32: -3.0, b64: -2.0, b125: -1.5, b250: 1.0, b500: 2.0, b1k: 3.5, b2k: 5.5, b4k: 6.0, b8k: 4.5, b16k: 3.5 } },
  { id: 'acoustic-warmth', name: 'アコースティック', vi: 'Ấm Áp Mộc', en: 'Acoustic Warmth', zhHans: '原声温暖', zhHant: '原聲溫暖', ko: '어쿠스틱 웜', preamp: 0, lowCut: 0, highCut: 18000, bands: { b32: 1.0, b64: 2.5, b125: 4.0, b250: 3.5, b500: 1.5, b1k: 0, b2k: -1.0, b4k: -1.5, b8k: 1.5, b16k: 2.5 } },
  { id: 'edm-club', name: 'EDMクラブ', vi: 'Đại Tiệc EDM', en: 'EDM Festival Punch', zhHans: 'EDM 派对', zhHant: 'EDM 派對', ko: 'EDM 클럽', preamp: -3, lowCut: 20, highCut: 20000, bands: { b32: 7.0, b64: 8.5, b125: 4.0, b250: -2.0, b500: -2.5, b1k: 0, b2k: 2.5, b4k: 4.5, b8k: 6.5, b16k: 7.0 } },
  { id: 'rock-metal', name: 'ロック／メタル', vi: 'Rock / Metal Mạnh Mẽ', en: 'Rock / Metal Drive', zhHans: '摇滚 / 金属', zhHant: '搖滾 / 金屬', ko: '록 / 메탈', preamp: -2, lowCut: 30, highCut: 20000, bands: { b32: 4.5, b64: 6.0, b125: 3.5, b250: -1.5, b500: -3.0, b1k: -1.5, b2k: 2.5, b4k: 4.5, b8k: 5.5, b16k: 4.0 } },
  { id: 'lofi-vintage', name: 'ローファイ', vi: 'Lofi Cổ Điển Băng Từ', en: 'Lofi Vintage Warmth', zhHans: '复古 Lo-Fi', zhHant: '復古 Lo-Fi', ko: '로파이 빈티지', preamp: 0.5, lowCut: 30, highCut: 14000, bands: { b32: 3.0, b64: 4.5, b125: 3.5, b250: 2.5, b500: 1.0, b1k: -1.0, b2k: -2.5, b4k: -4.5, b8k: -7.0, b16k: -10.0 } },
  { id: 'cinematic-air', name: 'シネマティック', vi: 'Điện Ảnh Không Gian', en: 'Cinematic Master', zhHans: '电影空间感', zhHant: '電影空間感', ko: '시네마틱', preamp: -1.5, lowCut: 0, highCut: 20000, bands: { b32: 6.0, b64: 5.0, b125: 2.0, b250: 0, b500: 1.0, b1k: 2.0, b2k: 2.5, b4k: 4.0, b8k: 6.0, b16k: 7.5 } },
  { id: 'podcast-clean', name: 'ポッドキャスト', vi: 'Thu Âm / Giọng Nói Sạch', en: 'Podcast / Clean Speech', zhHans: '播客 / 清晰人声', zhHant: '播客 / 清晰人聲', ko: '팟캐스트 / 클린 보이스', preamp: 0, lowCut: 80, highCut: 16000, bands: { b32: -12.0, b64: -8.0, b125: -3.0, b250: -2.0, b500: 1.0, b1k: 2.5, b2k: 4.0, b4k: 4.5, b8k: 2.0, b16k: 0 } },
];
J.eqPreset = (id) => J.EQ_PRESETS.find(p => p.id === id) || J.EQ_PRESETS[0];
J.eqDefault = () => ({ bypass: false, preset: 'flat', preamp: 0, lowCut: 0, highCut: 20000, bands: { b32: 0, b64: 0, b125: 0, b250: 0, b500: 0, b1k: 0, b2k: 0, b4k: 0, b8k: 0, b16k: 0 } });
/* a full EQ state with a preset's values loaded (a fresh object — the preset table is never mutated) */
J.eqApplyPreset = (id) => {
  const p = J.eqPreset(id), bands = {};
  for (const b of J.EQ_BANDS) bands[b.id] = p.bands[b.id] || 0;
  return { bypass: false, preset: p.id, preamp: p.preamp, lowCut: p.lowCut, highCut: p.highCut, bands };
};
/* project files are untrusted: clamp everything, unknown preset -> flat (or 'custom' when the bands are non-flat) */
J.eqNormalize = (eq) => {
  const d = J.eqDefault(), src = (eq && typeof eq === 'object') ? eq : {};
  const out = {
    bypass: !!src.bypass,
    preset: typeof src.preset === 'string' ? src.preset : 'flat',
    preamp: isFinite(+src.preamp) ? Math.max(-6, Math.min(6, +src.preamp)) : 0,
    lowCut: isFinite(+src.lowCut) ? Math.max(0, Math.min(500, +src.lowCut)) : 0,
    highCut: isFinite(+src.highCut) ? Math.max(8000, Math.min(20000, +src.highCut)) : 20000,
    bands: {},
  };
  const sb = (src.bands && typeof src.bands === 'object') ? src.bands : {};
  for (const b of J.EQ_BANDS) out.bands[b.id] = isFinite(+sb[b.id]) ? Math.max(-12, Math.min(12, +sb[b.id])) : 0;
  const known = J.EQ_PRESETS.some(p => p.id === out.preset);
  if (!known) {
    const flat = J.EQ_BANDS.every(b => out.bands[b.id] === 0) && out.preamp === 0 && out.lowCut === 0 && out.highCut === 20000;
    out.preset = flat ? 'flat' : 'custom';
  }
  return out;
};
/* build the chain on any BaseAudioContext (live or offline). Returns
   { input, output, set(eq) } — set() retunes live with setTargetAtTime. */
J.buildEqChain = (ctx, eq) => {
  const e = J.eqNormalize(eq);
  const preamp = ctx.createGain();
  const lowCut = ctx.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.Q.value = 0.707;
  const highCut = ctx.createBiquadFilter(); highCut.type = 'lowpass'; highCut.Q.value = 0.707;
  const bands = {};
  let prev = preamp;
  prev.connect(lowCut); prev = lowCut;
  for (const b of J.EQ_BANDS) {
    const f = ctx.createBiquadFilter();
    f.type = b.type; f.frequency.value = b.freq; f.Q.value = 1.4; f.gain.value = 0;
    bands[b.id] = f; prev.connect(f); prev = f;
  }
  prev.connect(highCut);
  const setParam = (param, value, tc) => {
    try {
      const now = ctx.currentTime || 0;
      if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, now, tc == null ? 0.05 : tc);
      else param.value = value;
    } catch (err) { try { param.value = value; } catch (e2) {} }
  };
  const chain = {
    input: preamp, output: highCut, preamp, lowCut, highCut, bands,
    set(eq2) {
      const n = J.eqNormalize(eq2);
      setParam(preamp.gain, Math.pow(10, n.preamp / 20));
      setParam(lowCut.frequency, n.lowCut > 0 ? n.lowCut : 10);
      setParam(highCut.frequency, n.highCut < 20000 ? n.highCut : 22050);
      for (const b of J.EQ_BANDS) setParam(bands[b.id].gain, n.bands[b.id]);
    },
  };
  chain.set(e);
  return chain;
};
/* Relative band energies (each band's share of total power, 0..1) of a buffer
   rendered through the EQ — the QA probe: bass-boost must raise the low
   bands' share, lofi must cut the high bands' share, bypass must match off.
   Null when there is no OfflineAudioContext (node). */
J.eqBandEnergies = async (buffer, eq) => {
  if (typeof OfflineAudioContext === 'undefined' || !buffer) return null;
  const sr = buffer.sampleRate, chn = Math.min(2, buffer.numberOfChannels);
  const oc = new OfflineAudioContext(chn, buffer.length, sr);
  const src = oc.createBufferSource(); src.buffer = buffer;
  const e = J.eqNormalize(eq);
  if (!e.bypass) { const chain = J.buildEqChain(oc, e); src.connect(chain.input); chain.output.connect(oc.destination); }
  else src.connect(oc.destination);
  src.start(0);
  const rendered = await oc.startRendering();
  const mono = new Float32Array(rendered.length);
  for (let c = 0; c < chn; c++) { const d = rendered.getChannelData(c); for (let i = 0; i < rendered.length; i++) mono[i] += d[i] / chn; }
  // 2048-point FFT windows spread over the buffer; power per bin, summed into bands
  const WIN = 2048, nWin = Math.max(1, Math.min(16, Math.floor(mono.length / WIN)));
  const power = new Float64Array(WIN / 2 + 1);
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let w = 0; w < nWin; w++) {
    const off = Math.floor(w * (mono.length - WIN) / Math.max(1, nWin - 1));
    for (let i = 0; i < WIN; i++) { re[i] = mono[off + i] * (0.5 * (1 - Math.cos(2 * Math.PI * i / (WIN - 1)))); im[i] = 0; }
    _vizFFT(re, im);
    for (let k = 0; k <= WIN / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
  }
  const bandPower = (fLo, fHi) => {
    const kLo = Math.max(1, Math.floor(fLo * WIN / sr)), kHi = Math.min(WIN / 2, Math.ceil(fHi * WIN / sr));
    let s = 0; for (let k = kLo; k <= kHi; k++) s += power[k];
    return s;
  };
  const bands = {};
  let total = 0;
  for (let i = 0; i < J.EQ_BANDS.length; i++) {
    const b = J.EQ_BANDS[i];
    const fLo = i === 0 ? 20 : b.freq / Math.SQRT2, fHi = i === J.EQ_BANDS.length - 1 ? 20000 : b.freq * Math.SQRT2;
    bands[b.id] = bandPower(fLo, fHi); total += bands[b.id];
  }
  // the half-octave windows overlap slightly, so normalise by the sum, not the raw total
  const out = {};
  for (const b of J.EQ_BANDS) out[b.id] = total > 0 ? +(bands[b.id] / total).toFixed(4) : 0;
  return out;
};
})();
