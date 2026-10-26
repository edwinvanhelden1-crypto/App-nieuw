import { toSvg, isColored } from './svg.js';

const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

const innerCache = new Map();
export function innerOf(item) {
  if (!innerCache.has(item.id)) innerCache.set(item.id, item.draw());
  return innerCache.get(item.id);
}

export const hasColor = (item) => !item.src && isColored(innerOf(item));
export const thumbUrl = (item) => item.src || svgUrl(toSvg(innerOf(item), { width: 2.5, colored: true }));

// Split a drawing into at most `max` steps for the learning mode. Clip paths
// are needed by every step, so they are kept in front of each one.
export function splitSteps(inner, max = 12) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><g>${inner}</g></svg>`, 'image/svg+xml');
  const children = [...doc.documentElement.firstChild.children];
  const ser = new XMLSerializer();
  const strip = (s) => s.replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  const keep = children.filter((c) => c.tagName === 'clipPath').map((c) => strip(ser.serializeToString(c))).join('');
  const parts = children.filter((c) => c.tagName !== 'clipPath').map((c) => strip(ser.serializeToString(c)));
  const size = Math.ceil(parts.length / max);
  const steps = [];
  for (let i = 0; i < parts.length; i += size) steps.push(parts.slice(i, i + size).join(''));
  return { keep, steps };
}

export function stepInner({ keep, steps }, n) {
  const done = steps.slice(0, n).join('');
  const current = steps[n] || '';
  return keep + `<g opacity=".3">${done}</g>` + current;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Afbeelding kon niet geladen worden'));
    img.src = src;
  });

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Turn dark pixels into the chosen line colour and light pixels into transparency.
function darknessToAlpha(ctx, w, h, color, gain = 1) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
    px[i + 3] = Math.min(255, (255 - lum) * gain);
  }
  ctx.putImageData(data, 0, 0);
}

// Coloured drawings keep their colours; only the white paper becomes transparent.
function whiteToAlpha(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const d = 255 - Math.min(px[i], px[i + 1], px[i + 2]);
    px[i + 3] = Math.min(255, d * 5);
  }
  ctx.putImageData(data, 0, 0);
}

export async function renderSvgTo(canvas, inner, { color, width, mode, kleur }) {
  const size = 1200;
  canvas.width = size;
  canvas.height = size;
  const colored = kleur && isColored(inner);
  const svg = toSvg(inner, { color: colored ? color : '#000000', width, mode, bg: true, colored });
  const img = await loadImage(svgUrl(svg.replace('width="200" height="200"', `width="${size}" height="${size}"`)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  if (colored) whiteToAlpha(ctx, size, size);
  else darknessToAlpha(ctx, size, size, color);
}

// Marks the plain background around the subject: a flood fill from the image
// border over pixels that look like the border colour.
function backgroundMask(px, w, h, tolerance = 42) {
  const border = [];
  for (let x = 0; x < w; x += 4) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 4) border.push(y * w, y * w + w - 1);
  // Reference colour: the most common (rounded) border colour.
  const counts = new Map();
  for (const j of border) {
    if (px[j * 4 + 3] < 20) continue; // transparent pixels are background anyway
    const k = ((px[j * 4] >> 4) << 8) | ((px[j * 4 + 1] >> 4) << 4) | (px[j * 4 + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = 0, ref = 0xfff;
  for (const [k, n] of counts) if (n > best) { best = n; ref = k; }
  const rr = ((ref >> 8) << 4) + 8, rg = (((ref >> 4) & 15) << 4) + 8, rb = ((ref & 15) << 4) + 8;
  const close = (j) => {
    const o = j * 4;
    if (px[o + 3] < 20) return true;
    const dr = px[o] - rr, dg = px[o + 1] - rg, db = px[o + 2] - rb;
    return dr * dr + dg * dg + db * db < tolerance * tolerance;
  };
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const push = (j) => { if (!mask[j] && close(j)) { mask[j] = 1; queue[tail++] = j; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const j = queue[head++], x = j % w;
    if (x > 0) push(j - 1);
    if (x < w - 1) push(j + 1);
    if (j >= w) push(j - w);
    if (j < w * (h - 1)) push(j + w);
  }
  return mask;
}

// process: 'origineel' (as is), 'schets' (colours removed, shading kept),
// 'lijnen' (only the outlines), 'randen' (edge detection), 'zwartwit' (threshold).
export async function renderPhotoTo(canvas, img, { color, process, level, removeBg }) {
  const max = 1200;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const bg = removeBg ? backgroundMask(px, w, h) : null;
  if (process === 'origineel') {
    if (bg) for (let j = 0; j < w * h; j++) if (bg[j]) px[j * 4 + 3] = 0;
    ctx.putImageData(data, 0, 0);
    return;
  }
  const lum = new Float32Array(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const a = px[i + 3] / 255;
    lum[j] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
  }
  const t = level / 100; // 0..1
  const out = new Uint8ClampedArray(px.length);
  const [r, g, b] = hexToRgb(color);
  let alphaAt;
  if (process === 'lijnen') {
    // Adaptive threshold: a pixel is part of a line when it is clearly darker
    // than its surroundings, so flat coloured areas disappear and outlines stay.
    const rad = Math.max(3, Math.round(Math.min(w, h) / 90));
    const W1 = w + 1;
    const sum = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += lum[y * w + x];
        sum[(y + 1) * W1 + x + 1] = sum[y * W1 + x + 1] + rowSum;
      }
    }
    const offset = 6 + (1 - t) * 34;
    alphaAt = (x, y, j) => {
      const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1), y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1);
      const mean = (sum[y1 * W1 + x1] - sum[y0 * W1 + x1] - sum[y1 * W1 + x0] + sum[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
      const d = mean - offset - lum[j];
      return d > 0 ? Math.min(255, 110 + d * 10) : 0;
    };
  } else if (process === 'randen') {
    const cut = 40 + (1 - t) * 260;
    alphaAt = (x, y, j) => {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return 0;
      const gx = -lum[j - w - 1] - 2 * lum[j - 1] - lum[j + w - 1] + lum[j - w + 1] + 2 * lum[j + 1] + lum[j + w + 1];
      const gy = -lum[j - w - 1] - 2 * lum[j - w] - lum[j - w + 1] + lum[j + w - 1] + 2 * lum[j + w] + lum[j + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      return mag > cut ? Math.min(255, (mag - cut) * 2.5 + 120) : 0;
    };
  } else if (process === 'zwartwit') {
    alphaAt = (x, y, j) => (lum[j] < 40 + t * 180 ? 255 : 0);
  } else {
    alphaAt = (x, y, j) => Math.max(0, Math.min(255, (255 - lum[j]) * (0.6 + t * 2.4) - (1 - t) * 30));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = y * w + x, o = j * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
      out[o + 3] = bg && bg[j] ? 0 : alphaAt(x, y, j);
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

export { loadImage };
