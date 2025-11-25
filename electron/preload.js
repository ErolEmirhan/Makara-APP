const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCategories: () => ipcRenderer.invoke('get-categories'),
  createCategory: (categoryData) => ipcRenderer.invoke('create-category', categoryData),
  deleteCategory: (categoryId) => ipcRenderer.invoke('delete-category', categoryId),
  getProducts: (categoryId) => ipcRenderer.invoke('get-products', categoryId),
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: () => ipcRenderer.invoke('get-sales'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),
  // Table Order API
  createTableOrder: (orderData) => ipcRenderer.invoke('create-table-order', orderData),
  getTableOrders: (tableId) => ipcRenderer.invoke('get-table-orders', tableId),
  getTableOrderItems: (orderId) => ipcRenderer.invoke('get-table-order-items', orderId),
  completeTableOrder: (orderId) => ipcRenderer.invoke('complete-table-order', orderId),
  // Settings API
  changePassword: (currentPin, newPin) => ipcRenderer.invoke('change-password', currentPin, newPin),
  getAdminPin: () => ipcRenderer.invoke('get-admin-pin'),
  // Product Management API
  createProduct: (productData) => ipcRenderer.invoke('create-product', productData),
  updateProduct: (productData) => ipcRenderer.invoke('update-product', productData),
  deleteProduct: (productId) => ipcRenderer.invoke('delete-product', productId),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  // Update API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
  // Print API
  printReceipt: (receiptData) => ipcRenderer.invoke('print-receipt', receiptData),
  printAdisyon: (adisyonData) => ipcRenderer.invoke('print-adisyon', adisyonData),
  // Printer Management API
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  assignCategoryToPrinter: (assignmentData) => ipcRenderer.invoke('assign-category-to-printer', assignmentData),
  getPrinterAssignments: () => ipcRenderer.invoke('get-printer-assignments'),
  removePrinterAssignment: (printerName, printerType) => ipcRenderer.invoke('remove-printer-assignment', printerName, printerType),
  setCashierPrinter: (printerData) => ipcRenderer.invoke('set-cashier-printer', printerData),
  getCashierPrinter: () => ipcRenderer.invoke('get-cashier-printer'),
  // Table Order Partial Payment API
  updateTableOrderAmount: (orderId, paidAmount) => ipcRenderer.invoke('update-table-order-amount', orderId, paidAmount),
  createPartialPaymentSale: (saleData) => ipcRenderer.invoke('create-partial-payment-sale', saleData),
  // Exit API
  quitApp: () => ipcRenderer.invoke('quit-app')
});

