import { W, F, K, C, E, P, L, D, G, S, R, POLY, ROT, polar, smooth, spiral, heart, star, rng, paint } from './svg.js';

const thin = 'stroke-width="1.6"';
const COLORS = {
  Vulkaan: ['#8a6a5a'], 'Eiland met palmboom': ['#f2d68a', '#b5835a', '#5cb85c'], Waterval: ['#8a9a8a', '#8a9a8a', '#bfe3f7'], Bergtop: ['#8a9ab8', '#ffffff'],
  'Bliksem en wolk': ['#c9d3e0', '#f7d23e'], 'Blad met nerven': ['#6cc068'], Varen: ['#5cb85c'], Zonsondergang: ['#f2954a'], Paddenstoelen: ['#e84a3a', '#e84a3a'],
  Tulp: ['#5cb85c', '#e84a6a'], Roos: ['#5cb85c', '#e84a4a'], Zonnebloem: [...Array(18).fill('#f7c931'), '#7a4a2a'], Monsterablad: ['#3f9a4f'], Lavendel: ['#9b7ad8'],
  'Plant in pot': ['#d9774a', '#c8653c', '#5cb85c'], 'Klavertje vier': ['#5cb85c'], Bloemenkrans: ['#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#6cc068', '#f7a8c4', '#f7a8c4', '#f7a8c4', '#f7a8c4', '#f7a8c4', '#f2c94c', '#c9a0f0', '#c9a0f0', '#c9a0f0', '#c9a0f0', '#c9a0f0', '#f2c94c', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#f2c94c'],
  Windmolen: ['#7a4a3a', '#5a3a2a', '#3a6a3a', '#f5efe6', '#f5efe6', '#f5efe6', '#f5efe6', '#f5efe6'], Kasteel: ['#c9c3b5', '#b5ae9f'], Vuurtoren: ['#f5efe6', '#ffe58a', '#e84a3a', '#6b4226'],
  Kerk: ['#d8cbb5', '#a0522d', '#d8cbb5', '#a0522d', '#6b4226'], Eiffeltoren: ['#9a7a5a'], Iglo: ['#e8f4fa', '#bfd8e8'], Tent: ['#f2954a'], Pagode: ['#e84a3a'],
  Tempel: ['#e8e0d0'], 'Toren met klok': ['#d8cbb5', '#3a6a8a'],
  'Maan in raam': ['#2a3a6a'], 'Stapel boeken': ['#5aa8e0', '#e86a8a', '#7cc46c', '#f5efe6'], Kaarsen: ['#f7e6cc', '#ffcc33'], 'Hand met bloem': ['#f6d0b1', '#f7a8c4', '#f2c94c'],
  'Zon met gezicht (boho)': ['#e8a05a'], 'Vaas met takken': ['#d9a07a', '#c9b08a'], 'Koffie en boek': ['#f5efe6', '#d9a07a'], Hangplant: ['#d9a07a', '#6cc068'], 'Spiegel met plant': ['#e8c9a0', '#d9774a', '#6cc068'],
  Astronaut: ['#eef2f8'], Ufo: ['#9aa3b5', '#bfe3f7'], 'Maan met sterren': ['#ffe58a'], Zonnestelsel: ['#ffd34d', '#b5a99a', '#f2c26b', '#5aa8e0', '#e86a4a'], Komeet: ['#9ad8f2'],
  Telescoop: ['#3a4766', '#3a4766', '#3a4766'], Sterrenbeeld: ['#ffe58a'], 'Raket in de ruimte': ['#eef2f8', '#7fc8f0', '#e84a3a', '#e84a3a', '#f2954a'],
  Draak: ['#5cb85c', '#5cb85c', '#5cb85c', '#f2a43c'], Spookje: ['#f2f2ff'], Toverdrank: ['#c9a0f0', '#a0522d'], 'Kristallen bol': ['#c9e3f7', '#9a6a4a'], Toverstaf: ['#3a3a4a', '#f2c94c'],
  Eenhoorn: ['#fdf0fa', '#f2c94c'], Zeemeermin: ['#3fbf9f', '#f6d0b1', '#e86a8a'], Fee: ['#c9e3f7', '#c9e3f7', '#f6d0b1', '#f7a8c4'], 'Kasteel in de wolken': ['#e8c9f0'], Draakenei: ['#8fd16a'],
  Kerstboom: ['#8a5a3a', '#3f9a4f', '#3f9a4f', '#3f9a4f', '#f2c94c', '#e84a3a', '#5aa8e0', '#f2c94c', '#e84a3a', '#5aa8e0', '#f2c94c'], Sneeuwpop: ['#ffffff', '#ffffff', '#ffffff', '#3a3a4a', '#3a3a4a', '#f2954a'],
  Pompoen: ['#f2954a'], Pompoenlantaarn: ['#f2954a'], 'Kaars met hulst': ['#e84a3a', '#ffcc33', '#3f9a4f', '#d8312f', '#d8312f'], Sinterklaasschoen: ['#3a3a4a', '#e84a3a'],
  'Hartjes (Valentijn)': ['#e84a6a', '#f7a8c4'], Paashaas: ['#d8d0c8'],
};
const list = (arr) => arr.map(([t, d]) => ({ t, d: COLORS[t] ? () => paint(d(), COLORS[t]) : d }));
const many = (n, title, fn, offset = 0) => Array.from({ length: n }, (_, i) => ({ t: `${title} ${i + 1}`, d: () => fn(i + offset) }));
const fx = (p) => p.map((v) => +v.toFixed(1)).join(' ');

// ---------- Nature ----------

function landscape(seed) {
  const r = rng(seed);
  const round = seed % 3 === 0;
  const night = r.chance(0.35);
  let s = R(0, 0, 200, 200, 0, K(night ? '#2a3a6a' : '#cfeaf8') + ' stroke="none"');
  const sunX = r.range(50, 150), sunY = r.range(40, 70);
  s += r.chance(0.5) ? C(sunX, sunY, r.range(14, 22), K(night ? '#ffe58a' : '#ffd34d')) : P(`M${sunX} ${sunY - 18}Q${sunX - 26} ${sunY} ${sunX} ${sunY + 18}Q${sunX - 12} ${sunY} ${sunX} ${sunY - 18}Z`, K('#ffe58a'));
  // mountains
  const layers = r.int(2, 3);
  for (let l = 0; l < layers; l++) {
    const base = 120 + l * 16;
    const pts = [[0, base + 30]];
    let x = 0;
    while (x < 200) {
      x += r.range(30, 60);
      pts.push([Math.min(x, 200), base - r.range(20, 70) + l * 10]);
      x += r.range(20, 40);
      pts.push([Math.min(x, 200), base - r.range(0, 20) + l * 10]);
    }
    pts.push([200, base + 30]);
    s += POLY(pts, false, K(['#9aa8c8', '#6a9a7a', '#4f8a5a'][l]));
    if (l === 0) pts.slice(1, -1).forEach((p, i) => { if (i % 2 === 0) s += P(`M${fx(p)}l-8 14l6 -4l4 6l6 -8l4 4`, thin); });
  }
  // trees
  const trees = r.int(2, 6);
  for (let i = 0; i < trees; i++) {
    const tx = r.range(14, 186), ty = r.range(160, 176), h = r.range(18, 34);
    s += POLY([[tx, ty - h], [tx + h * 0.35, ty], [tx - h * 0.35, ty]], true, K('#2f7a3f')) + L(tx, ty, tx, ty + 6);
  }
  // water or path
  if (r.chance(0.5)) s += P('M0 182Q50 176 100 182T200 182M30 192Q70 188 110 192', thin);
  else s += P(`M${r.range(80, 120)} 200Q100 180 ${r.range(96, 110)} 160`, thin);
  for (let i = 0; i < r.int(1, 3); i++) { const bx = r.range(30, 170), by = r.range(24, 70); s += P(`M${bx - 8} ${by}q4 -5 8 0q4 -5 8 0`, thin); }
  if (round) return `<clipPath id="cr"><circle cx="100" cy="100" r="86"/></clipPath><g clip-path="url(#cr)">${s}</g>` + C(100, 100, 86);
  return `<clipPath id="cr"><rect x="12" y="12" width="176" height="176" rx="6"/></clipPath><g clip-path="url(#cr)">${s}</g>` + R(12, 12, 176, 176, 6);
}

function tree(seed) {
  const r = rng(seed);
  const kind = ['loof', 'den', 'kaal', 'palm', 'wilg', 'bloesem'][seed % 6];
  let s = '';
  if (kind === 'den') {
    s += R(92, 160, 16, 26, 2, K('#8a5a3a'));
    for (let i = 0; i < 4; i++) {
      const y = 160 - i * 34, w = 64 - i * 12;
      s += P(`M${100 - w} ${y}L100 ${y - 56}L${100 + w} ${y}Q100 ${y - 8} ${100 - w} ${y}Z`, K('#2f8a4f'));
    }
    return s + P('M10 186H190', thin);
  }
  if (kind === 'palm') {
    s += P('M96 186Q90 120 112 70L120 72Q102 130 110 186Z', K('#b5835a'));
    for (let i = 0; i < 6; i++) {
      const a = -80 + i * 32, end = polar(116, 70, 70, a), mid = polar(116, 70, 40, a - 8);
      s += P(`M116 70Q${fx(mid)} ${fx(end)}Q${fx(polar(116, 70, 46, a + 10))} 116 70Z`, K('#4fae5a'));
    }
    return s + C(110, 80, 7, K('#7a4a2a')) + C(124, 82, 7, K('#7a4a2a')) + P('M10 186H190', thin);
  }
  // branching trees
  const branch = (x, y, len, ang, depth) => {
    if (depth === 0 || len < 4) return '';
    const [x2, y2] = polar(x, y, len, ang);
    let out = L(x, y, x2, y2, `stroke-width="${Math.max(1.2, depth * 1.3)}"`);
    if (depth <= 2 && kind === 'bloesem') out += C(x2, y2, 4, K('#f7b6c8'));
    if (depth <= 1 && kind === 'wilg') out += P(`M${fx([x2, y2])}q${r.range(-4, 4)} 20 ${r.range(-6, 6)} 40`, 'stroke-width="1"');
    const spread = r.range(18, 34);
    out += branch(x2, y2, len * r.range(0.66, 0.78), ang - spread, depth - 1);
    out += branch(x2, y2, len * r.range(0.66, 0.78), ang + spread, depth - 1);
    if (r.chance(0.3)) out += branch(x2, y2, len * 0.6, ang + r.range(-8, 8), depth - 2);
    return out;
  };
  if (kind === 'loof') {
    const pts = Array.from({ length: 14 }, (_, i) => polar(100, 78, r.range(52, 66), i * (360 / 14)));
    s += P('M90 186L94 120L80 100M106 120L120 96M94 120L106 120L110 186', K('#8a5a3a'));
    s += P(smooth(pts), K(r.pick(['#5cb85c', '#7cc46c', '#f2954a', '#e8b83a']))) + Array.from({ length: 6 }, () => { const [x, y] = polar(100, 78, r.range(10, 40), r.range(0, 360)); return P(`M${fx([x, y])}q5 -6 10 0`, thin); }).join('');
    return s + P('M10 186H190', thin);
  }
  s += branch(100, 186, 46, 0, kind === 'kaal' ? 8 : 7);
  return s + P('M10 186H190', thin);
}

function flower(seed) {
  const r = rng(seed);
  const n = r.pick([5, 6, 8, 10, 12]);
  const shape = r.int(0, 3);
  const cx = 100, cy = 78, pr = r.range(36, 50);
  const petalC = r.pick(['#e84a6a', '#f7a8c4', '#9b6bd6', '#5aa8e0', '#f2954a', '#f7d23e', '#ffffff', '#e84a3a']);
  let s = '';
  // stem and leaves
  s += P(`M100 ${cy + 20}Q${r.range(90, 110)} 140 100 190`, 'stroke-width="3"');
  s += P('M100 150Q70 120 54 136Q72 160 100 150Z', K('#5cb85c')) + P('M100 150Q70 140 58 138', thin);
  if (r.chance(0.6)) s += P('M101 170Q130 140 148 152Q130 176 101 170Z', K('#5cb85c'));
  const petal = (len, wid) => {
    if (shape === 0) return E(cx, cy - len / 2, wid, len / 2, W);
    if (shape === 1) return P(`M${cx} ${cy}Q${cx - wid * 1.6} ${cy - len * 0.6} ${cx} ${cy - len}Q${cx + wid * 1.6} ${cy - len * 0.6} ${cx} ${cy}Z`, W);
    if (shape === 2) return P(`M${cx} ${cy}C${cx - wid * 2} ${cy - len * 0.7} ${cx - wid} ${cy - len * 1.05} ${cx} ${cy - len * 0.85}C${cx + wid} ${cy - len * 1.05} ${cx + wid * 2} ${cy - len * 0.7} ${cx} ${cy}Z`, W);
    return P(`M${cx} ${cy}L${cx - wid} ${cy - len * 0.7}L${cx} ${cy - len}L${cx + wid} ${cy - len * 0.7}Z`, W);
  };
  const doubleLayer = r.chance(0.4);
  if (doubleLayer) s += paint(ROT(petal(pr * 1.1, pr * 0.24), n, cx, cy, 180 / n), [petalC]);
  s += paint(ROT(petal(pr, pr * 0.26), n, cx, cy), [petalC]);
  if (r.chance(0.5)) s += ROT(L(cx, cy - pr * 0.3, cx, cy - pr * 0.75, 'stroke-width="1.2"'), n, cx, cy);
  s += C(cx, cy, pr * 0.28, K('#f2c94c'));
  for (let i = 0; i < 7; i++) s += D(...polar(cx, cy, pr * 0.15, i * 51), 1.6);
  return s;
}

function cactus(seed) {
  const r = rng(seed);
  let s = P('M56 140H144L134 190H66Z', K('#d9774a')) + R(50, 130, 100, 16, 4, K('#c8653c'));
  if (r.chance(0.5)) s += P('M66 160H134', thin);
  const kind = r.int(0, 2);
  const green = r.pick(['#5cb85c', '#3f9a6f', '#7cc46c']);
  if (kind === 0) {
    s += P('M84 130V50Q84 34 100 34Q116 34 116 50V130Z', K(green));
    s += P('M84 96H70Q60 96 60 84V64Q60 56 67 56Q74 56 74 64V82H84', K(green));
    if (r.chance(0.7)) s += P('M116 82H130Q140 82 140 70V54Q140 46 133 46Q126 46 126 54V68H116', K(green));
    s += P('M100 44V126', thin);
  } else if (kind === 1) {
    s += E(100, 100, 42, 34, K(green)) + P('M100 66V134M78 72Q70 100 78 128M122 72Q130 100 122 128', thin);
  } else {
    s += E(84, 108, 22, 26, K(green)) + E(118, 100, 20, 34, K(green)) + E(100, 74, 14, 18, K(green));
  }
  for (let i = 0; i < 10; i++) { const x = r.range(72, 128), y = r.range(50, 124); s += P(`M${x.toFixed(1)} ${y.toFixed(1)}l-3 -3M${x.toFixed(1)} ${y.toFixed(1)}l3 -3`, 'stroke-width="1"'); }
  if (r.chance(0.5)) s += ROT(E(100, 26, 4, 8, K('#f7a8c4')), 5, 100, 34);
  return s;
}

export const nature = [
  ...many(16, 'Landschap', landscape, 1),
  ...many(18, 'Boom', tree, 0),
  ...list([
    ['Vulkaan', () => P('M10 180L70 70H130L190 180Z', W) + P('M70 70Q80 80 90 72Q100 84 110 72Q120 80 130 70', thin) + P('M86 60Q70 30 90 20Q100 6 116 18Q136 20 128 44Q120 60 106 56', thin)],
    ['Eiland met palmboom', () => P('M20 160Q100 120 180 160Z', W) + P('M96 148Q90 100 112 60L118 62Q102 110 106 148Z', W) +
      [-80, -40, 0, 40, 80].map((a) => P(`M114 60Q${fx(polar(114, 60, 34, a - 10))} ${fx(polar(114, 60, 56, a))}Q${fx(polar(114, 60, 30, a + 14))} 114 60Z`, W)).join('') + P('M0 172Q30 164 60 172T120 172T180 172T200 170', thin) + C(150, 40, 14)],
    ['Waterval', () => P('M10 60Q60 50 80 70V180H10Z', W) + P('M190 60Q140 50 120 70V180H190Z', W) + P('M80 70H120V160', thin) + P('M90 70V160M100 70V170M110 70V160', thin) + P('M70 170Q100 150 130 170Q100 190 70 170Z', W)],
    ['Bergtop', () => P('M10 170L80 50L110 96L130 70L190 170Z', W) + P('M64 78L80 50L96 76L88 70L80 82L72 72Z', W) + P('M120 84L130 70L140 86', thin)],
    ['Regenboog', () => [70, 58, 46, 34].map((rr) => P(`M${100 - rr} 140A${rr} ${rr} 0 0 1 ${100 + rr} 140`)).join('') + S(P('M20 150Q16 130 36 130Q40 116 56 120Q70 120 70 136Q84 140 78 152Z', W))],
    ['Bliksem en wolk', () => P('M50 100Q18 100 22 74Q26 52 52 56Q56 24 92 26Q114 10 140 26Q170 28 166 60Q186 66 182 88Q178 104 150 104Z', W) + P('M104 104L84 150H104L92 192L136 132H112L124 104', W)],
    ['Blad met nerven', () => P('M30 170Q20 60 170 30Q180 150 30 170Z', W) + P('M30 170Q90 110 170 30') + [0.3, 0.45, 0.6, 0.75].map((t) => { const x = 30 + 140 * t, y = 170 - 140 * t; return P(`M${x} ${y}Q${x - 10} ${y - 28} ${x - 26} ${y - 34}M${x} ${y}Q${x + 28} ${y + 8} ${x + 34} ${y + 24}`, thin); }).join('')],
    ['Varen', () => P('M100 190Q96 100 120 20', 'stroke-width="2.4"') + Array.from({ length: 12 }, (_, i) => { const t = i / 12, x = 100 + 20 * t * t, y = 180 - 155 * t, l = 44 * (1 - t) + 8; return P(`M${x} ${y}Q${x - l * 0.6} ${y - 10} ${x - l} ${y - 4}Q${x - l * 0.5} ${y + 4} ${x} ${y}Z`, W) + P(`M${x} ${y}Q${x + l * 0.6} ${y - 12} ${x + l} ${y - 8}Q${x + l * 0.5} ${y + 2} ${x} ${y}Z`, W); }).join('')],
    ['Zonsondergang', () => P('M50 120A50 50 0 0 1 150 120Z', W) + P('M10 120H190M30 134H170M50 148H150M74 162H126') + Array.from({ length: 9 }, (_, i) => L(...polar(100, 120, 60, -80 + i * 20), ...polar(100, 120, 74, -80 + i * 20))).join('')],
    ['Paddenstoelen', () => P('M30 120Q34 60 90 60Q146 60 150 120Z', W) + P('M70 120Q66 170 76 180H104Q114 170 110 120') + C(70, 90, 8) + C(110, 80, 10) + C(130, 104, 6) + P('M120 160Q122 130 150 130Q178 130 180 160Z', W) + P('M140 160V184H160V160')],
  ]),
];

export const flowers = [
  ...many(30, 'Bloem', flower, 1),
  ...many(12, 'Cactus', cactus, 3),
  ...list([
    ['Tulp', () => P('M100 110V190', 'stroke-width="3"') + P('M100 170Q60 150 56 100Q80 120 100 160Z', W) + P('M70 50Q66 100 100 110Q134 100 130 50L115 70L100 40L85 70Z', W)],
    ['Roos', () => P('M100 110V190', 'stroke-width="3"') + P('M100 150Q70 130 60 146Q76 164 100 156Z', W) + P('M100 110Q50 108 54 64Q60 30 100 30Q140 30 146 64Q150 108 100 110Z', W) + spiral(100, 66, 4, 34, 2.4, 40) + P('M70 84Q100 110 130 84', thin)],
    ['Zonnebloem', () => P('M100 140V196', 'stroke-width="3"') + ROT(P('M100 18Q112 40 100 54Q88 40 100 18Z', W), 18, 100, 86) + C(100, 86, 32, W) +
      Array.from({ length: 30 }, (_, i) => D(...polar(100, 86, 6 + (i % 5) * 5, i * 41), 1.6)).join('')],
    ['Monsterablad', () => P('M100 190V110', 'stroke-width="3"') + P('M100 110Q20 120 24 60Q30 16 100 20Q170 16 176 60Q180 120 100 110Z', W) + P('M100 110V24') +
      [[-1, 50], [1, 46], [-1, 76], [1, 74]].map(([d, y]) => P(`M${100 + d * 36} ${y}Q${100 + d * 60} ${y + 4} ${100 + d * 70} ${y + 14}`, 'stroke-width="5"')).join('')],
    ['Lavendel', () => [80, 100, 120].map((x, i) => P(`M${x} 190Q${x + (i - 1) * 6} 120 ${x + (i - 1) * 20} 60`) + Array.from({ length: 6 }, (_, k) => E(x + (i - 1) * (20 - k * 3) + (i - 1) * 2, 60 + k * 11, 5, 7, W)).join('')).join('')],
    ['Plant in pot', () => P('M60 120H140L130 190H70Z', W) + R(54, 110, 92, 14, 3, W) + [-60, -30, 0, 30, 60].map((a) => P(`M100 110Q${fx(polar(100, 110, 40, a - 14))} ${fx(polar(100, 110, 80, a))}Q${fx(polar(100, 110, 40, a + 14))} 100 110Z`, W)).join('')],
    ['Klavertje vier', () => ROT(heart(100, 66, 30, W).replace(/<path/, '<path transform="rotate(180 100 70)"'), 4, 100, 100) + P('M100 100Q110 150 140 180', 'stroke-width="3"')],
    ['Bloemenkrans', () => C(100, 100, 66) + Array.from({ length: 14 }, (_, i) => G(P('M0 0Q-8 -10 0 -20Q8 -10 0 0Z', W), `translate(${fx(polar(100, 100, 66, i * 25.7))}) rotate(${i * 25.7 + 60})`)).join('') +
      [0, 120, 240].map((a) => G(ROT(E(0, -9, 5, 8, W), 5, 0, 0) + C(0, 0, 4, W), `translate(${fx(polar(100, 100, 66, a))})`)).join('')],
  ]),
];

// ---------- Architecture ----------

function house(seed) {
  const r = rng(seed);
  const roof = ['zadel', 'trap', 'hals', 'klok', 'plat', 'schuur'][seed % 6];
  const wallC = r.pick(['#c8664a', '#e8d8b8', '#a0522d', '#f2e6c8', '#8fb8d8', '#d88a6a']), roofC = r.pick(['#7a3a2a', '#3a4766', '#5a5a5a', '#a0422a']);
  const w = r.range(90, 120), x0 = 100 - w / 2, x1 = 100 + w / 2, base = 180, top = r.range(90, 110);
  let s = '';
  if (roof === 'zadel' || roof === 'schuur') {
    if (r.chance(0.6)) s += R(x1 - 30, top - 50, 14, 30, 1, K('#8a4a3a'));
    s += P(`M${x0 - 8} ${top}L100 ${top - 60}L${x1 + 8} ${top}Z`, K(roofC));
  }
  const gableTop = top - 70;
  if (roof === 'trap') {
    const steps = 4, sw = w / (steps * 2 + 1);
    const pts = [[x0, top]];
    for (let i = 0; i < steps; i++) { const y = top - (i + 1) * ((top - gableTop) / (steps + 1)); pts.push([x0 + i * sw, y], [x0 + (i + 1) * sw, y]); }
    const peak = [[x0 + steps * sw, gableTop], [x1 - steps * sw, gableTop]];
    const right = pts.slice(1).map(([x, y]) => [200 - x, y]).reverse();
    s += POLY([...pts, ...peak, ...right, [x1, top]], false, K(wallC));
  }
  if (roof === 'hals') s += P(`M${x0} ${top}Q${x0 + 14} ${top - 10} ${x0 + 24} ${top - 34}V${gableTop}H${x1 - 24}V${top - 34}Q${x1 - 14} ${top - 10} ${x1} ${top}Z`, K(wallC)) + P(`M${x0 + 20} ${gableTop}L100 ${gableTop - 14}L${x1 - 20} ${gableTop}`, K(wallC));
  if (roof === 'klok') s += P(`M${x0} ${top}Q${x0 + 4} ${top - 20} ${x0 + 22} ${top - 30}Q${x0 + 28} ${gableTop} 100 ${gableTop - 6}Q${x1 - 28} ${gableTop} ${x1 - 22} ${top - 30}Q${x1 - 4} ${top - 20} ${x1} ${top}Z`, K(wallC));
  if (roof === 'plat') s += R(x0 - 6, top - 10, w + 12, 12, 2, K('#5a5a5a'));
  s += R(x0, top, w, base - top, 0, K(wallC));
  if (roof === 'schuur') s += P(`M${x0 - 8} ${top}L100 ${top - 60}L${x1 + 8} ${top}`, 'stroke-width="4"');
  // windows
  const cols = r.int(2, 3), rows = r.int(1, 2);
  const ww = 18, wh = 22;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const wx = x0 + ((i + 0.5) * w) / cols - ww / 2, wy = top + 12 + j * 34;
    if (wy + wh > base - 44 && Math.abs(wx + ww / 2 - 100) < 18) continue;
    s += R(wx, wy, ww, wh, 1, K('#bfe3f7')) + L(wx + ww / 2, wy, wx + ww / 2, wy + wh, thin) + L(wx, wy + wh / 2, wx + ww, wy + wh / 2, thin);
    if (r.chance(0.4)) s += P(`M${wx - 3} ${wy}H${wx + ww + 3}`, 'stroke-width="3"');
  }
  if (roof === 'trap' || roof === 'hals' || roof === 'klok') s += C(100, gableTop + 26, 7) + L(100, gableTop + 19, 100, gableTop + 33, thin) + L(93, gableTop + 26, 107, gableTop + 26, thin);
  // door
  s += r.chance(0.5) ? P(`M90 ${base}V${base - 32}Q100 ${base - 44} 110 ${base - 32}V${base}`, K('#6b4226')) : R(90, base - 40, 20, 40, 1, K('#3a6a8a'));
  s += D(106, base - 18, 1.8) + P(`M84 ${base}h32v4h-32z`, thin);
  if (r.chance(0.5)) s += Array.from({ length: 5 }, (_, i) => C(x0 - 2 + i * 6, base - 4, 4, K('#e86a8a')) + C(x1 + 2 - i * 6, base - 4, 4, K('#f2c94c'))).join('');
  return s + P('M6 186H194', thin);
}

function skyline(seed) {
  const r = rng(seed);
  let s = '', x = 6;
  while (x < 190) {
    const w = r.range(18, 34), h = r.range(50, 150);
    const t = 180 - h;
    const kind = r.int(0, 3);
    const bc = r.pick(['#9aa8c8', '#7a8aa8', '#b8c4d6', '#5a6a8a', '#c9b8a8']);
    if (kind === 1) s += P(`M${x + w / 2} ${t - 20}V${t}`, 'stroke-width="2"');
    if (kind === 2) s += POLY([[x, t], [x + w / 2, t - 14], [x + w, t]], true, K(bc));
    s += R(x, t, Math.min(w, 194 - x), h, 0, K(bc));
    for (let wy = t + 8; wy < 170; wy += 12) for (let wx = x + 4; wx < x + w - 6; wx += 8) if (r.chance(0.7)) s += R(wx, wy, 4, 6, 0, K('#ffe58a') + ' stroke-width="1.6"');
    x += w + r.range(-4, 4);
  }
  return R(0, 0, 200, 180, 0, K('#f7c9a0') + ' stroke="none"') + s + P('M0 180H200') + C(r.range(30, 170), 30, 10, K('#ffd34d'));
}

export const architecture = [
  ...many(24, 'Huis', house, 0),
  ...many(8, 'Skyline', skyline, 2),
  ...list([
    ['Windmolen', () => P('M70 186L80 90H120L130 186Z', W) + P('M76 90L100 66L124 90Z', W) + R(92, 150, 16, 36, 2, W) + R(92, 104, 16, 16, 1) +
      ROT(P('M100 70L104 10H94Z', W) + R(94, 14, 10, 50, 0, thin), 4, 100, 70, 20) + C(100, 70, 5, W)],
    ['Kasteel', () => R(30, 90, 140, 96, 0, W) + [30, 140].map((x) => R(x - 10, 50, 40, 136, 0, W) + P(`M${x - 10} 50v-10h8v10h8v-10h8v10h8v-10h8v10`, W) + R(x + 4, 80, 12, 18, 6)).join('') +
      P('M30 90v-10h10v10h12v-10h12v10h12v-10h12v10h12v-10h12v10h12v-10h12v10', W) + P('M80 186V140Q100 116 120 140V186', W) + P('M80 150H120M80 162H120M80 174H120M93 140V186M106 140V186', thin) + P('M160 40V10L184 18L160 26')],
    ['Vuurtoren', () => P('M76 186L84 60H116L124 186Z', W) + R(78, 40, 44, 20, 2, W) + P('M70 40L100 18L130 40Z', W) + P('M80 96H120M78 132H122', 'stroke-width="6"') + R(94, 158, 12, 28, 6, W) + P('M10 186H190')],
    ['Kerk', () => R(30, 100, 100, 86, 0, W) + P('M24 100L80 54L136 100Z', W) + R(124, 60, 44, 126, 0, W) + P('M120 60L146 10L172 60Z', W) + P('M146 10V-6M138 0H154') + C(146, 84, 10) +
      P('M66 186V150Q80 134 94 150V186', W) + P('M44 130V112Q50 104 56 112V130ZM104 130V112Q110 104 116 112V130Z')],
    ['Eiffeltoren', () => P('M100 10L94 40H106ZM94 40L80 100H120L106 40M80 100L50 186H74Q100 140 126 186H150L120 100', W) + P('M86 70H114M70 130H130', 'stroke-width="4"') + P('M94 40L114 70M106 40L86 70M80 100L126 130M120 100L74 130', thin)],
    ['Brug', () => P('M0 140H200') + P('M0 120H200') + P('M20 120Q100 20 180 120') + Array.from({ length: 9 }, (_, i) => { const x = 36 + i * 16; const y = 120 - 100 * (1 - Math.pow((x - 100) / 80, 2)) * 0.5; return L(x, y, x, 120, thin); }).join('') + R(16, 40, 10, 100, 0, W) + R(174, 40, 10, 100, 0, W) + P('M0 160Q30 152 60 160T120 160T180 160T200 158', thin)],
    ['Iglo', () => P('M20 170A80 80 0 0 1 180 170Z', W) + P('M70 170V140Q70 116 100 116Q130 116 130 140V170', W) + P('M28 140H70M130 140H172M44 110H156M70 84H130M60 140V110M100 110V84M140 140V110M80 84V60M120 84V60', thin)],
    ['Tent', () => P('M20 170L100 40L180 170Z', W) + P('M100 40L70 170M100 40L130 170') + P('M100 40L90 20M100 40L110 20') + P('M10 172H190')],
    ['Pagode', () => [0, 1, 2].map((i) => { const y = 160 - i * 46, w = 80 - i * 16; return R(100 - w * 0.6, y - 30, w * 1.2, 30, 0, W) + P(`M${100 - w - 10} ${y - 30}Q${100 - w} ${y - 40} 100 ${y - 52}Q${100 + w} ${y - 40} ${100 + w + 10} ${y - 30}Z`, W); }).join('') + P('M100 22V2') + R(90, 140, 20, 20, 0, W) + P('M10 186H190M20 186V160H180V186')],
    ['Grachtenpanden', () => [1, 2, 3].map((k, i) => G(house(k), `translate(${-24 + i * 62} 70) scale(.62)`)).join('')],
    ['Tempel', () => P('M14 70L100 20L186 70Z', W) + R(14, 70, 172, 14, 0, W) + [30, 66, 102, 138].map((x) => R(x, 84, 18, 84, 0, W) + P(`M${x + 6} 88V164M${x + 12} 88V164`, thin)).join('') + R(10, 168, 180, 10, 0, W) + R(4, 178, 192, 10, 0, W)],
    ['Toren met klok', () => R(70, 60, 60, 126, 0, W) + P('M64 60L100 14L136 60Z', W) + C(100, 90, 18) + P('M100 90V78M100 90L108 96') + R(88, 130, 24, 30, 12) + P('M84 186V170H116V186')],
  ]),
];

// ---------- One line ----------

function oneLine(seed) {
  const r = rng(seed);
  const kind = (seed % 3) + 1;
  if (kind === 0) {
    // abstract face profiles
    return P(smooth([[30, 190], [40, 150], [70, 140], [76, 120], [62, 112], [72, 100], [64, 90], [80, 80], [66, 50], [90, 22], [130, 24], [150, 60], [140, 100], [r.range(110, 130), 120], [140, 140], [130, 170], [150, 190]], false, 1.1));
  }
  if (kind === 1) {
    const pts = [[10, 150]];
    let x = 10;
    while (x < 180) { x += r.range(16, 40); pts.push([x, r.range(60, 140)]); }
    pts.push([190, 150]);
    return P(smooth(pts, false)) + P(`M${r.range(60, 140)} 40m-14 0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0`);
  }
  if (kind === 2) {
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push([r.range(30, 170), r.range(30, 170)]);
    return P(smooth(pts, false, 1.2));
  }
  // continuous loop flower/leaf
  const n = r.int(3, 6);
  const pts = [[100, 190], [100, 120]];
  for (let i = 0; i < n * 2; i++) pts.push(polar(100, 80, i % 2 ? r.range(50, 70) : 10, (360 / (n * 2)) * i));
  pts.push([100, 120], [120, 150], [150, 140], [110, 160]);
  return P(smooth(pts, false, 1.1));
}

export const oneLineArt = [
  ...list([
    ['Kat (één lijn)', () => P(smooth([[20, 180], [60, 176], [70, 140], [60, 100], [64, 60], [72, 30], [86, 54], [114, 54], [128, 30], [136, 60], [140, 100], [130, 140], [140, 176], [170, 180], [184, 150], [170, 130]], false))],
    ['Hart en hand (één lijn)', () => P(smooth([[10, 120], [50, 120], [70, 80], [60, 50], [80, 40], [100, 60], [120, 40], [140, 50], [140, 80], [100, 130], [70, 110], [100, 150], [150, 150], [190, 150]], false))],
    ['Twee gezichten (één lijn)', () => P(smooth([[100, 190], [90, 160], [70, 150], [76, 130], [64, 124], [72, 112], [66, 100], [80, 90], [70, 60], [100, 30], [130, 60], [120, 90], [134, 100], [128, 112], [136, 124], [124, 130], [130, 150], [110, 160], [100, 190]], false))],
    ['Bergen en zon (één lijn)', () => P('M10 160L50 90L70 120L100 60L130 120L150 96L190 160') + P('M150 50m-16 0a16 16 0 1 0 32 0a16 16 0 1 0 -32 0')],
    ['Olifant (één lijn)', () => P(smooth([[20, 170], [30, 120], [40, 80], [80, 60], [120, 66], [140, 80], [150, 110], [148, 150], [160, 170], [174, 160], [170, 140], [156, 120], [160, 90], [140, 60], [110, 50], [100, 80], [120, 110], [100, 120], [90, 170]], false))],
    ['Vogel (één lijn)', () => P(smooth([[10, 120], [60, 110], [90, 70], [120, 60], [150, 70], [170, 64], [150, 84], [140, 110], [100, 130], [60, 120], [100, 150], [160, 170]], false))],
    ['Roos (één lijn)', () => P(smooth([[100, 190], [100, 130], [80, 120], [70, 90], [86, 66], [110, 70], [120, 90], [100, 100], [90, 86], [104, 80], [130, 80], [136, 110], [110, 128], [100, 130], [130, 150], [150, 140]], false))],
    ['Hand (één lijn)', () => P(smooth([[60, 190], [60, 130], [40, 100], [48, 92], [66, 110], [66, 50], [76, 46], [82, 100], [86, 34], [96, 32], [100, 98], [106, 40], [116, 40], [118, 102], [128, 58], [138, 60], [134, 130], [130, 190]], false))],
  ]),
  ...many(18, 'Abstracte lijn', oneLine, 3),
];

// ---------- Aesthetic / boho ----------

function boho(seed) {
  const r = rng(seed);
  const kind = seed % 4;
  let s = '';
  if (kind === 0) {
    const arcs = r.int(3, 5);
    for (let i = 0; i < arcs; i++) { const rr = 80 - i * 14; s += P(`M${100 - rr} 160A${rr} ${rr} 0 0 1 ${100 + rr} 160${i === arcs - 1 ? 'Z' : ''}`, i % 2 ? W : ''); }
    if (r.chance(0.5)) s += Array.from({ length: 6 }, (_, i) => L(100 - (24 - i * 8), 160, 100 - (24 - i * 8), 152, thin)).join('');
    s += P('M10 160H190');
  } else if (kind === 1) {
    const rays = r.int(7, 13);
    s += P('M30 160A70 70 0 0 1 170 160Z', W);
    for (let i = 0; i < rays; i++) { const a = -80 + (160 / (rays - 1)) * i; s += L(...polar(100, 160, 78, a), ...polar(100, 160, r.chance(0.5) ? 90 : 96, a)); }
    s += P('M60 160A40 40 0 0 1 140 160') + P('M10 160H190') + P('M20 176H180M40 188H160', thin);
  } else if (kind === 2) {
    s += R(50, 24, 100, 150, 50, W) + P(`M${r.range(60, 100)} 174Q100 120 140 140`, thin) + C(r.range(80, 120), 70, 16) + P('M60 120Q100 100 140 110', thin);
  } else {
    s += P('M100 30V180') + Array.from({ length: 6 }, (_, i) => { const y = 50 + i * 22; const side = i % 2 ? 1 : -1; return P(`M100 ${y}Q${100 + side * 40} ${y - 20} ${100 + side * 50} ${y + 6}Q${100 + side * 24} ${y + 10} 100 ${y}Z`, W); }).join('');
  }
  return s;
}

export const aesthetic = [
  ...list([
    ['Maan in raam', () => R(40, 20, 120, 160, 60, W) + P('M100 20V180M40 100H160', thin) + P('M110 50Q90 60 96 84Q104 100 124 96Q108 90 106 74Q104 60 110 50Z') + star(66, 60, 6, 2.5) + star(130, 130, 5, 2) + star(70, 140, 4, 1.6)],
    ['Stapel boeken', () => R(40, 150, 120, 28, 3, W) + G(R(50, 122, 110, 26, 3, W), 'rotate(-3 100 135)') + R(36, 94, 116, 26, 3, W) + P('M60 150V178M70 94V120', thin) + P('M90 94Q90 60 110 60Q126 60 120 80Q114 94 98 94', thin) + R(98, 70, 24, 24, 4, W) + P('M122 76Q132 76 130 86Q128 92 122 90')],
    ['Kaarsen', () => [[56, 100], [100, 70], [144, 110]].map(([x, t]) => R(x - 16, t, 32, 180 - t, 4, W) + P(`M${x} ${t}V${t - 10}`) + P(`M${x} ${t - 10}Q${x - 9} ${t - 22} ${x} ${t - 38}Q${x + 9} ${t - 22} ${x} ${t - 10}Z`, W)).join('') + P('M20 180H180')],
    ['Hand met bloem', () => P('M40 190Q50 150 70 140L110 128Q120 126 120 134Q118 140 108 142L92 146L130 144Q140 144 138 152Q136 158 126 158L90 162Q70 170 66 190', W) + P('M116 132L140 60', 'stroke-width="2"') + ROT(E(140, 44, 8, 14, W), 6, 140, 58) + C(140, 58, 6, W)],
    ['Gezicht met bloemen', () => P(smooth([[100, 190], [90, 160], [70, 150], [76, 130], [64, 124], [72, 112], [66, 100], [80, 90], [74, 64]], false)) + Array.from({ length: 7 }, (_, i) => G(ROT(E(0, -9, 5, 9, W), 5, 0, 0) + C(0, 0, 4, W), `translate(${fx(polar(110, 64, 34, -70 + i * 26))})`)).join('') + P('M74 112Q80 114 84 110', thin)],
    ['Zon met gezicht (boho)', () => C(100, 100, 40) + ROT(P('M100 40L106 52H94Z', W), 12) + S(P('M80 98Q86 104 92 98', thin)) + P('M90 120Q100 126 110 120', thin) + P('M100 104l-3 8h5', thin)],
    ['Vaas met takken', () => P('M70 100Q50 130 66 180H134Q150 130 130 100V80H70Z', W) + P('M100 80Q96 40 60 20M100 80Q110 30 150 16M100 80V20', thin) +
      [[70, 30], [80, 40], [130, 24], [120, 36], [100, 30], [100, 50]].map(([x, y]) => E(x, y, 4, 7, W)).join('')],
    ['Koffie en boek', () => P('M100 120Q60 106 20 112V170Q60 164 100 178Q140 164 180 170V112Q140 106 100 120Z', W) + P('M100 120V178') + P('M120 70H170L166 108Q164 116 145 116Q126 116 124 108Z', W) + P('M168 78Q186 78 182 92Q180 100 168 100') + P('M136 60Q130 50 136 40M154 60Q148 50 154 40', thin)],
    ['Hangplant', () => P('M100 10V40M70 40L100 10L130 40') + P('M60 40H140L128 90H72Z', W) + [74, 90, 110, 126].map((x, i) => P(`M${x} 90Q${x + (i % 2 ? 10 : -10)} 130 ${x} 180`) + [0, 1, 2, 3].map((k) => E(x + (k % 2 ? 6 : -6), 104 + k * 20, 5, 8, W)).join('')).join('')],
    ['Spiegel met plant', () => E(80, 90, 48, 72, W) + E(80, 90, 40, 64) + P('M140 140H180L176 186H144Z', W) + P('M160 140Q150 100 130 90M160 140Q170 110 186 100M160 140V96', thin) + E(132, 92, 6, 10, W) + E(184, 102, 6, 10, W) + E(160, 92, 6, 10, W)],
  ]),
  ...many(8, 'Boho', boho, 0),
];

// ---------- Mandalas ----------

function mandala(seed) {
  const r = rng(seed);
  const n = r.pick([6, 8, 10, 12, 16]);
  let s = C(100, 100, r.range(6, 10));
  let rad = r.range(10, 16);
  while (rad < 86) {
    const next = Math.min(92, rad + r.range(8, 18));
    const kind = r.int(0, 6);
    const k = kind === 2 || kind === 3 ? n * 2 : n;
    if (kind === 0) s += ROT(P(`M100 ${100 - rad}Q${100 + (next - rad) * 0.7} ${100 - (rad + next) / 2} 100 ${100 - next}Q${100 - (next - rad) * 0.7} ${100 - (rad + next) / 2} 100 ${100 - rad}Z`), k);
    if (kind === 1) s += C(100, 100, next);
    if (kind === 2) s += ROT(C(100, 100 - (rad + next) / 2, Math.min(4, (next - rad) / 3)), k);
    if (kind === 3) { const pts = []; for (let i = 0; i <= k * 2; i++) pts.push(polar(100, 100, i % 2 ? next : rad, (180 / k) * i)); s += POLY(pts, false); }
    if (kind === 4) s += ROT(P(`M${fx(polar(100, 100, rad, -180 / k))}Q${fx(polar(100, 100, next * 1.12, 0))} ${fx(polar(100, 100, rad, 180 / k))}`), k);
    if (kind === 5) s += ROT(P(`M100 ${100 - rad}C${100 + (next - rad)} ${100 - rad - 4} ${100 + (next - rad) * 0.5} ${100 - next} 100 ${100 - next}C${100 - (next - rad) * 0.5} ${100 - next} ${100 - (next - rad)} ${100 - rad - 4} 100 ${100 - rad}Z`) + L(100, 100 - rad, 100, 100 - next + 3, 'stroke-width="1"'), k);
    if (kind === 6) s += C(100, 100, (rad + next) / 2, 'stroke-dasharray="1 5"') + C(100, 100, next);
    rad = next;
  }
  return s;
}
export const mandalas = many(40, 'Mandala', mandala, 1);

// ---------- Patterns ----------

function pattern(seed) {
  const r = rng(seed);
  const kind = seed % 10;
  let s = '';
  const step = r.pick([20, 24, 28]);
  if (kind === 0) for (let y = 0; y < 220; y += step / 2) for (let x = (y / (step / 2)) % 2 ? step / 2 : 0; x < 220; x += step) s += P(`M${x - step / 2} ${y}A${step / 2} ${step / 2} 0 0 0 ${x + step / 2} ${y}`);
  if (kind === 1) for (let y = 10; y < 210; y += step / 1.5) s += P(`M0 ${y}` + Array.from({ length: 12 }, (_, i) => `q${step / 2} ${i % 2 ? step / 2 : -step / 2} ${step} 0`).join(''));
  if (kind === 2) for (let y = 0; y < 220; y += step * 0.87) for (let x = ((y / (step * 0.87)) % 2) * step / 2; x < 220; x += step) s += POLY(Array.from({ length: 6 }, (_, i) => polar(x, y, step / 1.9, i * 60 + 30)));
  if (kind === 3) for (let y = 0; y < 220; y += step) for (let x = 0; x < 220; x += step) s += ((x + y) / step) % 2 ? P(`M${x} ${y}h${step}v${step}`) + P(`M${x + 4} ${y + step - 4}L${x + step - 4} ${y + 4}`, thin) : C(x + step / 2, y + step / 2, step / 3);
  if (kind === 4) for (let y = 0; y < 220; y += step / 2) for (let x = ((y / (step / 2)) % 2) * step / 2; x < 220; x += step) s += R(x, y, step, step / 2);
  if (kind === 5) for (let y = 0; y < 220; y += step) for (let x = 0; x < 220; x += step) s += spiral(x + step / 2, y + step / 2, 1, step / 2.4, 2, r.int(0, 360));
  if (kind === 6) for (let y = 0; y < 220; y += step) for (let x = 0; x < 220; x += step) s += P(r.chance(0.5) ? `M${x} ${y + step / 2}A${step / 2} ${step / 2} 0 0 0 ${x + step / 2} ${y}M${x + step} ${y + step / 2}A${step / 2} ${step / 2} 0 0 0 ${x + step / 2} ${y + step}` : `M${x + step / 2} ${y}A${step / 2} ${step / 2} 0 0 0 ${x + step} ${y + step / 2}M${x} ${y + step / 2}A${step / 2} ${step / 2} 0 0 1 ${x + step / 2} ${y + step}`);
  if (kind === 7) { const h = step * 0.58; for (let y = -h; y < 220; y += step * 1.5) for (let x = 0; x < 220; x += step * 1.73) for (const ox of [0, step * 0.865]) { const cx = x + ox, cy = y + (ox ? step * 0.75 : 0); s += POLY([[cx, cy - step / 2], [cx + step * 0.865, cy], [cx, cy + step / 2], [cx - step * 0.865, cy]]) + L(cx, cy, cx, cy + step, thin); } }
  if (kind === 8) for (let y = 0; y < 220; y += step) for (let x = 0; x < 220; x += step) s += heart(x + step / 2, y + step / 2, step / 3.2);
  if (kind === 9) for (let y = 0; y < 220; y += step) for (let x = 0; x < 220; x += step) s += ((x / step + y / step) % 2) ? P(`M${x} ${y + step / 2}L${x + step / 2} ${y}L${x + step} ${y + step / 2}L${x + step / 2} ${y + step}Z`) : D(x + step / 2, y + step / 2, 2.5);
  const frame = seed % 3 === 1 ? C(100, 100, 86) : R(14, 14, 172, 172, 8);
  const clip = seed % 3 === 1 ? '<circle cx="100" cy="100" r="86"/>' : '<rect x="14" y="14" width="172" height="172" rx="8"/>';
  return `<clipPath id="cp">${clip}</clipPath><g clip-path="url(#cp)">${s}</g>` + frame;
}
export const patterns = many(30, 'Patroon', pattern, 0);

// ---------- Geometry ----------

function geometry(seed) {
  const r = rng(seed);
  const kind = seed % 6;
  if (kind === 0) {
    const n = r.pick([5, 7, 8, 9, 10, 12]), k = r.pick([2, 3]);
    const pts = Array.from({ length: n }, (_, i) => polar(100, 100, 82, (360 / n) * i));
    let d = '';
    for (let i = 0; i < n; i++) d += `M${fx(pts[i])}L${fx(pts[(i + k) % n])}`;
    return P(d) + C(100, 100, 82, thin);
  }
  if (kind === 1) {
    let s = C(100, 100, 26);
    for (let i = 0; i < 6; i++) s += C(...polar(100, 100, 26, i * 60), 26);
    if (r.chance(0.6)) for (let i = 0; i < 6; i++) s += C(...polar(100, 100, 45, i * 60 + 30), 26) + C(...polar(100, 100, 52, i * 60), 26);
    return s + C(100, 100, 78);
  }
  if (kind === 2) {
    const n = r.int(3, 6);
    let s = '';
    for (let i = 0; i < 12; i++) s += POLY(Array.from({ length: n }, (_, j) => polar(100, 100, 84 * Math.pow(0.86, i), (360 / n) * j + i * r.range(6, 12))));
    return s;
  }
  if (kind === 3) {
    let s = '';
    const sz = 22;
    for (let row = 0; row < 4; row++) for (let col = 0; col <= row; col++) {
      const cx = 100 + (col - row / 2) * sz * 1.73, cy = 40 + row * sz * 1.5;
      s += POLY([[cx, cy - sz], [cx + sz * 0.866, cy - sz / 2], [cx + sz * 0.866, cy + sz / 2], [cx, cy + sz], [cx - sz * 0.866, cy + sz / 2], [cx - sz * 0.866, cy - sz / 2]], true, W) + P(`M${cx - sz * 0.866} ${cy - sz / 2}L${cx} ${cy}L${cx + sz * 0.866} ${cy - sz / 2}M${cx} ${cy}V${cy + sz}`);
    }
    return s;
  }
  if (kind === 4) {
    let s = '';
    const lines = r.int(14, 22);
    for (let i = 0; i <= lines; i++) { const t = i / lines; s += L(20, 20 + 160 * t, 20 + 160 * t, 180, thin) + L(180, 180 - 160 * t, 180 - 160 * t, 20, thin); }
    return s + R(20, 20, 160, 160);
  }
  // whirl of squares: each square's corners sit a fixed fraction along the previous one
  let sq = [[20, 20], [180, 20], [180, 180], [20, 180]];
  const f = r.range(0.06, 0.14);
  let s = '';
  for (let i = 0; i < 26; i++) {
    s += POLY(sq, true, thin);
    sq = sq.map((p, j) => { const q = sq[(j + 1) % 4]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; });
  }
  return s;
}
export const geometric = many(30, 'Geometrie', geometry, 0);

// ---------- Letters ----------

const FONTS = {
  bubbel: 'Arial Black, Arial, sans-serif',
  klassiek: 'Georgia, Times New Roman, serif',
  sierlijk: 'Brush Script MT, Segoe Script, cursive',
};

const bubbleColor = (text) => ['#f7a8c4', '#7fc8f0', '#f7d23e', '#a8e0a0', '#c9a0f0', '#f7b07a'][[...text].reduce((a, c) => a + c.charCodeAt(0), 0) % 6];

export function lettering(text, style = 'bubbel') {
  const len = [...text].length;
  const size = len === 1 ? 170 : len === 2 ? 110 : len <= 4 ? 84 : len <= 7 ? 66 : 48;
  const fit = len >= 3 ? `textLength="${style === 'bubbel' ? 168 : 176}" lengthAdjust="spacingAndGlyphs"` : '';
  const t = (a) => `<text x="100" y="${100 + size * 0.36}" font-size="${size}" text-anchor="middle" ${fit} font-family="${FONTS[style] || FONTS.bubbel}" font-weight="${style === 'sierlijk' ? 400 : 900}" ${a}>${text.replace(/[<&>"]/g, '')}</text>`;
  if (style === 'bubbel') return t('stroke-width="16"') + t(`stroke="#fff" data-ks="${bubbleColor(text)}" ${K(bubbleColor(text))} stroke-width="11"`);
  if (style === 'schaduw') return G(t('stroke-width="2.5" fill="#fff"'), 'translate(6 6)') + t('stroke-width="2.5" fill="#fff"');
  return t('stroke-width="2" fill="#fff"');
}

const WORDS = ['Hallo', 'Love', 'Dream', 'Wow!', 'Zomer', 'Happy', 'Mama', 'Papa', 'Liefde', 'Thanks', 'Cool', 'Hi!', 'Party', 'Smile', 'Joy', 'Peace', 'Hoera', 'Yes!', 'Boem!', 'Hey'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const letters = [
  ...WORDS.map((w, i) => ({ t: `Woord: ${w}`, d: () => lettering(w, ['bubbel', 'schaduw', 'klassiek', 'sierlijk'][i % 4]) })),
  ...[...ALPHABET].map((ch) => ({ t: `Bubbelletter ${ch}`, d: () => lettering(ch, 'bubbel') })),
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((ch) => ({ t: `Letter ${ch} (klassiek)`, d: () => lettering(ch, 'schaduw') })),
];

// ---------- Space ----------

function planet(seed) {
  const r = rng(seed);
  let s = '';
  s += R(0, 0, 200, 200, 0, K('#1f2a4a') + ' stroke="none"');
  for (let i = 0; i < 14; i++) s += r.chance(0.5) ? star(r.range(10, 190), r.range(10, 190), r.range(3, 6), 1.5, 4) : D(r.range(10, 190), r.range(10, 190), 1.5);
  const pr = r.range(36, 56);
  const ring = r.chance(0.6);
  const tilt = r.range(-30, 30);
  if (ring) s += G(P(`M${100 - pr * 1.8} 100A${pr * 1.8} ${pr * 0.4} 0 0 0 ${100 + pr * 1.8} 100`), `rotate(${tilt} 100 100)`).replace('<path', '<path fill="none"');
  s += C(100, 100, pr, K(r.pick(['#f2954a', '#5aa8e0', '#e86a8a', '#9b6bd6', '#f2c94c', '#3fbf9f', '#e8543c'])));
  const bands = r.int(0, 4);
  for (let i = 0; i < bands; i++) { const y = r.range(-0.7, 0.7) * pr; const w = Math.sqrt(pr * pr - y * y); s += G(P(`M${100 - w} ${100 + y}Q100 ${100 + y + r.range(-8, 8)} ${100 + w} ${100 + y}`, thin), `rotate(${tilt} 100 100)`); }
  if (!bands) for (let i = 0; i < 4; i++) { const [x, y] = polar(100, 100, r.range(0, pr * 0.6), r.range(0, 360)); s += C(x, y, r.range(4, 9), thin); }
  if (ring) s += G(P(`M${100 - pr * 1.8} 100A${pr * 1.8} ${pr * 0.4} 0 0 1 ${100 + pr * 1.8} 100`) + P(`M${100 - pr * 1.55} 100A${pr * 1.55} ${pr * 0.3} 0 0 1 ${100 + pr * 1.55} 100`, thin), `rotate(${tilt} 100 100)`);
  return s;
}

export const space = [
  ...many(14, 'Planeet', planet, 1),
  ...list([
    ['Astronaut', () => R(60, 100, 80, 70, 20, W) + S(P('M62 110Q30 120 34 150', 'stroke-width="12"')) + `<g stroke="#fff">${S(P('M62 110Q30 120 34 150', 'stroke-width="7"'))}</g>` + S(C(34, 156, 9, W)) +
      R(66, 160, 28, 30, 6, W) + R(106, 160, 28, 30, 6, W) + C(100, 66, 44, W) + R(70, 48, 60, 40, 18) + P('M78 58Q86 52 94 54', thin) + R(84, 118, 32, 20, 3) + D(92, 128, 2.5) + D(108, 128, 2.5)],
    ['Ufo', () => E(100, 110, 80, 22, W) + P('M56 104Q60 50 100 50Q140 50 144 104Z', W) + E(100, 110, 80, 22) + [50, 80, 110, 140].map((x) => C(x + 5, 114, 5)).join('') + P('M70 132L50 186H150L130 132', 'stroke-dasharray="6 6"') + S(C(86, 78, 5)) + P('M90 90Q100 96 110 90')],
    ['Maan met sterren', () => P('M120 20Q60 30 56 100Q56 170 126 180Q90 160 86 100Q86 46 120 20Z', W) + C(84, 70, 6) + C(76, 130, 8) + star(150, 60, 14, 5) + star(160, 130, 9, 3.5) + star(130, 96, 6, 2.5)],
    ['Zonnestelsel', () => C(20, 100, 40, W) + [[70, 8], [96, 10], [126, 12], [160, 16]].map(([x, rr]) => C(x, 100, rr, W)).join('') + C(160, 100, 26, 'transform="matrix(1 0 0 .3 0 70)"') + P('M20 40Q200 100 20 160', 'stroke-dasharray="2 6"')],
    ['Komeet', () => C(150, 50, 18, W) + P('M138 64Q80 120 20 180M144 70Q100 130 50 186M132 58Q70 100 14 150', thin) + star(40, 50, 8, 3) + star(170, 160, 6, 2.5)],
    ['Telescoop', () => G(R(40, 70, 120, 30, 4, W) + R(150, 64, 20, 42, 3, W) + R(26, 76, 16, 18, 2, W), 'rotate(-25 100 85)') + P('M100 100L70 186M100 100L130 186M100 100V186') + star(170, 30, 8, 3)],
    ['Sterrenbeeld', () => { const pts = [[30, 140], [60, 110], [90, 120], [120, 80], [150, 60], [170, 90], [140, 110]]; return P('M' + pts.map(fx).join('L'), 'stroke-dasharray="3 5"') + pts.map(([x, y]) => star(x, y, 7, 2.5, 4, W)).join(''); }],
    ['Raket in de ruimte', () => G(P('M100 14Q140 50 140 110V160H60V110Q60 50 100 14Z', W) + C(100, 80, 14) + P('M60 120L34 160V176L60 160ZM140 120L166 160V176L140 160Z', W) + P('M84 160L90 190L100 172L110 190L116 160', W), 'rotate(30 100 100) translate(10 0) scale(.85)') + star(30, 40, 6, 2.5) + star(170, 170, 7, 3) + D(40, 160, 2) + D(160, 30, 2)],
  ]),
];

// ---------- Fantasy ----------

function monster(seed) {
  const r = rng(seed);
  const pts = Array.from({ length: 10 }, (_, i) => polar(100, 110, r.range(50, 70), i * 36));
  const body = r.pick(['#8fd16a', '#9b6bd6', '#5aa8e0', '#f2954a', '#e86a8a', '#3fbf9f', '#f7d23e']);
  let s = '';
  const horns = r.int(0, 2);
  if (horns === 1) s += S(P('M66 64Q50 30 60 20Q66 40 80 54', K('#f5efe6')));
  if (horns === 2) s += S(P('M80 56L72 20L94 48', K(body)) + C(72, 18, 5, K('#f2c94c')));
  s += S(P(`M50 150L40 ${170 + r.range(0, 10)}M60 156L58 ${176 + r.range(0, 8)}`, 'stroke-width="6"'));
  s += S(P(`M46 110Q${r.range(14, 26)} ${r.range(90, 130)} ${r.range(18, 30)} ${r.range(60, 90)}`, 'stroke-width="4"'));
  s += P(smooth(pts), K(body));
  const eyes = r.int(1, 3);
  if (eyes === 1) s += C(100, 92, 20, W) + C(100, 94, 9, 'fill="FILL"');
  if (eyes === 2) s += S(C(80, 92, 13, W) + C(81, 94, 6, 'fill="FILL"'));
  if (eyes === 3) s += C(100, 80, 10, W) + D(100, 82, 5) + S(C(76, 98, 10, W) + D(77, 100, 5));
  const mouthW = r.range(18, 30);
  s += P(`M${100 - mouthW} 122Q100 ${150 + r.range(0, 10)} ${100 + mouthW} 122Z`, K('#a8324a'));
  if (r.chance(0.7)) s += P(`M${100 - mouthW * 0.6} 124l5 8l5 -7M${100 + mouthW * 0.6} 124l-5 8l-5 -7`, W);
  for (let i = 0; i < r.int(0, 5); i++) { const [x, y] = polar(100, 110, r.range(30, 46), r.range(100, 260)); s += C(x, y, r.range(3, 7), thin); }
  return s;
}

function robot(seed) {
  const r = rng(seed);
  let s = '';
  const hw = r.range(56, 76), hh = r.range(40, 56);
  s += P(`M100 ${70 - hh / 2}V${50 - hh / 2}`) + C(100, 46 - hh / 2, 6, W);
  s += S(R(100 - hw / 2 - 8, 60 - 8, 10, 18, 3, W));
  s += R(100 - hw / 2, 70 - hh / 2 - 6, hw, hh, r.pick([4, 10, 20]), W);
  const eyeKind = r.int(0, 2);
  if (eyeKind === 0) s += S(C(84, 66, 8) + D(84, 66, 3.5));
  if (eyeKind === 1) s += S(R(76, 58, 16, 12, 2) + D(84, 64, 3));
  if (eyeKind === 2) s += R(78, 58, 44, 14, 7) + D(92, 65, 3) + D(108, 65, 3);
  s += r.chance(0.5) ? R(86, 80, 28, 8, 2) + P('M93 80V88M100 80V88M107 80V88', 'stroke-width="1.2"') : P('M88 80Q100 90 112 80');
  s += R(92, 92, 16, 8, 0, W);
  const bw = r.range(60, 84);
  s += S(P('M62 112Q40 120 36 150', 'stroke-width="10"')) + `<g stroke="#fff">${S(P('M62 112Q40 120 36 150', 'stroke-width="6"'))}</g>` + S(P('M28 150Q30 164 40 160M44 150Q46 162 36 164'));
  s += R(100 - bw / 2, 100, bw, 60, 8, W) + R(84, 112, 32, 24, 3) + C(92, 124, 3) + C(108, 124, 3, F);
  const legs = r.chance(0.5);
  if (legs) s += S(R(78, 160, 14, 20, 2, W) + R(72, 178, 26, 10, 3, W));
  else s += P('M70 160H130V176Q130 186 120 186H80Q70 186 70 176Z', W) + [82, 100, 118].map((x) => C(x, 174, 6)).join('');
  const bodyC = r.pick(['#9aa8c8', '#5aa8e0', '#f2954a', '#7cc46c', '#e86a8a', '#cfd6e6']);
  return paint(s, ['#e84a3a', '#6a7488', '#6a7488', bodyC, '#6a7488', bodyC, '#6a7488']);
}

export const fantasy = [
  ...many(24, 'Monster', monster, 1),
  ...many(16, 'Robot', robot, 1),
  ...list([
    ['Draak', () => P('M150 150Q190 150 186 120Q184 104 170 108') + P('M90 90Q60 60 70 30Q90 50 100 40Q110 60 130 56Q120 80 110 92Z', W) +
      E(110, 140, 46, 36, W) + E(110, 150, 26, 22, thin) + C(70, 90, 30, W) + P('M58 66L50 46L66 60M76 62L80 42L88 62', W) + P('M44 96Q36 98 38 104', thin) + D(66, 84, 4) + P('M50 100Q58 106 66 102') + P('M90 172v10M130 172v10', 'stroke-width="6"')],
    ['Spookje', () => P('M50 180V90Q50 30 100 30Q150 30 150 90V180L134 166L117 180L100 166L83 180L66 166Z', W) + D(84, 86, 6) + D(116, 86, 6) + E(100, 112, 8, 11) + S(P('M50 110Q30 110 34 90', W))],
    ['Toverdrank', () => P('M84 30H116V70Q156 90 156 130Q156 180 100 180Q44 180 44 130Q44 90 84 70Z', W) + R(80, 20, 40, 12, 4, W) + P('M50 120Q100 140 150 120', thin) + C(80, 150, 6) + C(110, 140, 4) + C(122, 160, 7) + star(160, 40, 10, 4) + star(40, 50, 7, 3)],
    ['Kristallen bol', () => C(100, 90, 60, W) + P('M60 60Q70 44 88 40', thin) + star(110, 100, 10, 4) + star(84, 76, 6, 2.5) + P('M50 150H150L160 186H40Z', W) + P('M60 150Q100 130 140 150')],
    ['Toverstaf', () => G(R(96, 70, 8, 120, 3, W), 'rotate(30 100 100)') + star(140, 46, 34, 14, 5, W) + D(60, 40, 3) + D(170, 110, 3) + star(70, 90, 6, 2.5) + star(176, 70, 5, 2)],
    ['Eenhoorn', () => P('M60 186Q50 140 70 110Q60 90 70 70Q86 46 120 50L150 70Q160 80 150 90L120 96Q110 110 120 140L130 186', W) + P('M110 52L118 8L126 54', W) + P('M112 40L124 36M114 28L122 26', thin) + D(128, 70, 4) +
      P('M70 70Q50 80 50 110Q40 140 56 160Q40 110 70 100Q60 130 74 150', 'stroke-width="2.2"') + P('M104 50L96 34L112 46', W)],
    ['Zeemeermin', () => P('M90 100Q70 140 100 160Q130 176 150 160Q170 150 186 160L180 140Q170 150 150 146Q120 140 120 100Z', W) + P('M150 160L176 186L186 160') + C(104, 50, 18, W) + P('M90 100H120L118 70H92Z', W) +
      P('M86 50Q70 90 60 110M122 50Q140 70 140 100', 'stroke-width="2.2"') + D(98, 50, 2.5) + D(110, 50, 2.5) + P('M100 58Q104 62 108 58', thin) + P('M100 120q6 4 12 0M104 134q6 4 12 0', thin)],
    ['Fee', () => S(P('M98 90Q50 40 40 80Q40 100 96 96Q50 120 60 140Q80 150 98 100', W)) + C(100, 60, 14, W) + P('M90 76H110L124 140H76Z', W) + P('M92 140V180M108 140V180') + G(R(-1, 0, 2, 30, 1), 'translate(128 100) rotate(-30)') + star(144, 74, 7, 3)],
    ['Kasteel in de wolken', () => R(60, 80, 80, 70, 0, W) + [60, 120].map((x) => R(x - 6, 50, 26, 100, 0, W) + P(`M${x - 8} 50L${x + 7} 22L${x + 22} 50Z`, W)).join('') + P('M88 150V120Q100 106 112 120V150') + P('M10 160Q20 140 40 150Q50 130 80 146Q100 130 130 146Q150 130 170 150Q190 144 192 160Q170 176 100 172Q30 176 10 160Z', W)],
    ['Draakenei', () => P('M100 20Q150 20 156 110Q160 180 100 180Q40 180 44 110Q50 20 100 20Z', W) + P('M70 60l10 10M110 40l10 10M60 110l14 6M120 90l14 6M90 140l12 8M130 140l8 10', 'stroke-width="2.4"') + P('M60 120L80 106L94 124L110 100L124 120L144 104', 'stroke-width="2"')],
  ]),
];

// ---------- Holidays ----------

function bauble(seed) {
  const r = rng(seed);
  let s = P('M100 10V40', thin) + R(88, 36, 24, 14, 3, K('#d8b04a')) + C(100, 110, 62, K(r.pick(['#e84a3a', '#2f7fd8', '#3f9a4f', '#9b6bd6', '#f2c94c', '#e86a8a'])));
  const kind = seed % 4;
  if (kind === 0) s += P('M38 100Q100 120 162 100M40 126Q100 146 160 126', thin) + Array.from({ length: 6 }, (_, i) => star(58 + i * 17, 113 + Math.sin(i) * 3, 5, 2)).join('');
  if (kind === 1) s += P('M44 80Q60 96 76 80Q92 96 108 80Q124 96 140 80Q150 92 156 86M40 130Q56 146 72 130Q88 146 104 130Q120 146 136 130Q148 142 160 132', thin);
  if (kind === 2) s += Array.from({ length: 12 }, () => C(r.range(56, 144), r.range(70, 150), r.range(3, 7), thin)).join('');
  if (kind === 3) s += ROT(P('M100 110V70M100 82l-8-8M100 82l8-8M100 96l-10-10M100 96l10-10', thin), 6, 100, 110);
  return s;
}

function egg(seed) {
  const r = rng(seed);
  let s = P('M100 20Q150 20 156 110Q160 180 100 180Q40 180 44 110Q50 20 100 20Z', K(r.pick(['#f7a8c4', '#a8e0f0', '#f7e26b', '#c9a0f0', '#a8e0a0', '#f7c6a0'])));
  const bands = r.int(2, 4);
  for (let i = 0; i < bands; i++) {
    const y = 60 + i * (110 / bands) + r.range(-6, 6);
    const kind = r.int(0, 3);
    const w = 56 - Math.abs(y - 110) * 0.25;
    if (kind === 0) s += P(`M${100 - w} ${y}` + Array.from({ length: 8 }, (_, k) => `l${(w * 2) / 8} ${k % 2 ? -8 : 8}`).join(''), thin);
    if (kind === 1) s += P(`M${100 - w} ${y}Q100 ${y + 10} ${100 + w} ${y}`, thin) + Array.from({ length: 5 }, (_, k) => D(100 - w + 10 + k * ((w * 2 - 20) / 4), y + 10, 2.4)).join('');
    if (kind === 2) s += P(`M${100 - w} ${y}` + Array.from({ length: 6 }, () => `q${w / 6} -10 ${w / 3} 0`).join(''), thin);
    if (kind === 3) s += Array.from({ length: 4 }, (_, k) => heart(100 - w + 14 + k * ((w * 2 - 28) / 3), y, 5)).join('');
  }
  return s;
}

function snowflake(seed) {
  const r = rng(seed);
  let arm = L(100, 100, 100, 18);
  const branches = r.int(2, 4);
  for (let i = 0; i < branches; i++) {
    const y = 100 - (82 * (i + 1)) / (branches + 1);
    const len = r.range(10, 26) * (1 - i * 0.12);
    arm += P(`M100 ${y}l${-len * 0.8} ${-len * 0.6}M100 ${y}l${len * 0.8} ${-len * 0.6}`);
  }
  if (r.chance(0.5)) arm += POLY([[100, 14], [106, 22], [100, 30], [94, 22]], true, '');
  if (r.chance(0.5)) arm += C(100, 18, 4);
  let s = ROT(arm, 6);
  if (r.chance(0.6)) s += POLY(Array.from({ length: 6 }, (_, i) => polar(100, 100, r.range(10, 22), i * 60)), true, W);
  return s;
}

export const holidays = [
  ...list([
    ['Kerstboom', () => R(88, 160, 24, 26, 2, W) + [0, 1, 2].map((i) => { const y = 164 - i * 40, w = 74 - i * 18; return P(`M${100 - w} ${y}L100 ${y - 64}L${100 + w} ${y}Q100 ${y - 10} ${100 - w} ${y}Z`, W); }).join('') + star(100, 30, 16, 6, 5, W) +
      [[70, 140], [124, 150], [100, 110], [80, 100], [120, 86], [96, 70]].map(([x, y]) => C(x, y, 5, W)).join('')],
    ['Sneeuwpop', () => C(100, 150, 40, W) + C(100, 92, 30, W) + C(100, 50, 22, W) + R(80, 14, 40, 22, 2, W) + R(72, 34, 56, 6, 2, W) + S(D(92, 48, 3)) + P('M100 54L124 60L100 60Z', W) + P('M70 92L40 70M130 92L160 70') + D(100, 86, 3) + D(100, 100, 3) + D(100, 140, 3)],
    ['Pompoen', () => P('M100 50Q60 40 34 70Q14 100 30 140Q50 176 100 172Q150 176 170 140Q186 100 166 70Q140 40 100 50Z', W) + P('M100 50Q80 100 100 172M100 50Q120 100 100 172M70 52Q50 110 70 170M130 52Q150 110 130 170', thin) + P('M100 50Q98 30 110 20')],
    ['Pompoenlantaarn', () => P('M100 50Q60 40 34 70Q14 100 30 140Q50 176 100 172Q150 176 170 140Q186 100 166 70Q140 40 100 50Z', W) + P('M100 50Q98 30 110 20') + S(P('M60 100L78 82L90 104Z', F)) + P('M92 116L100 104L108 116Z', F) + P('M54 128Q100 170 146 128L130 138L120 126L108 142L92 126L80 142L70 128Z', F)],
    ['Zuurstok', () => P('M80 190V70Q80 30 116 30Q150 30 150 66', 'stroke-width="22"') + `<g stroke="#fff">${P('M80 190V70Q80 30 116 30Q150 30 150 66', 'stroke-width="17"')}</g>` + P('M70 180L90 170M70 150L90 140M70 120L90 110M70 90L90 80M76 56L94 64M100 38L112 52M130 34L124 50M150 50L136 58', 'stroke-width="4"')],
    ['Kaars met hulst', () => R(80, 70, 40, 110, 4, W) + P('M100 70V56') + P('M100 58Q88 44 100 24Q112 44 100 58Z', W) + P('M60 180Q50 160 80 164Q74 150 100 156Q126 150 120 164Q150 160 140 180Z', W) + C(96, 168, 5, W) + C(106, 170, 5, W)],
    ['Sinterklaasschoen', () => P('M30 110H90V60H120V130Q170 130 176 160V180H30Z', W) + P('M30 150H176') + R(84, 52, 42, 14, 4, W) + P('M100 52Q90 20 110 10Q120 30 106 50', thin)],
    ['Hartjes (Valentijn)', () => heart(80, 90, 50, W) + heart(130, 120, 36, W) + P('M30 170L170 40', thin) + P('M170 40l-14 2M170 40l-2 14')],
    ['Vuurwerk', () => ROT(P('M100 70V40'), 12, 100, 80) + ROT(D(100, 34, 2.5), 12, 100, 80) + ROT(P('M60 140V124', thin), 8, 60, 150) + ROT(P('M150 150V136', thin), 8, 150, 158) + P('M100 190Q96 150 100 110', 'stroke-dasharray="3 5"')],
    ['Paashaas', () => S(G(E(84, 46, 11, 32, W), 'rotate(-12 84 46)')) + E(100, 140, 42, 46, W) + C(100, 88, 30, W) + S(D(88, 84, 4)) + E(100, 96, 4, 3, F) + P('M100 99Q100 104 94 104M100 99Q100 104 106 104') + E(100, 150, 22, 26, thin)],
  ]),
  ...many(12, 'Paasei', egg, 1),
  ...many(8, 'Kerstbal', bauble, 0),
  ...many(20, 'Sneeuwvlok', snowflake, 1),
];
