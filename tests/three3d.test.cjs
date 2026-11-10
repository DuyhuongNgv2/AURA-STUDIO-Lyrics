// P1 v0.19.0 — 3D text: defaults, registration, 2D/3D branching, planner weighting.
// Node-testable only (no DOM/WebGL): the 3D host is verified in the browser QA.
// Cross-realm note: vm values are compared with JSON.stringify, never deepStrictEqual.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const eq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { documentElement: { lang: 'vi' }, createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 100 }) }) }) }, console, Intl, URL, Map, Set, TextEncoder, TextDecoder, performance: { now: () => 0 } });
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
const J = context.window.J;

// --- fx defaults (v0.19.0): 3D off, plane mode, no shadow ---
{
  const fx = J.defaultProject().fx;
  assert.equal(fx.threeD, false, 'threeD defaults OFF');
  assert.equal(fx.threeDepth, 0.7, 'threeDepth defaults 0.7');
  assert.equal(fx.threeMode, 'plane', 'threeMode defaults plane');
  assert.equal(fx.threeShadow, false, 'threeShadow defaults OFF');
  assert.equal(fx.threeMetal, 0.15, 'threeMetal defaults 0.15');
}

// --- the 5 new effects are registered ---
{
  assert.ok(J.ENTER.textFlip3d, 'textFlip3d registered (enter)');
  assert.ok(J.HOLD.spin3d, 'spin3d registered (hold)');
  assert.ok(J.CAMERA.dolly3d, 'dolly3d registered (cam)');
  assert.ok(J.CAMERA.orbit3d, 'orbit3d registered (cam)');
  assert.ok(J.TREAT.khoi3d, 'khoi3d registered (treat)');
  assert.equal(J.ENTER.textFlip3d.name, '3Dフリップ');
  assert.equal(J.HOLD.spin3d.name, '3Dスピン');
  assert.equal(J.CAMERA.dolly3d.name, 'ドリー');
  assert.equal(J.CAMERA.orbit3d.name, 'オービット');
  assert.equal(J.TREAT.khoi3d.name, '立体ブロック');
  // the bg-mode flip3d (user image) is untouched — different key, no collision
  assert.ok(J.ENTER.textFlip3d !== J.ENTER.flipX, 'textFlip3d is not flipX');
}

// --- 3D host exists, starts unready, load() fails honestly without vendored source ---
{
  assert.ok(J.text3d, 'J.text3d singleton exists');
  assert.equal(J.text3d.ready, false, 'not ready before load');
  assert.equal(typeof J.text3d.load, 'function');
  assert.equal(typeof J.text3d.drawMain, 'function');
  assert.equal(typeof J.text3d.dispose, 'function');
}

// --- effect branching: 2D fallback when 3D is off or not ready ---
const mockEnv = (over = {}) => Object.assign({
  pass: 'main', glyphLog: null, hideText: false,
  fx: { threeD: false, threeDepth: 0.7, motion: 0.7, beatSync: false },
  sc: { bg: '#111111', fg: '#ffffff', accent: '#ff00ff', accent2: '#00ffff' },
  cut: { dur: 2, inDur: 0.5, outDur: 0.3, seed: 1 }, lt: 0.5,
}, over);
const mockIt = (over = {}) => Object.assign({
  text: 'Sương', font: 'gothic_bold', size: 100, x: 640, y: 360, color: '#ffffff',
}, over);
{
  // textFlip3d, 3D off -> 2D charFn installed, no 3D descriptor
  const it = mockIt();
  J.ENTER.textFlip3d.apply(mockEnv(), it, 0.5);
  assert.ok(it.charFns && it.charFns.length === 1, '2D flip installs a charFn');
  assert.equal(it._t3d, undefined, '2D flip sets no 3D descriptor');
  // spin3d, 3D off -> 2D charFn installed
  const it2 = mockIt();
  J.HOLD.spin3d.apply(mockEnv(), it2, 1);
  assert.ok(it2.charFns && it2.charFns.length === 1, '2D spin installs a charFn');
  assert.equal(it2._t3d, undefined, '2D spin sets no 3D descriptor');
  // dolly3d / orbit3d, 3D off -> 2D camera approximations (scale / rot)
  assert.ok(J.CAMERA.dolly3d.get(mockEnv()).s > 1, '2D dolly scales up');
  assert.ok(J.CAMERA.orbit3d.get(mockEnv()).rot !== 0 || J.CAMERA.orbit3d.get(mockEnv()).s === 1, '2D orbit returns a 2D transform');
}

// --- effect branching: 3D on + host ready -> descriptor only, no 2D charFn ---
{
  J.text3d.ready = true;   // simulate the loaded host (WebGL itself is browser QA)
  try {
    const env3 = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false } });
    const it = mockIt();
    J.ENTER.textFlip3d.apply(env3, it, 0.5);
    assert.equal(it.charFns, undefined, '3D flip installs no 2D charFn');
    assert.ok(typeof it._t3d.rotY === 'number', `3D flip rotY ${it._t3d.rotY}`);
    // endpoints: p=0 -> facing away (PI), p=1 -> facing the viewer (0);
    // mid-flight the outBack ease overshoots slightly past 0 (a natural bounce)
    const itA = mockIt(); J.ENTER.textFlip3d.apply(env3, itA, 0);
    assert.ok(Math.abs(itA._t3d.rotY - Math.PI) < 1e-9, `flip start rotY ${itA._t3d.rotY}`);
    const itB = mockIt(); J.ENTER.textFlip3d.apply(env3, itB, 1);
    assert.ok(Math.abs(itB._t3d.rotY) < 1e-9, `flip end rotY ${itB._t3d.rotY}`);
    // whole-line card flip (QA-021): two items of one cut share ONE rotY from
    // the CUT's progress. Item A (delay 0, lt 0.25) and item B (delay 0.25,
    // lt 0) are both at cut time 0.25 of inDur 0.5 -> pCut 0.5 -> same rotY,
    // even though B's item-staggered progress is 0.
    const envA = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false }, lt: 0.25 });
    const itA2 = mockIt({ delay: 0 });
    J.ENTER.textFlip3d.apply(envA, itA2, 0.5, { inDur: 0.5 });
    const envB2 = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false }, lt: 0 });
    const itB2 = mockIt({ delay: 0.25 });
    J.ENTER.textFlip3d.apply(envB2, itB2, 0, { inDur: 0.5 });
    assert.ok(Math.abs(itA2._t3d.rotY - itB2._t3d.rotY) < 1e-9, `flip cut-progress rotY A ${itA2._t3d.rotY} vs B ${itB2._t3d.rotY}`);
    assert.ok(itB2._t3d.rotY < Math.PI, 'flip B is mid-flip, not facing away');
    const it2 = mockIt();
    J.HOLD.spin3d.apply(env3, it2, 1);
    assert.equal(it2.charFns, undefined, '3D spin installs no 2D charFn');
    assert.ok(typeof it2._t3d.rotY === 'number', '3D spin sets rotY');
    // cameras stash 3D params on env and return an identity 2D transform
    const envD = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false } });
    assert.equal(J.CAMERA.dolly3d.get(envD).s, 1, '3D dolly leaves the 2D camera alone');
    assert.ok(typeof envD._t3dCam.dolly === 'number' && envD._t3dCam.dolly > 0, '3D dolly stashed');
    const envO = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false } });
    assert.equal(J.CAMERA.orbit3d.get(envO).s, 1, '3D orbit leaves the 2D camera alone');
    assert.ok(typeof envO._t3dCam.orbit === 'number', '3D orbit stashed');
    // ghost pass always takes the 2D path even when 3D is on
    const envG = mockEnv({ pass: 'B', fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false } });
    const itG = mockIt();
    J.ENTER.textFlip3d.apply(envG, itG, 0.5);
    assert.ok(itG.charFns && itG.charFns.length === 1, 'ghost pass uses the 2D flip');
    assert.equal(itG._t3d, undefined, 'ghost pass sets no 3D descriptor');
  } finally { J.text3d.ready = false; }
}

// --- khoi3d sets an extrude with a front->back shade ramp (L1 block look) ---
{
  const it = mockIt();
  J.TREAT.khoi3d.apply(mockEnv(), it, { d: 0.07, dir: [1, 1] });
  assert.ok(it.extrude, 'khoi3d sets extrude');
  assert.ok(it.extrude.n >= 4, `extrude layers ${it.extrude.n}`);
  eq(it.extrude.shade.length, 2, 'shade ramp has 2 stops');
  assert.ok(/^#[0-9a-f]{6}$/i.test(it.extrude.shade[0]) && /^#[0-9a-f]{6}$/i.test(it.extrude.shade[1]), 'shade stops are hex colours');
  // the shade ramp darkens toward the back
  assert.ok(J.lum(it.extrude.shade[1]) <= J.lum(it.extrude.shade[0]), 'back shade is darker than front shade');
}

// --- M2: 3D font subsets are valid typeface.json (Vietnamese + Latin) ---
{
  const vi = 'àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ'
    + 'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ';
  for (const stem of ['BeVietnamPro-Regular-vi-subset', 'BeVietnamPro-Bold-vi-subset']) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'fonts/3d', stem + '.json'), 'utf8'));
    const glyphs = data.glyphs;
    assert.ok(glyphs && Object.keys(glyphs).length > 200, `${stem}: ${Object.keys(glyphs).length} glyphs`);
    const missing = [...vi].filter(c => !glyphs[c]);
    assert.equal(missing.length, 0, `${stem}: missing Vietnamese chars ${missing.join('')}`);
    assert.ok(glyphs[' '] && glyphs[' '].ha > 0, `${stem}: space glyph with advance`);
    for (const [ch, g] of Object.entries(glyphs)) {
      assert.ok(g.ha > 0, `${stem}: glyph ${ch} ha ${g.ha}`);
      if (ch !== ' ' && ch !== ' ') assert.ok(typeof g.o === 'string' && g.o.length > 0, `${stem}: glyph ${ch} has an outline`);
    }
    assert.equal(data.resolution, 1000, `${stem}: resolution 1000`);
    assert.ok(data.ascender > 0 && data.descender < 0, `${stem}: ascender/descender`);
  }
}

// --- M2: word splitting (wordTimes first, whitespace fallback) ---
{
  const envW = mockEnv({
    fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false },
    cut: { dur: 2, inDur: 0.5, outDur: 0.3, seed: 1, text: 'Nhìn giọt sương',
      wordTimes: [
        { start: 0, end: 0.5, c0: 0, c1: 4 },   // Nhìn
        { start: 0.5, end: 1, c0: 5, c1: 9 },   // giọt
        { start: 1, end: 1.5, c0: 10, c1: 15 }, // sương
      ] },
  });
  const itW = mockIt({ text: 'Nhìn giọt sương', font: 'gothic_bold', size: 100, x: 960, y: 540 });
  const words = J.text3d.words(envW, itW);
  assert.equal(words.length, 3, `words split into 3, got ${words.length}`);
  eq(words.map(w => w.text), ['Nhìn', 'giọt', 'sương'], 'word texts');
  assert.ok(words.every(w => w.w > 0 && w.h > 0), 'every word has a positive bbox');
  assert.ok(words[0].x < words[1].x && words[1].x < words[2].x, 'words are left-to-right');
  assert.equal(words[0].start, 0, 'first word start time');
  assert.equal(words[2].end, 1.5, 'last word end time');
  // whitespace fallback (no wordTimes)
  const envF = mockEnv({ fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false }, cut: { dur: 2, inDur: 0.5, outDur: 0.3, seed: 1, text: 'Nhìn giọt sương' } });
  const itF = mockIt({ text: 'Nhìn giọt sương', font: 'gothic_bold', size: 100, x: 960, y: 540 });
  const wordsF = J.text3d.words(envF, itF);
  assert.equal(wordsF.length, 3, `whitespace fallback splits into 3, got ${wordsF.length}`);
  eq(wordsF.map(w => w.text), ['Nhìn', 'giọt', 'sương'], 'fallback word texts');
  assert.equal(wordsF[0].start, null, 'fallback words have no time span');
}

// --- M2: word splitting for SUBSTRING items (per-word / per-char layouts) ---
// A layout may draw a single word or character as its own item; words() must
// still resolve the word's time span from the cut's wordTimes (locate the
// item text inside the cut text) so per-word karaoke sweeps. Before this fix
// only full-text items got times and substring items always rendered lit.
{
  const cutText = 'Cùng đàn ngăn vang khúc';
  const envS = mockEnv({
    fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false },
    cut: { dur: 3, inDur: 0.5, outDur: 0.3, seed: 1, text: cutText,
      wordTimes: [
        { start: 0, end: 0.5, c0: 0, c1: 4 },    // Cùng
        { start: 0.5, end: 1, c0: 5, c1: 8 },    // đàn
        { start: 1, end: 1.5, c0: 9, c1: 13 },   // ngăn
        { start: 1.5, end: 2, c0: 14, c1: 18 },  // vang
        { start: 2, end: 2.5, c0: 19, c1: 23 },  // khúc
      ] },
  });
  const wDan = J.text3d.words(envS, mockIt({ text: 'đàn', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wDan.length, 1, `substring word 'đàn' -> 1 word, got ${wDan.length}`);
  eq(wDan.map(w => w.text), ['đàn'], "substring word text");
  assert.equal(wDan[0].start, 0.5, "substring word 'đàn' start time");
  assert.equal(wDan[0].end, 1, "substring word 'đàn' end time");
  const wNgan = J.text3d.words(envS, mockIt({ text: 'ngăn', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wNgan.length, 1, `substring word 'ngăn' -> 1 word`);
  assert.equal(wNgan[0].start, 1, "substring word 'ngăn' start time");
  const wChar = J.text3d.words(envS, mockIt({ text: 'ă', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wChar.length, 1, `single char 'ă' -> 1 word`);
  assert.equal(wChar[0].start, 1, "single char 'ă' inherits the 'ngăn' word span");
  assert.equal(wChar[0].end, 1.5, "single char 'ă' end time");
  const wTwo = J.text3d.words(envS, mockIt({ text: 'Cùng đàn', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wTwo.length, 2, `two-word substring -> 2 words, got ${wTwo.length}`);
  eq(wTwo.map(w => w.text), ['Cùng', 'đàn'], 'two-word substring texts');
  assert.equal(wTwo[0].start, 0, "first word of substring start");
  assert.equal(wTwo[1].end, 1, "second word of substring end");
  // repeated word: 'đàn' occurs twice — the occurrence is picked by time,
  // not by first match, so each item gets its own word's span
  const envR = mockEnv({
    t: 1.7,
    fx: { threeD: true, threeDepth: 0.7, motion: 0.7, beatSync: false },
    cut: { dur: 3, inDur: 0.5, outDur: 0.3, seed: 1, start: 0, text: 'phím đàn, Cùng đàn ngăn',
      wordTimes: [
        { start: 0, end: 0.5, c0: 0, c1: 4 },    // phím
        { start: 0.5, end: 1, c0: 5, c1: 8 },    // đàn (1st)
        { start: 1, end: 1.5, c0: 10, c1: 14 },  // Cùng
        { start: 1.5, end: 2, c0: 15, c1: 18 },  // đàn (2nd)
        { start: 2, end: 2.5, c0: 19, c1: 23 },  // ngăn
      ] },
  });
  const wDan2 = J.text3d.words(envR, mockIt({ text: 'đàn', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wDan2.length, 1, `repeated 'đàn' at t=1.7 -> 1 word`);
  assert.equal(wDan2[0].start, 1.5, "repeated 'đàn' at t=1.7 takes the 2nd occurrence (start 1.5)");
  assert.equal(wDan2[0].end, 2, "repeated 'đàn' at t=1.7 end time");
  const envR1 = mockEnv({ t: 0.7, fx: envR.fx, cut: envR.cut });
  const wDan1 = J.text3d.words(envR1, mockIt({ text: 'đàn', font: 'gothic_bold', size: 100, x: 960, y: 540 }));
  assert.equal(wDan1[0].start, 0.5, "repeated 'đàn' at t=0.7 takes the 1st occurrence (start 0.5)");
}

// --- M2: block font selection (Be Vietnam Pro 400/700 only) ---
{
  // the vm defaults to J.lang 'ja'; the app sets it from the plan language
  if (J.setLang) J.setLang('vi');
  assert.equal(J.lang, 'vi', 'test language is vi');
  const faceBold = J.faceOf ? J.faceOf('gothic_bold') : null;
  assert.ok(faceBold, 'faceOf resolves gothic_bold');
  assert.equal(String(faceBold.family).replace(/^["']|["']$/g, ''), 'Be Vietnam Pro', `gothic_bold family ${faceBold && faceBold.family}`);
  assert.equal(J.text3d._blockFontFor({ font: 'gothic_bold' }), 'bold', 'gothic_bold (700) -> bold subset');
  assert.equal(J.text3d._blockFontFor({ font: 'vi_be_regular' }), 'regular', 'vi_be_regular (400) -> regular subset');
  assert.equal(J.text3d._blockFontFor({ font: 'vi_be_bold' }), 'bold', 'vi_be_bold (700) -> bold subset');
  assert.equal(J.text3d._blockFontFor({ font: 'vi_be_black' }), null, 'vi_be_black (900) -> plane (not subset)');
  assert.equal(J.text3d._blockFontFor({ font: 'mincho' }), null, 'non-BeVietnamPro font -> plane');
}

// --- M2: block eligibility (subset font + glyph coverage + no per-glyph effects) ---
{
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'fonts/3d/BeVietnamPro-Regular-vi-subset.json'), 'utf8'));
  const bold = JSON.parse(fs.readFileSync(path.join(root, 'fonts/3d/BeVietnamPro-Bold-vi-subset.json'), 'utf8'));
  J.text3d._fonts = { regular: { data: reg }, bold: { data: bold } };
  try {
    const envB = mockEnv({ fx: { threeD: true, threeDepth: 0.7, threeMode: 'block', motion: 0.7, beatSync: false }, cut: { dur: 2, inDur: 0.5, outDur: 0.3, seed: 1, text: 'Nhìn giọt sương' } });
    assert.equal(J.text3d._blockEligible(envB, mockIt({ text: 'Nhìn giọt sương', font: 'gothic_bold' })), true, 'Vietnamese BeVietnamPro Bold is eligible');
    assert.equal(J.text3d._blockEligible(envB, mockIt({ text: 'Nhìn giọt sương', font: 'vi_be_regular' })), true, 'Vietnamese BeVietnamPro Regular is eligible');
    assert.equal(J.text3d._blockEligible(envB, mockIt({ text: 'あいうえお', font: 'gothic_bold' })), false, 'Japanese text is not eligible (missing glyphs)');
    assert.equal(J.text3d._blockEligible(envB, mockIt({ text: 'Nhìn giọt sương', font: 'mincho' })), false, 'non-subset font is not eligible');
    assert.equal(J.text3d._blockEligible(envB, mockIt({ text: 'Hello 😀', font: 'gothic_bold' })), false, 'emoji is not eligible (missing glyph)');
    const itP = mockIt({ text: 'Nhìn giọt sương', font: 'gothic_bold' }); itP.pieceFns = [() => {}];
    assert.equal(J.text3d._blockEligible(envB, itP), false, 'pieceFn effect forces the plane');
    const itV = mockIt({ text: 'Nhìn giọt sương', font: 'gothic_bold' }); itV.vertical = true;
    assert.equal(J.text3d._blockEligible(envB, itV), false, 'vertical text forces the plane');
  } finally { J.text3d._fonts = null; }
}

// --- M2: textFlip3d stores the cut progress (flipP) for the per-word block flip ---
{
  J.text3d.ready = true;
  try {
    const env3 = mockEnv({ fx: { threeD: true, threeDepth: 0.7, threeMode: 'block', motion: 0.7, beatSync: false }, lt: 0.25 });
    const it = mockIt({ delay: 0 });
    J.ENTER.textFlip3d.apply(env3, it, 0.5, { inDur: 0.5 });
    assert.ok(typeof it._t3d.flipP === 'number', `flipP stored ${it._t3d.flipP}`);
    assert.ok(Math.abs(it._t3d.flipP - 0.5) < 1e-9, `flipP is the cut progress ${it._t3d.flipP}`);
  } finally { J.text3d.ready = false; }
}

// --- seam exists: mainDraw delegates to mainDraw2D when 3D is off ---
assert.equal(typeof J.mainDraw, 'function');
assert.equal(typeof J.mainDraw2D, 'function');

console.log(JSON.stringify({ status: 'PASS', threeDefaults: 'PASS', effectsRegistered: 5, branching2D3D: 'PASS', khoi3dShade: 'PASS', seam: 'PASS', fonts3d: 'PASS', words: 'PASS', blockFont: 'PASS', blockEligible: 'PASS', flipP: 'PASS' }, null, 2));
