/* AURA pack: capcut — trending kinetic typography effects inspired by CapCut & V-Pop */
(() => {
'use strict';
const E = J.E;
const P = 'capcut';
const DEG = J.DEG, TAU = J.TAU, clamp = J.clamp, lerp = J.lerp;
const reg = (group, key, def) => J.register(group, key, Object.assign(def, { set: P, pack: P }), P);

/* ----------------------------------------------------------------
   ENTRANCES (Xuất hiện phong cách CapCut)
   ---------------------------------------------------------------- */

// 1. Elastic Pop Bounce (Bật nảy lò xo từng chữ)
reg('enter', 'ccPopBounce', {
  name: 'バウンスポップ', tags: ['pop', 'graphic', 'kinetic'], w: 2.0,
  apply(env, it, p, ctx) {
    const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
    it.charFns.push((i, g, n) => {
      const stagger = Math.min(0.06, (dur * 0.4) / Math.max(1, n));
      const t = clamp((lt - i * stagger) / Math.max(0.01, dur * 0.65));
      if (t <= 0) return { hide: true };
      const s = E.outBack(t, 2.8);
      const dy = (1 - E.outQuad(t)) * (it.size * 0.8);
      return { s, dy, a: clamp(t * 3) };
    });
  }
});

// 2. Typewriter with blinking cursor (Máy đánh chữ + con trỏ)
reg('enter', 'ccTypeBlink', {
  name: 'タイプライター', tags: ['editorial', 'calm', 'lyricpv'], w: 1.8,
  apply(env, it, p, ctx) {
    const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
    const progress = clamp(lt / Math.max(0.01, dur));
    it.charFns.push((i, g, n) => {
      const threshold = i / Math.max(1, n);
      if (progress < threshold) return { hide: true };
      return { a: 1 };
    });
    // draw blinking cursor after the last revealed glyph
    const oldPost = it.post;
    it.post = (e, item, bb) => {
      if (oldPost) oldPost(e, item, bb);
      if (progress < 1.0 && Math.floor(env.lt * 6) % 2 === 0) {
        const ctx2 = e.ctx;
        ctx2.save();
        ctx2.fillStyle = e.sc.accent || '#F5A50C';
        const cx = bb ? bb.x1 + 4 : item.x + 10;
        const cy = bb ? bb.y0 : item.y - item.size / 2;
        const ch = bb ? bb.h : item.size;
        ctx2.fillRect(cx, cy, Math.max(3, item.size * 0.1), ch);
        ctx2.restore();
      }
    };
  }
});

// 3. Smooth Slide Up Motion Blur (Trượt mềm từ dưới lên)
reg('enter', 'ccSmoothSlideUp', {
  name: 'スムーズスライド', tags: ['emotional', 'pop', 'calm'], w: 1.8,
  apply(env, it, p, ctx) {
    const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
    const t = clamp(lt / Math.max(0.01, dur));
    const k = E.outExpo(t);
    it.dy = (it.dy || 0) + (1 - k) * (it.size * 1.5);
    it.alpha = (it.alpha ?? 1) * clamp(t * 2.5);
    if (t < 0.8) it.blur = (it.blur || 0) + (1 - k) * 6;
  }
});

// 4. Stomp Impact (Chữ đập mạnh vào giữa màn hình)
reg('enter', 'ccStompImpact', {
  name: 'ストンプインパクト', tags: ['pop', 'glitch', 'graphic'], w: 1.6,
  apply(env, it, p, ctx) {
    const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
    const t = clamp(lt / Math.max(0.01, dur * 0.5));
    if (t < 1) {
      const s = lerp(3.5, 1.0, E.outExpo(t));
      it.sx = (it.sx || 1) * s;
      it.sy = (it.sy || 1) * s;
      it.alpha = (it.alpha ?? 1) * clamp(t * 4);
    } else {
      // small camera shake bounce
      const rebound = (env.lt - (it.delay || 0) - dur * 0.5) / 0.15;
      if (rebound >= 0 && rebound < 1) {
        it.dy = (it.dy || 0) + Math.sin(rebound * Math.PI) * (it.size * 0.15);
      }
    }
  }
});

// 5. Cyber Glitch RGB (Xuất hiện bằng nhiễu điện tử)
reg('enter', 'ccGlitchRGB', {
  name: 'サイバーグリッチ', tags: ['glitch', 'pop'], w: 1.7,
  apply(env, it, p, ctx) {
    const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
    const t = clamp(lt / Math.max(0.01, dur * 0.6));
    if (t < 1) {
      it.alpha = Math.random() > 0.3 ? 1 : 0.2;
      it.dx = (it.dx || 0) + (Math.random() - 0.5) * it.size * 0.4 * (1 - t);
      it.dy = (it.dy || 0) + (Math.random() - 0.5) * it.size * 0.2 * (1 - t);
      it.skew = (it.skew || 0) + (Math.random() - 0.5) * 20 * (1 - t);
    }
  }
});

/* ----------------------------------------------------------------
   HOLDS (Giữ nhịp phong cách CapCut)
   ---------------------------------------------------------------- */

// 6. Pulse Heartbeat (Phập phồng theo nhịp bass)
reg('hold', 'ccPulseHeart', {
  name: 'ハートビート', tags: ['emotional', 'pop', 'calm'], w: 2.0,
  apply(env, it) {
    const speed = 4.5;
    const beat = Math.sin(env.lt * speed);
    const pulse = beat > 0 ? Math.pow(beat, 4) * 0.12 : 0;
    it.sx = (it.sx || 1) * (1 + pulse);
    it.sy = (it.sy || 1) * (1 + pulse);
  }
});

// 7. Floating Wave (Sóng nước bồng bềnh)
reg('hold', 'ccWaveSway', {
  name: 'ウェイブスウェイ', tags: ['calm', 'emotional', 'pop'], w: 1.8,
  apply(env, it) {
    it.charFns.push((i, g, n) => {
      const phase = env.lt * 3 + i * 0.5;
      const dy = Math.sin(phase) * (it.size * 0.14);
      const rot = Math.cos(phase) * 3;
      return { dy, rot };
    });
  }
});

// 8. Bass Jitter Shake (Rung giật theo tiếng Bass)
reg('hold', 'ccJitterBass', {
  name: 'ベースジッター', tags: ['glitch', 'pop'], w: 1.5,
  apply(env, it) {
    const amp = it.size * 0.05 * (env.fx.glitch ?? 0.8);
    it.dx = (it.dx || 0) + (Math.sin(env.lt * 40) + Math.cos(env.lt * 27)) * amp * 0.5;
    it.dy = (it.dy || 0) + (Math.cos(env.lt * 35) + Math.sin(env.lt * 19)) * amp * 0.5;
  }
});

/* ----------------------------------------------------------------
   EXITS (Biến mất phong cách CapCut)
   ---------------------------------------------------------------- */

// 9. Zoom Through Camera (Phóng xuyên qua camera)
reg('exit', 'ccZoomThrough', {
  name: 'ズームスルー', tags: ['pop', 'graphic', 'kinetic'], w: 1.8,
  apply(env, it, p, ctx) {
    const dur = ctx.outDur, t = clamp((env.cut.dur - env.lt) / Math.max(0.01, dur));
    const k = 1 - t; // 0 -> 1
    const s = 1 + Math.pow(k, 2) * 5;
    it.sx = (it.sx || 1) * s;
    it.sy = (it.sy || 1) * s;
    it.alpha = (it.alpha ?? 1) * (1 - Math.pow(k, 1.5));
    if (k > 0.2) it.blur = (it.blur || 0) + k * 8;
  }
});

// 10. Smoke Dissolve (Tan biến như làn khói)
reg('exit', 'ccSmokeFade', {
  name: 'スモークフェード', tags: ['calm', 'emotional'], w: 1.8,
  apply(env, it, p, ctx) {
    const dur = ctx.outDur, t = clamp((env.cut.dur - env.lt) / Math.max(0.01, dur));
    const k = 1 - t;
    it.dy = (it.dy || 0) - k * (it.size * 0.8);
    it.alpha = (it.alpha ?? 1) * (1 - k);
    it.blur = (it.blur || 0) + k * 12;
    it.sx = (it.sx || 1) * (1 + k * 0.3);
  }
});

// 11. Gravity Drop (Rơi tự do trọng lực)
reg('exit', 'ccDropFall', {
  name: 'グラビティフォール', tags: ['pop', 'glitch'], w: 1.5,
  apply(env, it, p, ctx) {
    const dur = ctx.outDur, t = clamp((env.cut.dur - env.lt) / Math.max(0.01, dur));
    const k = 1 - t;
    it.dy = (it.dy || 0) + Math.pow(k, 2.5) * (env.H * 0.6);
    it.rot = (it.rot || 0) + k * 15;
    it.alpha = (it.alpha ?? 1) * (1 - Math.pow(k, 3));
  }
});

/* ----------------------------------------------------------------
   TREATMENTS (Hiệu ứng bề mặt chữ CapCut)
   ---------------------------------------------------------------- */

// 12. Karaoke Sing-Along Active (Đổi màu phát sáng theo nhịp hát)
reg('treat', 'ccKaraokeActive', {
  name: 'カラオケ発光', tags: ['pop', 'calm', 'emotional'], w: 2.5,
  apply(env, it) {
    const p = clamp(env.lt / Math.max(0.01, env.cut.dur * 0.9));
    it.charFns.push((i, g, n) => {
      const charP = i / Math.max(1, n);
      if (p >= charP) {
        return {
          color: env.sc.accent || '#F5A50C',
          s: 1.08,
          dx: 0,
          dy: -it.size * 0.04
        };
      }
      return {
        color: env.sc.sub || 'rgba(255,255,255,0.4)',
        s: 1.0
      };
    });
  }
});

// 13. Highlighter Marker Bar (Thanh bút dạ quang quét sau chữ)
reg('treat', 'ccHighlighter', {
  name: 'マーカーハイライト', tags: ['pop', 'graphic', 'editorial'], w: 2.0,
  apply(env, it) {
    const oldPre = it.pre;
    it.pre = (e, item) => {
      if (oldPre) oldPre(e, item);
      const m = item._m || (item._m = J.measure(item));
      const dur = e.cut.dur || 1;
      const sweep = clamp(e.lt / Math.max(0.1, dur * 0.4));
      const width = m.w * E.outQuad(sweep);
      const ctx2 = e.ctx;
      ctx2.save();
      ctx2.fillStyle = e.sc.accent2 || 'rgba(22, 244, 212, 0.45)';
      const x0 = item.align === 'left' ? item.x - 6 : item.align === 'right' ? item.x - width + 6 : item.x - width / 2;
      const y0 = item.y - m.h * 0.35;
      ctx2.fillRect(x0, y0, width + 12, m.h * 0.7);
      ctx2.restore();
    };
  }
});

// 14. Neon Glow Tube (Ống đèn neon phát sáng rực)
reg('treat', 'ccNeonGlowTube', {
  name: 'ネオンチューブ', tags: ['pop', 'glitch', 'emotional'], w: 2.2,
  apply(env, it) {
    it.shadowColor = env.sc.accent || '#16F4D4';
    it.shadowBlur = it.size * 0.35;
    it.outline = Math.max(2, it.size * 0.06);
    it.outlineColor = '#FFFFFF';
  }
});

/* ----------------------------------------------------------------
   TRANSITIONS (Chuyển cảnh điện ảnh phong cách Concat & CapCut)
   ---------------------------------------------------------------- */
const trReg = (k, d) => reg('trans', k, Object.assign({}, d, {
  draw(ctx, A, B, p, I) {
    ctx.save();
    try {
      if (!(p > 0)) ctx.drawImage(A, 0, 0);
      else if (p >= 1) ctx.drawImage(B, 0, 0);
      else d.draw(ctx, A, B, p, I, I.P || {});
    } finally { ctx.restore(); }
  }
}));

// 15. Whip Pan with Directional Motion Blur (Lia máy tốc độ cao)
trReg('ccWhipPan', {
  name: 'ホイップパン', tags: ['pop', 'graphic', 'kinetic'], w: 2.2, dur: 0.38,
  plan: rng => ({ dir: rng.chance(0.5) ? 'R' : 'L' }),
  draw(ctx, A, B, p, I, P) {
    const { cw, ch } = I;
    const e = E.inOutCubic(p);
    const sign = (P.dir === 'L') ? -1 : 1;
    const shift = cw * e * sign;
    const blur = Math.sin(p * Math.PI) * (cw * 0.04);

    ctx.drawImage(A, -shift, 0);
    ctx.drawImage(B, cw * sign - shift, 0);

    // High-speed motion blur trails
    if (blur > 2) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(A, -shift - blur * sign, 0);
      ctx.drawImage(B, cw * sign - shift + blur * sign, 0);
      ctx.drawImage(A, -shift + blur * 0.6 * sign, 0);
      ctx.drawImage(B, cw * sign - shift - blur * 0.6 * sign, 0);

      // Light flash speedline at the seam
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.35;
      ctx.fillStyle = '#FFFFFF';
      const streakX = (cw * sign - shift);
      ctx.fillRect(streakX - 4, 0, 8, ch);
      ctx.restore();
    }
  }
});

// 16. Film Burn & Organic Light Leak (Cháy phim & Lóe sáng điện ảnh)
trReg('ccFilmBurn', {
  name: 'フィルムバーン', tags: ['emotional', 'pop', 'calm'], w: 2.0, dur: 0.42,
  plan: rng => ({ x: rng.range(0.2, 0.8), y: rng.range(0.2, 0.8) }),
  draw(ctx, A, B, p, I, P) {
    const { cw, ch } = I;
    if (p < 0.5) {
      ctx.drawImage(A, 0, 0);
    } else {
      ctx.drawImage(B, 0, 0);
    }

    const bell = Math.sin(p * Math.PI);
    if (bell > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(1.0, Math.pow(bell, 0.75) * 1.5);

      const cx = cw * (P.x || 0.5) + (p - 0.5) * cw * 0.4;
      const cy = ch * (P.y || 0.5) + (p - 0.5) * ch * 0.2;
      const rMax = Math.hypot(cw, ch) * 0.75;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rMax);
      grad.addColorStop(0.0, '#FFFFFF');
      grad.addColorStop(0.2, '#FFE27A');
      grad.addColorStop(0.45, '#FF7A29');
      grad.addColorStop(0.7, '#FF1464');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }
  }
});

// 17. Digital RGB Chromatic Glitch Split (Tách kênh màu 3D)
trReg('ccRgbSplit', {
  name: 'RGBスプリット', tags: ['glitch', 'pop', 'graphic'], w: 2.0, dur: 0.36,
  draw(ctx, A, B, p, I) {
    const { cw, ch } = I;
    const split = Math.sin(p * Math.PI) * (cw * 0.035);

    if (p < 0.5) {
      ctx.drawImage(A, 0, 0);
    } else {
      ctx.drawImage(B, 0, 0);
    }

    if (split > 1.5) {
      const src = p < 0.5 ? A : B;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(src, -split, (Math.sin(p * 24) * ch * 0.008));
      ctx.drawImage(src, split, -(Math.sin(p * 24) * ch * 0.008));

      // Glitch displacement bar
      if (Math.sin(p * 35) > 0.3) {
        ctx.fillStyle = '#16F4D4';
        ctx.globalAlpha = 0.25;
        const gy = ch * (0.2 + 0.6 * p);
        ctx.fillRect(0, gy, cw, ch * 0.04);
      }
      ctx.restore();
    }
  }
});

/* ----------------------------------------------------------------
   ATMOSPHERE & STYLING TREATMENTS (Bộ lọc không khí Concat)
   ---------------------------------------------------------------- */

// 18. Cyberpunk Dual-Tone Glow (Tím neon & Xanh cyan điện tử)
reg('treat', 'ccCyberpunk', {
  name: 'サイバーパンク', tags: ['glitch', 'pop', 'graphic'], w: 2.4,
  apply(env, it) {
    it.color = '#00F0FF';
    it.shadowColor = '#FF007F';
    it.shadowBlur = it.size * 0.45;
    it.outline = Math.max(2, it.size * 0.05);
    it.outlineColor = '#100028';
  }
});

// 19. Retro VHS Scanlines & Chromatic Bleed (Băng từ VHS thập niên 90)
reg('treat', 'ccVhs', {
  name: 'VHSレトロ', tags: ['pop', 'emotional', 'glitch'], w: 2.2,
  apply(env, it) {
    it.color = '#FFFFFF';
    it.shadowColor = 'rgba(255, 30, 80, 0.85)';
    it.shadowBlur = it.size * 0.3;
    const oldPost = it.post;
    it.post = (e, item, bb) => {
      if (oldPost) oldPost(e, item, bb);
      if (!bb) return;
      const ctx2 = e.ctx;
      ctx2.save();
      ctx2.fillStyle = 'rgba(0, 0, 0, 0.3)';
      const step = Math.max(3, item.size * 0.08);
      for (let y = bb.y0; y <= bb.y1; y += step) {
        ctx2.fillRect(bb.x0 - 4, y, bb.w + 8, step * 0.35);
      }
      ctx2.restore();
    };
  }
});

/* ----------------------------------------------------------------
   AUTO ĐỘC BẢN: Guaranteed Non-Repeating Kinetic Diversity
   ---------------------------------------------------------------- */
J.applyNonRepeatingDiversity = (project) => {
  const parsed = J.parseLyrics(project.lyrics || '');
  const lines = parsed.lines || [];
  if (!lines.length) return 0;

  project.overrides = project.overrides || {};

  // Curated lists with high visual distinction, prioritizing CapCut & kinetic typography
  const enterPoolEnergetic = [
    'ccPopBounce', 'ccStompImpact', 'ccGlitchRGB', 'assemble', 'slice', 'knWordSlam', 'flipIn', 'elastic', 'shatter', 'fly'
  ].filter(k => J.ENTER[k]);

  const enterPoolSmooth = [
    'ccSmoothSlideUp', 'ccTypeBlink', 'blur', 'type', 'wipe', 'draw', 'roll', 'unfold', 'expand', 'focus', 'fade'
  ].filter(k => J.ENTER[k]);

  const holdPool = [
    'ccPulseHeart', 'ccWaveSway', 'ccJitterBass', 'float', 'drift', 'quake', 'pendulum', 'hover', 'breath', 'orbit'
  ].filter(k => J.HOLD[k]);

  const exitPool = [
    'ccZoomThrough', 'ccSmokeFade', 'ccDropFall', 'explode', 'fall', 'burn', 'scatter', 'drift', 'wipe', 'blur', 'snap'
  ].filter(k => J.EXIT[k]);

  const treatPool = [
    'ccKaraokeActive', 'ccHighlighter', 'ccNeonGlowTube', 'ccCyberpunk', 'ccVhs', 'outline', 'shadow', 'rainbow', 'extrusion', 'halftone', 'none'
  ].filter(k => J.TREAT[k]);

  const camPool = [
    'push', 'pull', 'pan', 'drift', 'sway', 'tilt'
  ].filter(k => J.CAMERA[k]);

  const transPool = [
    'ccWhipPan', 'ccFilmBurn', 'ccRgbSplit', 'wipe', 'diagonalWipe', 'clockWipe', 'irisOpen', 'pushSlide'
  ].filter(k => J.TRANS[k]);

  const history = { enter: [], hold: [], exit: [], treat: [], cam: [], trans: [] };

  const pickAvoid = (pool, hist, maxHist = 3) => {
    if (!pool.length) return null;
    let available = pool.filter(k => !hist.includes(k));
    if (!available.length) {
      const prev = hist[hist.length - 1];
      available = pool.filter(k => k !== prev);
      if (!available.length) available = pool;
    }
    const chosen = available[Math.floor(Math.random() * available.length)];
    hist.push(chosen);
    if (hist.length > maxHist) hist.shift();
    return chosen;
  };

  let assignedCount = 0;

  lines.forEach((ln, idx) => {
    if (ln.interlude) return;
    const isImpact = ln.impact || idx % 3 === 2;
    const enterPool = isImpact ? enterPoolEnergetic : enterPoolSmooth;

    const chosenEnter = pickAvoid(enterPool.length ? enterPool : J.ENTER_ORDER, history.enter, 3);
    const chosenHold = pickAvoid(holdPool.length ? holdPool : J.HOLD_ORDER, history.hold, 2);
    const chosenExit = pickAvoid(exitPool.length ? exitPool : J.EXIT_ORDER, history.exit, 3);
    const chosenTreat = pickAvoid(treatPool.length ? treatPool : J.TREAT_ORDER, history.treat, 2);
    const chosenCam = pickAvoid(camPool.length ? camPool : J.CAMERA_ORDER, history.cam, 2);
    const chosenTrans = pickAvoid(transPool.length ? transPool : J.TRANS_ORDER, history.trans, 2);

    const cur = Object.assign({}, project.overrides[idx] || {});
    if (!cur.lock) {
      if (chosenEnter) cur.enter = chosenEnter;
      if (chosenHold) cur.hold = chosenHold;
      if (chosenExit) cur.exit = chosenExit;
      if (chosenTreat) cur.treat = chosenTreat;
      if (chosenCam) cur.cam = chosenCam;
      if (chosenTrans) cur.trans = chosenTrans;
      project.overrides[idx] = cur;
      assignedCount++;
    }
  });

  return assignedCount;
};

})();
