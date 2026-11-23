// M5 v0.30.0 — particles: the music-reactivity factor, the layer count,
// and the eight DECOR registrations (898 old labels intact + 8 new).
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

// --- reactivity: louder + fresher beat = faster particles; no audio = calm ---
{
  assert.equal(typeof J.particleReact, 'function', 'J.particleReact exists');
  near(J.particleReact(null, null), 1.315, 0.001, 'no audio, no beat: 1 + 0.9*0.35');
  near(J.particleReact(0, null), 1, 0.001, 'silence: factor 1');
  near(J.particleReact(1, null), 1.9, 0.001, 'full energy: 1.9');
  near(J.particleReact(1, 0), 2.4, 0.001, 'full energy on the beat: 2.4');
  near(J.particleReact(1, 0.3), 1.9, 0.001, 'stale beat (>0.25s) adds nothing');
  assert.ok(J.particleReact(0.8, 0.05) > J.particleReact(0.2, 0.05), 'louder is faster at the same beat age');
  assert.ok(J.particleReact(0.5, 0.05) > J.particleReact(0.5, null), 'a fresh beat is faster than no beat');
}

// --- layer count clamps to 1..5, defaults to 2 ---
{
  assert.equal(typeof J.particleLayersOf, 'function', 'J.particleLayersOf exists');
  assert.equal(J.particleLayersOf(null), 2, 'missing fx defaults to 2 layers');
  assert.equal(J.particleLayersOf({}), 2, 'empty fx defaults to 2 layers');
  assert.equal(J.particleLayersOf({ particleLayers: 5 }), 5, '5 layers');
  assert.equal(J.particleLayersOf({ particleLayers: 9 }), 5, '9 clamps to 5');
  assert.equal(J.particleLayersOf({ particleLayers: 0 }), 2, '0 falls back to the default (|| 2)');
  assert.equal(J.particleLayersOf({ particleLayers: 1 }), 1, '1 layer');
}

// --- the eight DECOR entries register with their Japanese names ---
{
  const keys = ['ptRain', 'ptSnow', 'ptDust', 'ptStars', 'ptEmbers', 'ptBubbles', 'ptSpeed', 'ptWarp'];
  for (const k of keys) {
    assert.ok(J.DECOR[k], `J.DECOR.${k} registered`);
    assert.equal(typeof J.DECOR[k].draw, 'function', `J.DECOR.${k}.draw is a function`);
    assert.equal(J.DECOR[k].layer, 'back', `J.DECOR.${k} draws behind the lyrics`);
    assert.equal(J.DECOR[k].w, 0, `J.DECOR.${k} has weight 0 (random never picks particles)`);
    assert.equal(J.DECOR[k].pack, 'particle', `J.DECOR.${k} belongs to the particle pack`);
  }
  eq(keys.map(k => J.DECOR[k].name), ['雨', '雪', '塵', '星', '火の粉', 'シャボン玉', 'スピード線', 'ワープ'], 'Japanese registry names');
  assert.ok(J.DECOR_ORDER.includes('ptSnow'), 'particle entries are in DECOR_ORDER');
  // random never picks a particle: every particle weight in pickDecor is 0
  for (const k of keys) assert.equal((J.DECOR[k].w || 0) * 0.5, 0, `pickDecor weight of ${k} is 0`);
  for (const k of ['grid', 'risingParticles', 'bokeh', 'snow']) assert.ok(J.DECOR[k], `old DECOR ${k} still registered`);
}

// --- defaults: new projects carry the grade + particle fx fields ---
{
  const fx = J.defaultProject().fx;
  eq(fx.grade, { lut: 'none', strength: 1 }, 'default grade is none at full strength');
  assert.equal(fx.particleLayers, 2, 'default particleLayers is 2');
  assert.equal(fx.particleReact, true, 'default particleReact is true');
}
console.log('ALL_PARTICLE_PASS');
