// Kopieert de web-app naar www/ en zet het AI-model en de MediaPipe-bestanden erbij,
// zodat de Android-app volledig offline werkt.
import { cp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const www = join(here, 'www');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelCache = join(here, '.cache', 'face_landmarker.task');

await rm(www, { recursive: true, force: true });
await cp(join(here, '..', 'gezichtwissel'), www, { recursive: true });
await rm(join(www, 'sw.js'), { force: true });
await rm(join(www, 'README.md'), { force: true });

const lib = join(here, 'node_modules', '@mediapipe', 'tasks-vision');
await mkdir(join(www, 'vendor', 'tasks-vision'), { recursive: true });
await cp(join(lib, 'vision_bundle.mjs'), join(www, 'vendor', 'tasks-vision', 'vision_bundle.mjs'));
await cp(join(lib, 'wasm'), join(www, 'vendor', 'tasks-vision', 'wasm'), { recursive: true });

try {
  await access(modelCache);
} catch {
  console.log('AI-model downloaden…');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model downloaden mislukt: ${res.status}`);
  await mkdir(dirname(modelCache), { recursive: true });
  await writeFile(modelCache, Buffer.from(await res.arrayBuffer()));
}
await mkdir(join(www, 'models'), { recursive: true });
await cp(modelCache, join(www, 'models', 'face_landmarker.task'));
console.log('www/ klaar');
