const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCategories: () => ipcRenderer.invoke('get-categories'),
  createCategory: (categoryData) => ipcRenderer.invoke('create-category', categoryData),
  updateCategory: (categoryId, categoryData) => ipcRenderer.invoke('update-category', categoryId, categoryData),
  deleteCategory: (categoryId) => ipcRenderer.invoke('delete-category', categoryId),
  reorderCategories: (orderedCategoryIds) => ipcRenderer.invoke('reorder-categories', orderedCategoryIds),
  getProducts: (categoryId) => ipcRenderer.invoke('get-products', categoryId),
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: () => ipcRenderer.invoke('get-sales'),
  getRecentSales: (hours) => ipcRenderer.invoke('get-recent-sales', hours),
  getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),
  deleteSale: (saleId) => ipcRenderer.invoke('delete-sale', saleId),
  deleteAllSales: () => ipcRenderer.invoke('delete-all-sales'),
  // Table Order API
  createTableOrder: (orderData) => ipcRenderer.invoke('create-table-order', orderData),
  getTableOrders: (tableId) => ipcRenderer.invoke('get-table-orders', tableId),
  getTableOrderItems: (orderId) => ipcRenderer.invoke('get-table-order-items', orderId),
  cancelTableOrderItem: (itemId, cancelQuantity, cancelReason) => ipcRenderer.invoke('cancel-table-order-item', itemId, cancelQuantity, cancelReason),
  cancelTableOrderItemsBulk: (itemsToCancel, cancelReason) => ipcRenderer.invoke('cancel-table-order-items-bulk', itemsToCancel, cancelReason),
  previewCancelReceipt: (itemId, cancelQuantity) => ipcRenderer.invoke('preview-cancel-receipt', itemId, cancelQuantity),
  cancelEntireTableOrder: (orderId, cancelReason) => ipcRenderer.invoke('cancel-entire-table-order', orderId, cancelReason),
  completeTableOrder: (orderId, paymentMethod, campaignPercentage) => ipcRenderer.invoke('complete-table-order', orderId, paymentMethod, campaignPercentage),
  transferTableOrder: (sourceTableId, targetTableId) => ipcRenderer.invoke('transfer-table-order', sourceTableId, targetTableId),
  // Settings API
  changePassword: (currentPin, newPin) => ipcRenderer.invoke('change-password', currentPin, newPin),
  getAdminPin: () => ipcRenderer.invoke('get-admin-pin'),
  // Product Management API
  createProduct: (productData) => ipcRenderer.invoke('create-product', productData),
  updateProduct: (productData) => ipcRenderer.invoke('update-product', productData),
  deleteProduct: (productId) => ipcRenderer.invoke('delete-product', productId),
  selectImageFile: (productId) => ipcRenderer.invoke('select-image-file', productId),
  createImageRecordsForAllProducts: () => ipcRenderer.invoke('create-image-records-for-all-products'),
  getFirebaseImages: () => ipcRenderer.invoke('get-firebase-images'),
  // Stock Management API
  adjustProductStock: (productId, adjustment) => ipcRenderer.invoke('adjust-product-stock', productId, adjustment),
  getProductStock: (productId) => ipcRenderer.invoke('get-product-stock', productId),
  toggleProductStockTracking: (productId, trackStock) => ipcRenderer.invoke('toggle-product-stock-tracking', productId, trackStock),
  markCategoryOutOfStock: (categoryId) => ipcRenderer.invoke('mark-category-out-of-stock', categoryId),
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
  payTableOrderItem: (itemId, paymentMethod, paidQuantity) => ipcRenderer.invoke('pay-table-order-item', itemId, paymentMethod, paidQuantity),
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
  setStaffManager: (staffId, isManager) => ipcRenderer.invoke('set-staff-manager', staffId, isManager),
  // Courier Management API
  getCouriers: () => ipcRenderer.invoke('get-couriers'),
  addCourier: (name, password) => ipcRenderer.invoke('add-courier', name, password),
  changeCourierPassword: (courierId, newPassword) => ipcRenderer.invoke('change-courier-password', courierId, newPassword),
  deleteCourier: (courierId) => ipcRenderer.invoke('delete-courier', courierId),
  verifyCourier: (name, password) => ipcRenderer.invoke('verify-courier', name, password),
  // Image optimization API
  optimizeAllProductImages: () => ipcRenderer.invoke('optimize-all-product-images'),
  // Real-time updates
  onNewOrderCreated: (callback) => {
    ipcRenderer.on('new-order-created', (event, data) => callback(data));
    // Cleanup function döndür
    return () => {
      ipcRenderer.removeAllListeners('new-order-created');
    };
  },
  // Table Sync API
  startTableSync: () => ipcRenderer.invoke('start-table-sync'),
  stopTableSync: () => ipcRenderer.invoke('stop-table-sync'),
  getTableSyncStatus: () => ipcRenderer.invoke('get-table-sync-status'),
  // Broadcast Message API
  sendBroadcastMessage: (message) => ipcRenderer.invoke('send-broadcast-message', message),
  onBroadcastMessage: (callback) => {
    ipcRenderer.on('broadcast-message', (event, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('broadcast-message');
    };
  },
  // Window Management API
  minimizeWindow: () => ipcRenderer.invoke('minimize-window')
});

