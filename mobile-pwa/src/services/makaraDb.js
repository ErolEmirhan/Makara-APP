export const DB_NAME = 'makara-pwa';
export const DB_VERSION = 2;

export function openMakaraDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('product-images')) {
        db.createObjectStore('product-images');
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog');
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}
