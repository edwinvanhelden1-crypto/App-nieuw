// WebGL2-motor die een brongezicht op een doelgezicht legt.
//
// Per gezicht:
//  1. Warp:      de driehoeken van het brongezicht worden naar de posities van het
//                doelgezicht vervormd (W, alfa = 1 binnen het gezicht).
//  2. Kleur:     met "genormaliseerde vervaging" wordt de lokale gemiddelde kleur van
//                doel en bron binnen het gezicht berekend; het verschil wordt bij de bron
//                opgeteld. Zo nemen huidskleur en belichting het doel over.
//  3. Masker:    de dekking van W wordt vervaagd en iets ingekrompen voor een zachte rand.
//  4. Samenvoegen met het doelbeeld.
//
// Afspraak: in alle textures en framebuffers is rij 0 de bovenkant van het beeld; pas
// bij het tekenen op het scherm wordt de y-as omgedraaid.
import { buildGeometry } from './mesh.js';

const QUAD_VS = `#version 300 es
in vec2 aPos;
uniform float uFlip;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos.x, aPos.y * uFlip, 0.0, 1.0);
}`;

const WARP_VS = `#version 300 es
in vec2 aPos;
in vec2 aUV;
in float aA;
uniform vec2 uRes;
out vec2 vUV;
out float vA;
void main() {
  vUV = aUV;
  vA = aA;
  gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
`;

const WARP_FS = `${HEAD}
in float vA;
uniform sampler2D uSrc;
// Voorvermenigvuldigd met het gewicht (ogen/mond kunnen deels doorzichtig zijn).
void main() { o = vec4(texture(uSrc, vUV).rgb * vA, vA); }`;

const COPY_FS = `${HEAD}
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUV).rgb, 1.0); }`;

// Doelkleur vermenigvuldigd met de dekking van het gewarpte gezicht.
const PREMUL_FS = `${HEAD}
uniform sampler2D uT;
uniform sampler2D uW;
void main() {
  float a = texture(uW, vUV).a;
  o = vec4(texture(uT, vUV).rgb * a, a);
}`;

// Helderheid² van doel (r) en bron (g), gewogen met de dekking: voor het contrast.
const SQUARE_FS = `${HEAD}
uniform sampler2D uT;
uniform sampler2D uW;
const vec3 L = vec3(0.299, 0.587, 0.114);
void main() {
  vec4 w = texture(uW, vUV);
  float lt = dot(texture(uT, vUV).rgb, L);
  float ls = w.a > 0.001 ? dot(w.rgb / w.a, L) : 0.0;
  o = vec4(lt * lt * w.a, ls * ls * w.a, 0.0, w.a);
}`;

const LOD_FS = `${HEAD}
uniform sampler2D uTex;
uniform float uLod;
uniform float uAlphaOnly;
void main() {
  vec4 c = textureLod(uTex, vUV, uLod);
  o = uAlphaOnly > 0.5 ? vec4(c.a) : c;
}`;

const BLUR_FS = `${HEAD}
uniform sampler2D uTex;
uniform vec2 uStep;
void main() {
  vec4 s = vec4(0.0);
  float ws = 0.0;
  for (int i = -12; i <= 12; i++) {
    float f = float(i);
    float w = exp(-f * f / 32.0);
    s += texture(uTex, vUV + uStep * f) * w;
    ws += w;
  }
  o = s / ws;
}`;

const COMPOSITE_FS = `${HEAD}
uniform sampler2D uT;
uniform sampler2D uW;
uniform sampler2D uMask;
uniform sampler2D uMT;
uniform sampler2D uMS;
uniform sampler2D uSQ;
uniform float uOpacity;
uniform float uColor;
uniform float uContrast;
const vec3 L = vec3(0.299, 0.587, 0.114);
void main() {
  vec4 t = texture(uT, vUV);
  vec4 w = texture(uW, vUV);
  // Zachte rand × gewicht (ogen/mond van het doel blijven zichtbaar waar het gewicht laag is).
  float m = smoothstep(0.5, 0.98, texture(uMask, vUV).r) * clamp(w.a, 0.0, 1.0) * uOpacity;
  vec4 a = texture(uMT, vUV);
  vec4 b = texture(uMS, vUV);
  vec4 q = texture(uSQ, vUV);
  vec3 meanT = a.rgb / max(a.a, 1e-4);
  vec3 meanS = b.rgb / max(b.a, 1e-4);
  vec3 src = w.a > 0.001 ? w.rgb / w.a : t.rgb;
  // Lokaal contrast: verhouding van de standaardafwijking van de helderheid.
  float lT = dot(meanT, L), lS = dot(meanS, L);
  float sdT = sqrt(max(q.r / max(q.a, 1e-4) - lT * lT, 1e-5));
  float sdS = sqrt(max(q.g / max(q.a, 1e-4) - lS * lS, 1e-5));
  float g = mix(1.0, clamp(sdT / sdS, 0.6, 1.6), uContrast);
  // Gemiddelde kleur én contrast van het doel overnemen.
  vec3 matched = meanT + (src - meanS) * g;
  vec3 res = clamp(mix(src, matched, uColor), 0.0, 1.0);
  o = vec4(mix(t.rgb, res, m), 1.0);
}`;

export const DEFAULTS = {
  opacity: 1,      // 0..1   hoeveel van het nieuwe gezicht zichtbaar is
  color: 1,        // 0..1   kleur/belichting van het doel overnemen
  contrast: 1,     // 0..1   contrast van het doel overnemen
  feather: 0.4,    // 0..1   zachtheid van de rand
  fillEyes: true,  // ogen van de bron gebruiken (uit = ogen van het doel, behoudt blik)
  fillMouth: false // mond van de bron gebruiken (uit = mond van het doel, behoudt expressie)
};

export class SwapEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
    });
    if (!gl) throw new Error('Je browser ondersteunt geen WebGL2.');
    this.gl = gl;

    // Halve-float-buffers geven genoeg precisie voor contrastberekening.
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    if (this.float) gl.getExtension('OES_texture_float_linear');

    this.progs = {
      square: this.program(QUAD_VS, SQUARE_FS),
      warp: this.program(WARP_VS, WARP_FS),
      copy: this.program(QUAD_VS, COPY_FS),
      premul: this.program(QUAD_VS, PREMUL_FS),
      lod: this.program(QUAD_VS, LOD_FS),
      blur: this.program(QUAD_VS, BLUR_FS),
      composite: this.program(QUAD_VS, COMPOSITE_FS),
    };

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.posBuf = gl.createBuffer();
    this.uvBuf = gl.createBuffer();
    this.alphaBuf = gl.createBuffer();

    this.target = this.texture(1, 1, true);
    this.targetSize = [1, 1];
    this.full = null;
    this.low = new Map();
    this.sources = new Map();
    this.w = 0;
    this.h = 0;
  }

  // ---------- WebGL-hulpjes ----------

  program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uni = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      uni[name] = gl.getUniformLocation(p, name);
    }
    return { p, uni, aPos: gl.getAttribLocation(p, 'aPos'), aUV: gl.getAttribLocation(p, 'aUV'), aA: gl.getAttribLocation(p, 'aA') };
  }

  texture(w, h, mip = false, float = false) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  target_(w, h, mip = false, float = false) {
    const gl = this.gl;
    const tex = this.texture(w, h, mip, float && this.float);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  freeTarget(t) {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fbo);
  }

  upload(tex, source, mip) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  }

  bindTex(prog, name, tex, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.uni[name], unit);
  }

  /** Tekent een schermvullend vlak in `dest` (null = het canvas). */
  pass(prog, dest, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest ? dest.fbo : null);
    gl.viewport(0, 0, dest ? dest.w : this.w, dest ? dest.h : this.h);
    gl.useProgram(prog.p);
    gl.uniform1f(prog.uni.uFlip, dest ? 1 : -1);
    setup(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // Ontkoppel textures zodat een volgende pass er weer naartoe kan tekenen.
    for (let u = 0; u < 6; u++) {
      gl.activeTexture(gl.TEXTURE0 + u);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  // ---------- Publieke API ----------

  /** Stelt de uitvoergrootte in (in pixels). */
  setSize(w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.full) [this.full.warp, this.full.premul, this.full.square, ...this.full.out].forEach((t) => this.freeTarget(t));
    this.full = {
      warp: this.target_(w, h, true),
      premul: this.target_(w, h, true, true),
      square: this.target_(w, h, true, true),
      out: [this.target_(w, h), this.target_(w, h)], // afwisselend in tekenen
    };
  }

  /** Laadt het doelbeeld (foto, videoframe, camerabeeld). */
  setTarget(source, naturalW, naturalH, { mipmap = false } = {}) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    this.upload(this.target, source, mipmap);
    this.targetSize = [naturalW, naturalH];
  }

  /** Geeft (en onthoudt) een texture voor een brongezicht. */
  sourceTexture(key, image) {
    let tex = this.sources.get(key);
    if (!tex) {
      tex = this.texture(1, 1, true);
      this.upload(tex, image, true);
      this.sources.set(key, tex);
    }
    return tex;
  }

  forgetSource(key) {
    const tex = this.sources.get(key);
    if (tex) this.gl.deleteTexture(tex);
    this.sources.delete(key);
  }

  lowTargets(key, w, h) {
    const k = `${key}:${w}x${h}`;
    let set = this.low.get(k);
    if (!set) {
      set = { a: this.target_(w, h, false, true), b: this.target_(w, h, false, true), c: this.target_(w, h, false, true), tmp: this.target_(w, h, false, true) };
      this.low.set(k, set);
      if (this.low.size > 12) {
        const [oldKey, old] = this.low.entries().next().value;
        Object.values(old).forEach((t) => this.freeTarget(t));
        this.low.delete(oldKey);
      }
    }
    return set;
  }

  blur(src, tmp, sigmaTexels) {
    // 25 taps met sigma = 4 taps; de stapgrootte schaalt mee met de gewenste sigma.
    const step = Math.max(0.25, sigmaTexels / 4);
    this.pass(this.progs.blur, tmp, (p) => {
      this.bindTex(p, 'uTex', src.tex, 0);
      this.gl.uniform2f(p.uni.uStep, step / src.w, 0);
    });
    this.pass(this.progs.blur, src, (p) => {
      this.bindTex(p, 'uTex', tmp.tex, 0);
      this.gl.uniform2f(p.uni.uStep, 0, step / src.h);
    });
  }

  downsample(srcTex, dest, lod, alphaOnly) {
    this.pass(this.progs.lod, dest, (p) => {
      this.bindTex(p, 'uTex', srcTex, 0);
      this.gl.uniform1f(p.uni.uLod, lod);
      this.gl.uniform1f(p.uni.uAlphaOnly, alphaOnly ? 1 : 0);
    });
  }

  /**
   * Rendert het doelbeeld met verwisselde gezichten.
   * faces: [{ tex, srcW, srcH, src: Float32Array(481*2) bronpixels, dst: Float32Array(481*2) uitvoerpixels, size }]
   */
  render(faces, settings = {}) {
    const gl = this.gl;
    const s = { ...DEFAULTS, ...settings };
    const { warp, premul, square, out } = this.full;
    let cur = this.target;
    let flip = 0;

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const maxLod = Math.floor(Math.log2(Math.max(this.w, this.h)));

    for (const f of faces) {
      // 1. Brongezicht vervormen naar de doelpositie.
      const geo = buildGeometry(f.src, f.dst, f.srcW, f.srcH, s, f.weights);
      const p = this.progs.warp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, warp.fbo);
      gl.viewport(0, 0, this.w, this.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p.p);
      gl.uniform2f(p.uni.uRes, this.w, this.h);
      this.bindTex(p, 'uSrc', f.tex, 0);
      const attr = (buf, loc, data, size) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      attr(this.posBuf, p.aPos, geo.pos, 2);
      attr(this.uvBuf, p.aUV, geo.uv, 2);
      attr(this.alphaBuf, p.aA, geo.alpha, 1);
      gl.drawArrays(gl.TRIANGLES, 0, geo.count);
      gl.disableVertexAttribArray(p.aUV);
      gl.disableVertexAttribArray(p.aA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, warp.tex);
      gl.generateMipmap(gl.TEXTURE_2D);

      // 2. Doelkleur × dekking, voor de kleurgemiddelden.
      this.pass(this.progs.premul, premul, (q) => {
        this.bindTex(q, 'uT', cur, 0);
        this.bindTex(q, 'uW', warp.tex, 1);
      });
      gl.bindTexture(gl.TEXTURE_2D, premul.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (this.float) {
        this.pass(this.progs.square, square, (q) => {
          this.bindTex(q, 'uT', cur, 0);
          this.bindTex(q, 'uW', warp.tex, 1);
        });
        gl.bindTexture(gl.TEXTURE_2D, square.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
      }

      const size = Math.max(8, f.size);
      // Kleur: gezicht ≈ 32 px breed, masker: gezicht ≈ 128 px breed.
      const lodC = Math.min(maxLod, Math.max(0, Math.round(Math.log2(size / 32))));
      const lodM = Math.min(maxLod, Math.max(0, Math.round(Math.log2(size / 128))));
      const dims = (lod) => [Math.max(1, this.w >> lod), Math.max(1, this.h >> lod)];

      const [cw, ch] = dims(lodC);
      const col = this.lowTargets('c', cw, ch);
      this.downsample(premul.tex, col.a, lodC, false);
      this.downsample(warp.tex, col.b, lodC, false);
      const sigmaC = (0.12 * size) / (1 << lodC);
      this.blur(col.a, col.tmp, sigmaC);
      this.blur(col.b, col.tmp, sigmaC);
      if (this.float) {
        this.downsample(square.tex, col.c, lodC, false);
        this.blur(col.c, col.tmp, sigmaC);
      }

      // 3. Zachte rand.
      const [mw, mh] = dims(lodM);
      const msk = this.lowTargets('m', mw, mh);
      this.downsample(warp.tex, msk.a, lodM, true);
      const sigmaM = ((0.008 + 0.06 * s.feather) * size) / (1 << lodM);
      this.blur(msk.a, msk.tmp, sigmaM);

      // 4. Samenvoegen.
      const dest = out[flip];
      flip = 1 - flip;
      this.pass(this.progs.composite, dest, (q) => {
        this.bindTex(q, 'uT', cur, 0);
        this.bindTex(q, 'uW', warp.tex, 1);
        this.bindTex(q, 'uMask', msk.a.tex, 2);
        this.bindTex(q, 'uMT', col.a.tex, 3);
        this.bindTex(q, 'uMS', col.b.tex, 4);
        this.bindTex(q, 'uSQ', col.c.tex, 5);
        gl.uniform1f(q.uni.uOpacity, s.opacity);
        gl.uniform1f(q.uni.uColor, s.color);
        gl.uniform1f(q.uni.uContrast, this.float ? s.contrast : 0);
      });
      cur = dest.tex;
    }

    this.pass(this.progs.copy, null, (q) => this.bindTex(q, 'uTex', cur, 0));
  }
}
