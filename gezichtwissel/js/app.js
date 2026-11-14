import { store, uid } from './store.js';
import * as detector from './detector.js';
import { SwapEngine, DEFAULTS } from './engine.js';
import { withCenters, bounds, yaw, blendShape, expressionWeights, Smoother, N_LANDMARKS } from './mesh.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ============================================================
// Kleine hulpjes
// ============================================================

const storage = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* privémodus */ }
  },
};

let toastTimer = 0;
function toast(text, ms = 3200) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function setStatus(el, text, error = false) {
  el.textContent = text;
  el.classList.toggle('error', error);
}

const fit = (w, h, max) => {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)];
};

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

async function loadBitmap(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Oudere Safari: via een <img>.
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toCanvas(image, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(image, 0, 0, w, h);
  return c;
}

const canvasBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((r) => c.toBlob(r, type, q));

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function canShareFile(file) {
  try { return !!navigator.canShare?.({ files: [file] }); } catch { return false; }
}

async function shareFile(file) {
  try {
    await navigator.share({ files: [file], title: 'Gezichtwissel' });
  } catch (err) {
    if (err.name !== 'AbortError') toast('Delen lukte niet.');
  }
}

/** Klein "AI-bewerkt"-label rechtsonder, zodat duidelijk is dat het beeld bewerkt is. */
function drawLabel(ctx, w, h) {
  const fs = Math.max(11, Math.round(Math.min(w, h) * 0.028));
  ctx.save();
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  const text = 'AI-bewerkt';
  const pad = fs * 0.5;
  const tw = ctx.measureText(text).width;
  const x = w - tw - pad * 3, y = h - fs - pad * 3;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.roundRect?.(x, y, tw + pad * 2, fs + pad * 2, pad) ?? ctx.rect(x, y, tw + pad * 2, fs + pad * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x + pad, y + pad * 1.05);
  ctx.restore();
}

/** Kopieert het WebGL-canvas naar een 2D-canvas (optioneel gespiegeld en met label). */
function exportCanvas(src, { label, mirror = false, into = null } = {}) {
  const c = into || document.createElement('canvas');
  if (c.width !== src.width || c.height !== src.height) {
    c.width = src.width;
    c.height = src.height;
  }
  const ctx = c.getContext('2d');
  ctx.save();
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  if (label) drawLabel(ctx, c.width, c.height);
  return c;
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}
const extFor = (mime) => (mime.startsWith('video/mp4') ? 'mp4' : 'webm');

// ============================================================
// AI-model laden (met melding de eerste keer)
// ============================================================

let modelLoaded = false;
async function withModel(fn) {
  if (!modelLoaded) {
    $('#loader-text').textContent = 'AI-model laden… (eenmalig, ±4 MB)';
    $('#loader').hidden = false;
  }
  try {
    const r = await fn();
    modelLoaded = true;
    return r;
  } catch (err) {
    console.error(err);
    throw new Error(modelLoaded ? err.message : 'Het AI-model kon niet geladen worden. Controleer je internetverbinding en probeer opnieuw.');
  } finally {
    $('#loader').hidden = true;
  }
}

// ============================================================
// Instellingen
// ============================================================

// Editor: alle opties werken direct (realtime) in foto, video en live.
const pct = (v) => `${Math.round(v * 100)}%`;
const signed = (v) => (v > 0 ? '+' : '') + Math.round(v * 100);
const SECTIONS = [
  {
    id: 'swap', title: 'Gezicht',
    sliders: [
      { key: 'opacity', label: 'Sterkte', min: 0, max: 1, hint: 'Hoeveel van het nieuwe gezicht zichtbaar is' },
      { key: 'color', label: 'Huidskleur & licht aanpassen', min: 0, max: 1, hint: 'Neemt kleur en belichting van het origineel over' },
      { key: 'contrast', label: 'Contrast aanpassen', min: 0, max: 1, hint: 'Neemt schaduwen en glans van het origineel over' },
      { key: 'feather', label: 'Zachte rand', min: 0, max: 1, hint: 'Hoe geleidelijk het gezicht overloopt' },
      { key: 'maskSize', label: 'Gezichtsgebied', min: -1, max: 1, fmt: signed, hint: 'Kleiner of groter deel van het gezicht vervangen' },
      { key: 'shape', label: 'Gezichtsvorm van nieuw gezicht', min: 0, max: 1, hint: 'Ogen, neus en mond op de plek van het nieuwe gezicht' },
    ],
    checks: [
      { key: 'expression', label: 'Expressie volgen (knipperen, praten)' },
      { key: 'fillEyes', label: 'Ogen van nieuw gezicht' },
      { key: 'fillMouth', label: 'Mond van nieuw gezicht' },
    ],
  },
  {
    id: 'face', title: 'Retouche',
    sliders: [
      { key: 'smooth', label: 'Huid gladmaken', min: 0, max: 1 },
      { key: 'sharpen', label: 'Verscherpen', min: 0, max: 1 },
      { key: 'faceBright', label: 'Helderheid gezicht', min: -1, max: 1, fmt: signed },
      { key: 'faceContrast', label: 'Contrast gezicht', min: -1, max: 1, fmt: signed },
      { key: 'faceSat', label: 'Verzadiging gezicht', min: -1, max: 1, fmt: signed },
      { key: 'faceWarm', label: 'Warmte gezicht', min: -1, max: 1, fmt: signed },
    ],
  },
  {
    id: 'pos', title: 'Positie',
    sliders: [
      { key: 'offX', label: 'Links / rechts', min: -1, max: 1, fmt: signed },
      { key: 'offY', label: 'Omhoog / omlaag', min: -1, max: 1, fmt: signed },
      { key: 'scale', label: 'Grootte', min: -1, max: 1, fmt: signed },
      { key: 'rotate', label: 'Draaien', min: -1, max: 1, fmt: (v) => `${Math.round(v * 15)}°` },
    ],
  },
  {
    id: 'image', title: 'Hele beeld',
    sliders: [
      { key: 'imgBright', label: 'Helderheid', min: -1, max: 1, fmt: signed },
      { key: 'imgContrast', label: 'Contrast', min: -1, max: 1, fmt: signed },
      { key: 'imgSat', label: 'Verzadiging', min: -1, max: 1, fmt: signed },
      { key: 'imgWarm', label: 'Warmte', min: -1, max: 1, fmt: signed },
      { key: 'vignette', label: 'Vignet', min: 0, max: 1 },
    ],
  },
  {
    id: 'motion', title: 'Beweging', modes: ['video', 'live'],
    sliders: [
      { key: 'stability', label: 'Stabiliteit (minder trillen)', min: 0, max: 1, hint: 'Hoger = rustiger gezicht; snelle bewegingen worden altijd direct gevolgd' },
    ],
  },
  {
    id: 'export', title: 'Opslaan',
    checks: [{ key: 'label', label: 'Label "AI-bewerkt" bij downloaden' }],
  },
];

const EDIT_DEFAULTS = { ...DEFAULTS, shape: 0, expression: true, label: true, offX: 0, offY: 0, scale: 0, rotate: 0, stability: 0.6 };
const MODE_DEFAULTS = {
  photo: { ...EDIT_DEFAULTS, shape: 0.25 },
  video: { ...EDIT_DEFAULTS },
  live: { ...EDIT_DEFAULTS, stability: 0.5 },
};
const settings = {};
for (const mode of Object.keys(MODE_DEFAULTS)) {
  settings[mode] = { ...MODE_DEFAULTS[mode], ...storage.get(`settings-${mode}`, {}) };
}

function buildSettings(mode, onChange, openId = storage.get(`section-${mode}`, 'swap')) {
  const root = $(`[data-settings="${mode}"]`);
  root.replaceChildren();
  const s = settings[mode];
  const save = () => { storage.set(`settings-${mode}`, s); onChange(); };
  const sections = SECTIONS.filter((sec) => !sec.modes || sec.modes.includes(mode));
  if (!sections.some((sec) => sec.id === openId)) openId = 'swap';

  const tabs = document.createElement('div');
  tabs.className = 'seg';
  tabs.setAttribute('role', 'tablist');
  root.append(tabs);

  for (const sec of sections) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = sec.title;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', sec.id === openId);
    tabs.append(tab);

    const box = document.createElement('div');
    box.className = 'sec';
    box.hidden = sec.id !== openId;
    tab.addEventListener('click', () => {
      storage.set(`section-${mode}`, sec.id);
      $$('[role=tab]', tabs).forEach((t) => t.setAttribute('aria-selected', t === tab));
      $$('.sec', root).forEach((b) => { b.hidden = b !== box; });
    });

    for (const def of sec.sliders || []) {
      const fmt = def.fmt || pct;
      const label = document.createElement('label');
      label.className = 'slider';
      if (def.hint) label.title = def.hint;
      label.innerHTML = '<span></span><output></output><input type="range" step="1">';
      label.firstChild.textContent = def.label;
      const input = $('input', label);
      const out = $('output', label);
      input.min = Math.round(def.min * 100);
      input.max = Math.round(def.max * 100);
      input.value = Math.round(s[def.key] * 100);
      out.textContent = fmt(s[def.key]);
      input.addEventListener('input', () => {
        s[def.key] = input.value / 100;
        out.textContent = fmt(s[def.key]);
        save();
      });
      // Dubbelklik/dubbeltik zet de regelaar terug.
      input.addEventListener('dblclick', () => {
        s[def.key] = MODE_DEFAULTS[mode][def.key];
        input.value = Math.round(s[def.key] * 100);
        out.textContent = fmt(s[def.key]);
        save();
      });
      box.append(label);
    }
    for (const def of sec.checks || []) {
      const label = document.createElement('label');
      label.className = 'check';
      label.innerHTML = '<input type="checkbox"> <span></span>';
      label.lastChild.textContent = def.label;
      const input = $('input', label);
      input.checked = !!s[def.key];
      input.addEventListener('change', () => { s[def.key] = input.checked; save(); });
      box.append(label);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn ghost small';
    reset.textContent = `${sec.title}: standaard`;
    reset.addEventListener('click', () => {
      for (const def of [...(sec.sliders || []), ...(sec.checks || [])]) s[def.key] = MODE_DEFAULTS[mode][def.key];
      buildSettings(mode, onChange, sec.id);
      save();
    });
    box.append(reset);
    root.append(box);
  }
}

/** Voert een render hoogstens één keer per schermverversing uit (soepel slepen). */
function coalesce(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

// ============================================================
// Gezichtenbibliotheek
// ============================================================

let faces = [];                                 // opgeslagen gezichten (met objectURL)
let activeId = storage.get('active-face', null);
const faceData = new Map();                     // id → { image, w, h, src(481*2), raw(478*2) }
const engines = new Set();

async function loadFaces() {
  try {
    faces = await store.all('faces');
  } catch (err) {
    console.error(err);
    faces = [];
    toast('Opslag niet beschikbaar: gezichten worden niet bewaard.');
  }
  for (const f of faces) f.url = URL.createObjectURL(f.blob);
  if (!faces.some((f) => f.id === activeId)) activeId = faces[0]?.id ?? null;
  renderFaces();
}

const activeFace = () => faces.find((f) => f.id === activeId) || null;

function setActive(id) {
  activeId = id;
  storage.set('active-face', id);
  renderFaces();
  onActiveChange();
}

/** Laadt de pixels en landmarks van een opgeslagen gezicht (één keer). */
async function faceSource(face) {
  let d = faceData.get(face.id);
  if (!d) {
    const image = await loadBitmap(face.blob);
    const w = image.width, h = image.height;
    const raw = new Float32Array(N_LANDMARKS * 2);
    for (let i = 0; i < N_LANDMARKS; i++) {
      raw[i * 2] = face.pts[i * 2] * w;
      raw[i * 2 + 1] = face.pts[i * 2 + 1] * h;
    }
    d = { image, w, h, raw, src: withCenters(raw) };
    faceData.set(face.id, d);
  }
  return d;
}

function renderFaces() {
  const grid = $('#face-grid');
  grid.replaceChildren();
  for (const f of faces) {
    const card = document.createElement('div');
    card.className = 'face-card' + (f.id === activeId ? ' active' : '');
    card.innerHTML = `
      ${f.id === activeId ? '<span class="badge">Actief</span>' : ''}
      <button class="del" type="button" title="Verwijderen" aria-label="Verwijder ${f.name}">✕</button>
      <span class="avatar" style="background-image:url(${f.url})"></span>
      <input class="name" value="" aria-label="Naam" maxlength="30">
      ${Math.abs(f.yaw) > 0.35 ? '<p class="warn">Hoofd gedraaid: resultaat kan minder zijn</p>' : ''}`;
    const name = $('.name', card);
    name.value = f.name;
    name.addEventListener('click', (e) => e.stopPropagation());
    name.addEventListener('change', async () => {
      f.name = name.value.trim() || 'Gezicht';
      await store.put('faces', strip(f)).catch(() => {});
      renderActiveChip();
    });
    $('.del', card).addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${f.name}" verwijderen?`)) return;
      await store.delete('faces', f.id).catch(() => {});
      URL.revokeObjectURL(f.url);
      faceData.delete(f.id);
      engines.forEach((en) => en.forgetSource(f.id));
      faces = faces.filter((x) => x !== f);
      if (activeId === f.id) setActive(faces[0]?.id ?? null);
      else renderFaces();
      photo.onFacesChanged();
    });
    card.addEventListener('click', () => setActive(f.id));
    grid.append(card);
  }
  $('#faces-empty').hidden = faces.length > 0;
  renderActiveChip();
}

const strip = ({ url, ...rest }) => rest;

function renderActiveChip() {
  const f = activeFace();
  $('#active-face-img').style.backgroundImage = f ? `url(${f.url})` : '';
  $('#active-face-name').textContent = f ? f.name : 'Geen gezicht';
}

/** Snijdt een gezicht ruim uit, schaalt naar max 512 px en bewaart het. */
async function saveFaceFromImage(canvas, pts, name) {
  const b = bounds(pts);
  const side = b.size * 1.8;
  let x0 = Math.max(0, Math.round(b.cx - side / 2));
  let y0 = Math.max(0, Math.round(b.cy - side * 0.55));
  const x1 = Math.min(canvas.width, Math.round(b.cx + side / 2));
  const y1 = Math.min(canvas.height, Math.round(b.cy + side * 0.45));
  const cw = x1 - x0, ch = y1 - y0;
  const [w, h] = fit(cw, ch, 512);
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  crop.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, w, h);
  const norm = new Array(N_LANDMARKS * 2);
  for (let i = 0; i < N_LANDMARKS; i++) {
    norm[i * 2] = (pts[i * 2] - x0) / cw;
    norm[i * 2 + 1] = (pts[i * 2 + 1] - y0) / ch;
  }
  const face = {
    id: uid(),
    name,
    blob: await canvasBlob(crop, 'image/jpeg', 0.93),
    pts: norm,
    yaw: yaw(pts),
    created: Date.now(),
  };
  try { await store.put('faces', face); } catch { /* alleen in geheugen */ }
  face.url = URL.createObjectURL(face.blob);
  faces.unshift(face);
  return face;
}

/** Klein rond voorbeeld van een gezicht uit een canvas (voor kiezers). */
function faceThumb(canvas, pts) {
  const b = bounds(pts);
  const side = b.size * 1.3;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  c.getContext('2d').drawImage(canvas, b.cx - side / 2, b.cy - side / 2, side, side, 0, 0, 128, 128);
  return c.toDataURL('image/jpeg', 0.85);
}

async function addFacesFromBlob(blob) {
  const image = await loadBitmap(blob);
  const [w, h] = fit(image.width, image.height, 2048);
  const canvas = toCanvas(image, w, h);
  const found = await withModel(() => detector.detectImage(canvas, w, h));
  if (!found.length) {
    toast('Geen gezicht gevonden. Probeer een duidelijkere foto, recht van voren.');
    return null;
  }
  found.sort((a, b) => bounds(b).size - bounds(a).size);
  let chosen = [0];
  if (found.length > 1) {
    const pick = await openPicker({
      title: `${found.length} gezichten gevonden`,
      multi: true,
      groups: [{
        title: 'Welke gezichten wil je bewaren?',
        items: found.map((pts, i) => ({ id: i, label: `Persoon ${i + 1}`, img: faceThumb(canvas, pts), selected: i === 0 })),
      }],
      confirm: 'Bewaren',
    });
    if (!pick || !pick.length) return null;
    chosen = pick;
  }
  let last = null;
  for (const i of chosen) {
    last = await saveFaceFromImage(canvas, found[i], `Gezicht ${faces.length + 1}`);
    if (Math.abs(last.yaw) > 0.35) toast('Tip: een foto recht van voren geeft een beter resultaat.');
  }
  setActive(last.id);
  toast(chosen.length > 1 ? `${chosen.length} gezichten toegevoegd` : 'Gezicht toegevoegd');
  return last;
}

$('#face-file').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const file of files) {
    try { await addFacesFromBlob(file); } catch (err) { toast(err.message); }
  }
});

$('#face-selfie').addEventListener('click', async () => {
  const blob = await openCamera('user');
  if (blob) {
    try { await addFacesFromBlob(blob); } catch (err) { toast(err.message); }
  }
});

$('#active-face').addEventListener('click', async () => {
  if (!faces.length) { switchTab('faces'); toast('Voeg eerst een gezicht toe.'); return; }
  const id = await openPicker({
    title: 'Actief gezicht',
    groups: [{ title: 'Mijn gezichten', items: faces.map((f) => ({ id: f.id, label: f.name, img: f.url, selected: f.id === activeId })) }],
    add: true,
  });
  if (id === 'add') { switchTab('faces'); $('#face-file').click(); } else if (id) setActive(id);
});

// ============================================================
// Kiezer (onderblad)
// ============================================================

function openPicker({ title, groups, multi = false, confirm = null, none = null, add = false }) {
  const dlg = $('#face-sheet');
  const body = $('#face-sheet-body');
  $('#face-sheet-title').textContent = title;
  body.replaceChildren();
  const selected = new Set(groups.flatMap((g) => g.items.filter((i) => i.selected).map((i) => i.id)));

  return new Promise((resolve) => {
    let result = null;
    const finish = (r) => { result = r; dlg.close(); };

    for (const g of groups) {
      if (!g.items.length) continue;
      const sec = document.createElement('section');
      sec.innerHTML = `<h3>${g.title}</h3><div class="pick-row"></div>`;
      for (const item of g.items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pick' + (selected.has(item.id) ? ' selected' : '');
        b.innerHTML = `<span class="avatar"></span><span></span>`;
        $('.avatar', b).style.backgroundImage = `url(${item.img})`;
        b.lastChild.textContent = item.label;
        b.addEventListener('click', () => {
          if (!multi) return finish(item.id);
          if (selected.has(item.id)) selected.delete(item.id); else selected.add(item.id);
          b.classList.toggle('selected');
        });
        $('.pick-row', sec).append(b);
      }
      body.append(sec);
    }
    if (none || add) {
      const sec = document.createElement('section');
      sec.innerHTML = '<div class="pick-row"></div>';
      if (none) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pick none';
        b.innerHTML = '<span class="avatar">⦸</span><span>' + none + '</span>';
        b.addEventListener('click', () => finish('none'));
        $('.pick-row', sec).append(b);
      }
      if (add) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pick none';
        b.innerHTML = '<span class="avatar">＋</span><span>Nieuw gezicht</span>';
        b.addEventListener('click', () => finish('add'));
        $('.pick-row', sec).append(b);
      }
      body.append(sec);
    }
    if (confirm) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = confirm;
      b.addEventListener('click', () => finish([...selected]));
      body.append(b);
    }
    dlg.addEventListener('close', () => resolve(result), { once: true });
    dlg.showModal();
  });
}

// ============================================================
// Camera-onderblad (selfie of foto maken)
// ============================================================

async function getCamera(facingMode, audio = false, height = 720) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera wordt niet ondersteund (gebruik HTTPS).');
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode, height: { ideal: height }, width: { ideal: Math.round(height * 16 / 9) }, frameRate: { ideal: 30 } },
    audio,
  });
}

function openCamera(initialFacing = 'user') {
  const dlg = $('#camera-sheet');
  const video = $('#camera-video');
  let facing = initialFacing;
  let stream = null;

  const start = async () => {
    stream?.getTracks().forEach((t) => t.stop());
    try {
      stream = await getCamera(facing);
      video.srcObject = stream;
      video.classList.toggle('mirror', facing === 'user');
      await video.play().catch(() => {});
    } catch (err) {
      toast(err.name === 'NotAllowedError' ? 'Geen toegang tot de camera.' : (err.message || 'Camera starten mislukt.'));
      dlg.close();
    }
  };

  return new Promise((resolve) => {
    let result = null;
    const flip = () => { facing = facing === 'user' ? 'environment' : 'user'; start(); };
    const snap = () => {
      if (!video.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      const ctx = c.getContext('2d');
      if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0);
      c.toBlob((b) => { result = b; dlg.close(); }, 'image/jpeg', 0.94);
    };
    $('#camera-flip').onclick = flip;
    $('#camera-snap').onclick = snap;
    dlg.addEventListener('close', () => {
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      resolve(result);
    }, { once: true });
    dlg.showModal();
    start();
  });
}

// ============================================================
// Gemeenschappelijk: bronnen voor de motor
// ============================================================

/** Maakt de gezichtsopdracht voor de motor: bron → doelpositie. */
function faceJob(engine, source, targetPts, s) {
  let pts = blendShape(targetPts, source.raw, s.shape);
  if (s.offX || s.offY || s.scale || s.rotate) pts = nudge(pts, s);
  const dst = withCenters(pts);
  const weights = s.expression ? expressionWeights(source.raw, targetPts) : {};
  return { tex: source.tex, srcW: source.w, srcH: source.h, src: source.src, dst, weights, size: bounds(dst).size };
}

/** Handmatig bijstellen: verschuiven, schalen en draaien rond het gezichtsmidden. */
function nudge(pts, s) {
  const b = bounds(pts);
  const k = 1 + s.scale * 0.2;
  const a = s.rotate * (15 * Math.PI / 180);
  const c = Math.cos(a) * k, si = Math.sin(a) * k;
  const dx = s.offX * 0.15 * b.size, dy = s.offY * 0.15 * b.size;
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] - b.cx, y = pts[i + 1] - b.cy;
    out[i] = b.cx + c * x - si * y + dx;
    out[i + 1] = b.cy + si * x + c * y + dy;
  }
  return out;
}

async function librarySource(engine, face) {
  const d = await faceSource(face);
  return { ...d, tex: engine.sourceTexture(face.id, d.image) };
}

/** Synchrone variant voor de videolus: geeft null terwijl het gezicht nog laadt. */
function librarySourceSync(engine, face) {
  const d = faceData.get(face.id);
  if (!d) { faceSource(face).catch(() => {}); return null; }
  return { ...d, tex: engine.sourceTexture(face.id, d.image) };
}

/** Voor/na-schuif: 0 = uit, anders het deel (links) dat het origineel toont. */
function splitValue(id) {
  const v = Number($(id)?.value || 0);
  return v > 0 ? v / 100 : -1;
}

// ============================================================
// FOTO
// ============================================================

const photo = {
  engine: null,
  canvas: null,       // origineel (geschaald)
  w: 0,
  h: 0,
  faces: [],          // [{ pts, thumb }]
  assign: [],         // per doelgezicht: null | { lib: id } | { self: index }
  showMarkers: true,
  blob: null,

  init() {
    this.requestRender = coalesce(() => this.render());
    buildSettings('photo', this.requestRender);
    $('#photo-split').addEventListener('input', this.requestRender);
    const drop = $('#photo-drop');
    $('#photo-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) this.load(f);
    });
    $('#photo-camera').addEventListener('click', async () => {
      const blob = await openCamera('environment');
      if (blob) this.load(blob);
    });
    dropTarget(drop, 'image/', (f) => this.load(f));
    document.addEventListener('paste', (e) => {
      if (currentTab !== 'photo') return;
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) this.load(item.getAsFile());
    });

    $('#photo-all').addEventListener('click', () => {
      const f = activeFace();
      if (!f) { toast('Voeg eerst een gezicht toe bij "Gezichten".'); return; }
      this.assign = this.faces.map(() => ({ lib: f.id }));
      this.render();
    });
    $('#photo-rotate').addEventListener('click', () => {
      if (this.faces.length < 2) { toast('Hiervoor zijn minstens 2 gezichten in de foto nodig.'); return; }
      const n = this.faces.length;
      this.assign = this.faces.map((_, i) => ({ self: (i + 1) % n }));
      this.render();
    });
    $('#photo-clear').addEventListener('click', () => {
      this.assign = this.faces.map(() => null);
      this.render();
    });

    const cmp = $('#photo-compare');
    const showOrig = (e) => { e.preventDefault(); this.render(true); };
    const showNew = () => this.render();
    cmp.addEventListener('pointerdown', showOrig);
    cmp.addEventListener('pointerup', showNew);
    cmp.addEventListener('pointerleave', showNew);
    cmp.addEventListener('pointercancel', showNew);
    cmp.addEventListener('contextmenu', (e) => e.preventDefault());
    cmp.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') this.render(true); });
    cmp.addEventListener('keyup', showNew);

    $('#photo-markers').addEventListener('click', (e) => {
      this.showMarkers = !this.showMarkers;
      e.currentTarget.setAttribute('aria-pressed', this.showMarkers);
      $('#photo-chips').classList.toggle('off', !this.showMarkers);
    });

    $('#photo-download').addEventListener('click', async () => {
      const file = await this.file();
      downloadBlob(file, file.name);
    });
    $('#photo-share').addEventListener('click', async () => shareFile(await this.file()));
    $('#photo-share').hidden = !canShareFile(new File([''], 'x.jpg', { type: 'image/jpeg' }));
    $('#photo-save-template').addEventListener('click', async () => {
      await saveTemplate('photo', this.blob, await canvasBlob(thumbCanvas(this.canvas)));
      toast('Opgeslagen bij "Mijn sjablonen"');
    });
    $('#photo-new').addEventListener('click', () => this.close());
    renderTemplates('photo');
  },

  async file() {
    const c = exportCanvas(this.engine.canvas, { label: settings.photo.label });
    const blob = await canvasBlob(c, 'image/jpeg', 0.93);
    return new File([blob], `gezichtwissel-${stamp()}.jpg`, { type: 'image/jpeg' });
  },

  async load(blob) {
    const status = $('#photo-status');
    try {
      const image = await loadBitmap(blob);
      const [w, h] = fit(image.width, image.height, 2048);
      this.canvas = toCanvas(image, w, h);
      this.w = w;
      this.h = h;
      this.blob = blob;
      this.engine ??= newEngine($('#photo-canvas'));
      this.engine.setSize(w, h);
      this.engine.setTarget(this.canvas, w, h, { mipmap: true });
      $('#photo-picker').hidden = true;
      $('#photo-work').hidden = false;
      this.faces = [];
      this.assign = [];
      this.engine.render([]);
      this.drawChips();
      setStatus(status, 'Gezichten zoeken…');

      const found = await withModel(() => detector.detectImage(this.canvas, w, h));
      found.sort((a, b) => bounds(a).cx - bounds(b).cx); // van links naar rechts
      this.faces = found.map((pts) => ({ pts, thumb: faceThumb(this.canvas, pts) }));
      const f = activeFace();
      this.assign = this.faces.map(() => (f ? { lib: f.id } : null));
      if (!found.length) setStatus(status, 'Geen gezichten gevonden in deze foto. Probeer een andere.', true);
      else if (!f) setStatus(status, 'Voeg eerst een gezicht toe bij "Gezichten", of kies "Onderling wisselen".');
      else setStatus(status, `${found.length} ${found.length === 1 ? 'gezicht' : 'gezichten'} gevonden. Tik op een label om een ander gezicht te kiezen.`);
      await this.render();
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || 'Foto laden mislukt.', true);
      toast(err.message || 'Foto laden mislukt.');
    }
  },

  close() {
    $('#photo-picker').hidden = false;
    $('#photo-work').hidden = true;
    this.faces = [];
  },

  async render(original = false) {
    if (!this.engine || !this.canvas) return;
    const s = settings.photo;
    const jobs = [];
    if (!original) {
      for (let i = 0; i < this.faces.length; i++) {
        const a = this.assign[i];
        if (!a) continue;
        let source = null;
        if (a.lib) {
          const face = faces.find((f) => f.id === a.lib);
          if (face) source = await librarySource(this.engine, face);
        } else if (a.self != null && this.faces[a.self]) {
          const raw = this.faces[a.self].pts;
          source = { raw, src: withCenters(raw), w: this.w, h: this.h, tex: this.engine.target };
        }
        if (source) jobs.push(faceJob(this.engine, source, this.faces[i].pts, s));
      }
    }
    this.engine.render(jobs, s, { split: original ? -1 : splitValue('#photo-split') });
    if (!original && this.chipsDirty !== false) this.drawChips();
  },

  drawChips() {
    const root = $('#photo-chips');
    root.replaceChildren();
    this.faces.forEach((f, i) => {
      const b = bounds(f.pts);
      const a = this.assign[i];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (a ? '' : ' none');
      chip.style.left = `${(b.cx / this.w) * 100}%`;
      chip.style.top = `${Math.max(4, (b.y / this.h) * 100)}%`;
      let img = '', label = `Persoon ${i + 1}`;
      if (a?.lib) {
        const face = faces.find((x) => x.id === a.lib);
        img = face?.url ?? '';
        label = `${i + 1}: ${face?.name ?? '?'}`;
      } else if (a?.self != null) {
        img = this.faces[a.self].thumb;
        label = `${i + 1} → Persoon ${a.self + 1}`;
      } else {
        label = `${i + 1}: origineel`;
      }
      chip.innerHTML = '<span class="avatar"></span><span></span>';
      if (img) $('.avatar', chip).style.backgroundImage = `url(${img})`;
      chip.lastChild.textContent = label;
      chip.addEventListener('click', () => this.choose(i));
      root.append(chip);
    });
  },

  async choose(i) {
    const cur = this.assign[i];
    const id = await openPicker({
      title: `Gezicht voor persoon ${i + 1}`,
      groups: [
        { title: 'Mijn gezichten', items: faces.map((f) => ({ id: `lib:${f.id}`, label: f.name, img: f.url, selected: cur?.lib === f.id })) },
        {
          title: 'Uit deze foto',
          items: this.faces.map((f, j) => ({ id: `self:${j}`, label: `Persoon ${j + 1}`, img: f.thumb, selected: cur?.self === j })).filter((_, j) => j !== i),
        },
      ],
      none: 'Origineel',
      add: true,
    });
    if (!id) return;
    if (id === 'add') {
      const pick = document.createElement('input');
      pick.type = 'file';
      pick.accept = 'image/*';
      pick.onchange = async () => {
        if (!pick.files[0]) return;
        try {
          const face = await addFacesFromBlob(pick.files[0]);
          if (face) { this.assign[i] = { lib: face.id }; this.render(); }
        } catch (err) { toast(err.message); }
      };
      pick.click();
      return;
    }
    if (id === 'none') this.assign[i] = null;
    else if (id.startsWith('lib:')) this.assign[i] = { lib: id.slice(4) };
    else this.assign[i] = { self: Number(id.slice(5)) };
    this.render();
  },

  onFacesChanged() {
    this.assign = this.assign.map((a) => (a?.lib && !faces.some((f) => f.id === a.lib) ? null : a));
    if (!$('#photo-work').hidden) this.render();
  },
};

// ============================================================
// Sjablonen (eigen foto's/video's om opnieuw te gebruiken)
// ============================================================

function thumbCanvas(source, w = source.videoWidth || source.width, h = source.videoHeight || source.height) {
  const [tw, th] = fit(w, h, 240);
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  c.getContext('2d').drawImage(source, 0, 0, tw, th);
  return c;
}

async function saveTemplate(kind, blob, thumb) {
  try {
    await store.put('templates', { id: uid(), kind, blob, thumb, created: Date.now() });
  } catch {
    toast('Opslaan mislukt (te weinig opslagruimte?).');
  }
  renderTemplates(kind);
}

async function renderTemplates(kind) {
  let items = [];
  try { items = (await store.all('templates')).filter((t) => t.kind === kind); } catch { /* geen opslag */ }
  const row = $(`#${kind}-templates`);
  row.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));
  row.replaceChildren();
  $(`#${kind}-templates-wrap`).hidden = !items.length;
  for (const t of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'template';
    b.innerHTML = `<img alt=""><span class="kind">${kind === 'video' ? 'video' : 'foto'}</span><span class="x" role="button" aria-label="Verwijderen">✕</span>`;
    $('img', b).src = URL.createObjectURL(t.thumb);
    b.addEventListener('click', async (e) => {
      if (e.target.classList.contains('x')) {
        if (confirm('Sjabloon verwijderen?')) {
          await store.delete('templates', t.id).catch(() => {});
          renderTemplates(kind);
        }
        return;
      }
      if (kind === 'photo') photo.load(t.blob); else video.load(t.blob);
    });
    row.append(b);
  }
}

function dropTarget(el, typePrefix, onFile) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag');
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith(typePrefix));
    if (f) onFile(f); else toast('Dit bestandstype wordt niet ondersteund.');
  });
}

// ============================================================
// VIDEO
// ============================================================

const video = {
  engine: null,
  el: $('#video-el'),
  blob: null,
  url: null,
  w: 0,
  h: 0,
  detect: null,
  smoother: new Smoother(),
  audio: null,
  frameReq: 0,
  exporting: null,

  init() {
    // Bij stilstand: alleen opnieuw tekenen met de laatste gezichtspunten (direct zichtbaar).
    this.requestDraw = coalesce(() => { if (this.el.paused) this.draw(); });
    buildSettings('video', this.requestDraw);
    $('#video-split').addEventListener('input', this.requestDraw);
    $('#video-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) this.load(f);
    });
    dropTarget($('#video-drop'), 'video/', (f) => this.load(f));

    const el = this.el;
    $('#video-play').addEventListener('click', () => (el.paused ? this.play() : el.pause()));
    el.addEventListener('play', () => this.setPlayIcon(true));
    el.addEventListener('pause', () => this.setPlayIcon(false));
    el.addEventListener('ended', () => this.setPlayIcon(false));
    el.addEventListener('timeupdate', () => {
      if (!el.duration) return;
      $('#video-seek').value = Math.round((el.currentTime / el.duration) * 1000);
      $('#video-time').textContent = fmtTime(el.currentTime);
    });
    $('#video-seek').addEventListener('input', (e) => {
      if (!el.duration) return;
      el.currentTime = (e.target.value / 1000) * el.duration;
    });
    el.addEventListener('seeked', () => {
      this.smoother.reset();
      if (el.paused) this.frame();
    });
    $('#video-mute').addEventListener('click', (e) => {
      const muted = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', muted);
      el.muted = muted;
    });
    $('#video-faces').value = String(storage.get('video-faces', 1));
    $('#video-faces').addEventListener('change', async (e) => {
      storage.set('video-faces', Number(e.target.value));
      this.detect = await detector.videoDetector(Number(e.target.value));
      this.smoother.reset();
      if (el.paused) this.frame();
    });

    $('#video-export').addEventListener('click', () => this.export());
    $('#video-cancel').addEventListener('click', () => this.exporting?.cancel());
    $('#video-save-template').addEventListener('click', async () => {
      await saveTemplate('video', this.blob, await canvasBlob(thumbCanvas(this.el)));
      toast('Opgeslagen bij "Mijn sjablonen"');
    });
    $('#video-new').addEventListener('click', () => this.close());
    renderTemplates('video');
  },

  setPlayIcon(playing) {
    const b = $('#video-play');
    b.querySelector('svg').innerHTML = playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="M7 5l12 7-12 7z"/>';
    b.querySelector('span').textContent = playing ? 'Pauze' : 'Afspelen';
  },

  async load(blob) {
    const status = $('#video-status');
    const el = this.el;
    this.close(false);
    this.blob = blob;
    this.url = URL.createObjectURL(blob);
    el.src = this.url;
    el.loop = false;
    $('#video-picker').hidden = true;
    $('#video-work').hidden = false;
    $('#video-result').hidden = true;
    setStatus(status, 'Video laden…');
    try {
      await new Promise((res, rej) => {
        el.onloadeddata = res;
        el.onerror = () => rej(new Error('Deze video kan je browser niet afspelen. Probeer mp4 of webm.'));
      });
      [this.w, this.h] = fit(el.videoWidth, el.videoHeight, 1280);
      this.engine ??= newEngine($('#video-canvas'));
      this.engine.setSize(this.w, this.h);
      this.detect = await withModel(() => detector.videoDetector(Number($('#video-faces').value)));
      $('#video-time').textContent = fmtTime(0);
      el.currentTime = 0.01;
      setStatus(status, activeFace()
        ? `${fmtTime(el.duration)} · ${el.videoWidth}×${el.videoHeight}. Druk op afspelen voor een voorbeeld, of op "Video maken".`
        : 'Kies eerst een gezicht bij "Gezichten".');
    } catch (err) {
      setStatus(status, err.message, true);
    }
  },

  close(showPicker = true) {
    this.exporting?.cancel();
    this.el.pause();
    cancelFrame(this.el, this.frameReq);
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.el.removeAttribute('src');
    if (showPicker) {
      $('#video-picker').hidden = false;
      $('#video-work').hidden = true;
    }
  },

  async play() {
    this.ensureAudio();
    this.smoother.reset();
    if (this.el.ended) this.el.currentTime = 0;
    await this.el.play().catch(() => {});
    this.loop();
  },

  loop() {
    const step = () => {
      if (this.el.paused || this.el.ended) return;
      this.frame();
      this.frameReq = requestFrame(this.el, step);
    };
    this.frameReq = requestFrame(this.el, step);
  },

  ensureAudio() {
    if (this.audio || !window.AudioContext) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(this.el);
      const speakers = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      src.connect(speakers).connect(ctx.destination);
      src.connect(dest);
      this.audio = { ctx, speakers, dest };
    } catch (err) {
      console.warn('Geen audio-opname mogelijk', err);
    }
  },

  async frame() {
    const el = this.el;
    if (!this.engine || el.readyState < 2) return;
    this.engine.setTarget(el, el.videoWidth, el.videoHeight);
    const face = activeFace();
    this.found = [];
    if (face && this.detect) {
      if (!faceData.has(face.id)) await faceSource(face);
      let found = this.detect(el, this.w, this.h);
      found.sort((a, b) => bounds(b).size - bounds(a).size);
      found = found.slice(0, Number($('#video-faces').value));
      // Bij stilstand (pauze/zoeken) geen filter: dan klopt het frame precies.
      this.found = el.paused && !this.exporting ? found : this.smoother.update(found, performance.now() / 1000, settings.video.stability);
    }
    this.draw();
    this.exporting?.onFrame();
  },

  /** Tekent het huidige frame met de laatst gevonden gezichten (gebruikt bij elke instelling). */
  draw() {
    if (!this.engine || this.el.readyState < 2) return;
    const face = activeFace();
    const s = settings.video;
    const source = face ? librarySourceSync(this.engine, face) : null;
    const jobs = source ? (this.found || []).map((pts) => faceJob(this.engine, source, pts, s)) : [];
    this.engine.render(jobs, s, { split: this.exporting ? -1 : splitValue('#video-split') });
  },

  async export() {
    if (!activeFace()) { toast('Kies eerst een gezicht bij "Gezichten".'); return; }
    const mime = pickMime();
    if (mime === null) { toast('Je browser kan geen video opnemen.'); return; }
    const el = this.el;
    this.ensureAudio();
    await this.audio?.ctx.resume();
    el.pause();
    el.currentTime = 0;
    await new Promise((r) => el.addEventListener('seeked', r, { once: true }));

    const rec = document.createElement('canvas');
    const label = settings.video.label;
    exportCanvas(this.engine.canvas, { label, into: rec });
    const stream = rec.captureStream(30);
    this.audio?.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const busy = $('#video-busy');
    const progress = $('#video-progress');
    busy.hidden = false;
    progress.value = 0;
    $('#video-busy-text').textContent = 'Video maken… laat dit tabblad open.';
    if (this.audio) this.audio.speakers.gain.value = 0; // stil verwerken

    let cancelled = false;
    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve();
      el.addEventListener('ended', () => recorder.state !== 'inactive' && recorder.stop(), { once: true });
    });
    this.exporting = {
      onFrame: () => {
        exportCanvas(this.engine.canvas, { label, into: rec });
        progress.value = el.duration ? el.currentTime / el.duration : 0;
      },
      cancel: () => {
        cancelled = true;
        el.pause();
        if (recorder.state !== 'inactive') recorder.stop();
      },
    };
    this.smoother.reset();
    recorder.start(250);
    await el.play().catch(() => {});
    this.loop();
    await done;

    this.exporting = null;
    busy.hidden = true;
    if (this.audio) this.audio.speakers.gain.value = 1;
    if (cancelled) { toast('Geannuleerd'); return; }

    const type = recorder.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type });
    const name = `gezichtwissel-${stamp()}.${extFor(type)}`;
    const out = $('#video-out');
    if (out.src) URL.revokeObjectURL(out.src);
    out.src = URL.createObjectURL(blob);
    $('#video-download').href = out.src;
    $('#video-download').download = name;
    const file = new File([blob], name, { type });
    const share = $('#video-share');
    share.hidden = !canShareFile(file);
    share.onclick = () => shareFile(file);
    $('#video-result').hidden = false;
    $('#video-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
};

function requestFrame(el, cb) {
  return 'requestVideoFrameCallback' in el ? el.requestVideoFrameCallback(cb) : requestAnimationFrame(cb);
}
function cancelFrame(el, id) {
  if (!id) return;
  if ('cancelVideoFrameCallback' in el) el.cancelVideoFrameCallback(id); else cancelAnimationFrame(id);
}

// ============================================================
// LIVE
// ============================================================

const live = {
  engine: null,
  el: $('#live-video'),
  stream: null,
  facing: 'user',
  running: false,
  detect: null,
  smoother: new Smoother(),
  recorder: null,
  recCanvas: null,
  w: 0,
  h: 0,
  fps: { n: 0, t: 0 },

  init() {
    buildSettings('live', () => {});
    $('#live-quality').value = String(storage.get('live-quality', 720));
    $('#live-quality').addEventListener('change', (e) => {
      storage.set('live-quality', Number(e.target.value));
      if (this.running) this.start();
    });
    $('#live-on').addEventListener('click', () => this.start());
    $('#live-off').addEventListener('click', () => this.stop());
    $('#live-flip').addEventListener('click', () => {
      this.facing = this.facing === 'user' ? 'environment' : 'user';
      if (this.running) this.start();
    });
    $('#live-snap').addEventListener('click', () => this.snap());
    $('#live-rec').addEventListener('click', () => (this.recorder ? this.stopRec() : this.startRec()));
  },

  async start() {
    const status = $('#live-status');
    this.stopTracks();
    try {
      const q = Number($('#live-quality').value);
      this.stream = await getCamera(this.facing, false, q);
      this.el.srcObject = this.stream;
      await this.el.play();
      [this.w, this.h] = fit(this.el.videoWidth, this.el.videoHeight, q * 16 / 9);
      this.engine ??= newEngine($('#live-canvas'));
      this.engine.setSize(this.w, this.h);
      $('#live-canvas').classList.toggle('mirror', this.facing === 'user');
      this.detect = await withModel(() => detector.videoDetector(2));
      $('#live-start').hidden = true;
      $('#live-off').hidden = false;
      setStatus(status, activeFace() ? '' : 'Kies een gezicht bij "Gezichten" om te wisselen.');
      this.smoother.reset();
      if (!this.running) { this.running = true; this.loop(); }
    } catch (err) {
      console.error(err);
      setStatus(status, err.name === 'NotAllowedError' ? 'Geen toegang tot de camera. Sta dit toe in je browser.' : (err.message || 'Camera starten mislukt.'), true);
    }
  },

  stopTracks() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  },

  stop() {
    if (this.recorder) this.stopRec();
    this.running = false;
    this.stopTracks();
    this.el.srcObject = null;
    $('#live-start').hidden = false;
    $('#live-off').hidden = true;
    $('#live-fps').textContent = '';
  },

  loop() {
    let frameNo = 0;
    let detectMs = 0;
    let found = [];
    const step = (now) => {
      if (!this.running) return;
      const el = this.el;
      if (el.readyState >= 2 && el.videoWidth) {
        this.engine.setTarget(el, el.videoWidth, el.videoHeight);
        const face = $('#live-swap').checked ? activeFace() : null;
        const s = settings.live;
        let jobs = [];
        const source = face ? librarySourceSync(this.engine, face) : null;
        if (source && this.detect) {
          // Snelle camera: is herkennen traag (> 22 ms), dan om het andere frame herkennen.
          // Tussenliggende frames hergebruiken de gestabiliseerde punten.
          const every = detectMs > 22 ? 2 : 1;
          if (frameNo % every === 0 || !found.length) {
            const t0 = performance.now();
            const raw = this.detect(el, this.w, this.h);
            detectMs = detectMs * 0.8 + (performance.now() - t0) * 0.2;
            found = this.smoother.update(raw, performance.now() / 1000, s.stability);
          }
          jobs = found.map((pts) => faceJob(this.engine, source, pts, s));
        }
        frameNo++;
        this.engine.render(jobs, s);
        if (this.recorder) exportCanvas(this.engine.canvas, { label: s.label, mirror: this.facing === 'user', into: this.recCanvas });
        this.fps.n++;
        if (now - this.fps.t > 1000) {
          $('#live-fps').textContent = `${Math.round((this.fps.n * 1000) / (now - this.fps.t))} fps`;
          this.fps = { n: 0, t: now };
        }
      }
      requestFrame(el, step);
    };
    requestFrame(this.el, step);
  },

  async snap() {
    if (!this.running) { toast('Start eerst de camera.'); return; }
    const c = exportCanvas(this.engine.canvas, { label: settings.live.label, mirror: this.facing === 'user' });
    const blob = await canvasBlob(c, 'image/jpeg', 0.93);
    this.addToGallery(blob, `gezichtwissel-${stamp()}.jpg`, 'foto');
    downloadBlob(blob, `gezichtwissel-${stamp()}.jpg`);
  },

  async startRec() {
    if (!this.running) { toast('Start eerst de camera.'); return; }
    const mime = pickMime();
    if (mime === null) { toast('Je browser kan geen video opnemen.'); return; }
    this.recCanvas = exportCanvas(this.engine.canvas, { label: settings.live.label, mirror: this.facing === 'user' });
    const stream = this.recCanvas.captureStream(30);
    if ($('#live-mic').checked) {
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mic.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch { toast('Geen toegang tot de microfoon: opname zonder geluid.'); }
    }
    const chunks = [];
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 6_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm';
      const blob = new Blob(chunks, { type });
      this.addToGallery(blob, `gezichtwissel-${stamp()}.${extFor(type)}`, 'video');
      this.mic?.getTracks().forEach((t) => t.stop());
      this.mic = null;
    };
    rec.start(250);
    this.recorder = rec;
    const started = performance.now();
    $('#live-rec').classList.add('recording');
    $('#live-rec span').textContent = 'Stop';
    $('#live-rec-dot').hidden = false;
    this.recTimer = setInterval(() => {
      $('#live-rec-time').textContent = fmtTime((performance.now() - started) / 1000);
    }, 500);
  },

  stopRec() {
    this.recorder?.stop();
    this.recorder = null;
    clearInterval(this.recTimer);
    $('#live-rec').classList.remove('recording');
    $('#live-rec span').textContent = 'Opnemen';
    $('#live-rec-dot').hidden = true;
    $('#live-rec-time').textContent = '0:00';
  },

  addToGallery(blob, name, kind) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.title = `${name} downloaden`;
    const media = kind === 'video' ? document.createElement('video') : document.createElement('img');
    media.src = a.href;
    if (kind === 'video') { media.muted = true; media.playsInline = true; media.loop = true; media.autoplay = true; }
    a.append(media);
    const tag = document.createElement('span');
    tag.className = 'kind';
    tag.textContent = kind;
    a.append(tag);
    $('#live-gallery').prepend(a);
    if (kind === 'video') toast('Opname klaar: tik op het voorbeeld om te downloaden.');
  },
};

// ============================================================
// Tabbladen, motor en opstarten
// ============================================================

function newEngine(canvas) {
  try {
    const e = new SwapEngine(canvas);
    engines.add(e);
    return e;
  } catch (err) {
    toast(err.message, 6000);
    throw err;
  }
}

const TABS = ['faces', 'photo', 'video', 'live'];
let currentTab = 'faces';

function switchTab(name) {
  if (!TABS.includes(name)) name = 'faces';
  if (currentTab === 'live' && name !== 'live') live.stop();
  if (currentTab === 'video' && name !== 'video') video.el.pause();
  currentTab = name;
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
  $$('.tabs button').forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0 });
}

function onActiveChange() {
  if (currentTab === 'video' && video.el.paused) video.frame();
}

$$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
window.addEventListener('hashchange', () => switchTab(location.hash.slice(1)));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && live.running && !live.recorder) live.stop();
});

function consent() {
  if (storage.get('consent', false)) return;
  const dlg = $('#consent');
  dlg.addEventListener('cancel', (e) => e.preventDefault());
  dlg.addEventListener('close', () => storage.set('consent', true));
  dlg.showModal();
}

photo.init();
video.init();
live.init();
await loadFaces();
switchTab(location.hash.slice(1) || (faces.length ? 'photo' : 'faces'));
consent();

// Model alvast op de achtergrond ophalen zodat de eerste wissel snel is.
setTimeout(() => detector.ready().catch(() => {}), 1500);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Voor tests en debugging.
window.__gw = { photo, video, live, faces: () => faces, setActive };
