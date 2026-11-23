// M2 v0.27.0 — 2D visualizers: the offline spectrum (FFT + log bins +
// per-bin normalisation), the per-frame slice, the deterministic idle
// spectrum, and the six BG registrations (892 old labels intact + 6 new).
// Node-testable only (no DOM): the Preview==Export pixel proof is browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b})`);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

const sineBuf = (freq, seconds, amp) => {
  const sr = 44100, len = sr * seconds, d = new Float32Array(len);
  for (let i = 0; i < len; i++) d[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  return { sampleRate: sr, numberOfChannels: 1, length: len, getChannelData: () => d };
};

// --- vizData exists, needs a buffer, caches per AudioBuffer ---
{
  assert.equal(typeof J.vizData, 'function', 'J.vizData exists');
  assert.equal(typeof J.vizFrame, 'function', 'J.vizFrame exists');
  assert.equal(J.vizData(null), null, 'vizData(null) is null');
  assert.equal(J.vizData({}), null, 'vizData without buffer is null');
  assert.equal(J.vizFrame(null, 1), null, 'vizFrame(null) is null');
  const buf = sineBuf(440, 2, 0.5);
  const a = { buffer: buf };
  const viz = J.vizData(a);
  assert.equal(viz.bins, 64, '64 bins');
  assert.equal(viz.rate, 30, '30 fps');
  assert.equal(viz.frames, 59, '2s at 30fps, 2048 window, hop 1470 -> 59 frames');
  assert.equal(J.vizData(a), viz, 'same audio object returns the cached viz');
  assert.equal(J.vizData({ buffer: buf }), viz, 'same AudioBuffer returns the cached viz (survives audioLike() copies)');
  assert.equal(a._viz, viz, 'viz is cached on the audio object too');
}

// --- a 440 Hz sine lights the ~440 Hz bins and leaves distant bins dark ---
{
  const viz = J.vizData({ buffer: sineBuf(440, 2, 0.5) });
  const fr = J.vizFrame(viz, 1.0).freq;
  assert.equal(fr.length, 64, 'freq is 64 bins');
  assert.ok(fr[29] > 0.8, `440Hz bin 29 hot (got ${fr[29]})`);
  assert.ok(fr[30] > 0.8, `440Hz bin 30 hot (got ${fr[30]})`);
  assert.ok(fr[10] < 0.2, `~60Hz bin 10 dark (got ${fr[10]})`);
  assert.ok(fr[50] < 0.2, `high bin 50 dark (got ${fr[50]})`);
  for (const v of fr) assert.ok(v >= 0 && v <= 1, 'every bin is normalised to 0..1');
  // two tones: both bands hot
  const sr = 44100, len = sr * 2, d = new Float32Array(len);
  for (let i = 0; i < len; i++) d[i] = 0.4 * Math.sin(2 * Math.PI * 440 * i / sr) + 0.4 * Math.sin(2 * Math.PI * 3000 * i / sr);
  const viz2 = J.vizData({ buffer: { sampleRate: sr, numberOfChannels: 1, length: len, getChannelData: () => d } });
  const fr2 = J.vizFrame(viz2, 1.0).freq;
  assert.ok(fr2[29] > 0.8, '440Hz band hot in the mix');
  assert.ok(fr2[47] > 0.8 || fr2[48] > 0.8, `3kHz band hot in the mix (47=${fr2[47]}, 48=${fr2[48]})`);
}

// --- silence stays silent; vizFrame clamps time; wave is the mono slice ---
{
  const sr = 44100, len = sr * 2;
  const viz = J.vizData({ buffer: { sampleRate: sr, numberOfChannels: 1, length: len, getChannelData: () => new Float32Array(len) } });
  let mx = 0;
  for (const v of viz.spec) if (v > mx) mx = v;
  assert.equal(mx, 0, 'silence spectrum is all zero');
  const f0 = J.vizFrame(viz, -5), f1 = J.vizFrame(viz, 999);
  assert.equal(f0.fi, 0, 'negative t clamps to frame 0');
  assert.equal(f1.fi, viz.frames - 1, 'late t clamps to the last frame');
  const vizS = J.vizData({ buffer: sineBuf(440, 2, 0.5) });
  const w = J.vizFrame(vizS, 1.0).wave;
  assert.equal(w.length, 128, 'wave is 128 samples');
  let wMax = 0;
  for (const v of w) wMax = Math.max(wMax, Math.abs(v));
  near(wMax, 0.5, 0.05, 'wave slice carries the sine amplitude');
}

// --- the idle spectrum is deterministic and bounded (thumbnails / no audio) ---
{
  assert.equal(typeof J.vizIdleFreq, 'function', 'J.vizIdleFreq exists');
  const a = J.vizIdleFreq(1.25), b = J.vizIdleFreq(1.25), c = J.vizIdleFreq(2.5);
  eq(Array.from(a), Array.from(b), 'idle spectrum is deterministic for the same t');
  assert.ok(JSON.stringify(Array.from(a)) !== JSON.stringify(Array.from(c)), 'idle spectrum moves with t');
  assert.equal(a.length, 64, 'idle spectrum is 64 bins');
  for (const v of a) assert.ok(v >= 0.05 && v <= 0.6, 'idle bins stay in their calm band');
}

// --- the six BG entries register with their Japanese names; old labels intact ---
{
  const keys = ['vizBarsMirror', 'vizFlame', 'vizMatrix', 'vizLaser', 'vizStarburst', 'vizDna'];
  for (const k of keys) {
    assert.ok(J.BG[k], `J.BG.${k} registered`);
    assert.equal(typeof J.BG[k].draw, 'function', `J.BG.${k}.draw is a function`);
    assert.equal(J.BG[k].pack, 'viz', `J.BG.${k} belongs to the viz pack`);
  }
  eq(keys.map(k => J.BG[k].name), ['ミラーバー・ピーク', '炎スペクトル', 'サイバーマトリックス', 'レーザービーム', 'スターバースト', 'DNAヘリックス'], 'Japanese registry names');
  assert.ok(J.BG_ORDER.includes('vizFlame'), 'viz entries are in BG_ORDER');
  const total = J.GROUP_KEYS.reduce((x, g) => x + J.order(g).length, 0);
  assert.equal(total, 918, `label gate is 918 (got ${total})`);
  for (const k of ['seigaiha', 'eqBars', 'nightMoon', 'particlesBg']) assert.ok(J.BG[k], `old BG ${k} still registered`);
}
console.log('ALL_VIZ_PASS');
