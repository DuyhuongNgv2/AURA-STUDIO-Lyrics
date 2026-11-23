/* ============================================================
   LyricWave — Lottie stickers (M6 v0.31.0): foreground overlays
   rendered with the vendored lottie-web canvas renderer.
   The 8 animation payloads (J.LOTTIE_DATA, appended below) are
   hand-authored Bodymovin shape data from HAY Studio73's SonaWave
   (src/data/embeddedLottieData.ts, MIT) — shapes only, no gradients,
   no masks, no expressions, so the canvas renderer draws them
   reliably. No network, no .dotlottie, no external URL.
   Pure helpers (normalize / frame math) are node-testable; anything
   touching document/lottie is guarded so the file loads in node.
   ============================================================ */
(() => {
'use strict';

/* id, Japanese display name, Vietnamese, English — the picker shows the
   Japanese literal (i18n pass) like every other effect name. */
J.LOTTIE_STICKERS = [
  { id: 'stVinyl', name: 'レコード', vi: 'Đĩa than xoay', en: 'Spinning vinyl', zhHans: '旋转黑胶', zhHant: '旋轉黑膠', ko: '회전 바이닐' },
  { id: 'stEqualizer', name: 'イコライザー', vi: 'Sóng nhạc equalizer', en: 'Equalizer wave', zhHans: '均衡器音波', zhHant: '等化器音波', ko: '이퀄라이저 파형' },
  { id: 'stHeart', name: 'ハート', vi: 'Trái tim neon đập', en: 'Neon beating heart', zhHans: '霓虹跳动爱心', zhHant: '霓虹跳動愛心', ko: '네온 하트' },
  { id: 'stNotes', name: '音符', vi: 'Nốt nhạc bay', en: 'Dancing music notes', zhHans: '跃动音符', zhHant: '躍動音符', ko: '춤추는 음표' },
  { id: 'stLightning', name: '雷', vi: 'Tia sét cyber', en: 'Cyber lightning bolt', zhHans: '赛博闪电', zhHant: '賽博閃電', ko: '사이버 번개' },
  { id: 'stSpeaker', name: 'スピーカー', vi: 'Loa bass nảy', en: 'Pumping bass speaker', zhHans: '重低音音箱', zhHant: '重低音喇叭', ko: '베이스 스피커' },
  { id: 'stSparkle', name: '星', vi: 'Sao lấp lánh', en: 'Sparkling stars', zhHans: '闪烁星星', zhHant: '閃爍星星', ko: '반짝이는 별' },
  { id: 'stFlame', name: '炎', vi: 'Ngọn lửa theo nhạc', en: 'Fire flame beat', zhHans: '节拍火焰', zhHant: '節拍火焰', ko: '비트 불꽃' },
];
J.lottieSticker = (id) => J.LOTTIE_STICKERS.find(s => s.id === id) || null;
/* { w, h, fr, ip, op } of an embedded animation, or null when unknown */
J.lottieMeta = (id) => {
  const d = J.LOTTIE_DATA && J.LOTTIE_DATA[id];
  if (!d || typeof d !== 'object') return null;
  return { w: +d.w || 300, h: +d.h || 300, fr: +d.fr || 60, ip: +d.ip || 0, op: +d.op || 60 };
};
/* the animation frame (in frames, not seconds) a sticker shows at time t */
J.stickerFrame = (id, t, start) => {
  const m = J.lottieMeta(id);
  if (!m) return 0;
  const dur = Math.max(0.01, (m.op - m.ip) / m.fr);
  let local = (t - (start || 0)) % dur;
  if (local < 0) local += dur;
  return m.ip + local * m.fr;
};

let _stickerSeq = 0;
const _cl = (v, a, b) => Math.min(b, Math.max(a, v));
J.stickerDefault = (anim, start, end) => ({
  id: 'st' + (++_stickerSeq) + '-' + Date.now().toString(36),
  anim: J.lottieSticker(anim) ? anim : 'stVinyl',
  x: 0.5, y: 0.5, size: 0.25,
  start: Math.max(0, +start || 0),
  end: Math.max(0.5, (+end || 0) > (+start || 0) ? +end : (+start || 0) + 2),
});
/* project files are untrusted: keep only known animations, clamp everything */
J.stickerNormalize = (list) => {
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || typeof s !== 'object' || !J.lottieSticker(s.anim)) continue;
    const start = isFinite(+s.start) ? Math.max(0, +s.start) : 0;
    let end = isFinite(+s.end) ? Math.max(0, +s.end) : start + 2;
    if (!(end > start)) end = start + 2;
    out.push({
      id: typeof s.id === 'string' && /^[\w-]+$/.test(s.id) ? s.id.slice(0, 40) : 'st' + out.length,
      anim: s.anim,
      x: _cl(isFinite(+s.x) ? +s.x : 0.5, 0, 1),
      y: _cl(isFinite(+s.y) ? +s.y : 0.5, 0, 1),
      size: _cl(isFinite(+s.size) ? +s.size : 0.25, 0.05, 0.6),
      start, end,
    });
  }
  return out;
};

J.lottieReady = () => typeof window !== 'undefined' && !!window.lottie && typeof window.lottie.loadAnimation === 'function';

/* SonaWave's hand-authored sticker data omits Bodymovin easing handles
   (i/o) on keyframes — only {t, s} is present. lottie-web 5.13.0's
   interpolateValue reads keyData.o.x unconditionally whenever a frame
   falls strictly between two keyframes, so it throws (swallowed by
   AnimationItem.renderFrame's try/catch) and the canvas stays blank:
   goToAndStop never draws, play() draws only a frozen frame-0 for some
   stickers and nothing at all for others. Normalise once per instance:
   add the standard LINEAR handles (o 0.167 / i 0.833, the exact values
   Bodymovin writes for linear keyframes) to every keyframe that lacks
   them. Visual result is unchanged — it is what the data means. */
J.lottieNormalizeData = (data) => {
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.k) && o.k.length && typeof o.k[0] === 'object' && o.k[0] !== null && 't' in o.k[0] && 's' in o.k[0]) {
      const n = Array.isArray(o.k[0].s) ? o.k[0].s.length : 1;
      const fill = (v) => { const a = []; for (let i = 0; i < n; i++) a.push(v); return a; };
      for (let i = 0; i < o.k.length; i++) {
        const kf = o.k[i];
        if (!kf.o) kf.o = { x: fill(0.167), y: fill(0.167) };
        if (!kf.i) kf.i = { x: fill(0.833), y: fill(0.833) };
      }
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
  return data;
};

/* one cached lottie-web canvas instance per animation id: an offscreen
   host div (never visible) holds a container per animation; the canvas
   renderer draws into it, and each frame is copied onto the main canvas.
   Instances are created lazily on first sight so a project with no
   stickers never touches lottie-web. */
const _inst = new Map();
let _host = null;
function _lottieInstance(anim) {
  if (_inst.has(anim)) return _inst.get(anim);
  if (typeof document === 'undefined' || !J.lottieReady()) return null;
  const data = J.LOTTIE_DATA && J.LOTTIE_DATA[anim];
  if (!data) return null;
  try {
    if (!_host) {
      _host = document.createElement('div');
      _host.id = 'lottie-offscreen-host';
      _host.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;pointer-events:none;opacity:0.001;z-index:-9999;overflow:hidden';
      document.body.appendChild(_host);
    }
    const box = document.createElement('div');
    box.style.cssText = 'width:256px;height:256px';
    _host.appendChild(box);
    const animation = window.lottie.loadAnimation({
      container: box, renderer: 'canvas', loop: false, autoplay: false, animationData: J.lottieNormalizeData(JSON.parse(JSON.stringify(data))),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    const canvas = box.querySelector('canvas');
    const inst = { animation, canvas };
    _inst.set(anim, inst);
    return inst;
  } catch (e) { return null; }
}

/* Draw every sticker visible at time t onto ctx (device pixels; the
   caller passes the render scale). Returns how many stickers were drawn.
   Never throws: one broken sticker must not kill the frame. */
J.drawStickers = (ctx, plan, t, scale) => {
  let drawn = 0;
  try {
    const list = (plan && plan.stickers) || [];
    if (!list.length || typeof document === 'undefined') return 0;
    const W = plan.W, H = plan.H, sc = scale || 1;
    for (const s of list) {
      try {
        if (!(t >= s.start && t < s.end)) continue;
        const inst = _lottieInstance(s.anim);
        if (!inst || !inst.canvas) continue;
        inst.animation.goToAndStop(J.stickerFrame(s.anim, t, s.start), true);
        const m = J.lottieMeta(s.anim) || { w: 300, h: 300 };
        const sh = s.size * H * sc, sw = sh * (m.w / m.h);
        const dx = s.x * W * sc - sw / 2, dy = s.y * H * sc - sh / 2;
        ctx.save();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
        ctx.drawImage(inst.canvas, dx, dy, sw, sh);
        ctx.restore();
        drawn++;
      } catch (e) { /* one sticker fails — the frame goes on */ }
    }
  } catch (e) {}
  return drawn;
};
})();
// Embedded Lottie animation data (8 stickers) — see src/14_lottie.js header.
J.LOTTIE_DATA = {
  'stVinyl': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 120,
  w: 300,
  h: 300,
  nm: 'Spinning Vinyl Record',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Vinyl Disc Rotating',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 120, s: [360] },
          ],
        },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        // Base dark vinyl body
        {
          ty: 'gr',
          nm: 'Base Vinyl',
          it: [
            { ty: 'el', s: { a: 0, k: [270, 270] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.07, 0.08, 0.1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [0.35, 0.4, 0.5, 1] }, w: { a: 0, k: 2.5 }, o: { a: 0, k: 70 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Outer Sound Groove Ring 1
        {
          ty: 'gr',
          nm: 'Groove Ring 1',
          it: [
            { ty: 'el', s: { a: 0, k: [230, 230] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: [0.35, 0.45, 0.65, 1] }, w: { a: 0, k: 1.5 }, o: { a: 0, k: 40 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Sound Groove Ring 2
        {
          ty: 'gr',
          nm: 'Groove Ring 2',
          it: [
            { ty: 'el', s: { a: 0, k: [180, 180] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: [0.35, 0.45, 0.65, 1] }, w: { a: 0, k: 1.5 }, o: { a: 0, k: 40 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Center Album Sticker (Retro Magenta / Coral)
        {
          ty: 'gr',
          nm: 'Album Label',
          it: [
            { ty: 'el', s: { a: 0, k: [105, 105] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.92, 0.25, 0.48, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 0.85, 0.3, 1] }, w: { a: 0, k: 2.5 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Inner Label Ring
        {
          ty: 'gr',
          nm: 'Inner Ring',
          it: [
            { ty: 'el', s: { a: 0, k: [65, 65] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, w: { a: 0, k: 1.5 }, o: { a: 0, k: 60 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Center Spindle Hole
        {
          ty: 'gr',
          nm: 'Spindle Center',
          it: [
            { ty: 'el', s: { a: 0, k: [22, 22] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.03, 0.03, 0.05, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [0.8, 0.8, 0.85, 1] }, w: { a: 0, k: 1.5 }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
  ],
},
  'stEqualizer': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 60,
  w: 300,
  h: 300,
  nm: 'Equalizer Soundwave',
  ddd: 0,
  assets: [],
  layers: [0, 1, 2, 3, 4].map((i) => {
    const xPos = 70 + i * 40;
    const h1 = 30 + (i % 3) * 30;
    const h2 = 95 - (i % 2) * 35;
    const h3 = 135 - (i % 3) * 25;
    const h4 = 55 + (i % 2) * 35;
    return {
      ddd: 0,
      ind: i + 1,
      ty: 4,
      nm: `EQ Bar ${i + 1}`,
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [xPos, 220, 0] },
        a: { a: 0, k: [0, 60, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, h1, 100] },
            { t: 15 + (i % 3) * 5, s: [100, h3, 100] },
            { t: 30 + (i % 2) * 4, s: [100, h2, 100] },
            { t: 45 + (i % 3) * 3, s: [100, h4, 100] },
            { t: 60, s: [100, h1, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [24, 120] },
              p: { a: 0, k: [0, 60] },
              r: { a: 0, k: 6 },
            },
            {
              ty: 'fl',
              c: {
                a: 0,
                k: [
                  0.32 + i * 0.14,
                  0.48 + (i % 2) * 0.22,
                  0.95 - i * 0.08,
                  1,
                ],
              },
              o: { a: 0, k: 100 },
            },
            {
              ty: 'st',
              c: { a: 0, k: [1, 1, 1, 1] },
              w: { a: 0, k: 1.5 },
              o: { a: 0, k: 50 },
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    };
  }),
},
  'stHeart': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 60,
  w: 300,
  h: 300,
  nm: 'Neon Pulsing Heart',
  ddd: 0,
  assets: [],
  layers: [
    // Outer Glow Ring Pulsing
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Pulse Glow Halo',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [20] },
            { t: 15, s: [75] },
            { t: 30, s: [25] },
            { t: 45, s: [85] },
            { t: 60, s: [20] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [85, 85, 100] },
            { t: 15, s: [115, 115, 100] },
            { t: 30, s: [95, 95, 100] },
            { t: 45, s: [125, 125, 100] },
            { t: 60, s: [85, 85, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', s: { a: 0, k: [210, 210] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: [1, 0.2, 0.6, 1] }, w: { a: 0, k: 4 }, o: { a: 0, k: 70 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Left Heart Lobe
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Heart Body Left',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: -45 },
        p: { a: 0, k: [136, 142, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 12, s: [122, 122, 100] },
            { t: 24, s: [105, 105, 100] },
            { t: 36, s: [128, 128, 100] },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [70, 110] }, p: { a: 0, k: [0, -20] }, r: { a: 0, k: 35 } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.15, 0.5, 1] }, o: { a: 0, k: 95 } },
            { ty: 'st', c: { a: 0, k: [1, 0.7, 0.9, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Right Heart Lobe
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Heart Body Right',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 45 },
        p: { a: 0, k: [164, 142, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 12, s: [122, 122, 100] },
            { t: 24, s: [105, 105, 100] },
            { t: 36, s: [128, 128, 100] },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [70, 110] }, p: { a: 0, k: [0, -20] }, r: { a: 0, k: 35 } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.15, 0.5, 1] }, o: { a: 0, k: 95 } },
            { ty: 'st', c: { a: 0, k: [1, 0.7, 0.9, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
},
  'stNotes': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 90,
  w: 300,
  h: 300,
  nm: 'Dancing Musical Notes',
  ddd: 0,
  assets: [],
  layers: [
    // Note 1 (Left eighth note)
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Musical Note 1',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [20] },
            { t: 20, s: [100] },
            { t: 70, s: [100] },
            { t: 90, s: [10] },
          ],
        },
        r: {
          a: 1,
          k: [
            { t: 0, s: [-15] },
            { t: 45, s: [15] },
            { t: 90, s: [-15] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: 0, s: [110, 240, 0] },
            { t: 90, s: [95, 70, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [90, 90, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          nm: 'Note Head',
          it: [
            { ty: 'el', s: { a: 0, k: [28, 22] }, p: { a: 0, k: [-8, 12] } },
            { ty: 'fl', c: { a: 0, k: [0.3, 0.8, 1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: -20 }, o: { a: 0, k: 100 } },
          ],
        },
        {
          ty: 'gr',
          nm: 'Stem and Flag',
          it: [
            { ty: 'rc', s: { a: 0, k: [5, 45] }, p: { a: 0, k: [6, -10] }, r: { a: 0, k: 2 } },
            { ty: 'rc', s: { a: 0, k: [20, 8] }, p: { a: 0, k: [14, -30] }, r: { a: 0, k: 3 } },
            { ty: 'fl', c: { a: 0, k: [0.4, 0.85, 1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    // Note 2 (Right sixteenth beam note)
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Musical Note 2',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 15, s: [20] },
            { t: 35, s: [100] },
            { t: 75, s: [100] },
            { t: 90, s: [10] },
          ],
        },
        r: {
          a: 1,
          k: [
            { t: 0, s: [12] },
            { t: 45, s: [-12] },
            { t: 90, s: [12] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: 0, s: [195, 230, 0] },
            { t: 90, s: [210, 60, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [110, 110, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', s: { a: 0, k: [26, 20] }, p: { a: 0, k: [-16, 12] } },
            { ty: 'el', s: { a: 0, k: [26, 20] }, p: { a: 0, k: [16, 8] } },
            { ty: 'rc', s: { a: 0, k: [4, 42] }, p: { a: 0, k: [-4, -8] }, r: { a: 0, k: 2 } },
            { ty: 'rc', s: { a: 0, k: [4, 42] }, p: { a: 0, k: [28, -12] }, r: { a: 0, k: 2 } },
            { ty: 'rc', s: { a: 0, k: [36, 7] }, p: { a: 0, k: [12, -28] }, r: { a: 0, k: -6 } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.35, 0.85, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
  ],
},
  'stLightning': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 40,
  w: 300,
  h: 300,
  nm: 'Cyber Lightning Bolt',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Lightning Flash',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [100] },
            { t: 8, s: [30] },
            { t: 14, s: [100] },
            { t: 20, s: [80] },
            { t: 28, s: [25] },
            { t: 34, s: [100] },
            { t: 40, s: [100] },
          ],
        },
        r: { a: 0, k: 10 },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 14, s: [115, 115, 100] },
            { t: 28, s: [95, 95, 100] },
            { t: 40, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        // Lightning segments composed of angled rounded bars
        {
          ty: 'gr',
          nm: 'Bolt Top',
          it: [
            { ty: 'rc', s: { a: 0, k: [22, 100] }, p: { a: 0, k: [12, -45] }, r: { a: 0, k: 6 } },
            { ty: 'fl', c: { a: 0, k: [0.2, 0.95, 1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 25 }, o: { a: 0, k: 100 } },
          ],
        },
        {
          ty: 'gr',
          nm: 'Bolt Middle Jag',
          it: [
            { ty: 'rc', s: { a: 0, k: [20, 95] }, p: { a: 0, k: [-8, 10] }, r: { a: 0, k: 5 } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.95, 0.2, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 95 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: -32 }, o: { a: 0, k: 100 } },
          ],
        },
        {
          ty: 'gr',
          nm: 'Bolt Bottom Spear',
          it: [
            { ty: 'rc', s: { a: 0, k: [18, 90] }, p: { a: 0, k: [5, 55] }, r: { a: 0, k: 4 } },
            { ty: 'fl', c: { a: 0, k: [0.2, 0.95, 1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 22 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 40,
      st: 0,
    },
  ],
},
  'stSpeaker': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 60,
  w: 300,
  h: 300,
  nm: 'Pumping Bass Subwoofer',
  ddd: 0,
  assets: [],
  layers: [
    // Expanding Acoustic Wave 1
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Acoustic Wave 1',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [90] },
            { t: 30, s: [40] },
            { t: 60, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [80, 80, 100] },
            { t: 60, s: [150, 150, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', s: { a: 0, k: [220, 220] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: [0.4, 0.6, 1, 1] }, w: { a: 0, k: 3.5 }, o: { a: 0, k: 80 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Main Speaker Cabinet & Pumping Cone
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Speaker Cone',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 10, s: [124, 124, 100] },
            { t: 25, s: [96, 96, 100] },
            { t: 40, s: [112, 112, 100] },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        // Outer cabinet frame
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [180, 180] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 28 } },
            { ty: 'fl', c: { a: 0, k: [0.1, 0.12, 0.16, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [0.3, 0.35, 0.45, 1] }, w: { a: 0, k: 4 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Outer Subwoofer Cone
        {
          ty: 'gr',
          it: [
            { ty: 'el', s: { a: 0, k: [135, 135] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.18, 0.22, 0.3, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [0.85, 0.3, 0.5, 1] }, w: { a: 0, k: 3 }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
        // Center Dust Cap
        {
          ty: 'gr',
          it: [
            { ty: 'el', s: { a: 0, k: [55, 55] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.3, 0.55, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 0.9, 0.3, 1] }, w: { a: 0, k: 2 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
},
  'stSparkle': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 60,
  w: 300,
  h: 300,
  nm: 'Sparkling Cyber Stars',
  ddd: 0,
  assets: [],
  layers: [
    // Center big star
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Main Star',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 60, s: [90] },
          ],
        },
        p: { a: 0, k: [150, 150, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [70, 70, 100] },
            { t: 30, s: [130, 130, 100] },
            { t: 60, s: [70, 70, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [18, 140] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 9 } },
            { ty: 'rc', s: { a: 0, k: [140, 18] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 9 } },
            { ty: 'fl', c: { a: 0, k: [1, 0.95, 0.4, 1] }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, w: { a: 0, k: 2 }, o: { a: 0, k: 90 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Mini satellite star 1
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Mini Star 1',
      sr: 1,
      ks: {
        o: { a: 0, k: 90 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [45] },
            { t: 60, s: [-45] },
          ],
        },
        p: { a: 0, k: [75, 90, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [110, 110, 100] },
            { t: 30, s: [50, 50, 100] },
            { t: 60, s: [110, 110, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [10, 70] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 5 } },
            { ty: 'rc', s: { a: 0, k: [70, 10] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 5 } },
            { ty: 'fl', c: { a: 0, k: [0.4, 0.95, 1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Mini satellite star 2
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Mini Star 2',
      sr: 1,
      ks: {
        o: { a: 0, k: 90 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 60, s: [90] },
          ],
        },
        p: { a: 0, k: [225, 210, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [40, 40, 100] },
            { t: 30, s: [100, 100, 100] },
            { t: 60, s: [40, 40, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [10, 65] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 5 } },
            { ty: 'rc', s: { a: 0, k: [65, 10] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 5 } },
            { ty: 'fl', c: { a: 0, k: [1, 0.45, 0.85, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
},
  'stFlame': {
  v: '5.5.7',
  fr: 60,
  ip: 0,
  op: 60,
  w: 300,
  h: 300,
  nm: 'Fire Flame Beat',
  ddd: 0,
  assets: [],
  layers: [
    // Outer Red Flame
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Outer Flame Red',
      sr: 1,
      ks: {
        o: { a: 0, k: 90 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [-6] },
            { t: 30, s: [6] },
            { t: 60, s: [-6] },
          ],
        },
        p: { a: 0, k: [150, 160, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 15, s: [115, 125, 100] },
            { t: 30, s: [95, 95, 100] },
            { t: 45, s: [120, 130, 100] },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [90, 120] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 45 } },
            { ty: 'fl', c: { a: 0, k: [0.95, 0.2, 0.1, 1] }, o: { a: 0, k: 95 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 45 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Middle Orange Flame
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Middle Flame Orange',
      sr: 1,
      ks: {
        o: { a: 0, k: 95 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [6] },
            { t: 30, s: [-6] },
            { t: 60, s: [6] },
          ],
        },
        p: { a: 0, k: [150, 165, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [85, 85, 100] },
            { t: 20, s: [105, 110, 100] },
            { t: 40, s: [80, 80, 100] },
            { t: 60, s: [85, 85, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [65, 90] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 32 } },
            { ty: 'fl', c: { a: 0, k: [1, 0.55, 0.1, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 45 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    // Center Yellow Core Flame
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Core Flame Yellow',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 45 },
        p: { a: 0, k: [150, 172, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [70, 70, 100] },
            { t: 25, s: [100, 100, 100] },
            { t: 60, s: [70, 70, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', s: { a: 0, k: [38, 55] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 18 } },
            { ty: 'fl', c: { a: 0, k: [1, 0.95, 0.35, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
},
};
