const DB_NAME = 'makaraHavzanProductImages';
const STORE = 'images';

const memory = new Map();
const rawById = new Map();
let dbPromise = null;
const waiters = [];
let running = 0;

function pump() {
  while (running < 2 && waiters.length) {
    const job = waiters.shift();
    running += 1;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    waiters.push({ task, resolve, reject });
    pump();
  });
}

function normalizeImage(image) {
  if (!image || typeof image !== 'string') return '';
  const trimmed = image.trim();
  if (
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.length > 80 && !/\s/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return '';
}

function signature(image) {
  const tail = image.slice(-32);
  return `${image.length}:${tail}`;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function idbGet(key) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      })
  ).catch(() => null);
}

function idbPut(key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      })
  ).catch(() => {});
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function remember(key, sig, blob) {
  const prev = memory.get(key);
  if (prev && prev.sig !== sig && prev.url.startsWith('blob:')) {
    URL.revokeObjectURL(prev.url);
  }
  const url = URL.createObjectURL(blob);
  memory.set(key, { sig, url });
  return url;
}

export function registerProductImage(productId, image) {
  if (productId == null) return;
  const normalized = normalizeImage(image);
  if (!normalized) return;
  rawById.set(String(productId), normalized);
}

export function getCachedProductImageUrl(productId) {
  const hit = memory.get(String(productId));
  if (hit?.url) return hit.url;
  const raw = rawById.get(String(productId));
  if (raw && !raw.startsWith('data:image')) return raw;
  return null;
}

export function resolveRegisteredProductImage(productId) {
  const raw = rawById.get(String(productId));
  if (!raw) return Promise.resolve(getCachedProductImageUrl(productId));
  return resolveProductImage(productId, raw);
}

export function displayProductImage(image) {
  const normalized = normalizeImage(image);
  return normalized || null;
}

export function peekProductImage(productId, image) {
  const normalized = normalizeImage(image);
  if (!normalized) return null;
  if (!normalized.startsWith('data:image')) return normalized;
  const hit = memory.get(String(productId));
  if (hit && hit.sig === signature(normalized)) return hit.url;
  return null;
}

export function resolveProductImage(productId, image) {
  const normalized = normalizeImage(image);
  if (!normalized) return Promise.resolve(null);
  if (!normalized.startsWith('data:image')) return Promise.resolve(normalized);
  image = normalized;

  const key = String(productId);
  const sig = signature(image);
  const hit = memory.get(key);
  if (hit && hit.sig === sig) return Promise.resolve(hit.url);

  return enqueue(async () => {
    const again = memory.get(key);
    if (again && again.sig === sig) return again.url;

    const stored = await idbGet(key);
    if (stored?.blob && stored.sig === sig) {
      return remember(key, sig, stored.blob);
    }

    const blob = dataUrlToBlob(image);
    if (!blob) return null;
    const url = remember(key, sig, blob);
    idbPut(key, { sig, blob });
    return url;
  });
}
