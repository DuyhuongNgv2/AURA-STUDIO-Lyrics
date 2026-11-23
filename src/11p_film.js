/* JIZURA pack: film light — cinematic light leaks and flares (M5 v0.30.0)
   Six film-light styles, rewritten in plain AURA-style JS from the
   *design* of SonaWave's FilmLightTab.tsx (HAY Studio73, MIT — see
   THIRD_PARTY_NOTICES.md): no TS/React code was carried over.
   Each style is an FXE entry: a post-processing event drawn additively
   ('screen' / 'lighter') over the finished frame. Events are scheduled
   by the existing pickFx machinery (cut edge + mid-cut, dur 24–48
   frames so the light lasts 1–2 s) and by previewPlan for the 手法 tab
   thumbnails — no planner change. Positions drift slowly with I.t and
   only use the deterministic 24 fps step hash, so Preview and offline
   export agree; the beat only lifts the alpha a little. */
(() => {
'use strict';
const clamp = J.clamp, TAU = J.TAU;
const PK = 'film';
const reg = (k, d) => J.register('fx', k, Object.assign({ dur: 36, amp: 1, w: 1, mid: true }, d), PK);

/* in-out envelope over the event + a small beat lift */
const envA = (ev, k, I, base) => {
  const amp = (ev && ev.amp) || 1;
  const bp = (I.beat && I.beat.since < 0.25) ? 1 + 0.35 * Math.exp(-I.beat.since * 8) : 1;
  return base * amp * Math.sin(Math.PI * clamp(k, 0, 1)) * bp;
};
const radial = (ctx, x, y, r, c0, c1) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
};

const filmReg = (k, d) => reg(k, Object.assign({}, d, {
  draw(ctx, ev, k, I) {
    const { cw, ch, t } = I, a = envA(ev, k, I, d.base || 0.5);
    if (a <= 0.01) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    try { d.draw(ctx, I, a, t); } finally { ctx.restore(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
}));

/* ---- 1. vintage 35mm burn: warm amber + ruby leaks from the corners ---- */
filmReg('filmVintage', {
  name: 'ヴィンテージリーク', tags: ['emotional', 'calm'], base: 0.5,
  draw(ctx, I, a, t) {
    const { cw, ch } = I, R = Math.min(cw, ch) * 0.75;
    const dx = Math.sin(t * 0.4) * cw * 0.03, dy = Math.cos(t * 0.33) * ch * 0.03;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a;
    ctx.fillStyle = radial(ctx, cw * 0.08 + dx, ch * 0.06 + dy, R, 'rgba(255,122,0,0.85)', 'rgba(255,122,0,0)');
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = radial(ctx, cw * 0.94 - dx, ch * 0.92 - dy, R * 0.9, 'rgba(255,0,85,0.7)', 'rgba(255,0,85,0)');
    ctx.fillRect(0, 0, cw, ch);
  },
});

/* ---- 2. anamorphic flare: horizontal cyan streak + flare core ---- */
filmReg('filmAnamorphic', {
  name: 'アナモフィックフレア', tags: ['pop', 'graphic'], base: 0.55,
  draw(ctx, I, a, t) {
    const { cw, ch } = I, cy = ch * (0.42 + 0.06 * Math.sin(t * 0.5)), cx = cw * (0.36 + 0.04 * Math.sin(t * 0.31));
    ctx.globalCompositeOperation = 'lighter';
    const band = ctx.createLinearGradient(0, cy - ch * 0.09, 0, cy + ch * 0.09);
    band.addColorStop(0, 'rgba(0,212,255,0)'); band.addColorStop(0.5, `rgba(0,212,255,${0.55 * a})`); band.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = band; ctx.fillRect(0, cy - ch * 0.09, cw, ch * 0.18);
    ctx.globalAlpha = a;
    ctx.fillStyle = radial(ctx, cx, cy, Math.min(cw, ch) * 0.16, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
    ctx.fillRect(cx - ch * 0.2, cy - ch * 0.2, ch * 0.4, ch * 0.4);
    ctx.fillStyle = radial(ctx, cx + cw * 0.22, cy, Math.min(cw, ch) * 0.07, 'rgba(0,212,255,0.8)', 'rgba(0,212,255,0)');
    ctx.fillRect(cx, cy - ch * 0.1, cw * 0.3, ch * 0.2);
  },
});

/* ---- 3. prism rainbow: soft 7-colour diagonal spectrum ---- */
filmReg('filmPrism', {
  name: 'プリズムレインボー', tags: ['emotional', 'pop'], base: 0.5,
  draw(ctx, I, a, t) {
    const { cw, ch } = I;
    ctx.globalCompositeOperation = 'screen';
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.rotate(-0.5 + 0.05 * Math.sin(t * 0.4));
    const cols = ['#ff5b5b', '#ff9a3c', '#ffe14d', '#4dff7a', '#3cc8ff', '#6a5cff', '#c95bff'];
    const bw = cw * 0.09;
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = cols[i];
      ctx.fillRect((i - 3.5) * bw, -ch, bw * 0.82, ch * 2);
    }
    ctx.restore();
  },
});

/* ---- 4. golden hour: warm diagonal sunbeams + light dust ---- */
filmReg('filmGolden', {
  name: 'ゴールデンアワー', tags: ['emotional', 'calm'], base: 0.8,
  draw(ctx, I, a, t) {
    const { cw, ch } = I;
    ctx.globalCompositeOperation = 'screen';
    ctx.save();
    ctx.translate(cw, 0); ctx.rotate(0.6 + 0.03 * Math.sin(t * 0.3));
    for (let i = 0; i < 3; i++) {
      const w = ch * (0.05 + i * 0.035);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, `rgba(255,190,60,${0.5 * a})`); g.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(i * ch * 0.16, -ch * 0.2, w, ch * 2.4);
    }
    ctx.restore();
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 24; i++) {
      const x = J.r(I.step, i, 1) * cw, y = J.r(I.step, i, 2) * ch;
      const r = 1 + J.r(I.step, i, 3) * 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  },
});

/* ---- 5. cyberpunk neon leak: magenta vs cyan from opposite corners ---- */
filmReg('filmNeon', {
  name: 'ネオンリーク', tags: ['pop', 'glitch'], base: 0.55,
  draw(ctx, I, a, t) {
    const { cw, ch } = I, R = Math.min(cw, ch) * 0.8;
    const dx = Math.sin(t * 0.6) * cw * 0.02;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.fillStyle = radial(ctx, cw * 0.92 + dx, ch * 0.1, R, 'rgba(236,72,153,0.85)', 'rgba(236,72,153,0)');
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = radial(ctx, cw * 0.06 - dx, ch * 0.9, R, 'rgba(6,182,212,0.85)', 'rgba(6,182,212,0)');
    ctx.fillRect(0, 0, cw, ch);
  },
});

/* ---- 6. optical ring flare: core + rings along a diagonal ---- */
filmReg('filmLens', {
  name: 'レンズフレア', tags: ['pop', 'graphic'], base: 0.75,
  draw(ctx, I, a, t) {
    const { cw, ch } = I;
    const cx = cw * (0.62 + 0.03 * Math.sin(t * 0.4)), cy = ch * (0.38 + 0.03 * Math.cos(t * 0.33));
    const ux = -0.55, uy = 0.55;   // rings trail down-left from the core
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a;
    ctx.fillStyle = radial(ctx, cx, cy, Math.min(cw, ch) * 0.14, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
    ctx.fillRect(cx - ch * 0.2, cy - ch * 0.2, ch * 0.4, ch * 0.4);
    const rings = [0.16, 0.30, 0.48, 0.68];
    for (let i = 0; i < rings.length; i++) {
      const rx = cx + ux * rings[i] * cw, ry = cy + uy * rings[i] * ch;
      const rr = Math.min(cw, ch) * (0.05 + 0.02 * ((i * 7) % 3));
      ctx.globalAlpha = a * (0.55 - i * 0.09);
      ctx.strokeStyle = i % 2 ? '#9fd8ff' : '#ffd9a0'; ctx.lineWidth = Math.max(1, ch * 0.004);
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = radial(ctx, rx, ry, rr, 'rgba(160,210,255,0.5)', 'rgba(160,210,255,0)');
      ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
    }
  },
});
})();
