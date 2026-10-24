const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const SWATCHES = ['#ff0000', '#ff6a00', '#ffd000', '#00e05a', '#00d5ff', '#0050ff', '#8a2be2', '#ff00b4'];

let devices = [];
let current = null;
let state = {};

// ---------- API ----------

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fout ${res.status}`);
  return data;
}

// Tijdens slepen sturen we niet elke beweging: één verzoek tegelijk, en
// tussentijdse wijzigingen worden samengevoegd tot het volgende verzoek.
let pending = null;
let busy = false;
const MODES = ['colour', 'white', 'scene'];
function send(change) {
  // Een nieuwe modus vervangt een nog niet verstuurde andere modus.
  if (pending && MODES.some((m) => m in change)) MODES.forEach((m) => delete pending[m]);
  pending = { ...pending, ...change };
  if (!busy) flush();
}
async function flush() {
  if (!pending || !current) return;
  const body = pending;
  const id = current.id;
  pending = null;
  busy = true;
  try {
    await api(`/api/devices/${id}`, body);
    setOnline(true);
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    if (pending) flush();
  }
}

// ---------- UI-status ----------

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 4000);
}

function setOnline(online, msg) {
  $('#panel').classList.toggle('offline', !online);
  $('#dev-status').textContent = online ? (state.on ? 'Aan' : 'Uit') : (msg || 'Niet bereikbaar');
}

function setPower(on) {
  state.on = on;
  $('#power').setAttribute('aria-pressed', on);
  setOnline(true);
}

function setGlow(hex) {
  document.documentElement.style.setProperty('--glow', hex);
}

function showTab(tab) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
}

function setSlider(id, value) {
  $(`#${id}`).value = value;
  $(`#${id}-out`).textContent = `${value}%`;
}

function tempToHex(t) {
  // 0 = warm (oranje), 100 = koel (blauwig wit)
  const warm = [255, 179, 92], cool = [207, 227, 255];
  const c = warm.map((w, i) => Math.round(w + (cool[i] - w) * (t / 100)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---------- Apparaten ----------

function renderDevices() {
  const box = $('#devices');
  box.innerHTML = '';
  devices.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = d.name;
    b.classList.toggle('active', current && d.id === current.id);
    b.onclick = () => selectDevice(d);
    box.appendChild(b);
  });
}

async function selectDevice(d) {
  current = d;
  pending = null;
  try { localStorage.setItem('led-device', d.id); } catch {}
  renderDevices();
  $('#dev-name').textContent = d.name;
  $('#dev-status').textContent = 'Verbinden…';
  await refresh();
}

async function refresh() {
  const d = current;
  try {
    const s = await api(`/api/devices/${d.id}`);
    if (d !== current) return;
    state = s;
    setPower(s.on);
    setSlider('colour-bri', s.brightness || 100);
    setSlider('white-bri', s.brightness || 100);
    setSlider('temp', s.colourtemp);
    renderScenes(s.scenes || []);
    if (s.mode === 'colour') {
      showTab('colour');
      placeDot(s.colour);
      setGlow(s.colour);
    } else if (s.mode && s.mode.startsWith('scene')) {
      showTab('scene');
    } else {
      showTab('white');
      setGlow(tempToHex(s.colourtemp));
    }
  } catch (e) {
    if (d === current) setOnline(false, e.message);
  }
}

// ---------- Kleurenwiel ----------

const wheel = $('#wheel');
const dot = $('#wheel-dot');

function drawWheel() {
  const ctx = wheel.getContext('2d');
  const size = wheel.width, r = size / 2;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r, dy = y - r, dist = Math.hypot(dx, dy);
      if (dist > r) continue;
      const [cr, cg, cb] = hsvToRgb((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1, dist / r, 1);
      const i = (y * size + x) * 4;
      img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb;
      img.data[i + 3] = dist > r - 1 ? 255 * (r - dist) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [r, g, b].map((c) => Math.round(c * 255));
}

function rgbToHs(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [((h / 6) + 1) % 1, max ? d / max : 0];
}

function placeDot(hex) {
  const [h, s] = rgbToHs(hex);
  const a = h * 2 * Math.PI;
  dot.style.left = `${50 + Math.cos(a) * s * 50}%`;
  dot.style.top = `${50 + Math.sin(a) * s * 50}%`;
  dot.style.background = hex;
}

function pickFromWheel(e) {
  const rect = wheel.getBoundingClientRect();
  const r = rect.width / 2;
  let dx = e.clientX - rect.left - r, dy = e.clientY - rect.top - r;
  const dist = Math.min(Math.hypot(dx, dy), r);
  const h = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
  const hex = '#' + hsvToRgb(h, dist / r, 1).map((c) => c.toString(16).padStart(2, '0')).join('');
  chooseColour(hex);
}

function chooseColour(hex) {
  placeDot(hex);
  setGlow(hex);
  setPower(true);
  send({ colour: hex, brightness: +$('#colour-bri').value });
}

wheel.addEventListener('pointerdown', (e) => {
  wheel.setPointerCapture(e.pointerId);
  pickFromWheel(e);
});
wheel.addEventListener('pointermove', (e) => {
  if (wheel.hasPointerCapture(e.pointerId)) pickFromWheel(e);
});

SWATCHES.forEach((hex) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = hex;
  b.setAttribute('aria-label', hex);
  b.onclick = () => chooseColour(hex);
  $('#swatches').appendChild(b);
});

// ---------- Overige bediening ----------

$('#power').onclick = () => {
  const on = !state.on;
  setPower(on);
  send({ on });
};

$$('.tabs button').forEach((b) => {
  b.onclick = () => showTab(b.dataset.tab);
});

$('#colour-bri').oninput = (e) => {
  setSlider('colour-bri', e.target.value);
  send({ brightness: +e.target.value });
};

function sendWhite() {
  const brightness = +$('#white-bri').value, colourtemp = +$('#temp').value;
  setGlow(tempToHex(colourtemp));
  setPower(true);
  send({ white: { brightness, colourtemp } });
}
$('#white-bri').oninput = (e) => { setSlider('white-bri', e.target.value); sendWhite(); };
$('#temp').oninput = (e) => { setSlider('temp', e.target.value); sendWhite(); };

$$('[data-white]').forEach((b) => {
  b.onclick = () => {
    const [bri, temp] = b.dataset.white.split(',');
    setSlider('white-bri', bri);
    setSlider('temp', temp);
    sendWhite();
  };
});

function renderScenes(names) {
  const box = $('#scenes');
  box.innerHTML = '';
  names.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.onclick = () => {
      setPower(true);
      send({ scene: i });
    };
    box.appendChild(b);
  });
  $('[data-tab="scene"]').hidden = !names.length;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && current) refresh();
});

// ---------- Start ----------

(async function init() {
  drawWheel();
  try {
    devices = await api('/api/devices');
  } catch (e) {
    toast('Server niet bereikbaar: ' + e.message);
    return;
  }
  if (!devices.length) {
    $('#empty').hidden = false;
    return;
  }
  $('#panel').hidden = false;
  let saved = null;
  try { saved = localStorage.getItem('led-device'); } catch {}
  selectDevice(devices.find((d) => d.id === saved) || devices[0]);
})();
