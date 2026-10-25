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
      const s = lerp(3.5, 1.0, E.outQuart(t));
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

})();
