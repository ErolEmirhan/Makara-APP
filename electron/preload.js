const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCategories: () => ipcRenderer.invoke('get-categories'),
  createCategory: (categoryData) => ipcRenderer.invoke('create-category', categoryData),
  deleteCategory: (categoryId) => ipcRenderer.invoke('delete-category', categoryId),
  getProducts: (categoryId) => ipcRenderer.invoke('get-products', categoryId),
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: () => ipcRenderer.invoke('get-sales'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),
  deleteAllSales: () => ipcRenderer.invoke('delete-all-sales'),
  // Table Order API
  createTableOrder: (orderData) => ipcRenderer.invoke('create-table-order', orderData),
  getTableOrders: (tableId) => ipcRenderer.invoke('get-table-orders', tableId),
  getTableOrderItems: (orderId) => ipcRenderer.invoke('get-table-order-items', orderId),
  cancelTableOrderItem: (itemId, cancelQuantity) => ipcRenderer.invoke('cancel-table-order-item', itemId, cancelQuantity),
  previewCancelReceipt: (itemId, cancelQuantity) => ipcRenderer.invoke('preview-cancel-receipt', itemId, cancelQuantity),
  completeTableOrder: (orderId) => ipcRenderer.invoke('complete-table-order', orderId),
  transferTableOrder: (sourceTableId, targetTableId) => ipcRenderer.invoke('transfer-table-order', sourceTableId, targetTableId),
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
  removePrinterAssignment: (printerName, printerType, categoryId) => ipcRenderer.invoke('remove-printer-assignment', printerName, printerType, categoryId),
  setCashierPrinter: (printerData) => ipcRenderer.invoke('set-cashier-printer', printerData),
  getCashierPrinter: () => ipcRenderer.invoke('get-cashier-printer'),
  // Table Order Partial Payment API
  updateTableOrderAmount: (orderId, paidAmount) => ipcRenderer.invoke('update-table-order-amount', orderId, paidAmount),
  createPartialPaymentSale: (saleData) => ipcRenderer.invoke('create-partial-payment-sale', saleData),
  // Exit API
  quitApp: () => ipcRenderer.invoke('quit-app'),
  // Mobile API
  getServerURL: () => ipcRenderer.invoke('get-server-url'),
  generateQRCode: () => ipcRenderer.invoke('generate-qr-code'),
  // Admin Dashboard API
  // Staff Management API
  createStaff: (staffData) => ipcRenderer.invoke('create-staff', staffData),
  updateStaffPassword: (staffId, newPassword) => ipcRenderer.invoke('update-staff-password', staffId, newPassword),
  deleteStaff: (staffId) => ipcRenderer.invoke('delete-staff', staffId),
  getStaff: () => ipcRenderer.invoke('get-staff'),
  verifyStaffPin: (password) => ipcRenderer.invoke('verify-staff-pin', password),
  // Real-time updates
  onNewOrderCreated: (callback) => {
    ipcRenderer.on('new-order-created', (event, data) => callback(data));
    // Cleanup function döndür
    return () => {
      ipcRenderer.removeAllListeners('new-order-created');
    };
  }
});

