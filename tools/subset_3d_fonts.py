#!/usr/bin/env python3
"""Build the 3D font subsets for AURA P1 v0.19.0 M2 (real extrusion).

For each Be Vietnam Pro weight (Regular 400, Bold 700):
  1. Subset the source TTF with fontTools (Vietnamese + Latin + punctuation).
  2. Convert the subset TTF to three.js typeface.json with tools/ttf2typeface.mjs
     (opentype.js — the converter proven by the M1 experiment: FontLoader +
     a real visual check of TextGeometry('Sương')).
  3. Verify the JSON: parses, enough glyphs, every required Vietnamese
     character present, every glyph has a positive advance width.

Outputs (committed, inlined by build.py into every HTML edition):
  fonts/3d/BeVietnamPro-Regular-vi-subset.json
  fonts/3d/BeVietnamPro-Bold-vi-subset.json
  (the intermediate subset TTFs are kept next to them for reference)

Run from the repo root:  python3 tools/subset_3d_fonts.py
Requires: fontTools (python3 -m fontTools.subset) + node + opentype.js
  (npm install in tools/ — already done in this checkout).
The subsets are built once and committed; build.py only inlines the JSONs.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'fonts' / 'bevietnampro'
OUT_DIR = ROOT / 'fonts' / '3d'
CONVERTER = ROOT / 'tools' / 'ttf2typeface.mjs'

# Unicode coverage: Vietnamese + Latin + common punctuation/symbols.
#   Basic Latin, Latin-1 Supplement, Latin Extended-A/B (covers ă â đ ê ô ơ ư),
#   Latin Extended Additional U+1EA0-1EF9 (all Vietnamese precomposed tones),
#   general punctuation, currency, arrows, math.
UNICODES = (
    'U+0020-007E,'      # Basic Latin (printable ASCII)
    'U+00A0-00FF,'      # Latin-1 Supplement
    'U+0100-017F,'      # Latin Extended-A
    'U+0180-024F,'      # Latin Extended-B
    'U+1EA0-1EF9,'      # Latin Extended Additional (Vietnamese tones)
    'U+2010-201F,'      # hyphens, dashes, quotes
    'U+2020-2027,'      # dagger, bullet, etc.
    'U+2030,U+2032-2033,U+2039-203A,'  # per mille, primes, guillemets
    'U+20AC,'           # Euro
    'U+2190-2193,'      # arrows
    'U+00D7,U+00F7,U+00B1'  # multiply, divide, plus-minus
)

# Every Vietnamese character that MUST be present (lower + upper, all tones).
REQUIRED_VIETNAMESE = (
    'àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ'
    'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ'
)

WEIGHTS = [
    ('BeVietnamPro-Regular.ttf', 'BeVietnamPro-Regular-vi-subset'),
    ('BeVietnamPro-Bold.ttf', 'BeVietnamPro-Bold-vi-subset'),
]


def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, file=sys.stderr)
        print(r.stderr, file=sys.stderr)
        raise SystemExit(f'FAILED: {" ".join(str(c) for c in cmd)}')
    return r.stdout.strip()


def subset_ttf(src, dst):
    run([sys.executable, '-m', 'fontTools.subset', str(src),
         f'--unicodes={UNICODES}',
         '--output-file=' + str(dst),
         '--layout-features=', '--no-hinting',
         '--desubroutinize', '--drop-tables+=GSUB,GPOS,GDEF',
         '--name-IDs=*', '--notdef-outline', '--recalc-bounds'])
    return dst.stat().st_size


def convert_ttf(ttf, js):
    out = run(['node', str(CONVERTER), str(ttf), str(js)], cwd=ROOT)
    print('  ' + out)
    return js.stat().st_size


def verify(js, label):
    data = json.loads(js.read_text(encoding='utf-8'))
    glyphs = data.get('glyphs') or {}
    assert isinstance(glyphs, dict) and len(glyphs) > 200, f'{label}: only {len(glyphs)} glyphs'
    missing = [c for c in REQUIRED_VIETNAMESE if c not in glyphs]
    assert not missing, f'{label}: missing Vietnamese chars: {"".join(missing)}'
    assert ' ' in glyphs, f'{label}: no space glyph'
    bad_ha = [c for c, g in glyphs.items() if not (isinstance(g.get('ha'), (int, float)) and g['ha'] > 0)]
    assert not bad_ha, f'{label}: glyphs with bad advance width: {bad_ha[:10]}'
    # non-space glyphs must have an outline string (spaces have none, by design)
    space_like = {' ', '\xa0', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004',
                  '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a',
                  '\u202f', '\u205f', '\u3000', '\u200b', '\u00ad'}
    no_outline = [c for c, g in glyphs.items() if c not in space_like and not g.get('o')]
    assert not no_outline, f'{label}: glyphs with no outline: {no_outline[:10]}'
    assert data.get('resolution') == 1000, f'{label}: unexpected resolution {data.get("resolution")}'
    assert data.get('ascender', 0) > 0 and data.get('descender', 0) < 0, f'{label}: bad ascender/descender'
    print(f'  VERIFY {label}: {len(glyphs)} glyphs, all {len(REQUIRED_VIETNAMESE)} Vietnamese chars present, ha>0, outlines OK')
    return len(glyphs)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f'Building 3D font subsets into {OUT_DIR}')
    for src_name, stem in WEIGHTS:
        src = SRC_DIR / src_name
        assert src.exists(), f'missing source font: {src}'
        ttf = OUT_DIR / (stem + '.ttf')
        js = OUT_DIR / (stem + '.json')
        print(f'{src_name}:')
        ttf_size = subset_ttf(src, ttf)
        print(f'  subset TTF: {ttf_size} bytes')
        js_size = convert_ttf(ttf, js)
        n = verify(js, stem)
        print(f'  -> {js.name}: {js_size} bytes, {n} glyphs')
    print('DONE — 2 font subsets ready for build.py to inline.')


if __name__ == '__main__':
    main()
