// M5 v0.30.0 — LUT grade: all 13 presets, the filter string and the
// overlay descriptors. Node-testable only (no DOM): the Preview==Export
// pixel proof is browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- 13 presets, ids + categories exactly as SonaWave's LUT_PRESET_ITEMS ---
{
  assert.equal(J.GRADE_LUTS.length, 13, '13 LUT presets');
  eq(J.GRADE_LUTS.map(l => l.id), ['none', 'teal-orange', 'cinematic-warm', 'bleach-bypass', 'cyberpunk-neon', 'vintage-70s', 'golden-hour', 'black-and-white', 'faded-film', 'retro-vhs', 'matrix-green', 'moody-blue', 'candy-pop'], 'preset ids in SonaWave order');
  eq(J.GRADE_LUTS.map(l => l.cat), ['clean', 'cinema', 'cinema', 'creative', 'creative', 'vintage', 'cinema', 'clean', 'vintage', 'vintage', 'creative', 'moody', 'creative'], 'preset categories');
  for (const l of J.GRADE_LUTS) {
    assert.ok(l.name && l.vi && l.en, `${l.id} has ja/vi/en names`);
    assert.equal(typeof l.cfg, 'object', `${l.id} has a numeric config`);
  }
  eq(J.gradeLut('teal-orange').cfg.contrast, 18, 'teal-orange contrast 18 (SonaWave value)');
  eq(J.gradeLut('black-and-white').cfg.saturation, -100, 'B&W saturation -100');
  eq(J.gradeLut('moody-blue').cfg.temperature, -65, 'moody-blue temperature -65');
  eq(J.gradeLut('matrix-green').cfg.tint, -70, 'matrix-green tint -70');
  eq(J.gradeLut('nope'), J.GRADE_LUTS[0], 'unknown id falls back to none');
}

// --- gradeOf: off for none / strength 0, on otherwise ---
{
  assert.equal(J.gradeOf(null), null, 'missing grade is off');
  assert.equal(J.gradeOf({ lut: 'none', strength: 1 }), null, 'none is off');
  assert.equal(J.gradeOf({ lut: 'teal-orange', strength: 0 }), null, 'strength 0 is off');
  const g = J.gradeOf({ lut: 'teal-orange', strength: 0.5 });
  assert.equal(g.lut, 'teal-orange', 'grade keeps the lut id');
  assert.equal(g.strength, 0.5, 'grade keeps the strength');
  assert.equal(J.gradeOf({ lut: 'teal-orange' }).strength, 1, 'missing strength defaults to 1');
}

// --- filter string: none is empty, B&W kills saturation, strength scales ---
{
  assert.equal(J.gradeFilter('none', 1), '', 'none has no filter');
  assert.equal(J.gradeFilter('teal-orange', 0), '', 'strength 0 has no filter');
  const bw = J.gradeFilter('black-and-white', 1);
  assert.ok(bw.includes('saturate(0'), `B&W saturate(0%) (got ${bw})`);
  assert.ok(bw.includes('contrast(138'), `B&W contrast 138% (got ${bw})`);
  const half = J.gradeFilter('teal-orange', 0.5);
  assert.ok(half.includes('contrast(109'), `half strength halves the contrast (got ${half})`);
  const warm = J.gradeFilter('cinematic-warm', 1);
  assert.ok(warm.includes('sepia(8'), `warm sepia 8% (got ${warm})`);
  const vhs = J.gradeFilter('retro-vhs', 1);
  assert.ok(vhs.includes('hue-rotate(8'), `VHS hue-rotate 8deg (got ${vhs})`);
}

// --- overlays: split-tone, temperature, tint, lift + folded amounts ---
{
  const none = J.gradeOverlays('none', 1);
  eq(none, { overlays: [], vignette: 0, grain: 0, bloom: 0 }, 'none has no overlays');
  const teal = J.gradeOverlays('teal-orange', 1);
  assert.ok(teal.overlays.some(o => o.where === 'top' && o.color === '#fed7aa'), 'teal-orange highlights tint on top');
  assert.ok(teal.overlays.some(o => o.where === 'bottom' && o.color === '#083344'), 'teal-orange shadows tint at the bottom');
  assert.ok(teal.overlays.some(o => o.color === '#ff9a3c'), 'warm temperature overlay');
  assert.ok(teal.vignette > 0 && teal.vignette < 0.6, 'teal-orange vignette folded in');
  const cold = J.gradeOverlays('moody-blue', 1);
  assert.ok(cold.overlays.some(o => o.color === '#3c7bff'), 'cold temperature overlay is blue');
  const bw = J.gradeOverlays('black-and-white', 1);
  assert.ok(bw.grain > 0.2, 'B&W grain folded in');
  assert.ok(bw.overlays.some(o => o.color === '#ffffff'), 'shadowsLift adds a white lift overlay');
  const half = J.gradeOverlays('teal-orange', 0.5);
  assert.ok(Math.abs(half.vignette - teal.vignette / 2) < 1e-9, 'strength 0.5 halves the folded vignette');
  const neon = J.gradeOverlays('cyberpunk-neon', 1);
  assert.ok(neon.bloom > 0.2, 'cyberpunk bloom folded in');
}
console.log('ALL_GRADE_PASS');
