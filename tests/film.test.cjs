// M5 v0.30.0 — film light: the six FXE registrations (898 old labels
// intact + 6 new). Node-testable only (no DOM): the Preview==Export
// pixel proof is browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- the six FXE entries register with their Japanese names ---
{
  const keys = ['filmVintage', 'filmAnamorphic', 'filmPrism', 'filmGolden', 'filmNeon', 'filmLens'];
  for (const k of keys) {
    assert.ok(J.FXE[k], `J.FXE.${k} registered`);
    assert.equal(typeof J.FXE[k].draw, 'function', `J.FXE.${k}.draw is a function`);
    assert.equal(J.FXE[k].builtin, undefined, `J.FXE.${k} is a draw entry, not a builtin (pickFx only picks non-builtins)`);
    assert.equal(J.FXE[k].mid, true, `J.FXE.${k} can fire mid-cut`);
    assert.ok(J.FXE[k].dur >= 24 && J.FXE[k].dur <= 48, `J.FXE.${k} lasts 1-2s (dur ${J.FXE[k].dur})`);
    assert.equal(J.FXE[k].pack, 'film', `J.FXE.${k} belongs to the film pack`);
  }
  eq(keys.map(k => J.FXE[k].name), ['ヴィンテージリーク', 'アナモフィックフレア', 'プリズムレインボー', 'ゴールデンアワー', 'ネオンリーク', 'レンズフレア'], 'Japanese registry names');
  assert.ok(J.FXE_ORDER.includes('filmPrism'), 'film entries are in FXE_ORDER');
  for (const k of ['chroma', 'radialChroma', 'anamorphic', 'filmBurn']) assert.ok(J.FXE[k], `old FXE ${k} still registered`);
}

// --- label gate: 898 old + 8 particles + 6 film + 4 gltrans + 2 viz3d = 918 ---
{
  const total = J.GROUP_KEYS.reduce((x, g) => x + J.order(g).length, 0);
  assert.equal(total, 918, `label gate is 918 (got ${total})`);
}
console.log('ALL_FILM_PASS');
