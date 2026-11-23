'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

const EDITIONS = [
  { code: 'vi', file: 'index.html', lang: 'vi' },
  { code: 'vi-sub', file: 'vi/index.html', lang: 'vi' },
  { code: 'en', file: 'en/index.html', lang: 'en' },
  { code: 'ja', file: 'ja/index.html', lang: 'ja' },
  { code: 'zh-Hans', file: 'zh-hans/index.html', lang: 'zh-Hans' },
  { code: 'zh-Hant', file: 'zh-hant/index.html', lang: 'zh-Hant' },
  { code: 'ko', file: 'ko/index.html', lang: 'ko' },
];

const RE_KANA = /[぀-ゟ゠-ヿ]/;
const RE_CJK = /[一-鿿]/;
const RE_HANGUL = /[가-힯]/;
const RE_VI = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

function isForeign(lang, text) {
  if (!text || !text.trim()) return null;
  if (lang === 'vi') {
    if (RE_KANA.test(text)) return 'kana';
    if (RE_CJK.test(text)) return 'cjk';
    if (RE_HANGUL.test(text)) return 'hangul';
  } else if (lang === 'en') {
    if (RE_KANA.test(text)) return 'kana';
    if (RE_CJK.test(text)) return 'cjk';
    if (RE_HANGUL.test(text)) return 'hangul';
    if (RE_VI.test(text)) return 'vi';
  } else if (lang === 'zh-Hans' || lang === 'zh-Hant') {
    if (RE_KANA.test(text)) return 'kana';
    if (RE_HANGUL.test(text)) return 'hangul';
    if (RE_VI.test(text)) return 'vi';
  } else if (lang === 'ko') {
    if (RE_KANA.test(text)) return 'kana';
    if (RE_VI.test(text)) return 'vi';
  } else if (lang === 'ja') {
    if (RE_HANGUL.test(text)) return 'hangul';
    if (RE_VI.test(text)) return 'vi';
  }
  return null;
}

function stripIntentionalExceptions(bodyHtml) {
  // Ngoại lệ cố ý 3: nhãn định dạng file "SSA・ASS" — dấu ・ ở đây là ký hiệu
  // trong tên định dạng phụ đề (SSA/ASS), không phải chữ tiếng Nhật trong UI.
  let s = bodyHtml.replace(/SSA・ASS/g, 'SSA/ASS');
  s = s.replace(/<label class="lang-switch">[\s\S]*?<\/label>/g, '');
  s = s.replace(/<select id="lyricLang">[\s\S]*?<\/select>/g, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  return s;
}

function scanHtml(lang, html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  assert(bodyMatch, 'Missing <body>');
  const clean = stripIntentionalExceptions(bodyMatch[1]);
  const hits = [];
  const attrRe = /\b(title|placeholder|aria-label)="([^"]*)"/g;
  let m;
  while ((m = attrRe.exec(clean)) !== null) {
    const kind = isForeign(lang, m[2]);
    if (kind) hits.push({ where: `@${m[1]}`, kind, text: m[2].slice(0, 80) });
  }
  const stripped = clean.replace(/<[^>]+>/g, '\n');
  for (const line of stripped.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const kind = isForeign(lang, t);
    if (kind) hits.push({ where: 'text', kind, text: t.slice(0, 80) });
  }
  return hits;
}

let failed = 0;

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
assert(!/\/id\//.test(sitemap), 'sitemap.xml vẫn còn đường dẫn /id/');
assert(!/hreflang="id-ID"/.test(sitemap), 'sitemap.xml vẫn còn hreflang="id-ID"');
console.log('PASS: sitemap.xml không còn bản id');

for (const ed of EDITIONS) {
  const p = path.join(ROOT, ed.file);
  assert(fs.existsSync(p), `Thiếu file build: ${ed.file}`);
  const html = fs.readFileSync(p, 'utf8');
  assert(!/hreflang="id-ID"/.test(html), `${ed.file} vẫn còn hreflang="id-ID"`);
  assert(!/Bahasa Indonesia/.test(html), `${ed.file} vẫn còn Bahasa Indonesia`);
  assert(html.includes(`<html lang="${ed.lang}">`), `${ed.file} sai <html lang>`);
  const hits = scanHtml(ed.lang, html);
  if (hits.length > 0) {
    failed++;
    console.error(`FAIL [${ed.code}] (${ed.file}): ${hits.length} chuỗi lạ:`);
    for (const h of hits.slice(0, 15)) console.error(`  - [${h.where}][${h.kind}] ${h.text}`);
  } else {
    console.log(`PASS [${ed.code}] (${ed.file}): 0 chuỗi lạ`);
  }
}

assert.strictEqual(failed, 0, `Có ${failed} bản build còn lẫn ngôn ngữ`);
console.log('ALL QA-046 i18n CHECKS PASSED');
