/* AURA pack: 3D text (P1 v0.19.0) — 5 new effects with a dual behaviour.
   When 3D is on AND the host is ready (J.text3d.ready), the effect writes a
   3D descriptor (it._t3d / env._t3dCam) and the plane/block renderer does the
   real transform; the 2D charFn is skipped so nothing is applied twice.
   When 3D is off, not ready, or the pass is not the main one (ghost pass,
   morph recording), the same effect falls back to a 2D approximation with
   the repo's existing tools (sx = cos(angle), per-glyph rot, extrude).
   Plane 3D = 2D text on a 3D plane (M1). Block 3D = real extruded text
   (M2). The distinction is user-visible in the UI. */
(() => {
'use strict';
const E = J.E;
const PK = '3d';
const reg = (g, k, d) => J.register(g, k, d, PK);
const DEG = J.DEG, clamp = J.clamp, lerp = J.lerp;
const HIDE = Object.freeze({ hide: true });

const oQuart = x => 1 - Math.pow(1 - clamp(x), 4);
const oBack = (x, s) => E.outBack(clamp(x), s);
const stg = (p, k, spread) => clamp((p - spread * k) / (1 - spread));
const ordLR = (i, n) => (n > 1 ? i / (n - 1) : 0);
const isHex = c => typeof c === 'string' && c[0] === '#' && (c.length === 7 || c.length === 4);
const colOf = it => (isHex(it.color) ? it.color : '#ffffff');
const pick = (...cs) => cs.find(isHex) || '#ffffff';
const glyphN = it => [...String(it.text || '').replace(/\s/g, '')].length;
const alive = (it, amin = 0.9) => it.fill !== false && (it.alpha ?? 1) >= amin && !!it.text && it.size > 1;
const addPre = (it, f) => { const p = it.pre; it.pre = p ? (e, i) => { p(e, i); f(e, i); } : f; };
const sized = (it, env, f) => { f(it, env); addPre(it, (e, i) => f(i, e)); };
function glyphs(it, fn) {
  if (!it.charFns) it.charFns = [];
  it.charFns.push(fn);
  if (!it._enterFix) {
    it._enterFix = true;
    addPre(it, (env, x) => { if (x.charFns && x.charFns.length > 1) x.charFn = J.combineChar(x.charFns); });
  }
  return fn;
}

/* True only on the path the 3D seam actually renders (mirrors the seam
   condition in J.mainDraw): main pass, no morph recording, text visible,
   toggle on, host ready. Ghost passes and morph always take the 2D path. */
const is3D = env => env.pass === 'main' && !env.glyphLog && !env.hideText &&
  env.fx && env.fx.threeD && J.text3d && J.text3d.ready;
const depthOf = env => (env.fx && env.fx.threeDepth != null ? +env.fx.threeDepth : 0.7);
const t3 = it => (it._t3d = it._t3d || {});

/* ---------------- enter ---------------- */
reg('enter', 'textFlip3d', {
  // whole-line card flip around the vertical axis (3D plane); per-glyph flip in 2D
  name: '3Dフリップ', tags: ['pop', 'graphic', 'editorial'], w: 1,
  apply(env, it, p, ctx) {
    if (is3D(env)) {
      // Whole-line card flip: every item in the cut shares ONE rotY from the
      // CUT's progress, so the line flips as a single card. (p is the item's
      // staggered progress — using it here splits the line into cards at
      // different angles mid-flip, which reads as garbled text. QA-021.)
      // env.lt is the item-delayed time here; add the stagger back to recover
      // the cut time. ctx carries inDur; fall back to p when it is absent.
      const inDur = ctx && ctx.inDur;
      const pCut = inDur ? clamp(((env.lt || 0) + (it.delay || 0)) / Math.max(0.01, inDur)) : p;
      // pCut: 0 -> 1 over inDur; rotY PI (backwards) -> 0 (facing the viewer)
      t3(it).rotY = (1 - oBack(pCut, 1.25)) * Math.PI;
      // M2 block layer: the per-word flip staggers from this cut progress
      // (renderBlock reads flipP and offsets each word by its index)
      t3(it).flipP = pCut;
      return;
    }
    const col = colOf(it), bg = pick(env.sc.bg),
      back = it.color === env.sc.accent ? pick(env.sc.accent2, env.sc.fg) : pick(env.sc.accent, env.sc.fg);
    glyphs(it, (i, g, n) => {
      const q = stg(p, ordLR(i, n), 0.45);
      if (q <= 0) return HIDE; if (q >= 1) return null;
      const pop = oBack(q / 0.22, 1.6), th = (1 - oBack((q - 0.22) / 0.78, 1.25)) * 180 * DEG,
        c = Math.cos(th), sh = Math.abs(Math.sin(th));
      if (c < 0) return { ch: '■', sx: Math.max(0.04, -c), s: 1.02 * pop, color: J.mix(back, bg, sh * 0.35), a: clamp(q * 8) };
      return { sx: Math.max(0.04, c), color: J.mix(col, bg, Math.min(0.5, sh * 0.5)) };
    });
  },
});

/* ---------------- hold ---------------- */
reg('hold', 'spin3d', {
  // the line sways around the vertical axis (3D plane); per-glyph sway in 2D
  name: '3Dスピン', tags: ['pop', 'graphic'], w: 1,
  apply(env, it, amt) {
    const depth = depthOf(env);
    if (is3D(env)) {
      const ph = env.lt * Math.PI;   // 0.5 Hz sway
      const t = t3(it);
      t.rotY = Math.sin(ph) * 25 * DEG * depth * amt;
      t.rotX = Math.sin(ph * 0.6 + 1) * 8 * DEG * depth * amt;
      // beat pulse: the plane leans a little harder right on the beat
      if (env.fx.beatSync && env.beat && typeof env.beat.since === 'number' && env.beat.since < 0.3) {
        t.rotY += Math.exp(-env.beat.since * 10) * 10 * DEG * depth * amt;
      }
      return;
    }
    glyphs(it, (i, g, n) => {
      const ph = (n > 1 ? i / (n - 1) : 0) * Math.PI * 2;
      return { rot: Math.sin(env.lt * 3 + ph) * 10 * amt };
    });
  },
});

/* ---------------- camera ---------------- */
reg('cam', 'dolly3d', {
  // the text rushes toward the viewer (plane moves on Z); scale-up in 2D
  name: 'ドリー', tags: ['calm', 'emotional', 'graphic'], w: 0.9,
  get(env) {
    const k = J.clamp(env.lt / Math.max(0.3, env.cut.dur));
    if (is3D(env)) {
      env._t3dCam = env._t3dCam || {};
      env._t3dCam.dolly = k;
      return { s: 1 };
    }
    return { s: 1 + 0.35 * k * (env.fx.motion ?? 0.7) };
  },
});

reg('cam', 'orbit3d', {
  // the camera circles the text (3D); a slight rotation in 2D
  name: 'オービット', tags: ['calm', 'emotional', 'graphic'], w: 0.8,
  get(env) {
    const ang = Math.sin(env.lt * 0.9) * 30 * DEG * depthOf(env);   // radians, ±30° × depth
    if (is3D(env)) {
      env._t3dCam = env._t3dCam || {};
      env._t3dCam.orbit = ang;
      return { s: 1 };
    }
    return { rot: (ang * 0.3) / DEG, s: 1 };
  },
});

/* ---------------- treatment ---------------- */
reg('treat', 'khoi3d', {
  // block text: shaded side faces (extrude with a front->back colour ramp).
  // In 3D the plane also sits at a slight angle so the sides read; in M2 this
  // becomes a real extruded block with two materials.
  name: '立体ブロック', tags: ['pop', 'graphic'], w: 0.9,
  plan: rng => ({ d: rng.range(0.05, 0.09), dir: rng.pick([[1, 1], [1, 1], [0.6, 1]]) }),
  apply(env, it, P) {
    if (!alive(it)) return;
    const col = colOf(env, it);
    const side = J.mix(col, '#000000', 0.55);
    const back = J.mix(col, '#000000', 0.75);
    sized(it, env, i => {
      const L = i.size * P.d;
      i.extrude = { n: clamp(Math.round(L / 2), 4, 14), dx: P.dir[0] * L, dy: P.dir[1] * L, color: side, shade: [side, back], a: 1 };
    });
    if (is3D(env)) t3(it).rotY = 0.2 * depthOf(env);
  },
});
})();
