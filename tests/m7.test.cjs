// M7 v0.32.0 — auto-fix lyrics overlaps + line offsets + karaoke duo next line.
// Node-testable only (pure data): the browser proof (Preview pixels, drag,
// export) is QA-040.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// Two ELRC lines in the shape lyric-align produces (last word of a line has end null = runs to the span end).
const ELRC2 = '[00:17.17]<00:17.17>Nhìn <00:17.25>giọt <00:22.13>ràng\n[00:24.04]<00:24.04>Nhìn <00:24.60>lại';
function elrcProject() {
  const p = J.defaultProject();
  p.lyrics = ELRC2; p.timing.lineTimes = {}; p.timing.wordTimes = {};
  const parsed = J.parseLyrics(p.lyrics);
  parsed.lines.forEach((l, i) => { if (l.words && l.words.length) p.timing.wordTimes[i] = l.words.map(w => ({ start: +w.start.toFixed(3), end: w.end != null ? +w.end.toFixed(3) : null, text: w.text })); });
  return p;
}

// --- validate: a clean ELRC import has no issues ---
{
  const p = elrcProject();
  const v = J.validateLyricsTimings(p);
  eq(v.hasIssues, false, 'clean ELRC import: no issues');
  eq(v.overlapCount, 0, 'clean ELRC import: 0 overlaps');
  eq(v.errorCount, 0, 'clean ELRC import: 0 errors');
}

// --- rule B: a word tail running past the next line start is trimmed to nextStart - 0.05 ---
{
  const p = elrcProject();
  p.timing.wordTimes[0][2].end = 24.50;   // last word of line 0 runs past line 1 start (24.04)
  const before = J.validateLyricsTimings(p);
  assert.equal(before.overlapCount, 1, 'one overlap before fix (word tail past next start)');
  const rep = J.autoFixLyricsOverlaps(p);
  eq(rep.after.hasIssues, false, 'no issues after fix');
  eq(p.timing.wordTimes[0][2].end, 23.99, 'word tail trimmed to nextStart - 0.05');
  eq(p.timing.lineTimes, {}, 'lineTimes untouched by a word-only fix');
  eq(p.timing.wordTimes[1], elrcProject().timing.wordTimes[1], 'line 1 words untouched');
  const rep2 = J.autoFixLyricsOverlaps(p);
  eq(rep2.fixed, 0, 'second fix is a no-op (idempotent)');
}

// --- rule B0: a line start typed earlier than its own first word snaps to the first word ---
{
  const p = elrcProject();
  p.timing.lineTimes[1] = 21.0;   // line 1 typed to start while line 0 still sings (till 24.04)
  const before = J.validateLyricsTimings(p);
  assert.ok(before.overlapCount >= 1, 'early line start is flagged');
  const rep = J.autoFixLyricsOverlaps(p);
  eq(rep.after.hasIssues, false, 'no issues after fix');
  eq(p.timing.lineTimes[1], 24.04, 'line 1 start snaps to its first word (B0)');
  eq(p.timing.wordTimes[1], elrcProject().timing.wordTimes[1], 'line 1 words never shift');
  eq(p.timing.wordTimes[0][2].end, null, 'last word of line 0 keeps its null end (runs to span end)');
  const rep2 = J.autoFixLyricsOverlaps(p);
  eq(rep2.fixed, 0, 'second fix is a no-op (idempotent)');
}

// --- rule A: stored line starts out of order are pushed apart by 0.5 s ---
// (parseLyrics sorts LRC tags by time, so the out-of-order case is built with stored lineTimes)
{
  const p = J.defaultProject();
  p.lyrics = '[00:16.50]Dòng hai\n[00:17.00]Dòng một\n[00:20.00]Dòng ba';
  p.timing.lineTimes = { 1: 16.0 };   // line 1 forced earlier than line 0 start + 0.5
  p.timing.wordTimes = {};
  const before = J.validateLyricsTimings(p);
  assert.ok(before.overlapCount >= 1, 'out-of-order stored starts are flagged');
  const rep = J.autoFixLyricsOverlaps(p);
  eq(rep.after.hasIssues, false, 'no issues after fix');
  eq(p.timing.lineTimes[1], 17.0, 'line 2 pushed to line 1 start + 0.5');
  assert.equal(p.timing.lineTimes[2], undefined, 'line 3 untouched (already clear of the pushed line 2)');
}

// --- rule C: an inverted word (end <= start) is repaired to start + 0.05 ---
{
  const p = elrcProject();
  p.timing.wordTimes[0][1] = { start: 17.25, end: 17.10, text: 'giọt' };
  const before = J.validateLyricsTimings(p);
  assert.ok(before.errorCount >= 1, 'inverted word is flagged as an error');
  const rep = J.autoFixLyricsOverlaps(p);
  eq(rep.after.hasIssues, false, 'no issues after fix');
  eq(p.timing.wordTimes[0][1].end, 17.3, 'inverted word end repaired to start + 0.05');
}

// --- fix on a clean project writes nothing back ---
{
  const p = elrcProject();
  const snap = JSON.stringify({ lt: p.timing.lineTimes, wt: p.timing.wordTimes });
  const rep = J.autoFixLyricsOverlaps(p);
  eq(rep.fixed, 0, 'clean project: nothing to fix');
  eq(JSON.stringify({ lt: p.timing.lineTimes, wt: p.timing.wordTimes }), snap, 'clean project: timing untouched');
}

// --- lineOffsetsNormalize ---
{
  eq(J.lineOffsetsNormalize(null), {}, 'null -> {}');
  eq(J.lineOffsetsNormalize({ 0: { dx: 0.1234, dy: -0.2 }, 2: { dx: 9, dy: 0 }, x: { dx: 1 }, '-1': { dx: 0.1 } }), { 0: { dx: 0.123, dy: -0.2 }, 2: { dx: 0.45, dy: 0 } }, 'clamp +-0.45, round 0.001, drop bad keys, drop all-zero');
}

// --- duoNextLine skips interludes ---
{
  const lines = [{ text: 'a' }, { text: '', interlude: true }, { text: 'b' }, { text: '', interlude: true }];
  eq(J.duoNextLine(lines, 0), 2, 'next singable line after 0 is 2 (interlude skipped)');
  eq(J.duoNextLine(lines, 2), -1, 'no line after the last one');
  eq(J.duoNextLine(lines, -1), 0, 'before the first line, the duo is line 0');
}

console.log('m7.test.cjs: all M7 node tests passed');
