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
/** Driehoeksindices, optioneel met de ogen en/of mond van de bron opgevuld. */
export function triangles({ fillEyes, fillMouth }) {
  const key = `${+fillEyes}${+fillMouth}`;
  if (triCache.has(key)) return triCache.get(key);
  const out = baseTriangles.slice();
  const fan = (loop, c) => {
    for (let i = 0; i < loop.length; i++) out.push(c, loop[i], loop[(i + 1) % loop.length]);
  };
  if (fillEyes) { fan(LOOP_EYE_A, CENTER[0]); fan(LOOP_EYE_B, CENTER[1]); }
  if (fillMouth) fan(LOOP_MOUTH, CENTER[2]);
  const arr = new Uint16Array(out);
  triCache.set(key, arr);
  return arr;
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

/**
 * Strijkt bewegende landmarks glad tussen videoframes en koppelt gezichten aan
 * het vorige frame (MediaPipe garandeert geen vaste volgorde).
 */
export class Smoother {
  constructor() { this.tracks = []; }
  reset() { this.tracks = []; }
  update(faces) {
    const prev = this.tracks;
    const used = new Set();
    const next = faces.map((pts) => {
      const b = bounds(pts);
      let best = null, bestD = Infinity;
      for (const t of prev) {
        if (used.has(t)) continue;
        const d = Math.hypot(t.b.cx - b.cx, t.b.cy - b.cy);
        if (d < bestD && d < b.size * 0.6) { bestD = d; best = t; }
      }
      if (!best) return { pts: new Float32Array(pts), b };
      used.add(best);
      // Snelle beweging → weinig gladstrijken (geen naijlen); stilstand → veel (geen trillen).
      const motion = bestD / (b.size || 1);
      const alpha = Math.min(1, 0.3 + motion * 12);
      const out = best.pts;
      for (let i = 0; i < out.length; i++) out[i] += (pts[i] - out[i]) * alpha;
      return { pts: out, b };
    });
    this.tracks = next;
    return next.map((t) => t.pts);
  }
}
