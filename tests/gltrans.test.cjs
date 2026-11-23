/* P6 v0.33.0 — gl-transition shaders: registry, catalog defaults (seeded plan),
   draw edges (p=0 -> A exactly, p=1 -> B exactly), WebGL pass-through + honest
   crossfade fallback, AE map coverage. Runs in node vm like the other tests
   (no DOM, no WebGL); the real WebGL compile/render is QA-041's job. */
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
// JA literals, snapshotted BEFORE the label scripts rewrite names (vi edition shows vi names)
const jaNames = {};
for (const k of ['glSwirl', 'glKaleido', 'glPinwheel', 'glTvStatic']) jaNames[k] = context.window.J.TRANS[k].name;
for (const file of ['app/english.js', 'app/vietnamese.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const J = context.window.J;
const parts = JSON.parse(fs.readFileSync(path.join(root, 'app/vietnamese-parts.json'), 'utf8'));

const OLD8 = ['glBurn', 'glDissolve', 'glWater', 'glWarp', 'glMorph', 'glGlitch', 'glZoom', 'glDream'];
const NEW4 = ['glSwirl', 'glKaleido', 'glPinwheel', 'glTvStatic'];
const GL12 = [...OLD8, ...NEW4];
// --- registry: all 12 present, ordered, shaped like every other TRANS entry ---
for (const k of GL12) {
  assert.ok(J.TRANS[k], `missing TRANS ${k}`);
  assert.ok(J.TRANS_ORDER.includes(k), `not ordered ${k}`);
  const d = J.TRANS[k];
  assert.equal(typeof d.name, 'string', `${k} name`);
  assert.ok(Array.isArray(d.tags) && d.tags.length, `${k} tags`);
  assert.ok(typeof d.w === 'number' && d.w > 0, `${k} weight`);
  assert.ok(typeof d.dur === 'number' && d.dur >= 0.12 && d.dur <= 0.6, `${k} dur in planner clamp`);
  assert.equal(typeof d.draw, 'function', `${k} draw`);
  assert.equal(typeof d.plan, 'function', `${k} plan`);
  assert.ok(parts.trans[k], `missing vi name trans.${k}`);
}
assert.equal(JSON.stringify(jaNames), JSON.stringify({ glSwirl: 'スワール', glKaleido: 'カレイドスコープ', glPinwheel: 'ピンホイール', glTvStatic: 'TVノイズ' }), 'JA literals for the 4 new keys');
// trans group grew 38 -> 42, total labels 912 -> 916; +2 viz3d (M3 merge) -> 918
assert.equal(J.TRANS_ORDER.length, 42, `TRANS_ORDER is ${J.TRANS_ORDER.length}`);
assert.equal(J.GROUP_KEYS.reduce((x, g) => x + J.order(g).length, 0), 918, 'total labels');
// --- catalog defaults come back from plan() (a uniform is never left at 0) ---
const planOf = (k, seed) => J.TRANS[k].plan(J.rng(seed), {});
// catalog defaults: plan() returns them (glDissolve's seed is seeded-random,
// so its static DEFAULTS seed 12.9898 is what the renderer merges, not plan's)
const CATALOG = { glBurn: { burnColor: [1, 0.5, 0] }, glWater: { amplitude: 30, speed: 30 }, glMorph: { strength: 0.1 }, glZoom: { strength: 0.4 }, glDream: { rotation: 6, scale: 1.2 }, glSwirl: {}, glKaleido: { speed: 1, angle: 1, power: 1.5 }, glPinwheel: { speed: 2 }, glTvStatic: { offset: 0.05 }, glWarp: {}, glGlitch: {}, glDissolve: { scale: 4, smoothness: 0.01, seed: 12.9898 } };
for (const [k, want] of Object.entries(CATALOG)) {
  if (k === 'glDissolve') continue; // seed varies; checked separately below
  assert.equal(JSON.stringify(planOf(k, 1)), JSON.stringify(want), `${k} plan returns catalog defaults`);
}
// glDissolve seed is seeded-random: same rng seed -> same plan, other seed -> other seed
const d1 = planOf('glDissolve', 42), d2 = planOf('glDissolve', 42), d3 = planOf('glDissolve', 43);
assert.equal(JSON.stringify(d1), JSON.stringify(d2), 'dissolve plan deterministic per seed');
assert.equal(d1.scale, 4); assert.equal(d1.smoothness, 0.01);
assert.ok(typeof d1.seed === 'number' && d1.seed !== d3.seed, 'dissolve seed varies with rng');
// --- draw edges + WebGL pass-through + fallback, with a mocked J.gltrans ---
const A = { id: 'A' }, B = { id: 'B' };
function mockCtx() {
  return { calls: [], alphas: [], globalAlpha: 1, save() {}, restore() {}, drawImage(img, ...rest) { this.calls.push([img, ...rest]); this.alphas.push(this.globalAlpha); } };
}
const GL_CANVAS = { id: 'glcanvas' };
let renderCalls = [];
J.gltrans = {
  canvas: GL_CANVAS,
  render(key, glsl, a, b, p, params, cw, ch) { renderCalls.push({ key, p, params, cw, ch }); assert.equal(typeof glsl, 'string'); assert.ok(/vec4\s+transition\s*\(vec2/.test(glsl), `${key} GLSL has transition()`); assert.ok(!glsl.includes('sampler2D'), `${key} no extra textures`); return true; },
};
for (const k of GL12) {
  const D = J.TRANS[k];
  // p = 0 draws A exactly, p = 1 draws B exactly (glReg edge handling)
  let ctx = mockCtx();
  D.draw(ctx, A, B, 0, { cw: 640, ch: 360, P: {} });
  assert.equal(JSON.stringify(ctx.calls), JSON.stringify([[A, 0, 0]]), `${k} p=0 draws A`);
  ctx = mockCtx();
  D.draw(ctx, A, B, 1, { cw: 640, ch: 360, P: {} });
  assert.equal(JSON.stringify(ctx.calls), JSON.stringify([[B, 0, 0]]), `${k} p=1 draws B`);
  // p = 0.5 goes through WebGL with merged defaults (plan params + caller P override)
  renderCalls = [];
  ctx = mockCtx();
  const P = k === 'glPinwheel' ? { speed: 3 } : {};
  D.draw(ctx, A, B, 0.5, { cw: 640, ch: 360, P });
  assert.equal(renderCalls.length, 1, `${k} renders once at p=0.5`);
  assert.equal(renderCalls[0].key, k);
  assert.equal(renderCalls[0].p, 0.5);
  assert.equal(renderCalls[0].cw, 640); assert.equal(renderCalls[0].ch, 360);
  assert.equal(JSON.stringify(renderCalls[0].params), JSON.stringify(Object.assign({}, CATALOG[k], P)), `${k} params = defaults + P`);
  assert.equal(JSON.stringify(ctx.calls), JSON.stringify([[GL_CANVAS, 0, 0, 640, 360]]), `${k} draws gl canvas back`);
}
// fallback: WebGL unavailable -> honest crossfade (A at alpha 1-p over B already in ctx)
J.gltrans = { canvas: GL_CANVAS, render() { return false; } };
for (const k of GL12) {
  const ctx = mockCtx();
  J.TRANS[k].draw(ctx, A, B, 0.5, { cw: 640, ch: 360, P: {} });
  assert.equal(JSON.stringify(ctx.calls), JSON.stringify([[A, 0, 0]]), `${k} fallback draws A`);
  assert.equal(JSON.stringify(ctx.alphas), JSON.stringify([0.5]), `${k} fallback alpha is 1-p`);
  assert.equal(ctx.globalAlpha, 1, `${k} fallback restores alpha`);
}
// --- AE map covers all 12 gl keys with real AE trans targets ---
for (const k of GL12) {
  const m = J.AE_MAP.trans[k];
  assert.ok(m, `AE map missing ${k}`);
  assert.ok(J.TRANS[m], `AE map ${k} -> ${m} is not a TRANS key`);
}
assert.equal(JSON.stringify(Object.keys(J.AE_MAP.trans).filter(k => k.startsWith('gl')).sort()), JSON.stringify(GL12.slice().sort()));
// --- planner: gl keys are 追加分 (extra) by design (11q_sets.js): random picks
// use them only when project.extra === true; a per-line override always works.
// Same gate as the M2 viz / M5 particle packs — not a P6 regression.
const lyrics30 = Array.from({ length: 30 }, (_, i) => 'Dòng số ' + (i + 1)).join('\n');
let pickedGl = 0, trials = 0, pickedGlOff = 0;
for (let s = 0; s < 100; s++) {
  const p = Object.assign(J.defaultProject(), { lang: 'vi', lyrics: lyrics30, seed: s, extra: true });
  const plan = J.plan(p);
  for (const c of plan.cuts) { trials++; if (c.trans && c.trans.startsWith('gl')) pickedGl++; }
  const pOff = Object.assign(J.defaultProject(), { lang: 'vi', lyrics: lyrics30, seed: s });
  for (const c of J.plan(pOff).cuts) if (c.trans && c.trans.startsWith('gl')) pickedGlOff++;
}
assert.ok(pickedGl > 0, `planner never picked a gl trans in ${trials} cuts (extra on)`);
assert.equal(pickedGlOff, 0, 'gl trans must not be random-picked with extra off');
// manual per-line override bypasses the gate (extra off)
const pOv = Object.assign(J.defaultProject(), { lang: 'vi', lyrics: 'Dòng một\nDòng hai\nDòng ba', seed: 7, overrides: { 1: { trans: 'glPinwheel' } } });
const ovCuts = J.plan(pOv).cuts.filter(c => c.trans === 'glPinwheel');
assert.ok(ovCuts.length >= 1, 'override glSwirl did not apply');
assert.equal(JSON.stringify(ovCuts[0].transP), JSON.stringify({ speed: 2 }), 'override transP is the catalog default');
console.log(JSON.stringify({ status: 'PASS', glKeys: GL12.length, transTotal: J.TRANS_ORDER.length, labels: 918, plannerGlPicksExtraOn: pickedGl, plannerGlPicksExtraOff: pickedGlOff, plannerCuts: trials }, null, 2));
