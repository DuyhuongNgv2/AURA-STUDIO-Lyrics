/* JIZURA pack: grade — colour grading LUT presets (M5 v0.30.0)
   All 13 presets of SonaWave's LUT_PRESET_ITEMS (HAY Studio73, MIT —
   see THIRD_PARTY_NOTICES.md), rewritten in plain AURA-style JS from the
   *numeric configs* (no TS/React code was carried over). SonaWave's
   presets are numbers, not .cube files, so AURA applies them with a
   canvas filter string (linear part) plus soft-light colour overlays
   (temperature / tint / split-tone part) and folds vignette / grain /
   bloom into the renderer's existing post pass. This is an approximation
   of a 3D LUT, not a per-pixel table lookup — every preset still shifts
   the frame's colours visibly and measurably (see QA-038 P2).
   Pure data + pure functions: no DOM, no audio, node-testable. */
(() => {
'use strict';
const clamp = J.clamp;

/* id, category (SonaWave groups), Japanese / Vietnamese / English names,
   and the numeric config exactly as in SonaWave's presets.ts. Missing
   fields default to 0 / null. */
J.GRADE_LUTS = [
  { id: 'none', cat: 'clean', name: 'オリジナル', vi: 'Nguyên Bản (Tự Nhiên)', en: 'Original / Neutral', zhHans: '原色（自然）', zhHant: '原色（自然）', ko: '원본 (내추럴)',
    cfg: {} },
  { id: 'teal-orange', cat: 'cinema', name: 'ティール＆オレンジ', vi: 'Xanh Teal & Cam Hollywood', en: 'Teal & Orange Hollywood', zhHans: '青橙好莱坞', zhHant: '青橙好萊塢', ko: '틸 & 오렌지',
    cfg: { brightness: 0, contrast: 18, saturation: 15, exposure: 0, temperature: 15, tint: -6, hueRotate: 0, sepia: 0, shadowsLift: 5, highlightsTint: '#fed7aa', shadowsTint: '#083344', splitToneIntensity: 55, vignette: 25, filmGrain: 0, bloomGlow: 0 } },
  { id: 'cinematic-warm', cat: 'cinema', name: 'シネマティック・ウォーム', vi: 'Điện Ảnh Kodachrome Ấm', en: 'Cinematic Kodachrome', zhHans: '暖调电影柯达', zhHant: '暖調電影柯達', ko: '시네마틱 웜',
    cfg: { brightness: 2, contrast: 20, saturation: 10, exposure: 0, temperature: 32, tint: 6, sepia: 8, shadowsLift: 0, highlightsTint: '#fef08a', shadowsTint: '#451a03', splitToneIntensity: 45, vignette: 30, filmGrain: 10, bloomGlow: 10 } },
  { id: 'bleach-bypass', cat: 'creative', name: 'ブリーチバイパス', vi: 'Bleach Bypass Bạc (Hành Động)', en: 'Bleach Bypass Action', zhHans: '跳漂银盐（动作）', zhHant: '跳漂銀鹽（動作）', ko: '블리치 바이패스',
    cfg: { brightness: -4, contrast: 42, saturation: -45, exposure: 5, temperature: -10, tint: 0, shadowsLift: 15, vignette: 40, filmGrain: 25, bloomGlow: 0 } },
  { id: 'cyberpunk-neon', cat: 'creative', name: 'サイバーパンク・ネオン', vi: 'Cyberpunk Neon Tương Lai', en: 'Cyberpunk Neon 2077', zhHans: '赛博朋克霓虹', zhHant: '賽博龐克霓虹', ko: '사이버펑크 네온',
    cfg: { brightness: 2, contrast: 26, saturation: 45, exposure: 0, temperature: -12, tint: 38, hueRotate: 0, shadowsLift: 0, highlightsTint: '#f43f5e', shadowsTint: '#06b6d4', splitToneIntensity: 65, vignette: 35, bloomGlow: 30 } },
  { id: 'vintage-70s', cat: 'vintage', name: 'ヴィンテージ70s', vi: 'Hoài Niệm Vintage 70s', en: 'Vintage 70s Polaroid', zhHans: '复古 70 年代', zhHant: '復古 70 年代', ko: '빈티지 70s',
    cfg: { brightness: 4, contrast: -8, saturation: -15, temperature: 28, tint: -6, sepia: 30, shadowsLift: 28, vignette: 35, filmGrain: 35, bloomGlow: 15 } },
  { id: 'golden-hour', cat: 'cinema', name: 'ゴールデンアワー', vi: 'Hoàng Hôn Nắng Vàng', en: 'Golden Hour Sunset', zhHans: '黄金时刻日落', zhHant: '黃金時刻日落', ko: '골든 아워',
    cfg: { brightness: 6, contrast: 10, saturation: 22, temperature: 55, tint: 10, highlightsTint: '#f59e0b', shadowsTint: '#78350f', splitToneIntensity: 50, vignette: 20, bloomGlow: 25 } },
  { id: 'black-and-white', cat: 'clean', name: 'モノクロ', vi: 'Đen Trắng Nghệ Thuật (B&W)', en: 'Noir Monochrome Classic', zhHans: '经典黑白', zhHant: '經典黑白', ko: '흑백 모노크롬',
    cfg: { brightness: 0, contrast: 38, saturation: -100, exposure: 0, temperature: 0, tint: 0, shadowsLift: 10, vignette: 45, filmGrain: 25 } },
  { id: 'faded-film', cat: 'vintage', name: 'フェイデッド・フィルム', vi: 'Phim Mờ Matte Faded', en: 'Matte Faded Film', zhHans: '褪色胶片', zhHant: '褪色底片', ko: '페이디드 필름',
    cfg: { brightness: 6, contrast: -15, saturation: -18, temperature: 12, shadowsLift: 45, vignette: 25, filmGrain: 20 } },
  { id: 'retro-vhs', cat: 'vintage', name: 'レトロVHS', vi: 'Băng Từ VHS Thập Niên 90', en: 'Retro 90s VHS Tape', zhHans: '复古 90s VHS', zhHant: '復古 90s VHS', ko: '레트로 VHS',
    cfg: { brightness: 2, contrast: 15, saturation: 25, temperature: 10, tint: 18, hueRotate: 8, shadowsLift: 22, vignette: 30, filmGrain: 45 } },
  { id: 'matrix-green', cat: 'creative', name: 'マトリックス・グリーン', vi: 'Xanh Ma Trận Matrix', en: 'Matrix Cyber Emerald', zhHans: '黑客帝国绿', zhHant: '駭客任務綠', ko: '매트릭스 그린',
    cfg: { brightness: -5, contrast: 22, saturation: -12, temperature: -15, tint: -70, highlightsTint: '#86efac', shadowsTint: '#064e3b', splitToneIntensity: 70, vignette: 35, filmGrain: 15 } },
  { id: 'moody-blue', cat: 'moody', name: 'ムーディー・ブルー', vi: 'Xanh Đêm Lạnh Tối Giản', en: 'Midnight Moody Blue', zhHans: '午夜冷蓝', zhHant: '午夜冷藍', ko: '무디 블루',
    cfg: { brightness: -8, contrast: 22, saturation: -8, temperature: -65, tint: 12, highlightsTint: '#e0f2fe', shadowsTint: '#082f49', splitToneIntensity: 65, vignette: 40, filmGrain: 10 } },
  { id: 'candy-pop', cat: 'creative', name: 'キャンディ・ポップ', vi: 'Kẹo Ngọt Candy Pop Rực Rỡ', en: 'Vibrant Candy Pop', zhHans: '糖果波普', zhHant: '糖果波普', ko: '캔디 팝',
    cfg: { brightness: 6, contrast: 18, saturation: 55, temperature: 8, tint: 12, bloomGlow: 20, vignette: 15 } },
];
J.gradeLut = id => J.GRADE_LUTS.find(l => l.id === id) || J.GRADE_LUTS[0];

/* Normalised grade state from project.fx.grade: { lut, strength }.
   Returns null when there is nothing to apply (none / strength 0 /
   unknown id falls back to 'none'). */
J.gradeOf = (grade) => {
  const lut = (grade && grade.lut) || 'none';
  const strength = clamp(grade && grade.strength != null ? +grade.strength : 1, 0, 1);
  if (lut === 'none' || strength <= 0) return null;
  return { lut, strength, def: J.gradeLut(lut) };
};

/* Linear part as one ctx.filter string. '' means "no filter needed"
   (only possible when the preset has no linear component). */
J.gradeFilter = (lutId, strength) => {
  const g = J.gradeOf({ lut: lutId, strength });
  if (!g) return '';
  const c = g.def.cfg, s = g.strength;
  const bri = 100 + ((c.brightness || 0) + (c.exposure || 0) + (c.shadowsLift || 0) * 0.5) * s;
  const con = 100 + (c.contrast || 0) * s;
  const sat = Math.max(0, 100 + (c.saturation || 0) * s);
  const sep = (c.sepia || 0) * s;
  const hue = (c.hueRotate || 0) * s;
  const parts = [];
  if (Math.abs(bri - 100) > 0.01) parts.push(`brightness(${bri.toFixed(1)}%)`);
  if (Math.abs(con - 100) > 0.01) parts.push(`contrast(${con.toFixed(1)}%)`);
  if (Math.abs(sat - 100) > 0.01) parts.push(`saturate(${sat.toFixed(1)}%)`);
  if (sep > 0.01) parts.push(`sepia(${sep.toFixed(1)}%)`);
  if (Math.abs(hue) > 0.01) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  return parts.join(' ');
};

/* Colour-overlay part: [{ mode, color, alpha, where }] — the renderer
   paints each with globalCompositeOperation 'soft-light' (full frame,
   or a linear/radial gradient for split-tone). Also the amounts the
   renderer folds into its existing grain / bloom / vignette. */
J.gradeOverlays = (lutId, strength) => {
  const g = J.gradeOf({ lut: lutId, strength });
  if (!g) return { overlays: [], vignette: 0, grain: 0, bloom: 0 };
  const c = g.def.cfg, s = g.strength, out = [];
  if (c.temperature) {
    const a = Math.min(0.5, Math.abs(c.temperature) * 0.004 * s);
    out.push({ mode: 'soft-light', color: c.temperature > 0 ? '#ff9a3c' : '#3c7bff', alpha: a, where: 'full' });
  }
  if (c.tint) {
    const a = Math.min(0.5, Math.abs(c.tint) * 0.004 * s);
    out.push({ mode: 'soft-light', color: c.tint > 0 ? '#ff4fd8' : '#4fff7a', alpha: a, where: 'full' });
  }
  if (c.shadowsLift) out.push({ mode: 'soft-light', color: '#ffffff', alpha: Math.min(0.4, c.shadowsLift * 0.003 * s), where: 'full' });
  if ((c.splitToneIntensity || 0) > 0 && (c.highlightsTint || c.shadowsTint)) {
    const a = (c.splitToneIntensity / 100) * 0.55 * s;
    if (c.highlightsTint) out.push({ mode: 'soft-light', color: c.highlightsTint, alpha: a, where: 'top' });
    if (c.shadowsTint) out.push({ mode: 'soft-light', color: c.shadowsTint, alpha: a, where: 'bottom' });
  }
  return {
    overlays: out,
    vignette: ((c.vignette || 0) / 100) * 0.6 * s,
    grain: ((c.filmGrain || 0) / 100) * s,
    bloom: ((c.bloomGlow || 0) / 100) * s,
  };
};
})();
