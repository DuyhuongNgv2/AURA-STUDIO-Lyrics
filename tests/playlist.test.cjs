// M4 v0.29.0 — playlist logic: pure functions, node-tested (no DOM).
// Cross-realm note: vm values are compared with JSON.stringify, never deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

const fakeProject = (over) => Object.assign({
  title: 'Song A', artist: 'Artist A', lyrics: 'line one\nline two',
  audioName: 'a.mp3', audioKey: '', duration: 90,
  timing: { bpm: 120, offset: 0.4, beatOffset: 0, snap: true, tail: 0.9, lineScale: 1, lineTimes: { 0: 17.17 }, wordTimes: { 0: [{ start: 17.17, end: 17.5, text: 'Nhìn' }] } },
  overrides: { 0: { cutTech: { 0: { bg: 'vizFlame' } } } },
  style: 'sakura', mood: 'pop', seed: 42, fx: { beatSync: true, motion: 0.7 },
  exportRange: null, playlist: { items: [], current: 0, autoPlayNext: true, repeat: 'all' },
}, over || {});

// --- defaults / active ---
{
  assert.equal(typeof J.playlistNormalize, 'function', 'J.playlistNormalize exists');
  eq(J.playlistDefault(), { items: [], current: 0, autoPlayNext: true, repeat: 'all' }, 'default playlist is empty');
  assert.equal(J.playlistActive({ playlist: { items: [] } }), false, '0 items: not active');
  assert.equal(J.playlistActive({ playlist: { items: [{}] } }), false, '1 item: not active (legacy single-song behaviour)');
  assert.equal(J.playlistActive({ playlist: { items: [{}, {}] } }), true, '2 items: active');
  assert.equal(J.playlistActive({}), false, 'no playlist field: not active');
  assert.equal(J.playlistActive(null), false, 'null project: not active');
}

// --- normalize: drops bad items, dedupes ids, clamps current, coerces repeat ---
{
  const pl = J.playlistNormalize({
    items: [
      { id: 'a', title: 'A', lyrics: 'la', audioName: 'a.mp3', duration: 90, timing: { bpm: 100, lineTimes: { 0: 1 } } },
      { id: 'a', title: 'B', lyrics: 'lb' },           // duplicate id -> new id
      null, 'nope', { title: 'no lyrics' },            // malformed -> dropped
      { lyrics: 'no id at all', repeat: 'bogus' },
    ],
    current: 99, autoPlayNext: 'yes', repeat: 'bogus',
  });
  assert.equal(pl.items.length, 3, 'keeps 3 valid items, drops 3 malformed');
  assert.equal(pl.items[0].id, 'a', 'first id kept');
  assert.notEqual(pl.items[1].id, 'a', 'duplicate id replaced');
  assert.equal(pl.items[0].timing.bpm, 100, 'timing bpm kept');
  eq(pl.items[0].timing.lineTimes, { 0: 1 }, 'lineTimes kept');
  assert.equal(pl.items[2].title, '', 'missing title defaults to empty string');
  assert.equal(pl.current, 2, 'current clamped to last item');
  assert.equal(pl.repeat, 'all', 'bad repeat falls back to all');
  assert.equal(pl.autoPlayNext, true, 'autoPlayNext coerced (only false is false)');
  const pl2 = J.playlistNormalize({ items: [{ id: 'x', lyrics: 'l' }], current: 0, repeat: 'one', autoPlayNext: false });
  assert.equal(pl2.repeat, 'one', 'repeat one kept');
  assert.equal(pl2.autoPlayNext, false, 'autoPlayNext false kept');
  eq(J.playlistNormalize(null), J.playlistDefault(), 'null normalizes to default');
  eq(J.playlistNormalize('junk'), J.playlistDefault(), 'non-object normalizes to default');
}

// --- snapshot / apply round-trip (deep clone: no shared references) ---
{
  const p = fakeProject();
  const item = J.playlistSnapshot(p, { duration: 90.5 }, 'keep-id');
  assert.equal(item.id, 'keep-id', 'snapshot keeps the given id');
  assert.equal(item.title, 'Song A', 'snapshot takes title');
  assert.equal(item.duration, 90.5, 'snapshot takes duration from audio');
  assert.equal(item.audioKey, 'song:keep-id', 'audioKey derived from id');
  eq(item.timing.lineTimes, { 0: 17.17 }, 'snapshot takes lineTimes');
  eq(item.overrides, { 0: { cutTech: { 0: { bg: 'vizFlame' } } } }, 'snapshot takes overrides');
  // mutating the item must not touch the project (deep clone)
  item.timing.lineTimes[0] = 99;
  item.overrides[0].cutTech[0].bg = 'vizLaser';
  assert.equal(p.timing.lineTimes[0], 17.17, 'project lineTimes untouched by item edit');
  assert.equal(p.overrides[0].cutTech[0].bg, 'vizFlame', 'project overrides untouched by item edit');
  // apply the other way: project gets the item's fields, item stays intact
  const p2 = fakeProject({ title: 'Other', style: 'noir', timing: { bpm: 0, lineTimes: {} }, overrides: {} });
  const item2 = J.playlistSnapshot(fakeProject(), { duration: 90 });
  J.playlistApply(p2, item2);
  assert.equal(p2.title, 'Song A', 'apply restores title');
  assert.equal(p2.style, 'sakura', 'apply restores style');
  eq(p2.timing.lineTimes, { 0: 17.17 }, 'apply restores lineTimes');
  eq(p2.overrides, { 0: { cutTech: { 0: { bg: 'vizFlame' } } } }, 'apply restores overrides');
  item2.timing.lineTimes[0] = 55;
  assert.equal(p2.timing.lineTimes[0], 17.17, 'project untouched by later item edit after apply');
  // re-snapshot of the current item keeps its audio key
  const p3 = fakeProject();
  p3.playlist.items = [J.playlistSnapshot(p3, { duration: 90 }, 'id-1')];
  p3.playlist.items[0].audioKey = 'song:id-1';
  const again = J.playlistSnapshot(p3, { duration: 90 }, 'id-1');
  assert.equal(again.audioKey, 'song:id-1', 're-snapshot keeps the known audio key');
}

// --- next index: repeat modes ---
{
  const mk = (n, repeat) => ({ items: Array.from({ length: n }, (_, i) => ({ id: 't' + i })), current: 0, autoPlayNext: true, repeat });
  assert.equal(J.playlistNextIndex(mk(3, 'all'), 0), 1, 'all: 0 -> 1');
  assert.equal(J.playlistNextIndex(mk(3, 'all'), 2), 0, 'all: last wraps to 0');
  assert.equal(J.playlistNextIndex(mk(3, 'off'), 2), -1, 'off: last stops (-1)');
  assert.equal(J.playlistNextIndex(mk(3, 'off'), 1), 2, 'off: mid advances');
  assert.equal(J.playlistNextIndex(mk(3, 'one'), 1), 1, 'one: replays the same song');
  assert.equal(J.playlistNextIndex(mk(1, 'all'), 0), 0, 'all with 1 item: stays');
  assert.equal(J.playlistNextIndex({ items: [] }, 0), -1, 'empty: stops');
}

// --- move / total / title ---
{
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(J.playlistMove(items, 0, 2), 2, 'move 0 -> 2 returns new index');
  eq(items.map(i => i.id), ['b', 'c', 'a'], 'order after move');
  assert.equal(J.playlistMove(items, 5, 0), 5, 'out-of-range from is a no-op');
  assert.equal(J.playlistTotalDuration([{ duration: 90 }, { duration: 6.5 }, {}]), 96.5, 'total duration sums, missing counts as 0');
  assert.equal(J.playlistItemTitle({ title: ' My Song ' }, 0), 'My Song', 'title wins, trimmed');
  assert.equal(J.playlistItemTitle({ title: '', audioName: 'song_0_ocql.mp3' }, 1), 'song_0_ocql', 'falls back to audio name without extension');
  assert.equal(J.playlistItemTitle({ title: '', audioName: '' }, 2), '曲 3', 'falls back to numbered label');
  assert.equal(J.playlistCurrentItem({ playlist: { items: [{ id: 'a' }, { id: 'b' }], current: 1 } }).id, 'b', 'current item by index');
  assert.equal(J.playlistCurrentItem({ playlist: { items: [], current: 0 } }), null, 'no items: null');
}

console.log('playlist.test.cjs: ALL PASS');
