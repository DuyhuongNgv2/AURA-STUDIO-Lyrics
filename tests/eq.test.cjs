// M6 v0.31.0 — 10-band Master EQ: bands, presets, normalize, preset apply.
// Node-testable only (pure data): the audio proof (band energies, bypass,
// offline/fast export) is browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- 10 bands, SonaWave frequencies and filter types ---
{
  eq(J.EQ_BANDS.map(b => b.id), ['b32', 'b64', 'b125', 'b250', 'b500', 'b1k', 'b2k', 'b4k', 'b8k', 'b16k'], 'band ids in order');
  eq(J.EQ_BANDS.map(b => b.freq), [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], 'band frequencies');
  eq(J.EQ_BANDS.map(b => b.type), ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'], 'shelf on the ends, peaking in the middle');
}

// --- 10 presets, SonaWave ids + values ---
{
  eq(J.EQ_PRESETS.map(p => p.id), ['flat', 'bass-boost', 'sub-punch', 'vocal-clarity', 'acoustic-warmth', 'edm-club', 'rock-metal', 'lofi-vintage', 'cinematic-air', 'podcast-clean'], 'preset ids in SonaWave order');
  for (const p of J.EQ_PRESETS) {
    assert.ok(p.name && p.vi && p.en, `${p.id} has ja/vi/en names`);
    eq(Object.keys(p.bands).sort(), J.EQ_BANDS.map(b => b.id).sort(), `${p.id} covers all 10 bands`);
  }
  eq(J.eqPreset('bass-boost').bands.b64, 8.0, 'bass-boost b64 +8.0 (SonaWave value)');
  eq(J.eqPreset('bass-boost').preamp, -2, 'bass-boost preamp -2');
  eq(J.eqPreset('sub-punch').bands.b32, 8.5, 'sub-punch b32 +8.5');
  eq(J.eqPreset('vocal-clarity').bands.b4k, 6.0, 'vocal-clarity b4k +6.0');
  eq(J.eqPreset('vocal-clarity').lowCut, 40, 'vocal-clarity lowCut 40');
  eq(J.eqPreset('lofi-vintage').bands.b16k, -10.0, 'lofi b16k -10.0');
  eq(J.eqPreset('lofi-vintage').highCut, 14000, 'lofi highCut 14000');
  eq(J.eqPreset('podcast-clean').bands.b32, -12.0, 'podcast-clean b32 -12.0');
  eq(J.eqPreset('podcast-clean').lowCut, 80, 'podcast-clean lowCut 80');
  eq(J.eqPreset('edm-club').bands.b500, -2.5, 'edm-club scooped mids');
  eq(J.eqPreset('nope').id, 'flat', 'unknown preset falls back to flat');
}

// --- default / applyPreset / normalize ---
{
  const d = J.eqDefault();
  eq(d, { bypass: false, preset: 'flat', preamp: 0, lowCut: 0, highCut: 20000, bands: { b32: 0, b64: 0, b125: 0, b250: 0, b500: 0, b1k: 0, b2k: 0, b4k: 0, b8k: 0, b16k: 0 } }, 'flat default');
  const bb = J.eqApplyPreset('bass-boost');
  assert.equal(bb.preset, 'bass-boost', 'apply keeps the preset id');
  assert.equal(bb.bands.b64, 8.0, 'apply loads the band gains');
  assert.equal(bb.bypass, false, 'apply clears bypass');
  const flat2 = J.eqApplyPreset('flat');
  assert.equal(JSON.stringify(flat2.bands), JSON.stringify(d.bands), 'flat apply == default bands');
  // apply must not mutate the preset table
  bb.bands.b64 = 99;
  assert.equal(J.eqPreset('bass-boost').bands.b64, 8.0, 'preset table untouched by apply');
  eq(J.eqNormalize(null), d, 'null normalizes to flat default');
  const cl = J.eqNormalize({ preset: 'flat', preamp: 99, lowCut: -5, highCut: 99999, bands: { b64: 99, b16k: -99 } });
  assert.equal(cl.preamp, 6, 'preamp clamped to +6');
  assert.equal(cl.lowCut, 0, 'lowCut clamped to 0');
  assert.equal(cl.highCut, 20000, 'highCut clamped to 20000');
  assert.equal(cl.bands.b64, 12, 'band clamped to +12');
  assert.equal(cl.bands.b16k, -12, 'band clamped to -12');
  assert.equal(J.eqNormalize({ preset: 'nope', bands: {} }).preset, 'flat', 'unknown preset + flat bands -> flat');
  assert.equal(J.eqNormalize({ preset: 'nope', bands: { b64: 5 } }).preset, 'custom', 'unknown preset + non-flat bands -> custom');
  assert.equal(J.eqNormalize({ preset: 'custom', bands: { b64: 5 } }).preset, 'custom', 'custom stays custom');
  assert.equal(J.eqNormalize({ preset: 'bass-boost', bands: { b64: 8 } }).preset, 'bass-boost', 'known preset stays');
}

// --- eqBandEnergies needs Web Audio: null in node, never throws ---
{
  (async () => {
    assert.equal(await J.eqBandEnergies(null, null), null, 'null buffer -> null');
  })();
}

console.log(JSON.stringify({ status: 'PASS', bands: J.EQ_BANDS.length, presets: J.EQ_PRESETS.length }, null, 2));
