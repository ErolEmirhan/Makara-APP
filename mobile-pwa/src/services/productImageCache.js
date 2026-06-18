import { openMakaraDb } from './makaraDb';

const STORE = 'product-images';

function cacheKey(branchKey, productId) {
  return `${branchKey}:${productId}`;
}

function openDb() {
  return openMakaraDb();
}

function batchGet(db, keys) {
  return new Promise((resolve, reject) => {
    const map = new Map();
    if (!keys.length) {
      resolve(map);
      return;
    }
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    let pending = keys.length;
    keys.forEach((key) => {
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) map.set(key, req.result);
        pending -= 1;
        if (pending === 0) resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

function batchPut(db, entries) {
  return new Promise((resolve, reject) => {
    if (!entries.length) {
      resolve();
      return;
    }
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    entries.forEach(({ key, entry }) => store.put(entry, key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function imageFingerprint(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return `${raw.length}:${raw.slice(0, 48)}:${raw.slice(-48)}`;
}

/** Firestore görsel alanı: image_base64, image (data URL), http URL veya ham base64 */
export function normalizeProductImage(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.length > 80) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return null;
}

/**
 * Ürün görsellerini IndexedDB'den okur; Firestore'daki base64 değiştiyse günceller.
 */
export async function resolveProductImages(branchKey, products) {
  if (!branchKey || !products?.length) return products || [];

  let db;
  try {
    db = await openDb();
  } catch {
    return products.map((p) => ({
      ...p,
      imageSrc: normalizeProductImage(p.imageRaw),
    }));
  }

  const keys = products.map((p) => cacheKey(branchKey, p.id));
  let cachedMap;
  try {
    cachedMap = await batchGet(db, keys);
  } catch {
    cachedMap = new Map();
  }

  const toWrite = [];
  const resolved = products.map((product, idx) => {
    const key = keys[idx];
    const raw = product.imageRaw;
    const fp = imageFingerprint(raw);
    const cached = cachedMap.get(key);

    if (cached?.dataUrl && cached.fingerprint === fp) {
      const { imageRaw, ...rest } = product;
      return { ...rest, imageSrc: cached.dataUrl };
    }

    const dataUrl = normalizeProductImage(raw);
    if (dataUrl && fp) {
      toWrite.push({
        key,
        entry: { dataUrl, fingerprint: fp, cachedAt: Date.now() },
      });
    }

    const { imageRaw, ...rest } = product;
    return { ...rest, imageSrc: dataUrl };
  });

  if (toWrite.length) {
    try {
      await batchPut(db, toWrite);
    } catch {
      /* önbellek yazılamazsa görüntü yine gösterilir */
    }
  }

  return resolved;
}

export async function clearProductImageCache(branchKey) {
  try {
    const db = await openDb();
    const prefix = `${branchKey}:`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
