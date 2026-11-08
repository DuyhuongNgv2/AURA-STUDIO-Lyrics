/* AURA — WebGL host for the vendored gl-transitions shaders (src/11p_gltrans.js).
   One shared context for every Renderer instance (Preview, technique-preview, export):
   never create a context per Renderer. Plain WebGL1, no libraries, no CDN.
   The context is alpha:true + premultipliedAlpha:false so transparent PNG export keeps
   its alpha; opaque renders are unaffected (A/B are opaque there, so the shader
   output alpha is 1). drawImage(webglCanvas) runs synchronously in the same task
   right after the draw, so preserveDrawingBuffer:false is correct here. */
(() => {
'use strict';
const VERT = [
  'attribute vec2 aPos;',
  'varying vec2 vUv;',
  'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }',
].join('\n');
/* host contract (gl-transitions spec v1): progress, ratio, getFromColor/getToColor.
   uv origin is the bottom-left in gl-transitions, so textures are uploaded with
   UNPACK_FLIP_Y_WEBGL (see ensure). */
const HEAD = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform float progress;',
  'uniform float ratio;',
  'uniform sampler2D from;',
  'uniform sampler2D to;',
  'vec4 getFromColor(vec2 uv){ return texture2D(from, uv); }',
  'vec4 getToColor(vec2 uv){ return texture2D(to, uv); }',
].join('\n');
const TAIL = 'void main(){ gl_FragColor = transition(vUv); }';

const GL = {
  canvas: null, gl: null, quad: null, tex: null, programs: {}, warned: false, _support: undefined,
  ensure() {
    if (this.gl) return this.gl;
    if (this._support === false) return null;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false, depth: false, stencil: false })
        || c.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false, depth: false, stencil: false });
      if (!gl) { this._support = false; return null; }
      this.canvas = c; this.gl = gl; this._support = true;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.quad = buf;
      this.tex = [gl.createTexture(), gl.createTexture()];
      for (const t of this.tex) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      return gl;
    } catch (e) { this._support = false; return null; }
  },
  supported() { return !!this.ensure(); },
  /* compile once per shader, cache the program + uniform locations (null = failed, do not retry) */
  compile(name, glsl) {
    if (name in this.programs) return this.programs[name];
    const gl = this.gl;
    const one = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('compile ' + name + ': ' + (log || 'unknown error'));
      }
      return sh;
    };
    try {
      const vs = one(gl.VERTEX_SHADER, VERT);
      const fs = one(gl.FRAGMENT_SHADER, HEAD + '\n' + glsl + '\n' + TAIL);
      const pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link ' + name + ': ' + (gl.getProgramInfoLog(pr) || 'unknown error'));
      const P = { program: pr, loc: { progress: gl.getUniformLocation(pr, 'progress'), ratio: gl.getUniformLocation(pr, 'ratio'), from: gl.getUniformLocation(pr, 'from'), to: gl.getUniformLocation(pr, 'to'), aPos: gl.getAttribLocation(pr, 'aPos'), params: {} } };
      this.programs[name] = P;
      return P;
    } catch (e) {
      this.programs[name] = null;
      if (!this.warned) { this.warned = true; console.warn('AURA gltrans: ' + (e && e.message ? e.message : e)); }
      return null;
    }
  },
  /* Render the transition into this.canvas; returns true on success, false on any
     WebGL failure (caller falls back to a plain crossfade). Deterministic: progress
     and params are pure functions of the plan time, no Math.random / Date.now here. */
  render(name, glsl, A, B, p, params, cw, ch) {
    const gl = this.ensure();
    if (!gl || gl.isContextLost() || !A || !B || !cw || !ch) return false;
    const P = this.compile(name, glsl);
    if (!P) return false;
    try {
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(P.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, B);
      gl.uniform1i(P.loc.from, 0);
      gl.uniform1i(P.loc.to, 1);
      gl.uniform1f(P.loc.progress, p);
      gl.uniform1f(P.loc.ratio, cw / ch);
      for (const k of Object.keys(params || {})) {
        const v = params[k];
        if (P.loc.params[k] === undefined) P.loc.params[k] = gl.getUniformLocation(P.program, k);
        const loc = P.loc.params[k];
        if (!loc) continue;
        if (typeof v === 'number') gl.uniform1f(loc, v);
        else if (Array.isArray(v) && v.length >= 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(P.loc.aPos);
      gl.vertexAttribPointer(P.loc.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(P.loc.aPos);
      return true;
    } catch (e) {
      if (!this.warned) { this.warned = true; console.warn('AURA gltrans render: ' + (e && e.message ? e.message : e)); }
      return false;
    }
  },
};
J.gltrans = GL;
})();
