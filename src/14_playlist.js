/* ============================================================
   LyricWave — playlist (M4 v0.29.0): many songs, continuous play.
   Pure logic, no DOM, no audio — node-testable (tests/playlist.test.cjs).
   The design comes from SonaWave's playlistManager.ts (MIT, HAY Studio73):
   a track keeps its own title/artist/lyrics/audio/timing/effects, the
   playlist keeps the order + the current index + repeat mode. Rewritten
   in plain JS the AURA way — no TS/React is carried over.
   User-visible strings live in 12_ui.js (localised there); this file
   throws/returns error CODES only.
   ============================================================ */
(() => {
'use strict';

/* fields that belong to ONE song (snapshotted per item, applied on switch).
   Everything else in the project — enabled (892-key map), aspect/res/fps/
   quality/includeAudio, colors, fonts, locks, themeId, sets, lang, keyBg,
   unify, typeset, centerFree — is shared by the whole playlist (see the
   M4 Gate 0 doc for why). */
const PL_FIELDS = ['title', 'artist', 'lyrics', 'audioName', 'audioKey', 'duration',
  'timing', 'overrides', 'style', 'mood', 'seed', 'fx', 'exportRange'];
const PL_REPEATS = ['all', 'one', 'off'];
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

J.playlistDefault = () => ({ items: [], current: 0, autoPlayNext: true, repeat: 'all' });
/* the playlist drives behaviour only once it holds 2+ songs; with 0-1 items
   the app is exactly the old single-song app */
J.playlistActive = (project) => {
  const pl = project && project.playlist;
  return !!(pl && Array.isArray(pl.items) && pl.items.length >= 2);
};
J.playlistCount = (project) => {
  const pl = project && project.playlist;
  return pl && Array.isArray(pl.items) ? pl.items.length : 0;
};

let plSeq = 0;
J.playlistNewId = () => 'pl-' + Date.now().toString(36) + '-' + (++plSeq) + '-' + Math.floor(Math.random() * 1296).toString(36);

/* one item's shape, with safe defaults for anything an old/foreign file omits */
J.playlistBlankItem = (id) => ({
  id: id || J.playlistNewId(),
  title: '', artist: '', lyrics: '',
  audioName: '', audioKey: '',
  duration: 0,
  timing: { bpm: 0, offset: 0.4, beatOffset: 0, snap: true, tail: 0.9, lineScale: 1, lineTimes: {}, wordTimes: {} },
  overrides: {},
  style: 'noir', mood: null, seed: 20260922,
  fx: {},
  exportRange: null,
});

/* project files are untrusted: drop malformed items, dedupe ids, clamp current */
J.playlistNormalize = (pl) => {
  const out = J.playlistDefault();
  if (!pl || typeof pl !== 'object') return out;
  const seen = new Set();
  const items = Array.isArray(pl.items) ? pl.items : [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    if (typeof raw.lyrics !== 'string') continue;
    let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : '';
    if (!id || seen.has(id)) id = J.playlistNewId();
    seen.add(id);
    const it = J.playlistBlankItem(id);
    it.title = typeof raw.title === 'string' ? raw.title.slice(0, 120) : '';
    it.artist = typeof raw.artist === 'string' ? raw.artist.slice(0, 120) : '';
    it.lyrics = raw.lyrics;
    it.audioName = typeof raw.audioName === 'string' ? raw.audioName.slice(0, 200) : '';
    it.audioKey = typeof raw.audioKey === 'string' ? raw.audioKey.slice(0, 120) : '';
    const dur = +raw.duration;
    it.duration = isFinite(dur) && dur > 0 ? +dur.toFixed(3) : 0;
    if (raw.timing && typeof raw.timing === 'object') {
      const t = raw.timing;
      it.timing = {
        bpm: isFinite(+t.bpm) ? +t.bpm : 0,
        offset: isFinite(+t.offset) ? +t.offset : 0.4,
        beatOffset: isFinite(+t.beatOffset) ? +t.beatOffset : 0,
        snap: t.snap !== false,
        tail: isFinite(+t.tail) ? +t.tail : 0.9,
        lineScale: isFinite(+t.lineScale) ? +t.lineScale : 1,
        lineTimes: (t.lineTimes && typeof t.lineTimes === 'object') ? clone(t.lineTimes) : {},
        wordTimes: (t.wordTimes && typeof t.wordTimes === 'object') ? clone(t.wordTimes) : {},
      };
    }
    if (raw.overrides && typeof raw.overrides === 'object') it.overrides = clone(raw.overrides);
    if (typeof raw.style === 'string') it.style = raw.style.slice(0, 40);
    if (raw.mood === null || typeof raw.mood === 'string') it.mood = raw.mood == null ? null : raw.mood.slice(0, 40);
    if (isFinite(+raw.seed)) it.seed = Math.round(+raw.seed);
    if (raw.fx && typeof raw.fx === 'object') it.fx = clone(raw.fx);
    if (raw.exportRange === null || (raw.exportRange && typeof raw.exportRange === 'object')) it.exportRange = clone(raw.exportRange);
    out.items.push(it);
  }
  out.current = Math.max(0, Math.min(out.items.length - 1, parseInt(pl.current, 10) || 0));
  out.autoPlayNext = pl.autoPlayNext !== false;
  out.repeat = PL_REPEATS.includes(pl.repeat) ? pl.repeat : 'all';
  return out;
};

/* capture the current project as one playlist item (keeps `id` when given) */
J.playlistSnapshot = (project, audio, id) => {
  const it = J.playlistBlankItem(id || J.playlistNewId());
  for (const k of PL_FIELDS) {
    if (k === 'audioKey') continue;   // set below: keep the known key, else derive it from the id
    if (project && project[k] !== undefined) it[k] = clone(project[k]);
  }
  if (audio && isFinite(+audio.duration) && audio.duration > 0) it.duration = +audio.duration.toFixed(3);
  const cur = project && J.playlistCurrentItem(project);
  it.audioKey = (cur && cur.id === it.id && cur.audioKey) ? cur.audioKey : 'song:' + it.id;
  return it;
};
/* write one item's song fields back into the live project (deep-cloned, so
   the item and the project never share a timing/overrides object) */
J.playlistApply = (project, item) => {
  if (!project || !item) return project;
  for (const k of PL_FIELDS) if (item[k] !== undefined) project[k] = clone(item[k]);
  return project;
};
J.playlistCurrentItem = (project) => {
  const pl = project && project.playlist;
  if (!pl || !Array.isArray(pl.items) || !pl.items.length) return null;
  return pl.items[Math.max(0, Math.min(pl.current || 0, pl.items.length - 1))] || null;
};
/* where continuous play goes after `fromIdx`: -1 means stop (last song, repeat off) */
J.playlistNextIndex = (pl, fromIdx) => {
  if (!pl || !Array.isArray(pl.items) || !pl.items.length) return -1;
  if (pl.repeat === 'one') return Math.max(0, Math.min(fromIdx, pl.items.length - 1));
  if (fromIdx + 1 < pl.items.length) return fromIdx + 1;
  if (pl.repeat === 'all') return 0;
  return -1;
};
/* move item from -> to (clamped); returns the new index of the moved item */
J.playlistMove = (items, from, to) => {
  if (!Array.isArray(items) || from < 0 || from >= items.length) return from;
  to = Math.max(0, Math.min(items.length - 1, to));
  if (from === to) return from;
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  return to;
};
J.playlistTotalDuration = (items) => {
  let s = 0;
  for (const it of items || []) if (it && isFinite(+it.duration)) s += +it.duration;
  return +s.toFixed(3);
};
/* list label: title, else audio file name, else a plain fallback (never empty) */
J.playlistItemTitle = (item, idx) => {
  if (!item) return '曲 ' + (idx + 1);
  const t = String(item.title || '').trim();
  if (t) return t;
  const a = String(item.audioName || '').trim();
  if (a) return a.replace(/\.[^.]+$/, '');
  return '曲 ' + (idx + 1);
};
})();
