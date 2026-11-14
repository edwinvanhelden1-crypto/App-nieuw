// Gezichtsnet-hulpmiddelen: driehoeken, gaten (ogen/mond) vullen, uitlijnen en gladstrijken.
export const N_LANDMARKS = 478;

// Randlussen van het canonieke MediaPipe-gezichtsnet (de gaten in het net).
export const LOOP_EYE_A = [157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33, 246, 161, 160, 159, 158];
export const LOOP_EYE_B = [387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386];
export const LOOP_MOUTH = [14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317];
export const LOOP_OVAL = [136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338, 10, 109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172];

const LOOPS = [LOOP_EYE_A, LOOP_EYE_B, LOOP_MOUTH];
// Index van het extra middelpunt per lus (achter de 478 landmarks).
const CENTER = [N_LANDMARKS, N_LANDMARKS + 1, N_LANDMARKS + 2];
export const N_POINTS = N_LANDMARKS + LOOPS.length;

// Spiegelpunt (links ↔ rechts) per landmark, berekend op een frontaal gezicht.
const MIRROR = [0,1,2,248,4,5,6,390,8,9,10,11,12,13,14,15,16,17,18,19,250,251,252,253,254,255,256,257,258,259,260,261,262,249,264,265,266,267,268,269,304,271,310,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,306,308,293,294,295,296,297,298,299,300,301,302,303,272,305,308,307,308,309,310,311,312,313,314,315,316,317,318,319,321,321,322,323,94,324,324,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,463,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,263,360,361,463,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,151,152,380,382,362,383,384,385,386,387,388,389,373,164,391,392,393,168,394,395,396,397,362,399,175,400,401,402,403,404,405,406,415,407,408,410,411,412,413,414,415,416,417,418,195,419,197,420,199,200,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,388,467,3,33,20,21,22,23,24,25,26,27,28,29,30,31,32,130,34,35,36,37,38,39,40,41,74,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,76,63,64,65,66,67,68,69,70,71,72,73,40,75,61,77,62,79,42,81,82,83,84,85,86,87,88,89,90,90,92,93,96,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,155,134,135,136,137,138,139,140,141,142,143,144,145,77,147,148,149,150,153,154,154,156,157,158,159,160,246,162,7,165,166,167,169,170,171,172,154,174,176,177,178,179,180,181,182,184,185,185,186,187,188,189,190,183,192,193,194,196,198,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,133,244,245,246,247];

// Driehoeken: 0 = gezicht, 1 = oog A, 2 = oog B, 3 = mond.
const TAG_FACE = 0, TAG_EYE_A = 1, TAG_EYE_B = 2, TAG_MOUTH = 3;
let baseTriangles = null;

/** Haalt de 852 driehoeken uit de tesselatie (die in driehoek-volgorde staat). */
export function initMesh(tesselation) {
  const tris = [];
  for (let i = 0; i + 2 < tesselation.length; i += 3) {
    tris.push(tesselation[i].start, tesselation[i + 1].start, tesselation[i + 2].start);
  }
  baseTriangles = tris;
}

const triCache = new Map();
/** Driehoeksindices (+ soort), optioneel met de ogen en/of mond van de bron opgevuld. */
export function triangles({ fillEyes, fillMouth }) {
  const key = `${+fillEyes}${+fillMouth}`;
  if (triCache.has(key)) return triCache.get(key);
  const idx = baseTriangles.slice();
  const tags = new Array(baseTriangles.length / 3).fill(TAG_FACE);
  const fan = (loop, c, tag) => {
    for (let i = 0; i < loop.length; i++) {
      idx.push(c, loop[i], loop[(i + 1) % loop.length]);
      tags.push(tag);
    }
  };
  if (fillEyes) { fan(LOOP_EYE_A, CENTER[0], TAG_EYE_A); fan(LOOP_EYE_B, CENTER[1], TAG_EYE_B); }
  if (fillMouth) fan(LOOP_MOUTH, CENTER[2], TAG_MOUTH);
  const res = { idx: new Uint16Array(idx), tags: new Uint8Array(tags) };
  triCache.set(key, res);
  return res;
}

// Landmarks die de herkenbaarheid bepalen: hier blijven de plooien van de bron.
const KEEP = [
  // wenkbrauwen
  70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
  // ogen (randen)
  ...LOOP_EYE_A, ...LOOP_EYE_B,
  // neus
  1, 2, 4, 5, 6, 19, 94, 97, 98, 326, 327, 195, 197, 168, 45, 275, 220, 440, 48, 278, 64, 294, 129, 358, 102, 331, 115, 344, 218, 438, 79, 309,
  // lippen
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409, ...LOOP_MOUTH,
];
const REGION = new Float32Array(N_POINTS).fill(1);
for (const i of KEEP) REGION[i] = 0;
for (const c of CENTER) REGION[c] = 0;

const area = (p, a, b, c) =>
  (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) - (p[b * 2 + 1] - p[a * 2 + 1]) * (p[c * 2] - p[a * 2]);

/**
 * Bouwt de hoekpunten voor de warp.
 * - Driehoeken die in het doel van de camera af gedraaid zijn (achter de neus of
 *   wang) worden overgeslagen, zodat er niets "dubbel" over elkaar valt.
 * - Is een deel van het brongezicht weggedraaid (bron kijkt opzij), dan wordt de
 *   gespiegelde, wel zichtbare kant van de bron gebruikt.
 * - Ogen en mond krijgen een gewicht, zodat knipperen en praten van het doel zichtbaar blijven.
 */
export function buildGeometry(src, dst, srcW, srcH, opts, weights = {}) {
  const { idx, tags } = triangles(opts);
  const n = tags.length;
  const pos = new Float32Array(n * 6);
  const uv = new Float32Array(n * 6);
  const alpha = new Float32Array(n * 3);
  const region = new Float32Array(n * 3);
  const wTag = [1, weights.eyeA ?? 1, weights.eyeB ?? 1, weights.mouth ?? 1];
  let v = 0;
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    const tag = tags[t];
    let ua = a, ub = b, uc = c;
    if (tag === TAG_FACE) {
      // Canonieke driehoeken hebben negatieve oppervlakte (y naar beneden) als ze naar de camera wijzen.
      if (area(dst, a, b, c) >= 0) continue;
      const own = Math.max(0, -area(src, a, b, c));
      const ma = MIRROR[a], mb = MIRROR[b], mc = MIRROR[c];
      const mir = Math.max(0, area(src, ma, mb, mc)); // gespiegeld = omgekeerde draairichting
      if (own < 0.45 * mir) { ua = ma; ub = mb; uc = mc; }
    }
    const w = wTag[tag];
    if (w <= 0.001) continue;
    for (const [p, q] of [[a, ua], [b, ub], [c, uc]]) {
      pos[v * 2] = dst[p * 2];
      pos[v * 2 + 1] = dst[p * 2 + 1];
      uv[v * 2] = src[q * 2] / srcW;
      uv[v * 2 + 1] = src[q * 2 + 1] / srcH;
      alpha[v] = w;
      region[v] = tag === TAG_FACE ? REGION[p] : 0;
      v++;
    }
  }
  return { pos, uv, alpha, region, count: v };
}

const dist = (p, a, b) => Math.hypot(p[a * 2] - p[b * 2], p[a * 2 + 1] - p[b * 2 + 1]);
/** Hoe ver de ogen en mond open zijn (ten opzichte van de breedte). */
export function openness(p) {
  return {
    eyeA: dist(p, 159, 145) / (dist(p, 33, 133) || 1),
    eyeB: dist(p, 386, 374) / (dist(p, 263, 362) || 1),
    mouth: dist(p, 13, 14) / (dist(p, 61, 291) || 1),
  };
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/**
 * Expressie overnemen: knippert het doel, dan verdwijnt het oog van de bron en zie je
 * het ooglid van het doel. Gaat de mond van het doel verder open dan die van de bron,
 * dan komen tanden en tong van het doel in beeld.
 */
export function expressionWeights(src, dst) {
  const s = openness(src), d = openness(dst);
  return {
    eyeA: smooth(0.35, 0.75, d.eyeA / Math.max(s.eyeA, 0.05)),
    eyeB: smooth(0.35, 0.75, d.eyeB / Math.max(s.eyeB, 0.05)),
    mouth: 1 - smooth(0.04, 0.18, d.mouth - s.mouth),
  };
}

/** Voegt de middelpunten van de lussen toe: 478 → 481 punten (x,y paren). */
export function withCenters(pts) {
  const out = new Float32Array(N_POINTS * 2);
  out.set(pts.subarray(0, N_LANDMARKS * 2));
  LOOPS.forEach((loop, k) => {
    let x = 0, y = 0;
    for (const i of loop) { x += pts[i * 2]; y += pts[i * 2 + 1]; }
    out[CENTER[k] * 2] = x / loop.length;
    out[CENTER[k] * 2 + 1] = y / loop.length;
  });
  return out;
}

/** Zet MediaPipe-landmarks (genormaliseerd) om naar pixels. */
export function toPixels(landmarks, w, h) {
  const pts = new Float32Array(N_LANDMARKS * 2);
  for (let i = 0; i < N_LANDMARKS; i++) {
    pts[i * 2] = landmarks[i].x * w;
    pts[i * 2 + 1] = landmarks[i].y * h;
  }
  return pts;
}

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < N_LANDMARKS; i++) {
    const x = pts[i * 2], y = pts[i * 2 + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) };
}

/** Grove hoofddraaiing: 0 = recht vooruit, ±1 = volledig opzij. */
export function yaw(pts) {
  const l = pts[234 * 2], r = pts[454 * 2], n = pts[1 * 2];
  return ((n - l) / (r - l || 1)) * 2 - 1;
}

/** Gelijkvormigheidstransformatie (schaal, rotatie, verschuiving) die a zo goed mogelijk op b legt. */
function similarity(a, b) {
  const n = N_LANDMARKS;
  let ax = 0, ay = 0, bx = 0, by = 0;
  for (let i = 0; i < n; i++) { ax += a[i * 2]; ay += a[i * 2 + 1]; bx += b[i * 2]; by += b[i * 2 + 1]; }
  ax /= n; ay /= n; bx /= n; by /= n;
  let sxx = 0, sxy = 0, norm = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i * 2] - ax, y = a[i * 2 + 1] - ay;
    const u = b[i * 2] - bx, v = b[i * 2 + 1] - by;
    sxx += x * u + y * v;
    sxy += x * v - y * u;
    norm += x * x + y * y;
  }
  const c = sxx / norm, s = sxy / norm;
  return (x, y) => [c * (x - ax) - s * (y - ay) + bx, s * (x - ax) + c * (y - ay) + by];
}

const OVAL_SET = new Set(LOOP_OVAL);
/**
 * Mengt de vorm van het brongezicht in de doelpunten (0 = vorm van doel, 1 = vorm van bron).
 * De buitenrand blijft op het doel liggen zodat er geen dubbele kaaklijn ontstaat.
 */
export function blendShape(dst, src, amount) {
  if (!amount) return dst;
  const t = similarity(src, dst);
  const out = new Float32Array(dst);
  for (let i = 0; i < N_LANDMARKS; i++) {
    if (OVAL_SET.has(i)) continue;
    const [x, y] = t(src[i * 2], src[i * 2 + 1]);
    out[i * 2] += (x - dst[i * 2]) * amount;
    out[i * 2 + 1] += (y - dst[i * 2 + 1]) * amount;
  }
  return out;
}

// ---------- Stabilisatie (One-Euro-filter) ----------
// Weinig beweging → sterk filteren (geen trillen); snelle beweging → nauwelijks (geen naijlen).

const lowpass = (dt, cutoff) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

class OneEuro {
  constructor(n) {
    this.x = new Float64Array(n);
    this.dx = new Float64Array(n);
    this.init = false;
  }
  /** values: nieuwe waarden; speedScale: deelt de snelheid (bv. door de gezichtsgrootte). */
  filter(values, dt, minCutoff, beta, speedScale = 1) {
    const n = values.length;
    if (!this.init || dt <= 0 || dt > 0.5) {
      this.x.set(values);
      this.dx.fill(0);
      this.init = true;
      return this.x;
    }
    const aD = lowpass(dt, 1.0);
    for (let i = 0; i < n; i++) {
      const d = (values[i] - this.x[i]) / dt;
      this.dx[i] += (d - this.dx[i]) * aD;
      const scale = typeof speedScale === 'number' ? speedScale : speedScale[i];
      const cutoff = minCutoff + beta * Math.abs(this.dx[i]) / scale;
      this.x[i] += (values[i] - this.x[i]) * lowpass(dt, cutoff);
    }
    return this.x;
  }
}

/** Splitst landmarks in houding (midden, grootte, hoek) en vorm in een eigen assenstelsel. */
function decompose(pts) {
  const n = N_LANDMARKS;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
  cx /= n; cy /= n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (pts[i * 2] - cx) ** 2 + (pts[i * 2 + 1] - cy) ** 2;
  const scale = Math.sqrt(ss / n) || 1;
  const angle = Math.atan2(pts[263 * 2 + 1] - pts[33 * 2 + 1], pts[263 * 2] - pts[33 * 2]);
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const local = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = (pts[i * 2] - cx) / scale, y = (pts[i * 2 + 1] - cy) / scale;
    local[i * 2] = c * x - s * y;
    local[i * 2 + 1] = s * x + c * y;
  }
  return { pose: [cx, cy, scale, angle], local };
}

function compose(pose, local) {
  const [cx, cy, scale, angle] = pose;
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = new Float32Array(N_LANDMARKS * 2);
  for (let i = 0; i < N_LANDMARKS; i++) {
    const x = local[i * 2], y = local[i * 2 + 1];
    out[i * 2] = (c * x - s * y) * scale + cx;
    out[i * 2 + 1] = (s * x + c * y) * scale + cy;
  }
  return out;
}

/**
 * Stabiliseert gezichten tussen videoframes en koppelt ze aan het vorige frame
 * (MediaPipe garandeert geen vaste volgorde).
 */
export class Smoother {
  constructor() { this.tracks = []; this.last = 0; }
  reset() { this.tracks = []; this.last = 0; }

  /** faces: landmarks per gezicht; time: seconden; stability: 0 (snel) .. 1 (zeer stabiel). */
  update(faces, time = performance.now() / 1000, stability = 0.6) {
    const dt = this.last ? time - this.last : 0;
    this.last = time;
    const prev = this.tracks;
    const used = new Set();
    const lerp = (a, b) => a + (b - a) * stability;
    const next = faces.map((pts) => {
      const b = bounds(pts);
      let best = null, bestD = Infinity;
      for (const t of prev) {
        if (used.has(t)) continue;
        const d = Math.hypot(t.b.cx - b.cx, t.b.cy - b.cy);
        if (d < bestD && d < b.size * 0.6) { bestD = d; best = t; }
      }
      const track = best ?? { pose: new OneEuro(4), local: new OneEuro(N_LANDMARKS * 2) };
      if (best) used.add(best);
      track.b = b;
      const { pose, local } = decompose(pts);
      // Hoek omwikkelen zodat -π/π geen sprong geeft.
      if (track.pose.init) {
        const prevA = track.pose.x[3];
        pose[3] = prevA + Math.atan2(Math.sin(pose[3] - prevA), Math.cos(pose[3] - prevA));
      }
      // Snelheid van positie en grootte relatief aan de gezichtsgrootte.
      const sp = track.pose.filter(pose, dt, lerp(2, 0.15), 3, [pose[2], pose[2], pose[2], 1]);
      const fp = [sp[0], sp[1], sp[2], sp[3]];
      const fl = track.local.filter(local, dt, lerp(4, 0.5), 1, 1);
      track.out = compose(fp, fl);
      return track;
    });
    this.tracks = next;
    return next.map((t) => t.out);
  }
}
