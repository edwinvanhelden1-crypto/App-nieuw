// Kleine IndexedDB-opslag voor gezichten en sjablonen. Alles blijft op het apparaat.
const DB_NAME = 'gezichtwissel';
const VERSION = 1;
let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('faces')) db.createObjectStore('faces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const store = {
  async all(name) {
    const items = await tx(name, 'readonly', (s) => s.getAll());
    return (items || []).sort((a, b) => b.created - a.created);
  },
  put: (name, item) => tx(name, 'readwrite', (s) => s.put(item)),
  delete: (name, id) => tx(name, 'readwrite', (s) => s.delete(id)),
};
