const { app, BrowserWindow, ipcMain, Menu, dialog, webContents } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mainWindow;
let dbPath;
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
  return { success: true, category: newCategory };
});

// Kategori silme handler'ı
ipcMain.handle('delete-category', (event, categoryId) => {
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

ipcMain.handle('create-sale', (event, saleData) => {
  const { items, totalAmount, paymentMethod, orderNote } = saleData;
  
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = now.toLocaleTimeString('tr-TR');

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
    sale_time: saleTime
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
  return { success: true, saleId };
});

ipcMain.handle('get-sales', () => {
  // Satışları ve itemları birleştir
  const salesWithItems = db.sales.map(sale => {
    const items = db.saleItems
      .filter(si => si.sale_id === sale.id)
      .map(si => {
        const giftText = si.isGift ? ' (İKRAM)' : '';
        return `${si.product_name} x${si.quantity}${giftText}`;
      })
      .join(', ');
    
    return {
      ...sale,
      items: items || 'Ürün bulunamadı'
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

// Table Order IPC Handlers
ipcMain.handle('create-table-order', (event, orderData) => {
  const { items, totalAmount, tableId, tableName, tableType, orderNote } = orderData;
  
  const now = new Date();
  const orderDate = now.toLocaleDateString('tr-TR');
  const orderTime = now.toLocaleTimeString('tr-TR');

  // Yeni sipariş ID'si
  const orderId = db.tableOrders.length > 0 
    ? Math.max(...db.tableOrders.map(o => o.id)) + 1 
    : 1;

  // Sipariş ekle
  db.tableOrders.push({
    id: orderId,
    table_id: tableId,
    table_name: tableName,
    table_type: tableType,
    total_amount: totalAmount,
    order_date: orderDate,
    order_time: orderTime,
    status: 'pending', // 'pending', 'completed', 'cancelled'
    order_note: orderNote || null
  });

  // Sipariş itemlarını ekle
  items.forEach(item => {
    const itemId = db.tableOrderItems.length > 0 
      ? Math.max(...db.tableOrderItems.map(oi => oi.id)) + 1 
      : 1;
      
    db.tableOrderItems.push({
      id: itemId,
      order_id: orderId,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false
    });
  });

  saveDatabase();
  return { success: true, orderId };
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

ipcMain.handle('complete-table-order', (event, orderId) => {
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
  const saleTime = now.toLocaleTimeString('tr-TR');

  // Yeni satış ID'si
  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: order.total_amount,
    payment_method: 'Nakit',
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: order.table_name,
    table_type: order.table_type
  });

  // Satış itemlarını ekle
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === orderId);
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
      isGift: item.isGift || false
    });
  });

  saveDatabase();
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
  const saleTime = now.toLocaleTimeString('tr-TR');

  // Yeni satış ID'si
  const saleId = db.sales.length > 0 
    ? Math.max(...db.sales.map(s => s.id)) + 1 
    : 1;

  // Satış ekle
  db.sales.push({
    id: saleId,
    total_amount: saleData.totalAmount,
    payment_method: saleData.paymentMethod,
    sale_date: saleDate,
    sale_time: saleTime,
    table_name: saleData.tableName,
    table_type: saleData.tableType
  });

  // Satış itemlarını ekle (kısmi ödeme için tüm ürünleri göster, sadece ödeme yöntemi farklı)
  const orderItems = db.tableOrderItems.filter(oi => oi.order_id === saleData.orderId);
  
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
      isGift: item.isGift || false
    });
  });

  saveDatabase();
  return { success: true, saleId };
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
  return { success: true, product: newProduct };
});

ipcMain.handle('update-product', (event, productData) => {
  const { id, name, category_id, price, image } = productData;
  
  const productIndex = db.products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  db.products[productIndex] = {
    ...db.products[productIndex],
    name,
    category_id,
    price: parseFloat(price),
    image: image || null
  };
  
  saveDatabase();
  return { success: true, product: db.products[productIndex] };
});

ipcMain.handle('delete-product', (event, productId) => {
  const productIndex = db.products.findIndex(p => p.id === productId);
  if (productIndex === -1) {
    return { success: false, error: 'Ürün bulunamadı' };
  }
  
  // Check if product is used in any sale
  const isUsedInSale = db.saleItems.some(si => si.product_id === productId);
  if (isUsedInSale) {
    return { success: false, error: 'Bu ürün satış geçmişinde kullanıldığı için silinemez' };
  }
  
  db.products.splice(productIndex, 1);
  saveDatabase();
  return { success: true };
});

// File selection handler
ipcMain.handle('select-image-file', async (event) => {
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

    // Dosyayı public klasörüne kopyala
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const destPath = path.join(publicDir, fileName);
    
    // Eğer aynı isimde dosya varsa, benzersiz isim oluştur
    let finalDestPath = destPath;
    let counter = 1;
    while (fs.existsSync(finalDestPath)) {
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      finalDestPath = path.join(publicDir, `${nameWithoutExt}_${counter}${ext}`);
      counter++;
    }

    fs.copyFileSync(filePath, finalDestPath);
    
    // Public klasöründeki dosya için relative path döndür
    const relativePath = `/${path.basename(finalDestPath)}`;
    
    return { success: true, path: relativePath };
  } catch (error) {
    console.error('Dosya seçme hatası:', error);
    return { success: false, error: error.message };
  }
});

// Auto Updater Configuration
autoUpdater.autoDownload = false;
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
  const msg = `Yeni güncelleme mevcut: ${info.version}`;
  writeLog(msg);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
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
  console.log('Güncelleme indirildi:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
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
    
    const printJobs = []; // { printerName, printerType, categoryId, items, receiptData, isCashierReceipt, isProductionReceipt }
    
    categoryItemsMap.forEach((categoryItems, categoryId) => {
      console.log(`\n   Kategori ID ${categoryId} için yazıcı aranıyor...`);
      
      // Bu kategori için atanmış yazıcıyı bul
      // categoryId'yi number'a çevir (karşılaştırma için)
      const categoryIdNum = typeof categoryId === 'string' && categoryId !== 'no-category' ? parseInt(categoryId) : categoryId;
      
      const assignment = db.printerAssignments.find(a => {
        const assignmentCategoryId = typeof a.category_id === 'string' ? parseInt(a.category_id) : a.category_id;
        return assignmentCategoryId === categoryIdNum;
      });
      
      // Bu kategori için toplam tutarı hesapla (sadece bu kategorinin ürünleri, ikram edilenler hariç)
      const categoryTotalAmount = categoryItems.reduce((sum, item) => {
        // İkram edilen ürünleri toplamdan çıkar
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      if (assignment) {
        console.log(`   ✓ Yazıcı ataması bulundu:`);
        console.log(`     - Yazıcı: "${assignment.printerName}"`);
        console.log(`     - Tip: ${assignment.printerType}`);
        console.log(`     - Kategori ID: ${assignment.category_id}`);
        console.log(`     - Kategori Toplamı: ₺${categoryTotalAmount.toFixed(2)}`);
        
        // Bu kategori için yazdırma işi oluştur - sadece bu kategorinin ürünleri ve toplamı
        const categoryReceiptData = {
          ...receiptData,
          items: categoryItems, // Sadece bu kategorinin ürünleri
          totalAmount: categoryTotalAmount // Sadece bu kategorinin toplamı
        };
        
        printJobs.push({
          printerName: assignment.printerName,
          printerType: assignment.printerType,
          categoryId: categoryId,
          items: categoryItems,
          receiptData: categoryReceiptData,
          isCashierReceipt: false,
          isProductionReceipt: true
        });
      } else {
        console.warn(`   ⚠️ Kategori ID ${categoryId} için yazıcı ataması bulunamadı`);
        console.log(`   → Varsayılan yazıcı kullanılacak`);
        console.log(`     - Kategori Toplamı: ₺${categoryTotalAmount.toFixed(2)}`);
        
        // Varsayılan yazıcıya yazdır - sadece bu kategorinin ürünleri ve toplamı
        const categoryReceiptData = {
          ...receiptData,
          items: categoryItems, // Sadece bu kategorinin ürünleri
          totalAmount: categoryTotalAmount // Sadece bu kategorinin toplamı
        };
        
        printJobs.push({
          printerName: null, // null = varsayılan yazıcı
          printerType: 'default',
          categoryId: categoryId,
          items: categoryItems,
          receiptData: categoryReceiptData,
          isCashierReceipt: false,
          isProductionReceipt: true
        });
      }
    });
    
    // Kasa yazıcısına tam fiş ekle (eğer ayarlanmışsa)
    if (cashierPrinter && cashierPrinter.printerName) {
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
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_time || new Date().toLocaleTimeString('tr-TR')}</span>
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
          <span style="font-weight: 900; font-style: italic; font-family: 'Montserrat', sans-serif;">${receiptData.sale_time || new Date().toLocaleTimeString('tr-TR')}</span>
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
  
  if (!printerName || !printerType) {
    return { success: false, error: 'Yazıcı adı ve tipi gerekli' };
  }
  
  // Mevcut atamayı bul veya yeni oluştur
  const existingIndex = db.printerAssignments.findIndex(
    a => a.printerName === printerName && a.printerType === printerType
  );
  
  const assignment = {
    printerName,
    printerType,
    category_id: category_id || null
  };
  
  if (existingIndex >= 0) {
    db.printerAssignments[existingIndex] = assignment;
  } else {
    db.printerAssignments.push(assignment);
  }
  
  saveDatabase();
  return { success: true, assignment };
});

ipcMain.handle('get-printer-assignments', () => {
  return db.printerAssignments;
});

ipcMain.handle('remove-printer-assignment', (event, printerName, printerType) => {
  const index = db.printerAssignments.findIndex(
    a => a.printerName === printerName && a.printerType === printerType
  );
  
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

// Adisyon yazdırma handler
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
    
    // Kasa yazıcısını kontrol et
    console.log('\n💰 Kasa yazıcısı kontrol ediliyor...');
    const cashierPrinter = db.settings.cashierPrinter;
    
    if (!cashierPrinter || !cashierPrinter.printerName) {
      console.error('   ❌ Kasa yazıcısı ayarlanmamış!');
      return { success: false, error: 'Kasa yazıcısı ayarlanmamış. Lütfen ayarlardan kasa yazıcısı seçin.' };
    }
    
    console.log(`   ✓ Kasa yazıcısı bulundu: "${cashierPrinter.printerName}" (${cashierPrinter.printerType})`);
    
    // Tüm ürünleri kasa yazıcısına yazdır
    console.log(`\n🖨️ ADİSYON YAZDIRMA BAŞLIYOR`);
    console.log(`   Yazıcı: "${cashierPrinter.printerName}"`);
    console.log(`   Tip: ${cashierPrinter.printerType}`);
    console.log(`   Toplam ürün sayısı: ${items.length}`);
    
    const result = await printAdisyonToPrinter(
      cashierPrinter.printerName, 
      cashierPrinter.printerType, 
      items, // Tüm ürünler
      adisyonData
    );
    
    if (!result.success) {
      console.error(`   ❌ Adisyon yazdırma başarısız: ${result.error}`);
      return { success: false, error: result.error || 'Adisyon yazdırılamadı' };
    } else {
      console.log(`   ✅ Adisyon yazdırma başarılı`);
    }
    
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

// Modern ve profesyonel adisyon HTML formatı
function generateAdisyonHTML(items, adisyonData) {
  const itemsHTML = items.map(item => {
    const isGift = item.isGift || false;
    
    if (isGift) {
      return `
      <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #16a34a; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
            <span style="font-weight: 900; font-size: 13px; color: #166534; font-family: 'Montserrat', sans-serif; text-decoration: line-through; opacity: 0.6;">${item.name}</span>
            <span style="font-size: 8px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 3px 6px; border-radius: 12px; font-weight: 900; box-shadow: 0 2px 4px rgba(22,163,74,0.3);">İKRAM</span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #166534; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
        </div>
        ${item.extraNote ? `
        <div style="margin-top: 6px; padding: 6px; background: white; border-radius: 4px; border-left: 3px solid #fbbf24;">
          <p style="font-size: 9px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
        </div>
        ` : ''}
      </div>
    `;
    }
    
    return `
      <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-left: 4px solid #3b82f6; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 900; font-size: 13px; color: #1e293b; font-family: 'Montserrat', sans-serif;">${item.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #475569; font-weight: 700; font-family: 'Montserrat', sans-serif;">${item.quantity} adet</span>
        </div>
        ${item.extraNote ? `
        <div style="margin-top: 6px; padding: 6px; background: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
          <p style="font-size: 9px; color: #92400e; font-weight: 700; margin: 0; font-family: 'Montserrat', sans-serif;">📝 ${item.extraNote}</p>
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
            padding: 12px 12px 20px 12px;
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
          padding: 12px 12px 25px 12px;
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
        .header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 3px solid #3b82f6;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .header h2 {
          font-size: 20px;
          font-weight: 900;
          margin: 8px 0 4px 0;
          font-family: 'Montserrat', sans-serif;
          color: #1e293b;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header p {
          font-size: 11px;
          font-weight: 700;
          margin: 0;
          color: #64748b;
          font-family: 'Montserrat', sans-serif;
        }
        .info {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 12px;
          padding: 12px;
          margin: 12px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .info div {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          font-family: 'Montserrat', sans-serif;
        }
        .info div span:last-child {
          color: #1e293b;
          font-weight: 900;
        }
        .items {
          margin: 16px 0;
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
      <div class="header">
        <h2>MAKARA</h2>
        <p>ADİSYON</p>
      </div>
      
      <div class="info">
        ${adisyonData.tableName ? `
        <div>
          <span>Masa:</span>
          <span>${adisyonData.tableName}</span>
        </div>
        ` : ''}
        <div>
          <span>Tarih:</span>
          <span>${adisyonData.sale_date || new Date().toLocaleDateString('tr-TR')}</span>
        </div>
        <div>
          <span>Saat:</span>
          <span>${adisyonData.sale_time || new Date().toLocaleTimeString('tr-TR')}</span>
        </div>
      </div>

      <div class="items">
        ${itemsHTML}
      </div>
      
      ${adisyonData.orderNote ? `
      <div style="margin: 16px 0; padding: 12px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <p style="font-size: 10px; font-weight: 900; color: #92400e; margin: 0 0 6px 0; font-family: 'Montserrat', sans-serif;">📝 Sipariş Notu:</p>
        <p style="font-size: 10px; font-weight: 700; color: #78350f; margin: 0; font-family: 'Montserrat', sans-serif;">${adisyonData.orderNote}</p>
      </div>
      ` : ''}

    </body>
    </html>
  `;
}

ipcMain.handle('quit-app', () => {
  saveDatabase();
  setTimeout(() => {
    app.quit();
  }, 500);
  return { success: true };
});

