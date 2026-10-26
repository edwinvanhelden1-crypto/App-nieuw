// Generates the AI illustration library of AR Tekenen with the free Pollinations
// image API. Already generated files are skipped, so the script can be run again
// to continue or to add new subjects to library-prompts.json.
//
//   cd tools && npm install sharp@0.33.5 && node generate-library.mjs
//
// Environment: POLLINATIONS_TOKEN (optional), COMMIT_EVERY=n to git-commit and
// push every n new images (used by the GitHub workflow), LIMIT=n to stop early.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, '..', 'ar-tekenen', 'library');
const spec = JSON.parse(await readFile(path.join(here, 'library-prompts.json'), 'utf8'));
const commitEvery = Number(process.env.COMMIT_EVERY || 0);
const limit = Number(process.env.LIMIT || Infinity);
const token = process.env.POLLINATIONS_TOKEN;

const exists = (f) => access(f).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function seedOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 1000000;
}

async function generate(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&model=flux&seed=${seed}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(120000),
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) {
        const body = (await res.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' ');
        throw new Error(`HTTP ${res.status} ${type} ${body}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`  poging ${attempt} mislukt: ${err.message}`);
      await sleep(attempt * 15000);
    }
  }
  return null;
}

function writeIndex() {
  return (async () => {
    const categories = [];
    let position = 0;
    for (const c of spec.categories) {
      const items = [];
      for (const it of c.items) {
        if (await exists(path.join(out, c.id, it.file))) items.push({ file: it.file, title: it.title, style: it.style });
      }
      if (items.length) categories.push({ id: c.id, name: c.name, position, items });
      position++;
    }
    await writeFile(path.join(out, 'index.json'), JSON.stringify({ categories }, null, 1) + '\n');
    return categories.reduce((n, c) => n + c.items.length, 0);
  })();
}

function commit(message) {
  execSync('git add ar-tekenen/library', { cwd: path.join(here, '..'), stdio: 'inherit' });
  try {
    execSync(`git commit -q -m "${message}"`, { cwd: path.join(here, '..'), stdio: 'inherit' });
  } catch {
    return; // nothing to commit
  }
  for (let i = 0; i < 4; i++) {
    try {
      execSync('git pull -q --rebase && git push -q', { cwd: path.join(here, '..'), stdio: 'inherit' });
      return;
    } catch {
      execSync(`sleep ${2 ** (i + 1)}`);
    }
  }
}

let made = 0, failed = 0, sinceCommit = 0, failedInRow = 0;
for (const c of spec.categories) {
  await mkdir(path.join(out, c.id), { recursive: true });
  if (failedInRow >= 5) break;
  for (const it of c.items) {
    if (made >= limit) break;
    const file = path.join(out, c.id, it.file);
    if (await exists(file)) continue;
    const prompt = `${it.prompt}, ${spec.styles[it.style]}`;
    console.log(`${c.id}/${it.file}`);
    const buf = await generate(prompt, seedOf(c.id + it.file));
    if (!buf) {
      failed++;
      if (++failedInRow >= 5) {
        console.error('Vijf afbeeldingen op rij mislukt; de dienst weigert waarschijnlijk. Gestopt.');
        break;
      }
      continue;
    }
    failedInRow = 0;
    // Cover the small service logo in the bottom-right corner with white.
    const meta = await sharp(buf).metadata();
    const mw = Math.round(meta.width * 0.3), mh = Math.round(meta.height * 0.07);
    const mask = Buffer.from(`<svg width="${mw}" height="${mh}"><rect width="100%" height="100%" fill="#fff"/></svg>`);
    const clean = await sharp(buf).composite([{ input: mask, left: meta.width - mw, top: meta.height - mh }]).toBuffer();
    await sharp(clean).resize(640, 640, { fit: 'inside' }).flatten({ background: '#ffffff' }).webp({ quality: 80 }).toFile(file);
    made++;
    sinceCommit++;
    if (commitEvery && sinceCommit >= commitEvery) {
      const total = await writeIndex();
      commit(`Tekeningenbibliotheek: ${total} afbeeldingen`);
      sinceCommit = 0;
    }
    await sleep(3000);
  }
}

const total = await writeIndex();
if (commitEvery) commit(`Tekeningenbibliotheek: ${total} afbeeldingen`);
console.log(`Klaar: ${made} nieuw, ${failed} mislukt, ${total} in totaal.`);
if (made === 0 && failed > 0) process.exit(1);
