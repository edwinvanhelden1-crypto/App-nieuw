import { W, F, K, C, E, P, L, D, G, S, M, R, POLY, ROT, polar, smooth, spiral, heart, rng, paint } from './svg.js';

const NONE = 'stroke="none"';
const shine = (x, y) => C(x, y, 1.8, `fill="#fff" ${NONE}`);

// ---------- Kawaii animal heads ----------

const EXPRESSIONS = {
  blij: ({ dx, ey, my }) =>
    S(D(100 - dx, ey, 6) + shine(100 - dx + 2, ey - 2)) + P(`M91 ${my}Q95.5 ${my + 6} 100 ${my}Q104.5 ${my + 6} 109 ${my}`),
  lachend: ({ dx, ey, my }) =>
    S(P(`M${100 - dx - 8} ${ey + 3}Q${100 - dx} ${ey - 8} ${100 - dx + 8} ${ey + 3}`)) +
    P(`M90 ${my - 2}Q100 ${my + 15} 110 ${my - 2}Z`, W) + P(`M95 ${my + 5}Q100 ${my + 1} 105 ${my + 5}`),
  slaperig: ({ dx, ey, my }) =>
    S(P(`M${100 - dx - 8} ${ey}Q${100 - dx} ${ey + 7} ${100 - dx + 8} ${ey}`)) + C(100, my + 2, 3) +
    P('M150 40h10l-10 10h10M166 24h7l-7 7h7', 'stroke-width="2"'),
  knipoog: ({ dx, ey, my }) =>
    D(100 - dx, ey, 6) + shine(100 - dx + 2, ey - 2) +
    P(`M${100 + dx - 6} ${ey - 6}L${100 + dx + 4} ${ey}L${100 + dx - 6} ${ey + 6}`) +
    P(`M92 ${my}Q100 ${my + 9} 108 ${my}`),
  verliefd: ({ dx, ey, my }) => S(heart(100 - dx, ey, 8, F)) + P(`M92 ${my}Q100 ${my + 9} 108 ${my}`),
  verbaasd: ({ dx, ey, my }) => S(C(100 - dx, ey, 8) + D(100 - dx, ey, 4)) + E(100, my + 3, 4.5, 6.5),
};

const blush = ({ dx, ey }) => S(P(`M${100 - dx - 12} ${ey + 18}l4 -6M${100 - dx - 6} ${ey + 18}l4 -6M${100 - dx} ${ey + 18}l4 -6`, 'stroke-width="1.8"'));

const HEAD = E(100, 110, 62, 56, W);

const ANIMALS = {
  kat: () => ({
    back: S(P('M50 88L48 34L90 60', W) + P('M56 72L56 46L76 60', 'stroke-width="1.8"')),
    front: S(L(36, 118, 60, 122) + L(36, 132, 60, 128)) + P('M96 120h8l-4 4z', F),
    dx: 26, ey: 108, my: 126,
  }),
  beer: () => ({
    back: S(C(54, 66, 19, W) + C(54, 66, 9)),
    front: E(100, 132, 22, 15, W) + E(100, 125, 7, 5, F),
    dx: 28, ey: 104, my: 134, small: true,
  }),
  konijn: () => ({
    back: S(G(E(76, 36, 14, 40, W) + E(76, 40, 6, 27), 'rotate(-10 76 70)')),
    front: E(100, 121, 4, 3, F),
    dx: 26, ey: 108, my: 126,
  }),
  muis: () => ({
    back: S(C(46, 66, 30, W) + C(46, 66, 17)),
    front: E(100, 121, 5, 4, F) + S(L(40, 116, 62, 120) + L(42, 130, 62, 126)),
    dx: 26, ey: 108, my: 128,
  }),
  vos: () => ({
    back: S(P('M48 92L44 30L92 60', W) + P('M54 74L52 46L74 60', 'stroke-width="1.8"')),
    front: S(P('M40 112Q70 116 92 150')) + E(100, 136, 6, 4, F),
    dx: 26, ey: 106, my: 142, small: true,
  }),
  varken: () => ({
    back: S(P('M54 70L46 38L84 56Z', W)),
    front: E(100, 130, 20, 14, W) + S(E(93, 130, 3, 5, F)),
    dx: 30, ey: 104, my: 148, small: true,
  }),
  hond: () => ({
    back: '',
    front: S(P('M56 64Q26 70 32 122Q40 140 56 120Q50 92 64 70Z', W)) + E(100, 132, 20, 14, W) + E(100, 124, 8, 6, F),
    dx: 26, ey: 106, my: 134, small: true,
  }),
  kikker: () => ({
    back: S(C(68, 64, 24, W)),
    front: '',
    dx: 32, ey: 64, my: 128,
  }),
  panda: () => ({
    back: S(C(54, 66, 19, F)),
    front: S(G(E(72, 106, 14, 19, F), 'rotate(35 72 106)')) + E(100, 126, 7, 5, F),
    dx: 28, ey: 104, my: 134, panda: true,
  }),
  kuiken: () => ({
    back: '',
    front: P('M96 56Q90 38 100 42Q106 34 106 54', 'stroke-width="2.2"') + P('M92 122L100 116L108 122L100 130Z', W) + S(P('M42 140Q30 128 40 116')),
    dx: 26, ey: 106, my: 200,
  }),
  pinguin: () => ({
    back: '',
    front: P('M100 92Q84 66 64 86Q50 112 70 140Q100 166 130 140Q150 112 136 86Q116 66 100 92Z') + P('M92 122L108 122L100 132Z', F),
    dx: 22, ey: 108, my: 200,
  }),
  uil: () => ({
    back: S(P('M52 76L44 40L80 58', W)),
    front: S(C(76, 104, 20)) + P('M94 120L106 120L100 132Z', F) + S(P('M64 148q6 6 12 0M80 156q6 6 12 0', 'stroke-width="1.8"')),
    dx: 24, ey: 104, my: 200,
  }),
  eenhoorn: () => ({
    back: S(P('M60 74L54 44L82 60', W)) + P('M88 58L100 10L112 58', W) + P('M92 44L108 38M95 32L106 28', 'stroke-width="1.8"'),
    front: P('M112 56Q140 46 150 70Q164 66 162 90Q174 100 160 118', 'stroke-width="2.2"'),
    dx: 26, ey: 108, my: 128,
  }),
};

const ANIMAL_COLORS = {
  kat: ['#f4a259'],
  beer: ['#b07a52', '#b07a52', '#b07a52', '#ead2b5'],
  konijn: ['#efe9f4'],
  muis: ['#c4c4d4'],
  vos: ['#f08a3c'],
  varken: ['#f7b6c2', '#f7b6c2', '#f7b6c2', '#f28aa5'],
  hond: ['#e8c08a', '#a8754a', '#a8754a', '#f7e6cc'],
  kikker: ['#8fd16a'],
  panda: [null],
  kuiken: ['#ffd84d', '#f5953a'],
  pinguin: ['#9fb3d1'],
  uil: ['#c79a6a'],
  eenhoorn: ['#fdf0fa', '#fdf0fa', '#ffd34d', '#fdf0fa'],
};

const ANIMAL_NAMES = {
  kat: 'Kat', beer: 'Beer', konijn: 'Konijn', muis: 'Muis', vos: 'Vos', varken: 'Varken', hond: 'Hond',
  kikker: 'Kikker', panda: 'Panda', kuiken: 'Kuiken', pinguin: 'Pinguïn', uil: 'Uil', eenhoorn: 'Eenhoorn',
};

function kawaii(animal, expr) {
  const a = ANIMALS[animal]();
  const face = { ...a };
  if (a.my > 190) face.my = a.ey + 30; // beak animals: mouth hidden by beak
  let mouthless = a.my > 190;
  let featuresFace = EXPRESSIONS[expr](face);
  if (mouthless) {
    // Only keep the eyes for animals with a beak.
    featuresFace = EXPRESSIONS[expr]({ ...face, my: 400 });
  }
  if (a.panda) featuresFace = featuresFace.replaceAll('FILL', '#fff');
  return paint(a.back + HEAD + a.front, ANIMAL_COLORS[animal]) + featuresFace + (a.panda ? '' : blush(a));
}

export const kawaiiAnimals = [];
for (const animal of Object.keys(ANIMALS)) {
  for (const expr of Object.keys(EXPRESSIONS)) {
    kawaiiAnimals.push({ t: `${ANIMAL_NAMES[animal]} – ${expr}`, d: () => kawaii(animal, expr) });
  }
}

// ---------- Kawaii objects (cartoon) ----------

const face = (x, y, s = 1, expr = 'blij') => {
  const dx = 12 * s;
  const e = EXPRESSIONS[expr]({ dx: 12, ey: 0, my: 10 });
  return G(e, `translate(${x - 100 * s} ${y}) scale(${s})`) + G(blush({ dx, ey: 0 }), `translate(${x - 100} ${y - 4})`);
};

const THING_COLORS = {
  'Cupcake': ['#7ec8e3', '#f9b8d0', '#e53b4b'],
  'IJsje': ['#e7b26a', '#f7a8c4'],
  'Donut': ['#e9b46f'],
  'Koffiekop': ['#9ad1d4'],
  'Melkpak': ['#7fb8f0'],
  'Avocado': ['#4f8a3c', '#a0612f'],
  'Aardbei': ['#e8484f', '#5cb85c'],
  'Wolk': ['#dff1ff'],
  'Zon': ['#ffd34d'],
  'Maan': ['#ffe58a'],
  'Ster': ['#ffd34d'],
  'Hart': ['#ff6f91'],
  'Wolkje met regen': ['#c9e3f7'],
  'Taartpunt': ['#f6d7a7', '#e53b4b'],
  'Melkshake': ['#f7a8c4', '#fff8ee', '#e53b4b'],
  'Plantje': ['#d9774a', '#c8653c', '#6cc068'],
  'Rijstbal': [null],
  'Kaars': ['#f7c6d9', '#ffcc33'],
  'Ballon': ['#ff6f91'],
  'Cadeau': ['#6fb7f0', '#f05a7e', '#f05a7e', '#f05a7e', '#f05a7e'],
};

const KAWAII_THINGS = [
  ['Cupcake', () => P('M50 110L62 176H138L150 110Z', W) + P('M66 110l4 66M84 110l2 66M100 110v66M116 110l-2 66M134 110l-4 66', 'stroke-width="1.8"') +
    P('M44 112Q36 92 58 88Q56 62 84 64Q92 40 116 52Q140 50 140 76Q166 82 156 112Z', W) + C(100, 40, 9, W) + P('M100 31Q104 20 112 18'), 'face', 100, 150],
  ['IJsje', () => P('M66 100L100 186L134 100', W) + P('M74 118L120 112M80 134L114 128M88 150L110 146', 'stroke-width="1.8"') +
    P(smooth([[60, 102], [56, 76], [74, 54], [100, 46], [126, 54], [144, 76], [140, 102], [120, 96], [100, 104], [80, 96]], true), W), 'face', 100, 70],
  ['Donut', () => C(100, 104, 70, W) + C(100, 104, 22) + P('M36 96Q40 50 100 40Q160 46 166 98Q150 92 146 106Q130 96 126 112Q116 102 100 120Q86 104 76 114Q72 98 56 106Q48 92 36 96Z') +
    P('M70 62l6 4M120 56l6 -3M146 76l2 6M58 80l-3 5M96 52l5 2', 'stroke-width="3"'), 'face', 100, 150],
  ['Koffiekop', () => P('M44 76H148L140 160Q138 176 120 176H72Q54 176 52 160Z', W) + P('M146 92Q180 90 176 118Q172 140 142 138') +
    P('M80 54Q72 42 80 32Q88 22 80 12M102 54Q94 42 102 32Q110 22 102 12M124 54Q116 42 124 32Q132 22 124 12', 'stroke-width="2"'), 'face', 96, 108],
  ['Melkpak', () => P('M58 70L76 40H124L142 70V180H58Z', W) + P('M76 40L58 70H142M82 30H118V40H82Z') + R(70, 128, 60, 34, 6), 'face', 100, 92],
  ['Avocado', () => P('M100 22Q132 22 140 70Q168 110 154 150Q138 184 100 184Q62 184 46 150Q32 110 60 70Q68 22 100 22Z', W) +
    P('M100 34Q124 34 130 76Q152 108 142 142Q130 170 100 170Q70 170 58 142Q48 108 70 76Q76 34 100 34Z') + C(100, 136, 22, W), 'face', 100, 82],
  ['Aardbei', () => P('M100 186Q46 150 40 96Q40 62 70 58Q100 54 130 58Q160 62 160 96Q154 150 100 186Z', W) +
    P('M64 60Q70 40 86 52Q92 30 100 46Q108 30 114 52Q130 40 136 60Q118 70 100 60Q82 70 64 60Z', W) + P('M100 46V26') +
    P('M64 130l2 4M82 150l2 4M120 152l-2 4M138 128l-2 4M100 166v4', 'stroke-width="3"'), 'face', 100, 98],
  ['Wolk', () => P('M50 150Q18 150 20 120Q22 92 52 94Q54 58 92 60Q112 38 138 56Q166 58 164 90Q186 96 182 124Q178 150 150 150Z', W), 'face', 100, 108],
  ['Zon', () => ROT(P('M100 22V40'), 12) + C(100, 100, 46, W), 'face', 100, 96],
  ['Maan', () => P('M126 26Q70 30 62 92Q60 150 112 172Q160 182 178 140Q110 160 98 100Q90 50 126 26Z', W), 'face2', 104, 100],
  ['Ster', () => P('M100 22L122 72L176 76L134 110L148 164L100 136L52 164L66 110L24 76L78 72Z', W), 'face', 100, 98],
  ['Hart', () => heart(100, 104, 74, W), 'face', 100, 94],
  ['Wolkje met regen', () => P('M50 120Q18 120 20 92Q22 64 52 66Q54 30 92 32Q112 10 138 28Q166 30 164 62Q186 68 182 96Q178 120 150 120Z', W) +
    P('M60 140l-6 14M90 140l-6 14M120 140l-6 14M150 140l-6 14M74 164l-6 14M104 164l-6 14M134 164l-6 14'), 'face', 100, 78],
  ['Taartpunt', () => P('M30 150L170 110V170L30 190Z', W) + P('M30 150L100 60L170 110') + P('M30 168L170 136', 'stroke-width="1.8"') + C(110, 58, 12, W), 'face', 116, 134],
  ['Melkshake', () => P('M60 70H140L128 186H72Z', W) + P('M56 70Q56 40 100 40Q144 40 144 70Z', W) + P('M112 40L130 6') + C(100, 30, 8, W), 'face', 100, 116],
  ['Plantje', () => P('M64 120H136L128 184H72Z', W) + R(58, 108, 84, 16, 4, W) + P('M100 108V70') + P('M100 84Q70 86 58 56Q90 50 100 84Z', W) + P('M100 72Q120 40 150 44Q144 78 100 72Z', W), 'face', 100, 136],
  ['Rijstbal', () => P('M100 24Q120 24 160 120Q176 170 100 172Q24 170 40 120Q80 24 100 24Z', W) + R(72, 128, 56, 44, 2, F), 'face', 100, 92],
  ['Kaars', () => R(70, 80, 60, 100, 8, W) + P('M100 80V64') + P('M100 66Q84 50 100 22Q116 50 100 66Z', W) + P('M70 100Q86 110 92 100Q96 120 106 104', 'stroke-width="1.8"'), 'face', 100, 128],
  ['Ballon', () => E(100, 82, 52, 60, W) + P('M94 142L100 150L106 142Z') + P('M100 150Q86 170 104 186') + P('M70 60Q76 44 90 40', 'stroke-width="2"'), 'face', 100, 82],
  ['Cadeau', () => R(40, 90, 120, 90, 4, W) + R(32, 70, 136, 24, 4, W) + P('M92 70V180M108 70V180') + P('M100 70Q70 30 60 56Q60 70 100 70Q140 70 140 56Q130 30 100 70Z', W), 'face', 100, 130],
];

export const kawaiiThings = KAWAII_THINGS.map(([t, draw, kind, fx, fy], i) => ({
  t,
  d: () => paint(draw(), THING_COLORS[t] || [null]) + face(fx, fy, kind === 'face2' ? 0.9 : 1, ['blij', 'lachend', 'knipoog', 'blij', 'verliefd'][i % 5]),
}));

const HAND_COLORS = {
  Uil: ['#b88a5a', '#f2a43c'],
  'Pinguïn': ['#3a4766', '#fffaf0', '#f2a43c'],
  Eend: ['#ffd84d', '#f2953a'],
  Kip: ['#f2ece0'],
  Flamingo: ['#f59ab5'],
  'Zittende kat': ['#f4a259'],
  Hond: ['#e8c08a', '#e8c08a', '#a8754a', '#a8754a', '#f7e6cc', '#f27a8a', '#f2c94c'],
  Olifant: ['#b8c4d6'],
  Leeuw: [...Array(14).fill('#d9822b'), '#e0952f', '#f2c26b'],
  Schildpad: ['#8fc46a', '#8fc46a', '#8fc46a', '#4f8a3c'],
  Walvis: ['#6aa6d8'],
  Octopus: ['#e86a8a'],
  Krab: ['#e8543c', '#e8543c', '#e8543c', null],
  Slak: ['#c8d68a', '#d9a05b'],
  Bij: ['#dff1ff', '#dff1ff', '#f7d23e', '#f7d23e'],
  Egel: ['#8a6a50', '#e8c9a0'],
  Dinosaurus: ['#7cc46c', '#f2a43c'],
  Konijn: ['#d8d0c8'],
  Giraf: ['#f2c26b'],
  'Vos (zittend)': ['#f08a3c'],
  Muis: ['#c4c4d4'],
  Kwal: ['#c79ae8'],
  Zeester: ['#f2954a'],
  Schelp: ['#f7c6a8'],
  Zeepaardje: ['#f2c94c'],
  'Vuurtoren in zee': ['#f5efe6', '#ffe58a', '#e84a3a'],
  Golf: ['#5aa8e0'],
  'Duikbril en snorkel': ['#f2c94c'],
};
const colorList = (arr) => arr.map(([t, d]) => ({ t, d: HAND_COLORS[t] ? () => paint(d(), HAND_COLORS[t]) : d }));

// ---------- Birds ----------

const BIRD_TYPES = [
  { name: 'Mus', c: ['#c9a27a', '#8a5a3a', '#a07050', '#e0b060'], beak: 'kort', tail: 'kort', crest: false, bodyX: 46, head: 22 },
  { name: 'Roodborstje', c: ['#e8743c', '#8a6a50', '#9a7a5c', '#5a4a3a'], beak: 'kort', tail: 'kort', crest: false, bodyX: 44, head: 24, breast: true },
  { name: 'Mees', c: ['#f2d64b', '#6a93c9', '#4a5f8a', '#555'], beak: 'kort', tail: 'lang', crest: false, bodyX: 42, head: 22, cap: true },
  { name: 'Kuifmees', c: ['#d8c8b0', '#8a7a6a', '#d8c8b0', '#555'], beak: 'kort', tail: 'kort', crest: true, bodyX: 44, head: 22 },
  { name: 'Papegaai', c: ['#3fbf5f', '#2f7fd8', '#e84a3a', '#f2c94c'], beak: 'haak', tail: 'lang', crest: false, bodyX: 40, head: 26 },
  { name: 'Kolibrie', c: ['#3fbf9f', '#2f8f6f', '#d84a8a', '#444'], beak: 'naald', tail: 'kort', crest: false, bodyX: 36, head: 18, fly: true },
  { name: 'Zwaluw', c: ['#f5efe6', '#2a3a6a', '#3a4a7a', '#444'], beak: 'kort', tail: 'gevorkt', crest: false, bodyX: 44, head: 20 },
  { name: 'IJsvogel', c: ['#f08a3c', '#2aa6d8', '#2a86c8', '#444'], beak: 'lang', tail: 'kort', crest: false, bodyX: 42, head: 26 },
  { name: 'Kardinaal', c: ['#d8312f', '#a82a2a', '#d8312f', '#f2a43c'], beak: 'dik', tail: 'lang', crest: true, bodyX: 46, head: 24 },
  { name: 'Toekan', c: ['#3a404c', '#2a2f38', '#f5efe6', '#f59a2a'], beak: 'toekan', tail: 'kort', crest: false, bodyX: 42, head: 22 },
];

function bird(type, seed) {
  const r = rng(seed);
  const hx = 128, hy = 74 + r.range(-6, 6);
  const tilt = r.range(-26, -14);
  let s = '';
  // branch
  const branch = !type.fly;
  if (branch) {
    s += P(`M10 ${150 + r.range(-4, 4)}Q100 ${140 + r.range(-6, 6)} 190 ${156 + r.range(-6, 6)}`, 'stroke-width="4"');
    s += P('M160 152Q170 130 186 126Q178 146 160 152Z', K('#6cc068')) + P('M40 148Q36 128 20 120Q22 142 40 148Z', K('#6cc068'));
  }
  // tail
  const tx = 56, ty = 124;
  if (type.tail === 'kort') s += P(`M${tx + 10} ${ty - 8}L${tx - 30} ${ty + 22}L${tx - 22} ${ty + 30}L${tx + 16} ${ty + 6}Z`, K(type.c[1]));
  if (type.tail === 'lang') s += P(`M${tx + 10} ${ty - 8}L${tx - 44} ${ty + 56}L${tx - 32} ${ty + 60}L${tx + 18} ${ty + 6}Z`, K(type.c[1])) + L(tx + 8, ty, tx - 36, ty + 56, 'stroke-width="1.5"');
  if (type.tail === 'gevorkt') s += P(`M${tx + 10} ${ty - 8}L${tx - 48} ${ty + 30}L${tx - 14} ${ty + 12}L${tx - 40} ${ty + 46}L${tx + 18} ${ty + 6}Z`, K(type.c[1]));
  // legs
  if (branch) s += P('M96 140l-4 14M108 140l2 14', 'stroke-width="2.4"') + P('M86 156l6-2 6 2M104 156l6-2 6 2', 'stroke-width="2"');
  // body
  s += G(E(98, 112, type.bodyX, 32, K(type.c[0])), `rotate(${tilt} 98 112)`);
  if (type.breast) s += P(`M${hx - 8} ${hy + 18}Q${hx + 10} ${hy + 40} 120 132`, 'stroke-width="1.8"');
  // wing
  const wy = r.range(-4, 4);
  s += P(`M${72} ${100 + wy}Q100 ${86 + wy} 122 ${102 + wy}Q100 ${128 + wy} 60 ${136 + wy}Q66 ${116 + wy} 72 ${100 + wy}Z`, K(type.c[1]));
  s += P(`M78 ${118 + wy}L100 ${112 + wy}M72 ${126 + wy}L94 ${122 + wy}`, 'stroke-width="1.6"');
  if (type.fly) s += P(`M90 ${96}Q70 40 40 30Q60 70 70 100`, K(type.c[1]));
  // head
  s += C(hx, hy, type.head, K(type.c[2]));
  if (type.cap) s += P(`M${hx - type.head} ${hy - 4}Q${hx} ${hy - 14} ${hx + type.head} ${hy - 4}`, 'stroke-width="1.8"');
  if (type.crest) s += P(`M${hx - 14} ${hy - 16}L${hx - 20} ${hy - 40}L${hx - 6} ${hy - 22}L${hx - 4} ${hy - 44}L${hx + 4} ${hy - 22}`, K(type.c[2]));
  // beak
  const bx = hx + type.head - 3, by = hy + 2;
  const beaks = {
    kort: `M${bx} ${by - 6}L${bx + 16} ${by + 1}L${bx} ${by + 7}Z`,
    dik: `M${bx} ${by - 9}Q${bx + 20} ${by} ${bx} ${by + 10}Z`,
    naald: `M${bx} ${by - 3}L${bx + 50} ${by + 6}L${bx} ${by + 4}Z`,
    lang: `M${bx} ${by - 7}L${bx + 36} ${by + 4}L${bx} ${by + 8}Z`,
    haak: `M${bx - 2} ${by - 10}Q${bx + 24} ${by - 10} ${bx + 18} ${by + 16}Q${bx + 10} ${by + 4} ${bx} ${by + 8}Z`,
    toekan: `M${bx - 4} ${by - 12}Q${bx + 60} ${by - 14} ${bx + 58} ${by + 6}Q${bx + 30} ${by + 14} ${bx - 2} ${by + 10}Z`,
  };
  s += P(beaks[type.beak], K(type.c[3]));
  if (type.beak === 'toekan') s += P(`M${bx} ${by}Q${bx + 30} ${by - 2} ${bx + 56} ${by + 2}`, 'stroke-width="1.6"');
  // eye
  s += D(hx + 6, hy - 4, 4.2) + shine(hx + 7.5, hy - 5.5);
  return s;
}

export const birds = [];
BIRD_TYPES.forEach((type, i) => {
  for (let v = 0; v < 3; v++) birds.push({ t: `${type.name} ${v + 1}`, d: () => bird(type, i * 10 + v + 1) });
});

const HAND_BIRDS = [
  ['Uil', () => P('M100 30C150 30 160 120 140 160Q100 185 60 160C40 120 50 30 100 30Z', W) + S(P('M64 46L58 20L82 36')) +
    S(C(78, 74, 19) + C(78, 74, 8) + D(80, 72, 4)) + P('M94 88L100 102L106 88Z', W) + S(P('M58 96Q46 130 72 156')) +
    P('M84 118l6 6 6-6M104 118l6 6 6-6M94 134l6 6 6-6M84 150l6 6 6-6M104 150l6 6 6-6', 'stroke-width="1.8"') +
    P('M20 172H180', 'stroke-width="4"') + S(P('M84 166v10M90 166v10'))],
  ['Pinguïn', () => P('M100 24Q146 24 150 100Q156 160 136 180H64Q44 160 50 100Q54 24 100 24Z', W) +
    P('M100 62Q76 62 72 110Q70 160 84 176H116Q130 160 128 110Q124 62 100 62Z', W) + S(P('M54 96Q26 120 32 150Q46 134 54 124')) +
    S(D(86, 56, 4.5)) + P('M92 66L108 66L100 80Z', W) + S(E(80, 182, 16, 6, W))],
  ['Zwaan', () => P('M30 140Q40 180 100 180Q170 180 178 130Q150 140 120 134Q132 100 112 70Q100 40 116 30Q132 22 140 36', W) +
    P('M140 36L156 44L140 48') + D(130, 34, 3) + P('M50 140Q80 110 120 134', 'stroke-width="2"') + P('M10 186Q40 178 70 186T130 186T190 186', 'stroke-width="2"')],
  ['Eend', () => P('M40 120Q40 170 100 170Q164 170 168 120Q170 100 150 104Q130 108 126 100Q140 80 132 60Q120 36 96 42Q74 50 80 80Q84 96 70 104Q40 104 40 120Z', W) +
    P('M80 64Q60 64 56 72Q66 82 84 76', W) + D(102, 60, 4) + P('M70 126Q100 112 130 130Q110 148 76 140', 'stroke-width="2"')],
  ['Kip', () => P('M60 110Q50 170 110 170Q164 168 166 110Q166 70 140 80Q150 40 120 50Q114 66 120 80Q100 92 60 110Z') +
    P('M60 110Q40 80 30 110Q30 130 60 124', W) + P('M120 50Q116 30 128 34Q132 22 142 32Q152 30 146 46') + P('M150 74L168 82L150 88') +
    P('M146 90Q148 104 140 104Q134 96 142 90') + D(138, 68, 3.5) + P('M100 170V186M120 170V186M94 186h12M114 186h12')],
  ['Flamingo', () => P('M60 90Q60 60 100 64Q130 66 128 92Q124 116 90 116Q60 116 60 90Z', W) + P('M116 72Q140 60 130 30Q120 10 104 24Q98 34 106 40') +
    P('M106 40L94 52Q90 56 96 56L108 46') + D(110, 26, 2.5) + P('M96 116V186M96 140L110 154L104 160', 'stroke-width="2.2"') + P('M84 186h24')],
];
export const handBirds = colorList(HAND_BIRDS);

// ---------- Hand drawn animals ----------

const HAND_ANIMALS = [
  ['Zittende kat', () => P('M140 172Q182 170 174 128Q170 110 182 102') + P('M72 96Q50 150 60 180L140 180Q150 150 128 96', W) +
    P('M66 58L72 20L94 36Q100 34 106 36L128 20L134 58Q140 100 100 104Q60 100 66 58Z', W) + S(D(86, 64, 4.5)) + P('M96 76H104L100 81Z', F) +
    P('M100 81Q100 88 92 88M100 81Q100 88 108 88') + S(L(56, 74, 78, 78, 'stroke-width="1.6"') + L(56, 84, 78, 82, 'stroke-width="1.6"')) +
    P('M80 180Q80 166 92 166Q100 166 100 180M100 180Q100 166 108 166Q120 166 120 180')],
  ['Hond', () => P('M70 120Q48 160 60 184H140Q152 160 130 120', W) + E(100, 84, 42, 40, W) + S(P('M62 58Q34 62 38 112Q44 128 60 112Q56 82 70 62Z', W)) +
    E(100, 104, 20, 14, W) + E(100, 96, 8, 6, F) + S(D(84, 76, 5)) + P('M100 102V110M88 112Q100 120 112 112') + P('M96 113Q100 126 104 113', W) +
    P('M64 124Q100 140 136 124', 'stroke-width="4"') + C(100, 140, 7, W)],
  ['Olifant', () => S(E(52, 84, 32, 40, W)) + E(100, 84, 38, 42, W) + P('M86 112Q82 150 62 156Q54 160 60 168Q76 170 88 158Q108 138 114 112Z', W) +
    S(D(84, 76, 4.5)) + S(P('M88 116Q80 124 76 120', 'stroke-width="1.8"')) + P('M80 136l4 3M78 146l4 2', 'stroke-width="1.6"')],
  ['Leeuw', () => ROT(P('M100 22Q114 22 116 34Q104 40 100 40Q96 40 84 34Q86 22 100 22Z', W), 14) + C(100, 100, 56, W) + C(100, 100, 46, W) +
    S(C(66, 64, 10, W)) + S(D(84, 92, 4.5)) + P('M92 110H108L100 118Z', F) + P('M100 118Q100 128 90 128M100 118Q100 128 110 128') +
    S(P('M60 112l18 2M62 122l16-2', 'stroke-width="1.5"'))],
  ['Schildpad', () => S(E(70, 150, 12, 16, W)) + C(28, 110, 16, W) + D(24, 106, 3) + P('M18 116Q24 120 30 116', 'stroke-width="1.6"') +
    P('M172 130L188 136L172 140') + P('M40 136Q46 60 110 60Q172 60 176 136Z', W) + P('M36 136H180') +
    POLY([[92, 82], [128, 82], [140, 106], [128 , 128], [92, 128], [80, 106]]) + P('M92 82L80 64M128 82L140 64M140 106H172M80 106H44M92 128L84 136M128 128L136 136')],
  ['Walvis', () => P('M24 112Q24 60 90 62Q140 64 152 100Q160 78 180 72Q174 96 162 104Q178 110 184 128Q162 126 152 114Q130 144 80 144Q24 144 24 112Z', W) +
    D(62, 98, 4) + P('M28 116Q60 124 96 116', 'stroke-width="2"') + P('M40 128h6M54 132h6M68 132h6', 'stroke-width="1.6"') +
    P('M90 60Q86 40 72 34M90 60Q90 36 90 26M90 60Q96 40 108 34')],
  ['Octopus', () => [0, 1, 2, 3, 4, 5].map((i) => {
    const x = 50 + i * 20;
    return P(`M${x} 120Q${x - 14 + i * 4} 150 ${x + (i < 3 ? -18 : 18)} 170Q${x + (i < 3 ? -24 : 24)} 180 ${x + (i < 3 ? -12 : 12)} 182`, 'stroke-width="5"');
  }).join('') + P('M44 120Q30 30 100 30Q170 30 156 120Z', W) + S(C(80, 96, 9, W) + D(82, 98, 4.5)) + P('M90 116Q100 124 110 116') +
    P('M70 60l6 4M128 54l4 6M110 46l6 0', 'stroke-width="2"')],
  ['Krab', () => S(P('M58 132L30 150L22 176M62 142L40 166L40 186M70 148L58 172L62 190')) + S(P('M62 108Q34 96 30 70') + P('M30 70Q8 54 18 34Q34 40 34 50Q44 40 42 60Q40 70 30 70Z', W)) +
    E(100, 124, 52, 34, W) + S(P('M88 92V68') + C(88, 62, 8, W) + D(88, 62, 3.5)) + P('M88 134Q100 144 112 134')],
  ['Slak', () => P('M20 170H180') + P('M24 168Q40 140 90 152H150Q172 148 176 120Q178 104 168 102Q158 102 156 120Q154 140 140 152', W) +
    C(100, 112, 46, W) + spiral(100, 112, 2, 40, 2.6, 0) + P('M164 104L160 80M172 104L180 82') + C(160, 78, 4, F) + C(181, 80, 4, F)],
  ['Bij', () => S(G(E(84, 70, 22, 32, W), 'rotate(-30 84 70)')) + E(100, 112, 50, 40, W) +
    P('M88 74Q100 112 88 150M112 74Q124 112 112 150', 'stroke-width="7"') + P('M150 112L176 112', 'stroke-width="3"') +
    C(46, 100, 24, W) + D(40, 96, 4) + P('M34 110Q42 116 50 110') + P('M36 78Q30 54 18 50M50 78Q56 56 66 50')],
  ['Egel', () => {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = -80 + (i / 18) * 170; pts.push(polar(110, 130, i % 2 ? 66 : 80, a)); }
    return POLY(pts, false, W) + P('M42 140Q30 136 38 130Q48 110 70 110', W) + P('M38 140Q60 160 100 160Q150 160 186 140') + D(36, 135, 3.5) + D(58, 124, 3.5) + P('M80 160v14M140 160v14');
  }],
  ['Dinosaurus', () => P('M38 150Q38 110 80 108Q110 106 120 110Q130 70 132 40Q134 26 148 26Q166 26 166 38Q166 46 152 46Q146 48 146 60Q144 100 150 130Q160 160 192 160Q160 172 140 160L140 176H126V160L80 162V176H66V158Q38 160 38 150Z', W) +
    D(152, 34, 3) + P('M80 108L86 98L92 108M98 107L104 96L110 108', W) + P('M80 130Q100 140 120 128', 'stroke-width="1.8"')],
  ['Konijn', () => S(G(E(86, 46, 11, 34, W), 'rotate(-14 86 46)')) + E(100, 138, 40, 44, W) + C(100, 88, 30, W) + S(D(88, 84, 4)) +
    E(100, 96, 4, 3, F) + P('M100 99Q100 104 94 104M100 99Q100 104 106 104') + C(142, 160, 10, W)],
  ['Giraf', () => P('M66 180V120Q60 100 80 96L110 96Q118 60 116 36Q120 20 136 22Q150 26 156 34L160 42L140 48Q132 70 132 112Q138 140 130 180H116V140H82V180Z', W) +
    P('M128 24L124 10M136 22L136 8') + D(140, 32, 3) + P('M86 110l8 6-6 6-8-4zM112 120l8 4-2 8-8-2zM122 70l6 4-4 8-6-4zM120 100l6 2-2 8-6-2z', 'stroke-width="1.8"')],
  ['Vos (zittend)', () => P('M120 176Q190 176 176 120Q168 100 150 110Q170 140 120 160Z', W) + P('M70 110Q54 150 64 180H130Q140 150 124 110', W) +
    P('M60 58L66 20L88 44L112 44L134 20L140 58Q140 90 100 110Q60 90 60 58Z', W) + P('M60 58Q80 84 100 110Q120 84 140 58', 'stroke-width="1.8"') +
    S(D(86, 64, 4)) + E(100, 104, 5, 4, F)],
  ['Muis', () => P('M150 160Q190 160 184 130', 'stroke-width="2"') + S(C(70, 70, 22, W)) + P('M40 160Q40 92 100 90Q160 92 160 160Z', W) + D(84, 110, 4) + D(116, 110, 4) + E(100, 124, 5, 4, F) +
    S(L(60, 120, 84, 124, 'stroke-width="1.5"') + L(62, 132, 84, 128, 'stroke-width="1.5"'))],
];
export const handAnimals = colorList(HAND_ANIMALS);

// ---------- Butterflies ----------

function butterfly(seed) {
  const r = rng(seed);
  const up = [[100, 92], [r.range(70, 84), r.range(40, 56)], [r.range(26, 40), r.range(22, 40)], [r.range(14, 26), r.range(62, 84)], [r.range(46, 64), r.range(96, 106)]];
  const low = [[100, 104], [r.range(56, 70), r.range(110, 118)], [r.range(26, 44), r.range(130, 150)], [r.range(46, 60), r.range(164, 182)], [r.range(80, 92), r.range(150, 166)]];
  const pal = r.pick([['#f59a2a', '#f7c948'], ['#5aa8e0', '#9ad1f5'], ['#e86a8a', '#f7b6c8'], ['#9b6bd6', '#c9b0f0'], ['#3fbf9f', '#f7e26b'], ['#e8543c', '#f2954a']]);
  let wing = P(smooth(up, true, 0.9), K(pal[0])) + P(smooth(low, true, 0.9), K(pal[1]));
  const kind = r.int(0, 3);
  if (kind === 0) wing += C(r.range(48, 58), r.range(62, 70), r.range(8, 13)) + C(r.range(60, 66), r.range(130, 140), r.range(5, 9));
  if (kind === 1) wing += P(smooth([[96, 94], [70, 60], [36, 46], [28, 72], [60, 96]], false), 'stroke-width="1.6"') + P(smooth([[96, 106], [70, 124], [52, 156]], false), 'stroke-width="1.6"');
  if (kind === 2) for (let i = 0; i < 6; i++) wing += D(...polar(56, 70, 24, i * 50 + 200), 3);
  if (kind === 3) wing += P(`M100 92L${up[2][0] + 10} ${up[2][1] + 12}M100 94L${up[3][0] + 10} ${up[3][1]}M100 104L${low[2][0] + 10} ${low[2][1]}`, 'stroke-width="1.6"');
  if (r.chance(0.5)) wing += P(smooth([up[1], up[2], up[3], up[4]].map(([x, y]) => [x + (100 - x) * 0.18, y + (98 - y) * 0.18]), false), 'stroke-width="1.4" stroke-dasharray="1 4"');
  return S(wing) + E(100, 104, 6, 34, K('#4a3a3a')) + C(100, 66, 7, K('#4a3a3a')) + S(P('M97 60Q90 36 78 28') + C(77, 27, 2.6, F));
}
export const butterflies = Array.from({ length: 24 }, (_, i) => ({ t: `Vlinder ${i + 1}`, d: () => butterfly(i + 7) }));

// ---------- Fish ----------

function fish(seed) {
  const r = rng(seed);
  const len = r.range(110, 140), h = r.range(34, 60);
  const x0 = 100 - len / 2 + 2, x1 = x0 + len;
  const tail = r.pick(['V', 'rond', 'lang']);
  let s = '';
  if (tail === 'V') s += P(`M${x0 + 8} 100L${x0 - 28} ${100 - h * 0.7}Q${x0 - 14} 100 ${x0 - 28} ${100 + h * 0.7}Z`, W);
  if (tail === 'rond') s += P(`M${x0 + 8} 100Q${x0 - 40} ${100 - h} ${x0 - 30} 100Q${x0 - 40} ${100 + h} ${x0 + 8} 100Z`, W);
  if (tail === 'lang') s += P(`M${x0 + 8} 100Q${x0 - 30} ${100 - h * 1.2} ${x0 - 40} ${100 - h * 0.4}Q${x0 - 20} 100 ${x0 - 40} ${100 + h * 0.5}Q${x0 - 24} ${100 + h * 1.1} ${x0 + 8} 100Z`, W);
  s += P(`M${x0 + len * 0.35} ${100 - h * 0.8}Q${x0 + len * 0.5} ${100 - h * 1.5} ${x0 + len * 0.7} ${100 - h * 0.8}`, W);
  s += P(`M${x0 + len * 0.45} ${100 + h * 0.85}Q${x0 + len * 0.55} ${100 + h * 1.3} ${x0 + len * 0.65} ${100 + h * 0.8}`, W);
  s += P(`M${x0} 100Q${x0 + len * 0.45} ${100 - h * 2.1} ${x1} 100Q${x0 + len * 0.45} ${100 + h * 2.1} ${x0} 100Z`, W);
  s += P(`M${x1 - len * 0.26} ${100 - h * 0.62}Q${x1 - len * 0.2} 100 ${x1 - len * 0.26} ${100 + h * 0.62}`, 'stroke-width="2"');
  s += C(x1 - len * 0.13, 100 - h * 0.18, 6, W) + D(x1 - len * 0.12, 100 - h * 0.18, 3);
  s += P(`M${x1 - 4} ${100 + h * 0.15}q-6 4 -10 0`, 'stroke-width="2"');
  const pattern = r.int(0, 3);
  if (pattern === 0) for (let i = 0; i < 3; i++) { const x = x0 + len * (0.3 + i * 0.13); s += P(`M${x} ${100 - h * 0.8}Q${x - 8} 100 ${x} ${100 + h * 0.8}`, 'stroke-width="5"'); }
  if (pattern === 1) for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) { const x = x0 + len * (0.25 + i * 0.1), y = 100 + j * h * 0.4; s += P(`M${x} ${y - 6}Q${x - 7} ${y} ${x} ${y + 6}`, 'stroke-width="1.6"'); }
  if (pattern === 2) for (let i = 0; i < 7; i++) s += C(x0 + len * r.range(0.2, 0.62), 100 + r.range(-0.5, 0.5) * h, r.range(2, 5));
  s += C(184, 60, 3) + C(180, 42, 5) + C(186, 22, 4);
  const pal = r.pick([['#f59a2a', '#f7c948'], ['#5aa8e0', '#2f6fb8'], ['#e86a8a', '#b84a6a'], ['#3fbf9f', '#2a8f7a'], ['#f7d23e', '#5aa8e0'], ['#9b6bd6', '#f2954a']]);
  return paint(s, [pal[1], pal[1], pal[1], pal[0], null]);
}
export const fishes = Array.from({ length: 20 }, (_, i) => ({ t: `Vis ${i + 1}`, d: () => fish(i + 3) }));

const SEA = [
  ['Kwal', () => [60, 80, 100, 120, 140].map((x, i) => P(`M${x} 100Q${x + 10} 120 ${x} 140Q${x - 10} 160 ${x} 186`, i % 2 ? 'stroke-width="1.6"' : '')).join('') +
    P('M44 102Q44 30 100 30Q156 30 156 102Q142 94 128 104Q114 94 100 104Q86 94 72 104Q58 94 44 102Z', W) + S(D(84, 72, 4)) + P('M94 82Q100 88 106 82')],
  ['Zeester', () => P(smooth(Array.from({ length: 10 }, (_, i) => polar(100, 104, i % 2 ? 30 : 84, i * 36)), true, 0.6), W) +
    Array.from({ length: 5 }, (_, i) => [0.4, 0.6, 0.8].map((k) => D(...polar(100, 104, 84 * k * 0.9, i * 72), 2.4)).join('')).join('')],
  ['Schelp', () => P('M100 180L30 100Q30 30 100 24Q170 30 170 100Z', W) + [-60, -36, -12, 12, 36, 60].map((a) => P(`M100 178L${polar(100, 100, 74, a).join(' ')}`, 'stroke-width="1.8"')).join('') +
    P('M86 180H114V190H86Z', W)],
  ['Zeepaardje', () => P('M110 40Q140 30 148 52Q150 66 136 64L120 62Q132 80 126 100Q118 120 100 130Q88 140 98 156Q110 172 96 182Q80 186 78 172Q78 160 90 160', W) +
    P('M110 40Q92 46 96 70Q100 90 92 110Q84 128 100 130') + D(124, 48, 3) + P('M104 34L100 22L112 32') +
    P('M96 74L84 76M98 92L84 94M94 108L82 112', 'stroke-width="1.6"')],
  ['Anker', () => C(100, 30, 12) + P('M100 42V176M70 64H130') + P('M40 130Q50 176 100 176Q150 176 160 130M30 140L40 128L52 140M148 140L160 128L170 140')],
  ['Vuurtoren in zee', () => P('M76 170L84 60H116L124 170Z', W) + R(78, 40, 44, 20, 2, W) + P('M70 40L100 18L130 40Z', W) + P('M80 96H120M78 132H122', 'stroke-width="6"') +
    P('M10 174Q30 164 50 174T90 174T130 174T170 174T190 172') + P('M70 50L20 34M70 54L20 70M130 50L180 34M130 54L180 70', 'stroke-width="1.6"')],
  ['Golf', () => P('M10 170Q20 90 90 70Q150 56 170 100Q178 130 150 136Q126 138 128 116Q130 98 150 102Q140 82 110 90Q66 102 60 170Z', W) +
    P('M10 170H190') + P('M70 140Q90 110 120 110M84 160Q100 132 130 128', 'stroke-width="1.6"')],
  ['Duikbril en snorkel', () => R(36, 70, 128, 60, 26, W) + R(48, 80, 46, 40, 18) + R(106, 80, 46, 40, 18) + P('M164 96H176V30H184', 'stroke-width="5"')],
];
export const sea = colorList(SEA);
