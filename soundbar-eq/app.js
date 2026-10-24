const $ = (sel) => document.querySelector(sel);

const FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const MAX_DB = 12;
const STORE_KEY = 'soundbar-eq';

const PRESETS = {
  'Vlak':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bas boost':     [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Dialoog':       [-2, -2, -1, 0, 2, 4, 4, 3, 1, 0],
  'Film':          [4, 3, 1, 0, -1, 0, 1, 2, 3, 3],
  'Muziek':        [4, 3, 1, 0, -1, -1, 0, 2, 3, 4],
  'Pop':           [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  'Rock':          [5, 4, 2, -1, -2, -1, 2, 3, 4, 4],
  'Nacht (zacht)': [-6, -5, -3, -1, 0, 1, 2, 2, 1, 0],
  'Hoge tonen':    [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
};

// ---------- Saved settings ----------

const saved = loadSettings();
let gains = saved.gains ?? [...PRESETS['Vlak']];
let customPresets = saved.customPresets ?? {};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      gains,
      customPresets,
      preamp: +preampEl.value,
      volume: +volumeEl.value,
      eqOn: eqOnEl.checked,
      limiterOn: limiterOnEl.checked,
      sinkId: outputSelect.value,
    }));
  } catch { /* storage unavailable: settings just aren't remembered */ }
}

// ---------- Audio graph ----------
// source -> preamp -> 10 filters -> limiter -> analyser -> volume -> output

const ctx = new AudioContext({ latencyHint: 'playback' });
const preamp = ctx.createGain();
const filters = FREQS.map((frequency, i) => {
  const f = ctx.createBiquadFilter();
  f.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
  f.frequency.value = frequency;
  f.Q.value = 1;
  return f;
});
const limiter = ctx.createDynamicsCompressor();
limiter.threshold.value = -3;
limiter.knee.value = 0;
limiter.ratio.value = 20;
limiter.attack.value = 0.003;
limiter.release.value = 0.15;
const analyser = ctx.createAnalyser();
analyser.fftSize = 4096;
analyser.smoothingTimeConstant = 0.8;
const volume = ctx.createGain();

filters.reduce((prev, f) => (prev.connect(f), f), preamp);
analyser.connect(volume);
volume.connect(ctx.destination);

const lastFilter = filters[filters.length - 1];

function routeTail() {
  lastFilter.disconnect();
  limiter.disconnect();
  if (limiterOnEl.checked) {
    lastFilter.connect(limiter);
    limiter.connect(analyser);
  } else {
    lastFilter.connect(analyser);
  }
}

function applyGains() {
  const on = eqOnEl.checked;
  filters.forEach((f, i) => f.gain.setTargetAtTime(on ? gains[i] : 0, ctx.currentTime, 0.02));
  preamp.gain.setTargetAtTime(on ? dbToGain(+preampEl.value) : 1, ctx.currentTime, 0.02);
  document.body.classList.toggle('eq-off', !on);
  computeResponse();
}

const dbToGain = (db) => 10 ** (db / 20);

// ---------- Output device (soundbar) ----------

const outputSelect = $('#output-select');
const outputStatus = $('#output-status');
const canChooseOutput = typeof ctx.setSinkId === 'function';

function setOutputStatus(text, isError = false) {
  outputStatus.textContent = text;
  outputStatus.classList.toggle('error', isError);
}

async function listOutputs() {
  const devices = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default');
  const current = outputSelect.value || saved.sinkId || '';
  outputSelect.length = 1;
  for (const d of devices) {
    const opt = new Option(d.label || 'Naamloos apparaat', d.deviceId);
    outputSelect.add(opt);
  }
  if ([...outputSelect.options].some((o) => o.value === current)) outputSelect.value = current;
  return devices;
}

async function findOutputs() {
  try {
    if (navigator.mediaDevices.selectAudioOutput) {
      // Firefox: the browser shows its own device picker.
      const device = await navigator.mediaDevices.selectAudioOutput();
      await listOutputs();
      if (![...outputSelect.options].some((o) => o.value === device.deviceId)) {
        outputSelect.add(new Option(device.label, device.deviceId));
      }
      outputSelect.value = device.deviceId;
      await useOutput(device.deviceId);
      return;
    }
    // Chrome/Edge only reveal device names after a one-time microphone permission.
    let devices = await listOutputs();
    if (devices.every((d) => !d.label)) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      devices = await listOutputs();
    }
    setOutputStatus(devices.length
      ? `${devices.length} apparaat/apparaten gevonden. Kies je soundbar in de lijst.`
      : 'Geen apparaten gevonden. Is de soundbar gekoppeld en aangezet?');
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      setOutputStatus('Geen toestemming gekregen. De app speelt af via de standaard uitvoer.', true);
    } else {
      setOutputStatus(`Apparaten zoeken lukte niet: ${err.message}`, true);
    }
  }
}

async function useOutput(sinkId) {
  try {
    await ctx.setSinkId(sinkId);
    const name = outputSelect.selectedOptions[0]?.textContent;
    setOutputStatus(sinkId ? `Geluid gaat naar: ${name}` : 'Geluid gaat naar de standaard uitvoer van het systeem.');
    saveSettings();
  } catch (err) {
    setOutputStatus(`Overschakelen lukte niet: ${err.message}`, true);
  }
}

if (canChooseOutput) {
  $('#output-btn').addEventListener('click', findOutputs);
  outputSelect.addEventListener('change', () => useOutput(outputSelect.value));
  navigator.mediaDevices.addEventListener?.('devicechange', () => listOutputs().catch(() => {}));
  listOutputs()
    .then(() => { if (outputSelect.value) return useOutput(outputSelect.value); })
    .catch(() => {});
} else {
  outputSelect.disabled = true;
  $('#output-btn').hidden = true;
  setOutputStatus('Deze browser kan zelf geen uitvoer kiezen. Selecteer de soundbar als geluidsuitvoer in de instellingen van je toestel; de app gebruikt dan automatisch de soundbar.');
}

// ---------- Source: audio files ----------

const audio = $('#audio');
const fileInput = $('#file-input');
const playBtn = $('#play-btn');
const seek = $('#seek');
const playlistEl = $('#playlist');
const sourceStatus = $('#source-status');
const fileSource = ctx.createMediaElementSource(audio);
let tracks = [];
let trackIndex = -1;
let activeSource = null;

function setSourceStatus(text, isError = false) {
  sourceStatus.textContent = text;
  sourceStatus.classList.toggle('error', isError);
}

function useSource(node) {
  if (activeSource === node) return;
  activeSource?.disconnect();
  activeSource = node;
  node?.connect(preamp);
}

fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  if (!files.length) return;
  tracks.forEach((t) => URL.revokeObjectURL(t.url));
  tracks = files.map((file) => ({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file) }));
  renderPlaylist();
  loadTrack(0, true);
  fileInput.value = '';
});

function renderPlaylist() {
  playlistEl.replaceChildren(...tracks.map((t, i) => {
    const li = document.createElement('li');
    li.textContent = t.name;
    li.classList.toggle('current', i === trackIndex);
    li.addEventListener('click', () => loadTrack(i, true));
    return li;
  }));
}

function loadTrack(i, autoplay) {
  if (!tracks.length) return;
  trackIndex = (i + tracks.length) % tracks.length;
  audio.src = tracks[trackIndex].url;
  $('#track-name').textContent = tracks[trackIndex].name;
  playBtn.disabled = false;
  renderPlaylist();
  if (autoplay) play();
}

async function play() {
  stopCapture();
  useSource(fileSource);
  await ctx.resume();
  try {
    await audio.play();
    setSourceStatus('');
  } catch (err) {
    setSourceStatus(`Afspelen lukte niet: ${err.message}`, true);
  }
}

playBtn.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
$('#prev-btn').addEventListener('click', () => {
  if (audio.currentTime > 3) audio.currentTime = 0;
  else loadTrack(trackIndex - 1, !audio.paused);
});
$('#next-btn').addEventListener('click', () => loadTrack(trackIndex + 1, !audio.paused));
audio.addEventListener('ended', () => {
  if (trackIndex < tracks.length - 1) loadTrack(trackIndex + 1, true);
});
audio.addEventListener('play', () => { playBtn.textContent = 'Pauze'; });
audio.addEventListener('pause', () => { playBtn.textContent = 'Afspelen'; });
audio.addEventListener('loadedmetadata', () => {
  seek.max = audio.duration || 0;
  $('#dur-time').textContent = formatTime(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  if (!seeking) seek.value = audio.currentTime;
  $('#cur-time').textContent = formatTime(audio.currentTime);
});
audio.addEventListener('error', () => setSourceStatus('Dit bestand kan de browser niet afspelen.', true));

let seeking = false;
seek.addEventListener('input', () => { seeking = true; $('#cur-time').textContent = formatTime(+seek.value); });
seek.addEventListener('change', () => { audio.currentTime = +seek.value; seeking = false; });

function formatTime(s) {
  if (!Number.isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ---------- Source: another browser tab ----------

const captureBtn = $('#capture-btn');
const captureStop = $('#capture-stop');
let captureStream = null;
let captureSource = null;

if (!navigator.mediaDevices?.getDisplayMedia) {
  captureBtn.disabled = true;
  captureBtn.title = 'Niet beschikbaar in deze browser';
}

captureBtn.addEventListener('click', async () => {
  await ctx.resume();
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        // Mute the original tab so only the equalized sound is heard.
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    });
    stream.getVideoTracks().forEach((t) => t.stop());
    const [track] = stream.getAudioTracks();
    if (!track) {
      setSourceStatus('Er komt geen geluid mee. Kies een tabblad en zet "Tabblad-audio delen" aan.', true);
      return;
    }
    stopCapture();
    audio.pause();
    captureStream = stream;
    captureSource = ctx.createMediaStreamSource(stream);
    useSource(captureSource);
    track.addEventListener('ended', stopCapture);
    captureStop.hidden = false;
    setSourceStatus(`Geluid van "${track.label || 'tabblad'}" gaat nu door de equalizer.`);
  } catch (err) {
    if (err.name !== 'NotAllowedError') setSourceStatus(`Tabblad delen lukte niet: ${err.message}`, true);
  }
});

captureStop.addEventListener('click', () => {
  stopCapture();
  setSourceStatus('Gestopt met tabblad-audio.');
});

function stopCapture() {
  if (!captureStream) return;
  captureStream.getTracks().forEach((t) => t.stop());
  if (activeSource === captureSource) useSource(null);
  captureStream = null;
  captureSource = null;
  captureStop.hidden = true;
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', t === tab);
  });
  $('#source-file').hidden = tab.dataset.source !== 'file';
  $('#source-tab').hidden = tab.dataset.source !== 'tab';
}));

// ---------- Equalizer controls ----------

const bandsEl = $('#bands');
const presetSelect = $('#preset-select');
const deletePresetBtn = $('#delete-preset');
const preampEl = $('#preamp');
const volumeEl = $('#volume');
const eqOnEl = $('#eq-on');
const limiterOnEl = $('#limiter-on');

const bandInputs = FREQS.map((freq, i) => {
  const wrap = document.createElement('label');
  wrap.className = 'band';
  const out = document.createElement('output');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = -MAX_DB;
  input.max = MAX_DB;
  input.step = 0.5;
  input.setAttribute('aria-label', `${formatFreq(freq)}Hz`);
  const name = document.createElement('span');
  name.textContent = formatFreq(freq);
  wrap.append(out, input, name);
  bandsEl.append(wrap);
  input.addEventListener('input', () => {
    gains[i] = +input.value;
    out.textContent = formatDb(gains[i]);
    presetSelect.value = '';
    deletePresetBtn.hidden = true;
    applyGains();
    saveSettings();
  });
  input.addEventListener('dblclick', () => {
    input.value = 0;
    input.dispatchEvent(new Event('input'));
  });
  return { input, out };
});

function formatFreq(f) { return f >= 1000 ? `${f / 1000}k` : String(f); }
function formatDb(db) { return `${db > 0 ? '+' : ''}${db}`; }

function setGains(values) {
  gains = [...values];
  bandInputs.forEach(({ input, out }, i) => {
    input.value = gains[i];
    out.textContent = formatDb(gains[i]);
  });
  applyGains();
  saveSettings();
}

function renderPresets(selected) {
  presetSelect.replaceChildren(new Option('Eigen instelling', ''));
  const group = (label, presets, prefix) => {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const name of Object.keys(presets)) og.append(new Option(name, prefix + name));
    if (og.children.length) presetSelect.append(og);
  };
  group('Voorinstellingen', PRESETS, 'p:');
  group('Mijn instellingen', customPresets, 'c:');
  presetSelect.value = selected ?? matchPreset();
  deletePresetBtn.hidden = !presetSelect.value.startsWith('c:');
}

function matchPreset() {
  const same = (a) => a.every((v, i) => v === gains[i]);
  for (const [name, v] of Object.entries(customPresets)) if (same(v)) return `c:${name}`;
  for (const [name, v] of Object.entries(PRESETS)) if (same(v)) return `p:${name}`;
  return '';
}

presetSelect.addEventListener('change', () => {
  const [kind, name] = [presetSelect.value.slice(0, 2), presetSelect.value.slice(2)];
  const values = kind === 'p:' ? PRESETS[name] : customPresets[name];
  if (values) setGains(values);
  deletePresetBtn.hidden = kind !== 'c:';
});

$('#save-preset').addEventListener('click', () => {
  const name = prompt('Naam voor deze instelling:', 'Mijn soundbar')?.trim();
  if (!name) return;
  customPresets[name] = [...gains];
  saveSettings();
  renderPresets(`c:${name}`);
});

deletePresetBtn.addEventListener('click', () => {
  const name = presetSelect.value.slice(2);
  if (!confirm(`"${name}" verwijderen?`)) return;
  delete customPresets[name];
  saveSettings();
  renderPresets();
});

$('#reset-eq').addEventListener('click', () => {
  setGains(PRESETS['Vlak']);
  preampEl.value = 0;
  preampEl.dispatchEvent(new Event('input'));
  renderPresets();
});

preampEl.addEventListener('input', () => {
  $('#preamp-val').textContent = `${formatDb(+preampEl.value)} dB`;
  applyGains();
  saveSettings();
});

volumeEl.addEventListener('input', () => {
  const v = +volumeEl.value / 100;
  volume.gain.setTargetAtTime(v * v, ctx.currentTime, 0.02);
  $('#volume-val').textContent = `${volumeEl.value}%`;
  saveSettings();
});

eqOnEl.addEventListener('change', () => { applyGains(); saveSettings(); });
limiterOnEl.addEventListener('change', () => { routeTail(); saveSettings(); });

// ---------- Curve and spectrum ----------

const curve = $('#curve');
const cctx = curve.getContext('2d');
const POINTS = 200;
const curveFreqs = new Float32Array(POINTS).map((_, i) => 20 * 1000 ** (i / (POINTS - 1)));
const mag = new Float32Array(POINTS);
const phase = new Float32Array(POINTS);
const spectrum = new Uint8Array(analyser.frequencyBinCount);
const RANGE_DB = 15;
const probe = new BiquadFilterNode(ctx);
let response = new Float32Array(POINTS);

const xOf = (f, w) => (Math.log10(f / 20) / 3) * w;
const yOf = (db, h) => h / 2 - (db / RANGE_DB) * (h / 2 - 8);

function computeResponse() {
  // Use the target gains (not the smoothed AudioParams) so the curve updates instantly.
  const total = new Float32Array(POINTS).fill(eqOnEl.checked ? +preampEl.value : 0);
  filters.forEach((f, i) => {
    probe.type = f.type;
    probe.frequency.value = f.frequency.value;
    probe.Q.value = f.Q.value;
    probe.gain.value = eqOnEl.checked ? gains[i] : 0;
    probe.getFrequencyResponse(curveFreqs, mag, phase);
    for (let k = 0; k < POINTS; k++) total[k] += 20 * Math.log10(mag[k]);
  });
  response = total;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  curve.width = curve.clientWidth * dpr;
  curve.height = curve.clientHeight * dpr;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render() {
  const w = curve.clientWidth;
  const h = curve.clientHeight;
  const css = getComputedStyle(document.documentElement);
  cctx.clearRect(0, 0, w, h);

  // Grid
  cctx.strokeStyle = css.getPropertyValue('--grid');
  cctx.fillStyle = css.getPropertyValue('--muted');
  cctx.font = '11px system-ui, sans-serif';
  cctx.lineWidth = 1;
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const x = Math.round(xOf(f, w)) + 0.5;
    cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, h); cctx.stroke();
    cctx.fillText(formatFreq(f), x + 3, h - 4);
  }
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = Math.round(yOf(db, h)) + 0.5;
    cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(w, y); cctx.stroke();
    cctx.fillText(`${formatDb(db)} dB`, 4, y - 3);
  }

  // Spectrum of what is actually playing
  analyser.getByteFrequencyData(spectrum);
  const binHz = ctx.sampleRate / analyser.fftSize;
  cctx.fillStyle = css.getPropertyValue('--spectrum');
  cctx.beginPath();
  cctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) {
    const f = 20 * 1000 ** (x / w);
    const v = spectrum[Math.min(spectrum.length - 1, Math.round(f / binHz))] / 255;
    cctx.lineTo(x, h - v * h);
  }
  cctx.lineTo(w, h);
  cctx.fill();

  // Equalizer curve
  cctx.strokeStyle = css.getPropertyValue('--accent');
  cctx.lineWidth = 2.5;
  cctx.beginPath();
  for (let k = 0; k < POINTS; k++) {
    const x = xOf(curveFreqs[k], w);
    const y = yOf(Math.max(-RANGE_DB, Math.min(RANGE_DB, response[k])), h);
    k ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
  }
  cctx.stroke();

  requestAnimationFrame(render);
}

// ---------- Start ----------

preampEl.value = saved.preamp ?? 0;
volumeEl.value = saved.volume ?? 80;
eqOnEl.checked = saved.eqOn ?? true;
limiterOnEl.checked = saved.limiterOn ?? true;
$('#preamp-val').textContent = `${formatDb(+preampEl.value)} dB`;
$('#volume-val').textContent = `${volumeEl.value}%`;
volume.gain.value = (+volumeEl.value / 100) ** 2;

routeTail();
setGains(gains);
renderPresets();
resizeCanvas();
new ResizeObserver(resizeCanvas).observe(curve);
requestAnimationFrame(render);
