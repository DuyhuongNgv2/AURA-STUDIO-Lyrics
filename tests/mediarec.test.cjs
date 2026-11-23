// M1 v0.24.0 — fast export (MediaRecorder): mime negotiation, file
// extension derivation, bitrate mapping, and the "never mislabel webm
// as mp4" rule. The pure helpers live in src/14_mediarec.js (an IIFE
// that assigns to J); the test loads the whole file in a vm with stubbed
// browser globals, so it tests the real code, not a copy.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual (same rule as keyframe.test.cjs / worddrag.test.cjs).
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', '14_mediarec.js'), 'utf8');

// --- vm context: stub MediaRecorder with a configurable supported set ---
function ctxWith(supported) {
  const ctx = vm.createContext({
    J: {},
    MediaRecorder: { isTypeSupported: (m) => supported.includes(m) },
    MediaStream: class { constructor() { this.tracks = []; } addTrack(t) { this.tracks.push(t); } },
    document: { getElementById: () => null },
    console,
  });
  vm.runInContext(src, ctx, { filename: '14_mediarec.js' });
  return ctx;
}

// --- pickFastMime: first supported in the SonaWave order (H.264+AAC first) ---
{
  const c = ctxWith(['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/webm;codecs=vp9,opus']);
  eq(c.J.pickFastMime(), 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4 H.264+AAC wins when supported');
  eq(c.J.fastExportSupported(), true, 'supported when a mime is available');
}
{
  // Linux Chromium: no mp4 in MediaRecorder -> falls back to webm, never null-mp4
  const c = ctxWith(['video/webm;codecs=vp9,opus', 'video/webm']);
  eq(c.J.pickFastMime(), 'video/webm;codecs=vp9,opus', 'webm vp9 when mp4 is unsupported');
}
{
  const c = ctxWith([]);
  eq(c.J.pickFastMime(), null, 'null when nothing is supported');
  eq(c.J.fastExportSupported(), false, 'unsupported when nothing is supported');
}
{
  // no MediaRecorder at all (old browser)
  const ctx = vm.createContext({ J: {}, MediaStream: class {}, document: { getElementById: () => null }, console });
  vm.runInContext(src, ctx, { filename: '14_mediarec.js' });
  eq(ctx.J.pickFastMime(), null, 'null without MediaRecorder');
  eq(ctx.J.fastExportSupported(), false, 'unsupported without MediaRecorder');
}

// --- fastMimeInfo: the reported codec always matches the real mime ---
eq(ctxWith([]).J.fastMimeInfo('video/mp4;codecs=avc1.640028,mp4a.40.2'),
  { container: 'MP4', video: 'H.264', audio: 'AAC', label: 'MP4 H.264 + AAC' }, 'mp4 H.264+AAC info');
eq(ctxWith([]).J.fastMimeInfo('video/webm;codecs=vp9,opus'),
  { container: 'WebM', video: 'VP9', audio: 'Opus', label: 'WebM VP9 + Opus' }, 'webm vp9+opus info');
eq(ctxWith([]).J.fastMimeInfo('video/mp4;codecs=h264,opus'),
  { container: 'MP4', video: 'H.264', audio: 'Opus', label: 'MP4 H.264 + Opus' }, 'mp4 h264+opus info');
eq(ctxWith([]).J.fastMimeInfo('video/webm'),
  { container: 'WebM', video: null, audio: null, label: 'WebM' }, 'bare webm info');

// --- fastFileExt: NEVER .mp4 for a webm mime (the SonaWave App.tsx:1908 bug) ---
{
  const J = ctxWith([]).J;
  eq(J.fastFileExt('video/mp4;codecs=avc1.640028,mp4a.40.2'), 'mp4', 'mp4 mime -> .mp4');
  eq(J.fastFileExt('video/mp4'), 'mp4', 'bare mp4 -> .mp4');
  eq(J.fastFileExt('video/webm;codecs=vp9,opus'), 'webm', 'webm vp9 -> .webm, not .mp4');
  eq(J.fastFileExt('video/webm'), 'webm', 'bare webm -> .webm');
  eq(J.fastFileExt(''), 'webm', 'empty mime -> .webm (safe default)');
}

// --- fastVideoBitrate: quality setting maps to a fixed bitrate ---
{
  const J = ctxWith([]).J;
  eq(J.fastVideoBitrate('standard'), 8000000, 'standard 8 Mbps');
  eq(J.fastVideoBitrate('high'), 14000000, 'high 14 Mbps');
  eq(J.fastVideoBitrate('max'), 24000000, 'max 24 Mbps');
  eq(J.fastVideoBitrate(undefined), 14000000, 'default is high');
}

// --- exportFast exists and rejects without a view (no silent no-op) ---
(async () => {
  const c = ctxWith(['video/webm;codecs=vp9,opus']);
  c.J.exportSpan = () => ({ t0: 0, dur: 10 });
  c.J.outputSize = () => [1920, 1080];
  c.J.ui = { loop: 'off', t: 0, playing: false, need: false, fastExporting: false };
  c.J.uiApi = { seek: () => {}, play: () => {}, pause: () => {} };
  let code = null;
  try {
    await c.J.exportFast({ plan: { fps: 24 }, project: {}, audio: null, range: null, onProgress: () => {}, signal: null });
  } catch (e) { code = e.fastCode; }
  eq(code, 'no-view', 'exportFast throws fastCode no-view without a preview canvas');
  console.log('mediarec: all cases PASS');
})().catch(e => { console.error(e); process.exit(1); });
