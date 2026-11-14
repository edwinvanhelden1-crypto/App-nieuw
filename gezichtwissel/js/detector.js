// Gezichtsherkenning met MediaPipe Face Landmarker (gratis, draait lokaal in de browser).
import { initMesh, toPixels } from './mesh.js';

const VERSION = '0.10.14';
// In de Android-app zitten bibliotheek en model in de app zelf (werkt offline).
const NATIVE = !!globalThis.Capacitor?.isNativePlatform?.();
export const LIB_BASE = NATIVE
  ? new URL('../vendor/tasks-vision', import.meta.url).href
  : `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
export const MODEL_URL = NATIVE
  ? new URL('../models/face_landmarker.task', import.meta.url).href
  : 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let libPromise = null;
function lib() {
  libPromise ??= import(`${LIB_BASE}/vision_bundle.mjs`).then((m) => {
    initMesh(m.FaceLandmarker.FACE_LANDMARKS_TESSELATION);
    return m;
  });
  return libPromise;
}

async function create(runningMode, numFaces) {
  const m = await lib();
  const fileset = await m.FilesetResolver.forVisionTasks(`${LIB_BASE}/wasm`);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode,
    numFaces,
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
  try {
    return await m.FaceLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch (err) {
    console.warn('GPU niet beschikbaar, val terug op CPU', err);
    return m.FaceLandmarker.createFromOptions(fileset, opts('CPU'));
  }
}

let imageDet = null;
let videoDet = null;
let videoFaces = 0;
let lastTs = 0;

/** Zorgt dat het model geladen is (voor een laadmelding in de interface). */
export const ready = () => lib();

const MAX_DETECT = 1280;
/** Zoekt gezichten in een stilstaand beeld. Geeft per gezicht 478 punten in pixels van `w`×`h`. */
export async function detectImage(source, w, h) {
  imageDet ??= create('IMAGE', 8);
  const det = await imageDet;
  let input = source;
  const scale = Math.min(1, MAX_DETECT / Math.max(w, h));
  if (scale < 1) {
    input = document.createElement('canvas');
    input.width = Math.round(w * scale);
    input.height = Math.round(h * scale);
    input.getContext('2d').drawImage(source, 0, 0, input.width, input.height);
  }
  const res = det.detect(input);
  return res.faceLandmarks.map((lm) => toPixels(lm, w, h));
}

/** Zoekt gezichten in een videoframe (snel, met tracking tussen frames). */
export async function videoDetector(numFaces) {
  if (!videoDet) videoDet = create('VIDEO', numFaces), videoFaces = numFaces;
  const det = await videoDet;
  if (numFaces !== videoFaces) {
    videoFaces = numFaces;
    await det.setOptions({ numFaces });
  }
  return (video, w, h) => {
    // Tijdstempels moeten altijd oplopen, ook na terugspoelen.
    const ts = Math.max(performance.now(), lastTs + 1);
    lastTs = ts;
    const res = det.detectForVideo(video, ts);
    return res.faceLandmarks.map((lm) => toPixels(lm, w, h));
  };
}
