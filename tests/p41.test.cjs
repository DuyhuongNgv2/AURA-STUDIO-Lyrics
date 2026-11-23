// P4.1 v0.35.1 — word-drag snap toggle persistence (aura.wdSnap.v1).
// The helpers live inside src/12_ui.js (DOM-heavy, not vm-loadable), so the
// test extracts WD_SNAP_KEY + wdSnapLoad + wdSnapSave verbatim from the
// shipped source and runs them with a stubbed localStorage + WD — it tests
// the real code, not a copy (same rule as worddrag.test.cjs).
// The keyframe rAF flush (also P4.1) lives in bind() event handlers and is
// not extractable as a top-level function; it is covered by QA-045 in a
// real browser instead.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const uiSrc = fs.readFileSync(path.join(root, 'src', '12_ui.js'), 'utf8');

function extractFn(src, name) {
  const i = src.indexOf('function ' + name);
  assert.ok(i >= 0, `${name} exists in 12_ui.js`);
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error(`unbalanced braces in ${name}`);
}
const keyLine = uiSrc.match(/const WD_SNAP_KEY = '[^']+';/);
assert.ok(keyLine, 'WD_SNAP_KEY const exists in 12_ui.js');
assert.equal(keyLine[0], "const WD_SNAP_KEY = 'aura.wdSnap.v1';");
const code = keyLine[0] + '\n' + extractFn(uiSrc, 'wdSnapLoad') + '\n' + extractFn(uiSrc, 'wdSnapSave');

function ctxWith(store, snap) {
  const ctx = vm.createContext({
    WD: { snap },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    console,
  });
  vm.runInContext(code, ctx, { filename: 'p41-helpers.js' });
  return ctx;
}

// absent key -> in-memory default kept (ON, as WD.snap starts true)
let store = {};
let ctx = ctxWith(store, true);
ctx.wdSnapLoad();
assert.equal(ctx.WD.snap, true, 'absent key keeps default ON');
assert.deepEqual(Object.keys(store), [], 'load writes nothing');

// stored '0' -> OFF restored
store = { 'aura.wdSnap.v1': '0' };
ctx = ctxWith(store, true);
ctx.wdSnapLoad();
assert.equal(ctx.WD.snap, false, "'0' restores OFF");

// stored '1' -> ON restored (even if memory started OFF)
store = { 'aura.wdSnap.v1': '1' };
ctx = ctxWith(store, false);
ctx.wdSnapLoad();
assert.equal(ctx.WD.snap, true, "'1' restores ON");

// garbage value -> default kept
store = { 'aura.wdSnap.v1': 'yes' };
ctx = ctxWith(store, true);
ctx.wdSnapLoad();
assert.equal(ctx.WD.snap, true, 'garbage value keeps default');

// save writes '1'/'0' immediately under the versioned key
store = {};
ctx = ctxWith(store, false);
ctx.wdSnapSave();
assert.equal(store['aura.wdSnap.v1'], '0', 'save OFF writes 0');
ctx.WD.snap = true;
ctx.wdSnapSave();
assert.equal(store['aura.wdSnap.v1'], '1', 'save ON writes 1');

// round-trip: save OFF, fresh context (reload) loads OFF
ctx = ctxWith(store, true);
ctx.WD.snap = false;
ctx.wdSnapSave();
const reloaded = ctxWith(store, true);
reloaded.wdSnapLoad();
assert.equal(reloaded.WD.snap, false, 'round-trip OFF survives reload');

// throwing localStorage (private mode etc.) must not break load/save
const boom = vm.createContext({
  WD: { snap: true },
  localStorage: { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } },
  console,
});
vm.runInContext(code, boom, { filename: 'p41-helpers.js' });
boom.wdSnapLoad();
boom.wdSnapSave();
assert.equal(boom.WD.snap, true, 'throwing storage leaves default, no throw');

console.log('p41.test.cjs PASS');
