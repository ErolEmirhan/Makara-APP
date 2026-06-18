import { openMakaraDb } from './makaraDb';

const STORE = 'catalog';

function catalogKey(branchKey) {
  return `catalog:${branchKey}`;
}

/** Ürün listesini önbelleğe yazarken imageRaw atılır (imageSrc kalır) */
function stripForCache(products) {
  return (products || []).map(({ imageRaw, ...rest }) => rest);
}

export async function getCatalogCache(branchKey) {
  if (!branchKey) return null;
  try {
    const db = await openMakaraDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(catalogKey(branchKey));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCatalogCache(branchKey, { categories, products }) {
  if (!branchKey) return;
  try {
    const db = await openMakaraDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        {
          categories: categories || [],
          products: stripForCache(products),
          cachedAt: Date.now(),
        },
        catalogKey(branchKey)
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* önbellek yazılamazsa uygulama çalışmaya devam eder */
  }
}

export async function clearCatalogCache(branchKey) {
  if (!branchKey) return;
  try {
    const db = await openMakaraDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(catalogKey(branchKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
