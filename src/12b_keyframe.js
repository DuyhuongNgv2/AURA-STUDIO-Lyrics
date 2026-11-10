/* AURA — Keyframe Editor (P2 v0.20.0, K1 + K2).
   Item keyframes, OFFSET semantics: a key stores a full pose {t, x, y, rot,
   scale, opacity, rotY, rotX, dolly, orbit} where x/y/rot ADD to the
   procedural value and scale/opacity MULTIPLY it. K2 fields: rotY/rotX are
   3D text rotation in DEGREES (additive into it._t3d, radians); dolly is a
   camera push (additive 0..1 into env._t3dCam.dolly, zoom multiplier in 2D);
   orbit is a camera orbit in DEGREES (additive into env._t3dCam.orbit,
   radians; slight rotation in 2D). Linear interpolation between keys, hold
   outside the key range. Pure functions only (no DOM): keyframeEval is
   unit-tested in Node, and the render hooks are single calls — Hook 1 inside
   J.mainDraw2D (after enter/hold/exit, before draw; runs once per item per
   frame, inside the bake too, so 3D plane + block both read the mutated
   item) and Hook 2 J.applyCamKeyframes inside Renderer.frame (after CD.get;
   the layerBlur probe in the same file calls the same helper). No extrusion
   depth is keyframeable (geometry cache key includes exDepth). */
(() => {
'use strict';
const clamp = J.clamp, lerp = J.lerp;

/* The unit pose: zero offset, unit scale, full opacity. Frozen — callers must
   never mutate it; keyframeEval returns a fresh object (or this one read-only
   via keyframePoseAt callers that only read). */
const UNIT = Object.freeze({ x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 });
const PROPS = ['x', 'y', 'rot', 'scale', 'opacity', 'rotY', 'rotX', 'dolly', 'orbit'];

/* Normalise a key array into a clean sorted copy (never mutates the input):
   drops non-objects and non-finite t, fills missing props from UNIT,
   clamps opacity into [0, 1], forces scale to a finite positive number,
   sorts by t, and drops earlier duplicates of the same t (last wins). */
J.keyframeNorm = keys => {
  if (!Array.isArray(keys)) return [];
  const out = [];
  for (const k of keys) {
    if (!k || typeof k !== 'object' || !Number.isFinite(+k.t)) continue;
    const p = { t: +k.t };
    for (const prop of PROPS) {
      const v = +k[prop];
      if (prop === 'opacity') p[prop] = Number.isFinite(v) ? clamp(v, 0, 1) : 1;
      else if (prop === 'scale') p[prop] = Number.isFinite(v) && v > 0 ? v : 1;
      else p[prop] = Number.isFinite(v) ? v : 0;
    }
    out.push(p);
  }
  out.sort((a, b) => a.t - b.t);
  const ded = [];
  for (const p of out) {
    if (ded.length && ded[ded.length - 1].t === p.t) ded[ded.length - 1] = p;
    else ded.push(p);
  }
  return ded;
};

/* Evaluate the pose at cut-relative time t (seconds since cut start).
   Pure function of (keys, t): linear interpolation between the bracketing
   keys, hold the nearest key outside the range, unit pose for an empty track.
   Robust to unsorted input and duplicate t (last duplicate wins) — one O(n)
   scan, no allocation except the returned pose. */
J.keyframeEval = (keys, t) => {
  if (!Array.isArray(keys) || !keys.length) return { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, rotY: 0, rotX: 0, dolly: 0, orbit: 0 };
  const q = Number.isFinite(+t) ? +t : 0;
  let lo = null, hi = null;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!k || typeof k !== 'object' || !Number.isFinite(+k.t)) continue;
    const kt = +k.t;
    if (kt <= q) { if (!lo || kt >= lo.k.t) lo = { k, i }; }
    else if (!hi || kt <= hi.k.t) { hi = { k, i }; }
  }
  const poseOf = k => ({
    x: Number.isFinite(+k.x) ? +k.x : 0,
    y: Number.isFinite(+k.y) ? +k.y : 0,
    rot: Number.isFinite(+k.rot) ? +k.rot : 0,
    scale: Number.isFinite(+k.scale) && +k.scale > 0 ? +k.scale : 1,
    opacity: Number.isFinite(+k.opacity) ? clamp(+k.opacity, 0, 1) : 1,
    rotY: Number.isFinite(+k.rotY) ? +k.rotY : 0,
    rotX: Number.isFinite(+k.rotX) ? +k.rotX : 0,
    dolly: Number.isFinite(+k.dolly) ? +k.dolly : 0,
    orbit: Number.isFinite(+k.orbit) ? +k.orbit : 0,
  });
  if (!lo) return poseOf(hi.k);            // before the first key: hold it
  if (!hi) return poseOf(lo.k);            // after the last key: hold it
  const span = hi.k.t - lo.k.t;
  if (span <= 0) return poseOf(lo.k);
  const u = clamp((q - lo.k.t) / span, 0, 1);
  const a = poseOf(lo.k), b = poseOf(hi.k);
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    rot: lerp(a.rot, b.rot, u),
    scale: lerp(a.scale, b.scale, u),
    opacity: lerp(a.opacity, b.opacity, u),
    rotY: lerp(a.rotY, b.rotY, u),
    rotX: lerp(a.rotX, b.rotX, u),
    dolly: lerp(a.dolly, b.dolly, u),
    orbit: lerp(a.orbit, b.orbit, u),
  };
};

/* Pose of a cut at cut-relative time t (for the Inspector). Read-only. */
J.keyframePoseAt = (cut, t) => J.keyframeEval(cut && cut.keyframes, t);

/* Validate a key array against a cut duration (used when restoring from JSON):
   normalises, clamps t into [0, dur], reports how many keys were dropped. */
J.keyframeValidate = (keys, dur) => {
  const norm = J.keyframeNorm(keys);
  const d = Number.isFinite(+dur) && +dur > 0 ? +dur : 0;
  const kept = [];
  let drop = 0;
  for (const p of norm) {
    if (p.t < 0 || p.t > d) { drop++; continue; }
    kept.push(p);
  }
  return { keys: kept, dropped: drop };
};

/* Deep-copy a key array (for the splitCut twin, which must not share the
   reference with the original cut). */
J.keyframeClone = keys => (Array.isArray(keys) ? JSON.parse(JSON.stringify(keys)) : []);

/* Render hook (K1). Applies the evaluated pose to the item AFTER the
   enter/hold/exit recipes mutated it and BEFORE it is drawn — so the
   procedural animation is preserved and the keyframe only adds its offset.
   No-op when the cut has no keys (old projects render byte-identically).
   Called once per item per frame from J.mainDraw2D; the 3D bake calls
   mainDraw2D too, so plane + block both see the mutated item. */
J.applyKeyframes = (env, it) => {
  const cut = env && env.cut;
  const keys = cut && cut.keyframes;
  if (!keys || !keys.length) return;
  const t = env.lt != null ? env.lt : 0;
  const p = J.keyframeEval(keys, t);
  it.x = (it.x || 0) + p.x;
  it.y = (it.y || 0) + p.y;
  if (p.rot) it.rot = (it.rot || 0) + p.rot;
  if (p.scale !== 1) { it.sx = (it.sx || 1) * p.scale; it.sy = (it.sy || 1) * p.scale; }
  if (p.opacity !== 1) it.alpha = (it.alpha ?? 1) * p.opacity;
  // K2: 3D text rotation — additive into it._t3d (radians; the keyframe
  // stores degrees). _transform/_renderBlock read it._t3d after the bake,
  // so plane + block both rotate; in 2D this is inert (nothing reads _t3d).
  if (p.rotY || p.rotX) {
    it._t3d = it._t3d || {};
    if (p.rotY) it._t3d.rotY = (it._t3d.rotY || 0) + p.rotY * J.DEG;
    if (p.rotX) it._t3d.rotX = (it._t3d.rotX || 0) + p.rotX * J.DEG;
  }
};

/* Camera hook (K2). Applies the evaluated camera pose AFTER the cut's camera
   effect (CD.get) and BEFORE the frame transform uses cam — so the keyframe
   adds to the procedural camera move, exactly like Hook 1 adds to the item.
   dolly: additive into env._t3dCam.dolly (3D plane Z, 0..1) and a zoom
   multiplier (1 + dolly) on cam.s in 2D. orbit: additive into
   env._t3dCam.orbit (radians; the keyframe stores degrees) and a slight
   rotation (degrees × 0.3, like the orbit3d effect's 2D fallback) on cam.rot
   in 2D. Returns cam (unchanged when there are no keys). Pure function of
   (keys, env.lt): Preview/Export identical; ghost passes evaluate at their
   own (earlier) time, so a delayed ghost shows the camera of its own moment.
   No-op when the cut has no keys. */
J.applyCamKeyframes = (env, cut, cam) => {
  if (!cam) return cam;
  const keys = cut && cut.keyframes;
  if (!keys || !keys.length) return cam;
  const t = env && env.lt != null ? env.lt : 0;
  const p = J.keyframeEval(keys, t);
  if (p.dolly) {
    if (env) { env._t3dCam = env._t3dCam || {}; env._t3dCam.dolly = (env._t3dCam.dolly || 0) + p.dolly; }
    cam.s = (cam.s ?? 1) * (1 + p.dolly);
  }
  if (p.orbit) {
    if (env) { env._t3dCam = env._t3dCam || {}; env._t3dCam.orbit = (env._t3dCam.orbit || 0) + p.orbit * J.DEG; }
    cam.rot = (cam.rot || 0) + p.orbit * 0.3;
  }
  return cam;
};
})();
