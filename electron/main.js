const { app, BrowserWindow, ipcMain, Menu, dialog, webContents } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
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
let firebaseWriteBatch = null;
let firebaseDoc = null;
let firebaseSetDoc = null;
let firebaseOnSnapshot = null;
let firebaseWhere = null;
let firebaseQuery = null;
let firebaseOrderBy = null;
let firebaseLimit = null;
let storageRef = null;
let storageUploadBytes = null;
let storageGetDownloadURL = null;
let storageDeleteObject = null;

// Firebase modülleri (tek noktadan yüklenir)
const firebaseAppModule = require('firebase/app');
const firebaseFirestoreModule = require('firebase/firestore');
const firebaseStorageModule = require('firebase/storage');

// Havzan ile ortak: kategori/ürün/görsel/broadcast (makara-16344) + masalar/stok (makaramasalar)
const FIREBASE_MAKARA_MAIN = {
  apiKey: "AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA",
  authDomain: "makara-16344.firebaseapp.com",
  projectId: "makara-16344",
  storageBucket: "makara-16344.firebasestorage.app",
  messagingSenderId: "216769654742",
  appId: "1:216769654742:web:16792742d4613f4269be77",
  measurementId: "G-K4XZHP11MM"
};
const FIREBASE_MAKARA_TABLES = {
  apiKey: "AIzaSyDu_NUrgas4wZ_wdfAYE-DgxqTpb7vKxyo",
  authDomain: "makaramasalar.firebaseapp.com",
  projectId: "makaramasalar",
  storageBucket: "makaramasalar.firebasestorage.app",
  messagingSenderId: "840151572206",
  appId: "1:840151572206:web:0afaf93deea636309e5dff",
  measurementId: "G-2S0J3566ZY"
};
// Suriçi: sadece POS satışları + iptal kayıtları bu projede; katalog Havzan ile aynı store
const FIREBASE_SURICI_SALES = {
  apiKey: "AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo",
  authDomain: "makarasurici.firebaseapp.com",
  projectId: "makarasurici",
  storageBucket: "makarasurici.firebasestorage.app",
  messagingSenderId: "237735301273",
  appId: "1:237735301273:web:bf62c8f145434df0292808",
  measurementId: "G-WXWWQT92L6"
};
// Sultan Somatı: Makara’dan bağımsız; kategori/ürün/satış/masa/stok tek projede
const FIREBASE_SULTAN_SOMATI = {
  apiKey: "AIzaSyB_sSvCgbWC4HYKufueqfoDmbBS4SHlUnA",
  authDomain: "sultansomati-5a3e9.firebaseapp.com",
  projectId: "sultansomati-5a3e9",
  storageBucket: "sultansomati-5a3e9.firebasestorage.app",
  messagingSenderId: "166037373406",
  appId: "1:166037373406:web:ed1c3724085446ae0d1d4f",
  measurementId: "G-SV23DHVNDG"
};

/** Makara Havzan: `inside-1` … `inside-99`. Suriçi: eski dışarı numara listesi (IPC/mobil ile uyumlu). */
const MAKARA_HAVZAN_MAIN_TABLE_COUNT = 99;
const MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS = [61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77, 78, 81, 82, 83, 84, 85, 86, 87, 88];

// Çoklu şube yapılandırması
const BRANCH_CONFIGS = {
  makara: {
    key: 'makara',
    label: 'Makara',
    mainFirebase: FIREBASE_MAKARA_MAIN,
    tablesFirebase: FIREBASE_MAKARA_TABLES
  },
  makarasur: {
    key: 'makarasur',
    label: 'Makara Sur',
    mainFirebase: FIREBASE_MAKARA_MAIN,
    tablesFirebase: FIREBASE_MAKARA_TABLES,
    salesFirebase: FIREBASE_SURICI_SALES
  },
  sultansomati: {
    key: 'sultansomati',
    label: 'Sultan Somatı',
    mainFirebase: FIREBASE_SULTAN_SOMATI,
    tablesFirebase: FIREBASE_SULTAN_SOMATI
  }
};

/** Sultan Somatı masa düzeni (API + mobil); Makara masa ID'leriyle çakışmaz (sultan-…). */
const SULTAN_TABLE_LAYOUT = [
  { key: 'disari', label: 'Dışarı', count: 4 },
  { key: 'kis-bahcesi', label: 'Kış Bahçesi', count: 14 },
  { key: 'osmanli-odasi', label: 'Osmanlı Odası', count: 8 },
  { key: 'selcuklu-odasi', label: 'Selçuklu Odası', count: 10 },
  { key: 'mevlevi-odasi', label: 'Mevlevi Odası', count: 1 },
  { key: 'ask-odasi', label: 'Aşk Odası', count: 1 },
  { key: 'yapma-odasi', label: 'Yapma Odası', count: 1 }
];

function parseSultanTableIdForMain(tableId) {
  if (!tableId || typeof tableId !== 'string' || !tableId.startsWith('sultan-')) return null;
  for (const sec of SULTAN_TABLE_LAYOUT) {
    const prefix = `sultan-${sec.key}-`;
    if (!tableId.startsWith(prefix)) continue;
    const numStr = tableId.slice(prefix.length);
    const n = parseInt(numStr, 10);
    if (String(n) !== numStr) continue;
    if (n < 1 || n > sec.count) continue;
    const name = sec.count === 1 ? sec.label : `${sec.label} · Masa ${n}`;
    return { id: tableId, sectionKey: sec.key, number: n, name, type: sec.key };
  }
  return null;
}

function sumPendingOrderItemsTotal(db, orderId) {
  const items = (db.tableOrderItems || []).filter((oi) => oi.order_id === orderId);
  let s = 0;
  for (const i of items) {
    if (i && i.isGift) continue;
    s += (Number(i.price) || 0) * (Number(i.quantity) || 0);
  }
  return s;
}

function buildSultanTablesListForApi(db) {
  const orders = db.tableOrders || [];
  const list = [];
  for (const sec of SULTAN_TABLE_LAYOUT) {
    for (let n = 1; n <= sec.count; n++) {
      const id = `sultan-${sec.key}-${n}`;
      const name = sec.count === 1 ? sec.label : `${sec.label} · Masa ${n}`;
      const pending = orders.find((o) => o.table_id === id && o.status === 'pending');
      const hasOrder = !!pending;
      const orderTotal = hasOrder && pending ? sumPendingOrderItemsTotal(db, pending.id) : null;
      list.push({
        id,
        number: n,
        type: sec.key,
        name,
        hasOrder,
        orderTotal: hasOrder ? orderTotal : null,
        sectionKey: sec.key,
        sectionLabel: sec.label
      });
    }
  }
  return list;
}

/** Yan Ürünler — yalnızca Makara şubeleri; Sultan Somatı listelerinden çıkarılır */
function isYanUrunlerCategoryForFilter(c) {
  if (!c) return false;
  const id = c.id;
  const num = Number(id);
  if (num === 999999 || num === -999) return true;
  if (String(id) === 'yan_urunler') return true;
  const nm = (c.name && String(c.name).trim().toLowerCase()) || '';
  return nm === 'yan ürünler' || nm === 'yan urunler';
}

let activeBranchKey = 'makara';
/** Aynı oturumda tam katalog bir kez yüklendiyse tekrar Firebase taraması yapma (StrictMode çift effect / çift IPC) */
let branchCatalogWarmSessionKey = null;
/** activate-branch IPC çağrılarını sıraya al (paralel iki activate şubeyi ve katalogu bozabiliyor) */
let activateBranchChain = Promise.resolve();
let branchSettingsPath = null;
let categoriesRealtimeUnsubscribe = null;
let productsRealtimeUnsubscribe = null;
let broadcastsRealtimeUnsubscribe = null;
/** Şube değişince eski arka plan warmup iptal etmek için */
let branchWarmupGeneration = 0;
let saveDatabaseTimer = null;
/** activateBranch öncesi bellekteki ürünlerden; db.products=[] sonrası Firebase sync bu map ile base64 görseli geri yazar */
let pendingLocalProductDataUrlById = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processInChunks(items, chunkSize, handler, pauseMs = 0, onProgress = null) {
  if (!Array.isArray(items) || items.length === 0) return;
  const total = items.length;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    for (const item of chunk) {
      handler(item);
    }
    const processed = Math.min(i + chunk.length, total);
    if (typeof onProgress === 'function') {
      try {
        onProgress(processed, total);
      } catch (_) {}
    }
    if (pauseMs > 0 && i + chunkSize < items.length) {
      await sleep(pauseMs);
    }
  }
}

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

// Masalar için ayrı Firebase
let tablesFirebaseApp = null;
let tablesFirestore = null;
let tablesFirebaseCollection = null;
let tablesFirebaseDoc = null;
let tablesFirebaseSetDoc = null;

/** Suriçi: satış/iptal Firestore; Havzan'da main ile aynı (null iken firestore kullanılır) */
let salesFirebaseApp = null;
let salesFirestore = null;

function getSalesFirestore() {
  return salesFirestore || firestore;
}

/** Açık sipariş satırı iptali: Sultan'da tüm personel; Havzan (makara) müdür veya şef; Suriçi'de yalnız müdür */
function staffHasTableOrderCancelRole(staff) {
  if (!staff) return false;
  if (activeBranchKey === 'sultansomati') return true;
  if (staff.is_manager) return true;
  if (activeBranchKey === 'makara' && staff.is_chef) return true;
  return false;
}

async function fetchFirestoreCancelsLastHours(branchKey, hours) {
  if (branchKey !== 'makara' || hours <= 0) return [];
  const fsDb = getSalesFirestore();
  if (!fsDb || !firebaseCollection || !firebaseGetDocs || !firebaseQuery || !firebaseOrderBy || !firebaseLimit) {
    return [];
  }
  const cut = Date.now() - hours * 3600000;
  try {
    const ref = firebaseCollection(fsDb, 'cancels');
    const q = firebaseQuery(ref, firebaseOrderBy('created_at', 'desc'), firebaseLimit(600));
    const snap = await firebaseGetDocs(q);
    const rows = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let ms = 0;
      const ca = d.created_at;
      if (ca && typeof ca.toMillis === 'function') ms = ca.toMillis();
      else if (ca && typeof ca.seconds === 'number') ms = ca.seconds * 1000;
      if (!ms) return;
      if (ms < cut) return;
      rows.push({
        id: docSnap.id,
        product_name: d.product_name || '',
        quantity: d.quantity,
        cancel_reason: d.cancel_reason != null ? String(d.cancel_reason) : '',
        staff_name: d.staff_name || '—',
        table_name: d.table_name || '',
        cancel_date: d.cancel_date || '',
        cancel_time: d.cancel_time || '',
        is_group: !!d.is_group,
        items_array: Array.isArray(d.items_array) ? d.items_array : null,
        source: d.source || ''
      });
    });
    return rows;
  } catch (e) {
    console.error('fetchFirestoreCancelsLastHours:', e);
    return [];
  }
}

let mainWindow;
let dbPath;
let apiServer = null;
let io = null;
let serverPort = 3000;

function sendCatalogSyncProgress(payload) {
  try {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isDestroyed()
    ) {
      mainWindow.webContents.send('catalog-sync-progress', payload);
    }
  } catch (_) {}
}

/** Uzun süren Firestore getDocs sırasında % takılmasın — yavaşça yükselen nabız (üst sınır capPct) */
let catalogProgressPulseTimer = null;
function clearCatalogProgressPulse() {
  if (catalogProgressPulseTimer) {
    clearInterval(catalogProgressPulseTimer);
    catalogProgressPulseTimer = null;
  }
}
function startCatalogProgressPulse(phase, startPct, capPct, message) {
  clearCatalogProgressPulse();
  let v = Math.min(100, Math.max(0, startPct));
  const cap = Math.min(100, capPct);
  catalogProgressPulseTimer = setInterval(() => {
    v = Math.min(v + 0.55, cap);
    sendCatalogSyncProgress({ percent: v, phase, message });
  }, 260);
}

function loadBranchSettings() {
  try {
    branchSettingsPath = path.join(app.getPath('userData'), 'branch-settings.json');
    if (!fs.existsSync(branchSettingsPath)) return;
    const raw = fs.readFileSync(branchSettingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.activeBranchKey && BRANCH_CONFIGS[parsed.activeBranchKey]) {
      activeBranchKey = parsed.activeBranchKey;
    }
  } catch (error) {
    console.error('Branch settings yüklenemedi:', error);
  }
}

function saveBranchSettings() {
  try {
    if (!branchSettingsPath) {
      branchSettingsPath = path.join(app.getPath('userData'), 'branch-settings.json');
    }
    fs.writeFileSync(
      branchSettingsPath,
      JSON.stringify({ activeBranchKey }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Branch settings kaydedilemedi:', error);
  }
}

async function initializeFirebaseForBranch(branchKey) {
  const branch = BRANCH_CONFIGS[branchKey] || BRANCH_CONFIGS.makara;
  activeBranchKey = branch.key;
  sendCatalogSyncProgress({
    percent: 4,
    phase: 'firebase',
    message: 'Sunucuya bağlanılıyor…'
  });

  // Önce önceki realtime listenerları kapat
  try { categoriesRealtimeUnsubscribe?.(); } catch (_) {}
  try { productsRealtimeUnsubscribe?.(); } catch (_) {}
  try { broadcastsRealtimeUnsubscribe?.(); } catch (_) {}
  categoriesRealtimeUnsubscribe = null;
  productsRealtimeUnsubscribe = null;
  broadcastsRealtimeUnsubscribe = null;
  isCategoriesListenerInitialized = false;
  isProductsListenerInitialized = false;
  isBroadcastsListenerInitialized = false;

  // Aynı isimli app'ler varsa temizle
  const { getApps, getApp, initializeApp, deleteApp } = firebaseAppModule;
  for (const appName of ['main-tenant', 'tables-tenant', 'sales-tenant']) {
    try {
      const existing = getApp(appName);
      await deleteApp(existing);
    } catch (_) {}
  }

  try {
    // Main firebase
    firebaseApp = initializeApp(branch.mainFirebase, 'main-tenant');
    firestore = firebaseFirestoreModule.getFirestore(firebaseApp);
    storage = firebaseStorageModule.getStorage(firebaseApp);
    firebaseCollection = firebaseFirestoreModule.collection;
    firebaseAddDoc = firebaseFirestoreModule.addDoc;
    firebaseServerTimestamp = firebaseFirestoreModule.serverTimestamp;
    firebaseGetDocs = firebaseFirestoreModule.getDocs;
    firebaseDeleteDoc = firebaseFirestoreModule.deleteDoc;
    firebaseWriteBatch = firebaseFirestoreModule.writeBatch;
    firebaseDoc = firebaseFirestoreModule.doc;
    firebaseSetDoc = firebaseFirestoreModule.setDoc;
    firebaseOnSnapshot = firebaseFirestoreModule.onSnapshot;
    firebaseWhere = firebaseFirestoreModule.where;
    firebaseQuery = firebaseFirestoreModule.query;
    firebaseOrderBy = firebaseFirestoreModule.orderBy;
    firebaseLimit = firebaseFirestoreModule.limit;
    storageRef = firebaseStorageModule.ref;
    storageUploadBytes = firebaseStorageModule.uploadBytes;
    storageGetDownloadURL = firebaseStorageModule.getDownloadURL;
    storageDeleteObject = firebaseStorageModule.deleteObject;

    // Masalar Firebase: Havzan'da ürün/katalog (makara-16344) ile masalar (makaramasalar) ayrı projede.
    // Suriçi'de ikisi de makarasurici — aynı projeyi iki kez initializeApp ile açmak Firestore okumalarını
    // bozabiliyor; tek app + tek Firestore kullan.
    const tablesSameProject =
      branch.tablesFirebase?.projectId &&
      branch.mainFirebase?.projectId &&
      branch.tablesFirebase.projectId === branch.mainFirebase.projectId;
    if (tablesSameProject) {
      tablesFirebaseApp = firebaseApp;
      tablesFirestore = firestore;
    } else {
      tablesFirebaseApp = initializeApp(branch.tablesFirebase, 'tables-tenant');
      tablesFirestore = firebaseFirestoreModule.getFirestore(tablesFirebaseApp);
    }
    tablesFirebaseCollection = firebaseFirestoreModule.collection;
    tablesFirebaseDoc = firebaseFirestoreModule.doc;
    tablesFirebaseSetDoc = firebaseFirestoreModule.setDoc;

    const salesCfg = branch.salesFirebase;
    if (
      salesCfg?.projectId &&
      branch.mainFirebase?.projectId &&
      salesCfg.projectId !== branch.mainFirebase.projectId
    ) {
      salesFirebaseApp = initializeApp(salesCfg, 'sales-tenant');
      salesFirestore = firebaseFirestoreModule.getFirestore(salesFirebaseApp);
    } else {
      salesFirebaseApp = null;
      salesFirestore = firestore;
    }

    console.log(`✅ Firebase branch aktif: ${branch.key}`);
    return true;
  } catch (error) {
    console.error(`❌ Firebase branch başlatılamadı (${branch.key}):`, error);
    firestore = null;
    firebaseWriteBatch = null;
    storage = null;
    tablesFirestore = null;
    salesFirestore = null;
    salesFirebaseApp = null;
    return false;
  }
}

async function activateBranch(branchKey) {
  if (!BRANCH_CONFIGS[branchKey]) {
    return { success: false, error: 'Geçersiz şube anahtarı' };
  }

  if (
    branchCatalogWarmSessionKey === branchKey &&
    activeBranchKey === branchKey &&
    Array.isArray(db.categories) &&
    db.categories.length > 0 &&
    Array.isArray(db.products) &&
    db.products.length > 0
  ) {
    return {
      success: true,
      branch: { key: activeBranchKey, label: BRANCH_CONFIGS[activeBranchKey].label }
    };
  }

  const ok = await initializeFirebaseForBranch(branchKey);
  if (!ok) {
    sendCatalogSyncProgress({ percent: 100, phase: 'done', message: '' });
    return { success: false, error: 'Firebase bağlantısı kurulamadı' };
  }

  // Base64 görseller Firestore'da yok; db.products silinmeden önce sakla (sync Firebase ile birleşsin)
  pendingLocalProductDataUrlById = new Map();
  for (const p of db.products || []) {
    if (!p || p.image == null) continue;
    if (typeof p.image !== 'string' || !p.image.startsWith('data:image')) continue;
    const pid = typeof p.id === 'string' ? parseInt(p.id, 10) : Number(p.id);
    if (Number.isNaN(pid)) continue;
    pendingLocalProductDataUrlById.set(pid, p.image);
  }

  // Eski şube katalogunu göstermemek için bellek temizliği (disk yazımı senkron bitince)
  db.categories = [];
  db.products = [];

  sendCatalogSyncProgress({
    percent: 7,
    phase: 'catalog',
    message: 'Katalog senkronize ediliyor…'
  });

  saveBranchSettings();

  // Önce kademeli tam çekim (getDocs), sonra realtime dinleyiciler — aynı anda çift yük + ana iş parçacığında dev JSON yazımı donmasını önler.
  branchWarmupGeneration += 1;
  const warmupGen = branchWarmupGeneration;
  const warmupBranchKey = activeBranchKey;

  // Sultan: önce menü paketi (gerekirse) — paket kurulduysa kategori+ürün zaten db'de; tekrar getDocs atlanır (açılış hızlanır).
  // Makara: doğrudan Firebase kategorileri.
  let sultanMenuBundleJustApplied = false;
  try {
    if (activeBranchKey === 'sultansomati') {
      sendCatalogSyncProgress({
        percent: 9,
        phase: 'bundle',
        message: 'Menü paketi kontrol ediliyor…'
      });
      try {
        sultanMenuBundleJustApplied = await maybeInstallSultanMenuBundleOnActivate();
      } catch (e) {
        console.error('Sultan menü paketi kurulumu:', e);
      }
      if (!sultanMenuBundleJustApplied) {
        await syncCategoriesFromFirebase();
      }
    } else {
      await syncCategoriesFromFirebase();
    }
  } catch (error) {
    console.error('Kategori senkronu (activateBranch):', error);
  }
  if (warmupGen !== branchWarmupGeneration || activeBranchKey !== warmupBranchKey) {
    sendCatalogSyncProgress({ percent: 100, phase: 'done', message: '' });
    return { success: false, error: 'Şube eşzamanlı değişti, tekrar deneyin.' };
  }

  // İlk açılışta renderer getProducts çağırdığında dolu katalog olsun (splash sırasında bile yüklenebilsin)
  try {
    if (!sultanMenuBundleJustApplied) {
      await syncProductsFromFirebase();
    } else {
      sendCatalogSyncProgress({
        percent: 92,
        phase: 'products',
        message: 'Menü paketi yerelde hazır'
      });
    }
  } catch (error) {
    console.error('Ürün senkronu (activateBranch):', error);
  }
  if (warmupGen !== branchWarmupGeneration || activeBranchKey !== warmupBranchKey) {
    sendCatalogSyncProgress({ percent: 100, phase: 'done', message: '' });
    return { success: false, error: 'Şube eşzamanlı değişti, tekrar deneyin.' };
  }

  sendCatalogSyncProgress({
    percent: 98,
    phase: 'finalize',
    message: 'Son hazırlıklar…'
  });

  setImmediate(() => {
    (async () => {
      try {
        if (warmupGen !== branchWarmupGeneration || activeBranchKey !== warmupBranchKey) return;

        categoriesRealtimeUnsubscribe = setupCategoriesRealtimeListener();
        productsRealtimeUnsubscribe = setupProductsRealtimeListener();
        broadcastsRealtimeUnsubscribe = setupBroadcastsRealtimeListener();

        // Görsel migration çok ağır; şube girişinden dakikalar sonra, tek tek nefes alarak.
        if (warmupGen !== branchWarmupGeneration || activeBranchKey !== warmupBranchKey) return;
        setTimeout(() => {
          if (warmupGen !== branchWarmupGeneration || activeBranchKey !== warmupBranchKey) return;
          migrateLocalImagesToFirebase().catch((e) => console.error('Görsel migration:', e));
        }, 120_000);
      } catch (error) {
        console.error('Arka plan branch warmup hatası:', error);
      }
    })();
  });

  branchCatalogWarmSessionKey = activeBranchKey;

  sendCatalogSyncProgress({
    percent: 100,
    phase: 'done',
    message: 'Katalog hazır'
  });

  return {
    success: true,
    branch: { key: activeBranchKey, label: BRANCH_CONFIGS[activeBranchKey].label }
  };
}

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
    cashierPrinter: null, // { printerName, printerType } - Kasa yazıcısı ayarı
    /** Masaüstünde müdür seç / müdürlük kaldır için zorunlu (mobil müdür tarafından belirlenir) */
    managerOperationsPassword: null
  },
  printerAssignments: [], // { printerName, printerType, category_id }
  yanUrunler: [], // Local kayıtlı yan ürünler (Firebase'e gitmez) - { id, name, price }
  reservations: [] // { id, tableId, tableName, date, time, peopleCount, adults, children, babies, note, staffId, staffName, createdAt }
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
      if (db.settings && db.settings.managerOperationsPassword === undefined) {
        db.settings.managerOperationsPassword = null;
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
      if (!db.yanUrunler) db.yanUrunler = [];
      if (!db.reservations) db.reservations = [];
      
      // Yan Ürünler için varsayılan veriler (eğer boşsa)
      if (db.yanUrunler.length === 0) {
        db.yanUrunler = [
          { id: 1, name: 'Pasta Servis ücreti', price: 150 },
          { id: 2, name: 'Kolonya', price: 270 },
          { id: 3, name: 'Callei Antep sos', price: 600 },
          { id: 4, name: 'Callei frambuaz sos', price: 450 },
          { id: 5, name: 'Chocoworld soslar', price: 350 },
          { id: 6, name: '100 gr Türk kahvesi', price: 150 },
          { id: 7, name: '250 gr filtre kahve', price: 450 },
          { id: 8, name: '250 gr çekirdek kahve', price: 450 },
          { id: 9, name: 'Pasta volkanı', price: 100 },
          { id: 10, name: 'Yer volkanı', price: 450 }
        ];
        saveDatabase();
      }
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
  db.yanUrunler = [
    { id: 1, name: 'Pasta Servis ücreti', price: 150 },
    { id: 2, name: 'Kolonya', price: 270 },
    { id: 3, name: 'Callei Antep sos', price: 600 },
    { id: 4, name: 'Callei frambuaz sos', price: 450 },
    { id: 5, name: 'Chocoworld soslar', price: 350 },
    { id: 6, name: '100 gr Türk kahvesi', price: 150 },
    { id: 7, name: '250 gr filtre kahve', price: 450 },
    { id: 8, name: '250 gr çekirdek kahve', price: 450 },
    { id: 9, name: 'Pasta volkanı', price: 100 },
    { id: 10, name: 'Yer volkanı', price: 450 }
  ];
  
  saveDatabase();
}

function saveDatabase() {
  if (saveDatabaseTimer) clearTimeout(saveDatabaseTimer);
  saveDatabaseTimer = setTimeout(() => {
    saveDatabaseTimer = null;
    try {
      const payload = JSON.stringify(db, null, 2);
      fs.writeFile(dbPath, payload, 'utf8', (err) => {
        if (err) console.error('Veritabanı kaydedilemedi:', err);
      });
    } catch (error) {
      console.error('Veritabanı serileştirilemedi:', error);
    }
  }, 900);
}

/** Kapatmadan önce bekleyen yazımı hemen diske yaz (senkron) */
function flushSaveDatabaseSync() {
  if (saveDatabaseTimer) {
    clearTimeout(saveDatabaseTimer);
    saveDatabaseTimer = null;
  }
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
    const payload = {
      id: product.id,
      name: product.name,
      category_id: product.category_id,
      price: parseFloat(product.price) || 0,
      image: product.image != null && product.image !== '' ? product.image : null
    };
    if (product.description) payload.description = product.description;
    if (product.gluten_free === true) payload.gluten_free = true;
    if (product.per_person === true) payload.per_person = true;
    await firebaseSetDoc(productRef, payload, { merge: true });
    console.log(`✅ Ürün Firebase'e kaydedildi: ${product.name} (ID: ${product.id}, Fiyat: ${parseFloat(product.price) || 0})`);
  } catch (error) {
    console.error(`❌ Ürün Firebase'e kaydedilemedi (${product.name}):`, error);
    const msg = String(error?.message || '');
    if (msg.includes('longer than') || msg.includes('exceed') || error?.code === 'invalid-argument') {
      console.error('   Firestore belge boyutu sınırı (yakl. 1 MB): görsel çok büyükse Ayarlar’dan daha küçük dosya seçin.');
    }
  }
}

function mapFirebaseProductToLocal(firebaseProduct) {
  const productId = typeof firebaseProduct.id === 'string' ? parseInt(firebaseProduct.id, 10) : firebaseProduct.id;
  const o = {
    id: productId,
    name: firebaseProduct.name || '',
    category_id: typeof firebaseProduct.category_id === 'string' ? parseInt(firebaseProduct.category_id, 10) : firebaseProduct.category_id,
    price: parseFloat(firebaseProduct.price) || 0,
    image: firebaseProduct.image || null
  };
  if (firebaseProduct.description) o.description = firebaseProduct.description;
  if (firebaseProduct.gluten_free === true) o.gluten_free = true;
  if (firebaseProduct.per_person === true) o.per_person = true;
  if (firebaseProduct.trackStock === true) o.trackStock = true;
  if (firebaseProduct.stock !== undefined && firebaseProduct.stock !== null) o.stock = firebaseProduct.stock;
  return o;
}

/** Firebase dokümanında image yokken (eski kayıtlar) yerel data:image korunur */
function mergeProductFromFirebaseWithLocalDataUrl(prevLocal, mappedFromFirebase) {
  if (
    prevLocal &&
    typeof prevLocal.image === 'string' &&
    prevLocal.image.startsWith('data:image') &&
    (mappedFromFirebase.image == null || mappedFromFirebase.image === '')
  ) {
    return { ...mappedFromFirebase, image: prevLocal.image };
  }
  return mappedFromFirebase;
}

function normalizeBundledProductForLocal(p) {
  const o = {
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    price: parseFloat(p.price) || 0,
    image: p.image || null
  };
  if (p.description) o.description = p.description;
  if (p.gluten_free === true) o.gluten_free = true;
  if (p.per_person === true) o.per_person = true;
  return o;
}

function productDocForFirestore(p) {
  const d = {
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    price: parseFloat(p.price) || 0,
    image: p.image || null
  };
  if (p.description) d.description = p.description;
  if (p.gluten_free === true) d.gluten_free = true;
  if (p.per_person === true) d.per_person = true;
  return d;
}

async function deleteAllFirestoreDocsInCollection(collectionName) {
  if (!firestore || !firebaseCollection || !firebaseGetDocs || !firebaseDeleteDoc) return;
  const ref = firebaseCollection(firestore, collectionName);
  const snapshot = await firebaseGetDocs(ref);
  const docs = snapshot.docs || [];
  for (let i = 0; i < docs.length; i += 45) {
    const chunk = docs.slice(i, i + 45);
    await Promise.all(chunk.map((d) => firebaseDeleteDoc(d.ref)));
  }
}

async function firestoreBatchSetDocuments(collectionName, items, toFirestoreFields) {
  if (!firestore || !firebaseWriteBatch || !firebaseDoc) {
    throw new Error('Firestore batch kullanılamıyor');
  }
  let batch = firebaseWriteBatch(firestore);
  let ops = 0;
  for (const item of items) {
    const ref = firebaseDoc(firestore, collectionName, String(item.id));
    batch.set(ref, toFirestoreFields(item));
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = firebaseWriteBatch(firestore);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

async function replaceSultanCatalogFromBundledData(categoriesSeed, productsSeed) {
  await deleteAllFirestoreDocsInCollection('products');
  await deleteAllFirestoreDocsInCollection('categories');
  await firestoreBatchSetDocuments('categories', categoriesSeed, (c) => ({
    id: c.id,
    name: c.name,
    order_index: c.order_index || 0
  }));
  await firestoreBatchSetDocuments('products', productsSeed, productDocForFirestore);
  db.categories = categoriesSeed
    .map((c) => ({ id: c.id, name: c.name, order_index: c.order_index || 0 }))
    .sort((a, b) => (a.order_index !== b.order_index ? a.order_index - b.order_index : a.id - b.id));
  db.products = productsSeed.map(normalizeBundledProductForLocal);
  saveDatabase();
  flushSaveDatabaseSync();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('categories-updated', db.categories);
    mainWindow.webContents.send('products-updated', db.products);
  }
}

/** @returns {Promise<boolean>} true = paket şimdi kuruldu (Firebase + yerel db doldu); false = zaten güncel veya atlandı */
async function maybeInstallSultanMenuBundleOnActivate() {
  let bundle;
  try {
    bundle = require('./data/sultanMenuCatalog');
  } catch (e) {
    console.warn('⚠️ sultanMenuCatalog yüklenemedi:', e.message);
    return false;
  }
  const { SULTAN_MENU_BUNDLE_ID, categories: sc, products: sp } = bundle;
  const markerPath = path.join(app.getPath('userData'), 'sultan_menu_bundle_id.txt');
  let installed = 0;
  try {
    installed = parseInt(fs.readFileSync(markerPath, 'utf8'), 10) || 0;
  } catch (_) {}
  if (installed >= SULTAN_MENU_BUNDLE_ID) return false;
  console.log(`📦 Sultan Somatı menü paketi yükleniyor (sürüm ${SULTAN_MENU_BUNDLE_ID}, ${sp.length} ürün)...`);
  await replaceSultanCatalogFromBundledData(sc, sp);
  fs.writeFileSync(markerPath, String(SULTAN_MENU_BUNDLE_ID), 'utf8');
  console.log('✅ Sultan menü paketi Firebase ve yerel kataloga yazıldı.');
  return true;
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
    console.log('🔄 Local görseller Firebase Storage\'a yükleniyor (düşük öncelik, kademeli)...');
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const products = db.products || [];
    for (let idx = 0; idx < products.length; idx++) {
      const product = products[idx];
      if (idx > 0 && idx % 12 === 0) {
        await sleep(30);
      }

      // Eğer görsel yoksa veya zaten Firebase Storage URL'si ise atla
      if (!product.image) {
        skippedCount++;
        continue;
      }

      // Base64 data URL — yerelde kalır, dosya yoluna çevrilmeye çalışılmaz
      if (typeof product.image === 'string' && product.image.startsWith('data:image')) {
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
      
      // Firebase'e de güncelle (sırayla, UI donmasın)
      let fbIdx = 0;
      for (const product of db.products) {
        if (product.image && (product.image.includes('firebasestorage.googleapis.com') || product.image.includes('r2.cloudflarestorage.com') || product.image.includes('r2.dev'))) {
          await saveProductToFirebase(product);
          fbIdx += 1;
          if (fbIdx % 8 === 0) await sleep(40);
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
    sendCatalogSyncProgress({
      percent: 8,
      phase: 'categories',
      message: 'Kategoriler indiriliyor…'
    });
    const categoriesRef = firebaseCollection(firestore, 'categories');
    startCatalogProgressPulse('categories', 8.5, 11.4, 'Kategoriler sunucudan alınıyor…');
    let snapshot;
    try {
      snapshot = await firebaseGetDocs(categoriesRef);
    } finally {
      clearCatalogProgressPulse();
    }
    
    let addedCount = 0;
    let updatedCount = 0;
    
    const docs = snapshot.docs || [];
    sendCatalogSyncProgress({
      percent: 12,
      phase: 'categories',
      message: docs.length ? `${docs.length} kategori işleniyor…` : 'Kategoriler işleniyor…'
    });
    await processInChunks(
      docs,
      120,
      (snapshotDoc) => {
      const firebaseCategory = snapshotDoc.data();
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
    },
      12,
      (processed, total) => {
        const pct = 12 + Math.round((processed / Math.max(total, 1)) * 20);
        sendCatalogSyncProgress({
          percent: Math.min(32, pct),
          phase: 'categories',
          message: `Kategoriler ${processed}/${total}`
        });
      }
    );
    
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
    clearCatalogProgressPulse();
    console.error('❌ Firebase\'den kategori çekme hatası:', error);
  }
}

// Firebase'den ürünleri çek ve local database'e senkronize et
async function syncProductsFromFirebase() {
  if (!firestore || !firebaseCollection || !firebaseGetDocs) {
    console.warn('⚠️ Firebase başlatılamadı, ürünler çekilemedi');
    pendingLocalProductDataUrlById = null;
    return;
  }

  try {
    console.log('📥 Firebase\'den ürünler çekiliyor...');
    sendCatalogSyncProgress({
      percent: 32,
      phase: 'products',
      message: 'Ürünler indiriliyor…'
    });
    const productsRef = firebaseCollection(firestore, 'products');
    startCatalogProgressPulse('products', 33, 72, 'Ürün listesi sunucudan alınıyor…');
    let snapshot;
    try {
      snapshot = await firebaseGetDocs(productsRef);
    } finally {
      clearCatalogProgressPulse();
    }
    
    let addedCount = 0;
    let updatedCount = 0;
    
    const docs = snapshot.docs || [];
    sendCatalogSyncProgress({
      percent: 54,
      phase: 'products',
      message: docs.length ? `${docs.length} ürün işleniyor…` : 'Ürünler işleniyor…'
    });
    await processInChunks(
      docs,
      150,
      (snapshotDoc) => {
      const firebaseProduct = snapshotDoc.data();
      const productId = typeof firebaseProduct.id === 'string' ? parseInt(firebaseProduct.id) : firebaseProduct.id;
      // Local database'de bu ürün var mı kontrol et
      const existingProductIndex = db.products.findIndex(p => p.id === productId);
      let prevLocal = existingProductIndex !== -1 ? db.products[existingProductIndex] : null;
      if (!prevLocal && pendingLocalProductDataUrlById && pendingLocalProductDataUrlById.has(productId)) {
        prevLocal = { image: pendingLocalProductDataUrlById.get(productId) };
      }
      const mapped = mergeProductFromFirebaseWithLocalDataUrl(
        prevLocal,
        mapFirebaseProductToLocal(firebaseProduct)
      );
      
      if (existingProductIndex !== -1) {
        // Ürün mevcut, güncelle
        db.products[existingProductIndex] = mapped;
        updatedCount++;
      } else {
        // Yeni ürün, ekle
        db.products.push(mapped);
        addedCount++;
      }
    },
      14,
      (processed, total) => {
        const pct = 54 + Math.round((processed / Math.max(total, 1)) * 41);
        sendCatalogSyncProgress({
          percent: Math.min(96, pct),
          phase: 'products',
          message: `Ürünler ${processed}/${total}`
        });
      }
    );
    
    saveDatabase();
    console.log(`✅ Firebase'den ${snapshot.size} ürün çekildi (${addedCount} yeni, ${updatedCount} güncellendi)`);
  } catch (error) {
    clearCatalogProgressPulse();
    console.error('❌ Firebase\'den ürün çekme hatası:', error);
  } finally {
    clearCatalogProgressPulse();
    pendingLocalProductDataUrlById = null;
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
          const prevLocal = existingProductIndex !== -1 ? db.products[existingProductIndex] : null;
          const productData = mergeProductFromFirebaseWithLocalDataUrl(
            prevLocal,
            mapFirebaseProductToLocal(firebaseProduct)
          );
          
          if (existingProductIndex !== -1) {
            // Güncelle - sadece gerçekten değiştiyse
            const oldProduct = db.products[existingProductIndex];
            const hasRealChange = oldProduct.name !== productData.name || 
                                 oldProduct.category_id !== productData.category_id ||
                                 oldProduct.price !== productData.price ||
                                 oldProduct.image !== productData.image ||
                                 (oldProduct.description || '') !== (productData.description || '') ||
                                 !!oldProduct.gluten_free !== !!productData.gluten_free ||
                                 !!oldProduct.per_person !== !!productData.per_person;
            
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

function enableLaunchAtStartup() {
  // Sadece kurulu/paketli Windows uygulamasında başlangıca ekle
  if (process.platform !== 'win32' || !app.isPackaged) {
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    });

    const loginItem = app.getLoginItemSettings();
    writeLog(`Windows baslangicinda acilis: ${loginItem.openAtLogin ? 'aktif' : 'pasif'}`);
  } catch (error) {
    console.error('Windows baslangic ayari yapilamadi:', error);
    writeLog(`Windows baslangic ayari hatasi: ${error.message || error}`);
  }
}

// IPC Handlers
ipcMain.handle('get-branch-options', () => {
  return Object.values(BRANCH_CONFIGS).map(b => ({ key: b.key, label: b.label }));
});

ipcMain.handle('get-active-branch', () => {
  const active = BRANCH_CONFIGS[activeBranchKey] || BRANCH_CONFIGS.makara;
  return { key: active.key, label: active.label };
});

ipcMain.handle('activate-branch', async (event, branchKey) => {
  try {
    const next = activateBranchChain.then(() => activateBranch(branchKey));
    activateBranchChain = next.then(() => {}).catch(() => {});
    return await next;
  } catch (error) {
    console.error('activate-branch hatası:', error);
    return { success: false, error: error.message || 'Şube aktifleştirilemedi' };
  }
});

/** Sultan Somatı: paket menüyü Firebase + yerelde yeniden yazar (mevcut kategori/ürünleri siler). */
ipcMain.handle('sultan-reinstall-menu-bundle', async () => {
  if (activeBranchKey !== 'sultansomati') {
    return { success: false, error: 'Bu işlem yalnızca Sultan Somatı şubesinde kullanılabilir.' };
  }
  if (!firestore || !firebaseWriteBatch) {
    return { success: false, error: 'Firebase bağlı değil.' };
  }
  try {
    const { SULTAN_MENU_BUNDLE_ID, categories: sc, products: sp } = require('./data/sultanMenuCatalog');
    await replaceSultanCatalogFromBundledData(sc, sp);
    const markerPath = path.join(app.getPath('userData'), 'sultan_menu_bundle_id.txt');
    fs.writeFileSync(markerPath, String(SULTAN_MENU_BUNDLE_ID), 'utf8');
    return { success: true, message: `Menü yenilendi (${sp.length} ürün).` };
  } catch (e) {
    console.error('sultan-reinstall-menu-bundle:', e);
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('get-categories', () => {
  let list = [...(db.categories || [])].sort((a, b) => a.order_index - b.order_index);
  if (activeBranchKey === 'sultansomati') {
    list = list.filter((c) => !isYanUrunlerCategoryForFilter(c));
  }
  return list;
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
  const hasCategory =
    categoryId !== null && categoryId !== undefined && categoryId !== '';
  const isAllProductsToken = Number(categoryId) === -998;
  const loadAll = !hasCategory || isAllProductsToken;
  const products = loadAll
    ? db.products
    : db.products.filter((p) => Number(p.category_id) === Number(categoryId));

  // Satış ekranı: Firebase stok taraması N paralel istek = çok yavaş; liste yerel db ile anında döner.
  // Stok güncellemesi satış / senkron akışlarında zaten yapılır.
  return products.map((p) => ({
    ...p,
    stock: p.stock !== undefined ? p.stock : 0,
  }));
});

// Yan Ürünler IPC Handlers (Local kayıtlı, Firebase'e gitmez)
ipcMain.handle('get-yan-urunler', () => {
  return db.yanUrunler || [];
});

ipcMain.handle('create-yan-urun', (event, urunData) => {
  const { name, price } = urunData;
  
  if (!name || name.trim() === '') {
    return { success: false, error: 'Ürün adı boş olamaz' };
  }
  
  if (!price || price <= 0) {
    return { success: false, error: 'Geçerli bir fiyat giriniz' };
  }
  
  const newId = db.yanUrunler.length > 0 
    ? Math.max(...db.yanUrunler.map(u => u.id)) + 1 
    : 1;
  
  const newUrun = {
    id: newId,
    name: name.trim(),
    price: parseFloat(price)
  };
  
  db.yanUrunler.push(newUrun);
  saveDatabase();
  
  // Firebase'e kaydetme - YOK (local kayıtlı)
  
  return { success: true, urun: newUrun };
});

ipcMain.handle('update-yan-urun', (event, urunData) => {
  const { id, name, price } = urunData;
  
  const urunIndex = db.yanUrunler.findIndex(u => u.id === id);
  if (urunIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  if (!name || name.trim() === '') {
    return { success: false, error: 'Ürün adı boş olamaz' };
  }
  
  if (!price || price <= 0) {
    return { success: false, error: 'Geçerli bir fiyat giriniz' };
  }
  
  db.yanUrunler[urunIndex] = {
    ...db.yanUrunler[urunIndex],
    name: name.trim(),
    price: parseFloat(price)
  };
  
  saveDatabase();
  
  // Firebase'e kaydetme - YOK (local kayıtlı)
  
  return { success: true, urun: db.yanUrunler[urunIndex] };
});

ipcMain.handle('delete-yan-urun', (event, urunId) => {
  const urunIndex = db.yanUrunler.findIndex(u => u.id === urunId);
  if (urunIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  db.yanUrunler.splice(urunIndex, 1);
  saveDatabase();
  
  // Firebase'e kaydetme - YOK (local kayıtlı)
  
  return { success: true };
});

ipcMain.handle('create-sale', async (event, saleData) => {
  const { items, totalAmount, paymentMethod, orderNote, staff_name } = saleData;
  
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = getFormattedTime(now);

  // Stok kontrolü ve düşürme (sadece stok takibi yapılan ürünler için)
  for (const item of items) {
    // Yan ürünler için stok kontrolü yapma
    if (item.isYanUrun || (typeof item.id === 'string' && item.id.startsWith('yan_urun_'))) {
      continue;
    }
    
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
      const salesRef = firebaseCollection(getSalesFirestore(), 'sales');
      
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
        const salesRef = firebaseCollection(getSalesFirestore(), 'sales');
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
        const salesRef = firebaseCollection(getSalesFirestore(), 'sales');
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
    // Yan ürünler için stok kontrolü yapma
    if (item.isYanUrun || (typeof item.id === 'string' && item.id.startsWith('yan_urun_'))) {
      continue;
    }
    
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
        added_time: orderTime,
        item_note: (newItem.extraNote && String(newItem.extraNote).trim()) ? String(newItem.extraNote).trim() : null
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
        added_time: orderTime,
        item_note: (item.extraNote && String(item.extraNote).trim()) ? String(item.extraNote).trim() : null
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
  // Sadece bekleyen (açık) siparişleri döndür – tamamlanan/iptal edilen masalar dolu görünmez
  const pendingOnly = (list) => (list || []).filter(o => o.status === 'pending');
  if (tableId) {
    return pendingOnly(db.tableOrders.filter(o => o.table_id === tableId));
  }
  return pendingOnly(db.tableOrders);
});

ipcMain.handle('get-table-order-items', (event, orderId) => {
  return db.tableOrderItems.filter(oi => oi.order_id === orderId);
});

function nextTableOrderItemId() {
  const arr = db.tableOrderItems || [];
  if (arr.length === 0) return 1;
  return Math.max(...arr.map((oi) => oi.id)) + 1;
}

/** groupRowKey son eki: _true / _false — ürün id'si alt çizgi içerebilir. */
function parseGiftGroupKey(groupKey) {
  if (typeof groupKey !== 'string' || !groupKey.length) return null;
  const last = groupKey.lastIndexOf('_');
  if (last <= 0) return null;
  const suffix = groupKey.slice(last + 1);
  if (suffix !== 'true' && suffix !== 'false') return null;
  const productIdRaw = groupKey.slice(0, last);
  return { productIdRaw, isGiftSuffix: suffix === 'true' };
}

/** Bir satırdan giftQty adedi ikram satırına ayırır (veya tüm satırı ikram yapar). */
function splitTableOrderRowGift(row, giftQty) {
  const oid = row.order_id;
  const q = Number(row.quantity) || 0;
  const take = Math.min(Math.max(0, giftQty), q);
  if (take <= 0) return 0;
  if (!db.tableOrderItems) db.tableOrderItems = [];
  if (take >= q) {
    row.isGift = true;
    return take;
  }
  row.quantity = q - take;
  db.tableOrderItems.push({
    id: nextTableOrderItemId(),
    order_id: oid,
    product_id: row.product_id,
    product_name: row.product_name,
    quantity: take,
    price: row.price,
    isGift: true,
    staff_id: row.staff_id ?? null,
    staff_name: row.staff_name ?? null,
    added_date: row.added_date,
    added_time: row.added_time,
    item_note: row.item_note ?? null,
    paid_quantity: 0,
    is_paid: false
  });
  return take;
}

function finalizeTableOrderGiftUpdate(order) {
  const oid = order.id;
  const newTotal = (db.tableOrderItems || [])
    .filter((oi) => oi.order_id === oid)
    .reduce((s, oi) => s + (oi.isGift ? 0 : Number(oi.price) * Number(oi.quantity)), 0);
  order.total_amount = Math.round(newTotal * 100) / 100;
  saveDatabase();
  syncSingleTableToFirebase(order.table_id).catch((err) => {
    console.error('Masa Firebase kaydetme hatası (ikram):', err);
  });
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', {
      orderId: order.id,
      tableId: order.table_id
    });
  }
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: tableHasOpenItems(order.table_id)
    });
  }
}

/** Seçilen masa satırlarını ikram (isGift) yapar veya grup başına adet ile kısmi ikram uygular. */
ipcMain.handle('set-table-order-items-as-gift', (event, orderId, payload) => {
  const oid = Number(orderId);
  const order = db.tableOrders.find((o) => o.id === oid);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }
  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş üzerinde ikram yapılamaz' };
  }

  // Kısmi ikram: { allocations: [{ groupKey, giftQuantity }] }
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.allocations)) {
    let appliedGiftUnits = 0;
    for (const entry of payload.allocations) {
      const gk = entry && entry.groupKey;
      const want = Math.max(0, Math.floor(Number(entry.giftQuantity) || 0));
      if (!gk || want <= 0) continue;
      const parsed = parseGiftGroupKey(String(gk));
      if (!parsed || parsed.isGiftSuffix) continue;
      const pid = parsed.productIdRaw;
      const rows = (db.tableOrderItems || [])
        .filter((oi) => {
          if (oi.order_id !== oid || oi.isGift) return false;
          if (String(oi.product_id) !== String(pid)) return false;
          const paidQty = Number(oi.paid_quantity) || 0;
          if (paidQty > 0 || oi.is_paid) return false;
          return true;
        })
        .sort((a, b) => a.id - b.id);
      const maxUnits = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      let remaining = Math.min(want, maxUnits);
      for (const row of rows) {
        if (remaining <= 0) break;
        const rq = Number(row.quantity) || 0;
        const take = Math.min(rq, remaining);
        appliedGiftUnits += splitTableOrderRowGift(row, take);
        remaining -= take;
      }
    }
    if (appliedGiftUnits <= 0) {
      return {
        success: false,
        error: 'İkram yapılacak uygun satır yok veya adet geçersiz'
      };
    }
    finalizeTableOrderGiftUpdate(order);
    return {
      success: true,
      updatedCount: appliedGiftUnits,
      appliedGiftUnits,
      total_amount: order.total_amount
    };
  }

  // Eski: tam satır id listesi
  const ids = Array.isArray(payload)
    ? payload.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return { success: false, error: 'Ürün seçilmedi' };
  }

  let updatedRows = 0;
  let appliedGiftUnits = 0;
  for (const rawId of ids) {
    const row = db.tableOrderItems.find((oi) => oi.id === rawId && oi.order_id === oid);
    if (!row || row.isGift) continue;
    const paidQty = Number(row.paid_quantity) || 0;
    if (paidQty > 0 || row.is_paid) continue;
    row.isGift = true;
    updatedRows += 1;
    appliedGiftUnits += Number(row.quantity) || 0;
  }

  if (updatedRows === 0) {
    return {
      success: false,
      error: 'İkram yapılacak uygun satır yok (kısmi ödenmiş, zaten ikram veya geçersiz)'
    };
  }

  finalizeTableOrderGiftUpdate(order);
  return {
    success: true,
    updatedCount: updatedRows,
    appliedGiftUnits,
    total_amount: order.total_amount
  };
});

/** İptal fişi: kategori yazıcısı → kasa yazıcısı → varsayılan (null). Atama zorunlu değil. */
function resolveCancelPrinterNameType(categoryId, isYanUrun) {
  if (isYanUrun) {
    const cp = db.settings.cashierPrinter;
    if (cp && cp.printerName) {
      return { printerName: cp.printerName, printerType: cp.printerType || 'usb' };
    }
    return { printerName: null, printerType: null };
  }
  if (categoryId != null && categoryId !== undefined) {
    const assignment = db.printerAssignments.find((a) => {
      const ac = typeof a.category_id === 'string' ? parseInt(a.category_id, 10) : a.category_id;
      return ac === categoryId;
    });
    if (assignment && assignment.printerName) {
      return { printerName: assignment.printerName, printerType: assignment.printerType || 'usb' };
    }
  }
  const cp = db.settings.cashierPrinter;
  if (cp && cp.printerName) {
    return { printerName: cp.printerName, printerType: cp.printerType || 'usb' };
  }
  return { printerName: null, printerType: null };
}

/** Pending siparişte ürün satırı kalmadıysa siparişi siler; masa admin/Firebase’te boş görünür. */
function removePendingTableOrderIfNoItemsLeft(order) {
  if (!order || order.status !== 'pending') return;
  const hasRows = db.tableOrderItems.some((oi) => oi.order_id === order.id);
  if (hasRows) return;
  const idx = db.tableOrders.findIndex((o) => o.id === order.id);
  if (idx !== -1) db.tableOrders.splice(idx, 1);
}

/** Masada bekleyen sipariş ve en az bir ürün satırı var mı (socket). */
function tableHasOpenItems(tableId) {
  const ord = db.tableOrders.find((o) => o.table_id === tableId && o.status === 'pending');
  if (!ord) return false;
  return db.tableOrderItems.some((oi) => oi.order_id === ord.id);
}

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

  // Sultan: tümü; Havzan: müdür/şef; Suriçi: müdür
  if (staffId && activeBranchKey !== 'sultansomati') {
    const staff = (db.staff || []).find(s => s.id === staffId);
    if (!staffHasTableOrderCancelRole(staff)) {
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
  
  // Yan ürün kontrolü
  const isYanUrun = typeof item.product_id === 'string' && item.product_id.startsWith('yan_urun_');
  let categoryName = 'Yan Ürünler';
  let printerName = null;
  let printerType = null;

  if (isYanUrun) {
    categoryName = 'Yan Ürünler';
    const pr = resolveCancelPrinterNameType(null, true);
    printerName = pr.printerName;
    printerType = pr.printerType;
  } else {
    // Normal ürünler için stok iadesi (ikram edilen ürünler hariç)
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
    categoryName = category ? category.name : 'Diğer';

    const pr = resolveCancelPrinterNameType(product.category_id, false);
    printerName = pr.printerName;
    printerType = pr.printerType;
  }

      // İptal açıklaması kontrolü - açıklama yoksa fiş yazdırma, sadece açıklama iste
      if (!cancelReason || cancelReason.trim() === '') {
        return { success: false, requiresReason: true, error: 'İptal açıklaması zorunludur' };
      }

      cancelReason = cancelReason.trim();
      
      // Fiş verilerini hazırla (yazdırma arka planda yapılacak)
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

  removePendingTableOrderIfNoItemsLeft(order);
  saveDatabase();

  // İptal fişi arka planda yazdır (kullanıcı beklemez)
  printCancelReceipt(printerName, printerType, cancelReceiptData).catch(err => {
    console.error('İptal fişi yazdırma hatası:', err);
  });

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
    const cancelStaffIsChef = cancelStaff ? (cancelStaff.is_chef || false) : false;
    
    const cancelRef = firebaseCollection(getSalesFirestore(), 'cancels');
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
      staff_is_chef: cancelStaffIsChef,
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
      hasOrder: tableHasOpenItems(order.table_id)
    });
  }

  // Yeni Firebase'e sadece bu masayı kaydet (makaramasalar)
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  const pendingAfter = db.tableOrders.find((o) => o.id === order.id && o.status === 'pending');
  const remainingAmount = pendingAfter ? pendingAfter.total_amount : 0;
  return { success: true, remainingAmount };
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

  // Sultan: tümü; Havzan: müdür/şef; Suriçi: müdür
  if (staffId && activeBranchKey !== 'sultansomati') {
    const staff = (db.staff || []).find(s => s.id === staffId);
    if (!staffHasTableOrderCancelRole(staff)) {
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
  const YAN_URUNLER_CATEGORY_ID = 'yan_urunler'; // Yan ürünler için özel kategori ID

  for (const cancelItem of itemsToCancel) {
    const item = db.tableOrderItems.find(oi => oi.id === cancelItem.itemId);
    if (!item) continue;

    const quantityToCancel = cancelItem.quantity || item.quantity;
    if (quantityToCancel <= 0 || quantityToCancel > item.quantity) continue;

    // Yan ürün kontrolü
    const isYanUrun = typeof item.product_id === 'string' && item.product_id.startsWith('yan_urun_');
    
    if (isYanUrun) {
      // Yan ürünler için stok iadesi yapma (yan ürünler stok takibi yapmaz)
      if (!categoryGroups.has(YAN_URUNLER_CATEGORY_ID)) {
        const pr = resolveCancelPrinterNameType(null, true);
        categoryGroups.set(YAN_URUNLER_CATEGORY_ID, {
          categoryName: 'Yan Ürünler',
          printerName: pr.printerName,
          printerType: pr.printerType,
          items: [],
          totalQuantity: 0,
          totalAmount: 0
        });
      }

      const categoryGroup = categoryGroups.get(YAN_URUNLER_CATEGORY_ID);
      categoryGroup.items.push({
        productName: item.product_name,
        quantity: quantityToCancel,
        price: item.price
      });
      categoryGroup.totalQuantity += quantityToCancel;
      categoryGroup.totalAmount += item.isGift ? 0 : (item.price * quantityToCancel);
    } else {
      // Normal ürünler için stok iadesi (ikram edilen ürünler hariç)
      if (!item.isGift) {
        await increaseProductStock(item.product_id, quantityToCancel);
      }

      // Ürün bilgilerini al
      const product = db.products.find(p => p.id === item.product_id);
      if (!product) continue;

      const category = db.categories.find(c => c.id === product.category_id);
      const categoryName = category ? category.name : 'Diğer';

      // Kategoriye göre grupla (yazıcı ataması zorunlu değil)
      if (!categoryGroups.has(product.category_id)) {
        const pr = resolveCancelPrinterNameType(product.category_id, false);
        categoryGroups.set(product.category_id, {
          categoryName,
          printerName: pr.printerName,
          printerType: pr.printerType,
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
    }

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

  removePendingTableOrderIfNoItemsLeft(order);
  saveDatabase();

  // Her kategori için tek bir fiş yazdır - arka planda (kullanıcı beklemez)
  const now = new Date();
  const cancelDate = now.toLocaleDateString('tr-TR');
  const cancelTime = getFormattedTime(now);

  for (const [categoryId, categoryGroup] of categoryGroups) {
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
    printCancelReceipt(categoryGroup.printerName, categoryGroup.printerType, cancelReceiptData).catch(err => {
      console.error('İptal fişi yazdırma hatası:', err);
    });
  }

  // Firebase'e iptal kayıtları ekle
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const orderStaffName = order.staff_name || firstItem.staff_name || null;
      const cancelStaff = staffId ? (db.staff || []).find(s => s.id === staffId) : null;
      const cancelStaffName = cancelStaff ? `${cancelStaff.name} ${cancelStaff.surname}` : null;
      const cancelStaffIsManager = cancelStaff ? (cancelStaff.is_manager || false) : false;
      const cancelStaffIsChef = cancelStaff ? (cancelStaff.is_chef || false) : false;

      const cancelRef = firebaseCollection(getSalesFirestore(), 'cancels');
      
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
          staff_is_chef: cancelStaffIsChef,
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
      hasOrder: tableHasOpenItems(order.table_id)
    });
  }

  // Yeni Firebase'e sadece bu masayı kaydet
  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  const pendingBulk = db.tableOrders.find((o) => o.id === order.id && o.status === 'pending');
  const remainingBulk = pendingBulk ? pendingBulk.total_amount : 0;
  return { success: true, remainingAmount: remainingBulk };
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

  const targetTableName = getTableNameFromId(targetTableId);
  const targetTableType = getTableTypeFromId(targetTableId);

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

// Sipariş ürünlerini başka masaya aktar (ürünleri kaynak masadan sil, hedef masaya ekle, kategori bazlı yazdır + aktarım bildirimi)
function getTableNameFromId(tableId) {
  const sultanParsed = parseSultanTableIdForMain(tableId);
  if (sultanParsed) return sultanParsed.name;
  if (tableId.startsWith('inside-')) return `Masa ${tableId.replace('inside-', '')}`;
  if (tableId.startsWith('outside-')) {
    const num = parseInt(tableId.replace('outside-', ''), 10);
    return `Masa ${MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS.includes(num) ? num : (MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS[num - 1] || num)}`;
  }
  if (tableId.startsWith('package-')) {
    const parts = tableId.split('-');
    return `Paket ${parts[parts.length - 1]}`;
  }
  return tableId;
}
function getTableTypeFromId(tableId) {
  const sultanParsed = parseSultanTableIdForMain(tableId);
  if (sultanParsed) return sultanParsed.type;
  if (tableId.startsWith('inside-') || (tableId.startsWith('package-') && tableId.includes('inside'))) return 'inside';
  if (tableId.startsWith('outside-') || (tableId.startsWith('package-') && tableId.includes('outside'))) return 'outside';
  return 'inside';
}

ipcMain.handle('transfer-order-items', async (event, sourceOrderId, targetTableId, itemsToTransfer) => {
  const sourceOrder = db.tableOrders.find(o => o.id === sourceOrderId);
  if (!sourceOrder) return { success: false, error: 'Sipariş bulunamadı' };
  if (sourceOrder.status !== 'pending') return { success: false, error: 'Bu sipariş aktarılamaz' };

  const list = Array.isArray(itemsToTransfer) ? itemsToTransfer : [];
  if (list.length === 0) return { success: false, error: 'Aktarılacak ürün seçin' };

  if (sourceOrder.table_id === targetTableId) return { success: false, error: 'Hedef masa, mevcut masa ile aynı olamaz' };

  const targetTableName = getTableNameFromId(targetTableId);
  const targetTableType = getTableTypeFromId(targetTableId);
  let targetOrder = db.tableOrders.find(o => o.table_id === targetTableId && o.status === 'pending');

  const now = new Date();
  const orderDate = now.toLocaleDateString('tr-TR');
  const orderTime = getFormattedTime(now);

  if (!targetOrder) {
    const newOrderId = db.tableOrders.length > 0 ? Math.max(...db.tableOrders.map(o => o.id)) + 1 : 1;
    targetOrder = {
      id: newOrderId,
      table_id: targetTableId,
      table_name: targetTableName,
      table_type: targetTableType,
      total_amount: 0,
      order_date: orderDate,
      order_time: orderTime,
      status: 'pending',
      order_note: null
    };
    db.tableOrders.push(targetOrder);
  }

  let transferredAmount = 0;
  const itemsForPrint = [];

  for (const it of list) {
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (qty <= 0) continue;

    const productId = it.product_id;
    const isGift = !!it.isGift;
    let remaining = qty;
    const sourceRows = db.tableOrderItems.filter(oi => oi.order_id === sourceOrderId && oi.product_id === productId && !!oi.isGift === isGift);

    for (const row of sourceRows) {
      if (remaining <= 0) break;
      const unpaid = row.quantity - (Number(row.paid_quantity) || 0);
      const take = Math.min(remaining, Math.max(0, unpaid));
      if (take <= 0) continue;
      remaining -= take;
      row.quantity -= take;
      if (row.quantity <= 0) {
        row.paid_quantity = 0;
        const idx = db.tableOrderItems.findIndex(oi => oi.id === row.id);
        if (idx !== -1) db.tableOrderItems.splice(idx, 1);
      } else {
        row.paid_quantity = Math.min(row.paid_quantity || 0, row.quantity);
      }
      const itemAmount = isGift ? 0 : Math.round(row.price * take * 100) / 100;
      transferredAmount += itemAmount;
    }

    if (qty - remaining > 0) {
      const addQty = qty - remaining;
      const newItemId = db.tableOrderItems.length > 0 ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 : 1;
      db.tableOrderItems.push({
        id: newItemId,
        order_id: targetOrder.id,
        product_id: productId,
        product_name: it.product_name || '',
        quantity: addQty,
        price: it.price || 0,
        isGift: isGift,
        staff_id: it.staff_id || null,
        staff_name: it.staff_name || null,
        added_date: orderDate,
        added_time: orderTime,
        paid_quantity: 0,
        is_paid: false,
        payment_method: null
      });
      // Ürünün kategori bilgisini bul
      const product = db.products.find(p => p.id === productId);
      const categoryId = product ? (product.category_id || null) : null;
      
      itemsForPrint.push({
        id: productId,
        name: it.product_name || '',
        quantity: addQty,
        price: it.price || 0,
        isGift: isGift,
        staff_name: it.staff_name || null,
        added_date: orderDate,
        added_time: orderTime,
        category_id: categoryId
      });
    }
  }

  const sourceRemainingItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrderId);
  sourceOrder.total_amount = Math.round(sourceRemainingItems.reduce((sum, oi) => sum + (oi.isGift ? 0 : oi.price * oi.quantity), 0) * 100) / 100;
  targetOrder.total_amount = Math.round(((targetOrder.total_amount || 0) + transferredAmount) * 100) / 100;

  if (sourceRemainingItems.length === 0) {
    sourceOrder.status = 'completed';
    if (io) io.emit('table-update', { tableId: sourceOrder.table_id, hasOrder: false });
    syncSingleTableToFirebase(sourceOrder.table_id).catch(() => {});
  }

  saveDatabase();
  if (io) io.emit('table-update', { tableId: targetTableId, hasOrder: true });
  syncSingleTableToFirebase(targetTableId).catch(() => {});

  if (itemsForPrint.length > 0) {
    const adisyonDataForPrint = {
      tableName: targetTableName,
      tableType: targetTableType,
      sale_date: orderDate,
      sale_time: orderTime,
      transferFromTableName: sourceOrder.table_name,
      transferToTableName: targetTableName
    };
    printAdisyonByCategory(itemsForPrint, adisyonDataForPrint).catch(err => {
      console.error('Aktarım adisyon yazdırma hatası:', err);
    });
  }

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', { orderId: sourceOrder.id, targetOrderId: targetOrder.id, targetTableId });
  }

  return {
    success: true,
    sourceOrderId: sourceOrder.id,
    targetOrderId: targetOrder.id,
    targetTableId,
    transferredCount: itemsForPrint.length
  };
});

// Masa birleştir: dolu masayı başka bir dolu masaya aktar (kaynak masanın ürünleri hedef masaya eklenir, kaynak kapanır)
ipcMain.handle('merge-table-order', async (event, sourceTableId, targetTableId) => {
  const sourceOrder = db.tableOrders.find(
    o => o.table_id === sourceTableId && o.status === 'pending'
  );
  if (!sourceOrder) {
    return { success: false, error: 'Kaynak masada aktif sipariş bulunamadı' };
  }

  const targetOrder = db.tableOrders.find(
    o => o.table_id === targetTableId && o.status === 'pending'
  );
  if (!targetOrder) {
    return { success: false, error: 'Hedef masada aktif sipariş bulunamadı. Lütfen dolu bir masa seçin.' };
  }

  if (sourceTableId === targetTableId) {
    return { success: false, error: 'Aynı masayı seçemezsiniz' };
  }

  const sourceItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrder.id);
  if (sourceItems.length === 0) {
    return { success: false, error: 'Kaynak masada ürün bulunamadı' };
  }

  const nextItemId = db.tableOrderItems.length > 0 ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 : 1;
  let addedAmount = 0;
  const newItems = [];
  sourceItems.forEach((item, idx) => {
    const newItem = {
      id: nextItemId + idx,
      order_id: targetOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false,
      staff_id: item.staff_id || null,
      staff_name: item.staff_name || null,
      paid_quantity: item.paid_quantity || 0,
      is_paid: item.is_paid || false,
      payment_method: item.payment_method || null,
      paid_date: item.paid_date || null,
      paid_time: item.paid_time || null,
      category_id: item.category_id || null
    };
    newItems.push(newItem);
    db.tableOrderItems.push(newItem);
    if (!newItem.isGift) addedAmount += item.price * item.quantity;
  });

  targetOrder.total_amount = (targetOrder.total_amount || 0) + addedAmount;

  const sourceOrderId = sourceOrder.id;
  db.tableOrderItems = db.tableOrderItems.filter(oi => oi.order_id !== sourceOrderId);
  db.tableOrders = db.tableOrders.filter(o => o.id !== sourceOrderId);

  saveDatabase();

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', {
      orderId: targetOrder.id,
      tableId: targetTableId,
      sourceTableId: sourceTableId,
      merged: true
    });
  }
  if (io) {
    io.emit('table-update', { tableId: sourceTableId, hasOrder: false });
    io.emit('table-update', { tableId: targetTableId, hasOrder: true });
  }
  syncSingleTableToFirebase(sourceTableId).catch(() => {});
  syncSingleTableToFirebase(targetTableId).catch(() => {});

  return {
    success: true,
    targetOrderId: targetOrder.id,
    sourceTableId: sourceTableId,
    targetTableId: targetTableId,
    itemsMerged: newItems.length
  };
});

// Tüm masayı iptal et - tek grup iptal kaydı Firebase'e yazılır, sonra sipariş silinir
ipcMain.handle('cancel-entire-table-order', async (event, orderId, cancelReason = '') => {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  const tableId = order.table_id;

  // Tüm sipariş item'larını bul
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);

  // Firebase'e tek grup iptal kaydı ekle (admin dashboard'da ayrı ayrı değil, bir grup olarak görünsün)
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp && orderItems.length > 0) {
    try {
      const now = new Date();
      const cancelDate = now.toLocaleDateString('tr-TR');
      const cancelTime = getFormattedTime(now);
      const items_array = orderItems.map(oi => ({
        product_name: oi.product_name,
        quantity: oi.quantity,
        price: oi.price,
        isGift: oi.isGift || false
      }));
      const total_amount = orderItems.reduce((s, oi) => s + (oi.isGift ? 0 : oi.price * oi.quantity), 0);
      const cancelRef = firebaseCollection(getSalesFirestore(), 'cancels');
      await firebaseAddDoc(cancelRef, {
        is_group: true,
        order_id: order.id,
        table_id: order.table_id,
        table_name: order.table_name,
        table_type: order.table_type,
        cancel_reason: cancelReason || '',
        cancel_date: cancelDate,
        cancel_time: cancelTime,
        items_array,
        total_amount,
        source: 'desktop',
        staff_name: null,
        order_staff_name: order.staff_name || null,
        created_at: firebaseServerTimestamp()
      });
      console.log('✅ Tüm masa iptali (grup) Firebase\'e kaydedildi');
    } catch (err) {
      console.error('❌ Tüm masa iptal kaydı Firebase\'e yazılamadı:', err);
    }
  }
  
  // Stok iadesi yapma - hiçbir şey değişmeyecek
  // Fiş yazdırma - hiçbir şey yazdırılmayacak
  
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

/** Masa kapatma / ödeme alma (masaüstü ipc + Sultan mobil müdür API). */
async function completeTableOrderCore(orderId, paymentMethod = 'Nakit', campaignPercentage = null, discountAmountTL = null) {
  const order = db.tableOrders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Bu sipariş zaten tamamlanmış veya iptal edilmiş' };
  }

  if (!paymentMethod || (paymentMethod !== 'Nakit' && paymentMethod !== 'Kredi Kartı')) {
    return { success: false, error: 'Geçerli bir ödeme yöntemi seçilmedi' };
  }

  const originalAmount = parseFloat(order.total_amount) || 0;
  let finalAmount, discountAmount;
  if (discountAmountTL != null && parseFloat(discountAmountTL) > 0) {
    // TL bazlı sabit indirim (mobil personel indirim girişi)
    discountAmount = Math.min(Math.round(parseFloat(discountAmountTL) * 100) / 100, originalAmount);
    finalAmount = Math.round((originalAmount - discountAmount) * 100) / 100;
    order.firstOrderDiscount = {
      applied: true,
      discountPercent: originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 10000) / 100 : 0,
      discountAmount,
      subtotal: originalAmount,
      finalTotal: finalAmount
    };
  } else {
    const pct = campaignPercentage != null ? parseFloat(campaignPercentage) : 0;
    finalAmount = pct > 0 ? Math.round((originalAmount * (1 - pct / 100)) * 100) / 100 : originalAmount;
    discountAmount = originalAmount - finalAmount;
    if (pct > 0) {
      order.firstOrderDiscount = {
        applied: true,
        discountPercent: pct,
        discountAmount,
        subtotal: originalAmount,
        finalTotal: finalAmount
      };
    }
  }

  order.status = 'completed';

  const saleDate = order.order_date || new Date().toLocaleDateString('tr-TR');
  const saleTime = order.order_time || getFormattedTime(new Date());

  const saleId = db.sales.length > 0
    ? Math.max(...db.sales.map(s => s.id)) + 1
    : 1;

  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);

  const staffCounts = {};
  orderItems.forEach(item => {
    if (item.staff_name) {
      if (!staffCounts[item.staff_name]) {
        staffCounts[item.staff_name] = 0;
      }
      staffCounts[item.staff_name] += item.quantity;
    }
  });

  const mainStaffName = Object.keys(staffCounts).length > 0
    ? Object.keys(staffCounts).reduce((a, b) => staffCounts[a] > staffCounts[b] ? a : b)
    : null;

  db.sales.push({
    id: saleId,
    table_order_id: orderId,
    total_amount: finalAmount,
    payment_method: paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: order.table_name,
    table_type: order.table_type,
    staff_name: mainStaffName
  });
  order.completed_sale_id = saleId;

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
      staff_id: item.staff_id || null,
      staff_name: item.staff_name || null
    });
  });

  saveDatabase();

  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(getSalesFirestore(), 'sales');

      const itemsText = orderItems.map(item => {
        const giftText = item.isGift ? ' (İKRAM)' : '';
        return `${item.product_name} x${item.quantity}${giftText}`;
      }).join(', ');

      const staffNames = [...new Set(orderItems.filter(oi => oi.staff_name).map(oi => oi.staff_name))];
      const staffName = staffNames.length > 0 ? staffNames.join(', ') : null;

      const di = order.firstOrderDiscount;
      const hasDiscount = di && di.applied === true;
      const subtotal = hasDiscount && (di.subtotal != null) ? di.subtotal : null;
      const discountPercent = hasDiscount && (di.discountPercent != null) ? di.discountPercent : 0;
      const discountAmountFb = hasDiscount && (di.discountAmount != null) ? di.discountAmount : 0;
      const firebaseSale = {
        sale_id: saleId,
        total_amount: finalAmount,
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
          staff_name: item.staff_name || null
        })),
        created_at: firebaseServerTimestamp()
      };
      if (hasDiscount) {
        firebaseSale.discountInfo = { applied: true, discountPercent: discountPercent, discountAmount: discountAmountFb };
        if (subtotal != null) firebaseSale.subtotal = subtotal;
        firebaseSale.discount_percent = discountPercent;
        if (discountAmountFb > 0) firebaseSale.discount_amount = discountAmountFb;
      }
      await firebaseAddDoc(salesRef, firebaseSale);
      console.log('Masa siparişi Firebase\'e kaydedildi:', saleId);
    } catch (error) {
      console.error('Firebase\'e kaydetme hatası:', error);
    }
  }

  syncSingleTableToFirebase(order.table_id).catch(err => {
    console.error('Masa Firebase kaydetme hatası:', err);
  });

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', {
      orderId: order.id,
      tableId: order.table_id
    });
  }

  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: false
    });
  }

  return { success: true, saleId };
}

/**
 * Ödemesi alınmış masa siparişini geri al: siparişi tekrar pending yapar, bağlı satış kaydını siler.
 * Yalnızca completed_sale_id veya sale.table_order_id ile eşleşen satışlar güvenli geri alınır.
 */
async function revertCompletedTableOrderCore(orderId) {
  const oid = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
  const order = db.tableOrders.find((o) => o.id === oid);
  if (!order) {
    return { success: false, error: 'Sipariş bulunamadı' };
  }
  if (order.status !== 'completed') {
    return { success: false, error: 'Bu sipariş tamamlanmamış; geri alma uygulanamaz' };
  }
  let saleId = order.completed_sale_id;
  if (!saleId) {
    const linked = (db.sales || []).find((s) => Number(s.table_order_id) === Number(oid));
    if (linked) saleId = linked.id;
  }
  if (!saleId) {
    return { success: false, error: 'Bu kayıt için satış bağlantısı yok (eski veriler). Yalnızca güncellemeden sonra kapanan siparişler geri alınabilir.' };
  }
  const saleIdx = (db.sales || []).findIndex((s) => s.id === saleId);
  if (saleIdx < 0) {
    return { success: false, error: 'Satış kaydı bulunamadı' };
  }
  db.saleItems = (db.saleItems || []).filter((si) => si.sale_id !== saleId);
  db.sales.splice(saleIdx, 1);
  order.status = 'pending';
  delete order.completed_sale_id;
  if (order.firstOrderDiscount) delete order.firstOrderDiscount;
  saveDatabase();
  syncSingleTableToFirebase(order.table_id).catch((err) => {
    console.error('Masa Firebase (geri al):', err);
  });
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('table-order-updated', {
      orderId: order.id,
      tableId: order.table_id
    });
  }
  if (io) {
    io.emit('table-update', {
      tableId: order.table_id,
      hasOrder: true
    });
  }
  return { success: true };
}

ipcMain.handle('complete-table-order', async (event, orderId, paymentMethod = 'Nakit', campaignPercentage = null) => {
  return completeTableOrderCore(orderId, paymentMethod, campaignPercentage);
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
  // Masa açılış tarihini kullan (masa hangi tarihte açıldıysa o tarihin cirosuna geçer)
  // Bu sayede çift sayım önlenir ve masa açılış tarihine göre ciraya eklenir
  const order = db.tableOrders.find(o => o.id === saleData.orderId);
  const saleDate = (order && order.order_date) ? order.order_date : new Date().toLocaleDateString('tr-TR');
  const saleTime = (order && order.order_time) ? order.order_time : getFormattedTime(new Date());

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
      const salesRef = firebaseCollection(getSalesFirestore(), 'sales');
      
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

  // Ödenecek miktarı belirle (kısmi ödeme: sadece gönderilen miktar; sayı zorunlu)
  const requestedQty = paidQuantity != null ? Number(paidQuantity) : NaN;
  const quantityToPay = Number.isFinite(requestedQty) && requestedQty > 0
    ? Math.min(Math.floor(requestedQty), item.quantity)
    : item.quantity;

  // Miktar kontrolü
  if (quantityToPay <= 0 || quantityToPay > item.quantity) {
    return { success: false, error: 'Geçersiz miktar' };
  }

  // Ödenmiş miktarı kontrol et
  const currentPaidQuantity = Number(item.paid_quantity || 0);
  const remainingQuantity = item.quantity - currentPaidQuantity;

  // Kısmi ödemede asla kalan miktarı aşma
  const actualQuantityToPay = Math.min(quantityToPay, Math.max(0, remainingQuantity));
  if (actualQuantityToPay <= 0) {
    return { success: false, error: `Bu kalem için ödenecek miktar kalmadı` };
  }

  // Yeni ödenen miktar
  const newPaidQuantity = currentPaidQuantity + actualQuantityToPay;

  // Ürün tutarını hesapla (ikram değilse) - para birimi 2 basamak
  const itemAmount = item.isGift ? 0 : Math.round(item.price * actualQuantityToPay * 100) / 100;

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
  // Masa açılış tarihini kullan (masa hangi tarihte açıldıysa o tarihin cirosuna geçer)
  // Bu sayede çift sayım önlenir ve masa açılış tarihine göre ciraya eklenir
  const saleDate = order.order_date || new Date().toLocaleDateString('tr-TR');
  const saleTime = order.order_time || getFormattedTime(new Date());

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
    quantity: actualQuantityToPay, // Ödenen miktar
    price: item.price,
    isGift: item.isGift || false,
    staff_id: item.staff_id || null,
    staff_name: item.staff_name || null
  });

  saveDatabase();

  // Firebase'e kaydet
  if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
    try {
      const salesRef = firebaseCollection(getSalesFirestore(), 'sales');
      
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
          quantity: actualQuantityToPay, // Ödenen miktar
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
      hasOrder: tableHasOpenItems(order.table_id)
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
  const { name, category_id, price, image, description, gluten_free, per_person } = productData;
  
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
  if (description) newProduct.description = description;
  if (gluten_free === true) newProduct.gluten_free = true;
  if (per_person === true) newProduct.per_person = true;
  
  db.products.push(newProduct);
  saveDatabase();
  if (newProduct.image && typeof newProduct.image === 'string' && newProduct.image.startsWith('data:image')) {
    flushSaveDatabaseSync();
  }

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
  const { id, name, category_id, price, image, description, gluten_free, per_person } = productData;
  
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
  
  const next = {
    ...db.products[productIndex],
    name,
    category_id,
    price: parseFloat(price),
    image: image || null
  };
  if (description !== undefined) {
    if (description) next.description = description;
    else delete next.description;
  }
  if (gluten_free === true) next.gluten_free = true;
  else delete next.gluten_free;
  if (per_person === true) next.per_person = true;
  else delete next.per_person;
  db.products[productIndex] = next;
  
  saveDatabase();
  if (next.image && typeof next.image === 'string' && next.image.startsWith('data:image')) {
    flushSaveDatabaseSync();
  }

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
      
      // Yazıcılar arası bekleme kaldırıldı (hız için)
      if (i < printJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
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

// Yazıcı listesi önbelleği (art arda yazdırmalarda gecikmeyi önler)
let _printerNamesCache = { list: null, at: 0 };
const PRINTER_CACHE_TTL_MS = 6000;
function getAvailablePrinterNames() {
  const now = Date.now();
  if (_printerNamesCache.list && (now - _printerNamesCache.at) < PRINTER_CACHE_TTL_MS) {
    return _printerNamesCache.list;
  }
  try {
    const result = execSync('powershell -Command "Get-WmiObject Win32_Printer | Select-Object Name | ConvertTo-Json"', { encoding: 'utf-8', timeout: 4000 });
    const data = JSON.parse(result);
    const arr = Array.isArray(data) ? data : [data];
    _printerNamesCache = { list: arr.map(p => (p && p.Name) ? p.Name : '').filter(n => n), at: now };
    return _printerNamesCache.list;
  } catch (e) {
    if (_printerNamesCache.list) return _printerNamesCache.list;
    return [];
  }
}

// Metin belgesi olarak yazdır - temp .txt + PowerShell (yol/kaçış güvenli: -File script)
function printRawToPrinter(printerName, text) {
  let targetName = printerName || null;
  if (targetName) {
    const available = getAvailablePrinterNames();
    const exact = available.find(p => p === targetName);
    const partial = available.find(p => p.includes(targetName) || targetName.includes(p));
    targetName = exact || partial || null;
  }
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, 'makara-print-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.txt');
  fs.writeFileSync(tmpFile, text, { encoding: 'utf8' });
  const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (_) {} try { if (ps1Path) fs.unlinkSync(ps1Path); } catch (_) {} };
  const ps1Path = path.join(tmpDir, 'makara-print-' + Date.now() + '.ps1');
  const ps1Content = targetName
    ? `$ErrorActionPreference = 'Stop'; Get-Content -LiteralPath $args[0] -Encoding UTF8 | Out-Printer -Name $args[1]`
    : `$ErrorActionPreference = 'Stop'; Get-Content -LiteralPath $args[0] -Encoding UTF8 | Out-Printer`;
  fs.writeFileSync(ps1Path, ps1Content, { encoding: 'utf8' });
  try {
    const args = targetName
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path, tmpFile, targetName]
      : ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path, tmpFile];
    const result = spawnSync('powershell.exe', args, {
      windowsHide: true,
      timeout: 20000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status !== 0) {
      const errMsg = (result.stderr || result.stdout || '').trim() || 'Yazdırma hatası';
      console.error('   [printRawToPrinter] PowerShell:', errMsg);
      cleanup();
      return Promise.reject(new Error(errMsg));
    }
    console.log('   [printRawToPrinter] Gönderildi:', targetName || 'Varsayılan');
    setTimeout(cleanup, 3000);
    return Promise.resolve({ success: true, printerName: targetName || 'Varsayılan' });
  } catch (err) {
    console.error('   [printRawToPrinter] Hata:', err.message || err);
    cleanup();
    return Promise.reject(err || new Error('Yazdırma hatası'));
  }
}

/** Termal / HTML fiş üst bilgisi: Sultan Somatı şubesinde marka adı. */
function getReceiptBrandTitle() {
  return activeBranchKey === 'sultansomati' ? 'Sultan Somatı' : 'MAKARA';
}

/** RAW termal yazıcılar için ortalanmış marka satırı (~32 kolon). */
function formatThermalBrandLine(title) {
  const t = String(title || 'MAKARA');
  const width = 32;
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}

// Üretim fişi metin (termal RAW)
function generateProductionReceiptText(items, receiptData) {
  const lines = [
    '--------------------------------',
    formatThermalBrandLine(getReceiptBrandTitle()),
    '      ÜRETİM FİŞİ',
    '--------------------------------',
    `Tarih: ${receiptData.sale_date || new Date().toLocaleDateString('tr-TR')}`,
    `Saat:  ${receiptData.sale_time || getFormattedTime(new Date())}`,
    receiptData.sale_id ? `Fiş No: #${receiptData.sale_id}` : null,
    receiptData.order_id ? `Sipariş No: #${receiptData.order_id}` : null,
    '--------------------------------',
    'Ürün                  Adet',
    '--------------------------------'
  ].filter(Boolean);
  items.forEach(item => {
    const name = (item.name || '').substring(0, 22);
    const qty = String(item.quantity || 0);
    lines.push(`${name.padEnd(22)} ${qty}`);
    if (item.isGift) lines.push('  (İKRAM)');
    if (item.extraNote) lines.push(`  Not: ${item.extraNote}`);
  });
  lines.push('--------------------------------');
  if (receiptData.orderNote) {
    lines.push('Sipariş notu:');
    lines.push(receiptData.orderNote);
    lines.push('--------------------------------');
  }
  lines.push('');
  return lines.join('\r\n') + '\r\n';
}

// Kasa fişi metin (termal RAW)
function generateReceiptText(receiptData) {
  const isSuriciBranch = activeBranchKey === 'makarasur';
  const entityLabel = isSuriciBranch ? 'Musteri' : 'Masa';
  const lines = [
    '--------------------------------',
    formatThermalBrandLine(getReceiptBrandTitle()),
    receiptData.tableName
      ? (receiptData.tableType === 'online' ? '   Online Siparis' : `   ${entityLabel} Siparisi`)
      : '    Satis Fisi',
    '--------------------------------',
    receiptData.tableName ? `${entityLabel}: ${receiptData.tableName.replace('Online Siparis Musteri: ', '')}` : null,
    receiptData.customer_phone ? `Tel: ${receiptData.customer_phone}` : null,
    receiptData.customer_address ? `Adres: ${receiptData.customer_address}` : null,
    `Tarih: ${receiptData.sale_date || new Date().toLocaleDateString('tr-TR')}`,
    `Saat:  ${receiptData.sale_time || getFormattedTime(new Date())}`,
    '--------------------------------',
    'Ürün              Adet   Tutar',
    '--------------------------------'
  ].filter(Boolean);
  (receiptData.items || []).forEach(item => {
    const isGift = item.isGift || false;
    const name = (item.name || '').substring(0, 16);
    const qty = String(item.quantity || 0);
    const total = isGift ? '0.00' : (item.price * item.quantity).toFixed(2);
    lines.push(`${name.padEnd(16)} ${qty.padStart(3)}  TL${total}`);
    if (isGift) lines.push('  (İKRAM)');
    if (item.extraNote) lines.push(`  Not: ${item.extraNote}`);
  });
  lines.push('--------------------------------');
  const totalAmount = (receiptData.totalAmount != null ? receiptData.totalAmount : (receiptData.items || []).reduce((s, i) => s + (i.isGift ? 0 : i.price * i.quantity), 0));
  lines.push(`TOPLAM:              TL${Number(totalAmount).toFixed(2)}`);
  lines.push('--------------------------------');
  if (receiptData.orderNote) {
    lines.push('Not: ' + receiptData.orderNote);
    lines.push('--------------------------------');
  }
  lines.push('');
  return lines.join('\r\n') + '\r\n';
}

// Yazıcıya yazdırma — HTML ile (okunaklı, düzgün düzen; metin belgesi silik/bozuk çıkıyordu)
async function printToPrinter(printerName, printerType, receiptData, isProductionReceipt = false, productionItems = null, rawHTML = null) {
  let printWindow = null;
  try {
    const receiptType = isProductionReceipt ? 'ÜRETİM FİŞİ' : rawHTML ? 'ÖZEL FİŞ' : 'KASA FİŞİ';
    console.log(`   [printToPrinter] ${receiptType} (HTML): "${printerName || 'Varsayılan'}"`);
    const receiptHTML = rawHTML
      ? rawHTML
      : isProductionReceipt
        ? generateProductionReceiptHTML(productionItems || receiptData.items, receiptData)
        : generateReceiptHTML(receiptData);
    printWindow = new BrowserWindow({
      show: false,
      width: 220,
      height: 3000,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    let printResolve, printReject;
    const printPromise = new Promise((resolve, reject) => { printResolve = resolve; printReject = reject; });
    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      setImmediate(async () => {
        try {
          const scrollHeight = await printWindow.webContents.executeJavaScript(`
            (function() {
              document.body.style.minHeight = 'auto'; document.body.style.height = 'auto';
              document.documentElement.style.height = 'auto';
              return Math.max(document.body.scrollHeight, document.body.offsetHeight,
                document.documentElement.scrollHeight, document.documentElement.offsetHeight);
            })();
          `);
          printWindow.setSize(220, Math.max(3000, scrollHeight + 200));
        } catch (_) {}
        let targetName = printerName;
        if (targetName) {
          const available = getAvailablePrinterNames();
          const exact = available.find(p => p === targetName);
          const partial = available.find(p => p.includes(targetName) || targetName.includes(p));
          targetName = exact || partial || null;
        }
        const printOptions = {
          silent: true, printBackground: true, margins: { marginType: 'none' },
          landscape: false, scaleFactor: 100, pagesPerSheet: 1, collate: false, color: false, copies: 1, duplex: 'none'
        };
        if (targetName) printOptions.deviceName = targetName;
        printWindow.webContents.print(printOptions, (success, errType) => {
          if (!success) printReject(new Error(errType || 'Yazdırma başarısız'));
          else printResolve(true);
          setTimeout(() => { if (printWindow && !printWindow.isDestroyed()) { printWindow.close(); printWindow = null; } }, 150);
        });
      });
    };
    printWindow.webContents.once('did-finish-load', () => startPrint());
    printWindow.webContents.once('dom-ready', () => startPrint());
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);
    setImmediate(() => startPrint());
    await Promise.race([
      printPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Yazdırma timeout')), 10000))
    ]);
    return { success: true, printerName: printerName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printToPrinter] Hata:`, error.message);
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
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
        <h3>${getReceiptBrandTitle()}</h3>
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

/** Kasa «Adisyon Yazdır»: kısa, sade termal fiş (Sultan’da marka: Sultan Somatı). */
function generateReservationReceiptHTML(reservation) {
  const brand = getReceiptBrandTitle();
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const row = (label, value) => value
    ? `<tr><td style="padding:4px 0;font-size:11px;color:#555;font-weight:600;white-space:nowrap;width:50%;">${esc(label)}</td><td style="padding:4px 0 4px 6px;font-size:12px;color:#111;font-weight:800;text-align:right;">${esc(String(value))}</td></tr>`
    : '';
  const peopleRows = [
    row('Kisi Sayisi', reservation.peopleCount > 0 ? reservation.peopleCount : null),
    row('Yetiskin',    reservation.adults    > 0 ? reservation.adults    : null),
    row('Cocuk',       reservation.children  > 0 ? reservation.children  : null),
    row('Bebek',       reservation.babies    > 0 ? reservation.babies    : null),
  ].filter(Boolean).join('');
  const noteHTML = reservation.note && reservation.note.trim()
    ? `<div style="margin-top:10px;padding:8px 10px;background:#fafafa;border:1px dashed #ddd;border-radius:4px;"><div style="font-size:9px;font-weight:800;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">Ozel Not</div><div style="font-size:11px;color:#222;font-weight:600;line-height:1.55;">${esc(reservation.note)}</div></div>`
    : '';
  const now = new Date();
  const printedAt = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
@media print{@page{size:58mm auto;margin:0;}body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Montserrat','Arial Narrow',Arial,sans-serif;width:58mm;background:#fff;color:#111;padding:10px 8px 22px 8px;}
</style></head><body>
<div style="text-align:center;margin-bottom:12px;">
  <div style="font-size:14px;font-weight:900;letter-spacing:0.06em;color:#111;text-transform:uppercase;">${esc(brand)}</div>
  <div style="margin:5px auto;height:2px;background:#111;width:80%;"></div>
  <div style="font-size:9px;font-weight:800;letter-spacing:0.18em;color:#444;text-transform:uppercase;margin-top:4px;">REZERVASYON</div>
  <div style="margin:5px auto;height:1px;background:#ccc;width:80%;"></div>
</div>
<div style="text-align:center;margin-bottom:10px;padding:8px 6px;background:#f5f5f5;border-radius:6px;">
  <div style="font-size:9px;font-weight:700;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">MISAFIR</div>
  <div style="font-size:14px;font-weight:900;color:#111;line-height:1.3;">${esc(reservation.guestName || '\u2014')}</div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:4px;"><tbody>
  ${row('Masa',  reservation.tableName || reservation.tableId)}
  ${row('Tarih', reservation.date)}
  ${row('Saat',  reservation.time)}
</tbody></table>
${peopleRows ? `<div style="height:1px;background:#eee;margin:8px 0;"></div><table style="width:100%;border-collapse:collapse;"><tbody>${peopleRows}</tbody></table>` : ''}
${noteHTML}
<div style="height:1px;background:#ccc;margin:12px 0 8px 0;"></div>
<div style="text-align:center;">
  ${reservation.staffName ? `<div style="font-size:9px;color:#888;font-weight:600;">Olusturan: ${esc(reservation.staffName)}</div>` : ''}
  <div style="font-size:9px;color:#aaa;margin-top:2px;">Yazdirildi: ${printedAt}</div>
</div>
</body></html>`;
}

function generateMinimalAdisyonReceiptHTML(receiptData) {
  const brand = getReceiptBrandTitle();
  const isSuriciBranch = activeBranchKey === 'makarasur';
  const isSultanMinimal = activeBranchKey === 'sultansomati';
  /** Sultan Somatı: 58 mm termalde okunabilirlik için bir kademe daha büyük puntolar */
  const fs = isSultanMinimal
    ? {
        body: 12,
        title: 15,
        subtitle: 10,
        mid: 11,
        meta: 10,
        row: 12,
        rowNote: 10,
        discount: 10,
        orderNote: 11,
        addr: 10,
        qrCaption: 9,
        total: 13,
        bodyPad: '7px 9px 12px',
        qrSize: 108
      }
    : {
        body: 10,
        title: 13,
        subtitle: 9,
        mid: 9,
        meta: 8,
        row: 10,
        rowNote: 8,
        discount: 9,
        orderNote: 9,
        addr: 8,
        qrCaption: 7,
        total: 11,
        bodyPad: '6px 8px 10px',
        qrSize: 100
      };
  const entityLabel = isSuriciBranch ? 'Müşteri' : 'Masa';
  const dateStr = receiptData.sale_date || new Date().toLocaleDateString('tr-TR');
  const timeStr = receiptData.sale_time || getFormattedTime(new Date());
  const items = receiptData.items || [];

  const tableLine = (() => {
    if (receiptData.tableType === 'online') {
      const name = (receiptData.tableName || '').replace('Online Sipariş Müşteri: ', '').trim();
      const bits = ['Online'];
      if (name) bits.push(name);
      if (receiptData.customer_phone) bits.push(receiptData.customer_phone);
      return bits.join(' · ');
    }
    if (receiptData.tableName) return `${entityLabel} ${receiptData.tableName}`;
    return '';
  })();

  const itemsHTML = items.map((item) => {
    const isGift = item.isGift || false;
    const qty = item.quantity || 0;
    const lineTotal = isGift ? 0 : (item.price * item.quantity);
    const name = item.name || '';
    const extra = item.extraNote
      ? `<div style="font-size:${fs.rowNote}px;color:#444;margin:0 0 3px 0;padding-left:1px;line-height:1.3;">${item.extraNote}</div>`
      : '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin:2px 0;font-size:${fs.row}px;line-height:1.28;">
        <span style="flex:1;min-width:0;word-break:break-word;">${qty}× ${name}${isGift ? ' · İKRAM' : ''}</span>
        <span style="white-space:nowrap;font-weight:600;">${isGift ? '₺0' : '₺' + lineTotal.toFixed(2)}</span>
      </div>
      ${extra}`;
  }).join('');

  const subtotal = receiptData.subtotal !== undefined
    ? receiptData.subtotal
    : items.reduce((s, i) => s + (i.isGift ? 0 : i.price * i.quantity), 0);
  const finalTotal = receiptData.finalTotal !== undefined ? receiptData.finalTotal : subtotal;
  const hasDisc = receiptData.discountInfo && receiptData.discountInfo.applied === true;

  const discountBlock = hasDisc ? `
    <div style="display:flex;justify-content:space-between;font-size:${fs.discount}px;color:#555;margin-top:4px;">
      <span>Ara</span><span>₺${Number(subtotal).toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:${fs.discount}px;color:#b91c1c;">
      <span>İnd.%${receiptData.discountInfo.discountPercent || 0}</span><span>-₺${(receiptData.discountAmount || 0).toFixed(2)}</span>
    </div>` : '';

  const noteBlock = receiptData.orderNote
    ? `<div style="margin-top:6px;padding-top:5px;border-top:1px dashed #999;font-size:${fs.orderNote}px;line-height:1.35;"><span style="font-weight:600;">Not:</span> ${receiptData.orderNote}</div>`
    : '';

  const onlineAddr = (receiptData.tableType === 'online' && receiptData.customer_address)
    ? `<div style="font-size:${fs.addr}px;color:#333;margin:3px 0 0;line-height:1.35;word-break:break-word;">${receiptData.customer_address}</div>`
    : '';

  const qrBlock = (receiptData.qrCodeDataURL && receiptData.tableType === 'online')
    ? `<div style="text-align:center;margin-top:8px;padding-top:6px;border-top:1px solid #000;">
        <img src="${receiptData.qrCodeDataURL}" alt="" style="width:${fs.qrSize}px;height:${fs.qrSize}px;image-rendering:pixelated;" />
        <div style="font-size:${fs.qrCaption}px;margin-top:2px;color:#444;">Adres</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @media print { @page { size: 58mm auto; margin: 0; } body { margin: 0; padding: ${fs.bodyPad}; } }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; width: 58mm; max-width: 58mm; margin: 0; padding: ${fs.bodyPad}; font-size: ${fs.body}px; color: #000; }
  .t { font-weight: 700; font-size: ${fs.title}px; letter-spacing: 0.02em; text-align: center; margin: 0 0 2px; }
  .s { font-size: ${fs.subtitle}px; text-align: center; color: #444; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.05em; }
  .m { font-size: ${fs.mid}px; text-align: center; margin: 0 0 2px; line-height: 1.3; word-break: break-word; }
  .meta { font-size: ${fs.meta}px; text-align: center; color: #666; margin: 0 0 5px; }
  hr { border: none; border-top: 1px solid #000; margin: 5px 0; }
  .tot { display: flex; justify-content: space-between; font-weight: 700; font-size: ${fs.total}px; margin-top: 5px; padding-top: 4px; border-top: 2px solid #000; }
</style></head><body>
  <p class="t">${brand}</p>
  <p class="s">Adisyon</p>
  ${tableLine ? `<p class="m">${tableLine}</p>` : ''}
  ${onlineAddr}
  <p class="meta">${dateStr} · ${timeStr}</p>
  <hr/>
  ${itemsHTML}
  ${discountBlock}
  <div class="tot"><span>TOPLAM</span><span>₺${Number(finalTotal).toFixed(2)}</span></div>
  ${noteBlock}
  ${qrBlock}
</body></html>`;
}

// Fiş HTML içeriğini oluştur
function generateReceiptHTML(receiptData) {
  if (receiptData?.cashierOnly === true) {
    return generateMinimalAdisyonReceiptHTML(receiptData);
  }
  const isSuriciBranch = activeBranchKey === 'makarasur';
  const entityLabel = isSuriciBranch ? 'Müşteri' : 'Masa';
  const receiptCustomerName = (receiptData.tableName || '').replace('Online Sipariş Müşteri: ', '').trim();
  const normalizedPaymentMethod = String(receiptData.paymentMethod || '').trim().toLocaleLowerCase('tr-TR');
  const showPaymentInfo = normalizedPaymentMethod !== 'adisyon';
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
        <h3>${getReceiptBrandTitle()}</h3>
        ${isSuriciBranch && receiptCustomerName ? `
        <h3 style="margin-top: 0; margin-bottom: 4px; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.3px;">${receiptCustomerName}</h3>
        ` : ''}
        <p style="font-size: 10px; margin: 0; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.tableName ? (receiptData.tableType === 'online' ? 'Online Sipariş' : `${entityLabel} Siparişi`) : 'Satış Fişi'}</p>
      </div>
      
      <div class="info">
        ${receiptData.tableName ? (receiptData.tableType === 'online' ? `
        <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #000;">
          <div style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">ONLINE SİPARİŞ MÜŞTERİ:</div>
          <div style="font-size: 14px; font-weight: 900; color: #000; font-family: 'Montserrat', sans-serif; line-height: 1.3; margin-bottom: 6px;">${receiptData.tableName.replace('Online Sipariş Müşteri: ', '')}</div>
          ${receiptData.customer_phone ? `
          <div style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 6px;">
            <span style="font-weight: 900;">Tel:</span> ${receiptData.customer_phone}
          </div>
          ` : ''}
        </div>
        ` : `
        ${isSuriciBranch ? '' : `
        <div>
          <span>${entityLabel}:</span>
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.tableName}</span>
        </div>
        `}
        `) : ''}
        ${receiptData.tableType === 'online' && receiptData.customer_address ? `
        <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #000;">
          <div style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">ADRES:</div>
          <div style="font-size: 9px; font-weight: 900; color: #000; line-height: 1.4; word-wrap: break-word;">${receiptData.customer_address}</div>
          ${receiptData.address_note ? `
          <div style="font-size: 8px; font-weight: 700; color: #000; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #666; line-height: 1.3; word-wrap: break-word;">
            ${receiptData.address_note}
          </div>
          ` : ''}
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
        ${receiptData.discountInfo && receiptData.discountInfo.applied === true ? `
        <div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #ccc;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
            <span>Ara Toplam:</span>
            <span>₺${(receiptData.subtotal || receiptData.items.reduce((sum, item) => {
              if (item.isGift) return sum;
              return sum + (item.price * item.quantity);
            }, 0)).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #dc2626; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif; margin-top: 4px;">
            <span>İndirim (${receiptData.discountInfo.discountPercent || 0}%):</span>
            <span>-₺${(receiptData.discountAmount || 0).toFixed(2)}</span>
          </div>
          ${receiptData.discountInfo.discountDescription ? `
          <div style="font-size: 8px; color: #6b7280; font-weight: 700; font-style: italic; font-family: 'Montserrat', sans-serif; margin-top: 2px; text-align: right;">
            ${receiptData.discountInfo.discountDescription}
          </div>
          ` : ''}
        </div>
        ` : ''}
        <div>
          <span>TOPLAM:</span>
          <span>₺${(receiptData.finalTotal !== undefined ? receiptData.finalTotal : receiptData.items.reduce((sum, item) => {
            // İkram edilen ürünleri toplamdan çıkar
            if (item.isGift) return sum;
            return sum + (item.price * item.quantity);
          }, 0)).toFixed(2)}</span>
        </div>
        ${showPaymentInfo ? `
        <div style="font-size: 11px; color: #000; font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">
          <span>Ödeme:</span>
          <span>${receiptData.paymentMethod || 'Nakit'}</span>
        </div>
        ` : ''}
      </div>
      
      ${receiptData.qrCodeDataURL && receiptData.tableType === 'online' ? `
      <div class="footer" style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 2px solid #000;">
        <div style="font-size: 9px; font-weight: 900; font-style: italic; color: #000; margin-bottom: 8px; font-family: 'Montserrat', sans-serif;">
          ADRES İÇİN QR KOD
        </div>
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 6px;">
          <img src="${receiptData.qrCodeDataURL}" alt="QR Code" style="width: 180px; height: 180px; min-width: 180px; min-height: 180px; border: 3px solid #000; padding: 6px; background: #fff; image-rendering: crisp-edges;" />
        </div>
        <div style="font-size: 8px; font-weight: 700; font-style: italic; color: #000; font-family: 'Montserrat', sans-serif; line-height: 1.2;">
          QR kodu okutarak<br/>adresi Google Maps'te açın
        </div>
      </div>
      ` : ''}

    </body>
    </html>
  `;
}

app.whenReady().then(() => {
  loadBranchSettings();
  initDatabase();
  enableLaunchAtStartup();
  createWindow();
  startAPIServer();

  // Varsayılan/son seçilen branch için Firebase istemcilerini hazırla.
  // Not: Veri senkronizasyonu renderer'dan 'activate-branch' çağrısı ile başlatılır.
  initializeFirebaseForBranch(activeBranchKey).then((ok) => {
    if (!ok) {
      console.error('⚠️ Başlangıç branch Firebase bağlantısı kurulamadı');
    }
  });

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
    flushSaveDatabaseSync();
    app.quit();
  }
});

app.on('before-quit', () => {
  flushSaveDatabaseSync();
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

/** Adisyon: tüm kategori → mutfak yazıcı atamalarını tek seferde kaldırır (kasa yazıcısı değişmez). */
ipcMain.handle('reset-all-printer-assignments', () => {
  if (!db.printerAssignments) db.printerAssignments = [];
  const n = db.printerAssignments.length;
  db.printerAssignments = [];
  saveDatabase();
  console.log(`🖨️ Tüm kategori yazıcı atamaları sıfırlandı (${n} kayıt)`);
  return { success: true, removedCount: n };
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

// Sepetteyken fiş hazırla (masaüstü/mobil — gönder/kaydet anında yazdırmak için)
ipcMain.handle('prepare-adisyon-receipts', (event, adisyonData) => {
  const items = adisyonData?.items || [];
  return prepareAdisyonReceipts(items, adisyonData || {});
});

// Masaüstü: sepetteyken adisyon fişini arka planda hazırla (Adisyon Yazdır / Masaya Kaydet anında yazdırılır)
ipcMain.handle('prepare-adisyon-desktop', (event, adisyonData) => {
  try {
    const items = adisyonData?.items || [];
    if (!items.length) return { printJobId: null };

    const cashierPrinter = db.settings.cashierPrinter;
    if (!cashierPrinter || !cashierPrinter.printerName) return { printJobId: null };

    const totalAmount = adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : items.reduce((sum, item) => {
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    const receiptData = {
      sale_id: null,
      totalAmount,
      paymentMethod: 'Adisyon',
      sale_date: adisyonData.sale_date || new Date().toLocaleDateString('tr-TR'),
      sale_time: adisyonData.sale_time || getFormattedTime(new Date()),
      items,
      orderNote: adisyonData.orderNote || null,
      tableName: adisyonData.tableName || null,
      tableType: adisyonData.tableType || null,
      cashierOnly: true,
      customer_name: adisyonData.customer_name || null,
      customer_phone: adisyonData.customer_phone || null,
      customer_address: adisyonData.customer_address || null,
      address_note: adisyonData.address_note || null,
      discountInfo: adisyonData.discountInfo || null,
      subtotal: adisyonData.subtotal !== undefined ? adisyonData.subtotal : totalAmount,
      discountAmount: adisyonData.discountAmount || 0,
      finalTotal: adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : totalAmount
    };
    const receiptHTML = generateReceiptHTML(receiptData);
    const htmlReceipts = { [cashierPrinter.printerName]: receiptHTML };
    const printJobId = preloadPrintWindows(htmlReceipts);
    return { printJobId };
  } catch (err) {
    console.error('prepare-adisyon-desktop hatası:', err);
    return { printJobId: null };
  }
});

// Online sipariş: sepetteyken adisyonu (QR'lı, kasa fişi) arka planda hazırla — Adisyon Yazdır anında yazdırılır
ipcMain.handle('prepare-adisyon-online', async (event, adisyonData) => {
  try {
    const items = adisyonData?.items || [];
    if (!items.length) return { printJobId: null };
    const cashierPrinter = db.settings.cashierPrinter;
    if (!cashierPrinter || !cashierPrinter.printerName) return { printJobId: null };
    const totalAmount = adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : items.reduce((sum, item) => {
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    const receiptData = {
      sale_id: null,
      totalAmount,
      paymentMethod: 'Adisyon',
      sale_date: adisyonData.sale_date || new Date().toLocaleDateString('tr-TR'),
      sale_time: adisyonData.sale_time || getFormattedTime(new Date()),
      items,
      orderNote: adisyonData.orderNote || null,
      tableName: adisyonData.tableName || null,
      tableType: 'online',
      cashierOnly: true,
      customer_name: adisyonData.customer_name || null,
      customer_phone: adisyonData.customer_phone || null,
      customer_address: adisyonData.customer_address || null,
      address_note: adisyonData.address_note || null,
      discountInfo: adisyonData.discountInfo || null,
      subtotal: adisyonData.subtotal !== undefined ? adisyonData.subtotal : totalAmount,
      discountAmount: adisyonData.discountAmount || 0,
      finalTotal: adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : totalAmount
    };
    if (adisyonData.customer_address) {
      try {
        const mapsURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adisyonData.customer_address)}`;
        receiptData.qrCodeDataURL = await QRCode.toDataURL(mapsURL, { width: 280, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#FFFFFF' } });
      } catch (_) {}
    }
    const receiptHTML = generateReceiptHTML(receiptData);
    const htmlReceipts = { [cashierPrinter.printerName]: receiptHTML };
    const printJobId = preloadPrintWindows(htmlReceipts);
    return { printJobId };
  } catch (err) {
    console.error('prepare-adisyon-online hatası:', err);
    return { printJobId: null };
  }
});

// Hazır fişi anında yazdır (masaüstü Adisyon Yazdır / Masaya Kaydet / Online Adisyon Yazdır)
ipcMain.handle('print-adisyon-by-job-id', async (event, printJobId) => {
  if (!printJobId || !preloadedPrintJobs.has(printJobId)) {
    return { success: false, error: 'Hazır fiş bulunamadı' };
  }
  try {
    await printPreloadedJob(printJobId);
    return { success: true };
  } catch (err) {
    console.error('print-adisyon-by-job-id hatası:', err);
    return { success: false, error: err?.message || 'Yazdırılamadı' };
  }
});

// Hazır fişleri anında yazdır (hazır metinleri yazıcıya gönder)
ipcMain.handle('print-adisyon-prepared', async (event, receipts) => {
  if (!receipts || typeof receipts !== 'object') return { success: false, error: 'Geçersiz fiş verisi' };
  const entries = Object.entries(receipts);
  if (entries.length === 0) return { success: true };
  const results = await Promise.all(
    entries.map(([printerName, text]) =>
      printRawToPrinter(printerName, text).catch(err => ({ success: false, error: err?.message, printerName }))
    )
  );
  const failed = results.filter(r => r && !r.success);
  return { success: failed.length === 0, error: failed.length ? failed.map(f => f?.error).join('; ') : null };
});

/** Kasa adisyon fişi (cashierOnly) — ipc ve Sultan mobil müdür API ortak. */
async function printCashierAdisyonFromData(adisyonData) {
  const items = adisyonData.items || [];
  const cashierPrinter = db.settings.cashierPrinter;
  if (!cashierPrinter || !cashierPrinter.printerName) {
    return { success: false, error: 'Kasa yazıcısı ayarlanmamış' };
  }
  const totalAmount = adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : items.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * item.quantity);
  }, 0);
  const receiptData = {
    sale_id: null,
    totalAmount,
    paymentMethod: 'Adisyon',
    sale_date: adisyonData.sale_date || new Date().toLocaleDateString('tr-TR'),
    sale_time: adisyonData.sale_time || getFormattedTime(new Date()),
    items,
    orderNote: adisyonData.orderNote || null,
    tableName: adisyonData.tableName || null,
    tableType: adisyonData.tableType || null,
    cashierOnly: true,
    customer_name: adisyonData.customer_name || null,
    customer_phone: adisyonData.customer_phone || null,
    customer_address: adisyonData.customer_address || null,
    address_note: adisyonData.address_note || null,
    discountInfo: adisyonData.discountInfo || null,
    subtotal: adisyonData.subtotal !== undefined ? adisyonData.subtotal : totalAmount,
    discountAmount: adisyonData.discountAmount || 0,
    finalTotal: adisyonData.finalTotal !== undefined ? adisyonData.finalTotal : totalAmount
  };
  if (adisyonData.tableType === 'online' && adisyonData.customer_address) {
    try {
      const mapsURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adisyonData.customer_address)}`;
      receiptData.qrCodeDataURL = await QRCode.toDataURL(mapsURL, { width: 280, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#FFFFFF' } });
    } catch (_) {}
  }
  await printToPrinter(cashierPrinter.printerName, cashierPrinter.printerType, receiptData, false, null);
  return { success: true, error: null };
}

// Adisyon yazdırma handler - Kategori bazlı yazdırma yapar
ipcMain.handle('print-adisyon', async (event, adisyonData) => {
  console.log('\n=== ADİSYON YAZDIRMA İŞLEMİ BAŞLADI ===');
  console.log('📄 AdisyonData:', JSON.stringify(adisyonData, null, 2));
  
  try {
    const items = adisyonData.items || [];
    console.log(`   Toplam ${items.length} ürün bulundu`);
    
    if (adisyonData.cashierOnly === true) {
      console.log('   💰 Kasa yazıcısından fiyatlı fiş yazdırılıyor...');
      const r = await printCashierAdisyonFromData(adisyonData);
      console.log(`\n=== KASA YAZICISINDAN FİYATLI FİŞ YAZDIRMA TAMAMLANDI ===`);
      return r;
    }

    if (!mainWindow) {
      console.error('❌ Ana pencere bulunamadı');
      return { success: false, error: 'Ana pencere bulunamadı' };
    }
    
    // Normal kategori bazlı adisyon yazdırma (online sipariş için QR kod kategori bazlı adisyonun en altına eklenecek)
    await printAdisyonByCategory(items, adisyonData);
    
    // Online sipariş için cashierOnly: true olsa bile ayrı QR kod fişi yazdırma (artık kategori bazlı adisyonun içinde)
    // Bu kısım kaldırıldı - QR kod artık kategori bazlı adisyonun en altında
    
    console.log(`\n=== ADİSYON YAZDIRMA İŞLEMİ TAMAMLANDI ===`);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('\n❌❌❌ ADİSYON YAZDIRMA HATASI ❌❌❌');
    console.error('Hata mesajı:', error.message);
    console.error('Hata detayı:', error.stack);
    return { success: false, error: error.message };
  }
});

// Adisyon yazdırma — HTML ile (okunaklı; metin belgesi silik/bozuk çıkıyordu)
async function printAdisyonToPrinter(printerName, printerType, items, adisyonData) {
  let printWindow = null;
  try {
    console.log(`   [printAdisyonToPrinter] Adisyon (HTML): "${printerName || 'Varsayılan'}"`);
    const adisyonHTML = generateAdisyonHTML(items, adisyonData);
    printWindow = new BrowserWindow({
      show: false, width: 220, height: 3000,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    let printResolve, printReject;
    const printPromise = new Promise((resolve, reject) => { printResolve = resolve; printReject = reject; });
    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      setImmediate(async () => {
        try {
          const scrollHeight = await printWindow.webContents.executeJavaScript(`
            (function() {
              document.body.style.minHeight = 'auto'; document.body.style.height = 'auto';
              document.documentElement.style.height = 'auto';
              return Math.max(document.body.scrollHeight, document.body.offsetHeight,
                document.documentElement.scrollHeight, document.documentElement.offsetHeight);
            })();
          `);
          printWindow.setSize(220, Math.max(3000, scrollHeight + 200));
        } catch (_) {}
        let targetName = printerName;
        if (targetName) {
          const available = getAvailablePrinterNames();
          const exact = available.find(p => p === targetName);
          const partial = available.find(p => p.includes(targetName) || targetName.includes(p));
          targetName = exact || partial || null;
        }
        const printOptions = {
          silent: true, printBackground: true, margins: { marginType: 'none' },
          landscape: false, scaleFactor: 100, pagesPerSheet: 1, collate: false, color: false, copies: 1, duplex: 'none'
        };
        if (targetName) printOptions.deviceName = targetName;
        printWindow.webContents.print(printOptions, (success, errType) => {
          if (!success) printReject(new Error(errType || 'Adisyon yazdırma başarısız'));
          else printResolve(true);
          setTimeout(() => { if (printWindow && !printWindow.isDestroyed()) { printWindow.close(); printWindow = null; } }, 150);
        });
      });
    };
    printWindow.webContents.once('did-finish-load', () => startPrint());
    printWindow.webContents.once('dom-ready', () => startPrint());
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(adisyonHTML)}`);
    setImmediate(() => startPrint());
    await Promise.race([
      printPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Adisyon yazdırma timeout')), 18000))
    ]);
    return { success: true, printerName: printerName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printAdisyonToPrinter] Hata:`, error.message);
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
    return { success: false, error: error.message, printerName: printerName || 'Varsayılan' };
  }
}

// Sepetteyken fişi hazırla — yazıcı adı -> metin map döner (gönder/kaydet anında yazdırmak için)
function prepareAdisyonReceipts(items, adisyonData) {
  const receipts = {};
  if (!items || items.length === 0) return receipts;
  const categoryItemsMap = new Map();
  const categoryInfoMap = new Map();
  for (const item of items) {
    const product = db.products.find(p => String(p.id) === String(item.id));
    const categoryId = product?.category_id ?? 'no-category';
    const category = db.categories.find(c => c.id === categoryId);
    if (!categoryItemsMap.has(categoryId)) {
      categoryItemsMap.set(categoryId, []);
      categoryInfoMap.set(categoryId, { id: categoryId, name: category?.name || 'Diğer' });
    }
    categoryItemsMap.get(categoryId).push(item);
  }
  const printerGroupsMap = new Map();
  categoryItemsMap.forEach((categoryItems, categoryId) => {
    const categoryIdNum = typeof categoryId === 'string' && categoryId !== 'no-category' ? parseInt(categoryId) : categoryId;
    const categoryInfo = categoryInfoMap.get(categoryId);
    const assignment = db.printerAssignments.find(a => {
      const cid = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
      return cid === categoryIdNum;
    });
    if (!assignment) return;
    const printerKey = `${assignment.printerName}::${assignment.printerType}`;
    if (!printerGroupsMap.has(printerKey)) {
      printerGroupsMap.set(printerKey, { printerName: assignment.printerName, printerType: assignment.printerType, categories: [] });
    }
    printerGroupsMap.get(printerKey).categories.push({
      categoryId,
      categoryName: categoryInfo.name,
      items: categoryItems
    });
  });
  printerGroupsMap.forEach((job) => {
    const allItemsWithCategory = [];
    job.categories.forEach(cat => {
      cat.items.forEach(item => {
        allItemsWithCategory.push({ ...item, _categoryId: cat.categoryId, _categoryName: cat.categoryName });
      });
    });
    const printerAdisyonData = {
      ...adisyonData,
      items: allItemsWithCategory,
      categories: job.categories.map(cat => ({ categoryId: cat.categoryId, categoryName: cat.categoryName, items: cat.items }))
    };
    receipts[job.printerName] = generateAdisyonText(allItemsWithCategory, printerAdisyonData);
  });
  return receipts;
}

// Sepetteyken fişi HTML olarak hazırla — yazıcı adı -> HTML map (Siparişi Gönder anında anında yazdırma)
function prepareAdisyonHtmlReceipts(items, adisyonData) {
  const htmlReceipts = {};
  if (!items || items.length === 0) return htmlReceipts;
  const categoryItemsMap = new Map();
  const categoryInfoMap = new Map();
  for (const item of items) {
    const product = db.products.find(p => String(p.id) === String(item.id));
    const categoryId = product?.category_id ?? 'no-category';
    const category = db.categories.find(c => c.id === categoryId);
    if (!categoryItemsMap.has(categoryId)) {
      categoryItemsMap.set(categoryId, []);
      categoryInfoMap.set(categoryId, { id: categoryId, name: category?.name || 'Diğer' });
    }
    categoryItemsMap.get(categoryId).push(item);
  }
  const printerGroupsMap = new Map();
  categoryItemsMap.forEach((categoryItems, categoryId) => {
    const categoryIdNum = typeof categoryId === 'string' && categoryId !== 'no-category' ? parseInt(categoryId) : categoryId;
    const categoryInfo = categoryInfoMap.get(categoryId);
    const assignment = db.printerAssignments.find(a => {
      const cid = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
      return cid === categoryIdNum;
    });
    if (!assignment) return;
    const printerKey = `${assignment.printerName}::${assignment.printerType}`;
    if (!printerGroupsMap.has(printerKey)) {
      printerGroupsMap.set(printerKey, { printerName: assignment.printerName, printerType: assignment.printerType, categories: [] });
    }
    printerGroupsMap.get(printerKey).categories.push({
      categoryId,
      categoryName: categoryInfo.name,
      items: categoryItems
    });
  });
  printerGroupsMap.forEach((job) => {
    const allItemsWithCategory = [];
    job.categories.forEach(cat => {
      cat.items.forEach(item => {
        allItemsWithCategory.push({ ...item, _categoryId: cat.categoryId, _categoryName: cat.categoryName });
      });
    });
    const printerAdisyonData = {
      ...adisyonData,
      items: allItemsWithCategory,
      categories: job.categories.map(cat => ({ categoryId: cat.categoryId, categoryName: cat.categoryName, items: cat.items }))
    };
    htmlReceipts[job.printerName] = generateAdisyonHTML(allItemsWithCategory, printerAdisyonData);
  });
  return htmlReceipts;
}

// Hazır HTML fişlerini anında yazdır (0 gecikme — Siparişi Gönder ile kullanılır)
async function printPreparedHtmlReceipts(printerNameToHtml) {
  if (!printerNameToHtml || typeof printerNameToHtml !== 'object') return;
  const entries = Object.entries(printerNameToHtml);
  if (entries.length === 0) return;
  const printOne = (printerName, html) => {
    return new Promise((resolve, reject) => {
      let printWindow = null;
      try {
        printWindow = new BrowserWindow({
          show: false, width: 220, height: 3000,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        let printResolve, printReject;
        const printPromise = new Promise((res, rej) => { printResolve = res; printReject = rej; });
        let printStarted = false;
        const startPrint = () => {
          if (printStarted) return;
          printStarted = true;
          setImmediate(async () => {
            try {
              const scrollHeight = await printWindow.webContents.executeJavaScript(`
                (function() {
                  document.body.style.minHeight = 'auto'; document.body.style.height = 'auto';
                  document.documentElement.style.height = 'auto';
                  return Math.max(document.body.scrollHeight, document.body.offsetHeight,
                    document.documentElement.scrollHeight, document.documentElement.offsetHeight);
                })();
              `);
              printWindow.setSize(220, Math.max(3000, scrollHeight + 200));
            } catch (_) {}
            const available = getAvailablePrinterNames();
            const exact = available.find(p => p === printerName);
            const partial = available.find(p => p.includes(printerName) || printerName.includes(p));
            const targetName = exact || partial || printerName;
            const printOptions = {
              silent: true, printBackground: true, margins: { marginType: 'none' },
              landscape: false, scaleFactor: 100, pagesPerSheet: 1, collate: false, color: false, copies: 1, duplex: 'none'
            };
            if (targetName) printOptions.deviceName = targetName;
            printWindow.webContents.print(printOptions, (success, errType) => {
              if (!success) printReject(new Error(errType || 'Yazdırma başarısız'));
              else printResolve(true);
              if (printWindow && !printWindow.isDestroyed()) { printWindow.close(); printWindow = null; }
            });
          });
        };
        printWindow.webContents.once('did-finish-load', () => startPrint());
        printWindow.webContents.once('dom-ready', () => startPrint());
        const timeout = setTimeout(() => printReject(new Error('Yazdırma timeout')), 15000);
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
          setImmediate(() => startPrint());
        }).catch(err => { clearTimeout(timeout); printReject(err); });
        printPromise.then(() => { clearTimeout(timeout); resolve(); }, err => { clearTimeout(timeout); reject(err); });
      } catch (e) {
        if (printWindow && !printWindow.isDestroyed()) printWindow.close();
        reject(e);
      }
    });
  };
  await Promise.all(entries.map(([name, html]) => printOne(name, html).catch(err => console.error(`Hazır fiş yazdırma ${name}:`, err?.message || err))));
}

// Kategori bazlı adisyon yazdırma fonksiyonu
async function printAdisyonByCategory(items, adisyonData) {
  console.log('\n=== KATEGORİ BAZLI ADİSYON YAZDIRMA BAŞLIYOR ===');
  console.log(`   Toplam ${items.length} ürün bulundu`);
  
  // Online sipariş için QR (metin fişinde kullanılmıyor; arka planda oluştur, yazdırmayı geciktirme)
  if (adisyonData.tableType === 'online' && adisyonData.customer_address && !adisyonData.qrCodeDataURL) {
    const mapsURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adisyonData.customer_address)}`;
    QRCode.toDataURL(mapsURL, { width: 280, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#FFFFFF' } })
      .then(url => { adisyonData.qrCodeDataURL = url; })
      .catch(() => {});
  }
  
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
      
      // 4. Tüm yazıcılara AYNI ANDA gönder (paralel) — basmaz basmaz fiş çıksın
      const printJobs = Array.from(printerGroupsMap.values());
      const printPromises = printJobs.map(job => {
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
        const printerAdisyonData = {
          ...adisyonData,
          items: allItemsWithCategory,
          categories: job.categories.map(cat => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            items: cat.items
          })),
          sale_date: staffGroup.staffDate,
          sale_time: staffGroup.staffTime,
          staff_name: staffGroup.staffName,
          transferFromTableName: adisyonData.transferFromTableName || null,
          transferToTableName: adisyonData.transferToTableName || null,
          qrCodeDataURL: adisyonData.includeAddressQr === false ? null : (adisyonData.qrCodeDataURL || null),
          customer_address: adisyonData.includeAddressQr === false ? null : (adisyonData.customer_address || null)
        };
        return printAdisyonToPrinter(job.printerName, job.printerType, allItemsWithCategory, printerAdisyonData)
          .catch(err => {
            console.error(`      ❌ ${job.printerName}:`, err?.message || err);
            return { success: false, error: err?.message };
          });
      });
      await Promise.all(printPromises);
    }
    
    console.log(`\n=== KATEGORİ BAZLI ADİSYON YAZDIRMA TAMAMLANDI ===`);
  } catch (error) {
    console.error('\n❌ KATEGORİ BAZLI ADİSYON YAZDIRMA HATASI:', error);
    // Hata durumunda kasa yazıcısına yazdırma yapma (sadece kategori bazlı yazıcılara yazdır)
  }
}

// Adisyon metin (termal RAW) - HTML yerine hızlı yazdırma
function generateAdisyonText(items, adisyonData) {
  const isSuriciBranch = activeBranchKey === 'makarasur';
  const entityLabel = isSuriciBranch ? 'Müşteri' : 'Masa';
  const staffName = adisyonData.staff_name || (items.length > 0 && items[0].staff_name ? items[0].staff_name : null);
  const lines = [
    '--------------------------------',
    formatThermalBrandLine(getReceiptBrandTitle()),
    '        ADİSYON',
    '--------------------------------',
    adisyonData.transferFromTableName && adisyonData.transferToTableName
      ? `AKTARIM: ${adisyonData.transferFromTableName} -> ${adisyonData.transferToTableName}`
      : null,
    adisyonData.tableName ? `${entityLabel}: ${adisyonData.tableName}` : null,
    staffName ? `Garson: ${staffName}` : null,
    `Tarih: ${adisyonData.sale_date || new Date().toLocaleDateString('tr-TR')}`,
    `Saat:  ${adisyonData.sale_time || getFormattedTime(new Date())}`,
    '--------------------------------'
  ].filter(Boolean);
  const hasCategories = adisyonData.categories && adisyonData.categories.length > 0;
  if (hasCategories) {
    adisyonData.categories.forEach(cat => {
      lines.push(`[${cat.categoryName}]`);
      (cat.items || []).forEach(item => {
        lines.push(`  ${item.name}`);
        lines.push(`  ${item.quantity} adet`);
        if (item.isGift) lines.push('  İKRAM');
        if (item.extraNote) lines.push(`  Not: ${item.extraNote}`);
      });
    });
  } else {
    (items || []).forEach(item => {
      lines.push((item.name || '').toString());
      lines.push(`  ${item.quantity || 0} adet`);
      if (item.isGift) lines.push('  İKRAM');
      if (item.extraNote) lines.push(`  Not: ${item.extraNote}`);
    });
  }
  lines.push('--------------------------------');
  if (adisyonData.orderNote) {
    lines.push('Sipariş notu:');
    lines.push(adisyonData.orderNote);
    lines.push('--------------------------------');
  }
  lines.push('');
  return lines.join('\r\n') + '\r\n';
}

// Modern ve profesyonel adisyon HTML formatı
function generateAdisyonHTML(items, adisyonData) {
  const isSuriciBranch = activeBranchKey === 'makarasur';
  const entityLabel = isSuriciBranch ? 'Müşteri' : 'Masa';
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
      ${adisyonData.transferFromTableName && adisyonData.transferToTableName ? `
      <div style="margin: 0 0 12px 0; padding: 10px 12px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 8px; text-align: center; box-shadow: 0 2px 6px rgba(245,158,11,0.4);">
        <p style="font-size: 9px; font-weight: 900; color: #92400e; margin: 0 0 4px 0; font-family: 'Montserrat', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">🔄 Aktarım</p>
        <p style="font-size: 12px; font-weight: 900; color: #78350f; margin: 0; font-family: 'Montserrat', sans-serif; line-height: 1.3;">${adisyonData.transferFromTableName} ${isSuriciBranch ? 'müşterisinden' : 'masasından'}<br/><strong>${adisyonData.transferToTableName}</strong> ${isSuriciBranch ? 'müşterisine' : 'masasına'} aktarıldı</p>
      </div>
      ` : ''}
      <div class="info">
        ${adisyonData.tableName ? (adisyonData.tableType === 'online' ? `
        <div class="table-row" style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0;">
          <div class="table-label" style="font-size: 9px; font-weight: 700; color: #6366f1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.8px;">Online Sipariş Müşteri:</div>
          <div class="table-value" style="font-size: 17px; font-weight: 900; color: #1e293b; line-height: 1.4; letter-spacing: 0.3px;">${adisyonData.tableName.replace('Online Sipariş Müşteri: ', '')}</div>
        </div>
        ` : `
        <div class="table-row">
          <div class="table-label">${entityLabel}:</div>
          <div class="table-value">${adisyonData.tableName}</div>
        </div>
        `) : ''}
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
      
      ${adisyonData.qrCodeDataURL && adisyonData.tableType === 'online' ? `
      <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 2px solid #000;">
        <div style="font-size: 9px; font-weight: 900; font-style: italic; color: #000; margin-bottom: 8px; font-family: 'Montserrat', sans-serif;">
          ADRES İÇİN QR KOD
        </div>
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 6px;">
          <img src="${adisyonData.qrCodeDataURL}" alt="QR Code" style="width: 180px; height: 180px; min-width: 180px; min-height: 180px; border: 3px solid #000; padding: 6px; background: #fff; image-rendering: crisp-edges;" />
        </div>
        <div style="font-size: 8px; font-weight: 700; font-style: italic; color: #000; font-family: 'Montserrat', sans-serif; line-height: 1.2;">
          QR kodu okutarak<br/>adresi Google Maps'te açın
        </div>
      </div>
      ` : ''}

    </body>
    </html>
  `;
}

// İptal fişi metin (termal RAW)
function generateCancelReceiptText(cancelData) {
  const tableTypeText = cancelData.tableType === 'inside' ? 'İç Masa' : 'Dış Masa';
  const lines = [
    '--------------------------------',
    '        İPTAL FİŞİ',
    '--------------------------------',
    `Masa: ${tableTypeText} ${cancelData.tableName}`,
    '--------------------------------',
    cancelData.items && cancelData.items.length > 1
      ? cancelData.items.map(item => `${item.productName} ${item.quantity} adet TL${(item.price * item.quantity).toFixed(2)}`).join('\n')
      : `${cancelData.productName}\n${cancelData.quantity} adet  TL${cancelData.price.toFixed(2)}`,
    '--------------------------------',
    `Toplam: ${cancelData.quantity} adet`,
    cancelData.items && cancelData.items.length > 1
      ? `Tutar: TL${cancelData.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}`
      : `Tutar: TL${(cancelData.price * cancelData.quantity).toFixed(2)}`,
    '--------------------------------',
    `${cancelData.cancelDate} ${cancelData.cancelTime}`,
    `Kategori: ${cancelData.categoryName}`,
    '--------------------------------',
    ''
  ];
  return lines.join('\r\n') + '\r\n';
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
// İptal fişi — HTML ile (okunaklı; metin belgesi silik/bozuk çıkıyordu)
async function printCancelReceipt(printerName, printerType, cancelData) {
  let printWindow = null;
  try {
    console.log(`   [printCancelReceipt] İptal fişi (HTML): "${printerName || 'Varsayılan'}"`);
    const cancelHTML = generateCancelReceiptHTML(cancelData);
    printWindow = new BrowserWindow({
      show: false,
      width: 220,
      height: 3000,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    let targetName = printerName || null;
    if (targetName) {
      try {
        const available = getAvailablePrinterNames();
        const exact = available.find(p => p === targetName);
        const partial = available.find(p => p.includes(targetName) || targetName.includes(p));
        targetName = exact || partial || targetName;
      } catch (_) {}
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
    if (targetName) printOptions.deviceName = targetName;
    const loadDone = new Promise((resolve) => {
      printWindow.webContents.once('did-finish-load', () => resolve());
      printWindow.webContents.once('did-fail-load', (e, code, desc) => {
        console.warn(`   [printCancelReceipt] load uyarısı: ${code} ${desc}`);
        resolve();
      });
    });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(cancelHTML)}`);
    await Promise.race([loadDone, new Promise((r) => setTimeout(r, 3000))]);
    await new Promise((r) => setTimeout(r, 400));
    const doPrint = (options) => new Promise((resolve, reject) => {
      if (!printWindow || printWindow.isDestroyed()) {
        reject(new Error('Pencere kapatıldı'));
        return;
      }
      printWindow.webContents.print(options, (success, errType) => {
        if (!success) reject(new Error(errType || 'İptal fişi yazdırma başarısız'));
        else resolve();
      });
    });
    try {
      await Promise.race([
        doPrint(printOptions),
        new Promise((_, rej) => setTimeout(() => rej(new Error('İptal fişi yazdırma timeout (10s)')), 10000))
      ]);
    } catch (firstErr) {
      if (printOptions.deviceName) {
        console.warn(`   [printCancelReceipt] Hedef yazıcı başarısız, varsayılan deneniyor:`, firstErr.message);
        delete printOptions.deviceName;
        await Promise.race([
          doPrint(printOptions),
          new Promise((_, rej) => setTimeout(() => rej(new Error('İptal fişi timeout')), 10000))
        ]);
      } else {
        throw firstErr;
      }
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
        printWindow = null;
      }
    }
    return { success: true, printerName: targetName || 'Varsayılan' };
  } catch (error) {
    console.error(`   [printCancelReceipt] Hata:`, error.message);
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
    throw error;
  }
}

function generateMobileHTML(serverURL, mobileBranchKey = 'makara') {
  const isSultanMobileTpl = mobileBranchKey === 'sultansomati';
  const isMakaraHavzanMobileTpl = mobileBranchKey === 'makara';
  const pageTitle = isSultanMobileTpl ? 'Sultan Somatı - Mobil Sipariş' : 'MAKARA - Mobil Sipariş';
  const themeColor = isSultanMobileTpl || isMakaraHavzanMobileTpl ? '#ffffff' : '#ec4899';
  const appleTitle = isSultanMobileTpl ? 'Sultan Somatı Mobil' : 'MAKARA Mobil';
  const faviconHref = isSultanMobileTpl ? `${serverURL}/sultan-mobile-icon.svg` : `${serverURL}/mobilpersonel.png`;
  const appleTouchHref = faviconHref;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="${themeColor}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="${appleTitle}">
  <link rel="manifest" href="${serverURL}/mobile-manifest.json">
  <link rel="icon" type="${isSultanMobileTpl ? 'image/svg+xml' : 'image/png'}" href="${faviconHref}">
  <link rel="apple-touch-icon" href="${appleTouchHref}">
  <meta name="mobile-web-app-capable" content="yes">
  <title>${pageTitle}</title>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/mobile-sw.js', { scope: '/mobile' })
          .catch(function() {});
      });
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html {
      touch-action: manipulation;
      -ms-touch-action: manipulation;
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); 
      min-height: 100vh; 
      padding: 10px;
      touch-action: manipulation;
      -ms-touch-action: manipulation;
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
    .table-btn.inside-empty {
      background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
      border-color: #f9a8d4;
      color: #9d174d;
    }
    .table-btn.inside-empty .table-number,
    .table-btn.inside-empty .table-label { color: #9d174d; }
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
    .sultan-table-cell {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
    }
    .sultan-table-cell > .table-btn {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .sultan-mgr-fab {
      position: absolute;
      bottom: 6px;
      right: 6px;
      width: 36px;
      height: 36px;
      border-radius: 11px;
      border: none;
      background: rgba(6, 78, 59, 0.92);
      color: #fff;
      font-size: 20px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -2px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.28);
      z-index: 5;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 0 2px 0;
      -webkit-tap-highlight-color: transparent;
    }
    .sultan-mgr-fab:active {
      transform: scale(0.94);
    }
    .table-btn.outside-empty .table-number,
    .table-btn.outside-empty .table-label {
      color: #92400e;
    }
    .category-tabs {
      padding-top: 0;
      padding-bottom: 4px;
      width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #a855f7 #f1f1f1;
    }
    /* Üç satır birlikte tek yatay kaydırmada hareket eder */
    .category-tabs-inner {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: max-content;
      min-width: 100%;
      box-sizing: border-box;
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
    /* 3 satır: en geniş satır genişliğinde hizalanır; kaydırma üstteki .category-tabs’ta */
    .category-tabs-row.category-tabs-row--equal {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: stretch;
      gap: 10px;
      width: 100%;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .category-tab {
      padding: 12px 18px;
      border: 2px solid #e5e7eb;
      border-radius: 14px;
      background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
      font-size: 14px;
      font-weight: 700;
      white-space: nowrap;
      word-break: normal;
      overflow-wrap: normal;
      hyphens: manual;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      color: #4b5563;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      text-align: center;
      flex: 0 0 auto;
      min-width: max-content;
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      line-height: 1.15;
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
    #productsGridScrollWrap {
      scrollbar-width: thin;
      scrollbar-color: #a855f7 #f1f1f1;
    }
    #productsGridScrollWrap::-webkit-scrollbar {
      width: 6px;
    }
    #productsGridScrollWrap::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    #productsGridScrollWrap::-webkit-scrollbar-thumb {
      background: #a855f7;
      border-radius: 10px;
    }
    #productsGridScrollWrap::-webkit-scrollbar-thumb:hover {
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
      background: #fff;
      box-shadow: 0 -2px 20px rgba(0,0,0,0.08);
      border-radius: 16px 16px 0 0;
      transform: translateY(calc(100% - 56px));
      transition: transform 0.25s ease;
      z-index: 1000;
      max-height: 75vh;
    }
    .cart.open {
      transform: translateY(0);
    }
    .cart-header {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      min-height: 56px;
      border-bottom: 1px solid #f0f0f0;
    }
    .cart-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cart-header-badge {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .cart-header-total {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .cart-header-total .currency {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }
    .cart-header-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
      transition: transform 0.2s;
    }
    .cart-header-icon:active {
      transform: scale(0.92);
    }
    .cart-content {
      padding: 12px 16px 16px;
      max-height: calc(75vh - 56px);
      overflow-y: auto;
      display: none;
    }
    .cart.open .cart-content {
      display: block;
    }
    .cart-content::-webkit-scrollbar {
      width: 4px;
    }
    .cart-content::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    .cart-items {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 12px;
    }
    .cart-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      gap: 10px;
    }
    .cart-item:last-child {
      border-bottom: none;
    }
    .cart-item-name {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      min-width: 0;
    }
    .cart-item-meta {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .cart-item-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .cart-item-qty {
      min-width: 28px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #334155;
    }
    .cart-qty-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 8px;
      background: #e2e8f0;
      color: #475569;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.15s;
    }
    .cart-qty-btn:active {
      background: #cbd5e1;
    }
    .cart-remove-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 8px;
      background: #fee2e2;
      color: #dc2626;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.15s;
    }
    .cart-remove-btn:active {
      background: #fecaca;
    }
    .cart-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
      align-items: stretch;
    }
    .cart-note-btn {
      flex: 0 0 auto;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cart-note-btn:active {
      background: #f8fafc;
    }
    .cart-ikram-btn {
      flex: 0 0 auto;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #fbbf24;
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      color: #92400e;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
    }
    .cart-ikram-btn:active {
      background: #fde68a;
      transform: scale(0.98);
    }
    html.sultan-mobile-root .cart-ikram-btn {
      border-color: #34d399;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      color: #065f46;
      box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
    }
    html.sultan-mobile-root .cart-ikram-btn:active {
      background: #a7f3d0;
    }
    .cart-item-gift {
      border-left: 3px solid #f59e0b;
      background: linear-gradient(90deg, rgba(254, 243, 199, 0.35) 0%, #fff 12px);
    }
    html.sultan-mobile-root .cart-item-gift {
      border-left-color: #10b981;
      background: linear-gradient(90deg, rgba(209, 250, 229, 0.45) 0%, #fff 12px);
    }
    .cart-send-btn {
      flex: 1;
      min-width: 120px;
      padding: 12px 16px;
      border-radius: 10px;
      border: none;
      background: #6366f1;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .cart-send-btn:active {
      background: #4f46e5;
    }
    .cart-empty {
      text-align: center;
      padding: 24px 16px;
      color: #94a3b8;
      font-size: 14px;
      font-weight: 500;
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
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-120px);
      background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
      border-radius: 20px;
      padding: 24px 28px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      z-index: 10000;
      min-width: 360px;
      max-width: 90%;
      display: flex;
      align-items: center;
      gap: 18px;
      opacity: 0;
      transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      backdrop-filter: blur(10px);
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    .toast.success {
      border-left: 5px solid #10b981;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.2), 0 0 0 1px rgba(16, 185, 129, 0.1);
    }
    .toast.error {
      border-left: 5px solid #ef4444;
      box-shadow: 0 20px 60px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.1);
    }
    .toast-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toast.success .toast-icon {
      background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
      color: white;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
    }
    .toast.error .toast-icon {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
      color: white;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
    }
    .toast-content {
      flex: 1;
    }
    .toast-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }
    .toast-message {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.5;
      font-weight: 400;
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
    /* Sultan Somatı mobil — tam genişlik beyaz sayfa (yan yeşillik yok) */
    html.sultan-mobile-root {
      background: #ffffff;
      overflow-x: hidden;
      max-width: 100%;
      width: 100%;
      height: 100%;
      overscroll-behavior-x: none;
    }
    body.sultan-mobile {
      background: #ffffff !important;
      padding: 0 !important;
      overflow-x: hidden;
      max-width: 100%;
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      overscroll-behavior-x: none;
      /* Tüm sayfayı yatay sürüklemeyi engelle; dikey kaydırma + pinch */
      touch-action: pan-y pinch-zoom;
      position: relative;
    }
    body.sultan-mobile .container {
      width: 100%;
      max-width: 100%;
      margin: 0;
      border-radius: 0;
      border: none;
      box-shadow: none;
      padding: 12px 14px 20px;
      min-height: 100vh;
      box-sizing: border-box;
      overflow-x: hidden;
    }
    /* Yatay kaydırması kasıtlı alanlar (touch-action body'de pan-y iken açıkça pan-x) */
    body.sultan-mobile .category-tabs {
      touch-action: pan-x pinch-zoom;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
      padding-bottom: 2px;
    }
    body.sultan-mobile .category-tabs::-webkit-scrollbar {
      height: 4px;
    }
    body.sultan-mobile .category-tabs::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    body.sultan-mobile .category-tabs-inner {
      gap: 4px !important;
    }
    body.sultan-mobile .category-tabs-row.category-tabs-row--equal {
      gap: 5px !important;
    }
    body.sultan-mobile #orderSectionCategoryBar {
      padding-top: 2px !important;
      padding-bottom: 4px !important;
      margin-bottom: 4px !important;
    }
    /* Sultan — kurumsal minimal kategori sekmeleri (daha küçük, nötr palet) */
    body.sultan-mobile .category-tab.category-tab--sultan {
      padding: 6px 10px !important;
      min-height: 32px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      letter-spacing: -0.02em !important;
      line-height: 1.2 !important;
      border-radius: 9px !important;
      border: 1px solid #e2e8f0 !important;
      background: #f8fafc !important;
      color: #64748b !important;
      box-shadow: none !important;
      -webkit-tap-highlight-color: transparent;
    }
    body.sultan-mobile .category-tab.category-tab--sultan::before {
      display: none !important;
    }
    body.sultan-mobile .category-tab.category-tab--sultan:hover {
      background: #f1f5f9 !important;
      border-color: #cbd5e1 !important;
      color: #334155 !important;
      transform: none !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05) !important;
    }
    body.sultan-mobile .category-tab.category-tab--sultan.active {
      border-color: #059669 !important;
      color: #064e3b !important;
      background: #ffffff !important;
      box-shadow: 0 0 0 1px rgba(5, 150, 105, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06) !important;
      font-weight: 700 !important;
      transform: none !important;
    }
    body.sultan-mobile .category-tab.category-tab--sultan.active::after {
      height: 2px !important;
      bottom: 0 !important;
      left: 6px !important;
      right: 6px !important;
      border-radius: 2px !important;
      background: linear-gradient(90deg, #34d399, #059669) !important;
      box-shadow: none !important;
    }
    body.sultan-mobile .category-tab.category-tab--sultan:active {
      transform: scale(0.97) !important;
    }
    body.sultan-mobile .sultan-section-scroll {
      touch-action: pan-x pinch-zoom;
    }
    /* Makara Havzan mobil — tam genişlik beyaz (yanlarda pembe gradient taşması yok) */
    html.makara-mobile-root {
      background: #ffffff;
    }
    body.makara-mobile {
      background: #ffffff !important;
      padding: 0 !important;
    }
    body.makara-mobile .container {
      max-width: none;
      width: 100%;
      margin: 0;
      border-radius: 0;
      border: none;
      box-shadow: none;
      padding: 12px 14px 20px;
      min-height: 100vh;
      box-sizing: border-box;
    }
    /* Masa kutuları ~2×: 4 sütun yerine 2 sütun (genişlik ve yükseklik birlikte büyür) */
    body.sultan-mobile .table-grid {
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 10px !important;
    }
    body.sultan-mobile .table-btn .table-number {
      font-size: 22px !important;
    }
    body.sultan-mobile .table-btn.has-order .table-number {
      font-size: 23px !important;
    }
    body.sultan-mobile .sultan-table-total {
      font-size: clamp(0.72rem, 3.5vw, 1.1rem) !important;
      font-weight: 800 !important;
      color: #ecfdf5 !important;
      margin-top: 5px !important;
      line-height: 1.1 !important;
      text-align: center !important;
      width: 100% !important;
      max-width: 100% !important;
      padding: 0 3px !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      font-variant-numeric: tabular-nums !important;
      letter-spacing: -0.03em !important;
    }
    body.sultan-mobile .pin-btn {
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%) !important;
    }
    body.sultan-mobile .category-tab:not(.category-tab--sultan).active {
      border-color: #5eead4 !important;
      color: #047857 !important;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
    }
    body.sultan-mobile .category-tab:not(.category-tab--sultan).active::after {
      background: linear-gradient(90deg, #10b981 0%, #059669 50%, #10b981 100%) !important;
    }
    body.sultan-mobile .category-tab:not(.category-tab--sultan) {
      font-size: 14px !important;
      font-weight: 700 !important;
      padding: 12px 18px !important;
      min-height: 48px !important;
      white-space: nowrap !important;
    }
    body.sultan-mobile .products-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 14px !important;
    }
    body.sultan-mobile .product-card {
      background: #ffffff !important;
      background-image: none !important;
      border: 1.5px solid #e2e8f0 !important;
      border-radius: 18px !important;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.07), 0 1px 4px rgba(15, 23, 42, 0.04) !important;
      min-height: 155px !important;
      padding: 20px 16px 14px !important;
      transition: all 0.18s ease !important;
    }
    body.sultan-mobile .product-card::before {
      display: none !important;
    }
    body.sultan-mobile .product-card:hover {
      border-color: #6ee7b7 !important;
      box-shadow: 0 6px 22px rgba(16, 185, 129, 0.13), 0 2px 8px rgba(15, 23, 42, 0.06) !important;
      transform: translateY(-2px) !important;
    }
    body.sultan-mobile .product-card:active {
      transform: scale(0.97) !important;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08) !important;
    }
    body.sultan-mobile .product-name {
      color: #1e293b !important;
      text-shadow: none !important;
      font-weight: 700 !important;
      font-size: 15px !important;
      line-height: 1.45 !important;
      margin-bottom: 6px !important;
    }
    body.sultan-mobile .product-price {
      color: #059669 !important;
      text-shadow: none !important;
      font-weight: 800 !important;
      font-size: 19px !important;
      letter-spacing: -0.3px !important;
    }
    /* Sultan: masa sipariş ekranı — üst toolbar; Masalara dön / Ürün aktar gizli; yerel mevcut sipariş listesi yok (Siparişler menüde) */
    body.sultan-mobile #orderSectionTopNav {
      display: none !important;
    }
    body.sultan-mobile #existingOrders {
      display: none !important;
    }
    body.sultan-mobile #orderSectionCategoryBar {
      top: calc(58px + env(safe-area-inset-top, 0px) + 6px) !important;
    }
    body.sultan-mobile #sultanOrderToolbar {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 10px;
      position: sticky;
      top: 0;
      z-index: 101;
      margin: -15px -15px 10px -15px;
      padding: 10px 12px 10px;
      padding-top: max(10px, env(safe-area-inset-top, 0px));
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
    }
    body.sultan-mobile #sultanOrderToolbar .sultan-order-toolbar__btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 12px;
      border: none;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.02em;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    body.sultan-mobile #sultanOrderToolbar .sultan-order-toolbar__btn:active {
      transform: scale(0.98);
    }
    body.sultan-mobile #sultanOrderToolbar .sultan-order-toolbar__btn--back {
      background: #f1f5f9;
      color: #0f172a;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
    }
    body.sultan-mobile #sultanOrderToolbar .sultan-order-toolbar__btn--orders {
      background: linear-gradient(135deg, #10b981 0%, #047857 100%);
      color: #fff;
      box-shadow: 0 8px 22px rgba(5, 150, 105, 0.38);
    }
    body.sultan-mobile #sultanOrderToolbar .sultan-order-toolbar__btn svg {
      flex-shrink: 0;
    }
    body.sultan-mobile #productsGridScrollWrap {
      max-height: calc(100vh - 224px);
      max-height: calc(100dvh - 224px);
    }
    body.sultan-mobile .table-btn.selected {
      border-color: #10b981 !important;
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%) !important;
    }
    body.sultan-mobile .table-btn.sultan-table-empty.selected {
      background: #ffffff !important;
      border-color: #10b981 !important;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.35) !important;
    }
    body.sultan-mobile .table-btn.sultan-table-empty.selected .table-number {
      color: #059669 !important;
    }
    body.sultan-mobile .sultan-section-scroll-wrap {
      margin: 0 -12px 4px;
      padding: 0 12px;
    }
    body.sultan-mobile .sultan-section-scroll {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: stretch;
      gap: 12px;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      padding: 6px 4px 14px;
      scrollbar-width: thin;
      scrollbar-color: #94a3af #f1f5f9;
    }
    body.sultan-mobile .sultan-section-scroll::-webkit-scrollbar {
      height: 6px;
    }
    body.sultan-mobile .sultan-section-scroll::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 10px;
    }
    body.sultan-mobile .sultan-section-scroll::-webkit-scrollbar-thumb {
      background: #94a3af;
      border-radius: 10px;
    }
    body.sultan-mobile .sultan-section-tab {
      flex: 0 0 auto;
      scroll-snap-align: start;
      min-width: max-content;
      padding: 16px 22px;
      border-radius: 16px;
      border: 2px solid #e2e8f0;
      background: #fff;
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }
    body.sultan-mobile .sultan-section-tab.active {
      border-color: #10b981;
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
      color: #fff;
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.45);
    }
    body.sultan-mobile .sultan-section-tab .cnt {
      opacity: 1;
      font-size: 13px;
      margin-left: 5px;
      background: rgba(0,0,0,0.07);
      padding: 1px 6px;
      border-radius: 20px;
      letter-spacing: 0;
      color: #64748b;
      font-weight: 700;
    }
    body.sultan-mobile .sultan-section-tab.has-occ:not(.active) .cnt {
      color: #047857;
      font-weight: 800;
      background: rgba(16, 185, 129, 0.12);
    }
    body.sultan-mobile .sultan-section-tab.active .cnt {
      color: #fff;
      font-weight: 800;
      background: rgba(255, 255, 255, 0.28);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
    }
    body.sultan-mobile .table-btn.sultan-table-empty {
      background: #ffffff !important;
      border: 2px solid #e2e8f0 !important;
      box-shadow: none !important;
    }
    body.sultan-mobile .table-btn.sultan-table-empty .table-number {
      font-size: 28px !important;
      font-weight: 800 !important;
      color: #64748b !important;
      margin: 0 !important;
    }
    body.sultan-mobile .table-btn.sultan-table-empty:not(.selected):hover {
      border-color: #cbd5e1 !important;
      background: #fafafa !important;
    }
    body.sultan-mobile .table-btn.sultan-table-reserved {
      background: #fffbeb !important;
      border: 2px solid #fcd34d !important;
      box-shadow: 0 0 0 2px rgba(251,191,36,0.18) !important;
    }
    body.sultan-mobile .table-btn.sultan-table-reserved .table-number {
      color: #92400e !important;
    }
    /* Sultan: normal sipariş ekranında satır içi arama yerine "Ürün ara" butonu */
    #sultanSearchLaunchRow {
      display: none;
    }
    body.sultan-mobile #sultanInlineSearchRow {
      display: none !important;
    }
    body.sultan-mobile #sultanSearchLaunchRow {
      display: block !important;
    }
    /* Makara Havzan: Sultan ile aynı ürün arama akışı (buton + tam ekran) */
    body.makara-mobile #sultanInlineSearchRow {
      display: none !important;
    }
    body.makara-mobile #sultanSearchLaunchRow {
      display: block !important;
    }
    body.makara-mobile .sultan-search-launch-btn {
      background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
      color: #fafafa;
      box-shadow: 0 6px 20px rgba(24, 24, 27, 0.35);
    }
    body.makara-mobile .sultan-immersive-overlay__header {
      background: linear-gradient(180deg, #f4f4f5 0%, #ffffff 100%);
    }
    body.makara-mobile #sultanImmersiveSearchInput {
      border-color: #e4e4e7;
    }
    body.makara-mobile #sultanImmersiveSearchInput:focus {
      border-color: #18181b;
      box-shadow: 0 0 0 4px rgba(24, 24, 27, 0.15);
    }
    body.makara-mobile.sultan-immersive-search-open .cart {
      z-index: 10060 !important;
    }
    body.makara-mobile.sultan-immersive-search-open .sultan-immersive-overlay__body {
      padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    }
    body.makara-mobile #productsGridScrollWrap.sultan-grid-placeholder {
      min-height: 120px;
    }
    .sultan-search-launch-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px 18px;
      border: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 800;
      color: #fff;
      cursor: pointer;
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.35);
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease;
    }
    .sultan-search-launch-btn:active {
      transform: scale(0.98);
    }
    /* Tam ekran odaklı arama (sadece arama + sonuçlar) */
    .sultan-immersive-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10050;
      flex-direction: column;
      background: rgba(248, 250, 252, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sultan-immersive-overlay.sultan-immersive-overlay--open {
      opacity: 1;
      pointer-events: auto;
    }
    .sultan-immersive-overlay__panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: #ffffff;
      border-radius: 0 0 22px 22px;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
      transform: translateY(-100%);
      transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sultan-immersive-overlay.sultan-immersive-overlay--open .sultan-immersive-overlay__panel {
      transform: translateY(0);
    }
    .sultan-immersive-overlay__header {
      flex-shrink: 0;
      padding: calc(10px + env(safe-area-inset-top, 0px)) 14px 12px;
      background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
      border-bottom: 1px solid #e2e8f0;
    }
    .sultan-immersive-overlay__close {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 10px 14px;
      border: none;
      border-radius: 12px;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .sultan-immersive-overlay__close:active {
      background: #e2e8f0;
    }
    .sultan-immersive-overlay__input-wrap {
      position: relative;
    }
    .sultan-immersive-overlay__input-wrap svg {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      color: #64748b;
      pointer-events: none;
    }
    #sultanImmersiveSearchInput {
      width: 100%;
      box-sizing: border-box;
      padding: 16px 16px 16px 52px;
      border: 2px solid #d1fae5;
      border-radius: 16px;
      font-size: 17px;
      font-weight: 600;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #sultanImmersiveSearchInput:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
    }
    .sultan-immersive-overlay__body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 14px 14px calc(24px + env(safe-area-inset-bottom, 0px));
    }
    /* Arama modunda sabit sepet üstte kalsın (kapalı şerit ~56px + pay) */
    body.sultan-immersive-search-open .cart {
      z-index: 10060 !important;
    }
    body.sultan-immersive-search-open .sultan-immersive-overlay__body {
      padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    }
    body.sultan-mobile #productsGridScrollWrap.sultan-grid-placeholder {
      min-height: 120px;
    }
    /* —— Sultan Somatı: baştan tasarlanan tam ekran login + kurumsal splash —— */
    .sultan-login-hero,
    .sultan-login-status,
    .sultan-login-footnote,
    .sultan-input-label,
    .splash-screen__noise,
    .splash-badge {
      display: none;
    }
    html.sultan-mobile-root {
      background: #08111f !important;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth {
      background: #08111f !important;
      background-image:
        radial-gradient(circle at 50% -10%, rgba(45, 212, 191, 0.26) 0%, transparent 38%),
        radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.16) 0%, transparent 34%),
        linear-gradient(180deg, #08111f 0%, #0b1628 34%, #0b1f1a 100%) !important;
      padding: 0 !important;
      min-height: 100dvh;
      min-height: 100svh;
      color: #f8fafc;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth .container {
      background: transparent !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      max-width: none !important;
      width: 100% !important;
      min-height: 100dvh;
      min-height: 100svh;
      border-radius: 0 !important;
      border: none !important;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 100%;
      max-width: none;
      margin: 0;
      min-height: 100dvh;
      min-height: 100svh;
      padding: calc(18px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px));
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section::before {
      display: none;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section::after {
      content: '';
      position: absolute;
      left: -18%;
      right: -18%;
      bottom: -14%;
      height: 42%;
      background: radial-gradient(ellipse at center, rgba(15, 118, 110, 0.18) 0%, transparent 70%);
      pointer-events: none;
      filter: blur(18px);
    }
    html.sultan-mobile-root .sultan-login-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      width: 100%;
      max-width: 460px;
      margin: 0 auto;
      padding-top: clamp(14px, 7vh, 56px);
      z-index: 1;
    }
    html.sultan-mobile-root .sultan-login-hero__glow {
      position: absolute;
      width: 240px;
      height: 240px;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      background: radial-gradient(circle, rgba(45, 212, 191, 0.25) 0%, transparent 68%);
      pointer-events: none;
      filter: blur(4px);
      animation: sultanLoginGlow 4.5s ease-in-out infinite;
    }
    @keyframes sultanLoginGlow {
      0%, 100% { opacity: 0.72; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.08); }
    }
    html.sultan-mobile-root .sultan-login-hero__mark {
      position: relative;
      width: 88px;
      height: 88px;
      border-radius: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ecfeff;
      background:
        linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)),
        linear-gradient(145deg, #14b8a6 0%, #10b981 52%, #047857 100%);
      box-shadow:
        0 20px 48px rgba(16, 185, 129, 0.36),
        0 0 0 1px rgba(255,255,255,0.12) inset,
        0 10px 26px rgba(8, 17, 31, 0.45);
      margin-bottom: 22px;
      animation: sultanLoginMarkIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes sultanLoginMarkIn {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    html.sultan-mobile-root .sultan-login-hero__titles {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    html.sultan-mobile-root .sultan-login-hero__brand {
      font-size: clamp(1.55rem, 5vw, 2rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #f8fafc;
      line-height: 1.08;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    }
    html.sultan-mobile-root .sultan-login-hero__sub {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #99f6e4;
      opacity: 0.95;
    }
    html.sultan-mobile-root .sultan-login-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(153, 246, 228, 0.18);
      background: rgba(15, 23, 42, 0.34);
      color: #d1fae5;
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section > .pin-form-stack {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      margin: auto auto 0;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section h2 {
      font-size: clamp(1.6rem, 5.3vw, 1.95rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #f8fafc;
      margin-bottom: 10px;
      text-align: left;
      line-height: 1.12;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .subtitle {
      color: #cbd5e1;
      font-size: 15px;
      margin-bottom: 26px;
      font-weight: 500;
      text-align: left;
      line-height: 1.5;
      max-width: 30ch;
    }
    html.sultan-mobile-root .sultan-input-label {
      display: block;
      margin-bottom: 10px;
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input-wrapper {
      max-width: none;
      width: 100%;
      margin-bottom: 18px;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input {
      width: 100%;
      border-radius: 20px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.72) 100%);
      padding: 18px 20px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #f8fafc !important;
      -webkit-text-fill-color: #f8fafc !important;
      box-shadow:
        0 10px 24px rgba(2, 8, 23, 0.28),
        0 0 0 1px rgba(255,255,255,0.03) inset;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input::placeholder {
      color: #94a3b8 !important;
      -webkit-text-fill-color: #94a3b8 !important;
      letter-spacing: 0.01em;
      opacity: 1;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input:focus {
      border-color: rgba(94, 234, 212, 0.76);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.82) 100%);
      box-shadow:
        0 0 0 4px rgba(45, 212, 191, 0.18),
        0 14px 34px rgba(15, 23, 42, 0.34);
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input:-webkit-autofill,
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input:-webkit-autofill:hover,
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 50px rgba(15, 23, 42, 0.92) inset;
      box-shadow: 0 0 0 50px rgba(15, 23, 42, 0.92) inset;
      -webkit-text-fill-color: #f8fafc !important;
      caret-color: #f8fafc;
      border-color: rgba(94, 234, 212, 0.28);
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-section__actions {
      width: 100%;
      max-width: none !important;
      margin: 6px 0 24px;
      gap: 12px;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-section__actions label {
      flex: 1;
      min-width: 0;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-section__actions label span {
      color: #e2e8f0 !important;
      font-size: 14px !important;
      font-weight: 600 !important;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section input[type="checkbox"] {
      accent-color: #2dd4bf !important;
      width: 20px !important;
      height: 20px !important;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-section__actions button {
      color: #99f6e4 !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      text-decoration: none !important;
      padding: 0 !important;
      white-space: nowrap;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-btn {
      width: 100%;
      max-width: none;
      border-radius: 20px;
      padding: 18px 24px;
      font-size: 17px;
      font-weight: 800;
      background: linear-gradient(135deg, #2dd4bf 0%, #10b981 42%, #047857 100%);
      color: #f8fffe;
      box-shadow:
        0 18px 38px rgba(5, 150, 105, 0.34),
        0 10px 18px rgba(8, 17, 31, 0.24);
      letter-spacing: 0.02em;
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-btn:hover {
      background: linear-gradient(135deg, #14b8a6 0%, #059669 100%);
    }
    html.sultan-mobile-root body.sultan-mobile.sultan-staff-auth #pinSection.pin-section .pin-error {
      border-radius: 16px;
      border: 1px solid rgba(252, 165, 165, 0.42);
      background: rgba(127, 29, 29, 0.18);
      color: #fee2e2;
      font-size: 14px;
      font-weight: 600;
      margin-top: 16px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    html.sultan-mobile-root .sultan-login-footnote {
      display: block;
      margin-top: 18px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      text-align: left;
      opacity: 0.95;
    }
    html.sultan-mobile-root .splash-screen {
      background: #0c1222;
      background-image:
        radial-gradient(ellipse 100% 70% at 50% 0%, rgba(16, 185, 129, 0.22) 0%, transparent 55%),
        linear-gradient(180deg, #0c1222 0%, #0f172a 50%, #022c22 100%);
    }
    html.sultan-mobile-root .splash-screen__noise {
      display: block;
      position: absolute;
      inset: 0;
      opacity: 0.04;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    html.sultan-mobile-root .splash-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 32px;
      max-width: 420px;
    }
    html.sultan-mobile-root .splash-badge {
      display: inline-block;
      margin-bottom: 20px;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(226, 232, 240, 0.95);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    html.sultan-mobile-root .splash-icon {
      width: 108px;
      height: 108px;
      margin-bottom: 28px;
      background: linear-gradient(145deg, #34d399 0%, #059669 50%, #0d9488 100%);
      box-shadow:
        0 16px 48px rgba(5, 150, 105, 0.45),
        0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    }
    html.sultan-mobile-root .splash-icon::before {
      background: linear-gradient(135deg, #34d399, #10b981);
      opacity: 0.35;
      filter: blur(20px);
    }
    html.sultan-mobile-root .splash-title {
      color: #f1f5f9;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
    }
    html.sultan-mobile-root .splash-name {
      color: #94a3b8;
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 40px;
    }
    html.sultan-mobile-root .splash-loader {
      height: 4px;
      background: rgba(148, 163, 184, 0.2);
      border-radius: 999px;
      max-width: 280px;
    }
    html.sultan-mobile-root .splash-loader-bar {
      background: linear-gradient(90deg, #059669 0%, #34d399 50%, #059669 100%);
      background-size: 200% 100%;
      box-shadow: 0 0 20px rgba(52, 211, 153, 0.5);
    }

    /* ===========================
       APP HEADER
       =========================== */
    #appHeader {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 58px;
      z-index: 9500;
      display: none;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px 0 16px;
      padding-top: env(safe-area-inset-top, 0px);
      background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
      box-shadow: 0 2px 16px rgba(0,0,0,0.18);
    }
    body.sultan-mobile #appHeader {
      background: linear-gradient(135deg, #064e3b 0%, #059669 100%);
      max-width: 100%;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    body.makara-mobile #appHeader {
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    }
    #appHeader.visible { display: flex; }
    .app-header__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .app-header__icon {
      width: 32px;
      height: 32px;
      background: rgba(255,255,255,0.18);
      border: 1.5px solid rgba(255,255,255,0.25);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .app-header__texts { min-width: 0; }
    .app-header__title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.2px;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .app-header__sub {
      font-size: 10px;
      color: rgba(255,255,255,0.65);
      font-weight: 500;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      line-height: 1;
    }
    .app-header__hamburger {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.12);
      border: 1.5px solid rgba(255,255,255,0.22);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4.5px;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .app-header__hamburger:hover,
    .app-header__hamburger:active { background: rgba(255,255,255,0.22); }
    .app-header__hamburger span {
      display: block;
      width: 17px;
      height: 2px;
      background: #fff;
      border-radius: 2px;
    }

    /* ===========================
       DRAWER
       =========================== */
    #drawerOverlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 10500;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.28s;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    #drawerOverlay.open { opacity: 1; pointer-events: all; }
    #drawerPanel {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 290px;
      max-width: 88vw;
      z-index: 10501;
      background: #fff;
      transform: translateX(105%);
      transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: -8px 0 48px rgba(0,0,0,0.2);
      border-radius: 22px 0 0 22px;
    }
    #drawerPanel.open { transform: translateX(0); }
    .drawer-head {
      padding: max(20px, env(safe-area-inset-top, 20px)) 20px 22px;
      background: linear-gradient(145deg, #7c3aed 0%, #ec4899 100%);
      position: relative;
      flex-shrink: 0;
    }
    body.sultan-mobile .drawer-head {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid #e2e8f0;
      padding: max(14px, env(safe-area-inset-top, 14px)) 52px 14px 16px;
      display: grid;
      grid-template-columns: 42px 1fr;
      grid-template-rows: auto auto;
      align-items: center;
      column-gap: 12px;
      row-gap: 2px;
    }
    body.sultan-mobile .drawer-head .drawer-close-btn {
      color: #64748b;
      background: rgba(148, 163, 184, 0.12);
      top: max(12px, calc(env(safe-area-inset-top, 0px) + 10px));
      right: 12px;
    }
    body.sultan-mobile .drawer-head .drawer-close-btn:hover { background: rgba(148, 163, 184, 0.2); }
    body.sultan-mobile .drawer-avatar {
      grid-row: 1 / span 2;
      grid-column: 1;
      width: 42px;
      height: 42px;
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.5px;
      border-radius: 12px;
      border: 1px solid #d1fae5;
      background: #ecfdf5;
      color: #047857;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    body.sultan-mobile .drawer-staff-name {
      grid-column: 2;
      grid-row: 1;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    body.sultan-mobile .drawer-staff-role {
      grid-column: 2;
      grid-row: 2;
      margin: 0;
      align-self: start;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      background: transparent;
      padding: 0;
      border-radius: 0;
    }
    body.makara-mobile .drawer-head { background: linear-gradient(145deg, #7c3aed 0%, #a855f7 100%); }
    .drawer-close-btn {
      position: absolute;
      top: max(14px, calc(env(safe-area-inset-top, 0px) + 14px));
      right: 14px;
      width: 30px; height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.18);
      border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
      color: white;
    }
    .drawer-close-btn:hover { background: rgba(255,255,255,0.28); }
    .drawer-avatar {
      width: 58px; height: 58px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      border: 2.5px solid rgba(255,255,255,0.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 800;
      color: #fff; letter-spacing: -1px;
      margin-bottom: 10px; margin-top: 6px;
      flex-shrink: 0;
    }
    .drawer-staff-name {
      font-size: 16px; font-weight: 700; color: #fff;
      margin-bottom: 3px; line-height: 1.2;
    }
    .drawer-staff-role {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: rgba(255,255,255,0.75);
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.9px;
      background: rgba(255,255,255,0.15);
      padding: 3px 8px; border-radius: 20px;
    }
    .drawer-menu {
      flex: 1; overflow-y: auto; padding: 10px 0 0;
      -webkit-overflow-scrolling: touch;
    }
    .drawer-section-label {
      padding: 10px 20px 4px;
      font-size: 10px; font-weight: 700; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 1.2px;
    }
    .drawer-item {
      display: flex; align-items: center; gap: 14px;
      padding: 13px 20px;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
      border: none; background: none; width: 100%;
      text-align: left; font-size: 15px; font-weight: 600; color: #1f2937;
      -webkit-tap-highlight-color: transparent;
    }
    .drawer-item:hover { background: #f9fafb; }
    .drawer-item:active { background: #f3f4f6; transform: scale(0.99); }
    .drawer-item__icon {
      width: 38px; height: 38px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .drawer-item__icon svg { width: 19px; height: 19px; }
    .drawer-item__label { flex: 1; }
    .drawer-divider { height: 1px; background: #f3f4f6; margin: 5px 20px; }
    .drawer-footer {
      padding: 10px 16px;
      padding-bottom: max(14px, env(safe-area-inset-bottom, 14px));
      border-top: 1px solid #f3f4f6;
      flex-shrink: 0;
    }
    .drawer-logout-item {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; cursor: pointer; transition: background 0.15s;
      border: 1.5px solid #fee2e2; background: #fff5f5;
      width: 100%; text-align: left;
      font-size: 14px; font-weight: 600; color: #ef4444;
      border-radius: 13px; -webkit-tap-highlight-color: transparent;
    }
    .drawer-logout-item:hover { background: #fee2e2; }
  </style>
</head>
<body>
${isSultanMobileTpl ? `<script>(function(){document.documentElement.classList.add('sultan-mobile-root');document.body.classList.add('sultan-mobile','sultan-staff-auth');})();<\/script>` : isMakaraHavzanMobileTpl ? `<script>(function(){document.documentElement.classList.add('makara-mobile-root');document.body.classList.add('makara-mobile');})();<\/script>` : ''}

  <!-- App Header: Giriş sonrası sabit üst bar -->
  <div id="appHeader">
    <div class="app-header__brand">
      <div class="app-header__icon" aria-hidden="true">
        <svg width="15" height="15" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/>
        </svg>
      </div>
      <div class="app-header__texts">
        <div class="app-header__title" id="appHeaderTitle">${isSultanMobileTpl ? 'Sultan Somatı' : isMakaraHavzanMobileTpl ? 'Makara' : 'Mobil'} Mobil Personel</div>
        <div class="app-header__sub">Sipariş Sistemi</div>
      </div>
    </div>
    <button class="app-header__hamburger" onclick="openDrawer()" aria-label="Menü aç">
      <span></span><span></span><span></span>
    </button>
  </div>

  <!-- Drawer Overlay -->
  <div id="drawerOverlay" onclick="closeDrawer()"></div>

  <!-- Drawer Panel -->
  <div id="drawerPanel" role="dialog" aria-modal="true" aria-label="Menü">
    <div class="drawer-head">
      <button class="drawer-close-btn" onclick="closeDrawer()" aria-label="Menüyü kapat">
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      <div class="drawer-avatar" id="drawerAvatar">?</div>
      <div class="drawer-staff-name" id="drawerStaffName">—</div>
      <div class="drawer-staff-role" id="drawerStaffRole">Personel</div>
    </div>
    <div class="drawer-menu">
      <div class="drawer-section-label">Hesap</div>
      <button class="drawer-item" onclick="closeDrawer(); setTimeout(showChangePasswordModal, 280);">
        <span class="drawer-item__icon" style="background:#ede9fe;">
          <svg fill="none" stroke="#7c3aed" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
          </svg>
        </span>
        <span class="drawer-item__label">Şifre Değiştir</span>
      </button>
      <button class="drawer-item" id="drawerManagerOpsBtn" style="display:none;" onclick="closeDrawer(); setTimeout(showManagerOpsPasswordModal, 280);">
        <span class="drawer-item__icon" style="background:#fef3c7;">
          <svg fill="none" stroke="#b45309" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </span>
        <span class="drawer-item__label">Masaüstü müdür şifresi</span>
      </button>
      <div class="drawer-divider"></div>
      <div class="drawer-section-label">İşlemler</div>
      <button class="drawer-item" onclick="closeDrawer(); setTimeout(refreshAllData, 280);">
        <span class="drawer-item__icon" style="background:#e0f2fe;">
          <svg fill="none" stroke="#0284c7" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </span>
        <span class="drawer-item__label">Yenile</span>
      </button>
      <button type="button" class="drawer-item" id="drawerTableTransferBtn" onclick="closeDrawer(); setTimeout(showTransferModal, 280);">
        <span class="drawer-item__icon" style="background:#e0e7ff;">
          <svg fill="none" stroke="#4f46e5" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
        </span>
        <span class="drawer-item__label">Masa Aktar</span>
      </button>
      <button class="drawer-item" id="drawerMergeBtn" style="display:none;" onclick="closeDrawer(); setTimeout(showMergeModal, 280);">
        <span class="drawer-item__icon" style="background:#d1fae5;">
          <svg fill="none" stroke="#059669" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </span>
        <span class="drawer-item__label">Masa Birleştir</span>
      </button>
      <button class="drawer-item" id="drawerAllOrdersBtn" style="display:none;" onclick="closeDrawer(); setTimeout(openSultanAllOrdersSheet, 280);">
        <span class="drawer-item__icon" style="background:#ecfdf5;">
          <svg fill="none" stroke="#047857" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        </span>
        <span class="drawer-item__label">Siparişler</span>
      </button>
      <button class="drawer-item" id="drawerReservationBtn" style="display:none;" onclick="closeDrawer(); setTimeout(openReservationFormSheet, 280);">
        <span class="drawer-item__icon" style="background:#fef3c7;">
          <svg fill="none" stroke="#d97706" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </span>
        <span class="drawer-item__label">Rezervasyon</span>
      </button>
      <button class="drawer-item" id="drawerReservationListBtn" style="display:none;" onclick="closeDrawer(); setTimeout(openReservationListSheet, 280);">
        <span class="drawer-item__icon" style="background:#fef9c3;">
          <svg fill="none" stroke="#ca8a04" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
        </span>
        <span class="drawer-item__label">Mevcut Rezervasyonlar</span>
        <span id="drawerReservationCount" style="background:#fbbf24;color:#78350f;font-size:11px;font-weight:800;padding:2px 7px;border-radius:20px;margin-left:auto;"></span>
      </button>
      <button class="drawer-item" id="drawerSalesHistoryBtn" style="display:none;" onclick="closeDrawer(); setTimeout(openSultanSalesHistorySheet, 280);">
        <span class="drawer-item__icon" style="background:#ecfdf5;">
          <svg fill="none" stroke="#047857" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </span>
        <span class="drawer-item__label">Satışlar</span>
      </button>
      <button type="button" class="drawer-item" id="drawerMakaraCancellationsBtn" style="display:none;" onclick="closeDrawer(); setTimeout(openMakaraRecentCancellationsSheet, 280);">
        <span class="drawer-item__icon" style="background:#fef2f2;">
          <svg fill="none" stroke="#dc2626" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </span>
        <span class="drawer-item__label">İptaller (24 saat)</span>
      </button>
    </div>
    <div class="drawer-footer">
      <button class="drawer-logout-item" onclick="closeDrawer(); setTimeout(showLogoutModal, 280);">
        <span class="drawer-item__icon" style="background:#fee2e2; border-radius:11px; width:38px; height:38px; flex-shrink:0;">
          <svg width="19" height="19" fill="none" stroke="#ef4444" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </span>
        Çıkış Yap
      </button>
    </div>
  </div>

  <div class="container">
    <!-- PIN Giriş Ekranı - Kurumsal ve Profesyonel -->
    <div id="pinSection" class="pin-section">
      ${isSultanMobileTpl ? `<div class="sultan-login-hero" aria-hidden="true">
        <div class="sultan-login-hero__glow"></div>
        <div class="sultan-login-hero__mark">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
            <path d="M8.5 12.5l2.2 2.2L15.5 9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="sultan-login-hero__titles">
          <span class="sultan-login-hero__brand">Sultan Somatı</span>
          <span class="sultan-login-hero__sub">Mobil personel</span>
        </div>
        <div class="sultan-login-status">
          <span>Güvenli kurumsal erişim</span>
        </div>
      </div>` : ''}
      ${isSultanMobileTpl ? '' : `<img src="${serverURL}/assets/login.png" alt="Login" class="login-image" onerror="this.style.display='none';">`}
      <div class="pin-form-stack">
        <h2>Personel Girişi</h2>
        <p class="subtitle">Hesabınıza erişmek için personel şifrenizi girin.</p>
        <label class="sultan-input-label" for="pinInput">Personel şifresi</label>
        <div class="pin-input-wrapper">
          <input type="password" id="pinInput" class="pin-input" placeholder="Şifrenizi giriniz" maxlength="20" autocomplete="off" onkeypress="if(event.key === 'Enter') verifyStaffPin()">
        </div>

        <!-- Beni Hatırla ve Şifre Değiştir -->
        <div class="pin-section__actions" style="display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 300px; margin: 15px auto 20px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: #666;">
            <input type="checkbox" id="rememberMe" style="width: 18px; height: 18px; cursor: pointer; accent-color: #8b5cf6;">
            <span>Beni Hatırla</span>
          </label>
          <button type="button" onclick="showChangePasswordModal()" style="background: none; border: none; color: #8b5cf6; font-size: 14px; cursor: pointer; text-decoration: underline; padding: 0;">
            Şifre Değiştir
          </button>
        </div>

        <button onclick="verifyStaffPin()" class="pin-btn">Giriş Yap</button>
        <p id="pinError" class="pin-error"></p>
        <p class="sultan-login-footnote">Bu ekran yalnızca Sultan Somatı mobil personel kullanımı icindir.</p>
      </div>
    </div>
    
    <!-- Şifre Değiştir Modal -->
    <div id="changePasswordModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 20px; font-size: 20px; font-weight: bold; color: #333;">Şifre Değiştir</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Mevcut Şifre</label>
          <input type="password" id="currentPassword" placeholder="Mevcut şifrenizi giriniz" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Yeni Şifre</label>
          <input type="password" id="newPassword" placeholder="Yeni şifrenizi giriniz" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Yeni Şifre (Tekrar)</label>
          <input type="password" id="confirmPassword" placeholder="Yeni şifrenizi tekrar giriniz" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;" onkeypress="if(event.key === 'Enter') changeStaffPassword()">
        </div>
        <p id="changePasswordError" style="color: #ef4444; font-size: 13px; margin: 0 0 15px; display: none;"></p>
        <div style="display: flex; gap: 10px;">
          <button onclick="changeStaffPassword()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            Değiştir
          </button>
          <button onclick="closeChangePasswordModal()" style="flex: 1; padding: 12px; background: #f3f4f6; color: #666; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            İptal
          </button>
        </div>
      </div>
    </div>

    <div id="managerOpsPasswordModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; align-items: center; justify-content: center; padding: 20px;">
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 12px; font-size: 20px; font-weight: bold; color: #333;">Masaüstü müdür işlem şifresi</h3>
        <p style="margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.45;">Bu şifre, bilgisayardaki personel listesinde müdür atama ve kaldırma için kullanılır.</p>
        <div id="managerOpsCurrentRow" style="margin-bottom: 15px; display: none;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Mevcut masaüstü şifresi</label>
          <input type="password" id="managerOpsCurrentPassword" placeholder="Kayıtlı şifre" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Personel giriş şifreniz</label>
          <input type="password" id="managerOpsStaffPassword" placeholder="Doğrulama için" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Yeni masaüstü şifresi</label>
          <input type="password" id="managerOpsNewPassword" placeholder="En az 4 karakter" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #555;">Yeni şifre (tekrar)</label>
          <input type="password" id="managerOpsNewPassword2" placeholder="Tekrar" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; box-sizing: border-box;" onkeypress="if(event.key === 'Enter') submitManagerOpsPassword()">
        </div>
        <p id="managerOpsPasswordError" style="color: #ef4444; font-size: 13px; margin: 0 0 15px; display: none;"></p>
        <div style="display: flex; gap: 10px;">
          <button type="button" onclick="submitManagerOpsPassword()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">Kaydet</button>
          <button type="button" onclick="closeManagerOpsPasswordModal()" style="flex: 1; padding: 12px; background: #f3f4f6; color: #666; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">İptal</button>
        </div>
      </div>
    </div>
    
    <!-- Splash Screen - Giriş Sonrası Hoş Geldiniz -->
    <div id="splashScreen" class="splash-screen" style="display: none;">
      <div class="splash-screen__noise" aria-hidden="true"></div>
      <div class="splash-content">
        <div class="splash-badge" aria-hidden="true">Sultan Somatı</div>
        <div class="splash-icon">
          <svg width="48" height="48" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="splash-title">İyi çalışmalar dileriz</h1>
        <p class="splash-name" id="splashStaffName"></p>
        <div class="splash-loader">
          <div class="splash-loader-bar"></div>
        </div>
      </div>
    </div>
    
    <!-- Ana Sipariş Ekranı -->
    <div id="mainSection" style="display: none; padding-top: 68px;">
      <!-- Eski logout butonu gizli tutulur - çıkış artık drawer menüde -->
      <button class="logout-btn" id="mainLogoutBtn" onclick="showLogoutModal()" title="Çıkış Yap" style="display: none !important;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Çıkış Yap</span>
      </button>
      
      <!-- Masa Tipi Seçim Ekranı (gizli - tek ekran masalar kullanılıyor) -->
      <div id="tableTypeSelection" style="display: none;">
      </div>
      
      <div id="tableSelection" style="display: block;">
        <!-- Eski buton satırı kaldırıldı - tüm işlemler drawer menüde -->
        <button id="refreshDataBtn" onclick="refreshAllData()" style="display:none;"></button>
        <button id="mergeTableBtn" class="merge-table-btn" onclick="showMergeModal()" style="display:none;"></button>
        
        <!-- İç/Dış Tab'leri (Gizli - sadece geri dönüş için) -->
        <div class="table-type-tabs" style="display: none;">
          <button class="table-type-tab active" data-type="inside" onclick="selectTableType('inside')">🏠 İç</button>
          <button class="table-type-tab" data-type="outside" onclick="selectTableType('outside')">🌳 Dış</button>
        </div>
        
        <div id="sultanSectionBar" style="display: none; margin-bottom: 14px;"></div>
        <!-- Masa Grid -->
        <div class="table-grid" id="tablesGrid"></div>
      </div>
      
      <div id="orderSection" style="display: none;">
        <!-- Sultan Somatı: masadayken geri + Siparişler (drawer ile aynı sheet) -->
        <div id="sultanOrderToolbar" style="display: none;" aria-label="Masa üstü gezinme">
          <button type="button" class="sultan-order-toolbar__btn sultan-order-toolbar__btn--back" onclick="goBackToTables()">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.3" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            <span>Geri dön</span>
          </button>
          <button type="button" class="sultan-order-toolbar__btn sultan-order-toolbar__btn--orders" onclick="openSultanAllOrdersFromCurrentTable()">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            <span>Mevcut siparişler</span>
          </button>
        </div>
        <!-- En Üst: Geri Dön + Ürün Aktar (Makara vb.); Sultan mobilde gizlenir — masaya dönüş cihaz geri tuşu / mantık -->
        <div id="orderSectionTopNav" style="position: sticky; top: 0; z-index: 100; background: white; padding: 6px 12px 8px 12px; margin: -15px -15px 0 -15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 0 0 20px 20px; scroll-margin-top: 58px;">
          <button type="button" class="back-btn" id="orderSectionBackToTablesBtn" onclick="goBackToTables()" style="position: relative; top: 0; left: 0; margin-bottom: 6px; width: 100%; max-width: none; animation: none;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            <span>Masalara Dön</span>
          </button>
          <!-- Ürün Aktar Butonu (Sadece Müdür) -->
          <button onclick="showTransferItemsModal()" id="orderSectionTransferItemsBtn" style="display: none; width: 100%; padding: 12px 16px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.3s; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(139, 92, 246, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(139, 92, 246, 0.3)'">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" style="display: inline-block; vertical-align: middle;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            <span>Ürün Aktar</span>
          </button>
        </div>
        
        <!-- Kategoriler ve Arama -->
        <div id="orderSectionCategoryBar" style="position: sticky; top: 46px; z-index: 99; background: white; padding: 4px 0 6px 0; margin: 0 -15px 6px -15px; padding-left: 15px; padding-right: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 0 0 20px 20px;">
          <!-- Kategoriler: 3 satır, satırlara mümkün olduğunca eşit sayıda -->
          <div style="margin-bottom: 6px;">
            <div class="category-tabs" id="categoryTabs">
              <div class="category-tabs-inner">
                <div class="category-tabs-row category-tabs-row--equal" id="categoryTabsRow1"></div>
                <div class="category-tabs-row category-tabs-row--equal" id="categoryTabsRow2"></div>
                <div class="category-tabs-row category-tabs-row--equal" id="categoryTabsRow3"></div>
              </div>
            </div>
          </div>
          
          <!-- Arama: Makara satır içi; Sultan Somatı tam ekran mod (buton) -->
          <div id="sultanInlineSearchRow" style="position: relative; margin-bottom: 0;">
            <input type="text" id="searchInput" class="search-box" placeholder="🔍 Ürün ara..." oninput="filterProducts()" style="padding: 14px 16px 14px 48px; border: 2px solid #e5e7eb; border-radius: 14px; font-size: 15px; background: #f9fafb; transition: all 0.3s;">
            <div style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>
          <div id="sultanSearchLaunchRow" style="margin-bottom: 0;">
            <button type="button" class="sultan-search-launch-btn" id="sultanOpenImmersiveSearchBtn" aria-label="Ürün ara">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <span>Ürün ara</span>
            </button>
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
        <div id="productsGridScrollWrap" style="overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; max-height: calc(100vh - 320px); padding-bottom: 100px; padding-right: 5px;">
          <div class="products-grid" id="productsGrid"></div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Sultan Somatı: tam ekran ürün arama (yalnızca arama + sonuçlar) -->
  <div id="sultanImmersiveSearchOverlay" class="sultan-immersive-overlay" style="display: none;" aria-hidden="true">
    <div class="sultan-immersive-overlay__panel">
      <div class="sultan-immersive-overlay__header">
        <button type="button" class="sultan-immersive-overlay__close" id="sultanImmersiveSearchCloseBtn">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
          </svg>
          Geri
        </button>
        <div class="sultan-immersive-overlay__input-wrap">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="search" id="sultanImmersiveSearchInput" autocomplete="off" enterkeyhint="search" placeholder="Ürün adı yazın…" />
        </div>
      </div>
      <div class="sultan-immersive-overlay__body" id="sultanImmersiveProductsMount"></div>
    </div>
  </div>
  
  <div class="cart" id="cart">
    <div class="cart-header" onclick="toggleCart()">
      <div class="cart-header-left">
        <span class="cart-header-badge" id="cartItemCount">0 ürün</span>
        <span class="cart-header-total"><span id="cartTotal">0.00</span> <span class="currency">₺</span></span>
      </div>
      <div class="cart-header-icon" id="cartToggleIcon">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
        </svg>
      </div>
    </div>
    <div class="cart-content">
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-actions">
        <button type="button" class="cart-note-btn" onclick="showNoteModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
          <span id="noteButtonText">Not</span>
        </button>
        <button type="button" class="cart-ikram-btn" onclick="showGiftMarkModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"/></svg>
          <span>İkram işaretle</span>
        </button>
        <button type="button" id="sendOrderBtn" class="cart-send-btn" onclick="sendOrder()">
          <span id="sendOrderBtnContent" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
            </svg>
            Gönder
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
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Hızlı notlar</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <button type="button" onclick="appendQuickNote('Çay tatlıyla birlikte')" style="padding: 8px 14px; background: #f3e8ff; color: #7c3aed; border: 1px solid #c4b5fd; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Çay tatlıyla birlikte</button>
          <button type="button" onclick="appendQuickNote('Soğuk su')" style="padding: 8px 14px; background: #f3e8ff; color: #7c3aed; border: 1px solid #c4b5fd; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Soğuk su</button>
          <button type="button" onclick="appendQuickNote('Dışardan su')" style="padding: 8px 14px; background: #f3e8ff; color: #7c3aed; border: 1px solid #c4b5fd; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Dışardan su</button>
        </div>
        <textarea id="noteInput" placeholder="Sipariş notu yazın veya yukarıdan seçin..." style="width: 100%; min-height: 100px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; outline: none;" onfocus="this.style.borderColor='#a855f7';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
        <button onclick="hideNoteModal()" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
        <button onclick="saveNote()" style="padding: 12px 24px; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(168, 85, 247, 0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(168, 85, 247, 0.3)';">Kaydet</button>
      </div>
    </div>
  </div>
  
  <!-- Sultan Somatı: not hedefi (genel / ürün satırları) — kategori fişinde ürün altında -->
  <div id="noteModalSultan" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target === this) hideNoteModalSultan()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 420px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; padding: 18px 20px; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 800;">Sipariş notu</h2>
          <button type="button" onclick="hideNoteModalSultan()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 22px; font-weight: bold; line-height: 1;">×</button>
        </div>
        <p style="margin: 10px 0 0; font-size: 13px; opacity: 0.95; line-height: 1.45;">Notun nerede görüneceğini seçin: <strong>genel sipariş notu</strong> veya <strong>sepetteki ürün satırları</strong> (mutfak fişinde ilgili ürünün altında).</p>
      </div>
      <div style="padding: 16px 18px; overflow-y: auto; flex: 1; min-height: 0;">
        <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Hedef</p>
        <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:2px solid #d1fae5;border-radius:14px;margin-bottom:12px;cursor:pointer;background:#ecfdf5;">
          <input type="checkbox" id="sultanNoteGeneral" style="width:20px;height:20px;margin-top:2px;flex-shrink:0;accent-color:#059669;" />
          <span style="font-size:14px;font-weight:700;color:#065f46;line-height:1.35;">Genel not<br/><span style="font-size:12px;font-weight:600;color:#047857;">Tüm siparişe (fişte sipariş notu bölümü)</span></span>
        </label>
        <div id="sultanNoteLineList"></div>
        <p style="margin: 16px 0 8px; font-size: 12px; font-weight: 700; color: #64748b;">Hızlı notlar</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <button type="button" onclick="appendQuickNoteSultan('Çay tatlıyla birlikte')" style="padding: 8px 12px; background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Çay tatlıyla</button>
          <button type="button" onclick="appendQuickNoteSultan('Soğuk su')" style="padding: 8px 12px; background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Soğuk su</button>
          <button type="button" onclick="appendQuickNoteSultan('Acele')" style="padding: 8px 12px; background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Acele</button>
        </div>
        <textarea id="noteInputSultan" placeholder="Notunuzu yazın… Boş bırakıp kaydederseniz seçili hedeflerdeki not silinir." style="width: 100%; min-height: 96px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; outline: none;" onfocus="this.style.borderColor='#059669';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 14px 18px; display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0; background: #fafafa;">
        <button type="button" onclick="hideNoteModalSultan()" style="padding: 12px 20px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">İptal</button>
        <button type="button" onclick="saveNoteSultan()" style="padding: 12px 22px; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.35);">Kaydet</button>
      </div>
    </div>
  </div>
  
  <!-- Sepette ikram işaretle -->
  <div id="giftMarkModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10200; align-items: center; justify-content: center; padding: 20px; flex-direction: row;" onclick="if(event.target === this) hideGiftMarkModal()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 420px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.35); max-height: 85vh;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 800;">İkram işaretle</h2>
          <button type="button" onclick="hideGiftMarkModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; font-size: 22px; font-weight: bold; line-height: 1;">×</button>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 13px; opacity: 0.95; line-height: 1.45;">Her satır için kaç adedin ikram olacağını yazın; tümünü ikramlamak zorunda değilsiniz. 0 bıraktığınız satırlar değişmez. Tekrar açıp ek ikram verebilirsiniz.</p>
      </div>
      <div id="giftMarkListScroll" style="padding: 16px; overflow-y: auto; flex: 1; min-height: 0;">
        <div id="giftMarkList"></div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 14px 16px; display: flex; gap: 10px; justify-content: flex-end; background: #fafafa;">
        <button type="button" onclick="hideGiftMarkModal()" style="padding: 12px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer;">Vazgeç</button>
        <button type="button" onclick="applyGiftMarks()" style="padding: 12px 20px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">Uygula</button>
      </div>
    </div>
  </div>
  
  <!-- Ürün İptal Modal -->
  <div id="cancelItemModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2900; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) hideCancelItemModal()">
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
          <div style="display: flex; align-items: center; gap: 12px; max-width: 280px; margin: 0 auto;">
            <button type="button" onclick="changeCancelQuantity(-1)" style="flex: 0 0 52px; height: 52px; border: 2px solid #e5e7eb; border-radius: 14px; background: #f9fafb; font-size: 24px; font-weight: 800; color: #374151; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; -webkit-tap-highlight-color: transparent;" onmouseover="this.style.background='#ef4444'; this.style.borderColor='#ef4444'; this.style.color='white';" onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#e5e7eb'; this.style.color='#374151';" ontouchstart="this.style.transform='scale(0.95)';" ontouchend="this.style.transform='scale(1)';">−</button>
            <input type="number" id="cancelItemQuantity" min="1" max="1" value="1" step="1" style="flex: 1; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 22px; font-weight: 800; text-align: center; outline: none; transition: all 0.3s; appearance: textfield; -moz-appearance: textfield;" onfocus="this.style.borderColor='#ef4444';" onblur="this.style.borderColor='#e5e7eb'; validateCancelQuantity();" oninput="validateCancelQuantity()" onkeydown="if(event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') event.preventDefault();">
            <button type="button" onclick="changeCancelQuantity(1)" style="flex: 0 0 52px; height: 52px; border: 2px solid #e5e7eb; border-radius: 14px; background: #f9fafb; font-size: 24px; font-weight: 800; color: #374151; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; -webkit-tap-highlight-color: transparent;" onmouseover="this.style.background='#22c55e'; this.style.borderColor='#22c55e'; this.style.color='white';" onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#e5e7eb'; this.style.color='#374151';" ontouchstart="this.style.transform='scale(0.95)';" ontouchend="this.style.transform='scale(1)';">+</button>
          </div>
        </div>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 600; line-height: 1.6;">
            ⚠️ İptal fişi: önce kategori yazıcısı, yoksa kasa veya varsayılan yazıcı kullanılır. Kategori yazıcısı atanmamış olsa bile iptal yapılabilir.
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
  <div id="turkishCoffeeModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10100; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) hideTurkishCoffeeModal()">
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
  <div id="cancelReasonModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2910; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);" onclick="if(event.target === this) return;">
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
      <div style="border-top: 1px solid #e5e7eb; padding: 20px; display: flex; justify-content: space-between; gap: 12px; background: #f9fafb;">
        <button onclick="hideCancelReasonModalAndReturnToTables()" style="padding: 14px 28px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Geri Dön</button>
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
  
  <!-- Ürün Aktar Modal (Sadece Müdür) -->
  <div id="transferItemsModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target === this) hideTransferItemsModal()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;" id="transferItemsModalTitle">Ürün Aktar - Adım 1</h2>
          <button onclick="hideTransferItemsModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">×</button>
        </div>
        <p id="transferItemsModalSubtitle" style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Kaynak masayı seçin</p>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px;" id="transferItemsModalContent">
        <!-- İçerik dinamik olarak doldurulacak -->
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: space-between; gap: 12px;">
        <button onclick="handleTransferItemsBack()" id="transferItemsBackBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: none;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Geri</button>
        <button onclick="handleTransferItemsConfirm()" id="transferItemsConfirmBtn" style="padding: 12px 24px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; flex: 1; display: none;" onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">Devam</button>
        <button onclick="hideTransferItemsModal()" id="transferItemsCancelBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
      </div>
    </div>
  </div>
  
  <!-- Masa Birleştir Modal (Sadece Müdür) -->
  <div id="mergeModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target === this) hideMergeModal()">
    <div style="background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;" id="mergeModalTitle">Masa Birleştir - Adım 1</h2>
          <button onclick="hideMergeModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">×</button>
        </div>
        <p id="mergeModalSubtitle" style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Kaynak masayı seçin</p>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <p id="mergeModalDescription" style="color: #6b7280; margin-bottom: 16px; font-weight: 600; font-size: 14px;"></p>
        <div id="mergeTablesGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;"></div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: space-between; gap: 12px;">
        <button onclick="handleMergeBack()" id="mergeBackBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: none;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Geri</button>
        <button onclick="handleMergeConfirm()" id="mergeConfirmBtn" style="padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s; flex: 1; display: none;" onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">Birleştir</button>
        <button onclick="hideMergeModal()" id="mergeCancelBtn" style="padding: 12px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">İptal</button>
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
  
  <!-- Sultan Somatı — masa kartı ⋮ (ödeme: tüm personel; adisyon: müdür) -->
  <div id="sultanManagerSheet" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 2600; align-items: flex-end; justify-content: center;" onclick="if(event.target === this) closeSultanManagerSheet()">
    <div style="background: #fff; width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 10px 20px 22px; box-shadow: 0 -12px 40px rgba(0,0,0,0.18);">
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="width: 44px; height: 5px; background: #e2e8f0; border-radius: 3px; margin: 0 auto 14px;"></div>
        <h3 id="sultanMgrTitle" style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">Masa</h3>
        <p id="sultanMgrSubtitle" style="margin: 8px 0 0; font-size: 15px; font-weight: 600; color: #64748b;"></p>
      </div>
      <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;margin-bottom:14px;border:1.5px solid #e2e8f0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
          <label for="sultanMgrDiscountInput" style="font-size:14px;font-weight:700;color:#374151;white-space:nowrap;">İndirim (₺)</label>
          <input type="number" id="sultanMgrDiscountInput" min="0" step="0.01" placeholder="0.00" oninput="updateSultanMgrDiscount()" style="flex:1;border:1.5px solid #d1d5db;border-radius:10px;padding:8px 12px;font-size:16px;font-weight:700;color:#1e293b;text-align:right;outline:none;max-width:140px;box-sizing:border-box;">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:#94a3b8;font-weight:600;">Ödenecek Tutar</span>
          <span id="sultanMgrPayableAmount" style="font-size:19px;font-weight:900;color:#059669;">—</span>
        </div>
      </div>
      <button type="button" onclick="sultanManagerOpenPayment()" style="width: 100%; padding: 16px; margin-bottom: 10px; border-radius: 14px; border: none; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; font-size: 16px; font-weight: 800; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);">Ödeme al</button>
      <button type="button" onclick="openSultanMgrTransferSheet()" style="width: 100%; padding: 16px; margin-bottom: 10px; border-radius: 14px; border: 2px solid #e2e8f0; background: #fff; color: #1e40af; font-size: 16px; font-weight: 700;">Masa aktar</button>
      <button type="button" id="sultanMgrPrintBtn" onclick="sultanManagerPrintAdisyon()" style="width: 100%; padding: 16px; margin-bottom: 10px; border-radius: 14px; border: 2px solid #e2e8f0; background: #fff; color: #0f172a; font-size: 16px; font-weight: 700;">Adisyon yazdır</button>
      <button type="button" onclick="openSultanMgrCancelSheet()" style="width: 100%; padding: 14px; margin-bottom: 10px; border-radius: 14px; border: 1.5px solid #fecaca; background: #fff5f5; color: #dc2626; font-size: 15px; font-weight: 700;">Tüm masayı iptal et</button>
      <button type="button" onclick="closeSultanManagerSheet()" style="width: 100%; padding: 12px; border: none; background: transparent; color: #64748b; font-size: 15px; font-weight: 600;">Vazgeç</button>
    </div>
  </div>
  <!-- Sultan — Tüm Masayı İptal Et Onay Sayfası -->
  <div id="sultanMgrCancelSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:2700;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeSultanMgrCancelSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:10px 20px 28px;box-shadow:0 -12px 40px rgba(0,0,0,0.2);">
      <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 16px;"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:44px;height:44px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" fill="none" stroke="#dc2626" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </div>
        <div>
          <div style="font-size:17px;font-weight:800;color:#0f172a;" id="sultanMgrCancelTitle">Masayı İptal Et</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">Bu işlem geri alınamaz</div>
        </div>
      </div>
      <textarea id="sultanMgrCancelReason" rows="3" placeholder="İptal açıklaması girin (zorunlu)..." style="width:100%;border:1.5px solid #fca5a5;border-radius:12px;padding:12px 14px;font-size:15px;color:#1e293b;resize:none;outline:none;font-family:inherit;box-sizing:border-box;line-height:1.5;margin-bottom:14px;"></textarea>
      <button type="button" onclick="confirmSultanMgrCancelOrder()" style="width:100%;padding:16px;border-radius:14px;border:none;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px;box-shadow:0 3px 12px rgba(220,38,38,0.3);">Evet, İptal Et</button>
      <button type="button" onclick="closeSultanMgrCancelSheet()" style="width:100%;padding:13px;border:none;background:transparent;color:#64748b;font-size:15px;font-weight:600;cursor:pointer;">Vazgeç</button>
    </div>
  </div>

  <!-- Sultan — Masa Aktar Hedef Seçim Sayfası -->
  <div id="sultanMgrTransferSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:2700;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeSultanMgrTransferSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.2);">
      <div style="padding:10px 20px 14px;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:4px;">Hedef Masayı Seçin</div>
        <div style="font-size:13px;color:#64748b;" id="sultanMgrTransferSubtitle"></div>
      </div>
      <div id="sultanMgrTransferGrid" style="flex:1;overflow-y:auto;padding:0 16px 8px;"></div>
      <div style="padding:14px 20px 24px;flex-shrink:0;display:flex;gap:10px;">
        <button type="button" onclick="closeSultanMgrTransferSheet()" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:15px;font-weight:700;cursor:pointer;">Vazgeç</button>
        <button type="button" id="sultanMgrTransferConfirmBtn" onclick="confirmSultanMgrTransfer()" style="flex:2;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:#fff;font-size:15px;font-weight:800;cursor:pointer;display:none;box-shadow:0 3px 12px rgba(29,78,216,0.3);">Aktar</button>
      </div>
    </div>
  </div>

  <!-- Sultan — Rezervasyon Oluşturma Formu -->
  <div id="sultanReservationFormSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2800;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeReservationFormSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="padding:10px 20px 0;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:40px;height:40px;border-radius:12px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="20" height="20" fill="none" stroke="#d97706" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;" id="resFormTitle">Rezervasyon Oluştur</div>
            <div style="font-size:13px;color:#64748b;" id="resFormTableLabel"></div>
          </div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 20px 10px;">
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Ad Soyad *</label>
          <input type="text" id="resFormGuestName" placeholder="Müşteri adı soyadı..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Tarih *</label>
            <input type="date" id="resFormDate" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Saat *</label>
            <input type="time" id="resFormTime" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Kişi Sayısı</label>
            <input type="number" id="resFormPeople" min="0" placeholder="0" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Yetişkin</label>
            <input type="number" id="resFormAdults" min="0" placeholder="0" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Çocuk</label>
            <input type="number" id="resFormChildren" min="0" placeholder="0" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Bebek</label>
            <input type="number" id="resFormBabies" min="0" placeholder="0" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;">
          </div>
        </div>
        <div id="resFormTablePickerWrap" style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Masa *</label>
          <select id="resFormTableSelect" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;outline:none;box-sizing:border-box;background:#fff;"></select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Özel Not</label>
          <textarea id="resFormNote" rows="3" placeholder="Özel not..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;resize:none;outline:none;font-family:inherit;box-sizing:border-box;line-height:1.5;"></textarea>
        </div>
      </div>
      <div style="padding:12px 20px 24px;flex-shrink:0;display:flex;gap:10px;">
        <button type="button" onclick="closeReservationFormSheet()" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:15px;font-weight:700;cursor:pointer;">Vazgeç</button>
        <button type="button" id="resFormSubmitBtn" onclick="submitReservation()" style="flex:2;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 3px 12px rgba(217,119,6,0.3);">Oluştur</button>
      </div>
    </div>
  </div>

  <!-- Sultan — Rezervasyon Detay Sheet -->
  <div id="sultanReservationDetailSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2800;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeReservationDetailSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:10px 20px 26px;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:40px;height:40px;border-radius:12px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="20" height="20" fill="none" stroke="#d97706" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <div>
          <div style="font-size:17px;font-weight:800;color:#0f172a;">Rezervasyon Bilgileri</div>
          <div style="font-size:13px;color:#64748b;" id="resDetailTableLabel"></div>
        </div>
      </div>
      <div id="resDetailBody" style="background:#f8fafc;border-radius:14px;padding:14px 16px;margin-bottom:14px;border:1.5px solid #e2e8f0;font-size:14px;color:#1e293b;line-height:1.9;"></div>
      <button type="button" onclick="printReservation()" style="width:100%;padding:14px;margin-bottom:10px;border-radius:14px;border:none;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 3px 12px rgba(217,119,6,0.3);">Rezervasyon Yazdır</button>
      <button type="button" onclick="editReservationFromDetail()" style="width:100%;padding:13px;margin-bottom:10px;border-radius:14px;border:1.5px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-size:14px;font-weight:700;cursor:pointer;">Düzenle</button>
      <button type="button" onclick="cancelReservation()" style="width:100%;padding:13px;margin-bottom:10px;border-radius:14px;border:1.5px solid #fecaca;background:#fff5f5;color:#dc2626;font-size:14px;font-weight:700;cursor:pointer;">Rezervasyonu İptal Et</button>
      <button type="button" onclick="closeReservationDetailSheet()" style="width:100%;padding:12px;border:none;background:transparent;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;">Kapat</button>
    </div>
  </div>

  <!-- Sultan — Tüm Rezervasyonlar Listesi -->
  <div id="sultanReservationListSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2800;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeReservationListSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="padding:10px 20px 0;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:11px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" fill="none" stroke="#d97706" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;">Mevcut Rezervasyonlar</div>
          </div>
          <span id="resListCount" style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;"></span>
        </div>
      </div>
      <div id="resListBody" style="flex:1;overflow-y:auto;padding:0 16px 8px;"></div>
      <div style="padding:12px 20px 24px;flex-shrink:0;">
        <button type="button" onclick="closeReservationListSheet()" style="width:100%;padding:13px;border:none;background:transparent;color:#64748b;font-size:15px;font-weight:600;cursor:pointer;">Kapat</button>
      </div>
    </div>
  </div>

  <!-- Sultan — Tamamlanmış satışlar (geri al) -->
  <div id="sultanSalesHistorySheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2815;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeSultanSalesHistorySheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="padding:10px 20px 0;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:11px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" fill="none" stroke="#047857" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;">Satışlar</div>
          </div>
        </div>
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;line-height:1.45;">Ödemesi alınmış masalar. Yanlışlıkla kapatılan siparişi <strong style="color:#0f172a;">Geri al</strong> ile tekrar açık masaya döndürebilirsiniz.</p>
      </div>
      <div id="sultanSalesHistoryBody" style="flex:1;overflow-y:auto;padding:0 16px 8px;"></div>
      <div style="padding:12px 20px 24px;flex-shrink:0;">
        <button type="button" onclick="closeSultanSalesHistorySheet()" style="width:100%;padding:13px;border:none;background:transparent;color:#64748b;font-size:15px;font-weight:600;cursor:pointer;">Kapat</button>
      </div>
    </div>
  </div>

  <!-- Sultan — Tüm masalar açık siparişleri (toplu) -->
  <div id="sultanAllOrdersSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2816;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeSultanAllOrdersSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="padding:10px 20px 0;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:11px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" fill="none" stroke="#047857" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            </div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;">Siparişler</div>
          </div>
          <span id="sultanAllOrdersCount" style="background:#ecfdf5;color:#047857;font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;"></span>
        </div>
        <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#64748b;line-height:1.45;">Tüm masalardaki açık siparişler ve satırlar.</p>
      </div>
      <div id="sultanAllOrdersBody" style="flex:1;overflow-y:auto;padding:0 16px 8px;-webkit-overflow-scrolling:touch;"></div>
      <div style="padding:12px 20px 24px;flex-shrink:0;">
        <button type="button" onclick="closeSultanAllOrdersSheet()" style="width:100%;padding:13px;border:none;background:transparent;color:#64748b;font-size:15px;font-weight:600;cursor:pointer;">Kapat</button>
      </div>
    </div>
  </div>

  <div id="sultanPaymentSheet" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 2650; align-items: flex-end; justify-content: center;" onclick="if(event.target === this) closeSultanPaymentSheet()">
    <div style="background: #fff; width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 10px 20px 22px; box-shadow: 0 -12px 40px rgba(0,0,0,0.18);">
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="width: 44px; height: 5px; background: #e2e8f0; border-radius: 3px; margin: 0 auto 14px;"></div>
        <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a;">Ödeme yöntemi</h3>
        <p id="sultanPaySubtitle" style="margin: 8px 0 0; font-size: 15px; font-weight: 600; color: #64748b;"></p>
      </div>
      <button type="button" onclick="confirmSultanPayment('Nakit')" style="width: 100%; padding: 16px; margin-bottom: 10px; border-radius: 14px; border: none; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #fff; font-size: 16px; font-weight: 800;">Nakit</button>
      <button type="button" onclick="confirmSultanPayment('Kredi Kartı')" style="width: 100%; padding: 16px; margin-bottom: 10px; border-radius: 14px; border: none; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #fff; font-size: 16px; font-weight: 800;">Kredi Kartı</button>
      <button type="button" onclick="closeSultanPaymentSheet()" style="width: 100%; padding: 12px; border: none; background: transparent; color: #64748b; font-size: 15px; font-weight: 600;">Geri</button>
    </div>
  </div>
  
  <!-- Makara Havzan müdür: son 24 saat iptaller -->
  <div id="makaraRecentCancellationsSheet" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2820;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeMakaraRecentCancellationsSheet()">
    <div style="background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(0,0,0,0.22);">
      <div style="padding:10px 20px 0;flex-shrink:0;">
        <div style="width:44px;height:5px;background:#e2e8f0;border-radius:3px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:17px;font-weight:800;color:#0f172a;">İptaller</div>
          <span style="font-size:12px;font-weight:600;color:#64748b;">Son 24 saat</span>
        </div>
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;line-height:1.45;">İptal edilen ürünler, iptal eden personel ve açıklamalar (Firebase kayıtları).</p>
      </div>
      <div id="makaraRecentCancellationsBody" style="flex:1;overflow-y:auto;padding:0 16px 8px;-webkit-overflow-scrolling:touch;font-size:13px;color:#334155;"></div>
      <div style="padding:12px 20px 24px;flex-shrink:0;">
        <button type="button" onclick="closeMakaraRecentCancellationsSheet()" style="width:100%;padding:13px;border:none;background:transparent;color:#64748b;font-size:15px;font-weight:600;cursor:pointer;">Kapat</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <script>
    const API_URL = '${serverURL}/api';
    const SOCKET_URL = '${serverURL}';
    const MOBILE_BRANCH_KEY = ${JSON.stringify(mobileBranchKey)};
    const isSultanMobile = MOBILE_BRANCH_KEY === 'sultansomati';
    const isMakaraHavzanMobile = MOBILE_BRANCH_KEY === 'makara';
    const useImmersiveProductSearch = isSultanMobile || isMakaraHavzanMobile;
    let sultanAllOrdersHighlightTableId = null;

    // Sultan Somatı'da tüm personel müdür yetkisine sahiptir
    function hasManagerPermission() {
      return isSultanMobile || !!(currentStaff && currentStaff.is_manager);
    }

    function canCancelExistingOrderLines() {
      return hasManagerPermission() || !!(isMakaraHavzanMobile && currentStaff && currentStaff.is_chef);
    }

    function openMakaraRecentCancellationsSheet() {
      if (!isMakaraHavzanMobile || !currentStaff || !currentStaff.is_manager) return;
      var sheet = document.getElementById('makaraRecentCancellationsSheet');
      var body = document.getElementById('makaraRecentCancellationsBody');
      if (!sheet || !body) return;
      body.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-weight:600;">Yükleniyor…</div>';
      sheet.style.display = 'flex';
      fetch(API_URL + '/staff/recent-cancellations?staffId=' + encodeURIComponent(currentStaff.id))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) {
            body.innerHTML = '<div style="padding:16px;color:#b91c1c;font-weight:600;">' + (data.error || 'Liste alınamadı') + '</div>';
            return;
          }
          var items = data.items || [];
          if (!items.length) {
            body.innerHTML = '<div style="padding:24px;text-align:center;color:#64748b;">Bu sürede iptal kaydı yok.</div>';
            return;
          }
          body.innerHTML = items.map(function(row) {
            var esc = function(s) {
              return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
            };
            var lines = '';
            if (row.is_group && row.items_array && row.items_array.length) {
              lines = '<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.5;">' +
                row.items_array.map(function(it) {
                  return esc((it.product_name || '') + ' ×' + (it.quantity != null ? it.quantity : ''));
                }).join('<br/>') + '</div>';
            } else {
              lines = '<div style="margin-top:6px;font-weight:700;color:#0f172a;">' + esc(row.product_name) + (row.quantity != null ? ' ×' + row.quantity : '') + '</div>';
            }
            return '<div style="border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:10px;background:#f8fafc;">' +
              '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                '<span style="font-weight:800;color:#7c3aed;">' + esc(row.table_name || 'Masa') + '</span>' +
                '<span style="font-size:12px;color:#64748b;">' + esc(row.cancel_date || '') + ' ' + esc(row.cancel_time || '') + '</span>' +
              '</div>' +
              lines +
              '<div style="margin-top:8px;font-size:12px;"><span style="color:#64748b;">Personel:</span> <strong style="color:#0f172a;">' + esc(row.staff_name || '—') + '</strong></div>' +
              '<div style="margin-top:6px;font-size:12px;"><span style="color:#64748b;">Sebep:</span> <span style="color:#92400e;font-weight:600;">' + esc(row.cancel_reason || '—') + '</span></div>' +
              (row.source ? '<div style="margin-top:4px;font-size:11px;color:#94a3b8;">Kaynak: ' + esc(row.source) + '</div>' : '') +
            '</div>';
          }).join('');
        })
        .catch(function() {
          body.innerHTML = '<div style="padding:16px;color:#b91c1c;font-weight:600;">Bağlantı hatası</div>';
        });
    }

    function closeMakaraRecentCancellationsSheet() {
      var sheet = document.getElementById('makaraRecentCancellationsSheet');
      if (sheet) sheet.style.display = 'none';
    }

    function setSultanLoginChromeActive(on) {
      if (!isSultanMobile) return;
      document.body.classList.toggle('sultan-staff-auth', !!on);
    }

    /* ===========================
       APP HEADER & DRAWER
       =========================== */
    function openDrawer() {
      document.getElementById('drawerOverlay').classList.add('open');
      document.getElementById('drawerPanel').classList.add('open');
      document.body.style.overflow = 'hidden';
      var resBtn = document.getElementById('drawerReservationBtn');
      if (resBtn) resBtn.style.display = isSultanMobile ? '' : 'none';
      var resListBtn = document.getElementById('drawerReservationListBtn');
      if (resListBtn) resListBtn.style.display = isSultanMobile ? '' : 'none';
      var resCount = document.getElementById('drawerReservationCount');
      if (resCount) resCount.textContent = (sultanReservations && sultanReservations.length > 0) ? sultanReservations.length : '';
      var salesHistBtn = document.getElementById('drawerSalesHistoryBtn');
      if (salesHistBtn) salesHistBtn.style.display = isSultanMobile ? '' : 'none';
      var mergeBtn = document.getElementById('drawerMergeBtn');
      if (mergeBtn) mergeBtn.style.display = !isSultanMobile && currentStaff && currentStaff.is_manager ? '' : 'none';
      var mgrOpsBtn = document.getElementById('drawerManagerOpsBtn');
      if (mgrOpsBtn) mgrOpsBtn.style.display = hasManagerPermission() ? 'flex' : 'none';
      var allOrdBtn = document.getElementById('drawerAllOrdersBtn');
      if (allOrdBtn) allOrdBtn.style.display = isSultanMobile ? '' : 'none';
      var makCanBtn = document.getElementById('drawerMakaraCancellationsBtn');
      if (makCanBtn) makCanBtn.style.display = (isMakaraHavzanMobile && currentStaff && currentStaff.is_manager) ? '' : 'none';
    }

    function closeDrawer() {
      document.getElementById('drawerOverlay').classList.remove('open');
      document.getElementById('drawerPanel').classList.remove('open');
      document.body.style.overflow = '';
    }

    function showAppHeader(staff) {
      const header = document.getElementById('appHeader');
      if (!header) return;
      header.classList.add('visible');
      if (staff) {
        const fullName = ((staff.name || '') + ' ' + (staff.surname || '')).trim();
        const i1 = (staff.name || ' ').charAt(0).toUpperCase();
        const i2 = (staff.surname || ' ').charAt(0).toUpperCase();
        const avatarEl = document.getElementById('drawerAvatar');
        const nameEl = document.getElementById('drawerStaffName');
        const roleEl = document.getElementById('drawerStaffRole');
        if (avatarEl) avatarEl.textContent = i1 + i2;
        if (nameEl) nameEl.textContent = fullName || 'Personel';
        if (roleEl) {
          if (isSultanMobile || staff.is_manager) roleEl.textContent = 'Müdür';
          else if (isMakaraHavzanMobile && staff.is_chef) roleEl.textContent = 'Şef';
          else roleEl.textContent = 'Personel';
        }
        const mergeBtn = document.getElementById('drawerMergeBtn');
        if (mergeBtn) mergeBtn.style.display = !isSultanMobile && staff.is_manager ? 'flex' : 'none';
        const mgrOpsBtn = document.getElementById('drawerManagerOpsBtn');
        if (mgrOpsBtn) mgrOpsBtn.style.display = (isSultanMobile || staff.is_manager) ? 'flex' : 'none';
        const allOrdersBtn = document.getElementById('drawerAllOrdersBtn');
        if (allOrdersBtn) allOrdersBtn.style.display = isSultanMobile ? 'flex' : 'none';
        var makCanBtn = document.getElementById('drawerMakaraCancellationsBtn');
        if (makCanBtn) makCanBtn.style.display = (isMakaraHavzanMobile && staff.is_manager) ? '' : 'none';
      }
    }

    function hideAppHeader() {
      const header = document.getElementById('appHeader');
      if (header) header.classList.remove('visible');
      closeDrawer();
    }

    let currentSultanSectionKey = '';
    let selectedTable = null;
    let categories = [];
    let products = [];
    let yanUrunler = []; // Yan ürünler için ayrı liste
    let cart = [];
    let nextCartLineId = 1;
    let selectedCategoryId = null;
    let currentStaff = null;
    let socket = null;
    let tables = [];
    let currentTableType = 'inside';
    let orderNote = '';
    let preparedReceipts = {}; // Sepetteyken hazırlanan fişler (metin)
    let preparedHtmlReceipts = {}; // Sepetteyken hazırlanan HTML fişler
    let preparedPrintJobId = null; // Sunucudaki önceden yüklenmiş BrowserWindow job kimliği
    const YAN_URUNLER_CATEGORY_ID = 999999; // Özel kategori ID'si
    let transferItemsStep = 1; // 1: Ürün/adet seç, 2: Hedef masa seç
    let selectedTransferItemsSourceTableId = null;
    let selectedTransferItemsSourceOrderId = null;
    let selectedTransferItemsTargetTableId = null;
    let transferItemsQuantities = {}; // {product_id_isGift: quantity}
    let currentOrderItems = []; // Mevcut sipariş ürünleri
    let mergeStep = 1;
    let selectedMergeSourceTableId = null;
    let selectedMergeTargetTableId = null;
    
    // PIN oturum yönetimi (1 saat)
    const SESSION_DURATION = 60 * 60 * 1000;
    
    function saveStaffSession(staff, rememberMe = false) {
      const sessionData = { staff: staff, timestamp: Date.now(), rememberMe: rememberMe };
      localStorage.setItem('staffSession', JSON.stringify(sessionData));
    }
    
    function getStaffSession() {
      const sessionData = localStorage.getItem('staffSession');
      if (!sessionData) return null;
      try {
        const parsed = JSON.parse(sessionData);
        // Eğer "Beni Hatırla" seçiliyse süre kontrolü yapma
        if (parsed.rememberMe) {
          return parsed.staff;
        }
        // Normal durumda süre kontrolü yap
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
      if (isSultanMobile) {
        document.documentElement.classList.add('sultan-mobile-root');
        document.body.classList.add('sultan-mobile');
      } else if (isMakaraHavzanMobile) {
        document.documentElement.classList.add('makara-mobile-root');
        document.body.classList.add('makara-mobile');
      }
      if (useImmersiveProductSearch) {
        initSultanImmersiveSearchUI();
      }
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
        // "Beni Hatırla" checkbox'ını kontrol et
        const sessionData = localStorage.getItem('staffSession');
        if (sessionData) {
          try {
            const parsed = JSON.parse(sessionData);
            if (parsed.rememberMe) {
              const rememberMeCheckbox = document.getElementById('rememberMe');
              if (rememberMeCheckbox) {
                rememberMeCheckbox.checked = true;
              }
            }
          } catch (error) {
            console.error('Session parse hatası:', error);
          }
        }
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
        document.getElementById('tableTypeSelection').style.display = 'none';
        document.getElementById('tableSelection').style.display = 'block';
        document.getElementById('cart').style.display = 'block';
        showAppHeader(currentStaff);
        setSultanLoginChromeActive(false);
        loadData();
        initWebSocket();
        if (typeof renderTables === 'function') renderTables();
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
          const rememberMe = document.getElementById('rememberMe')?.checked || false;
          saveStaffSession(currentStaff, rememberMe);
          errorDiv.classList.remove('show');
          
          // Splash screen göster
          document.getElementById('pinSection').style.display = 'none';
          document.getElementById('splashScreen').style.display = 'flex';
          document.getElementById('splashStaffName').textContent = currentStaff.name + ' ' + currentStaff.surname;
          
          // 2 saniye sonra ana ekrana geç
          setTimeout(() => {
            document.getElementById('splashScreen').style.display = 'none';
            setSultanLoginChromeActive(false);
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
            document.getElementById('tableTypeSelection').style.display = 'none';
            document.getElementById('tableSelection').style.display = 'block';
            document.getElementById('cart').style.display = 'block';
            showAppHeader(currentStaff);
            loadData();
            initWebSocket();
            if (typeof renderTables === 'function') renderTables();
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
    
    // PERFORMANS: Debounce ve throttle helper'lar
    const debounceTimers = {};
    function debounce(key, fn, delay = 250) {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, delay);
    }
    
    // Sepetteyken fişi arka planda hazırla (Siparişi Gönder anında anında yazdırılır)
    function schedulePrepareReceipts() {
      debounce('prepare-receipts', function() {
        if (cart.length === 0 || !selectedTable) { preparedReceipts = {}; preparedHtmlReceipts = {}; preparedPrintJobId = null; return; }
        var staffName = currentStaff ? (currentStaff.name + ' ' + currentStaff.surname) : null;
        fetch(API_URL + '/prepare-adisyon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(function(item) {
              return {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                isGift: item.isGift || false,
                extraNote: (item.extraNote && String(item.extraNote).trim()) ? String(item.extraNote).trim() : null
              };
            }),
            tableName: selectedTable.name,
            tableType: selectedTable.type,
            orderNote: orderNote || null,
            staffName: staffName
          })
        })
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (result.success) {
            if (result.receipts) preparedReceipts = result.receipts;
            if (result.htmlReceipts) preparedHtmlReceipts = result.htmlReceipts;
            if (result.printJobId) preparedPrintJobId = result.printJobId;
          }
        })
        .catch(function() { preparedReceipts = {}; preparedHtmlReceipts = {}; preparedPrintJobId = null; });
      }, 150);
    }
    
    const throttleTimers = {};
    const throttleLastRun = {};
    function throttle(key, fn, delay = 100) {
      const now = Date.now();
      const lastRun = throttleLastRun[key] || 0;
      if (now - lastRun >= delay) {
        throttleLastRun[key] = now;
        fn();
      } else {
        if (throttleTimers[key]) clearTimeout(throttleTimers[key]);
        throttleTimers[key] = setTimeout(() => {
          throttleLastRun[key] = Date.now();
          fn();
        }, delay - (now - lastRun));
      }
    }

    // WebSocket bağlantısı
    function initWebSocket() {
      if (socket) socket.disconnect();
      try {
        socket = io(SOCKET_URL);
        socket.on('connect', () => {});  // PERFORMANS: Log kaldırıldı
        socket.on('table-update', async (data) => {
          // PERFORMANS: Log kaldırıldı - sadece hata durumunda log
          // Debounce ile performans artır
          debounce('table-update-' + data.tableId, () => {
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
            if (isSultanMobile) {
              var _ssh = document.getElementById('sultanSalesHistorySheet');
              if (_ssh && _ssh.style.display === 'flex') renderSultanSalesHistoryList();
              var _sao = document.getElementById('sultanAllOrdersSheet');
              if (_sao && _sao.style.display === 'flex') renderSultanAllOrdersSheet();
            }
          }, 200);
        });
        socket.on('new-order', async (data) => {
          // PERFORMANS: Log kaldırıldı
          debounce('new-order-' + data.tableId, () => {
            if (selectedTable && selectedTable.id === data.tableId) {
              loadExistingOrders(selectedTable.id);
            }
          }, 200);
        });
        socket.on('staff-deleted', (data) => {
          console.log('⚠️ Personel silindi:', data);
          // Otomatik çıkış yap
          localStorage.removeItem('staffSession');
          // Ana ekranı gizle, giriş ekranını göster
          document.getElementById('mainSection').style.display = 'none';
          document.getElementById('pinSection').style.display = 'block';
          setSultanLoginChromeActive(true);
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
          // PERFORMANS: Log kaldırıldı
          debounce('stock-update-' + data.productId, () => {
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
              fetch(API_URL + '/products')
                .then(res => res.ok ? res.json() : null)
                .then(prods => {
                  if (prods) {
                    products = prods;
                    if (document.getElementById('orderSection') && document.getElementById('orderSection').style.display !== 'none') {
                      renderProducts();
                    }
                  }
                })
                .catch(error => console.error('Ürün güncelleme hatası:', error));
            }
          }, 300);
        });
        socket.on('disconnect', () => {}); // PERFORMANS: Log kaldırıldı
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
      const mergeTableBtn = document.getElementById('mergeTableBtn');
      if (mergeTableBtn) mergeTableBtn.style.display = hasManagerPermission() ? 'flex' : 'none';
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
    
    var sultanReservations = []; // { id, tableId, ... }

    async function loadData() {
      try {
        const fetchList = [
          fetch(API_URL + '/categories'),
          fetch(API_URL + '/products'),
          fetch(API_URL + '/tables')
        ];
        if (isSultanMobile) fetchList.push(fetch(API_URL + '/reservations'));
        const results = await Promise.all(fetchList);
        categories = await results[0].json();
        if (isSultanMobile) {
          categories = categories.filter(function (c) {
            var n = Number(c.id);
            if (n === 999999 || n === -999) return false;
            var nm = (c.name && String(c.name).trim().toLowerCase()) || '';
            return nm !== 'yan ürünler' && nm !== 'yan urunler';
          });
        }
        products = await results[1].json();
        tables = await results[2].json();
        if (isSultanMobile && results[3]) sultanReservations = await results[3].json();
        renderTables();
        renderCategories();
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
        document.getElementById('tablesGrid').innerHTML = '<div class="loading">❌ Bağlantı hatası</div>';
      }
    }
    
    async function refreshAllData() {
      const refreshBtn = document.getElementById('refreshDataBtn');
      const originalHTML = refreshBtn ? refreshBtn.innerHTML : '';
      
      // Butonu loading durumuna geçir
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';
        refreshBtn.style.cursor = 'not-allowed';
        refreshBtn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Yenileniyor...';
      }
      
      try {
        // Tüm verileri yenile
        await loadData();
        
        // Eğer bir masa seçiliyse, siparişleri de yenile
        if (selectedTable && selectedTable.id) {
          await loadExistingOrders(selectedTable.id);
        }
        
        // Ürünleri render et (eğer order section açıksa)
        if (document.getElementById('orderSection') && document.getElementById('orderSection').style.display !== 'none') {
          renderProducts();
        }
        
        showToast('success', 'Başarılı', 'Tüm veriler yenilendi');
      } catch (error) {
        console.error('Veri yenileme hatası:', error);
        showToast('error', 'Hata', 'Veriler yenilenirken bir hata oluştu');
      } finally {
        // Butonu eski haline getir
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = '1';
          refreshBtn.style.cursor = 'pointer';
          refreshBtn.innerHTML = originalHTML;
        }
      }
    }
    
    function renderSultanSectionTabs() {
      const bar = document.getElementById('sultanSectionBar');
      if (!bar) return;
      if (!isSultanMobile || !tables.length || typeof tables[0].id !== 'string' || tables[0].id.indexOf('sultan-') !== 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
      }
      const byKey = {};
      tables.forEach(function (t) {
        if (t.sectionKey) byKey[t.sectionKey] = t.sectionLabel || t.sectionKey;
      });
      const keys = Object.keys(byKey);
      if (!keys.length) {
        bar.style.display = 'none';
        return;
      }
      if (!currentSultanSectionKey || keys.indexOf(currentSultanSectionKey) < 0) {
        currentSultanSectionKey = keys[0];
      }
      const sub = byKey[currentSultanSectionKey] || '';
      bar.style.display = 'block';
      bar.innerHTML =
        '<p style="text-align:center;font-size:12px;font-weight:800;letter-spacing:0.14em;color:#64748b;margin:0 0 12px 0;text-transform:uppercase;">Bölüm seçin <span style="font-weight:600;opacity:0.75;font-size:11px;">(kaydırarak seçin)</span></p>' +
        '<div class="sultan-section-scroll-wrap">' +
        '<div class="sultan-section-scroll">' +
        keys
          .map(function (k) {
            const label = byKey[k];
            const sectionTables = tables.filter(function (x) { return x.sectionKey === k; });
            const total = sectionTables.length;
            const occupied = sectionTables.filter(function (x) { return x.hasOrder; }).length;
            const active = currentSultanSectionKey === k ? ' active' : '';
            const kEsc = k.replace(/'/g, "\\'");
            const occCls = occupied > 0 ? ' has-occ' : '';
            return (
              '<button type="button" class="sultan-section-tab' +
              active +
              occCls +
              '" onclick="selectSultanSectionKey(\\'' +
              kEsc +
              '\\')">' +
              String(label).replace(/</g, '&lt;').replace(/>/g, '&gt;') +
              '<span class="cnt">' +
              occupied + '/' + total +
              '</span></button>'
            );
          })
          .join('') +
        '</div></div>' +
        '<p style="text-align:center;font-size:15px;font-weight:800;color:#334155;margin:18px 0 10px 0;">' +
        String(sub).replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        ' — Masa seçin</p>';
      requestAnimationFrame(function () {
        var scrollEl = bar.querySelector('.sultan-section-scroll');
        var activeBtn = bar.querySelector('.sultan-section-tab.active');
        if (!scrollEl || !activeBtn) return;
        var sR = scrollEl.getBoundingClientRect();
        var bR = activeBtn.getBoundingClientRect();
        var delta = bR.left + bR.width / 2 - (sR.left + sR.width / 2);
        var maxScroll = Math.max(0, scrollEl.scrollWidth - sR.width);
        scrollEl.scrollLeft = Math.max(0, Math.min(scrollEl.scrollLeft + delta, maxScroll));
      });
    }

    function selectSultanSectionKey(key) {
      currentSultanSectionKey = key;
      renderTables();
    }

    function renderTables() {
      const grid = document.getElementById('tablesGrid');
      if (isSultanMobile && tables.length > 0 && typeof tables[0].id === 'string' && tables[0].id.indexOf('sultan-') === 0) {
        renderSultanSectionTabs();
        const inSection = tables.filter(function (t) {
          return t.sectionKey === currentSultanSectionKey;
        });
        const html = inSection
          .map(function (table) {
            const tableIdStr = typeof table.id === 'string' ? '\\'' + table.id + '\\'' : table.id;
            const nameStr = table.name.replace(/'/g, "\\'");
            const typeStr = (table.type || '').replace(/'/g, "\\'");
            const hasOrderClass = table.hasOrder ? ' has-order' : '';
            const selectedClass = selectedTable && selectedTable.id === table.id ? ' selected' : '';
            const ot =
              typeof table.orderTotal === 'number' && !isNaN(table.orderTotal) ? table.orderTotal : 0;
            const totalLine =
              '<div class="sultan-table-total" title="' +
              ot.toFixed(2) +
              ' ₺">' +
              ot.toFixed(2) +
              ' ₺</div>';
            // Rezervasyon kontrolü
            const reservation = sultanReservations.find(function(r) { return r.tableId === table.id; });
            const mgrFab =
              (table.hasOrder || reservation) && currentStaff
                ? '<button type="button" class="sultan-mgr-fab" aria-label="Masa işlemleri" onclick="event.preventDefault();event.stopPropagation();' +
                  (table.hasOrder ? 'openSultanManagerSheet(' + tableIdStr + ')' : 'openReservationDetailSheet(' + tableIdStr + ')') +
                  '">⋯</button>'
                : '';
            if (!table.hasOrder) {
              const resvBadge = reservation
                ? '<div style="font-size:9px;font-weight:800;color:#92400e;margin-top:4px;padding:2px 7px;background:rgba(251,191,36,0.25);border-radius:6px;letter-spacing:0.03em;">REZERVE</div>'
                : '';
              const resvClass = reservation ? ' sultan-table-reserved' : '';
              return (
                '<div class="sultan-table-cell">' +
                '<button class="table-btn sultan-table-empty' +
                resvClass +
                selectedClass +
                '" onclick="selectTable(' +
                tableIdStr +
                ', \\'' +
                nameStr +
                '\\', \\'' +
                typeStr +
                '\\')">' +
                '<div class="table-number">' +
                table.number +
                '</div>' +
                resvBadge +
                '</button>' +
                mgrFab +
                '</div>'
              );
            }
            const disp = String(table.name || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            return (
              '<div class="sultan-table-cell">' +
              '<button class="table-btn' +
              hasOrderClass +
              selectedClass +
              '" onclick="selectTable(' +
              tableIdStr +
              ', \\'' +
              nameStr +
              '\\', \\'' +
              typeStr +
              '\\')">' +
              '<div class="table-number">' +
              table.number +
              '</div>' +
              '<div style="font-size:10px;font-weight:700;color:#ecfdf5;margin:6px 2px 0;line-height:1.25;text-align:center;max-height:40px;overflow:hidden;">' +
              disp +
              '</div>' +
              '<div style="font-size: 10px; font-weight: 600; color: #bbf7d0; margin-top: 4px; padding: 2px 6px; background: rgba(22, 101, 52, 0.25); border-radius: 6px;">' +
              'Dolu' +
              '</div>' +
              totalLine +
              '</button>' +
              mgrFab +
              '</div>'
            );
          })
          .join('');
        requestAnimationFrame(function () {
          if (grid) grid.innerHTML = html;
        });
        return;
      }
      const sultanBar = document.getElementById('sultanSectionBar');
      if (sultanBar) {
        sultanBar.style.display = 'none';
        sultanBar.innerHTML = '';
      }
      // Havzan: 1-99 + paket | Suriçi: iç 1-20, ayırıcı, dış numaralar, paket
      const insideTables = tables.filter(t => t.id.startsWith('inside-') && !t.id.startsWith('package-'));
      const outsideTables = tables.filter(t => t.id.startsWith('outside-') && !t.id.startsWith('package-'));
      const packageTables = tables.filter(t => t.id.startsWith('package-'));
      
      let html = '';
      
      if (insideTables.length > 0) {
        html += insideTables.map(table => {
          const tableIdStr = typeof table.id === 'string' ? '\\'' + table.id + '\\'' : table.id;
          const nameStr = table.name.replace(/'/g, "\\'");
          const typeStr = table.type.replace(/'/g, "\\'");
          const hasOrderClass = table.hasOrder ? ' has-order' : '';
          const selectedClass = selectedTable && selectedTable.id === table.id ? ' selected' : '';
          const insideEmptyClass = (!table.hasOrder) ? ' inside-empty' : '';
          const statusLabel = table.hasOrder ? 'Dolu' : 'Boş';
          const statusColor = table.hasOrder ? '#166534' : '#9d174d';
          return '<button class="table-btn' + hasOrderClass + selectedClass + insideEmptyClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')">' +
            '<div class="table-number">' + table.number + '</div>' +
            '<div style="font-size: 10px; font-weight: 600; color: ' + statusColor + '; margin-top: 4px; padding: 2px 6px; background: ' + (table.hasOrder ? 'rgba(22, 101, 52, 0.15)' : 'rgba(107, 114, 128, 0.1)') + '; border-radius: 6px;">' + statusLabel + '</div>' +
          '</button>';
        }).join('');
      }
      
      if (outsideTables.length > 0) {
        html += '<div style="grid-column: 1 / -1; padding: 20px 0; width: 100%; display: flex; align-items: center; justify-content: center;">';
        html += '<div style="position: relative; width: 100%; display: flex; align-items: center; justify-content: center;">';
        html += '<div style="position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 2px; width: 100%; background: linear-gradient(90deg, #e2e8f0, #94a3b8, #e2e8f0); box-shadow: 0 1px 3px rgba(0,0,0,0.08);"></div>';
        html += '<div style="position: relative; z-index: 10; width: 12px; height: 12px; border-radius: 50%; background: #ffffff; border: 2px solid #94a3b8; box-shadow: 0 2px 8px rgba(148,163,184,0.4), 0 0 0 2px rgba(226,232,240,0.8);"></div>';
        html += '</div></div>';
        html += outsideTables.map(table => {
          const tableIdStr = typeof table.id === 'string' ? '\\'' + table.id + '\\'' : table.id;
          const nameStr = table.name.replace(/'/g, "\\'");
          const typeStr = table.type.replace(/'/g, "\\'");
          const hasOrderClass = table.hasOrder ? ' has-order' : '';
          const selectedClass = selectedTable && selectedTable.id === table.id ? ' selected' : '';
          const outsideEmptyClass = (!table.hasOrder) ? ' outside-empty' : '';
          const statusLabel = table.hasOrder ? 'Dolu' : 'Boş';
          const statusColor = table.hasOrder ? '#166534' : '#92400e';
          return '<button class="table-btn' + hasOrderClass + selectedClass + outsideEmptyClass + '" onclick="selectTable(' + tableIdStr + ', \\'' + nameStr + '\\', \\'' + typeStr + '\\')">' +
            '<div class="table-number">' + table.number + '</div>' +
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
      
      // PERFORMANS: requestAnimationFrame ile smooth DOM update
      requestAnimationFrame(() => {
        if (grid) grid.innerHTML = html;
      });
    }
    
    async function selectTable(id, name, type) {
      if (useImmersiveProductSearch) {
        forceCloseSultanImmersiveSearchNoAnim();
      }
      selectedTable = { id, name, type };
      schedulePrepareReceipts();
      renderTables();
      document.getElementById('tableSelection').style.display = 'none';
      document.getElementById('orderSection').style.display = 'block';
      var sultanOrderToolbarEl = document.getElementById('sultanOrderToolbar');
      if (sultanOrderToolbarEl) {
        sultanOrderToolbarEl.style.display = isSultanMobile ? 'flex' : 'none';
      }
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
      const immIn = document.getElementById('sultanImmersiveSearchInput');
      if (immIn) {
        immIn.value = '';
      }
      searchQuery = '';
      // Mevcut siparişleri yükle
      await loadExistingOrders(id);
      const orderSectionTransferItemsBtn = document.getElementById('orderSectionTransferItemsBtn');
      if (orderSectionTransferItemsBtn) {
        orderSectionTransferItemsBtn.style.display = !isSultanMobile && hasManagerPermission() ? 'flex' : 'none';
      }
      if (categories.length > 0) {
        // İlk kategoriyi seç (yan ürünler kategorisi değilse)
        const firstCategory = categories.find(c => c.id !== YAN_URUNLER_CATEGORY_ID) || categories[0];
        await selectCategory(firstCategory.id);
      }
    }
    
    async function loadExistingOrders(tableId) {
      if (isSultanMobile) {
        var eo = document.getElementById('existingOrders');
        if (eo) eo.style.display = 'none';
        return;
      }
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
      if (isSultanMobile) {
        if (ordersContainer) ordersContainer.style.display = 'none';
        return;
      }
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
          const itemNoteRaw = item.item_note && String(item.item_note).trim() ? String(item.item_note).trim() : '';
          const itemNoteBlock = itemNoteRaw
            ? '<div style="margin-top:8px;padding:8px 10px;background:#ecfdf5;border-radius:8px;border-left:3px solid #059669;font-size:12px;color:#065f46;font-weight:600;line-height:1.4;">📝 ' +
              itemNoteRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\\n/g, '<br/>') +
              '</div>'
            : '';
          return '<div class="order-item" style="position: relative;">' +
            '<div class="order-item-name' + giftClass + '">' + item.product_name + '</div>' +
            '<div class="order-item-details" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' +
              '<div style="display: flex; align-items: center; gap: 8px;">' +
                '<span class="order-item-qty">×' + item.quantity + '</span>' +
                '<span class="order-item-price">' + itemTotal + ' ₺</span>' +
              '</div>' +
              (canCancelExistingOrderLines()
                ? '<button id="cancelBtn_' + item.id + '" onclick="showCancelItemModal(' + item.id + ', ' + item.quantity + ', \\'' + item.product_name.replace(/'/g, "\\'") + '\\')" style="padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px;" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(239, 68, 68, 0.4)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'0 2px 8px rgba(239, 68, 68, 0.3)\\'; }" ontouchstart="if(!this.disabled) { this.style.transform=\\'scale(0.95)\\'; }" ontouchend="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; }" class="cancel-item-btn"><span id="cancelBtnText_' + item.id + '">İptal</span><svg id="cancelBtnSpinner_' + item.id + '" style="display: none; width: 14px; height: 14px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>'
                : '<button onclick="showManagerRequiredMessage()" style="padding: 6px 12px; background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px; opacity: 0.7;" onmouseover="this.style.opacity=\\'0.9\\';" onmouseout="this.style.opacity=\\'0.7\\';"><span>İptal</span></button>') +
            '</div>' +
          itemNoteBlock +
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
      if (useImmersiveProductSearch) {
        forceCloseSultanImmersiveSearchNoAnim();
      }
      const immClear = document.getElementById('sultanImmersiveSearchInput');
      if (immClear) {
        immClear.value = '';
      }
      selectedTable = null;
      document.getElementById('tableSelection').style.display = 'block';
      document.getElementById('tableTypeSelection').style.display = 'none';
      document.getElementById('orderSection').style.display = 'none';
      var sultanOrderToolbarEl = document.getElementById('sultanOrderToolbar');
      if (sultanOrderToolbarEl) {
        sultanOrderToolbarEl.style.display = 'none';
      }
      const cartEl = document.getElementById('cart');
      if (cartEl) {
        cartEl.style.display = 'none';
        cartEl.classList.remove('open');
      }
      const searchInputEl = document.getElementById('searchInput');
      if (searchInputEl) {
        searchInputEl.value = '';
      }
      searchQuery = '';
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
          const isOutside = table.type === 'outside' && !isSultanMobile;

          if (hasOrder || isSourceTable) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
              (isSourceTable ? '<span style="font-size: 9px; color: #dc2626; margin-top: 4px; font-weight: 600;">Kaynak</span>' : '') +
            '</div>';
          }
          
          const bgColor = isSultanMobile
            ? (isSelected ? '#d1fae5' : '#ecfdf5')
            : isOutside
            ? (isSelected ? '#fef3c7' : '#fffbeb')
            : (isSelected ? '#ede9fe' : '#faf5ff');
          const borderColor = isSultanMobile
            ? (isSelected ? '#10b981' : '#6ee7b7')
            : isOutside
            ? (isSelected ? '#fbbf24' : '#facc15')
            : (isSelected ? '#a855f7' : '#c4b5fd');
          const circleBg = isSultanMobile
            ? 'linear-gradient(135deg, #34d399 0%, #059669 100%)'
            : isOutside
            ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
            : '#f3f4f6';
          const nameColor = isSultanMobile ? '#064e3b' : isOutside ? '#92400e' : '#111827';
          const statusColor = isSultanMobile ? '#047857' : isOutside ? '#b45309' : '#4b5563';
          const circleText = isSultanMobile ? '#ffffff' : isOutside ? '#78350f' : '#4b5563';
          
          return '<button onclick="selectTargetTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + borderColor + '; border-radius: 12px; background: ' + bgColor + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(148, 163, 184, 0.3)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: ' + circleBg + '; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: ' + circleText + '; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);">' + table.number + '</div>' +
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
    
    // Ürün Aktar Modal Fonksiyonları
    async function showTransferItemsModal() {
      if (!hasManagerPermission()) {
        showToast('error', 'Yetki Yok', 'Bu işlem için müdür yetkisi gereklidir.');
        return;
      }
      if (!selectedTable || !selectedTable.id) {
        showToast('error', 'Hata', 'Lütfen önce bir masa seçin.');
        return;
      }
      transferItemsStep = 1;
      selectedTransferItemsSourceTableId = selectedTable.id;
      selectedTransferItemsTargetTableId = null;
      transferItemsQuantities = {};
      
      // Mevcut siparişi yükle
      try {
        const response = await fetch(API_URL + '/table-orders?tableId=' + encodeURIComponent(selectedTable.id));
        const orders = await response.json();
        if (!orders || orders.length === 0) {
          showToast('error', 'Hata', 'Bu masada sipariş bulunamadı.');
          return;
        }
        const order = orders[0];
        selectedTransferItemsSourceOrderId = order.id;
        currentOrderItems = order.items || [];
        document.getElementById('transferItemsModal').style.display = 'flex';
        // Modal render edilmesi için kısa bir gecikme
        setTimeout(() => {
          renderTransferItemsContent();
        }, 50);
      } catch (error) {
        console.error('Sipariş yükleme hatası:', error);
        showToast('error', 'Hata', 'Sipariş bilgileri yüklenemedi.');
      }
    }
    
    function hideTransferItemsModal() {
      document.getElementById('transferItemsModal').style.display = 'none';
      transferItemsStep = 1;
      selectedTransferItemsSourceTableId = null;
      selectedTransferItemsSourceOrderId = null;
      selectedTransferItemsTargetTableId = null;
      transferItemsQuantities = {};
      currentOrderItems = [];
    }
    
    function getTransferItemsKey(item) {
      return item.product_id + '_' + (item.isGift ? 'true' : 'false');
    }
    
    function getTransferableQty(item) {
      // Hem orijinal item'lar (quantity, paid_quantity) hem de gruplanmış item'lar (totalQty, paidQty) için çalışır
      const total = item.totalQty !== undefined ? item.totalQty : (item.quantity || 0);
      const paid = item.paidQty !== undefined ? item.paidQty : (item.paid_quantity || 0);
      return Math.max(0, total - paid);
    }
    
    function setTransferItemsQtyByKey(key, delta) {
      // Key için aktarılabilir maksimum adedi, tüm satırlardaki ödenmemiş miktar üzerinden hesapla
      // (mobil arayüzde aynı üründen birden fazla satır olduğunda 1 ile sınırlı kalma hatasını önler)
      const transferableItems = currentOrderItems.filter(item => getTransferableQty(item) > 0);
      if (transferableItems.length === 0) return;

      // Ürünleri grupla (aynı product_id ve isGift olanları birleştir)
      const groupedItems = {};
      transferableItems.forEach(item => {
        const itemKey = getTransferItemsKey(item);
        if (!groupedItems[itemKey]) {
          groupedItems[itemKey] = {
            product_id: item.product_id,
            product_name: item.product_name,
            isGift: item.isGift || false,
            price: item.price || 0,
            totalQty: 0,
            paidQty: 0
          };
        }
        groupedItems[itemKey].totalQty += (item.quantity || 0);
        groupedItems[itemKey].paidQty += (item.paid_quantity || 0);
      });

      const groupedItem = groupedItems[key];
      if (!groupedItem) return;

      const max = getTransferableQty(groupedItem);
      const current = Math.max(0, Math.min(max, (transferItemsQuantities[key] || 0) + delta));
      transferItemsQuantities[key] = current;
      renderTransferItemsContent();
    }
    
    function getSelectedTransferTotal() {
      return Object.values(transferItemsQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
    }
    
    function renderTransferItemsContent() {
      const content = document.getElementById('transferItemsModalContent');
      const title = document.getElementById('transferItemsModalTitle');
      const subtitle = document.getElementById('transferItemsModalSubtitle');
      const backBtn = document.getElementById('transferItemsBackBtn');
      const confirmBtn = document.getElementById('transferItemsConfirmBtn');
      const cancelBtn = document.getElementById('transferItemsCancelBtn');
      
      if (!content || !title || !subtitle || !backBtn || !confirmBtn || !cancelBtn) {
        console.error('Modal elementleri bulunamadı');
        return;
      }
      
      if (transferItemsStep === 1) {
        // Adım 1: Ürün/adet seçimi
        title.textContent = 'Ürünleri aktar';
        subtitle.textContent = 'Aktarılacak ürünleri ve adetleri seçin (yalnızca ödenmemiş adetler)';
        backBtn.style.display = 'none';
        confirmBtn.style.display = 'none';
        cancelBtn.style.display = 'block';
        
        const transferableItems = currentOrderItems.filter(item => getTransferableQty(item) > 0);
        
        if (transferableItems.length === 0) {
          content.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px 20px;">Aktarılabilir (ödenmemiş) ürün yok.</p>';
          return;
        }
        
        // Ürünleri grupla (aynı product_id ve isGift olanları birleştir)
        const groupedItems = {};
        transferableItems.forEach(item => {
          const key = getTransferItemsKey(item);
          if (!groupedItems[key]) {
            groupedItems[key] = {
              product_id: item.product_id,
              product_name: item.product_name,
              isGift: item.isGift || false,
              price: item.price || 0,
              totalQty: 0,
              paidQty: 0
            };
          }
          groupedItems[key].totalQty += (item.quantity || 0);
          groupedItems[key].paidQty += (item.paid_quantity || 0);
        });
        
        const itemsHtml = Object.values(groupedItems).map(item => {
          const key = getTransferItemsKey(item);
          const maxQty = getTransferableQty(item);
          const current = Math.min(maxQty, transferItemsQuantities[key] || 0);
          const productIdStr = String(item.product_id).replace(/'/g, "\\'");
          const isGiftStr = item.isGift ? 'true' : 'false';
          
          const minusDisabled = current <= 0;
          const plusDisabled = current >= maxQty;
          
          return '<div style="display: flex; align-items: center; justify-between; gap: 12px; padding: 12px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 8px;">' +
            '<div style="flex: 1; min-width: 0;">' +
              '<p style="font-semibold text-gray-900; margin: 0 0 4px 0; font-size: 14px;">' + (item.product_name || 'Ürün').replace(/'/g, "\\'") + '</p>' +
              '<p style="text-xs text-gray-500; margin: 0;">En fazla ' + maxQty + ' adet</p>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
              '<button onclick="setTransferItemsQtyByKey(\\'' + key + '\\', -1)" ' + (minusDisabled ? 'disabled' : '') + ' style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #d1d5db; background: white; font-bold; color: #374151; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;' + (minusDisabled ? ' opacity: 0.4; cursor: not-allowed;' : '') + '"' + (minusDisabled ? '' : ' onmouseover="this.style.background=\\'#f3f4f6\\';" onmouseout="this.style.background=\\'white\\';"') + '>−</button>' +
              '<span style="width: 40px; text-align: center; font-bold text-gray-900; font-size: 16px;">' + current + '</span>' +
              '<button onclick="setTransferItemsQtyByKey(\\'' + key + '\\', 1)" ' + (plusDisabled ? 'disabled' : '') + ' style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #d1d5db; background: white; font-bold; color: #374151; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;' + (plusDisabled ? ' opacity: 0.4; cursor: not-allowed;' : '') + '"' + (plusDisabled ? '' : ' onmouseover="this.style.background=\\'#f3f4f6\\';" onmouseout="this.style.background=\\'white\\';"') + '>+</button>' +
            '</div>' +
          '</div>';
        }).join('');
        
        const selectedTotal = getSelectedTransferTotal();
        content.innerHTML = '<div style="margin-bottom: 12px;"><p style="text-xs font-semibold text-gray-500 uppercase tracking-wide; margin: 0 0 8px 0;">Aktarılacak adet (ödenmemiş)</p></div>' +
          '<div style="max-height: 400px; overflow-y: auto;">' + itemsHtml + '</div>' +
          '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">' +
            '<p style="text-sm font-semibold text-gray-600; margin: 0;">Seçilen: <span style="color: #8b5cf6; font-weight: 700;">' + selectedTotal + ' adet</span></p>' +
          '</div>';
        
        if (selectedTotal > 0) {
          confirmBtn.textContent = 'Hedef masa seç';
          confirmBtn.style.display = 'block';
        }
      } else if (transferItemsStep === 2) {
        // Adım 2: Hedef masa seçimi
        title.textContent = 'Hedef masa seçin';
        subtitle.textContent = 'Ürünlerin aktarılacağı masayı seçin';
        backBtn.style.display = 'block';
        confirmBtn.style.display = selectedTransferItemsTargetTableId ? 'block' : 'none';
        confirmBtn.textContent = 'Aktar ve yazdır';
        cancelBtn.style.display = 'none';
        
        const allTables = [...tables];
        const sourceTable = allTables.find(t => t.id === selectedTransferItemsSourceTableId);
        
        const tablesHtml = allTables.map(table => {
          const isSelected = selectedTransferItemsTargetTableId === table.id;
          const isSourceTable = selectedTransferItemsSourceTableId === table.id;
          
          if (isSourceTable) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
              '<span style="font-size: 9px; color: #dc2626; margin-top: 4px; font-weight: 600;">Kaynak</span>' +
            '</div>';
          }
          
          const bgColor = isSelected ? '#ede9fe' : '#faf5ff';
          const borderColor = isSelected ? '#a855f7' : '#c4b5fd';
          
          return '<button onclick="selectTransferItemsTargetTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + borderColor + '; border-radius: 12px; background: ' + bgColor + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(148, 163, 184, 0.3)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: #4b5563; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: #111827; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: #4b5563; margin-top: 4px; font-weight: 600;">' + (table.hasOrder ? 'Dolu' : 'Boş') + '</span>' +
          '</button>';
        }).join('');
        
        content.innerHTML = '<p style="text-xs font-semibold text-gray-500 uppercase tracking-wide; margin: 0 0 12px 0;">Hedef masa (mevcut masa hariç)</p>' +
          '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-height: 400px; overflow-y: auto;">' + tablesHtml + '</div>';
      }
    }
    
    
    function selectTransferItemsTargetTable(tableId) {
      if (tableId === selectedTransferItemsSourceTableId) {
        showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
        return;
      }
      selectedTransferItemsTargetTableId = tableId;
      renderTransferItemsContent();
    }
    
    function handleTransferItemsBack() {
      if (transferItemsStep === 2) {
        transferItemsStep = 1;
        selectedTransferItemsTargetTableId = null;
        renderTransferItemsContent();
      }
    }
    
    async function handleTransferItemsConfirm() {
      if (transferItemsStep === 1) {
        // Adım 1'den Adım 2'ye geç
        const selectedTotal = getSelectedTransferTotal();
        if (selectedTotal <= 0) {
          showToast('error', 'Hata', 'Lütfen en az bir ürün seçin.');
          return;
        }
        transferItemsStep = 2;
        renderTransferItemsContent();
      } else if (transferItemsStep === 2) {
        // Adım 2: Aktarımı gerçekleştir
        if (!selectedTransferItemsSourceOrderId || !selectedTransferItemsTargetTableId) {
          showToast('error', 'Hata', 'Lütfen hedef masayı seçin.');
          return;
        }
        
        if (selectedTransferItemsSourceTableId === selectedTransferItemsTargetTableId) {
          showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
          return;
        }
        
        if (!hasManagerPermission()) {
          showToast('error', 'Yetki Yok', 'Bu işlem için müdür yetkisi gereklidir.');
          return;
        }
        
        // Seçilen ürünleri hazırla
        const itemsToTransfer = [];
        Object.keys(transferItemsQuantities).forEach(key => {
          const qty = transferItemsQuantities[key];
          if (qty > 0) {
            const [productId, isGiftStr] = key.split('_');
            const isGift = isGiftStr === 'true';
            const item = currentOrderItems.find(i => 
              String(i.product_id) === productId && 
              (!!i.isGift) === isGift
            );
            if (item) {
              itemsToTransfer.push({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: qty,
                price: item.price,
                isGift: isGift,
                staff_name: item.staff_name || null
              });
            }
          }
        });
        
        if (itemsToTransfer.length === 0) {
          showToast('error', 'Hata', 'Aktarılacak ürün bulunamadı.');
          return;
        }
        
        try {
          const transferResponse = await fetch(API_URL + '/transfer-order-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceOrderId: selectedTransferItemsSourceOrderId,
              targetTableId: selectedTransferItemsTargetTableId,
              itemsToTransfer: itemsToTransfer,
              staffId: currentStaff.id
            })
          });
          
          const result = await transferResponse.json();
          
          if (result.success) {
            showToast('success', 'Başarılı', 'Ürünler başarıyla aktarıldı!');
            hideTransferItemsModal();
            // Siparişleri yenile
            if (selectedTable) {
              await loadExistingOrders(selectedTable.id);
            }
            const tablesRes = await fetch(API_URL + '/tables');
            tables = await tablesRes.json();
            renderTables();
          } else {
            showToast('error', 'Hata', result.error || 'Ürünler aktarılamadı');
          }
        } catch (error) {
          console.error('Ürün aktarım hatası:', error);
          showToast('error', 'Hata', 'Ürünler aktarılırken bir hata oluştu');
        }
      }
    }
    
    // Masa Birleştir Modal Fonksiyonları
    function showMergeModal() {
      if (!hasManagerPermission()) {
        showToast('error', 'Yetki Yok', 'Bu işlem için müdür yetkisi gereklidir.');
        return;
      }
      mergeStep = 1;
      selectedMergeSourceTableId = null;
      selectedMergeTargetTableId = null;
      document.getElementById('mergeModal').style.display = 'flex';
      renderMergeTables();
    }
    
    function hideMergeModal() {
      document.getElementById('mergeModal').style.display = 'none';
      mergeStep = 1;
      selectedMergeSourceTableId = null;
      selectedMergeTargetTableId = null;
    }
    
    function renderMergeTables() {
      const grid = document.getElementById('mergeTablesGrid');
      const allTables = [...tables];
      
      if (mergeStep === 1) {
        document.getElementById('mergeModalTitle').textContent = 'Masa Birleştir - Adım 1';
        document.getElementById('mergeModalSubtitle').textContent = 'Kaynak masayı seçin';
        document.getElementById('mergeModalDescription').textContent = 'Lütfen birleştirilecek kaynak masayı seçin:';
        document.getElementById('mergeBackBtn').style.display = 'none';
        document.getElementById('mergeConfirmBtn').style.display = 'none';
        document.getElementById('mergeCancelBtn').style.display = 'block';
        
        const html = allTables.map(table => {
          const hasOrder = table.hasOrder;
          const isSelected = selectedMergeSourceTableId === table.id;
          
          if (!hasOrder) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
            '</div>';
          }
          
          return '<button onclick="selectMergeSourceTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + (isSelected ? '#059669' : '#10b981') + '; border-radius: 12px; background: ' + (isSelected ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(16, 185, 129, 0.45)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #059669 0%, #047857 100%); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.6);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: #ecfdf5; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: #a7f3d0; margin-top: 4px; font-weight: 600;">Dolu</span>' +
          '</button>';
        }).join('');
        
        grid.innerHTML = html;
      } else {
        document.getElementById('mergeModalTitle').textContent = 'Masa Birleştir - Adım 2';
        document.getElementById('mergeModalSubtitle').textContent = 'Hedef masayı seçin';
        const sourceTable = allTables.find(t => t.id === selectedMergeSourceTableId);
        document.getElementById('mergeModalDescription').textContent = 'Lütfen birleştirilecek hedef masayı seçin (dolu olmalı):';
        document.getElementById('mergeBackBtn').style.display = 'block';
        document.getElementById('mergeConfirmBtn').style.display = selectedMergeTargetTableId ? 'block' : 'none';
        document.getElementById('mergeCancelBtn').style.display = 'none';
        
        const html = allTables.map(table => {
          const hasOrder = table.hasOrder;
          const isSelected = selectedMergeTargetTableId === table.id;
          const isSourceTable = selectedMergeSourceTableId === table.id;
          
          if (isSourceTable || !hasOrder) {
            return '<div style="opacity: 0.3; cursor: not-allowed; padding: 12px; border: 2px solid #d1d5db; border-radius: 12px; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px;">' +
              '<div style="width: 40px; height: 40px; border-radius: 50%; background: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px;">' + table.number + '</div>' +
              '<span style="font-size: 11px; color: #6b7280; font-weight: 600;">' + table.name + '</span>' +
              (isSourceTable ? '<span style="font-size: 9px; color: #dc2626; margin-top: 4px; font-weight: 600;">Kaynak</span>' : '<span style="font-size: 9px; color: #6b7280; margin-top: 4px; font-weight: 600;">Boş</span>') +
            '</div>';
          }
          
          return '<button onclick="selectMergeTargetTable(\\'' + table.id + '\\')" style="padding: 12px; border: 2px solid ' + (isSelected ? '#059669' : '#10b981') + '; border-radius: 12px; background: ' + (isSelected ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') + '; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; transition: all 0.3s; transform: ' + (isSelected ? 'scale(1.05)' : 'scale(1)') + ';" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(16, 185, 129, 0.45)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\'; }" ' + (isSelected ? 'disabled' : '') + '>' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #059669 0%, #047857 100%); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.6);">' + table.number + '</div>' +
            '<span style="font-size: 11px; color: #ecfdf5; font-weight: 700;">' + table.name + '</span>' +
            '<span style="font-size: 9px; color: #a7f3d0; margin-top: 4px; font-weight: 600;">Dolu</span>' +
          '</button>';
        }).join('');
        
        grid.innerHTML = html;
      }
    }
    
    function selectMergeSourceTable(tableId) {
      const table = tables.find(t => t.id === tableId);
      if (!table || !table.hasOrder) {
        showToast('error', 'Hata', 'Bu masa boş! Lütfen dolu bir masa seçin.');
        return;
      }
      selectedMergeSourceTableId = tableId;
      mergeStep = 2;
      renderMergeTables();
    }
    
    function selectMergeTargetTable(tableId) {
      const table = tables.find(t => t.id === tableId);
      if (!table || !table.hasOrder) {
        showToast('error', 'Hata', 'Bu masa boş! Lütfen dolu bir masa seçin.');
        return;
      }
      if (tableId === selectedMergeSourceTableId) {
        showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
        return;
      }
      selectedMergeTargetTableId = tableId;
      document.getElementById('mergeConfirmBtn').style.display = 'block';
      renderMergeTables();
    }
    
    function handleMergeBack() {
      mergeStep = 1;
      selectedMergeTargetTableId = null;
      renderMergeTables();
    }
    
    async function handleMergeConfirm() {
      if (!selectedMergeSourceTableId || !selectedMergeTargetTableId) {
        showToast('error', 'Hata', 'Lütfen hem kaynak hem de hedef masayı seçin.');
        return;
      }
      
      if (selectedMergeSourceTableId === selectedMergeTargetTableId) {
        showToast('error', 'Hata', 'Aynı masayı seçemezsiniz!');
        return;
      }
      
      if (!hasManagerPermission()) {
        showToast('error', 'Yetki Yok', 'Bu işlem için müdür yetkisi gereklidir.');
        return;
      }
      
      try {
        const response = await fetch(API_URL + '/merge-table-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTableId: selectedMergeSourceTableId,
            targetTableId: selectedMergeTargetTableId,
            staffId: currentStaff.id
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast('success', 'Başarılı', 'Masalar başarıyla birleştirildi!');
          hideMergeModal();
          const tablesRes = await fetch(API_URL + '/tables');
          tables = await tablesRes.json();
          renderTables();
        } else {
          showToast('error', 'Hata', result.error || 'Masalar birleştirilemedi');
        }
      } catch (error) {
        console.error('Masa birleştirme hatası:', error);
        showToast('error', 'Hata', 'Masalar birleştirilirken bir hata oluştu');
      }
    }
    
    function renderCategories() {
      const row1 = document.getElementById('categoryTabsRow1');
      const row2 = document.getElementById('categoryTabsRow2');
      const row3 = document.getElementById('categoryTabsRow3');
      if (!row1 || !row2 || !row3) return;
      
      row1.innerHTML = '';
      row2.innerHTML = '';
      row3.innerHTML = '';
      
      var catList = categories;
      if (isSultanMobile) {
        catList = categories.filter(function (c) {
          var n = Number(c.id);
          if (n === 999999 || n === -999) return false;
          var nm = (c.name && String(c.name).trim().toLowerCase()) || '';
          return nm !== 'yan ürünler' && nm !== 'yan urunler';
        });
      }
      
      var sorted = catList.slice().sort(function (a, b) {
        var oa = typeof a.order_index === 'number' ? a.order_index : parseInt(a.order_index, 10) || 0;
        var ob = typeof b.order_index === 'number' ? b.order_index : parseInt(b.order_index, 10) || 0;
        if (oa !== ob) return oa - ob;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });
      
      var n = sorted.length;
      var chunk0 = [];
      var chunk1 = [];
      var chunk2 = [];
      if (n > 0) {
        if (isSultanMobile) {
          /* Sultan: sırayı bozmadan 3 satıra böl (soldan sağa okunur); kompakt pill ile daha çok sığar */
          var perRow = Math.ceil(sorted.length / 3);
          chunk0 = sorted.slice(0, perRow);
          chunk1 = sorted.slice(perRow, perRow * 2);
          chunk2 = sorted.slice(perRow * 2);
        } else {
        function cmpOrder(a, b) {
          var oa = typeof a.order_index === 'number' ? a.order_index : parseInt(a.order_index, 10) || 0;
          var ob = typeof b.order_index === 'number' ? b.order_index : parseInt(b.order_index, 10) || 0;
          if (oa !== ob) return oa - ob;
          return (Number(a.id) || 0) - (Number(b.id) || 0);
        }
        /* Selçuklu Mevlevi Mutfağı — Ara Sıcaklar + Çorbalar 3. satırda */
        function isSelcukluMevleviPinnedRow3(cat) {
          var raw = (cat.name && String(cat.name).toLowerCase()) || '';
          if (raw.indexOf('selçuklu') === -1 && raw.indexOf('selcuklu') === -1) return false;
          if (raw.indexOf('mevlevi') === -1) return false;
          var araSicak = (raw.indexOf('ara') !== -1) && (raw.indexOf('sıcak') !== -1 || raw.indexOf('sicak') !== -1);
          var corba = raw.indexOf('çorba') !== -1 || raw.indexOf('corba') !== -1;
          return araSicak || corba;
        }
        function estimateTabWidth(cat) {
          var nm = (cat.name && String(cat.name)) || '';
          return nm.length * 13 + 52;
        }
        var pinned = [];
        var rest = [];
        for (var pi = 0; pi < sorted.length; pi++) {
          if (isSelcukluMevleviPinnedRow3(sorted[pi])) pinned.push(sorted[pi]);
          else rest.push(sorted[pi]);
        }
        var rows = [[], [], []];
        var rowWeight = [0, 0, 0];
        for (var ri = 0; ri < rest.length; ri++) {
          var c = rest[ri];
          var w = estimateTabWidth(c);
          var pick = 0;
          if (rowWeight[1] < rowWeight[pick]) pick = 1;
          if (rowWeight[2] < rowWeight[pick]) pick = 2;
          rows[pick].push(c);
          rowWeight[pick] += w;
        }
        for (var pj = 0; pj < pinned.length; pj++) {
          rows[2].push(pinned[pj]);
        }
        rows[0].sort(cmpOrder);
        rows[1].sort(cmpOrder);
        rows[2].sort(cmpOrder);
        chunk0 = rows[0];
        chunk1 = rows[1];
        chunk2 = rows[2];
        }
      }
      
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
      
      function categoryTabButtonHtml(cat) {
        const isActive = selectedCategoryId === cat.id;
        if (isSultanMobile) {
          var nm = (cat.name && String(cat.name)) || '';
          nm = nm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return '<button type="button" class="category-tab category-tab--sultan' + (isActive ? ' active' : '') + '" onclick="selectCategory(' + cat.id + ')">' + nm + '</button>';
        }
        const colors = getCategoryColor(cat.id);
        const activeBg = colors.hover;
        const activeBorder = colors.border;
        return '<button class="category-tab ' + (isActive ? 'active' : '') + '" onclick="selectCategory(' + cat.id + ')" style="background: ' + (isActive ? activeBg : colors.bg) + '; border-color: ' + (isActive ? activeBorder : colors.border) + '; color: ' + colors.text + '; box-shadow: 0 2px 8px rgba(0,0,0,0.08); font-weight: ' + (isActive ? '700' : '600') + ';" onmouseover="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.hover + '\\'; this.style.transform=\\'translateY(-2px)\\'; }" onmouseout="if(!this.classList.contains(\\'active\\')) { this.style.background=\\'' + colors.bg + '\\'; this.style.transform=\\'translateY(0)\\'; }">' + cat.name + '</button>';
      }
      
      function fillCategoryRow(el, rowCats) {
        if (!el) return;
        if (!rowCats.length) {
          el.style.display = 'none';
          el.innerHTML = '';
          return;
        }
        el.style.display = 'flex';
        el.style.gridTemplateColumns = '';
        el.innerHTML = rowCats.map(categoryTabButtonHtml).join('');
      }
      
      fillCategoryRow(row1, chunk0);
      fillCategoryRow(row2, chunk1);
      fillCategoryRow(row3, chunk2);
    }
    
    // PERFORMANS: Kategori bazlı ürün cache'i - aynı kategoriye tekrar tıklanınca API çağrısı yapma
    const categoryProductsCache = {};
    
    async function selectCategory(categoryId) {
      // PERFORMANS: Aynı kategori tekrar seçilirse hiçbir şey yapma
      if (selectedCategoryId === categoryId && categoryProductsCache[categoryId]) {
        return;
      }
      
      selectedCategoryId = categoryId;
      renderCategories();
      
      // Cache'de varsa oradan yükle (API çağrısı yapma)
      if (categoryProductsCache[categoryId]) {
        products = categoryProductsCache[categoryId];
        renderProducts();
        return;
      }
      
      // Yan Ürünler kategorisi seçildiyse yan ürünleri yükle
      if (categoryId === YAN_URUNLER_CATEGORY_ID) {
        try {
          const response = await fetch(API_URL + '/products?category_id=' + YAN_URUNLER_CATEGORY_ID);
          yanUrunler = await response.json();
          products = yanUrunler;
          categoryProductsCache[categoryId] = products; // Cache'e ekle
        } catch (error) {
          console.error('Yan ürünler yüklenirken hata:', error);
          products = [];
        }
      } else {
        // Normal kategoriler için ürünleri yükle
        try {
          const response = await fetch(API_URL + '/products?category_id=' + categoryId);
          products = await response.json();
          categoryProductsCache[categoryId] = products; // Cache'e ekle
        } catch (error) {
          console.error('Ürünler yüklenirken hata:', error);
          products = [];
        }
      }
      
      renderProducts();
    }
    
    let searchQuery = '';
    
    function isSultanImmersiveSearchOpen() {
      return document.body.classList.contains('sultan-immersive-search-open');
    }
    
    function syncSearchFromActiveInput() {
      const imm = document.getElementById('sultanImmersiveSearchInput');
      const main = document.getElementById('searchInput');
      if (isSultanImmersiveSearchOpen() && imm) {
        return (imm.value || '').toLowerCase().trim();
      }
      return main ? (main.value || '').toLowerCase().trim() : '';
    }
    
    function filterProducts() {
      searchQuery = syncSearchFromActiveInput();
      renderProducts();
    }
    
    function ensureSultanImmersiveProductsRestored() {
      const grid = document.getElementById('productsGrid');
      const wrap = document.getElementById('productsGridScrollWrap');
      const mount = document.getElementById('sultanImmersiveProductsMount');
      if (!grid || !wrap || !mount) return;
      if (grid.parentNode === mount) {
        wrap.appendChild(grid);
      }
      wrap.classList.remove('sultan-grid-placeholder');
    }
    
    /** Tam ekran aramadan çıkınca metni sil (yalnızca arama sırasında görünsün) */
    function resetSultanImmersiveSearchText() {
      const imm = document.getElementById('sultanImmersiveSearchInput');
      const main = document.getElementById('searchInput');
      if (imm) imm.value = '';
      if (main) main.value = '';
      searchQuery = '';
    }
    
    function forceCloseSultanImmersiveSearchNoAnim() {
      if (!useImmersiveProductSearch) return;
      const overlay = document.getElementById('sultanImmersiveSearchOverlay');
      if (overlay) {
        overlay.classList.remove('sultan-immersive-overlay--open');
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('sultan-immersive-search-open');
      resetSultanImmersiveSearchText();
      ensureSultanImmersiveProductsRestored();
      filterProducts();
    }
    
    function closeSultanImmersiveSearch() {
      if (!useImmersiveProductSearch) return;
      const overlay = document.getElementById('sultanImmersiveSearchOverlay');
      if (!overlay) return;
      resetSultanImmersiveSearchText();
      overlay.classList.remove('sultan-immersive-overlay--open');
      document.body.classList.remove('sultan-immersive-search-open');
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        ensureSultanImmersiveProductsRestored();
        filterProducts();
      }, 320);
    }
    
    function openSultanImmersiveSearch() {
      if (!useImmersiveProductSearch) return;
      const overlay = document.getElementById('sultanImmersiveSearchOverlay');
      const mount = document.getElementById('sultanImmersiveProductsMount');
      const grid = document.getElementById('productsGrid');
      const wrap = document.getElementById('productsGridScrollWrap');
      const imm = document.getElementById('sultanImmersiveSearchInput');
      const main = document.getElementById('searchInput');
      if (!overlay || !mount || !grid || !wrap || !imm) return;
      imm.value = '';
      if (main) main.value = '';
      searchQuery = '';
      wrap.classList.add('sultan-grid-placeholder');
      mount.appendChild(grid);
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sultan-immersive-search-open');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.add('sultan-immersive-overlay--open');
        });
      });
      renderProducts();
      setTimeout(() => {
        imm.focus();
        try {
          imm.select();
        } catch (e) {}
      }, 400);
    }
    
    function initSultanImmersiveSearchUI() {
      if (!useImmersiveProductSearch) return;
      const openBtn = document.getElementById('sultanOpenImmersiveSearchBtn');
      const closeBtn = document.getElementById('sultanImmersiveSearchCloseBtn');
      const imm = document.getElementById('sultanImmersiveSearchInput');
      if (openBtn) {
        openBtn.addEventListener('click', openSultanImmersiveSearch);
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', closeSultanImmersiveSearch);
      }
      if (imm) {
        imm.addEventListener('input', filterProducts);
      }
      const overlay = document.getElementById('sultanImmersiveSearchOverlay');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            closeSultanImmersiveSearch();
          }
        });
      }
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
    
    // PERFORMANS: Render throttling
    let renderProductsScheduled = false;
    async function renderProducts() {
      if (renderProductsScheduled) return;
      renderProductsScheduled = true;
      
      requestAnimationFrame(async () => {
        renderProductsScheduled = false;
        
        const gridEarly = document.getElementById('productsGrid');
        if (!gridEarly) return;
        // Kart yeniden render olurken aktif kart durumunu sıfırla
        if (isSultanMobile) sultanActiveCardId = null;
        if (useImmersiveProductSearch && isSultanImmersiveSearchOpen() && !searchQuery) {
          gridEarly.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #64748b; font-size: 16px; font-weight: 600; line-height: 1.5;">Aramak istediğiniz ürünün adını yukarıdaki kutuya yazın.</div>';
          return;
        }
        
        let filtered;
        
        // Arama sorgusu varsa tüm kategorilerden ara, yoksa sadece seçili kategoriden göster
        if (searchQuery) {
        // Arama yapıldığında tüm kategorilerden ara
        // Yan ürünler kategorisi seçiliyse yan ürünlerden ara, değilse normal ürünlerden ara
        if (selectedCategoryId === YAN_URUNLER_CATEGORY_ID) {
          filtered = products.filter(p => 
            p.name.toLowerCase().includes(searchQuery)
          );
        } else {
          // Tüm ürünleri yükle (arama için)
          try {
            const allProductsRes = await fetch(API_URL + '/products');
            const allProducts = await allProductsRes.json();
            // Yan ürünleri de ekle
            const yanUrunlerRes = await fetch(API_URL + '/products?category_id=' + YAN_URUNLER_CATEGORY_ID);
            const yanUrunler = await yanUrunlerRes.json();
            const allProductsWithYanUrunler = [...allProducts, ...yanUrunler];
            filtered = allProductsWithYanUrunler.filter(p => 
              p.name.toLowerCase().includes(searchQuery)
            );
          } catch (error) {
            console.error('Arama için ürünler yüklenirken hata:', error);
            filtered = products.filter(p => 
              p.name.toLowerCase().includes(searchQuery)
            );
          }
        }
      } else {
        // Arama yoksa sadece seçili kategoriden göster
        filtered = products.filter(p => {
          if (selectedCategoryId === YAN_URUNLER_CATEGORY_ID) {
            return p.category_id === YAN_URUNLER_CATEGORY_ID || p.isYanUrun;
          }
          return p.category_id === selectedCategoryId;
        });
      }
      
      const grid = document.getElementById('productsGrid');
      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">Ürün bulunamadı</div>';
        return;
      }
      
      // PERFORMANS: Önce ürünleri hemen göster (resimler lazy load)
      grid.innerHTML = filtered.map(prod => {
        const cardId = 'product-card-' + prod.id;
        // Cache'de varsa hemen göster, yoksa placeholder
        const cachedImageUrl = prod.image && imageCache[prod.image] ? imageCache[prod.image] : null;
        const backgroundStyle = isSultanMobile
          ? 'background: #ffffff;'
          : (cachedImageUrl ? 'background-image: url(' + cachedImageUrl + ');' : 'background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);');
        const trackStock = prod.trackStock === true;
        const stock = trackStock && prod.stock !== undefined ? (prod.stock || 0) : null;
        const isOutOfStock = trackStock && stock !== null && stock === 0;
        const isLowStock = trackStock && stock !== null && stock > 0 && stock <= 5;
        // Türk Kahvesi ve Menengiç Kahve için özel modal açma
        const isTurkishCoffee = prod.name.toLowerCase().includes('türk kahvesi') || prod.name.toLowerCase().includes('turk kahvesi');
        const isMenengicCoffee = prod.name.toLowerCase().includes('menengiç kahve') || prod.name.toLowerCase().includes('menengic kahve');
        const needsCoffeeModal = isTurkishCoffee || isMenengicCoffee;
        // ID'yi string olarak geç (yan ürünler için gerekli)
        const productIdStr = typeof prod.id === 'string' ? '\\'' + prod.id + '\\'' : prod.id;
        const escapedName = prod.name.replace(/'/g, "\\'");
        const onClickHandler = isOutOfStock ? '' : (needsCoffeeModal
          ? 'onclick="showTurkishCoffeeModal(' + productIdStr + ', \\'' + escapedName + '\\', ' + prod.price + ')"'
          : (isSultanMobile
              ? 'onclick="toggleSultanCard(' + productIdStr + ', \\'' + escapedName + '\\', ' + prod.price + ', \\'' + cardId + '\\')"'
              : 'onclick="addToCart(' + productIdStr + ', \\'' + escapedName + '\\', ' + prod.price + ')"'));
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

        // Sultan Somatı: sağ üst köşe miktar kontrolü (dikey, büyük, modern) — anlık sepet
        const sultanInlineQty = (isSultanMobile && !isOutOfStock && !needsCoffeeModal)
          ? '<div id="' + cardId + '-sqr" style="position:absolute;top:8px;right:8px;display:none;flex-direction:column;align-items:center;background:#fff;border:1.5px solid #a7f3d0;border-radius:14px;overflow:hidden;box-shadow:0 3px 14px rgba(5,150,105,0.22);z-index:5;min-width:36px;">' +
            '<button onclick="event.stopPropagation();sultanCardInc(' + productIdStr + ', \\'' + escapedName + '\\', ' + prod.price + ', \\'' + cardId + '\\')" style="width:36px;height:34px;border:none;border-bottom:1.5px solid #a7f3d0;background:#059669;font-size:20px;font-weight:700;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;touch-action:manipulation;">+</button>' +
            '<span id="' + cardId + '-sqv" style="font-size:16px;font-weight:900;color:#065f46;width:36px;text-align:center;height:32px;line-height:32px;background:#f0fdf4;letter-spacing:-0.5px;">1</span>' +
            '<button onclick="event.stopPropagation();sultanCardDec(' + productIdStr + ', \\'' + escapedName + '\\', ' + prod.price + ', \\'' + cardId + '\\')" style="width:36px;height:34px;border:none;border-top:1.5px solid #a7f3d0;background:#fff;font-size:22px;font-weight:500;cursor:pointer;color:#059669;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;touch-action:manipulation;">−</button>' +
            '</div>'
          : '';

        // Sultan Somatı: sol alt köşe not butonu
        const sultanNoteBtn = (isSultanMobile && !isOutOfStock && !needsCoffeeModal)
          ? '<button onclick="event.stopPropagation();openSultanNote(' + productIdStr + ', \\'' + escapedName + '\\', \\'' + cardId + '\\')" style="position:relative;width:28px;height:28px;border-radius:50%;border:1.5px solid #e2e8f0;background:#f8fafc;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;">' +
            '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="2.2" cy="6.5" r="1.2" fill="#94a3b8"/><circle cx="6.5" cy="6.5" r="1.2" fill="#94a3b8"/><circle cx="10.8" cy="6.5" r="1.2" fill="#94a3b8"/></svg>' +
            '<span id="' + cardId + '-ni" style="display:none;position:absolute;top:-1px;right:-1px;width:7px;height:7px;background:#059669;border-radius:50%;border:1.5px solid #fff;"></span>' +
            '</button>'
          : '';

        // Kart HTML — Sultan mobile için yeni düzen, diğerleri için eski düzen
        if (isSultanMobile && !isOutOfStock && !needsCoffeeModal) {
          return '<div id="' + cardId + '" class="product-card" ' + onClickHandler + ' style="' + cardStyle + ' position: relative; overflow: hidden; display:flex; flex-direction:column;">' +
            lockIcon +
            sultanInlineQty +
            '<div class="product-name" style="padding-right:72px;">' + prod.name + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:8px;">' +
              sultanNoteBtn +
              '<div class="product-price">' + prod.price.toFixed(2) + ' ₺</div>' +
            '</div>' +
            stockBadge +
          '</div>';
        }

        return '<div id="' + cardId + '" class="product-card" ' + onClickHandler + ' style="' + cardStyle + ' position: relative; overflow: hidden;">' +
          lockIcon +
          '<div class="product-name" style="' + (isOutOfStock ? 'opacity: 0.7;' : '') + '">' + prod.name + '</div>' +
          '<div class="product-price" style="' + (isOutOfStock ? 'opacity: 0.7;' : '') + '">' + prod.price.toFixed(2) + ' ₺</div>' +
          sultanInlineQty +
          stockBadge +
        '</div>';
      }).join('');
      
      // PERFORMANS: Resimleri akıllı yükleme - sadece yoksa yükle, hızlı batch'ler
      // Sultan Somatı: kartlar düz beyaz; ürün görseli arka planda kullanılmaz
      const productsToLoad = isSultanMobile
        ? []
        : filtered.filter(prod => prod.image && !imageCache[prod.image]);
      const priorityProducts = productsToLoad.slice(0, 8); // İlk 8 ürün öncelikli
      const otherProducts = productsToLoad.slice(8);
      
      const loadProductImage = async (prod) => {
        try {
          const blobUrl = await cacheImage(prod.image);
          if (blobUrl) {
            const card = document.getElementById('product-card-' + prod.id);
            if (card) {
              // requestAnimationFrame ile smooth güncelleme
              requestAnimationFrame(() => {
                if (card) card.style.backgroundImage = 'url(' + blobUrl + ')';
              });
            }
          }
        } catch (error) {
          console.error('Resim yükleme hatası:', error);
        }
      };
      
      // Öncelikli ürünleri 4'erli batch'lerde hemen yükle
      for (let i = 0; i < priorityProducts.length; i += 4) {
        const batch = priorityProducts.slice(i, i + 4);
        Promise.all(batch.map(loadProductImage)).catch(() => {});
      }
      
      // Diğer ürünleri lazy load - daha büyük batch'ler (8'erli)
      for (let i = 0; i < otherProducts.length; i += 8) {
        const batch = otherProducts.slice(i, i + 8);
        setTimeout(() => {
          Promise.all(batch.map(loadProductImage)).catch(() => {});
        }, 100 * (Math.floor(i / 8) + 1));
      }
      });
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
      // Özel prefix'leri koru (Double, Triple vb.)
      // "Double Türk Kahvesi" -> "Double Şekerli Türk Kahvesi"
      // "Türk Kahvesi" -> "Şekerli Türk Kahvesi"
      const originalName = pendingTurkishCoffeeProduct.name;
      const originalNameLower = originalName.toLowerCase();
      const isMenengic = originalNameLower.includes('menengiç kahve') || originalNameLower.includes('menengic kahve');
      const coffeeType = isMenengic ? 'Menengiç Kahve' : 'Türk Kahvesi';
      
      // Prefix'i çıkart (Double, Triple, Quad vb.)
      let prefix = '';
      const coffeeTypeRegex = new RegExp('(.*?)\\s*' + (isMenengic ? '(menengiç kahve|menengic kahve)' : '(türk kahvesi|turk kahvesi)'), 'i');
      const match = originalName.match(coffeeTypeRegex);
      if (match && match[1] && match[1].trim()) {
        prefix = match[1].trim() + ' ';
      }
      
      const productName = prefix + option + ' ' + coffeeType;
      
      const existing = cart.find(item => item.id === pendingTurkishCoffeeProduct.id && item.name === productName && !item.isGift);
      if (existing) {
        existing.quantity++;
      } else {
        cart.push({ 
          id: pendingTurkishCoffeeProduct.id, 
          name: productName, 
          price: pendingTurkishCoffeeProduct.price, 
          quantity: 1,
          isGift: false,
          lineId: nextCartLineId++
        });
      }
      
      updateCart();
      hideTurkishCoffeeModal();
      showToast('success', 'Eklendi', productName + ' sepete eklendi');

      // Tam ekran ürün araması açıksa arama sorgusunu koru, kapatma
      if (!(useImmersiveProductSearch && isSultanImmersiveSearchOpen())) {
        const searchInputEl = document.getElementById('searchInput');
        if (searchInputEl) {
          searchInputEl.value = '';
          searchQuery = '';
          renderProducts();
        }
      }
    }

    // ── Sultan Somatı: Ürün Notu ──────────────────────────────────────────
    let sultanNotes = {}; // cardId -> not metni
    let _sultanNoteCtx = { cardId: null, productId: null, name: null };

    function openSultanNote(productId, name, cardId) {
      _sultanNoteCtx = { cardId, productId, name };

      let modal = document.getElementById('sultanNoteModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sultanNoteModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:20000;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(6px);';
        modal.innerHTML =
          '<style>#sultanNoteTextarea:focus{border-color:#059669!important;}</style>' +
          '<div style="background:#fff;border-radius:24px 24px 0 0;width:100%;padding:22px 20px 32px;box-shadow:0 -6px 40px rgba(0,0,0,0.13);">' +
            '<div style="width:36px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 18px;"></div>' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">' +
              '<div>' +
                '<div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">NOT EKLE</div>' +
                '<div id="sultanNoteProductName" style="font-size:16px;font-weight:700;color:#1e293b;line-height:1.3;"></div>' +
              '</div>' +
              '<button onclick="closeSultanNoteModal()" style="width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;font-size:20px;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:12px;">x</button>' +
            '</div>' +
            '<textarea id="sultanNoteTextarea" placeholder="Bu urun icin ozel not... (az baharatli, yok)" rows="4" style="width:100%;border:1.5px solid #e2e8f0;border-radius:14px;padding:13px 14px;font-size:15px;color:#1e293b;resize:none;outline:none;font-family:inherit;box-sizing:border-box;line-height:1.5;transition:border-color 0.2s;"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
              '<button onclick="clearSultanNote()" style="flex:0 0 auto;padding:0 18px;height:46px;border-radius:14px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;">Temizle</button>' +
              '<button onclick="saveSultanNote()" style="flex:1;height:46px;border-radius:14px;border:none;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(5,150,105,0.3);">Kaydet</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === modal) closeSultanNoteModal(); });
      }

      document.getElementById('sultanNoteProductName').textContent = name;
      const ta = document.getElementById('sultanNoteTextarea');
      ta.value = sultanNotes[cardId] || '';
      ta.style.borderColor = '#e2e8f0';
      modal.style.display = 'flex';
      setTimeout(function() { ta.focus(); }, 120);
    }

    function closeSultanNoteModal() {
      const modal = document.getElementById('sultanNoteModal');
      if (modal) modal.style.display = 'none';
    }

    function clearSultanNote() {
      const ta = document.getElementById('sultanNoteTextarea');
      if (ta) { ta.value = ''; ta.style.borderColor = '#e2e8f0'; }
    }

    function saveSultanNote() {
      const ta = document.getElementById('sultanNoteTextarea');
      const note = ta ? ta.value.trim() : '';
      const { cardId, productId, name } = _sultanNoteCtx;
      sultanNotes[cardId] = note || null;
      // Sepette varsa extraNote güncelle
      const existing = cart.find(function(item) { return String(item.id) === String(productId) && item.name === name && !item.isGift; });
      if (existing) existing.extraNote = note || null;
      // Kart üzerindeki yeşil nokta göstergesi
      const indicator = document.getElementById(cardId + '-ni');
      if (indicator) indicator.style.display = note ? 'block' : 'none';
      closeSultanNoteModal();
      showToast('success', 'Not Kaydedildi', note ? ('"' + note.substring(0, 30) + (note.length > 30 ? '...' : '') + '"') : 'Not temizlendi');
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Sultan Somatı: Kart İçi Anlık Miktar Seçici ─────────────────────
    let sultanActiveCardId = null;

    function _sultanCloseCard(cardId) {
      const row = document.getElementById(cardId + '-sqr');
      if (row) row.style.display = 'none';
      const card = document.getElementById(cardId);
      if (card) card.style.outline = '';
      if (sultanActiveCardId === cardId) sultanActiveCardId = null;
    }

    function toggleSultanCard(productId, name, price, cardId) {
      const row = document.getElementById(cardId + '-sqr');
      if (!row) return;
      const isOpen = row.style.display === 'flex';
      // Her kart bağımsız olarak açılıp kapanır; başka kartlar etkilenmez
      if (isOpen) {
        _sultanCloseCard(cardId);
      } else {
        // Sepetteki mevcut miktarı göster; yoksa 1 ekle
        const isYanUrun = typeof productId === 'string' && productId.startsWith('yan_urun_');
        const existing = cart.find(item => String(item.id) === String(productId) && item.name === name && !item.isGift);
        let qty;
        if (existing) {
          qty = existing.quantity;
        } else {
          const extraNote = sultanNotes[cardId] || null;
          cart.push({ id: productId, name, price, quantity: 1, isGift: false, isYanUrun, lineId: nextCartLineId++, extraNote });
          qty = 1;
          updateCart();
        }
        const val = document.getElementById(cardId + '-sqv');
        if (val) val.textContent = qty;
        row.style.display = 'flex';
        sultanActiveCardId = cardId;
        const card = document.getElementById(cardId);
        if (card) card.style.outline = '2px solid #059669';
      }
    }

    function sultanCardDec(productId, name, price, cardId) {
      const existing = cart.find(item => String(item.id) === String(productId) && item.name === name && !item.isGift);
      if (!existing) { _sultanCloseCard(cardId); return; }
      if (existing.quantity <= 1) {
        cart.splice(cart.indexOf(existing), 1);
        updateCart();
        _sultanCloseCard(cardId);
      } else {
        existing.quantity--;
        const val = document.getElementById(cardId + '-sqv');
        if (val) val.textContent = existing.quantity;
        updateCart();
      }
    }

    function sultanCardInc(productId, name, price, cardId) {
      const isYanUrun = typeof productId === 'string' && productId.startsWith('yan_urun_');
      if (!isYanUrun) {
        const product = products.find(p => String(p.id) === String(productId));
        if (product && product.trackStock) {
          const stock = product.stock || 0;
          const val = document.getElementById(cardId + '-sqv');
          const cur = val ? (parseInt(val.textContent) || 0) : 0;
          if (cur >= stock) { showToast('error', 'Stok Yetersiz', 'Maksimum ' + stock + ' adet eklenebilir.'); return; }
        }
      }
      const existing = cart.find(item => String(item.id) === String(productId) && item.name === name && !item.isGift);
      if (existing) {
        existing.quantity++;
        const val = document.getElementById(cardId + '-sqv');
        if (val) val.textContent = existing.quantity;
        updateCart();
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    function addToCart(productId, name, price) {
      // Yan ürün kontrolü
      const isYanUrun = typeof productId === 'string' && productId.startsWith('yan_urun_');
      
      // Stok kontrolü (yan ürünler için yapma)
      if (!isYanUrun) {
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
      }
      
      // ID karşılaştırması için string/number uyumluluğu
      const existing = cart.find(item => {
        // ID'leri karşılaştırırken string/number uyumluluğunu kontrol et
        const itemId = String(item.id);
        const productIdStr = String(productId);
        return itemId === productIdStr && item.name === name && !item.isGift;
      });
      
      if (existing) {
        existing.quantity++;
      } else {
        cart.push({ id: productId, name, price, quantity: 1, isGift: false, isYanUrun: isYanUrun, lineId: nextCartLineId++ });
      }
      updateCart();
      
      // Tam ekran ürün araması açıkken arama sorgusunu koruyup kapatma
      if (!(useImmersiveProductSearch && isSultanImmersiveSearchOpen())) {
        const searchInputEl = document.getElementById('searchInput');
        if (searchInputEl) {
          searchInputEl.value = '';
          searchQuery = '';
          renderProducts();
        }
      }
      
      // Sepeti otomatik açma - kullanıcı manuel olarak açacak
    }
    
    // PERFORMANS: updateCart'ı throttle et (zaten throttle çağrılıyor ama fonksiyon da optimize)
    let updateCartScheduled = false;
    function updateCart() {
      if (updateCartScheduled) return;
      updateCartScheduled = true;
      
      requestAnimationFrame(() => {
        updateCartScheduled = false;
        const itemsDiv = document.getElementById('cartItems');
      cart.forEach(function(entry) {
        if (entry.lineId == null || entry.lineId === undefined) {
          entry.lineId = nextCartLineId++;
        }
      });
      // İkram edilen ürünleri toplamdan çıkar
      const total = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      if (cart.length === 0) {
        itemsDiv.innerHTML = '<div class="cart-empty">Sepet boş</div>';
      } else {
        itemsDiv.innerHTML = cart.map(item => {
          const lid = item.lineId;
          const esc = String(item.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          const giftCls = item.isGift ? ' cart-item-gift' : '';
          const metaLine = item.isGift
            ? '<div class="cart-item-meta"><span style="text-decoration:line-through;color:#94a3b8;">' + item.price.toFixed(2) + ' ₺</span> × ' + item.quantity + ' → <strong style="color:#b45309;">₺0 · İKRAM</strong></div>'
            : '<div class="cart-item-meta">' + item.price.toFixed(2) + ' ₺ × ' + item.quantity + ' = ' + (item.price * item.quantity).toFixed(2) + ' ₺</div>';
          var lineNoteHtml = '';
          if (isSultanMobile && item.extraNote && String(item.extraNote).trim()) {
            var en = String(item.extraNote).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            lineNoteHtml = '<div style="font-size:11px;color:#047857;font-weight:600;margin-top:6px;line-height:1.35;">📝 ' + en + '</div>';
          }
          return '<div class="cart-item' + giftCls + '">' +
            '<div><div class="cart-item-name">' + esc + '</div>' + metaLine + lineNoteHtml + '</div>' +
            '<div class="cart-item-right">' +
              '<button type="button" class="cart-qty-btn" onclick="changeQuantity(' + lid + ', -1)">−</button>' +
              '<span class="cart-item-qty">' + item.quantity + '</span>' +
              '<button type="button" class="cart-qty-btn" onclick="changeQuantity(' + lid + ', 1)">+</button>' +
              '<button type="button" class="cart-remove-btn" onclick="removeFromCart(' + lid + ')">×</button>' +
            '</div></div>';
        }).join('');
      }
      
      document.getElementById('cartTotal').textContent = total.toFixed(2);
      const cartItemCountEl = document.getElementById('cartItemCount');
      if (cartItemCountEl) {
        cartItemCountEl.textContent = totalItems + ' ürün';
      }
      schedulePrepareReceipts();
      });
    }
    
    function changeQuantity(lineId, delta) {
      const lid = Number(lineId);
      const item = cart.find(function(entry) { return entry.lineId === lid; });
      if (item) { 
        item.quantity += delta; 
        if (item.quantity <= 0) {
          removeFromCart(lid);
        } else {
          throttle('updateCart', updateCart, 50);
        }
      }
    }
    
    function removeFromCart(lineId) {
      const lid = Number(lineId);
      cart = cart.filter(function(entry) { return entry.lineId !== lid; });
      throttle('updateCart', updateCart, 50);
    }
    
    function showGiftMarkModal() {
      const candidates = cart.filter(function(i) { return !i.isGift; });
      if (candidates.length === 0) {
        showToast('info', 'Sepet', 'İkram işaretlenecek ürün yok.');
        return;
      }
      const listEl = document.getElementById('giftMarkList');
      listEl.innerHTML = candidates.map(function(item) {
        var name = String(item.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        var maxQ = item.quantity;
        var lid = item.lineId;
        return '<div class="gift-mark-row" data-line-id="' + lid + '" style="padding:14px;border:2px solid #e5e7eb;border-radius:14px;margin-bottom:10px;background:#fff;box-sizing:border-box;">' +
          '<div style="font-weight:700;color:#1f2937;font-size:15px;line-height:1.3;">' + name + '</div>' +
          '<div style="font-size:13px;color:#64748b;margin-top:6px;">Sepette <strong>' + maxQ + '</strong> adet · birim ' + item.price.toFixed(2) + ' ₺</div>' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px;">' +
          '<label style="font-size:13px;font-weight:600;color:#374151;white-space:nowrap;">İkram adedi</label>' +
          '<input type="number" class="gift-mark-qty" min="0" max="' + maxQ + '" value="0" inputmode="numeric" ' +
          'style="width:76px;padding:8px 10px;border:2px solid #e5e7eb;border-radius:10px;font-size:16px;font-weight:700;text-align:center;box-sizing:border-box;"/>' +
          '<span style="font-size:12px;color:#64748b;">/ en fazla ' + maxQ + ' (0 = atla)</span></div></div>';
      }).join('');
      document.getElementById('giftMarkModal').style.display = 'flex';
    }
    
    function hideGiftMarkModal() {
      var m = document.getElementById('giftMarkModal');
      if (m) m.style.display = 'none';
    }
    
    function applyGiftMarks() {
      var rows = document.querySelectorAll('#giftMarkList .gift-mark-row');
      var anyApplied = false;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var lid = parseInt(row.getAttribute('data-line-id'), 10);
        var inp = row.querySelector('.gift-mark-qty');
        var raw = inp ? parseInt(String(inp.value).trim(), 10) : 0;
        if (isNaN(raw) || raw <= 0) continue;
        var item = cart.find(function(entry) { return entry.lineId === lid; });
        if (!item || item.isGift) continue;
        var maxQ = item.quantity;
        var q = Math.min(Math.max(0, raw), maxQ);
        if (q <= 0) continue;
        anyApplied = true;
        if (q >= maxQ) {
          item.isGift = true;
        } else {
          item.quantity = maxQ - q;
          cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: q,
            isGift: true,
            isYanUrun: !!item.isYanUrun,
            lineId: nextCartLineId++,
            extraNote: item.extraNote || null
          });
        }
      }
      if (!anyApplied) {
        showToast('warning', 'Seçim', 'En az bir satırda ikram adedi girin (1 veya daha fazla).');
        return;
      }
      hideGiftMarkModal();
      updateCart();
      schedulePrepareReceipts();
      showToast('success', 'İkram', 'Belirttiğiniz adetler ₺0 olarak ayrıldı.');
    }
    
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
      
      // Otomatik kapat (başarı mesajları için 4 saniye, hata mesajları için 3 saniye)
      const autoCloseDelay = type === 'success' ? 4000 : 3000;
      setTimeout(() => {
        hideToast();
      }, autoCloseDelay);
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
    
    // Şifre Değiştir Modal Fonksiyonları
    function showChangePasswordModal() {
      document.getElementById('changePasswordModal').style.display = 'flex';
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      document.getElementById('changePasswordError').style.display = 'none';
      document.getElementById('currentPassword').focus();
    }
    
    function closeChangePasswordModal() {
      document.getElementById('changePasswordModal').style.display = 'none';
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      document.getElementById('changePasswordError').style.display = 'none';
    }
    
    async function changeStaffPassword() {
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('changePasswordError');
      
      // Validasyon
      if (!currentPassword || !newPassword || !confirmPassword) {
        errorDiv.textContent = 'Lütfen tüm alanları doldurunuz';
        errorDiv.style.display = 'block';
        return;
      }
      
      if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Yeni şifreler eşleşmiyor';
        errorDiv.style.display = 'block';
        return;
      }
      
      if (newPassword.length < 4) {
        errorDiv.textContent = 'Yeni şifre en az 4 karakter olmalıdır';
        errorDiv.style.display = 'block';
        return;
      }
      
      try {
        // Önce mevcut şifreyi doğrula
        const loginResponse = await fetch(API_URL + '/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: currentPassword })
        });
        
        const loginResult = await loginResponse.json();
        
        if (!loginResult.success) {
          errorDiv.textContent = 'Mevcut şifre hatalı';
          errorDiv.style.display = 'block';
          return;
        }
        
        // Şifreyi değiştir
        const changeResponse = await fetch(API_URL + '/staff/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            staffId: loginResult.staff.id,
            currentPassword: currentPassword,
            newPassword: newPassword 
          })
        });
        
        const changeResult = await changeResponse.json();
        
        if (changeResult.success) {
          // Başarılı - Modern toast bildirimi göster
          showToast('success', 'Şifre Değiştirildi', 'Şifreniz başarıyla güncellendi. Lütfen yeni şifrenizle tekrar giriş yapın.');
          closeChangePasswordModal();
          
          // 2 saniye sonra giriş ekranına dön (toast mesajının görünmesi için)
          setTimeout(() => {
            document.getElementById('changePasswordModal').style.display = 'none';
            document.getElementById('pinSection').style.display = 'block';
            document.getElementById('mainSection').style.display = 'none';
            document.getElementById('pinInput').value = '';
            localStorage.removeItem('staffSession');
            currentStaff = null;
            setSultanLoginChromeActive(true);
          }, 2000);
        } else {
          errorDiv.textContent = changeResult.error || 'Şifre değiştirilemedi';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        errorDiv.textContent = 'Bağlantı hatası';
        errorDiv.style.display = 'block';
      }
    }

    async function showManagerOpsPasswordModal() {
      if (!currentStaff || !hasManagerPermission()) {
        showToast('error', 'Yetki yok', 'Bu işlemi yalnızca müdür yapabilir.');
        return;
      }
      const err = document.getElementById('managerOpsPasswordError');
      if (err) { err.style.display = 'none'; err.textContent = ''; }
      document.getElementById('managerOpsStaffPassword').value = '';
      document.getElementById('managerOpsNewPassword').value = '';
      document.getElementById('managerOpsNewPassword2').value = '';
      document.getElementById('managerOpsCurrentPassword').value = '';
      var configured = false;
      try {
        var r = await fetch(API_URL + '/staff/manager-ops-configured');
        var j = await r.json();
        configured = !!j.configured;
      } catch (e) {}
      var curRow = document.getElementById('managerOpsCurrentRow');
      if (curRow) curRow.style.display = configured ? 'block' : 'none';
      document.getElementById('managerOpsPasswordModal').style.display = 'flex';
      setTimeout(function() {
        var el = configured ? document.getElementById('managerOpsCurrentPassword') : document.getElementById('managerOpsStaffPassword');
        if (el) el.focus();
      }, 100);
    }

    function closeManagerOpsPasswordModal() {
      document.getElementById('managerOpsPasswordModal').style.display = 'none';
      var err = document.getElementById('managerOpsPasswordError');
      if (err) { err.style.display = 'none'; }
    }

    async function submitManagerOpsPassword() {
      if (!currentStaff) return;
      var staffPassword = document.getElementById('managerOpsStaffPassword').value;
      var newPwd = document.getElementById('managerOpsNewPassword').value;
      var newPwd2 = document.getElementById('managerOpsNewPassword2').value;
      var currentRow = document.getElementById('managerOpsCurrentRow');
      var needCurrent = currentRow && currentRow.style.display !== 'none';
      var currentPwd = document.getElementById('managerOpsCurrentPassword').value;
      var errorDiv = document.getElementById('managerOpsPasswordError');
      if (!staffPassword || !newPwd || !newPwd2) {
        errorDiv.textContent = 'Lütfen tüm alanları doldurun';
        errorDiv.style.display = 'block';
        return;
      }
      if (needCurrent && !currentPwd) {
        errorDiv.textContent = 'Mevcut masaüstü şifresini girin';
        errorDiv.style.display = 'block';
        return;
      }
      if (newPwd !== newPwd2) {
        errorDiv.textContent = 'Yeni şifreler eşleşmiyor';
        errorDiv.style.display = 'block';
        return;
      }
      if (newPwd.length < 4) {
        errorDiv.textContent = 'Yeni şifre en az 4 karakter olmalıdır';
        errorDiv.style.display = 'block';
        return;
      }
      try {
        var body = {
          staffId: currentStaff.id,
          staffPassword: staffPassword,
          newManagerOpsPassword: newPwd
        };
        if (needCurrent) body.currentManagerOpsPassword = currentPwd;
        var res = await fetch(API_URL + '/staff/manager-operations-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var data = await res.json();
        if (data.success) {
          showToast('success', 'Kaydedildi', data.message || 'Şifre kaydedildi');
          closeManagerOpsPasswordModal();
        } else {
          errorDiv.textContent = data.error || 'Kaydedilemedi';
          errorDiv.style.display = 'block';
        }
      } catch (e) {
        console.error(e);
        errorDiv.textContent = 'Bağlantı hatası';
        errorDiv.style.display = 'block';
      }
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
      hideAppHeader();
      setSultanLoginChromeActive(true);
      
      // Sepeti ve seçili masayı temizle
      cart = [];
      selectedTable = null;
      updateCart();
      sultanMgrDiscountByOrderId = {};
      
      // Input'u temizle
      document.getElementById('pinInput').value = '';
      document.getElementById('pinError').classList.remove('show');
      
      // Toast göster
      showToast('success', 'Çıkış Yapıldı', 'Başarıyla çıkış yaptınız. Tekrar giriş yapabilirsiniz.');
    }
    
    // Sultan Somatı — masa ⋮ (ödeme: tüm personel; adisyon yazdır: müdür)
    let sultanMgrTableId = null;
    let sultanMgrOrder = null;
    let sultanMgrDiscountAmount = 0;
    /** Açık sipariş başına girilen indirim (₺); sheet kapanınca silinmez, ödeme/iptal/çıkışta temizlenir */
    var sultanMgrDiscountByOrderId = {};

    function _sultanMgrClearSavedDiscount(orderId) {
      if (orderId == null) return;
      delete sultanMgrDiscountByOrderId[orderId];
    }

    function _sultanMgrGetTotal() {
      if (!sultanMgrOrder) return 0;
      return sultanMgrOrder.items.reduce(function(s, i) { return i.isGift ? s : s + i.price * i.quantity; }, 0);
    }

    function updateSultanMgrDiscount() {
      var input = document.getElementById('sultanMgrDiscountInput');
      var raw = parseFloat(input ? input.value : 0) || 0;
      var total = _sultanMgrGetTotal();
      sultanMgrDiscountAmount = Math.min(Math.max(raw, 0), total);
      if (sultanMgrOrder) {
        sultanMgrDiscountByOrderId[sultanMgrOrder.id] = sultanMgrDiscountAmount;
      }
      var payable = total - sultanMgrDiscountAmount;
      var el = document.getElementById('sultanMgrPayableAmount');
      if (el) el.textContent = payable.toFixed(2) + ' \u20ba';
    }

    function closeSultanManagerSheet() {
      if (sultanMgrOrder) {
        var input = document.getElementById('sultanMgrDiscountInput');
        if (input) {
          var raw = parseFloat(input.value) || 0;
          var total = _sultanMgrGetTotal();
          sultanMgrDiscountAmount = Math.min(Math.max(raw, 0), total);
          sultanMgrDiscountByOrderId[sultanMgrOrder.id] = sultanMgrDiscountAmount;
        }
      }
      var el = document.getElementById('sultanManagerSheet');
      if (el) el.style.display = 'none';
      sultanMgrTableId = null;
      sultanMgrOrder = null;
    }
    function closeSultanPaymentSheet() {
      var el = document.getElementById('sultanPaymentSheet');
      if (el) el.style.display = 'none';
    }
    function openSultanManagerSheet(tableId) {
      if (!isSultanMobile) return;
      if (!currentStaff) {
        showToast('error', 'Giriş gerekli', 'Lütfen personel olarak giriş yapın.');
        return;
      }
      sultanMgrTableId = tableId;
      sultanMgrOrder = null;
      var t = tables.find(function (x) { return x.id === tableId; });
      fetch(API_URL + '/table-orders?tableId=' + encodeURIComponent(tableId))
        .then(function (res) { return res.json(); })
        .then(function (orders) {
          if (!orders || !orders.length) {
            showToast('error', 'Sipariş yok', 'Bu masada açık sipariş bulunmuyor.');
            return;
          }
          sultanMgrOrder = orders[0];
          var total = _sultanMgrGetTotal();
          var oid = sultanMgrOrder.id;
          var savedDisc = sultanMgrDiscountByOrderId[oid];
          if (typeof savedDisc === 'number' && !isNaN(savedDisc)) {
            sultanMgrDiscountAmount = Math.min(Math.max(savedDisc, 0), total);
          } else {
            sultanMgrDiscountAmount = 0;
          }
          document.getElementById('sultanMgrTitle').textContent = t && t.name ? t.name : 'Masa';
          document.getElementById('sultanMgrSubtitle').textContent = 'Toplam: ' + total.toFixed(2) + ' \u20ba';
          var discInput = document.getElementById('sultanMgrDiscountInput');
          if (discInput) discInput.value = sultanMgrDiscountAmount > 0 ? String(sultanMgrDiscountAmount) : '';
          updateSultanMgrDiscount();
          var pbtn = document.getElementById('sultanMgrPrintBtn');
          if (pbtn) {
            pbtn.style.display = hasManagerPermission() ? 'block' : 'none';
          }
          document.getElementById('sultanManagerSheet').style.display = 'flex';
        })
        .catch(function () {
          showToast('error', 'Hata', 'Sipariş bilgisi alınamadı.');
        });
    }
    function sultanManagerOpenPayment() {
      if (!sultanMgrOrder) return;
      document.getElementById('sultanManagerSheet').style.display = 'none';
      var total = _sultanMgrGetTotal();
      var payable = total - sultanMgrDiscountAmount;
      var subtitle = payable.toFixed(2) + ' \u20ba tahsil edilecek';
      if (sultanMgrDiscountAmount > 0) {
        subtitle += ' (' + sultanMgrDiscountAmount.toFixed(2) + ' \u20ba indirim uyguland\u0131)';
      }
      document.getElementById('sultanPaySubtitle').textContent = subtitle;
      document.getElementById('sultanPaymentSheet').style.display = 'flex';
    }
    function sultanManagerPrintAdisyon() {
      if (!sultanMgrOrder || !currentStaff) return;
      updateSultanMgrDiscount();
      var oid = sultanMgrOrder.id;
      var sid = currentStaff.id;
      var discountTL = sultanMgrDiscountAmount > 0 ? sultanMgrDiscountAmount : null;
      closeSultanManagerSheet();
      fetch(API_URL + '/sultan-manager/print-adisyon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: oid, staffId: sid, discountAmountTL: discountTL })
      })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (x) {
          if (x.ok && x.j.success) {
            showToast('success', 'Yazdırıldı', 'Adisyon kasa yazıcısına gönderildi.');
          } else {
            showToast('error', 'Yazdırılamadı', (x.j && x.j.error) || 'Bilinmeyen hata');
          }
        })
        .catch(function () {
          showToast('error', 'Hata', 'Bağlantı hatası');
        });
    }
    async function confirmSultanPayment(paymentMethod) {
      if (!sultanMgrOrder || !currentStaff) return;
      closeSultanPaymentSheet();
      try {
        var res = await fetch(API_URL + '/sultan-manager/complete-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: sultanMgrOrder.id,
            paymentMethod: paymentMethod,
            staffId: currentStaff.id,
            discountAmountTL: sultanMgrDiscountAmount > 0 ? sultanMgrDiscountAmount : null
          })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          showToast('success', 'Ödeme alındı', 'Masa kapatıldı.');
          _sultanMgrClearSavedDiscount(sultanMgrOrder.id);
          sultanMgrOrder = null;
          sultanMgrTableId = null;
          await loadData();
        } else {
          showToast('error', 'İşlem başarısız', (data && data.error) || 'Bilinmeyen hata');
        }
      } catch (e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    // ----- Tüm Masayı İptal Et -----
    function openSultanMgrCancelSheet() {
      if (!sultanMgrTableId) return;
      var t = tables.find(function(x){ return x.id === sultanMgrTableId; });
      var title = document.getElementById('sultanMgrCancelTitle');
      if (title) title.textContent = (t && t.name ? t.name : 'Masa') + ' — Tüm Siparişi İptal Et';
      var ta = document.getElementById('sultanMgrCancelReason');
      if (ta) ta.value = '';
      document.getElementById('sultanMgrCancelSheet').style.display = 'flex';
    }
    function closeSultanMgrCancelSheet() {
      document.getElementById('sultanMgrCancelSheet').style.display = 'none';
    }
    async function confirmSultanMgrCancelOrder() {
      var reason = (document.getElementById('sultanMgrCancelReason').value || '').trim();
      if (!reason) {
        showToast('error', 'Açıklama gerekli', 'Lütfen bir iptal açıklaması girin.');
        return;
      }
      if (!sultanMgrOrder) {
        showToast('error', 'Hata', 'Sipariş bilgisi bulunamadı.');
        return;
      }
      try {
        var res = await fetch(API_URL + '/sultan-manager/cancel-entire-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: sultanMgrOrder.id, cancelReason: reason, staffId: currentStaff ? currentStaff.id : null })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          _sultanMgrClearSavedDiscount(sultanMgrOrder.id);
          closeSultanMgrCancelSheet();
          closeSultanManagerSheet();
          showToast('success', 'İptal edildi', 'Masa siparişi iptal edildi.');
          await loadData();
        } else {
          showToast('error', 'Hata', (data && data.error) || 'İptal işlemi başarısız.');
        }
      } catch(e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    // ----- Masa Aktar (Manager Sheet içinden) -----
    var _sultanMgrTransferTargetId = null;

    function openSultanMgrTransferSheet() {
      if (!sultanMgrTableId) return;
      _sultanMgrTransferTargetId = null;
      var t = tables.find(function(x){ return x.id === sultanMgrTableId; });
      var sub = document.getElementById('sultanMgrTransferSubtitle');
      if (sub) sub.textContent = 'Kaynak: ' + (t && t.name ? t.name : '');
      var btn = document.getElementById('sultanMgrTransferConfirmBtn');
      if (btn) btn.style.display = 'none';
      _renderSultanMgrTransferGrid();
      document.getElementById('sultanMgrTransferSheet').style.display = 'flex';
    }
    function closeSultanMgrTransferSheet() {
      document.getElementById('sultanMgrTransferSheet').style.display = 'none';
      _sultanMgrTransferTargetId = null;
    }
    function _renderSultanMgrTransferGrid() {
      var grid = document.getElementById('sultanMgrTransferGrid');
      if (!grid) return;

      // Masaları bölüme göre grupla (sectionKey → sectionLabel ile)
      var bySection = {};
      var sectionOrder = [];
      tables.forEach(function(table) {
        var key = table.sectionKey || '_other';
        if (!bySection[key]) {
          bySection[key] = { label: table.sectionLabel || key, tables: [] };
          sectionOrder.push(key);
        }
        bySection[key].tables.push(table);
      });

      var html = '';
      sectionOrder.forEach(function(key) {
        var sec = bySection[key];
        var sectionTables = sec.tables;

        // Bölümde mevcut kaynaktan farklı en az 1 masa var mı kontrol et
        var hasVisible = sectionTables.some(function(t) { return t.id !== sultanMgrTableId; });
        if (!hasVisible) return;

        // Bölüm başlığı
        html += '<div style="margin-top:14px;margin-bottom:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div style="flex:1;height:1px;background:#e2e8f0;"></div>' +
            '<span style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;padding:0 4px;">' +
              sec.label.replace(/</g,'&lt;').replace(/>/g,'&gt;') +
            '</span>' +
            '<div style="flex:1;height:1px;background:#e2e8f0;"></div>' +
          '</div>' +
        '</div>';

        // Bölümdeki masalar — 3 sütunlu inline-grid
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px;">';

        sectionTables.forEach(function(table) {
          if (table.id === sultanMgrTableId) return;

          if (table.hasOrder) {
            html += '<div style="opacity:0.35;padding:10px 6px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:68px;">' +
              '<div style="width:34px;height:34px;border-radius:50%;background:#94a3b8;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;margin-bottom:4px;">' + table.number + '</div>' +
              '<span style="font-size:10px;color:#64748b;font-weight:600;text-align:center;line-height:1.2;">' + table.number + '</span>' +
              '<span style="font-size:9px;color:#dc2626;margin-top:2px;font-weight:700;">Dolu</span>' +
              '</div>';
            return;
          }

          var isSelected = _sultanMgrTransferTargetId === table.id;
          var bg = isSelected ? '#d1fae5' : '#f0fdf4';
          var border = isSelected ? '#059669' : '#a7f3d0';
          var circleBg = isSelected ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#34d399,#059669)';
          html += '<button type="button" onclick="_selectSultanMgrTransferTarget(\\'' + table.id + '\\')" style="padding:10px 6px;border:2px solid ' + border + ';border-radius:12px;background:' + bg + ';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:68px;transition:all 0.15s;' + (isSelected ? 'box-shadow:0 0 0 3px rgba(5,150,105,0.2);' : '') + '">' +
            '<div style="width:34px;height:34px;border-radius:50%;background:' + circleBg + ';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;margin-bottom:4px;">' + table.number + '</div>' +
            '<span style="font-size:9px;color:#047857;font-weight:600;">Boş</span>' +
            '</button>';
        });

        html += '</div>';
      });

      if (!html.trim()) {
        html = '<div style="text-align:center;padding:30px 20px;color:#94a3b8;font-size:14px;">Aktarılabilecek boş masa yok.</div>';
      }

      grid.innerHTML = html;
    }
    function _selectSultanMgrTransferTarget(tableId) {
      _sultanMgrTransferTargetId = tableId;
      var btn = document.getElementById('sultanMgrTransferConfirmBtn');
      if (btn) btn.style.display = 'block';
      _renderSultanMgrTransferGrid();
    }
    async function confirmSultanMgrTransfer() {
      if (!sultanMgrTableId || !_sultanMgrTransferTargetId) {
        showToast('error', 'Hata', 'Hedef masa seçilmedi.');
        return;
      }
      try {
        var res = await fetch(API_URL + '/transfer-table-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceTableId: sultanMgrTableId, targetTableId: _sultanMgrTransferTargetId })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          closeSultanMgrTransferSheet();
          closeSultanManagerSheet();
          showToast('success', 'Aktarıldı', 'Masa başarıyla aktarıldı.');
          await loadData();
        } else {
          showToast('error', 'Hata', (data && data.error) || 'Aktarım başarısız.');
        }
      } catch(e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    // ──── Rezervasyon ────
    var _reservationFormTableId = null;
    var _reservationDetailId = null;
    var _reservationEditId = null; // Düzenleme modunda mevcut rezervasyon id'si

    function openReservationFormSheet(tableId, existingReservation) {
      _reservationFormTableId = tableId || null;
      _reservationEditId = existingReservation ? existingReservation.id : null;
      // Başlık & buton
      var titleEl = document.getElementById('resFormTitle');
      var btnEl = document.getElementById('resFormSubmitBtn');
      if (titleEl) titleEl.textContent = existingReservation ? 'Rezervasyon Düzenle' : 'Rezervasyon Oluştur';
      if (btnEl) btnEl.textContent = existingReservation ? 'Kaydet' : 'Oluştur';
      // Alanları doldur
      var gEl = document.getElementById('resFormGuestName');
      if (gEl) gEl.value = existingReservation ? (existingReservation.guestName || '') : '';
      var dateEl = document.getElementById('resFormDate');
      if (dateEl) dateEl.value = existingReservation ? existingReservation.date : (function(){
        var t = new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      })();
      var timeEl = document.getElementById('resFormTime');
      if (timeEl) timeEl.value = existingReservation ? (existingReservation.time || '') : '';
      var peopleEl = document.getElementById('resFormPeople');
      if (peopleEl) peopleEl.value = existingReservation && existingReservation.peopleCount ? existingReservation.peopleCount : '';
      var adultsEl = document.getElementById('resFormAdults');
      if (adultsEl) adultsEl.value = existingReservation && existingReservation.adults ? existingReservation.adults : '';
      var childEl = document.getElementById('resFormChildren');
      if (childEl) childEl.value = existingReservation && existingReservation.children ? existingReservation.children : '';
      var babyEl = document.getElementById('resFormBabies');
      if (babyEl) babyEl.value = existingReservation && existingReservation.babies ? existingReservation.babies : '';
      var noteEl = document.getElementById('resFormNote');
      if (noteEl) noteEl.value = existingReservation ? (existingReservation.note || '') : '';
      // Masa seçim dropdown
      var sel = document.getElementById('resFormTableSelect');
      var tid = tableId || (existingReservation && existingReservation.tableId) || null;
      if (sel) {
        var opts = tables.map(function(t) {
          return '<option value="' + t.id + '"' + (t.id === tid ? ' selected' : '') + '>' + t.name + '</option>';
        }).join('');
        sel.innerHTML = opts;
        if (tid) sel.value = tid;
      }
      var wrap = document.getElementById('resFormTablePickerWrap');
      if (wrap) wrap.style.display = tid ? 'none' : '';
      var lbl = document.getElementById('resFormTableLabel');
      if (lbl && tid) {
        var tObj = tables.find(function(x){ return x.id === tid; });
        lbl.textContent = tObj ? tObj.name : '';
      } else if (lbl) {
        lbl.textContent = '';
      }
      document.getElementById('sultanReservationFormSheet').style.display = 'flex';
    }

    function closeReservationFormSheet() {
      document.getElementById('sultanReservationFormSheet').style.display = 'none';
      _reservationEditId = null;
    }

    async function submitReservation() {
      var sel = document.getElementById('resFormTableSelect');
      var tableId = _reservationFormTableId || (sel ? sel.value : null)
        || (_reservationEditId ? (sultanReservations.find(function(r){ return r.id === _reservationEditId; }) || {}).tableId : null);
      if (!tableId && sel) tableId = sel.value;
      var guestName = (document.getElementById('resFormGuestName').value || '').trim();
      var date = (document.getElementById('resFormDate').value || '').trim();
      var time = (document.getElementById('resFormTime').value || '').trim();
      if (!guestName) { showToast('error', 'Hata', 'Ad Soyad girin.'); return; }
      if (!tableId) { showToast('error', 'Hata', 'Masa seçin.'); return; }
      if (!date) { showToast('error', 'Hata', 'Tarih girin.'); return; }
      if (!time) { showToast('error', 'Hata', 'Saat girin.'); return; }
      var t = tables.find(function(x){ return x.id === tableId; });
      var body = {
        tableId: tableId,
        tableName: t ? t.name : tableId,
        guestName: guestName,
        date: date,
        time: time,
        peopleCount: parseInt(document.getElementById('resFormPeople').value) || 0,
        adults: parseInt(document.getElementById('resFormAdults').value) || 0,
        children: parseInt(document.getElementById('resFormChildren').value) || 0,
        babies: parseInt(document.getElementById('resFormBabies').value) || 0,
        note: (document.getElementById('resFormNote').value || '').trim(),
        staffId: currentStaff ? currentStaff.id : null,
        staffName: currentStaff ? ((currentStaff.name || '') + ' ' + (currentStaff.surname || '')).trim() : null
      };
      if (_reservationEditId) body.reservationId = _reservationEditId;
      try {
        var res = await fetch(API_URL + '/reservations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var data = await res.json();
        if (res.ok && data.success) {
          closeReservationFormSheet();
          var isEdit = !!_reservationEditId;
          showToast('success', isEdit ? 'Güncellendi' : 'Oluşturuldu', (t ? t.name : '') + (isEdit ? ' rezervasyonu güncellendi.' : ' masası rezerve edildi.'));
          sultanReservations = sultanReservations.filter(function(r){ return r.tableId !== tableId && r.id !== (data.reservation && data.reservation.id); });
          sultanReservations.push(data.reservation);
          renderTables();
          // Eğer liste sheet açıksa yenile
          if (document.getElementById('sultanReservationListSheet') && document.getElementById('sultanReservationListSheet').style.display === 'flex') {
            renderReservationList();
          }
        } else {
          showToast('error', 'Hata', (data && data.error) || 'İşlem başarısız.');
        }
      } catch(e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    function openReservationDetailSheet(tableId) {
      var reservation = sultanReservations.find(function(r){ return r.tableId === tableId; });
      if (!reservation) { showToast('error', 'Hata', 'Bu masada rezervasyon bulunamadı.'); return; }
      _reservationDetailId = reservation.id;
      var t = tables.find(function(x){ return x.id === tableId; });
      var lbl = document.getElementById('resDetailTableLabel');
      if (lbl) lbl.textContent = t ? t.name : tableId;
      var body = document.getElementById('resDetailBody');
      if (body) {
        var rows = [
          ['Ad Soyad', reservation.guestName || '—'],
          ['Masa', reservation.tableName || reservation.tableId],
          ['Tarih', reservation.date],
          ['Saat', reservation.time],
          ['Kişi Sayısı', reservation.peopleCount || '—'],
          ['Yetişkin', reservation.adults || '—'],
          ['Çocuk', reservation.children || '—'],
          ['Bebek', reservation.babies || '—'],
        ];
        var html = rows.map(function(r){
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">' +
            '<span style="color:#64748b;font-size:13px;">' + r[0] + '</span>' +
            '<span style="font-weight:700;color:#0f172a;font-size:14px;">' + r[1] + '</span>' +
            '</div>';
        }).join('');
        if (reservation.note && reservation.note.trim()) {
          html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;">' +
            '<div style="font-size:12px;color:#64748b;margin-bottom:4px;">Özel Not</div>' +
            '<div style="font-size:14px;color:#1e293b;line-height:1.5;">' + reservation.note.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
            '</div>';
        }
        if (reservation.staffName) {
          html += '<div style="margin-top:8px;font-size:12px;color:#94a3b8;">Oluşturan: ' + reservation.staffName + '</div>';
        }
        body.innerHTML = html;
      }
      document.getElementById('sultanReservationDetailSheet').style.display = 'flex';
    }

    function closeReservationDetailSheet() {
      document.getElementById('sultanReservationDetailSheet').style.display = 'none';
    }

    async function printReservation() {
      if (!_reservationDetailId) return;
      try {
        var res = await fetch(API_URL + '/reservations/print', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: _reservationDetailId })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          showToast('success', 'Yazdırıldı', 'Rezervasyon fişi yazdırıldı.');
        } else {
          showToast('error', 'Yazdırılamadı', (data && data.error) || 'Hata');
        }
      } catch(e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    async function cancelReservation() {
      if (!_reservationDetailId) return;
      try {
        var res = await fetch(API_URL + '/reservations/' + encodeURIComponent(_reservationDetailId), {
          method: 'DELETE'
        });
        var data = await res.json();
        if (res.ok && data.success) {
          sultanReservations = sultanReservations.filter(function(r){ return r.id !== _reservationDetailId; });
          closeReservationDetailSheet();
          showToast('success', 'İptal edildi', 'Rezervasyon iptal edildi.');
          renderTables();
        } else {
          showToast('error', 'Hata', (data && data.error) || 'İptal başarısız.');
        }
      } catch(e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    function editReservationFromDetail() {
      var reservation = sultanReservations.find(function(r){ return r.id === _reservationDetailId; });
      if (!reservation) return;
      closeReservationDetailSheet();
      setTimeout(function(){ openReservationFormSheet(reservation.tableId, reservation); }, 120);
    }

    function _escSalesHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function openSultanAllOrdersSheet(highlightTableId) {
      if (!isSultanMobile) return;
      if (!currentStaff) {
        showToast('error', 'Giriş gerekli', 'Lütfen personel olarak giriş yapın.');
        return;
      }
      if (highlightTableId != null && highlightTableId !== '') {
        sultanAllOrdersHighlightTableId = String(highlightTableId);
      } else {
        sultanAllOrdersHighlightTableId = null;
      }
      var sh = document.getElementById('sultanAllOrdersSheet');
      if (sh) sh.style.display = 'flex';
      renderSultanAllOrdersSheet();
    }
    function openSultanAllOrdersFromCurrentTable() {
      if (!isSultanMobile || !selectedTable) return;
      openSultanAllOrdersSheet(selectedTable.id);
    }
    function closeSultanAllOrdersSheet() {
      var sh = document.getElementById('sultanAllOrdersSheet');
      if (sh) sh.style.display = 'none';
      sultanAllOrdersHighlightTableId = null;
    }
    async function renderSultanAllOrdersSheet() {
      var body = document.getElementById('sultanAllOrdersBody');
      var cntEl = document.getElementById('sultanAllOrdersCount');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#64748b;font-weight:600;font-size:14px;">Yükleniyor…</div>';
      if (cntEl) cntEl.textContent = '';
      try {
        var res = await fetch(API_URL + '/sultan-mobile/pending-orders?staffId=' + encodeURIComponent(currentStaff.id));
        var data = await res.json();
        if (!res.ok || !data.success) {
          body.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#b91c1c;font-weight:600;font-size:14px;">' + _escSalesHtml((data && data.error) || 'Liste alınamadı') + '</div>';
          return;
        }
        var arr = data.orders || [];
        if (cntEl) cntEl.textContent = arr.length ? arr.length + ' masa' : '0';
        if (!arr.length) {
          body.innerHTML = '<div style="text-align:center;padding:36px 20px;color:#94a3b8;font-size:15px;font-weight:600;">Açık sipariş bulunmuyor.</div>';
          return;
        }
        body.innerHTML = arr.map(function (ord) {
          var tnm = _escSalesHtml(ord.table_name || ord.table_id || 'Masa');
          var tamt = (typeof ord.total_amount === 'number' ? ord.total_amount : parseFloat(ord.total_amount) || 0).toFixed(2);
          var isHl = !!(sultanAllOrdersHighlightTableId && String(ord.table_id) === String(sultanAllOrdersHighlightTableId));
          var cardBorder = isHl ? '#10b981' : '#e2e8f0';
          var cardShadow = isHl
            ? '0 8px 28px rgba(5,150,105,0.2),0 0 0 2px rgba(16,185,129,0.45)'
            : '0 2px 10px rgba(15,23,42,0.05)';
          var hlBadge = isHl
            ? '<span style="font-size:10px;font-weight:900;color:#fff;background:linear-gradient(135deg,#059669,#047857);padding:3px 10px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;flex-shrink:0;">Bu masa</span>'
            : '';
          var meta = [(ord.order_date || ''), (ord.order_time || '')].filter(Boolean).join(' ');
          var note = ord.order_note
            ? '<div style="margin-top:8px;padding:8px 10px;background:#f8fafc;border-radius:10px;font-size:12px;color:#475569;line-height:1.4;"><span style="font-weight:700;">Not:</span> ' + _escSalesHtml(ord.order_note) + '</div>'
            : '';
          var lines = (ord.items || []).map(function (it) {
            var nm = _escSalesHtml(it.product_name || '');
            var q = Number(it.quantity) || 0;
            var gift = it.isGift ? ' <span style="color:#059669;font-weight:800;font-size:11px;">İKRAM</span>' : '';
            var sn = it.staff_name ? ' <span style="color:#94a3b8;font-size:11px;font-weight:600;">· ' + _escSalesHtml(it.staff_name) + '</span>' : '';
            var ln = it.item_note
              ? '<div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.35;">' + _escSalesHtml(it.item_note) + '</div>'
              : '';
            var lineTot = it.isGift ? '0.00' : (q * (parseFloat(it.price) || 0)).toFixed(2);
            var cancelCell = '';
            if (hasManagerPermission() && it.id != null && it.id !== '') {
              var pnameJs = String(it.product_name || '').replace(/'/g, "\\'");
              cancelCell =
                '<button id="cancelBtn_' + it.id + '" onclick="showCancelItemModal(' + it.id + ', ' + q + ', \\'' + pnameJs + '\\', true)" style="padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px;" onmouseover="if(!this.disabled) { this.style.transform=\\'scale(1.05)\\'; this.style.boxShadow=\\'0 4px 12px rgba(239, 68, 68, 0.4)\\'; }" onmouseout="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'0 2px 8px rgba(239, 68, 68, 0.3)\\'; }" ontouchstart="if(!this.disabled) { this.style.transform=\\'scale(0.95)\\'; }" ontouchend="if(!this.disabled) { this.style.transform=\\'scale(1)\\'; }" class="cancel-item-btn"><span id="cancelBtnText_' + it.id + '">İptal</span><svg id="cancelBtnSpinner_' + it.id + '" style="display: none; width: 14px; height: 14px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>';
            } else if (!hasManagerPermission()) {
              cancelCell =
                '<button onclick="showManagerRequiredMessage()" style="padding: 6px 12px; background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3); transition: all 0.3s; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 70px; opacity: 0.7;" onmouseover="this.style.opacity=\\'0.9\\';" onmouseout="this.style.opacity=\\'0.7\\';"><span>İptal</span></button>';
            }
            return (
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">' +
              '<div style="flex:1;min-width:0;"><span style="font-weight:800;color:#0f172a;">' + q + '×</span> ' + nm + gift + sn + ln + '</div>' +
              '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">' +
              '<div style="font-weight:800;color:#334155;white-space:nowrap;font-variant-numeric:tabular-nums;">' + lineTot + ' ₺</div>' +
              cancelCell +
              '</div></div>'
            );
          }).join('');
          return (
            '<div data-sultan-order-highlight="' + (isHl ? '1' : '0') + '" style="margin-bottom:14px;border-radius:16px;border:1px solid ' + cardBorder + ';background:#fff;overflow:hidden;box-shadow:' + cardShadow + ';">' +
            '<div style="padding:12px 14px;background:linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 100%);border-bottom:1px solid #d1fae5;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;flex:1;">' +
            '<div style="font-size:15px;font-weight:800;color:#064e3b;letter-spacing:-0.02em;">' + tnm + '</div>' +
            hlBadge +
            '</div>' +
            '<div style="font-size:14px;font-weight:900;color:#047857;font-variant-numeric:tabular-nums;flex-shrink:0;">' + tamt + ' ₺</div>' +
            '</div>' +
            '<div style="padding:2px 14px 12px;">' +
            (meta ? '<div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:2px;padding-top:8px;">' + _escSalesHtml(meta) + '</div>' : '') +
            lines +
            note +
            '</div></div>'
          );
        }).join('');
        if (sultanAllOrdersHighlightTableId) {
          requestAnimationFrame(function () {
            var hl = body.querySelector('[data-sultan-order-highlight="1"]');
            if (hl) hl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }
      } catch (e) {
        body.innerHTML = '<div style="text-align:center;padding:28px;color:#b91c1c;font-weight:600;">Bağlantı hatası</div>';
      }
    }
    function openSultanSalesHistorySheet() {
      if (!isSultanMobile) return;
      if (!currentStaff) {
        showToast('error', 'Giriş gerekli', 'Lütfen personel olarak giriş yapın.');
        return;
      }
      var sh = document.getElementById('sultanSalesHistorySheet');
      if (sh) sh.style.display = 'flex';
      renderSultanSalesHistoryList();
    }
    function closeSultanSalesHistorySheet() {
      var sh = document.getElementById('sultanSalesHistorySheet');
      if (sh) sh.style.display = 'none';
    }
    async function renderSultanSalesHistoryList() {
      var body = document.getElementById('sultanSalesHistoryBody');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#64748b;font-weight:600;font-size:14px;">Yükleniyor…</div>';
      try {
        var res = await fetch(API_URL + '/sultan-manager/completed-table-orders?staffId=' + encodeURIComponent(currentStaff.id));
        var data = await res.json();
        if (!res.ok || !data.success) {
          body.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#b91c1c;font-weight:600;font-size:14px;">' + _escSalesHtml((data && data.error) || 'Liste alınamadı') + '</div>';
          return;
        }
        var arr = data.orders || [];
        if (!arr.length) {
          body.innerHTML = '<div style="text-align:center;padding:36px 20px;color:#94a3b8;font-size:15px;font-weight:600;">Tamamlanmış masa satışı yok.</div>';
          return;
        }
        body.innerHTML = arr.map(function (row) {
          var nm = _escSalesHtml(row.table_name || row.table_id || 'Masa');
          var amt = (typeof row.charged_amount === 'number' ? row.charged_amount : parseFloat(row.charged_amount) || 0).toFixed(2);
          var pm = _escSalesHtml(row.payment_method || '—');
          var wh = _escSalesHtml((row.sale_date || '') + ' ' + (row.sale_time || '')).trim();
          var can = !!row.canRevert;
          var revertBtn = can
            ? '<button type="button" onclick="revertSultanCompletedSale(' + row.id + ')" style="padding:8px 14px;border-radius:10px;border:1.5px solid #fca5a5;background:#fff1f2;color:#b91c1c;font-size:13px;font-weight:800;cursor:pointer;">Geri al</button>'
            : '<span style="font-size:11px;font-weight:700;color:#94a3b8;">Eski kayıt</span>';
          return '<div style="margin-bottom:10px;background:#f8fafc;border-radius:14px;border:1.5px solid #e2e8f0;padding:12px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">' +
            '<div style="flex:1;min-width:180px;">' +
            '<div style="font-size:16px;font-weight:800;color:#0f172a;">' + nm + '</div>' +
            '<div style="margin-top:4px;font-size:13px;font-weight:600;color:#64748b;">' + amt + ' ₺ · ' + pm + '</div>' +
            (wh ? '<div style="margin-top:2px;font-size:12px;color:#94a3b8;">' + wh + '</div>' : '') +
            '</div>' +
            '<div style="flex-shrink:0;">' + revertBtn + '</div>' +
            '</div>';
        }).join('');
      } catch (e) {
        body.innerHTML = '<div style="text-align:center;padding:28px;color:#b91c1c;font-weight:600;">Bağlantı hatası</div>';
      }
    }
    async function revertSultanCompletedSale(orderId) {
      if (!currentStaff) return;
      if (!confirm('Bu satışı geri alırsanız masa tekrar açık sipariş olur; ilgili satış kaydı silinir. Devam edilsin mi?')) return;
      try {
        var res = await fetch(API_URL + '/sultan-manager/revert-completed-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderId, staffId: currentStaff.id })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          showToast('success', 'Geri alındı', 'Masa tekrar açık sipariş olarak gösteriliyor.');
          await loadData();
          renderSultanSalesHistoryList();
        } else {
          showToast('error', 'Geri alınamadı', (data && data.error) || 'Hata');
        }
      } catch (e) {
        showToast('error', 'Hata', 'Bağlantı hatası');
      }
    }

    // ── Rezervasyon Listesi ──
    function openReservationListSheet() {
      renderReservationList();
      document.getElementById('sultanReservationListSheet').style.display = 'flex';
    }
    function closeReservationListSheet() {
      document.getElementById('sultanReservationListSheet').style.display = 'none';
    }
    function renderReservationList() {
      var cnt = document.getElementById('resListCount');
      if (cnt) cnt.textContent = sultanReservations.length > 0 ? sultanReservations.length + ' rezervasyon' : 'Rezervasyon yok';
      var body = document.getElementById('resListBody');
      if (!body) return;
      if (!sultanReservations.length) {
        body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:15px;font-weight:600;">Henüz rezervasyon bulunmuyor.</div>';
        return;
      }
      // Tarihe göre sırala
      var sorted = sultanReservations.slice().sort(function(a, b){
        if (a.date < b.date) return -1; if (a.date > b.date) return 1;
        if ((a.time || '') < (b.time || '')) return -1; if ((a.time || '') > (b.time || '')) return 1;
        return 0;
      });
      body.innerHTML = sorted.map(function(r, idx) {
        var escapedId = r.id.replace(/'/g, "\\'");
        var tableName = r.tableName || r.tableId;
        var guestName = r.guestName ? r.guestName : '—';
        var peopleInfo = [];
        if (r.peopleCount) peopleInfo.push(r.peopleCount + ' kişi');
        if (r.adults) peopleInfo.push(r.adults + ' yetişkin');
        if (r.children) peopleInfo.push(r.children + ' çocuk');
        if (r.babies) peopleInfo.push(r.babies + ' bebek');
        var peopleStr = peopleInfo.join(' · ') || '—';
        return '<div style="margin-bottom:10px;background:#f8fafc;border-radius:14px;border:1.5px solid #e2e8f0;overflow:hidden;">' +
          '<div style="padding:12px 14px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
          '<div style="font-size:15px;font-weight:800;color:#0f172a;">' + guestName + '</div>' +
          '<div style="font-size:12px;font-weight:700;color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:20px;">' + r.date + ' ' + (r.time || '') + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:#64748b;">' +
          '<span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:20px;font-weight:600;">' + tableName + '</span>' +
          (peopleStr !== '—' ? '<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:20px;font-weight:600;">' + peopleStr + '</span>' : '') +
          '</div>' +
          (r.note ? '<div style="margin-top:6px;font-size:12px;color:#475569;font-style:italic;">' + r.note.replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0,60) + (r.note.length>60?'…':'') + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;border-top:1px solid #e2e8f0;">' +
          '<button type="button" onclick="editReservationFromList(\\'' + escapedId + '\\')" style="flex:1;padding:10px;border:none;background:transparent;color:#1d4ed8;font-size:13px;font-weight:700;cursor:pointer;border-right:1px solid #e2e8f0;">Düzenle</button>' +
          '<button type="button" onclick="printReservationById(\\'' + escapedId + '\\')" style="flex:1;padding:10px;border:none;background:transparent;color:#d97706;font-size:13px;font-weight:700;cursor:pointer;border-right:1px solid #e2e8f0;">Yazdır</button>' +
          '<button type="button" onclick="deleteReservationById(\\'' + escapedId + '\\')" style="flex:1;padding:10px;border:none;background:transparent;color:#dc2626;font-size:13px;font-weight:700;cursor:pointer;">Kaldır</button>' +
          '</div>' +
          '</div>';
      }).join('');
    }
    function editReservationFromList(id) {
      var reservation = sultanReservations.find(function(r){ return r.id === id; });
      if (!reservation) return;
      closeReservationListSheet();
      setTimeout(function(){ openReservationFormSheet(reservation.tableId, reservation); }, 120);
    }
    async function printReservationById(id) {
      try {
        var res = await fetch(API_URL + '/reservations/print', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: id })
        });
        var data = await res.json();
        if (res.ok && data.success) showToast('success', 'Yazdırıldı', 'Rezervasyon fişi yazdırıldı.');
        else showToast('error', 'Yazdırılamadı', (data && data.error) || 'Hata');
      } catch(e) { showToast('error', 'Hata', 'Bağlantı hatası'); }
    }
    async function deleteReservationById(id) {
      try {
        var res = await fetch(API_URL + '/reservations/' + encodeURIComponent(id), { method: 'DELETE' });
        var data = await res.json();
        if (res.ok && data.success) {
          sultanReservations = sultanReservations.filter(function(r){ return r.id !== id; });
          renderReservationList();
          renderTables();
          showToast('success', 'Kaldırıldı', 'Rezervasyon silindi.');
        } else { showToast('error', 'Hata', (data && data.error) || 'Silinemedi.'); }
      } catch(e) { showToast('error', 'Hata', 'Bağlantı hatası'); }
    }

    // Not Modal İşlemleri (Sultan: hedef seçimi + genel / satır bazlı extraNote)
    function hideNoteModalSultan() {
      var m = document.getElementById('noteModalSultan');
      if (m) m.style.display = 'none';
    }
    function appendQuickNoteSultan(text) {
      var el = document.getElementById('noteInputSultan');
      if (!el) return;
      var cur = el.value.trim();
      el.value = cur ? cur + ', ' + text : text;
      el.focus();
    }
    function saveNoteSultan() {
      var text = (document.getElementById('noteInputSultan') && document.getElementById('noteInputSultan').value || '').trim();
      var gen = document.getElementById('sultanNoteGeneral') && document.getElementById('sultanNoteGeneral').checked;
      var lineChecks = document.querySelectorAll('.sultan-note-line-cb:checked');
      if (!gen && lineChecks.length === 0) {
        showToast('error', 'Seçim gerekli', 'Genel not veya en az bir ürün işaretleyin.');
        return;
      }
      if (gen) {
        orderNote = text || '';
      }
      for (var i = 0; i < lineChecks.length; i++) {
        var lid = parseInt(lineChecks[i].getAttribute('data-line-id'), 10);
        var row = cart.find(function(e) { return e.lineId === lid; });
        if (row) {
          row.extraNote = text || null;
        }
      }
      hideNoteModalSultan();
      updateNoteButton();
      throttle('updateCart', updateCart, 50);
      schedulePrepareReceipts();
    }
    function showNoteModal() {
      if (isSultanMobile) {
        var listEl = document.getElementById('sultanNoteLineList');
        if (listEl) {
          if (cart.length === 0) {
            listEl.innerHTML = '<p style="font-size:13px;color:#64748b;margin:0 0 8px;">Sepette ürün yok; yalnızca <strong>genel not</strong> ekleyebilirsiniz.</p>';
          } else {
            listEl.innerHTML = cart.map(function(item) {
              var name = String(item.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
              return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:8px;cursor:pointer;background:#fff;">' +
                '<input type="checkbox" class="sultan-note-line-cb" data-line-id="' + item.lineId + '" style="width:20px;height:20px;margin-top:2px;flex-shrink:0;accent-color:#059669;" />' +
                '<span style="font-size:14px;font-weight:600;color:#1f2937;line-height:1.35;">' + name +
                ' <span style="font-weight:500;color:#64748b;">×' + item.quantity + '</span></span></label>';
            }).join('');
          }
        }
        var genCb = document.getElementById('sultanNoteGeneral');
        if (genCb) genCb.checked = false;
        var ta = document.getElementById('noteInputSultan');
        if (ta) ta.value = '';
        document.getElementById('noteModalSultan').style.display = 'flex';
        return;
      }
      document.getElementById('noteInput').value = orderNote;
      document.getElementById('noteModal').style.display = 'flex';
    }
    
    // Ürün İptal Modal İşlemleri
    let cancelItemId = null;
    let cancelItemMaxQuantity = 1;
    
    function showManagerRequiredMessage() {
      showToast('error', 'Yetki Yok', 'İptal ettirmek için lütfen müdürle görüşünüz.');
    }
    
    function showCancelItemModal(itemId, maxQuantity, productName, fromAllOrders) {
      if (!hasManagerPermission()) {
        showManagerRequiredMessage();
        return;
      }
      cancelOpenedFromSultanAllOrdersSheet = fromAllOrders === true;

      cancelItemId = itemId;
      cancelItemMaxQuantity = maxQuantity;
      document.getElementById('cancelItemName').textContent = productName;
      document.getElementById('cancelItemMaxQuantity').textContent = maxQuantity + ' adet';
      const quantityInput = document.getElementById('cancelItemQuantity');
      if (quantityInput) {
        quantityInput.value = 1;
        quantityInput.setAttribute('max', maxQuantity);
        quantityInput.max = maxQuantity;
      }
      
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
      cancelOpenedFromSultanAllOrdersSheet = false;
    }
    
    function validateCancelQuantity() {
      const input = document.getElementById('cancelItemQuantity');
      let value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) {
        value = 1;
      } else if (value > cancelItemMaxQuantity) {
        value = cancelItemMaxQuantity;
      }
      input.value = value;
    }
    
    function changeCancelQuantity(delta) {
      const input = document.getElementById('cancelItemQuantity');
      if (!input) return;
      let value = parseInt(input.value, 10) || 1;
      value = value + delta;
      if (value < 1) value = 1;
      if (value > cancelItemMaxQuantity) value = cancelItemMaxQuantity;
      input.value = value;
    }
    
    // İptal işlemi için geçici değişkenler
    let pendingCancelItemId = null;
    let pendingCancelQuantity = null;
    let cancelOpenedFromSultanAllOrdersSheet = false;
    let pendingCancelFromAllOrdersSheet = false;
    
    function confirmCancelItem() {
      if (!cancelItemId) return;
      
      const cancelQuantity = parseInt(document.getElementById('cancelItemQuantity').value);
      if (isNaN(cancelQuantity) || cancelQuantity < 1 || cancelQuantity > cancelItemMaxQuantity) {
        showToast('error', 'Hata', 'Geçersiz iptal miktarı');
        return;
      }
      
      if (!hasManagerPermission()) {
        showManagerRequiredMessage();
        return;
      }
      
      // İptal edilecek ürün bilgilerini sakla
      pendingCancelFromAllOrdersSheet = !!cancelOpenedFromSultanAllOrdersSheet;
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
          if (pendingCancelFromAllOrdersSheet) {
            pendingCancelFromAllOrdersSheet = false;
            const _aos = document.getElementById('sultanAllOrdersSheet');
            if (_aos && _aos.style.display === 'flex') await renderSultanAllOrdersSheet();
            await loadData();
          } else if (selectedTable) {
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
          pendingCancelFromAllOrdersSheet = false;
        }
      } catch (error) {
        console.error('İptal hatası:', error);
        showToast('error', 'Hata', 'Ürün iptal edilirken bir hata oluştu');
        resetCancelButton(cancelBtn, cancelBtnText, cancelBtnSpinner);
        pendingCancelItemId = null;
        pendingCancelQuantity = null;
        pendingCancelFromAllOrdersSheet = false;
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
    
    function hideCancelReasonModalAndReturnToTables() {
      // İptal butonunu tekrar aktif hale getir (eğer varsa)
      const currentPendingId = pendingCancelItemId;
      if (currentPendingId) {
        const cancelBtn = document.getElementById('cancelBtn_' + currentPendingId);
        const cancelBtnText = document.getElementById('cancelBtnText_' + currentPendingId);
        const cancelBtnSpinner = document.getElementById('cancelBtnSpinner_' + currentPendingId);
        resetCancelButton(cancelBtn, cancelBtnText, cancelBtnSpinner);
      }
      // Pending iptal işlemini iptal et
      pendingCancelItemId = null;
      pendingCancelQuantity = null;
      hideCancelReasonModal();
      if (pendingCancelFromAllOrdersSheet) {
        pendingCancelFromAllOrdersSheet = false;
        return;
      }
      // Masalara dön
      document.getElementById('orderSection').style.display = 'none';
      document.getElementById('tableSelection').style.display = 'block';
      // Çıkış Yap butonunu göster
      const mainLogoutBtn = document.getElementById('mainLogoutBtn');
      if (mainLogoutBtn) {
        mainLogoutBtn.style.display = 'block';
      }
      selectedTable = null;
      renderTables();
    }
    
    async function submitCancelReason() {
      const cancelReasonInput = document.getElementById('cancelReasonInput');
      const cancelReason = cancelReasonInput ? cancelReasonInput.value.trim() : '';
      
      if (!cancelReason || cancelReason === '') {
        showToast('error', 'Hata', 'Lütfen iptal açıklaması yazın');
        return;
      }
      
      if (!pendingCancelItemId || !pendingCancelQuantity) {
        showToast('error', 'Hata', 'İptal işlemi bulunamadı');
        hideCancelReasonModal();
        return;
      }
      
      const btn = document.getElementById('confirmCancelReasonBtn');
      const btnText = document.getElementById('confirmCancelReasonBtnText');
      const btnSpinner = document.getElementById('confirmCancelReasonBtnSpinner');
      if (btn) btn.disabled = true;
      if (btnText) btnText.textContent = 'İşleniyor...';
      if (btnSpinner) btnSpinner.style.display = 'block';
      
      try {
        const response = await fetch(API_URL + '/cancel-table-order-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: pendingCancelItemId,
            cancelQuantity: pendingCancelQuantity,
            staffId: currentStaff ? currentStaff.id : null,
            cancelReason: cancelReason
          })
        });
        const result = await response.json();
        
        if (result.success) {
          hideCancelReasonModal();
          if (cancelReasonInput) cancelReasonInput.value = '';
          pendingCancelItemId = null;
          pendingCancelQuantity = null;
          showToast('success', 'Başarılı', 'Ürün iptal edildi');
          if (pendingCancelFromAllOrdersSheet) {
            pendingCancelFromAllOrdersSheet = false;
            const _aos2 = document.getElementById('sultanAllOrdersSheet');
            if (_aos2 && _aos2.style.display === 'flex') await renderSultanAllOrdersSheet();
            await loadData();
          } else if (selectedTable) {
            await loadExistingOrders(selectedTable.id);
          }
        } else {
          showToast('error', 'Hata', result.error || 'Ürün iptal edilemedi');
        }
      } catch (error) {
        console.error('İptal işlemi hatası:', error);
        showToast('error', 'Hata', 'İptal işlemi sırasında bir hata oluştu');
      } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Tamamla';
        if (btnSpinner) btnSpinner.style.display = 'none';
      }
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
    
    function appendQuickNote(text) {
      const el = document.getElementById('noteInput');
      if (!el) return;
      const current = el.value.trim();
      el.value = current ? current + ', ' + text : text;
      el.focus();
    }
    
    function saveNote() {
      orderNote = document.getElementById('noteInput').value.trim();
      updateNoteButton();
      hideNoteModal();
      schedulePrepareReceipts();
    }
    
    function updateNoteButton() {
      const noteButtonText = document.getElementById('noteButtonText');
      var hasLineNotes = cart.some(function(i) { return i.extraNote && String(i.extraNote).trim(); });
      if (orderNote || (isSultanMobile && hasLineNotes)) {
        noteButtonText.textContent = 'Not Düzenle';
      } else {
        noteButtonText.textContent = 'Not Ekle';
      }
    }
    
    function sendOrder() {
      if (!selectedTable || cart.length === 0) { 
        showToast('error', 'Eksik Bilgi', 'Lütfen masa seçin ve ürün ekleyin');
        return; 
      }
      if (!currentStaff) { 
        showToast('error', 'Giriş Gerekli', 'Lütfen giriş yapın');
        return; 
      }
      
      var sendBtn = document.getElementById('sendOrderBtn');
      var sendBtnContent = document.getElementById('sendOrderBtnContent');
      var originalSendHTML = sendBtnContent ? sendBtnContent.innerHTML : '';
      
      // Gönderilecek veriyi şimdi al (hemen sonra cart temizlenecek)
      var totalAmount = cart.reduce(function(sum, item) {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      var payload = { 
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          isGift: item.isGift || false,
          isYanUrun: item.isYanUrun || (typeof item.id === 'string' && item.id.startsWith('yan_urun_')),
          extraNote: (item.extraNote && String(item.extraNote).trim()) ? String(item.extraNote).trim() : null
        })), 
        totalAmount, 
        tableId: selectedTable.id, 
        tableName: selectedTable.name, 
        tableType: selectedTable.type,
        staffId: currentStaff.id,
        orderNote: orderNote || null
      };
      // printJobId varsa büyük HTML göndermeye gerek yok — sunucu zaten hazır pencereyi kullanır
      if (preparedPrintJobId) {
        payload.printJobId = preparedPrintJobId;
      } else {
        // Fallback: hazır HTML yoksa sunucu kendi üretir (printAdisyonByCategory)
        // preparedHtmlReceipts gönderme — büyük payload limit sorununa yol açar
      }
      var currentTableId = selectedTable.id;
      preparedReceipts = {};
      preparedHtmlReceipts = {};
      preparedPrintJobId = null;
      
      if (sendBtn) sendBtn.disabled = true;
      // Anında frontend: butonda "Gönderildi" göster, sepeti temizle, toast göster
      if (sendBtnContent) sendBtnContent.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Gönderildi';
      showToast('success', 'Sipariş Gönderildi', 'Ürünler gönderildi.');
      cart = []; 
      orderNote = '';
      updateCart();
      updateNoteButton();
      var searchEl = document.getElementById('searchInput');
      if (searchEl) searchEl.value = '';
      searchQuery = '';
      loadExistingOrders(currentTableId).catch(function(err) { console.error('Sipariş listesi yenileme:', err); });
      loadData().then(function() { renderProducts(); }).catch(function(err) { console.error('Veri yenileme:', err); });
      
      // Butonu kısa süre sonra eski haline getir
      setTimeout(function() {
        if (sendBtn) sendBtn.disabled = false;
        if (sendBtnContent) sendBtnContent.innerHTML = originalSendHTML;
        // Sultan Somatı / Makara Havzan mobil: sipariş sonrası masalar ekranına dön
        if (isSultanMobile) {
          sultanNotes = {};
        }
        if (isSultanMobile || isMakaraHavzanMobile) {
          goBackToTables();
        }
      }, 1000);
      
      // Backend isteği arka planda (birebir aynı işlem devam etsin)
      fetch(API_URL + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function(response) { return response.json(); })
        .then(function(result) {
          if (!result.success) {
            showToast('error', 'Hata', result.error || 'Sipariş sunucuda işlenemedi.');
          }
        })
        .catch(function(error) { 
          console.error('Sipariş gönderme hatası:', error); 
          showToast('error', 'Bağlantı Hatası', 'Sunucuya iletilemedi. Lütfen kontrol edin.');
        });
    }

    // ── Donanım Geri Tuşu (Android / PWA) — önce üst katman, uygulama kapanmasın ──
    (function() {
      function _isVisible(id) {
        var el = document.getElementById(id);
        if (!el) return false;
        try {
          var cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (parseFloat(cs.opacity) === 0) return false;
        } catch (e) {
          return false;
        }
        return true;
      }

      function handleMobileBack() {
        // En üstteki katmanı kapat, öncelik sırasıyla:

        // 0. Yayın mesajı (tam ekran, yüksek z-index)
        if (_isVisible('broadcastMessageModal')) { closeBroadcastMessage(); return; }

        // 1. Dinamik sultan not modalı
        if (_isVisible('sultanNoteModal')) { closeSultanNoteModal(); return; }

        // 2. Türk kahvesi / Menengiç modalı
        if (_isVisible('turkishCoffeeModal')) { hideTurkishCoffeeModal(); return; }

        // 3. Tam ekran ürün araması (Sultan / Makara Havzan)
        if (useImmersiveProductSearch && isSultanImmersiveSearchOpen()) { closeSultanImmersiveSearch(); return; }

        // 3b. Müdür işlemleri şifre modalı
        if (_isVisible('managerOpsPasswordModal')) { closeManagerOpsPasswordModal(); return; }

        // 4. Şifre değiştirme modalı
        if (_isVisible('changePasswordModal')) { closeChangePasswordModal(); return; }

        // 5. Çıkış onay modalı
        if (_isVisible('logoutModal')) { hideLogoutModal(); return; }

        // 6. İptal neden modalı
        if (_isVisible('cancelReasonModal')) { document.getElementById('cancelReasonModal').style.display = 'none'; return; }

        // 7. İptal onay sheet (manager içinden)
        if (_isVisible('sultanMgrCancelSheet')) { closeSultanMgrCancelSheet(); return; }

        // 7b. Masa aktar hedef seçim sheet
        if (_isVisible('sultanMgrTransferSheet')) { closeSultanMgrTransferSheet(); return; }

        // 7c. Rezervasyon form/detay/liste sheet'leri
        if (_isVisible('sultanReservationFormSheet')) { closeReservationFormSheet(); return; }
        if (_isVisible('sultanReservationDetailSheet')) { closeReservationDetailSheet(); return; }
        if (_isVisible('sultanReservationListSheet')) { closeReservationListSheet(); return; }
        if (_isVisible('sultanSalesHistorySheet')) { closeSultanSalesHistorySheet(); return; }
        if (_isVisible('sultanAllOrdersSheet')) { closeSultanAllOrdersSheet(); return; }

        // 7d. Ödeme sheet
        if (_isVisible('sultanPaymentSheet')) { closeSultanPaymentSheet(); return; }

        // 8. Yönetici sheet
        if (_isVisible('sultanManagerSheet')) { closeSultanManagerSheet(); return; }

        // 9. İkram modalı
        if (_isVisible('giftMarkModal')) { hideGiftMarkModal(); return; }

        // 10. Ürün iptal modalı
        if (_isVisible('cancelItemModal')) { hideCancelItemModal(); return; }

        // 11. Not modallari
        if (_isVisible('noteModalSultan')) { hideNoteModalSultan(); return; }
        if (_isVisible('noteModal')) { hideNoteModal(); return; }

        // 12. Transfer / birleştirme modallari
        if (_isVisible('transferItemsModal')) { hideTransferItemsModal(); return; }
        if (_isVisible('transferModal')) { hideTransferModal(); return; }
        if (_isVisible('mergeModal')) { hideMergeModal(); return; }

        // 13. Drawer (opacity ile açılır; kapalıyken opacity:0 → _isVisible false)
        if (_isVisible('drawerOverlay')) { closeDrawer(); return; }

        // 14. Sipariş ekranından masalara dön
        if (_isVisible('orderSection')) { goBackToTables(); return; }

        // Masalar / ana ekran: geçmişi tazele — uygulama kapanmasın
        try {
          history.pushState({ mobileNav: true }, '');
        } catch (e2) {}
      }

      function bindHistoryTrap() {
        if (!window.history || !window.history.pushState) return;
        try {
          history.pushState({ mobileNav: true }, '');
        } catch (e) {}
        window.addEventListener('popstate', function() {
          try {
            history.pushState({ mobileNav: true }, '');
          } catch (e3) {}
          handleMobileBack();
        });
        window.addEventListener('pageshow', function(ev) {
          if (ev && ev.persisted) {
            try {
              history.pushState({ mobileNav: true }, '');
            } catch (e4) {}
          }
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindHistoryTrap);
      } else {
        bindHistoryTrap();
      }
    })();
    // ──────────────────────────────────────────────────────────────────────────────
  </script>
</body>
</html>`;
}

// ─── Önceden Yüklenmiş Pencere Mimarisi (Anında Yazdırma) ───────────────────
// printJobId -> { windows: [{printerName, win, ready}], createdAt }
const preloadedPrintJobs = new Map();
const PRINT_JOB_TTL_MS = 5 * 60 * 1000; // 5 dakika sonra temizle

function cleanupOldPrintJobs() {
  const now = Date.now();
  for (const [jobId, job] of preloadedPrintJobs.entries()) {
    if (now - job.createdAt > PRINT_JOB_TTL_MS) {
      job.windows.forEach(({ win }) => {
        try { if (win && !win.isDestroyed()) win.close(); } catch (_) {}
      });
      preloadedPrintJobs.delete(jobId);
    }
  }
}

// Sepetteyken çağrılır — her yazıcı için BrowserWindow açar + HTML yükler
function preloadPrintWindows(htmlReceiptsMap) {
  // Önceki preload işlerini iptal et (kart değişmişse)
  for (const [, oldJob] of preloadedPrintJobs.entries()) {
    oldJob.windows.forEach(({ win }) => {
      try { if (win && !win.isDestroyed()) win.close(); } catch (_) {}
    });
  }
  preloadedPrintJobs.clear();

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const windows = Object.entries(htmlReceiptsMap).map(([printerName, html]) => {
    const win = new BrowserWindow({
      show: false, width: 220, height: 3000,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const entry = { printerName, win, ready: false };
    win.webContents.once('did-finish-load', () => { entry.ready = true; });
    win.webContents.once('dom-ready', () => { entry.ready = true; });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
    return entry;
  });
  preloadedPrintJobs.set(jobId, { windows, createdAt: Date.now() });
  cleanupOldPrintJobs();
  return jobId;
}

// "Siparişi Gönder"e basılınca çağrılır — pencere zaten hazır, sadece .print()
async function printPreloadedJob(printJobId) {
  const job = preloadedPrintJobs.get(printJobId);
  if (!job) return false;
  preloadedPrintJobs.delete(printJobId);
  console.log(`[printPreloadedJob] ${job.windows.length} yazıcı için yazdırma başlıyor`);

  const printOne = async ({ printerName, win, ready }) => {
    if (!win || win.isDestroyed()) return;
    console.log(`[printPreloadedJob] Yazıcı: "${printerName}", hazır: ${ready}`);
    // Pencere yüklenmediyse en fazla 1000ms bekle (genellikle zaten hazır)
    if (!ready) {
      await new Promise(r => {
        const t = setTimeout(r, 1000);
        win.webContents.once('did-finish-load', () => { clearTimeout(t); r(); });
        win.webContents.once('dom-ready', () => { clearTimeout(t); r(); });
      });
    }
    const available = getAvailablePrinterNames();
    const exact = available.find(p => p === printerName);
    const partial = available.find(p => p.includes(printerName) || printerName.includes(p));
    const targetName = exact || partial || printerName;
    const printOptions = {
      silent: true, printBackground: true, margins: { marginType: 'none' },
      landscape: false, scaleFactor: 100, pagesPerSheet: 1,
      collate: false, color: false, copies: 1, duplex: 'none',
      deviceName: targetName
    };
    await new Promise((resolve) => {
      win.webContents.print(printOptions, () => {
        try { if (!win.isDestroyed()) win.close(); } catch (_) {}
        resolve();
      });
    });
  };

  await Promise.all(job.windows.map(e =>
    printOne(e).catch(err => console.error(`[printPreloadedJob] ${e.printerName}:`, err?.message || err))
  ));
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

// HTTP Server ve API Setup
function startAPIServer() {
  const appExpress = express();
  appExpress.use(cors());
  appExpress.use(express.json({ limit: '10mb' }));
  
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

  function getLocalCategoriesWithYanUrunler() {
    const YAN_URUNLER_CATEGORY_ID = 999999;
    let base = Array.isArray(db.categories) ? [...db.categories] : [];
    base.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    if (activeBranchKey === 'sultansomati') {
      return base.filter((c) => !isYanUrunlerCategoryForFilter(c));
    }
    if (!base.find(c => c.id === YAN_URUNLER_CATEGORY_ID)) {
      base.push({
        id: YAN_URUNLER_CATEGORY_ID,
        name: 'Yan Ürünler',
        order_index: 9999
      });
    }
    return base;
  }

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
        
        // Firebase boş dönerse local fallback kullan
        if (categories.length === 0) {
          return res.json(getLocalCategoriesWithYanUrunler());
        }
        if (activeBranchKey === 'sultansomati') {
          const filtered = categories.filter((c) => !isYanUrunlerCategoryForFilter(c));
          return res.json(filtered);
        }
        // Yan Ürünler kategorisini ekle (Makara vb.)
        const YAN_URUNLER_CATEGORY_ID = 999999; // Özel ID
        if (!categories.find(c => c.id === YAN_URUNLER_CATEGORY_ID)) {
          categories.push({
            id: YAN_URUNLER_CATEGORY_ID,
            name: 'Yan Ürünler',
            order_index: 9999
          });
        }

        res.json(categories);
      } else {
        // Firebase yoksa local database'den çek
        res.json(getLocalCategoriesWithYanUrunler());
      }
    } catch (error) {
      console.error('❌ Kategoriler çekilirken hata:', error);
      // Hata durumunda local database'den çek
      res.json(getLocalCategoriesWithYanUrunler());
    }
  });

  appExpress.get('/api/products', async (req, res) => {
    const categoryId = req.query.category_id;
    try {
      const YAN_URUNLER_CATEGORY_ID = 999999; // Özel ID

      if (activeBranchKey === 'sultansomati' && categoryId && Number(categoryId) === YAN_URUNLER_CATEGORY_ID) {
        return res.json([]);
      }
      
      // Yan Ürünler kategorisi seçildiyse yan ürünleri döndür
      if (categoryId && Number(categoryId) === YAN_URUNLER_CATEGORY_ID) {
        const yanUrunler = (db.yanUrunler || []).map(urun => ({
          id: `yan_urun_${urun.id}`, // Özel ID formatı
          name: urun.name,
          price: urun.price,
          category_id: YAN_URUNLER_CATEGORY_ID,
          image: null,
          trackStock: false,
          stock: null,
          isYanUrun: true
        }));
        return res.json(yanUrunler);
      }
      
      let products = [];
      
      // Firebase'den direkt çek
      if (firestore && firebaseCollection && firebaseGetDocs) {
        const productsRef = firebaseCollection(firestore, 'products');
        const snapshot = await firebaseGetDocs(productsRef);
        
        snapshot.forEach((doc) => {
          const firebaseProduct = doc.data();
          const product = mapFirebaseProductToLocal(firebaseProduct);
          
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
      
      // Firebase boş dönerse local fallback kullan
      if (products.length === 0) {
        if (categoryId) {
          products = db.products.filter(p => p.category_id === Number(categoryId));
        } else {
          products = db.products;
        }
      }

      // PERFORMANS: Stok + yalnızca yerelde olan base64 görseli birleştir (Firebase'de image yok)
      const productsWithStock = products.map((product) => {
        const localProduct = db.products.find(p => p.id === product.id);
        const trackStock = localProduct?.trackStock === true;
        const stock = trackStock ? (localProduct?.stock !== undefined ? localProduct.stock : 0) : undefined;
        let imageOut = product.image;
        if (
          localProduct &&
          typeof localProduct.image === 'string' &&
          localProduct.image.startsWith('data:image') &&
          (imageOut == null || imageOut === '')
        ) {
          imageOut = localProduct.image;
        }
        return {
          ...product,
          image: imageOut,
          trackStock,
          stock
        };
      });
      
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

  // PERFORMANS: Backend resim cache - lokal görseller için hızlı cache
  const imageCache = new Map();
  const CACHE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 gün - lokal görseller değişmez
  const CACHE_MAX_SIZE = 2000; // Maksimum 2000 resim (8GB RAM için yeterli)
  
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
      is_manager: s.is_manager || false,
      is_chef: s.is_chef || false
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
          is_manager: staff.is_manager || false,
          is_chef: staff.is_chef || false
        }
      });
    } else {
      // Konsolda "Failed to load resource: 401" görünmemesi için 200 ile dön
      res.json({ success: false, error: 'Şifre hatalı' });
    }
  });
  
  // Mobil personel şifre değiştirme endpoint'i
  appExpress.post('/api/staff/change-password', (req, res) => {
    const { staffId, currentPassword, newPassword } = req.body;
    
    if (!staffId || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Tüm alanlar gereklidir' });
    }
    
    const staff = (db.staff || []).find(s => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }
    
    // Mevcut şifreyi doğrula
    if (staff.password !== currentPassword.toString()) {
      return res.status(401).json({ success: false, error: 'Mevcut şifre hatalı' });
    }
    
    // Yeni şifreyi kaydet
    staff.password = newPassword.toString();
    saveDatabase();
    
    res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
  });

  /** Masaüstünde müdür seç / kaldır için kullanılan şifre tanımlı mı (mobil müdür belirler) */
  appExpress.get('/api/staff/manager-ops-configured', (req, res) => {
    const p = db.settings && db.settings.managerOperationsPassword;
    const configured = typeof p === 'string' && p.length > 0;
    res.json({ configured });
  });

  /** Mobil müdür: masaüstü müdür işlem şifresi belirle / güncelle */
  appExpress.post('/api/staff/manager-operations-password', (req, res) => {
    const { staffId, staffPassword, newManagerOpsPassword, currentManagerOpsPassword } = req.body || {};
    if (!staffId || !staffPassword || !newManagerOpsPassword) {
      return res.status(400).json({ success: false, error: 'Personel, giriş şifresi ve yeni şifre gerekli' });
    }
    const np = newManagerOpsPassword.toString();
    if (np.length < 4) {
      return res.status(400).json({ success: false, error: 'Yeni şifre en az 4 karakter olmalıdır' });
    }
    const staff = (db.staff || []).find((s) => String(s.id) === String(staffId));
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }
    if (staff.password !== staffPassword.toString()) {
      return res.status(401).json({ success: false, error: 'Giriş şifresi hatalı' });
    }
    const canSet = !!(staff.is_manager || activeBranchKey === 'sultansomati');
    if (!canSet) {
      return res.status(403).json({ success: false, error: 'Bu işlemi yalnızca müdür yapabilir' });
    }
    const already = isManagerOperationsPasswordConfigured();
    if (already) {
      const cur = (currentManagerOpsPassword === undefined || currentManagerOpsPassword === null)
        ? ''
        : String(currentManagerOpsPassword);
      if (cur !== (db.settings.managerOperationsPassword || '').toString()) {
        return res.status(401).json({ success: false, error: 'Mevcut masaüstü müdür işlem şifresi hatalı' });
      }
    }
    if (!db.settings) db.settings = {};
    db.settings.managerOperationsPassword = np;
    saveDatabase();
    res.json({ success: true, message: 'Masaüstü müdür işlem şifresi kaydedildi' });
  });

  /** Makara Havzan mobil müdür: son 24 saat iptal kayıtları (Firebase cancels) */
  appExpress.get('/api/staff/recent-cancellations', async (req, res) => {
    try {
      const staffIdRaw = req.query.staffId;
      if (!staffIdRaw) {
        return res.status(400).json({ success: false, error: 'staffId gerekli' });
      }
      if (activeBranchKey !== 'makara') {
        return res.status(403).json({ success: false, error: 'Bu liste yalnızca Makara Havzan mobil müdürü içindir' });
      }
      const staff = (db.staff || []).find((s) => String(s.id) === String(staffIdRaw));
      if (!staff || !staff.is_manager) {
        return res.status(403).json({ success: false, error: 'Yetkisiz' });
      }
      const items = await fetchFirestoreCancelsLastHours('makara', 24);
      res.json({ success: true, items });
    } catch (e) {
      console.error('recent-cancellations:', e);
      res.status(500).json({ success: false, error: 'Liste alınamadı' });
    }
  });

  appExpress.get('/api/tables', (req, res) => {
    if (activeBranchKey === 'sultansomati') {
      return res.json(buildSultanTablesListForApi(db));
    }
    const tables = [];
    const isSuriciBranch = activeBranchKey === 'makarasur';
    const insideCount = isSuriciBranch ? 20 : MAKARA_HAVZAN_MAIN_TABLE_COUNT;
    for (let i = 1; i <= insideCount; i++) {
      const tableId = `inside-${i}`;
      const hasPendingOrder = (db.tableOrders || []).some(
        o => o.table_id === tableId && o.status === 'pending'
      );
      tables.push({
        id: tableId,
        number: i,
        type: 'inside',
        name: `Masa ${i}`,
        hasOrder: hasPendingOrder
      });
    }
    if (isSuriciBranch) {
      MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS.forEach((tableNumber, idx) => {
        const tableId = `outside-${tableNumber}`;
        const oldTableId = `outside-${idx + 1}`;
        const hasPendingOrder = (db.tableOrders || []).some(
          o => (o.table_id === tableId || o.table_id === oldTableId) && o.status === 'pending'
        );
        tables.push({
          id: tableId,
          number: tableNumber,
          type: 'outside',
          name: `Masa ${tableNumber}`,
          hasOrder: hasPendingOrder
        });
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

  // Ürün aktar (mobil arayüz için - sadece müdür)
  appExpress.post('/api/transfer-order-items', async (req, res) => {
    try {
      const { sourceOrderId, targetTableId, itemsToTransfer, staffId } = req.body;
      
      if (!sourceOrderId || !targetTableId || !itemsToTransfer || !Array.isArray(itemsToTransfer) || itemsToTransfer.length === 0) {
        return res.status(400).json({ success: false, error: 'Geçersiz istek parametreleri' });
      }

      // Sultan Somatı'da tüm personel yetkili; diğer şubelerde sadece müdür
      if (!staffId) {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }
      if (activeBranchKey !== 'sultansomati') {
        const staff = (db.staff || []).find(s => s.id === staffId);
        if (!staff || !staff.is_manager) {
          return res.status(403).json({ 
            success: false, 
            error: 'Ürün aktarma yetkisi yok. Bu işlem için müdür yetkisi gereklidir.' 
          });
        }
      }

      const sourceOrder = db.tableOrders.find(o => o.id === sourceOrderId);
      if (!sourceOrder) return res.status(404).json({ success: false, error: 'Sipariş bulunamadı' });
      if (sourceOrder.status !== 'pending') return res.status(400).json({ success: false, error: 'Bu sipariş aktarılamaz' });

      if (sourceOrder.table_id === targetTableId) return res.status(400).json({ success: false, error: 'Hedef masa, mevcut masa ile aynı olamaz' });

      const targetTableName = getTableNameFromId(targetTableId);
      const targetTableType = getTableTypeFromId(targetTableId);
      let targetOrder = db.tableOrders.find(o => o.table_id === targetTableId && o.status === 'pending');

      const now = new Date();
      const orderDate = now.toLocaleDateString('tr-TR');
      const orderTime = getFormattedTime(now);

      if (!targetOrder) {
        const newOrderId = db.tableOrders.length > 0 ? Math.max(...db.tableOrders.map(o => o.id)) + 1 : 1;
        targetOrder = {
          id: newOrderId,
          table_id: targetTableId,
          table_name: targetTableName,
          table_type: targetTableType,
          total_amount: 0,
          order_date: orderDate,
          order_time: orderTime,
          status: 'pending',
          order_note: null
        };
        db.tableOrders.push(targetOrder);
      }

      let transferredAmount = 0;
      const itemsForPrint = [];
      const transferredItemsMap = {}; // Aktarılan item'ları takip etmek için

      for (const it of itemsToTransfer) {
        const productId = it.product_id;
        const qty = it.quantity || 0;
        const isGift = it.isGift || false;
        if (qty <= 0) continue;

        const sourceItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrderId && oi.product_id === productId && (oi.isGift || false) === isGift);
        let remaining = qty;

        for (const item of sourceItems) {
          if (remaining <= 0) break;
          
          // Sadece ödenmemiş miktarı al
          const unpaidQty = item.quantity - (Number(item.paid_quantity) || 0);
          if (unpaidQty <= 0) continue;
          
          const takeQty = Math.min(remaining, unpaidQty);
          const itemAmount = isGift ? 0 : (item.price * takeQty);
          transferredAmount += itemAmount;

          if (takeQty >= unpaidQty) {
            // Tüm ödenmemiş miktarı al - item'ı hedef siparişe taşı
            // Ama paid_quantity'yi sıfırla çünkü yeni siparişte ödenmemiş
            const newItemId = db.tableOrderItems.length > 0 ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 : 1;
            db.tableOrderItems.push({
              ...item,
              id: newItemId,
              order_id: targetOrder.id,
              quantity: unpaidQty,
              paid_quantity: 0,
              is_paid: false,
              payment_method: null
            });
            
            // Yazdırma listesine ekle
            const printKey = `${productId}_${isGift}`;
            if (!transferredItemsMap[printKey]) {
              transferredItemsMap[printKey] = {
                id: productId,
                name: it.product_name || item.product_name || '',
                quantity: 0,
                price: item.price || it.price || 0,
                isGift: isGift,
                staff_name: it.staff_name || item.staff_name || null,
                added_date: orderDate,
                added_time: orderTime
              };
            }
            transferredItemsMap[printKey].quantity += unpaidQty;
            
            // Kaynak item'dan ödenmemiş miktarı çıkar
            item.quantity -= unpaidQty;
            // Eğer item tamamen tükendiyse sil
            if (item.quantity <= 0) {
              const idx = db.tableOrderItems.findIndex(oi => oi.id === item.id);
              if (idx !== -1) db.tableOrderItems.splice(idx, 1);
            } else {
              // Kalan miktar için paid_quantity'yi güncelle
              item.paid_quantity = Math.min(item.paid_quantity || 0, item.quantity);
            }
            
            remaining -= takeQty;
          } else {
            // Sadece bir kısmını al - yeni item oluştur
            const newItemId = db.tableOrderItems.length > 0 ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 : 1;
            db.tableOrderItems.push({
              ...item,
              id: newItemId,
              order_id: targetOrder.id,
              quantity: takeQty,
              paid_quantity: 0,
              is_paid: false,
              payment_method: null
            });
            
            // Yazdırma listesine ekle
            const printKey = `${productId}_${isGift}`;
            if (!transferredItemsMap[printKey]) {
              transferredItemsMap[printKey] = {
                id: productId,
                name: it.product_name || item.product_name || '',
                quantity: 0,
                price: item.price || it.price || 0,
                isGift: isGift,
                staff_name: it.staff_name || item.staff_name || null,
                added_date: orderDate,
                added_time: orderTime
              };
            }
            transferredItemsMap[printKey].quantity += takeQty;
            
            // Kaynak item'dan ödenmemiş miktarın bir kısmını çıkar
            item.quantity -= takeQty;
            item.paid_quantity = Math.min(item.paid_quantity || 0, item.quantity);
            
            remaining -= takeQty;
          }
        }

        // Eğer hala aktarılacak miktar varsa (bu durumda kaynakta yeterli ödenmemiş ürün yok demektir)
        // Bu durum normalde olmamalı çünkü frontend'de sadece ödenmemiş miktar gösteriliyor
        // Ama yine de güvenlik için kontrol ediyoruz
        if (remaining > 0) {
          console.warn(`Uyarı: ${remaining} adet aktarılamadı (yeterli ödenmemiş ürün yok)`);
        }
      }

      // Aktarılan item'ları yazdırma listesine ekle
      itemsForPrint.push(...Object.values(transferredItemsMap));

      const sourceRemainingItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrderId);
      sourceOrder.total_amount = Math.round(sourceRemainingItems.reduce((sum, oi) => sum + (oi.isGift ? 0 : oi.price * oi.quantity), 0) * 100) / 100;
      targetOrder.total_amount = Math.round(((targetOrder.total_amount || 0) + transferredAmount) * 100) / 100;

      if (sourceRemainingItems.length === 0) {
        sourceOrder.status = 'completed';
        if (io) io.emit('table-update', { tableId: sourceOrder.table_id, hasOrder: false });
        syncSingleTableToFirebase(sourceOrder.table_id).catch(() => {});
      }

      saveDatabase();
      if (io) io.emit('table-update', { tableId: targetTableId, hasOrder: true });
      syncSingleTableToFirebase(targetTableId).catch(() => {});

      if (itemsForPrint.length > 0) {
        const adisyonDataForPrint = {
          tableName: targetTableName,
          tableType: targetTableType,
          items: itemsForPrint,
          orderDate: orderDate,
          orderTime: orderTime
        };
        printAdisyonByCategory(adisyonDataForPrint).catch(err => console.error('Adisyon yazdırma hatası:', err));
      }

      res.json({ 
        success: true, 
        transferredCount: itemsForPrint.length
      });
    } catch (error) {
      console.error('Ürün aktarım hatası:', error);
      res.status(500).json({ success: false, error: 'Ürün aktarılırken bir hata oluştu' });
    }
  });

  // Masa birleştir (mobil arayüz için - sadece müdür)
  appExpress.post('/api/merge-table-order', async (req, res) => {
    try {
      const { sourceTableId, targetTableId, staffId } = req.body;
      
      if (!sourceTableId || !targetTableId) {
        return res.status(400).json({ success: false, error: 'Kaynak ve hedef masa ID\'leri gerekli' });
      }

      // Sultan Somatı'da tüm personel yetkili; diğer şubelerde sadece müdür
      if (!staffId) {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }
      if (activeBranchKey !== 'sultansomati') {
        const staff = (db.staff || []).find(s => s.id === staffId);
        if (!staff || !staff.is_manager) {
          return res.status(403).json({ 
            success: false, 
            error: 'Masa birleştirme yetkisi yok. Bu işlem için müdür yetkisi gereklidir.' 
          });
        }
      }

      const sourceOrder = db.tableOrders.find(
        o => o.table_id === sourceTableId && o.status === 'pending'
      );
      if (!sourceOrder) {
        return res.status(404).json({ success: false, error: 'Kaynak masada aktif sipariş bulunamadı' });
      }

      const targetOrder = db.tableOrders.find(
        o => o.table_id === targetTableId && o.status === 'pending'
      );
      if (!targetOrder) {
        return res.status(404).json({ success: false, error: 'Hedef masada aktif sipariş bulunamadı. Lütfen dolu bir masa seçin.' });
      }

      if (sourceTableId === targetTableId) {
        return res.status(400).json({ success: false, error: 'Aynı masayı seçemezsiniz' });
      }

      const sourceItems = db.tableOrderItems.filter(oi => oi.order_id === sourceOrder.id);
      if (sourceItems.length === 0) {
        return res.status(400).json({ success: false, error: 'Kaynak masada ürün bulunamadı' });
      }

      const nextItemId = db.tableOrderItems.length > 0 ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 : 1;
      let addedAmount = 0;
      const newItems = [];
      sourceItems.forEach((item, idx) => {
        const newItem = {
          id: nextItemId + idx,
          order_id: targetOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          isGift: item.isGift || false,
          staff_id: item.staff_id || null,
          staff_name: item.staff_name || null,
          paid_quantity: item.paid_quantity || 0,
          is_paid: item.is_paid || false,
          payment_method: item.payment_method || null,
          paid_date: item.paid_date || null,
          paid_time: item.paid_time || null,
          category_id: item.category_id || null
        };
        newItems.push(newItem);
        db.tableOrderItems.push(newItem);
        if (!newItem.isGift) addedAmount += item.price * item.quantity;
      });

      targetOrder.total_amount = (targetOrder.total_amount || 0) + addedAmount;
      sourceOrder.status = 'completed';
      sourceOrder.total_amount = 0;

      saveDatabase();

      if (io) {
        io.emit('table-update', { tableId: sourceTableId, hasOrder: false });
        io.emit('table-update', { tableId: targetTableId, hasOrder: true });
      }
      syncSingleTableToFirebase(sourceTableId).catch(() => {});
      syncSingleTableToFirebase(targetTableId).catch(() => {});

      const targetTableName = getTableNameFromId(targetTableId);
      const targetTableType = getTableTypeFromId(targetTableId);
      const now = new Date();
      const orderDate = now.toLocaleDateString('tr-TR');
      const orderTime = getFormattedTime(now);

      const adisyonDataForPrint = {
        tableName: targetTableName,
        tableType: targetTableType,
        items: newItems.map(item => ({
          id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          isGift: item.isGift,
          staff_name: item.staff_name,
          added_date: orderDate,
          added_time: orderTime
        })),
        orderDate: orderDate,
        orderTime: orderTime
      };
      printAdisyonByCategory(adisyonDataForPrint).catch(err => console.error('Adisyon yazdırma hatası:', err));

      res.json({ 
        success: true, 
        mergedCount: newItems.length
      });
    } catch (error) {
      console.error('Masa birleştirme hatası:', error);
      res.status(500).json({ success: false, error: 'Masa birleştirilirken bir hata oluştu' });
    }
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

      const targetTableName = getTableNameFromId(targetTableId);
      const targetTableType = getTableTypeFromId(targetTableId);

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

      // Masaüstü / patron ekranı (Firebase masalar dinleyicisi) ipc ile aynı veriyi görsün
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

      // ipcMain.transfer-table-order ile aynı: makaramasalar Firebase'de kaynak boş, hedef dolu
      // Mobil istemciye başarı dönmeden önce bitir — admin dashboard anlık dinleyicide eski masa kalmasın
      await syncSingleTableToFirebase(sourceTableId);
      await syncSingleTableToFirebase(targetTableId);

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

      // Sultan: tümü; Havzan: müdür/şef; Suriçi: müdür
      if (!staffId) {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }
      if (activeBranchKey !== 'sultansomati') {
        const staff = (db.staff || []).find(s => s.id === staffId);
        if (!staffHasTableOrderCancelRole(staff)) {
          return res.status(403).json({ 
            success: false, 
            error: 'İptal yetkisi yok. İptal ettirmek için lütfen müdürle görüşünüz.' 
          });
        }
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

      // Yan ürün kontrolü
      const isYanUrun = typeof item.product_id === 'string' && item.product_id.startsWith('yan_urun_');
      let categoryName = 'Yan Ürünler';
      let printerName = null;
      let printerType = null;

      if (isYanUrun) {
        categoryName = 'Yan Ürünler';
        const pr = resolveCancelPrinterNameType(null, true);
        printerName = pr.printerName;
        printerType = pr.printerType;
      } else {
        // Normal ürünler için ürün bilgilerini al (kategori ve yazıcı için)
        const product = db.products.find(p => p.id === item.product_id);
        if (!product) {
          return res.status(404).json({ success: false, error: 'Ürün bilgisi bulunamadı' });
        }

        // Kategori bilgisini al
        const category = db.categories.find(c => c.id === product.category_id);
        categoryName = category ? category.name : 'Diğer';

        const pr = resolveCancelPrinterNameType(product.category_id, false);
        printerName = pr.printerName;
        printerType = pr.printerType;
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
      
      // İptal fişi yazdır (mobil — kategori yazıcısına)
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

      try {
        await printCancelReceipt(printerName, printerType, cancelReceiptData);
      } catch (err) {
        console.error('İptal fişi yazdırma hatası:', err);
      }

      // İptal edilecek tutarı hesapla (ikram değilse)
      const cancelAmount = item.isGift ? 0 : (item.price * quantityToCancel);

      // Stok iadesi (ikram edilen ürünler hariç, sadece stok takibi yapılan ürünler için, yan ürünler hariç)
      if (!item.isGift && !isYanUrun) {
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

      const tableIdForSync = order.table_id;
      removePendingTableOrderIfNoItemsLeft(order);
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
        const cancelStaffIsChef = cancelStaff ? (cancelStaff.is_chef || false) : false;
        
        const cancelRef = firebaseCollection(getSalesFirestore(), 'cancels');
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
          staff_is_chef: cancelStaffIsChef,
          order_staff_name: orderStaffName, // Siparişi oluşturan garson
          source: 'mobile', // 'desktop' veya 'mobile'
          created_at: firebaseServerTimestamp()
        }).then(() => {
          console.log('✅ İptal kaydı Firebase\'e başarıyla kaydedildi');
        }).catch(error => {
          console.error('❌ Firebase\'e iptal kaydı kaydedilemedi:', error);
        });
      }

      syncSingleTableToFirebase(tableIdForSync).catch((err) => {
        console.error('Masa Firebase kaydetme hatası (mobil iptal):', err);
      });

      // Mobil personel arayüzüne gerçek zamanlı güncelleme gönder
      if (io) {
        io.emit('table-update', {
          tableId: tableIdForSync,
          hasOrder: tableHasOpenItems(tableIdForSync)
        });
      }

      const pendingMobil = db.tableOrders.find((o) => o.id === order.id && o.status === 'pending');
      res.json({ 
        success: true, 
        remainingAmount: pendingMobil ? pendingMobil.total_amount : 0
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
    
    // Dışarı masalar için hem yeni hem eski format kontrol et
    let tableIdsToCheck = [tableId];
    if (tableId.startsWith('outside-')) {
      const tableNumber = parseInt(tableId.replace('outside-', ''), 10) || 0;
      const idx = MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS.indexOf(tableNumber);
      if (idx >= 0) {
        tableIdsToCheck.push(`outside-${idx + 1}`);
      } else if (tableNumber >= 1 && tableNumber <= 24 && MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS[tableNumber - 1]) {
        tableIdsToCheck.push(`outside-${MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS[tableNumber - 1]}`);
      }
    }
    
    const orders = (db.tableOrders || []).filter(
      o => tableIdsToCheck.includes(o.table_id) && o.status === 'pending'
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

  /** Sultan mobil — tüm masaların bekleyen siparişleri (toplu liste; personel doğrulaması). */
  appExpress.get('/api/sultan-mobile/pending-orders', (req, res) => {
    try {
      if (activeBranchKey !== 'sultansomati') {
        return res.status(403).json({ success: false, error: 'Bu liste yalnızca Sultan Somatı mobilinde kullanılabilir.' });
      }
      const staffId = req.query.staffId;
      if (!staffId) {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }
      const staff = (db.staff || []).find((s) => String(s.id) === String(staffId));
      if (!staff) {
        return res.status(403).json({ success: false, error: 'Personel bulunamadı.' });
      }
      const pending = (db.tableOrders || []).filter(
        (o) =>
          o.status === 'pending' &&
          typeof o.table_id === 'string' &&
          o.table_id.indexOf('sultan-') === 0
      );
      pending.sort((a, b) => String(a.table_name || '').localeCompare(String(b.table_name || ''), 'tr'));
      const orders = pending.map((order) => {
        const items = (db.tableOrderItems || []).filter((i) => i.order_id === order.id);
        const subtotal = items.reduce(
          (s, i) => s + (i.isGift ? 0 : (Number(i.price) || 0) * (Number(i.quantity) || 0)),
          0
        );
        return {
          orderId: order.id,
          table_id: order.table_id,
          table_name: order.table_name,
          total_amount: order.total_amount,
          computed_subtotal: Math.round(subtotal * 100) / 100,
          order_note: order.order_note || null,
          order_date: order.order_date || null,
          order_time: order.order_time || null,
          items: items.map((i) => ({
            id: i.id,
            product_name: i.product_name,
            quantity: i.quantity,
            price: i.price,
            isGift: i.isGift || false,
            staff_name: i.staff_name || null,
            item_note: i.item_note || null
          }))
        };
      });
      res.json({ success: true, orders });
    } catch (e) {
      console.error('sultan-mobile/pending-orders:', e);
      res.status(500).json({ success: false, error: e.message || 'Liste alınamadı' });
    }
  });

  /** Sultan mobil — müdür: kasa adisyon verisi (masaüstüyle aynı mantık). */
  function buildCashierAdisyonPayloadFromTableOrder(order) {
    const items = (order.items || []).map((item) => ({
      id: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false,
      staff_name: item.staff_name || null,
      category_id: null,
      extraNote: (item.item_note && String(item.item_note).trim()) ? String(item.item_note).trim() : null
    }));
    const subtotal = items.reduce((s, i) => s + (i.isGift ? 0 : i.price * i.quantity), 0);
    const di = order.firstOrderDiscount;
    const discountInfo = di && di.applied ? di : null;
    let discountAmount = 0;
    let finalTotal = subtotal;
    if (discountInfo && discountInfo.applied === true) {
      discountAmount = discountInfo.discountAmount || 0;
      finalTotal = discountInfo.finalTotal != null ? discountInfo.finalTotal : subtotal - discountAmount;
    }
    return {
      items,
      tableName: order.table_name,
      tableType: order.table_type,
      orderNote: order.order_note || null,
      sale_date: order.order_date || new Date().toLocaleDateString('tr-TR'),
      sale_time: order.order_time || getFormattedTime(new Date()),
      cashierOnly: true,
      discountInfo,
      subtotal,
      discountAmount,
      finalTotal
    };
  }

  // Sultan Somatı mobil — müdür: ödeme al (Nakit / Kredi Kartı)
  appExpress.post('/api/sultan-manager/complete-order', async (req, res) => {
    try {
      if (activeBranchKey !== 'sultansomati') {
        return res.status(403).json({ success: false, error: 'Bu işlem yalnızca Sultan Somatı şubesinde kullanılabilir.' });
      }
      const { orderId, paymentMethod, staffId, discountAmountTL } = req.body || {};
      if (!orderId || !staffId) {
        return res.status(400).json({ success: false, error: 'Sipariş ve personel bilgisi gerekli' });
      }
      const staff = (db.staff || []).find((s) => s.id === staffId);
      if (!staff) {
        return res.status(403).json({ success: false, error: 'Personel bulunamadı.' });
      }
      const result = await completeTableOrderCore(orderId, paymentMethod, null, discountAmountTL || null);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (e) {
      console.error('sultan-manager/complete-order:', e);
      res.status(500).json({ success: false, error: e.message || 'İşlem başarısız' });
    }
  });

  // Sultan Somatı mobil — ödemesi alınmış (tamamlanmış) masa siparişleri listesi
  appExpress.get('/api/sultan-manager/completed-table-orders', (req, res) => {
    try {
      if (activeBranchKey !== 'sultansomati') {
        return res.status(403).json({ success: false, error: 'Bu işlem yalnızca Sultan Somatı şubesinde kullanılabilir.' });
      }
      const staffId = req.query.staffId;
      if (!staffId) {
        return res.status(400).json({ success: false, error: 'Personel bilgisi gerekli' });
      }
      const staff = (db.staff || []).find((s) => String(s.id) === String(staffId));
      if (!staff) {
        return res.status(403).json({ success: false, error: 'Personel bulunamadı.' });
      }
      const list = (db.tableOrders || []).filter(
        (o) =>
          o.status === 'completed' &&
          typeof o.table_id === 'string' &&
          o.table_id.indexOf('sultan-') === 0
      );
      list.sort((a, b) => b.id - a.id);
      const orders = list.slice(0, 150).map((order) => {
        let sale = null;
        if (order.completed_sale_id) {
          sale = (db.sales || []).find((s) => s.id === order.completed_sale_id);
        }
        if (!sale) {
          sale = (db.sales || []).find((s) => Number(s.table_order_id) === Number(order.id));
        }
        const canRevert = !!sale;
        const charged = sale ? sale.total_amount : order.total_amount;
        return {
          id: order.id,
          table_id: order.table_id,
          table_name: order.table_name,
          total_amount: order.total_amount,
          charged_amount: charged,
          payment_method: sale ? sale.payment_method : '—',
          sale_date: sale ? sale.sale_date : order.order_date || '',
          sale_time: sale ? sale.sale_time : order.order_time || '',
          canRevert
        };
      });
      res.json({ success: true, orders });
    } catch (e) {
      console.error('sultan-manager/completed-table-orders:', e);
      res.status(500).json({ success: false, error: e.message || 'Liste alınamadı' });
    }
  });

  // Sultan Somatı mobil — tamamlanmış siparişi geri al (masayı tekrar açık sipariş yap)
  appExpress.post('/api/sultan-manager/revert-completed-order', async (req, res) => {
    try {
      if (activeBranchKey !== 'sultansomati') {
        return res.status(403).json({ success: false, error: 'Bu işlem yalnızca Sultan Somatı şubesinde kullanılabilir.' });
      }
      const { orderId, staffId } = req.body || {};
      if (!orderId || !staffId) {
        return res.status(400).json({ success: false, error: 'Sipariş ve personel bilgisi gerekli' });
      }
      const staff = (db.staff || []).find((s) => String(s.id) === String(staffId));
      if (!staff) {
        return res.status(403).json({ success: false, error: 'Personel bulunamadı.' });
      }
      const result = await revertCompletedTableOrderCore(orderId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (e) {
      console.error('sultan-manager/revert-completed-order:', e);
      res.status(500).json({ success: false, error: e.message || 'Geri alınamadı' });
    }
  });

  // Sultan Somatı mobil — müdür: kasa adisyonu yazdır
  appExpress.post('/api/sultan-manager/print-adisyon', async (req, res) => {
    try {
      if (activeBranchKey !== 'sultansomati') {
        return res.status(403).json({ success: false, error: 'Bu işlem yalnızca Sultan Somatı şubesinde kullanılabilir.' });
      }
      const { orderId, staffId, discountAmountTL } = req.body || {};
      if (!orderId || !staffId) {
        return res.status(400).json({ success: false, error: 'Sipariş ve personel bilgisi gerekli' });
      }
      const staff = (db.staff || []).find((s) => s.id === staffId);
      if (!staff) {
        return res.status(403).json({ success: false, error: 'Personel bulunamadı.' });
      }
      const order = db.tableOrders.find((o) => o.id === orderId);
      if (!order || order.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Geçerli açık sipariş bulunamadı' });
      }
      const orderItems = (db.tableOrderItems || []).filter((oi) => oi.order_id === orderId);
      const orderWithItems = { ...order, items: orderItems };
      const adisyonData = buildCashierAdisyonPayloadFromTableOrder(orderWithItems);
      // Mobil personel indirim tutarını adisyon verisine uygula
      if (discountAmountTL != null && parseFloat(discountAmountTL) > 0) {
        const discTL = Math.min(parseFloat(discountAmountTL), adisyonData.subtotal);
        adisyonData.discountAmount = discTL;
        adisyonData.finalTotal = Math.round((adisyonData.subtotal - discTL) * 100) / 100;
        adisyonData.discountInfo = {
          applied: true,
          discountPercent: adisyonData.subtotal > 0 ? Math.round((discTL / adisyonData.subtotal) * 10000) / 100 : 0,
          discountAmount: discTL,
          subtotal: adisyonData.subtotal,
          finalTotal: adisyonData.finalTotal
        };
      }
      const printRes = await printCashierAdisyonFromData(adisyonData);
      if (!printRes.success) {
        return res.status(400).json(printRes);
      }
      res.json({ success: true });
    } catch (e) {
      console.error('sultan-manager/print-adisyon:', e);
      res.status(500).json({ success: false, error: e.message || 'Yazdırılamadı' });
    }
  });

  // Sultan: tüm masayı iptal et
  appExpress.post('/api/sultan-manager/cancel-entire-order', async (req, res) => {
    try {
      const { orderId, cancelReason = '', staffId = null } = req.body || {};
      const order = db.tableOrders.find(o => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Sipariş bulunamadı' });
      if (order.status !== 'pending') return res.status(400).json({ success: false, error: 'Sipariş zaten tamamlanmış veya iptal edilmiş' });

      const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);

      // Firebase'e grup iptal kaydı
      if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp && orderItems.length > 0) {
        try {
          const now = new Date();
          const cancelDate = now.toLocaleDateString('tr-TR');
          const cancelTime = getFormattedTime(now);
          const items_array = orderItems.map(oi => ({
            product_name: oi.product_name,
            quantity: oi.quantity,
            price: oi.price,
            isGift: oi.isGift || false
          }));
          const total_amount = orderItems.reduce((s, oi) => s + (oi.isGift ? 0 : oi.price * oi.quantity), 0);
          const cancelRef = firebaseCollection(getSalesFirestore(), 'cancels');
          await firebaseAddDoc(cancelRef, {
            is_group: true,
            order_id: order.id,
            table_id: order.table_id,
            table_name: order.table_name,
            table_type: order.table_type,
            cancel_reason: cancelReason || '',
            cancel_date: cancelDate,
            cancel_time: cancelTime,
            items_array,
            total_amount,
            source: 'mobile',
            staff_name: staffId ? (db.staff || []).find(s => s.id === staffId)?.name || null : null,
            order_staff_name: order.staff_name || null,
            created_at: firebaseServerTimestamp()
          });
        } catch (err) {
          console.error('cancel-entire-order firebase hatası:', err);
        }
      }

      // Siparişi ve item'ları sil
      const orderIndex = db.tableOrders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) db.tableOrders.splice(orderIndex, 1);
      orderItems.forEach(item => {
        const idx = db.tableOrderItems.findIndex(oi => oi.id === item.id);
        if (idx !== -1) db.tableOrderItems.splice(idx, 1);
      });
      saveDatabase();

      syncSingleTableToFirebase(order.table_id).catch(err => {
        console.error('Masa Firebase kaydetme hatası:', err);
      });

      res.json({ success: true });
    } catch (e) {
      console.error('sultan-manager/cancel-entire-order:', e);
      res.status(500).json({ success: false, error: e.message || 'İptal başarısız' });
    }
  });

  // ──── Rezervasyon API ────
  // Rezervasyon oluştur
  appExpress.post('/api/reservations', (req, res) => {
    try {
      const { tableId, tableName, date, time, peopleCount, adults, children, babies, note, staffId, staffName, guestName, reservationId } = req.body || {};
      if (!tableId || !date || !time) return res.status(400).json({ success: false, error: 'Zorunlu alanlar eksik (tableId, date, time)' });
      // Düzenleme mi yoksa yeni oluşturma mı?
      const existingIdx = reservationId ? db.reservations.findIndex(r => r.id === reservationId) : -1;
      const id = (existingIdx >= 0) ? reservationId : ('res-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      const reservation = { id, tableId, tableName: tableName || '', date, time,
        peopleCount: Number(peopleCount) || 0, adults: Number(adults) || 0,
        children: Number(children) || 0, babies: Number(babies) || 0,
        note: note || '', guestName: guestName || '',
        staffId: staffId || null, staffName: staffName || null,
        createdAt: (existingIdx >= 0 ? db.reservations[existingIdx].createdAt : new Date().toISOString()) };
      // Mevcut masa rezervasyonu + aynı id varsa sil
      db.reservations = db.reservations.filter(r => r.tableId !== tableId && r.id !== id);
      db.reservations.push(reservation);
      saveDatabase();
      res.json({ success: true, reservation });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  // Rezervasyonları getir (tableId filtresi opsiyonel)
  appExpress.get('/api/reservations', (req, res) => {
    try {
      const { tableId } = req.query;
      const list = tableId
        ? db.reservations.filter(r => r.tableId === tableId)
        : db.reservations;
      res.json(list);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  // Rezervasyon sil
  appExpress.delete('/api/reservations/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = db.reservations.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Rezervasyon bulunamadı' });
      db.reservations.splice(idx, 1);
      saveDatabase();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  // Rezervasyon yazdır (PDF/HTML tabanlı — termal 58mm)
  appExpress.post('/api/reservations/print', async (req, res) => {
    try {
      const { reservationId } = req.body || {};
      const reservation = db.reservations.find(r => r.id === reservationId);
      if (!reservation) return res.status(404).json({ success: false, error: 'Rezervasyon bulunamadı' });
      const cashierPrinter = db.settings.cashierPrinter;
      if (!cashierPrinter || !cashierPrinter.printerName) {
        return res.status(400).json({ success: false, error: 'Kasa yazıcısı ayarlanmamış' });
      }
      const html = generateReservationReceiptHTML(reservation);
      const result = await printToPrinter(cashierPrinter.printerName, cashierPrinter.printerType || 'usb', null, false, null, html);
      if (result && result.success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: (result && result.error) || 'Yazdırılamadı' });
      }
    } catch (e) {
      console.error('rezervasyon print hatası:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Mobil personel arayüzü için static dosyalar
  appExpress.get('/mobile-manifest.json', (req, res) => {
    // Manifest'i dinamik olarak oluştur - icon path'leri tam URL olmalı
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseURL = `${protocol}://${host}`;
    const sultanManifest = activeBranchKey === 'sultansomati';
    const makaraHavzanManifest = activeBranchKey === 'makara';

    const manifest = {
      "name": sultanManifest ? "Sultan Somatı Mobil Sipariş" : "MAKARA Mobil Sipariş",
      "short_name": sultanManifest ? "Sultan Somatı" : "MAKARA Mobil",
      "description": sultanManifest
        ? "Sultan Somatı Satış Sistemi - Mobil Personel Arayüzü"
        : "MAKARA Satış Sistemi - Mobil Personel Arayüzü",
      "id": "/mobile",
      "start_url": `${baseURL}/mobile`,
      "scope": `${baseURL}/mobile`,
      "display": "standalone",
      "display_override": ["standalone", "fullscreen"],
      "background_color": sultanManifest ? "#064e3b" : makaraHavzanManifest ? "#ffffff" : "#ec4899",
      "theme_color": sultanManifest ? "#064e3b" : makaraHavzanManifest ? "#ffffff" : "#ec4899",
      "orientation": "portrait",
      "prefer_related_applications": false,
      "icons": sultanManifest
        ? [
            {
              src: `${baseURL}/sultan-mobile-icon.svg`,
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: `${baseURL}/sultan-mobile-icon.svg`,
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        : [
            {
              src: `${baseURL}/mobilpersonel.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${baseURL}/mobilpersonel.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
    };
    
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
  });
  
  // Sultan Somatı mobil: markasız düz renk ikon (PWA / sekme; Makara logosu yok)
  appExpress.get('/sultan-mobile-icon.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#059669"/></svg>'
    );
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

  // PWA Service Worker - offline destek ve kurulum için
  appExpress.get('/mobile-sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/mobile');
    const swCode = `
const CACHE_NAME = 'makara-mobile-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Socket.io, API ve stream isteklerini pass-through yap
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/firebase') ||
    event.request.method !== 'GET'
  ) {
    return;
  }
  // Navigasyon: network-first, offline'da cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  // Diğer GET: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
`;
    res.send(swCode);
  });

  appExpress.get('/mobile', (req, res) => {
    res.send(generateMobileHTML(serverURL, activeBranchKey));
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

  // Mobil/masaüstü: sepetteyken fiş hazırla (tarih/saat/masa/ürünler — gönder/kaydet anında yazdırmak için)
  appExpress.post('/api/prepare-adisyon', (req, res) => {
    try {
      const { items, tableName, tableType, orderNote, staffName } = req.body;
      const now = new Date();
      const sale_date = now.toLocaleDateString('tr-TR');
      const sale_time = getFormattedTime(now);
      const itemsWithMeta = (items || []).map(item => ({
        ...item,
        staff_name: staffName || null,
        added_date: sale_date,
        added_time: sale_time
      }));
      const adisyonData = {
        items: itemsWithMeta,
        tableName: tableName || '',
        tableType: tableType || '',
        orderNote: orderNote || null,
        sale_date,
        sale_time,
        staff_name: staffName || null
      };
      const receipts = prepareAdisyonReceipts(itemsWithMeta, adisyonData);
      const htmlReceipts = prepareAdisyonHtmlReceipts(itemsWithMeta, adisyonData);
      // BrowserWindow'ları şimdiden aç + HTML yükle — Siparişi Gönder'e basılınca sadece .print() kalır
      const printJobId = Object.keys(htmlReceipts).length > 0
        ? preloadPrintWindows(htmlReceipts)
        : null;
      console.log(`[prepare-adisyon] htmlReceipts yazıcılar: [${Object.keys(htmlReceipts).join(', ')}], printJobId: ${printJobId}`);
      res.json({ success: true, receipts, htmlReceipts, printJobId });
    } catch (err) {
      console.error('prepare-adisyon hatası:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  appExpress.post('/api/orders', async (req, res) => {
    try {
      const { items, totalAmount, tableId, tableName, tableType, orderNote, staffId, preparedReceipts, preparedHtmlReceipts, printJobId } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Ürün listesi gerekli' });
      }
      
      // 1. YOL: Önceden yüklenmiş pencere var → sadece .print() (en hızlı, sıfır gecikme)
      if (printJobId && preloadedPrintJobs.has(printJobId)) {
        console.log(`[/api/orders] ✅ Hazır pencere bulundu (printJobId=${printJobId}), anında yazdırılıyor`);
        printPreloadedJob(printJobId).catch(err => {
          console.error('Önceden yüklenmiş fiş yazdırma hatası:', err);
        });
      // 2. YOL: Hazır HTML var → pencereyi yeni aç, HTML yükle, yazdır
      } else if (preparedHtmlReceipts && typeof preparedHtmlReceipts === 'object' && Object.keys(preparedHtmlReceipts).length > 0) {
        console.log(`[/api/orders] ⚡ Hazır HTML ile yazdırılıyor`);
        printPreparedHtmlReceipts(preparedHtmlReceipts).catch(err => {
          console.error('Mobil hazır fiş yazdırma hatası:', err);
        });
      // 3. YOL: Hiçbir hazır fiş yok → HTML üret + yazdır (yedek akış)
      } else {
        console.warn(`[/api/orders] ⚠️ printJobId=${printJobId} bulunamadı, yedek akış: printAdisyonByCategory. preloadedPrintJobs boyutu: ${preloadedPrintJobs.size}`);
        const staff = staffId && db.staff ? db.staff.find(s => s.id === staffId) : null;
        const staffName = staff ? `${staff.name} ${staff.surname}` : null;
        const now = new Date();
        const adisyonDate = now.toLocaleDateString('tr-TR');
        const adisyonTime = getFormattedTime(now);
        const itemsWithStaffForPrint = items.map(item => ({
          ...item,
          staff_name: staffName || null,
          added_date: adisyonDate,
          added_time: adisyonTime
        }));
        const adisyonDataForPrint = {
          items: itemsWithStaffForPrint,
          tableName: tableName || '',
          tableType: tableType || '',
          orderNote: orderNote || null,
          sale_date: adisyonDate,
          sale_time: adisyonTime,
          staff_name: staffName || null
        };
        printAdisyonByCategory(itemsWithStaffForPrint, adisyonDataForPrint).catch(err => {
          console.error('Mobil sipariş adisyon yazdırma hatası:', err);
        });
      }
      
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
            added_time: addedTime,
            item_note: (newItem.extraNote && String(newItem.extraNote).trim()) ? String(newItem.extraNote).trim() : null
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
            added_time: orderTime,
            item_note: (item.extraNote && String(item.extraNote).trim()) ? String(item.extraNote).trim() : null
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

  // Integration Webhook Endpoints
  appExpress.post('/api/webhook/trendyol', async (req, res) => {
    try {
      console.log('\n📦 Trendyol Webhook Alındı:', JSON.stringify(req.body, null, 2));
      
      // Entegrasyon ayarlarını kontrol et
      if (!db.settings || !db.settings.integrations || !db.settings.integrations.trendyol.enabled) {
        return res.status(400).json({ success: false, error: 'Trendyol entegrasyonu aktif değil' });
      }
      
      const orderData = req.body;
      
      // Trendyol sipariş formatını online sipariş formatına çevir
      const items = (orderData.lines || []).map(line => ({
        id: line.productId || `trendyol-${line.barcode}`,
        name: line.productName || 'Bilinmeyen Ürün',
        quantity: line.quantity || 1,
        price: line.price || 0,
        isGift: false
      }));
      
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Firebase'e online sipariş olarak ekle
      if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
        try {
          const ordersRef = firebaseCollection(firestore, 'orders');
          await firebaseAddDoc(ordersRef, {
            orderId: orderData.orderNumber || `trendyol-${Date.now()}`,
            customer_name: orderData.shipmentAddress?.fullName || 'Trendyol Müşteri',
            customer_phone: orderData.shipmentAddress?.phoneNumber || null,
            customer_address: orderData.shipmentAddress ? 
              `${orderData.shipmentAddress.address1 || ''} ${orderData.shipmentAddress.address2 || ''} ${orderData.shipmentAddress.district || ''} ${orderData.shipmentAddress.city || ''}`.trim() : null,
            items: items,
            total_amount: totalAmount,
            paymentMethod: 'card', // Trendyol siparişleri genelde kart ile ödenir
            status: 'pending',
            source: 'trendyol',
            orderNote: orderData.customerNote || null,
            createdAt: firebaseServerTimestamp()
          });
          
          console.log('✅ Trendyol siparişi Firebase\'e eklendi:', orderData.orderNumber);
        } catch (firebaseError) {
          console.error('❌ Firebase\'e kaydetme hatası:', firebaseError);
        }
      }
      
      res.json({ success: true, message: 'Sipariş alındı' });
    } catch (error) {
      console.error('❌ Trendyol webhook hatası:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  appExpress.post('/api/webhook/yemeksepeti', async (req, res) => {
    try {
      console.log('\n🍕 Yemeksepeti Webhook Alındı:', JSON.stringify(req.body, null, 2));
      
      // Entegrasyon ayarlarını kontrol et
      if (!db.settings || !db.settings.integrations || !db.settings.integrations.yemeksepeti.enabled) {
        return res.status(400).json({ success: false, error: 'Yemeksepeti entegrasyonu aktif değil' });
      }
      
      const orderData = req.body;
      
      // Yemeksepeti sipariş formatını online sipariş formatına çevir
      const items = (orderData.items || []).map(item => ({
        id: item.productId || `yemeksepeti-${item.id}`,
        name: item.name || 'Bilinmeyen Ürün',
        quantity: item.quantity || 1,
        price: item.price || 0,
        isGift: false
      }));
      
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Firebase'e online sipariş olarak ekle
      if (firestore && firebaseCollection && firebaseAddDoc && firebaseServerTimestamp) {
        try {
          const ordersRef = firebaseCollection(firestore, 'orders');
          await firebaseAddDoc(ordersRef, {
            orderId: orderData.orderId || `yemeksepeti-${Date.now()}`,
            customer_name: orderData.customer?.name || 'Yemeksepeti Müşteri',
            customer_phone: orderData.customer?.phone || null,
            customer_address: orderData.deliveryAddress?.fullAddress || null,
            items: items,
            total_amount: totalAmount,
            paymentMethod: orderData.paymentMethod === 'cash' ? 'cash' : 'card',
            status: 'pending',
            source: 'yemeksepeti',
            orderNote: orderData.note || null,
            createdAt: firebaseServerTimestamp()
          });
          
          console.log('✅ Yemeksepeti siparişi Firebase\'e eklendi:', orderData.orderId);
        } catch (firebaseError) {
          console.error('❌ Firebase\'e kaydetme hatası:', firebaseError);
        }
      }
      
      res.json({ success: true, message: 'Sipariş alındı' });
    } catch (error) {
      console.error('❌ Yemeksepeti webhook hatası:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  server.listen(serverPort, () => {
    console.log(`\n🚀 API Server başlatıldı: ${serverURL}`);
    console.log(`📱 Mobil cihazlardan erişim için: ${serverURL}/mobile\n`);
    console.log(`🔗 Trendyol Webhook: ${serverURL}/api/webhook/trendyol`);
    console.log(`🔗 Yemeksepeti Webhook: ${serverURL}/api/webhook/yemeksepeti\n`);
  });

  apiServer = server;
  return { serverURL, localIP };
}

ipcMain.handle('quit-app', () => {
  flushSaveDatabaseSync();
  if (apiServer) {
    apiServer.close();
  }
  setTimeout(() => {
    app.quit();
  }, 500);
  return { success: true };
});

// Integration Settings IPC Handlers
ipcMain.handle('get-integration-settings', async () => {
  try {
    if (!db.settings) {
      db.settings = {};
    }
    if (!db.settings.integrations) {
      db.settings.integrations = {
        trendyol: {
          enabled: false,
          apiKey: '',
          apiSecret: '',
          supplierId: '',
          webhookUrl: ''
        },
        yemeksepeti: {
          enabled: false,
          apiKey: '',
          apiSecret: '',
          restaurantId: '',
          webhookUrl: ''
        }
      };
      saveDatabase();
    }
    
    // Webhook URL'lerini güncelle (server URL'si değişmiş olabilir)
    const localIP = getLocalIP();
    const serverURL = `http://${localIP}:${serverPort}`;
    
    if (db.settings.integrations.trendyol.enabled && !db.settings.integrations.trendyol.webhookUrl) {
      db.settings.integrations.trendyol.webhookUrl = `${serverURL}/api/webhook/trendyol`;
    }
    if (db.settings.integrations.yemeksepeti.enabled && !db.settings.integrations.yemeksepeti.webhookUrl) {
      db.settings.integrations.yemeksepeti.webhookUrl = `${serverURL}/api/webhook/yemeksepeti`;
    }
    
    return db.settings.integrations;
  } catch (error) {
    console.error('Entegrasyon ayarları yüklenirken hata:', error);
    return null;
  }
});

ipcMain.handle('save-integration-settings', async (event, settings) => {
  try {
    if (!db.settings) {
      db.settings = {};
    }
    db.settings.integrations = settings;
    
    // Webhook URL'lerini güncelle
    const localIP = getLocalIP();
    const serverURL = `http://${localIP}:${serverPort}`;
    
    if (settings.trendyol.enabled) {
      settings.trendyol.webhookUrl = `${serverURL}/api/webhook/trendyol`;
    }
    if (settings.yemeksepeti.enabled) {
      settings.yemeksepeti.webhookUrl = `${serverURL}/api/webhook/yemeksepeti`;
    }
    
    db.settings.integrations = settings;
    saveDatabase();
    
    return { success: true };
  } catch (error) {
    console.error('Entegrasyon ayarları kaydedilirken hata:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-integration-connection', async (event, platform, settings) => {
  try {
    // API bağlantı testi
    if (platform === 'trendyol') {
      // Trendyol API test endpoint'i (örnek)
      // Gerçek API endpoint'ini Trendyol dokümantasyonundan alın
      const testUrl = 'https://api.trendyol.com/sapigw/suppliers/' + settings.supplierId + '/orders';
      // Burada gerçek API çağrısı yapılacak
      // Şimdilik basit bir test
      if (settings.apiKey && settings.apiSecret && settings.supplierId) {
        return { success: true, message: 'Bağlantı başarılı' };
      } else {
        return { success: false, error: 'API bilgileri eksik' };
      }
    } else if (platform === 'yemeksepeti') {
      // Yemeksepeti API test endpoint'i (örnek)
      // Gerçek API endpoint'ini Yemeksepeti dokümantasyonundan alın
      if (settings.apiKey && settings.apiSecret && settings.restaurantId) {
        return { success: true, message: 'Bağlantı başarılı' };
      } else {
        return { success: false, error: 'API bilgileri eksik' };
      }
    }
    
    return { success: false, error: 'Geçersiz platform' };
  } catch (error) {
    console.error('Bağlantı testi hatası:', error);
    return { success: false, error: error.message };
  }
});


// Minimize window handler
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return { success: true };
});

// Ağdaki cihazları tara: hangi IP'de Makara mobil personel / kamera / yazıcı vb. var
function getLocalSubnetPrefix() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) return parts.slice(0, 3).join('.');
      }
    }
  }
  return null;
}

function probeIp(ip, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const url = `http://${ip}:${port}/mobile`;
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.setTimeout(timeoutMs);
  });
}

function probePort(ip, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: ip,
      port,
      path: '/',
      method: 'GET',
      timeout: timeoutMs
    }, (res) => resolve({ open: true }));
    req.on('error', () => resolve({ open: false }));
    req.on('timeout', () => { req.destroy(); resolve({ open: false }); });
    req.setTimeout(timeoutMs);
    req.end();
  });
}

ipcMain.handle('scan-network', async () => {
  const prefix = getLocalSubnetPrefix();
  if (!prefix) return { success: false, error: 'Yerel ağ bulunamadı', devices: [] };
  const devices = [];
  const port = serverPort || 3000;
  const ips = [];
  for (let i = 1; i <= 254; i++) ips.push(`${prefix}.${i}`);
  const chunk = (arr, n) => { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };
  for (const batch of chunk(ips, 15)) {
    const results = await Promise.all(batch.map(async (ip) => {
      const r = await probeIp(ip, port);
      if (!r.ok) {
        const p80 = await probePort(ip, 80);
        const p554 = await probePort(ip, 554);
        const p9100 = await probePort(ip, 9100);
        if (p80.open) return { ip, label: 'Web arayüzü (kamera/yönlendirici vb.)', isOurBackend: false };
        if (p554.open) return { ip, label: 'Kamera (RTSP)', isOurBackend: false };
        if (p9100.open) return { ip, label: 'Yazıcı olabilir', isOurBackend: false };
        return null;
      }
      const isOurs = (r.body || '').includes('MAKARA') || (r.body || '').includes('Mobil Sipariş');
      return { ip, label: isOurs ? 'Makara Mobil Personel' : 'Diğer sunucu (port ' + port + ')', isOurBackend: isOurs };
    }));
    results.forEach((r) => { if (r) devices.push(r); });
  }
  return { success: true, devices };
});

ipcMain.handle('get-computer-hostname', () => {
  return os.hostname();
});

ipcMain.handle('get-mobile-preferred-host', () => {
  const host = db.settings && db.settings.mobilePreferredHost;
  return host != null ? host : null;
});

ipcMain.handle('set-mobile-preferred-host', (event, host) => {
  if (!db.settings) db.settings = {};
  db.settings.mobilePreferredHost = host || null;
  saveDatabase();
  return { success: true };
});

// Mobil API IPC Handlers
ipcMain.handle('get-server-url', () => {
  if (!apiServer) {
    return { success: false, error: 'Server başlatılmadı' };
  }
  const preferred = db.settings && db.settings.mobilePreferredHost;
  if (preferred) {
    const host = isIpAddress(preferred) ? preferred : `${preferred}.local`;
    const serverURL = `http://${host}:${serverPort}`;
    return { success: true, url: serverURL, ip: preferred, port: serverPort };
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

function isIpAddress(host) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

ipcMain.handle('generate-qr-code', async () => {
  try {
    const preferred = db.settings && db.settings.mobilePreferredHost;
    let serverURL;
    if (preferred) {
      const host = isIpAddress(preferred) ? preferred : `${preferred}.local`;
      serverURL = `http://${host}:${serverPort}/mobile`;
    } else {
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
      serverURL = `http://${localIP}:${serverPort}/mobile`;
    }
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

function isManagerOperationsPasswordConfigured() {
  const p = db.settings && db.settings.managerOperationsPassword;
  return typeof p === 'string' && p.length > 0;
}

function verifyManagerOperationsPassword(input) {
  if (!isManagerOperationsPasswordConfigured()) return true;
  const a = (db.settings.managerOperationsPassword || '').toString();
  const b = (input === undefined || input === null) ? '' : String(input);
  return a === b;
}

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
    is_manager: false, // Varsayılan olarak müdür değil
    is_chef: false
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
    is_manager: s.is_manager || false,
    is_chef: s.is_chef || false
  }));
});

// Müdür atama/kaldırma (managerAuthPassword: managerOperationsPassword tanımlıysa zorunlu)
ipcMain.handle('set-staff-manager', (event, staffId, isManager, managerAuthPassword) => {
  if (!db.staff) db.staff = [];
  if (isManagerOperationsPasswordConfigured() && !verifyManagerOperationsPassword(managerAuthPassword)) {
    return { success: false, error: 'Masaüstü müdür işlem şifresi hatalı veya girilmedi' };
  }
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
    staff.is_chef = false;
  }
  
  staff.is_manager = isManager;
  saveDatabase();
  return { success: true, staff: staff };
});

/** Makara Havzan: garson ile aynı işlemler + mevcut sipariş satırı iptali (masaüstü müdür şifresi ile) */
ipcMain.handle('set-staff-chef', (event, staffId, isChef, managerAuthPassword) => {
  if (activeBranchKey !== 'makara') {
    return { success: false, error: 'Şef ataması yalnızca Makara Havzan şubesinde kullanılır' };
  }
  if (!db.staff) db.staff = [];
  if (isManagerOperationsPasswordConfigured() && !verifyManagerOperationsPassword(managerAuthPassword)) {
    return { success: false, error: 'Masaüstü müdür işlem şifresi hatalı veya girilmedi' };
  }
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return { success: false, error: 'Personel bulunamadı' };
  }
  if (isChef) {
    staff.is_chef = true;
    staff.is_manager = false;
  } else {
    staff.is_chef = false;
  }
  saveDatabase();
  return { success: true, staff };
});

ipcMain.handle('get-manager-ops-password-configured', () => ({
  configured: isManagerOperationsPasswordConfigured()
}));

ipcMain.handle('verify-staff-pin', (event, password) => {
  if (!db.staff) db.staff = [];
  const staff = db.staff.find(s => s.password === password.toString());
  if (staff) {
    return {
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        surname: staff.surname,
        is_manager: staff.is_manager || false,
        is_chef: staff.is_chef || false
      }
    };
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

    // Masa bilgilerini bul (sipariş var ama satır yoksa boş masa — eski tutarlılık)
    const order = tableOrders.find(o => o.table_id === tableId && o.status === 'pending');
    const orderItemsForTable = order
      ? tableOrderItems.filter((oi) => oi.order_id === order.id)
      : [];
    if (order && orderItemsForTable.length === 0) {
      removePendingTableOrderIfNoItemsLeft(order);
      saveDatabase();
    }
    const effectiveOrder = order && orderItemsForTable.length > 0 ? order : null;

    if (!effectiveOrder) {
      console.log(`⚠️ Masa için aktif sipariş/ürün yok: ${tableId} - Boş masa olarak kaydedilecek`);
    } else {
      console.log(`✅ Aktif sipariş bulundu: Order ID: ${effectiveOrder.id}, Tutar: ${effectiveOrder.total_amount}`);
    }
    
    // Masa numarasını çıkar
    let tableNumber = 0;
    let tableName = '';
    let tableType = 'inside';
    
    if (tableId.startsWith('inside-')) {
      tableNumber = parseInt(tableId.replace('inside-', ''), 10) || 0;
      tableName = `Masa ${tableNumber}`;
      tableType = 'inside';
    } else if (tableId.startsWith('outside-')) {
      const num = parseInt(tableId.replace('outside-', ''), 10) || 0;
      tableNumber = MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS.includes(num) ? num : (MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS[num - 1] || num);
      tableName = `Masa ${tableNumber}`;
      tableType = 'outside';
    } else if (tableId.startsWith('package-inside-')) {
      tableNumber = parseInt(tableId.replace('package-inside-', '')) || 0;
      tableName = `Paket ${tableNumber}`;
      tableType = 'inside';
    } else if (tableId.startsWith('package-outside-')) {
      tableNumber = parseInt(tableId.replace('package-outside-', '')) || 0;
      tableName = `Paket ${tableNumber}`;
      tableType = 'outside';
    } else {
      const st = parseSultanTableIdForMain(tableId);
      if (st) {
        tableNumber = st.number;
        tableName = st.name;
        tableType = st.type;
      }
    }

    const isOccupied = !!effectiveOrder;
    let totalAmount = 0;
    let items = [];
    let orderId = null;
    let orderDate = null;
    let orderTime = null;
    let orderNote = null;

    if (effectiveOrder) {
      orderId = effectiveOrder.id;
      totalAmount = parseFloat(effectiveOrder.total_amount) || 0;
      orderDate = effectiveOrder.order_date || null;
      orderTime = effectiveOrder.order_time || null;
      orderNote = effectiveOrder.order_note || null;
      tableName = effectiveOrder.table_name || tableName;
      tableType = effectiveOrder.table_type || tableType;

      items = orderItemsForTable.map(item => ({
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

// Uygulama başlangıcında tüm dolu masaları Firebase'e senkronize et (admin dashboard doğru veri görsün)
async function syncAllOccupiedTablesToFirebase() {
  if (!tablesFirestore || !tablesFirebaseDoc || !tablesFirebaseSetDoc) {
    console.warn('⚠️ Masalar Firebase başlatılamadı, toplu senkronizasyon atlanıyor');
    return;
  }

  const pendingOrders = (db.tableOrders || []).filter(o => o.status === 'pending');
  const uniqueTableIds = [...new Set(pendingOrders.map(o => o.table_id))];

  if (uniqueTableIds.length === 0) {
    console.log('📋 Açık masa yok, Firebase senkronizasyonu atlanıyor');
    return;
  }

  console.log(`🔄 ${uniqueTableIds.length} dolu masa Firebase'e senkronize ediliyor...`);
  for (const tableId of uniqueTableIds) {
    await syncSingleTableToFirebase(tableId);
  }
  console.log('✅ Tüm dolu masalar Firebase\'e senkronize edildi');
}

