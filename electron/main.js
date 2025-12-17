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
// Görsel işleme için sharp (WebP + resize + kalite ayarı)
let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('⚠️ sharp modülü yüklenemedi, görsel optimizasyon devre dışı:', e.message);
}

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
let storageRef = null;
let storageUploadBytes = null;
let storageGetDownloadURL = null;
let storageDeleteObject = null;

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
  storageRef = firebaseStorageModule.ref;
  storageUploadBytes = firebaseStorageModule.uploadBytes;
  storageGetDownloadURL = firebaseStorageModule.getDownloadURL;
  storageDeleteObject = firebaseStorageModule.deleteObject;
  console.log('Firebase başarıyla başlatıldı (Firestore + Storage)');
} catch (error) {
  console.error('Firebase başlatılamadı:', error);
  console.log('Firebase olmadan devam ediliyor...');
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

      // Firebase Storage URL kontrolü
      if (product.image.includes('firebasestorage.googleapis.com')) {
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
        const downloadURL = await uploadImageToFirebaseStorage(imagePath, product.id);
        
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
        if (product.image && product.image.includes('firebasestorage.googleapis.com')) {
          await saveProductToFirebase(product);
        }
      }
    }

    console.log(`✅ Görsel migration tamamlandı: ${migratedCount} yüklendi, ${skippedCount} atlandı, ${errorCount} hata`);
  } catch (error) {
    console.error('❌ Görsel migration hatası:', error);
  }
}

// Tüm kategorileri Firebase'e senkronize et
async function syncCategoriesToFirebase() {
  if (!firestore || !firebaseCollection || !firebaseDoc || !firebaseSetDoc) {
    console.warn('⚠️ Firebase başlatılamadı, kategoriler senkronize edilemedi');
    return;
  }
  
  try {
    console.log('🔄 Kategoriler Firebase\'e senkronize ediliyor...');
    const categories = db.categories || [];
    
    for (const category of categories) {
      await saveCategoryToFirebase(category);
    }
    
    console.log(`✅ ${categories.length} kategori Firebase'e senkronize edildi`);
  } catch (error) {
    console.error('❌ Kategoriler senkronize edilirken hata oluştu:', error);
  }
}

// Tüm ürünleri Firebase'e senkronize et
async function syncProductsToFirebase() {
  if (!firestore || !firebaseCollection || !firebaseDoc || !firebaseSetDoc) {
    console.warn('⚠️ Firebase başlatılamadı, ürünler senkronize edilemedi');
    return;
  }
  
  try {
    console.log('🔄 Ürünler Firebase\'e senkronize ediliyor...');
    const products = db.products || [];
    
    for (const product of products) {
      await saveProductToFirebase(product);
    }
    
    console.log(`✅ ${products.length} ürün Firebase'e senkronize edildi`);
  } catch (error) {
    console.error('❌ Ürünler senkronize edilirken hata oluştu:', error);
  }
}

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
function setupCategoriesRealtimeListener() {
  if (!firestore || !firebaseCollection || !firebaseOnSnapshot) {
    console.warn('⚠️ Firebase başlatılamadı, kategori listener kurulamadı');
    return null;
  }
  
  try {
    console.log('👂 Kategoriler için gerçek zamanlı listener başlatılıyor...');
    const categoriesRef = firebaseCollection(firestore, 'categories');
    
    const unsubscribe = firebaseOnSnapshot(categoriesRef, (snapshot) => {
      console.log('🔄 Firebase\'den kategori güncellemesi alındı');
      
      snapshot.docChanges().forEach((change) => {
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
            // Güncelle
            db.categories[existingCategoryIndex] = categoryData;
            console.log(`✅ Kategori güncellendi: ${categoryData.name} (ID: ${categoryId})`);
          } else {
            // Yeni ekle
            db.categories.push(categoryData);
            console.log(`✅ Yeni kategori eklendi: ${categoryData.name} (ID: ${categoryId})`);
          }
          
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
        } else if (change.type === 'removed') {
          // Kategori silindi
          const categoryIndex = db.categories.findIndex(c => c.id === categoryId);
          if (categoryIndex !== -1) {
            const deletedCategory = db.categories[categoryIndex];
            db.categories.splice(categoryIndex, 1);
            saveDatabase();
            console.log(`✅ Kategori silindi: ${deletedCategory.name} (ID: ${categoryId})`);
            
            // Renderer process'e bildir
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('categories-updated', db.categories);
            }
          }
        }
      });
    }, (error) => {
      console.error('❌ Kategori listener hatası:', error);
    });
    
    console.log('✅ Kategoriler için gerçek zamanlı listener aktif');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Kategori listener kurulum hatası:', error);
    return null;
  }
}

// Firebase'den gerçek zamanlı ürün dinleme
function setupProductsRealtimeListener() {
  if (!firestore || !firebaseCollection || !firebaseOnSnapshot) {
    console.warn('⚠️ Firebase başlatılamadı, ürün listener kurulamadı');
    return null;
  }
  
  try {
    console.log('👂 Ürünler için gerçek zamanlı listener başlatılıyor...');
    const productsRef = firebaseCollection(firestore, 'products');
    
    const unsubscribe = firebaseOnSnapshot(productsRef, (snapshot) => {
      console.log('🔄 Firebase\'den ürün güncellemesi alındı');
      
      snapshot.docChanges().forEach((change) => {
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
            // Güncelle
            db.products[existingProductIndex] = productData;
            console.log(`✅ Ürün güncellendi: ${productData.name} (ID: ${productId})`);
          } else {
            // Yeni ekle
            db.products.push(productData);
            console.log(`✅ Yeni ürün eklendi: ${productData.name} (ID: ${productId})`);
          }
          
          saveDatabase();
          
          // Renderer process'e bildir
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('products-updated', db.products);
          }
        } else if (change.type === 'removed') {
          // Ürün silindi
          const productIndex = db.products.findIndex(p => p.id === productId);
          if (productIndex !== -1) {
            const deletedProduct = db.products[productIndex];
            db.products.splice(productIndex, 1);
            saveDatabase();
            console.log(`✅ Ürün silindi: ${deletedProduct.name} (ID: ${productId})`);
            
            // Renderer process'e bildir
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('products-updated', db.products);
            }
          }
        }
      });
    }, (error) => {
      console.error('❌ Ürün listener hatası:', error);
    });
    
    console.log('✅ Ürünler için gerçek zamanlı listener aktif');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Ürün listener kurulum hatası:', error);
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

ipcMain.handle('get-products', (event, categoryId) => {
  if (categoryId) {
    return db.products.filter(p => p.category_id === categoryId);
  }
  return db.products;
});

ipcMain.handle('create-sale', async (event, saleData) => {
  const { items, totalAmount, paymentMethod, orderNote, staff_name } = saleData;
  
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

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

ipcMain.handle('get-sale-details', (event, saleId) => {
  const sale = db.sales.find(s => s.id === saleId);
  const items = db.saleItems.filter(si => si.sale_id === saleId);
  
  return { sale, items };
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

// Kategorileri yeniden sıralama (order_index güncelleme)
ipcMain.handle('reorder-categories', async (event, orderedCategoryIds) => {
  try {
    if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
      return { success: false, error: 'Geçersiz kategori sırası' };
    }

    // ID'leri number'a çevir
    const normalizedIds = orderedCategoryIds.map(id =>
      typeof id === 'string' ? parseInt(id) : id
    );

    // Tüm kategorilerin mevcut olduğunu doğrula
    const allExist = normalizedIds.every(id =>
      db.categories.some(c => c.id === id)
    );
    if (!allExist) {
      return { success: false, error: 'Mevcut olmayan kategori ID\'si gönderildi' };
    }

    // Yeni order_index değerlerini ata
    normalizedIds.forEach((id, index) => {
      const cat = db.categories.find(c => c.id === id);
      if (cat) {
        cat.order_index = index;
      }
    });

    // Güvenlik için diğer kategorileri de sona ekle (eğer varsa)
    const remaining = db.categories
      .filter(c => !normalizedIds.includes(c.id))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    remaining.forEach((cat, offset) => {
      cat.order_index = normalizedIds.length + offset;
    });

    // Veritabanını kaydet
    saveDatabase();

    // Firebase'e güncel sırayı yansıt
    try {
      for (const category of db.categories) {
        await saveCategoryToFirebase(category);
      }
    } catch (err) {
      console.error('Firebase kategori sıralama güncelleme hatası:', err);
      // Firebase hatası olsa bile local sıralama kaydedildi, uyarı ver
      return {
        success: false,
        error:
          'Sıralama localde kaydedildi ancak Firebase güncellenemedi. İnternet bağlantınızı kontrol edin.'
      };
    }

    const sorted = [...db.categories].sort(
      (a, b) => a.order_index - b.order_index
    );

    return { success: true, categories: sorted };
  } catch (error) {
    console.error('Kategori sıralama hatası:', error);
    return { success: false, error: error.message };
  }
});

// Table Order IPC Handlers
ipcMain.handle('create-table-order', (event, orderData) => {
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

  if (existingOrder) {
    // Mevcut siparişe ekle
    orderId = existingOrder.id;
    items.forEach(newItem => {
      const existingItem = (db.tableOrderItems || []).find(
        oi => oi.order_id === orderId && 
              oi.product_id === newItem.id && 
              oi.isGift === (newItem.isGift || false)
      );
      if (existingItem) {
        existingItem.quantity += newItem.quantity;
      } else {
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
      }
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
ipcMain.handle('cancel-table-order-item', async (event, itemId, cancelQuantity) => {
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

  // İptal edilecek miktarı belirle
  const quantityToCancel = cancelQuantity || item.quantity;
  if (quantityToCancel <= 0 || quantityToCancel > item.quantity) {
    return { success: false, error: 'Geçersiz iptal miktarı' };
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

  // İptal fişi yazdır
  try {
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

    await printCancelReceipt(assignment.printerName, assignment.printerType, cancelReceiptData);
  } catch (error) {
    console.error('İptal fişi yazdırma hatası:', error);
    // Yazdırma hatası olsa bile iptal işlemini devam ettir
  }

  // İptal edilecek tutarı hesapla (ikram değilse)
  const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);

  // Masa siparişinin toplam tutarını güncelle
  order.total_amount = Math.max(0, order.total_amount - cancelAmount);

  // Eğer tüm ürün iptal ediliyorsa, item'ı sil
  if (quantityToCancel >= item.quantity) {
    const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === itemId);
    if (itemIndex !== -1) {
      db.tableOrderItems.splice(itemIndex, 1);
    }
  } else {
    // Sadece bir kısmı iptal ediliyorsa, quantity'yi azalt
    item.quantity -= quantityToCancel;
  }

  saveDatabase();

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

  return { 
    success: true, 
    orderId: sourceOrder.id,
    sourceTableId: sourceTableId,
    targetTableId: targetTableId
  };
});

ipcMain.handle('complete-table-order', async (event, orderId) => {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  // Sipariş durumunu tamamlandı olarak işaretle
  order.status = 'completed';

  // Satış geçmişine ekle (nakit olarak)
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

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: order.total_amount,
    payment_method: 'Nakit',
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
        payment_method: 'Nakit',
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
  if (oldImage && oldImage !== image && oldImage.includes('firebasestorage.googleapis.com')) {
    await deleteImageFromFirebaseStorage(oldImage);
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
  
  return { success: true, product: db.products[productIndex] };
});

ipcMain.handle('delete-product', async (event, productId) => {
  const productIndex = db.products.findIndex(p => p.id === productId);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  const product = db.products[productIndex];
  
  // Check if product is used in any sale
  const isUsedInSale = db.saleItems.some(si => si.product_id === productId);
  if (isUsedInSale) {
    return { success: false, error: 'Bu ürün satış geçmişinde kullanıldığı için silinemez' };
  }
  
  // Eğer ürünün Firebase Storage'da görseli varsa, onu da sil
  if (product.image && product.image.includes('firebasestorage.googleapis.com')) {
    await deleteImageFromFirebaseStorage(product.image);
  }
  
  db.products.splice(productIndex, 1);
  saveDatabase();
  
  // Firebase'den ürünü sil
  if (firestore && firebaseDoc && firebaseDeleteDoc) {
    try {
      const productRef = firebaseDoc(firestore, 'products', productId.toString());
      await firebaseDeleteDoc(productRef);
      console.log(`✅ Ürün Firebase'den silindi: ${product.name} (ID: ${productId})`);
    } catch (error) {
      console.error('❌ Firebase\'den ürün silme hatası:', error);
      console.error('Hata detayları:', error.message, error.code);
      // Hata olsa bile local'den silindi, devam et
    }
  } else {
    console.warn('⚠️ Firebase başlatılamadı, ürün sadece local database\'den silindi');
  }
  
  return { success: true };
});

// Tek bir görsel buffer'ını WebP formatına çevirip optimize eden yardımcı fonksiyon
// Kurallar:
// - Max width: 600px (daha büyükse küçült, küçükse büyütme)
// - Başlangıç kalite: 65, gerektiğinde kaliteyi düşürerek 120 KB altına inmeye çalış
// - Sert limit: 200 KB üstü ise RED (hata fırlat)
async function optimizeImageBufferToWebP(inputBuffer) {
  if (!sharp) {
    const err = new Error('Görsel optimizasyon modülü (sharp) yüklenemedi');
    err.code = 'SHARP_NOT_AVAILABLE';
    throw err;
  }

  const MAX_WIDTH = 600;
  const INITIAL_QUALITY = 65;
  const MIN_QUALITY = 40;
  const QUALITY_STEP = 5;
  const TARGET_MAX_KB = 120;
  const HARD_LIMIT_KB = 200;

  let quality = INITIAL_QUALITY;

  const encodeWithQuality = async (q) => {
    return sharp(inputBuffer, { failOnError: false })
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true
      })
      .webp({
        quality: q,
        effort: 4
      })
      .toBuffer();
  };

  // İlk deneme
  let optimizedBuffer = await encodeWithQuality(quality);
  let sizeKB = optimizedBuffer.length / 1024;

  // 120 KB'nin üzerindeyse, kaliteyi kademeli düşür
  while (sizeKB > TARGET_MAX_KB && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    optimizedBuffer = await encodeWithQuality(quality);
    sizeKB = optimizedBuffer.length / 1024;
  }

  // Sert limit kontrolü
  if (sizeKB > HARD_LIMIT_KB) {
    const err = new Error(
      `Optimize edilmiş görsel hala çok büyük (${sizeKB.toFixed(
        1
      )} KB). Lütfen daha küçük/basitleştirilmiş bir görsel kullanın.`
    );
    err.code = 'OPTIMIZED_IMAGE_TOO_LARGE';
    err.sizeKB = sizeKB;
    throw err;
  }

  console.log(
    `🖼️ Görsel optimize edildi -> WebP, kalite=${quality}, boyut=${sizeKB.toFixed(
      1
    )} KB`
  );

  return {
    buffer: optimizedBuffer,
    sizeKB,
    quality
  };
}

// Firebase Storage'a görsel yükleme fonksiyonu (ZORUNLU OPTİMİZASYONLU)
async function uploadImageToFirebaseStorage(filePath, productId = null) {
  if (!storage || !storageRef || !storageUploadBytes || !storageGetDownloadURL) {
    throw new Error('Firebase Storage başlatılamadı');
  }

  try {
    // Dosyayı oku
    const originalBuffer = fs.readFileSync(filePath);

    // Zorunlu optimizasyon: her görsel WebP + resize + kalite ile sıkıştırılır
    const { buffer: optimizedBuffer, sizeKB } = await optimizeImageBufferToWebP(
      originalBuffer
    );

    // Benzersiz dosya adı oluştur (ürün ID + timestamp) - her zaman .webp
    const timestamp = Date.now();
    const uniqueFileName = productId
      ? `products/${productId}_${timestamp}.webp`
      : `products/temp_${timestamp}.webp`;

    // Storage referansı oluştur
    const imageRef = storageRef(storage, uniqueFileName);

    // Metadata: sadece optimize edilmiş WebP saklanır
    const metadata = {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    };

    // Optimize edilmiş görseli yükle
    await storageUploadBytes(imageRef, optimizedBuffer, metadata);
    console.log(
      `✅ Optimize görsel Firebase Storage'a yüklendi: ${uniqueFileName} (${sizeKB.toFixed(
        1
      )} KB)`
    );

    // Download URL'yi al
    const downloadURL = await storageGetDownloadURL(imageRef);
    console.log(`✅ Görsel URL alındı: ${downloadURL}`);

    return downloadURL;
  } catch (error) {
    console.error('❌ Firebase Storage yükleme/optimizasyon hatası:', error);
    throw error;
  }
}

// Firebase Storage'dan görsel silme fonksiyonu
async function deleteImageFromFirebaseStorage(imageURL) {
  if (!storage || !storageRef || !storageDeleteObject) {
    console.warn('⚠️ Firebase Storage başlatılamadı, görsel silinemedi');
    return;
  }

  if (!imageURL || typeof imageURL !== 'string') {
    return;
  }

  try {
    // URL'den dosya yolunu çıkar
    // Firebase Storage URL formatı: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media&token=TOKEN
    const urlMatch = imageURL.match(/\/o\/([^?]+)/);
    if (!urlMatch || !urlMatch[1]) {
      console.warn('⚠️ Geçersiz Storage URL formatı:', imageURL);
      return;
    }

    // URL decode yap
    const filePath = decodeURIComponent(urlMatch[1]);
    
    // Storage referansı oluştur ve sil
    const imageRef = storageRef(storage, filePath);
    await storageDeleteObject(imageRef);
    console.log(`✅ Görsel Firebase Storage'dan silindi: ${filePath}`);
  } catch (error) {
    console.error('❌ Firebase Storage silme hatası:', error);
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

    // Firebase Storage'a OPTİMİZE edilmiş görseli yükle
    try {
      const downloadURL = await uploadImageToFirebaseStorage(filePath, productId);
      return { success: true, path: downloadURL, isFirebaseURL: true };
    } catch (storageError) {
      console.error('Firebase Storage yükleme/optimizasyon hatası:', storageError);

      // Boyut/optimizasyon kaynaklı hatalarda fallback kullanma, direkt hata döndür
      if (
        storageError &&
        (storageError.code === 'OPTIMIZED_IMAGE_TOO_LARGE' ||
          storageError.code === 'SHARP_NOT_AVAILABLE')
      ) {
        return {
          success: false,
          error: storageError.message || 'Görsel optimize edilemedi'
        };
      }

      // Diğer hatalarda eski yönteme (public klasörüne kopyalama) geriye dönük uyumluluk için izin ver
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

// Mevcut Firebase Storage ürün görsellerini yeniden optimize edip overwrite eden batch job
async function optimizeAllProductImages() {
  if (!sharp) {
    throw new Error('Görsel optimizasyon modülü (sharp) yüklenemedi');
  }
  if (!storage || !storageRef || !storageUploadBytes) {
    throw new Error('Firebase Storage başlatılamadı');
  }

  // db.products içindeki tüm ürünleri dolaş
  const products = db.products || [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const https = require('https');

  const downloadToBuffer = (url) => {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', (err) => reject(err));
    });
  };

  for (const product of products) {
    const imageUrl = product.image;

    // Görsel yoksa ya da Firebase Storage URL değilse atla
    if (
      !imageUrl ||
      typeof imageUrl !== 'string' ||
      !imageUrl.includes('firebasestorage.googleapis.com')
    ) {
      skipped++;
      continue;
    }

    try {
      console.log(`🔄 Ürün görseli optimize ediliyor: ${product.name} (${imageUrl})`);

      // URL'den storage path çıkar
      const urlMatch = imageUrl.match(/\/o\/([^?]+)/);
      if (!urlMatch || !urlMatch[1]) {
        console.warn('⚠️ Geçersiz Storage URL formatı, atlanıyor:', imageUrl);
        skipped++;
        continue;
      }
      const filePathInStorage = decodeURIComponent(urlMatch[1]);
      const imageRef = storageRef(storage, filePathInStorage);

      // Remote görseli indir
      const originalBuffer = await downloadToBuffer(imageUrl);

      // Optimize et
      const { buffer: optimizedBuffer, sizeKB } =
        await optimizeImageBufferToWebP(originalBuffer);

      // Aynı path'e overwrite et (sadece optimize sürüm kalır)
      const metadata = {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable'
      };
      await storageUploadBytes(imageRef, optimizedBuffer, metadata);

      console.log(
        `✅ Ürün görseli yeniden optimize edildi: ${product.name} -> ${sizeKB.toFixed(
          1
        )} KB`
      );
      processed++;
    } catch (err) {
      console.error(
        `❌ Ürün görseli optimize edilemedi (${product.name || product.id}):`,
        err
      );
      failed++;
      // Devam et
    }
  }

  console.log(
    `📊 Görsel optimize özeti -> işlendi: ${processed}, atlandı: ${skipped}, hata: ${failed}`
  );

  return { success: true, processed, skipped, failed };
}

// Batch job'ı UI'dan tetiklemek için IPC
ipcMain.handle('optimize-all-product-images', async () => {
  try {
    const result = await optimizeAllProductImages();
    return result;
  } catch (error) {
    console.error('❌ Toplu görsel optimizasyon hatası:', error);
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
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif;">
          <span>${item.name}</span>
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
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-style: italic; margin-bottom: 4px; font-family: 'Montserrat', sans-serif;">
          <span>${item.name}</span>
          <span>₺${itemTotal.toFixed(2)}</span>
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

  // Firebase senkronizasyonu: Önce Firebase'den çek, sonra local'den Firebase'e gönder
  setTimeout(async () => {
    console.log('🔄 Firebase senkronizasyonu başlatılıyor...');
    
    // 1. Önce Firebase'den kategorileri ve ürünleri çek
    await syncCategoriesFromFirebase();
    await syncProductsFromFirebase();
    
    // 2. Local path'leri Firebase Storage'a yükle (migration)
    await migrateLocalImagesToFirebase();
    
    // 3. Sonra local database'deki verileri Firebase'e gönder (iki yönlü senkronizasyon)
    await syncCategoriesToFirebase();
    await syncProductsToFirebase();
    
    // 4. Gerçek zamanlı listener'ları başlat (anında güncellemeler için)
    setupCategoriesRealtimeListener();
    setupProductsRealtimeListener();
    
    console.log('✅ Firebase senkronizasyonu tamamlandı ve gerçek zamanlı listener\'lar aktif');
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
          <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 900; color: #000; text-decoration: line-through; text-decoration-thickness: 3px;">${cancelData.productName}</p>
          <span style="display: inline-block; font-size: 8px; color: #000; font-weight: 700; padding: 2px 6px; border: 1px solid #000; border-radius: 3px; margin-top: 4px;">iptal</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 2px solid #000;">
          <div>
            <p style="margin: 0; font-size: 8px; color: #000; font-weight: 700;">Adet</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 900; color: #000;">${cancelData.quantity} adet</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 8px; color: #000; font-weight: 700;">Birim Fiyat</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 900; color: #000;">₺${cancelData.price.toFixed(2)}</p>
          </div>
        </div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 3px solid #000;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-size: 9px; color: #000; font-weight: 700; text-transform: uppercase;">Toplam</p>
            <p style="margin: 0; font-size: 16px; font-weight: 900; color: #000;">₺${(cancelData.price * cancelData.quantity).toFixed(2)}</p>
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
    .header {
      text-align: center;
      margin-bottom: 4px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 24px;
      margin-bottom: 2px;
      font-weight: bold;
    }
    .header p {
      color: #666;
      font-size: 14px;
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
    /* İçerideki boş masalar - İçeri butonuyla aynı soft pembe ton */
    .table-btn.inside-empty {
      background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
      border-color: #fbcfe8;
      color: #9d174d;
    }
    .table-btn.inside-empty .table-number,
    .table-btn.inside-empty .table-label {
      color: #9d174d;
    }
    /* Dışarıdaki boş masalar - mevcut soft sarı ton */
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
    /* Dolu masalar - içeride/dışarıda tümü için kan kırmızısı ton */
    .table-btn.has-order {
      border-color: #7f1d1d;
      background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
      color: #fee2e2;
    }
    .table-btn.has-order.selected {
      border-color: #b91c1c;
      background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%);
      color: #fee2e2;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.6);
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
    /* Kategori sekmeleri - 2 satırlı, yatay (sağa-sola) kaydırmalı grid yapı */
    .category-tabs {
      display: grid;
      grid-auto-flow: column;                /* Sütunları yatayda akıt */
      grid-auto-columns: minmax(100px, 1fr); /* Her kategori için sabit genişlik */
      grid-template-rows: repeat(2, auto);   /* Aynı anda 2 satır göster */
      column-gap: 8px;
      row-gap: 6px;
      overflow-x: auto;                      /* Sağa-sola kaydırma */
      overflow-y: hidden;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
    }
    .category-tabs::-webkit-scrollbar {
      height: 4px;
    }
    .category-tabs::-webkit-scrollbar-thumb {
      background: #d4b5ff;
      border-radius: 999px;
    }
    .category-tab {
      padding: 8px 6px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      font-size: 13px;
      font-weight: 600;
      white-space: normal;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: #6b7280;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    /* Kategori butonları için yumuşak pastel arkaplanlar (aktif olmayanlar) */
    .category-tab:nth-child(6n+1):not(.active) {
      background: #fdf2f8;           /* çok açık pembe */
      border-color: #fbcfe8;
    }
    .category-tab:nth-child(6n+2):not(.active) {
      background: #f5f3ff;           /* çok açık mor/lila */
      border-color: #ddd6fe;
    }
    .category-tab:nth-child(6n+3):not(.active) {
      background: #eff6ff;           /* çok açık mavi */
      border-color: #bfdbfe;
    }
    .category-tab:nth-child(6n+4):not(.active) {
      background: #ecfdf3;           /* çok açık yeşil */
      border-color: #bbf7d0;
    }
    .category-tab:nth-child(6n+5):not(.active) {
      background: #fffbeb;           /* çok açık sarı */
      border-color: #fef3c7;
    }
    .category-tab:nth-child(6n+6):not(.active) {
      background: #fef2f2;           /* çok açık kırmızı/rose */
      border-color: #fecaca;
    }
    .category-tab:active {
      transform: scale(0.96);
    }
    .category-tab.active {
      border-color: #a855f7;
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
      transform: translateY(-1px);
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
      border: 2px solid rgba(189, 68, 128, 0.99); /* pembe stroke çerçeve */
      border-radius: 14px;
      background: #1f2937;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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
      /* Düz, sade pembe overlay (gradyansız), %50 opaklık */
      background: rgba(220, 67, 144, 0.8);
      z-index: 1;
    }
    .product-card:hover {
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
        transform: scale(1.08);
      }
    }
    /* Mevcut Siparişler Bölümü */
    .existing-orders {
      margin-bottom: 20px;
      padding: 0 0 15px 0;
    }
    .existing-orders-title {
      font-size: 15px;
      font-weight: 800;
      color: #7f1d1d;
      margin-bottom: 8px;
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 45%, #fee2e2 100%);
      border-radius: 999px;
      border: 1px solid #fecaca;
      padding: 10px 14px;
      box-shadow: 0 4px 12px rgba(248, 113, 113, 0.45);
    }
    .existing-orders-title-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .existing-orders-title-left::before {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: radial-gradient(circle at 30% 30%, #fee2e2 0%, #ef4444 45%, #7f1d1d 100%);
      box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.45);
      animation: pulse 1.6s infinite;
    }
    .existing-orders-toggle-icon {
      font-size: 16px;
      color: #b91c1c;
      font-weight: 800;
    }
    .existing-orders-content {
      margin-top: 6px;
    }
    .existing-orders-actions {
      display: flex;
      justify-content: flex-end;
      padding: 4px 5px 10px 5px;
    }
    .existing-orders-actions .adisyon-btn {
      padding: 10px 18px;
      border-radius: 999px;
      border: none;
      font-size: 13px;
      font-weight: 800;
      color: #78350f;
      background: linear-gradient(135deg, #fef9c3 0%, #fde68a 45%, #fbbf24 100%);
      box-shadow: 0 4px 12px rgba(250, 204, 21, 0.5);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    .existing-orders-actions .adisyon-btn:hover {
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 6px 16px rgba(250, 204, 21, 0.65);
      filter: brightness(1.02);
    }
    .existing-orders-actions .adisyon-btn:active {
      transform: translateY(0) scale(0.97);
      box-shadow: 0 2px 8px rgba(250, 204, 21, 0.4);
      filter: brightness(0.99);
    }
    .adisyon-btn-icon {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.45);
      color: #fff;
      font-size: 13px;
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
    <div id="mainSection" style="display: none; padding-top: 16px;">
      <!-- Çıkış Yap Butonu - Sol Üst (masalar ekranında görünecek) -->
      <button class="logout-btn" id="mainLogoutBtn" onclick="showLogoutModal()" title="Çıkış Yap" style="display: none;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Çıkış Yap</span>
      </button>
      
      <!-- Garson bilgisi gösterilmesin (taslaktan kaldırıldı) -->
      
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
        <!-- En Üst: Kategoriler ve Arama -->
        <div style="position: sticky; top: 0; z-index: 100; background: white; padding: 15px 0; margin: -15px -15px 15px -15px; padding-left: 15px; padding-right: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 0 0 20px 20px;">
          <!-- Geri Dön Butonu -->
          <button class="back-btn" onclick="goBackToTables()" style="position: relative; top: 0; left: 0; margin-bottom: 12px; width: 100%; max-width: none; animation: none;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            <span>Masalara Dön</span>
          </button>
          
          <!-- Kategoriler -->
          <div style="margin-bottom: 12px;">
            <div class="category-tabs" id="categoryTabs" style="gap: 10px; padding-bottom: 0;"></div>
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
        
        <!-- Mevcut Siparişler (açılır/kapanır) -->
        <div class="existing-orders" id="existingOrders" style="display: none;">
          <button type="button" class="existing-orders-title" onclick="toggleExistingOrders()">
            <div class="existing-orders-title-left">
              <span>Mevcut Siparişler</span>
            </div>
            <span class="existing-orders-toggle-icon" id="existingOrdersToggleIcon">▼</span>
          </button>
          <div class="existing-orders-content" id="existingOrdersContent" style="display: none;">
            <div class="existing-orders-actions">
              <button type="button" class="adisyon-btn" onclick="requestTableAdisyon()">
                <span class="adisyon-btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="3" width="16" height="18" rx="2" ry="2"></rect>
                    <line x1="8" y1="7" x2="16" y2="7"></line>
                    <line x1="8" y1="11" x2="16" y2="11"></line>
                    <line x1="8" y1="15" x2="12" y2="15"></line>
                  </svg>
                </span>
                <span>Adisyon İste</span>
              </button>
            </div>
            <div id="existingOrdersList"></div>
          </div>
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
  
  <style>
    @keyframes slideUp {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
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
    let existingOrdersExpanded = false;
    let isRequestingTableAdisyon = false;
    
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
        // Garson adı gösterilecek bir alan artık olmadığı için DOM güncellemesi opsiyonel
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
            const staffNameEl = document.getElementById('staffName');
            if (staffNameEl) {
              staffNameEl.textContent = currentStaff.name + ' ' + currentStaff.surname;
            }
            // Garson infosu artık gösterilmiyor
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
          // Masa verilerini API'den yeniden yükle (güncel durumu almak için)
          try {
            const tablesRes = await fetch(API_URL + '/tables');
            if (tablesRes.ok) {
              tables = await tablesRes.json();
              renderTables();
            } else {
              // API hatası durumunda sadece mevcut veriyi güncelle
              if (tables && tables.length > 0) {
                const tableIndex = tables.findIndex(t => t.id === data.tableId);
                if (tableIndex !== -1) {
                  tables[tableIndex].hasOrder = data.hasOrder;
                  renderTables();
                }
              }
            }
            // Eğer seçili masa varsa siparişleri yenile
            if (selectedTable && selectedTable.id === data.tableId) {
              await loadExistingOrders(selectedTable.id);
            }
          } catch (error) {
            console.error('Masa güncelleme hatası:', error);
            // Hata durumunda sadece mevcut veriyi güncelle
            if (tables && tables.length > 0) {
              const tableIndex = tables.findIndex(t => t.id === data.tableId);
              if (tableIndex !== -1) {
                tables[tableIndex].hasOrder = data.hasOrder;
                renderTables();
              }
            }
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
      // Garson bilgisi ve ana logout butonu gösterilmesin
      const staffInfoEl = document.getElementById('staffInfo');
      if (staffInfoEl) staffInfoEl.style.display = 'none';
      const logoutBtnEl = document.getElementById('mainLogoutBtn');
      if (logoutBtnEl) logoutBtnEl.style.display = 'none';
      // Sipariş gönder modalını göster
      document.getElementById('cart').style.display = 'block';
      renderTables();
    }
    
    // Geri dönüş butonu
    function goBackToTypeSelection() {
      document.getElementById('tableSelection').style.display = 'none';
      document.getElementById('tableTypeSelection').style.display = 'flex';
      const staffInfoEl = document.getElementById('staffInfo');
      if (staffInfoEl) staffInfoEl.style.display = 'none';
      const logoutBtnEl = document.getElementById('mainLogoutBtn');
      if (logoutBtnEl) logoutBtnEl.style.display = 'none';
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
          const insideEmptyClass = (table.type === 'inside' && !table.hasOrder) ? ' inside-empty' : '';
          
          // Masa numaralandırması: İç Masa 1, Dış Masa 1 gibi
          const tableTypeLabel = table.type === 'inside' ? 'İç Masa' : 'Dış Masa';
          const tableDisplayName = tableTypeLabel + ' ' + table.number;
          
          // Durum etiketi: Dolu veya Boş
          const statusLabel = table.hasOrder ? 'Dolu' : 'Boş';
          // Dolu masalar için kan kırmızısı ton
          const statusColor = table.hasOrder ? '#b91c1c' : '#6b7280';
          
          return '<button class="table-btn' + hasOrderClass + selectedClass + outsideEmptyClass + insideEmptyClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')">' +
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
          
          // Boş için turuncu, dolu için kan kırmızısı premium renkler
          const bgGradient = table.hasOrder 
            ? 'linear-gradient(135deg, #fecaca 0%, #fca5a5 50%, #ef4444 100%)' 
            : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)';
          const borderColor = table.hasOrder ? '#b91c1c' : '#f97316';
          const numberBg = table.hasOrder 
            ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%)' 
            : 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fd7e14 100%)';
          const iconColor = table.hasOrder ? '#b91c1c' : '#f97316';
          
          return '<button class="table-btn package-table-btn' + hasOrderClass + selectedClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')" style="background: ' + bgGradient + '; border: 3px solid ' + borderColor + '; box-shadow: 0 4px 16px ' + (table.hasOrder ? 'rgba(16, 185, 129, 0.35)' : 'rgba(249, 115, 22, 0.35)') + ', 0 0 0 1px rgba(255, 255, 255, 0.4) inset; position: relative; overflow: hidden; transform: scale(1); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">' +
            '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ' + (table.hasOrder ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, transparent 100%)' : 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, transparent 100%)') + '; pointer-events: none; opacity: 0.8;"></div>' +
            '<div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none; transform: rotate(45deg);"></div>' +
            '<div class="table-number" style="background: ' + numberBg + '; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: white; box-shadow: 0 4px 16px ' + (table.hasOrder ? 'rgba(16, 185, 129, 0.5)' : 'rgba(249, 115, 22, 0.5)') + ', 0 0 0 3px rgba(255, 255, 255, 0.4) inset; margin-bottom: 8px; position: relative; z-index: 2; transition: all 0.3s;">' + table.number + '</div>' +
            '<div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 5px;">' +
            '<div class="table-label" style="font-size: 12px; font-weight: 900; color: ' + (table.hasOrder ? '#7f1d1d' : '#9a3412') + '; letter-spacing: 0.8px; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);">' + table.name + '</div>' +
            (table.hasOrder ? '<div style="width: 8px; height: 8px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 50%; box-shadow: 0 0 12px rgba(248, 113, 113, 0.9), 0 0 6px rgba(248, 113, 113, 0.7); animation: pulse 2s infinite;"></div>' : '<div style="width: 6px; height: 6px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 50%; opacity: 0.6;"></div>') +
            '</div>' +
            (table.hasOrder ? '<div style="position: absolute; top: 6px; right: 6px; width: 12px; height: 12px; background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%); border-radius: 50%; box-shadow: 0 0 12px rgba(248, 113, 113, 0.9), 0 0 6px rgba(248, 113, 113, 0.7); animation: pulse 2s infinite; z-index: 3;"></div>' : '') +
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
      const contentEl = document.getElementById('existingOrdersContent');
      const toggleIconEl = document.getElementById('existingOrdersToggleIcon');
      
      if (!orders || orders.length === 0) {
        if (ordersContainer) {
          ordersContainer.style.display = 'none';
        }
        existingOrdersExpanded = false;
        if (contentEl) {
          contentEl.style.display = 'none';
        }
        if (toggleIconEl) {
          toggleIconEl.textContent = '▼';
        }
        return;
      }
      
      if (ordersContainer) {
        ordersContainer.style.display = 'block';
      }
      if (contentEl) {
        contentEl.style.display = existingOrdersExpanded ? 'block' : 'none';
      }
      if (toggleIconEl) {
        toggleIconEl.textContent = existingOrdersExpanded ? '▲' : '▼';
      }
      
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
              '<button id="cancelBtn_' + item.id + '" onclick="showCancelItemModal(' + item.id + ', ' + item.quantity + ', \\'' + item.product_name.replace(/'/g, "\\'") + '\\')" style="padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px;" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(239, 68, 68, 0.4)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'0 2px 8px rgba(239, 68, 68, 0.3)\\'; }" ontouchstart="if(!this.disabled) { this.style.transform=\\'scale(0.95)\\'; }" ontouchend="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; }" class="cancel-item-btn"><span id="cancelBtnText_' + item.id + '">İptal</span><svg id="cancelBtnSpinner_' + item.id + '" style="display: none; width: 14px; height: 14px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>' +
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
    
    async function requestTableAdisyon() {
      if (!selectedTable) {
        showToast('error', 'Adisyon Yazdırılamadı', 'Lütfen önce bir masa seçin.');
        return;
      }
      if (isRequestingTableAdisyon) {
        return;
      }
      
      const confirmResult = confirm(selectedTable.name + ' için kasa yazıcısından adisyon fişi yazdırılsın mı?');
      if (!confirmResult) {
        return;
      }
      
      try {
        isRequestingTableAdisyon = true;
        
        const response = await fetch(API_URL + '/request-table-adisyon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: selectedTable.id })
        });
        
        const result = await response.json().catch(() => ({}));
        
        if (response.ok && result.success) {
          showToast('success', 'Adisyon Gönderildi', 'Kasa yazıcısına adisyon fişi gönderildi.');
        } else {
          showToast('error', 'Adisyon Yazdırılamadı', (result && result.error) || 'Adisyon fişi yazdırılırken bir hata oluştu.');
        }
      } catch (error) {
        console.error('Adisyon isteği hatası:', error);
        showToast('error', 'Adisyon Yazdırılamadı', 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
      } finally {
        isRequestingTableAdisyon = false;
      }
    }
    
    function goBackToTables() {
      selectedTable = null;
      document.getElementById('tableSelection').style.display = 'block';
      document.getElementById('tableTypeSelection').style.display = 'none';
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
      // Mevcut siparişler panelini kapalı hale getir
      existingOrdersExpanded = false;
      const contentEl = document.getElementById('existingOrdersContent');
      const toggleIconEl = document.getElementById('existingOrdersToggleIcon');
      if (contentEl) contentEl.style.display = 'none';
      if (toggleIconEl) toggleIconEl.textContent = '▼';
      renderTables();
    }

    function toggleExistingOrders() {
      const contentEl = document.getElementById('existingOrdersContent');
      const toggleIconEl = document.getElementById('existingOrdersToggleIcon');
      if (!contentEl || !toggleIconEl) return;
      existingOrdersExpanded = !existingOrdersExpanded;
      contentEl.style.display = existingOrdersExpanded ? 'block' : 'none';
      toggleIconEl.textContent = existingOrdersExpanded ? '▲' : '▼';
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
          
          // Dolu masalar için mobil masa renkleriyle uyumlu kan kırmızısı tonlar
          return '<button onclick="selectSourceTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + (isSelected ? '#b91c1c' : '#7f1d1d') + '; border-radius: 12px; background: ' + (isSelected ? 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)') + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(220, 38, 38, 0.5)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(248, 113, 113, 0.7);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: #fee2e2; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: #fecaca; margin-top: 4px; font-weight: 600;">Dolu</span>' +
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
          
          // Boş masalar için mobil masa renkleriyle uyumlu backgroundlar
          const bgColor = isOutside
            ? (isSelected ? '#fef3c7' : '#fffbeb')  // dışarı: soft sarı
            : (isSelected ? '#fce7f3' : '#fdf2f8'); // içeri: soft pembe
          const borderColor = isOutside
            ? (isSelected ? '#fbbf24' : '#facc15')
            : (isSelected ? '#f472b6' : '#fbcfe8');
          const circleBg = isOutside
            ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
            : 'linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)';
          const nameColor = isOutside ? '#92400e' : '#9d174d';
          const statusColor = isOutside ? '#b45309' : '#be185d';
          
          return '<button onclick="selectTargetTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + borderColor + '; border-radius: 12px; background: ' + bgColor + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(148, 163, 184, 0.3)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: ' + circleBg + '; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: ' + (isOutside ? '#78350f' : '#831843') + '; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(248, 113, 113, 0.25);">' + table.number + '</div>' +
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
      const tabs = document.getElementById('categoryTabs');
      tabs.innerHTML = categories.map(cat => 
        '<button class="category-tab ' + (selectedCategoryId === cat.id ? 'active' : '') + '" onclick="selectCategory(' + cat.id + ')">' + cat.name + '</button>'
      ).join('');
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
      if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
        return null;
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
        return '<div id="' + cardId + '" class="product-card" onclick="addToCart(' + prod.id + ', \\'' + prod.name.replace(/'/g, "\\'") + '\\', ' + prod.price + ')" style="' + backgroundStyle + '">' +
          '<div class="product-name">' + prod.name + '</div>' +
          '<div class="product-price">' + prod.price.toFixed(2) + ' ₺</div>' +
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
    
    function addToCart(productId, name, price) {
      const existing = cart.find(item => item.id === productId);
      if (existing) existing.quantity++;
      else cart.push({ id: productId, name, price, quantity: 1 });
      updateCart();
      // Sepeti otomatik açma - kullanıcı manuel olarak açacak
    }
    
    function updateCart() {
      const itemsDiv = document.getElementById('cartItems');
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      if (cart.length === 0) {
        itemsDiv.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #9ca3af; font-size: 14px;">Sepetiniz boş</div>';
      } else {
        itemsDiv.innerHTML = cart.map(item => 
          '<div class="cart-item">' +
            '<div style="flex: 1;">' +
              '<div style="font-weight: 700; font-size: 15px; color: #1f2937; margin-bottom: 4px;">' + item.name + '</div>' +
              '<div style="color: #6b7280; font-size: 13px; font-weight: 600;">' + item.price.toFixed(2) + ' ₺ × ' + item.quantity + ' = ' + (item.price * item.quantity).toFixed(2) + ' ₺</div>' +
            '</div>' +
            '<div class="cart-item-controls">' +
              '<button class="qty-btn" onclick="changeQuantity(' + item.id + ', -1)" title="Azalt">-</button>' +
              '<span style="min-width: 36px; text-align: center; font-weight: 700; color: #1f2937; font-size: 15px;">' + item.quantity + '</span>' +
              '<button class="qty-btn" onclick="changeQuantity(' + item.id + ', 1)" title="Artır">+</button>' +
              '<button class="qty-btn" onclick="removeFromCart(' + item.id + ')" style="background: #ef4444; color: white; border-color: #ef4444; font-size: 18px;" title="Sil">×</button>' +
            '</div>' +
          '</div>'
        ).join('');
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
    
    function showCancelItemModal(itemId, maxQuantity, productName) {
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
    
    function confirmCancelItem() {
      if (!cancelItemId) return;
      
      const cancelQuantity = parseInt(document.getElementById('cancelItemQuantity').value);
      if (isNaN(cancelQuantity) || cancelQuantity < 1 || cancelQuantity > cancelItemMaxQuantity) {
        showToast('error', 'Hata', 'Geçersiz iptal miktarı');
        return;
      }
      
      // İptal edilecek ürün bilgilerini sakla
      const itemIdToCancel = cancelItemId;
      const quantityToCancel = cancelQuantity;
      
      // Modal'ı hemen kapat
      hideCancelItemModal();
      
      // Mevcut siparişler listesindeki iptal butonunu bul ve loading durumuna geçir
      const cancelBtn = document.getElementById('cancelBtn_' + itemIdToCancel);
      const cancelBtnText = document.getElementById('cancelBtnText_' + itemIdToCancel);
      const cancelBtnSpinner = document.getElementById('cancelBtnSpinner_' + itemIdToCancel);
      
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.7';
        cancelBtn.style.cursor = 'not-allowed';
        cancelBtn.style.pointerEvents = 'none';
        if (cancelBtnText) cancelBtnText.textContent = 'İptal...';
        if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'block';
      }
      
      // İptal işlemini arka planda gerçekleştir
      (async () => {
        try {
          const response = await fetch(API_URL + '/cancel-table-order-item', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              itemId: itemIdToCancel,
              cancelQuantity: quantityToCancel
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            showToast('success', 'Başarılı', 'Ürün başarıyla iptal edildi');
            // Siparişleri yenile
            if (selectedTable) {
              await loadExistingOrders(selectedTable.id);
            }
          } else {
            showToast('error', 'Hata', result.error || 'Ürün iptal edilemedi');
            // Hata durumunda butonu tekrar aktif hale getir
            if (cancelBtn) {
              cancelBtn.disabled = false;
              cancelBtn.style.opacity = '1';
              cancelBtn.style.cursor = 'pointer';
              cancelBtn.style.pointerEvents = 'auto';
              if (cancelBtnText) cancelBtnText.textContent = 'İptal';
              if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'none';
            }
          }
        } catch (error) {
          console.error('İptal hatası:', error);
          showToast('error', 'Hata', 'Ürün iptal edilirken bir hata oluştu');
          // Hata durumunda butonu tekrar aktif hale getir
          if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.style.opacity = '1';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.style.pointerEvents = 'auto';
            if (cancelBtnText) cancelBtnText.textContent = 'İptal';
            if (cancelBtnSpinner) cancelBtnSpinner.style.display = 'none';
          }
        }
      })();
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
      
      const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      try {
        const response = await fetch(API_URL + '/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: cart, 
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
          loadData();
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
      
      // Firebase'den direkt çek
      if (firestore && firebaseCollection && firebaseGetDocs) {
        const productsRef = firebaseCollection(firestore, 'products');
        const snapshot = await firebaseGetDocs(productsRef);
        
        const products = [];
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
        
        res.json(products);
      } else {
        // Firebase yoksa local database'den çek
        if (categoryId) {
          res.json(db.products.filter(p => p.category_id === Number(categoryId)));
        } else {
          res.json(db.products);
        }
      }
    } catch (error) {
      console.error('❌ Ürünler çekilirken hata:', error);
      // Hata durumunda local database'den çek
      if (categoryId) {
        res.json(db.products.filter(p => p.category_id === Number(categoryId)));
      } else {
        res.json(db.products);
      }
    }
  });

  // Backend resim cache (memory cache - Firebase Storage kullanımını azaltmak için)
  const imageCache = new Map();
  const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 saat
  const CACHE_MAX_SIZE = 100; // Maksimum 100 resim cache'de tut
  
  // Resim proxy endpoint - CORS sorununu çözmek için + Backend cache
  appExpress.get('/api/image-proxy', async (req, res) => {
    try {
      const imageUrl = req.query.url;
      if (!imageUrl) {
        return res.status(400).json({ error: 'URL parametresi gerekli' });
      }
      
      // Firebase Storage URL'si kontrolü
      if (!imageUrl.includes('firebasestorage.googleapis.com')) {
        return res.status(400).json({ error: 'Geçersiz resim URL\'si' });
      }
      
      // Cache'de var mı kontrol et
      const cached = imageCache.get(imageUrl);
      if (cached && (Date.now() - cached.timestamp) < CACHE_MAX_AGE) {
        // Cache'den döndür - Firebase Storage'a istek yok!
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(cached.buffer);
        return;
      }
      
      // Cache'de yoksa Firebase Storage'dan çek
      const https = require('https');
      const response = await new Promise((resolve, reject) => {
        https.get(imageUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers['content-type'] || 'image/jpeg'
          }));
          response.on('error', reject);
        }).on('error', reject);
      });
      
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
      surname: s.surname
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
          surname: staff.surname 
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
    for (let i = 1; i <= 20; i++) {
      const tableId = `outside-${i}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: i,
        type: 'outside',
        name: `Dışarı ${i}`,
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
      const { itemId, cancelQuantity } = req.body;
      
      if (!itemId) {
        return res.status(400).json({ success: false, error: 'Ürün ID\'si gerekli' });
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

      // İptal fişi yazdır
      try {
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

        await printCancelReceipt(assignment.printerName, assignment.printerType, cancelReceiptData);
      } catch (error) {
        console.error('İptal fişi yazdırma hatası:', error);
        // Yazdırma hatası olsa bile iptal işlemini devam ettir
      }

      // İptal edilecek tutarı hesapla (ikram değilse)
      const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);

      // Masa siparişinin toplam tutarını güncelle
      order.total_amount = Math.max(0, order.total_amount - cancelAmount);

      // Eğer tüm ürün iptal ediliyorsa, item'ı sil
      if (quantityToCancel >= item.quantity) {
        const itemIndex = db.tableOrderItems.findIndex(oi => oi.id === itemId);
        if (itemIndex !== -1) {
          db.tableOrderItems.splice(itemIndex, 1);
        }
      } else {
        // Sadece bir kısmı iptal ediliyorsa, quantity'yi azalt
        item.quantity -= quantityToCancel;
      }

      saveDatabase();

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

  // Masa için kasa yazıcısından adisyon fişi iste
  appExpress.post('/api/request-table-adisyon', async (req, res) => {
    try {
      const { tableId } = req.body || {};
      
      if (!tableId) {
        return res.status(400).json({ success: false, error: 'tableId gerekli' });
      }
      
      const pendingOrders = (db.tableOrders || []).filter(
        o => o.table_id === tableId && o.status === 'pending'
      );
      
      if (!pendingOrders || pendingOrders.length === 0) {
        return res.status(404).json({ success: false, error: 'Bu masaya ait aktif sipariş bulunamadı.' });
      }
      
      const allItems = [];
      pendingOrders.forEach(order => {
        const items = (db.tableOrderItems || []).filter(
          item => item.order_id === order.id
        );
        items.forEach(item => {
          allItems.push({
            id: item.product_id,
            name: item.product_name,
            price: item.price,
            quantity: item.quantity,
            isGift: item.isGift || false
          });
        });
      });
      
      if (allItems.length === 0) {
        return res.status(400).json({ success: false, error: 'Bu masanın siparişinde ürün bulunamadı.' });
      }
      
      const cashierPrinter = db.settings && db.settings.cashierPrinter;
      if (!cashierPrinter || !cashierPrinter.printerName) {
        return res.status(400).json({ success: false, error: 'Kasa yazıcısı ayarlanmamış. Lütfen masaüstü uygulamadan kasa yazıcısı seçin.' });
      }
      
      const firstOrder = pendingOrders[0];
      const now = new Date();
      
      const receiptData = {
        sale_id: null,
        items: allItems,
        paymentMethod: 'Adisyon',
        sale_date: now.toLocaleDateString('tr-TR'),
        sale_time: getFormattedTime(now),
        orderNote: firstOrder.order_note || null,
        tableName: firstOrder.table_name || null,
        tableType: firstOrder.table_type || null,
        cashierOnly: true
      };
      
      // Toplam tutarı hesapla (ikramlar hariç)
      const totalAmount = allItems.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      const cashierReceiptData = {
        ...receiptData,
        totalAmount
      };
      
      const result = await printToPrinter(
        cashierPrinter.printerName,
        cashierPrinter.printerType,
        cashierReceiptData,
        false,
        null
      );
      
      if (result && result.success) {
        return res.json({ success: true });
      } else {
        return res.status(500).json({ success: false, error: (result && result.error) || 'Adisyon fişi yazdırılamadı.' });
      }
    } catch (error) {
      console.error('Mobil adisyon yazdırma hatası:', error);
      return res.status(500).json({ success: false, error: 'Adisyon yazdırma sırasında bir hata oluştu.' });
    }
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

  appExpress.post('/api/orders', async (req, res) => {
    try {
      const { items, totalAmount, tableId, tableName, tableType, orderNote, staffId } = req.body;
      const existingOrder = (db.tableOrders || []).find(
        o => o.table_id === tableId && o.status === 'pending'
      );

      let orderId;
      let isNewOrder = false;

      if (existingOrder) {
        orderId = existingOrder.id;
        items.forEach(newItem => {
          const existingItem = (db.tableOrderItems || []).find(
            oi => oi.order_id === orderId && 
                  oi.product_id === newItem.id && 
                  oi.isGift === (newItem.isGift || false)
          );
          if (existingItem) {
            existingItem.quantity += newItem.quantity;
          } else {
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
          }
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
        const itemsWithStaff = items.map(item => {
          // Mevcut orderId için bu ürünü ekleyen garsonu bul
          // En son eklenen item'ı al (ID'ye göre sırala - en yüksek ID = en son eklenen)
          const matchingItems = db.tableOrderItems.filter(oi => 
            oi.order_id === orderId && 
            oi.product_id === item.id && 
            oi.product_name === item.name
          );
          
          // En son eklenen item'ı al (ID'ye göre sırala - büyükten küçüğe)
          let orderItem = null;
          if (matchingItems.length > 0) {
            // ID'ye göre sırala ve en yüksek ID'li olanı al (en son eklenen)
            orderItem = matchingItems.sort((a, b) => b.id - a.id)[0];
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
    password: password.toString()
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
    surname: s.surname
  }));
});

ipcMain.handle('verify-staff-pin', (event, password) => {
  if (!db.staff) db.staff = [];
  const staff = db.staff.find(s => s.password === password.toString());
  if (staff) {
    return { success: true, staff: { id: staff.id, name: staff.name, surname: staff.surname } };
  }
  return { success: false, error: 'Şifre hatalı' };
});

