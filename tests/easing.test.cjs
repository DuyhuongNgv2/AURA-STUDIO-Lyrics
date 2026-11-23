// K4 v0.26.1 — Keyframe easing: the easing map, eased evaluation, normaliser
// validation, and back-compat (a key with no `ease` field evaluates linear).
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

// --- the easing map: 5 names, endpoints exact, hold is a step ---
{
  for (const fn of ['keyframeEase', 'keyframeEaseFn', 'keyframeEaseValid'])
    assert.equal(typeof J[fn] === 'function' || typeof J[fn] === 'object', true, `J.${fn} exists`);
  eq(Object.keys(J.keyframeEase).sort(), ['ease-in', 'ease-in-out', 'ease-out', 'hold', 'linear'], 'five easing names');
  for (const name of Object.keys(J.keyframeEase)) {
    near(J.keyframeEase[name](0), 0, 0, `${name}(0) is 0`);
    near(J.keyframeEase[name](1), 1, 0, `${name}(1) is 1`);
  }
  near(J.keyframeEase.linear(0.25), 0.25, 1e-12, 'linear(0.25)');
  near(J.keyframeEase['ease-in'](0.25), 0.0625, 1e-12, 'ease-in(0.25) = 0.25^2');
  near(J.keyframeEase['ease-out'](0.25), 0.4375, 1e-12, 'ease-out(0.25) = 1-(0.75)^2');
  near(J.keyframeEase['ease-in-out'](0.25), 0.0625, 1e-12, 'ease-in-out(0.25) = 4*0.25^3');
  near(J.keyframeEase['ease-in-out'](0.75), 0.9375, 1e-12, 'ease-in-out(0.75)');
  near(J.keyframeEase['ease-in-out'](0.5), 0.5, 1e-12, 'ease-in-out midpoint is 0.5');
  near(J.keyframeEase.hold(0), 0, 0, 'hold(0)');
  near(J.keyframeEase.hold(0.5), 0, 0, 'hold(0.5) stays at the lo key');
  near(J.keyframeEase.hold(0.999), 0, 0, 'hold(0.999) still at the lo key');
  near(J.keyframeEase.hold(1), 1, 0, 'hold(1) jumps to the hi key');
  assert.equal(J.keyframeEaseFn('ease-in'), J.keyframeEase['ease-in'], 'EaseFn returns the named curve');
  assert.equal(J.keyframeEaseFn('bogus'), J.keyframeEase.linear, 'EaseFn falls back to linear');
  assert.equal(J.keyframeEaseFn(undefined), J.keyframeEase.linear, 'EaseFn of undefined is linear');
  assert.equal(J.keyframeEaseValid('ease-out'), 'ease-out', 'EaseValid keeps a known name');
  assert.equal(J.keyframeEaseValid('bogus'), 'linear', 'EaseValid falls back to linear');
  assert.equal(J.keyframeEaseValid(undefined), 'linear', 'EaseValid of undefined is linear');
  assert.equal(J.keyframeEaseValid(42), 'linear', 'EaseValid of a non-string is linear');
}

// --- keyframeEval: each easing shapes the segment from the lo key ---
{
  const two = ease => [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease },
    { t: 4, x: 100, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  near(J.keyframeEval(two('linear'), 1).x, 25, 1e-9, 'linear at u=0.25 is 25');
  near(J.keyframeEval(two('ease-in'), 1).x, 6.25, 1e-9, 'ease-in slow start: x=6.25 at u=0.25');
  near(J.keyframeEval(two('ease-in'), 3).x, 56.25, 1e-9, 'ease-in fast end: x=56.25 at u=0.75');
  near(J.keyframeEval(two('ease-out'), 1).x, 43.75, 1e-9, 'ease-out fast start: x=43.75 at u=0.25');
  near(J.keyframeEval(two('ease-out'), 3).x, 93.75, 1e-9, 'ease-out slow end: x=93.75 at u=0.75');
  near(J.keyframeEval(two('ease-in-out'), 1).x, 6.25, 1e-9, 'ease-in-out slow start');
  near(J.keyframeEval(two('ease-in-out'), 3).x, 93.75, 1e-9, 'ease-in-out slow end');
  near(J.keyframeEval(two('ease-in-out'), 2).x, 50, 1e-9, 'ease-in-out midpoint is 50');
  near(J.keyframeEval(two('hold'), 1).x, 0, 1e-9, 'hold stays at the lo key at u=0.25');
  near(J.keyframeEval(two('hold'), 3.999).x, 0, 1e-9, 'hold still at the lo key just before the next key');
  eq(J.keyframeEval(two('hold'), 4).x, 100, 'hold reaches the hi key at the segment end');
  // endpoints are exact whatever the easing
  eq(J.keyframeEval(two('ease-in'), 0).x, 0, 'at the lo key, easing is irrelevant');
  eq(J.keyframeEval(two('ease-in'), 4).x, 100, 'at the hi key, easing is irrelevant');
}

// --- the easing belongs to the lo key: the hi key's ease never shapes the segment ---
{
  const holdFirst = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'hold' },
    { t: 4, x: 100, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-in' },
  ];
  near(J.keyframeEval(holdFirst, 2).x, 0, 1e-9, 'lo hold wins over hi ease-in');
  const holdLast = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 100, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'hold' },
  ];
  near(J.keyframeEval(holdLast, 2).x, 50, 1e-9, 'hi hold is ignored: the segment is linear');
}

// --- back-compat: a key with no `ease` field (every project saved before K4) evaluates linear ---
{
  const old = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 100, y: 40, rot: 90, scale: 2, opacity: 0, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  eq(J.keyframeEval(old, 2), { x: 50, y: 20, rot: 45, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'old keys without ease are linear');
  const bad = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'bounce' },
    { t: 4, x: 100, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'bounce' },
  ];
  near(J.keyframeEval(bad, 1).x, 25, 1e-9, 'unknown ease name falls back to linear');
}

// --- per-segment easing: two segments, different easings ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-in' },
    { t: 2, x: 100, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'linear' },
    { t: 4, x: 200, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  near(J.keyframeEval(k, 1).x, 25, 1e-9, 'first segment eased (u=0.5 -> 0.25)');
  near(J.keyframeEval(k, 3).x, 150, 1e-9, 'second segment linear (u=0.5 -> 0.5)');
}

// --- K2 channels are eased exactly like the K1 pose fields ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-in' },
    { t: 4, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 90, rotX: 45, dolly: 1, orbit: 30 },
  ];
  const p = J.keyframeEval(k, 1); // u=0.25 -> inQuad 0.0625
  near(p.rotY, 5.625, 1e-9, 'eased rotY');
  near(p.rotX, 2.8125, 1e-9, 'eased rotX');
  near(p.dolly, 0.0625, 1e-9, 'eased dolly');
  near(p.orbit, 1.875, 1e-9, 'eased orbit');
}

// --- hold also works on multiplicative channels (scale/opacity) ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'hold' },
    { t: 4, x: 0, y: 0, rot: 0, scale: 2, opacity: 0, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  const p = J.keyframeEval(k, 2);
  near(p.scale, 1, 1e-9, 'hold keeps scale at the lo key');
  near(p.opacity, 1, 1e-9, 'hold keeps opacity at the lo key');
}

// --- keyframeNorm: keeps a valid ease, defaults missing/unknown to 'linear' ---
{
  const out = J.keyframeNorm([
    { t: 2, x: 20, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-out' },
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 40, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'nope' },
  ]);
  eq(out.map(k => k.ease), ['linear', 'ease-out', 'linear'], 'norm keeps valid ease, defaults the rest');
  eq(out[1].t, 2, 'norm still sorts with ease present');
}

// --- keyframeValidate carries the ease through (restore path) ---
{
  const r = J.keyframeValidate([
    { t: 1, x: 10, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'hold' },
    { t: 9, x: 90, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-in' },
  ], 5);
  assert.equal(r.dropped, 1, 'out-of-range key still dropped');
  eq(r.keys[0].ease, 'hold', 'validate keeps the ease of the surviving key');
}

// --- keyframeClone deep-copies the ease field too ---
{
  const src = [{ t: 0, x: 1, y: 2, rot: 3, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0, ease: 'ease-in-out' }];
  const copy = J.keyframeClone(src);
  copy[0].ease = 'hold';
  assert.equal(src[0].ease, 'ease-in-out', 'clone does not share the ease field');
}

console.log(JSON.stringify({ easing: 'PASS', cases: 9 }));
