import { kawaiiAnimals, kawaiiThings, birds, handBirds, handAnimals, butterflies, fishes, sea } from './draw-animals.js';
import { animeChars, portraits, poses, anatomy, kids } from './draw-people.js';
import { music, food, vehicles, objects, basic } from './draw-things.js';
import {
  nature, flowers, architecture, oneLineArt, aesthetic, mandalas, patterns, geometric, letters, space, fantasy, holidays,
} from './draw-world.js';
import { scores, levels } from './difficulty.js';

// Easy drawings first, the most detailed last.
function byDifficulty(a, b) {
  return a.score - b.score;
}

// Categories in the order they appear on the "Teken objecten" screen.
const CATEGORIES = [
  ['anime', 'Anime', animeChars],
  ['cartoon', 'Cartoon', [...kids, ...kawaiiThings]],
  ['muziek', 'Muziek', music],
  ['dieren', 'Dieren', [...handAnimals, ...butterflies]],
  ['vogels', 'Vogels', [...handBirds, ...birds]],
  ['portret', 'Portret', portraits],
  ['aesthetic', 'Aesthetic', aesthetic],
  ['anatomie', 'Anatomie', anatomy],
  ['natuur', 'Natuur', nature],
  ['voorwerpen', 'Voorwerpen', objects],
  ['mensen', 'Mensen & poses', poses],
  ['architectuur', 'Architectuur', architecture],
  ['oneline', 'One Line', oneLineArt],
  ['eten', 'Eten & café', food],
  ['voertuigen', 'Voertuigen', vehicles],
  ['basis', 'Basis', basic],
  ['kawaii', 'Kawaii', kawaiiAnimals],
  ['bloemen', 'Bloemen & planten', flowers],
  ['zee', 'Zee & oceaan', [...fishes, ...sea]],
  ['mandala', "Mandala's", mandalas],
  ['patronen', 'Patronen', patterns],
  ['geometrie', 'Geometrie', geometric],
  ['letters', 'Letters & woorden', letters],
  ['ruimte', 'Ruimte', space],
  ['fantasie', 'Fantasie', fantasy],
  ['feestdagen', 'Feestdagen', holidays],
];

export const categories = CATEGORIES.map(([id, name, items]) => ({
  id,
  name,
  items: items
    .map((it, i) => ({ id: `${id}-${i}`, title: it.t, draw: it.d, cat: id, level: levels[`${id}-${i}`] || 2, score: scores[`${id}-${i}`] || 40 }))
    .sort(byDifficulty),
}));

const byId = new Map();
for (const c of categories) for (const it of c.items) byId.set(it.id, it);

// Illustrations made with AI (library/index.json, filled by tools/generate-library.mjs).
// They are put in front of the drawings of the same category.
const AI_LEVEL = { lijn: 1, oneline: 1, kleur: 2, retro: 2, anime: 3, schets: 3 };
const AI_SCORE = { lijn: 30, oneline: 20, kleur: 50, retro: 52, anime: 80, schets: 95 };

export async function loadLibrary() {
  let index;
  try {
    const res = await fetch('library/index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    index = await res.json();
  } catch {
    return;
  }
  for (const lc of index.categories || []) {
    let cat = categories.find((c) => c.id === lc.id);
    if (!cat) {
      cat = { id: lc.id, name: lc.name, items: [] };
      categories.splice(lc.position ?? categories.length, 0, cat);
    }
    const items = lc.items.map((it) => ({
      id: `${lc.id}-ai-${it.file}`,
      title: it.title,
      cat: lc.id,
      src: `library/${lc.id}/${it.file}`,
      process: it.style === 'kleur' || it.style === 'anime' || it.style === 'retro' ? 'origineel' : 'lijnen',
      level: AI_LEVEL[it.style] || 3,
      score: AI_SCORE[it.style] || 90,
    }));
    for (const it of items) byId.set(it.id, it);
    cat.items.push(...items);
    cat.items.sort(byDifficulty);
  }
}

export const getItem = (id) => byId.get(id);
export const getCategory = (id) => categories.find((c) => c.id === id);
export const totalCount = () => byId.size;
