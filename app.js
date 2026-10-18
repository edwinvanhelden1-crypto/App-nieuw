const $ = (sel) => document.querySelector(sel);

const fileInput = $('#file-input');
const dropzone = $('#dropzone');
const inputCard = $('#input-card');
const editor = $('#editor');
const canvas = $('#canvas');
const overlay = $('#overlay');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');
const statusEl = $('#status');
const progressEl = $('#progress');
const resultEl = $('#result');
const taskButtons = [...document.querySelectorAll('[data-task]')];

const MAX_SIDE = 1600;

// `original` is the photo as loaded; `base` holds the current pixels (e.g. after
// background removal). Filters are applied on top of `base` when drawing.
let original = null;
let base = null;

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let nextId = 0;
const pending = new Map();

worker.addEventListener('message', ({ data }) => {
  const job = pending.get(data.id);
  if (!job) return;
  if (data.type === 'progress') {
    progressEl.hidden = false;
    progressEl.value = data.progress ?? 0;
    setStatus(`Model downloaden (${data.file})… ${Math.round(data.progress ?? 0)}%`);
  } else if (data.type === 'status') {
    setStatus(data.text);
  } else if (data.type === 'done') {
    pending.delete(data.id);
    job.resolve(data.result);
  } else if (data.type === 'error') {
    pending.delete(data.id);
    job.reject(new Error(data.message));
  }
});

function runTask(task, extra = {}) {
  return new Promise((resolve, reject) => {
    base.toBlob((blob) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, task, blob, ...extra });
    }, 'image/png');
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

// ---------- Loading photos ----------

function makeCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

async function loadImage(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  original = makeCanvas(w, h);
  original.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  resetToOriginal();
  inputCard.hidden = true;
  editor.hidden = false;
  setStatus('Kies een AI-functie of pas de filters aan.');
}

function resetToOriginal() {
  base = makeCanvas(original.width, original.height);
  base.getContext('2d').drawImage(original, 0, 0);
  for (const input of document.querySelectorAll('.sliders input')) {
    input.value = input.defaultValue;
  }
  clearOverlay();
  resultEl.replaceChildren();
  render();
}

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Kies een afbeelding.');
    return;
  }
  loadImage(file).catch((err) => alert(`Kon de foto niet openen: ${err.message}`));
}

fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFile(e.dataTransfer.files[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (item) handleFile(item.getAsFile());
});

// ---------- Camera ----------

const cameraWrap = $('#camera-wrap');
const video = $('#camera');
let stream = null;

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  cameraWrap.hidden = true;
  dropzone.hidden = false;
}

$('#camera-btn').addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    cameraWrap.hidden = false;
    dropzone.hidden = true;
  } catch (err) {
    alert(`Camera niet beschikbaar: ${err.message}`);
  }
});

$('#snap-btn').addEventListener('click', () => {
  const c = makeCanvas(video.videoWidth, video.videoHeight);
  c.getContext('2d').drawImage(video, 0, 0);
  stopCamera();
  c.toBlob(handleFile, 'image/jpeg', 0.95);
});

$('#camera-close').addEventListener('click', stopCamera);

// ---------- Rendering & filters ----------

function filterString() {
  const v = (id) => $(`#f-${id}`).value;
  return [
    `brightness(${v('brightness')}%)`,
    `contrast(${v('contrast')}%)`,
    `saturate(${v('saturate')}%)`,
    `grayscale(${v('grayscale')}%)`,
    `sepia(${v('sepia')}%)`,
    `blur(${v('blur')}px)`,
  ].join(' ');
}

function render() {
  canvas.width = overlay.width = base.width;
  canvas.height = overlay.height = base.height;
  ctx.filter = filterString();
  ctx.drawImage(base, 0, 0);
  ctx.filter = 'none';
}

for (const input of document.querySelectorAll('.sliders input')) {
  input.addEventListener('input', () => {
    // Resizing the canvases in render() would wipe the detection boxes, so only redraw the photo.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = filterString();
    ctx.drawImage(base, 0, 0);
    ctx.filter = 'none';
  });
}

function clearOverlay() {
  octx.clearRect(0, 0, overlay.width, overlay.height);
}

// ---------- AI tasks ----------

const COCO_NL = {
  person: 'persoon', bicycle: 'fiets', car: 'auto', motorcycle: 'motor', airplane: 'vliegtuig',
  bus: 'bus', train: 'trein', truck: 'vrachtwagen', boat: 'boot', 'traffic light': 'verkeerslicht',
  'fire hydrant': 'brandkraan', 'stop sign': 'stopbord', 'parking meter': 'parkeermeter', bench: 'bank',
  bird: 'vogel', cat: 'kat', dog: 'hond', horse: 'paard', sheep: 'schaap', cow: 'koe',
  elephant: 'olifant', bear: 'beer', zebra: 'zebra', giraffe: 'giraffe', backpack: 'rugzak',
  umbrella: 'paraplu', handbag: 'handtas', tie: 'stropdas', suitcase: 'koffer', frisbee: 'frisbee',
  skis: 'ski\'s', snowboard: 'snowboard', 'sports ball': 'bal', kite: 'vlieger',
  'baseball bat': 'honkbalknuppel', 'baseball glove': 'honkbalhandschoen', skateboard: 'skateboard',
  surfboard: 'surfplank', 'tennis racket': 'tennisracket', bottle: 'fles', 'wine glass': 'wijnglas',
  cup: 'kopje', fork: 'vork', knife: 'mes', spoon: 'lepel', bowl: 'kom', banana: 'banaan',
  apple: 'appel', sandwich: 'broodje', orange: 'sinaasappel', broccoli: 'broccoli', carrot: 'wortel',
  'hot dog': 'hotdog', pizza: 'pizza', donut: 'donut', cake: 'taart', chair: 'stoel', couch: 'bank',
  'potted plant': 'kamerplant', bed: 'bed', 'dining table': 'eettafel', toilet: 'toilet', tv: 'tv',
  laptop: 'laptop', mouse: 'muis', remote: 'afstandsbediening', keyboard: 'toetsenbord',
  'cell phone': 'mobiele telefoon', microwave: 'magnetron', oven: 'oven', toaster: 'broodrooster',
  sink: 'gootsteen', refrigerator: 'koelkast', book: 'boek', clock: 'klok', vase: 'vaas',
  scissors: 'schaar', 'teddy bear': 'teddybeer', 'hair drier': 'föhn', toothbrush: 'tandenborstel',
};

// Candidate labels for zero-shot classification: English for the model, Dutch for display.
const LABELS = {
  'a portrait of a person': 'Portret',
  'a group of people': 'Groepsfoto',
  'a landscape': 'Landschap',
  'a beach': 'Strand',
  'mountains': 'Bergen',
  'a forest': 'Bos',
  'a city street': 'Stad',
  'a building': 'Gebouw',
  'food': 'Eten',
  'a dog': 'Hond',
  'a cat': 'Kat',
  'an animal': 'Dier',
  'flowers': 'Bloemen',
  'a car': 'Auto',
  'a sunset': 'Zonsondergang',
  'night': 'Nacht',
  'snow': 'Sneeuw',
  'the sea': 'Zee',
  'a document or text': 'Document',
  'a selfie': 'Selfie',
  'a sports event': 'Sport',
  'a party': 'Feest',
  'a baby': 'Baby',
  'an interior room': 'Interieur',
};

const COLORS = ['#ff5d5d', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a65', '#4db6ac'];

function drawDetections(objects) {
  clearOverlay();
  const lw = Math.max(2, overlay.width / 300);
  const fontSize = Math.max(14, overlay.width / 45);
  octx.lineWidth = lw;
  octx.font = `600 ${fontSize}px system-ui, sans-serif`;
  octx.textBaseline = 'top';
  objects.forEach(({ label, score, box }, i) => {
    const color = COLORS[i % COLORS.length];
    const w = box.xmax - box.xmin;
    const h = box.ymax - box.ymin;
    octx.strokeStyle = color;
    octx.strokeRect(box.xmin, box.ymin, w, h);
    const text = `${COCO_NL[label] ?? label} ${Math.round(score * 100)}%`;
    const tw = octx.measureText(text).width + 8;
    const ty = Math.max(0, box.ymin - fontSize - 6);
    octx.fillStyle = color;
    octx.fillRect(box.xmin, ty, tw, fontSize + 6);
    octx.fillStyle = '#000';
    octx.fillText(text, box.xmin + 4, ty + 3);
  });
}

function list(items) {
  const ul = document.createElement('ul');
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.append(li);
  }
  return ul;
}

const HANDLERS = {
  async caption() {
    const { english, dutch } = await runTask('caption');
    const p = document.createElement('p');
    p.className = 'caption';
    p.textContent = dutch ?? english;
    const small = document.createElement('small');
    small.textContent = dutch ? `Origineel (Engels): ${english}` : '';
    resultEl.replaceChildren(p, small);
  },

  async detect() {
    const objects = await runTask('detect');
    drawDetections(objects);
    if (!objects.length) {
      resultEl.textContent = 'Geen objecten met zekerheid herkend.';
      return;
    }
    const counts = {};
    for (const o of objects) {
      const name = COCO_NL[o.label] ?? o.label;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    resultEl.replaceChildren(list(Object.entries(counts).map(([n, c]) => `${c}× ${n}`)));
  },

  async classify() {
    const top = await runTask('classify', { labels: Object.keys(LABELS) });
    resultEl.replaceChildren(list(top.map((t) => `${LABELS[t.label]}: ${Math.round(t.score * 100)}%`)));
  },

  async background() {
    const { width, height, data } = await runTask('background');
    const cut = makeCanvas(width, height);
    cut.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    base = cut;
    clearOverlay();
    render();
    resultEl.textContent = 'Achtergrond verwijderd. Download als PNG om de transparantie te behouden.';
  },
};

const LABELS_BUSY = {
  caption: 'Foto beschrijven…',
  detect: 'Objecten zoeken…',
  classify: 'Labels bepalen…',
  background: 'Achtergrond verwijderen…',
};

for (const btn of taskButtons) {
  btn.addEventListener('click', async () => {
    const task = btn.dataset.task;
    taskButtons.forEach((b) => (b.disabled = true));
    resultEl.replaceChildren();
    if (task !== 'detect') clearOverlay();
    setStatus(LABELS_BUSY[task]);
    try {
      await HANDLERS[task]();
      setStatus('Klaar.');
    } catch (err) {
      console.error(err);
      setStatus(`Er ging iets mis: ${err.message}`);
    } finally {
      progressEl.hidden = true;
      taskButtons.forEach((b) => (b.disabled = false));
    }
  });
}

// ---------- Actions ----------

$('#reset-btn').addEventListener('click', resetToOriginal);

$('#new-btn').addEventListener('click', () => {
  editor.hidden = true;
  inputCard.hidden = false;
  fileInput.value = '';
});

$('#download-btn').addEventListener('click', () => {
  // Bake the detection boxes into the download when they are visible.
  const out = makeCanvas(canvas.width, canvas.height);
  const c = out.getContext('2d');
  c.drawImage(canvas, 0, 0);
  c.drawImage(overlay, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-foto.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});
