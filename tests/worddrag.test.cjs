// P3 v0.21.0 — Waveform Word-Drag: bounds + snap, and the planner round-trip.
// P4 v0.22.0 — Whole-Word Drag: bounds for edge 'whole' + whole-word round-trip.
// The drag helpers live inside src/12_ui.js (DOM-heavy IIFE, not vm-loadable),
// so the test extracts wdBoundsFor + wdSnapTo verbatim from the shipped source
// and runs them with stubbed J/S/WD — it tests the real code, not a copy.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual (same rule as keyframe.test.cjs).
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b})`);
const root = path.resolve(__dirname, '..');

// --- extract a top-level function verbatim from 12_ui.js (brace-matching) ---
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
const uiSrc = fs.readFileSync(path.join(root, 'src', '12_ui.js'), 'utf8');
const wdSrc = extractFn(uiSrc, 'wdBoundsFor') + '\n' + extractFn(uiSrc, 'wdSnapTo');

// --- run the helpers in a vm with stubbed J/S/WD ---
function wdCtx(beats, snap) {
  const ctx = vm.createContext({
    J: { clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi) },
    S: { plan: { beats: beats || [] } },
    WD: { snap: snap !== false },
    Math, console,
  });
  vm.runInContext(wdSrc, ctx, { filename: 'worddrag-helpers.js' });
  return ctx;
}

// --- wdBoundsFor: start edge mirrors the .wstart handler's clamp ---
{
  const ctx = wdCtx([]);
  const arr = [
    { start: 17.17, end: 17.5, text: 'a' },
    { start: 17.5, end: 17.9, text: 'b' },
    { start: 17.9, end: 18.3, text: 'c' },
  ];
  const ln = { start: 17.0, end: 19.0 };
  const bEq = (got, lo, hi, msg) => { near(got.lo, lo, 0.0005, msg + ' lo'); near(got.hi, hi, 0.0005, msg + ' hi'); };
  bEq(ctx.wdBoundsFor(arr, ln, 1, 'start'), 17.5, 17.89, 'middle word start: [prevEnd, nextStart-0.01]');
  bEq(ctx.wdBoundsFor(arr, ln, 0, 'start'), 17.0, 17.49, 'first word start: lo is the line start');
  bEq(ctx.wdBoundsFor(arr, ln, 2, 'start'), 17.9, 19.0, 'last word start: hi is the line end');
  bEq(ctx.wdBoundsFor(arr, ln, 2, 'end'), 17.91, 19.0, 'last word end: [start+0.01, line.end]');
  // previous word with a null end falls back to prev.start + 0.01 (same as the handler)
  const arrNull = [
    { start: 17.17, end: null, text: 'a' },
    { start: 17.5, end: 17.9, text: 'b' },
  ];
  bEq(ctx.wdBoundsFor(arrNull, ln, 1, 'start'), 17.18, 19.0, 'null prev end -> prev.start+0.01');
}

// --- wdBoundsFor 'whole' (P4 v0.22.0): move start+end together, duration fixed ---
{
  const ctx = wdCtx([]);
  const arrW = [
    { start: 17.0, end: 17.3, text: 'a' },
    { start: 17.6, end: 18.0, text: 'b' },
    { start: 18.5, end: 18.8, text: 'c' },
  ];
  const lnW = { start: 16.5, end: 19.5 };
  const bEq = (got, lo, hi, msg) => { near(got.lo, lo, 0.0005, msg + ' lo'); near(got.hi, hi, 0.0005, msg + ' hi'); };
  bEq(ctx.wdBoundsFor(arrW, lnW, 1, 'whole'), 17.3, 18.09, 'middle word whole: [prevEnd, nextStart-0.01-dur]');
  bEq(ctx.wdBoundsFor(arrW, lnW, 0, 'whole'), 16.5, 17.29, 'first word whole: lo is the line start');
  bEq(ctx.wdBoundsFor(arrW, lnW, 2, 'whole'), 18.0, 19.2, 'last word whole: hi is line.end-dur');
  // tight gap: the word is as long as the free room, so hi < lo and the word cannot move
  const arr = [
    { start: 17.17, end: 17.5, text: 'a' },
    { start: 17.5, end: 17.9, text: 'b' },
    { start: 17.9, end: 18.3, text: 'c' },
  ];
  const ln = { start: 17.0, end: 19.0 };
  bEq(ctx.wdBoundsFor(arr, ln, 1, 'whole'), 17.5, 17.49, 'tight gap: hi < lo means no room to move');
  // previous word with a null end falls back to prev.start + 0.01 (same as the handler)
  const arrNull = [
    { start: 17.17, end: null, text: 'a' },
    { start: 17.5, end: 17.9, text: 'b' },
  ];
  bEq(ctx.wdBoundsFor(arrNull, ln, 1, 'whole'), 17.18, 18.6, 'whole with null prev end -> prev.start+0.01, hi is line.end-dur');
}

// --- wdSnapTo: toggle OFF = raw; Shift = 0.01s; beat within 0.12s; else 0.05s ---
{
  const beats = [17.0, 17.5, 18.0];
  const on = wdCtx(beats, true), off = wdCtx(beats, false), noBeats = wdCtx([], true);
  near(off.wdSnapTo(17.317, {}), 17.317, 0.0005, 'snap OFF: raw time, 3 decimals');
  near(on.wdSnapTo(17.51, {}), 17.5, 0.0005, 'near a beat (0.01 away): snaps to the beat');
  near(on.wdSnapTo(17.61, {}), 17.5, 0.0005, '0.11 from a beat: still the beat (inside 0.12)');
  near(on.wdSnapTo(17.63, {}), 17.65, 0.0005, '0.13 from a beat: falls back to the 0.05s grid');
  near(on.wdSnapTo(17.317, { shiftKey: true }), 17.32, 0.0005, 'Shift: fine 0.01s grid, no beat snap');
  near(noBeats.wdSnapTo(17.317, {}), 17.3, 0.0005, 'no beats: 0.05s grid');
  near(on.wdSnapTo(17.025, {}), 17.0, 0.0005, 'exact beat wins over the grid');
}

// --- planner round-trip: an edited wordTime survives the plan slice (W3) ---
{
  const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
  for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
  const J = context.window.J;
  const edited = [
    { start: 17.17, end: 17.5, text: 'Một' },
    { start: 17.55, end: 17.9, text: 'chiều' }, // dragged start 17.50 -> 17.55
    { start: 17.9, end: 18.3, text: 'thu' },
  ];
  const out = J.sliceWordTimes(edited, 'Một chiều thu', 'vi');
  assert.ok(out && out.length === 3, 'slice keeps all three words');
  near(out[1].start, 17.55, 0.0005, 'edited start survives sliceWordTimes');
  near(out[2].start, 17.9, 0.0005, 'untouched neighbours survive sliceWordTimes');
  const endEdited = [
    { start: 17.17, end: 17.5, text: 'Một' },
    { start: 17.5, end: 17.9, text: 'chiều' },
    { start: 17.9, end: 18.45, text: 'thu' }, // dragged end 18.30 -> 18.45
  ];
  const out2 = J.sliceWordTimes(endEdited, 'Một chiều thu', 'vi');
  near(out2[2].end, 18.45, 0.0005, 'edited end survives sliceWordTimes');
  // P4 v0.22.0: a whole-word move shifts start AND end by the same delta
  const wholeMoved = [
    { start: 17.17, end: 17.5, text: 'Một' },
    { start: 17.7, end: 18.1, text: 'chiều' }, // whole-word drag 17.50 -> 17.70 (end 17.9 -> 18.1)
    { start: 18.5, end: 18.9, text: 'thu' },
  ];
  const out3 = J.sliceWordTimes(wholeMoved, 'Một chiều thu', 'vi');
  assert.ok(out3 && out3.length === 3, 'whole-word slice keeps all three words');
  near(out3[1].start, 17.7, 0.0005, 'whole-word move: start survives sliceWordTimes');
  near(out3[1].end, 18.1, 0.0005, 'whole-word move: end survives sliceWordTimes');
  near(out3[1].end - out3[1].start, 0.4, 0.0005, 'whole-word move: duration preserved');
  near(out3[0].start, 17.17, 0.0005, 'whole-word move: previous word untouched');
  near(out3[2].start, 18.5, 0.0005, 'whole-word move: next word untouched');
}

console.log('worddrag: all cases PASS');
