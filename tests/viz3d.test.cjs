// M3 v0.28.0 — 3D visualizers: the two new BG registrations (916 old labels
// intact + 2 new), the SonaWave planet templates, the pure orbit-angle and
// cube-bin helpers, and the deterministic 2D loading fallback math.
// Node-testable only (no DOM/WebGL): the Preview==Export pixel proof and
// the real WebGL path are browser QA (QA-036). Cross-realm note: vm values
// are compared with JSON.stringify, never deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b})`);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- the two BG entries exist, with the Japanese literal names ---
{
  assert.ok(J.BG.viz3dSolar, 'viz3dSolar is registered');
  assert.ok(J.BG.viz3dCubes, 'viz3dCubes is registered');
  assert.equal(J.BG.viz3dSolar.name, '太陽系3D', 'solar ja name');
  assert.equal(J.BG.viz3dCubes.name, 'キューブマトリックス3D', 'cubes ja name');
  assert.equal(typeof J.BG.viz3dSolar.draw, 'function', 'solar has a draw');
  assert.equal(typeof J.BG.viz3dCubes.draw, 'function', 'cubes has a draw');
  const bg = J.order('bg');
  assert.ok(bg.includes('viz3dSolar') && bg.includes('viz3dCubes'), 'both scenes are in the bg order');
  assert.equal(bg.length, 74, 'BG group is 72 old + 2 new');
}

// --- planet templates: SonaWave's six (Mercury..Saturn), colours/speeds verbatim ---
{
  const planets = J.viz3dSolarPlanets;
  assert.equal(planets.length, 6, 'six planets (SonaWave default planetCount)');
  eq(planets.map(p => p.name), ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'], 'planet names in order');
  eq(planets.map(p => p.color), ['#94a3b8', '#facc15', '#38bdf8', '#f87171', '#fb923c', '#fef08a'], 'planet colours verbatim from SonaWave');
  eq(planets.map(p => p.speed), [2.2, 1.7, 1.25, 0.95, 0.65, 0.45], 'planet angular speeds verbatim from SonaWave');
  eq(planets.map(p => p.off), [3.8, 7.0, 10.8, 14.5, 19.8, 25.5], 'planet orbit offsets verbatim from SonaWave');
  for (let i = 1; i < planets.length; i++) assert.ok(planets[i].off > planets[i - 1].off, 'orbits are strictly increasing');
}

// --- orbit angle is a pure function of t (deterministic: Preview == Export) ---
{
  const a0 = J.viz3dPlanetAngle(0, 0), a1 = J.viz3dPlanetAngle(0, 10);
  near(a1 - a0, 2.2 * 0.25 * 10, 1e-9, 'Mercury advances speed*0.25*t');
  assert.equal(J.viz3dPlanetAngle(2, 3.5), J.viz3dPlanetAngle(2, 3.5), 'same t gives the same angle');
  near(J.viz3dPlanetAngle(1, 0), (1 / 6) * Math.PI * 2, 1e-9, 'initial angles spread evenly');
  const saturnAt0 = J.viz3dPlanetAngle(5, 0);
  near(saturnAt0, (5 / 6) * Math.PI * 2, 1e-9, 'Saturn starts at 5/6 of a turn');
}

// --- cube bin pick: SonaWave's floor(dist * n * 0.65), clamped to the last bin ---
{
  assert.equal(J.viz3dCubeBin(0, 64), 0, 'centre cube reads the bass bin');
  assert.equal(J.viz3dCubeBin(1, 64), 41, 'corner cube reads bin floor(1*64*0.65)');
  assert.equal(J.viz3dCubeBin(0.5, 64), 20, 'mid cube reads bin 20');
  assert.equal(J.viz3dCubeBin(2, 64), 63, 'out-of-range distance clamps to the last bin');
  assert.equal(J.viz3dCubeBin(0.25, 64), 10, 'quarter distance reads bin 10');
  const spec = J.viz3dCubeSpec;
  eq([spec.n, spec.w, spec.gap], [8, 2.0, 0.35], 'cube grid spec is the SonaWave default (8, 2.0, 0.35)');
}

// --- the 2D fallback draws without WebGL and is deterministic ---
// The fallback runs through the BG draw with a stubbed text3d host that is
// never ready: it must not throw, must not call Math.random, and must draw
// the same pixels at the same t twice (a stub canvas records the calls).
{
  const calls = [];
  const stubCtx = {
    save() { calls.push(['save']); }, restore() { calls.push(['restore']); },
    beginPath() { calls.push(['beginPath']); }, closePath() { calls.push(['closePath']); },
    arc(x, y, r) { calls.push(['arc', +x.toFixed(2), +y.toFixed(2), +r.toFixed(2)]); },
    ellipse(x, y, rx, ry, rot) { calls.push(['ellipse', +x.toFixed(2), +y.toFixed(2), +rx.toFixed(2), +ry.toFixed(2), +rot.toFixed(2)]); },
    stroke() { calls.push(['stroke']); }, fill() { calls.push(['fill']); },
    fillRect(x, y, w, h) { calls.push(['fillRect', +x.toFixed(2), +y.toFixed(2), +w.toFixed(2), +h.toFixed(2)]); },
    createRadialGradient() { return { addColorStop() {} }; },
    set lineWidth(v) {}, set strokeStyle(v) {}, set fillStyle(v) {}, set globalAlpha(v) {},
  };
  const sc = { accent: '#ff00aa', accent2: '#00aaff', ghostA: '#888888', ghostB: '#444444', fg: '#ffffff', bg: '#100d19' };
  const fakeRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => { randomCalls++; return 0.5; };
  try {
    const realT3d = J.text3d;
    J.text3d = { ready: false, load() { return Promise.resolve(false); }, viz3d: { key: null, webgl: false } };
    const env = { ctx: stubCtx, W: 1280, H: 720, t: 17.5, sc, cut: {}, freq: J.vizIdleFreq(17.5), wave: null, beat: { since: 0.1 } };
    const run = key => { calls.length = 0; J.BG[key].draw(env, {}); return JSON.stringify(calls); };
    const solar1 = run('viz3dSolar'), solar2 = run('viz3dSolar');
    assert.equal(solar1, solar2, 'solar fallback draws identically at the same t');
    assert.ok(calls.length > 20, 'solar fallback draws orbits + sun + planets');
    assert.ok(JSON.parse(solar1).some(c => c[0] === 'arc'), 'solar fallback draws circles');
    const cubes1 = run('viz3dCubes'), cubes2 = run('viz3dCubes');
    assert.equal(cubes1, cubes2, 'cubes fallback draws identically at the same t');
    assert.equal(JSON.parse(cubes1).filter(c => c[0] === 'fillRect').length, 64, 'cubes fallback draws all 64 cells');
    assert.equal(randomCalls, 0, 'no Math.random in the fallback path');
    // the probe records the fallback path honestly
    assert.equal(J.text3d.viz3d.webgl, false, 'probe says webgl:false after a fallback frame');
    assert.equal(J.text3d.viz3d.key, 'viz3dCubes', 'probe records the last scene key');
    J.text3d = realT3d;
  } finally { Math.random = fakeRandom; }
}

console.log(JSON.stringify({ status: 'PASS', viz3dScenes: 2, planets: 6, cubeCells: 64 }, null, 2));
