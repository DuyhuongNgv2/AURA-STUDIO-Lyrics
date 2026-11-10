// TTF -> three.js typeface.json converter (production, P1 v0.19.0 M2).
// Based on the experiment converter (research_notes/aura-3d-text-p1/evidence/
// ttf2typeface.mjs) which was verified with FontLoader + a real visual check:
// TextGeometry('Sương') built in ~85ms and rendered correctly with Vietnamese
// diacritics. The Y-flip below (negating every y) is REQUIRED — typeface.json
// outlines are Y-up while TTF outlines are Y-down; without it the text
// renders upside down. Do not "fix" the negation.
// Usage: node tools/ttf2typeface.mjs <input.ttf> <output.json>
// Requires opentype.js (npm install in tools/).
import opentype from 'opentype.js';
import fs from 'fs';
const [,, inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('usage: node ttf2typeface.mjs <input.ttf> <output.json>'); process.exit(2); }
const font = opentype.parse(fs.readFileSync(inFile));
const glyphs = {};
let count = 0;
const list = []; for (let i = 0; i < font.glyphs.length; i++) list.push(font.glyphs.get(i));
for (const g of list) {
  if (!g.unicode || g.unicode < 32) continue;
  const ch = String.fromCodePoint(g.unicode);
  const path = g.getPath(0, 0, font.unitsPerEm);
  let o = '';
  for (const cmd of path.commands) {
    if (cmd.type === 'M') o += `m ${cmd.x} ${-cmd.y} `;
    else if (cmd.type === 'L') o += `l ${cmd.x} ${-cmd.y} `;
    else if (cmd.type === 'Q') o += `q ${cmd.x1} ${-cmd.y1} ${cmd.x} ${-cmd.y} `;
    else if (cmd.type === 'C') o += `b ${cmd.x1} ${-cmd.y1} ${cmd.x2} ${-cmd.y2} ${cmd.x} ${-cmd.y} `;
    else if (cmd.type === 'Z') o += 'z ';
  }
  glyphs[ch] = { ha: Math.round(g.advanceWidth), x_min: g.xMin, x_max: g.xMax, o: o.trim() };
  count++;
}
const head = (font.tables && font.tables.head) || {};
const post = (font.tables && font.tables.post) || {};
const names = font.names || {};
const out = {
  glyphs,
  familyName: (names.fontFamily && names.fontFamily.en) || 'subset',
  ascender: font.ascender, descender: font.descender,
  underlinePosition: (post.underlinePosition != null ? post.underlinePosition : -100),
  underlineThickness: (post.underlineThickness != null ? post.underlineThickness : 50),
  boundingBox: {
    yMin: (head.yMin != null ? head.yMin : font.descender),
    xMin: (head.xMin != null ? head.xMin : 0),
    yMax: (head.yMax != null ? head.yMax : font.ascender),
    xMax: (head.xMax != null ? head.xMax : 1000),
  },
  resolution: 1000,
  original_font_information: {
    copyright: (names.copyright && names.copyright.en) || 'Be Vietnam Pro (OFL)',
  },
};
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`${inFile}: ${count} glyphs -> ${outFile} ${fs.statSync(outFile).size} bytes`);
