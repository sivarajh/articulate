// Recordings live in IndexedDB (they are far too big for localStorage). Only the most
// recent ones are kept. Every function fails soft: audio is a nice-to-have.

const DB_NAME = 'articulate-audio';
const STORE = 'recordings';
const KEEP = 40;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
      }),
  );
}

export async function saveAudio(takeId: string, blob: Blob): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(blob, takeId));
  } catch {
    // storage full or blocked: the take is still saved without audio
  }
}

export async function loadAudio(takeId: string): Promise<Blob | null> {
  try {
    const blob = await run<Blob | undefined>('readonly', (store) => store.get(takeId) as IDBRequest<Blob | undefined>);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteAudio(takeId: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(takeId));
  } catch {
    // nothing to delete
  }
}

/** Drop recordings whose takes are gone, and all but the newest few. `takeIds` is newest first. */
export async function pruneAudio(takeIds: string[]): Promise<void> {
  try {
    const keep = new Set(takeIds.slice(0, KEEP));
    const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    for (const key of keys) if (!keep.has(String(key))) await deleteAudio(String(key));
  } catch {
    // best effort
  }
}

export async function clearAudio(): Promise<void> {
  try {
    await run('readwrite', (store) => store.clear());
  } catch {
    // best effort
  }
}
