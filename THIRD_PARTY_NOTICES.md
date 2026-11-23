# Third-party notices

## SonaWave (design credit — no code vendored)

LyricWave Studio's 2D visualizers (M2), 3D visualizer scenes (M3), particles /
LUT / film light (M5), Lottie stickers / EQ (M6) and lyric tools (M7) were
rewritten in plain AURA-style JavaScript from the *design* of
HAY Studio73's SonaWave (`HAYStudio73_SonaWave`, MIT). No TypeScript/React
code was carried over. Source: https://github.com/haystudio73/HAYStudio73_SonaWave
— licensed under the MIT License.

## three.js r170 (bundled)

`vendor/three.module.min.js` and `vendor/three-addons/FontLoader.js` / `TextGeometry.js`
are embedded in `index.html` and used for 3D text (textured-plane layer and
extruded text). Loaded at runtime from inlined strings via blob URLs — no CDN
is required. Source: https://github.com/mrdoob/three.js — licensed under the
MIT License:

```
MIT License

Copyright (c) 2010-2025 three.js authors
```

## mp4-muxer 5.2.2 (bundled)

`vendor/mp4-muxer.min.js` is embedded in `index.html` and is used to write MP4 files.
Source: https://github.com/Vanilagy/mp4-muxer — licensed under the MIT License:

```
MIT License

Copyright (c) 2023 Vanilagy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts (not bundled)

The web app loads the following typefaces at runtime from Google Fonts (https://fonts.google.com/); they are not
included in this repository. They are distributed by their authors under the SIL Open Font License 1.1:
Noto Sans JP, Noto Serif JP, Dela Gothic One, Zen Kaku Gothic New, Zen Old Mincho, Kaisei Tokumin,
M PLUS Rounded 1c, Mochiy Pop One, DotGothic16, Yuji Syuku, IBM Plex Mono, IBM Plex Sans JP.

## Bundled Vietnamese-capable fonts (LyricWave)

Be Vietnam Pro, Montserrat, Lexend, Noto Sans, Noto Serif, and Oswald are bundled unmodified from google/fonts under SIL OFL 1.1. Each family retains its OFL.txt in fonts/. See fonts/manifest.json for the pinned upstream commit, source URL, file hash, and exact weights. build.py embeds these files in the standalone pages. Original CJK font families may still load online when explicitly selected or used by other lyric languages. Font family names are proper names and are not translated.

### 3D font subsets (Be Vietnam Pro, for the real 3D block layer)

`fonts/3d/BeVietnamPro-Regular-vi-subset.json` and `BeVietnamPro-Bold-vi-subset.json` are subsets of the bundled Be Vietnam Pro Regular 400 / Bold 700 (SIL OFL 1.1), built by `tools/subset_3d_fonts.py` (fontTools subset + a TTF→typeface.json converter using opentype.js, MIT). Each subset keeps 394 glyphs (Vietnamese + Latin + common punctuation) and is converted to three.js typeface.json so `TextGeometry` can extrude real 3D text. The OFL.txt for Be Vietnam Pro is kept in `fonts/3d/OFL.txt`. The subsets are inlined by build.py into every HTML edition (no fetch).

## gl-transitions 3.0.0 (shaders vendored)

Twelve transition shaders from gl-transitions are vendored verbatim in `src/11p_gltrans.js`
and run on a small WebGL host written for this app (`src/13_gltrans.js`); no library or
network request is involved.

- BurnThrough — Author: liubailin2020@gmail.com
- PerlinDissolve — Author: Rich Harris
- WaterDrop — Author: Paweł Płóciennik
- CrossWarp — Author: Eke Péter <peterekepeter@gmail.com>
- Morph — Author: paniq
- GlitchMemories — Author: Gunnar Roth
- CrossZoom — Author: rectalogic
- DreamyZoom — Author: Zeh Fernando
- Swirl — Author: Sergey Kosarevsky
- Kaleidoscope — Author: nwoeanhinnogaehr
- Pinwheel — Author: Mr Speaker
- TvStatic — Author: Brandon Anzaldi

Source: https://github.com/gl-transitions/gl-transitions — licensed under the MIT License:

```
MIT License

Copyright (c) 2017-present gl-transitions contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Note: Individual transitions in the transitions/ directory may have their own
license specified in their file header comments. When no license is specified,
the transition is covered by this MIT license.
```

## lottie-web 5.13.0 (bundled, canvas renderer only)

`vendor/lottie-web/lottie_canvas.min.js` is embedded in `index.html` and
renders the Lottie sticker animations (M6 v0.31.0).
Source: https://github.com/airbnb/lottie-web — licensed under the MIT License
(see `vendor/lottie-web/LICENSE.md`):

```
The MIT License (MIT)

Copyright (c) 2015 Bodymovin
```

## Embedded Lottie sticker data (HAY Studio73 / SonaWave)

The 8 sticker animations embedded in `src/14_lottie.js` (`J.LOTTIE_DATA`)
are hand-authored Bodymovin shape data from HAY Studio73's SonaWave
(`src/data/embeddedLottieData.ts`), transplanted as plain JSON:
vinyl record, equalizer wave, neon heart, dancing notes, cyber lightning,
bass speaker, sparkling stars, fire flame. SonaWave is MIT-licensed;
credit to HAY Studio73 for the sticker designs.

## Master EQ (SonaWave design, rewritten)

The 10-band EQ band frequencies, filter types (lowshelf / peaking /
highshelf, Q 1.4), cut filters and the 10 preset gain values in
`src/10_audio.js` (`J.EQ_BANDS`, `J.EQ_PRESETS`) follow HAY Studio73's
SonaWave `src/utils/presets.ts` (`MASTER_EQ_BANDS_META`,
`MASTER_EQ_PRESETS_DATA`) and `src/utils/audioEngine.ts`; the code is a
fresh plain-JS implementation for LyricWave, not a copy. SonaWave is
MIT-licensed.
