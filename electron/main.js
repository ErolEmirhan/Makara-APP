const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'makara.db');
  db = new Database(dbPath);

  // Kategoriler tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER
    )
  `);

  // Ürünler tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      price REAL NOT NULL,
      image TEXT,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    )
  `);

  // Satışlar tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      sale_date TEXT NOT NULL,
      sale_time TEXT NOT NULL
    )
  `);

  // Satış detayları tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `);

  // Örnek veri ekle (eğer boş ise)
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (categoryCount.count === 0) {
    const categories = [
      'Kruvasan Çeşitleri',
      'Prag Tatlısı',
      'Paris Tatlıları',
      'Kahvaltılar',
      'Sıcak İçecekler',
      'Soğuk İçecekler'
    ];

    const insertCategory = db.prepare('INSERT INTO categories (name, order_index) VALUES (?, ?)');
    categories.forEach((cat, index) => {
      insertCategory.run(cat, index);
    });

    // Örnek ürünler
    const products = [
      // Kruvasan Çeşitleri
      { name: 'Sade Kruvasan', category_id: 1, price: 35.00 },
      { name: 'Çikolatalı Kruvasan', category_id: 1, price: 40.00 },
      { name: 'Peynirli Kruvasan', category_id: 1, price: 45.00 },
      { name: 'Kaymaklı Kruvasan', category_id: 1, price: 42.00 },
      
      // Prag Tatlısı
      { name: 'Klasik Prag', category_id: 2, price: 55.00 },
      { name: 'Çilekli Prag', category_id: 2, price: 60.00 },
      { name: 'Frambuazlı Prag', category_id: 2, price: 60.00 },
      
      // Paris Tatlıları
      { name: 'Ekler', category_id: 3, price: 38.00 },
      { name: 'Macaron', category_id: 3, price: 25.00 },
      { name: 'Millefeuille', category_id: 3, price: 65.00 },
      
      // Kahvaltılar
      { name: 'Serpme Kahvaltı', category_id: 4, price: 180.00 },
      { name: 'Kahvaltı Tabağı', category_id: 4, price: 120.00 },
      { name: 'Menemen', category_id: 4, price: 75.00 },
      
      // Sıcak İçecekler
      { name: 'Türk Kahvesi', category_id: 5, price: 30.00 },
      { name: 'Filtre Kahve', category_id: 5, price: 35.00 },
      { name: 'Cappuccino', category_id: 5, price: 45.00 },
      { name: 'Latte', category_id: 5, price: 45.00 },
      { name: 'Çay', category_id: 5, price: 15.00 },
      
      // Soğuk İçecekler
      { name: 'Ice Latte', category_id: 6, price: 50.00 },
      { name: 'Limonata', category_id: 6, price: 35.00 },
      { name: 'Soda', category_id: 6, price: 20.00 },
      { name: 'Ayran', category_id: 6, price: 15.00 }
    ];

    const insertProduct = db.prepare('INSERT INTO products (name, category_id, price) VALUES (?, ?, ?)');
    products.forEach(product => {
      insertProduct.run(product.name, product.category_id, product.price);
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    title: 'MAKARA POS',
    backgroundColor: '#0f0f1e'
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('get-categories', () => {
  return db.prepare('SELECT * FROM categories ORDER BY order_index').all();
});

ipcMain.handle('get-products', (event, categoryId) => {
  if (categoryId) {
    return db.prepare('SELECT * FROM products WHERE category_id = ?').all(categoryId);
  }
  return db.prepare('SELECT * FROM products').all();
});

ipcMain.handle('create-sale', (event, saleData) => {
  const { items, totalAmount, paymentMethod } = saleData;
  
  const now = new Date();
  const saleDate = now.toLocaleDateString('tr-TR');
  const saleTime = now.toLocaleTimeString('tr-TR');

  const insertSale = db.prepare(
    'INSERT INTO sales (total_amount, payment_method, sale_date, sale_time) VALUES (?, ?, ?, ?)'
  );
  const result = insertSale.run(totalAmount, paymentMethod, saleDate, saleTime);
  const saleId = result.lastInsertRowid;

  const insertItem = db.prepare(
    'INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
  );

  items.forEach(item => {
    insertItem.run(saleId, item.id, item.name, item.quantity, item.price);
  });

  return { success: true, saleId };
});

ipcMain.handle('get-sales', () => {
  const sales = db.prepare(`
    SELECT 
      s.id,
      s.total_amount,
      s.payment_method,
      s.sale_date,
      s.sale_time,
      GROUP_CONCAT(si.product_name || ' x' || si.quantity, ', ') as items
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    GROUP BY s.id
    ORDER BY s.id DESC
    LIMIT 100
  `).all();
  
  return sales;
});

ipcMain.handle('get-sale-details', (event, saleId) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  
  return { sale, items };
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

