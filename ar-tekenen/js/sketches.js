// Photos of the user's own drawings, kept in IndexedDB on this device.

let dbPromise = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('ar-tekenen', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('schetsen', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('schetsen', mode);
    const req = fn(tx.objectStore('schetsen'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const add = (blob) => run('readwrite', (s) => s.add({ blob, date: Date.now() }));
export const remove = (id) => run('readwrite', (s) => s.delete(id));
export async function all() {
  try {
    const list = await run('readonly', (s) => s.getAll());
    return (list || []).sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}
