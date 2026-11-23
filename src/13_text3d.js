/* LyricWave — 3D text host (P1 v0.19.0, M1: textured-plane + M2: extrusion).
   Three.js r170 vendored (MIT), loaded from window.__LyricWave_THREE__ (JSON strings
   injected by build.py) via blob URLs — no importmap, works on a local server
   AND file://. Addon sources are rewritten at runtime so their `from 'three'`
   points at the core blob URL.
   Singleton: ONE WebGLRenderer + ONE full-frame canvas shared by Preview,
   technique-preview and Export — never one context per J.Renderer instance
   (same rule as J.gltrans, src/13_gltrans.js).
   Composite: render into this.canvas, then the caller does
   ctx.drawImage(this.canvas, 0, 0, W, H) synchronously in the same task
   (the gltrans pattern — Preview and Export share one render path through
   J.Renderer.frame()). All 3D transforms are pure functions of (t, cut, fx):
   no Math.random, no wall-clock — exports are deterministic.
   Resource control: one reused texture + one reused crop canvas, geometry
   cache capped (M2), dispose() frees renderer/geometries/materials/textures
   and revokes blob URLs; context loss falls back to 2D. */
(() => {
'use strict';

/* Module helpers (M2). camZOf: the camera distance that makes the visible
   height at z=0 exactly H plan units for the 40° fov. The easing / colour
   helpers mirror the ones in 11p_3d.js (E.outBack) and J.mix (03_text.js). */
function camZOf(H) { return (H / 2) / Math.tan(40 / 2 * Math.PI / 180); }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function E_outBack(x, s) { return (typeof J !== 'undefined' && J.E && J.E.outBack) ? J.E.outBack(clamp01(x), s) : clamp01(x); }
function _hexRgb(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _rgbHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/* Karaoke colour for a word: dim (base colour × dimAlpha) -> lit (accent).
   frac is the sung fraction (0..1). */
function mixHex(baseCol, litCol, frac, dimA) {
  const b = _hexRgb(baseCol), l = _hexRgb(litCol);
  const dim = b.map(v => v * dimA);
  return _rgbHex(dim[0] + (l[0] - dim[0]) * frac, dim[1] + (l[1] - dim[1]) * frac, dim[2] + (l[2] - dim[2]) * frac);
}
/* Darken a colour toward black by `amount` (0..1) — the extruded side faces. */
function shadeHex(hex, amount) {
  const c = _hexRgb(hex);
  return _rgbHex(c[0] * (1 - amount), c[1] * (1 - amount), c[2] * (1 - amount));
}

/* ---- M3 viz3d constants (SonaWave 3d-solar-system / 3d-cube-matrix designs,
   HAY Studio73, MIT — rewritten in AURA style, no TS/React carried over).
   Single source of truth for both the 3D builders below and the 2D
   loading fallback in 11p_viz3d.js (exposed on J at the bottom of this file).
   Planet template: orbit radius = sun radius + off, size and angular speed
   in SonaWave units; AURA scales them by unit = R_out / 31 so Saturn's
   orbit fits the frame. Orbit speed is slowed (×0.25) so an orbit reads
   on screen instead of whirling. */
const VIZ3D_SUN_R = 5.5;        // SonaWave solarSunSize default
const VIZ3D_ORBIT_SPEED = 0.25;
const VIZ3D_PLANETS = [
  { name: 'Mercury', off: 3.8, size: 0.75, speed: 2.2, color: '#94a3b8' },
  { name: 'Venus', off: 7.0, size: 1.05, speed: 1.7, color: '#facc15' },
  { name: 'Earth', off: 10.8, size: 1.2, speed: 1.25, color: '#38bdf8' },
  { name: 'Mars', off: 14.5, size: 0.9, speed: 0.95, color: '#f87171' },
  { name: 'Jupiter', off: 19.8, size: 2.3, speed: 0.65, color: '#fb923c' },
  { name: 'Saturn', off: 25.5, size: 1.8, speed: 0.45, color: '#fef08a' },
];
const VIZ3D_CUBE_N = 8;         // SonaWave cubeGridSize default
const VIZ3D_CUBE_W = 2.0;       // SonaWave cube width (units)
const VIZ3D_CUBE_GAP = 0.35;    // SonaWave cubeSpacing default

const T3D = {
  THREE: null, FontLoader: null, TextGeometry: null,
  ready: false, _loading: null, _warned: false, _lost: false,
  renderer: null, canvas: null, scene: null, camera: null,
  _blobUrls: [],
  _bake: null, _crop: null, _tex: null,
  _plane: null, _planeGeo: null, _planeGeoKey: '',
  _geoCache: new Map(), _geoOrder: [], _geoMax: 200,   // M2: per-word TextGeometry
  _fontCache: {},                                       // M2: loaded typeface fonts
  _fonts: null, _fontsLoading: null,                    // M2: parsed subset fonts { regular, bold }
  _blockGroup: null,                                    // M2: reused group holding the word meshes
  _matCache: new Map(), _matMax: 128,                   // M2: MeshStandardMaterial cache (by colour)
  _shadowCatcher: null,                                 // M2: ShadowMaterial plane (threeShadow only)
  _cw: 0, _ch: 0,
  _viz3d: null,                                          // M3: cached viz3d scene { key, sig, scene, ...refs }
  viz3d: { key: null, webgl: false },                   // M3: probe state (QA/debugging) — last viz3d frame's path

  _warn(msg) {
    if (!this._warned) { this._warned = true; console.warn('LyricWave 3D: ' + msg); }
    else console.warn('LyricWave 3D: ' + msg);
  },

  _blob(src) {
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    this._blobUrls.push(url);
    return url;
  },

  _rewriteAddon(src, coreUrl) {
    return String(src).replace(/from\s+['"]three['"]/g, "from '" + coreUrl + "'");
  },

  /* Load three core + addons. Returns true when the 3D host is usable. */
  async load() {
    if (this.ready) return true;
    if (this._loading) return this._loading;
    this._loading = (async () => {
      try {
        const src = (typeof window !== 'undefined' && window.__LyricWave_THREE__) || null;
        if (!src || !src.core) { this._warn('vendored Three.js source is missing (window.__LyricWave_THREE__) — 3D falls back to 2D'); return false; }
        const coreUrl = this._blob(src.core);
        const flUrl = this._blob(this._rewriteAddon(src.fontLoader, coreUrl));
        const tgUrl = this._blob(this._rewriteAddon(src.textGeometry, coreUrl));
        const THREE = await import(coreUrl);
        const { FontLoader } = await import(flUrl);
        const { TextGeometry } = await import(tgUrl);
        this.THREE = THREE; this.FontLoader = FontLoader; this.TextGeometry = TextGeometry;
        this._initGL();
        this.ready = true; this._lost = false;
        // M2: parse the 3D font subsets in the background so the block layer
        // is ready by the time the user picks it (a miss just falls back to
        // the plane for the first frames — never a fake).
        this._loadFonts();
        return true;
      } catch (e) {
        this._warn('Three.js load failed: ' + (e && e.message ? e.message : e) + ' — 3D falls back to 2D');
        this.ready = false;
        return false;
      } finally { this._loading = null; }
    })();
    return this._loading;
  },

  /* M2: parse the vendored 3D font subsets (Be Vietnam Pro Regular 400 + Bold 700,
     Vietnamese + Latin, built by tools/subset_3d_fonts.py) from the in-memory
     window.__LyricWave_FONTS3D__ payload — no fetch, works on a server AND file://.
     Returns { regular, bold } (three.js Font objects) or null when missing. */
  async _loadFonts() {
    if (this._fonts) return this._fonts;
    if (this._fontsLoading) return this._fontsLoading;
    this._fontsLoading = (async () => {
      try {
        const src = (typeof window !== 'undefined' && window.__LyricWave_FONTS3D__) || null;
        if (!src || !src.regular || !src.bold) { this._warn('3D font subsets are missing (window.__LyricWave_FONTS3D__) — block mode falls back to the plane'); return null; }
        const fl = new this.FontLoader();
        const regular = fl.parse(src.regular);
        const bold = fl.parse(src.bold);
        if (!regular || !regular.data || !regular.data.glyphs || !bold || !bold.data || !bold.data.glyphs) { this._warn('3D font subsets failed to parse — block mode falls back to the plane'); return null; }
        this._fonts = { regular, bold };
        return this._fonts;
      } catch (e) {
        this._warn('3D font parse failed: ' + (e && e.message ? e.message : e) + ' — block mode falls back to the plane');
        return null;
      } finally { this._fontsLoading = null; }
    })();
    return this._fontsLoading;
  },

  _font(key) { return (this._fonts && this._fonts[key]) || null; },

  /* Which subset font an item needs, or null when the block layer cannot serve
     it (other family / Black 900 / unknown face) — the caller falls back to the
     plane. Only Be Vietnam Pro 400/700 are subset (M2 v1); Japanese text is
     caught separately by _blockEligible (missing glyphs). */
  _blockFontFor(it) {
    let face = null;
    try { face = (typeof J !== 'undefined' && J.faceOf) ? J.faceOf(it.font) : null; } catch (e) { face = null; }
    if (!face || !face.family) return null;
    // faceOf quotes mapped families ('"Be Vietnam Pro"'); strip the quotes
    const fam = String(face.family).replace(/^["']|["']$/g, '');
    if (fam !== 'Be Vietnam Pro') return null;
    const w = face.weight || 400;
    if (w >= 600 && w < 800) return 'bold';
    if (w < 600) return 'regular';
    return null;   // 900 (Black) — not subset in v1
  },

  /* Block eligibility (checked after the bake, so it.pieceFns is known).
     Falls back to the plane — honestly, per frame — when any of these hold:
     the cut needs per-glyph 2D effects (pieceFn/shatter/clip/bands/vertical),
     the font is not subset, a character is missing from the subset font
     (Japanese, emoji, …), or the fonts have not loaded yet. */
  _blockEligible(env, it) {
    if (it.pieceFns && it.pieceFns.length) return false;
    if (it.clip || it.clipY || it.clipFn || it.bands || it.vbands || it.vertical) return false;
    const key = this._blockFontFor(it);
    if (!key) return false;
    const font = this._font(key);
    if (!font) return false;
    const text = String(it.text ?? '');
    for (const ch of text) {
      if (ch === '\n' || ch === ' ' || ch === '\u00a0' || ch === '　') continue;
      if (!font.data.glyphs[ch]) return false;
    }
    return true;
  },

  /* Split an item into words for the block layer, using the cut's wordTimes
     when they align with the item text (same match as J.karaokeAt), otherwise
     whitespace. Each word carries its laid-out glyphs (positions from
     J.layoutText, relative to the item anchor) and its sung time span. */
  words(env, it) {
    const lay = it._lay || (it._lay = J.layoutText(it));
    const raw = String(it.text ?? '');
    const cut = env.cut;
    let wt = null, src = null, off = 0;
    const squash = s => String(s).replace(/\s+/g, '');
    // locate a substring inside a source (squash-aware): returns the source
    // index of the match, or -1. Squash drops whitespace, so a squashed
    // position is mapped back to a source position by counting non-spaces.
    // A repeated word (e.g. "đàn" twice in one line) has several matches:
    // pick the one whose word-time is closest to the current time, so the
    // item gets the right sung fraction instead of the first occurrence's.
    const locate = (source, sub, wtList, tNow) => {
      const sqSrc = squash(source), sqSub = squash(sub);
      if (!sqSub) return -1;
      // all squashed match positions
      const positions = [];
      let from = 0;
      for (;;) {
        const at = sqSrc.indexOf(sqSub, from);
        if (at < 0) break;
        positions.push(at);
        from = at + 1;
      }
      if (!positions.length) return -1;
      const toSrc = at => {
        let si = 0, srcI = 0;
        while (si < at && srcI < source.length) { if (!/\s/.test(source[srcI])) si++; srcI++; }
        while (srcI < source.length && /\s/.test(source[srcI])) srcI++;
        return srcI;
      };
      if (positions.length === 1 || !wtList || !wtList.length || tNow == null) return toSrc(positions[0]);
      // several matches: score each by the time distance from tNow to the
      // word-times overlapping that occurrence (0 when tNow is inside one)
      let best = -1, bestScore = Infinity;
      for (const at of positions) {
        const off = toSrc(at);
        const end = off + sub.replace(/\n/g, '').length;
        let score = Infinity;
        for (const w of wtList) {
          if (w.c1 <= off || w.c0 >= end) continue;   // does not overlap this occurrence
          const d = (tNow >= w.start && tNow < w.end) ? 0 : Math.min(Math.abs(tNow - w.start), Math.abs(tNow - w.end));
          if (d < score) score = d;
        }
        if (score < bestScore) { bestScore = score; best = off; }
      }
      return best >= 0 ? best : toSrc(positions[0]);
    };
    if (cut && cut.wordTimes && cut.wordTimes.length) {
      const flat = raw.replace(/\n/g, '');
      const tNow = env.t != null ? env.t : (cut.start + (env.lt || 0));
      if (flat === cut.text || (raw.includes('\n') && squash(flat) === squash(cut.text))) { wt = cut.wordTimes; src = cut.text; off = 0; }
      else if (cut.lineText && (flat === cut.lineText || (raw.includes('\n') && squash(flat) === squash(cut.lineText)))) { wt = cut.lineWordTimes; src = cut.lineText; off = 0; }
      else {
        // substring item (per-word / per-character layout): locate it in the
        // cut text, then in the line text. The wordTimes offsets are absolute
        // in the source, so the item's glyphs shift by `off`. (Before this fix
        // only full-text items got word times, so per-word / per-char items
        // had no karaoke span and always rendered fully lit.)
        const o1 = locate(cut.text, flat, cut.wordTimes, tNow);
        if (o1 >= 0) { wt = cut.wordTimes; src = cut.text; off = o1; }
        else if (cut.lineText) {
          const o2 = locate(cut.lineText, flat, cut.lineWordTimes, tNow);
          if (o2 >= 0) { wt = cut.lineWordTimes; src = cut.lineText; off = o2; }
        }
      }
    }
    // map laid-out glyph index -> source-text index (karaokeAt's idxMap),
    // shifted by the item's offset inside the source (0 for full-text items)
    let idxMap = null;
    if (raw.includes('\n') && src) {
      idxMap = [];
      let j = off;
      for (const ch of raw) {
        if (ch === '\n') { if (src[j] === ' ' || src[j] === '　') j++; continue; }
        while ((src[j] === ' ' || src[j] === '　') && ch !== ' ' && ch !== '　') j++;
        idxMap.push(j); j++;
      }
    }
    const oi = i => (idxMap && idxMap[i] != null ? idxMap[i] : i + off);
    const glyphs = lay.filter(g => g.ch && g.ch !== ' ' && g.ch !== '\u00a0' && g.ch !== '　');
    const words = [];
    if (wt && wt.length) {
      for (const w of wt) {
        const gs = glyphs.filter(g => { const s = oi(g.i); return s >= w.c0 && s < w.c1; });
        if (gs.length) words.push(this._wordFromGlyphs(gs, w));
      }
    }
    if (!words.length) {
      // fallback: split the laid-out glyphs on whitespace/newline boundaries
      // (glyphs are in reading order; a gap in the index means a space was skipped)
      let cur = [];
      const flush = () => { if (cur.length) { words.push(this._wordFromGlyphs(cur, null)); cur = []; } };
      let prevI = -1;
      for (const g of glyphs) {
        if (prevI >= 0 && g.i > prevI + 1) flush();
        cur.push(g); prevI = g.i;
      }
      flush();
    }
    return words;
  },

  _wordFromGlyphs(gs, w) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, text = '';
    for (const g of gs) {
      x0 = Math.min(x0, g.x - g.w / 2); x1 = Math.max(x1, g.x + g.w / 2);
      y0 = Math.min(y0, g.y - g.h / 2); y1 = Math.max(y1, g.y + g.h / 2);
      text += g.ch;
    }
    return { text, glyphs: gs, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0,
             fs: gs[0] ? (gs[0].fs || 1) : 1, start: w ? w.start : null, end: w ? w.end : null };
  },

  /* MeshStandardMaterial cache (by colour + metalness). Materials are shared
     across word meshes and frames; the cache is capped and cleared when full
     (the materials themselves are cheap — the GPU program is shared). */
  _matFor(hex, metal) {
    const key = hex + '|' + metal;
    let m = this._matCache.get(key);
    if (!m) {
      m = new this.THREE.MeshStandardMaterial({ color: hex, metalness: metal, roughness: 0.45 });
      if (this._matCache.size >= this._matMax) this._matCache.clear();
      this._matCache.set(key, m);
    }
    return m;
  },

  _initGL() {
    const THREE = this.THREE;
    // Drop cached objects tied to a previous renderer (context restore):
    // the old GPU resources are gone with the lost context.
    this._plane = null; this._planeGeo = null; this._planeGeoKey = ''; this._tex = null;
    this._viz3d = null; this.viz3d = { key: null, webgl: false };   // M3: viz scenes are rebuilt on demand
    // The renderer OWNS its canvas (renderer.domElement) — do not create a
    // separate one: drawImage must read the canvas the renderer drew into.
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' });
    renderer.setClearColor(0x000000, 0);
    this.canvas = renderer.domElement; this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 10000);
    // M2 lights (unused by the unlit plane material, kept for the block layer)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 4); this.scene.add(dl);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ready = false; this._lost = true;
      this._warn('WebGL context lost — 3D falls back to 2D until the context is restored');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      try { this._initGL(); this.ready = true; this._lost = false; } catch (e) { this.ready = false; }
    });
  },

  _ensureSize(cw, ch) {
    if (!this.renderer) return false;
    if (this._cw !== cw || this._ch !== ch) {
      this._cw = cw; this._ch = ch;
      this.renderer.setSize(cw, ch, false);
    }
    return true;
  },

  /* Bake the 2D mainDraw output into a texture canvas cropped to the text bbox.
     Runs the existing 2D pipeline (fonts, karaoke, enter/hold/exit) unchanged —
     the only difference is env.ctx points at the bake canvas. Returns
     { crop, bb, scale } or null when nothing was drawn. */
  bake(env, it) {
    const W = env.W, H = env.H, scale = env.scale || 1;
    const bw = Math.max(2, Math.ceil(W * scale)), bh = Math.max(2, Math.ceil(H * scale));
    if (!this._bake || this._bake.width !== bw || this._bake.height !== bh) {
      this._bake = document.createElement('canvas'); this._bake.width = bw; this._bake.height = bh;
    }
    const bctx = this._bake.getContext('2d');
    bctx.setTransform(scale, 0, 0, scale, 0, 0);
    bctx.globalAlpha = 1; bctx.globalCompositeOperation = 'source-over'; bctx.filter = 'none';
    bctx.clearRect(0, 0, W, H);
    const bakeEnv = Object.assign({}, env, { ctx: bctx, _t3dBaking: true });
    const bb = J.mainDraw2D(bakeEnv, it);
    if (!bb) return null;
    const x0 = Math.max(0, Math.floor(bb.x0 * scale)), y0 = Math.max(0, Math.floor(bb.y0 * scale));
    const x1 = Math.min(bw, Math.ceil(bb.x1 * scale)), y1 = Math.min(bh, Math.ceil(bb.y1 * scale));
    const cw = Math.max(2, x1 - x0), ch = Math.max(2, y1 - y0);
    if (!this._crop || this._crop.width !== cw || this._crop.height !== ch) {
      this._crop = document.createElement('canvas'); this._crop.width = cw; this._crop.height = ch;
    }
    const cctx = this._crop.getContext('2d');
    cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.globalAlpha = 1; cctx.globalCompositeOperation = 'source-over'; cctx.filter = 'none';
    cctx.clearRect(0, 0, cw, ch);
    cctx.drawImage(this._bake, x0, y0, cw, ch, 0, 0, cw, ch);
    return { crop: this._crop, bb, scale };
  },

  /* 3D transform for the plane, from the descriptors the effects wrote during
     the bake (it._t3d) and the camera (env._t3dCam). Angles in radians. */
  _transform(env, it) {
    const fx = env.fx || {};
    const depth = fx.threeDepth != null ? +fx.threeDepth : 0.7;
    const t3 = it._t3d || {};
    const cam = env._t3dCam || {};
    return {
      rotX: t3.rotX || 0,
      rotY: t3.rotY || 0,
      rotZ: t3.rotZ || 0,
      dolly: (cam.dolly || 0) * depth,   // 0..1 — plane moves toward the camera
      orbit: cam.orbit || 0,              // radians — camera circles the text centre
      depth,
    };
  },

  /* Render the baked texture on a plane in 3D space, then composite the whole
     WebGL canvas onto the frame ctx. World units are plan units (visible
     height H at z=0); the canvas is cw x ch device px so the drawImage is 1:1
     and stays crisp at export scale. */
  _renderPlane(env, baked, tr) {
    const THREE = this.THREE;
    const ctx = env.ctx;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const W = env.W, H = env.H;
    if (!this._ensureSize(cw, ch)) return false;
    const { crop, bb } = baked;
    const bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
    if (bw <= 0 || bh <= 0) return false;
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    // P2.1 F2: the crop canvas changes size with the text bbox, but the singleton
    // CanvasTexture kept its first GPU allocation — three.js then uploads via
    // texSubImage2D into the old (smaller) allocation and the upload fails
    // (GL_INVALID_VALUE, texture stays empty: the plane renders nothing and all
    // visible "plane" text was the 2D ghost passes). Recreate the texture
    // whenever the crop size changes (validated in-page: dispose recovers the
    // plane, area 29 → 882, 0 GL errors). Same size → keep the texture and
    // re-upload into it, as before.
    if (!this._tex || this._tex.image !== crop || this._tex.image.width !== crop.width || this._tex.image.height !== crop.height) {
      if (this._tex) this._tex.dispose();
      this._tex = new THREE.CanvasTexture(crop);
      this._tex.colorSpace = THREE.SRGBColorSpace;
    } else { this._tex.image = crop; this._tex.needsUpdate = true; }
    // No mipmaps: this texture is a dynamic NPOT canvas re-uploaded every
    // frame at ~1:1 scale, so mipmaps buy nothing — and on SwiftShader the
    // mipmap chain goes stale across re-uploads, sampling the plane as tiny
    // scrambled fragments instead of the baked text (QA-021). Linear
    // filtering is correct on every GPU for a 1:1-mapped texture.
    this._tex.generateMipmaps = false;
    this._tex.minFilter = THREE.LinearFilter;
    this._tex.magFilter = THREE.LinearFilter;
    const geoKey = bw.toFixed(1) + 'x' + bh.toFixed(1);
    if (!this._plane || this._planeGeoKey !== geoKey) {
      if (this._planeGeo) this._planeGeo.dispose();
      this._planeGeo = new THREE.PlaneGeometry(bw, bh);
      this._planeGeoKey = geoKey;
      if (!this._plane) {
        // DoubleSide: during a flip the back of the plane shows the text
        // mirrored, like the back of a real card — never a disappearing frame
        const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
        this._plane = new THREE.Mesh(this._planeGeo, mat);
        this.scene.add(this._plane);
      } else this._plane.geometry = this._planeGeo;
    }
    this._plane.material.map = this._tex;
    this._plane.material.needsUpdate = true;
    this._setupCamera(env, tr, W, H, cx, cy);
    this._plane.position.set(cx, H - cy, tr.dolly * camZOf(H) * 0.35);
    this._plane.rotation.set(tr.rotX || 0, tr.rotY || 0, tr.rotZ || 0);
    this._plane.visible = true;
    if (this._blockGroup) this._blockGroup.visible = false;   // M2: hide the block words in plane mode
    if (this._shadowCatcher) this._shadowCatcher.visible = false;
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.canvas, 0, 0, W, H);
    return true;
  },

  /* Camera for the 3D layers, shared by the plane and the block. World units
     are plan units (visible height H at z=0); the camera sits at (W/2, H/2,
     camZ) looking at the frame centre, or orbits it when the orbit effect is
     active. camZ is a pure function of H and the 40° fov. */
  _setupCamera(env, tr, W, H, cx, cy) {
    const THREE = this.THREE;
    const fov = 40;
    const camZ = camZOf(H);
    const cam = this.camera;
    cam.fov = fov; cam.aspect = this._cw / this._ch; cam.near = 1; cam.far = camZ * 4 + 1000;
    if (tr.orbit) {
      const R = camZ;
      cam.position.set(
        cx + Math.sin(tr.orbit) * R * 0.6,
        (H - cy) + Math.sin(tr.orbit * 0.7) * R * 0.15,
        Math.cos(tr.orbit) * R * 0.6 + camZ * 0.4);
      cam.lookAt(cx, H - cy, 0);
    } else {
      cam.position.set(W / 2, H / 2, camZ);
      cam.lookAt(W / 2, H / 2, 0);
    }
    cam.updateProjectionMatrix();
    return camZ;
  },

  /* M2 — real extrusion: one TextGeometry mesh per word, MeshStandardMaterial
     [cap, side] with the scene lights, per-word karaoke (lit/dim by the sung
     fraction), per-word flip stagger, and the shared dolly/orbit camera.
     The plane is hidden while the block renders. Returns false when the block
     could not be built (caller falls back to the plane). */
  _renderBlock(env, it, baked, tr) {
    const THREE = this.THREE;
    const ctx = env.ctx;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const W = env.W, H = env.H;
    if (!this._ensureSize(cw, ch)) return false;
    const fontKey = this._blockFontFor(it);
    const font = this._font(fontKey);
    if (!font) return false;
    const words = this.words(env, it);
    if (!words.length) return false;
    const fx = env.fx || {};
    const depth = fx.threeDepth != null ? +fx.threeDepth : 0.7;
    const metal = fx.threeMetal != null ? +fx.threeMetal : 0.15;
    const size = it.size || 100;
    const sx = it.sx || 1, sy = it.sy || 1;
    // extrusion depth: ~22% of the font size at the default depth 0.7,
    // 5% at depth 0, 30% at depth 1 (experiment: 20% at size 100).
    const exDepth = Math.max(1, size * (0.05 + 0.25 * depth));
    const bevelT = size * 0.04, bevelS = size * 0.03;
    // karaoke state (per-glyph lit fraction) and colours
    const kara = (typeof J !== 'undefined' && J.karaokeAt) ? J.karaokeAt(env, it) : null;
    const sc = env.sc || {};
    const baseCol = it.color || sc.fg || '#ffffff';
    // lit colour: karaokeAt's accent when available, else the scheme accent
    // (substring items have no karaokeAt match, so without this the lit
    // colour would equal the base and the sweep would be invisible)
    const litCol = (kara && kara.litColor) || sc.accent || baseCol;
    const dimA = (kara && kara.dimAlpha != null) ? kara.dimAlpha : 0.35;
    // Accumulate: a layout may draw SEVERAL items per frame (per-character,
    // emphasis + rest). Each item gets its own sub-group positioned at the
    // item anchor, so all of them stay visible. The parent group is cleared
    // once per frame in drawMain (env is a fresh object per R.frame call).
    // (Before this fix the parent group was cleared here, so only the LAST
    // item of a frame survived — B4/B5 in QA-022 showed 0-1 words.)
    if (!this._blockGroup) { this._blockGroup = new THREE.Group(); this.scene.add(this._blockGroup); }
    const grp = new THREE.Group();
    // P2.1 F3: dolly was a no-op in block mode — tr.dolly was only read by
    // _renderPlane. Mirror the plane's z-shift so the dolly effect and dolly
    // keyframes move the block toward the camera the same way.
    grp.position.set(it.x, H - it.y, tr.dolly * camZOf(H) * 0.35);
    grp.rotation.set(0, 0, -((it.rot || 0) * THREE.MathUtils.DEG2RAD));
    this._blockGroup.add(grp);
    this._blockGroup.visible = true;
    if (this._plane) this._plane.visible = false;
    const camZ = this._setupCamera(env, tr, W, H, W / 2, H / 2);
    // shadow catcher (only when the user enabled shadows)
    this._setupShadow(env, it, exDepth, camZ);
    const flipP = (it._t3d && it._t3d.flipP != null) ? it._t3d.flipP : null;
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi];
      const fs = w.fs || 1;
      // geometry: cached by word + font + size + depth + bevel (per-word build
      // is ~85ms the first time, then a cache hit — the plan's R4 mitigation)
      const geoKey = w.text + '|' + fontKey + '|' + size.toFixed(1) + '|' + exDepth.toFixed(1) + '|' + bevelT.toFixed(1);
      let geo = this._geoGet(geoKey);
      if (!geo) {
        try {
          geo = new this.TextGeometry(w.text, {
            font, size, depth: exDepth, curveSegments: 8,
            bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelSegments: 2,
          });
          geo.computeBoundingBox();
          // centre the geometry on its own bbox so the mesh origin is the
          // word centre (the 2D layout centres every glyph on its position)
          const bb = geo.boundingBox;
          geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
          this._geoPut(geoKey, geo);
        } catch (e) { this._warn('TextGeometry failed for "' + w.text + '": ' + (e && e.message ? e.message : e)); return false; }
      }
      // karaoke: lit fraction for this word (0 = unsung, 1 = fully sung).
      // Prefer the word's own time span — words() resolves wordTimes for
      // substring items too, so per-word / per-char layouts sweep correctly.
      // Fall back to kara.litFrac (full-text items) when no span is known.
      const tNow = env.t != null ? env.t : (env.cut ? env.cut.start + (env.lt || 0) : 0);
      let frac = 1;
      if (w.start != null && w.end != null) {
        if (tNow < w.start) frac = 0;
        else if (tNow >= w.end) frac = 1;
        else frac = (tNow - w.start) / Math.max(0.01, w.end - w.start);
      } else if (kara && w.glyphs.length) frac = kara.litFrac(w.glyphs[0].i);
      else if (kara && !kara.anyLit) frac = 0;
      const capHex = mixHex(baseCol, litCol, frac, dimA);
      const sideHex = shadeHex(capHex, 0.55);
      const mesh = new THREE.Mesh(geo, [this._matFor(capHex, metal), this._matFor(sideHex, metal)]);
      mesh.userData.word = w.text; mesh.userData.frac = frac;   // QA/debugging: the sung fraction per word
      mesh.position.set(w.x * sx, -(w.y * sy), 0);
      mesh.scale.set(sx * fs, sy * fs, 1);
      // rotation: the item-level spin applies to every word; the flip staggers
      // per word (each word flips a little later, left to right)
      let rotY = (it._t3d && it._t3d.rotY) || 0;
      let rotX = (it._t3d && it._t3d.rotX) || 0;
      if (flipP != null) {
        const stagger = wi * 0.08;
        rotY = (1 - E_outBack(clamp01(flipP - stagger), 1.25)) * Math.PI;
      }
      mesh.rotation.set(rotX, rotY, (it._t3d && it._t3d.rotZ) || 0);
      mesh.castShadow = !!(fx.threeShadow);
      grp.add(mesh);
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.canvas, 0, 0, W, H);
    return true;
  },

  /* Shadow catcher for the block layer (only when fx.threeShadow). A large
     ShadowMaterial plane behind the text receives the words' shadows from the
     directional light; the light's shadow camera is fitted to the frame. */
  _setupShadow(env, it, exDepth, camZ) {
    const fx = env.fx || {};
    if (!fx.threeShadow) {
      if (this._shadowCatcher) this._shadowCatcher.visible = false;
      const dl = this.scene && this.scene.children.find(o => o && o.isDirectionalLight);
      if (dl) dl.castShadow = false;
      return;
    }
    const THREE = this.THREE;
    const W = env.W, H = env.H;
    if (!this._shadowCatcher) {
      this._shadowCatcher = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 2, H * 2),
        new THREE.ShadowMaterial({ opacity: 0.35 }));
      this._shadowCatcher.receiveShadow = true;
      this.scene.add(this._shadowCatcher);
    }
    const dl = this.scene.children.find(o => o && o.isDirectionalLight);
    if (dl) {
      dl.castShadow = true;
      dl.shadow.mapSize.set(1024, 1024);
      dl.shadow.camera.left = -W / 2; dl.shadow.camera.right = W / 2;
      dl.shadow.camera.top = H / 2; dl.shadow.camera.bottom = -H / 2;
      dl.shadow.camera.near = 1; dl.shadow.camera.far = camZ * 4 + 1000;
      dl.shadow.bias = -0.001;
      dl.shadow.camera.updateProjectionMatrix();
    }
    this._shadowCatcher.position.set(W / 2, H / 2, -exDepth * 2 - 10);
    this._shadowCatcher.visible = true;
  },

  /* Seam entry called from J.mainDraw. Returns the bbox when 3D handled the
     item, null when nothing was drawn, undefined when the caller should fall
     back to the 2D path. */
  drawMain(env, it) {
    if (!this.ready) return undefined;
    // New frame (env is a fresh object per R.frame call): drop the previous
    // frame's block sub-groups so words don't accumulate across frames.
    // Items within one frame accumulate (see _renderBlock).
    if (this._frameEnv !== env) {
      this._frameEnv = env;
      if (this._blockGroup) { while (this._blockGroup.children.length) this._blockGroup.children[0].removeFromParent(); }
    }
    const baked = this.bake(env, it);
    if (!baked) return null;
    const tr = this._transform(env, it);
    // M2 block layer: real per-word extrusion when the user picked block mode
    // and this item is eligible (subset font, all glyphs present, no per-glyph
    // 2D effects). Any failure falls back to the plane — never a fake.
    if ((env.fx || {}).threeMode === 'block' && this._blockEligible(env, it)) {
      if (this._renderBlock(env, it, baked, tr)) return baked.bb;
    }
    if (!this._renderPlane(env, baked, tr)) return undefined;
    return baked.bb;
  },

  /* Per-word geometry cache (M2). LRU, capped — geometries are disposed on evict. */
  _geoGet(key) { return this._geoCache.get(key) || null; },
  _geoPut(key, geo) {
    if (this._geoCache.has(key)) return;
    this._geoCache.set(key, geo); this._geoOrder.push(key);
    while (this._geoOrder.length > this._geoMax) {
      const old = this._geoOrder.shift();
      const g = this._geoCache.get(old);
      if (g) { try { g.dispose(); } catch (e) {} }
      this._geoCache.delete(old);
    }
  },

  /* ---- M3 viz3d: two full-screen 3D background scenes rendered through
     this SAME singleton renderer + canvas — never a second WebGL context.
     A viz3d scene is its own THREE.Scene; drawViz3d renders it and
     composites with drawImage, the _renderPlane pattern. Every motion is
     a pure function of (t, freq(t), beat(t)): planet angles a0 + speed*t,
     cube heights straight from the 64-bin spectrum (already time-smoothed
     by J.vizData) — no dt accumulation, no Math.random, so Preview ==
     offline export frame by frame. Deterministic pseudo-noise (nhash) is
     used only for static flare/belt positions, fixed at build time. */
  _viz3dNh(i, t) { const s = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453; return s - Math.floor(s); },

  /* scheme colours that stand apart from the background (same rule as the
     M2 viz hues() in 11p_viz.js, local here so the 3D host stays standalone) */
  _viz3dHues(sc) {
    const out = [];
    for (const c of [sc.accent, sc.accent2, sc.ghostA, sc.ghostB, sc.fg]) {
      if (!c || J.contrast(c, sc.bg) < 1.25) continue;
      const k = String(c).toLowerCase();
      if (!out.some(o => String(o).toLowerCase() === k)) out.push(c);
    }
    return out.length ? out : [sc.fg || '#ffffff'];
  },

  _viz3dBuildSolar(THREE, W, H) {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5);
    dl.position.set(W / 2 + 200, H / 2 + 300, 400);
    scene.add(dl);
    const cx = W / 2, cy = H / 2;                 // three coords: y up, origin bottom-left
    const R_out = Math.min(W, H) * 0.42;
    const unit = R_out / (VIZ3D_SUN_R + 25.5);    // Saturn's orbit == R_out
    const sunR = VIZ3D_SUN_R * unit;
    const group = new THREE.Group();
    group.position.set(cx, cy, 0);
    group.rotation.x = -0.38;                     // ~22 deg tilt (SonaWave defaultTilt)
    scene.add(group);
    // sun (SonaWave: MeshStandardMaterial, emissive 1.2)
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(sunR, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2 }));
    group.add(sun);
    // corona: wireframe icosahedron (SonaWave)
    const corona = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sunR * 1.35, 2),
      new THREE.MeshBasicMaterial({ color: 0xec4899, wireframe: true, transparent: true, opacity: 0.45 }));
    group.add(corona);
    // solar flares: 180 deterministic points on a shell (SonaWave used Math.random here — AURA uses nhash so the build is reproducible)
    const flareCount = 180, fp = new Float32Array(flareCount * 3), fc = new Float32Array(flareCount * 3);
    const cA = new THREE.Color('#f59e0b'), cB = new THREE.Color('#ec4899');
    for (let i = 0; i < flareCount; i++) {
      const i3 = i * 3;
      const theta = this._viz3dNh(i, 1.7) * Math.PI * 2;
      const phi = Math.acos(this._viz3dNh(i, 2.3) * 2 - 1);
      const r = sunR * (1.1 + this._viz3dNh(i, 3.1) * 0.5);
      fp[i3] = r * Math.sin(phi) * Math.cos(theta);
      fp[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      fp[i3 + 2] = r * Math.cos(phi);
      const c = cA.clone().lerp(cB, this._viz3dNh(i, 4.7) * 0.6);
      fc[i3] = c.r; fc[i3 + 1] = c.g; fc[i3 + 2] = c.b;
    }
    const flareGeo = new THREE.BufferGeometry();
    flareGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    flareGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    const flares = new THREE.Points(flareGeo, new THREE.PointsMaterial({ size: sunR * 0.28, vertexColors: true, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(flares);
    // planets + orbit lines + Saturn ring + Earth moon
    const planets = [];
    for (let i = 0; i < VIZ3D_PLANETS.length; i++) {
      const tp = VIZ3D_PLANETS[i];
      const R = (VIZ3D_SUN_R + tp.off) * unit;
      const size = tp.size * unit;
      const col = new THREE.Color(tp.color);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 20, 20),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 }));
      group.add(mesh);
      const pts = [];
      for (let j = 0; j <= 64; j++) { const a = (j / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.32 }));
      group.add(line);
      let ring = null;
      if (tp.name === 'Saturn') {
        const rg = new THREE.RingGeometry(size * 1.35, size * 2.3, 32);
        rg.rotateX(-Math.PI / 2.8);
        ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.75, roughness: 0.4 }));
        mesh.add(ring);
      }
      let moon = null;
      if (tp.name === 'Earth') {
        moon = new THREE.Mesh(new THREE.SphereGeometry(0.35 * unit, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
        mesh.add(moon);
      }
      planets.push({ mesh, ring, moon, R, size, speed: tp.speed, a0: (i / VIZ3D_PLANETS.length) * Math.PI * 2 });
    }
    // asteroid belt: 400 deterministic points just outside Saturn's orbit
    const beltN = 400, bp = new Float32Array(beltN * 3);
    const beltR0 = (VIZ3D_SUN_R + 25.5) * unit * 1.12, beltR1 = beltR0 * 1.18;
    for (let i = 0; i < beltN; i++) {
      const a = this._viz3dNh(i, 5.3) * Math.PI * 2;
      const r = beltR0 + this._viz3dNh(i, 6.1) * (beltR1 - beltR0);
      bp[i * 3] = Math.cos(a) * r;
      bp[i * 3 + 1] = (this._viz3dNh(i, 7.7) - 0.5) * unit * 1.2;
      bp[i * 3 + 2] = Math.sin(a) * r;
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const belt = new THREE.Points(beltGeo, new THREE.PointsMaterial({ color: 0xcbd5e1, size: unit * 0.5, transparent: true, opacity: 0.8 }));
    group.add(belt);
    return { scene, group, sun, corona, flares, planets, belt, sunR, unit };
  },

  _viz3dUpdateSolar(v, env, freq, pulse) {
    const t = env.t;
    const bass = freq ? (freq[2] + freq[3]) / 2 : 0.3;
    const mid = freq ? freq[Math.floor(freq.length * 0.3)] : 0.3;
    const sunBounce = 1 + (bass * 0.35 + pulse * 0.25) * 1.5;
    v.sun.scale.set(sunBounce, sunBounce, sunBounce);
    v.sun.rotation.y = t * 0.3;
    const coronaBounce = 1 + pulse * 0.45 * 1.5;
    v.corona.scale.set(coronaBounce, coronaBounce, coronaBounce);
    v.corona.rotation.y = -t * 0.5;
    v.corona.rotation.x = t * 0.2;
    const burst = 1 + pulse * 0.55 * 1.5;
    v.flares.scale.set(burst, burst, burst);
    v.flares.rotation.y = t * 0.25;
    v.group.rotation.y = t * 0.05;
    for (const p of v.planets) {
      const a = p.a0 + p.speed * VIZ3D_ORBIT_SPEED * t;
      p.mesh.position.set(Math.cos(a) * p.R, 0, Math.sin(a) * p.R);
      p.mesh.rotation.y = t * 2.5;
      p.mesh.material.emissiveIntensity = 0.35 + pulse * 0.3;
      if (p.moon) { p.moon.position.x = Math.cos(a * 4.5) * 2.2 * v.unit; p.moon.position.z = Math.sin(a * 4.5) * 2.2 * v.unit; }
      if (p.ring) p.ring.rotation.z = t * 0.4;
    }
    v.belt.rotation.y = t * 0.02;
    v.belt.scale.y = 1 + mid * 0.6;
  },

  _viz3dBuildCubes(THREE, W, H, cols) {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5);
    dl.position.set(W / 2 + 200, H / 2 + 300, 400);
    scene.add(dl);
    const u = H / 27.6;                          // SonaWave visible height ~27.6 units at its camera
    const pitch = (VIZ3D_CUBE_W + VIZ3D_CUBE_GAP) * u;
    const cubeW = VIZ3D_CUBE_W * u;
    const group = new THREE.Group();
    group.position.set(W / 2, H * 0.28, 0);      // base line at plan y 0.72H (three y is up)
    group.rotation.x = -0.35;                    // tip the tops toward the camera
    scene.add(group);
    const geo = new THREE.BoxGeometry(cubeW, 1, cubeW);   // unit height, scaled per frame
    const cubes = [];
    const maxDist = Math.sqrt(2) * (VIZ3D_CUBE_N - 1) / 2;
    for (let ix = 0; ix < VIZ3D_CUBE_N; ix++) for (let iz = 0; iz < VIZ3D_CUBE_N; iz++) {
      const dx = ix - (VIZ3D_CUBE_N - 1) / 2, dz = iz - (VIZ3D_CUBE_N - 1) / 2;
      const dist = Math.sqrt(dx * dx + dz * dz) / maxDist;   // 0 centre .. 1 corner
      const mat = new THREE.MeshStandardMaterial({ color: cols[0], emissive: cols[0], emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(dx * pitch, 0.5, dz * pitch);
      mesh.scale.y = 1;
      group.add(mesh);
      cubes.push({ mesh, mat, dist });
    }
    return { scene, group, cubes, maxH: H * 0.42, minH: Math.max(2, u * 0.4) };
  },

  _viz3dUpdateCubes(v, env, freq, pulse, cols) {
    const n = freq ? freq.length : 64;
    for (let i = 0; i < v.cubes.length; i++) {
      const c = v.cubes[i];
      // SonaWave's bin pick: floor(dist * dataLength * 0.65)
      const bi = Math.min(n - 1, Math.floor(c.dist * n * 0.65));
      const f = freq ? freq[bi] : 0.3;
      const h = Math.max(v.minH, f * v.maxH * (1 + 0.25 * pulse));
      c.mesh.scale.y = h;
      c.mesh.position.y = h / 2;
      const col = cols[Math.min(cols.length - 1, Math.floor((h / v.maxH) * cols.length))];
      c.mat.color.set(col);
      c.mat.emissive.set(col);
      c.mat.emissiveIntensity = 0.25 + (h / v.maxH) * 0.8;
    }
  },

  _viz3dDispose() {
    const v = this._viz3d;
    if (!v) return;
    try {
      if (v.scene) {
        v.scene.traverse(o => {
          if (o.geometry) { try { o.geometry.dispose(); } catch (e) {} }
          if (o.material) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of ms) { try { m.dispose(); } catch (e) {} }
          }
        });
      }
    } catch (e) {}
    this._viz3d = null;
  },

  /* M3 seam: render one viz3d scene into the shared WebGL canvas and
     composite it onto the frame ctx. Returns false when 3D is not usable
     (not loaded yet / context lost) — the caller draws the 2D fallback. */
  drawViz3d(env, key, freq) {
    if (!this.ready || !this.renderer) return false;
    const THREE = this.THREE;
    const ctx = env.ctx;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const W = env.W, H = env.H;
    if (!this._ensureSize(cw, ch)) return false;
    const sig = key + '|' + W + 'x' + H;
    let v = this._viz3d;
    if (!v || v.sig !== sig) {
      this._viz3dDispose();
      const sc = env.sc || {};
      const cols = this._viz3dHues(sc);
      const built = key === 'viz3dCubes'
        ? this._viz3dBuildCubes(THREE, W, H, cols)
        : this._viz3dBuildSolar(THREE, W, H);
      v = this._viz3d = Object.assign({ key, sig, cols }, built);
    }
    const pulse = (env.beat && env.beat.since < 0.25 ? Math.exp(-env.beat.since * 8) : 0);
    try {
      if (key === 'viz3dCubes') this._viz3dUpdateCubes(v, env, freq, pulse, v.cols);
      else this._viz3dUpdateSolar(v, env, freq, pulse);
      this._setupCamera(env, {}, W, H, W / 2, H / 2);
      this.renderer.render(v.scene, this.camera);
      ctx.drawImage(this.canvas, 0, 0, W, H);
    } catch (e) {
      this._warn('viz3d render failed: ' + (e && e.message ? e.message : e));
      return false;
    }
    this.viz3d = { key, webgl: true };
    return true;
  },

  /* Free all WebGL resources. Called on context loss recovery failure and when
     the user turns 3D off for a long session (UI may call it on toggle-off). */
  dispose() {
    this._viz3dDispose(); this.viz3d = { key: null, webgl: false };   // M3
    try { if (this._tex) { this._tex.dispose(); this._tex = null; } } catch (e) {}
    try { if (this._planeGeo) { this._planeGeo.dispose(); this._planeGeo = null; } } catch (e) {}
    try { if (this._plane) { this.scene.remove(this._plane); this._plane = null; } } catch (e) {}
    try { if (this._blockGroup) { this.scene.remove(this._blockGroup); this._blockGroup = null; } } catch (e) {}
    try { if (this._shadowCatcher) { this.scene.remove(this._shadowCatcher); this._shadowCatcher = null; } } catch (e) {}
    for (const m of this._matCache.values()) { try { m.dispose(); } catch (e) {} }
    this._matCache.clear();
    for (const g of this._geoCache.values()) { try { g.dispose(); } catch (e) {} }
    this._geoCache.clear(); this._geoOrder = [];
    this._fonts = null; this._fontsLoading = null;
    try { if (this.renderer) { this.renderer.dispose(); this.renderer = null; } } catch (e) {}
    this.canvas = null; this.scene = null; this.camera = null;
    for (const u of this._blobUrls) { try { URL.revokeObjectURL(u); } catch (e) {} }
    this._blobUrls = [];
    this._cw = 0; this._ch = 0;
    this.ready = false;
  },
};
J.text3d = T3D;
/* M3 viz3d: single source of truth for the scene constants, shared with the
   2D loading fallback in 11p_viz3d.js and the node tests. Pure functions of
   (index, t) / (dist, bins) — the same math the 3D builders use. */
J.viz3dSolarPlanets = VIZ3D_PLANETS;
J.viz3dCubeSpec = { n: VIZ3D_CUBE_N, w: VIZ3D_CUBE_W, gap: VIZ3D_CUBE_GAP };
J.viz3dPlanetAngle = (i, t) => (i / VIZ3D_PLANETS.length) * Math.PI * 2 + VIZ3D_PLANETS[i].speed * VIZ3D_ORBIT_SPEED * t;
J.viz3dCubeBin = (dist, n) => Math.min(n - 1, Math.floor(dist * n * 0.65));
})();
