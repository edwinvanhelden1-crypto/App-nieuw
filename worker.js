// Runs the AI models off the main thread so the UI stays responsive.
import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

env.allowLocalModels = false;

// Free, open models from the Hugging Face Hub, executed locally via ONNX/WASM.
const MODELS = {
  caption:    ['image-to-text', 'Xenova/vit-gpt2-image-captioning'],
  translate:  ['translation', 'Xenova/opus-mt-en-nl'],
  detect:     ['object-detection', 'Xenova/detr-resnet-50'],
  classify:   ['zero-shot-image-classification', 'Xenova/clip-vit-base-patch32'],
  background: ['background-removal', 'Xenova/modnet'],
};

const cache = new Map();

function load(name, id) {
  if (!cache.has(name)) {
    const [task, model] = MODELS[name];
    const promise = pipeline(task, model, {
      progress_callback: (p) => {
        if (p.status === 'progress') {
          self.postMessage({ id, type: 'progress', file: p.file, progress: p.progress });
        }
      },
    });
    // Allow a retry after a failed download.
    promise.catch(() => cache.delete(name));
    cache.set(name, promise);
  }
  return cache.get(name);
}

const TASKS = {
  async caption(image, id) {
    const captioner = await load('caption', id);
    const [{ generated_text }] = await captioner(image, { max_new_tokens: 30 });
    const english = generated_text.trim();
    let dutch = null;
    try {
      self.postMessage({ id, type: 'status', text: 'Vertalen naar Nederlands…' });
      const translator = await load('translate', id);
      const [{ translation_text }] = await translator(english);
      dutch = translation_text;
    } catch (err) {
      console.warn('Vertalen mislukt, Engelse beschrijving wordt getoond.', err);
    }
    return { english, dutch };
  },

  async detect(image, id) {
    const detector = await load('detect', id);
    return detector(image, { threshold: 0.8 });
  },

  async classify(image, id, labels) {
    const classifier = await load('classify', id);
    const output = await classifier(image, labels);
    return output.slice(0, 5);
  },

  async background(image, id) {
    const remover = await load('background', id);
    const [result] = await remover(image);
    const rgba = result.channels === 4 ? result : result.rgba();
    return { width: rgba.width, height: rgba.height, data: rgba.data };
  },
};

self.addEventListener('message', async ({ data }) => {
  const { id, task, blob, labels } = data;
  try {
    const image = await RawImage.fromBlob(blob);
    const result = await TASKS[task](image, id, labels);
    const transfer = result?.data?.buffer ? [result.data.buffer] : [];
    self.postMessage({ id, type: 'done', result }, transfer);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err?.message ?? String(err) });
  }
});
