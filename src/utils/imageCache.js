// IndexedDB ile görsel cache yönetimi
let imageCache = {};
let dbInstance = null;

// IndexedDB başlatma
export async function initImageCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('makaraDesktopImageCache', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      // Tüm cache'lenmiş resimleri yükle
      const transaction = dbInstance.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        for (const item of getAllRequest.result) {
          if (item.blob) {
            const blobUrl = URL.createObjectURL(item.blob);
            imageCache[item.url] = blobUrl;
          }
        }
        resolve();
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('images')) {
        const store = db.createObjectStore('images', { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Resmi cache'le ve blob URL oluştur
export async function getCachedImage(imageUrl) {
  if (!imageUrl) return null;
  
  // Zaten memory cache'de varsa direkt dön
  if (imageCache[imageUrl]) {
    return imageCache[imageUrl];
  }
  
  // IndexedDB'den kontrol et
  if (dbInstance) {
    try {
      const transaction = dbInstance.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const request = store.get(imageUrl);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          if (request.result && request.result.blob) {
            const blobUrl = URL.createObjectURL(request.result.blob);
            imageCache[imageUrl] = blobUrl;
            resolve(blobUrl);
          } else {
            // Cache'de yok, yükle ve kaydet
            loadAndCacheImage(imageUrl).then(resolve);
          }
        };
        
        request.onerror = () => {
          // Hata durumunda direkt yükle
          loadAndCacheImage(imageUrl).then(resolve);
        };
      });
    } catch (error) {
      console.error('Cache okuma hatası:', error);
      return loadAndCacheImage(imageUrl);
    }
  }
  
  // DB hazır değilse direkt yükle
  return loadAndCacheImage(imageUrl);
}

// Resmi yükle ve cache'le
async function loadAndCacheImage(imageUrl) {
  try {
    // Firebase Storage veya R2 URL'si ise proxy üzerinden yükle (CORS sorununu çözmek için)
    let fetchUrl = imageUrl;
    const isFirebaseStorage = imageUrl && imageUrl.includes('firebasestorage.googleapis.com');
    const isR2 = imageUrl && (imageUrl.includes('r2.dev') || imageUrl.includes('r2.cloudflarestorage.com'));
    
    // Firebase Storage ve R2 için her zaman proxy kullan (CORS ve SSL sorunlarını çözmek için)
    if (isFirebaseStorage || isR2) {
      const proxyUrl = `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      fetchUrl = proxyUrl;
    }
    
    // Resmi fetch et
    const response = await fetch(fetchUrl, { 
      mode: 'cors',
      cache: 'force-cache'
    });
    
    if (!response.ok) {
      throw new Error('Resim yüklenemedi');
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Memory cache'e ekle (orijinal URL ile)
    imageCache[imageUrl] = blobUrl;
    
    // IndexedDB'ye kaydet
    if (dbInstance) {
      try {
        const transaction = dbInstance.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await new Promise((resolve, reject) => {
          const request = store.put({ 
            url: imageUrl, 
            blob: blob, 
            timestamp: Date.now() 
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('Cache kaydetme hatası:', error);
      }
    }
    
    return blobUrl;
  } catch (error) {
    console.error('Resim yükleme hatası:', error);
    return null;
  }
}

// Cache'i temizle (opsiyonel)
export function clearImageCache() {
  imageCache = {};
  if (dbInstance) {
    const transaction = dbInstance.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.clear();
  }
}

