const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCategories: () => ipcRenderer.invoke('get-categories'),
  getProducts: (categoryId) => ipcRenderer.invoke('get-products', categoryId),
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: () => ipcRenderer.invoke('get-sales'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId)
});

