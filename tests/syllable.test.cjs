// P5 v0.34.0 — syllable karaoke: word spans subdivided into syllable spans
// from the existing word times only (no model). Node-testable pure data;
// the browser proof (sweep pixels, export) is QA-043.
// Cross-realm note: vm values are compared with JSON.stringify, never
// deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

const sylText = (word, lang) => J.splitSyllables(word, lang).map(([a, b]) => [...word].slice(a, b).join(''));

// --- Vietnamese: one token = one syllable, unchanged ---
{
  eq(sylText('nhìn', 'vi'), ['nhìn'], 'vi: nhìn = 1 syllable');
  eq(sylText('giọt', 'vi'), ['giọt'], 'vi: giọt = 1 syllable');
  eq(sylText('nguyên', 'vi'), ['nguyên'], 'vi: nguyên = 1 syllable');
  const wt = [{ start: 1, end: 2, c0: 0, c1: 4 }];
  eq(J.expandSyllables(wt, 'nhìn', 'vi'), wt, 'vi: span unchanged');
}

// --- English multi-syllable splits ---
{
  eq(sylText('karaoke', 'en'), ['ka', 'ra', 'oke'], 'en: karaoke = ka-ra-oke (hiatus a-o splits; final e silent by rule — the loanword /ki/ ending needs a dictionary, not a rule)');
  eq(sylText('radio', 'en'), ['ra', 'di', 'o'], 'en: radio = ra-di-o (hiatus)');
  eq(sylText('beautiful', 'en'), ['beau', 'ti', 'ful'], 'en: beautiful = beau-ti-ful');
  eq(sylText('hello', 'en'), ['hel', 'lo'], 'en: hello = hel-lo (double consonant splits)');
  eq(sylText('make', 'en'), ['make'], 'en: make = 1 syllable (silent e)');
  eq(sylText('table', 'en'), ['ta', 'ble'], 'en: table = ta-ble (-le ending)');
  eq(sylText('happy', 'en'), ['hap', 'py'], 'en: happy = hap-py (y as vowel)');
  eq(sylText('yes', 'en'), ['yes'], 'en: yes = 1 syllable (initial y is a consonant)');
}

// --- proportional timing sums exactly to the word span ---
{
  const wt = [{ start: 10, end: 14, c0: 0, c1: 7 }];   // "karaoke", 4 s
  const out = J.expandSyllables(wt, 'karaoke', 'en');
  eq(out.length, 3, 'karaoke expands to 3 spans');
  eq(out[0].start, 10, 'first syllable starts at word start');
  eq(out[out.length - 1].end, 14, 'last syllable ends exactly at word end');
  for (let k = 0; k + 1 < out.length; k++) eq(out[k].end, out[k + 1].start, `syllable ${k} end == next start (no gap/overlap)`);
  // proportional to char length: ka(2) ra(2) oke(3) of 7 chars over 4 s
  eq(out[0].end, +(10 + 4 * 2 / 7).toFixed(3), 'ka ends at 2/7 of the word');
  eq(out[1].end, +(10 + 4 * 4 / 7).toFixed(3), 'ra ends at 4/7 of the word');
  eq(out.map(w => [w.c0, w.c1]), [[0, 2], [2, 4], [4, 7]], 'char ranges tile the word');
}

// --- Japanese: small kana joins the previous mora; other CJK unchanged ---
{
  const wt = [0, 1, 2].map(i => ({ start: i, end: i + 1, c0: i, c1: i + 1 }));
  const out = J.expandSyllables(wt, 'きゃく', 'ja');
  eq(out.length, 2, 'ja: きゃく = 2 morae');
  eq(out[0], { start: 0, end: 2, c0: 0, c1: 2 }, 'ja: きゃ merged span');
  eq(out[1], { start: 2, end: 3, c0: 2, c1: 3 }, 'ja: く span');
  const zh = [{ start: 0, end: 1, c0: 0, c1: 1 }, { start: 1, end: 2, c0: 1, c1: 2 }];
  eq(J.expandSyllables(zh, '你好', 'zh-Hans'), zh, 'zh: unchanged');
}

// --- edge cases: numbers, punctuation-bearing text, empty, single char ---
{
  eq(sylText('123', 'en'), ['123'], 'numbers = 1 syllable');
  eq(sylText('a', 'en'), ['a'], 'single char = 1 syllable');
  eq(sylText('', 'en'), [''], 'empty word = 1 empty range');
  eq(J.expandSyllables([], 'hello', 'en'), [], 'empty span list stays empty');
  eq(J.expandSyllables(null, 'hello', 'en'), null, 'null stays null');
  // punctuation lives outside tokens: spans index into the full text
  const text = 'hello, world';
  const wt = [{ start: 0, end: 1, c0: 0, c1: 5 }, { start: 1, end: 2, c0: 7, c1: 12 }];
  const out = J.expandSyllables(wt, text, 'en');
  eq(out.length, 3, 'hello, world -> hel-lo + world (3 spans)');
  eq(out[2].c0, 7, 'second word keeps its offset past the comma');
}

// --- toggle OFF = original wordTimes untouched (plan-level deep equal) ---
{
  const ELRC = '[00:17.17]<00:17.17>Nhìn <00:17.25>giọt <00:17.63>sương\n[00:24.04]<00:24.04>Nhìn <00:24.60>lại';
  const mk = (syl) => {
    const p = J.defaultProject();
    p.lyrics = ELRC; p.syllableKaraoke = syl;
    return J.plan(p, null);
  };
  const off = mk(false), on = mk(true);
  eq(off.syllableKaraoke, false, 'plan flag off');
  eq(on.syllableKaraoke, true, 'plan flag on');
  // Vietnamese: syllable == word, so ON spans equal OFF spans exactly
  const spans = plan => plan.cuts.filter(c => c.wordTimes).map(c => c.wordTimes);
  eq(spans(on), spans(off), 'vi real ELRC: ON spans == OFF spans (syllable == word)');
  // English mechanism line: OFF keeps word spans, ON subdivides
  const mkEn = (syl) => {
    const p = J.defaultProject();
    p.lyrics = '[00:01.00]<00:01.00>karaoke <00:03.00>beautiful <00:05.00>hello';
    p.lang = 'en'; p.syllableKaraoke = syl;
    return J.plan(p, null);
  };
  const offEn = mkEn(false), onEn = mkEn(true);
  const cutOff = offEn.cuts.find(c => c.wordTimes && c.wordTimes.length);
  const cutOn = onEn.cuts.find(c => c.wordTimes && c.wordTimes.length);
  assert.ok(cutOff && cutOn, 'en: cuts carry wordTimes in both modes');
  assert.ok(cutOn.wordTimes.length > cutOff.wordTimes.length, 'en: ON has more (syllable) spans than OFF');
  eq(cutOn.wordTimes[0].start, cutOff.wordTimes[0].start, 'en: first span start preserved');
  eq(cutOn.wordTimes[cutOn.wordTimes.length - 1].end, cutOff.wordTimes[cutOff.wordTimes.length - 1].end, 'en: last span end preserved');
}

console.log('syllable.test.cjs: all assertions passed');
