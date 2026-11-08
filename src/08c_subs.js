/* ============================================================
   AURA — subtitle import: SRT / WebVTT / SSA-ASS → standard LRC
   At import time each cue becomes one LRC line ([mm:ss.xx]text);
   per-word times (\k in ASS, timestamp tags in VTT) become inline
   <mm:ss.xx> tags, so they flow through the Enhanced LRC path that
   loadLrc / computeTiming / karaoke already know (v0.13.0).
   No planner / render / export / undo change; no new project field.
   Cue End is not kept (the planner derives line ends itself);
   ASS style / position is ignored (the app has its own styles).
   ============================================================ */
'use strict';
(function () {
  const J = window.J;

  const r3 = v => Math.round(v * 1000) / 1000;

  /* --- time helpers --- */
  // SRT/VTT clock: [HH:]MM:SS[.mmm|,mmm] — hours optional, 1-2 digits
  function parseClock(s) {
    const m = String(s || '').trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
    if (!m) return null;
    return (m[1] ? +m[1] : 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? +('0.' + m[4]) : 0);
  }
  // ASS clock: H:MM:SS.cc (centiseconds; lenient 1-3 decimals)
  function parseAssClock(s) {
    const m = String(s || '').trim().match(/^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!m) return null;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? +('0.' + m[4]) : 0);
  }
  // seconds → [mm:ss.xx] (LRC line tag, centiseconds)
  function lrcStamp(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return '[' + String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0') + ']';
  }
  // seconds → <mm:ss.xx> (Enhanced LRC word tag)
  function wordTag(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return '<' + String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0') + '>';
  }

  /* --- text helpers --- */
  const normText = s => String(s || '').replace(/\s+/g, ' ').trim();
  // strip HTML-ish tags <...> but keep the inner text; only tags matching a valid
  // tag name are stripped, so a literal '<' in the lyrics (e.g. 'a < b') survives
  const stripHtml = s => String(s || '').replace(/<\/?[A-Za-z][^<>]*>/g, '');

  // a cue's timed words, derived from its segments (end = next word's start, last = cue end).
  // Segment text keeps its edge spaces (they are the word separators in the line);
  // the word list trims them, and whitespace-only segments are not words.
  function cueWords(segs, end) {
    const words = [];
    const timed = segs.filter(s => s.t != null && s.text.trim());
    timed.forEach((s, k) => {
      const e = k + 1 < timed.length ? timed[k + 1].t : end;
      words.push({ text: s.text.trim(), start: s.t, end: Math.max(s.t, e) });
    });
    return words;
  }
  function finishCue(start, end, segs) {
    return { start, end, segs, text: segs.map(s => s.text).join(''), words: cueWords(segs, end) };
  }

  // split one karaoke syllable into timed token segments, keeping the punctuation
  // between tokens as untimed text (so 'grace,' never loses its comma)
  function tokenizeSegs(text, start, dur, lang) {
    const toks = (J.wordTokens ? J.wordTokens(text, lang) : null) || [];
    if (!toks.length) return [{ t: null, text }];
    const cps = [...text], out = [], n = toks.length, span = dur / n;
    let pos = 0;
    toks.forEach((tk, i) => {
      if (tk.start > pos) out.push({ t: null, text: cps.slice(pos, tk.start).join('') });
      out.push({ t: r3(start + i * span), text: tk.text });
      pos = tk.end;
    });
    if (pos < cps.length) out.push({ t: null, text: cps.slice(pos).join('') });
    return out;
  }

  /* ---------------- format detection (sniff content; extension is only a hint) ---------------- */
  J.detectSubsFormat = (text) => {
    const t = String(text || '').replace(/^\ufeff/, '');
    const head = t.replace(/^\s+/, '');
    if (/^WEBVTT(\s|$)/.test(head)) return 'vtt';
    if (/\[Script Info\]/i.test(t) && (/\[Events\]/i.test(t) || /\[V4\+ Styles\]/i.test(t) || /\[V4 Styles\]/i.test(t))) return 'ass';
    if (/-->/.test(t)) {
      if (/\d{1,2}:\d{2}:\d{2},\d/.test(t)) return 'srt';
      if (/\d{1,2}:\d{2}:\d{2}\.\d/.test(t) || /\d{1,2}:\d{2}\.\d{1,3}\s*-->/.test(t)) return 'vtt';
    }
    if (/^\[\d+:\d{1,2}/m.test(t)) return 'lrc';
    return 'txt';
  };

  /* ---------------- SRT ---------------- */
  function parseSrt(text) {
    const cues = []; let skipped = 0; const warnings = [];
    const blocks = String(text).replace(/\r\n?/g, '\n').split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      // the timestamp line is found anywhere in the block (lines before it are the
      // sequence number or junk); a block with no timestamp line is not a cue
      let ti = -1, tm = null;
      for (let k = 0; k < lines.length; k++) {
        tm = lines[k].match(/^(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3})/);
        if (tm) { ti = k; break; }
      }
      if (ti < 0) continue;
      const start = parseClock(tm[1]), end = parseClock(tm[2]);
      const body = lines.slice(ti + 1).map(l => normText(stripHtml(l))).filter(Boolean);
      const joined = body.join(' / ');
      if (start == null || end == null || end <= start || !joined) { skipped++; continue; }
      cues.push(finishCue(r3(Math.max(0, start)), r3(end), [{ t: null, text: joined }]));
    }
    return { format: 'srt', cues, skipped, warnings, title: null };
  }

  /* ---------------- WebVTT ---------------- */
  // timestamp tags inside cue text (<MM:SS.mmm> / <HH:MM:SS.mmm>) become word times;
  // other tags (<v Name>, <c.cls>, <b>…) are stripped, their text kept
  function vttLineSegs(ln) {
    const out = [];
    const re = /<((?:\d{1,2}:)?\d{1,2}:\d{1,2}(?:\.\d{1,3})?)>/g;
    let pos = 0, m, pending = null;
    const pushText = (t, raw) => {
      // collapse whitespace runs but keep the edge spaces: they are the word
      // separators between segments (trimming here would glue 'Hello' + 'brave'
      // into 'Hellobrave' in the line text, and parseLyrics would tokenize it
      // as one word — the timed words would never match)
      const clean = stripHtml(raw).replace(/\s+/g, ' ');
      if (clean) out.push({ t, text: clean });
    };
    while ((m = re.exec(ln))) {
      pushText(pending, ln.slice(pos, m.index));
      pending = parseClock(m[1]);
      pos = m.index + m[0].length;
    }
    pushText(pending, ln.slice(pos));
    return out;
  }
  function parseVtt(text) {
    const cues = []; let skipped = 0; const warnings = [];
    const rows = String(text).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < rows.length && !rows[i].trim()) i++;
    if (i < rows.length && /^WEBVTT(\s|$)/.test(rows[i].trim())) {
      i++;
      while (i < rows.length && rows[i].trim()) i++;   // header block (NOTE / STYLE / REGION…)
    } else {
      warnings.push('WEBVTT ヘッダーがありません');
    }
    let block = [];
    const flushBlock = () => {
      const b = block; block = [];
      if (!b.length) return;
      const first = b[0].trim();
      if (/^(NOTE|STYLE|REGION)(\s|$)/i.test(first)) return;   // NOTE / STYLE / REGION block anywhere
      let ti = -1;
      for (let k = 0; k < b.length; k++) {
        if (/^(?:\d{1,2}:)?\d{1,2}:\d{1,2}\.\d{1,3}\s*-->/.test(b[k].trim())) { ti = k; break; }
      }
      if (ti < 0) return;   // no timestamp line — not a cue (ID-only junk, ignored)
      const tm = b[ti].trim().match(/^((?:\d{1,2}:)?\d{1,2}:\d{1,2}\.\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}\.\d{1,3})/);
      if (!tm) { skipped++; return; }
      const start = parseClock(tm[1]), end = parseClock(tm[2]);
      const segs = [];
      b.slice(ti + 1).forEach((ln, li) => {
        if (li > 0) segs.push({ t: null, text: ' / ' });
        segs.push(...vttLineSegs(ln));
      });
      const joined = segs.map(s => s.text).join('');
      if (start == null || end == null || end <= start || !normText(joined)) { skipped++; return; }
      cues.push(finishCue(r3(Math.max(0, start)), r3(end), segs));
    };
    for (; i <= rows.length; i++) {
      const line = i < rows.length ? rows[i] : '';
      if (!line.trim()) { flushBlock(); continue; }
      block.push(line);
    }
    return { format: 'vtt', cues, skipped, warnings, title: null };
  }

  /* ---------------- SSA / ASS ---------------- */
  const ASS_COLS = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  // split a Dialogue line into fields: commas inside {...} override groups
  // ({\pos(100,200)}, {\move(...)}, {\fad(200,300)}…) do NOT split; if there are
  // more parts than columns, the rest belongs to the last column (Text may hold commas)
  function splitAssFields(s, n) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of String(s)) {
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
      else cur += ch;
    }
    parts.push(cur);
    if (parts.length <= n) return parts.map(p => p.trim());
    const head = parts.slice(0, n - 1).map(p => p.trim());
    head.push(parts.slice(n - 1).join(',').trim());
    return head;
  }
  // one Dialogue's text → timed segments. \k / \K / \kf (centiseconds) mark the
  // syllables; every other {...} override is stripped. {\p1}…{\p0} drawing
  // segments are dropped whole. Text before the first \k tag is untimed.
  function parseAssText(raw, cueStart, lang) {
    const segs = [];
    let cum = 0, cur = null, drawing = false;
    const flush = () => {
      if (!cur) return;
      const c = cur; cur = null;
      if (!c.text) return;
      if (!c.tagged) { segs.push({ t: null, text: c.text }); return; }
      segs.push(...tokenizeSegs(c.text, cueStart + c.start, c.dur, lang));
    };
    let i = 0; const n = raw.length;
    while (i < n) {
      if (raw[i] === '{') {
        const j = raw.indexOf('}', i);
        const group = j < 0 ? raw.slice(i + 1) : raw.slice(i + 1, j);
        i = j < 0 ? n : j + 1;
        const pm = group.match(/\\p(\d+)/);
        if (pm) {
          if (+pm[1] !== 0) { flush(); drawing = true; }
          else drawing = false;
          continue;
        }
        if (drawing) continue;
        const km = group.match(/\\[kK]f?(\d+)/);
        if (km) {
          flush();
          const dur = +km[1] / 100;
          cur = { start: cum, dur, text: '', tagged: true };
          cum += dur;
        }
        continue;   // any other override group: stripped
      }
      let j = raw.indexOf('{', i);
      if (j < 0) j = n;
      let run = raw.slice(i, j);
      i = j;
      run = run.replace(/\\[Nn]/g, ' / ').replace(/\\h/g, ' ');
      if (drawing) continue;
      if (!cur) cur = { start: cum, dur: 0, text: '', tagged: false };
      cur.text += run;
    }
    flush();
    return segs;
  }
  function parseAss(text, lang) {
    const cues = []; let skipped = 0; const warnings = []; let title = null;
    const rows = String(text).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').split('\n');
    let section = '', fmt = null;
    const events = [];
    for (const raw of rows) {
      const line = raw.trim();
      if (!line) continue;
      const sec = line.match(/^\[(.+)\]$/);
      if (sec) { section = sec[1].trim().toLowerCase(); continue; }
      if (section === 'script info') {
        const tm = line.match(/^Title:\s*(.+)$/i);
        if (tm && title == null) title = tm[1].trim();
        continue;
      }
      if (section === 'events') {
        if (/^Format:/i.test(line)) { fmt = line.slice(7).split(',').map(s => s.trim().toLowerCase()); continue; }
        if (/^Dialogue:/i.test(line)) events.push(line.slice(9));
        continue;
      }
    }
    const cols = fmt && fmt.length ? fmt : ASS_COLS.map(c => c.toLowerCase());
    if (!fmt) warnings.push('Format: 行がありません — 標準の列順序を使いました');
    const iStart = cols.indexOf('start'), iEnd = cols.indexOf('end'), iText = cols.indexOf('text');
    if (iStart < 0 || iEnd < 0 || iText < 0) {
      warnings.push('Format: に Start / End / Text がありません');
      return { format: 'ass', cues, skipped: events.length, warnings, title };
    }
    for (const ev of events) {
      const f = splitAssFields(ev, cols.length);
      const start = parseAssClock(f[iStart]), end = parseAssClock(f[iEnd]);
      const rawText = f.length > iText ? f[iText] : '';
      if (start == null || end == null || end <= start) { skipped++; continue; }
      const segs = parseAssText(rawText || '', start, lang);
      if (!normText(segs.map(s => s.text).join(''))) { skipped++; continue; }
      cues.push(finishCue(r3(Math.max(0, start)), r3(end), segs));
    }
    // duet lines: two Dialogues at (nearly) the same time, overlapping → one line
    cues.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const c of cues) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(c.start - last.start) < 0.05 && c.start < last.end) {
        last.segs.push({ t: null, text: ' / ' }, ...c.segs);
        last.end = Math.max(last.end, c.end);
        last.text = last.segs.map(s => s.text).join('');
        last.words = cueWords(last.segs, last.end);
      } else merged.push(c);
    }
    return { format: 'ass', cues: merged, skipped, warnings, title };
  }

  /* ---------------- public API ---------------- */
  J.parseSubs = (text, lang) => {
    const clean = String(text || '').replace(/^\ufeff/, '');
    const format = J.detectSubsFormat(clean);
    if (format === 'srt') return parseSrt(clean);
    if (format === 'vtt') return parseVtt(clean);
    if (format === 'ass') return parseAss(clean, lang || 'vi');
    return { format, cues: [], skipped: 0, warnings: [], title: null };
  };
  // cues → standard LRC text ([mm:ss.xx] per line, <mm:ss.xx> per word)
  J.subsToLrc = (parsed) => {
    const out = [];
    if (parsed.title) out.push('[ti:' + String(parsed.title).replace(/[\r\n\]]/g, '') + ']');
    (parsed.cues || []).forEach(c => {
      let line = lrcStamp(c.start);
      c.segs.forEach(s => { if (s.t != null) line += wordTag(s.t); line += s.text; });
      out.push(line);
    });
    return out.join('\n');
  };
})();
