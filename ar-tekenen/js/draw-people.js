import { W, F, C, E, P, L, D, G, S, R, POLY, polar, smooth, heart, star, rng } from './svg.js';

const NONE = 'stroke="none"';
const WHITE = `fill="#fff" ${NONE}`;
const thin = 'stroke-width="1.6"';

// ---------- Anime characters ----------

function animeEye(cx, cy, look) {
  return (
    P(`M${cx - 16} ${cy - 4}Q${cx - 2} ${cy - 18} ${cx + 15} ${cy - 9}`, 'stroke-width="4.5"') +
    E(cx + look, cy + 4, 10, 13.5, W) +
    E(cx + look, cy + 6, 5.5, 7.5, F) +
    C(cx + look + 4, cy - 1, 3.4, WHITE) +
    C(cx + look - 4, cy + 11, 1.6, WHITE) +
    P(`M${cx - 7} ${cy + 19}Q${cx} ${cy + 21} ${cx + 7} ${cy + 18}`, thin)
  );
}

const ANIME_MOUTHS = [
  P('M94 148Q100 152 106 148'),
  P('M93 146Q100 158 107 146Z', W),
  P('M92 147q4 4 8 0q4 4 8 0'),
  P('M95 149H105'),
  P('M94 145Q100 154 106 145Q100 148 94 145Z', F),
];

function animeHair(r, style) {
  const top = style === 'piekerig'
    ? Array.from({ length: 11 }, (_, i) => polar(100, 92, i % 2 ? 58 : 76 + r.range(-6, 6), -105 + i * 21))
    : [[46, 118], [44, 70], [62, 36], [100, 24], [138, 36], [156, 70], [154, 118]];
  const topPath = style === 'piekerig' ? 'M' + top.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L') : smooth(top, false);
  let bangs;
  const kind = r.int(0, 3);
  if (kind === 0) bangs = 'L150 104L136 88L128 98L116 82L106 96L94 80L84 96L72 84L62 100L50 104Z';
  if (kind === 1) bangs = 'L152 108Q140 90 132 66Q120 92 92 96Q104 84 104 62Q86 90 56 104Z';
  if (kind === 2) bangs = 'L150 116Q140 76 106 56Q102 66 100 62Q96 66 94 56Q60 76 50 116Z';
  if (kind === 3) bangs = 'L150 100Q148 90 140 92L132 82L124 94L110 78L100 92L86 78L76 94L66 84L56 96Q52 92 50 100Z';
  return P(topPath + bangs, W) + P('M78 50Q90 40 104 40M118 44Q130 50 136 60', thin);
}

function animeBackHair(style) {
  if (style === 'lang') return P('M52 70Q30 140 36 196H164Q170 140 148 70Z', W) + P('M60 140Q56 170 62 196M140 140Q144 170 138 196', thin);
  if (style === 'bob') return P('M50 70Q34 120 44 158Q70 166 80 150L120 150Q130 166 156 158Q166 120 150 70Z', W);
  if (style === 'staartjes') return S(P('M54 78Q14 80 18 140Q22 178 8 196Q44 180 42 140Q40 110 58 102Z', W) + C(54, 84, 7, W));
  if (style === 'paardenstaart') return P('M136 50Q186 50 180 110Q178 150 190 176Q156 160 160 120Q162 86 140 74Z', W);
  if (style === 'knot') return C(100, 26, 20, W) + P('M84 30Q100 38 116 30', thin);
  return '';
}

function animeAccessory(kind) {
  if (kind === 'strik') return P('M146 52L168 40L166 66ZM146 52L128 32L124 58Z', W) + C(146, 52, 6, W);
  if (kind === 'kattenoren') return S(P('M56 62L50 18L86 42', W) + P('M60 52L58 32L74 44', thin));
  if (kind === 'bril') return S(R(60, 108, 34, 30, 10)) + P('M94 120Q100 116 106 120');
  if (kind === 'koptelefoon') return P('M44 110Q36 20 100 18Q164 20 156 110', 'stroke-width="6"') + S(R(36, 98, 18, 34, 8, W));
  if (kind === 'bloem') return G(Array.from({ length: 5 }, (_, i) => C(...polar(0, 0, 8, i * 72), 6, W)).join('') + C(0, 0, 4, W), 'translate(56 56)');
  if (kind === 'hoed') return P('M30 64Q100 50 170 64Q170 74 100 70Q30 74 30 64Z', W) + P('M56 64Q60 20 100 18Q140 20 144 64', W) + P('M58 52Q100 44 142 52', 'stroke-width="5"');
  return '';
}

const ANIME_STYLES = ['piekerig', 'kort', 'lang', 'bob', 'staartjes', 'paardenstaart', 'knot'];
const ANIME_ACC = ['', '', 'strik', 'kattenoren', 'bril', 'koptelefoon', 'bloem', 'hoed'];

function anime(seed) {
  const r = rng(seed);
  const style = ANIME_STYLES[seed % ANIME_STYLES.length];
  const acc = ANIME_ACC[Math.floor(seed / 7) % ANIME_ACC.length];
  const look = r.pick([-2, 0, 2]);
  let s = animeBackHair(style === 'kort' || style === 'piekerig' ? '' : style);
  // shoulders + neck
  s += P('M86 160L84 180Q50 182 28 200H172Q150 182 116 180L114 160', W);
  s += r.chance(0.5) ? P('M84 180Q100 196 116 180', thin) : P('M78 182L100 200L122 182', thin);
  s += S(P('M56 104Q46 104 48 116Q50 128 60 128', W));
  s += P('M56 92Q56 146 100 168Q144 146 144 92', W);
  if (acc === 'kattenoren' || acc === 'hoed') s += '';
  if (acc === 'kattenoren') s += animeAccessory(acc);
  s += animeHair(r, style);
  if (acc !== 'kattenoren') s += animeAccessory(acc);
  s += S(P('M66 96Q76 90 90 94', 'stroke-width="2"'));
  s += animeEye(78, 116, look) + G(animeEye(78, 116, -look), 'matrix(-1 0 0 1 200 0)');
  s += P('M100 132l-2 4h3', thin);
  s += ANIME_MOUTHS[r.int(0, ANIME_MOUTHS.length - 1)];
  if (r.chance(0.6)) s += S(P('M62 140l4-5M68 140l4-5M74 140l4-5', thin));
  return s;
}

export const animeChars = Array.from({ length: 42 }, (_, i) => ({ t: `Anime-personage ${i + 1}`, d: () => anime(i) }));

// ---------- Realistic-ish portraits ----------

function portrait(seed) {
  const r = rng(seed);
  const hair = ['kort', 'lang', 'krullen', 'knot', 'afro', 'kaal', 'pony', 'golvend'][seed % 8];
  const beard = (seed % 3 === 1) && ['kort', 'kaal', 'krullen', 'afro'].includes(hair);
  const glasses = seed % 5 === 2;
  const jaw = r.range(0, 10);
  let s = '';
  if (hair === 'lang') s += P('M54 70Q36 140 40 196H160Q164 140 146 70Z', W);
  if (hair === 'golvend') s += P(smooth([[54, 70], [44, 110], [52, 140], [38, 170], [50, 196], [150, 196], [162, 170], [148, 140], [156, 110], [146, 70]], false), W);
  if (hair === 'afro') s += P(smooth(Array.from({ length: 22 }, (_, i) => polar(100, 86, i % 2 ? 70 : 78, i * (360 / 22))), true), W);
  if (hair === 'knot') s += C(100, 22, 18, W);
  s += P('M84 150L82 180Q50 184 26 200H174Q150 184 118 180L116 150', W);
  s += P('M82 176Q100 186 118 176', thin);
  s += S(P('M62 100Q52 98 52 112Q54 126 64 128', W) + P('M58 106Q56 114 62 120', thin));
  s += P('M62 84Q58 30 100 28Q142 30 138 84', W);
  s += P(`M62 78Q60 ${140 + jaw} ${84} ${160 + jaw / 2}Q100 ${170 + jaw / 2} ${116} ${160 + jaw / 2}Q140 ${140 + jaw} 138 78`, W);
  // hair front
  if (hair === 'kort') s += P('M60 96Q52 40 100 34Q148 40 140 96Q138 72 124 62Q100 74 74 64Q62 74 60 96Z', W);
  if (hair === 'lang' || hair === 'golvend') s += P('M60 110Q50 40 100 34Q150 40 140 110Q134 66 104 56Q88 76 60 110Z', W);
  if (hair === 'pony') s += P('M58 100Q50 34 100 32Q150 34 142 100Q140 86 132 80H68Q60 86 58 100Z', W) + P('M80 80V70M100 80V68M120 80V70', thin);
  if (hair === 'knot') s += P('M60 96Q54 36 100 34Q146 36 140 96Q132 64 100 58Q68 64 60 96Z', W);
  if (hair === 'krullen' || hair === 'afro') s += P(smooth(Array.from({ length: 13 }, (_, i) => polar(100, 80, i % 2 ? 40 : 48, -100 + i * (200 / 12))), false) + 'Q100 56 58 86Z', W);
  if (hair === 'krullen') s += P('M72 54q6 -6 10 0M98 46q6 -6 10 0M120 54q6 -6 10 0', thin);
  // brows, eyes
  const browY = 96 + r.range(-2, 2);
  s += S(P(`M70 ${browY}Q80 ${browY - 6} 92 ${browY - 1}`, 'stroke-width="3"'));
  const eye = (cx) => P(`M${cx - 12} 110Q${cx} 102 ${cx + 12} 110Q${cx} 116 ${cx - 12} 110Z`, W) + C(cx, 109.5, 5) + D(cx, 109.5, 2.4) + P(`M${cx - 12} 110Q${cx} 100 ${cx + 12} 109`, 'stroke-width="2.2"');
  s += S(eye(81));
  if (glasses) s += S(R(64, 98, 32, 24, 7)) + P('M96 106Q100 102 104 106') + S(L(64, 104, 58, 102));
  // nose
  s += P('M98 112Q96 128 92 134Q96 140 100 138Q104 140 108 134', 'stroke-width="2"');
  // lips
  const w = r.range(12, 16);
  const smile = r.chance(0.5) ? 5 : 0;
  s += P(`M${100 - w} ${150 - smile}Q100 ${146 + smile} ${100 + w} ${150 - smile}`, 'stroke-width="2"');
  if (seed % 4 === 3) s += S(C(60, 132, 3.5) + P('M60 136V144', thin) + C(60, 147, 3, W));
  if (seed % 6 === 5) s += S(D(76, 128, 1.3) + D(82, 132, 1.3) + D(72, 134, 1.3));
  s += P(`M${100 - w} 150Q94 144 100 146Q106 144 ${100 + w} 150`, thin) + P(`M${100 - w + 2} 151Q100 160 ${100 + w - 2} 151`, thin);
  if (beard) s += P(`M64 118Q66 ${160 + jaw} 100 ${174 + jaw / 2}Q134 ${160 + jaw} 136 118Q130 140 120 148Q100 140 80 148Q70 140 64 118Z`, W) + P(`M86 152Q100 146 114 152Q100 158 86 152Z`, W);
  return s;
}

export const portraits = Array.from({ length: 32 }, (_, i) => ({ t: `Portret ${i + 1}`, d: () => portrait(i) }));

// ---------- Mannequin poses ----------

const POSES = [
  ['Staan', [-12, -6, 12, 6, -5, -3, 5, 3, 0]],
  ['Zwaaien', [-12, -6, 140, 170, -5, -3, 5, 3, 0]],
  ['Lopen', [25, 45, -25, -10, -22, -6, 22, 38, 3]],
  ['Rennen', [60, 150, -50, -110, -45, 15, 55, -30, 12]],
  ['Springende ster', [-130, -140, 130, 140, -32, -32, 32, 32, 0]],
  ['Juichen', [-160, -172, 160, 172, -8, -4, 8, 4, 0]],
  ['Handen in de zij', [-50, 60, 50, -60, -10, -8, 10, 8, 0]],
  ['Dansen', [-70, -120, 120, 170, -38, 15, 8, 8, -8]],
  ['Yoga: boom', [-170, 170, 170, -170, 0, 0, 75, -60, 0]],
  ['Schoppen', [-60, -30, 40, 20, -4, -4, 75, 85, -12]],
  ['Wijzen', [-12, -6, 90, 90, -5, -3, 5, 3, 0]],
  ['Nadenken', [-12, -6, 30, 165, -5, -3, 5, 3, 0]],
  ['Gooien', [-80, -90, 150, 110, -25, -10, 28, 40, -8]],
  ['Bukken', [70, 70, 60, 60, -6, -6, 6, 6, 70]],
  ['Zitten', [-5, 70, 5, 75, 85, 0, 80, 0, 0]],
  ['Knielen', [-10, -5, 10, 5, 0, 90, 80, 0, 0]],
  ['Boksen', [-100, -170, 70, 150, -18, -8, 18, 8, 5]],
  ['Strekken', [-100, -100, 100, 100, -5, -3, 5, 3, 0]],
  ['Superheld', [-12, -6, 170, 170, -10, -6, 20, 50, 0]],
  ['Sluipen', [40, 80, 60, 100, -30, 20, 40, 0, 20]],
];

function mannequin(a) {
  const [la1, la2, ra1, ra2, ll1, ll2, rl1, rl2, lean] = a;
  const v = (x, y, len, ang) => [x + len * Math.sin((ang * Math.PI) / 180), y + len * Math.cos((ang * Math.PI) / 180)];
  const sitting = ll1 > 60 && rl1 > 60;
  const hip = [100 - lean * 0.45, sitting ? 132 : 112 + Math.max(0, lean - 30) * 0.4];
  const neck = v(hip[0], hip[1], 52, 180 - lean);
  const head = v(neck[0], neck[1], 20, 180 - lean);
  const perp = (p, d) => [p[0] + d * Math.cos((lean * Math.PI) / 180), p[1] + d * Math.sin((lean * Math.PI) / 180)];
  const ls = perp(neck, -14), rs = perp(neck, 14), lh = perp(hip, -8), rh = perp(hip, 8);
  const le = v(...ls, 30, la1), lw = v(...le, 28, la2);
  const re = v(...rs, 30, ra1), rw = v(...re, 28, ra2);
  const lk = v(...lh, 38, ll1), lf = v(...lk, 38, ll2);
  const rk = v(...rh, 38, rl1), rf = v(...rk, 38, rl2);
  const segs = [[ls, le], [le, lw], [rs, re], [re, rw], [lh, lk], [lk, lf], [rh, rk], [rk, rf]];
  const seg = (w) => segs.map(([p, q]) => L(p[0], p[1], q[0], q[1], `stroke-width="${w}"`)).join('');
  const torso = (w) => L(...perp(neck, -7), ...perp(hip, -4), `stroke-width="${w}"`) + L(...perp(neck, 7), ...perp(hip, 4), `stroke-width="${w}"`);
  const joints = [le, re, lk, rk, lw, rw].map((p) => C(p[0], p[1], 4.5)).join('');
  const feet = [lf, rf].map((p) => E(p[0] + 4, p[1] + 2, 8, 4, W)).join('');
  return (
    P('M20 190H180', 'stroke-width="1.5" stroke-dasharray="4 5"') +
    seg(15) + torso(22) + `<g stroke="#fff">${seg(10.5) + torso(17.5)}</g>` + joints + feet +
    C(head[0], head[1], 15, W) + L(...neck, ...v(...neck, 6, 180 - lean), 'stroke-width="6"')
  );
}

export const poses = POSES.map(([t, a]) => ({ t: `Pose: ${t}`, d: () => mannequin(a) }));

// ---------- Anatomy studies ----------

function eyeStudy(seed) {
  const r = rng(seed);
  const w = r.range(56, 70), h = r.range(18, 28), look = r.range(-10, 10), lift = r.range(-6, 6);
  let s = '';
  s += P(`M${100 - w} ${100 + lift}Q100 ${100 - h * 2} ${100 + w} ${100 - lift}Q100 ${100 + h * 1.5} ${100 - w} ${100 + lift}Z`, W);
  s += `<clipPath id="ce"><path d="M${100 - w} ${100 + lift}Q100 ${100 - h * 2} ${100 + w} ${100 - lift}Q100 ${100 + h * 1.5} ${100 - w} ${100 + lift}Z"/></clipPath>`;
  let iris = C(100 + look, 98, 26) + C(100 + look, 98, 11, F) + C(100 + look + 8, 90, 5, WHITE);
  for (let i = 0; i < 24; i++) iris += L(...polar(100 + look, 98, 13, i * 15), ...polar(100 + look, 98, 24, i * 15 + 6), 'stroke-width="1"');
  s += `<g clip-path="url(#ce)">${iris}</g>`;
  s += P(`M${100 - w + 6} ${100 + lift - 8}Q100 ${100 - h * 2 - 10} ${100 + w - 4} ${100 - lift - 10}`, 'stroke-width="1.6"');
  s += P(`M${100 - w} ${100 + lift}Q100 ${100 - h * 2} ${100 + w} ${100 - lift}`, 'stroke-width="4"');
  const lashes = r.int(0, 2);
  for (let i = 0; i < 9 * lashes; i++) {
    const t = 0.15 + (i / (9 * lashes)) * 0.75;
    const x = (1 - t) * (1 - t) * (100 - w) + 2 * t * (1 - t) * 100 + t * t * (100 + w);
    const y = (1 - t) * (1 - t) * (100 + lift) + 2 * t * (1 - t) * (100 - h * 2) + t * t * (100 - lift);
    s += P(`M${x.toFixed(1)} ${y.toFixed(1)}q${(t - 0.4) * 14} -12 ${(t - 0.3) * 22} -16`, thin);
  }
  s += P(`M${100 - w - 6} ${60 + lift}Q90 ${36 - h * 0.3} ${100 + w + 8} ${52 - lift}`, 'stroke-width="5"');
  s += P(`M${100 - w + 10} ${116 + lift}Q100 ${100 + h * 1.5 + 14} ${100 + w - 8} ${112}`, thin);
  return s;
}

const ANATOMY = [
  ['Gezichtsverhoudingen', () => E(100, 100, 56, 76) + L(100, 24, 100, 176, 'stroke-dasharray="4 4"') + L(44, 96, 156, 96, 'stroke-dasharray="4 4"') +
    L(52, 122, 148, 122, 'stroke-dasharray="4 4"') + L(60, 142, 140, 142, 'stroke-dasharray="4 4"') + L(48, 68, 152, 68, 'stroke-dasharray="4 4"') +
    S(P('M66 96Q78 88 90 96Q78 102 66 96Z')) + P('M94 122Q100 126 106 122') + P('M86 142Q100 148 114 142') + S(P('M44 96Q36 100 40 116Q44 122 48 120'))],
  ['Hoofd van opzij', () => P('M100 30Q150 28 156 80Q160 110 150 118L158 132L148 136Q150 150 144 154Q146 164 132 166Q120 168 116 162L114 180', W) +
    P('M100 30Q50 34 52 90Q54 130 80 144L82 180') + E(92, 100, 9, 14) + P('M140 88Q132 84 124 88') + P('M130 96Q136 92 142 96') + P('M66 60H160M60 96H160M70 132H160', 'stroke-dasharray="3 4" stroke-width="1.2"')],
  ['Oog (studie)', () => eyeStudy(1)],
  ['Lippen', () => P('M40 104Q70 76 92 82Q100 86 108 82Q130 76 160 104Q130 140 100 140Q70 140 40 104Z', W) + P('M40 104Q70 100 100 106Q130 100 160 104', 'stroke-width="2.4"') + P('M70 120Q100 130 130 120', thin) + P('M96 84Q100 92 104 84', thin)],
  ['Neus', () => P('M100 40Q96 100 82 120Q72 132 78 142Q84 150 94 144Q100 150 106 144Q116 150 122 142Q128 132 118 120Q112 110 108 96', 'stroke-width="2.4"') + S(P('M86 138Q90 134 96 138', thin))],
  ['Oor', () => P('M84 40Q140 30 144 80Q148 116 120 132Q110 140 112 156Q110 172 92 168Q80 164 84 150', 'stroke-width="2.4"') + P('M100 60Q128 56 128 86Q128 108 112 116Q102 120 104 106Q106 92 96 90', thin) + P('M92 112Q100 124 94 136', thin)],
  ['Open hand', () => P('M60 186L58 130Q40 104 28 88Q22 76 32 74Q42 72 56 92L64 104L60 44Q60 34 68 34Q76 34 78 44L82 94L84 30Q84 20 92 20Q100 20 102 30L104 92L108 38Q108 28 116 28Q124 28 124 38L124 98L132 56Q134 48 142 50Q148 52 146 62L140 120Q138 150 130 186', W) +
    P('M70 140Q90 150 112 140M82 94V102M104 92V100M124 98V106', thin)],
  ['Vuist', () => P('M50 150Q40 120 46 92Q50 72 70 70H140Q160 72 160 92Q162 120 150 150Q130 170 90 170Q66 168 50 150Z', W) + P('M70 70Q66 92 74 104M96 70Q92 92 100 104M120 70Q116 92 124 104', thin) +
    P('M46 104Q60 110 74 104Q88 112 100 104Q114 112 124 104Q140 110 158 100') + P('M60 120Q90 140 120 128', 'stroke-width="2"') + P('M76 170L78 196M134 160L136 196')],
  ['Voet', () => P('M70 30L72 120Q70 150 40 160Q20 168 28 180Q36 188 70 186H150Q176 184 172 166Q166 150 140 146Q120 140 116 110L118 30', W) + P('M150 172v12M138 170v14M126 170v14', thin)],
  ['Schedel', () => P('M100 24Q160 24 164 90Q166 120 150 130L148 150H132V166H68V150H52L50 130Q34 120 36 90Q40 24 100 24Z', W) +
    S(P('M60 96Q62 76 84 78Q94 84 92 104Q88 118 72 116Q58 112 60 96Z', W)) + P('M100 112L92 132H108Z', W) + P('M80 150V166M92 150V166M104 150V166M116 150V166', thin)],
  ['Lichaamsverhoudingen', () => C(100, 30, 14) + P('M100 44V112M76 54H124M76 54L66 110L62 150M124 54L134 110L138 150M86 112H114M88 112L84 190M112 112L116 190') +
    Array.from({ length: 8 }, (_, i) => L(20, 16 + i * 22.5, 40, 16 + i * 22.5, 'stroke-width="1.4"')).join('') + L(30, 16, 30, 196, 'stroke-width="1.4"')],
];

export const anatomy = [
  ...ANATOMY.map(([t, d]) => ({ t, d })),
  ...Array.from({ length: 10 }, (_, i) => ({ t: `Oogstudie ${i + 1}`, d: () => eyeStudy(i + 10) })),
];

// ---------- Cartoon kids ----------

function kid(seed) {
  const r = rng(seed);
  const girl = seed % 2 === 0;
  const pose = ['staan', 'zwaai', 'spring', 'staan'][Math.floor(seed / 2) % 4];
  let s = '';
  // legs
  const legSpread = pose === 'spring' ? 18 : 10;
  s += P(`M${92} 140L${100 - legSpread - 4} 178M108 140L${100 + legSpread + 4} 178`, 'stroke-width="9"') + `<g stroke="#fff">${P(`M${92} 140L${100 - legSpread - 4} 178M108 140L${100 + legSpread + 4} 178`, 'stroke-width="5"')}</g>`;
  s += E(100 - legSpread - 8, 182, 12, 7, W) + E(100 + legSpread + 8, 182, 12, 7, W);
  // arms
  const armL = 'M76 104L56 136', armR = pose === 'zwaai' ? 'M124 104L150 74' : pose === 'spring' ? 'M124 104L152 80' : 'M124 104L144 136';
  const armL2 = pose === 'spring' ? 'M76 104L48 80' : armL;
  s += P(`${armL2}${armR}`, 'stroke-width="9"') + `<g stroke="#fff">${P(`${armL2}${armR}`, 'stroke-width="5"')}</g>`;
  const hand = (d) => { const m = d.match(/L(\d+) (\d+)/); return C(+m[1], +m[2], 6, W); };
  s += hand(armL2) + hand(armR);
  // body
  s += girl ? P('M80 98H120L136 148H64Z', W) + P('M70 136H130', thin) : R(78, 98, 44, 46, 8, W) + P('M78 132H122', thin) + P('M100 132V146', thin);
  if (!girl) s += P('M80 144H96V150H80ZM104 144H120V150H104Z', W);
  s += r.chance(0.5) ? star(100, 116, 8, 3.5, 5) : heart(100, 116, 7);
  // head
  s += P('M96 92V98M104 92V98');
  if (girl) s += r.chance(0.5) ? S(C(52, 58, 12, W) + P('M52 70Q48 90 56 96', 'stroke-width="2"')) : P('M60 50Q40 96 60 104H140Q160 96 140 50Z', W);
  s += C(100, 56, 38, W);
  s += S(D(86, 60, 4.5) + C(87.5, 58.5, 1.4, WHITE));
  s += r.chance(0.5) ? P('M90 74Q100 84 110 74') : P('M90 72Q100 86 110 72Z', W);
  s += S(E(76, 72, 6, 3.5, 'fill="FILL" stroke="none" opacity=".25"'));
  s += girl ? P('M62 52Q60 18 100 16Q140 18 138 52Q120 34 100 40Q84 30 62 52Z', W) : P('M62 56Q56 20 100 16Q144 20 138 56L132 42L124 50L118 36L108 46L100 32L92 46L82 36L76 50L68 42Z', W);
  return s;
}

export const kids = Array.from({ length: 24 }, (_, i) => ({ t: `Cartoonkind ${i + 1}`, d: () => kid(i) }));
