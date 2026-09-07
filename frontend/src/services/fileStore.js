/**
 * Minimal IndexedDB key-value store for the original/generated vendor
 * workbook files behind Admin's "Upload Vendor File" flow.
 *
 * Why not localStorage: it's string-only and capped around 5-10MB total,
 * which even one or two real vendor workbooks can exceed. IndexedDB
 * stores Blobs natively and has a much larger (browser-dependent, but
 * typically hundreds of MB+) quota.
 */

const DB_NAME = "thred-finder-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await fn(store);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}

/** @param {string} key @param {Blob} blob */
export async function putFile(key, blob) {
  await withStore("readwrite", (store) => runRequest(store.put(blob, key)));
}

/** @param {string} key @returns {Promise<Blob|null>} */
export async function getFile(key) {
  const result = await withStore("readonly", (store) => runRequest(store.get(key)));
  return result ?? null;
}

/** @param {string} key */
export async function deleteFile(key) {
  await withStore("readwrite", (store) => runRequest(store.delete(key)));
}
