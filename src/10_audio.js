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
})();
