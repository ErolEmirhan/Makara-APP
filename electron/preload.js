const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCategories: () => ipcRenderer.invoke('get-categories'),
  getProducts: (categoryId) => ipcRenderer.invoke('get-products', categoryId),
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: () => ipcRenderer.invoke('get-sales'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),
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
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress))
});

