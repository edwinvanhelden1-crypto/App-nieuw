// Small helpers to write line drawings as SVG markup in a 200×200 view box.
// Strokes are inherited from the wrapper made by `toSvg`. Use `W` for shapes
// that should hide the lines behind them (white fill, made transparent later)
// and `FILL` for solid parts in the line colour.

export const W = 'fill="#fff"';
export const F = 'fill="FILL"';
// A fill that is white in line mode and `c` in colour mode.
export const K = (c) => `fill="#fff" data-k="${c}"`;

// Colour the plain white fills of a drawing in order of appearance; the last
// colour is reused for the rest, `null` keeps a fill white.
export function paint(markup, palette) {
  let i = 0;
  return markup.replace(/fill="#fff"(?! data-k)/g, () => {
    const c = palette[Math.min(i++, palette.length - 1)];
    return c ? `fill="#fff" data-k="${c}"` : 'fill="#fff"';
  });
}
export const isColored = (markup) => markup.includes('data-k="');

const n = (v) => +v.toFixed(1);
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

export const C = (x, y, r, a = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${a}/>`;
export const E = (x, y, rx, ry, a = '') => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" ${a}/>`;
export const P = (d, a = '') => `<path d="${d}" ${a}/>`;
export const L = (x1, y1, x2, y2, a = '') => P(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, a);
export const R = (x, y, w, h, rx = 0, a = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" ${a}/>`;
export const D = (x, y, r = 3) => C(x, y, r, 'fill="FILL" stroke="none"');
export const G = (s, t) => `<g transform="${t}">${s}</g>`;
export const T = (s, w) => `<g stroke-width="${w}">${s}</g>`;
export const POLY = (pts, closed = true, a = '') =>
  P('M' + pts.map(pt).join('L') + (closed ? 'Z' : ''), a);

// Mirror around the vertical centre line; `S` draws a shape and its mirror image.
export const M = (s) => G(s, 'matrix(-1 0 0 1 200 0)');
export const S = (s) => s + M(s);

// Repeat a shape `count` times around a centre point.
export const ROT = (s, count, cx = 100, cy = 100, offset = 0) => {
  let out = '';
  for (let i = 0; i < count; i++) out += G(s, `rotate(${n(offset + (360 / count) * i)} ${cx} ${cy})`);
  return out;
};

// Point at `deg` degrees clockwise from straight up.
export const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

// Smooth Catmull-Rom curve through points.
export function smooth(pts, closed = true, k = 1) {
  const len = pts.length;
  const get = (i) => (closed ? pts[(i + len) % len] : pts[Math.max(0, Math.min(len - 1, i))]);
  let d = 'M' + pt(pts[0]);
  const last = closed ? len : len - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}

export function spiral(cx, cy, r0, r1, turns, startDeg = 0) {
  const pts = [];
  const steps = Math.ceil(turns * 36);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(polar(cx, cy, r0 + (r1 - r0) * t, startDeg + t * turns * 360));
  }
  return P('M' + pts.map(pt).join('L'));
}

export function heart(x, y, s, a = '') {
  return P(
    `M${x} ${y + s * 0.9}C${x - s * 1.4} ${y} ${x - s * 0.8} ${y - s} ${x} ${y - s * 0.35}` +
      `C${x + s * 0.8} ${y - s} ${x + s * 1.4} ${y} ${x} ${y + s * 0.9}Z`,
    a,
  );
}

export function star(cx, cy, r1, r2, points = 5, a = '') {
  const pts = [];
  for (let i = 0; i < points * 2; i++) pts.push(polar(cx, cy, i % 2 ? r2 : r1, (180 / points) * i));
  return POLY(pts, true, a);
}

// Deterministic random numbers so every generated drawing stays the same.
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(next.range(lo, hi + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

// Wrap inner markup into a complete SVG document.
export function toSvg(inner, { color = '#111', width = 2.5, mode = 'lijn', bg = false, colored = false } = {}) {
  if (colored) inner = inner.replace(/fill="#fff" data-k="([^"]+)"/g, 'fill="$1"').replace(/stroke="#fff" data-ks="([^"]+)"/g, 'stroke="$1"');
  const dash = mode === 'stippel' ? 'stroke-dasharray="0.1 6"' : mode === 'streep' ? 'stroke-dasharray="7 6"' : '';
  const filter =
    mode === 'schets'
      ? '<filter id="sk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>'
      : '';
  const body = inner.replaceAll('FILL', color);
  const group = (extra) =>
    `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash} ${extra}>${body}</g>`;
  const content = mode === 'schets' ? group('filter="url(#sk)"') + `<g opacity="0.45">${group('transform="translate(1.2 0.8)"')}</g>` : group('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    `<defs>${filter}</defs>` +
    (bg ? '<rect width="200" height="200" fill="#fff"/>' : '') +
    content +
    `</svg>`
  );
}
