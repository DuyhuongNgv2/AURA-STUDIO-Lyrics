/* LyricWave pack: viz3d — 3D audio visualizers (M3 v0.28.0)
   Two full-screen background scenes, rewritten in plain AURA-style JS from
   the *design* of SonaWave's threeDVisualizerEngine.ts (HAY Studio73, MIT —
   see THIRD_PARTY_NOTICES.md): no TS/React code was carried over. Each scene
   renders through the shared singleton WebGL host (J.text3d, src/13_text3d.js
   — the same renderer + canvas as the 3D text, never a second context) and
   is a pure function of (t, freq(t), beat(t)): planet angles a0 + speed*t,
   cube heights straight from the 64-bin spectrum, so Preview == offline
   export frame by frame. With no audio every scene falls back to the
   deterministic idle spectrum (J.vizIdleFreq, M2). While Three.js is still
   loading — or when WebGL is unavailable at all — the frame draws a
   deterministic 2D fallback with the same data (loading/fallback state,
   never presented as the 3D feature); the probe J.text3d.viz3d.webgl tells
   QA which path actually rendered. No Math.random() anywhere in the draw
   path. */
(() => {
'use strict';
const PK = 'viz3d';
const reg = (g, k, d) => J.register(g, k, d, PK);
const clamp = J.clamp, TAU = J.TAU;
/* beat pulse 0..1 from the render env (null-safe) — same rule as M2 */
const beatPulse = env => (env.beat && env.beat.since < 0.25 ? Math.exp(-env.beat.since * 8) : 0);
const freqOf = env => (env.freq && env.freq.length ? env.freq : J.vizIdleFreq(env.t));
/* colourful scheme colours that stand apart from the background (accent first) — same rule as M2 */
const hues = sc => {
  const out = [];
  for (const c of [sc.accent, sc.accent2, sc.ghostA, sc.ghostB, sc.fg]) {
    if (!c || J.contrast(c, sc.bg) < 1.25) continue;
    const k = c.toLowerCase();
    if (!out.some(o => o.toLowerCase() === k)) out.push(c);
  }
  return out.length ? out : [sc.fg];
};
/* Three.js loads lazily on first use (like the 3D text toggle): kick the
   load exactly once per page, then the 3D path takes over on later frames */
let loadKicked = false;
const draw3d = (env, key, fallback) => {
  const t3 = (typeof J !== 'undefined' && J.text3d) || null;
  if (t3 && t3.ready) {
    if (t3.drawViz3d(env, key, freqOf(env))) return;
  }
  if (t3 && !loadKicked) { loadKicked = true; try { t3.load(); } catch (e) {} }
  if (t3) t3.viz3d = { key, webgl: false };
  fallback(env, env.ctx);
};
const bgReg = (k, d) => reg('bg', k, Object.assign({}, d, { draw(env, P) { const ctx = env.ctx; ctx.save(); try { d.draw(env, P || {}, ctx); } finally { ctx.restore(); } } }));

/* ---- 2D loading fallback: solar system ----
   Same numbers as the 3D scene (orbit radii, planet angles, sun pulse);
   the tilted orbits project to ellipses (vertical squash cos 0.38). */
const solarFallback = (env, ctx) => {
  const W = env.W, H = env.H, t = env.t;
  const freq = freqOf(env), pulse = beatPulse(env);
  const planets = J.viz3dSolarPlanets || [];
  const cx = W / 2, cy = H / 2;
  const R_out = Math.min(W, H) * 0.42;
  const unit = R_out / (5.5 + 25.5);
  const sunR = 5.5 * unit;
  const tilt = Math.cos(0.38);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(1, H / 720);
  for (const p of planets) {
    const R = (5.5 + p.off) * unit;
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R * tilt, 0, 0, TAU); ctx.stroke();
  }
  const bass = (freq[2] + freq[3]) / 2;
  const sr = sunR * (1 + (bass * 0.35 + pulse * 0.25) * 1.5);
  const g = ctx.createRadialGradient(cx, cy, sr * 0.2, cx, cy, sr * 1.6);
  g.addColorStop(0, '#fde68a'); g.addColorStop(0.45, '#f59e0b'); g.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sr * 1.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill();
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    const R = (5.5 + p.off) * unit;
    const a = J.viz3dPlanetAngle(i, t);
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * tilt;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, p.size * unit), 0, TAU); ctx.fill();
    if (p.name === 'Saturn') {
      ctx.strokeStyle = 'rgba(254,240,138,0.8)';
      ctx.lineWidth = Math.max(1, p.size * unit * 0.25);
      ctx.beginPath(); ctx.ellipse(x, y, p.size * unit * 2.1, p.size * unit * 0.7, -0.4, 0, TAU); ctx.stroke();
    }
  }
};

/* ---- 2D loading fallback: cube matrix ----
   Top-down schematic of the same 8x8 grid: each cell is a square whose size
   and alpha encode the cube height from the same bin pick. */
const cubesFallback = (env, ctx) => {
  const W = env.W, H = env.H;
  const freq = freqOf(env), pulse = beatPulse(env);
  const cols = hues(env.sc);
  const spec = J.viz3dCubeSpec || { n: 8 };
  const N = spec.n;
  const pitch = (W * 0.62) / N;
  const x0 = (W - N * pitch) / 2, y0 = H * 0.30;
  const maxDist = Math.sqrt(2) * (N - 1) / 2;
  const maxH = H * 0.42;
  for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
    const dist = Math.sqrt(Math.pow(ix - (N - 1) / 2, 2) + Math.pow(iz - (N - 1) / 2, 2)) / maxDist;
    const f = freq[J.viz3dCubeBin(dist, freq.length)];
    const h = Math.max(2, f * maxH * (1 + 0.25 * pulse));
    const frac = clamp(h / maxH, 0, 1);
    const s = Math.max(4, pitch * 0.62 * (0.35 + 0.65 * frac));
    const col = cols[Math.min(cols.length - 1, Math.floor(frac * cols.length))];
    ctx.globalAlpha = 0.35 + 0.65 * frac;
    ctx.fillStyle = col;
    ctx.fillRect(x0 + ix * pitch + (pitch - s) / 2, y0 + iz * pitch * 0.62 + (pitch * 0.62 - s) / 2, s, s);
  }
  ctx.globalAlpha = 1;
};

/* ---- 1. solar system 3D (SonaWave: 3d-solar-system) ---- */
bgReg('viz3dSolar', {
  name: '太陽系3D', tags: ['pop', 'graphic'],
  draw(env) { draw3d(env, 'viz3dSolar', solarFallback); },
});

/* ---- 2. cube matrix 3D (SonaWave: 3d-cube-matrix) ---- */
bgReg('viz3dCubes', {
  name: 'キューブマトリックス3D', tags: ['pop', 'graphic'],
  draw(env) { draw3d(env, 'viz3dCubes', cubesFallback); },
});
})();
