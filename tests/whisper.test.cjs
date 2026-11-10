// cross-realm note: values built inside the vm have vm prototypes, so structures are compared
// with JSON.stringify (like vietnamese.test.cjs does for plans), never deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

const sr = 16000;
const sine = (dur, amp, freq) => { const n = Math.round(dur * sr), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = amp * Math.sin(2 * Math.PI * freq * i / sr); return d; };
const zeros = dur => new Float32Array(Math.round(dur * sr));
const concat = (...arrs) => { const n = arrs.reduce((a, b) => a + b.length, 0), out = new Float32Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
const approx = (a, b, tol) => Math.abs(a - b) <= tol;

// --- VAD: silence -> nothing voiced ---
{
  const v = J.whisperVad(zeros(3), sr);
  assert.equal(v.voicedRatio, 0);
  assert.equal(v.spans.length, 0);
}
// --- VAD: 1 s of voice between silences -> one span ~[1, 2] ---
{
  const v = J.whisperVad(concat(zeros(1), sine(1, 0.3, 440), zeros(1)), sr);
  assert.equal(v.spans.length, 1);
  assert.ok(approx(v.spans[0][0], 1.0, 0.1), `span start ${v.spans[0][0]}`);
  assert.ok(approx(v.spans[0][1], 2.0, 0.1), `span end ${v.spans[0][1]}`);
  assert.ok(approx(v.voicedRatio, 1 / 3, 0.05), `voicedRatio ${v.voicedRatio}`);
}
// --- VAD: click track (10 ms pulses every 0.5 s, no voice) -> voiced ratio < 10% ---
{
  const pulse = new Float32Array(Math.round(0.01 * sr)).fill(0.5);
  const parts = [];
  for (let i = 0; i < 12; i++) parts.push(pulse, zeros(0.49));
  const v = J.whisperVad(concat(...parts), sr);
  assert.ok(v.voicedRatio < 0.1, `click track voicedRatio ${v.voicedRatio}`);
}
// --- span coverage ---
assert.ok(approx(J.whisperSpanRatio([[1, 2]], 0, 3), 1 / 3, 1e-9));
assert.ok(approx(J.whisperSpanRatio([[1, 2]], 1.5, 2.5), 0.5, 1e-9));
assert.equal(J.whisperSpanRatio([], 0, 3), 0);
// --- word filtering by voiced spans ---
{
  const words = [
    { text: 'a', start: 0.5, end: 0.8 },
    { text: 'b', start: 1.5, end: 1.8 },
    { text: 'c', start: 2.5, end: 2.8 },
  ];
  const kept = J.whisperFilterWords(words, [[1, 2]], 0.1);
  eq(kept.map(w => w.text), ['b']);
  assert.equal(J.whisperFilterWords(words, [], 0.1).length, 0);
}
// --- per-line status ---
assert.equal(J.whisperLineStatus(8, 10, 0.8), 'good');
assert.equal(J.whisperLineStatus(5, 10, 0.8), 'good');   // exactly 50% counts as good
assert.equal(J.whisperLineStatus(4, 10, 0.8), 'check');
assert.equal(J.whisperLineStatus(0, 5, 0.8), 'check');
assert.equal(J.whisperLineStatus(8, 10, 0.05), 'novoice'); // matched words, but no voice in its span
assert.equal(J.whisperLineStatus(0, 5, 0.0), 'novoice');
// --- line end: next NEW fixed time, else LRC, else song duration ---
{
  const L = [{ lrc: null }, { lrc: null }, { lrc: null }];
  assert.equal(J.whisperLineEnd({ 0: 10, 2: 30 }, L, 1, 60), 29.95);
  assert.equal(J.whisperLineEnd({ 0: 10, 2: 30 }, L, 2, 60), 60);
  assert.equal(J.whisperLineEnd({ 0: 10, 2: 30 }, L, 0, 60), 29.95); // line 1 has no time, so the next fixed time is line 2's 30
  const L2 = [{ lrc: 5 }, { lrc: null }, { lrc: 20 }];
  assert.equal(J.whisperLineEnd({}, L2, 1, 60), 19.95);
}
// --- word clamping: the QA-018 regression ---
// new line span [25, 29.95] (real times), old plan end was 20: the old code dropped every word.
{
  const flat = [{ line: 0, k: 0, text: 'Nhìn', norm: 'nhin' }, { line: 0, k: 1, text: 'giọt', norm: 'giot' }, { line: 0, k: 2, text: 'sương', norm: 'suong' }];
  const wWords = [
    { text: 'nhin', norm: 'nhin', start: 25.5, end: 25.8 },
    { text: 'giot', norm: 'giot', start: 26.0, end: 26.4 },
    { text: 'suong', norm: 'suong', start: 29.9, end: 30.6 },
  ];
  const toks = [{ text: 'Nhìn' }, { text: 'giọt' }, { text: 'sương' }];
  const clean = J.whisperClampWords([{ u: 0, w: 0 }, { u: 1, w: 1 }, { u: 2, w: 2 }], flat, wWords, toks, 25, 29.95);
  assert.equal(clean.length, 3, 'all three words kept inside the NEW span');
  eq(clean[0], { start: 25.5, end: 25.8, text: 'Nhìn' });
  eq(clean[2], { start: 29.9, end: 29.95, text: 'sương' }); // end clamped to the new line end
  // word before the line start clamps to the start, and order stays monotonic
  const early = J.whisperClampWords([{ u: 0, w: 0 }, { u: 1, w: 1 }], flat,
    [{ text: 'nhin', norm: 'nhin', start: 24.0, end: 24.5 }, { text: 'giot', norm: 'giot', start: 24.2, end: 24.6 }],
    toks, 25, 29.95);
  assert.equal(early[0].start, 25);
  assert.ok(early[1].start >= early[0].end);
  // word entirely past the line end is dropped
  const late = J.whisperClampWords([{ u: 0, w: 0 }], flat,
    [{ text: 'nhin', norm: 'nhin', start: 31, end: 31.5 }], toks, 25, 29.95);
  assert.equal(late.length, 0);
}
// --- review stats ---
{
  const rows = [
    { status: 'good', matched: 8, total: 10 },
    { status: 'check', matched: 3, total: 10 },
    { status: 'novoice', matched: 0, total: 5 },
    { status: 'good', matched: 10, total: 10 },
  ];
  eq(J.whisperReviewStats(rows), { good: 2, check: 1, novoice: 1, matchedWords: 21, totalWords: 35, total: 4 });
}
console.log(JSON.stringify({ status: 'PASS', whisperVad: 'PASS', whisperLineStatus: 'PASS', whisperLineEnd: 'PASS', whisperClampWords: 'PASS', whisperReviewStats: 'PASS' }, null, 2));
