import { kawaiiAnimals, kawaiiThings, birds, handBirds, handAnimals, butterflies, fishes, sea } from './draw-animals.js';
import { animeChars, portraits, poses, anatomy, kids } from './draw-people.js';
import { music, food, vehicles, objects, basic } from './draw-things.js';
import {
  nature, flowers, architecture, oneLineArt, aesthetic, mandalas, patterns, geometric, letters, space, fantasy, holidays,
} from './draw-world.js';

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
  items: items.map((it, i) => ({ id: `${id}-${i}`, title: it.t, draw: it.d, cat: id })),
}));

const byId = new Map();
for (const c of categories) for (const it of c.items) byId.set(it.id, it);

export const getItem = (id) => byId.get(id);
export const getCategory = (id) => categories.find((c) => c.id === id);
export const totalCount = byId.size;
