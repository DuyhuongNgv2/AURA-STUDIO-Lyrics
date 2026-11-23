// M6 v0.31.0 — Lottie stickers: 8 definitions + embedded data + normalize
// + frame math. Node-testable only (no DOM): the Preview==Export pixel
// proof is browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- 8 sticker definitions, ids + names exactly as the Gate 0 table ---
{
  eq(J.LOTTIE_STICKERS.map(s => s.id), ['stVinyl', 'stEqualizer', 'stHeart', 'stNotes', 'stLightning', 'stSpeaker', 'stSparkle', 'stFlame'], 'sticker ids in Gate 0 order');
  for (const s of J.LOTTIE_STICKERS) {
    assert.ok(s.name && s.vi && s.en, `${s.id} has ja/vi/en names`);
    assert.equal(J.lottieSticker(s.id).id, s.id, `${s.id} resolves`);
  }
  assert.equal(J.lottieSticker('nope'), null, 'unknown sticker is null');
}

// --- embedded data: valid Bodymovin 5.5.7, 300x300, shapes only ---
{
  eq(Object.keys(J.LOTTIE_DATA).sort(), J.LOTTIE_STICKERS.map(s => s.id).sort(), 'data has exactly the 8 stickers');
  for (const s of J.LOTTIE_STICKERS) {
    const d = J.LOTTIE_DATA[s.id];
    assert.equal(d.v, '5.5.7', `${s.id} is Bodymovin 5.5.7`);
    assert.equal(d.w, 300, `${s.id} width 300`);
    assert.equal(d.h, 300, `${s.id} height 300`);
    assert.ok(Array.isArray(d.layers) && d.layers.length > 0, `${s.id} has layers`);
    assert.ok(d.fr > 0 && d.op > d.ip, `${s.id} has a positive duration`);
    assert.equal(JSON.stringify(d).includes('"gf"'), false, `${s.id} has no gradient fill`);
    assert.equal(JSON.stringify(d).includes('"mm"'), false, `${s.id} has no mask`);
  }
  eq(J.lottieMeta('stVinyl'), { w: 300, h: 300, fr: 60, ip: 0, op: 120 }, 'vinyl meta (2s loop)');
  eq(J.lottieMeta('stLightning'), { w: 300, h: 300, fr: 60, ip: 0, op: 40 }, 'lightning meta');
  assert.equal(J.lottieMeta('nope'), null, 'unknown meta is null');
}

// --- frame math: loops inside [start, end), in frames ---
{
  assert.equal(J.stickerFrame('stVinyl', 0.5, 0), 30, 'vinyl 0.5s in = frame 30');
  assert.equal(J.stickerFrame('stVinyl', 2.5, 0.5), 0, 'vinyl loops every 2s');
  assert.equal(J.stickerFrame('stEqualizer', 1.25, 0.25), 0, 'equalizer loops every 1s');
  assert.equal(J.stickerFrame('nope', 1, 0), 0, 'unknown sticker frame 0');
}

// --- normalize: unknown animations dropped, everything clamped ---
{
  eq(J.stickerNormalize(null), [], 'null normalizes to []');
  eq(J.stickerNormalize([{ anim: 'nope' }]), [], 'unknown animation dropped');
  const one = J.stickerNormalize([{ anim: 'stHeart', x: 2, y: -1, size: 9, start: -1, end: 0 }]);
  eq(one, [{ id: 'st0', anim: 'stHeart', x: 1, y: 0, size: 0.6, start: 0, end: 2 }], 'clamped to safe values, end fixed past start');
  const two = J.stickerNormalize([{ anim: 'stFlame', x: 0.2, y: 0.8, size: 0.3, start: 1, end: 3, id: 'my-sticker' }]);
  eq(two[0].id, 'my-sticker', 'safe custom id kept');
  const bad = J.stickerNormalize([{ anim: 'stFlame', id: 'a/b;evil' }]);
  assert.ok(/^st\d+$/.test(bad[0].id), 'unsafe id replaced');
  const d = J.stickerDefault('stNotes', 5, 9);
  assert.equal(d.anim, 'stNotes', 'default keeps the animation');
  eq([d.x, d.y, d.size, d.start, d.end], [0.5, 0.5, 0.25, 5, 9], 'default position/size/span');
  assert.equal(J.stickerDefault('nope', 0, 2).anim, 'stVinyl', 'unknown animation defaults to vinyl');
}

// --- lottieNormalizeData: SonaWave data lacks Bodymovin i/o handles ---
{
  const data = { layers: [{ ks: { s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 30, s: [120, 120, 100] }] }, o: { a: 1, k: [{ t: 0, s: [20] }, { t: 30, s: [80] }] } } }] };
  J.lottieNormalizeData(data);
  const sk = data.layers[0].ks.s.k, ok = data.layers[0].ks.o.k;
  eq(sk[0].o.x, [0.167, 0.167, 0.167]); eq(sk[0].i.y, [0.833, 0.833, 0.833]);
  eq(ok[1].o.x, [0.167]); eq(ok[1].i.x, [0.833]);
  // already-present handles are left alone
  const data2 = { ks: { r: { a: 1, k: [{ t: 0, s: [0], o: { x: [0.5], y: [0.5] }, i: { x: [0.5], y: [0.5] } }] } } };
  J.lottieNormalizeData(data2);
  eq(data2.ks.r.k[0].o.x, [0.5]);
  // every embedded sticker's keyframes end up with i/o
  for (const id of Object.keys(J.LOTTIE_DATA)) {
    const d = JSON.parse(JSON.stringify(J.LOTTIE_DATA[id]));
    J.lottieNormalizeData(d);
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o.k) && o.k.length && typeof o.k[0] === 'object' && o.k[0] !== null && 't' in o.k[0]) {
        for (const kf of o.k) { assert(kf.o && kf.i, id + ' keyframe missing i/o'); }
      }
      for (const k in o) walk(o[k]);
    };
    walk(d);
  }
}

// --- drawStickers never throws without a DOM or lottie ---
{
  assert.equal(J.drawStickers(null, { stickers: [{ anim: 'stHeart', x: 0.5, y: 0.5, size: 0.25, start: 0, end: 5 }], W: 1280, H: 720 }, 1, 1), 0, 'no DOM draws nothing');
  assert.equal(J.drawStickers(null, { stickers: [], W: 1280, H: 720 }, 1, 1), 0, 'empty list draws nothing');
  assert.equal(J.lottieReady(), false, 'no lottie in node');
}

console.log(JSON.stringify({ status: 'PASS', stickers: J.LOTTIE_STICKERS.length }, null, 2));
