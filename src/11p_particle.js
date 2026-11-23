/* JIZURA pack: particles — multi-layer background particles (M5 v0.30.0)
   Eight particle styles, rewritten in plain AURA-style JS from the
   *design* of SonaWave's BackgroundEffectsTab.tsx (HAY Studio73, MIT —
   see THIRD_PARTY_NOTICES.md): no TS/React code was carried over.
   Each style is a DECOR entry (layer 'back': behind the lyrics, above
   the background), picked per cut through the existing decor picker and
   saved in the cut's cutTech like every other decoration.
   - Deterministic: every particle's seed comes from the cut's decor
     params (P.seed) plus its index and layer; motion is a pure function
     of env.t. No Math.random() anywhere, so Preview and offline export
     draw the same frame at the same time.
   - Multi-layer: S.project.fx.particleLayers (1..5, default 2) draws
     the same style in that many layers, each smaller / fainter /
     faster than the previous — SonaWave's "up to 5 layers" fitted to
     AURA's one-decor-per-cut mechanism (layers share one style).
   - Music-reactive: speed and brightness scale with env.energy and the
     beat pulse (off when fx.particleReact is false; idle motion when
     there is no audio).
   - Random never picks particles: w: 0 keeps them out of pickDecor,
     so Randomize / Shuffle / replan of old projects never sprout
     particles on their own — only an explicit picker choice does. */
(() => {
'use strict';
const clamp = J.clamp, TAU = J.TAU;
const PK = 'particle';
const reg = (k, d) => J.register('decor', k, d, PK);

/* deterministic pseudo-noise in [0,1) from (i, t) — same idea as viz */
const nhash = (i, t) => { const s = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453; return s - Math.floor(s); };
const wrap = (v, lo, hi) => { const m = hi - lo; return lo + ((((v - lo) % m) + m) % m); };

/* Music reactivity factor: 1 at rest, up to ~2.4 on loud beats.
   Pure and node-testable. energy null (no audio) counts as 0.35. */
J.particleReact = (energy, beatSince) => {
  const e = energy == null ? 0.35 : clamp(energy, 0, 1);
  const bp = (beatSince != null && beatSince < 0.25) ? Math.exp(-beatSince * 8) : 0;
  return 1 + 0.9 * e + 0.5 * bp;
};
J.particleLayersOf = (fx) => clamp(Math.round((fx && fx.particleLayers) || 2), 1, 5);

const reactOf = env => {
  const fx = env.fx || {};
  if (fx.particleReact === false) return 1;
  return J.particleReact(env.energy, env.beat && env.beat.since);
};
/* fade in at the cut start, fade out at the cut end (like other decor) */
const fadeOf = env => clamp(env.lt / 0.25, 0, 1) * (1 - clamp(env.pOut || 0, 0, 1));
const densityOf = (W, H) => clamp((W * H) / (1280 * 720), 0.5, 2);

/* Per-layer variation: smaller, fainter, faster the deeper the layer. */
const layerMul = L => ({ size: 1 - L * 0.16, alpha: 1 - L * 0.16, speed: 1 + L * 0.28 });

const ptReg = (k, d) => reg(k, Object.assign({}, d, {
  layer: 'back', w: 0, subtle: true,
  draw(env, bb, P) {
    if (env.pass !== 'main') return;
    const fade = fadeOf(env);
    if (fade <= 0.003) return;
    const ctx = env.ctx;
    ctx.save();
    try { d.draw(env, P || {}, ctx, fade); } finally { ctx.restore(); }
  },
}));

/* ---- 1. rain (SonaWave: rain) — slanted streaks falling fast ---- */
ptReg('ptRain', {
  name: '雨', tags: ['calm', 'emotional'],
  draw(env, P, ctx, fade) {
    const { W, H, sc } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.strokeStyle = sc.fg; ctx.lineCap = 'round';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(100 * dens);
      ctx.lineWidth = Math.max(1, 2 * u * m.size);
      ctx.globalAlpha = 0.6 * fade * m.alpha;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x0 = J.r(seed, L, i, 1) * (W + 60) - 30, y0 = J.r(seed, L, i, 2) * (H + 60) - 30;
        const vy = (480 + J.r(seed, L, i, 3) * 420) * u * m.speed * rf;
        const y = wrap(y0 + vy * env.t, -30, H + 30), x = wrap(x0 + vy * env.t * 0.22, -30, W + 30);
        const len = (11 + J.r(seed, L, i, 4) * 15) * u * m.size;
        ctx.moveTo(x, y); ctx.lineTo(x - len * 0.22, y - len);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 2. snow (SonaWave: snow) — slow flakes swaying down ---- */
ptReg('ptSnow', {
  name: '雪', tags: ['calm', 'emotional'],
  draw(env, P, ctx, fade) {
    const { W, H, sc } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.fillStyle = '#ffffff';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(80 * dens);
      ctx.globalAlpha = 0.9 * fade * m.alpha;
      for (let i = 0; i < N; i++) {
        const x0 = J.r(seed, L, i, 1) * W, y0 = J.r(seed, L, i, 2) * (H + 20) - 10;
        const vy = (22 + J.r(seed, L, i, 3) * 38) * u * m.speed * rf;
        const ph = J.r(seed, L, i, 4) * TAU, sw = (9 + J.r(seed, L, i, 5) * 18) * u;
        const y = wrap(y0 + vy * env.t, -10, H + 10);
        const x = wrap(x0 + sw * Math.sin(env.t * 0.7 + ph), -10, W + 10);
        const r = (2 + J.r(seed, L, i, 6) * 3) * u * m.size;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 3. lofi dust (SonaWave: dust) — slow soft dots drifting ---- */
ptReg('ptDust', {
  name: '塵', tags: ['calm', 'emotional'],
  draw(env, P, ctx, fade) {
    const { W, H, sc } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.fillStyle = sc.fg;
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(80 * dens);
      for (let i = 0; i < N; i++) {
        const x0 = J.r(seed, L, i, 1) * W, y0 = J.r(seed, L, i, 2) * H;
        const ph = J.r(seed, L, i, 3) * TAU, ph2 = J.r(seed, L, i, 4) * TAU;
        const x = wrap(x0 + 34 * u * Math.sin(env.t * 0.22 * rf + ph), -10, W + 10);
        const y = wrap(y0 + 22 * u * Math.sin(env.t * 0.16 * rf + ph2), -10, H + 10);
        const a = (0.3 + 0.3 * (0.5 + 0.5 * Math.sin(env.t * 0.8 + ph))) * fade * m.alpha;
        const r = (2 + J.r(seed, L, i, 5) * 3) * u * m.size;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 4. twinkling stars (SonaWave: stars) — static dots, pulsing ---- */
ptReg('ptStars', {
  name: '星', tags: ['calm', 'emotional', 'graphic'],
  draw(env, P, ctx, fade) {
    const { W, H } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.fillStyle = '#ffffff';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(90 * dens);
      for (let i = 0; i < N; i++) {
        const x = J.r(seed, L, i, 1) * W, y = J.r(seed, L, i, 2) * H;
        const sp = (0.8 + J.r(seed, L, i, 3) * 1.6) * rf, ph = J.r(seed, L, i, 4) * TAU;
        const tw = 0.5 + 0.5 * Math.sin(env.t * sp + ph);
        const r = (1.2 + J.r(seed, L, i, 5) * 2.2) * u * m.size;
        ctx.globalAlpha = (0.2 + 0.8 * tw) * fade * m.alpha;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        if (r > 2 * u) {   // brighter stars get a 4-point sparkle
          const s = r * 3;
          ctx.globalAlpha = 0.5 * tw * fade * m.alpha;
          ctx.fillRect(x - s, y - 0.5, s * 2, 1); ctx.fillRect(x - 0.5, y - s, 1, s * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 5. fire embers (SonaWave: fire-embers) — glowing dots rising ---- */
ptReg('ptEmbers', {
  name: '火の粉', tags: ['emotional', 'pop'],
  draw(env, P, ctx, fade) {
    const { W, H } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.globalCompositeOperation = 'lighter';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(80 * dens);
      for (let i = 0; i < N; i++) {
        const x0 = J.r(seed, L, i, 1) * W, y0 = J.r(seed, L, i, 2) * (H + 20);
        const vy = (34 + J.r(seed, L, i, 3) * 76) * u * m.speed * rf;
        const ph = J.r(seed, L, i, 4) * TAU;
        const y = H + 10 - wrap(y0 + vy * env.t, 0, H + 20);
        const x = wrap(x0 + 16 * u * Math.sin(env.t * 1.2 + ph), -10, W + 10);
        const p = clamp(1 - y / H, 0, 1);   // 0 at the bottom (fresh) → 1 at the top (spent)
        const flick = 0.65 + 0.35 * Math.sin(env.t * 9 + i * 2.7);
        ctx.globalAlpha = (1 - p) * 0.85 * flick * fade * m.alpha;
        ctx.fillStyle = p < 0.5 ? '#ffb03c' : '#ff4a1a';
        const r = (2.2 + J.r(seed, L, i, 5) * 3.5) * u * m.size;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
});

/* ---- 6. rainbow bubbles (SonaWave: rainbow-bubbles) — rings rising ---- */
ptReg('ptBubbles', {
  name: 'シャボン玉', tags: ['pop', 'graphic'],
  draw(env, P, ctx, fade) {
    const { W, H } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(45 * dens);
      for (let i = 0; i < N; i++) {
        const x0 = J.r(seed, L, i, 1) * W, y0 = J.r(seed, L, i, 2) * (H + 20);
        const vy = (16 + J.r(seed, L, i, 3) * 42) * u * m.speed * rf;
        const ph = J.r(seed, L, i, 4) * TAU;
        const y = H + 10 - wrap(y0 + vy * env.t, 0, H + 20);
        const x = wrap(x0 + 24 * u * Math.sin(env.t * 0.6 + ph), -20, W + 20);
        const r = (4 + J.r(seed, L, i, 5) * 10) * u * m.size;
        const hue = Math.round((360 * (1 - y / H) + L * 40 + i * 7) % 360);
        ctx.globalAlpha = 0.65 * fade * m.alpha;
        ctx.strokeStyle = `hsl(${hue} 90% 65%)`; ctx.lineWidth = Math.max(1, 2 * u);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.8 * fade * m.alpha; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(1, r * 0.16), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 7. speed lines (SonaWave: speed-lines) — fast horizontal streaks ---- */
ptReg('ptSpeed', {
  name: 'スピード線', tags: ['pop', 'graphic'],
  draw(env, P, ctx, fade) {
    const { W, H, sc } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    ctx.strokeStyle = sc.fg; ctx.lineCap = 'round';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(45 * dens);
      ctx.lineWidth = Math.max(1, 2 * u * m.size);
      ctx.globalAlpha = 0.6 * fade * m.alpha;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const y = J.r(seed, L, i, 1) * H, x0 = J.r(seed, L, i, 2) * (W + 200) - 100;
        const vx = (320 + J.r(seed, L, i, 3) * 520) * u * m.speed * rf;
        const x = wrap(x0 - vx * env.t, -100, W + 100);
        const len = (34 + J.r(seed, L, i, 4) * 96) * u * m.size;
        ctx.moveTo(x, y); ctx.lineTo(x + len, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
});

/* ---- 8. hyperspace warp (SonaWave: hyperspace) — radial streaks ---- */
ptReg('ptWarp', {
  name: 'ワープ', tags: ['pop', 'graphic'],
  draw(env, P, ctx, fade) {
    const { W, H } = env, u = H / 720, rf = reactOf(env), seed = P.seed || 1;
    const dens = densityOf(W, H), layers = J.particleLayersOf(env.fx);
    const cx = W / 2, cy = H * 0.45, maxR = Math.hypot(W, H) * 0.6;
    ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    for (let L = 0; L < layers; L++) {
      const m = layerMul(L), N = Math.round(60 * dens);
      ctx.lineWidth = Math.max(1, 2 * u * m.size);
      for (let i = 0; i < N; i++) {
        const a = J.r(seed, L, i, 1) * TAU;
        const vr = (70 + J.r(seed, L, i, 2) * 150) * u * m.speed * rf;
        const rad = wrap(J.r(seed, L, i, 3) * maxR + vr * env.t, 0, maxR);
        const r0 = rad * 0.82, ca = Math.cos(a), sa = Math.sin(a);
        ctx.globalAlpha = (0.25 + 0.65 * (rad / maxR)) * fade * m.alpha;
        ctx.beginPath();
        ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * rad, cy + sa * rad);
        ctx.stroke();
        ctx.globalAlpha = 0.9 * (rad / maxR) * fade * m.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx + ca * rad, cy + sa * rad, Math.max(1, 1.4 * u * m.size), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
});
})();
