const { app, BrowserWindow, ipcMain, Menu, dialog, webContents } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const os = require('os');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Firebase entegrasyonu
let firebaseApp = null;
let firestore = null;
let storage = null;
let firebaseCollection = null;
let firebaseAddDoc = null;
let firebaseServerTimestamp = null;
let firebaseGetDocs = null;
let firebaseDeleteDoc = null;
let firebaseDoc = null;
let firebaseSetDoc = null;
let firebaseOnSnapshot = null;
let firebaseWhere = null;
let firebaseQuery = null;
let storageRef = null;
let storageUploadBytes = null;
let storageGetDownloadURL = null;
let storageDeleteObject = null;

// Cloudflare R2 entegrasyonu
const R2_CONFIG = {
  accountId: 'e33cde4cf4906c2179b978f47a24bc2e',
  bucketName: 'makara',
  accessKeyId: '9ed5b5b10661aee16cb19588379afe42',
  secretAccessKey: '37caee60d81510e4f8bdec63cb857fd1832e1c88069d352dd110d5300f2b9c7d',
  endpoint: 'https://e33cde4cf4906c2179b978f47a24bc2e.r2.cloudflarestorage.com',
  publicSubdomainId: 'pub-25a516669a2e4f49b458356009f7fb83', // R2.dev public subdomain ID
  publicUrl: null // R2 public domain (eğer varsa) veya custom domain - null ise R2.dev subdomain kullanılır
};

// R2 S3 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

// Ana Firebase (satışlar, ürünler, kategoriler için)
try {
  // Firebase modüllerini dinamik olarak yükle
  const firebaseAppModule = require('firebase/app');
  const firebaseFirestoreModule = require('firebase/firestore');
  const firebaseStorageModule = require('firebase/storage');
  
  const firebaseConfig = {
    apiKey: "AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA",
    authDomain: "makara-16344.firebaseapp.com",
    projectId: "makara-16344",
    storageBucket: "makara-16344.firebasestorage.app",
    messagingSenderId: "216769654742",
    appId: "1:216769654742:web:16792742d4613f4269be77",
    measurementId: "G-K4XZHP11MM"
  };

  firebaseApp = firebaseAppModule.initializeApp(firebaseConfig);
  firestore = firebaseFirestoreModule.getFirestore(firebaseApp);
  storage = firebaseStorageModule.getStorage(firebaseApp);
  firebaseCollection = firebaseFirestoreModule.collection;
  firebaseAddDoc = firebaseFirestoreModule.addDoc;
  firebaseServerTimestamp = firebaseFirestoreModule.serverTimestamp;
  firebaseGetDocs = firebaseFirestoreModule.getDocs;
  firebaseDeleteDoc = firebaseFirestoreModule.deleteDoc;
  firebaseDoc = firebaseFirestoreModule.doc;
  firebaseSetDoc = firebaseFirestoreModule.setDoc;
  firebaseOnSnapshot = firebaseFirestoreModule.onSnapshot;
  firebaseWhere = firebaseFirestoreModule.where;
  firebaseQuery = firebaseFirestoreModule.query;
  storageRef = firebaseStorageModule.ref;
  storageUploadBytes = firebaseStorageModule.uploadBytes;
  storageGetDownloadURL = firebaseStorageModule.getDownloadURL;
  storageDeleteObject = firebaseStorageModule.deleteObject;
  console.log('✅ Ana Firebase başarıyla başlatıldı (Firestore + Storage)');
} catch (error) {
  console.error('❌ Ana Firebase başlatılamadı:', error);
  console.log('Firebase olmadan devam ediliyor...');
}

// Masalar için ayrı Firebase (makaramasalar)
let tablesFirebaseApp = null;
let tablesFirestore = null;
let tablesFirebaseCollection = null;
let tablesFirebaseDoc = null;
let tablesFirebaseSetDoc = null;

try {
  const firebaseAppModule = require('firebase/app');
  const firebaseFirestoreModule = require('firebase/firestore');
  
  const tablesFirebaseConfig = {
    apiKey: "AIzaSyDu_NUrgas4wZ_wdfAYE-DgxqTpb7vKxyo",
    authDomain: "makaramasalar.firebaseapp.com",
    projectId: "makaramasalar",
    storageBucket: "makaramasalar.firebasestorage.app",
    messagingSenderId: "840151572206",
    appId: "1:840151572206:web:0afaf93deea636309e5dff",
    measurementId: "G-2S0J3566ZY"
  };

  tablesFirebaseApp = firebaseAppModule.initializeApp(tablesFirebaseConfig, 'tables');
  tablesFirestore = firebaseFirestoreModule.getFirestore(tablesFirebaseApp);
  tablesFirebaseCollection = firebaseFirestoreModule.collection;
  tablesFirebaseDoc = firebaseFirestoreModule.doc;
  tablesFirebaseSetDoc = firebaseFirestoreModule.setDoc;
  console.log('✅ Masalar Firebase başarıyla başlatıldı (makaramasalar)');
} catch (error) {
  console.error('❌ Masalar Firebase başlatılamadı:', error);
  console.log('Masalar Firebase olmadan devam ediliyor...');
}

let mainWindow;
let dbPath;
let apiServer = null;
let io = null;
let serverPort = 3000;

// Saat formatı helper fonksiyonu (saat:dakika:saniye)
function getFormattedTime(date = new Date()) {
  return date.toLocaleTimeString('tr-TR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}
let db = {
  categories: [],
  products: [],
  sales: [],
  saleItems: [],
  tableOrders: [],
  tableOrderItems: [],
  settings: {
    adminPin: '1234',
    cashierPrinter: null // { printerName, printerType } - Kasa yazıcısı ayarı
  },
  printerAssignments: [] // { printerName, printerType, category_id }
};

function initDatabase() {
  dbPath = path.join(app.getPath('userData'), 'makara-db.json');
  
  // Veritabanını yükle veya yeni oluştur
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
      
      // Eğer settings objesi yoksa ekle
      if (!db.settings) {
        db.settings = { adminPin: '1234', cashierPrinter: null };
        saveDatabase();
      }
      // cashierPrinter yoksa ekle
      if (db.settings && db.settings.cashierPrinter === undefined) {
        db.settings.cashierPrinter = null;
        saveDatabase();
      }
      
      // Eksik diğer alanları kontrol et
      if (!db.categories) db.categories = [];
      if (!db.products) db.products = [];
      if (!db.sales) db.sales = [];
      if (!db.saleItems) db.saleItems = [];
      if (!db.tableOrders) db.tableOrders = [];
      if (!db.tableOrderItems) db.tableOrderItems = [];
      if (!db.printerAssignments) db.printerAssignments = [];
    } catch (error) {
      console.error('Veritabanı yüklenemedi, yeni oluşturuluyor:', error);
      initDefaultData();
    }
  } else {
    initDefaultData();
  }
}

function initDefaultData() {
  // Örnek kategoriler
  db.categories = [
    { id: 1, name: 'Kruvasan Çeşitleri', order_index: 0 },
    { id: 2, name: 'Prag Tatlısı', order_index: 1 },
    { id: 3, name: 'Paris Tatlıları', order_index: 2 },
    { id: 4, name: 'Kahvaltılar', order_index: 3 },
    { id: 5, name: 'Sıcak İçecekler', order_index: 4 },
    { id: 6, name: 'Soğuk İçecekler', order_index: 5 }
  ];

  // Örnek ürünler
  db.products = [
    // Kruvasan Çeşitleri
    { id: 1, name: 'Sade Kruvasan', category_id: 1, price: 35.00 },
    { id: 2, name: 'Çikolatalı Kruvasan', category_id: 1, price: 40.00 },
    { id: 3, name: 'Peynirli Kruvasan', category_id: 1, price: 45.00 },
    { id: 4, name: 'Kaymaklı Kruvasan', category_id: 1, price: 42.00 },
    
    // Prag Tatlısı
    { id: 5, name: 'Klasik Prag', category_id: 2, price: 55.00 },
    { id: 6, name: 'Çilekli Prag', category_id: 2, price: 60.00 },
    { id: 7, name: 'Frambuazlı Prag', category_id: 2, price: 60.00 },
    
    // Paris Tatlıları
    { id: 8, name: 'Ekler', category_id: 3, price: 38.00 },
    { id: 9, name: 'Macaron', category_id: 3, price: 25.00 },
    { id: 10, name: 'Millefeuille', category_id: 3, price: 65.00 },
    
    // Kahvaltılar
    { id: 11, name: 'Serpme Kahvaltı', category_id: 4, price: 180.00 },
    { id: 12, name: 'Kahvaltı Tabağı', category_id: 4, price: 120.00 },
    { id: 13, name: 'Menemen', category_id: 4, price: 75.00 },
    
    // Sıcak İçecekler
    { id: 14, name: 'Türk Kahvesi', category_id: 5, price: 30.00 },
    { id: 15, name: 'Filtre Kahve', category_id: 5, price: 35.00 },
    { id: 16, name: 'Cappuccino', category_id: 5, price: 45.00 },
    { id: 17, name: 'Latte', category_id: 5, price: 45.00 },
    { id: 18, name: 'Çay', category_id: 5, price: 15.00 },
    
    // Soğuk İçecekler
    { id: 19, name: 'Ice Latte', category_id: 6, price: 50.00 },
    { id: 20, name: 'Limonata', category_id: 6, price: 35.00 },
    { id: 21, name: 'Soda', category_id: 6, price: 20.00 },
    { id: 22, name: 'Ayran', category_id: 6, price: 15.00 }
  ];

  db.sales = [];
  db.saleItems = [];
  db.tableOrders = [];
  db.tableOrderItems = [];
  db.settings = {
    adminPin: '1234'
  };
  
  saveDatabase();
}

function saveDatabase() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Veritabanı kaydedilemedi:', error);
  }
}

// Firebase'e kategori kaydetme fonksiyonu
async function saveCategoryToFirebase(category) {
  if (!firestore || !firebaseCollection || !firebaseDoc || !firebaseSetDoc) {
    return;
  }
  
  try {
    const categoryRef = firebaseDoc(firestore, 'categories', category.id.toString());
    await firebaseSetDoc(categoryRef, {
      id: category.id,
      name: category.name,
      order_index: category.order_index || 0
    }, { merge: true });
    console.log(`✅ Kategori Firebase'e kaydedildi: ${category.name} (ID: ${category.id})`);
  } catch (error) {
    console.error(`❌ Kategori Firebase'e kaydedilemedi (${category.name}):`, error);
  }
}

// Firebase'e ürün kaydetme fonksiyonu
async function saveProductToFirebase(product) {
  if (!firestore || !firebaseCollection || !firebaseDoc || !firebaseSetDoc) {
    return;
  }
  
  try {
    const productRef = firebaseDoc(firestore, 'products', product.id.toString());
    await firebaseSetDoc(productRef, {
      id: product.id,
      name: product.name,
      category_id: product.category_id,
      price: parseFloat(product.price) || 0,
      image: product.image || null
    }, { merge: true });
    console.log(`✅ Ürün Firebase'e kaydedildi: ${product.name} (ID: ${product.id}, Fiyat: ${parseFloat(product.price) || 0})`);
  } catch (error) {
    console.error(`❌ Ürün Firebase'e kaydedilemedi (${product.name}):`, error);
  }
}

// Firebase'e (makaramasalar) ürün stok bilgisini kaydetme fonksiyonu
async function saveProductStockToFirebase(productId, stock) {
  if (!tablesFirestore || !tablesFirebaseDoc || !tablesFirebaseSetDoc) {
    return;
  }
  
  try {
    const stockRef = tablesFirebaseDoc(tablesFirestore, 'product_stocks', productId.toString());
    await tablesFirebaseSetDoc(stockRef, {
      product_id: productId,
      stock: stock || 0,
      updated_at: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ Ürün stoku Firebase'e kaydedildi: Product ID: ${productId}, Stok: ${stock || 0}`);
  } catch (error) {
    console.error(`❌ Ürün stoku Firebase'e kaydedilemedi (Product ID: ${productId}):`, error);
  }
}

// Firebase'den (makaramasalar) ürün stok bilgisini çekme fonksiyonu
async function getProductStockFromFirebase(productId) {
  if (!tablesFirestore || !tablesFirebaseDoc) {
    return null;
  }
  
  try {
    const firebaseFirestoreModule = require('firebase/firestore');
    const firebaseGetDoc = firebaseFirestoreModule.getDoc;
    
    const stockRef = tablesFirebaseDoc(tablesFirestore, 'product_stocks', productId.toString());
    const stockDoc = await firebaseGetDoc(stockRef);
    
    if (stockDoc.exists()) {
      const data = stockDoc.data();
      return data.stock || 0;
    }
    return null;
  } catch (error) {
    console.error(`❌ Ürün stoku Firebase'den çekilemedi (Product ID: ${productId}):`, error);
    return null;
  }
}

// Ürün stokunu düşürme fonksiyonu
async function decreaseProductStock(productId, quantity) {
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const productIndex = db.products.findIndex(p => p.id === productIdNum);
  if (productIndex === -1) {
    console.warn(`⚠️ Ürün bulunamadı (stok düşürme): Product ID: ${productIdNum}`);
    return false;
  }
  
  const product = db.products[productIndex];
  
  // Stok takibi yapılmıyorsa, stok düşürme işlemi yapma
  if (!product.trackStock) {
    console.log(`ℹ️ Stok takibi yapılmayan ürün: ${product.name} - Stok düşürülmedi`);
    return true; // Hata değil, sadece stok takibi yapılmıyor
  }
  
  // Stok bilgisini al (local veya Firebase'den)
  let currentStock = product.stock !== undefined ? (product.stock || 0) : null;
  if (currentStock === null) {
    currentStock = await getProductStockFromFirebase(productIdNum);
    if (currentStock === null) {
      currentStock = 0;
    }
  }
  
  // Stok yeterli mi kontrol et
  if (currentStock < quantity) {
    console.warn(`⚠️ Yetersiz stok: ${product.name} (Mevcut: ${currentStock}, İstenen: ${quantity})`);
    return false;
  }
  
  // Stoku düşür
  const newStock = Math.max(0, currentStock - quantity);
  
  // Local database'i güncelle
  db.products[productIndex] = {
    ...product,
    stock: newStock
  };
  
  saveDatabase();
  
  // Firebase'e kaydet
  await saveProductStockToFirebase(productIdNum, newStock);
  
  console.log(`✅ Stok düşürüldü: ${product.name} (${currentStock} → ${newStock}, -${quantity})`);
  
  // Mobil personel arayüzüne gerçek zamanlı stok güncellemesi gönder
  if (io) {
    io.emit('product-stock-update', {
      productId: productIdNum,
      stock: newStock,
      trackStock: product.trackStock
    });
  }
  
  return true;
}

// Ürün stokunu artırma fonksiyonu (iptal durumunda)
async function increaseProductStock(productId, quantity) {
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const productIndex = db.products.findIndex(p => p.id === productIdNum);
  if (productIndex === -1) {
    console.warn(`⚠️ Ürün bulunamadı (stok artırma): Product ID: ${productIdNum}`);
    return false;
  }
  
  const product = db.products[productIndex];
  
  // Stok takibi yapılmıyorsa, stok artırma işlemi yapma
  if (!product.trackStock) {
    console.log(`ℹ️ Stok takibi yapılmayan ürün: ${product.name} - Stok artırılmadı`);
    return true; // Hata değil, sadece stok takibi yapılmıyor
  }
  
  // Stok bilgisini al (local veya Firebase'den)
  let currentStock = product.stock !== undefined ? (product.stock || 0) : 0;
  if (currentStock === 0 && product.stock === undefined) {
    const firebaseStock = await getProductStockFromFirebase(productIdNum);
    if (firebaseStock !== null) {
      currentStock = firebaseStock;
    }
  }
  
  // Stoku artır
  const newStock = currentStock + quantity;
  
  // Local database'i güncelle
  db.products[productIndex] = {
    ...product,
    stock: newStock
  };
  
  saveDatabase();
  
  // Firebase'e kaydet
  await saveProductStockToFirebase(productIdNum, newStock);
  
  console.log(`✅ Stok artırıldı: ${product.name} (${currentStock} → ${newStock}, +${quantity})`);
  
  // Mobil personel arayüzüne gerçek zamanlı stok güncellemesi gönder
  if (io) {
    io.emit('product-stock-update', {
      productId: productIdNum,
      stock: newStock,
      trackStock: product.trackStock
    });
  }
  
  return true;
}

// Local path'leri Firebase Storage'a yükleme (migration)
async function migrateLocalImagesToFirebase() {
  if (!storage || !storageRef || !storageUploadBytes || !storageGetDownloadURL) {
    console.warn('⚠️ Firebase Storage başlatılamadı, görsel migration yapılamadı');
    return;
  }

  try {
    console.log('🔄 Local görseller Firebase Storage\'a yükleniyor...');
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of db.products) {
      // Eğer görsel yoksa veya zaten Firebase Storage URL'si ise atla
      if (!product.image) {
        skippedCount++;
        continue;
      }

      // Firebase Storage veya R2 URL kontrolü
      if (product.image.includes('firebasestorage.googleapis.com') || 
          product.image.includes('r2.cloudflarestorage.com') || 
          product.image.includes('r2.dev')) {
        skippedCount++;
        continue;
      }

      // Local path kontrolü (örn: /image.jpg veya C:\... veya relative path)
      let imagePath = product.image;
      
      // Eğer absolute path değilse (relative path), public klasöründen al
      // Windows: C:\ veya \\ ile başlıyorsa absolute
      // Unix: / ile başlıyorsa absolute
      const isAbsolutePath = path.isAbsolute(imagePath) || 
                            imagePath.startsWith('http://') || 
                            imagePath.startsWith('https://');
      
      if (!isAbsolutePath) {
        // Relative path ise public klasöründen al
        if (imagePath.startsWith('/')) {
          const publicDir = path.join(__dirname, '../public');
          imagePath = path.join(publicDir, imagePath.substring(1));
        } else {
          // Sadece dosya adı ise
          const publicDir = path.join(__dirname, '../public');
          imagePath = path.join(publicDir, imagePath);
        }
      }

      // Dosya var mı kontrol et
      if (!fs.existsSync(imagePath)) {
        console.warn(`⚠️ Görsel bulunamadı: ${imagePath} (Ürün: ${product.name})`);
        // Görseli temizle
        product.image = null;
        errorCount++;
        continue;
      }

      try {
        // Firebase Storage'a yükle
        const downloadURL = await uploadImageToR2(imagePath, product.id);
        
        // Ürünü güncelle
        product.image = downloadURL;
        migratedCount++;
        console.log(`✅ Görsel yüklendi: ${product.name} -> ${downloadURL}`);
      } catch (uploadError) {
        console.error(`❌ Görsel yüklenemedi (${product.name}):`, uploadError);
        errorCount++;
        // Hata olsa bile devam et
      }
    }

    // Veritabanını kaydet
    if (migratedCount > 0) {
      saveDatabase();
      
      // Firebase'e de güncelle
      for (const product of db.products) {
        if (product.image && (product.image.includes('firebasestorage.googleapis.com') || product.image.includes('r2.cloudflarestorage.com') || product.image.includes('r2.dev'))) {
          await saveProductToFirebase(product);
        }
      }
    }

    console.log(`✅ Görsel migration tamamlandı: ${migratedCount} yüklendi, ${skippedCount} atlandı, ${errorCount} hata`);
  } catch (error) {
    console.error('❌ Görsel migration hatası:', error);
  }
}

// NOT: syncCategoriesToFirebase ve syncProductsToFirebase fonksiyonları kaldırıldı
// Artık sadece yeni ekleme/güncelleme/silme işlemlerinde Firebase'e yazma yapılıyor
// Bu sayede gereksiz read/write maliyetleri önleniyor

// Firebase'den kategorileri çek ve local database'e senkronize et
async function syncCategoriesFromFirebase() {
  if (!firestore || !firebaseCollection || !firebaseGetDocs) {
    console.warn('⚠️ Firebase başlatılamadı, kategoriler çekilemedi');
    return;
  }
  
  try {
    console.log('📥 Firebase\'den kategoriler çekiliyor...');
    const categoriesRef = firebaseCollection(firestore, 'categories');
    const snapshot = await firebaseGetDocs(categoriesRef);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    snapshot.forEach((doc) => {
      const firebaseCategory = doc.data();
      const categoryId = typeof firebaseCategory.id === 'string' ? parseInt(firebaseCategory.id) : firebaseCategory.id;
      
      // Local database'de bu kategori var mı kontrol et
      const existingCategoryIndex = db.categories.findIndex(c => c.id === categoryId);
      
      if (existingCategoryIndex !== -1) {
        // Kategori mevcut, güncelle
        db.categories[existingCategoryIndex] = {
          id: categoryId,
          name: firebaseCategory.name || '',
          order_index: firebaseCategory.order_index || 0
        };
        updatedCount++;
      } else {
        // Yeni kategori, ekle
        db.categories.push({
          id: categoryId,
          name: firebaseCategory.name || '',
          order_index: firebaseCategory.order_index || 0
        });
        addedCount++;
      }
    });
    
    // ID'leri sırala ve order_index'e göre sırala
    db.categories.sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index;
      }
      return a.id - b.id;
    });
    
    saveDatabase();
    console.log(`✅ Firebase'den ${snapshot.size} kategori çekildi (${addedCount} yeni, ${updatedCount} güncellendi)`);
  } catch (error) {
    console.error('❌ Firebase\'den kategori çekme hatası:', error);
  }
}

// Firebase'den ürünleri çek ve local database'e senkronize et
async function syncProductsFromFirebase() {
  if (!firestore || !firebaseCollection || !firebaseGetDocs) {
    console.warn('⚠️ Firebase başlatılamadı, ürünler çekilemedi');
    return;
  }
  
  try {
    console.log('📥 Firebase\'den ürünler çekiliyor...');
    const productsRef = firebaseCollection(firestore, 'products');
    const snapshot = await firebaseGetDocs(productsRef);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    snapshot.forEach((doc) => {
      const firebaseProduct = doc.data();
      const productId = typeof firebaseProduct.id === 'string' ? parseInt(firebaseProduct.id) : firebaseProduct.id;
      
      // Local database'de bu ürün var mı kontrol et
      const existingProductIndex = db.products.findIndex(p => p.id === productId);
      
      if (existingProductIndex !== -1) {
        // Ürün mevcut, güncelle
        db.products[existingProductIndex] = {
          id: productId,
          name: firebaseProduct.name || '',
          category_id: typeof firebaseProduct.category_id === 'string' ? parseInt(firebaseProduct.category_id) : firebaseProduct.category_id,
          price: parseFloat(firebaseProduct.price) || 0,
          image: firebaseProduct.image || null
        };
        updatedCount++;
      } else {
        // Yeni ürün, ekle
        db.products.push({
          id: productId,
          name: firebaseProduct.name || '',
          category_id: typeof firebaseProduct.category_id === 'string' ? parseInt(firebaseProduct.category_id) : firebaseProduct.category_id,
          price: parseFloat(firebaseProduct.price) || 0,
          image: firebaseProduct.image || null
        });
        addedCount++;
      }
    });
    
    saveDatabase();
    console.log(`✅ Firebase'den ${snapshot.size} ürün çekildi (${addedCount} yeni, ${updatedCount} güncellendi)`);
  } catch (error) {
    console.error('❌ Firebase\'den ürün çekme hatası:', error);
  }
}

// Firebase'den gerçek zamanlı kategori dinleme
let isCategoriesListenerInitialized = false;
function setupCategoriesRealtimeListener() {
  if (!firestore || !firebaseCollection || !firebaseOnSnapshot) {
    console.warn('⚠️ Firebase başlatılamadı, kategori listener kurulamadı');
    return null;
  }
  
  try {
    console.log('👂 Kategoriler için gerçek zamanlı listener başlatılıyor...');
    const categoriesRef = firebaseCollection(firestore, 'categories');
    
    const unsubscribe = firebaseOnSnapshot(categoriesRef, (snapshot) => {
      // İlk yüklemede tüm dokümanlar "added" olarak gelir - bunları sessizce işle
      const isInitialLoad = !isCategoriesListenerInitialized;
      if (isInitialLoad) {
        isCategoriesListenerInitialized = true;
        console.log('📥 İlk kategori yüklemesi tamamlandı (sessiz mod)');
        // İlk yüklemede sadece renderer'a bildir, her kategori için log yazma
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('categories-updated', db.categories);
        }
        return;
      }
      
      // Sadece gerçek değişiklikler için log yaz
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;
      
      let hasChanges = false;
      changes.forEach((change) => {
        const firebaseCategory = change.doc.data();
        const categoryId = typeof firebaseCategory.id === 'string' ? parseInt(firebaseCategory.id) : firebaseCategory.id;
        
        if (change.type === 'added' || change.type === 'modified') {
          // Kategori eklendi veya güncellendi
          const existingCategoryIndex = db.categories.findIndex(c => c.id === categoryId);
          
          const categoryData = {
            id: categoryId,
            name: firebaseCategory.name || '',
            order_index: firebaseCategory.order_index || 0
          };
          
          if (existingCategoryIndex !== -1) {
            // Güncelle - sadece gerçekten değiştiyse
            const oldCategory = db.categories[existingCategoryIndex];
            const hasRealChange = oldCategory.name !== categoryData.name || 
                                 oldCategory.order_index !== categoryData.order_index;
            
            if (hasRealChange) {
              db.categories[existingCategoryIndex] = categoryData;
              console.log(`🔄 Kategori güncellendi: ${categoryData.name} (ID: ${categoryId})`);
              hasChanges = true;
            }
          } else {
            // Yeni ekle
            db.categories.push(categoryData);
            console.log(`➕ Yeni kategori eklendi: ${categoryData.name} (ID: ${categoryId})`);
            hasChanges = true;
          }
        } else if (change.type === 'removed') {
          // Kategori silindi
          const categoryIndex = db.categories.findIndex(c => c.id === categoryId);
          if (categoryIndex !== -1) {
            const deletedCategory = db.categories[categoryIndex];
            db.categories.splice(categoryIndex, 1);
            console.log(`🗑️ Kategori silindi: ${deletedCategory.name} (ID: ${categoryId})`);
            hasChanges = true;
          }
        }
      });
      
      // Sadece gerçek değişiklik varsa database'e yaz ve sırala
      if (hasChanges) {
        // ID'leri sırala ve order_index'e göre sırala
        db.categories.sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.id - b.id;
        });
        
        saveDatabase();
        
        // Renderer process'e bildir
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('categories-updated', db.categories);
        }
      }
    }, (error) => {
      console.error('❌ Kategori listener hatası:', error);
    });
    
    console.log('✅ Kategoriler için gerçek zamanlı listener aktif (optimize edilmiş)');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Kategori listener kurulum hatası:', error);
    return null;
  }
}

// Firebase'den gerçek zamanlı ürün dinleme
let isProductsListenerInitialized = false;
function setupProductsRealtimeListener() {
  if (!firestore || !firebaseCollection || !firebaseOnSnapshot) {
    console.warn('⚠️ Firebase başlatılamadı, ürün listener kurulamadı');
    return null;
  }
  
  try {
    console.log('👂 Ürünler için gerçek zamanlı listener başlatılıyor...');
    const productsRef = firebaseCollection(firestore, 'products');
    
    const unsubscribe = firebaseOnSnapshot(productsRef, (snapshot) => {
      // İlk yüklemede tüm dokümanlar "added" olarak gelir - bunları sessizce işle
      const isInitialLoad = !isProductsListenerInitialized;
      if (isInitialLoad) {
        isProductsListenerInitialized = true;
        console.log('📥 İlk ürün yüklemesi tamamlandı (sessiz mod)');
        // İlk yüklemede sadece renderer'a bildir, her ürün için log yazma
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('products-updated', db.products);
        }
        return;
      }
      
      // Sadece gerçek değişiklikler için log yaz
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;
      
      let hasChanges = false;
      changes.forEach((change) => {
        const firebaseProduct = change.doc.data();
        const productId = typeof firebaseProduct.id === 'string' ? parseInt(firebaseProduct.id) : firebaseProduct.id;
        
        if (change.type === 'added' || change.type === 'modified') {
          // Ürün eklendi veya güncellendi
          const existingProductIndex = db.products.findIndex(p => p.id === productId);
          
          const productData = {
            id: productId,
            name: firebaseProduct.name || '',
            category_id: typeof firebaseProduct.category_id === 'string' ? parseInt(firebaseProduct.category_id) : firebaseProduct.category_id,
            price: parseFloat(firebaseProduct.price) || 0,
            image: firebaseProduct.image || null
          };
          
          if (existingProductIndex !== -1) {
            // Güncelle - sadece gerçekten değiştiyse
            const oldProduct = db.products[existingProductIndex];
            const hasRealChange = oldProduct.name !== productData.name || 
                                 oldProduct.category_id !== productData.category_id ||
                                 oldProduct.price !== productData.price ||
                                 oldProduct.image !== productData.image;
            
            if (hasRealChange) {
              db.products[existingProductIndex] = productData;
              console.log(`🔄 Ürün güncellendi: ${productData.name} (ID: ${productId})`);
              hasChanges = true;
            }
          } else {
            // Yeni ekle
            db.products.push(productData);
            console.log(`➕ Yeni ürün eklendi: ${productData.name} (ID: ${productId})`);
            hasChanges = true;
          }
        } else if (change.type === 'removed') {
          // Ürün silindi
          const productIndex = db.products.findIndex(p => p.id === productId);
          if (productIndex !== -1) {
            const deletedProduct = db.products[productIndex];
            db.products.splice(productIndex, 1);
            console.log(`🗑️ Ürün silindi: ${deletedProduct.name} (ID: ${productId})`);
            hasChanges = true;
          }
        }
      });
      
      // Sadece gerçek değişiklik varsa database'e yaz
      if (hasChanges) {
        saveDatabase();
        
        // Renderer process'e bildir
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('products-updated', db.products);
        }
      }
    }, (error) => {
      console.error('❌ Ürün listener hatası:', error);
    });
    
    console.log('✅ Ürünler için gerçek zamanlı listener aktif (optimize edilmiş)');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Ürün listener kurulum hatası:', error);
    return null;
  }
}

// Firebase'den gerçek zamanlı broadcast mesajı dinleme
let isBroadcastsListenerInitialized = false;
function setupBroadcastsRealtimeListener() {
  if (!firestore || !firebaseCollection || !firebaseOnSnapshot) {
    console.warn('⚠️ Firebase başlatılamadı, broadcast listener kurulamadı');
    return null;
  }
  
  try {
    console.log('👂 Broadcast mesajları için gerçek zamanlı listener başlatılıyor...');
    const broadcastsRef = firebaseCollection(firestore, 'broadcasts');
    
    const unsubscribe = firebaseOnSnapshot(broadcastsRef, (snapshot) => {
      // İlk yüklemede tüm dokümanlar "added" olarak gelir - bunları sessizce işle
      const isInitialLoad = !isBroadcastsListenerInitialized;
      if (isInitialLoad) {
        isBroadcastsListenerInitialized = true;
        console.log('📥 İlk broadcast yüklemesi tamamlandı (sessiz mod)');
        return;
      }
      
      // Sadece yeni eklenen mesajları işle
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;
      
      changes.forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          console.log('📢 Yeni broadcast mesajı alındı:', data.message);
          
          // Socket.IO ile tüm clientlara gönder
          if (io) {
            io.emit('broadcast-message', {
              message: data.message,
              date: data.date,
              time: data.time
            });
            console.log('✅ Broadcast mesajı tüm clientlara gönderildi');
          }
          
          // Desktop uygulamaya da gönder
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('broadcast-message', {
              message: data.message,
              date: data.date,
              time: data.time
            });
          }
        }
      });
    }, (error) => {
      console.error('❌ Broadcast listener hatası:', error);
    });
    
    console.log('✅ Broadcast mesajları için gerçek zamanlı listener aktif');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Broadcast listener kurulum hatası:', error);
    return null;
  }
}

function createWindow() {
  // Menü çubuğunu kaldır
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true // DevTools'u etkinleştir
    },
    frame: false,
    title: 'MAKARA POS',
    backgroundColor: '#f0f4ff',
    autoHideMenuBar: true, // Menü çubuğunu gizle
    fullscreen: true, // Tam ekran modu
    kiosk: true // Kiosk modu - görev çubuğu ve diğer Windows öğelerini gizler
  });

  // F12 ile DevTools aç/kapa
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    // Konsol kapalı başlatılsın
    // mainWindow.webContents.openDevTools(); // Kaldırıldı
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Pencere kapatıldığında
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-categories', () => {
  return db.categories.sort((a, b) => a.order_index - b.order_index);
});

ipcMain.handle('create-category', (event, categoryData) => {
  const { name } = categoryData;
  
  if (!name || name.trim() === '') {
    return { success: false, error: 'Kategori adı boş olamaz' };
  }
  
  // Aynı isimde kategori var mı kontrol et
  const existingCategory = db.categories.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
  if (existingCategory) {
    return { success: false, error: 'Bu isimde bir kategori zaten mevcut' };
  }
  
  const newId = db.categories.length > 0 
    ? Math.max(...db.categories.map(c => c.id)) + 1 
    : 1;
  
  const maxOrderIndex = db.categories.length > 0
    ? Math.max(...db.categories.map(c => c.order_index || 0))
    : -1;
  
  const newCategory = {
    id: newId,
    name: name.trim(),
    order_index: maxOrderIndex + 1
  };
  
  db.categories.push(newCategory);
  saveDatabase();
  
  // Firebase'e kaydet
  saveCategoryToFirebase(newCategory).catch(err => {
    console.error('Firebase kategori kaydetme hatası:', err);
  });
  
  return { success: true, category: newCategory };
});

// Kategori silme handler'ı
ipcMain.handle('update-category', (event, categoryId, categoryData) => {
  const { name } = categoryData;
  
  if (!name || name.trim() === '') {
    return { success: false, error: 'Kategori adı boş olamaz' };
  }
  
  const category = db.categories.find(c => c.id === categoryId);
  if (!category) {
    return { success: false, error: 'Kategori bulunamadı' };
  }
  
  // Aynı isimde başka bir kategori var mı kontrol et (kendisi hariç)
  const existingCategory = db.categories.find(c => 
    c.id !== categoryId && c.name.toLowerCase().trim() === name.toLowerCase().trim()
  );
  if (existingCategory) {
    return { success: false, error: 'Bu isimde bir kategori zaten mevcut' };
  }
  
  // Kategori adını güncelle
  category.name = name.trim();
  
  saveDatabase();
  
  // Firebase'e kaydet
  saveCategoryToFirebase(category).catch(err => {
    console.error('Firebase kategori güncelleme hatası:', err);
  });
  
  return { success: true, category };
});

ipcMain.handle('delete-category', async (event, categoryId) => {
  const category = db.categories.find(c => c.id === categoryId);
  
  if (!category) {
    return { success: false, error: 'Kategori bulunamadı' };
  }
  
  // Bu kategorideki tüm ürünleri bul
  const productsInCategory = db.products.filter(p => p.category_id === categoryId);
  
  // Kategorideki tüm ürünleri sil
  if (productsInCategory.length > 0) {
    // Her ürünü sil
    productsInCategory.forEach(product => {
      // Ürünü products listesinden kaldır
      const productIndex = db.products.findIndex(p => p.id === product.id);
      if (productIndex !== -1) {
        db.products.splice(productIndex, 1);
      }
      
      // Ürünle ilgili satış itemlarını bul ve sil
      const saleItems = db.saleItems.filter(si => si.product_id === product.id);
      saleItems.forEach(item => {
        const itemIndex = db.saleItems.findIndex(si => si.id === item.id);
        if (itemIndex !== -1) {
          db.saleItems.splice(itemIndex, 1);
        }
      });
      
      // Ürünle ilgili masa sipariş itemlarını bul ve sil
      const tableOrderItems = db.tableOrderItems.filter(oi => oi.product_id === product.id);
      tableOrderItems.forEach(item => {
        const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === item.id);
        if (itemIndex !== -1) {
          db.tableOrderItems.splice(itemIndex, 1);
        }
      });
    });
    
    // Firebase'den tüm ürünleri sil
    if (firestore && firebaseDoc && firebaseDeleteDoc) {
      try {
        for (const product of productsInCategory) {
          try {
            const productRef = firebaseDoc(firestore, 'products', product.id.toString());
            await firebaseDeleteDoc(productRef);
            console.log(`✅ Ürün Firebase'den silindi: ${product.name} (ID: ${product.id})`);
          } catch (productError) {
            console.error(`❌ Ürün Firebase'den silinirken hata (ID: ${product.id}):`, productError.message);
            // Bir ürün silinemediyse diğerlerini denemeye devam et
          }
        }
        console.log(`✅ ${productsInCategory.length} ürün Firebase'den silindi`);
      } catch (error) {
        console.error('❌ Firebase\'den ürün silme hatası:', error);
        console.error('Hata detayları:', error.message, error.code);
      }
    } else {
      console.warn('⚠️ Firebase başlatılamadı, ürünler sadece local database\'den silindi');
    }
  }
  
  // Kategoriye atanmış yazıcı var mı kontrol et
  const printerAssignments = db.printerAssignments.filter(pa => pa.category_id === categoryId);
  if (printerAssignments.length > 0) {
    // Yazıcı atamalarını kaldır
    db.printerAssignments = db.printerAssignments.filter(pa => pa.category_id !== categoryId);
  }
  
  // Kategoriyi sil
  const categoryIndex = db.categories.findIndex(c => c.id === categoryId);
  if (categoryIndex !== -1) {
    db.categories.splice(categoryIndex, 1);
    saveDatabase();
    
    // Firebase'den kategoriyi sil
    if (firestore && firebaseDoc && firebaseDeleteDoc) {
      try {
        const categoryRef = firebaseDoc(firestore, 'categories', categoryId.toString());
        await firebaseDeleteDoc(categoryRef);
        console.log(`✅ Kategori Firebase'den silindi: ${category.name} (ID: ${categoryId})`);
      } catch (error) {
        console.error('❌ Firebase\'den kategori silme hatası:', error);
        console.error('Hata detayları:', error.message, error.code);
        // Hata olsa bile local'den silindi, devam et
      }
    } else {
      console.warn('⚠️ Firebase başlatılamadı, kategori sadece local database\'den silindi');
    }
    
    return { success: true, deletedProducts: productsInCategory.length };
  }
  
  return { success: false, error: 'Kategori silinemedi' };
});

ipcMain.handle('get-products', async (event, categoryId) => {
  let products = categoryId 
    ? db.products.filter(p => p.category_id === categoryId)
    : db.products;
  
  // Her ürün için stok bilgisini Firebase'den çek (eğer local'de yoksa)
  const productsWithStock = await Promise.all(products.map(async (product) => {
    // Eğer local'de stok bilgisi varsa onu kullan
    if (product.stock !== undefined) {
      return product;
    }
    
    // Firebase'den çek
    const firebaseStock = await getProductStockFromFirebase(product.id);
    if (firebaseStock !== null) {
      // Local'e kaydet
      const productIndex = db.products.findIndex(p => p.id === product.id);
      if (productIndex !== -1) {
        db.products[productIndex] = {
          ...db.products[productIndex],
          stock: firebaseStock
        };
      }
      return {
        ...product,
        stock: firebaseStock
      };
    }
    
    // Stok bilgisi yoksa 0 olarak döndür
    return {
      ...product,
      stock: 0
    };
  }));
  
  // Database'i kaydet (stok bilgileri güncellendi)
  saveDatabase();
  
  return productsWithStock;
});

ipcMain.handle('create-sale', async (event, saleData) => {
  const { items, totalAmount, paymentMethod, orderNote, staff_name } = saleData;
  
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

  // Stok kontrolü ve düşürme (sadece stok takibi yapılan ürünler için)
  for (const item of items) {
    if (!item.isGift && !item.isExpense) { // İkram ve masraf ürünleri stoktan düşmez
      const product = db.products.find(p => p.id === item.id);
      // Sadece stok takibi yapılan ürünler için kontrol et
      if (product && product.trackStock) {
        const stockDecreased = await decreaseProductStock(item.id, item.quantity);
        if (!stockDecreased) {
          return { 
            success: false, 
            error: `${item.name} için yetersiz stok` 
          };
        }
      }
    }
  }

  // Yeni satış ID'si
  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    staff_name: staff_name || null
  });

  // Satış itemlarını ekle
  items.forEach(item => {
    const itemId = db.saleItems.length > 0 
      ? Math.max(...db.saleItems.map(si => si.id)) + 1 
      : 1;
      
    db.saleItems.push({
      id: itemId,
      sale_id: saleId,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false
    });
  });

  saveDatabase();

  // Firebase'e kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(firestore, 'sales');
      
      // Items'ı string formatına çevir
      const itemsText = items.map(item => {
        const giftText = item.isGift ? ' (İKRAM)' : '';
        return `${item.name} x${item.quantity}${giftText}`;
      }).join(', ');

      const firebaseData = {
        sale_id: saleId,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        sale_date: saleDate,
        sale_time: saleTime,
        staff_name: staff_name || null,
        items: itemsText,
        items_array: items.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          isGift: item.isGift || false
        })),
        created_at: firebaseServerTimestamp()
      };

      await firebaseAddDoc(salesRef, firebaseData);
      console.log('✅ Satış Firebase\'e başarıyla kaydedildi:', saleId);
    } catch (error) {
      console.error('❌ Firebase\'e kaydetme hatası:', error);
      console.error('Hata detayları:', error.message, error.stack);
    }
  } else {
    console.warn('⚠️ Firebase başlatılamadı, satış sadece local database\'e kaydedildi');
  }

  return { success: true, saleId };
});

ipcMain.handle('get-sales', () => {
  // Satışları ve itemları birleştir
  const salesWithItems = db.sales.map(sale => {
    const saleItems = db.saleItems.filter(si => si.sale_id === sale.id);
    
    // Items string'i (eski format için uyumluluk)
    const items = saleItems
      .map(si => {
        const giftText = si.isGift ? ' (İKRAM)' : '';
        return `${si.product_name} x${si.quantity}${giftText}`;
      })
      .join(', ');
    
    // Items array (gerçek veriler için - personel bilgisi dahil)
    const itemsArray = saleItems.map(si => ({
      product_id: si.product_id,
      product_name: si.product_name,
      quantity: si.quantity,
      price: si.price,
      isGift: si.isGift || false,
      staff_id: si.staff_id || null,
      staff_name: si.staff_name || null // Her item için personel bilgisi
    }));
    
    return {
      ...sale,
      items: items || 'Ürün bulunamadı',
      items_array: itemsArray // Gerçek item detayları (personel bilgisi dahil)
    };
  });
  
  // En yeni satışlar önce
  return salesWithItems.sort((a, b) => b.id - a.id).slice(0, 100);
});

// Son 12 saatin satışlarını getir
ipcMain.handle('get-recent-sales', (event, hours = 12) => {
  const now = new Date();
  const hoursAgo = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  
  // Satışları ve itemları birleştir
  const salesWithItems = db.sales.map(sale => {
    const saleItems = db.saleItems.filter(si => si.sale_id === sale.id);
    
    // Items string'i (eski format için uyumluluk)
    const items = saleItems
      .map(si => {
        const giftText = si.isGift ? ' (İKRAM)' : '';
        return `${si.product_name} x${si.quantity}${giftText}`;
      })
      .join(', ');
    
    // Items array (gerçek veriler için - personel bilgisi dahil)
    const itemsArray = saleItems.map(si => ({
      product_id: si.product_id,
      product_name: si.product_name,
      quantity: si.quantity,
      price: si.price,
      isGift: si.isGift || false,
      staff_id: si.staff_id || null,
      staff_name: si.staff_name || null
    }));
    
    return {
      ...sale,
      items: items || 'Ürün bulunamadı',
      items_array: itemsArray
    };
  });
  
  // Son 12 saat içindeki satışları filtrele
  const recentSales = salesWithItems.filter(sale => {
    try {
      // Tarih ve saat bilgisini parse et
      const [day, month, year] = sale.sale_date.split('.');
      const [hours, minutes, seconds] = (sale.sale_time || '00:00:00').split(':');
      const saleDate = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
      
      return saleDate >= hoursAgo;
    } catch (error) {
      return false;
    }
  });
  
  // En yeni satışlar önce
  return recentSales.sort((a, b) => {
    try {
      const [dayA, monthA, yearA] = a.sale_date.split('.');
      const [hoursA, minutesA, secondsA] = (a.sale_time || '00:00:00').split(':');
      const dateA = new Date(yearA, monthA - 1, dayA, hoursA || 0, minutesA || 0, secondsA || 0);
      
      const [dayB, monthB, yearB] = b.sale_date.split('.');
      const [hoursB, minutesB, secondsB] = (b.sale_time || '00:00:00').split(':');
      const dateB = new Date(yearB, monthB - 1, dayB, hoursB || 0, minutesB || 0, secondsB || 0);
      
      return dateB - dateA;
    } catch (error) {
      return 0;
    }
  });
});

ipcMain.handle('get-sale-details', (event, saleId) => {
  const sale = db.sales.find(s => s.id === saleId);
  const items = db.saleItems.filter(si => si.sale_id === saleId);
  
  return { sale, items };
});

// Tek bir satışı sil
ipcMain.handle('delete-sale', async (event, saleId) => {
  try {
    console.log(`🗑️ Satış siliniyor: ${saleId}`);
    
    // Local database'den satışı bul
    const saleIndex = db.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) {
      return { 
        success: false, 
        error: 'Satış bulunamadı' 
      };
    }
    
    // Local database'den satışı ve itemlarını sil
    db.sales.splice(saleIndex, 1);
    const saleItemsToDelete = db.saleItems.filter(si => si.sale_id === saleId);
    saleItemsToDelete.forEach(item => {
      const itemIndex = db.saleItems.findIndex(si => si.id === item.id);
      if (itemIndex !== -1) {
        db.saleItems.splice(itemIndex, 1);
      }
    });
    
    saveDatabase();
    console.log(`✅ Local database'den satış ve ${saleItemsToDelete.length} satış item'ı silindi`);
    
    // Firebase'den de satışı sil
    if (firestore && firebaseCollection && firebaseGetDocs && firebaseDeleteDoc && firebaseWhere && firebaseQuery) {
      try {
        const salesRef = firebaseCollection(firestore, 'sales');
        // sale_id'ye göre sorgula
        const q = firebaseQuery(salesRef, firebaseWhere('sale_id', '==', saleId));
        const snapshot = await firebaseGetDocs(q);
        
        const deletePromises = [];
        snapshot.forEach((doc) => {
          deletePromises.push(firebaseDeleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        console.log(`✅ Firebase'den ${deletePromises.length} satış dokümanı silindi`);
      } catch (firebaseError) {
        console.error('❌ Firebase\'den silme hatası:', firebaseError);
        // Firebase hatası olsa bile local database'den silindi, devam et
      }
    } else {
      console.warn('⚠️ Firebase başlatılamadı, sadece local database\'den silindi');
    }
    
    return { 
      success: true, 
      message: 'Satış başarıyla silindi'
    };
  } catch (error) {
    console.error('❌ Satış silme hatası:', error);
    return { 
      success: false, 
      error: error.message || 'Satış silinirken bir hata oluştu' 
    };
  }
});

// Tüm satışları sil
ipcMain.handle('delete-all-sales', async (event) => {
  try {
    console.log('🗑️ Tüm satışlar siliniyor...');
    
    // Local database'den tüm satışları sil
    const salesCount = db.sales.length;
    const saleItemsCount = db.saleItems.length;
    
    db.sales = [];
    db.saleItems = [];
    
    saveDatabase();
    console.log(`✅ Local database'den ${salesCount} satış ve ${saleItemsCount} satış item'ı silindi`);
    
    // Firebase'den de tüm satışları sil
    if (firestore && firebaseCollection && firebaseGetDocs && firebaseDeleteDoc) {
      try {
        const salesRef = firebaseCollection(firestore, 'sales');
        const snapshot = await firebaseGetDocs(salesRef);
        
        let deletedCount = 0;
        const deletePromises = [];
        
        snapshot.forEach((doc) => {
          deletePromises.push(firebaseDeleteDoc(doc.ref));
          deletedCount++;
        });
        
        await Promise.all(deletePromises);
        console.log(`✅ Firebase'den ${deletedCount} satış silindi`);
      } catch (firebaseError) {
        console.error('❌ Firebase\'den silme hatası:', firebaseError);
        // Firebase hatası olsa bile local database'den silindi, devam et
      }
    } else {
      console.warn('⚠️ Firebase başlatılamadı, sadece local database temizlendi');
    }
    
    return { 
      success: true, 
      message: `${salesCount} satış başarıyla silindi`,
      deletedCount: salesCount
    };
  } catch (error) {
    console.error('❌ Satış silme hatası:', error);
    return { 
      success: false, 
      error: error.message || 'Satışlar silinirken bir hata oluştu' 
    };
  }
});

// Table Order IPC Handlers
ipcMain.handle('create-table-order', async (event, orderData) => {
  const { items, totalAmount, tableId, tableName, tableType, orderNote } = orderData;
  
  const now = new Date();
  const orderDate = now.toLocaleDateString('tr-TR');
  const orderTime = getFormattedTime(now);

  // Mevcut sipariş var mı kontrol et
  const existingOrder = (db.tableOrders || []).find(
    o => o.table_id === tableId && o.status === 'pending'
  );

  let orderId;
  let isNewOrder = false;

  // Stok kontrolü ve düşürme (sadece stok takibi yapılan ürünler için)
  for (const item of items) {
    if (!item.isGift) { // İkram edilen ürünler stoktan düşmez
      const product = db.products.find(p => p.id === item.id);
      // Sadece stok takibi yapılan ürünler için kontrol et
      if (product && product.trackStock) {
        const stockDecreased = await decreaseProductStock(item.id, item.quantity);
        if (!stockDecreased) {
          return { 
            success: false, 
            error: `${item.name} için yetersiz stok` 
          };
        }
      }
    }
  }

  if (existingOrder) {
    // Mevcut siparişe ekle
    // Her sipariş için ayrı kayıt oluştur (aynı ürün olsa bile, farklı saat bilgisiyle)
    // Böylece kategori bazlı yazdırmada her siparişin kendi bilgileri kullanılır
    orderId = existingOrder.id;
    items.forEach(newItem => {
      const itemId = (db.tableOrderItems || []).length > 0 
        ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 
        : 1;
      if (!db.tableOrderItems) db.tableOrderItems = [];
      db.tableOrderItems.push({
        id: itemId,
        order_id: orderId,
        product_id: newItem.id,
        product_name: newItem.name,
        quantity: newItem.quantity,
        price: newItem.price,
        isGift: newItem.isGift || false,
        staff_id: null, // Electron'dan eklenen ürünler için staff bilgisi yok
        staff_name: null,
        added_date: orderDate,
        added_time: orderTime
      });
    });
    // Toplam tutarı güncelle
    const existingTotal = existingOrder.total_amount || 0;
    existingOrder.total_amount = existingTotal + totalAmount;
    if (orderNote) {
      existingOrder.order_note = orderNote;
    }
  } else {
    // Yeni sipariş oluştur
    isNewOrder = true;
    orderId = db.tableOrders.length > 0 
      ? Math.max(...db.tableOrders.map(o => o.id)) + 1 
      : 1;

    db.tableOrders.push({
      id: orderId,
      table_id: tableId,
      table_name: tableName,
      table_type: tableType,
      total_amount: totalAmount,
      order_date: orderDate,
      order_time: orderTime,
      status: 'pending',
      order_note: orderNote || null
    });

    // Sipariş itemlarını ekle
    items.forEach(item => {
      const itemId = db.tableOrderItems.length > 0 
        ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 
        : 1;
        
      if (!db.tableOrderItems) db.tableOrderItems = [];
      db.tableOrderItems.push({
        id: itemId,
        order_id: orderId,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        isGift: item.isGift || false,
        staff_id: null,
        staff_name: null,
        added_date: orderDate,
        added_time: orderTime
      });
    });
  }

  saveDatabase();
  
  // Yeni Firebase'e sadece bu masayı kaydet (makaramasalar)
  syncSingleTableToFirebase(tableId).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });
  
  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('new-order-created', { 
      orderId, 
      tableId,
      tableName, 
      tableType,
      totalAmount: existingOrder ? existingOrder.total_amount : totalAmount,
      isNewOrder
    });
  }
  
  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
  if (io) {
    io.emit('table-update', {
      tableId: tableId,
      hasOrder: true
    });
  }
  
  return { success: true, orderId, isNewOrder };
});

ipcMain.handle('get-table-orders', (event, tableId) => {
  if (tableId) {
    // Belirli bir masa için siparişler
    return db.tableOrders.filter(o => o.table_id === tableId);
  }
  // Tüm masa siparişleri
  return db.tableOrders;
});

ipcMain.handle('get-table-order-items', (event, orderId) => {
  return db.tableOrderItems.filter(oi => oi.order_id === orderId);
});

// Masa siparişinden ürün iptal etme
ipcMain.handle('cancel-table-order-item', async (event, itemId, cancelQuantity, cancelReason = null, staffId = null) => {
  const item = db.tableOrderItems.find(oi => oi.id === itemId);
  if (!item) {
    return { success: false, error: 'Ürün bulunamadı' };
  }

  const order = db.tableOrders.find(o => o.id === item.order_id);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Müdür kontrolü (sadece mobil personel arayüzünden gelen istekler için)
  // Desktop uygulamasından gelen istekler için kontrol yapılmaz (admin yetkisi var)
  if (staffId) {
    const staff = (db.staff || []).find(s => s.id === staffId);
    if (!staff || !staff.is_manager) {
      return { 
        success: false, 
        error: 'İptal yetkisi yok. İptal ettirmek için lütfen müdürle görüşünüz.' 
      };
    }
  }

  // İptal edilecek miktarı belirle
  const quantityToCancel = cancelQuantity || item.quantity;
  if (quantityToCancel <= 0 || quantityToCancel > item.quantity) {
    return { success: false, error: 'Geçersiz iptal miktarı' };
  }
  
  // Stok iadesi (ikram edilen ürünler hariç)
  if (!item.isGift) {
    await increaseProductStock(item.product_id, quantityToCancel);
  }

  // Ürün bilgilerini al (kategori ve yazıcı için)
  const product = db.products.find(p => p.id === item.product_id);
  if (!product) {
    return { success: false, error: 'Ürün bilgisi bulunamadı' };
  }

  // Kategori bilgisini al
  const category = db.categories.find(c => c.id === product.category_id);
  const categoryName = category ? category.name : 'Diğer';

  // Bu kategoriye atanmış yazıcıyı bul
  const assignment = db.printerAssignments.find(a => {
    const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
    return assignmentCategoryId === product.category_id;
  });

  if (!assignment) {
    return { success: false, error: 'Bu ürünün kategorisine yazıcı atanmamış' };
  }

      // İptal açıklaması kontrolü - açıklama yoksa fiş yazdırma, sadece açıklama iste
      if (!cancelReason || cancelReason.trim() === '') {
        return { success: false, requiresReason: true, error: 'İptal açıklaması zorunludur' };
      }

      // Açıklama var, işleme devam et - fiş yazdır
      cancelReason = cancelReason.trim();
      
      // İptal fişi yazdır (sadece açıklama varsa) - arka planda
      const now = new Date();
      const cancelDate = now.toLocaleDateString('tr-TR');
      const cancelTime = getFormattedTime(now);

      const cancelReceiptData = {
        tableName: order.table_name,
        tableType: order.table_type,
        productName: item.product_name,
        quantity: quantityToCancel,
        price: item.price,
        cancelDate: cancelDate,
        cancelTime: cancelTime,
        categoryName: categoryName
      };

      // Yazıcıya gönderme işlemini arka planda yap (await kullanmadan)
      printCancelReceipt(assignment.printerName, assignment.printerType, cancelReceiptData).catch(error => {
        console.error('İptal fişi yazdırma hatası:', error);
        // Yazdırma hatası olsa bile iptal işlemi zaten tamamlandı
      });

  // İptal edilecek tutarı hesapla (ikram değilse)
  const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);

  // Masa siparişinin toplam tutarını güncelle
  order.total_amount = Math.max(0, order.total_amount - cancelAmount);

  // İptal açıklamasını kaydet
  if (quantityToCancel >= item.quantity) {
    // Tüm ürün iptal ediliyorsa, item'ı silmeden önce açıklamayı kaydet
    item.cancel_reason = cancelReason.trim();
    item.cancel_date = new Date().toISOString();
    const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === itemId);
    if (itemIndex !== -1) {
      db.tableOrderItems.splice(itemIndex, 1);
    }
  } else {
    // Sadece bir kısmı iptal ediliyorsa, quantity'yi azalt ve açıklamayı kaydet
    item.quantity -= quantityToCancel;
    item.cancel_reason = cancelReason.trim();
    item.cancel_date = new Date().toISOString();
  }

  saveDatabase();

  // Firebase'e iptal kaydı ekle - arka planda
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    const now = new Date();
    const cancelDate = now.toLocaleDateString('tr-TR');
    const cancelTime = getFormattedTime(now);
    
    // Siparişi oluşturan garson bilgisini bul
    const orderStaffName = order.staff_name || item.staff_name || null;
    
    // İptal eden personel bilgisi
    const cancelStaff = staffId ? (db.staff || []).find(s => s.id === staffId) : null;
    const cancelStaffName = cancelStaff ? `${cancelStaff.name} ${cancelStaff.surname}` : null;
    const cancelStaffIsManager = cancelStaff ? (cancelStaff.is_manager || false) : false;
    
    const cancelRef = firebaseCollection(firestore, 'cancels');
    // Firebase kaydetme işlemini arka planda yap (await kullanmadan)
    firebaseAddDoc(cancelRef, {
      item_id: itemId,
      order_id: order.id,
      table_id: order.table_id,
      table_name: order.table_name,
      table_type: order.table_type,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: quantityToCancel,
      price: item.price,
      cancel_reason: cancelReason,
      cancel_date: cancelDate,
      cancel_time: cancelTime,
      staff_id: staffId || null,
      staff_name: cancelStaffName,
      staff_is_manager: cancelStaffIsManager,
      order_staff_name: orderStaffName, // Siparişi oluşturan garson
      source: 'desktop', // 'desktop' veya 'mobile'
      created_at: firebaseServerTimestamp()
    }).then(() => {
      console.log('✅ İptal kaydı Firebase\'e başarıyla kaydedildi');
    }).catch(error => {
      console.error('❌ Firebase\'e iptal kaydı kaydedilemedi:', error);
    });
  }

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: order.id,
      tableId: order.table_id
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: order.total_amount > 0
    });
  }

  // Yeni Firebase'e sadece bu masayı kaydet (makaramasalar)
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  return { success: true, remainingAmount: order.total_amount };
});

// Toplu iptal handler - birden fazla item'ı tek fişte iptal et
ipcMain.handle('cancel-table-order-items-bulk', async (event, itemsToCancel, cancelReason = null, staffId = null) => {
  // itemsToCancel: [{ itemId, quantity }, ...]
  if (!itemsToCancel || itemsToCancel.length === 0) {
    return { success: false, error: 'İptal edilecek ürün bulunamadı' };
  }

  // İlk item'dan order bilgisini al
  const firstItem = db.tableOrderItems.find(oi => oi.id === itemsToCancel[0].itemId);
  if (!firstItem) {
    return { success: false, error: 'Ürün bulunamadı' };
  }

  const order = db.tableOrders.find(o => o.id === firstItem.order_id);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Müdür kontrolü (sadece mobil personel arayüzünden gelen istekler için)
  if (staffId) {
    const staff = (db.staff || []).find(s => s.id === staffId);
    if (!staff || !staff.is_manager) {
      return { 
        success: false, 
        error: 'İptal yetkisi yok. İptal ettirmek için lütfen müdürle görüşünüz.' 
      };
    }
  }

  if (!cancelReason || cancelReason.trim() === '') {
    return { success: false, requiresReason: true, error: 'İptal açıklaması zorunludur' };
  }

  cancelReason = cancelReason.trim();

  // Tüm item'ları iptal et ve toplam bilgilerini topla
  let totalCancelAmount = 0;
  const cancelItems = [];
  const categoryGroups = new Map(); // categoryId -> { items: [], totalQuantity, totalAmount }

  for (const cancelItem of itemsToCancel) {
    const item = db.tableOrderItems.find(oi => oi.id === cancelItem.itemId);
    if (!item) continue;

    const quantityToCancel = cancelItem.quantity || item.quantity;
    if (quantityToCancel <= 0 || quantityToCancel > item.quantity) continue;

    // Stok iadesi (ikram edilen ürünler hariç)
    if (!item.isGift) {
      await increaseProductStock(item.product_id, quantityToCancel);
    }

    // Ürün bilgilerini al
    const product = db.products.find(p => p.id === item.product_id);
    if (!product) continue;

    const category = db.categories.find(c => c.id === product.category_id);
    const categoryName = category ? category.name : 'Diğer';

    // Kategoriye göre grupla
    if (!categoryGroups.has(product.category_id)) {
      const assignment = db.printerAssignments.find(a => {
        const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
        return assignmentCategoryId === product.category_id;
      });

      if (!assignment) continue; // Yazıcı ataması yoksa atla

      categoryGroups.set(product.category_id, {
        categoryName,
        printerName: assignment.printerName,
        printerType: assignment.printerType,
        items: [],
        totalQuantity: 0,
        totalAmount: 0
      });
    }

    const categoryGroup = categoryGroups.get(product.category_id);
    categoryGroup.items.push({
      productName: item.product_name,
      quantity: quantityToCancel,
      price: item.price
    });
    categoryGroup.totalQuantity += quantityToCancel;
    categoryGroup.totalAmount += item.isGift ? 0 : (item.price * quantityToCancel);

    // İptal edilecek tutarı hesapla
    const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);
    totalCancelAmount += cancelAmount;

    // Item'ı güncelle veya sil
    if (quantityToCancel >= item.quantity) {
      item.cancel_reason = cancelReason;
      item.cancel_date = new Date().toISOString();
      const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === cancelItem.itemId);
      if (itemIndex !== -1) {
        db.tableOrderItems.splice(itemIndex, 1);
      }
    } else {
      item.quantity -= quantityToCancel;
      item.cancel_reason = cancelReason;
      item.cancel_date = new Date().toISOString();
    }

    cancelItems.push({
      itemId: cancelItem.itemId,
      productName: item.product_name,
      quantity: quantityToCancel,
      price: item.price
    });
  }

  // Masa siparişinin toplam tutarını güncelle
  order.total_amount = Math.max(0, order.total_amount - totalCancelAmount);

  saveDatabase();

  // Her kategori için tek bir fiş yazdır
  const now = new Date();
  const cancelDate = now.toLocaleDateString('tr-TR');
  const cancelTime = getFormattedTime(now);

  for (const [categoryId, categoryGroup] of categoryGroups) {
    try {
      // Tek fiş için toplam bilgileriyle yazdır
      const cancelReceiptData = {
        tableName: order.table_name,
        tableType: order.table_type,
        productName: categoryGroup.items.length === 1 
          ? categoryGroup.items[0].productName 
          : `${categoryGroup.items.length} Farklı Ürün`,
        quantity: categoryGroup.totalQuantity,
        price: categoryGroup.items.length === 1 
          ? categoryGroup.items[0].price 
          : categoryGroup.totalAmount / categoryGroup.totalQuantity, // Ortalama fiyat
        cancelDate,
        cancelTime,
        categoryName: categoryGroup.categoryName,
        items: categoryGroup.items // Detaylı ürün listesi
      };

      await printCancelReceipt(categoryGroup.printerName, categoryGroup.printerType, cancelReceiptData);
    } catch (error) {
      console.error('İptal fişi yazdırma hatası:', error);
      // Yazdırma hatası olsa bile iptal işlemini devam ettir
    }
  }

  // Firebase'e iptal kayıtları ekle
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const orderStaffName = order.staff_name || firstItem.staff_name || null;
      const cancelStaff = staffId ? (db.staff || []).find(s => s.id === staffId) : null;
      const cancelStaffName = cancelStaff ? `${cancelStaff.name} ${cancelStaff.surname}` : null;
      const cancelStaffIsManager = cancelStaff ? (cancelStaff.is_manager || false) : false;

      const cancelRef = firebaseCollection(firestore, 'cancels');
      
      for (const cancelItem of cancelItems) {
        await firebaseAddDoc(cancelRef, {
          item_id: cancelItem.itemId,
          order_id: order.id,
          table_id: order.table_id,
          table_name: order.table_name,
          table_type: order.table_type,
          product_name: cancelItem.productName,
          quantity: cancelItem.quantity,
          price: cancelItem.price,
          cancel_reason: cancelReason,
          cancel_date: cancelDate,
          cancel_time: cancelTime,
          staff_id: staffId || null,
          staff_name: cancelStaffName,
          staff_is_manager: cancelStaffIsManager,
          order_staff_name: orderStaffName,
          source: 'desktop',
          created_at: firebaseServerTimestamp()
        });
      }
      console.log('✅ Toplu iptal kayıtları Firebase\'e başarıyla kaydedildi');
    } catch (error) {
      console.error('❌ Firebase\'e iptal kayıtları kaydedilemedi:', error);
    }
  }

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: order.id,
      tableId: order.table_id
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: order.total_amount > 0
    });
  }

  // Yeni Firebase'e sadece bu masayı kaydet
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  return { success: true, remainingAmount: order.total_amount };
});

// Masa siparişini başka bir masaya aktar
ipcMain.handle('transfer-table-order', async (event, sourceTableId, targetTableId) => {
  // Kaynak masanın siparişini bul
  const sourceOrder = db.tableOrders.find(
    o => o.table_id === sourceTableId && o.status === 'pending'
  );

  if (!sourceOrder) {
    return { success: false, error: 'Kaynak masada aktif sipariş bulunamadı' };
  }

  // Hedef masada aktif sipariş var mı kontrol et
  const targetOrder = db.tableOrders.find(
    o => o.table_id === targetTableId && o.status === 'pending'
  );

  if (targetOrder) {
    return { success: false, error: 'Hedef masada zaten aktif bir sipariş var' };
  }

  // Kaynak masanın sipariş itemlarını al
  const sourceItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrder.id);

  if (sourceItems.length === 0) {
    return { success: false, error: 'Aktarılacak ürün bulunamadı' };
  }

  // Hedef masa bilgilerini al (masa adı ve tipi)
  let targetTableName = '';
  let targetTableType = sourceOrder.table_type; // Varsayılan olarak kaynak masanın tipi

  // Masa ID'sinden masa bilgilerini çıkar
  if (targetTableId.startsWith('inside-')) {
    targetTableName = `İçeri ${targetTableId.replace('inside-', '')}`;
    targetTableType = 'inside';
  } else if (targetTableId.startsWith('outside-')) {
    targetTableName = `Dışarı ${targetTableId.replace('outside-', '')}`;
    targetTableType = 'outside';
  } else if (targetTableId.startsWith('package-')) {
    const parts = targetTableId.split('-');
    targetTableName = `Paket ${parts[parts.length - 1]}`;
    targetTableType = parts[1] || sourceOrder.table_type; // package-{type}-{number}
  }

  // Kaynak siparişin tüm bilgilerini koru (order_date, order_time, order_note, total_amount)
  // Sadece table_id, table_name ve table_type'ı güncelle
  sourceOrder.table_id = targetTableId;
  sourceOrder.table_name = targetTableName;
  sourceOrder.table_type = targetTableType;

  // Tüm itemların order_id'si zaten doğru (aynı order'a ait oldukları için değişmeyecek)
  // Ancak emin olmak için kontrol edelim
  sourceItems.forEach(item => {
    if (item.order_id !== sourceOrder.id) {
      item.order_id = sourceOrder.id;
    }
  });

  saveDatabase();

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: sourceOrder.id,
      tableId: targetTableId,
      sourceTableId: sourceTableId
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
  if (io) {
    io.emit('table-update', {
      tableId: sourceTableId,
      hasOrder: false
    });
    io.emit('table-update', {
      tableId: targetTableId,
      hasOrder: true
    });
  }

  // Yeni Firebase'e hem kaynak hem hedef masayı kaydet (makaramasalar)
  syncSingleTableToFirebase(sourceTableId).catch(err => {
    console.error('Kaynak masa Firebase kaydetme hatası:', err);
  });
  syncSingleTableToFirebase(targetTableId).catch(err => {
    console.error('Hedef masa Firebase kaydetme hatası:', err);
  });

  return { 
    success: true, 
    orderId: sourceOrder.id,
    sourceTableId: sourceTableId,
    targetTableId: targetTableId
  };
});

// Tüm masayı iptal et - hiçbir kayıt tutmadan, sanki hiç açılmamış gibi
ipcMain.handle('cancel-entire-table-order', async (event, orderId) => {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  const tableId = order.table_id;

  // Tüm sipariş item'larını bul ve sil
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);
  
  // Stok iadesi yapma - hiçbir şey değişmeyecek
  // Fiş yazdırma - hiçbir şey yazdırılmayacak
  // Firebase kaydı - hiçbir kayıt tutulmayacak
  
  // Sadece siparişi ve item'ları sil
  const orderIndex = db.tableOrders.findIndex(o => o.id === orderId);
  if (orderIndex !== -1) {
    db.tableOrders.splice(orderIndex, 1);
  }

  // Tüm item'ları sil
  orderItems.forEach(item => {
    const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === item.id);
    if (itemIndex !== -1) {
      db.tableOrderItems.splice(itemIndex, 1);
    }
  });

  saveDatabase();

  // Yeni Firebase'e masayı boş olarak kaydet (makaramasalar)
  syncSingleTableToFirebase(tableId).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: orderId,
      tableId: tableId
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder (masa artık boş)
  if (io) {
    io.emit('table-update', {
      tableId: tableId,
      hasOrder: false
    });
  }

  return { success: true };
});

ipcMain.handle('complete-table-order', async (event, orderId, paymentMethod = 'Nakit') => {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Ödeme yöntemi kontrolü
  if (!paymentMethod || (paymentMethod !== 'Nakit' && paymentMethod !== 'Kredi Kartı')) {
    return { success: false, error: 'Geçerli bir ödeme yöntemi seçilmedi' };
  }

  // Sipariş durumunu tamamlandı olarak işaretle
  order.status = 'completed';

  // Satış geçmişine ekle (seçilen ödeme yöntemi ile)
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

  // Yeni satış ID'si
  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış itemlarını al
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);

  // Staff bilgilerini topla (varsa) - En çok ürün ekleyen personel ana personel olarak kaydedilir
  const staffCounts = {};
  orderItems.forEach(item => {
    if (item.staff_name) {
      if (!staffCounts[item.staff_name]) {
        staffCounts[item.staff_name] = 0;
      }
      staffCounts[item.staff_name] += item.quantity;
    }
  });
  
  // En çok ürün ekleyen personel ana personel
  const mainStaffName = Object.keys(staffCounts).length > 0
    ? Object.keys(staffCounts).reduce((a, b) => staffCounts[a] > staffCounts[b] ? a : b)
    : null;

  // Satış ekle (seçilen ödeme yöntemi ile)
  db.sales.push({
    id: saleId,
    total_amount: order.total_amount,
    payment_method: paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: order.table_name,
    table_type: order.table_type,
    staff_name: mainStaffName // Ana personel bilgisi
  });

  // Satış itemlarını ekle - Her item için personel bilgisini de kaydet
  orderItems.forEach(item => {
    const itemId = db.saleItems.length > 0 
      ? Math.max(...db.saleItems.map(si => si.id)) + 1 
      : 1;
      
    db.saleItems.push({
      id: itemId,
      sale_id: saleId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false,
      staff_id: item.staff_id || null, // Her ürün için personel bilgisi
      staff_name: item.staff_name || null
    });
  });

  saveDatabase();

  // Firebase'e kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(firestore, 'sales');
      
      // Items'ı string formatına çevir
      const itemsText = orderItems.map(item => {
        const giftText = item.isGift ? ' (İKRAM)' : '';
        return `${item.product_name} x${item.quantity}${giftText}`;
      }).join(', ');

      // Staff bilgilerini topla (varsa)
      const staffNames = [...new Set(orderItems.filter(oi => oi.staff_name).map(oi => oi.staff_name))];
      const staffName = staffNames.length > 0 ? staffNames.join(', ') : null;

      await firebaseAddDoc(salesRef, {
        sale_id: saleId,
        total_amount: order.total_amount,
        payment_method: paymentMethod,
        sale_date: saleDate,
        sale_time: saleTime,
        table_name: order.table_name,
        table_type: order.table_type,
        staff_name: staffName,
        items: itemsText,
        items_array: orderItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          isGift: item.isGift || false,
          staff_id: item.staff_id || null,
          staff_name: item.staff_name || null // Her item için personel bilgisi
        })),
        created_at: firebaseServerTimestamp()
      });
      console.log('Masa siparişi Firebase\'e kaydedildi:', saleId);
    } catch (error) {
      console.error('Firebase\'e kaydetme hatası:', error);
    }
  }

  // Yeni Firebase'e masayı boş olarak kaydet (makaramasalar)
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: order.id,
      tableId: order.table_id
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder (masa artık boş)
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: false
    });
  }

  return { success: true, saleId };
});

// Kısmi ödeme için masa siparişi tutarını güncelle ve satış kaydı oluştur
ipcMain.handle('update-table-order-amount', async (event, orderId, paidAmount) => {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Masa siparişi tutarını güncelle (kısmi ödeme düşülür)
  order.total_amount = Math.max(0, order.total_amount - paidAmount);

  // Eğer tutar 0 veya negatifse siparişi tamamlandı olarak işaretle
  if (order.total_amount <= 0.01) {
    order.status = 'completed';
    // Yeni Firebase'e masayı boş olarak kaydet (makaramasalar)
    syncSingleTableToFirebase(order.table_id).catch(err => {
      console.error('Masa Firebase kaydetme hatası:', err);
    });
    
    // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder (masa artık boş)
    if (io) {
      io.emit('table-update', {
        tableId: order.table_id,
        hasOrder: false
      });
    }
  } else {
    // Yeni Firebase'e masayı güncelle (makaramasalar)
    syncSingleTableToFirebase(order.table_id).catch(err => {
      console.error('Masa Firebase kaydetme hatası:', err);
    });
    
    // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder (masa hala dolu)
    if (io) {
      io.emit('table-update', {
        tableId: order.table_id,
        hasOrder: true
      });
    }
  }

  saveDatabase();
  return { success: true, remainingAmount: order.total_amount };
});

// Kısmi ödeme için satış kaydı oluştur
ipcMain.handle('create-partial-payment-sale', async (event, saleData) => {
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

  // Yeni satış ID'si
  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış itemlarını al (kısmi ödeme için tüm ürünleri göster, sadece ödeme yöntemi farklı)
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === saleData.orderId);

  // Staff bilgilerini topla (varsa) - En çok ürün ekleyen personel ana personel olarak kaydedilir
  const staffCounts = {};
  orderItems.forEach(item => {
    if (item.staff_name) {
      if (!staffCounts[item.staff_name]) {
        staffCounts[item.staff_name] = 0;
      }
      staffCounts[item.staff_name] += item.quantity;
    }
  });
  
  // En çok ürün ekleyen personel ana personel
  const mainStaffName = Object.keys(staffCounts).length > 0
    ? Object.keys(staffCounts).reduce((a, b) => staffCounts[a] > staffCounts[b] ? a : b)
    : null;

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: saleData.totalAmount,
    payment_method: saleData.paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: saleData.tableName,
    table_type: saleData.tableType,
    staff_name: mainStaffName // Ana personel bilgisi
  });

  // Satış itemlarını ekle - Her item için personel bilgisini de kaydet
  orderItems.forEach(item => {
    const itemId = db.saleItems.length > 0 
      ? Math.max(...db.saleItems.map(si => si.id)) + 1 
      : 1;
    
    db.saleItems.push({
      id: itemId,
      sale_id: saleId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false,
      staff_id: item.staff_id || null, // Her ürün için personel bilgisi
      staff_name: item.staff_name || null
    });
  });

  saveDatabase();

  // Firebase'e kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(firestore, 'sales');
      
      // Items'ı string formatına çevir
      const itemsText = orderItems.map(item => {
        const giftText = item.isGift ? ' (İKRAM)' : '';
        return `${item.product_name} x${item.quantity}${giftText}`;
      }).join(', ');

      // Staff bilgilerini topla (varsa)
      const staffNames = [...new Set(orderItems.filter(oi => oi.staff_name).map(oi => oi.staff_name))];
      const staffName = staffNames.length > 0 ? staffNames.join(', ') : null;

      await firebaseAddDoc(salesRef, {
        sale_id: saleId,
        total_amount: saleData.totalAmount,
        payment_method: saleData.paymentMethod,
        sale_date: saleDate,
        sale_time: saleTime,
        table_name: saleData.tableName,
        table_type: saleData.tableType,
        staff_name: staffName,
        items: itemsText,
        items_array: orderItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          isGift: item.isGift || false,
          staff_id: item.staff_id || null,
          staff_name: item.staff_name || null // Her item için personel bilgisi
        })),
        created_at: firebaseServerTimestamp()
      });
      console.log('Kısmi ödeme satışı Firebase\'e kaydedildi:', saleId);
    } catch (error) {
      console.error('Firebase\'e kaydetme hatası:', error);
    }
  }

  return { success: true, saleId };
});

// Ürün bazlı ödeme al (yeni sistem)
ipcMain.handle('pay-table-order-item', async (event, itemId, paymentMethod, paidQuantity = null) => {
  const item = db.tableOrderItems.find(oi => oi.id === itemId);
  if (!item) {
    return { success: false, error: 'Ürün bulunamadı' };
  }

  const order = db.tableOrders.find(o => o.id === item.order_id);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Ödenecek miktarı belirle
  const quantityToPay = paidQuantity !== null ? paidQuantity : item.quantity;
  
  // Miktar kontrolü
  if (quantityToPay <= 0 || quantityToPay > item.quantity) {
    return { success: false, error: 'Geçersiz miktar' };
  }

  // Ödenmiş miktarı kontrol et
  const currentPaidQuantity = item.paid_quantity || 0;
  const remainingQuantity = item.quantity - currentPaidQuantity;
  
  if (quantityToPay > remainingQuantity) {
    return { success: false, error: `Sadece ${remainingQuantity} adet için ödeme alınabilir` };
  }

  // Yeni ödenen miktar
  const newPaidQuantity = currentPaidQuantity + quantityToPay;

  // Ürün tutarını hesapla (ikram değilse)
  const itemAmount = item.isGift ? 0 : (item.price * quantityToPay);

  // Ödenen miktarı güncelle
  item.paid_quantity = newPaidQuantity;
  
  // Eğer tüm miktar ödendiyse, ürünü tamamen ödendi olarak işaretle
  if (newPaidQuantity >= item.quantity) {
    item.is_paid = true;
  }
  
  // Ödeme yöntemi ve tarih bilgilerini güncelle (ilk ödeme ise)
  if (currentPaidQuantity === 0) {
    item.payment_method = paymentMethod;
    item.paid_date = new Date().toLocaleDateString('tr-TR');
    item.paid_time = getFormattedTime(new Date());
  } else {
    // Kısmi ödemeler için ödeme yöntemlerini birleştir
    item.payment_method = `${item.payment_method}, ${paymentMethod}`;
  }

  // Masa siparişi tutarını güncelle
  order.total_amount = Math.max(0, order.total_amount - itemAmount);

  // Eğer tüm ürünlerin ödemesi alındıysa siparişi tamamlandı olarak işaretle
  const unpaidItems = db.tableOrderItems.filter(oi => {
    if (oi.order_id !== order.id || oi.isGift) return false;
    const paidQty = oi.paid_quantity || 0;
    return paidQty < oi.quantity;
  });
  if (unpaidItems.length === 0) {
    order.status = 'completed';
  }

  saveDatabase();

  // Satış kaydı oluştur (sadece bu ürün için)
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: itemAmount,
    payment_method: paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: order.table_name,
    table_type: order.table_type,
    staff_name: item.staff_name || null
  });

  // Satış itemını ekle (sadece ödenen miktar için)
  const saleItemId = db.saleItems.length > 0 
    ? Math.max(...db.saleItems.map(si => si.id)) + 1 
    : 1;
    
  db.saleItems.push({
    id: saleItemId,
    sale_id: saleId,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: quantityToPay, // Ödenen miktar
    price: item.price,
    isGift: item.isGift || false,
    staff_id: item.staff_id || null,
    staff_name: item.staff_name || null
  });

  saveDatabase();

  // Firebase'e kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(firestore, 'sales');
      
      const itemsText = `${item.product_name} x${quantityToPay}${item.isGift ? ' (İKRAM)' : ''}`;

      await firebaseAddDoc(salesRef, {
        sale_id: saleId,
        total_amount: itemAmount,
        payment_method: paymentMethod,
        sale_date: saleDate,
        sale_time: saleTime,
        table_name: order.table_name,
        table_type: order.table_type,
        staff_name: item.staff_name || null,
        items: itemsText,
        items_array: [{
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: quantityToPay, // Ödenen miktar
          price: item.price,
          isGift: item.isGift || false,
          staff_id: item.staff_id || null,
          staff_name: item.staff_name || null
        }],
        created_at: firebaseServerTimestamp()
      });
      console.log('Ürün ödemesi Firebase\'e kaydedildi:', saleId);
    } catch (error) {
      console.error('Firebase\'e kaydetme hatası:', error);
    }
  }

  // Electron renderer process'e güncelleme gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { 
      orderId: order.id,
      tableId: order.table_id
    });
  }

  // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: order.total_amount > 0
    });
  }

  // Yeni Firebase'e sadece bu masayı kaydet (makaramasalar)
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  return { success: true, remainingAmount: order.total_amount, saleId };
});

// Settings IPC Handlers
ipcMain.handle('change-password', (event, currentPin, newPin) => {
  try {
    // Settings objesini kontrol et ve yoksa oluştur
    if (!db.settings) {
      db.settings = { adminPin: '1234' };
      saveDatabase();
    }
    
    // Mevcut PIN kontrolü
    const currentStoredPin = db.settings.adminPin || '1234';
    if (currentStoredPin !== currentPin) {
      return { success: false, error: 'Mevcut parola hatalı' };
    }
    
    // Yeni PIN validasyonu
    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      return { success: false, error: 'Parola 4 haneli rakam olmalıdır' };
    }
    
    // PIN'i güncelle
    db.settings.adminPin = newPin;
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Parola değiştirme hatası:', error);
    return { success: false, error: 'Bir hata oluştu: ' + error.message };
  }
});

ipcMain.handle('get-admin-pin', () => {
  try {
    if (!db.settings) {
      db.settings = { adminPin: '1234' };
      saveDatabase();
    }
    return db.settings.adminPin || '1234';
  } catch (error) {
    console.error('PIN okuma hatası:', error);
    return '1234';
  }
});

// Product Management IPC Handlers
ipcMain.handle('create-product', (event, productData) => {
  const { name, category_id, price, image } = productData;
  
  const newId = db.products.length > 0 
    ? Math.max(...db.products.map(p => p.id)) + 1 
    : 1;
  
  const newProduct = {
    id: newId,
    name,
    category_id,
    price: parseFloat(price),
    image: image || null
  };
  
  db.products.push(newProduct);
  saveDatabase();
  
  // Firebase'e kaydet
  saveProductToFirebase(newProduct).catch(err => {
    console.error('Firebase ürün kaydetme hatası:', err);
  });
  
  // Eğer görsel varsa Firebase'e kaydet
  if (image) {
    // URL kontrolü (http veya https ile başlayan URL'ler)
    const isUrl = image.startsWith('http://') || image.startsWith('https://');
    
    if (isUrl && image.includes('r2.dev') && image.includes('temp_')) {
      // Temp görsel ise
      updateTempImageRecordInFirebase(image, newProduct.id, newProduct.name, newProduct.category_id, newProduct.price).catch(err => {
        console.error('Firebase temp görsel kaydı güncelleme hatası:', err);
      });
    } else if (isUrl) {
      // Normal URL ise (R2 veya başka bir URL)
      updateImageRecordInFirebase(newProduct.id, image, newProduct.name, newProduct.category_id, newProduct.price).catch(err => {
        console.error('Firebase görsel kaydı güncelleme hatası:', err);
      });
    } else if (image.includes('r2.dev') || image.includes('r2.cloudflarestorage.com')) {
      // R2 URL'i ama http/https ile başlamıyorsa (eski format)
      updateImageRecordInFirebase(newProduct.id, image, newProduct.name, newProduct.category_id, newProduct.price).catch(err => {
        console.error('Firebase görsel kaydı güncelleme hatası:', err);
      });
    }
  }
  
  return { success: true, product: newProduct };
});

ipcMain.handle('update-product', async (event, productData) => {
  const { id, name, category_id, price, image } = productData;
  
  const productIndex = db.products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  const oldProduct = db.products[productIndex];
  const oldImage = oldProduct.image;
  
  // Eğer görsel değiştiyse ve eski görsel Firebase Storage'da ise, eski görseli sil
    if (oldImage && oldImage !== image && (oldImage.includes('firebasestorage.googleapis.com') || oldImage.includes('r2.cloudflarestorage.com') || oldImage.includes('r2.dev'))) {
      await deleteImageFromR2(oldImage);
    }
  
  db.products[productIndex] = {
    ...db.products[productIndex],
    name,
    category_id,
    price: parseFloat(price),
    image: image || null
  };
  
  saveDatabase();
  
  // Firebase'e kaydet
  saveProductToFirebase(db.products[productIndex]).catch(err => {
    console.error('Firebase ürün güncelleme hatası:', err);
  });
  
  // Eğer görsel varsa Firebase'e kaydet
  if (image) {
    // URL kontrolü (http veya https ile başlayan URL'ler)
    const isUrl = image.startsWith('http://') || image.startsWith('https://');
    
    if (isUrl && image.includes('temp_')) {
      // Temp görsel ise
      updateTempImageRecordInFirebase(image, id, name, category_id, parseFloat(price)).catch(err => {
        console.error('Firebase temp görsel kaydı güncelleme hatası:', err);
      });
    } else if (isUrl || image.includes('r2.dev') || image.includes('r2.cloudflarestorage.com')) {
      // Normal URL ise (R2 veya başka bir URL)
      updateImageRecordInFirebase(id, image, name, category_id, parseFloat(price)).catch(err => {
        console.error('Firebase görsel kaydı güncelleme hatası:', err);
      });
    }
  }
  
  return { success: true, product: db.products[productIndex] };
});

// Stok güncelleme IPC handler
ipcMain.handle('adjust-product-stock', async (event, productId, adjustment) => {
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const productIndex = db.products.findIndex(p => p.id === productIdNum);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  const product = db.products[productIndex];
  
  // Stok takibini aktif et (eğer henüz aktif değilse)
  if (!product.trackStock) {
    db.products[productIndex] = {
      ...product,
      trackStock: true,
      stock: 0
    };
    product.trackStock = true;
    product.stock = 0;
  }
  
  const currentStock = product.stock !== undefined ? (product.stock || 0) : 0;
  const newStock = Math.max(0, currentStock + adjustment);
  
  // Ürün stokunu güncelle
  db.products[productIndex] = {
    ...product,
    trackStock: true,
    stock: newStock
  };
  
  saveDatabase();
  
  // Firebase'e kaydet (makaramasalar)
  await saveProductStockToFirebase(productIdNum, newStock);
  
  console.log(`✅ Ürün stoku güncellendi: ${product.name} (${currentStock} → ${newStock})`);
  
  // Mobil personel arayüzüne gerçek zamanlı stok güncellemesi gönder
  if (io) {
    io.emit('product-stock-update', {
      productId: productIdNum,
      stock: newStock,
      trackStock: true
    });
  }
  
  return { success: true, product: db.products[productIndex], newStock };
});

// Stok takibini açma/kapama IPC handler
ipcMain.handle('toggle-product-stock-tracking', async (event, productId, trackStock) => {
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const productIndex = db.products.findIndex(p => p.id === productIdNum);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  const product = db.products[productIndex];
  
  // Stok takibini aç/kapat
  db.products[productIndex] = {
    ...product,
    trackStock: trackStock === true
  };
  
  // Eğer stok takibi kapatılıyorsa, stok bilgisini sıfırla (opsiyonel)
  if (!trackStock) {
    db.products[productIndex].stock = undefined;
  }
  
  saveDatabase();
  
  console.log(`✅ Ürün stok takibi ${trackStock ? 'açıldı' : 'kapatıldı'}: ${product.name}`);
  
  // Mobil personel arayüzüne gerçek zamanlı stok güncellemesi gönder
  if (io) {
    const currentStock = db.products[productIndex].stock !== undefined ? (db.products[productIndex].stock || 0) : 0;
    io.emit('product-stock-update', {
      productId: productIdNum,
      stock: trackStock ? currentStock : null,
      trackStock: trackStock
    });
  }
  
  return { success: true, product: db.products[productIndex] };
});

// Mevcut tüm ürünler için Firebase'de image kaydı oluştur
ipcMain.handle('create-image-records-for-all-products', async (event) => {
  if (!firestore || !firebaseCollection || !firebaseGetDocs || !firebaseAddDoc || !firebaseServerTimestamp) {
    return { success: false, error: 'Firebase başlatılamadı' };
  }
  
  try {
    console.log('🔄 Tüm ürünler için Firebase image kayıtları oluşturuluyor...');
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Mevcut images koleksiyonunu çek
    const imagesRef = firebaseCollection(firestore, 'images');
    const imagesSnapshot = await firebaseGetDocs(imagesRef);
    
    // Mevcut product_id'leri topla
    const existingProductIds = new Set();
    imagesSnapshot.forEach((doc) => {
      const imageData = doc.data();
      if (imageData.product_id) {
        existingProductIds.add(imageData.product_id);
      }
    });
    
    // Tüm ürünleri işle
    for (const product of db.products) {
      // Eğer bu ürün için zaten image kaydı varsa atla
      if (existingProductIds.has(product.id)) {
        skippedCount++;
        continue;
      }
      
      // Eğer ürünün görseli yoksa atla
      if (!product.image) {
        skippedCount++;
        continue;
      }
      
      try {
        // URL'den path'i çıkar
        let filePath = '';
        try {
          if (product.image.includes('/images/')) {
            const urlParts = product.image.split('/images/');
            if (urlParts.length > 1) {
              filePath = `images/${urlParts[1]}`;
            }
          } else {
            const urlModule = require('url');
            try {
              const urlObj = new urlModule.URL(product.image);
              filePath = urlObj.pathname.substring(1) || product.image;
            } catch (urlError) {
              filePath = product.image;
            }
          }
        } catch (error) {
          filePath = product.image;
        }
        
        // Firebase'e kaydet
        await firebaseAddDoc(imagesRef, {
          product_id: product.id,
          category_id: product.category_id || null,
          product_name: product.name || null,
          product_price: product.price || null,
          url: product.image,
          path: filePath || product.image,
          uploaded_at: firebaseServerTimestamp(),
          created_at: new Date().toISOString()
        });
        
        createdCount++;
        console.log(`✅ Image kaydı oluşturuldu: ${product.name} (ID: ${product.id})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Image kaydı oluşturulamadı (${product.name}):`, error.message);
      }
    }
    
    console.log(`✅ Image kayıtları oluşturma tamamlandı: ${createdCount} oluşturuldu, ${skippedCount} atlandı, ${errorCount} hata`);
    
    return { 
      success: true, 
      created: createdCount, 
      skipped: skippedCount, 
      errors: errorCount 
    };
  } catch (error) {
    console.error('❌ Image kayıtları oluşturma hatası:', error);
    return { success: false, error: error.message };
  }
});

// Firebase'den images koleksiyonunu çek
ipcMain.handle('get-firebase-images', async (event) => {
  if (!firestore || !firebaseCollection || !firebaseGetDocs) {
    return { success: false, error: 'Firebase başlatılamadı', images: [] };
  }
  
  try {
    const imagesRef = firebaseCollection(firestore, 'images');
    const snapshot = await firebaseGetDocs(imagesRef);
    
    const images = [];
    snapshot.forEach((doc) => {
      const imageData = doc.data();
      images.push({
        id: doc.id,
        product_id: imageData.product_id || null,
        category_id: imageData.category_id || null,
        product_name: imageData.product_name || null,
        product_price: imageData.product_price || null,
        url: imageData.url || '',
        path: imageData.path || '',
        uploaded_at: imageData.uploaded_at ? imageData.uploaded_at.toDate().toISOString() : null,
        created_at: imageData.created_at || null
      });
    });
    
    // URL'e göre sırala
    images.sort((a, b) => {
      if (a.product_name && b.product_name) {
        return a.product_name.localeCompare(b.product_name);
      }
      return (a.url || '').localeCompare(b.url || '');
    });
    
    return { success: true, images };
  } catch (error) {
    console.error('❌ Firebase images çekme hatası:', error);
    return { success: false, error: error.message, images: [] };
  }
});

// Ürün stokunu getir (Firebase'den)
ipcMain.handle('get-product-stock', async (event, productId) => {
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const product = db.products.find(p => p.id === productIdNum);
  if (!product) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  // Önce local'den kontrol et
  if (product.stock !== undefined) {
    return { success: true, stock: product.stock || 0 };
  }
  
  // Firebase'den çek
  const firebaseStock = await getProductStockFromFirebase(productIdNum);
  if (firebaseStock !== null) {
    // Local'e kaydet
    const productIndex = db.products.findIndex(p => p.id === productIdNum);
    if (productIndex !== -1) {
      db.products[productIndex] = {
        ...product,
        stock: firebaseStock
      };
      saveDatabase();
    }
    return { success: true, stock: firebaseStock };
  }
  
  return { success: true, stock: 0 };
});

// Kategori bazında toplu "kalmadı" işaretleme IPC handler
ipcMain.handle('mark-category-out-of-stock', async (event, categoryId) => {
  const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
  
  // Kategorideki tüm ürünleri bul
  const categoryProducts = db.products.filter(p => p.category_id === categoryIdNum);
  
  if (categoryProducts.length === 0) {
    return { success: false, error: 'Bu kategoride ürün bulunamadı' };
  }
  
  const updatedProducts = [];
  
  // Her ürün için stok takibini aç ve stoku 0 yap
  for (const product of categoryProducts) {
    const productIndex = db.products.findIndex(p => p.id === product.id);
    if (productIndex !== -1) {
      // Stok takibini aç ve stoku 0 yap
      db.products[productIndex] = {
        ...product,
        trackStock: true,
        stock: 0
      };
      
      // Firebase'e kaydet
      await saveProductStockToFirebase(product.id, 0);
      
      updatedProducts.push(db.products[productIndex]);
      
      // Mobil personel arayüzüne gerçek zamanlı stok güncellemesi gönder
      if (io) {
        io.emit('product-stock-update', {
          productId: product.id,
          stock: 0,
          trackStock: true
        });
      }
    }
  }
  
  saveDatabase();
  
  console.log(`✅ Kategori "kalmadı" olarak işaretlendi: ${categoryProducts.length} ürün güncellendi`);
  
  return { 
    success: true, 
    updatedCount: updatedProducts.length,
    products: updatedProducts 
  };
});

ipcMain.handle('delete-product', async (event, productId) => {
  // productId'yi number'a çevir (tip uyumluluğu için)
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  
  const productIndex = db.products.findIndex(p => p.id === productIdNum);
  if (productIndex === -1) {
    console.error(`❌ Ürün bulunamadı: ID=${productIdNum} (tip: ${typeof productIdNum})`);
    console.error('Mevcut ürün ID\'leri:', db.products.map(p => ({ id: p.id, name: p.name })));
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  const product = db.products[productIndex];
  console.log(`🗑️ Ürün siliniyor: ${product.name} (ID: ${productIdNum})`);
  
  // Eğer ürünün Firebase Storage'da görseli varsa, onu da sil
  if (product.image && (product.image.includes('firebasestorage.googleapis.com') || product.image.includes('r2.cloudflarestorage.com') || product.image.includes('r2.dev'))) {
    try {
      await deleteImageFromR2(product.image);
      console.log(`✅ Ürün görseli R2'den silindi`);
    } catch (error) {
      console.error('⚠️ Görsel silme hatası (devam ediliyor):', error.message);
    }
  }
  
  // Local database'den sil
  db.products.splice(productIndex, 1);
  saveDatabase();
  console.log(`✅ Ürün local database'den silindi: ${product.name}`);
  
  // Firebase'den ürünü sil
  if (firestore && firebaseDoc && firebaseDeleteDoc) {
    try {
      // Hem string hem number ID'yi dene
      let productRef = firebaseDoc(firestore, 'products', productIdNum.toString());
      try {
        await firebaseDeleteDoc(productRef);
        console.log(`✅ Ürün Firebase'den silindi: ${product.name} (ID: ${productIdNum})`);
      } catch (error) {
        // Eğer string ID ile bulunamazsa, number ID ile dene
        if (error.code === 'not-found' || error.message?.includes('not found')) {
          console.warn(`⚠️ String ID ile bulunamadı, number ID deneniyor...`);
          productRef = firebaseDoc(firestore, 'products', productIdNum.toString());
          await firebaseDeleteDoc(productRef);
          console.log(`✅ Ürün Firebase'den silindi (number ID ile): ${product.name}`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Firebase\'den ürün silme hatası:', error);
      console.error('Hata detayları:', error.message, error.code);
      // Hata olsa bile local'den silindi, devam et
      // Ama kullanıcıya bilgi ver
      return { 
        success: true, 
        warning: 'Ürün local database\'den silindi ancak Firebase\'den silinirken bir hata oluştu. Lütfen Firebase\'i kontrol edin.' 
      };
    }
  } else {
    console.warn('⚠️ Firebase başlatılamadı, ürün sadece local database\'den silindi');
  }
  
  console.log(`✅ Ürün başarıyla silindi: ${product.name}`);
  return { success: true };
});

// Cloudflare R2'ye görsel yükleme fonksiyonu
async function uploadImageToR2(filePath, productId = null) {
  try {
    // Dosyayı oku
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName);
    
    // MIME type belirle
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const contentType = mimeTypes[fileExt.toLowerCase()] || 'image/jpeg';
    
    // Benzersiz dosya adı oluştur (ürün ID + timestamp)
    const timestamp = Date.now();
    const uniqueFileName = productId 
      ? `images/products/${productId}_${timestamp}${fileExt}`
      : `images/products/temp_${timestamp}${fileExt}`;
    
    // R2'ye yükle
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: contentType,
      // Public read için ACL (R2'de public bucket ise gerekli olmayabilir)
    });
    
    await r2Client.send(command);
    console.log(`✅ Görsel R2'ye yüklendi: ${uniqueFileName}`);
    
    // Public URL oluştur
    // R2.dev subdomain formatı: https://pub-{subdomain-id}.r2.dev/path
    // Eğer custom domain varsa onu kullan, yoksa R2.dev public subdomain kullan
    // Not: R2.dev subdomain Cloudflare dashboard'dan etkinleştirilmiş olmalı
    let publicUrl;
    if (R2_CONFIG.publicUrl) {
      publicUrl = `${R2_CONFIG.publicUrl}/${uniqueFileName}`;
    } else if (R2_CONFIG.publicSubdomainId) {
      // Doğru R2.dev public subdomain formatı: pub-{subdomain-id}.r2.dev
      publicUrl = `https://${R2_CONFIG.publicSubdomainId}.r2.dev/${uniqueFileName}`;
    } else {
      // Fallback: eski format (kullanılmamalı)
      publicUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.dev/${uniqueFileName}`;
    }
    
    console.log(`✅ Görsel URL oluşturuldu: ${publicUrl}`);
    
    // Firebase Firestore'a images koleksiyonuna kaydet (ürün bilgileriyle birlikte)
    if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp && productId) {
      try {
        // Ürün bilgilerini local database'den al
        const product = db.products.find(p => p.id === productId);
        
        if (product) {
          const imagesRef = firebaseCollection(firestore, 'images');
          await firebaseAddDoc(imagesRef, {
            product_id: productId,
            category_id: product.category_id || null,
            product_name: product.name || null,
            product_price: product.price || null,
            url: publicUrl,
            path: uniqueFileName,
            uploaded_at: firebaseServerTimestamp(),
            created_at: new Date().toISOString()
          });
          console.log(`✅ Görsel URL Firebase database'e kaydedildi (images koleksiyonu) - Ürün: ${product.name}`);
        } else {
          // Ürün bulunamadıysa sadece temel bilgileri kaydet
          const imagesRef = firebaseCollection(firestore, 'images');
          await firebaseAddDoc(imagesRef, {
            product_id: productId,
            category_id: null,
            product_name: null,
            product_price: null,
            url: publicUrl,
            path: uniqueFileName,
            uploaded_at: firebaseServerTimestamp(),
            created_at: new Date().toISOString()
          });
          console.log(`✅ Görsel URL Firebase database'e kaydedildi (images koleksiyonu) - Ürün bilgisi bulunamadı`);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Firebase database kayıt hatası (devam ediliyor):', firebaseError.message);
      }
    } else if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
      // productId yoksa (temp görsel) sadece URL'yi kaydet
      try {
        const imagesRef = firebaseCollection(firestore, 'images');
        await firebaseAddDoc(imagesRef, {
          product_id: null,
          category_id: null,
          product_name: null,
          product_price: null,
          url: publicUrl,
          path: uniqueFileName,
          uploaded_at: firebaseServerTimestamp(),
          created_at: new Date().toISOString()
        });
        console.log(`✅ Görsel URL Firebase database'e kaydedildi (images koleksiyonu) - Geçici görsel`);
      } catch (firebaseError) {
        console.warn('⚠️ Firebase database kayıt hatası (devam ediliyor):', firebaseError.message);
      }
    }
    
    return publicUrl;
  } catch (error) {
    console.error('❌ R2 yükleme hatası:', error);
    throw error;
  }
}

// Firebase images koleksiyonunda görsel kaydını güncelle (ürün güncellendiğinde)
async function updateImageRecordInFirebase(productId, imageUrl, productName, categoryId, productPrice) {
  if (!firestore || !firebaseCollection || !firebaseGetDocs || !firebaseDoc || !firebaseSetDoc) {
    return;
  }
  
  try {
    const imagesRef = firebaseCollection(firestore, 'images');
    const snapshot = await firebaseGetDocs(imagesRef);
    
    // Bu URL için görsel kaydı var mı kontrol et (product_id veya URL ile)
    let imageDocFound = null;
    snapshot.forEach((doc) => {
      const imageData = doc.data();
      // URL eşleşiyorsa veya aynı ürün için başka bir görsel varsa
      if (imageData.url === imageUrl || (imageData.product_id === productId && imageData.url !== imageUrl)) {
        imageDocFound = { docId: doc.id, data: imageData };
      }
    });
    
    if (imageDocFound) {
      // Mevcut kaydı güncelle
      const imageDocRef = firebaseDoc(firestore, 'images', imageDocFound.docId);
      await firebaseSetDoc(imageDocRef, {
        ...imageDocFound.data,
        product_id: productId,
        category_id: categoryId,
        product_name: productName,
        product_price: productPrice,
        url: imageUrl,
        updated_at: firebaseServerTimestamp()
      }, { merge: true });
      console.log(`✅ Görsel kaydı Firebase'de güncellendi - Ürün: ${productName}`);
    } else {
      // Kayıt yoksa yeni kayıt ekle
      // URL'den path'i çıkar
      let filePath = '';
      try {
        if (imageUrl.includes('/images/')) {
          const urlParts = imageUrl.split('/images/');
          if (urlParts.length > 1) {
            filePath = `images/${urlParts[1]}`;
          }
        } else {
          const urlModule = require('url');
          try {
            const urlObj = new urlModule.URL(imageUrl);
            filePath = urlObj.pathname.substring(1) || imageUrl;
          } catch (urlError) {
            // URL parse edilemezse, URL'in kendisini path olarak kullan
            filePath = imageUrl;
          }
        }
      } catch (error) {
        // Hata durumunda URL'in kendisini path olarak kullan
        filePath = imageUrl;
      }
      
      // Path boş değilse kaydet
      await firebaseAddDoc(imagesRef, {
        product_id: productId,
        category_id: categoryId,
        product_name: productName,
        product_price: productPrice,
        url: imageUrl,
        path: filePath || imageUrl,
        uploaded_at: firebaseServerTimestamp(),
        created_at: new Date().toISOString()
      });
      console.log(`✅ Görsel kaydı Firebase'e eklendi - Ürün: ${productName}`);
    }
  } catch (firebaseError) {
    console.warn('⚠️ Firebase görsel kaydı güncelleme hatası (devam ediliyor):', firebaseError.message);
  }
}

// Temp görsel kaydını güncelle (ürün oluşturulduğunda temp görseli gerçek ürün görseline dönüştür)
async function updateTempImageRecordInFirebase(imageUrl, productId, productName, categoryId, productPrice) {
  if (!firestore || !firebaseCollection || !firebaseGetDocs || !firebaseDoc || !firebaseSetDoc) {
    return;
  }
  
  try {
    const imagesRef = firebaseCollection(firestore, 'images');
    const snapshot = await firebaseGetDocs(imagesRef);
    
    // Bu URL için temp görsel kaydı var mı kontrol et
    let tempImageDocFound = null;
    snapshot.forEach((doc) => {
      const imageData = doc.data();
      // URL eşleşiyorsa ve product_id null ise (temp görsel)
      if (imageData.url === imageUrl && (imageData.product_id === null || imageData.path.includes('temp_'))) {
        tempImageDocFound = { docId: doc.id, data: imageData };
      }
    });
    
    if (tempImageDocFound) {
      // Temp görsel kaydını güncelle
      const imageDocRef = firebaseDoc(firestore, 'images', tempImageDocFound.docId);
      await firebaseSetDoc(imageDocRef, {
        ...tempImageDocFound.data,
        product_id: productId,
        category_id: categoryId,
        product_name: productName,
        product_price: productPrice,
        updated_at: firebaseServerTimestamp()
      }, { merge: true });
      console.log(`✅ Temp görsel kaydı Firebase'de güncellendi - Ürün: ${productName} (ID: ${productId})`);
    } else {
      // Temp görsel kaydı bulunamadıysa yeni kayıt oluştur
      let filePath = '';
      try {
        if (imageUrl.includes('/images/')) {
          const urlParts = imageUrl.split('/images/');
          if (urlParts.length > 1) {
            filePath = `images/${urlParts[1]}`;
          }
        } else {
          const urlModule = require('url');
          try {
            const urlObj = new urlModule.URL(imageUrl);
            filePath = urlObj.pathname.substring(1) || imageUrl;
          } catch (urlError) {
            // URL parse edilemezse, URL'in kendisini path olarak kullan
            filePath = imageUrl;
          }
        }
      } catch (error) {
        // Hata durumunda URL'in kendisini path olarak kullan
        filePath = imageUrl;
      }
      
      await firebaseAddDoc(imagesRef, {
        product_id: productId,
        category_id: categoryId,
        product_name: productName,
        product_price: productPrice,
        url: imageUrl,
        path: filePath || imageUrl,
        uploaded_at: firebaseServerTimestamp(),
        created_at: new Date().toISOString()
      });
      console.log(`✅ Görsel kaydı Firebase'e eklendi - Ürün: ${productName} (ID: ${productId})`);
    }
  } catch (firebaseError) {
    console.warn('⚠️ Firebase temp görsel kaydı güncelleme hatası (devam ediliyor):', firebaseError.message);
  }
}

// R2'den görsel silme fonksiyonu
async function deleteImageFromR2(imageURL) {
  if (!imageURL || typeof imageURL !== 'string') {
    return;
  }

  try {
    // URL'den dosya yolunu çıkar
    // R2 URL formatları:
    // https://makara.public.r2.dev/images/products/123_timestamp.jpg
    // https://account-id.r2.cloudflarestorage.com/bucket/images/products/123_timestamp.jpg
    let filePath = '';
    
    if (imageURL.includes('/images/')) {
      // Public domain veya custom domain kullanılıyorsa
      const urlParts = imageURL.split('/images/');
      if (urlParts.length > 1) {
        filePath = `images/${urlParts[1]}`;
      }
    } else if (imageURL.includes(R2_CONFIG.bucketName)) {
      // R2 endpoint kullanılıyorsa
      const urlParts = imageURL.split(`/${R2_CONFIG.bucketName}/`);
      if (urlParts.length > 1) {
        filePath = urlParts[1].split('?')[0]; // Query string'i temizle
      }
    }
    
    if (!filePath) {
      console.warn('⚠️ Geçersiz R2 URL formatı:', imageURL);
      return;
    }
    
    // R2'den sil
    const command = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: filePath,
    });
    
    await r2Client.send(command);
    console.log(`✅ Görsel R2'den silindi: ${filePath}`);
    
    // Firebase Firestore'dan da sil (images koleksiyonu)
    if (firestore && firebaseCollection && firebaseGetDocs && firebaseDeleteDoc && firebaseDoc) {
      try {
        const imagesRef = firebaseCollection(firestore, 'images');
        const snapshot = await firebaseGetDocs(imagesRef);
        
        const deletePromises = [];
        snapshot.forEach((doc) => {
          const imageData = doc.data();
          if (imageData.url === imageURL || imageData.path === filePath) {
            const imageDocRef = firebaseDoc(firestore, 'images', doc.id);
            deletePromises.push(firebaseDeleteDoc(imageDocRef));
          }
        });
        
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          console.log(`✅ Görsel Firebase database'den silindi (images koleksiyonu)`);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Firebase database silme hatası (devam ediliyor):', firebaseError.message);
      }
    }
  } catch (error) {
    console.error('❌ R2 silme hatası:', error);
    // Hata olsa bile devam et, kritik değil
  }
}

// File selection handler
ipcMain.handle('select-image-file', async (event, productId = null) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Görsel Seç',
      filters: [
        { name: 'Resim Dosyaları', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { name: 'Tüm Dosyalar', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    if (!filePath) {
      return { success: false, error: 'Dosya seçilmedi' };
    }

    // Dosya var mı kontrol et
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Dosya bulunamadı' };
    }

    // Firebase Storage'a yükle
    try {
      const downloadURL = await uploadImageToR2(filePath, productId);
      return { success: true, path: downloadURL, isFirebaseURL: true };
    } catch (storageError) {
      console.error('Firebase Storage yükleme hatası:', storageError);
      // Firebase Storage başarısız olursa, eski yöntemle devam et (geriye dönük uyumluluk)
      const publicDir = path.join(__dirname, '../public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const fileName = path.basename(filePath);
      const destPath = path.join(publicDir, fileName);
      
      let finalDestPath = destPath;
      let counter = 1;
      while (fs.existsSync(finalDestPath)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        finalDestPath = path.join(publicDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      fs.copyFileSync(filePath, finalDestPath);
      const relativePath = `/${path.basename(finalDestPath)}`;
      
      return { success: true, path: relativePath, isFirebaseURL: false };
    }
  } catch (error) {
    console.error('Dosya seçme hatası:', error);
    return { success: false, error: error.message };
  }
});

// Auto Updater Configuration
autoUpdater.autoDownload = true; // Otomatik indirme aktif
autoUpdater.autoInstallOnAppQuit = true;

// Log dosyası oluştur
const logPath = path.join(app.getPath('userData'), 'update-log.txt');

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage, 'utf8');
    console.log(message); // Console'a da yaz
  } catch (error) {
    console.error('Log yazma hatası:', error);
  }
}

// GitHub update server URL'ini manuel olarak ayarla
if (app.isPackaged) {
  const feedURL = {
    provider: 'github',
    owner: 'ErolEmirhan',
    repo: 'Makara-APP'
  };
  autoUpdater.setFeedURL(feedURL);
  writeLog(`Auto-updater yapılandırıldı: ${feedURL.owner}/${feedURL.repo}`);
  writeLog(`Update URL: https://github.com/${feedURL.owner}/${feedURL.repo}/releases/latest/download/latest.yml`);
  writeLog(`Mevcut uygulama versiyonu: ${app.getVersion()}`);
}

// Update event handlers
autoUpdater.on('checking-for-update', () => {
  const msg = `Güncelleme kontrol ediliyor... (Mevcut: ${app.getVersion()})`;
  writeLog(msg);
  console.log('🔍 Güncelleme kontrol ediliyor...');
});

autoUpdater.on('update-available', (info) => {
  const msg = `Yeni güncelleme mevcut: ${info.version} - Otomatik indirme başlatılıyor...`;
  writeLog(msg);
  console.log('📥 Yeni güncelleme bulundu, otomatik indirme başlatılıyor...');
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
  // Otomatik indirme zaten aktif (autoDownload = true), burada sadece bilgilendirme yapıyoruz
});

autoUpdater.on('update-not-available', (info) => {
  const currentVersion = app.getVersion();
  const msg = `Güncelleme yok - Mevcut versiyon: ${currentVersion}, En son sürüm: ${info.version || currentVersion}`;
  writeLog(msg);
  console.log('✅ En güncel versiyonu kullanıyorsunuz:', currentVersion);
});

autoUpdater.on('error', (err) => {
  const msg = `Güncelleme hatası: ${err.message || err}`;
  writeLog(msg);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  const msg = `Güncelleme indirildi: ${info.version} - Otomatik yükleme ve yeniden başlatma yapılıyor...`;
  writeLog(msg);
  console.log('✅ Güncelleme indirildi, otomatik yükleme başlatılıyor...');
  
  // Kullanıcıya bilgi ver (opsiyonel - kısa bir süre gösterilebilir)
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
  
  // 2 saniye bekle (kullanıcıya bilgi vermek için), sonra otomatik yükle ve yeniden başlat
  setTimeout(() => {
    writeLog('Uygulama kapatılıyor, güncelleme yükleniyor ve yeniden başlatılıyor...');
    // isSilent: true = Windows dialog'unu gösterme
    // isForceRunAfter: true = Yüklemeden sonra otomatik çalıştır
    autoUpdater.quitAndInstall(true, true);
  }, 2000); // 2 saniye bekle, kullanıcı bilgilendirilsin
});

// IPC Handlers for update
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { available: false, message: 'Development modunda güncelleme kontrol edilemez' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  // isSilent: true = Windows dialog'unu gösterme, direkt yükle
  // isForceRunAfter: true = Yüklemeden sonra otomatik çalıştır
  autoUpdater.quitAndInstall(true, true);
});

// Print Receipt Handler
ipcMain.handle('print-receipt', async (event, receiptData) => {
  console.log('\n=== YAZDIRMA İŞLEMİ BAŞLADI ===');
  console.log('📄 ReceiptData:', JSON.stringify(receiptData, null, 2));
  
  try {
    if (!mainWindow) {
      console.error('❌ Ana pencere bulunamadı');
      return { success: false, error: 'Ana pencere bulunamadı' };
    }

    // CashierOnly kontrolü - eğer sadece kasa yazıcısından yazdırılacaksa kategori bazlı yazdırma yapma
    const cashierOnly = receiptData.cashierOnly || false;
    
    if (cashierOnly) {
      console.log('\n💰 SADECE KASA YAZICISI MODU');
      console.log('   Kategori bazlı yazdırma atlanıyor, sadece kasa yazıcısından yazdırılacak');
      
      // Kasa yazıcısını kontrol et
      const cashierPrinter = db.settings.cashierPrinter;
      
      if (!cashierPrinter || !cashierPrinter.printerName) {
        console.error('   ❌ Kasa yazıcısı ayarlanmamış!');
        return { success: false, error: 'Kasa yazıcısı ayarlanmamış. Lütfen ayarlardan kasa yazıcısı seçin.' };
      }
      
      console.log(`   ✓ Kasa yazıcısı bulundu: "${cashierPrinter.printerName}" (${cashierPrinter.printerType})`);
      
      // Tüm ürünlerin toplam tutarını hesapla (ikram edilenler hariç)
      const totalAmount = receiptData.items.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      const cashierReceiptData = {
        ...receiptData,
        items: receiptData.items, // TÜM ürünler
        totalAmount: totalAmount
      };
      
      console.log(`   🖨️ Kasa yazıcısına yazdırılıyor: "${cashierPrinter.printerName}"`);
      console.log(`   Toplam ${receiptData.items.length} ürün, Toplam tutar: ₺${totalAmount.toFixed(2)}`);
      
      const result = await printToPrinter(
        cashierPrinter.printerName, 
        cashierPrinter.printerType, 
        cashierReceiptData, 
        false, // isProductionReceipt = false (tam fiş)
        null
      );
      
      if (result.success) {
        console.log(`   ✅ Fiş yazdırma başarılı`);
        return { success: true, results: [result], error: null };
      } else {
        console.error(`   ❌ Fiş yazdırma başarısız: ${result.error}`);
        return { success: false, error: result.error, results: [result] };
      }
    }
    
    // 1. ReceiptData içindeki item'ları kategorilere göre grupla
    console.log('\n📦 Ürünler kategorilere göre gruplanıyor...');
    const items = receiptData.items || [];
    console.log(`   Toplam ${items.length} ürün bulundu`);
    
    // Her item için kategori bilgisini bul
    const categoryItemsMap = new Map(); // category_id -> items[]
    
    for (const item of items) {
      // Item içinde category_id var mı kontrol et
      let categoryId = item.category_id;
      
      // Eğer yoksa, ürün bilgisinden al
      if (!categoryId && item.id) {
        const product = db.products.find(p => p.id === item.id);
        if (product) {
          categoryId = product.category_id;
          console.log(`   Ürün "${item.name}" için kategori ID bulundu: ${categoryId}`);
        }
      }
      
      // Eğer hala yoksa, ürün adına göre bul
      if (!categoryId) {
        const product = db.products.find(p => p.name === item.name);
        if (product) {
          categoryId = product.category_id;
          console.log(`   Ürün adından kategori ID bulundu: ${categoryId}`);
        }
      }
      
      if (categoryId) {
        if (!categoryItemsMap.has(categoryId)) {
          categoryItemsMap.set(categoryId, []);
        }
        categoryItemsMap.get(categoryId).push(item);
        console.log(`   ✓ "${item.name}" -> Kategori ID: ${categoryId}`);
      } else {
        console.warn(`   ⚠️ "${item.name}" için kategori bulunamadı, varsayılan yazıcı kullanılacak`);
        // Kategori bulunamazsa, özel bir key kullan
        if (!categoryItemsMap.has('no-category')) {
          categoryItemsMap.set('no-category', []);
        }
        categoryItemsMap.get('no-category').push(item);
      }
    }
    
    console.log(`\n📋 Kategori grupları oluşturuldu: ${categoryItemsMap.size} kategori`);
    categoryItemsMap.forEach((items, categoryId) => {
      console.log(`   - Kategori ID ${categoryId}: ${items.length} ürün`);
    });
    
    // 2. Kasa yazıcısını kontrol et
    console.log('\n💰 Kasa yazıcısı kontrol ediliyor...');
    const cashierPrinter = db.settings.cashierPrinter;
    
    if (cashierPrinter && cashierPrinter.printerName) {
      console.log(`   ✓ Kasa yazıcısı bulundu: "${cashierPrinter.printerName}" (${cashierPrinter.printerType})`);
    } else {
      console.log(`   ⚠️ Kasa yazıcısı ayarlanmamış`);
    }
    
    // 3. Her kategori için atanmış yazıcıları bul
    console.log('\n🖨️ Yazıcı atamaları kontrol ediliyor...');
    console.log(`   Toplam ${db.printerAssignments.length} yazıcı ataması var`);
    
    // 2. Kategorileri yazıcılara göre grupla (aynı yazıcıya atanmış kategorileri birleştir)
    const printerGroupsMap = new Map(); // printerKey -> { printerName, printerType, categories: [{ categoryId, items }] }
    
    categoryItemsMap.forEach((categoryItems, categoryId) => {
      console.log(`\n   Kategori ID ${categoryId} için yazıcı aranıyor...`);
      
      // Bu kategori için atanmış yazıcıyı bul
      const categoryIdNum = typeof categoryId === 'string' && categoryId !== 'no-category' ? parseInt(categoryId) : categoryId;
      
      const assignment = db.printerAssignments.find(a => {
        const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
        return assignmentCategoryId === categoryIdNum;
      });
      
      if (!assignment) {
        console.warn(`   ⚠️ Kategori ID ${categoryId} için yazıcı ataması bulunamadı, atlanıyor`);
        return; // Kategori ataması yoksa atla
      }
      
      console.log(`   ✓ Yazıcı ataması bulundu: "${assignment.printerName}"`);
      
      // Yazıcı key'i oluştur (aynı yazıcıyı gruplamak için)
      const printerKey = `${assignment.printerName}::${assignment.printerType}`;
      
      if (!printerGroupsMap.has(printerKey)) {
        printerGroupsMap.set(printerKey, {
          printerName: assignment.printerName,
          printerType: assignment.printerType,
          categories: []
        });
      }
      
      // Bu kategoriyi yazıcı grubuna ekle
      printerGroupsMap.get(printerKey).categories.push({
        categoryId,
        items: categoryItems
      });
    });
    
    console.log(`\n🖨️ Yazıcı grupları oluşturuldu: ${printerGroupsMap.size} yazıcı`);
    printerGroupsMap.forEach((group, key) => {
      console.log(`   - "${group.printerName}": ${group.categories.length} kategori`);
    });
    
    // 3. Her yazıcı için tek bir yazdırma işi oluştur (kategoriler birleştirilmiş)
    const printJobs = [];
    
    printerGroupsMap.forEach((group, printerKey) => {
      // Tüm kategorilerin ürünlerini birleştir
      const allItems = [];
      group.categories.forEach(cat => {
        allItems.push(...cat.items);
      });
      
      // Toplam tutarı hesapla (ikram edilenler hariç)
      const totalAmount = allItems.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      const combinedReceiptData = {
        ...receiptData,
        items: allItems, // Tüm kategorilerin ürünleri birleştirilmiş
        totalAmount: totalAmount
      };
      
      printJobs.push({
        printerName: group.printerName,
        printerType: group.printerType,
        categoryId: 'combined', // Birleştirilmiş kategoriler
        items: allItems,
        receiptData: combinedReceiptData,
        isCashierReceipt: false,
        isProductionReceipt: true
      });
      
      console.log(`   ✓ "${group.printerName}" için birleşik yazdırma işi oluşturuldu: ${allItems.length} ürün, ${group.categories.length} kategori`);
    });
    
    // Kasa yazıcısına tam fiş ekle (sadece masa siparişi değilse - hızlı satış için)
    // Masa siparişleri için kasa yazıcısına yazdırma yapma (sadece kategori bazlı yazıcılara yazdır)
    const isTableOrder = receiptData.tableName || receiptData.order_id;
    
    if (!isTableOrder && cashierPrinter && cashierPrinter.printerName) {
      // Tüm ürünlerin toplam tutarını hesapla (ikram edilenler hariç)
      const totalAmount = items.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      const cashierReceiptData = {
        ...receiptData,
        items: items, // TÜM ürünler
        totalAmount: totalAmount
      };
      
      // Kasa yazıcısını en başa ekle
      printJobs.unshift({
        printerName: cashierPrinter.printerName,
        printerType: cashierPrinter.printerType,
        categoryId: 'cashier',
        items: items, // TÜM ürünler
        receiptData: cashierReceiptData,
        isCashierReceipt: true,
        isProductionReceipt: false
      });
      
      console.log(`\n💰 Kasa yazıcısı yazdırma işi eklendi: "${cashierPrinter.printerName}"`);
      console.log(`   Toplam ${items.length} ürün, Toplam tutar: ₺${totalAmount.toFixed(2)}`);
    } else if (isTableOrder) {
      console.log(`\n📋 Masa siparişi tespit edildi - Kasa yazıcısına yazdırma atlanıyor (sadece kategori bazlı yazıcılara yazdırılacak)`);
    }
    
    // Kategori yazıcıları için üretim fişi olarak işaretle
    printJobs.forEach((job) => {
      if (!job.isCashierReceipt) {
        job.isProductionReceipt = true;
        job.isCashierReceipt = false;
      }
    });
    
    console.log(`\n🎯 Toplam ${printJobs.length} yazdırma işi oluşturuldu`);
    printJobs.forEach((job, index) => {
      const receiptType = job.isCashierReceipt ? '💰 KASA FİŞİ' : '🏭 ÜRETİM FİŞİ';
      console.log(`   ${index + 1}. ${receiptType}`);
      console.log(`      Yazıcı: "${job.printerName || 'Varsayılan'}" (${job.printerType})`);
      console.log(`      Kategori: ${job.categoryId}, Ürün sayısı: ${job.items.length}`);
    });
    
    // 3. Her yazdırma işini sırayla gerçekleştir
    const printResults = [];
    
    for (let i = 0; i < printJobs.length; i++) {
      const job = printJobs[i];
      console.log(`\n🖨️ YAZDIRMA ${i + 1}/${printJobs.length} BAŞLIYOR`);
      console.log(`   Yazıcı: "${job.printerName || 'Varsayılan yazıcı'}"`);
      console.log(`   Tip: ${job.printerType}`);
      console.log(`   Kategori ID: ${job.categoryId}`);
      console.log(`   Ürün sayısı: ${job.items.length}`);
      
      const result = await printToPrinter(
        job.printerName, 
        job.printerType, 
        job.receiptData, 
        job.isProductionReceipt || false, 
        job.items
      );
      printResults.push(result);
      
      if (!result.success) {
        console.error(`   ❌ Yazdırma başarısız: ${result.error}`);
      } else {
        console.log(`   ✅ Yazdırma başarılı`);
      }
      
      // Yazıcılar arası kısa bekleme
      if (i < printJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successCount = printResults.filter(r => r.success).length;
    
    console.log(`\n=== YAZDIRMA İŞLEMİ TAMAMLANDI ===`);
    console.log(`   Toplam ${printResults.length} iş, ${successCount} başarılı`);
    
    // Yazdırma işlemleri tamamlandı - her zaman success dön
    return { 
      success: true, 
      results: printResults,
      error: null
    };
  } catch (error) {
    console.error('\n❌❌❌ YAZDIRMA HATASI ❌❌❌');
    console.error('Hata mesajı:', error.message);
    console.error('Hata detayı:', error.stack);
    return { success: false, error: error.message };
  }
});

// Yazıcıya yazdırma fonksiyonu
async function printToPrinter(printerName, printerType, receiptData, isProductionReceipt = false, productionItems = null) {
  let printWindow = null;
  
  try {
    const receiptType = isProductionReceipt ? 'ÜRETİM FİŞİ' : 'KASA FİŞİ';
    console.log(`   [printToPrinter] ${receiptType} yazdırılıyor: "${printerName || 'Varsayılan'}"`);
    
    // Fiş içeriğini HTML olarak oluştur
    const receiptHTML = isProductionReceipt 
      ? generateProductionReceiptHTML(productionItems || receiptData.items, receiptData)
      : generateReceiptHTML(receiptData);

    // Gizli bir pencere oluştur ve fiş içeriğini yükle
    printWindow = new BrowserWindow({
      show: false,
      width: 220, // 58mm ≈ 220px (72 DPI'da)
      height: 3000, // Yüksekliği daha da artırdık - tüm içeriğin kesinlikle görünmesi için
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // HTML içeriğini data URL olarak yükle
    console.log('Yazdırma penceresi oluşturuldu, HTML yükleniyor...');
    
    // Yazdırma işlemini Promise ile sarmalıyoruz
    let printResolve, printReject;
    const printPromise = new Promise((resolve, reject) => {
      printResolve = resolve;
      printReject = reject;
    });

    // Hem did-finish-load hem de dom-ready event'lerini dinle
    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      
      console.log('İçerik yüklendi, yazdırma başlatılıyor...');
      
      // İçeriğin tamamen render edilmesi için daha uzun bir bekleme
      setTimeout(async () => {
        console.log('Yazdırma komutu gönderiliyor (varsayılan yazıcıya)...');
        
        // İçeriğin tamamen render edildiğinden emin olmak için scroll yüksekliğini kontrol et ve pencere boyutunu ayarla
        try {
          const scrollHeight = await printWindow.webContents.executeJavaScript(`
            (function() {
              document.body.style.minHeight = 'auto';
              document.body.style.height = 'auto';
              document.documentElement.style.height = 'auto';
              const height = Math.max(
                document.body.scrollHeight, 
                document.body.offsetHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
              );
              return height;
            })();
          `);
          
          console.log('Sayfa yüksekliği:', scrollHeight, 'px');
          
          // Pencere yüksekliğini içeriğe göre ayarla (en az 2000px, içerik daha uzunsa onu kullan)
          const windowHeight = Math.max(3000, scrollHeight + 200);
          printWindow.setSize(220, windowHeight);
          console.log('Pencere yüksekliği ayarlandı:', windowHeight, 'px');
          
          // Ekstra bir kısa bekleme - pencere boyutu değişikliğinin uygulanması için
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log('Yükseklik kontrolü hatası:', error);
        }
        
        // Yazıcı adını belirle
        let targetPrinterName = printerName;
        
        if (targetPrinterName) {
          console.log(`   🎯 Yazıcı adı belirtildi: "${targetPrinterName}"`);
          console.log(`   🔍 Yazıcının sistemde mevcut olup olmadığı kontrol ediliyor...`);
          
          // Sistem yazıcılarını al
          try {
            const powershellCmd = `Get-WmiObject Win32_Printer | Select-Object Name | ConvertTo-Json`;
            const result = execSync(`powershell -Command "${powershellCmd}"`, { 
              encoding: 'utf-8',
              timeout: 5000 
            });
            
            const printersData = JSON.parse(result);
            const printersArray = Array.isArray(printersData) ? printersData : [printersData];
            const availablePrinters = printersArray.map(p => p.Name || '').filter(n => n);
            
            console.log(`   📋 Sistemde ${availablePrinters.length} yazıcı bulundu`);
            
            // Yazıcı adını kontrol et (tam eşleşme veya kısmi eşleşme)
            const exactMatch = availablePrinters.find(p => p === targetPrinterName);
            const partialMatch = availablePrinters.find(p => p.includes(targetPrinterName) || targetPrinterName.includes(p));
            
            if (exactMatch) {
              targetPrinterName = exactMatch;
              console.log(`   ✅ Yazıcı bulundu (tam eşleşme): "${targetPrinterName}"`);
            } else if (partialMatch) {
              targetPrinterName = partialMatch;
              console.log(`   ✅ Yazıcı bulundu (kısmi eşleşme): "${targetPrinterName}"`);
            } else {
              console.warn(`   ⚠️ Yazıcı "${targetPrinterName}" sistemde bulunamadı!`);
              console.log(`   📋 Mevcut yazıcılar:`, availablePrinters);
              console.log(`   → Varsayılan yazıcı kullanılacak`);
              targetPrinterName = null; // Varsayılan yazıcıya yazdır
            }
          } catch (error) {
            console.error(`   ❌ Yazıcı kontrolü hatası:`, error.message);
            console.log(`   → Belirtilen yazıcı adı kullanılacak: "${targetPrinterName}"`);
          }
        } else {
          console.log(`   ℹ️ Yazıcı adı belirtilmedi, varsayılan yazıcı kullanılacak`);
        }
        
        // Yazdırma seçenekleri
        const printOptions = {
          silent: true, // Dialog gösterme
          printBackground: true,
          margins: {
            marginType: 'none' // Kenar boşluğu yok
          },
          landscape: false, // Dikey yönlendirme
          scaleFactor: 100,
          pagesPerSheet: 1,
          collate: false,
          color: false, // Siyah-beyaz (termal yazıcılar için)
          copies: 1,
          duplex: 'none'
        };
        
        // Yazıcı adı belirtilmişse ekle
        if (targetPrinterName) {
          printOptions.deviceName = targetPrinterName;
          console.log(`   📤 Yazdırma seçenekleri:`);
          console.log(`      - Yazıcı: "${targetPrinterName}"`);
          console.log(`      - Tip: ${printerType}`);
        } else {
          console.log(`   📤 Varsayılan yazıcıya yazdırılacak`);
        }

        console.log(`   🖨️ Yazdırma komutu gönderiliyor...`);
        printWindow.webContents.print(printOptions, (success, errorType) => {
          console.log(`\n   📥 Yazdırma callback alındı`);
          console.log(`      - Başarılı: ${success}`);
          console.log(`      - Yazıcı: "${targetPrinterName || 'Varsayılan'}"`);
          console.log(`      - Tip: ${printerType}`);
          
          if (!success) {
            console.error(`      ❌ Yazdırma başarısız!`);
            console.error(`      Hata tipi: ${errorType}`);
            printReject(new Error(errorType || 'Yazdırma başarısız'));
          } else {
            console.log(`      ✅ Yazdırma başarılı!`);
            console.log(`      🖨️ "${targetPrinterName || 'Varsayılan yazıcı'}" yazıcısına yazdırıldı`);
            printResolve(true);
          }
          
          // Yazdırma işlemi tamamlandıktan sonra pencereyi kapat
          setTimeout(() => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
              printWindow = null;
            }
          }, 1000);
        });
        }, 2000); // 2 saniye bekle - içeriğin tamamen render edilmesi için
    };

    printWindow.webContents.once('did-finish-load', () => {
      console.log('did-finish-load event tetiklendi');
      startPrint();
    });

    printWindow.webContents.once('dom-ready', () => {
      console.log('dom-ready event tetiklendi');
      startPrint();
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);
    console.log('HTML URL yüklendi');

    // Fallback: Eğer 3 saniye içinde hiçbir event tetiklenmezse yine de yazdır
    setTimeout(() => {
      console.log('Fallback timeout: Yazdırma zorla başlatılıyor...');
      startPrint();
    }, 3000);

    // Yazdırma işleminin tamamlanmasını bekle (max 10 saniye)
    await Promise.race([
      printPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Yazdırma timeout')), 10000))
    ]);

    console.log(`   [printToPrinter] Yazdırma işlemi tamamlandı`);
    return { success: true, printerName: targetPrinterName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printToPrinter] Hata:`, error.message);
    console.error(`   Hata detayı:`, error.stack);
    
    // Hata durumunda pencereyi temizle
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    
    return { success: false, error: error.message, printerName: printerName || 'Varsayılan' };
  }
}

// Üretim fişi HTML içeriğini oluştur (fiyat yok, sadece ürün bilgileri)
function generateProductionReceiptHTML(items, receiptData) {
  const itemsHTML = items.map(item => {
    const isGift = item.isGift || false;
    
    if (isGift) {
      return `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="text-decoration: line-through; color: #999;">${item.name}</span>
            <span style="font-size: 8px; background: #dcfce7; color: #16a34a; padding: 2px 4px; border-radius: 3px; font-weight: 900;">İKRAM</span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>${item.quantity} adet</span>
        </div>
        ${item.extraNote ? `
        <div style="font-size: 9px; color: #666; font-style: italic; margin-top: 4px; font-family: 'Montserrat', sans-serif;">
          📝 ${item.extraNote}
        </div>
        ` : ''}
      </div>
    `;
    }
    
    return `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif; color: #000 !important;">
          <span style="color: #000 !important;">${item.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>${item.quantity} adet</span>
        </div>
        ${item.extraNote ? `
        <div style="font-size: 9px; color: #666; font-style: italic; margin-top: 4px; font-family: 'Montserrat', sans-serif;">
          📝 ${item.extraNote}
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet">
      <style>
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
            min-height: 100%;
          }
          body {
            margin: 0;
            padding: 10px 10px 20px 10px;
            height: auto;
            min-height: 100%;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        * {
          box-sizing: border-box;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        p, span, div {
          color: #000;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        body {
          font-family: 'Montserrat', sans-serif;
          width: 58mm;
          max-width: 58mm;
          padding: 10px 10px 25px 10px;
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          font-style: italic;
          min-height: 100%;
          height: auto;
          overflow: visible;
          color: #000;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        html {
          height: auto;
          min-height: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        .header h3 {
          font-size: 16px;
          font-weight: 900;
          font-style: italic;
          margin: 5px 0;
          font-family: 'Montserrat', sans-serif;
        }
        .info {
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 8px 0;
          margin: 10px 0;
          font-size: 10px;
          color: #000;
          font-weight: 900;
          font-style: italic;
          font-family: 'Montserrat', sans-serif;
        }
        .info div {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .items {
          margin: 10px 0;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          margin-bottom: 15px;
          padding-top: 15px;
          padding-bottom: 15px;
          border-top: 3px solid #000;
          font-size: 12px;
          font-weight: 900;
          font-style: italic;
          color: #000;
          page-break-inside: avoid;
          display: block;
          font-family: 'Montserrat', sans-serif;
        }
        .header {
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h3>MAKARA</h3>
        <p style="font-size: 10px; margin: 0; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">ÜRETİM FİŞİ</p>
      </div>
      
      <div class="info">
        <div>
          <span>Tarih:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_date || new Date().toLocaleDateString('tr-TR')}</span>
        </div>
        <div>
          <span>Saat:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_time || getFormattedTime(new Date())}</span>
        </div>
        ${receiptData.sale_id ? `
        <div>
          <span>Fiş No:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">#${receiptData.sale_id}</span>
        </div>
        ` : ''}
        ${receiptData.order_id ? `
        <div>
          <span>Sipariş No:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">#${receiptData.order_id}</span>
        </div>
        ` : ''}
      </div>

      <div class="items">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid #000; font-family: 'Montserrat', sans-serif;">
          <span>Ürün</span>
          <span>Adet</span>
        </div>
        ${itemsHTML}
      </div>
      
      ${receiptData.orderNote ? `
      <div style="margin: 10px 0; padding: 8px; background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px;">
        <p style="font-size: 10px; font-weight: 900; font-style: italic; color: #d97706; margin: 0 0 4px 0; font-family: 'Montserrat', sans-serif;">📝 Sipariş Notu:</p>
        <p style="font-size: 10px; font-weight: 900; font-style: italic; color: #92400e; margin: 0; font-family: 'Montserrat', sans-serif;">${receiptData.orderNote}</p>
      </div>
      ` : ''}
    </body>
    </html>
  `;
}

// Fiş HTML içeriğini oluştur
function generateReceiptHTML(receiptData) {
  const itemsHTML = receiptData.items.map(item => {
    const isGift = item.isGift || false;
    const displayPrice = isGift ? 0 : item.price;
    const itemTotal = isGift ? 0 : (item.price * item.quantity);
    const originalTotal = item.price * item.quantity;
    
    if (isGift) {
      return `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="text-decoration: line-through; color: #999;">${item.name}</span>
            <span style="font-size: 8px; background: #dcfce7; color: #16a34a; padding: 2px 4px; border-radius: 3px; font-weight: 900;">İKRAM</span>
          </div>
          <div style="text-align: right;">
            <div style="text-decoration: line-through; color: #999; font-size: 10px;">₺${originalTotal.toFixed(2)}</div>
            <span style="color: #16a34a; font-weight: 900;">₺0.00</span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>${item.quantity} adet × <span style="text-decoration: line-through; color: #999;">₺${item.price.toFixed(2)}</span> <span style="color: #16a34a;">₺0.00</span></span>
        </div>
      </div>
    `;
    }
    
    return `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif; color: #000 !important;">
          <span style="color: #000 !important;">${item.name}</span>
          <span style="color: #000 !important;">₺${itemTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>${item.quantity} adet × ₺${item.price.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet">
      <style>
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
            min-height: 100%;
          }
          body {
            margin: 0;
            padding: 10px 10px 20px 10px;
            height: auto;
            min-height: 100%;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        * {
          box-sizing: border-box;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        p, span, div {
          color: #000;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        body {
          font-family: 'Montserrat', sans-serif;
          width: 58mm;
          max-width: 58mm;
          padding: 10px 10px 25px 10px;
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          font-style: italic;
          min-height: 100%;
          height: auto;
          overflow: visible;
          color: #000;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        html {
          height: auto;
          min-height: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        .header h3 {
          font-size: 16px;
          font-weight: 900;
          font-style: italic;
          margin: 5px 0;
          font-family: 'Montserrat', sans-serif;
        }
        .info {
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 8px 0;
          margin: 10px 0;
          font-size: 10px;
          color: #000;
          font-weight: 900;
          font-style: italic;
          font-family: 'Montserrat', sans-serif;
        }
        .info div {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .items {
          margin: 10px 0;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-style: italic;
        }
        .total {
          border-top: 3px solid #000;
          padding-top: 10px;
          margin-top: 15px;
          margin-bottom: 10px;
          font-weight: 900;
          font-style: italic;
          color: #000;
          font-family: 'Montserrat', sans-serif;
        }
        .total div {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-weight: 900;
          font-style: italic;
          color: #000;
          font-family: 'Montserrat', sans-serif;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          margin-bottom: 15px;
          padding-top: 15px;
          padding-bottom: 15px;
          border-top: 3px solid #000;
          font-size: 12px;
          font-weight: 900;
          font-style: italic;
          color: #000;
          page-break-inside: avoid;
          display: block;
          font-family: 'Montserrat', sans-serif;
        }
        .header {
          page-break-inside: avoid;
        }
        .total {
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h3>MAKARA</h3>
        <p style="font-size: 10px; margin: 0; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.tableName ? 'Masa Siparişi' : 'Satış Fişi'}</p>
      </div>
      
      <div class="info">
        ${receiptData.tableName ? `
        <div>
          <span>Masa:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.tableName}</span>
        </div>
        ` : ''}
        <div>
          <span>Tarih:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_date || new Date().toLocaleDateString('tr-TR')}</span>
        </div>
        <div>
          <span>Saat:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_time || getFormattedTime(new Date())}</span>
        </div>
        ${receiptData.sale_id ? `
        <div>
          <span>Fiş No:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">#${receiptData.sale_id}</span>
        </div>
        ` : ''}
        ${receiptData.order_id ? `
        <div>
          <span>Sipariş No:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">#${receiptData.order_id}</span>
        </div>
        ` : ''}
      </div>

      <div class="items">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid #000; font-family: 'Montserrat', sans-serif;">
          <span>Ürün</span>
          <span>Toplam</span>
        </div>
        ${itemsHTML}
      </div>
      
      ${receiptData.orderNote ? `
      <div style="margin: 10px 0; padding: 8px; background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px;">
        <p style="font-size: 10px; font-weight: 900; font-style: italic; color: #d97706; margin: 0 0 4px 0; font-family: 'Montserrat', sans-serif;">📝 Sipariş Notu:</p>
        <p style="font-size: 10px; font-weight: 900; font-style: italic; color: #92400e; margin: 0; font-family: 'Montserrat', sans-serif;">${receiptData.orderNote}</p>
      </div>
      ` : ''}

      <div class="total">
        <div>
          <span>TOPLAM:</span>
          <span>₺${receiptData.items.reduce((sum, item) => {
            // İkram edilen ürünleri toplamdan çıkar
            if (item.isGift) return sum;
            return sum + (item.price * item.quantity);
          }, 0).toFixed(2)}</span>
        </div>
        <div style="font-size: 11px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>Ödeme:</span>
          <span>${receiptData.paymentMethod || 'Nakit'}</span>
        </div>
      </div>

    </body>
    </html>
  `;
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  startAPIServer();

  // Firebase senkronizasyonu: Sadece Firebase'den çek, gereksiz write işlemleri yapma
  setTimeout(async () => {
    console.log('🔄 Firebase senkronizasyonu başlatılıyor...');
    
    // 1. Önce Firebase'den kategorileri ve ürünleri çek (sadece read)
    await syncCategoriesFromFirebase();
    await syncProductsFromFirebase();
    
    // 2. Local path'leri Firebase Storage'a yükle (migration - sadece ilk kurulum için)
    await migrateLocalImagesToFirebase();
    
    // 3. Gerçek zamanlı listener'ları başlat (anında güncellemeler için)
    // NOT: Artık tüm ürünleri Firebase'e yazmıyoruz - sadece yeni ekleme/silme işlemlerinde yazıyoruz
    setupCategoriesRealtimeListener();
    setupProductsRealtimeListener();
    setupBroadcastsRealtimeListener();
    
    console.log('✅ Firebase senkronizasyonu tamamlandı ve gerçek zamanlı listener\'lar aktif');
    console.log('💡 Not: Ürünler sadece ekleme/silme işlemlerinde Firebase\'e yazılacak (maliyet optimizasyonu)');
  }, 2000); // 2 saniye bekle, Firebase tam yüklensin

  // Uygulama paketlenmişse güncelleme kontrolü yap
  if (app.isPackaged) {
    writeLog(`Uygulama başlatıldı - Versiyon: ${app.getVersion()}`);
    writeLog('Güncelleme kontrolü başlatılıyor...');
    
    // İlk açılışta kontrol et
    setTimeout(() => {
      writeLog('Güncelleme kontrolü yapılıyor...');
      autoUpdater.checkForUpdates().catch(err => {
        writeLog(`Güncelleme kontrolü hatası: ${err.message || err}`);
      });
    }, 3000); // 3 saniye bekle, uygulama tam yüklensin
    
    // Her 4 saatte bir kontrol et
    setInterval(() => {
      writeLog('Periyodik güncelleme kontrolü...');
      autoUpdater.checkForUpdates().catch(err => {
        writeLog(`Güncelleme kontrolü hatası: ${err.message || err}`);
      });
    }, 4 * 60 * 60 * 1000); // 4 saat
  } else {
    writeLog('Development modu - güncelleme kontrolü yapılmıyor');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Single instance - sadece bir pencere açık olsun
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    saveDatabase();
    app.quit();
  }
});

app.on('before-quit', () => {
  saveDatabase();
});

// Uygulamayı kapat
// Printer Management IPC Handlers
ipcMain.handle('get-printers', async () => {
  try {
    console.log('=== YAZICI LİSTELEME BAŞLADI ===');
    
    // Windows PowerShell komutu ile yazıcıları ve port bilgilerini al
    let printersData = [];
    
    console.log('📋 Windows sisteminden yazıcılar alınıyor...');
    try {
      // PowerShell komutu ile yazıcıları ve port bilgilerini al
      const powershellCmd = `Get-WmiObject Win32_Printer | Select-Object Name, DisplayName, Description, Status, Default, PortName | ConvertTo-Json`;
      console.log('   PowerShell komutu çalıştırılıyor...');
      
      const result = execSync(`powershell -Command "${powershellCmd}"`, { 
        encoding: 'utf-8',
        timeout: 10000 
      });
      
      console.log('   PowerShell çıktısı alındı, uzunluk:', result.length, 'karakter');
      console.log('   İlk 500 karakter:', result.substring(0, 500));
      
      if (result && result.trim()) {
        const parsed = JSON.parse(result);
        printersData = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`✅ Toplam ${printersData.length} yazıcı bulundu`);
      } else {
        console.warn('⚠️ PowerShell çıktısı boş!');
        printersData = [];
      }
    } catch (psError) {
      console.error('❌ PowerShell hatası:', psError.message);
      console.error('   Hata detayı:', psError.stack);
      // Alternatif yöntem dene
      try {
        console.log('   Alternatif yöntem deneniyor...');
        const altCmd = `Get-Printer | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; PortName = (Get-PrinterPort -PrinterName $_.Name).Name; DisplayName = $_.DisplayName; Description = $_.Comment; Status = $_.PrinterStatus; Default = $false } } | ConvertTo-Json`;
        const altResult = execSync(`powershell -Command "${altCmd}"`, { encoding: 'utf-8', timeout: 10000 });
        if (altResult && altResult.trim()) {
          const parsed = JSON.parse(altResult);
          printersData = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`✅ Alternatif yöntem ile ${printersData.length} yazıcı bulundu`);
        }
      } catch (altError) {
        console.error('❌ Alternatif yöntem de başarısız:', altError.message);
        console.error('   Alternatif hata detayı:', altError.stack);
      }
    }
    
    if (printersData.length === 0) {
      console.warn('⚠️ Hiç yazıcı bulunamadı! Sistem yazıcılarını kontrol edin.');
      return {
        success: true,
        printers: {
          usb: [],
          network: [],
          all: []
        }
      };
    }
    
    console.log('\n📝 Bulunan yazıcılar:');
    printersData.forEach((p, index) => {
      console.log(`  ${index + 1}. İsim: "${p.Name || 'yok'}"`);
      console.log(`     Display Name: "${p.DisplayName || 'yok'}"`);
      console.log(`     Description: "${p.Description || 'yok'}"`);
      console.log(`     Port: "${p.PortName || 'yok'}"`);
      console.log(`     Status: ${p.Status || 0}`);
      console.log(`     Default: ${p.Default || false}`);
    });
    
    // Yazıcıları USB ve Ethernet olarak kategorize et
    const usbPrinters = [];
    const networkPrinters = [];
    
    // IP adresi pattern kontrolü için regex
    const ipAddressPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    
    console.log('\n🔍 Yazıcılar kategorize ediliyor...\n');
    
    printersData.forEach((printer, index) => {
      const printerName = printer.Name || '';
      const displayName = printer.DisplayName || printerName;
      const description = printer.Description || '';
      const portName = printer.PortName || '';
      const status = printer.Status || 0;
      const isDefault = printer.Default || false;
      
      console.log(`--- Yazıcı ${index + 1}: "${printerName}" ---`);
      
      const printerInfo = {
        name: printerName,
        displayName: displayName,
        description: description,
        status: status,
        isDefault: isDefault
      };
      
      const portNameLower = portName.toLowerCase();
      
      console.log(`  İsim: "${printerName}"`);
      console.log(`  Display Name: "${displayName}"`);
      console.log(`  Port: "${portName || 'BULUNAMADI'}"`);
      console.log(`  Açıklama: "${description || 'yok'}"`);
      console.log(`  Status: ${status}`);
      console.log(`  Default: ${isDefault}`);
      
      // Network yazıcı kontrolü - daha kapsamlı
      let isNetwork = false;
      const networkReasons = [];
      
      // 1. Port adında IP adresi var mı kontrol et (örn: "IP_192.168.1.152")
      const portHasIP = ipAddressPattern.test(portName);
      if (portHasIP) {
        const ipMatches = portName.match(ipAddressPattern);
        console.log(`  ✓ Port adında IP adresi bulundu: ${ipMatches ? ipMatches.join(', ') : ''}`);
        isNetwork = true;
        networkReasons.push(`Port adında IP: ${ipMatches ? ipMatches[0] : ''}`);
      }
      
      // 2. Port adı TCP/IP içeriyor mu kontrol et
      const portCheck = portNameLower.includes('tcp') || 
                       portNameLower.includes('ip_') || 
                       portNameLower.includes('ip:') || 
                       portNameLower.startsWith('192.') || 
                       portNameLower.startsWith('10.') || 
                       portNameLower.startsWith('172.');
      
      if (portCheck && !portHasIP) {
        console.log(`  ✓ Port adı TCP/IP içeriyor veya IP ile başlıyor`);
        isNetwork = true;
        networkReasons.push('Port TCP/IP içeriyor');
      }
      
      // 3. Yazıcı adında veya açıklamasında network kelimeleri var mı kontrol et
      const printerNameLower = printerName.toLowerCase();
      const descriptionLower = description.toLowerCase();
      
      const hasNetworkKeywords = printerNameLower.includes('network') || 
                                printerNameLower.includes('ethernet') ||
                                printerNameLower.includes('tcp') ||
                                descriptionLower.includes('network') ||
                                descriptionLower.includes('ethernet');
      
      if (hasNetworkKeywords) {
        console.log(`  ✓ İsim/açıklamada network kelimesi bulundu`);
        isNetwork = true;
        networkReasons.push('İsim/açıklamada network kelimesi');
      }
      
      // 4. Yazıcı adında veya açıklamasında IP adresi pattern'i var mı kontrol et
      const nameHasIP = ipAddressPattern.test(printerName);
      const descHasIP = ipAddressPattern.test(description);
      
      if (nameHasIP) {
        const ipMatches = printerName.match(ipAddressPattern);
        console.log(`  ✓ Yazıcı adında IP adresi bulundu: ${ipMatches ? ipMatches.join(', ') : ''}`);
        isNetwork = true;
        networkReasons.push(`İsimde IP: ${ipMatches ? ipMatches[0] : ''}`);
      }
      
      if (descHasIP) {
        const ipMatches = description.match(ipAddressPattern);
        console.log(`  ✓ Açıklamada IP adresi bulundu: ${ipMatches ? ipMatches.join(', ') : ''}`);
        isNetwork = true;
        networkReasons.push(`Açıklamada IP: ${ipMatches ? ipMatches[0] : ''}`);
      }
      
      // Özel IP kontrolü: 192.168.1.152
      const targetIP = '192.168.1.152';
      if (portName.includes(targetIP) || printerName.includes(targetIP) || description.includes(targetIP)) {
        console.log(`  🎯 HEDEF IP (${targetIP}) BULUNDU!`);
        isNetwork = true;
        networkReasons.push(`Hedef IP: ${targetIP}`);
      }
      
      console.log(`  📊 Network yazıcı mı? ${isNetwork ? 'EVET' : 'HAYIR'}`);
      if (isNetwork && networkReasons.length > 0) {
        console.log(`  📋 Nedenleri: ${networkReasons.join(', ')}`);
      }
      
      if (isNetwork) {
        networkPrinters.push(printerInfo);
        console.log(`  ✅ Network yazıcılar listesine eklendi\n`);
      } else {
        usbPrinters.push(printerInfo);
        console.log(`  ✅ USB yazıcılar listesine eklendi\n`);
      }
    });
    
    console.log('\n=== KATEGORİZASYON SONUÇLARI ===');
    console.log(`📦 USB Yazıcılar: ${usbPrinters.length}`);
    usbPrinters.forEach(p => console.log(`   - ${p.name}`));
    console.log(`🌐 Network Yazıcılar: ${networkPrinters.length}`);
    networkPrinters.forEach(p => console.log(`   - ${p.name}`));
    console.log('================================\n');
    
    return {
      success: true,
      printers: {
        usb: usbPrinters,
        network: networkPrinters,
        all: printersData.map(p => ({
          name: p.Name || '',
          displayName: p.DisplayName || p.Name || '',
          description: p.Description || '',
          status: p.Status || 0,
          isDefault: p.Default || false
        }))
      }
    };
  } catch (error) {
    console.error('❌❌❌ YAZICI LİSTELEME HATASI ❌❌❌');
    console.error('Hata mesajı:', error.message);
    console.error('Hata detayı:', error.stack);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('assign-category-to-printer', (event, assignmentData) => {
  const { printerName, printerType, category_id } = assignmentData;
  
  if (!printerName || !printerType || !category_id) {
    return { success: false, error: 'Yazıcı adı, tipi ve kategori ID gerekli' };
  }
  
  // Mevcut atamayı bul (aynı yazıcı + aynı kategori kombinasyonu)
  const existingIndex = db.printerAssignments.findIndex(
    a => a.printerName === printerName && 
         a.printerType === printerType && 
         Number(a.category_id) === Number(category_id)
  );
  
  const assignment = {
    printerName,
    printerType,
    category_id: Number(category_id)
  };
  
  if (existingIndex >= 0) {
    // Zaten varsa güncelle
    db.printerAssignments[existingIndex] = assignment;
  } else {
    // Yoksa yeni ekle
    db.printerAssignments.push(assignment);
  }
  
  saveDatabase();
  return { success: true, assignment };
});

ipcMain.handle('get-printer-assignments', () => {
  return db.printerAssignments;
});

ipcMain.handle('remove-printer-assignment', (event, printerName, printerType, categoryId) => {
  // categoryId belirtilmişse, sadece o kategori atamasını kaldır
  // categoryId belirtilmemişse, o yazıcıya ait tüm atamaları kaldır
  let index;
  
  if (categoryId !== undefined && categoryId !== null) {
    // Belirli bir kategori atamasını kaldır
    index = db.printerAssignments.findIndex(
      a => a.printerName === printerName && 
           a.printerType === printerType && 
           Number(a.category_id) === Number(categoryId)
    );
  } else {
    // Tüm kategori atamalarını kaldır (eski davranış - geriye dönük uyumluluk için)
    index = db.printerAssignments.findIndex(
      a => a.printerName === printerName && a.printerType === printerType
    );
  }
  
  if (index >= 0) {
    db.printerAssignments.splice(index, 1);
    saveDatabase();
    return { success: true };
  }
  
  return { success: false, error: 'Atama bulunamadı' };
});

// Kasa yazıcısı ayarları
ipcMain.handle('set-cashier-printer', (event, printerData) => {
  if (!printerData) {
    db.settings.cashierPrinter = null;
  } else {
    db.settings.cashierPrinter = {
      printerName: printerData.printerName,
      printerType: printerData.printerType
    };
  }
  saveDatabase();
  console.log('💰 Kasa yazıcısı ayarlandı:', db.settings.cashierPrinter);
  return { success: true, cashierPrinter: db.settings.cashierPrinter };
});

ipcMain.handle('get-cashier-printer', () => {
  return db.settings.cashierPrinter || null;
});

// Adisyon yazdırma handler - Kategori bazlı yazdırma yapar
ipcMain.handle('print-adisyon', async (event, adisyonData) => {
  console.log('\n=== ADİSYON YAZDIRMA İŞLEMİ BAŞLADI ===');
  console.log('📄 AdisyonData:', JSON.stringify(adisyonData, null, 2));
  
  try {
    if (!mainWindow) {
      console.error('❌ Ana pencere bulunamadı');
      return { success: false, error: 'Ana pencere bulunamadı' };
    }

    const items = adisyonData.items || [];
    console.log(`   Toplam ${items.length} ürün bulundu`);
    
    // Eğer cashierOnly flag'i true ise, sadece kasa yazıcısından fiyatlı fiş yazdır
    if (adisyonData.cashierOnly === true) {
      console.log('   💰 Sadece kasa yazıcısından fiyatlı fiş yazdırılıyor...');
      
      const cashierPrinter = db.settings.cashierPrinter;
      if (!cashierPrinter || !cashierPrinter.printerName) {
        console.error('   ❌ Kasa yazıcısı ayarlanmamış');
        return { success: false, error: 'Kasa yazıcısı ayarlanmamış' };
      }
      
      // Receipt formatında fiyatlı fiş oluştur
      const receiptData = {
        sale_id: null,
        totalAmount: items.reduce((sum, item) => {
          if (item.isGift) return sum;
          return sum + (item.price * item.quantity);
        }, 0),
        paymentMethod: 'Adisyon',
        sale_date: adisyonData.sale_date || new Date().toLocaleDateString('tr-TR'),
        sale_time: adisyonData.sale_time || getFormattedTime(new Date()),
        items: items,
        orderNote: adisyonData.orderNote || null,
        tableName: adisyonData.tableName || null,
        tableType: adisyonData.tableType || null,
        cashierOnly: true
      };
      
      // Kasa yazıcısından fiyatlı fiş yazdır
      await printToPrinter(
        cashierPrinter.printerName,
        cashierPrinter.printerType,
        receiptData,
        false,
        null
      );
      
      console.log(`\n=== KASA YAZICISINDAN FİYATLI FİŞ YAZDIRMA TAMAMLANDI ===`);
      return { success: true, error: null };
    }
    
    // Normal kategori bazlı adisyon yazdırma
    await printAdisyonByCategory(items, adisyonData);
    
    console.log(`\n=== ADİSYON YAZDIRMA İŞLEMİ TAMAMLANDI ===`);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('\n❌❌❌ ADİSYON YAZDIRMA HATASI ❌❌❌');
    console.error('Hata mesajı:', error.message);
    console.error('Hata detayı:', error.stack);
    return { success: false, error: error.message };
  }
});

// Adisyon yazdırma fonksiyonu
async function printAdisyonToPrinter(printerName, printerType, items, adisyonData) {
  let printWindow = null;
  
  try {
    console.log(`   [printAdisyonToPrinter] Adisyon yazdırılıyor: "${printerName || 'Varsayılan'}"`);
    
    // Adisyon HTML içeriğini oluştur
    const adisyonHTML = generateAdisyonHTML(items, adisyonData);

    // Gizli bir pencere oluştur ve adisyon içeriğini yükle
    printWindow = new BrowserWindow({
      show: false,
      width: 220, // 58mm ≈ 220px (72 DPI'da)
      height: 3000,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let printResolve, printReject;
    const printPromise = new Promise((resolve, reject) => {
      printResolve = resolve;
      printReject = reject;
    });

    // Yazıcı adını başlangıçta belirle (dışarıda kullanılabilmesi için)
    let targetPrinterName = printerName;

    // Hem did-finish-load hem de dom-ready event'lerini dinle
    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      
      console.log('İçerik yüklendi, yazdırma başlatılıyor...');
      
      // İçeriğin tamamen render edilmesi için daha uzun bir bekleme
      setTimeout(async () => {
        console.log('Yazdırma komutu gönderiliyor...');
        
        // İçeriğin tamamen render edildiğinden emin olmak için scroll yüksekliğini kontrol et ve pencere boyutunu ayarla
        try {
          const scrollHeight = await printWindow.webContents.executeJavaScript(`
            (function() {
              document.body.style.minHeight = 'auto';
              document.body.style.height = 'auto';
              document.documentElement.style.height = 'auto';
              const height = Math.max(
                document.body.scrollHeight, 
                document.body.offsetHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
              );
              return height;
            })();
          `);
          
          console.log('Sayfa yüksekliği:', scrollHeight, 'px');
          
          // Pencere yüksekliğini içeriğe göre ayarla (en az 3000px, içerik daha uzunsa onu kullan)
          const windowHeight = Math.max(3000, scrollHeight + 200);
          printWindow.setSize(220, windowHeight);
          console.log('Pencere yüksekliği ayarlandı:', windowHeight, 'px');
          
          // Ekstra bir kısa bekleme - pencere boyutu değişikliğinin uygulanması için
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log('Yükseklik kontrolü hatası:', error);
        }
        
        // Yazıcı adını belirle (güncelle)
        targetPrinterName = printerName;
        
        if (targetPrinterName) {
          console.log(`   🎯 Yazıcı adı belirtildi: "${targetPrinterName}"`);
          console.log(`   🔍 Yazıcının sistemde mevcut olup olmadığı kontrol ediliyor...`);
          
          // Sistem yazıcılarını al
          try {
            const powershellCmd = `Get-WmiObject Win32_Printer | Select-Object Name | ConvertTo-Json`;
            const result = execSync(`powershell -Command "${powershellCmd}"`, { 
              encoding: 'utf-8',
              timeout: 5000 
            });
            
            const printersData = JSON.parse(result);
            const printersArray = Array.isArray(printersData) ? printersData : [printersData];
            const availablePrinters = printersArray.map(p => p.Name || '').filter(n => n);
            
            console.log(`   📋 Sistemde ${availablePrinters.length} yazıcı bulundu`);
            
            // Yazıcı adını kontrol et (tam eşleşme veya kısmi eşleşme)
            const exactMatch = availablePrinters.find(p => p === targetPrinterName);
            const partialMatch = availablePrinters.find(p => p.includes(targetPrinterName) || targetPrinterName.includes(p));
            
            if (exactMatch) {
              targetPrinterName = exactMatch;
              console.log(`   ✅ Yazıcı bulundu (tam eşleşme): "${targetPrinterName}"`);
            } else if (partialMatch) {
              targetPrinterName = partialMatch;
              console.log(`   ✅ Yazıcı bulundu (kısmi eşleşme): "${targetPrinterName}"`);
            } else {
              console.warn(`   ⚠️ Yazıcı "${targetPrinterName}" sistemde bulunamadı!`);
              console.log(`   📋 Mevcut yazıcılar:`, availablePrinters);
              console.log(`   → Varsayılan yazıcı kullanılacak`);
              targetPrinterName = null; // Varsayılan yazıcıya yazdır
            }
          } catch (error) {
            console.error(`   ❌ Yazıcı kontrolü hatası:`, error.message);
            console.log(`   → Belirtilen yazıcı adı kullanılacak: "${targetPrinterName}"`);
          }
        } else {
          console.log(`   ℹ️ Yazıcı adı belirtilmedi, varsayılan yazıcı kullanılacak`);
        }
        
        // Yazdırma seçenekleri
        const printOptions = {
          silent: true, // Dialog gösterme
          printBackground: true,
          margins: {
            marginType: 'none' // Kenar boşluğu yok
          },
          landscape: false, // Dikey yönlendirme
          scaleFactor: 100,
          pagesPerSheet: 1,
          collate: false,
          color: false, // Siyah-beyaz (termal yazıcılar için)
          copies: 1,
          duplex: 'none'
        };
        
        // Yazıcı adı belirtilmişse ekle
        if (targetPrinterName) {
          printOptions.deviceName = targetPrinterName;
          console.log(`   📤 Yazdırma seçenekleri:`);
          console.log(`      - Yazıcı: "${targetPrinterName}"`);
          console.log(`      - Tip: ${printerType}`);
        } else {
          console.log(`   📤 Varsayılan yazıcıya yazdırılacak`);
        }

        console.log(`   🖨️ Yazdırma komutu gönderiliyor...`);
        printWindow.webContents.print(printOptions, (success, errorType) => {
          console.log(`\n   📥 Yazdırma callback alındı`);
          console.log(`      - Başarılı: ${success}`);
          console.log(`      - Yazıcı: "${targetPrinterName || 'Varsayılan'}"`);
          console.log(`      - Tip: ${printerType}`);
          
          if (!success) {
            console.error(`      ❌ Adisyon yazdırma başarısız!`);
            console.error(`      Hata tipi: ${errorType}`);
            printReject(new Error(errorType || 'Adisyon yazdırma başarısız'));
          } else {
            console.log(`      ✅ Adisyon yazdırma başarılı!`);
            console.log(`      🖨️ "${targetPrinterName || 'Varsayılan yazıcı'}" yazıcısına yazdırıldı`);
            printResolve(true);
          }
          
          // Yazdırma işlemi tamamlandıktan sonra pencereyi kapat
          setTimeout(() => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
              printWindow = null;
            }
          }, 1000);
        });
      }, 2000); // 2 saniye bekle - içeriğin tamamen render edilmesi için
    };

    printWindow.webContents.once('did-finish-load', () => {
      console.log('did-finish-load event tetiklendi');
      startPrint();
    });

    printWindow.webContents.once('dom-ready', () => {
      console.log('dom-ready event tetiklendi');
      startPrint();
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(adisyonHTML)}`);
    console.log('HTML URL yüklendi');

    // Fallback: Eğer 3 saniye içinde hiçbir event tetiklenmezse yine de yazdır
    setTimeout(() => {
      console.log('Fallback timeout: Yazdırma zorla başlatılıyor...');
      startPrint();
    }, 3000);

    // Yazdırma işleminin tamamlanmasını bekle (max 10 saniye)
    await Promise.race([
      printPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Adisyon yazdırma timeout')), 10000))
    ]);

    console.log(`   [printAdisyonToPrinter] Adisyon yazdırma işlemi tamamlandı`);
    return { success: true, printerName: targetPrinterName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printAdisyonToPrinter] Hata:`, error.message);
    console.error(`   Hata detayı:`, error.stack);
    
    // Hata durumunda pencereyi temizle
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    
    return { success: false, error: error.message, printerName: printerName || 'Varsayılan' };
  }
}

// Kategori bazlı adisyon yazdırma fonksiyonu
async function printAdisyonByCategory(items, adisyonData) {
  console.log('\n=== KATEGORİ BAZLI ADİSYON YAZDIRMA BAŞLIYOR ===');
  console.log(`   Toplam ${items.length} ürün bulundu`);
  
  try {
    // 1. ÖNCE: Ürünleri personel ve zaman bazında grupla
    // Her personel grubu için ayrı adisyon oluşturulacak
    const staffGroupsMap = new Map(); // staffKey -> { staffName, staffTime, staffDate, items: [] }
    
    for (const item of items) {
      // Item'dan personel bilgisini al (staff_name, added_time, added_date)
      const staffName = item.staff_name || null;
      const itemTime = item.added_time || adisyonData.sale_time || getFormattedTime(new Date());
      const itemDate = item.added_date || adisyonData.sale_date || new Date().toLocaleDateString('tr-TR');
      
      // Personel key'i oluştur (personel adı + tarih + saat kombinasyonu)
      // Aynı personel, aynı tarih ve saatte eklenen ürünler aynı grupta olacak
      const staffKey = `${staffName || 'Kasa'}::${itemDate}::${itemTime}`;
      
      if (!staffGroupsMap.has(staffKey)) {
        staffGroupsMap.set(staffKey, {
          staffName: staffName,
          staffTime: itemTime,
          staffDate: itemDate,
          items: []
        });
      }
      
      staffGroupsMap.get(staffKey).items.push(item);
    }
    
    console.log(`\n👥 Personel grupları oluşturuldu: ${staffGroupsMap.size} grup`);
    staffGroupsMap.forEach((group, key) => {
      console.log(`   - "${group.staffName || 'Kasa'}": ${group.items.length} ürün (${group.staffDate} ${group.staffTime})`);
    });
    
    // 2. Her personel grubu için ayrı adisyon yazdır
    const staffGroups = Array.from(staffGroupsMap.values());
    
    for (let staffGroupIndex = 0; staffGroupIndex < staffGroups.length; staffGroupIndex++) {
      const staffGroup = staffGroups[staffGroupIndex];
      
      console.log(`\n📋 Personel Grubu ${staffGroupIndex + 1}/${staffGroups.length}: "${staffGroup.staffName || 'Kasa'}" (${staffGroup.staffDate} ${staffGroup.staffTime})`);
      
      // Bu personel grubunun ürünlerini kategorilerine göre grupla
      const categoryItemsMap = new Map(); // categoryId -> items[]
      const categoryInfoMap = new Map(); // categoryId -> { name, id }
      
      for (const item of staffGroup.items) {
        // Ürünün kategori ID'sini bul
        const product = db.products.find(p => p.id === item.id);
        if (product && product.category_id) {
          const categoryId = product.category_id;
          const category = db.categories.find(c => c.id === categoryId);
          
          if (!categoryItemsMap.has(categoryId)) {
            categoryItemsMap.set(categoryId, []);
            categoryInfoMap.set(categoryId, {
              id: categoryId,
              name: category?.name || `Kategori ${categoryId}`
            });
          }
          categoryItemsMap.get(categoryId).push(item);
        } else {
          // Kategori bulunamazsa, 'no-category' key kullan
          if (!categoryItemsMap.has('no-category')) {
            categoryItemsMap.set('no-category', []);
            categoryInfoMap.set('no-category', {
              id: 'no-category',
              name: 'Diğer'
            });
          }
          categoryItemsMap.get('no-category').push(item);
        }
      }
      
      console.log(`   📋 Kategori grupları: ${categoryItemsMap.size} kategori`);
      
      // 3. Kategorileri yazıcılara göre grupla (aynı yazıcıya atanmış kategorileri birleştir)
      const printerGroupsMap = new Map(); // printerKey -> { printerName, printerType, categories: [{ categoryId, categoryName, items }] }
      
      categoryItemsMap.forEach((categoryItems, categoryId) => {
        const categoryIdNum = typeof categoryId === 'string' && categoryId !== 'no-category' ? parseInt(categoryId) : categoryId;
        const categoryInfo = categoryInfoMap.get(categoryId);
        
        // Bu kategori için atanmış yazıcıyı bul
        const assignment = db.printerAssignments.find(a => {
          const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
          return assignmentCategoryId === categoryIdNum;
        });
        
        let printerName, printerType;
        
        if (assignment) {
          printerName = assignment.printerName;
          printerType = assignment.printerType;
          console.log(`   ✓ Kategori "${categoryInfo.name}" (ID: ${categoryId}) için yazıcı bulundu: "${printerName}"`);
        } else {
          // Kategori ataması yoksa atla (kasa yazıcısına adisyon yazdırma)
          console.warn(`   ⚠️ Kategori "${categoryInfo.name}" (ID: ${categoryId}) için yazıcı ataması yok, atlanıyor`);
          return; // Kasa yazıcısına adisyon yazdırma
        }
        
        // Yazıcı key'i oluştur (aynı yazıcıyı gruplamak için)
        const printerKey = `${printerName}::${printerType}`;
        
        if (!printerGroupsMap.has(printerKey)) {
          printerGroupsMap.set(printerKey, {
            printerName,
            printerType,
            categories: []
          });
        }
        
        // Bu kategoriyi yazıcı grubuna ekle
        printerGroupsMap.get(printerKey).categories.push({
          categoryId,
          categoryName: categoryInfo.name,
          items: categoryItems
        });
      });
      
      console.log(`   🖨️ Yazıcı grupları: ${printerGroupsMap.size} yazıcı`);
      
      // 4. Her yazıcı için tek bir adisyon yazdır (kategoriler başlıklarla ayrılmış)
      const printJobs = Array.from(printerGroupsMap.values());
      
      for (let i = 0; i < printJobs.length; i++) {
        const job = printJobs[i];
        
        // Tüm kategorilerin ürünlerini birleştir (kategori bilgisiyle)
        const allItemsWithCategory = [];
        job.categories.forEach(cat => {
          cat.items.forEach(item => {
            allItemsWithCategory.push({
              ...item,
              _categoryId: cat.categoryId,
              _categoryName: cat.categoryName
            });
          });
        });
        
        // Bu personel grubu için özel adisyon data'sı oluştur
        const printerAdisyonData = {
          ...adisyonData,
          items: allItemsWithCategory,
          categories: job.categories.map(cat => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            items: cat.items
          })),
          // Personel grubunun bilgilerini kullan
          sale_date: staffGroup.staffDate,
          sale_time: staffGroup.staffTime,
          staff_name: staffGroup.staffName
        };
        
        console.log(`\n   🖨️ ADİSYON YAZDIRMA ${i + 1}/${printJobs.length}`);
        console.log(`      Yazıcı: "${job.printerName}"`);
        console.log(`      Personel: "${staffGroup.staffName || 'Kasa'}"`);
        console.log(`      Tarih/Saat: ${staffGroup.staffDate} ${staffGroup.staffTime}`);
        console.log(`      Kategori sayısı: ${job.categories.length}`);
        console.log(`      Toplam ürün sayısı: ${allItemsWithCategory.length}`);
        
        await printAdisyonToPrinter(
          job.printerName,
          job.printerType,
          allItemsWithCategory,
          printerAdisyonData
        ).catch(err => {
          console.error(`      ❌ Adisyon yazdırma hatası:`, err);
        });
        
        // Yazıcılar arası kısa bekleme
        if (i < printJobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Personel grupları arası kısa bekleme
      if (staffGroupIndex < staffGroups.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`\n=== KATEGORİ BAZLI ADİSYON YAZDIRMA TAMAMLANDI ===`);
  } catch (error) {
    console.error('\n❌ KATEGORİ BAZLI ADİSYON YAZDIRMA HATASI:', error);
    // Hata durumunda kasa yazıcısına yazdırma yapma (sadece kategori bazlı yazıcılara yazdır)
  }
}

// Modern ve profesyonel adisyon HTML formatı
function generateAdisyonHTML(items, adisyonData) {
  // Garson ismini adisyonData'dan al (eğer yoksa items'dan al)
  const staffName = adisyonData.staff_name || (items.length > 0 && items[0].staff_name ? items[0].staff_name : null);
  
  // Eğer kategori bilgisi varsa, kategorilere göre grupla
  const hasCategories = adisyonData.categories && adisyonData.categories.length > 0;
  
  let itemsHTML = '';
  
  if (hasCategories) {
    // Kategorilere göre gruplanmış format
    adisyonData.categories.forEach((category, catIndex) => {
      // Kategori başlığı
      itemsHTML += `
        <div style="margin: ${catIndex > 0 ? '16px' : '0'} 0 10px 0; padding: 6px 10px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 6px; box-shadow: 0 2px 4px rgba(59,130,246,0.3);">
          <h3 style="margin: 0; font-size: 11px; font-weight: 900; color: white; font-family: 'Montserrat', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
            📦 ${category.categoryName}
          </h3>
        </div>
      `;
      
      // Kategori ürünleri
      category.items.forEach(item => {
        const isGift = item.isGift || false;
        
        if (isGift) {
          itemsHTML += `
          <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 3px solid #16a34a; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
                <span style="font-weight: 900; font-size: 12px; color: #166534; font-family: 'Montserrat', sans-serif; text-decoration: line-through; opacity: 0.6;">${item.name}</span>
                <span style="font-size: 7px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 2px 5px; border-radius: 10px; font-weight: 900; box-shadow: 0 1px 3px rgba(22,163,74,0.3);">İKRAM</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 10px; color: #166534; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
            </div>
            ${item.extraNote ? `
            <div style="margin-top: 4px; padding: 4px; background: white; border-radius: 3px; border-left: 2px solid #fbbf24;">
              <p style="font-size: 8px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
            </div>
            ` : ''}
          </div>
        `;
        } else {
          itemsHTML += `
          <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-left: 3px solid #3b82f6; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 900; font-size: 12px; color: #1e293b; font-family: 'Montserrat', sans-serif;">${item.name}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 10px; color: #475569; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
            </div>
            ${item.extraNote ? `
            <div style="margin-top: 4px; padding: 4px; background: #fef3c7; border-radius: 3px; border-left: 2px solid #f59e0b;">
              <p style="font-size: 8px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
            </div>
            ` : ''}
          </div>
        `;
        }
      });
    });
  } else {
    // Kategori bilgisi yoksa eski format (geriye dönük uyumluluk)
    itemsHTML = items.map(item => {
      const isGift = item.isGift || false;
      
      if (isGift) {
        return `
        <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 3px solid #16a34a; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
              <span style="font-weight: 900; font-size: 12px; color: #166534; font-family: 'Montserrat', sans-serif; text-decoration: line-through; opacity: 0.6;">${item.name}</span>
              <span style="font-size: 7px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 2px 5px; border-radius: 10px; font-weight: 900; box-shadow: 0 1px 3px rgba(22,163,74,0.3);">İKRAM</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; color: #166534; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
          </div>
          ${item.extraNote ? `
          <div style="margin-top: 4px; padding: 4px; background: white; border-radius: 3px; border-left: 2px solid #fbbf24;">
            <p style="font-size: 8px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
          </div>
          ` : ''}
        </div>
      `;
      }
      
      return `
        <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-left: 3px solid #3b82f6; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 900; font-size: 12px; color: #1e293b; font-family: 'Montserrat', sans-serif;">${item.name}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; color: #475569; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
          </div>
          ${item.extraNote ? `
          <div style="margin-top: 4px; padding: 4px; background: #fef3c7; border-radius: 3px; border-left: 2px solid #f59e0b;">
            <p style="font-size: 8px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
      <style>
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
            min-height: 100%;
          }
          body {
            margin: 0;
            padding: 8px 8px 12px 8px;
            height: auto;
            min-height: 100%;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        * {
          box-sizing: border-box;
          font-family: 'Montserrat', sans-serif;
        }
        body {
          font-family: 'Montserrat', sans-serif;
          width: 58mm;
          max-width: 58mm;
          padding: 8px 8px 15px 8px;
          margin: 0;
          font-size: 12px;
          min-height: 100%;
          height: auto;
          overflow: visible;
          color: #000;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        html {
          height: auto;
          min-height: 100%;
        }
        .info {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 8px;
          padding: 10px;
          margin: 0 0 10px 0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .info div {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 9px;
          font-weight: 700;
          color: #475569;
          font-family: 'Montserrat', sans-serif;
        }
        .info div span:last-child {
          color: #1e293b;
          font-weight: 900;
        }
        .info .table-row {
          display: block;
          margin: 0 0 8px 0;
          padding: 0;
        }
        .info .table-row .table-label {
          font-size: 9px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 4px;
        }
        .info .table-row .table-value {
          font-size: 18px;
          font-weight: 900;
          color: #1e293b;
          font-family: 'Montserrat', sans-serif;
          line-height: 1.2;
        }
        .info .staff-row {
          display: block;
          margin: 6px 0 0 0;
          padding: 6px 8px;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 4px;
          border-left: 2px solid #8b5cf6;
        }
        .info .staff-row .staff-label {
          font-size: 8px;
          font-weight: 700;
          color: #6d28d9;
          margin-bottom: 2px;
        }
        .info .staff-row .staff-value {
          font-size: 10px;
          font-weight: 900;
          color: #6d28d9;
          font-family: 'Montserrat', sans-serif;
        }
        .items {
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 3px solid #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          font-family: 'Montserrat', sans-serif;
        }
        .footer p {
          margin: 4px 0;
          font-weight: 900;
          color: #1e293b;
        }
      </style>
    </head>
    <body>
      <div class="info">
        ${adisyonData.tableName ? `
        <div class="table-row">
          <div class="table-label">Masa:</div>
          <div class="table-value">${adisyonData.tableName}</div>
        </div>
        ` : ''}
        ${staffName ? `
        <div class="staff-row">
          <div class="staff-label">👤 Garson:</div>
          <div class="staff-value">${staffName}</div>
        </div>
        ` : ''}
        <div>
          <span>Tarih:</span>
          <span>${adisyonData.sale_date || new Date().toLocaleDateString('tr-TR')}</span>
        </div>
        <div>
          <span>Saat:</span>
          <span>${adisyonData.sale_time || getFormattedTime(new Date())}</span>
        </div>
      </div>

      <div class="items">
        ${itemsHTML}
      </div>
      
      ${adisyonData.orderNote ? `
      <div style="margin: 10px 0; padding: 8px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size: 9px; font-weight: 900; color: #92400e; margin: 0 0 4px 0; font-family: 'Montserrat', sans-serif;">📝 Sipariş Notu:</p>
        <p style="font-size: 9px; font-weight: 700; color: #78350f; margin: 0; font-family: 'Montserrat', sans-serif;">${adisyonData.orderNote}</p>
      </div>
      ` : ''}

    </body>
    </html>
  `;
}

// Mobil HTML oluştur
// İptal fişi HTML formatı
function generateCancelReceiptHTML(cancelData) {
  const tableTypeText = cancelData.tableType === 'inside' ? 'İç Masa' : 'Dış Masa';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
      <style>
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
            min-height: 100%;
          }
          body {
            margin: 0;
            padding: 8px 8px 12px 8px;
            height: auto;
            min-height: 100%;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            color: #000 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        body {
          font-family: 'Montserrat', sans-serif;
          background: white;
          color: #000;
          margin: 0;
          padding: 8px;
          font-size: 10px;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 12px; padding: 8px; background: white; border: 2px solid #000; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <p style="margin: 0; font-size: 9px; color: #000; font-weight: 700; text-transform: uppercase;">Masa</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 900; color: #000;">${tableTypeText} ${cancelData.tableName}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 12px; padding: 10px; background: white; border: 2px solid #000; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <p style="margin: 0; font-size: 9px; color: #000; font-weight: 700; text-transform: uppercase;">Ürün</p>
          ${cancelData.items && cancelData.items.length > 1 
            ? cancelData.items.map(item => `
              <div style="margin-top: 6px; padding-bottom: 6px; border-bottom: 1px solid #ccc;">
                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #000; text-decoration: line-through; text-decoration-thickness: 2px;">${item.productName}</p>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  <span style="font-size: 9px; color: #000; font-weight: 700;">${item.quantity} adet</span>
                  <span style="font-size: 9px; color: #000; font-weight: 700;">₺${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            `).join('')
            : `
              <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 900; color: #000; text-decoration: line-through; text-decoration-thickness: 3px;">${cancelData.productName}</p>
            `
          }
          <span style="display: inline-block; font-size: 8px; color: #000; font-weight: 700; padding: 2px 6px; border: 1px solid #000; border-radius: 3px; margin-top: 4px;">iptal</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 2px solid #000;">
          <div>
            <p style="margin: 0; font-size: 8px; color: #000; font-weight: 700;">Toplam Adet</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 900; color: #000;">${cancelData.quantity} adet</p>
          </div>
          ${!cancelData.items || cancelData.items.length === 1 ? `
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 8px; color: #000; font-weight: 700;">Birim Fiyat</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 900; color: #000;">₺${cancelData.price.toFixed(2)}</p>
          </div>
          ` : ''}
        </div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 3px solid #000;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-size: 9px; color: #000; font-weight: 700; text-transform: uppercase;">Toplam</p>
            <p style="margin: 0; font-size: 16px; font-weight: 900; color: #000;">₺${cancelData.items && cancelData.items.length > 1 
              ? cancelData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)
              : (cancelData.price * cancelData.quantity).toFixed(2)
            }</p>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 12px; padding-top: 8px; border-top: 2px solid #000; text-align: center;">
        <p style="margin: 0; font-size: 8px; color: #000; font-weight: 700;">
          ${cancelData.cancelDate} ${cancelData.cancelTime}
        </p>
        <p style="margin: 4px 0 0 0; font-size: 7px; color: #000; font-weight: 600;">
          Kategori: ${cancelData.categoryName}
        </p>
      </div>
    </body>
    </html>
  `;
}

// İptal fişi yazdırma fonksiyonu
async function printCancelReceipt(printerName, printerType, cancelData) {
  let printWindow = null;
  
  try {
    console.log(`   [printCancelReceipt] İptal fişi yazdırılıyor: "${printerName || 'Varsayılan'}"`);
    
    // İptal fişi HTML içeriğini oluştur
    const cancelHTML = generateCancelReceiptHTML(cancelData);

    // Gizli bir pencere oluştur ve içeriği yükle
    printWindow = new BrowserWindow({
      show: false,
      width: 220, // 58mm ≈ 220px (72 DPI'da)
      height: 3000,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let printResolve, printReject;
    const printPromise = new Promise((resolve, reject) => {
      printResolve = resolve;
      printReject = reject;
    });

    let targetPrinterName = printerName;
    let printStarted = false;
    
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      
      setTimeout(async () => {
        // Yazıcı kontrolü
        if (targetPrinterName) {
          try {
            const powershellCmd = `Get-WmiObject Win32_Printer | Select-Object Name | ConvertTo-Json`;
            const result = execSync(`powershell -Command "${powershellCmd}"`, { 
              encoding: 'utf-8',
              timeout: 5000 
            });
            
            const printersData = JSON.parse(result);
            const printersArray = Array.isArray(printersData) ? printersData : [printersData];
            const availablePrinters = printersArray.map(p => p.Name || '').filter(n => n);
            
            const exactMatch = availablePrinters.find(p => p === targetPrinterName);
            const partialMatch = availablePrinters.find(p => p.includes(targetPrinterName) || targetPrinterName.includes(p));
            
            if (exactMatch) {
              targetPrinterName = exactMatch;
            } else if (partialMatch) {
              targetPrinterName = partialMatch;
            } else {
              targetPrinterName = null;
            }
          } catch (error) {
            console.error(`   ❌ Yazıcı kontrolü hatası:`, error.message);
          }
        }
        
        const printOptions = {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          landscape: false,
          scaleFactor: 100,
          pagesPerSheet: 1,
          collate: false,
          color: false,
          copies: 1,
          duplex: 'none'
        };
        
        if (targetPrinterName) {
          printOptions.deviceName = targetPrinterName;
        }

        printWindow.webContents.print(printOptions, (success, errorType) => {
          if (!success) {
            printReject(new Error(errorType || 'İptal fişi yazdırma başarısız'));
          } else {
            console.log(`      ✅ İptal fişi yazdırma başarılı!`);
            printResolve(true);
          }
          
          setTimeout(() => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
              printWindow = null;
            }
          }, 1000);
        });
      }, 2000);
    };

    printWindow.webContents.once('did-finish-load', () => {
      startPrint();
    });

    printWindow.webContents.once('dom-ready', () => {
      startPrint();
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(cancelHTML)}`);

    setTimeout(() => {
      startPrint();
    }, 3000);

    await Promise.race([
      printPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('İptal fişi yazdırma timeout')), 10000))
    ]);

    return { success: true, printerName: targetPrinterName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printCancelReceipt] Hata:`, error.message);
    
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    
    throw error;
  }
}

function generateMobileHTML(serverURL) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#ec4899">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="MAKARA Mobil">
  <link rel="manifest" href="${serverURL}/mobile-manifest.json">
  <link rel="icon" type="image/png" href="${serverURL}/mobilpersonel.png">
  <link rel="apple-touch-icon" href="${serverURL}/mobilpersonel.png">
  <title>MAKARA - Mobil Sipariş</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); 
      min-height: 100vh; 
      padding: 10px; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 20px; 
      padding: 15px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); 
      min-height: calc(100vh - 20px);
    }
    .table-type-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
      background: #f5f5f5;
      padding: 5px;
      border-radius: 12px;
    }
    .table-type-tab {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: transparent;
      font-size: 16px;
      font-weight: bold;
      color: #666;
      cursor: pointer;
      transition: all 0.3s;
    }
    .table-type-tab[data-type="inside"] {
      background: #dbeafe;
      color: #1e40af;
    }
    .table-type-tab[data-type="inside"].active {
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .table-type-tab[data-type="outside"] {
      background: #fff7ed;
      color: #c2410c;
    }
    .table-type-tab[data-type="outside"].active {
      background: linear-gradient(135deg, #f97316 0%, #fbbf24 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
    }
    .table-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .table-btn {
      aspect-ratio: 1;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      background: white;
      font-size: 14px;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      transition: all 0.3s;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: 5px;
    }
    .table-btn.outside-empty {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-color: #facc15;
      color: #92400e;
    }
    .table-btn:active {
      transform: scale(0.95);
    }
    .table-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }
    .transfer-table-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
    }
    .package-table-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    .package-table-btn:hover .table-number {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    .table-btn.selected {
      border-color: #a855f7;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
    }
    .table-btn.has-order {
      border-color: #047857;
      background: linear-gradient(135deg, #065f46 0%, #022c22 100%);
      color: #ecfdf5;
    }
    .table-btn.has-order.selected {
      border-color: #22c55e;
      background: linear-gradient(135deg, #047857 0%, #022c22 100%);
      color: #ecfdf5;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5);
    }
    .table-btn.has-order::before {
      content: '●';
      position: absolute;
      top: 5px;
      right: 5px;
      color: #22c55e;
      font-size: 16px;
    }
    .table-btn.has-order.selected::before {
      color: white;
    }
    .table-number {
      font-size: 16px;
      font-weight: bold;
    }
    .table-label {
      font-size: 10px;
      opacity: 0.8;
      margin-top: 2px;
    }
    .table-btn.outside-empty .table-number,
    .table-btn.outside-empty .table-label {
      color: #92400e;
    }
    .category-tabs {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-bottom: 8px;
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #a855f7 #f1f1f1;
    }
    .category-tabs::-webkit-scrollbar {
      height: 6px;
    }
    .category-tabs::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    .category-tabs::-webkit-scrollbar-thumb {
      background: #a855f7;
      border-radius: 10px;
    }
    .category-tabs::-webkit-scrollbar-thumb:hover {
      background: #9333ea;
    }
    .category-tabs-row {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
      width: max-content;
      min-width: 100%;
      align-items: stretch;
    }
    .category-tab {
      padding: 16px 20px;
      border: 2px solid #e5e7eb;
      border-radius: 14px;
      background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      color: #4b5563;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      text-align: center;
      flex-shrink: 0;
      min-width: fit-content;
      min-height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .category-tab::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
      transition: left 0.5s;
    }
    .category-tab:hover::before {
      left: 100%;
    }
    .category-tab:hover {
      border-color: #d1d5db;
      background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
      transform: translateY(-2px);
      color: #374151;
    }
    .category-tab:active {
      transform: scale(0.97) translateY(0);
    }
    .category-tab.active {
      border-color: #fbcfe8;
      background: linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%);
      color: #ec4899;
      box-shadow: 0 4px 16px rgba(236, 72, 153, 0.25), 0 2px 8px rgba(236, 72, 153, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
      transform: translateY(-2px);
      font-weight: 700;
      position: relative;
    }
    .category-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #f472b6 0%, #ec4899 50%, #f472b6 100%);
      border-radius: 0 0 14px 14px;
      box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
    }
    .products-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 0;
      padding-right: 5px;
    }
    /* Scrollable container for products */
    #orderSection > div:last-child {
      scrollbar-width: thin;
      scrollbar-color: #a855f7 #f1f1f1;
    }
    #orderSection > div:last-child::-webkit-scrollbar {
      width: 6px;
    }
    #orderSection > div:last-child::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    #orderSection > div:last-child::-webkit-scrollbar-thumb {
      background: #a855f7;
      border-radius: 10px;
    }
    #orderSection > div:last-child::-webkit-scrollbar-thumb:hover {
      background: #9333ea;
    }
    .product-card {
      padding: 16px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      background: #1f2937;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4), 0 1px 3px rgba(219, 39, 119, 0.3);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 120px;
      position: relative;
      overflow: hidden;
    }
    .product-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.85) 0%, rgba(219, 39, 119, 0.8) 50%, rgba(236, 72, 153, 0.85) 100%);
      z-index: 1;
    }
    .product-card:hover {
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 4px 16px rgba(236, 72, 153, 0.5), 0 2px 8px rgba(219, 39, 119, 0.4);
      transform: translateY(-2px);
    }
    .product-card:active {
      transform: translateY(0) scale(0.98);
    }
    .product-name {
      font-weight: 700;
      margin-bottom: 8px;
      font-size: 15px;
      color: white;
      line-height: 1.4;
      position: relative;
      z-index: 2;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
    .product-price {
      color: white;
      font-weight: 800;
      font-size: 18px;
      margin-top: auto;
      position: relative;
      z-index: 2;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
    .cart {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 3px solid #a855f7;
      box-shadow: 0 -8px 30px rgba(0,0,0,0.15);
      border-radius: 20px 20px 0 0;
      transform: translateY(calc(100% - 70px));
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      max-height: 80vh;
    }
    .cart.open {
      transform: translateY(0);
    }
    .cart-header {
      padding: 16px 20px;
      border-bottom: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border-radius: 20px 20px 0 0;
    }
    .cart-header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cart-header-title span:first-child {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
    }
    .cart-header-title span:last-child {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      background: white;
      padding: 4px 10px;
      border-radius: 12px;
    }
    .cart-header-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
    }
    .cart-header-icon:active {
      transform: scale(0.95);
      box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
    }
    .cart-content {
      padding: 20px;
      max-height: calc(80vh - 80px);
      overflow-y: auto;
      display: none;
    }
    .cart.open .cart-content {
      display: block;
    }
    .cart-content::-webkit-scrollbar {
      width: 6px;
    }
    .cart-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    .cart-content::-webkit-scrollbar-thumb {
      background: #a855f7;
      border-radius: 10px;
    }
    .cart-items {
      max-height: 250px;
      overflow-y: auto;
      margin-bottom: 20px;
      padding-right: 5px;
    }
    .cart-items::-webkit-scrollbar {
      width: 6px;
    }
    .cart-items::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    .cart-items::-webkit-scrollbar-thumb {
      background: #a855f7;
      border-radius: 10px;
    }
    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px;
      margin-bottom: 10px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      transition: all 0.3s;
    }
    .cart-item:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }
    .cart-item-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .qty-btn {
      width: 36px;
      height: 36px;
      border: 2px solid #a855f7;
      border-radius: 10px;
      background: white;
      color: #a855f7;
      font-weight: 700;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    .qty-btn:hover {
      background: #a855f7;
      color: white;
      transform: scale(1.05);
    }
    .qty-btn:active {
      transform: scale(0.95);
    }
    .gift-btn {
      transition: all 0.3s;
    }
    .gift-btn:hover {
      transform: scale(1.05);
    }
    .gift-btn:active {
      transform: scale(0.95);
    }
    .send-btn {
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      color: white;
      border: none;
      border-radius: 14px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 0.3px;
    }
    .send-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
    }
    .send-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .loading {
      text-align: center;
      padding: 20px;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .pin-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 50px 30px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
      margin: 20px auto;
      max-width: 400px;
      position: relative;
      border: 1px solid #f0f0f0;
    }
    .pin-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #1f2937;
    }
    .pin-section h2 {
      margin-bottom: 6px;
      color: #1f2937;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: -0.3px;
      text-align: center;
    }
    .pin-section .subtitle {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 36px;
      font-weight: 400;
      text-align: center;
      line-height: 1.5;
    }
    .pin-input-wrapper {
      position: relative;
      width: 100%;
      max-width: 340px;
      margin-bottom: 24px;
    }
    .pin-input {
      width: 100%;
      padding: 16px 20px;
      font-size: 16px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      text-align: center;
      transition: all 0.2s ease;
      background: #fafafa;
      font-weight: 500;
      letter-spacing: 1.5px;
      color: #1f2937;
    }
    .pin-input:focus {
      outline: none;
      border-color: #1f2937;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(31, 41, 55, 0.08);
    }
    .pin-input::placeholder {
      color: #9ca3af;
      letter-spacing: 0;
      font-weight: 400;
    }
    .pin-btn {
      width: 100%;
      max-width: 340px;
      padding: 14px 40px;
      background: #1f2937;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(31, 41, 55, 0.2);
      transition: all 0.2s ease;
      letter-spacing: 0.3px;
    }
    .pin-btn:hover {
      background: #111827;
      box-shadow: 0 4px 12px rgba(31, 41, 55, 0.3);
    }
    .pin-btn:active {
      transform: scale(0.98);
      box-shadow: 0 1px 4px rgba(31, 41, 55, 0.2);
    }
    .pin-error {
      color: #dc2626;
      margin-top: 16px;
      font-size: 13px;
      display: none;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      max-width: 340px;
      width: 100%;
      text-align: center;
      font-weight: 500;
    }
    .pin-error.show {
      display: block;
    }
    .login-icon {
      width: 64px;
      height: 64px;
      background: #1f2937;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
      box-shadow: 0 2px 8px rgba(31, 41, 55, 0.15);
      font-size: 28px;
    }
    .login-image {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 24px;
      border: 4px solid #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      background: #f9fafb;
      display: block;
    }
    .staff-info {
      text-align: center;
      margin-top: 0;
      margin-bottom: 15px;
      padding: 10px;
      background: linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%);
      border-radius: 10px;
      border: 1px solid #e9d5ff;
    }
    .staff-info p {
      font-weight: bold;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 14px;
    }
    .selected-table-info {
      text-align: center;
      margin-bottom: 15px;
      padding: 12px;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      border-radius: 12px;
      color: white;
      font-weight: bold;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
    }
    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 20px;
      background: white;
      color: #a855f7;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .back-btn:hover {
      background: #f9fafb;
      border-color: #a855f7;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
    }
    .back-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .back-btn svg {
      width: 20px;
      height: 20px;
      transition: transform 0.3s;
    }
    .back-btn:hover svg {
      transform: translateX(-2px);
    }
    .logout-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      color: #ef4444;
      border: 2px solid rgba(239, 68, 68, 0.2);
      border-radius: 16px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.15);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: logoutButtonSlideIn 0.4s ease-out;
    }
    .logout-btn:hover {
      background: rgba(255, 255, 255, 1);
      border-color: rgba(239, 68, 68, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(239, 68, 68, 0.25);
    }
    .logout-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .logout-btn svg {
      width: 18px;
      height: 18px;
      transition: transform 0.3s;
    }
    .logout-btn:hover svg {
      transform: rotate(-15deg);
    }
    @keyframes logoutButtonSlideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .logout-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: modalFadeIn 0.3s ease-out;
    }
    .logout-modal-content {
      background: white;
      border-radius: 20px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: modalSlideUp 0.3s ease-out;
    }
    .logout-modal-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
    }
    .logout-modal-title {
      text-align: center;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 10px;
    }
    .logout-modal-message {
      text-align: center;
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 30px;
      line-height: 1.5;
    }
    .logout-modal-staff-name {
      font-weight: 600;
      color: #a855f7;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .logout-modal-buttons {
      display: flex;
      gap: 12px;
    }
    .logout-modal-btn {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .logout-modal-btn-cancel {
      background: #f3f4f6;
      color: #374151;
    }
    .logout-modal-btn-cancel:hover {
      background: #e5e7eb;
      transform: translateY(-2px);
    }
    .logout-modal-btn-confirm {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    .logout-modal-btn-confirm:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
    }
    .logout-modal-btn:active {
      transform: translateY(0) scale(0.98);
    }
    @keyframes modalFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes modalSlideUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .search-box {
      width: 100%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .search-box:focus {
      outline: none;
      border-color: #a855f7 !important;
      background: white !important;
      box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.1) !important;
      transform: translateY(-1px);
    }
    .search-box::placeholder {
      color: #9ca3af;
    }
    .toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background: white;
      border-radius: 16px;
      padding: 20px 25px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 300px;
      max-width: 90%;
      display: flex;
      align-items: center;
      gap: 15px;
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    .toast.success {
      border-left: 4px solid #10b981;
    }
    .toast.error {
      border-left: 4px solid #ef4444;
    }
    .toast-icon {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
    }
    .toast.success .toast-icon {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    .toast.error .toast-icon {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }
    .toast-content {
      flex: 1;
    }
    .toast-title {
      font-size: 16px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .toast-message {
      font-size: 14px;
      color: #6b7280;
    }
    .toast-close {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .toast-close:hover {
      background: #f3f4f6;
      color: #374151;
    }
    @keyframes checkmark {
      0% {
        transform: scale(0);
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }
    .toast.success .toast-icon svg {
      animation: checkmark 0.5s ease-out;
    }
    /* Splash Screen Styles */
    .splash-screen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #ffffff 0%, #fef2f2 30%, #fce7f3 70%, #fdf2f8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: splashFadeIn 0.6s ease-out;
    }
    .splash-content {
      text-align: center;
      padding: 60px 40px;
      animation: splashSlideUp 0.7s ease-out;
      max-width: 400px;
    }
    .splash-icon {
      width: 100px;
      height: 100px;
      margin: 0 auto 32px;
      background: linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #fbcfe8 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      box-shadow: 0 8px 24px rgba(236, 72, 153, 0.25);
      animation: splashIconScale 0.8s ease-out;
      position: relative;
    }
    .splash-icon::before {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ec4899, #f472b6);
      opacity: 0.2;
      filter: blur(12px);
      z-index: -1;
    }
    .splash-title {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 16px;
      letter-spacing: -0.3px;
      color: #831843;
      animation: splashTextFadeIn 0.9s ease-out;
      line-height: 1.3;
    }
    .splash-name {
      font-size: 20px;
      font-weight: 500;
      margin-bottom: 48px;
      color: #9f1239;
      opacity: 0.85;
      animation: splashTextFadeIn 1.1s ease-out;
      letter-spacing: 0.2px;
    }
    .splash-loader {
      width: 240px;
      height: 3px;
      background: rgba(236, 72, 153, 0.15);
      border-radius: 8px;
      margin: 0 auto;
      overflow: hidden;
      position: relative;
    }
    .splash-loader-bar {
      height: 100%;
      background: linear-gradient(90deg, #ec4899 0%, #f472b6 50%, #ec4899 100%);
      background-size: 200% 100%;
      border-radius: 8px;
      width: 0%;
      animation: splashLoaderProgress 2s ease-out forwards, splashLoaderShimmer 2s ease-in-out infinite;
      box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
    }
    @keyframes splashFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes splashSlideUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes splashIconScale {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes splashTextFadeIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes splashLoaderShimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    @keyframes splashLoaderProgress {
      from {
        width: 0%;
      }
      to {
        width: 100%;
      }
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.1);
      }
    }
    /* Mevcut Siparişler Bölümü */
    .existing-orders {
      margin-bottom: 20px;
      padding: 0 0 15px 0;
    }
    .existing-orders-title {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
      padding: 0 5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .existing-orders-title::before {
      content: '📋';
      font-size: 18px;
    }
    .order-card {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      transition: all 0.3s;
    }
    .order-card:hover {
      border-color: #a855f7;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);
    }
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f3f4f6;
    }
    .order-staff-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
      font-weight: 600;
    }
    .order-staff-info::before {
      content: '👤';
      font-size: 16px;
    }
    .order-time {
      font-size: 12px;
      color: #9ca3af;
      font-weight: 500;
    }
    .order-items {
      margin-top: 12px;
    }
    .order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .order-item:last-child {
      border-bottom: none;
    }
    .order-item-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      flex: 1;
    }
    .order-item-name.gift {
      color: #10b981;
    }
    .order-item-name.gift::after {
      content: ' (İKRAM)';
      font-size: 11px;
      color: #10b981;
      font-weight: 500;
    }
    .order-item-details {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: #6b7280;
    }
    .order-item-qty {
      background: #f3f4f6;
      padding: 4px 10px;
      border-radius: 8px;
      font-weight: 700;
      color: #1f2937;
    }
    .order-item-price {
      font-weight: 700;
      color: #a855f7;
      min-width: 70px;
      text-align: right;
    }
    .order-total {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .order-total-label {
      font-size: 15px;
      font-weight: 700;
      color: #1f2937;
    }
    .order-total-amount {
      font-size: 18px;
      font-weight: 800;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .no-orders {
      text-align: center;
      padding: 30px 20px;
      color: #9ca3af;
      font-size: 14px;
      background: #f9fafb;
      border-radius: 12px;
      border: 2px dashed #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- PIN Giriş Ekranı - Kurumsal ve Profesyonel -->
    <div id="pinSection" class="pin-section">
      <img src="${serverURL}/assets/login.png" alt="Login" class="login-image" onerror="this.style.display='none';">
      <h2>Personel Girişi</h2>
      <p class="subtitle">Lütfen şifrenizi giriniz</p>
      <div class="pin-input-wrapper">
        <input type="password" id="pinInput" class="pin-input" placeholder="Şifrenizi giriniz" maxlength="20" autocomplete="off" onkeypress="if(event.key === 'Enter') verifyStaffPin()">
      </div>
      <button onclick="verifyStaffPin()" class="pin-btn">Giriş Yap</button>
      <p id="pinError" class="pin-error"></p>
    </div>
    
    <!-- Splash Screen - Giriş Sonrası Hoş Geldiniz -->
    <div id="splashScreen" class="splash-screen" style="display: none;">
      <div class="splash-content">
        <div class="splash-icon">
          <svg width="48" height="48" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="splash-title">İyi Çalışmalar Dileriz</h1>
        <p class="splash-name" id="splashStaffName"></p>
        <div class="splash-loader">
          <div class="splash-loader-bar"></div>
        </div>
      </div>
    </div>
    
    <!-- Ana Sipariş Ekranı -->
    <div id="mainSection" style="display: none; padding-top: 60px;">
      <!-- Çıkış Yap Butonu - Sol Üst (masalar ekranında görünecek) -->
      <button class="logout-btn" id="mainLogoutBtn" onclick="showLogoutModal()" title="Çıkış Yap" style="display: none;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Çıkış Yap</span>
      </button>
      
      <!-- Masa Tipi Seçim Ekranı -->
      <div id="tableTypeSelection" style="display: block; position: fixed; inset: 0; background: white; z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px;">
        <!-- Çıkış Yap Butonu - Sadece bu ekranda görünsün -->
        <div style="position: absolute; top: 20px; right: 20px;">
          <button onclick="showLogoutModal()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s; cursor: pointer;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Çıkış Yap</span>
          </button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 500px; flex: 1; justify-content: center; padding: 20px;">
          <!-- İçeri Butonu -->
          <button onclick="selectTableTypeScreen('inside')" style="width: 100%; min-height: 280px; background: #fdf2f8; border: 3px solid #fbcfe8; border-radius: 20px; color: #111827; font-size: 24px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; position: relative; box-shadow: 0 4px 16px rgba(244, 114, 182, 0.25);" onmouseover="this.style.borderColor='#f472b6'; this.style.boxShadow='0 12px 32px rgba(244, 114, 182, 0.35)'; this.style.transform='translateY(-6px)'" onmouseout="this.style.borderColor='#fbcfe8'; this.style.boxShadow='0 4px 16px rgba(244, 114, 182, 0.25)'; this.style.transform='translateY(0)'">
            <svg width="80" height="80" fill="none" stroke="#f472b6" viewBox="0 0 24 24" stroke-width="1.5" style="transition: all 0.2s;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
            </svg>
            <div style="font-size: 32px; font-weight: 800; color: #111827; letter-spacing: 1px;">İÇERİ</div>
          </button>
          
          <!-- Dışarı Butonu -->
          <button onclick="selectTableTypeScreen('outside')" style="width: 100%; min-height: 280px; background: #fffbeb; border: 3px solid #fde68a; border-radius: 20px; color: #111827; font-size: 24px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; position: relative; box-shadow: 0 4px 16px rgba(250, 204, 21, 0.25);" onmouseover="this.style.borderColor='#facc15'; this.style.boxShadow='0 12px 32px rgba(250, 204, 21, 0.35)'; this.style.transform='translateY(-6px)'" onmouseout="this.style.borderColor='#fde68a'; this.style.boxShadow='0 4px 16px rgba(250, 204, 21, 0.25)'; this.style.transform='translateY(0)'">
            <svg width="80" height="80" fill="none" stroke="#facc15" viewBox="0 0 24 24" stroke-width="1.5" style="transition: all 0.2s;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.944 11.944 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>
            </svg>
            <div style="font-size: 32px; font-weight: 800; color: #111827; letter-spacing: 1px;">DIŞARI</div>
          </button>
        </div>
      </div>
      
      <div id="tableSelection" style="display: none;">
        <!-- Geri Dönüş Butonu -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <button onclick="goBackToTypeSelection()" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3); transition: all 0.3s; cursor: pointer;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(107, 114, 128, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(107, 114, 128, 0.3)'">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Geri Dön
          </button>
          
          <!-- Masa Aktar Butonu -->
          <button onclick="showTransferModal()" class="transfer-table-btn" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.3s; cursor: pointer;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(79, 70, 229, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(79, 70, 229, 0.3)'">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            Masa Aktar
          </button>
        </div>
        
        <!-- İç/Dış Tab'leri (Gizli - sadece geri dönüş için) -->
        <div class="table-type-tabs" style="display: none;">
          <button class="table-type-tab active" data-type="inside" onclick="selectTableType('inside')">🏠 İç</button>
          <button class="table-type-tab" data-type="outside" onclick="selectTableType('outside')">🌳 Dış</button>
        </div>
        
        <!-- Masa Grid -->
        <div class="table-grid" id="tablesGrid"></div>
      </div>
      
      <div id="orderSection" style="display: none;">
        <!-- En Üst: Geri Dön Butonu -->
        <div style="position: sticky; top: 0; z-index: 100; background: white; padding: 8px 15px 15px 15px; margin: -15px -15px 0 -15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 0 0 20px 20px;">
          <button class="back-btn" onclick="goBackToTables()" style="position: relative; top: 0; left: 0; margin-bottom: 0; width: 100%; max-width: none; animation: none;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            <span>Masalara Dön</span>
          </button>
        </div>
        
        <!-- Kategoriler ve Arama -->
        <div style="position: sticky; top: 70px; z-index: 99; background: white; padding: 15px 0; margin: 0 -15px 15px -15px; padding-left: 15px; padding-right: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 0 0 20px 20px;">
          <!-- Kategoriler -->
          <div style="margin-bottom: 12px;">
            <div class="category-tabs" id="categoryTabs">
              <div class="category-tabs-row" id="categoryTabsRow1"></div>
              <div class="category-tabs-row" id="categoryTabsRow2"></div>
            </div>
          </div>
          
          <!-- Arama Çubuğu -->
          <div style="position: relative; margin-bottom: 0;">
            <input type="text" id="searchInput" class="search-box" placeholder="🔍 Ürün ara..." oninput="filterProducts()" style="padding: 14px 16px 14px 48px; border: 2px solid #e5e7eb; border-radius: 14px; font-size: 15px; background: #f9fafb; transition: all 0.3s;">
            <div style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- Masa Bilgisi - Minimal -->
        <div style="text-align: center; margin-bottom: 16px; padding: 8px 12px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 10px; border: 1px solid #e5e7eb;">
          <span style="font-size: 13px; font-weight: 600; color: #6b7280;" id="selectedTableInfo"></span>
        </div>
        
        <!-- Mevcut Siparişler -->
        <div class="existing-orders" id="existingOrders" style="display: none;">
          <div class="existing-orders-title">Mevcut Siparişler</div>
          <div id="existingOrdersList"></div>
        </div>
        
        <!-- Ürünler -->
        <div style="overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; max-height: calc(100vh - 320px); padding-bottom: 100px; padding-right: 5px;">
          <div class="products-grid" id="productsGrid"></div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="cart" id="cart">
    <div class="cart-header" onclick="toggleCart()">
      <div class="cart-header-title">
        <span>Siparişi Gönder</span>
        <span id="cartItemCount">0 ürün</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"><span id="cartTotal">0.00</span> ₺</span>
        <div class="cart-header-icon" id="cartToggleIcon">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="cart-content">
      <div class="cart-items" id="cartItems"></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button onclick="showNoteModal()" style="flex: 0 0 auto; padding: 12px 16px; background: #f3f4f6; color: #374151; border: 2px solid #d1d5db; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
          </svg>
          <span id="noteButtonText">Not Ekle</span>
        </button>
        <button class="send-btn" onclick="sendOrder()" style="flex: 1; margin-top: 0;">
          <span style="display: inline-flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
            </svg>
            Siparişi Gönder
          </span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Toast Notification -->
  <div id="toast" class="toast">
    <div class="toast-icon" id="toastIcon"></div>
    <div class="toast-content">
      <div class="toast-title" id="toastTitle"></div>
      <div class="toast-message" id="toastMessage"></div>
    </div>
    <button class="toast-close" onclick="hideToast()">×</button>
  </div>
  
  <!-- Çıkış Yap Onay Modal -->
  <div id="logoutModal" class="logout-modal" style="display: none;" onclick="if(event.target === this) hideLogoutModal()">
    <div class="logout-modal-content">
      <div class="logout-modal-icon">🚪</div>
      <h3 class="logout-modal-title">Çıkış Yapmak İstediğinize Emin Misiniz?</h3>
      <p class="logout-modal-message">
        <span class="logout-modal-staff-name" id="logoutStaffName"></span> olarak çıkış yapmak istediğinize emin misiniz?
      </p>
      <div class="logout-modal-buttons">
        <button class="logout-modal-btn logout-modal-btn-cancel" onclick="hideLogoutModal()">İptal</button>
        <button class="logout-modal-btn logout-modal-btn-confirm" onclick="confirmLogout()">Evet, Çıkış Yap</button>
      </div>
    </div>
  </div>
  
  <!-- Not Ekle Modal -->
  <div id="noteModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target === this) hideNoteModal()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 400px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Sipariş Notu</h2>
          <button onclick="hideNoteModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">×</button>
        </div>
      </div>
      <div style="padding: 20px;">
        <textarea id="noteInput" placeholder="Sipariş notu yazın..." style="width: 100%; min-height: 120px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; outline: none;" onfocus="this.style.borderColor='#a855f7';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
        <button onclick="hideNoteModal()" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
        <button onclick="saveNote()" style="padding: 12px 24px; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(168, 85, 247, 0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(168, 85, 247, 0.3)';">Kaydet</button>
      </div>
    </div>
  </div>
  
  <!-- Ürün İptal Modal -->
  <div id="cancelItemModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) hideCancelItemModal()">
    <div style="background: white; border-radius: 24px; width: 100%; max-width: 420px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 70px rgba(0,0,0,0.4); animation: slideUp 0.3s ease;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 900;">Ürün İptal</h2>
          <button onclick="hideCancelItemModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)';" onmouseout="this.style.background='rgba(255,255,255,0.2)';">×</button>
        </div>
      </div>
      <div style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; color: #6b7280; font-weight: 600;">Ürün:</p>
          <p style="margin: 0; font-size: 18px; font-weight: 800; color: #1f2937;" id="cancelItemName"></p>
        </div>
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; color: #6b7280; font-weight: 600;">Mevcut Miktar:</p>
          <p style="margin: 0; font-size: 18px; font-weight: 800; color: #1f2937;" id="cancelItemMaxQuantity"></p>
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-size: 15px; color: #374151; font-weight: 700;">İptal Edilecek Miktar:</label>
          <input type="number" id="cancelItemQuantity" min="1" value="1" style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700; text-align: center; outline: none; transition: all 0.3s;" onfocus="this.style.borderColor='#ef4444';" onblur="this.style.borderColor='#e5e7eb';" oninput="validateCancelQuantity()">
        </div>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 600; line-height: 1.6;">
            ⚠️ İptal edildiğinde bu ürünün kategorisine atanan yazıcıdan iptal fişi yazdırılacaktır.
          </p>
        </div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 20px; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb;">
        <button onclick="hideCancelItemModal()" style="padding: 14px 28px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
        <button id="confirmCancelBtn" onclick="confirmCancelItem()" style="padding: 14px 28px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 140px;" onmouseover="if(!this.disabled) { this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.4)'; }" onmouseout="if(!this.disabled) { this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'; }">
          <span id="confirmCancelBtnText">İptal Et</span>
          <svg id="confirmCancelBtnSpinner" style="display: none; width: 18px; height: 18px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Türk Kahvesi / Menengiç Kahve Seçenek Modal -->
  <div id="turkishCoffeeModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) hideTurkishCoffeeModal()">
    <div style="background: white; border-radius: 24px; width: 100%; max-width: 420px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 70px rgba(0,0,0,0.4); animation: slideUp 0.3s ease;">
      <div style="background: linear-gradient(135deg, #92400e 0%, #78350f 100%); color: white; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 id="turkishCoffeeModalTitle" style="margin: 0; font-size: 22px; font-weight: 900;">Türk Kahvesi Seçimi</h2>
          <button onclick="hideTurkishCoffeeModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)';" onmouseout="this.style.background='rgba(255,255,255,0.2)';">×</button>
        </div>
      </div>
      <div style="padding: 24px;">
        <p id="turkishCoffeeModalDescription" style="margin: 0 0 20px 0; font-size: 15px; color: #6b7280; font-weight: 600; text-align: center;">Lütfen Türk Kahvesi tercihinizi seçin:</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button onclick="selectTurkishCoffeeOption('Sade')" class="turkish-coffee-option" style="padding: 18px 24px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 2px solid #e5e7eb; border-radius: 16px; font-size: 17px; font-weight: 700; color: #1f2937; cursor: pointer; transition: all 0.3s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 12px;" onmouseover="this.style.background='linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'; this.style.borderColor='#92400e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(146, 64, 14, 0.15)';" onmouseout="this.style.background='linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'; this.style.borderColor='#e5e7eb'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <span style="font-size: 24px;">☕</span>
            <span>Sade</span>
          </button>
          <button onclick="selectTurkishCoffeeOption('Orta')" class="turkish-coffee-option" style="padding: 18px 24px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 2px solid #e5e7eb; border-radius: 16px; font-size: 17px; font-weight: 700; color: #1f2937; cursor: pointer; transition: all 0.3s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 12px;" onmouseover="this.style.background='linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'; this.style.borderColor='#92400e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(146, 64, 14, 0.15)';" onmouseout="this.style.background='linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'; this.style.borderColor='#e5e7eb'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <span style="font-size: 24px;">☕</span>
            <span>Orta</span>
          </button>
          <button onclick="selectTurkishCoffeeOption('Şekerli')" class="turkish-coffee-option" style="padding: 18px 24px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 2px solid #e5e7eb; border-radius: 16px; font-size: 17px; font-weight: 700; color: #1f2937; cursor: pointer; transition: all 0.3s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 12px;" onmouseover="this.style.background='linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'; this.style.borderColor='#92400e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(146, 64, 14, 0.15)';" onmouseout="this.style.background='linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'; this.style.borderColor='#e5e7eb'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <span style="font-size: 24px;">☕</span>
            <span>Şekerli</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- İptal Açıklaması Modal (Fiş yazdırıldıktan sonra) -->
  <div id="cancelReasonModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 3000; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) return;">
    <div style="background: white; border-radius: 24px; width: 100%; max-width: 480px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 70px rgba(0,0,0,0.4); animation: slideUp 0.3s ease;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 900;">İptal Açıklaması</h2>
          <div style="width: 36px; height: 36px;"></div>
        </div>
      </div>
      <div style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; color: #6b7280; font-weight: 600;">İptal fişi yazdırıldı. Lütfen iptal nedenini açıklayın:</p>
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-size: 15px; color: #374151; font-weight: 700;">İptal Açıklaması <span style="color: #ef4444;">*</span>:</label>
          <textarea id="cancelReasonInput" placeholder="Örn: Müşteri istemedi, Yanlış sipariş, Ürün bozuk..." style="width: 100%; min-height: 120px; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; outline: none;" onfocus="this.style.borderColor='#f59e0b';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
        </div>
        <div style="background: #fef3c7; border: 2px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600; line-height: 1.6;">
            ⚠️ İptal açıklaması zorunludur. Açıklama yazmadan işlem tamamlanamaz.
          </p>
        </div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 20px; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb;">
        <button id="confirmCancelReasonBtn" onclick="submitCancelReason()" style="padding: 14px 28px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 140px;" onmouseover="if(!this.disabled) { this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(245, 158, 11, 0.4)'; }" onmouseout="if(!this.disabled) { this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(245, 158, 11, 0.3)'; }">
          <span id="confirmCancelReasonBtnText">Tamamla</span>
          <svg id="confirmCancelReasonBtnSpinner" style="display: none; width: 18px; height: 18px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
  
  <style>
    @keyframes slideUp {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes slideUpScale {
      from { transform: translateY(40px) scale(0.9); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
        <button onclick="saveNote()" style="padding: 12px 24px; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">Kaydet</button>
      </div>
    </div>
  </div>
  
  <!-- Masa Aktar Modal -->
  <div id="transferModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target === this) hideTransferModal()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;" id="transferModalTitle">Aktarılacak Masayı Seçin (Dolu)</h2>
          <button onclick="hideTransferModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">×</button>
        </div>
        <p id="transferModalSubtitle" style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;"></p>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <p id="transferModalDescription" style="color: #6b7280; margin-bottom: 16px; font-weight: 600; font-size: 14px;"></p>
        <div id="transferTablesGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;"></div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: space-between; gap: 12px;">
        <button onclick="handleTransferBack()" id="transferBackBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';" style="display: none;">Geri</button>
        <button onclick="handleTransferConfirm()" id="transferConfirmBtn" style="padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; flex: 1; display: none;" onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">Aktar</button>
        <button onclick="hideTransferModal()" id="transferCancelBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
      </div>
    </div>
  </div>
  
  <!-- Yayın Mesajı Popup -->
  <div id="broadcastMessageModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 20000; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px); animation: fadeIn 0.3s ease;" onclick="if(event.target === this) return;">
    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 32px; width: 100%; max-width: 420px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset; animation: slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative;">
      <!-- Dekoratif arka plan efekti -->
      <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>
      <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); color: white; padding: 28px 24px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 50%; filter: blur(20px);"></div>
        <div style="display: flex; align-items: center; gap: 16px; position: relative; z-index: 1;">
          <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.15);">
            <span style="font-size: 28px;">📢</span>
          </div>
          <div style="flex: 1;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">Yeni Mesaj</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.95; font-weight: 500;">Yönetimden bildirim</p>
          </div>
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 28px 24px; position: relative; z-index: 1;">
        <div style="margin-bottom: 20px;">
          <p id="broadcastMessageText" style="margin: 0; font-size: 16px; font-weight: 500; color: #1f2937; line-height: 1.7; white-space: pre-wrap; letter-spacing: 0.2px;"></p>
        </div>
        <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p id="broadcastMessageDate" style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600; text-align: center;"></p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding: 20px 24px; display: flex; justify-content: center; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); position: relative; z-index: 1;">
        <button onclick="closeBroadcastMessage()" style="padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4), 0 0 0 0 rgba(102, 126, 234, 0.5); letter-spacing: 0.3px; position: relative; overflow: hidden;" onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 12px 28px rgba(102, 126, 234, 0.5), 0 0 0 4px rgba(102, 126, 234, 0.2)';" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 20px rgba(102, 126, 234, 0.4), 0 0 0 0 rgba(102, 126, 234, 0.5)';">
          <span style="position: relative; z-index: 1;">Anladım</span>
          <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%); opacity: 0; transition: opacity 0.3s;" onmouseover="this.style.opacity='1';" onmouseout="this.style.opacity='0';"></div>
        </button>
      </div>
    </div>
  </div>
  
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <script>
    const API_URL = '${serverURL}/api';
    const SOCKET_URL = '${serverURL}';
    let selectedTable = null;
    let categories = [];
    let products = [];
    let cart = [];
    let selectedCategoryId = null;
    let currentStaff = null;
    let socket = null;
    let tables = [];
    let currentTableType = 'inside';
    let orderNote = '';
    
    // PIN oturum yönetimi (1 saat)
    const SESSION_DURATION = 60 * 60 * 1000;
    
    function saveStaffSession(staff) {
      const sessionData = { staff: staff, timestamp: Date.now() };
      localStorage.setItem('staffSession', JSON.stringify(sessionData));
    }
    
    function getStaffSession() {
      const sessionData = localStorage.getItem('staffSession');
      if (!sessionData) return null;
      try {
        const parsed = JSON.parse(sessionData);
        if (Date.now() - parsed.timestamp > SESSION_DURATION) {
          localStorage.removeItem('staffSession');
          return null;
        }
        return parsed.staff;
      } catch (error) {
        localStorage.removeItem('staffSession');
        return null;
      }
    }
    
    // Sayfa yüklendiğinde oturum kontrolü
    window.addEventListener('load', async () => {
      // Cart'ı başlat
      initializeCart();
      
      // Resim cache'ini başlat
      try {
        await initImageCache();
        console.log('✅ Resim cache başlatıldı');
      } catch (error) {
        console.error('❌ Resim cache başlatma hatası:', error);
      }
      
      const savedStaff = getStaffSession();
      if (savedStaff) {
        currentStaff = savedStaff;
        document.getElementById('pinSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        // staffName ve staffInfo elementleri kaldırıldı, null kontrolü yap
        const staffNameEl = document.getElementById('staffName');
        if (staffNameEl) {
          staffNameEl.textContent = currentStaff.name + ' ' + currentStaff.surname;
        }
        const staffInfoEl = document.getElementById('staffInfo');
        if (staffInfoEl) {
          staffInfoEl.style.display = 'none';
        }
        document.getElementById('tableTypeSelection').style.display = 'flex';
        // Sipariş gönder modalını gizle
        document.getElementById('cart').style.display = 'none';
        loadData();
        initWebSocket();
      }
    });
    
    // PIN doğrulama
    async function verifyStaffPin() {
      const pinInput = document.getElementById('pinInput');
      const pin = pinInput.value;
      const errorDiv = document.getElementById('pinError');
      
      if (!pin) {
        errorDiv.textContent = 'Lütfen şifrenizi girin';
        errorDiv.classList.add('show');
        return;
      }
      
      try {
        const response = await fetch(API_URL + '/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pin })
        });
        
        const result = await response.json();
        
        if (result.success) {
          currentStaff = result.staff;
          saveStaffSession(currentStaff);
          errorDiv.classList.remove('show');
          
          // Splash screen göster
          document.getElementById('pinSection').style.display = 'none';
          document.getElementById('splashScreen').style.display = 'flex';
          document.getElementById('splashStaffName').textContent = currentStaff.name + ' ' + currentStaff.surname;
          
          // 2 saniye sonra ana ekrana geç
          setTimeout(() => {
            document.getElementById('splashScreen').style.display = 'none';
            document.getElementById('mainSection').style.display = 'block';
            // staffName ve staffInfo elementleri kaldırıldı, null kontrolü yap
            const staffNameEl = document.getElementById('staffName');
            if (staffNameEl) {
              staffNameEl.textContent = currentStaff.name + ' ' + currentStaff.surname;
            }
            const staffInfoEl = document.getElementById('staffInfo');
            if (staffInfoEl) {
              staffInfoEl.style.display = 'none';
            }
            document.getElementById('tableTypeSelection').style.display = 'flex';
            // Sipariş gönder modalını gizle
            document.getElementById('cart').style.display = 'none';
            loadData();
            initWebSocket();
          }, 2000);
        } else {
          errorDiv.textContent = result.error || 'Şifre hatalı';
          errorDiv.classList.add('show');
          pinInput.value = '';
        }
      } catch (error) {
        console.error('PIN doğrulama hatası:', error);
        errorDiv.textContent = 'Bağlantı hatası';
        errorDiv.classList.add('show');
      }
    }
    
    document.getElementById('pinInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyStaffPin();
    });
    
    // WebSocket bağlantısı
    function initWebSocket() {
      if (socket) socket.disconnect();
      try {
        socket = io(SOCKET_URL);
        socket.on('connect', () => console.log('WebSocket bağlandı'));
        socket.on('table-update', async (data) => {
          console.log('📡 Masa güncellemesi alındı:', data);
          // Önce anında UI'ı güncelle (optimistic update)
          if (tables && tables.length > 0) {
            const tableIndex = tables.findIndex(t => t.id === data.tableId);
            if (tableIndex !== -1) {
              tables[tableIndex].hasOrder = data.hasOrder;
              renderTables(); // Anında render et
            }
          }
          
          // Arka planda API'den güncel veriyi yükle
          fetch(API_URL + '/tables')
            .then(tablesRes => {
              if (tablesRes.ok) {
                return tablesRes.json();
              }
              return null;
            })
            .then(updatedTables => {
              if (updatedTables) {
                tables = updatedTables;
                renderTables();
              }
            })
            .catch(error => {
              console.error('Masa güncelleme hatası:', error);
            });
          
          // Eğer seçili masa varsa siparişleri arka planda yenile
          if (selectedTable && selectedTable.id === data.tableId) {
            loadExistingOrders(selectedTable.id).catch(err => console.error('Sipariş yenileme hatası:', err));
          }
        });
        socket.on('new-order', async (data) => {
          console.log('📦 Yeni sipariş alındı:', data);
          // Eğer seçili masa varsa siparişleri yenile
          if (selectedTable && selectedTable.id === data.tableId) {
            await loadExistingOrders(selectedTable.id);
          }
        });
        socket.on('staff-deleted', (data) => {
          console.log('⚠️ Personel silindi:', data);
          // Otomatik çıkış yap
          localStorage.removeItem('staffSession');
          // Ana ekranı gizle, giriş ekranını göster
          document.getElementById('mainSection').style.display = 'none';
          document.getElementById('pinSection').style.display = 'block';
          // Hata mesajını göster
          const errorDiv = document.getElementById('pinError');
          errorDiv.textContent = data.message || 'Hesabınız silindi. Lütfen yönetici ile iletişime geçin.';
          errorDiv.classList.add('show');
          // Input'u temizle
          document.getElementById('pinInput').value = '';
          // Toast göster
          showToast('error', 'Hesap Silindi', data.message || 'Hesabınız silindi. Lütfen yönetici ile iletişime geçin.');
        });
        socket.on('broadcast-message', (data) => {
          console.log('📢 Yayın mesajı alındı:', data);
          showBroadcastMessage(data.message, data.date, data.time);
        });
        socket.on('product-stock-update', async (data) => {
          console.log('📦 Stok güncellemesi alındı:', data);
          // Ürün listesini güncelle
          const productIndex = products.findIndex(p => p.id === data.productId);
          if (productIndex !== -1) {
            products[productIndex] = {
              ...products[productIndex],
              stock: data.stock,
              trackStock: data.trackStock
            };
            // Eğer sipariş ekranındaysak ürünleri yeniden render et
            if (document.getElementById('orderSection') && document.getElementById('orderSection').style.display !== 'none') {
              renderProducts();
            }
          } else {
            // Ürün bulunamadıysa API'den yeniden yükle
            try {
              const prodsRes = await fetch(API_URL + '/products');
              if (prodsRes.ok) {
                products = await prodsRes.json();
                // Eğer sipariş ekranındaysak ürünleri yeniden render et
                if (document.getElementById('orderSection') && document.getElementById('orderSection').style.display !== 'none') {
                  renderProducts();
                }
              }
            } catch (error) {
              console.error('Ürün güncelleme hatası:', error);
            }
          }
        });
        socket.on('disconnect', () => console.log('WebSocket bağlantısı kesildi'));
      } catch (error) {
        console.error('WebSocket bağlantı hatası:', error);
      }
    }
    
    // Masa tipi seçim ekranından seçim
    function selectTableTypeScreen(type) {
      currentTableType = type;
      document.getElementById('tableTypeSelection').style.display = 'none';
      document.getElementById('tableSelection').style.display = 'block';
      // staffInfo elementi kaldırıldı, null kontrolü yap
      const staffInfoEl = document.getElementById('staffInfo');
      if (staffInfoEl) {
        staffInfoEl.style.display = 'block';
      }
      const mainLogoutBtn = document.getElementById('mainLogoutBtn');
      if (mainLogoutBtn) {
        mainLogoutBtn.style.display = 'flex';
      }
      // Sipariş gönder modalını göster
      document.getElementById('cart').style.display = 'block';
      renderTables();
    }
    
    // Geri dönüş butonu
    function goBackToTypeSelection() {
      document.getElementById('tableSelection').style.display = 'none';
      document.getElementById('tableTypeSelection').style.display = 'flex';
      // staffInfo elementi kaldırıldı, null kontrolü yap
      const staffInfoEl = document.getElementById('staffInfo');
      if (staffInfoEl) {
        staffInfoEl.style.display = 'none';
      }
      const mainLogoutBtn = document.getElementById('mainLogoutBtn');
      if (mainLogoutBtn) {
        mainLogoutBtn.style.display = 'none';
      }
      // Sipariş gönder modalını gizle
      document.getElementById('cart').style.display = 'none';
      selectedTable = null;
      renderTables();
    }
    
    // Masa tipi seçimi (masalar ekranında)
    function selectTableType(type) {
      currentTableType = type;
      document.querySelectorAll('.table-type-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-type') === type) {
          tab.classList.add('active');
        }
      });
      renderTables();
    }
    
    async function loadData() {
      try {
        const [catsRes, prodsRes, tablesRes] = await Promise.all([
          fetch(API_URL + '/categories'),
          fetch(API_URL + '/products'),
          fetch(API_URL + '/tables')
        ]);
        categories = await catsRes.json();
        products = await prodsRes.json();
        tables = await tablesRes.json();
        renderTables();
        renderCategories();
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
        document.getElementById('tablesGrid').innerHTML = '<div class="loading">❌ Bağlantı hatası</div>';
      }
    }
    
    function renderTables() {
      const grid = document.getElementById('tablesGrid');
      const filteredTables = tables.filter(t => t.type === currentTableType);
      
      // Normal masalar (paket olmayanlar)
      const normalTables = filteredTables.filter(t => !t.id.startsWith('package-'));
      // Paket masaları
      const packageTables = filteredTables.filter(t => t.id.startsWith('package-'));
      
      let html = '';
      
      // Normal masalar - tek grid içinde
      if (normalTables.length > 0) {
        html += normalTables.map(table => {
          const tableIdStr = typeof table.id === 'string' ? '\\'' + table.id + '\\'' : table.id;
          const nameStr = table.name.replace(/'/g, "\\'");
          const typeStr = table.type.replace(/'/g, "\\'");
          const hasOrderClass = table.hasOrder ? ' has-order' : '';
          const selectedClass = selectedTable && selectedTable.id === table.id ? ' selected' : '';
          const outsideEmptyClass = (table.type === 'outside' && !table.hasOrder) ? ' outside-empty' : '';
          
          // Masa numaralandırması: İç Masa 1, Dış Masa 1 gibi
          const tableTypeLabel = table.type === 'inside' ? 'İç Masa' : 'Dış Masa';
          const tableDisplayName = tableTypeLabel + ' ' + table.number;
          
          // Durum etiketi: Dolu veya Boş
          const statusLabel = table.hasOrder ? 'Dolu' : 'Boş';
          // Dolu masalar için daha koyu yeşil ton
          const statusColor = table.hasOrder ? '#166534' : '#6b7280';
          
          return '<button class="table-btn' + hasOrderClass + selectedClass + outsideEmptyClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')">' +
            '<div class="table-number">' + table.number + '</div>' +
            '<div class="table-label">' + tableDisplayName + '</div>' +
            '<div style="font-size: 10px; font-weight: 600; color: ' + statusColor + '; margin-top: 4px; padding: 2px 6px; background: ' + (table.hasOrder ? 'rgba(22, 101, 52, 0.15)' : 'rgba(107, 114, 128, 0.1)') + '; border-radius: 6px;">' + statusLabel + '</div>' +
          '</button>';
        }).join('');
      }
      
      // PAKET Başlığı - Premium ve Modern
      if (packageTables.length > 0) {
        html += '<div style="grid-column: 1 / -1; margin-top: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">';
        html += '<div style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #f97316 0%, #fb923c 30%, #fbbf24 70%, #fcd34d 100%); border-radius: 16px; box-shadow: 0 4px 16px rgba(249, 115, 22, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2) inset; position: relative; overflow: hidden;">';
        html += '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%); pointer-events: none;"></div>';
        html += '<svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); position: relative; z-index: 1;"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
        html += '<h3 style="font-size: 17px; font-weight: 900; color: white; margin: 0; letter-spacing: 1.2px; text-shadow: 0 2px 6px rgba(0,0,0,0.3); position: relative; z-index: 1;">PAKET</h3>';
        html += '</div>';
        html += '</div>';
        
        // Paket masaları - Premium Tasarım
        html += packageTables.map(table => {
          const tableIdStr = typeof table.id === 'string' ? '\\'' + table.id + '\\'' : table.id;
          const nameStr = table.name.replace(/'/g, "\\'");
          const typeStr = table.type.replace(/'/g, "\\'");
          const hasOrderClass = table.hasOrder ? ' has-order' : '';
          const selectedClass = selectedTable && selectedTable.id === table.id ? ' selected' : '';
          
          // Dolu için yeşil, boş için turuncu premium renkler
          const bgGradient = table.hasOrder 
            ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)' 
            : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)';
          const borderColor = table.hasOrder ? '#10b981' : '#f97316';
          const numberBg = table.hasOrder 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' 
            : 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fd7e14 100%)';
          const iconColor = table.hasOrder ? '#10b981' : '#f97316';
          
          return '<button class="table-btn package-table-btn' + hasOrderClass + selectedClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')" style="background: ' + bgGradient + '; border: 3px solid ' + borderColor + '; box-shadow: 0 4px 16px ' + (table.hasOrder ? 'rgba(16, 185, 129, 0.35)' : 'rgba(249, 115, 22, 0.35)') + ', 0 0 0 1px rgba(255, 255, 255, 0.4) inset; position: relative; overflow: hidden; transform: scale(1); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">' +
            '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ' + (table.hasOrder ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, transparent 100%)' : 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, transparent 100%)') + '; pointer-events: none; opacity: 0.8;"></div>' +
            '<div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none; transform: rotate(45deg);"></div>' +
            '<div class="table-number" style="background: ' + numberBg + '; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: white; box-shadow: 0 4px 16px ' + (table.hasOrder ? 'rgba(16, 185, 129, 0.5)' : 'rgba(249, 115, 22, 0.5)') + ', 0 0 0 3px rgba(255, 255, 255, 0.4) inset; margin-bottom: 8px; position: relative; z-index: 2; transition: all 0.3s;">' + table.number + '</div>' +
            '<div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 5px;">' +
            '<div class="table-label" style="font-size: 12px; font-weight: 900; color: ' + (table.hasOrder ? '#047857' : '#9a3412') + '; letter-spacing: 0.8px; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);">' + table.name + '</div>' +
            (table.hasOrder ? '<div style="width: 8px; height: 8px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; box-shadow: 0 0 12px rgba(16, 185, 129, 0.8), 0 0 6px rgba(16, 185, 129, 0.6); animation: pulse 2s infinite;"></div>' : '<div style="width: 6px; height: 6px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 50%; opacity: 0.6;"></div>') +
            '</div>' +
            (table.hasOrder ? '<div style="position: absolute; top: 6px; right: 6px; width: 12px; height: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; box-shadow: 0 0 12px rgba(16, 185, 129, 0.9), 0 0 6px rgba(16, 185, 129, 0.7); animation: pulse 2s infinite; z-index: 3;"></div>' : '') +
          '</button>';
        }).join('');
      }
      
      grid.innerHTML = html;
    }
    
    async function selectTable(id, name, type) {
      selectedTable = { id, name, type };
      renderTables();
      document.getElementById('tableSelection').style.display = 'none';
      document.getElementById('orderSection').style.display = 'block';
      // Çıkış Yap butonunu gizle
      const mainLogoutBtn = document.getElementById('mainLogoutBtn');
      if (mainLogoutBtn) {
        mainLogoutBtn.style.display = 'none';
      }
      // Cart her zaman görünür, sadece içeriği kapalı başlar
      const cartEl = document.getElementById('cart');
      if (cartEl) {
        cartEl.style.display = 'block';
        cartEl.classList.remove('open'); // Başlangıçta kapalı
      }
      // Seçili masa bilgisini göster
      document.getElementById('selectedTableInfo').textContent = name + ' için sipariş oluşturuluyor';
      // Arama çubuğunu temizle
      document.getElementById('searchInput').value = '';
      // Mevcut siparişleri yükle
      await loadExistingOrders(id);
      if (categories.length > 0) selectCategory(categories[0].id);
    }
    
    async function loadExistingOrders(tableId) {
      try {
        const response = await fetch(API_URL + '/table-orders?tableId=' + encodeURIComponent(tableId));
        if (!response.ok) {
          throw new Error('Siparişler yüklenemedi');
        }
        const orders = await response.json();
        renderExistingOrders(orders);
      } catch (error) {
        console.error('Sipariş yükleme hatası:', error);
        document.getElementById('existingOrders').style.display = 'none';
      }
    }
    
    function renderExistingOrders(orders) {
      const ordersContainer = document.getElementById('existingOrders');
      const ordersList = document.getElementById('existingOrdersList');
      
      if (!orders || orders.length === 0) {
        ordersContainer.style.display = 'none';
        return;
      }
      
      ordersContainer.style.display = 'block';
      
      ordersList.innerHTML = orders.map(order => {
        const orderDate = order.order_date || '';
        const orderTime = order.order_time || '';
        const staffName = order.staff_name || 'Bilinmiyor';
        const orderNote = order.order_note ? '<div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;"><div style="font-size: 12px; font-weight: 600; color: #92400e; margin-bottom: 4px;">Not:</div><div style="font-size: 13px; color: #78350f;">' + order.order_note.replace(/\\n/g, '<br>') + '</div></div>' : '';
        
        const itemsHtml = order.items.map(item => {
          const itemTotal = (item.price * item.quantity).toFixed(2);
          const giftClass = item.isGift ? ' gift' : '';
          const itemStaffName = item.staff_name || 'Bilinmiyor';
          return '<div class="order-item" style="position: relative;">' +
            '<div class="order-item-name' + giftClass + '">' + item.product_name + '</div>' +
            '<div class="order-item-details" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' +
              '<div style="display: flex; align-items: center; gap: 8px;">' +
                '<span class="order-item-qty">×' + item.quantity + '</span>' +
                '<span class="order-item-price">' + itemTotal + ' ₺</span>' +
              '</div>' +
              (currentStaff && currentStaff.is_manager 
                ? '<button id="cancelBtn_' + item.id + '" onclick="showCancelItemModal(' + item.id + ', ' + item.quantity + ', \\'' + item.product_name.replace(/'/g, "\\'") + '\\')" style="padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px;" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(239, 68, 68, 0.4)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'0 2px 8px rgba(239, 68, 68, 0.3)\\'; }" ontouchstart="if(!this.disabled) { this.style.transform=\\'scale(0.95)\\'; }" ontouchend="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; }" class="cancel-item-btn"><span id="cancelBtnText_' + item.id + '">İptal</span><svg id="cancelBtnSpinner_' + item.id + '" style="display: none; width: 14px; height: 14px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>'
                : '<button onclick="showManagerRequiredMessage()" style="padding: 6px 12px; background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px; opacity: 0.7;" onmouseover="this.style.opacity=\\'0.9\\';" onmouseout="this.style.opacity=\\'0.7\\';"><span>İptal</span></button>') +
            '</div>' +
          '</div>' +
          '<div style="font-size: 11px; color: #9ca3af; margin-top: 4px; margin-bottom: 8px; padding-left: 4px;">👤 ' + itemStaffName + ' • ' + (item.added_date || '') + ' ' + (item.added_time || '') + '</div>';
        }).join('');
        
        const totalAmount = order.items.reduce((sum, item) => {
          if (item.isGift) return sum;
          return sum + (item.price * item.quantity);
        }, 0).toFixed(2);
        
        return '<div class="order-card">' +
          '<div class="order-header">' +
            '<div class="order-staff-info">' + staffName + '</div>' +
            '<div class="order-time">' + orderDate + ' ' + orderTime + '</div>' +
          '</div>' +
          '<div class="order-items">' + itemsHtml + '</div>' +
          orderNote +
          '<div class="order-total">' +
            '<span class="order-total-label">Toplam:</span>' +
            '<span class="order-total-amount">' + totalAmount + ' ₺</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function goBackToTables() {
      selectedTable = null;
      document.getElementById('tableSelection').style.display = 'none';
      document.getElementById('tableTypeSelection').style.display = 'flex';
      document.getElementById('orderSection').style.display = 'none';
      const cartEl = document.getElementById('cart');
      if (cartEl) {
        cartEl.style.display = 'none';
        cartEl.classList.remove('open');
      }
      const searchInputEl = document.getElementById('searchInput');
      if (searchInputEl) {
        searchInputEl.value = '';
      }
      // staffInfo elementi kaldırıldı, null kontrolü yap
      const staffInfoEl = document.getElementById('staffInfo');
      if (staffInfoEl) {
        staffInfoEl.style.display = 'none';
      }
      const mainLogoutBtn = document.getElementById('mainLogoutBtn');
      if (mainLogoutBtn) {
        mainLogoutBtn.style.display = 'none';
      }
    }
    
    // Masa Aktar Modal İşlemleri
    let transferStep = 1; // 1: source table, 2: target table
    let selectedSourceTableId = null;
    let selectedTargetTableId = null;
    
    function showTransferModal() {
      transferStep = 1;
      selectedSourceTableId = null;
      selectedTargetTableId = null;
      document.getElementById('transferModal').style.display = 'flex';
      renderTransferTables();
    }
    
    function hideTransferModal() {
      document.getElementById('transferModal').style.display = 'none';
      transferStep = 1;
      selectedSourceTableId = null;
      selectedTargetTableId = null;
    }
    
    function renderTransferTables() {
      const grid = document.getElementById('transferTablesGrid');
      // Tüm masaları göster (iç, dış ve paket masaları) - tip kısıtlaması yok
      const allTables = [...tables];
      
      if (transferStep === 1) {
        // Adım 1: Dolu masaları göster
        document.getElementById('transferModalTitle').textContent = 'Aktarılacak Masayı Seçin (Dolu)';
        document.getElementById('transferModalDescription').textContent = 'Lütfen içeriği aktarılacak dolu masayı seçin:';
        document.getElementById('transferBackBtn').style.display = 'none';
        document.getElementById('transferConfirmBtn').style.display = 'none';
        document.getElementById('transferCancelBtn').style.display = 'block';
        document.getElementById('transferModalSubtitle').textContent = '';
        
        const html = allTables.map(table => {
          const hasOrder = table.hasOrder;
          const isSelected = selectedSourceTableId === table.id;
          
          if (!hasOrder) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
            '</div>';
          }
          
          return '<button onclick="selectSourceTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + (isSelected ? '#059669' : '#065f46') + '; border-radius: 12px; background: ' + (isSelected ? 'linear-gradient(135deg, #065f46 0%, #022c22 100%)' : 'linear-gradient(135deg, #047857 0%, #065f46 100%)') + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(5, 150, 105, 0.45)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #047857 0%, #022c22 100%); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.6);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: #ecfdf5; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: #bbf7d0; margin-top: 4px; font-weight: 600;">Dolu</span>' +
          '</button>';
        }).join('');
        
        grid.innerHTML = html;
      } else {
        // Adım 2: Boş masaları göster
        document.getElementById('transferModalTitle').textContent = 'Aktarılacak Masayı Seçin (Boş)';
        const sourceTable = allTables.find(t => t.id === selectedSourceTableId);
        document.getElementById('transferModalDescription').textContent = 'Lütfen içeriğin aktarılacağı boş masayı seçin:';
        document.getElementById('transferModalSubtitle').textContent = sourceTable ? 'Kaynak: ' + sourceTable.name : '';
        document.getElementById('transferBackBtn').style.display = 'block';
        document.getElementById('transferConfirmBtn').style.display = selectedTargetTableId ? 'block' : 'none';
        document.getElementById('transferCancelBtn').style.display = 'none';
        
        const html = allTables.map(table => {
          const hasOrder = table.hasOrder;
          const isSelected = selectedTargetTableId === table.id;
          const isSourceTable = selectedSourceTableId === table.id;
          const isOutside = table.type === 'outside';
          
          if (hasOrder || isSourceTable) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
              (isSourceTable ? '<span style="font-size: 9px; color: #dc2626; margin-top: 4px; font-weight: 600;">Kaynak</span>' : '') +
            '</div>';
          }
          
          const bgColor = isOutside
            ? (isSelected ? '#fef3c7' : '#fffbeb')
            : (isSelected ? '#ede9fe' : '#faf5ff');
          const borderColor = isOutside
            ? (isSelected ? '#fbbf24' : '#facc15')
            : (isSelected ? '#a855f7' : '#c4b5fd');
          const circleBg = isOutside
            ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
            : '#f3f4f6';
          const nameColor = isOutside ? '#92400e' : '#111827';
          const statusColor = isOutside ? '#b45309' : '#4b5563';
          
          return '<button onclick="selectTargetTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + borderColor + '; border-radius: 12px; background: ' + bgColor + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(148, 163, 184, 0.3)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: ' + circleBg + '; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: ' + (isOutside ? '#78350f' : '#4b5563') + '; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: ' + nameColor + '; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: ' + statusColor + '; margin-top: 4px; font-weight: 600;">Boş</span>' +
          '</button>';
        }).join('');
        
        grid.innerHTML = html;
      }
    }
    
    function selectSourceTable(tableId) {
      const table = tables.find(t => t.id === tableId);
      if (!table || !table.hasOrder) {
        showToast('error', 'Hata', 'Bu masa boş! Lütfen dolu bir masa seçin.');
        return;
      }
      selectedSourceTableId = tableId;
      transferStep = 2;
      renderTransferTables();
    }
    
    function selectTargetTable(tableId) {
      const table = tables.find(t => t.id === tableId);
      if (table && table.hasOrder) {
        showToast('error', 'Hata', 'Bu masa dolu! Lütfen boş bir masa seçin.');
        return;
      }
      if (tableId === selectedSourceTableId) {
        showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
        return;
      }
      selectedTargetTableId = tableId;
      document.getElementById('transferConfirmBtn').style.display = 'block';
      renderTransferTables();
    }
    
    function handleTransferBack() {
      transferStep = 1;
      selectedTargetTableId = null;
      renderTransferTables();
    }
    
    async function handleTransferConfirm() {
      if (!selectedSourceTableId || !selectedTargetTableId) {
        showToast('error', 'Hata', 'Lütfen hem kaynak hem de hedef masayı seçin.');
        return;
      }
      
      if (selectedSourceTableId === selectedTargetTableId) {
        showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
        return;
      }
      
      try {
        const response = await fetch(API_URL + '/transfer-table-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTableId: selectedSourceTableId,
            targetTableId: selectedTargetTableId
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast('success', 'Başarılı', 'Masa başarıyla aktarıldı!');
          hideTransferModal();
          // Masaları yenile
          const tablesRes = await fetch(API_URL + '/tables');
          tables = await tablesRes.json();
          renderTables();
        } else {
          showToast('error', 'Hata', result.error || 'Masa aktarılamadı');
        }
      } catch (error) {
        console.error('Masa aktarım hatası:', error);
        showToast('error', 'Hata', 'Masa aktarılırken bir hata oluştu');
      }
    }
    
    function renderCategories() {
      const row1 = document.getElementById('categoryTabsRow1');
      const row2 = document.getElementById('categoryTabsRow2');
      if (!row1 || !row2) return;
      
      row1.innerHTML = '';
      row2.innerHTML = '';
      
      // Üst satır kategorileri (belirli sırayla)
      const topRowCategoryNames = [
        'Makaralar',
        'Fransız Pastalar',
        'Kruvasanlar',
        'Sütlü Tatlılar ve Pastalar',
        'Waffle'
      ];
      
      // Alt satır kategorileri (belirli sırayla)
      const bottomRowCategoryNames = [
        'Sıcak İçecekler',
        'Soğuk İçecekler',
        'Frozenlar',
        'Milk Shakeler',
        'Milkshakeler',
        'Ekstra Çikolata'
      ];
      
      // Kategorileri isimlerine göre bul ve sırala (case-insensitive)
      const topRowCategories = [];
      const bottomRowCategories = [];
      let otherCategories = [];
      
      // Milk Shakeler/Milkshakeler kategorisini önce bul (farklı yazımlar için)
      const milkShakeCategory = categories.find(cat => {
        const catNameLower = cat.name.toLowerCase().trim();
        return catNameLower === 'milk shakeler' || catNameLower === 'milkshakeler' || (catNameLower.includes('milk') && catNameLower.includes('shake'));
      });
      
      topRowCategoryNames.forEach(categoryName => {
        const category = categories.find(cat => {
          const catNameLower = cat.name.toLowerCase().trim();
          const categoryNameLower = categoryName.toLowerCase().trim();
          return catNameLower === categoryNameLower;
        });
        if (category) {
          topRowCategories.push(category);
        }
      });
      
      bottomRowCategoryNames.forEach(categoryName => {
        const category = categories.find(cat => {
          const catNameLower = cat.name.toLowerCase().trim();
          const categoryNameLower = categoryName.toLowerCase().trim();
          return catNameLower === categoryNameLower;
        });
        if (category) {
          bottomRowCategories.push(category);
        }
      });
      
      // Milk Shakeler'i alt satıra ekle (eğer orada yoksa)
      if (milkShakeCategory) {
        const alreadyInBottomRow = bottomRowCategories.find(cat => {
          const catNameLower = cat.name.toLowerCase().trim();
          return catNameLower === 'milk shakeler' || catNameLower === 'milkshakeler' || (catNameLower.includes('milk') && catNameLower.includes('shake'));
        });
        if (!alreadyInBottomRow) {
          bottomRowCategories.push(milkShakeCategory);
        }
      }
      
      // Belirtilen kategorilerde olmayan diğer kategorileri ekle (case-insensitive)
      // Milk Shakeler'i kesinlikle ekleme
      const allSpecifiedNamesLower = [...topRowCategoryNames, ...bottomRowCategoryNames].map(name => name.toLowerCase().trim());
      categories.forEach(cat => {
        const catNameLower = cat.name.toLowerCase().trim();
        // Milk Shakeler/Milkshakeler'i otherCategories'e ekleme
        const isMilkShake = catNameLower === 'milk shakeler' || catNameLower === 'milkshakeler' || (catNameLower.includes('milk') && catNameLower.includes('shake'));
        const isInTopRow = topRowCategories.some(tc => tc.id === cat.id);
        const isInBottomRow = bottomRowCategories.some(bc => bc.id === cat.id);
        
        if (!allSpecifiedNamesLower.includes(catNameLower) && !isMilkShake && !isInTopRow && !isInBottomRow) {
          otherCategories.push(cat);
        }
      });
      
      // Üst satıra diğer kategorileri de ekle (eğer yer varsa)
      // Milk Shakeler'i üst satırdan kesinlikle çıkar
      const firstRow = [...topRowCategories, ...otherCategories].filter(cat => {
        const catNameLower = cat.name.toLowerCase().trim();
        return catNameLower !== 'milk shakeler' && catNameLower !== 'milkshakeler' && !(catNameLower.includes('milk') && catNameLower.includes('shake'));
      });
      const secondRow = bottomRowCategories;
      
      // Soft pastel renk paleti (çeşitli renkler - flu tonlar)
      const softColors = [
        { bg: '#fef3c7', border: '#fde68a', text: '#92400e', hover: '#fef08a' }, // Soft Amber
        { bg: '#fce7f3', border: '#fbcfe8', text: '#9f1239', hover: '#f9a8d4' }, // Soft Pink
        { bg: '#e0e7ff', border: '#c7d2fe', text: '#3730a3', hover: '#a5b4fc' }, // Soft Indigo
        { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', hover: '#6ee7b7' }, // Soft Emerald
        { bg: '#e0f2fe', border: '#bae6fd', text: '#0c4a6e', hover: '#7dd3fc' }, // Soft Sky
        { bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8', hover: '#d8b4fe' }, // Soft Purple
        { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', hover: '#fca5a5' }, // Soft Rose
        { bg: '#ecfdf5', border: '#d1fae5', text: '#065f46', hover: '#a7f3d0' }, // Soft Green
        { bg: '#fef9c3', border: '#fef08a', text: '#854d0e', hover: '#fde047' }, // Soft Lime
        { bg: '#f0f9ff', border: '#dbeafe', text: '#1e40af', hover: '#bfdbfe' }, // Soft Blue
        { bg: '#fdf4ff', border: '#fae8ff', text: '#86198f', hover: '#f5d0fe' }, // Soft Fuchsia
        { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', hover: '#fdba74' }, // Soft Orange
        { bg: '#f0fdfa', border: '#ccfbf1', text: '#134e4a', hover: '#99f6e4' }, // Soft Teal
        { bg: '#f5f3ff', border: '#e9d5ff', text: '#5b21b6', hover: '#ddd6fe' }, // Soft Violet
        { bg: '#fefce8', border: '#fef08a', text: '#713f12', hover: '#fde047' }, // Soft Yellow
        { bg: '#f0fdf4', border: '#dcfce7', text: '#166534', hover: '#bbf7d0' }, // Soft Mint
        { bg: '#fef7ff', border: '#f3e8ff', text: '#7c2d12', hover: '#e9d5ff' }, // Soft Lavender
        { bg: '#fff1f2', border: '#ffe4e6', text: '#881337', hover: '#fecdd3' }, // Soft Coral
      ];
      
      // Kategori için renk seç (kategori ID'sine göre tutarlı renk)
      const getCategoryColor = (categoryId) => {
        const index = categoryId % softColors.length;
        return softColors[index];
      };
      
      row1.innerHTML = firstRow.map((cat, index) => {
        const colors = getCategoryColor(cat.id);
        const isActive = selectedCategoryId === cat.id;
        const activeBg = colors.hover;
        const activeBorder = colors.border;
        return '<button class="category-tab ' + (isActive ? 'active' : '') + '" onclick="selectCategory(' + cat.id + ')" style="background: ' + (isActive ? activeBg : colors.bg) + '; border-color: ' + (isActive ? activeBorder : colors.border) + '; color: ' + colors.text + '; box-shadow: 0 2px 8px rgba(0,0,0,0.08); font-weight: ' + (isActive ? '700' : '600') + ';" onmouseover="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.hover + '\\'; this.style.transform=\\'translateY(-2px)\\'; }" onmouseout="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.bg + '\\'; this.style.transform=\\'translateY(0)\\'; }">' + cat.name + '</button>';
      }).join('');
      
      row2.innerHTML = secondRow.map((cat, index) => {
        const colors = getCategoryColor(cat.id);
        const isActive = selectedCategoryId === cat.id;
        const activeBg = colors.hover;
        const activeBorder = colors.border;
        return '<button class="category-tab ' + (isActive ? 'active' : '') + '" onclick="selectCategory(' + cat.id + ')" style="background: ' + (isActive ? activeBg : colors.bg) + '; border-color: ' + (isActive ? activeBorder : colors.border) + '; color: ' + colors.text + '; box-shadow: 0 2px 8px rgba(0,0,0,0.08); font-weight: ' + (isActive ? '700' : '600') + ';" onmouseover="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.hover + '\\'; this.style.transform=\\'translateY(-2px)\\'; }" onmouseout="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.bg + '\\'; this.style.transform=\\'translateY(0)\\'; }">' + cat.name + '</button>';
      }).join('');
    }
    
    function selectCategory(categoryId) {
      selectedCategoryId = categoryId;
      renderCategories();
      renderProducts();
    }
    
    let searchQuery = '';
    
    function filterProducts() {
      searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
      renderProducts();
    }
    
    // Resim cache yönetimi (IndexedDB)
    let imageCache = {};
    
    // IndexedDB başlatma
    function initImageCache() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('makaraImageCache', 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          // Tüm cache'lenmiş resimleri yükle
          const transaction = db.transaction(['images'], 'readonly');
          const store = transaction.objectStore('images');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = async () => {
            for (const item of getAllRequest.result) {
              // Blob'u blob URL'ye çevir
              if (item.blob) {
                const blobUrl = URL.createObjectURL(item.blob);
                imageCache[item.url] = blobUrl;
              } else if (item.blobUrl) {
                // Eski format (blobUrl) - yeni blob URL oluştur
                imageCache[item.url] = item.blobUrl;
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
          } else if (event.oldVersion < 2) {
            // Version 2'ye upgrade - blob ekle
            const store = event.target.transaction.objectStore('images');
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      });
    }
    
    // Resmi cache'le ve blob URL oluştur
    async function cacheImage(imageUrl) {
      if (!imageUrl) {
        return null;
      }
      
      // Firebase Storage veya R2 URL'lerini destekle
      const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com');
      const isR2 = imageUrl.includes('r2.dev') || imageUrl.includes('r2.cloudflarestorage.com');
      
      if (!isFirebaseStorage && !isR2) {
        // Direkt URL ise (local path veya başka bir URL), direkt dön
        return imageUrl;
      }
      
      // Zaten cache'de varsa
      if (imageCache[imageUrl]) {
        return imageCache[imageUrl];
      }
      
      try {
        // Backend proxy üzerinden resmi çek (CORS sorununu çözmek için)
        const proxyUrl = API_URL + '/image-proxy?url=' + encodeURIComponent(imageUrl);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Resim yüklenemedi');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // IndexedDB'ye kaydet
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('makaraImageCache', 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('images')) {
              const store = db.createObjectStore('images', { keyPath: 'url' });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            } else if (event.oldVersion < 2) {
              // Version 2'ye upgrade
              const store = event.target.transaction.objectStore('images');
              if (!store.indexNames.contains('timestamp')) {
                store.createIndex('timestamp', 'timestamp', { unique: false });
              }
            }
          };
        });
        
        const transaction = db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await new Promise((resolve, reject) => {
          const request = store.put({ url: imageUrl, blob: blob, timestamp: Date.now() });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        // Cache'e ekle
        imageCache[imageUrl] = blobUrl;
        return blobUrl;
      } catch (error) {
        console.error('Resim cache hatası:', error);
        return null;
      }
    }
    
    async function renderProducts() {
      let filtered;
      
      // Arama sorgusu varsa tüm kategorilerden ara, yoksa sadece seçili kategoriden göster
      if (searchQuery) {
        // Arama yapıldığında tüm kategorilerden ara
        filtered = products.filter(p => 
          p.name.toLowerCase().includes(searchQuery)
        );
      } else {
        // Arama yoksa sadece seçili kategoriden göster
        filtered = products.filter(p => p.category_id === selectedCategoryId);
      }
      
      const grid = document.getElementById('productsGrid');
      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">Ürün bulunamadı</div>';
        return;
      }
      
      // Önce ürünleri hemen göster (resimler olmadan)
      grid.innerHTML = filtered.map(prod => {
        const cardId = 'product-card-' + prod.id;
        // Cache'de varsa hemen göster, yoksa arka planda yüklenecek
        const cachedImageUrl = prod.image && imageCache[prod.image] ? imageCache[prod.image] : null;
        const backgroundStyle = cachedImageUrl ? 'background-image: url(' + cachedImageUrl + ');' : '';
        const trackStock = prod.trackStock === true;
        const stock = trackStock && prod.stock !== undefined ? (prod.stock || 0) : null;
        const isOutOfStock = trackStock && stock !== null && stock === 0;
        const isLowStock = trackStock && stock !== null && stock > 0 && stock <= 5;
        // Türk Kahvesi ve Menengiç Kahve için özel modal açma
        const isTurkishCoffee = prod.name.toLowerCase().includes('türk kahvesi') || prod.name.toLowerCase().includes('turk kahvesi');
        const isMenengicCoffee = prod.name.toLowerCase().includes('menengiç kahve') || prod.name.toLowerCase().includes('menengic kahve');
        const needsCoffeeModal = isTurkishCoffee || isMenengicCoffee;
        const onClickHandler = isOutOfStock ? '' : (needsCoffeeModal ? 'onclick="showTurkishCoffeeModal(' + prod.id + ', \\'' + prod.name.replace(/'/g, "\\'") + '\\', ' + prod.price + ')"' : 'onclick="addToCart(' + prod.id + ', \\'' + prod.name.replace(/'/g, "\\'") + '\\', ' + prod.price + ')"');
        const cardStyle = isOutOfStock ? backgroundStyle + ' opacity: 0.6; cursor: not-allowed; pointer-events: none;' : backgroundStyle;
        
        // Kilit ikonu (sadece stok 0 olduğunda)
        const lockIcon = isOutOfStock ? '<div style="position: absolute; top: 8px; left: 8px; background: linear-gradient(135deg, rgba(252, 231, 243, 0.95) 0%, rgba(253, 242, 248, 0.9) 100%); color: #ec4899; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 2px 8px rgba(236, 72, 153, 0.25), 0 0 0 1px rgba(236, 72, 153, 0.1) inset;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>' : '';
        
        // Stok uyarı badge'i (0 ise "Kalmadı", 1-5 arası ise "X adet kaldı")
        let stockBadge = '';
        if (isOutOfStock) {
          stockBadge = '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.85) 100%); color: white; padding: 8px; text-align: center; font-size: 12px; font-weight: 700; z-index: 10; border-radius: 0 0 12px 12px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">🔒 Kalmadı</div>';
        } else if (isLowStock) {
          const stockText = stock === 1 ? '1 adet kaldı' : stock + ' adet kaldı';
          stockBadge = '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(245, 158, 11, 0.95) 0%, rgba(245, 158, 11, 0.85) 100%); color: white; padding: 8px; text-align: center; font-size: 12px; font-weight: 700; z-index: 10; border-radius: 0 0 12px 12px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">⚠️ ' + stockText + '</div>';
        }
        
        return '<div id="' + cardId + '" class="product-card" ' + onClickHandler + ' style="' + cardStyle + ' position: relative; overflow: hidden;">' +
          lockIcon +
          '<div class="product-name" style="' + (isOutOfStock ? 'opacity: 0.7;' : '') + '">' + prod.name + '</div>' +
          '<div class="product-price" style="' + (isOutOfStock ? 'opacity: 0.7;' : '') + '">' + prod.price.toFixed(2) + ' ₺</div>' +
          stockBadge +
        '</div>';
      }).join('');
      
      // Resimleri arka planda paralel olarak yükle ve kartları güncelle
      // İlk 6 ürünü öncelikli yükle (görünen alan)
      const productsToLoad = filtered.filter(prod => prod.image && !imageCache[prod.image]);
      const priorityProducts = productsToLoad.slice(0, 6);
      const otherProducts = productsToLoad.slice(6);
      
      // Öncelikli ürünleri önce yükle (3'erli gruplar halinde)
      const loadProductImage = async (prod) => {
        try {
          const blobUrl = await cacheImage(prod.image);
          if (blobUrl) {
            const card = document.getElementById('product-card-' + prod.id);
            if (card) {
              card.style.backgroundImage = 'url(' + blobUrl + ')';
            }
          }
        } catch (error) {
          console.error('Resim yükleme hatası:', error);
        }
      };
      
      // Öncelikli ürünleri 3'erli gruplar halinde paralel yükle
      for (let i = 0; i < priorityProducts.length; i += 3) {
        const batch = priorityProducts.slice(i, i + 3);
        Promise.all(batch.map(loadProductImage)).catch(() => {}); // Hataları sessizce yok say
      }
      
      // Diğer ürünleri arka planda yükle (5'erli gruplar halinde)
      for (let i = 0; i < otherProducts.length; i += 5) {
        const batch = otherProducts.slice(i, i + 5);
        setTimeout(() => {
          Promise.all(batch.map(loadProductImage)).catch(() => {}); // Hataları sessizce yok say
        }, 50 * (Math.floor(i / 5) + 1)); // Her grup için artan gecikme
      }
    }
    
    // Türk Kahvesi Modal Fonksiyonları
    let pendingTurkishCoffeeProduct = null;
    
    function showTurkishCoffeeModal(productId, name, price) {
      pendingTurkishCoffeeProduct = { id: productId, name: name, price: price };
      // Modal başlığını ve açıklamasını güncelle
      const modalTitle = document.getElementById('turkishCoffeeModalTitle');
      const modalDescription = document.getElementById('turkishCoffeeModalDescription');
      const isMenengic = name.toLowerCase().includes('menengiç kahve') || name.toLowerCase().includes('menengic kahve');
      if (modalTitle) {
        modalTitle.textContent = isMenengic ? 'Menengiç Kahve Seçimi' : 'Türk Kahvesi Seçimi';
      }
      if (modalDescription) {
        modalDescription.textContent = isMenengic ? 'Lütfen Menengiç Kahve tercihinizi seçin:' : 'Lütfen Türk Kahvesi tercihinizi seçin:';
      }
      document.getElementById('turkishCoffeeModal').style.display = 'flex';
    }
    
    function hideTurkishCoffeeModal() {
      document.getElementById('turkishCoffeeModal').style.display = 'none';
      pendingTurkishCoffeeProduct = null;
    }
    
    function selectTurkishCoffeeOption(option) {
      if (!pendingTurkishCoffeeProduct) {
        hideTurkishCoffeeModal();
        return;
      }
      
      // Stok kontrolü
      const product = products.find(p => p.id === pendingTurkishCoffeeProduct.id);
      if (product) {
        const trackStock = product.trackStock === true;
        const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
        const isOutOfStock = trackStock && stock !== null && stock === 0;
        
        if (isOutOfStock) {
          showToast('error', 'Stok Yok', pendingTurkishCoffeeProduct.name + ' için stok kalmadı');
          hideTurkishCoffeeModal();
          return;
        }
      }
      
      // Ürün ismini seçeneğe göre güncelle
      // Eğer Menengiç Kahve ise "Sade Menengiç Kahve", "Orta Menengiç Kahve", "Şekerli Menengiç Kahve"
      // Eğer Türk Kahvesi ise "Sade Türk Kahvesi", "Orta Türk Kahvesi", "Şekerli Türk Kahvesi"
      const originalName = pendingTurkishCoffeeProduct.name.toLowerCase();
      const isMenengic = originalName.includes('menengiç kahve') || originalName.includes('menengic kahve');
      const coffeeType = isMenengic ? 'Menengiç Kahve' : 'Türk Kahvesi';
      const productName = option + ' ' + coffeeType;
      
      const existing = cart.find(item => item.id === pendingTurkishCoffeeProduct.id && item.name === productName);
      if (existing) {
        existing.quantity++;
      } else {
        cart.push({ 
          id: pendingTurkishCoffeeProduct.id, 
          name: productName, 
          price: pendingTurkishCoffeeProduct.price, 
          quantity: 1,
          isGift: false
        });
      }
      
      updateCart();
      hideTurkishCoffeeModal();
      
      // Arama input'unu temizle ve ürünleri yeniden render et
      const searchInputEl = document.getElementById('searchInput');
      if (searchInputEl) {
        searchInputEl.value = '';
        searchQuery = '';
        renderProducts();
      }
    }
    
    function addToCart(productId, name, price) {
      // Stok kontrolü
      const product = products.find(p => p.id === productId);
      if (product) {
        const trackStock = product.trackStock === true;
        const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
        const isOutOfStock = trackStock && stock !== null && stock === 0;
        
        if (isOutOfStock) {
          showToast('error', 'Stok Yok', name + ' için stok kalmadı');
          return;
        }
      }
      
      const existing = cart.find(item => item.id === productId && item.name === name);
      if (existing) {
        existing.quantity++;
      } else {
        cart.push({ id: productId, name, price, quantity: 1, isGift: false });
      }
      updateCart();
      
      // Arama input'unu temizle ve ürünleri yeniden render et
      const searchInputEl = document.getElementById('searchInput');
      if (searchInputEl) {
        searchInputEl.value = '';
        searchQuery = '';
        renderProducts();
      }
      
      // Sepeti otomatik açma - kullanıcı manuel olarak açacak
    }
    
    function updateCart() {
      const itemsDiv = document.getElementById('cartItems');
      // İkram edilen ürünleri toplamdan çıkar
      const total = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      if (cart.length === 0) {
        itemsDiv.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #9ca3af; font-size: 14px;">Sepetiniz boş</div>';
      } else {
        itemsDiv.innerHTML = cart.map(item => {
          return '<div class="cart-item">' +
            '<div style="flex: 1;">' +
              '<div style="font-weight: 700; font-size: 15px; color: #1f2937; margin-bottom: 4px; display: flex; align-items: center;">' + item.name + '</div>' +
              '<div style="color: #6b7280; font-size: 13px; font-weight: 600;">' + item.price.toFixed(2) + ' ₺ × ' + item.quantity + ' = ' + (item.price * item.quantity).toFixed(2) + ' ₺</div>' +
            '</div>' +
            '<div class="cart-item-controls" style="display: flex; align-items: center; gap: 8px;">' +
              '<button class="qty-btn" onclick="changeQuantity(' + item.id + ', -1)" title="Azalt">-</button>' +
              '<span style="min-width: 36px; text-align: center; font-weight: 700; color: #1f2937; font-size: 15px;">' + item.quantity + '</span>' +
              '<button class="qty-btn" onclick="changeQuantity(' + item.id + ', 1)" title="Artır">+</button>' +
              '<button class="qty-btn" onclick="removeFromCart(' + item.id + ')" style="background: #ef4444; color: white; border-color: #ef4444; font-size: 18px;" title="Sil">×</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      
      document.getElementById('cartTotal').textContent = total.toFixed(2);
      const cartItemCountEl = document.getElementById('cartItemCount');
      if (cartItemCountEl) {
        cartItemCountEl.textContent = totalItems + ' ürün';
      }
    }
    
    function changeQuantity(productId, delta) {
      const item = cart.find(item => item.id === productId);
      if (item) { item.quantity += delta; if (item.quantity <= 0) removeFromCart(productId); else updateCart(); }
    }
    
    function removeFromCart(productId) { cart = cart.filter(item => item.id !== productId); updateCart(); }
    
    function toggleCart() {
      const cartEl = document.getElementById('cart');
      const iconEl = document.getElementById('cartToggleIcon');
      
      if (!cartEl) return;
      
      const wasOpen = cartEl.classList.contains('open');
      cartEl.classList.toggle('open');
      const isNowOpen = cartEl.classList.contains('open');
      
      // İkonu güncelle: açıkken yukarı ok (kapatmak için), kapalıyken aşağı ok (açmak için)
      if (iconEl) {
        if (isNowOpen) {
          // Açık - yukarı ok göster (kapatmak için)
          iconEl.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>';
        } else {
          // Kapalı - aşağı ok göster (açmak için)
          iconEl.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>';
        }
      }
    }
    
    // Cart başlangıç durumunu ayarla
    function initializeCart() {
      const cartEl = document.getElementById('cart');
      const iconEl = document.getElementById('cartToggleIcon');
      
      if (cartEl && iconEl) {
        // Başlangıçta kapalı - aşağı ok göster
        cartEl.classList.remove('open');
        iconEl.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>';
      }
    }
    
    // Toast Notification Functions
    function showToast(type, title, message) {
      const toast = document.getElementById('toast');
      const toastIcon = document.getElementById('toastIcon');
      const toastTitle = document.getElementById('toastTitle');
      const toastMessage = document.getElementById('toastMessage');
      
      toast.className = 'toast ' + type;
      toastTitle.textContent = title;
      toastMessage.textContent = message;
      
      if (type === 'success') {
        toastIcon.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
      } else if (type === 'error') {
        toastIcon.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>';
      }
      
      toast.classList.add('show');
      
      // Otomatik kapat (3 saniye)
      setTimeout(() => {
        hideToast();
      }, 3000);
    }
    
    function hideToast() {
      const toast = document.getElementById('toast');
      toast.classList.remove('show');
    }
    
    // Çıkış Yap Fonksiyonları
    function showLogoutModal() {
      if (currentStaff) {
        const staffName = currentStaff.name + ' ' + currentStaff.surname;
        document.getElementById('logoutStaffName').textContent = staffName;
        document.getElementById('logoutModal').style.display = 'flex';
      }
    }
    
    function hideLogoutModal() {
      document.getElementById('logoutModal').style.display = 'none';
    }
    
    function confirmLogout() {
      // Oturum bilgisini temizle
      localStorage.removeItem('staffSession');
      currentStaff = null;
      
      // WebSocket bağlantısını kapat
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      
      // Ana ekranı gizle, giriş ekranını göster
      document.getElementById('mainSection').style.display = 'none';
      document.getElementById('pinSection').style.display = 'block';
      document.getElementById('logoutModal').style.display = 'none';
      
      // Sepeti ve seçili masayı temizle
      cart = [];
      selectedTable = null;
      updateCart();
      
      // Input'u temizle
      document.getElementById('pinInput').value = '';
      document.getElementById('pinError').classList.remove('show');
      
      // Toast göster
      showToast('success', 'Çıkış Yapıldı', 'Başarıyla çıkış yaptınız. Tekrar giriş yapabilirsiniz.');
    }
    
    // Not Modal İşlemleri
    function showNoteModal() {
      document.getElementById('noteInput').value = orderNote;
      document.getElementById('noteModal').style.display = 'flex';
    }
    
    // Ürün İptal Modal İşlemleri
    let cancelItemId = null;
    let cancelItemMaxQuantity = 1;
    
    function showManagerRequiredMessage() {
      showToast('error', 'Yetki Yok', 'İptal ettirmek için lütfen müdürle görüşünüz.');
    }
    
    function showCancelItemModal(itemId, maxQuantity, productName) {
      // Müdür kontrolü
      if (!currentStaff || !currentStaff.is_manager) {
        showManagerRequiredMessage();
        return;
      }
      
      cancelItemId = itemId;
      cancelItemMaxQuantity = maxQuantity;
      document.getElementById('cancelItemName').textContent = productName;
      document.getElementById('cancelItemMaxQuantity').textContent = maxQuantity + ' adet';
      document.getElementById('cancelItemQuantity').value = 1;
      document.getElementById('cancelItemQuantity').max = maxQuantity;
      
      // Butonu sıfırla (modal her açıldığında)
      const confirmBtn = document.getElementById('confirmCancelBtn');
      const confirmBtnText = document.getElementById('confirmCancelBtnText');
      const confirmBtnSpinner = document.getElementById('confirmCancelBtnSpinner');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.pointerEvents = 'auto';
        if (confirmBtnText) confirmBtnText.textContent = 'İptal Et';
        if (confirmBtnSpinner) confirmBtnSpinner.style.display = 'none';
      }
      
      document.getElementById('cancelItemModal').style.display = 'flex';
    }
    
    function hideCancelItemModal() {
      document.getElementById('cancelItemModal').style.display = 'none';
      cancelItemId = null;
      cancelItemMaxQuantity = 1;
    }
    
    function validateCancelQuantity() {
      const input = document.getElementById('cancelItemQuantity');
      let value = parseInt(input.value);
      if (isNaN(value) || value < 1) {
        value = 1;
      } else if (value > cancelItemMaxQuantity) {
        value = cancelItemMaxQuantity;
      }
      input.value = value;
    }
    
    // İptal işlemi için geçici değişkenler
    let pendingCancelItemId = null;
    let pendingCancelQuantity = null;
    
    function confirmCancelItem() {
      if (!cancelItemId) return;
      
      const cancelQuantity = parseInt(document.getElementById('cancelItemQuantity').value);
      if (isNaN(cancelQuantity) || cancelQuantity < 1 || cancelQuantity > cancelItemMaxQuantity) {
        showToast('error', 'Hata', 'Geçersiz iptal miktarı');
        return;
      }
      
      // Müdür kontrolü
      if (!currentStaff || !currentStaff.is_manager) {
        showManagerRequiredMessage();
        return;
      }
      
      // İptal edilecek ürün bilgilerini sakla
      pendingCancelItemId = cancelItemId;
      pendingCancelQuantity = cancelQuantity;
      
      // Modal'ı kapat
      hideCancelItemModal();
      
      // İptal işlemini başlat (fiş yazdırılacak)
      startCancelProcess();
    }
    
    async function startCancelProcess() {
      if (!pendingCancelItemId || !pendingCancelQuantity) return;
      
      // Mevcut siparişler listesindeki iptal butonunu bul ve loading durumuna geçir
      const cancelBtn = document.getElementById('cancelBtn_' + pendingCancelItemId);
      const cancelBtnText = document.getElementById('cancelBtnText_' + pendingCancelItemId);
      const cancelBtnSpinner = document.getElementById('cancelBtnSpinner_' + pendingCancelItemId);
      
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.7';
        cancelBtn.style.cursor = 'not-allowed';
        cancelBtn.style.pointerEvents = 'none';
        if (cancelBtnText) cancelBtnText.textContent = 'İşleniyor...';
        if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'block';
      }
      
      // İptal işlemini başlat (fiş yazdırılacak, açıklama bekleniyor)
      try {
        const response = await fetch(API_URL + '/cancel-table-order-item', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            itemId: pendingCancelItemId,
            cancelQuantity: pendingCancelQuantity,
            staffId: currentStaff ? currentStaff.id : null,
            cancelReason: '' // Geçici olarak boş, açıklama modal'ından sonra gönderilecek
          })
        });
        
        const result = await response.json();
        
        if (result.requiresReason === true || (result.error && result.error.includes('İptal açıklaması'))) {
          // Açıklama modal'ını aç (fiş henüz yazdırılmadı)
          if (cancelBtnText) cancelBtnText.textContent = 'İptal';
          if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'none';
          showCancelReasonModal();
        } else if (result.success) {
          // Başarılı (açıklama ile birlikte gönderildi)
          showToast('success', 'Başarılı', 'Ürün başarıyla iptal edildi');
          hideCancelReasonModal();
          if (selectedTable) {
            await loadExistingOrders(selectedTable.id);
          }
          pendingCancelItemId = null;
          pendingCancelQuantity = null;
        } else {
          showToast('error', 'Hata', result.error || 'Ürün iptal edilemedi');
          // Hata durumunda butonu tekrar aktif hale getir
          resetCancelButton(cancelBtn, cancelBtnText, cancelBtnSpinner);
          pendingCancelItemId = null;
          pendingCancelQuantity = null;
        }
      } catch (error) {
        console.error('İptal hatası:', error);
        showToast('error', 'Hata', 'Ürün iptal edilirken bir hata oluştu');
        resetCancelButton(cancelBtn, cancelBtnText, cancelBtnSpinner);
        pendingCancelItemId = null;
        pendingCancelQuantity = null;
      }
    }
    
    function resetCancelButton(cancelBtn, cancelBtnText, cancelBtnSpinner) {
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.style.opacity = '1';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.pointerEvents = 'auto';
        if (cancelBtnText) cancelBtnText.textContent = 'İptal';
        if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'none';
      }
    }
    
    function showCancelReasonModal() {
      document.getElementById('cancelReasonModal').style.display = 'flex';
      document.getElementById('cancelReasonInput').value = '';
      // Focus'u geciktirerek donma sorununu çöz
      setTimeout(() => {
        const input = document.getElementById('cancelReasonInput');
        if (input) {
          input.focus();
        }
      }, 100);
    }
    
    function hideCancelReasonModal() {
      document.getElementById('cancelReasonModal').style.display = 'none';
    }
    
    async function submitCancelReason() {
      const cancelReason = document.getElementById('cancelReasonInput').value.trim();
      
      if (!cancelReason || cancelReason === '') {
        showToast('error', 'Hata', 'Lütfen iptal açıklaması yazın');
        return;
      }
      
      if (!pendingCancelItemId || !pendingCancelQuantity) {
        showToast('error', 'Hata', 'İptal işlemi bulunamadı');
        hideCancelReasonModal();
        return;
      }
      
      // Modalı hemen kapat ve UI'ı anında güncelle
      hideCancelReasonModal();
      
      // Ürünü anında UI'dan kaldır (optimistic update)
      const cancelBtn = document.getElementById('cancelBtn_' + pendingCancelItemId);
      if (cancelBtn) {
        const orderItem = cancelBtn.closest('.order-item');
        if (orderItem) {
          orderItem.style.opacity = '0.5';
          orderItem.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            orderItem.style.display = 'none';
          }, 300);
        }
      }
      
      // Arka planda kaydet (await kullanmadan)
      fetch(API_URL + '/cancel-table-order-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId: pendingCancelItemId,
          cancelQuantity: pendingCancelQuantity,
          staffId: currentStaff ? currentStaff.id : null,
          cancelReason: cancelReason
        })
      })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          // Siparişleri arka planda yenile
          if (selectedTable) {
            loadExistingOrders(selectedTable.id).catch(err => console.error('Sipariş yenileme hatası:', err));
          }
        } else {
          // Hata durumunda UI'ı geri yükle
          if (cancelBtn) {
            const orderItem = cancelBtn.closest('.order-item');
            if (orderItem) {
              orderItem.style.display = '';
              orderItem.style.opacity = '1';
            }
          }
          showToast('error', 'Hata', result.error || 'Ürün iptal edilemedi');
        }
      })
      .catch(error => {
        console.error('İptal işlemi hatası:', error);
        // Hata durumunda UI'ı geri yükle
        if (cancelBtn) {
          const orderItem = cancelBtn.closest('.order-item');
          if (orderItem) {
            orderItem.style.display = '';
            orderItem.style.opacity = '1';
          }
        }
        showToast('error', 'Hata', 'İptal işlemi sırasında bir hata oluştu');
      });
      
      // Pending değişkenlerini temizle
      pendingCancelItemId = null;
      pendingCancelQuantity = null;
    }
    
    // Yayın Mesajı Fonksiyonları
    function showBroadcastMessage(message, date, time) {
      const modal = document.getElementById('broadcastMessageModal');
      const messageText = document.getElementById('broadcastMessageText');
      const messageDate = document.getElementById('broadcastMessageDate');
      
      if (modal && messageText && messageDate) {
        messageText.textContent = message;
        messageDate.textContent = date + ' ' + time;
        modal.style.display = 'flex';
      }
    }
    
    function closeBroadcastMessage() {
      const modal = document.getElementById('broadcastMessageModal');
      if (modal) {
        modal.style.display = 'none';
      }
    }
    
    function hideNoteModal() {
      document.getElementById('noteModal').style.display = 'none';
    }
    
    function saveNote() {
      orderNote = document.getElementById('noteInput').value.trim();
      updateNoteButton();
      hideNoteModal();
    }
    
    function updateNoteButton() {
      const noteButtonText = document.getElementById('noteButtonText');
      if (orderNote) {
        noteButtonText.textContent = 'Not Düzenle';
      } else {
        noteButtonText.textContent = 'Not Ekle';
      }
    }
    
    async function sendOrder() {
      if (!selectedTable || cart.length === 0) { 
        showToast('error', 'Eksik Bilgi', 'Lütfen masa seçin ve ürün ekleyin');
        return; 
      }
      if (!currentStaff) { 
        showToast('error', 'Giriş Gerekli', 'Lütfen giriş yapın');
        return; 
      }
      
      // İkram edilen ürünleri toplamdan çıkar
      const totalAmount = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      try {
        const response = await fetch(API_URL + '/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: cart.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              isGift: item.isGift || false
            })), 
            totalAmount, 
            tableId: selectedTable.id, 
            tableName: selectedTable.name, 
            tableType: selectedTable.type,
            staffId: currentStaff.id,
            orderNote: orderNote || null
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          const message = result.isNewOrder 
            ? selectedTable.name + ' için yeni sipariş başarıyla oluşturuldu!' 
            : selectedTable.name + ' için mevcut siparişe eklendi!';
          
          showToast('success', 'Sipariş Başarılı', message);
          
          // Sepeti temizle ama masada kal
          const currentTableId = selectedTable.id;
          cart = []; 
          orderNote = '';
          updateCart();
          updateNoteButton();
          document.getElementById('searchInput').value = '';
          searchQuery = '';
          
          // Siparişleri yenile
          await loadExistingOrders(currentTableId);
          // Ürünleri yenile (stok bilgisi güncellensin)
          await loadData();
          // Ürünleri render et (stok 0 olanlar "Kalmadı" göstersin)
          renderProducts();
        } else {
          showToast('error', 'Hata', result.error || 'Sipariş gönderilemedi');
        }
      } catch (error) { 
        console.error('Sipariş gönderme hatası:', error); 
        showToast('error', 'Bağlantı Hatası', 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      }
    }
  </script>
</body>
</html>`;
}

// HTTP Server ve API Setup
function startAPIServer() {
  const appExpress = express();
  appExpress.use(cors());
  appExpress.use(express.json());
  
  // Assets klasörünü serve et
  const assetsPath = path.join(__dirname, '../assets');
  appExpress.use('/assets', express.static(assetsPath));

  const server = http.createServer(appExpress);
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  const localIP = getLocalIP();
  const serverURL = `http://${localIP}:${serverPort}`;

  // API Endpoints
  appExpress.get('/api/categories', async (req, res) => {
    try {
      // Firebase'den direkt çek
      if (firestore && firebaseCollection && firebaseGetDocs) {
        const categoriesRef = firebaseCollection(firestore, 'categories');
        const snapshot = await firebaseGetDocs(categoriesRef);
        
        const categories = [];
        snapshot.forEach((doc) => {
          const firebaseCategory = doc.data();
          categories.push({
            id: typeof firebaseCategory.id === 'string' ? parseInt(firebaseCategory.id) : firebaseCategory.id,
            name: firebaseCategory.name || '',
            order_index: firebaseCategory.order_index || 0
          });
        });
        
        // order_index'e göre sırala
        categories.sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.id - b.id;
        });
        
        res.json(categories);
      } else {
        // Firebase yoksa local database'den çek
        res.json(db.categories.sort((a, b) => a.order_index - b.order_index));
      }
    } catch (error) {
      console.error('❌ Kategoriler çekilirken hata:', error);
      // Hata durumunda local database'den çek
      res.json(db.categories.sort((a, b) => a.order_index - b.order_index));
    }
  });

  appExpress.get('/api/products', async (req, res) => {
    try {
      const categoryId = req.query.category_id;
      
      let products = [];
      
      // Firebase'den direkt çek
      if (firestore && firebaseCollection && firebaseGetDocs) {
        const productsRef = firebaseCollection(firestore, 'products');
        const snapshot = await firebaseGetDocs(productsRef);
        
        snapshot.forEach((doc) => {
          const firebaseProduct = doc.data();
          const product = {
            id: typeof firebaseProduct.id === 'string' ? parseInt(firebaseProduct.id) : firebaseProduct.id,
            name: firebaseProduct.name || '',
            category_id: typeof firebaseProduct.category_id === 'string' ? parseInt(firebaseProduct.category_id) : firebaseProduct.category_id,
            price: parseFloat(firebaseProduct.price) || 0,
            image: firebaseProduct.image || null
          };
          
          // Kategori filtresi varsa uygula
          if (!categoryId || product.category_id === Number(categoryId)) {
            products.push(product);
          }
        });
      } else {
        // Firebase yoksa local database'den çek
        if (categoryId) {
          products = db.products.filter(p => p.category_id === Number(categoryId));
        } else {
          products = db.products;
        }
      }
      
      // Her ürün için stok bilgisini ekle (local database'den veya Firebase'den)
      const productsWithStock = await Promise.all(products.map(async (product) => {
        // Local database'de ürünü bul
        const localProduct = db.products.find(p => p.id === product.id);
        
        // Stok bilgisini al
        let stock = null;
        let trackStock = false;
        
        if (localProduct) {
          trackStock = localProduct.trackStock === true;
          if (trackStock) {
            stock = localProduct.stock !== undefined ? (localProduct.stock || 0) : null;
            // Eğer local'de stok yoksa Firebase'den çek
            if (stock === null) {
              stock = await getProductStockFromFirebase(product.id);
              if (stock === null) {
                stock = 0;
              }
            }
          }
        } else {
          // Local'de yoksa Firebase'den stok bilgisini çek
          const firebaseStock = await getProductStockFromFirebase(product.id);
          if (firebaseStock !== null) {
            trackStock = true;
            stock = firebaseStock;
          }
        }
        
        return {
          ...product,
          trackStock: trackStock,
          stock: trackStock ? (stock !== null ? stock : 0) : undefined
        };
      }));
      
      res.json(productsWithStock);
    } catch (error) {
      console.error('❌ Ürünler çekilirken hata:', error);
      // Hata durumunda local database'den çek
      let products = [];
      if (categoryId) {
        products = db.products.filter(p => p.category_id === Number(categoryId));
      } else {
        products = db.products;
      }
      
      // Stok bilgisini ekle
      const productsWithStock = products.map(product => ({
        ...product,
        trackStock: product.trackStock === true,
        stock: product.trackStock ? (product.stock !== undefined ? product.stock : 0) : undefined
      }));
      
      res.json(productsWithStock);
    }
  });

  // Backend resim cache (memory cache - Firebase Storage kullanımını azaltmak için)
  const imageCache = new Map();
  const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 gün (önceden 24 saat)
  const CACHE_MAX_SIZE = 1000; // Maksimum 1000 resim cache'de tut (önceden 100)
  
  // Resim proxy endpoint - CORS sorununu çözmek için + Backend cache
  // Image proxy endpoint - Firebase Storage ve R2 görselleri için CORS sorununu çözer
  appExpress.get('/api/image-proxy', async (req, res) => {
    try {
      const imageUrl = req.query.url;
      if (!imageUrl) {
        return res.status(400).json({ error: 'URL parametresi gerekli' });
      }
      
      // Firebase Storage veya R2 URL kontrolü
      const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com');
      const isR2ImageUrl = imageUrl.includes('r2.dev') || imageUrl.includes('r2.cloudflarestorage.com');
      
      if (!isFirebaseStorage && !isR2ImageUrl) {
        return res.status(400).json({ error: 'Geçersiz resim URL\'si (sadece Firebase Storage veya R2 destekleniyor)' });
      }
      
      // Cache'de var mı kontrol et
      const cached = imageCache.get(imageUrl);
      if (cached && (Date.now() - cached.timestamp) < CACHE_MAX_AGE) {
        // Cache'den döndür - Storage'a istek yok!
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(cached.buffer);
        return;
      }
      
      // Cache'de yoksa Storage'dan çek (Firebase Storage veya R2)
      let response;
      
      if (isR2ImageUrl) {
        // R2 için iki yöntem deneyelim:
        // 1. Önce R2 S3 API'sini kullanarak direkt çek (en güvenilir)
        // 2. Başarısız olursa public URL üzerinden çek
        
        try {
          // R2 URL'den dosya yolunu çıkar
          let filePath = '';
          if (imageUrl.includes('/images/')) {
            const urlParts = imageUrl.split('/images/');
            if (urlParts.length > 1) {
              filePath = `images/${urlParts[1]}`;
            }
          } else {
            // R2.dev subdomain formatından path çıkar
            const urlModule = require('url');
            const urlObj = new urlModule.URL(imageUrl);
            filePath = urlObj.pathname.substring(1); // Başındaki / karakterini kaldır
          }
          
          if (filePath) {
            // R2 S3 API'sini kullanarak direkt çek
            const getObjectCommand = new GetObjectCommand({
              Bucket: R2_CONFIG.bucketName,
              Key: filePath
            });
            
            const s3Response = await r2Client.send(getObjectCommand);
            
            // Stream'i buffer'a çevir
            const chunks = [];
            for await (const chunk of s3Response.Body) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            response = {
              buffer: buffer,
              contentType: s3Response.ContentType || 'image/jpeg'
            };
            
            console.log(`✅ R2 görsel S3 API üzerinden çekildi: ${filePath}`);
          } else {
            throw new Error('R2 dosya yolu çıkarılamadı');
          }
        } catch (s3Error) {
          console.warn('⚠️ R2 S3 API hatası, public URL denenecek:', s3Error.message);
          
          // S3 API başarısız olduysa, public URL üzerinden çek
          const https = require('https');
          const urlModule = require('url');
          const parsedUrl = new urlModule.URL(imageUrl);
          
          // R2.dev subdomain HTTPS kullanır
          const requestOptions = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/*'
            },
            rejectUnauthorized: true
          };
          
          response = await new Promise((resolve, reject) => {
            const req = https.get(imageUrl, requestOptions, (httpResponse) => {
              if (httpResponse.statusCode !== 200) {
                reject(new Error(`HTTP ${httpResponse.statusCode}`));
                return;
              }
              const chunks = [];
              httpResponse.on('data', (chunk) => chunks.push(chunk));
              httpResponse.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                contentType: httpResponse.headers['content-type'] || 'image/jpeg'
              }));
              httpResponse.on('error', reject);
            });
            req.on('error', (error) => {
              console.error('❌ R2 public URL hatası:', error);
              reject(error);
            });
            req.setTimeout(10000, () => {
              req.destroy();
              reject(new Error('Request timeout'));
            });
          });
        }
      } else {
        // Firebase Storage için mevcut yöntem
        const https = require('https');
        const http = require('http');
        const url = require('url');
        const parsedUrl = new url.URL(imageUrl);
        const httpModule = parsedUrl.protocol === 'https:' ? https : http;
        
        response = await new Promise((resolve, reject) => {
          const req = httpModule.get(imageUrl, (httpResponse) => {
            if (httpResponse.statusCode !== 200) {
              reject(new Error(`HTTP ${httpResponse.statusCode}`));
              return;
            }
            const chunks = [];
            httpResponse.on('data', (chunk) => chunks.push(chunk));
            httpResponse.on('end', () => resolve({
              buffer: Buffer.concat(chunks),
              contentType: httpResponse.headers['content-type'] || 'image/jpeg'
            }));
            httpResponse.on('error', reject);
          });
          req.on('error', (error) => {
            console.error('❌ Resim proxy hatası:', error);
            reject(error);
          });
          req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
        });
      }
      
      // Cache'e ekle (eski cache'leri temizle)
      if (imageCache.size >= CACHE_MAX_SIZE) {
        // En eski cache'i sil
        const oldestKey = Array.from(imageCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        imageCache.delete(oldestKey);
      }
      
      imageCache.set(imageUrl, {
        buffer: response.buffer,
        contentType: response.contentType,
        timestamp: Date.now()
      });
      
      // Resmi döndür
      res.setHeader('Content-Type', response.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(response.buffer);
    } catch (error) {
      console.error('❌ Resim proxy hatası:', error);
      res.status(500).json({ error: 'Resim yüklenemedi' });
    }
  });

  appExpress.get('/api/staff', (req, res) => {
    res.json((db.staff || []).map(s => ({
      id: s.id,
      name: s.name,
      surname: s.surname,
      is_manager: s.is_manager || false
    })));
  });

  appExpress.post('/api/staff/login', (req, res) => {
    const { password } = req.body;
    const staff = (db.staff || []).find(s => s.password === password.toString());
    if (staff) {
      res.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.name,
          surname: staff.surname,
          is_manager: staff.is_manager || false
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'Şifre hatalı' });
    }
  });

  appExpress.get('/api/tables', (req, res) => {
    const tables = [];
    for (let i = 1; i <= 20; i++) {
      const tableId = `inside-${i}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: i,
        type: 'inside',
        name: `İçeri ${i}`,
        hasOrder: hasPendingOrder
      });
    }
    for (let i = 1; i <= 24; i++) {
      const tableNumber = 60 + i; // 61-84
      const tableId = `outside-${tableNumber}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: tableNumber,
        type: 'outside',
        name: `Dışarı ${tableNumber}`,
        hasOrder: hasPendingOrder
      });
    }
    // Paket masaları - İçeri
    for (let i = 1; i <= 5; i++) {
      const tableId = `package-inside-${i}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: i,
        type: 'inside',
        name: `Paket ${i}`,
        hasOrder: hasPendingOrder
      });
    }
    // Paket masaları - Dışarı
    for (let i = 1; i <= 5; i++) {
      const tableId = `package-outside-${i}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: i,
        type: 'outside',
        name: `Paket ${i}`,
        hasOrder: hasPendingOrder
      });
    }
    res.json(tables);
  });

  // Masa aktar
  appExpress.post('/api/transfer-table-order', async (req, res) => {
    try {
      const { sourceTableId, targetTableId } = req.body;
      
      if (!sourceTableId || !targetTableId) {
        return res.status(400).json({ success: false, error: 'Kaynak ve hedef masa ID\'leri gerekli' });
      }
      
      // Kaynak masanın siparişini bul
      const sourceOrder = db.tableOrders.find(
        o => o.table_id === sourceTableId && o.status === 'pending'
      );

      if (!sourceOrder) {
        return res.status(404).json({ success: false, error: 'Kaynak masada aktif sipariş bulunamadı' });
      }

      // Hedef masada aktif sipariş var mı kontrol et
      const targetOrder = db.tableOrders.find(
        o => o.table_id === targetTableId && o.status === 'pending'
      );

      if (targetOrder) {
        return res.status(400).json({ success: false, error: 'Hedef masada zaten aktif bir sipariş var' });
      }

      // Kaynak masanın sipariş itemlarını al
      const sourceItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrder.id);

      if (sourceItems.length === 0) {
        return res.status(400).json({ success: false, error: 'Aktarılacak ürün bulunamadı' });
      }

      // Hedef masa bilgilerini al (masa adı ve tipi)
      let targetTableName = '';
      let targetTableType = sourceOrder.table_type; // Varsayılan olarak kaynak masanın tipi

      // Masa ID'sinden masa bilgilerini çıkar
      if (targetTableId.startsWith('inside-')) {
        targetTableName = `İçeri ${targetTableId.replace('inside-', '')}`;
        targetTableType = 'inside';
      } else if (targetTableId.startsWith('outside-')) {
        targetTableName = `Dışarı ${targetTableId.replace('outside-', '')}`;
        targetTableType = 'outside';
      } else if (targetTableId.startsWith('package-')) {
        const parts = targetTableId.split('-');
        targetTableName = `Paket ${parts[parts.length - 1]}`;
        targetTableType = parts[1] || sourceOrder.table_type; // package-{type}-{number}
      }

      // Kaynak siparişin tüm bilgilerini koru (order_date, order_time, order_note, total_amount)
      // Sadece table_id, table_name ve table_type'ı güncelle
      sourceOrder.table_id = targetTableId;
      sourceOrder.table_name = targetTableName;
      sourceOrder.table_type = targetTableType;

      // Tüm itemların order_id'si zaten doğru (aynı order'a ait oldukları için değişmeyecek)
      // Ancak emin olmak için kontrol edelim
      sourceItems.forEach(item => {
        if (item.order_id !== sourceOrder.id) {
          item.order_id = sourceOrder.id;
        }
      });

      saveDatabase();

      // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
      if (io) {
        io.emit('table-update', {
          tableId: sourceTableId,
          hasOrder: false
        });
        io.emit('table-update', {
          tableId: targetTableId,
          hasOrder: true
        });
      }

      res.json({ 
        success: true, 
        orderId: sourceOrder.id,
        sourceTableId: sourceTableId,
        targetTableId: targetTableId
      });
    } catch (error) {
      console.error('Masa aktarım hatası:', error);
      res.status(500).json({ success: false, error: 'Masa aktarılırken bir hata oluştu' });
    }
  });

  // Ürün iptal etme (mobil arayüz için)
  appExpress.post('/api/cancel-table-order-item', async (req, res) => {
    try {
      const { itemId, cancelQuantity, staffId } = req.body;
      
      if (!itemId) {
        return res.status(400).json({ success: false, error: 'Ürün ID\'si gerekli' });
      }

      // Müdür kontrolü
      if (staffId) {
        const staff = (db.staff || []).find(s => s.id === staffId);
        if (!staff || !staff.is_manager) {
          return res.status(403).json({ 
            success: false, 
            error: 'İptal yetkisi yok. İptal ettirmek için lütfen müdürle görüşünüz.' 
          });
        }
      } else {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }

      const item = db.tableOrderItems.find(oi => oi.id === itemId);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
      }

      const order = db.tableOrders.find(o => o.id === item.order_id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Sipariş bulunamadı' });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' });
      }

      // İptal edilecek miktarı belirle
      const quantityToCancel = cancelQuantity || item.quantity;
      if (quantityToCancel <= 0 || quantityToCancel > item.quantity) {
        return res.status(400).json({ success: false, error: 'Geçersiz iptal miktarı' });
      }

      // Ürün bilgilerini al (kategori ve yazıcı için)
      const product = db.products.find(p => p.id === item.product_id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Ürün bilgisi bulunamadı' });
      }

      // Kategori bilgisini al
      const category = db.categories.find(c => c.id === product.category_id);
      const categoryName = category ? category.name : 'Diğer';

      // Bu kategoriye atanmış yazıcıyı bul
      const assignment = db.printerAssignments.find(a => {
        const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
        return assignmentCategoryId === product.category_id;
      });

      if (!assignment) {
        return res.status(400).json({ success: false, error: 'Bu ürünün kategorisine yazıcı atanmamış' });
      }

      // İptal açıklaması kontrolü - açıklama yoksa fiş yazdırma, sadece açıklama iste
      let { cancelReason } = req.body;
      const hasCancelReason = cancelReason && cancelReason.trim() !== '';
      
      if (!hasCancelReason) {
        // Açıklama yok, fiş yazdırma - sadece açıklama iste
        return res.status(200).json({ 
          success: false, 
          requiresReason: true,
          message: 'Lütfen iptal açıklaması girin.' 
        });
      }
      
      // Açıklama var, işleme devam et - fiş yazdır
      cancelReason = cancelReason.trim();
      
      // İptal fişi yazdır (sadece açıklama varsa) - arka planda
      const now = new Date();
      const cancelDate = now.toLocaleDateString('tr-TR');
      const cancelTime = getFormattedTime(now);

      const cancelReceiptData = {
        tableName: order.table_name,
        tableType: order.table_type,
        productName: item.product_name,
        quantity: quantityToCancel,
        price: item.price,
        cancelDate: cancelDate,
        cancelTime: cancelTime,
        categoryName: categoryName
      };

      // Yazıcıya gönderme işlemini arka planda yap (await kullanmadan)
      printCancelReceipt(assignment.printerName, assignment.printerType, cancelReceiptData).catch(error => {
        console.error('İptal fişi yazdırma hatası:', error);
        // Yazdırma hatası olsa bile iptal işlemi zaten tamamlandı
      });

      // İptal edilecek tutarı hesapla (ikram değilse)
      const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);

      // Stok iadesi (ikram edilen ürünler hariç, sadece stok takibi yapılan ürünler için)
      if (!item.isGift) {
        const product = db.products.find(p => p.id === item.product_id);
        if (product && product.trackStock) {
          await increaseProductStock(item.product_id, quantityToCancel);
        }
      }

      // Masa siparişinin toplam tutarını güncelle
      order.total_amount = Math.max(0, order.total_amount - cancelAmount);

      // İptal açıklamasını kaydet
      if (quantityToCancel >= item.quantity) {
        // Tüm ürün iptal ediliyorsa, item'ı silmeden önce açıklamayı kaydet
        item.cancel_reason = cancelReason.trim();
        item.cancel_date = new Date().toISOString();
        // İptal edilmiş item'ı ayrı bir tabloya kaydetmek yerine, silmeden önce loglayabiliriz
        const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === itemId);
        if (itemIndex !== -1) {
          db.tableOrderItems.splice(itemIndex, 1);
        }
      } else {
        // Sadece bir kısmı iptal ediliyorsa, quantity'yi azalt ve açıklamayı kaydet
        item.quantity -= quantityToCancel;
        item.cancel_reason = cancelReason.trim();
        item.cancel_date = new Date().toISOString();
      }

      saveDatabase();

      // Firebase'e iptal kaydı ekle - arka planda
      if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
        const now = new Date();
        const cancelDate = now.toLocaleDateString('tr-TR');
        const cancelTime = getFormattedTime(now);
        
        // Siparişi oluşturan garson bilgisini bul
        const orderStaffName = order.staff_name || item.staff_name || null;
        
        // İptal eden personel bilgisi
        const cancelStaff = staffId ? (db.staff || []).find(s => s.id === staffId) : null;
        const cancelStaffName = cancelStaff ? `${cancelStaff.name} ${cancelStaff.surname}` : null;
        const cancelStaffIsManager = cancelStaff ? (cancelStaff.is_manager || false) : false;
        
        const cancelRef = firebaseCollection(firestore, 'cancels');
        // Firebase kaydetme işlemini arka planda yap (await kullanmadan)
        firebaseAddDoc(cancelRef, {
          item_id: itemId,
          order_id: order.id,
          table_id: order.table_id,
          table_name: order.table_name,
          table_type: order.table_type,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: quantityToCancel,
          price: item.price,
          cancel_reason: cancelReason,
          cancel_date: cancelDate,
          cancel_time: cancelTime,
          staff_id: staffId || null,
          staff_name: cancelStaffName,
          staff_is_manager: cancelStaffIsManager,
          order_staff_name: orderStaffName, // Siparişi oluşturan garson
          source: 'mobile', // 'desktop' veya 'mobile'
          created_at: firebaseServerTimestamp()
        }).then(() => {
          console.log('✅ İptal kaydı Firebase\'e başarıyla kaydedildi');
        }).catch(error => {
          console.error('❌ Firebase\'e iptal kaydı kaydedilemedi:', error);
        });
      }

      // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
      if (io) {
        io.emit('table-update', {
          tableId: order.table_id,
          hasOrder: order.total_amount > 0
        });
      }

      res.json({ 
        success: true, 
        remainingAmount: order.total_amount
      });
    } catch (error) {
      console.error('Ürün iptal hatası:', error);
      res.status(500).json({ success: false, error: 'Ürün iptal edilirken bir hata oluştu' });
    }
  });

  // Masa siparişlerini getir
  appExpress.get('/api/table-orders', (req, res) => {
    const { tableId } = req.query;
    if (!tableId) {
      return res.status(400).json({ error: 'tableId gerekli' });
    }
    
    const orders = (db.tableOrders || []).filter(
      o => o.table_id === tableId && o.status === 'pending'
    );
    
    // Her sipariş için itemları ekle
    const ordersWithItems = orders.map(order => {
      const items = (db.tableOrderItems || []).filter(
        item => item.order_id === order.id
      );
      return {
        ...order,
        items: items
      };
    });
    
    res.json(ordersWithItems);
  });

  // Mobil personel arayüzü için static dosyalar
  appExpress.get('/mobile-manifest.json', (req, res) => {
    // Manifest'i dinamik olarak oluştur - icon path'leri tam URL olmalı
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseURL = `${protocol}://${host}`;
    
    const manifest = {
      "name": "MAKARA Mobil Sipariş",
      "short_name": "MAKARA Mobil",
      "description": "MAKARA Satış Sistemi - Mobil Personel Arayüzü",
      "start_url": `${baseURL}/mobile`,
      "display": "standalone",
      "background_color": "#ec4899",
      "theme_color": "#ec4899",
      "orientation": "portrait",
      "icons": [
        {
          "src": `${baseURL}/mobilpersonel.png`,
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any maskable"
        },
        {
          "src": `${baseURL}/mobilpersonel.png`,
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "any maskable"
        }
      ]
    };
    
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
  });
  
  // Mobil personel icon'u - public klasöründen serve et
  appExpress.get('/mobilpersonel.png', (req, res) => {
    const iconPath = path.join(__dirname, '..', 'public', 'mobilpersonel.png');
    if (fs.existsSync(iconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(iconPath);
    } else {
      res.status(404).send('Icon not found');
    }
  });

  appExpress.get('/mobile', (req, res) => {
    res.send(generateMobileHTML(serverURL));
  });

  // Mesaj gönderme API endpoint'i
  appExpress.post('/api/broadcast-message', async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, error: 'Mesaj içeriği gerekli' });
      }

      const now = new Date();
      const messageDate = now.toLocaleDateString('tr-TR');
      const messageTime = getFormattedTime(now);

      // Firebase'e mesaj kaydet
      if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
        try {
          const broadcastsRef = firebaseCollection(firestore, 'broadcasts');
          await firebaseAddDoc(broadcastsRef, {
            message: message.trim(),
            date: messageDate,
            time: messageTime,
            created_at: firebaseServerTimestamp()
          });
          console.log('✅ Mesaj Firebase\'e başarıyla kaydedildi');
        } catch (error) {
          console.error('❌ Firebase\'e mesaj kaydedilemedi:', error);
        }
      }

      // Socket.IO ile tüm clientlara gönder
      if (io) {
        io.emit('broadcast-message', {
          message: message.trim(),
          date: messageDate,
          time: messageTime
        });
        console.log('✅ Mesaj tüm clientlara gönderildi');
      }

      // Desktop uygulamaya da gönder
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('broadcast-message', {
          message: message.trim(),
          date: messageDate,
          time: messageTime
        });
      }

      res.json({ success: true, message: 'Mesaj başarıyla gönderildi' });
    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      res.status(500).json({ success: false, error: 'Mesaj gönderilirken bir hata oluştu' });
    }
  });

  appExpress.post('/api/orders', async (req, res) => {
    try {
      const { items, totalAmount, tableId, tableName, tableType, orderNote, staffId } = req.body;
      
      // Stok kontrolü ve düşürme (sadece stok takibi yapılan ürünler için)
      for (const item of items) {
        if (!item.isGift) {
          const product = db.products.find(p => p.id === item.id);
          // Sadece stok takibi yapılan ürünler için kontrol et
          if (product && product.trackStock) {
            const stockDecreased = await decreaseProductStock(item.id, item.quantity);
            if (!stockDecreased) {
              return res.status(400).json({ 
                success: false, 
                error: `${item.name} için yetersiz stok` 
              });
            }
          }
        }
      }
      
      const existingOrder = (db.tableOrders || []).find(
        o => o.table_id === tableId && o.status === 'pending'
      );

      let orderId;
      let isNewOrder = false;

      if (existingOrder) {
        orderId = existingOrder.id;
        // Her sipariş için ayrı kayıt oluştur (aynı ürün olsa bile, farklı personel/saat bilgisiyle)
        // Böylece kategori bazlı yazdırmada her siparişin kendi bilgileri kullanılır
        items.forEach(newItem => {
          const itemId = (db.tableOrderItems || []).length > 0 
            ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 
            : 1;
          if (!db.tableOrderItems) db.tableOrderItems = [];
          const now = new Date();
          const addedDate = now.toLocaleDateString('tr-TR');
          const addedTime = getFormattedTime(now);
          const staff = staffId && db.staff ? db.staff.find(s => s.id === staffId) : null;
          const itemStaffName = staff ? `${staff.name} ${staff.surname}` : null;
          db.tableOrderItems.push({
            id: itemId,
            order_id: orderId,
            product_id: newItem.id,
            product_name: newItem.name,
            quantity: newItem.quantity,
            price: newItem.price,
            isGift: newItem.isGift || false,
            staff_id: staffId || null,
            staff_name: itemStaffName,
            added_date: addedDate,
            added_time: addedTime
          });
        });
        const existingTotal = existingOrder.total_amount || 0;
        existingOrder.total_amount = existingTotal + totalAmount;
        if (orderNote) {
          existingOrder.order_note = existingOrder.order_note 
            ? `${existingOrder.order_note}\n${orderNote}` 
            : orderNote;
        }
      } else {
        isNewOrder = true;
        const now = new Date();
        const orderDate = now.toLocaleDateString('tr-TR');
        const orderTime = getFormattedTime(now);
        orderId = (db.tableOrders || []).length > 0 
          ? Math.max(...db.tableOrders.map(o => o.id)) + 1 
          : 1;
        const staff = staffId && db.staff ? db.staff.find(s => s.id === staffId) : null;
        const staffName = staff ? `${staff.name} ${staff.surname}` : null;
        if (!db.tableOrders) db.tableOrders = [];
        db.tableOrders.push({
          id: orderId,
          table_id: tableId,
          table_name: tableName,
          table_type: tableType,
          total_amount: totalAmount,
          order_date: orderDate,
          order_time: orderTime,
          status: 'pending',
          order_note: orderNote || null,
          staff_id: staffId || null,
          staff_name: staffName
        });
        items.forEach(item => {
          const itemId = (db.tableOrderItems || []).length > 0 
            ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 
            : 1;
          if (!db.tableOrderItems) db.tableOrderItems = [];
          db.tableOrderItems.push({
            id: itemId,
            order_id: orderId,
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            isGift: item.isGift || false,
            staff_id: staffId || null,
            staff_name: staffName || null,
            added_date: orderDate,
            added_time: orderTime
          });
        });
      }

      saveDatabase();
      const finalTotalAmount = (db.tableOrders || []).find(o => o.id === orderId)?.total_amount || totalAmount;
      
      // Yeni Firebase'e sadece bu masayı kaydet (makaramasalar) - Mobil personel siparişleri için
      // Masaüstü uygulamasıyla aynı şekilde direkt çağır (setTimeout gerekmez çünkü saveDatabase senkron)
      syncSingleTableToFirebase(tableId).catch(err => {
        console.error('❌ Mobil sipariş Firebase kaydetme hatası:', err);
      });
      
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('new-order-created', { 
          orderId, 
          tableId,
          tableName, 
          tableType,
          totalAmount: finalTotalAmount,
          isNewOrder
        });
      }
      
      if (io) {
        io.emit('new-order', {
          orderId,
          tableId,
          tableName,
          tableType,
          totalAmount: finalTotalAmount,
          isNewOrder
        });
        io.emit('table-update', {
          tableId: tableId,
          hasOrder: true
        });
      }

      // Mobil personel arayüzünden gelen siparişler için otomatik adisyon yazdır (kategori bazlı)
      try {
        // Items'a staff_name, added_time ve added_date ekle (tableOrderItems'dan al)
        // Veritabanı zaten kaydedildi, şimdi items'ları bulabiliriz
        // Bu sipariş için az önce eklenen item'ları bul (en yüksek ID'li olanlar - en son eklenenler)
        // Her item için ayrı kayıt oluşturulduğu için, items array'indeki sıra ile tableOrderItems'daki sıra aynı olmalı
        // Ama güvenlik için en son eklenen kaydı bulalım
        const itemsWithStaff = items.map((item, index) => {
          // Mevcut orderId için bu ürünü ekleyen garsonu bul
          // En son eklenen item'ı al (ID'ye göre sırala - en yüksek ID = en son eklenen)
          const matchingItems = db.tableOrderItems.filter(oi => 
            oi.order_id === orderId && 
            oi.product_id === item.id && 
            oi.product_name === item.name &&
            oi.isGift === (item.isGift || false)
          );
          
          // En son eklenen item'ı al (ID'ye göre sırala - büyükten küçüğe)
          let orderItem = null;
          if (matchingItems.length > 0) {
            // ID'ye göre sırala ve en yüksek ID'li olanı al (en son eklenen)
            // Eğer birden fazla kayıt varsa, en son eklenenleri al ve index'e göre seç
            const sortedItems = matchingItems.sort((a, b) => b.id - a.id);
            // Eğer aynı ürün için birden fazla kayıt varsa, index'e göre seç
            // Örneğin: 2 adet çay sipariş edildiyse, 2 ayrı kayıt olacak
            // İlk item için en son eklenen 1. kayıt, ikinci item için en son eklenen 2. kayıt
            orderItem = sortedItems[index] || sortedItems[0];
          }
          
          // Eğer orderItem bulunduysa, onun bilgilerini kullan
          // Bulunamazsa, genel staffName ve şu anki zamanı kullan (fallback)
          const now = new Date();
          const fallbackDate = now.toLocaleDateString('tr-TR');
          const fallbackTime = getFormattedTime(now);
          
          return {
            ...item,
            staff_name: orderItem?.staff_name || staffName || null,
            added_date: orderItem?.added_date || fallbackDate,
            added_time: orderItem?.added_time || fallbackTime
          };
        });
        
        // Adisyon data'sı için, items'lardan personel ve zaman bilgisini al
        // İlk item'ın bilgilerini kullan (tüm items aynı personel ve zamanda eklenmiş olmalı)
        const firstItem = itemsWithStaff[0];
        const adisyonDate = firstItem?.added_date || new Date().toLocaleDateString('tr-TR');
        const adisyonTime = firstItem?.added_time || getFormattedTime(new Date());
        const adisyonStaffName = firstItem?.staff_name || staffName || null;
        
        const adisyonData = {
          items: itemsWithStaff,
          tableName: tableName,
          tableType: tableType,
          orderNote: orderNote || null,
          // Items'lardan alınan tarih/saat ve personel bilgisini kullan
          sale_date: adisyonDate,
          sale_time: adisyonTime,
          staff_name: adisyonStaffName
        };
        
        // Kategori bazlı adisyon yazdırma
        printAdisyonByCategory(itemsWithStaff, adisyonData).catch(err => {
          console.error('Mobil sipariş kategori bazlı adisyon yazdırma hatası:', err);
        });
      } catch (error) {
        console.error('Mobil sipariş adisyon yazdırma hatası:', error);
      }

      res.json({ 
        success: true, 
        orderId,
        isNewOrder,
        message: isNewOrder ? 'Yeni sipariş oluşturuldu' : 'Mevcut siparişe eklendi'
      });
    } catch (error) {
      console.error('Sipariş oluşturma hatası:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  server.listen(serverPort, () => {
    console.log(`\n🚀 API Server başlatıldı: ${serverURL}`);
    console.log(`📱 Mobil cihazlardan erişim için: ${serverURL}/mobile\n`);
  });

  apiServer = server;
  return { serverURL, localIP };
}

ipcMain.handle('quit-app', () => {
  saveDatabase();
  if (apiServer) {
    apiServer.close();
  }
  setTimeout(() => {
    app.quit();
  }, 500);
  return { success: true };
});

// Minimize window handler
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return { success: true };
});

// Mobil API IPC Handlers
ipcMain.handle('get-server-url', () => {
  if (!apiServer) {
    return { success: false, error: 'Server başlatılmadı' };
  }
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }
  const serverURL = `http://${localIP}:${serverPort}`;
  return { success: true, url: serverURL, ip: localIP, port: serverPort };
});

ipcMain.handle('generate-qr-code', async () => {
  try {
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }
    const serverURL = `http://${localIP}:${serverPort}/mobile`;
    const qrCodeDataURL = await QRCode.toDataURL(serverURL, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return { success: true, qrCode: qrCodeDataURL, url: serverURL };
  } catch (error) {
    console.error('QR kod oluşturma hatası:', error);
    return { success: false, error: error.message };
  }
});

// Staff Management IPC Handlers
ipcMain.handle('create-staff', (event, staffData) => {
  const { name, surname, password } = staffData;
  if (!name || !surname || !password) {
    return { success: false, error: 'Tüm alanları doldurun' };
  }
  if (!db.staff) db.staff = [];
  const newId = db.staff.length > 0 
    ? Math.max(...db.staff.map(s => s.id)) + 1 
    : 1;
  const newStaff = {
    id: newId,
    name: name.trim(),
    surname: surname.trim(),
    password: password.toString(),
    is_manager: false // Varsayılan olarak müdür değil
  };
  db.staff.push(newStaff);
  saveDatabase();
  return { success: true, staff: newStaff };
});

ipcMain.handle('delete-staff', (event, staffId) => {
  if (!db.staff) db.staff = [];
  const index = db.staff.findIndex(s => s.id === staffId);
  if (index === -1) {
    return { success: false, error: 'Personel bulunamadı' };
  }
  const deletedStaff = db.staff[index];
  db.staff.splice(index, 1);
  saveDatabase();
  
  // Mobil personel arayüzüne personel silme event'i gönder
  if (io) {
    io.emit('staff-deleted', {
      staffId: staffId,
      message: 'Hesabınız silindi. Lütfen tekrar giriş yapın.'
    });
  }
  
  return { success: true };
});

ipcMain.handle('update-staff-password', (event, staffId, newPassword) => {
  try {
    console.log('🔐 Şifre güncelleme isteği:', { staffId, newPasswordLength: newPassword?.length });
    
    if (!staffId) {
      console.error('❌ Personel ID eksik');
      return { success: false, error: 'Personel ID gerekli' };
    }
    
    if (!newPassword || newPassword.toString().trim() === '') {
      console.error('❌ Yeni şifre eksik veya boş');
      return { success: false, error: 'Yeni şifre gerekli' };
    }

    if (!db.staff) {
      console.error('❌ db.staff dizisi mevcut değil, oluşturuluyor...');
      db.staff = [];
      saveDatabase();
    }

    // ID'yi sayıya çevir (string olarak gelmiş olabilir)
    const staffIdNum = typeof staffId === 'string' ? parseInt(staffId) : staffId;
    
    const staff = db.staff.find(s => {
      const sId = typeof s.id === 'string' ? parseInt(s.id) : s.id;
      return sId === staffIdNum;
    });
    
    if (!staff) {
      console.error('❌ Personel bulunamadı. Mevcut personeller:', db.staff.map(s => ({ id: s.id, name: s.name })));
      return { success: false, error: `Personel bulunamadı (ID: ${staffId})` };
    }

    console.log('✅ Personel bulundu:', { id: staff.id, name: staff.name, surname: staff.surname });

    // Şifreyi güncelle
    staff.password = newPassword.toString();
    saveDatabase();

    console.log('✅ Şifre güncellendi ve veritabanına kaydedildi');

    // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
    if (io) {
      io.emit('staff-password-updated', {
        staffId: staffIdNum,
        message: 'Şifreniz güncellendi'
      });
      console.log('📡 Mobil arayüze bildirim gönderildi');
    }

    return { success: true, staff: { id: staff.id, name: staff.name, surname: staff.surname } };
  } catch (error) {
    console.error('❌ Şifre güncelleme hatası:', error);
    return { success: false, error: error.message || 'Şifre güncellenirken bir hata oluştu' };
  }
});

ipcMain.handle('get-staff', () => {
  if (!db.staff) db.staff = [];
  return db.staff.map(s => ({
    id: s.id,
    name: s.name,
    surname: s.surname,
    is_manager: s.is_manager || false
  }));
});

// Müdür atama/kaldırma
ipcMain.handle('set-staff-manager', (event, staffId, isManager) => {
  if (!db.staff) db.staff = [];
  const staff = db.staff.find(s => s.id === staffId);
  if (!staff) {
    return { success: false, error: 'Personel bulunamadı' };
  }
  
  // Eğer müdür yapılıyorsa, diğer tüm personellerin müdürlüğünü kaldır
  if (isManager) {
    db.staff.forEach(s => {
      if (s.id !== staffId) {
        s.is_manager = false;
      }
    });
  }
  
  staff.is_manager = isManager;
  saveDatabase();
  return { success: true, staff: staff };
});

ipcMain.handle('verify-staff-pin', (event, password) => {
  if (!db.staff) db.staff = [];
  const staff = db.staff.find(s => s.password === password.toString());
  if (staff) {
    return { success: true, staff: { id: staff.id, name: staff.name, surname: staff.surname } };
  }
  return { success: false, error: 'Şifre hatalı' };
});

// Mesaj gönderme IPC handler
ipcMain.handle('send-broadcast-message', async (event, message) => {
  if (!message || message.trim() === '') {
    return { success: false, error: 'Mesaj içeriği gerekli' };
  }

  const now = new Date();
  const messageDate = now.toLocaleDateString('tr-TR');
  const messageTime = getFormattedTime(now);

  // Firebase'e mesaj kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const broadcastsRef = firebaseCollection(firestore, 'broadcasts');
      await firebaseAddDoc(broadcastsRef, {
        message: message.trim(),
        date: messageDate,
        time: messageTime,
        created_at: firebaseServerTimestamp()
      });
      console.log('✅ Mesaj Firebase\'e başarıyla kaydedildi');
    } catch (error) {
      console.error('❌ Firebase\'e mesaj kaydedilemedi:', error);
    }
  }

  // Socket.IO ile tüm clientlara gönder
  if (io) {
    io.emit('broadcast-message', {
      message: message.trim(),
      date: messageDate,
      time: messageTime
    });
    console.log('✅ Mesaj tüm clientlara gönderildi');
  }

  // Desktop uygulamaya da gönder
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('broadcast-message', {
      message: message.trim(),
      date: messageDate,
      time: messageTime
    });
  }

  return { success: true, message: 'Mesaj başarıyla gönderildi' };
});

// Tek bir masayı yeni Firebase'e kaydet (makaramasalar) - sadece sipariş değişikliklerinde çağrılır
async function syncSingleTableToFirebase(tableId) {
  if (!tablesFirestore || !tablesFirebaseCollection || !tablesFirebaseDoc || !tablesFirebaseSetDoc) {
    console.warn('⚠️ Masalar Firebase başlatılamadı, masa kaydedilemedi');
    return;
  }

  try {
    const tableOrders = db.tableOrders || [];
    const tableOrderItems = db.tableOrderItems || [];

    console.log(`🔍 Masa Firebase'e kaydediliyor: ${tableId}`);
    console.log(`📊 Toplam sipariş sayısı: ${tableOrders.length}`);
    console.log(`📦 Toplam item sayısı: ${tableOrderItems.length}`);

    // Masa bilgilerini bul
    const order = tableOrders.find(o => o.table_id === tableId && o.status === 'pending');
    
    if (!order) {
      console.log(`⚠️ Masa için aktif sipariş bulunamadı: ${tableId} - Boş masa olarak kaydedilecek`);
    } else {
      console.log(`✅ Aktif sipariş bulundu: Order ID: ${order.id}, Tutar: ${order.total_amount}`);
    }
    
    // Masa numarasını çıkar
    let tableNumber = 0;
    let tableName = '';
    let tableType = 'inside';
    
    if (tableId.startsWith('inside-')) {
      tableNumber = parseInt(tableId.replace('inside-', '')) || 0;
      tableName = `İçeri ${tableNumber}`;
      tableType = 'inside';
    } else if (tableId.startsWith('outside-')) {
      tableNumber = parseInt(tableId.replace('outside-', '')) || 0;
      tableName = `Dışarı ${tableNumber}`;
      tableType = 'outside';
    } else if (tableId.startsWith('package-inside-')) {
      tableNumber = parseInt(tableId.replace('package-inside-', '')) || 0;
      tableName = `Paket ${tableNumber}`;
      tableType = 'inside';
    } else if (tableId.startsWith('package-outside-')) {
      tableNumber = parseInt(tableId.replace('package-outside-', '')) || 0;
      tableName = `Paket ${tableNumber}`;
      tableType = 'outside';
    }

    const isOccupied = !!order;
    let totalAmount = 0;
    let items = [];
    let orderId = null;
    let orderDate = null;
    let orderTime = null;
    let orderNote = null;

    if (order) {
      orderId = order.id;
      totalAmount = parseFloat(order.total_amount) || 0;
      orderDate = order.order_date || null;
      orderTime = order.order_time || null;
      orderNote = order.order_note || null;
      tableName = order.table_name || tableName;
      tableType = order.table_type || tableType;

      // Sipariş itemlarını al
      const orderItems = tableOrderItems.filter(oi => oi.order_id === order.id);
      items = orderItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0,
        isGift: item.isGift || false,
        is_paid: item.is_paid || false,
        paid_quantity: item.paid_quantity || 0,
        staff_name: item.staff_name || null,
        added_date: item.added_date || null,
        added_time: item.added_time || null
      }));
    }

    const tableData = {
      table_id: tableId,
      table_number: tableNumber,
      table_name: tableName,
      table_type: tableType,
      is_occupied: isOccupied,
      total_amount: totalAmount,
      order_id: orderId,
      order_date: orderDate,
      order_time: orderTime,
      order_note: orderNote,
      items: items,
      last_updated: new Date().toISOString()
    };

    // Yeni Firebase'e kaydet (makaramasalar)
    const tableRef = tablesFirebaseDoc(tablesFirestore, 'tables', tableId);
    await tablesFirebaseSetDoc(tableRef, tableData, { merge: true });
    
    console.log(`✅ Masa yeni Firebase'e kaydedildi: ${tableName} (${tableId})`);
    console.log(`📋 Kaydedilen veri: Dolu: ${isOccupied}, Tutar: ${totalAmount}, Item sayısı: ${items.length}`);
  } catch (error) {
    console.error(`❌ Masa yeni Firebase'e kaydedilemedi (${tableId}):`, error);
    console.error(`❌ Hata detayı:`, error.message);
    console.error(`❌ Stack trace:`, error.stack);
  }
}

