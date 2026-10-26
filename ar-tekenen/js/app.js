import { categories, getItem, getCategory, totalCount } from './catalog.js';
import { innerOf, thumbUrl, splitSteps, stepInner, renderSvgTo, renderPhotoTo, loadImage } from './render.js';
import { lettering } from './draw-world.js';
import { toSvg } from './svg.js';
import * as sketches from './sketches.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------- Small persistence helpers (storage can be unavailable) ----------

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('ar-tekenen:' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('ar-tekenen:' + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

const settings = Object.assign({ color: '#111111', width: 2.5, mode: 'lijn', opacity: 60 }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
let favorites = store.get('favorites', []);
let recent = store.get('recent', []);

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2200);
}

// ---------- Routing ----------

let depth = 0;
const go = (route) => { depth++; location.hash = '#/' + route; };
const back = () => (depth > 0 ? history.back() : (location.hash = '#/'));

const screens = {
  '': showHome, home: showHome, kies: () => show('kies'), objecten: () => showRows(false), leren: () => showRows(true),
  cat: (id) => showCategory(id, false), lcat: (id) => showCategory(id, true), les: showLesson, schetsen: showSketches,
  ai: () => show('ai'), foto: showPhoto, uitleg: () => show('uitleg'), over: () => show('over'), tekenen: showTrace,
};

let current = null;
function show(id) {
  if (current === 'tekenen' && id !== 'tekenen') leaveTrace();
  for (const s of $$('[data-screen]')) s.hidden = s.id !== id;
  if (current !== id) window.scrollTo(0, 0);
  current = id;
}

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  (screens[name] || showHome)(arg && decodeURIComponent(arg));
}
window.addEventListener('hashchange', () => { route(); });
window.addEventListener('popstate', () => { depth = Math.max(0, depth - 1); });

document.addEventListener('click', (e) => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) { go(goEl.dataset.go); return; }
  if (e.target.closest('.back')) { back(); return; }
  const act = e.target.closest('[data-action]');
  if (act?.dataset.action === 'gallery') $('#file-gallery').click();
  if (act?.dataset.action === 'camera-photo') $('#file-camera').click();
});

// ---------- Home ----------

function showHome() {
  show('home');
}

function initHome() {
  const butterfly = getItem('dieren-17') || categories[3].items[0];
  $('#ar-phone-img').src = thumbUrl(butterfly);
  $('#ar-bubble-img').src = thumbUrl(butterfly);
  $('#count-note').textContent = `${totalCount} tekeningen in ${categories.length} categorieën · gratis en zonder advertenties`;
}

// ---------- Thumbnails (lazy) ----------

const thumbObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    thumbObserver.unobserve(img);
    const item = getItem(img.dataset.item);
    try { img.src = thumbUrl(item); } catch (err) { console.error(item.id, err); }
  }
}, { rootMargin: '300px' });

function thumb(item, learn) {
  const b = document.createElement('button');
  b.className = 'thumb';
  b.title = item.title;
  b.innerHTML = `<img alt="${item.title}" data-item="${item.id}">`;
  b.addEventListener('click', () => (learn ? go('les/' + item.id) : openItem(item)));
  thumbObserver.observe(b.firstChild);
  return b;
}

// ---------- Rows per category ----------

let rowsLearn = null;
function showRows(learn) {
  show('objecten');
  $('#rows-title').textContent = learn ? 'Leer tekenen' : 'Teken objecten';
  if (rowsLearn === learn && !rowsDirty) return;
  rowsLearn = learn;
  rowsDirty = false;
  $('#search').value = '';
  buildRows();
}
let rowsDirty = false;

function row(title, items, seeAll, learn) {
  const sec = document.createElement('section');
  sec.className = 'row-block';
  sec.innerHTML = `<div class="row-head"><h2>${title}</h2>${seeAll ? '<button class="see-all">Alles bekijken <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' : ''}</div><div class="hscroll"></div>`;
  const strip = sec.querySelector('.hscroll');
  for (const it of items) strip.appendChild(thumb(it, learn));
  if (seeAll) sec.querySelector('.see-all').addEventListener('click', seeAll);
  return sec;
}

function buildRows() {
  const box = $('#rows');
  box.innerHTML = '';
  const learn = rowsLearn;
  if (!learn) {
    const rec = recent.map(getItem).filter(Boolean);
    const fav = favorites.map(getItem).filter(Boolean);
    if (fav.length) box.appendChild(row('Favorieten', fav, null, false));
    if (rec.length) box.appendChild(row('Recent', rec, null, false));
  }
  for (const c of categories) {
    box.appendChild(row(`${c.name} <small>${c.items.length}</small>`, c.items.slice(0, 10), () => go((learn ? 'lcat/' : 'cat/') + c.id), learn));
  }
}

$('#search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { buildRows(); return; }
  const hits = [];
  for (const c of categories) for (const it of c.items) if (it.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) hits.push(it);
  const box = $('#rows');
  box.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const it of hits.slice(0, 300)) grid.appendChild(thumb(it, rowsLearn));
  box.appendChild(hits.length ? grid : Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Niets gevonden.' }));
});

function showCategory(id, learn) {
  const c = getCategory(id);
  if (!c) return showHome();
  show('categorie');
  $('#cat-title').textContent = learn ? `Leer: ${c.name}` : c.name;
  const grid = $('#cat-grid');
  grid.innerHTML = '';
  for (const it of c.items) grid.appendChild(thumb(it, learn));
}

// ---------- Learn mode ----------

let lesson = null;
function showLesson(id) {
  const item = getItem(id);
  if (!item) return showHome();
  show('les');
  lesson = { item, split: splitSteps(innerOf(item)), n: 0 };
  $('#les-title').textContent = item.title;
  renderLesson();
}
function renderLesson() {
  const { split, n } = lesson;
  const total = split.steps.length;
  $('#les-img').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toSvg(stepInner(split, n), { width: 2.5 }));
  $('#les-step').textContent = `Stap ${n + 1} van ${total}`;
  $('#les-prev').disabled = n === 0;
  $('#les-next').textContent = n === total - 1 ? 'Klaar!' : 'Volgende stap';
}
$('#les-prev').addEventListener('click', () => { lesson.n = Math.max(0, lesson.n - 1); renderLesson(); });
$('#les-next').addEventListener('click', () => {
  if (lesson.n === lesson.split.steps.length - 1) { openItem(lesson.item); return; }
  lesson.n++;
  renderLesson();
});
$('#les-ar').addEventListener('click', () => openItem(lesson.item, { steps: lesson.split, n: lesson.n }));

// ---------- Sources ----------

let source = null; // { kind: 'svg', item, inner, steps?, n } | { kind: 'photo', img, process, level }

function openItem(item, learnState) {
  recent = [item.id, ...recent.filter((x) => x !== item.id)].slice(0, 12);
  store.set('recent', recent);
  rowsDirty = true;
  source = { kind: 'svg', item, inner: innerOf(item), steps: learnState?.steps || null, n: learnState?.n || 0 };
  go('tekenen');
}

function openSvgInner(inner, title) {
  source = { kind: 'svg', item: { id: null, title }, inner, steps: null, n: 0 };
  go('tekenen');
}

// Photo from gallery or camera
let photo = null;
const PHOTO_MODES = [['origineel', 'Origineel'], ['schets', 'Lijnen'], ['randen', 'Randen'], ['zwartwit', 'Zwart-wit']];

async function handleFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    photo = { img, process: 'origineel', level: 50 };
    go('foto');
  } catch {
    toast('Deze afbeelding kan niet geopend worden');
  }
}
$('#file-gallery').addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });
$('#file-camera').addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });

function chips(box, options, value, onPick) {
  box.innerHTML = '';
  for (const [v, label, extra] of options) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.setAttribute('aria-pressed', String(v === value));
    if (extra) b.style.setProperty('--sw', extra);
    b.innerHTML = extra ? `<i></i>${label}` : label;
    b.addEventListener('click', () => {
      for (const o of box.children) o.setAttribute('aria-pressed', String(o === b));
      onPick(v);
    });
    box.appendChild(b);
  }
}

function showPhoto() {
  if (!photo) return showHome();
  show('foto');
  chips($('#photo-modes'), PHOTO_MODES, photo.process, (v) => { photo.process = v; drawPhotoPreview(); });
  $('#photo-level').value = photo.level;
  drawPhotoPreview();
}
async function drawPhotoPreview() {
  $('#photo-level').disabled = photo.process === 'origineel';
  await renderPhotoTo($('#photo-preview'), photo.img, { color: '#111111', process: photo.process, level: photo.level });
}
$('#photo-level').addEventListener('input', (e) => { photo.level = +e.target.value; drawPhotoPreview(); });
$('#photo-use').addEventListener('click', () => {
  source = { kind: 'photo', ...photo };
  go('tekenen');
});

// ---------- AI drawing ----------

const AI_STYLES = [
  ['lijn', 'Lijntekening', 'clean black and white line art drawing, coloring book page, simple outlines, white background, no shading'],
  ['schets', 'Potloodschets', 'detailed pencil sketch, graphite drawing, black and white, white background'],
  ['cartoon', 'Cartoon', 'cute cartoon line drawing, thick black outlines, white background, no color'],
  ['anime', 'Anime', 'anime manga line art, black ink, white background, no color'],
  ['realistisch', 'Realistisch', 'realistic ink illustration, black and white, cross hatching, white background'],
];
let aiStyle = 'lijn';
let aiImg = null;
chips($('#ai-styles'), AI_STYLES, aiStyle, (v) => (aiStyle = v));

async function generateAi() {
  const prompt = $('#ai-prompt').value.trim();
  if (!prompt) { toast('Typ eerst wat je wilt tekenen'); return; }
  if (!navigator.onLine) { toast('Hiervoor is internet nodig'); return; }
  const style = AI_STYLES.find((s) => s[0] === aiStyle)[2];
  const seed = Math.floor(Math.random() * 1e6);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, ${style}`)}?width=768&height=768&nologo=true&seed=${seed}`;
  const btn = $('#ai-go');
  btn.disabled = true;
  btn.textContent = 'Bezig met tekenen…';
  try {
    aiImg = await loadImage(url);
    $('#ai-img').src = aiImg.src;
    $('#ai-result').hidden = false;
  } catch {
    toast('Het lukte niet om een tekening te maken. Probeer het opnieuw.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Maak tekening';
  }
}
$('#ai-go').addEventListener('click', generateAi);
$('#ai-again').addEventListener('click', generateAi);
$('#ai-use').addEventListener('click', () => {
  photo = { img: aiImg, process: 'schets', level: 50 };
  go('foto');
});
$('#own-text-go').addEventListener('click', () => {
  const text = $('#own-text').value.trim();
  if (!text) { toast('Typ eerst een tekst'); return; }
  openSvgInner(lettering(text, 'bubbel'), text);
});

// ---------- My sketches ----------

async function showSketches() {
  show('schetsen');
  const list = await sketches.all();
  const grid = $('#sketch-grid');
  grid.innerHTML = '';
  $('#sketch-empty').hidden = list.length > 0;
  for (const s of list) {
    const url = URL.createObjectURL(s.blob);
    const card = document.createElement('div');
    card.className = 'sketch';
    card.innerHTML = `<img alt="Schets" src="${url}"><div class="row"><a class="btn small ghost" download="schets-${s.id}.jpg" href="${url}">Bewaar</a><button class="btn small ghost danger">Wis</button></div>`;
    card.querySelector('.danger').addEventListener('click', async () => {
      await sketches.remove(s.id);
      showSketches();
    });
    grid.appendChild(card);
  }
}

// ---------- AR trace screen ----------

const video = $('#video');
const overlay = $('#overlay');
const stage = $('#stage');
let stream = null;
let wakeLock = null;
let lightbox = false;
let locked = false;
let torch = false;
let blinkTimer = null;
const tf = { x: 0, y: 0, scale: 1, rot: 0, flip: 1 };

const COLORS = [['#111111', 'Zwart', '#111111'], ['#e53935', 'Rood', '#e53935'], ['#1e63d6', 'Blauw', '#1e63d6'], ['#18a058', 'Groen', '#18a058'], ['#ffffff', 'Wit', '#ffffff']];
const MODES = [['lijn', 'Lijn'], ['stippel', 'Stippel'], ['streep', 'Streep'], ['schets', 'Schets']];

// Keep the drawing centred in the part of the screen that the panel leaves free.
function layoutStage() {
  const panel = $('.trace-panel');
  stage.style.bottom = panel.classList.contains('gone') ? '0px' : panel.offsetHeight + 'px';
  stage.style.top = $('.trace-top').classList.contains('gone') ? '0px' : $('.trace-top').offsetHeight + 'px';
  fitOverlay();
}

function applyTransform() {
  overlay.style.transform = `translate(-50%, -50%) translate(${tf.x}px, ${tf.y}px) rotate(${tf.rot}deg) scale(${tf.scale * tf.flip}, ${tf.scale})`;
}

function fitOverlay() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const base = Math.min(w, h) * 0.86;
  const ratio = overlay.width / overlay.height || 1;
  overlay.style.width = (ratio >= 1 ? base : base * ratio) + 'px';
  overlay.style.height = (ratio >= 1 ? base / ratio : base) + 'px';
}

async function renderOverlay() {
  if (!source) return;
  if (source.kind === 'svg') {
    const inner = source.steps ? stepInner(source.steps, source.n) : source.inner;
    await renderSvgTo(overlay, inner, settings);
  } else {
    await renderPhotoTo(overlay, source.img, { color: settings.color, process: source.process, level: source.level });
  }
  layoutStage();
  applyTransform();
}

function updateSteps() {
  const bar = $('#t-steps');
  bar.hidden = !(source?.kind === 'svg' && source.steps);
  if (bar.hidden) return;
  $('#t-step-label').textContent = `Stap ${source.n + 1} / ${source.steps.steps.length}`;
}

async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('geen camera');
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  $('#t-torch').hidden = !caps.torch;
}

function stopCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  video.srcObject = null;
  torch = false;
  $('#t-torch').setAttribute('aria-pressed', 'false');
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && current === 'tekenen') requestWakeLock();
});

function message(text) {
  const m = $('#t-msg');
  m.textContent = text || '';
  m.hidden = !text;
}

async function setLightbox(on) {
  lightbox = on;
  $('#t-light').setAttribute('aria-pressed', String(on));
  $('#tekenen').classList.toggle('lightbox', on);
  message('');
  if (on) {
    stopCamera();
    $('#t-torch').hidden = true;
    message('Lichtbak: zet je scherm op maximale helderheid, leg dun papier op het scherm en trek de lijnen over.');
    setTimeout(() => lightbox && message(''), 4000);
  } else {
    try {
      await startCamera();
    } catch {
      message('Camera niet beschikbaar. Geef toestemming voor de camera (werkt alleen via https) of gebruik Lichtbak.');
    }
  }
}

function showTrace() {
  if (!source) return showHome();
  show('tekenen');
  Object.assign(tf, { x: 0, y: 0, scale: 1, rot: 0, flip: 1 });
  setLocked(false);
  setUiHidden(false);
  $('#t-opacity').value = settings.opacity;
  $('#t-opacity-val').textContent = settings.opacity + '%';
  overlay.style.opacity = settings.opacity / 100;
  $('#t-width').value = settings.width;
  $('#t-width-val').textContent = settings.width;
  $('#t-width-row').hidden = source.kind !== 'svg';
  $('#t-modes').hidden = source.kind !== 'svg';
  $('#t-fav').hidden = !(source.kind === 'svg' && source.item.id);
  $('#t-fav').setAttribute('aria-pressed', String(favorites.includes(source.item?.id)));
  chips($('#t-colors'), COLORS, settings.color, (v) => { settings.color = v; saveSettings(); renderOverlay(); });
  chips($('#t-modes'), MODES, settings.mode, (v) => { settings.mode = v; saveSettings(); renderOverlay(); });
  updateSteps();
  renderOverlay();
  setLightbox(lightbox);
  requestWakeLock();
}

function leaveTrace() {
  stopCamera();
  setBlink(false);
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

function setLocked(on) {
  locked = on;
  $('#t-lock').setAttribute('aria-pressed', String(on));
  $('#tekenen').classList.toggle('locked', on);
}
function setUiHidden(on) {
  for (const el of $$('#tekenen [data-ui]')) el.classList.toggle('gone', on);
  $('#t-show').hidden = !on;
  if (current === 'tekenen') layoutStage();
}
function setBlink(on) {
  clearInterval(blinkTimer);
  blinkTimer = null;
  $('#t-blink').setAttribute('aria-pressed', String(on));
  overlay.style.visibility = 'visible';
  if (on) blinkTimer = setInterval(() => { overlay.style.visibility = overlay.style.visibility === 'hidden' ? 'visible' : 'hidden'; }, 700);
}

$('#t-lock').addEventListener('click', () => { setLocked(!locked); toast(locked ? 'Tekening vergrendeld' : 'Tekening los'); });
$('#t-hide').addEventListener('click', () => setUiHidden(true));
$('#t-show').addEventListener('click', () => setUiHidden(false));
$('#t-torch').addEventListener('click', async () => {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  try {
    await track.applyConstraints({ advanced: [{ torch: !torch }] });
    torch = !torch;
    $('#t-torch').setAttribute('aria-pressed', String(torch));
  } catch { toast('Zaklamp wordt niet ondersteund'); }
});
$('#t-fav').addEventListener('click', () => {
  const id = source?.item?.id;
  if (!id) return;
  favorites = favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites];
  store.set('favorites', favorites);
  rowsDirty = true;
  const on = favorites.includes(id);
  $('#t-fav').setAttribute('aria-pressed', String(on));
  toast(on ? 'Toegevoegd aan favorieten' : 'Uit favorieten verwijderd');
});
$('#t-opacity').addEventListener('input', (e) => {
  settings.opacity = +e.target.value;
  overlay.style.opacity = settings.opacity / 100;
  $('#t-opacity-val').textContent = settings.opacity + '%';
  saveSettings();
});
let widthTimer;
$('#t-width').addEventListener('input', (e) => {
  settings.width = +e.target.value;
  $('#t-width-val').textContent = settings.width;
  saveSettings();
  clearTimeout(widthTimer);
  widthTimer = setTimeout(renderOverlay, 120);
});
$('#t-flip').addEventListener('click', () => { tf.flip *= -1; applyTransform(); });
$('#t-rotate').addEventListener('click', () => { tf.rot = (Math.round(tf.rot / 90) * 90 + 90) % 360; applyTransform(); });
$('#t-reset').addEventListener('click', () => { Object.assign(tf, { x: 0, y: 0, scale: 1, rot: 0 }); applyTransform(); });
$('#t-grid').addEventListener('click', (e) => {
  const g = $('#grid-overlay');
  g.hidden = !g.hidden;
  e.currentTarget.setAttribute('aria-pressed', String(!g.hidden));
});
$('#t-blink').addEventListener('click', () => setBlink(!blinkTimer));
$('#t-light').addEventListener('click', () => setLightbox(!lightbox));
$('#t-more').addEventListener('click', (e) => {
  const opts = $('#t-options');
  opts.hidden = !opts.hidden;
  e.currentTarget.setAttribute('aria-pressed', String(!opts.hidden));
  layoutStage();
});
$('#t-step-prev').addEventListener('click', () => { source.n = Math.max(0, source.n - 1); updateSteps(); renderOverlay(); });
$('#t-step-next').addEventListener('click', () => { source.n = Math.min(source.steps.steps.length - 1, source.n + 1); updateSteps(); renderOverlay(); });

$('#t-photo').addEventListener('click', async () => {
  if (!stream || !video.videoWidth) { toast('Foto maken kan alleen met de camera aan'); return; }
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  try {
    await sketches.add(blob);
    toast('Bewaard in Mijn schetsen');
  } catch {
    toast('Bewaren is niet gelukt');
  }
});

// Gestures: one finger moves, two fingers zoom and rotate. Mouse wheel zooms.
const pointers = new Map();
let gesture = null;
function startGesture() {
  const pts = [...pointers.values()];
  gesture = { tf: { ...tf }, pts: pts.map((p) => ({ ...p })) };
  if (pts.length === 2) {
    gesture.dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    gesture.ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    gesture.mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }
}
stage.addEventListener('pointerdown', (e) => {
  if (locked) return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  startGesture();
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || locked) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 1 && gesture.pts.length === 1) {
    tf.x = gesture.tf.x + pts[0].x - gesture.pts[0].x;
    tf.y = gesture.tf.y + pts[0].y - gesture.pts[0].y;
  } else if (pts.length === 2 && gesture.dist) {
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    tf.scale = Math.max(0.15, Math.min(8, gesture.tf.scale * (dist / gesture.dist)));
    tf.rot = gesture.tf.rot + ((ang - gesture.ang) * 180) / Math.PI;
    tf.x = gesture.tf.x + mid.x - gesture.mid.x;
    tf.y = gesture.tf.y + mid.y - gesture.mid.y;
  }
  applyTransform();
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size) startGesture();
};
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => {
  if (locked) return;
  e.preventDefault();
  tf.scale = Math.max(0.15, Math.min(8, tf.scale * Math.exp(-e.deltaY * 0.0015)));
  applyTransform();
}, { passive: false });
window.addEventListener('resize', () => current === 'tekenen' && layoutStage());

// ---------- Misc ----------

$('#clear-recent').addEventListener('click', () => {
  favorites = [];
  recent = [];
  store.set('favorites', favorites);
  store.set('recent', recent);
  rowsDirty = true;
  toast('Gewist');
});

initHome();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
