/* JIZURA pack: viz — 2D audio visualizers (M2 v0.27.0)
   Six full-screen background styles, rewritten in plain AURA-style JS from
   the *design* of SonaWave's visualizerRenderer.ts (HAY Studio73, MIT —
   see THIRD_PARTY_NOTICES.md): no TS/React code was carried over. Each style
   is a pure canvas-2D draw of (freq, wave, t): `freq` is the 64-bin spectrum
   precomputed by J.vizData (30 fps, shared by Preview and offline export),
   `wave` the 128-sample mono slice. With no audio (effect thumbnails,
   projects without a song) every style falls back to a deterministic idle
   spectrum, so it still shows its shape. No Math.random() anywhere in the
   draw path: offline export must be frame-deterministic. */
(() => {
'use strict';
const PK = 'viz';
const reg = (g, k, d) => J.register(g, k, d, PK);
const clamp = J.clamp, TAU = J.TAU;

/* deterministic pseudo-noise in [0,1) from (i, t) — replaces Math.random()
   so the same frame always draws the same flame */
const nhash = (i, t) => { const s = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453; return s - Math.floor(s); };
/* SonaWave's log-ish bin pick: bar i reads bin floor((i/n)^exp * len*0.75) */
const barIndex = (i, n, exp, len) => Math.min(len - 1, Math.floor(Math.pow(i / n, exp) * len * 0.75));
/* beat pulse 0..1 from the render env (null-safe) */
const beatPulse = env => (env.beat && env.beat.since < 0.25 ? Math.exp(-env.beat.since * 8) : 0);
/* colourful scheme colours that stand apart from the background (accent first) */
const hues = sc => {
  const out = [];
  for (const c of [sc.accent, sc.accent2, sc.ghostA, sc.ghostB, sc.fg]) {
    if (!c || J.contrast(c, sc.bg) < 1.25) continue;
    const k = c.toLowerCase();
    if (!out.some(o => o.toLowerCase() === k)) out.push(c);
  }
  return out.length ? out : [sc.fg];
};
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};
/* idle spectrum for thumbnails / no-audio projects: gentle deterministic
   motion, so the style's shape is visible without a song */
J.vizIdleFreq = (t) => {
  const out = new Float32Array(64);
  for (let i = 0; i < 64; i++) out[i] = clamp(0.24 + 0.16 * Math.sin(t * 1.7 + i * 0.55) + 0.08 * Math.sin(t * 3.1 + i * 1.3), 0.05, 0.6);
  return out;
};
const freqOf = env => (env.freq && env.freq.length ? env.freq : J.vizIdleFreq(env.t));
/* falling-peak state for the mirrored bars, keyed by cut (reset on seek-back) */
const FALLBACK_PEAK = {};
const peakState = new WeakMap();
const peakFor = (cut, n) => {
  const key = cut || FALLBACK_PEAK;
  let s = peakState.get(key);
  if (!s || s.peaks.length !== n) { s = { peaks: new Float32Array(n), vels: new Float32Array(n), lastT: -1 }; peakState.set(key, s); }
  return s;
};
const bgReg = (k, d) => reg('bg', k, Object.assign({}, d, { draw(env, P) { const ctx = env.ctx; ctx.save(); try { d.draw(env, P || {}, ctx); } finally { ctx.restore(); } } }));
const barsGeom = env => {
  const bw = Math.max(4, env.W * 0.008), gap = bw * 0.45, N = 48;
  return { N, bw, gap, x0: (env.W - (N * (bw + gap) - gap)) / 2 };
};

/* ---- 1. mirrored bars with falling peak caps (SonaWave: bars-mirrored-peaks) ---- */
bgReg('vizBarsMirror', {
  name: 'ミラーバー・ピーク', tags: ['pop', 'graphic'],
  draw(env) {
    const ctx = env.ctx, W = env.W, H = env.H, t = env.t;
    const freq = freqOf(env), cols = hues(env.sc), u = H / 720, pulse = beatPulse(env);
    const { N, bw, gap, x0 } = barsGeom(env);
    const posY = H * 0.78, maxH = H * 0.16, cg = Math.max(3, 6 * u);
    const st = peakFor(env.cut, N);
    if (t < st.lastT - 0.01) { st.peaks.fill(0); st.vels.fill(0); }
    st.lastT = t;
    const r = Math.min(bw / 2, 4 * u);
    ctx.fillStyle = cols[0];
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const h = Math.max(3, freq[barIndex(i, N, 1.35, freq.length)] * maxH * (1 + 0.25 * pulse));
      if (h >= st.peaks[i]) { st.peaks[i] = h; st.vels[i] = 0; }
      else { st.vels[i] += 0.32; st.peaks[i] = Math.max(0, st.peaks[i] - st.vels[i]); }
      const x = x0 + i * (bw + gap);
      rr(ctx, x, posY - cg / 2 - h, bw, h, r);
      rr(ctx, x, posY + cg / 2, bw, h, r);
    }
    ctx.fill();
    ctx.fillStyle = cols[1] || '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (st.peaks[i] <= 4) continue;
      const x = x0 + i * (bw + gap);
      ctx.rect(x, posY - cg / 2 - st.peaks[i] - 5 * u, bw, 3 * u);
      ctx.rect(x, posY + cg / 2 + st.peaks[i] + 2 * u, bw, 3 * u);
    }
    ctx.fill();
  },
});

/* ---- 2. flame spectrum (SonaWave: flame-spectrum) ----
   The fire gradient is the style's own identity (fixed orange/red/yellow),
   like `galaxy` keeps its fixed purples — the other five styles use scheme colours. */
bgReg('vizFlame', {
  name: '炎スペクトル', tags: ['pop', 'emotional'],
  draw(env) {
    const ctx = env.ctx, H = env.H, t = env.t;
    const freq = freqOf(env), pulse = beatPulse(env);
    const { N, bw, gap, x0 } = barsGeom(env);
    const posY = H * 0.80, maxH = Math.max(60, H * 0.42 * (1 + 0.45 * pulse));
    const grad = ctx.createLinearGradient(0, posY, 0, posY - maxH);
    grad.addColorStop(0, '#f59e0b'); grad.addColorStop(0.6, '#ef4444'); grad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const nz = Math.sin(t * 7.2 + i * 0.8) * 0.2 + (nhash(i, t) - 0.5) * 0.15;
      const fh = Math.max(4, freq[barIndex(i, N, 1.2, freq.length)] * maxH * Math.max(0.2, 0.85 + nz));
      const x = x0 + i * (bw + gap);
      ctx.moveTo(x, posY);
      ctx.lineTo(x + bw / 2, posY - fh);
      ctx.lineTo(x + bw, posY);
      ctx.closePath();
    }
    ctx.fill();
  },
});

/* ---- 3. cyber matrix LED columns (SonaWave: cyber-matrix) ---- */
bgReg('vizMatrix', {
  name: 'サイバーマトリックス', tags: ['glitch', 'graphic'],
  draw(env) {
    const ctx = env.ctx, H = env.H;
    const freq = freqOf(env), cols = hues(env.sc), u = H / 720, pulse = beatPulse(env);
    const { N, bw, gap, x0 } = barsGeom(env);
    const rows = 24, bh = Math.max(3, H * 0.006), bg2 = 2 * u, posY = H * 0.80;
    ctx.fillStyle = cols[0];
    ctx.beginPath();
    const warn = [];
    for (let i = 0; i < N; i++) {
      const active = Math.floor(freq[barIndex(i, N, 1.3, freq.length)] * rows * (1 + 0.3 * pulse));
      const x = x0 + i * (bw + gap);
      for (let b = 0; b < active; b++) {
        const y = posY - (b + 1) * (bh + bg2);
        if (b >= rows - 3) warn.push([x, y]);
        else rr(ctx, x, y, bw, bh, 1 * u);
      }
    }
    ctx.fill();
    if (warn.length) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      for (const [x, y] of warn) rr(ctx, x, y, bw, bh, 1 * u);
      ctx.fill();
    }
  },
});

/* ---- 4. stage laser beams (SonaWave: laser-beams) ---- */
bgReg('vizLaser', {
  name: 'レーザービーム', tags: ['pop', 'glitch'],
  draw(env) {
    const ctx = env.ctx, W = env.W, H = env.H, t = env.t;
    const freq = freqOf(env), cols = hues(env.sc), u = H / 720, pulse = beatPulse(env);
    const N = 14, ox = W / 2, oy = H * 0.98;
    const spread = Math.PI / 3, L = Math.max(W, H) * 1.1, strobe = pulse > 0.5;
    for (let i = 0; i < N; i++) {
      const v = freq[Math.min(freq.length - 1, Math.floor((i / N) * freq.length * 0.75))];
      const power = v * (1 + 0.25 * pulse) * (strobe ? 1.4 : 1);
      const norm = (i - N / 2) / (N / 2);
      const ang = Math.sin(t * 2.2 + i * 0.45) * 0.38 + norm * spread;
      const tx = ox + Math.sin(ang) * L, ty = oy - Math.cos(ang) * L;
      const col = cols[i % cols.length] || cols[0];
      ctx.save();
      ctx.globalAlpha = Math.min(1, (0.25 + power * 0.45) * (strobe ? 1.3 : 1));
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(4, (6 + power * 16) * u);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = Math.min(1, 0.8 + power * 0.2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, (1.8 + power * 3.5) * u);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
      const fr = Math.max(6, (8 + power * 18 + pulse * 12) * u);
      const fg = ctx.createRadialGradient(ox, oy, 1, ox, oy, fr);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.4, col); fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(ox, oy, fr, 0, TAU); ctx.fill();
    }
  },
});

/* ---- 5. starburst nova core (SonaWave: starburst-core) ---- */
bgReg('vizStarburst', {
  name: 'スターバースト', tags: ['pop', 'emotional'],
  draw(env) {
    const ctx = env.ctx, W = env.W, H = env.H, t = env.t;
    const freq = freqOf(env), cols = hues(env.sc), u = H / 720, pulse = beatPulse(env);
    const cx = W / 2, cy = H * 0.5, rays = 48;
    const innerR = Math.max(10, H * 0.022), maxLen = Math.min(W, H) * 0.28;
    const rot = t * 0.6, bass = freq[2] || 0;
    const coreR = innerR * (1 + pulse * 0.35 + bass * 0.25);
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR * 2.0);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, cols[0]);
    cg.addColorStop(0.8, cols[1] || '#fbbf24'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 1.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = cols[0];
    ctx.lineWidth = Math.max(1.8, 2.5 * u);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const tips = [];
    for (let i = 0; i < rays; i++) {
      const ang = rot + (i / rays) * TAU;
      const mirrorIdx = i < rays / 2 ? i : rays - i;
      const v = freq[Math.min(freq.length - 1, Math.floor((mirrorIdx / (rays / 2)) * freq.length * 0.7))];
      const rayLen = innerR + v * maxLen * (1 + 0.2 * pulse);
      const x1 = cx + Math.cos(ang) * innerR, y1 = cy + Math.sin(ang) * innerR;
      const x2 = cx + Math.cos(ang) * rayLen, y2 = cy + Math.sin(ang) * rayLen;
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      tips.push([x2, y2, Math.max(2, (2.5 + v * 4) * u)]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const [x, y, r] of tips) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fill();
  },
});

/* ---- 6. DNA double helix (SonaWave: dna-helix) ---- */
bgReg('vizDna', {
  name: 'DNAヘリックス', tags: ['graphic', 'calm'],
  draw(env) {
    const ctx = env.ctx, W = env.W, H = env.H, t = env.t;
    const freq = freqOf(env), cols = hues(env.sc), u = H / 720, pulse = beatPulse(env);
    const pts = 42, helixW = Math.min(W * 0.9, 720 * u), x0 = (W - helixW) / 2;
    const step = helixW / (pts - 1), baseAmp = H * 0.09 * (1 + 0.2 * pulse);
    const cyc = t * 3.5, posY = H * 0.5;
    for (let i = 0; i < pts; i += 2) {
      const v = freq[Math.min(freq.length - 1, Math.floor((i / pts) * freq.length * 0.7))];
      const rungAmp = baseAmp * (0.4 + v * 0.85);
      const ang = cyc + (i / pts) * Math.PI * 4;
      const y1 = posY + Math.sin(ang) * rungAmp, y2 = posY + Math.sin(ang + Math.PI) * rungAmp;
      const x = x0 + i * step, alpha = 0.35 + (Math.cos(ang) + 1) * 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = cols[0];
      ctx.lineWidth = Math.max(1.5, 2.5 * u);
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      const nodeR = Math.max(2.5, (3 + v * 4) * u);
      ctx.fillStyle = cols[0];
      ctx.beginPath(); ctx.arc(x, y1, nodeR, 0, TAU); ctx.arc(x, y2, nodeR, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (let s = 0; s < 2; s++) {
      ctx.strokeStyle = cols[s] || cols[0];
      ctx.lineWidth = Math.max(2, 4 * u);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const v = freq[Math.min(freq.length - 1, Math.floor((i / pts) * freq.length * 0.7))];
        const strandAmp = baseAmp * (0.4 + v * 0.85);
        const ang = cyc + (i / pts) * Math.PI * 4 + s * Math.PI;
        const x = x0 + i * step, y = posY + Math.sin(ang) * strandAmp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
});
})();
