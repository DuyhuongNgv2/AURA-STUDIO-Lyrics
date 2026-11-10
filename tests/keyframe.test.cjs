// P2 v0.20.0 K1 + K2 — Keyframe Editor: evaluator, normaliser, validator,
// render hooks (Hook 1 item pose, Hook 2 camera). Node-testable only (no
// DOM): the hook-once-per-frame / Preview==Export proofs are browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b})`);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- engine is registered ---
{
  for (const fn of ['keyframeEval', 'keyframeNorm', 'keyframeValidate', 'keyframeClone', 'keyframePoseAt', 'applyKeyframes'])
    assert.equal(typeof J[fn], 'function', `J.${fn} exists`);
}

// --- empty track -> unit pose ---
{
  eq(J.keyframeEval([], 1), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'empty track is unit pose');
  eq(J.keyframeEval(undefined, 1), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'undefined track is unit pose');
}

// --- single key -> constant pose for the whole cut ---
{
  const k = [{ t: 2, x: 10, y: -5, rot: 15, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }];
  eq(J.keyframeEval(k, 0), { x: 10, y: -5, rot: 15, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'single key holds before');
  eq(J.keyframeEval(k, 2), { x: 10, y: -5, rot: 15, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'single key at t');
  eq(J.keyframeEval(k, 99), { x: 10, y: -5, rot: 15, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'single key holds after');
}

// --- two keys: exact ends, midpoint, hold outside ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 100, y: 40, rot: 90, scale: 2, opacity: 0, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  eq(J.keyframeEval(k, 0), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'at first key');
  eq(J.keyframeEval(k, 4), { x: 100, y: 40, rot: 90, scale: 2, opacity: 0, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'at last key');
  eq(J.keyframeEval(k, 2), { x: 50, y: 20, rot: 45, scale: 1.5, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'midpoint interpolates');
  eq(J.keyframeEval(k, -1), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'before first holds');
  eq(J.keyframeEval(k, 10), { x: 100, y: 40, rot: 90, scale: 2, opacity: 0, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'after last holds');
  const p = J.keyframeEval(k, 1);
  near(p.x, 25, 1e-9, 'quarter x'); near(p.scale, 1.25, 1e-9, 'quarter scale'); near(p.opacity, 0.75, 1e-9, 'quarter opacity');
}

// --- three keys: interpolation picks the right segment ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 2, x: 20, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 6, x: 20, y: 60, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  eq(J.keyframeEval(k, 1), { x: 10, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'first segment');
  eq(J.keyframeEval(k, 4), { x: 20, y: 30, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'second segment');
}

// --- unsorted input and duplicate t (last duplicate wins) ---
{
  const k = [
    { t: 4, x: 40, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 44, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ];
  eq(J.keyframeEval(k, 2), { x: 22, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'unsorted + dup t resolves to last duplicate');
  eq(J.keyframeEval(k, 4), { x: 44, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'at dup t, last wins');
}

// --- missing props default to unit values ---
{
  eq(J.keyframeEval([{ t: 0, x: 7 }], 0), { x: 7, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'missing props default');
  eq(J.keyframeEval([{ t: 0, scale: -2, opacity: 3, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }], 0), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'bad scale/opacity clamped');
}

// --- keyframeNorm: sorts, dedupes, drops bad, clamps ---
{
  const out = J.keyframeNorm([
    { t: 3, x: 30, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 'nope', x: 1 },
    null,
    { t: 1, x: 10, y: 0, rot: 0, scale: 0, opacity: 2, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 1, x: 11, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ]);
  eq(out, [
    { t: 1, x: 11, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 3, x: 30, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ], 'norm sorts + dedupes + drops bad');
  eq(J.keyframeNorm('not-an-array'), [], 'norm of non-array is []');
}

// --- keyframeValidate: drops keys outside [0, dur], reports count ---
{
  const r = J.keyframeValidate([
    { t: -1, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 2, x: 20, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 9, x: 90, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ], 5);
  assert.equal(r.dropped, 2, 'two keys outside duration dropped');
  eq(r.keys, [{ t: 2, x: 20, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }], 'only in-range key kept');
}

// --- keyframeClone: deep copy, no shared reference ---
{
  const src = [{ t: 0, x: 1, y: 2, rot: 3, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }];
  const copy = J.keyframeClone(src);
  copy[0].x = 99;
  assert.equal(src[0].x, 1, 'clone does not share the key object');
  eq(J.keyframeClone(null), [], 'clone of null is []');
}

// --- keyframePoseAt: cut-level helper ---
{
  eq(J.keyframePoseAt({ keyframes: [{ t: 0, x: 5, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }] }, 3), { x: 5, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'poseAt reads the cut track');
  eq(J.keyframePoseAt({}, 3), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'cut without keys is unit pose');
}

// --- applyKeyframes: no-op without keys, OFFSET semantics with keys ---
{
  const env0 = { cut: { dur: 4 }, lt: 1 };
  const it0 = { x: 100, y: 200, rot: 10, sx: 1, sy: 1, alpha: 1 };
  J.applyKeyframes(env0, it0);
  eq(it0, { x: 100, y: 200, rot: 10, sx: 1, sy: 1, alpha: 1 }, 'no keys: item untouched');

  const env = { cut: { dur: 4, keyframes: [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 100, y: 0, rot: 90, scale: 2, opacity: 0.5, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
  ] }, lt: 2 };
  const it = { x: 100, y: 200, rot: 10, sx: 1, sy: 1, alpha: 1 };
  J.applyKeyframes(env, it);
  eq(it, { x: 150, y: 200, rot: 55, sx: 1.5, sy: 1.5, alpha: 0.75 }, 'midpoint pose adds x/rot, multiplies scale/alpha');

  // unit pose leaves the procedural values exactly as they were
  const envU = { cut: { dur: 4, keyframes: [{ t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }] }, lt: 0 };
  const itU = { x: 100, y: 200, rot: 10, sx: 2, sy: 2, alpha: 0.8 };
  J.applyKeyframes(envU, itU);
  eq(itU, { x: 100, y: 200, rot: 10, sx: 2, sy: 2, alpha: 0.8 }, 'unit keyframe is identity');

  // missing env.cut never crashes
  J.applyKeyframes({}, { x: 1, y: 2 });
  J.applyKeyframes(null, { x: 1, y: 2 });
}

// --- K2: rotY/rotX/dolly/orbit interpolate like the K1 pose fields ---
{
  const k = [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 90, rotX: 45, dolly: 1, orbit: 30 },
  ];
  const p = J.keyframeEval(k, 2);
  near(p.rotY, 45, 1e-9, 'midpoint rotY'); near(p.rotX, 22.5, 1e-9, 'midpoint rotX');
  near(p.dolly, 0.5, 1e-9, 'midpoint dolly'); near(p.orbit, 15, 1e-9, 'midpoint orbit');
  eq(J.keyframeEval(k, 0), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }, 'K2 at first key');
  eq(J.keyframeEval(k, 4), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 90, rotX: 45, dolly: 1, orbit: 30 }, 'K2 at last key');
  eq(J.keyframeEval(k, 9), { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 90, rotX: 45, dolly: 1, orbit: 30 }, 'K2 holds after last');
}

// --- K2: norm fills missing K2 props with 0, preserves present ones ---
{
  const out = J.keyframeNorm([{ t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 30 }]);
  eq(out, [{ t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 30, rotX: 0, dolly: 0, orbit: 0 }], 'norm keeps rotY, defaults the rest');
}

// --- K2 Hook 1: rotY/rotX land in it._t3d as RADIANS, additive to the effect's value ---
{
  const env = { cut: { dur: 4, keyframes: [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 4, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 90, rotX: 45, dolly: 0, orbit: 0 },
  ] }, lt: 2 };
  const it = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, _t3d: { rotY: 0.1 } }; // an effect already set rotY 0.1 rad
  J.applyKeyframes(env, it);
  near(it._t3d.rotY, 0.1 + Math.PI / 4, 1e-9, 'rotY 45deg adds to the effect value (radians)');
  near(it._t3d.rotX, Math.PI / 8, 1e-9, 'rotX 22.5deg in radians');
}

// --- K2 Hook 1: no K2 values -> no _t3d object is created (2D renders stay identical) ---
{
  const env = { cut: { dur: 4, keyframes: [{ t: 0, x: 10, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 }] }, lt: 0 };
  const it = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };
  J.applyKeyframes(env, it);
  assert.equal(it._t3d, undefined, 'K1-only key creates no _t3d');
  assert.equal(it.x, 10, 'K1 x still applies');
}

// --- K2 Hook 2: dolly adds to env._t3dCam.dolly and multiplies cam.s ---
{
  assert.equal(typeof J.applyCamKeyframes, 'function', 'J.applyCamKeyframes exists');
  const env = { cut: { dur: 4 }, lt: 1, _t3dCam: { dolly: 0.2 } };
  const cut = { dur: 4, keyframes: [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 2, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 1, orbit: 0 },
  ] };
  const cam = { s: 1.2, rot: 5 };
  const out = J.applyCamKeyframes(env, cut, cam);
  near(env._t3dCam.dolly, 0.7, 1e-9, 'dolly 0.5 adds to the effect dolly 0.2');
  near(out.s, 1.2 * 1.5, 1e-9, 'cam.s multiplies by (1 + dolly)');
  assert.equal(out.rot, 5, 'cam.rot untouched by dolly');
}

// --- K2 Hook 2: orbit adds radians to env._t3dCam.orbit and degrees x0.3 to cam.rot ---
{
  const env = { cut: { dur: 4 }, lt: 2, _t3dCam: { orbit: 0.1 } };
  const cut = { dur: 4, keyframes: [
    { t: 0, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 },
    { t: 2, x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 30 },
  ] };
  const cam = { s: 1, rot: 0 };
  J.applyCamKeyframes(env, cut, cam);
  near(env._t3dCam.orbit, 0.1 + Math.PI / 6, 1e-9, 'orbit 30deg adds in radians');
  near(cam.rot, 9, 1e-9, 'cam.rot adds orbit x 0.3 (degrees, like orbit3d 2D fallback)');
}

// --- K2 Hook 2: no keys -> cam and env untouched; null cam -> null (no crash) ---
{
  const env = { cut: { dur: 4 }, lt: 1 };
  const cam = { s: 1.5, rot: 10 };
  assert.equal(J.applyCamKeyframes(env, { dur: 4, keyframes: [] }, cam), cam, 'no keys returns the same cam');
  assert.equal(env._t3dCam, undefined, 'no keys creates no _t3dCam');
  assert.equal(J.applyCamKeyframes(env, { dur: 4, keyframes: [{ t: 0, dolly: 1 }] }, null), null, 'null cam returns null');
  J.applyCamKeyframes(null, { dur: 4, keyframes: [{ t: 0, dolly: 1 }] }, { s: 1 });
}

console.log(JSON.stringify({ keyframe: 'PASS', cases: 20 }));
