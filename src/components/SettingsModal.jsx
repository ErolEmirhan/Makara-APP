import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const SettingsModal = ({ onClose, onProductsUpdated, variant = 'modal' }) => {
  const isPage = variant === 'page';
  const [activeTab, setActiveTab] = useState('password'); // 'password', 'products', 'printers', 'stock', or 'integration'
  const [printerSubTab, setPrinterSubTab] = useState('usb'); // 'usb' or 'network'
  
  // Stock management state
  const [stockFilterCategory, setStockFilterCategory] = useState(null);
  const [stockFilterProduct, setStockFilterProduct] = useState(null);
  const [stockAdjustmentAmount, setStockAdjustmentAmount] = useState('');
  const [stockAdjustmentType, setStockAdjustmentType] = useState('add'); // 'add' or 'subtract'
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Product management state
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category_id: '',
    price: '',
    image: ''
  });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { productId, productName }
  const [deleteCategoryModal, setDeleteCategoryModal] = useState(null); // { categoryId, categoryName, productCount }
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const productFormRef = useRef(null);
  const [categoryError, setCategoryError] = useState('');
  
  // Printer management state
  const [printers, setPrinters] = useState({ usb: [], network: [], all: [] });
  const [printerAssignments, setPrinterAssignments] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [showCategoryAssignModal, setShowCategoryAssignModal] = useState(false);
  const [assigningCategory, setAssigningCategory] = useState(null);
  const [cashierPrinter, setCashierPrinter] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isOptimizingImages, setIsOptimizingImages] = useState(false);
  const [lastOptimizeResult, setLastOptimizeResult] = useState(null);
  const [showFirebaseImageModal, setShowFirebaseImageModal] = useState(false);
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [isLoadingFirebaseImages, setIsLoadingFirebaseImages] = useState(false);
  const [isCreatingImageRecords, setIsCreatingImageRecords] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  
  // Integration state
  const [integrationSettings, setIntegrationSettings] = useState({
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
  });
  const [isTestingConnection, setIsTestingConnection] = useState({ trendyol: false, yemeksepeti: false });
  const [connectionStatus, setConnectionStatus] = useState({ trendyol: null, yemeksepeti: null }); // 'success', 'error', null

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  useEffect(() => {
    loadCategories();
    loadAllProducts();
    if (activeTab === 'printers') {
      loadPrinters();
      loadPrinterAssignments();
      loadCashierPrinter();
    }
    if (activeTab === 'stock') {
      // Stok sekmesi açıldığında ürünleri yükle
      loadAllProducts();
    }
    if (activeTab === 'integration') {
      loadIntegrationSettings();
    }
  }, [activeTab]);
  
  const loadIntegrationSettings = async () => {
    try {
      if (window.electronAPI && window.electronAPI.getIntegrationSettings) {
        const settings = await window.electronAPI.getIntegrationSettings();
        if (settings) {
          setIntegrationSettings(settings);
        }
      }
    } catch (error) {
      console.error('Entegrasyon ayarları yüklenirken hata:', error);
    }
  };
  
  const saveIntegrationSettings = async () => {
    try {
      if (window.electronAPI && window.electronAPI.saveIntegrationSettings) {
        const result = await window.electronAPI.saveIntegrationSettings(integrationSettings);
        if (result.success) {
          showToast('Entegrasyon ayarları başarıyla kaydedildi', 'success');
        } else {
          showToast('Ayarlar kaydedilirken hata: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
      }
    } catch (error) {
      console.error('Entegrasyon ayarları kaydedilirken hata:', error);
      showToast('Ayarlar kaydedilirken hata: ' + error.message, 'error');
    }
  };
  
  const testConnection = async (platform) => {
    setIsTestingConnection(prev => ({ ...prev, [platform]: true }));
    setConnectionStatus(prev => ({ ...prev, [platform]: null }));
    
    try {
      if (window.electronAPI && window.electronAPI.testIntegrationConnection) {
        const result = await window.electronAPI.testIntegrationConnection(platform, integrationSettings[platform]);
        if (result.success) {
          setConnectionStatus(prev => ({ ...prev, [platform]: 'success' }));
          showToast(`${platform === 'trendyol' ? 'Trendyol' : 'Yemeksepeti'} bağlantısı başarılı!`, 'success');
        } else {
          setConnectionStatus(prev => ({ ...prev, [platform]: 'error' }));
          showToast(`${platform === 'trendyol' ? 'Trendyol' : 'Yemeksepeti'} bağlantı hatası: ${result.error || 'Bilinmeyen hata'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Bağlantı testi hatası:', error);
      setConnectionStatus(prev => ({ ...prev, [platform]: 'error' }));
      showToast('Bağlantı testi sırasında hata: ' + error.message, 'error');
    } finally {
      setIsTestingConnection(prev => ({ ...prev, [platform]: false }));
    }
  };

  const loadCategories = async () => {
    const cats = await window.electronAPI.getCategories();
    setCategories(cats);
    if (cats.length > 0 && !selectedCategory) {
      setSelectedCategory(cats[0]);
      setProductForm(prev => ({ ...prev, category_id: cats[0].id }));
    }
  };

  const loadAllProducts = async () => {
    const prods = await window.electronAPI.getProducts();
    setProducts(prods);
  };

  const loadPrinters = async () => {
    try {
      const result = await window.electronAPI.getPrinters();
      if (result && result.success) {
        setPrinters(result.printers);
      }
    } catch (error) {
      console.error('Yazıcı yükleme hatası:', error);
    }
  };

  const handleOptimizeAllImages = async () => {
    if (!window.electronAPI || typeof window.electronAPI.optimizeAllProductImages !== 'function') {
      showToast('Görsel optimizasyon özelliği yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }

    if (
      !window.confirm(
        'Tüm ürün görselleri Firebase Storage üzerinde yeniden optimize edilecek.\n\n' +
        '- Tümü WebP formatına dönüştürülecek\n' +
        '- Maksimum genişlik 600px, kalite ~65\n' +
        '- Amaç: 50–120 KB arası, 200 KB üstü reddedilir\n\n' +
        'Bu işlem internet bağlantınıza ve görsel sayısına göre birkaç dakika sürebilir.\n\n' +
        'Devam etmek istiyor musunuz?'
      )
    ) {
      return;
    }

    try {
      setIsOptimizingImages(true);
      setLastOptimizeResult(null);
      const result = await window.electronAPI.optimizeAllProductImages();
      setLastOptimizeResult(result);

      if (result && result.success) {
        showToast(
          `Görsel optimizasyon tamamlandı. İşlenen: ${result.processed}, Atlanan: ${result.skipped}, Hata: ${result.failed}`,
          'success'
        );
      } else {
        showToast(
          'Görsel optimizasyon tamamlanamadı: ' + (result?.error || 'Bilinmeyen hata'),
          'error'
        );
      }
    } catch (error) {
      console.error('Görsel optimizasyon hatası:', error);
      showToast('Görsel optimizasyon hatası: ' + error.message, 'error');
    } finally {
      setIsOptimizingImages(false);
    }
  };

  const loadPrinterAssignments = async () => {
    try {
      const assignments = await window.electronAPI.getPrinterAssignments();
      console.log('Yazıcı atamaları yüklendi:', assignments);
      setPrinterAssignments(assignments || []);
    } catch (error) {
      console.error('Yazıcı atamaları yükleme hatası:', error);
    }
  };

  const loadCashierPrinter = async () => {
    try {
      const cashier = await window.electronAPI.getCashierPrinter();
      setCashierPrinter(cashier);
    } catch (error) {
      console.error('Kasa yazıcısı yükleme hatası:', error);
    }
  };

  const handleSetCashierPrinter = async (printerName, printerType) => {
    try {
      const isCurrentCashier = cashierPrinter && 
        cashierPrinter.printerName === printerName && 
        cashierPrinter.printerType === printerType;
      
      if (isCurrentCashier) {
        // Zaten kasa yazıcısıysa, kaldır
        await window.electronAPI.setCashierPrinter(null);
        setCashierPrinter(null);
        showToast('Kasa yazıcısı kaldırıldı', 'success');
      } else {
        // Kasa yazıcısı olarak ayarla
        await window.electronAPI.setCashierPrinter({ printerName, printerType });
        setCashierPrinter({ printerName, printerType });
        showToast(`${printerName} kasa yazıcısı olarak ayarlandı`, 'success');
      }
    } catch (error) {
      console.error('Kasa yazıcısı ayarlama hatası:', error);
      showToast('Kasa yazıcısı ayarlanırken hata oluştu: ' + error.message, 'error');
    }
  };

  const handleAssignCategory = async (printerName, printerType) => {
    setSelectedPrinter({ name: printerName, type: printerType });
    // Bu yazıcıya zaten atanmış kategorileri yükle
    const existingAssignments = printerAssignments.filter(
      a => a.printerName === printerName && a.printerType === printerType
    );
    // category_id'leri number'a çevir (tip uyumluluğu için)
    const existingCategoryIds = existingAssignments.map(a => Number(a.category_id));
    console.log('Modal açılıyor - Mevcut atamalar:', existingCategoryIds);
    setSelectedCategories(existingCategoryIds);
    setShowCategoryAssignModal(true);
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategories(prev => {
      const newSelection = prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
      console.log('Kategori seçimi değişti:', categoryId, 'Yeni seçim:', newSelection);
      return newSelection;
    });
  };

  const confirmCategoryAssignment = async () => {
    if (!selectedPrinter) return;
    
    console.log('Kategori atama başlatılıyor - Seçilen kategoriler:', selectedCategories);
    
    if (selectedCategories.length === 0) {
      showToast('Lütfen en az bir kategori seçin', 'warning');
      return;
    }
    
    setAssigningCategory(true);
    
    try {
      // Önce bu yazıcıya zaten atanmış kategorileri bul
      const existingAssignments = printerAssignments.filter(
        a => a.printerName === selectedPrinter.name && a.printerType === selectedPrinter.type
      );
      // Tip uyumluluğu için number'a çevir
      const existingCategoryIds = existingAssignments.map(a => Number(a.category_id));
      
      console.log('Mevcut atamalar:', existingCategoryIds);
      console.log('Seçilen kategoriler:', selectedCategories);
      
      // Kaldırılacak kategoriler (eski atamalarda var ama yeni seçimde yok)
      const toRemove = existingCategoryIds.filter(id => !selectedCategories.includes(id));
      
      // Eklenecek kategoriler (yeni seçimde var ama eski atamalarda yok)
      const toAdd = selectedCategories.filter(id => !existingCategoryIds.includes(id));
      
      console.log('Kaldırılacak kategoriler:', toRemove);
      console.log('Eklenecek kategoriler:', toAdd);
      
      // Önce kaldırılacak kategorileri kaldır
      for (const categoryId of toRemove) {
        const assignment = existingAssignments.find(a => a.category_id === categoryId);
        if (assignment) {
          const result = await window.electronAPI.removePrinterAssignment(
            assignment.printerName,
            assignment.printerType,
            categoryId
          );
          if (!result || !result.success) {
            console.error('Kategori kaldırma hatası:', categoryId, result);
          }
        }
      }
      
      // Sonra eklenecek kategorileri ekle - hepsini sırayla ekle
      const addResults = [];
      console.log(`Toplam ${toAdd.length} kategori eklenecek`);
      
      for (let i = 0; i < toAdd.length; i++) {
        const categoryId = toAdd[i];
        console.log(`[${i + 1}/${toAdd.length}] Kategori ekleniyor:`, categoryId, 'Tip:', typeof categoryId);
    
    try {
      const result = await window.electronAPI.assignCategoryToPrinter({
        printerName: selectedPrinter.name,
        printerType: selectedPrinter.type,
        category_id: categoryId
      });
      
          addResults.push({ categoryId, result });
          
          if (!result || !result.success) {
            console.error('Kategori ekleme hatası:', categoryId, result);
            throw new Error(result?.error || `Kategori ${categoryId} atanamadı`);
          }
          
          console.log(`✓ Kategori ${categoryId} başarıyla eklendi`);
          
          // Her atama arasında kısa bir bekleme (race condition önlemek için)
          if (i < toAdd.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error(`Kategori ${categoryId} eklenirken hata:`, error);
          throw error;
        }
      }
      
      console.log('Tüm kategoriler eklendi:', addResults);
      
      // Veritabanını yeniden yükle
        await loadPrinterAssignments();
      
        setShowCategoryAssignModal(false);
        setSelectedPrinter(null);
        setAssigningCategory(null);
      setSelectedCategories([]);
      
      const addedCount = toAdd.length;
      const removedCount = toRemove.length;
      let message = '';
      if (addedCount > 0 && removedCount > 0) {
        message = `${addedCount} kategori eklendi, ${removedCount} kategori kaldırıldı`;
      } else if (addedCount > 0) {
        message = `${addedCount} kategori başarıyla atandı`;
      } else if (removedCount > 0) {
        message = `${removedCount} kategori kaldırıldı`;
      }
      showToast(message || 'Kategori atamaları güncellendi', 'success');
    } catch (error) {
      console.error('Kategori atama hatası:', error);
      showToast('Kategori atanamadı: ' + error.message, 'error');
      setAssigningCategory(null);
      // Hata durumunda da veritabanını yeniden yükle
      await loadPrinterAssignments();
    }
  };

  const handleRemoveCategoryAssignment = async (categoryId) => {
    if (!categoryId) return;
    
    if (!confirm(`Bu kategorinin yazıcı atamasını kaldırmak istediğinize emin misiniz?`)) {
      return;
    }
    
    try {
      // Kategori bazlı kaldırma için categoryId kullan
      const assignment = printerAssignments.find(a => a.category_id === categoryId);
      if (!assignment) {
        showToast('Atama bulunamadı', 'error');
        return;
      }
      
      const result = await window.electronAPI.removePrinterAssignment(
        assignment.printerName,
        assignment.printerType,
        categoryId
      );
      
      if (result && result.success) {
        await loadPrinterAssignments();
        showToast('Kategori ataması kaldırıldı', 'success');
      } else {
        showToast(result?.error || 'Kategori ataması kaldırılamadı', 'error');
      }
    } catch (error) {
      console.error('Kategori ataması kaldırma hatası:', error);
      showToast('Kategori ataması kaldırılamadı: ' + error.message, 'error');
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tüm alanları doldurun');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni parolalar eşleşmiyor');
      return;
    }

    if (newPassword.length !== 4 || !/^\d+$/.test(newPassword)) {
      setPasswordError('Parola 4 haneli rakam olmalıdır');
      return;
    }

    // API kontrolü
    if (!window.electronAPI || typeof window.electronAPI.changePassword !== 'function') {
      setPasswordError('API yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
      return;
    }

    try {
      const result = await window.electronAPI.changePassword(currentPassword, newPassword);
      if (result && result.success) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordSuccess(false);
        }, 3000);
      } else {
        setPasswordError(result?.error || 'Parola değiştirilemedi');
      }
    } catch (error) {
      console.error('Parola değiştirme hatası:', error);
      setPasswordError('Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    
    if (!productForm.name || !productForm.category_id || !productForm.price) {
      showToast('Lütfen tüm alanları doldurun', 'warning');
      return;
    }

    const price = parseFloat(productForm.price);
    if (isNaN(price) || price <= 0) {
      showToast('Geçerli bir fiyat girin', 'warning');
      return;
    }

    try {
      if (editingProduct) {
        // Update product
        await window.electronAPI.updateProduct({
          id: editingProduct.id,
          name: productForm.name,
          category_id: parseInt(productForm.category_id),
          price: price,
          image: productForm.image || null
        });
      } else {
        // Create product
        await window.electronAPI.createProduct({
          name: productForm.name,
          category_id: parseInt(productForm.category_id),
          price: price,
          image: productForm.image || null
        });
      }
      
      // Reset form
      setProductForm({ name: '', category_id: selectedCategory?.id || '', price: '', image: '' });
      setEditingProduct(null);
      loadAllProducts();
      
      // Ana uygulamayı yenile
      if (onProductsUpdated) {
        onProductsUpdated();
      }
    } catch (error) {
      showToast('Ürün kaydedilemedi: ' + error.message, 'error');
    }
  };

  const handleDeleteProduct = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setDeleteConfirmModal({ productId, productName: product.name });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmModal) return;

    try {
      const result = await window.electronAPI.deleteProduct(deleteConfirmModal.productId);
      
      // Response kontrolü
      if (!result || !result.success) {
        showToast(result?.error || 'Ürün silinemedi', 'error');
        setDeleteConfirmModal(null);
        return;
      }
      
      // Başarılı silme
      loadAllProducts();
      
      // Ana uygulamayı yenile
      if (onProductsUpdated) {
        onProductsUpdated();
      }
      
      setDeleteConfirmModal(null);
    } catch (error) {
      console.error('Ürün silme hatası:', error);
      showToast('Ürün silinemedi: ' + (error.message || 'Bilinmeyen hata'), 'error');
      setDeleteConfirmModal(null);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category_id: product.category_id,
      price: product.price.toString(),
      image: product.image || ''
    });
    
    // Form alanına scroll yap
    setTimeout(() => {
      if (productFormRef.current) {
        productFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setProductForm({ name: '', category_id: selectedCategory?.id || '', price: '', image: '' });
  };

  const handleAddCategory = async () => {
    setCategoryError('');
    
    if (!newCategoryName || newCategoryName.trim() === '') {
      setCategoryError('Kategori adı boş olamaz');
      return;
    }

    // API kontrolü
    if (!window.electronAPI) {
      setCategoryError('Electron API yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
      console.error('window.electronAPI bulunamadı');
      return;
    }
    
    if (typeof window.electronAPI.createCategory !== 'function') {
      setCategoryError('Kategori ekleme özelliği yüklenemedi. Lütfen uygulamayı tamamen kapatıp yeniden başlatın.');
      console.error('window.electronAPI.createCategory fonksiyonu bulunamadı. Mevcut API fonksiyonları:', Object.keys(window.electronAPI || {}));
      return;
    }

    try {
      const result = await window.electronAPI.createCategory({ name: newCategoryName.trim() });
      
      if (result && result.success) {
        // Kategorileri yenile
        await loadCategories();
        // Yeni eklenen kategoriyi seç
        if (result.category) {
          setSelectedCategory(result.category);
          setProductForm(prev => ({ ...prev, category_id: result.category.id }));
        }
        // Modal'ı kapat ve formu temizle
        setShowAddCategoryModal(false);
        setNewCategoryName('');
        setCategoryError('');
        
        // Ana uygulamayı yenile
        if (onProductsUpdated) {
          onProductsUpdated();
        }
      } else {
        setCategoryError(result?.error || 'Kategori eklenemedi');
      }
    } catch (error) {
      console.error('Kategori ekleme hatası:', error);
      setCategoryError('Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setCategoryError('');
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = async () => {
    setCategoryError('');
    
    if (!newCategoryName || newCategoryName.trim() === '') {
      setCategoryError('Kategori adı boş olamaz');
      return;
    }

    if (!editingCategory) {
      setCategoryError('Düzenlenecek kategori bulunamadı');
      return;
    }

    // API kontrolü
    if (!window.electronAPI) {
      setCategoryError('Electron API yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
      return;
    }
    
    if (typeof window.electronAPI.updateCategory !== 'function') {
      setCategoryError('Kategori güncelleme özelliği yüklenemedi. Lütfen uygulamayı tamamen kapatıp yeniden başlatın.');
      return;
    }

    try {
      const result = await window.electronAPI.updateCategory(editingCategory.id, { name: newCategoryName.trim() });
      
      if (result && result.success) {
        // Kategorileri yenile
        await loadCategories();
        // Güncellenen kategoriyi seç
        if (result.category) {
          setSelectedCategory(result.category);
          setProductForm(prev => ({ ...prev, category_id: result.category.id }));
        }
        // Modal'ı kapat ve formu temizle
        setShowEditCategoryModal(false);
        setEditingCategory(null);
        setNewCategoryName('');
        setCategoryError('');
        
        // Ana uygulamayı yenile
        if (onProductsUpdated) {
          onProductsUpdated();
        }
      } else {
        setCategoryError(result?.error || 'Kategori güncellenemedi');
      }
    } catch (error) {
      console.error('Kategori güncelleme hatası:', error);
      setCategoryError('Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryModal) return;
    
    try {
      const result = await window.electronAPI.deleteCategory(deleteCategoryModal.categoryId);
      
      if (result && result.success) {
        // Kategorileri yenile
        await loadCategories();
        
        // Eğer silinen kategori seçiliyse, seçimi temizle
        if (selectedCategory?.id === deleteCategoryModal.categoryId) {
          setSelectedCategory(null);
        }
        
        // Ana uygulamayı yenile
        if (onProductsUpdated) {
          onProductsUpdated();
        }
        
        setDeleteCategoryModal(null);
      } else {
        showToast(result?.error || 'Kategori silinemedi', 'error');
        setDeleteCategoryModal(null);
      }
    } catch (error) {
      console.error('Kategori silme hatası:', error);
      showToast('Kategori silinemedi: ' + error.message, 'error');
      setDeleteCategoryModal(null);
    }
  };

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory.id)
    : products;

  // Stock management functions
  const handleStockAdjustment = async () => {
    if (!stockFilterProduct) {
      showToast('Lütfen bir ürün seçin', 'warning');
      return;
    }
    
    const amount = parseInt(stockAdjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Geçerli bir miktar girin', 'warning');
      return;
    }
    
    try {
      const result = await window.electronAPI.adjustProductStock(
        stockFilterProduct.id,
        stockAdjustmentType === 'add' ? amount : -amount
      );
      
      if (result && result.success) {
        showToast(`Stok başarıyla ${stockAdjustmentType === 'add' ? 'artırıldı' : 'azaltıldı'}`, 'success');
        setStockAdjustmentAmount('');
        // Ürünleri yenile
        await loadAllProducts();
        // Seçili ürünü güncelle
        const updatedProduct = result.product;
        setStockFilterProduct(updatedProduct);
        // Ana uygulamayı yenile
        if (onProductsUpdated) {
          onProductsUpdated();
        }
      } else {
        showToast(result?.error || 'Stok güncellenemedi', 'error');
      }
    } catch (error) {
      console.error('Stok güncelleme hatası:', error);
      showToast('Stok güncellenemedi: ' + error.message, 'error');
    }
  };

  const handleToggleStockTracking = async (productId, currentTrackStock) => {
    try {
      const result = await window.electronAPI.toggleProductStockTracking(productId, !currentTrackStock);
      
      if (result && result.success) {
        // Ürünleri yenile
        await loadAllProducts();
        // Seçili ürünü güncelle
        if (stockFilterProduct && stockFilterProduct.id === productId) {
          setStockFilterProduct(result.product);
        }
        // Ana uygulamayı yenile
        if (onProductsUpdated) {
          onProductsUpdated();
        }
      } else {
        showToast(result?.error || 'Stok takibi durumu değiştirilemedi', 'error');
      }
    } catch (error) {
      console.error('Stok takibi durumu değiştirme hatası:', error);
      showToast('Stok takibi durumu değiştirilemedi: ' + error.message, 'error');
    }
  };

  const handleMoveCategory = async (categoryId, direction) => {
    if (!categories || categories.length === 0) return;

    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) {
      return; // En üstte/en altta ise hareket etmesin
    }

    const newCategories = [...categories];
    const temp = newCategories[currentIndex];
    newCategories[currentIndex] = newCategories[targetIndex];
    newCategories[targetIndex] = temp;

    setCategories(newCategories);

    // Backend'e yeni sıralamayı gönder
    try {
      if (!window.electronAPI || typeof window.electronAPI.reorderCategories !== 'function') {
        showToast('Kategori sıralama özelliği yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
        return;
      }

      const orderedIds = newCategories.map(c => c.id);
      const result = await window.electronAPI.reorderCategories(orderedIds);

      if (!result || !result.success) {
        console.error('Kategori sıralama hatası:', result);
        showToast(result?.error || 'Kategori sıralaması kaydedilemedi', 'error');
        return;
      }

      // Backend’den dönen sıralamayı kaydet (güvenli olması için)
      if (Array.isArray(result.categories)) {
        setCategories(result.categories);
        // Seçili kategori referansını güncelle
        if (selectedCategory) {
          const updatedSelected = result.categories.find(c => c.id === selectedCategory.id);
          if (updatedSelected) {
            setSelectedCategory(updatedSelected);
          }
        }
      }

      // Ana uygulamadaki kategori/pano görünümünü yenile (masaüstü POS + mobil)
      if (onProductsUpdated) {
        onProductsUpdated();
      }
    } catch (error) {
      console.error('Kategori sıralama API hatası:', error);
      showToast('Kategori sıralaması kaydedilemedi: ' + error.message, 'error');
    }
  };

  const content = (
    <>
      {!isPage && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-rose-400" />}
      {!isPage && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {isPage && (
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Ayarlar</h1>
        </div>
      )}

        <div className="text-center mb-6 pt-2">
          <div className="w-14 h-14 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Ayarlar</h2>
          <p className="text-sm text-gray-500">Sistem ayarlarını yönetin</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('password')}
              className={`px-6 py-3 text-sm font-medium transition-all rounded-lg flex items-center space-x-2 ${
                activeTab === 'password'
                  ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Parola Değiştirme</span>
            </button>
            <div className="w-px bg-gray-200 my-2"></div>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-3 text-sm font-medium transition-all rounded-lg flex items-center space-x-2 ${
                activeTab === 'products'
                  ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Ürün Yönetimi</span>
            </button>
            <div className="w-px bg-gray-200 my-2"></div>
            <button
              onClick={() => setActiveTab('printers')}
              className={`px-6 py-3 text-sm font-medium transition-all rounded-lg flex items-center space-x-2 ${
                activeTab === 'printers'
                  ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Adisyon Yönetimi</span>
            </button>
            <div className="w-px bg-gray-200 my-2"></div>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-6 py-3 text-sm font-medium transition-all rounded-lg flex items-center space-x-2 ${
                activeTab === 'stock'
                  ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Stok Takibi</span>
            </button>
            <div className="w-px bg-gray-200 my-2"></div>
            <button
              onClick={() => setActiveTab('integration')}
              className={`px-6 py-3 text-sm font-medium transition-all rounded-lg flex items-center space-x-2 ${
                activeTab === 'integration'
                  ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Entegrasyon</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-custom">
          {activeTab === 'password' && (
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mevcut Parola
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={currentPassword}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCurrentPassword(val);
                      setPasswordError('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                    placeholder="4 haneli parola"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yeni Parola
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPassword}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewPassword(val);
                      setPasswordError('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                    placeholder="4 haneli yeni parola"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yeni Parola (Tekrar)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPassword}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setConfirmPassword(val);
                      setPasswordError('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                    placeholder="Yeni parolayı tekrar girin"
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
                    ✅ Parola başarıyla değiştirildi!
                  </div>
                )}

                <button
                  onClick={handlePasswordChange}
                  className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Parolayı Değiştir
                </button>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Product Form */}
              <div ref={productFormRef} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                </h3>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Adı
                      </label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white"
                        placeholder="Ürün adı"
                        required
                      />
                    </div>

                    <div className="relative" ref={categoryDropdownRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kategori
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className={`w-full px-4 py-3 rounded-lg border transition-all text-left flex items-center justify-between ${
                          productForm.category_id
                            ? 'border-pink-500 bg-pink-50'
                            : 'border-gray-300 hover:border-pink-400'
                        } focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white`}
                      >
                        <span className={productForm.category_id ? 'text-pink-700 font-medium' : 'text-gray-500'}>
                          {productForm.category_id
                            ? categories.find(c => c.id === parseInt(productForm.category_id))?.name || 'Kategori Seçin'
                            : 'Kategori Seçin'}
                        </span>
                        <svg 
                          className={`w-5 h-5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''} ${
                            productForm.category_id ? 'text-pink-600' : 'text-gray-400'
                          }`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showCategoryDropdown && (
                        <div className="absolute z-20 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-h-60 overflow-y-auto">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setProductForm({ ...productForm, category_id: cat.id.toString() });
                                setShowCategoryDropdown(false);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-pink-50 transition-all flex items-center space-x-3 ${
                                productForm.category_id === cat.id.toString()
                                  ? 'bg-pink-500 text-white'
                                  : 'text-gray-700'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full ${
                                productForm.category_id === cat.id.toString()
                                  ? 'bg-white'
                                  : 'bg-pink-500'
                              }`}></div>
                              <span className="font-medium">{cat.name}</span>
                              {productForm.category_id === cat.id.toString() && (
                                <svg className="w-5 h-5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fiyat (₺)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={productForm.price}
                        onChange={(e) => {
                          // Sadece sayı ve nokta/virgül kabul et
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          // Virgülü noktaya çevir
                          const normalized = val.replace(',', '.');
                          // Sadece bir ondalık ayırıcı olmasını sağla
                          const parts = normalized.split('.');
                          const finalValue = parts.length > 2 
                            ? parts[0] + '.' + parts.slice(1).join('')
                            : normalized;
                          setProductForm({ ...productForm, price: finalValue });
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white"
                        placeholder="0.00"
                        required
                      />
                    </div>

                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {editingProduct ? 'Güncelle' : 'Ekle'}
                    </button>
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                      >
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Product List */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">Mevcut Ürünler</h3>
                
                {/* Modern Category Filter */}
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">Kategori Filtrele</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                          !selectedCategory
                            ? 'bg-pink-500 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          <span>Tümü</span>
                        </div>
                      </button>
                      {categories.map(cat => (
                        <div key={cat.id} className="relative group">
                          <button
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                              selectedCategory?.id === cat.id
                                ? 'bg-pink-500 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                selectedCategory?.id === cat.id ? 'bg-white' : 'bg-purple-500'
                              }`}></div>
                              <span>{cat.name}</span>
                              {selectedCategory?.id === cat.id && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                            {/* Yukarı taşı */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCategory(cat.id, 'up');
                              }}
                              className="w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full flex items-center justify-center shadow-lg transition-all"
                              title="Yukarı Taşı"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            {/* Aşağı taşı */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCategory(cat.id, 'down');
                              }}
                              className="w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full flex items-center justify-center shadow-lg transition-all"
                              title="Aşağı Taşı"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCategory(cat);
                              }}
                              className="w-6 h-6 bg-pink-500 hover:bg-pink-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
                              title="Kategoriyi Düzenle"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteCategoryModal({ categoryId: cat.id, categoryName: cat.name });
                              }}
                              className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
                              title="Kategoriyi Sil"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setShowAddCategoryModal(true)}
                        className="px-4 py-2.5 rounded-lg font-medium transition-all duration-200 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>Kategori Ekle</span>
                        </div>
                      </button>
                    </div>
                    {selectedCategory && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold text-pink-600">{selectedCategory.name}</span> kategorisinde
                          </span>
                          <span className="text-sm font-bold text-pink-600">
                            {filteredProducts.length} ürün
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 overflow-y-auto scrollbar-custom" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                  {filteredProducts.map(product => {
                    const category = categories.find(c => c.id === product.category_id);
                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-xl p-3 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all flex flex-col"
                      >
                        <div className="mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-base leading-tight mb-1.5 truncate" title={product.name} style={{ fontWeight: 700 }}>{product.name}</h4>
                            <p className="text-xs text-gray-500 mb-2 truncate">{category?.name || 'Kategori yok'}</p>
                            <div className="inline-block">
                              <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-semibold rounded-lg text-sm border border-emerald-200/50">
                                {product.price.toFixed(2)} ₺
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all text-xs font-medium border border-gray-300 hover:border-gray-400"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="flex-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-all text-xs font-medium border border-gray-300 hover:border-gray-400"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">Stok Takibi</h3>
                  <p className="text-sm text-gray-500">Ürün stoklarını görüntüleyin ve güncelleyin</p>
                </div>
              </div>
              
              {/* Filtreler */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-800">Filtrele ve Ara</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategori Seçin
                    </label>
                    <select
                      value={stockFilterCategory?.id || ''}
                      onChange={(e) => {
                        const catId = e.target.value ? parseInt(e.target.value) : null;
                        const cat = categories.find(c => c.id === catId);
                        setStockFilterCategory(cat || null);
                        setStockFilterProduct(null);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white transition-all"
                    >
                      <option value="">Tüm Kategoriler</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ürün Seçin
                    </label>
                    <select
                      value={stockFilterProduct?.id || ''}
                      onChange={(e) => {
                        const prodId = e.target.value ? parseInt(e.target.value) : null;
                        const prod = products.find(p => p.id === prodId);
                        setStockFilterProduct(prod || null);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white transition-all disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={!stockFilterCategory && categories.length > 0}
                    >
                      <option value="">Önce kategori seçin</option>
                      {(stockFilterCategory 
                        ? products.filter(p => p.category_id === stockFilterCategory.id)
                        : products
                      ).map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} {prod.stock !== undefined ? `(Stok: ${prod.stock || 0})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {stockFilterCategory && (
                    <div className="flex items-end">
                      <button
                        onClick={async () => {
                          if (!window.confirm(
                            `${stockFilterCategory.name} kategorisindeki TÜM ürünlerin stokunu 0 yapmak ve stok takibini açmak istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`
                          )) {
                            return;
                          }
                          
                          try {
                            const result = await window.electronAPI.markCategoryOutOfStock(stockFilterCategory.id);
                            
                            if (result && result.success) {
                              showToast(`✅ ${result.updatedCount} ürün "kalmadı" olarak işaretlendi`, 'success');
                              await loadAllProducts();
                              if (onProductsUpdated) {
                                onProductsUpdated();
                              }
                            } else {
                              showToast(result?.error || 'Kategori işaretlenemedi', 'error');
                            }
                          } catch (error) {
                            console.error('Kategori işaretleme hatası:', error);
                            showToast('Kategori işaretlenemedi: ' + error.message, 'error');
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Kategoriyi Tükenmiş İşaretle</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stok Güncelleme */}
              {stockFilterProduct && (
                <div data-stock-form className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {stockFilterProduct.image ? (
                          <img src={stockFilterProduct.image} alt={stockFilterProduct.name} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            <span className="text-xl">📦</span>
                          </div>
                        )}
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">{stockFilterProduct.name}</h4>
                          <p className="text-sm text-gray-500">
                            {categories.find(c => c.id === stockFilterProduct.category_id)?.name || 'Kategori yok'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Mevcut Stok</p>
                          <p className={`text-2xl font-bold ${
                            stockFilterProduct.trackStock && stockFilterProduct.stock !== undefined
                              ? stockFilterProduct.stock === 0
                                ? 'text-red-600'
                                : stockFilterProduct.stock < 10
                                ? 'text-yellow-600'
                                : 'text-emerald-600'
                              : 'text-gray-400'
                          }`}>
                            {stockFilterProduct.trackStock && stockFilterProduct.stock !== undefined 
                              ? (stockFilterProduct.stock || 0) 
                              : '-'}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Fiyat</p>
                          <p className="text-2xl font-bold text-gray-900">{stockFilterProduct.price.toFixed(2)} ₺</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleStockTracking(stockFilterProduct.id, stockFilterProduct.trackStock)}
                      className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2 ${
                        stockFilterProduct.trackStock
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {stockFilterProduct.trackStock ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Takip Açık</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Takip Kapalı</span>
                        </>
                      )}
                    </button>
                  </div>
                  {stockFilterProduct.trackStock ? (
                    <div className="bg-white rounded-lg p-5 border border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-4 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Stok Güncelle</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            İşlem Tipi
                          </label>
                          <select
                            value={stockAdjustmentType}
                            onChange={(e) => setStockAdjustmentType(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white transition-all"
                          >
                            <option value="add">➕ Stok Ekle</option>
                            <option value="subtract">➖ Stok Çıkar</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Miktar
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={stockAdjustmentAmount}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setStockAdjustmentAmount(val);
                            }}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white transition-all"
                            placeholder="Miktar girin"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handleStockAdjustment}
                            className={`w-full px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center space-x-2 ${
                              stockAdjustmentType === 'add'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {stockAdjustmentType === 'add' ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Ekle</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                                <span>Çıkar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Bu ürün için stok takibi yapılmıyor. Stok takibini açmak için yukarıdaki butona tıklayın.</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Ürün Listesi */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-1">Ürün Stokları</h4>
                    <p className="text-sm text-gray-500">
                      {stockFilterCategory 
                        ? `${stockFilterCategory.name} kategorisindeki ürünler`
                        : 'Tüm ürünler'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span>Yeterli</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span>Az</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span>Tükendi</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto scrollbar-custom">
                  {(stockFilterCategory 
                    ? products.filter(p => p.category_id === stockFilterCategory.id)
                    : products
                  ).map(product => {
                    const category = categories.find(c => c.id === product.category_id);
                    const trackStock = product.trackStock === true;
                    const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
                    const stockStatus = trackStock && stock !== null
                      ? stock === 0 
                        ? { color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Tükendi' }
                        : stock < 10 
                        ? { color: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Az Stok' }
                        : { color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Yeterli' }
                      : { color: 'gray', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', label: 'Takip Yok' };
                    
                    return (
                      <div
                        key={product.id}
                        className={`bg-white rounded-xl p-4 border-2 ${stockStatus.border} hover:shadow-md transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                                <span className="text-2xl">📦</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-900">{product.name}</h4>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stockStatus.bg} ${stockStatus.text}`}>
                                  {stockStatus.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mb-2">{category?.name || 'Kategori yok'}</p>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">Fiyat:</span>
                                  <span className="text-base font-bold text-gray-900">{product.price.toFixed(2)} ₺</span>
                                </div>
                                {trackStock && stock !== null && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-500">Stok:</span>
                                    <span className={`text-base font-bold ${stockStatus.text}`}>
                                      {stock} adet
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <button
                              onClick={() => {
                                setStockFilterCategory(category || null);
                                setStockFilterProduct(product);
                                setStockAdjustmentAmount('');
                                setStockAdjustmentType('add');
                                setTimeout(() => {
                                  document.querySelector('[data-stock-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                              }}
                              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Güncelle</span>
                            </button>
                            <button
                              onClick={() => handleToggleStockTracking(product.id, trackStock)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md flex items-center justify-center space-x-1 ${
                                trackStock
                                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              {trackStock ? (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Kapat</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Aç</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Entegrasyon Ayarları</h3>
                <p className="text-sm text-gray-500">Trendyol ve Yemeksepeti API entegrasyonlarını yapılandırın</p>
              </div>

              {/* Trendyol Entegrasyonu */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">T</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Trendyol Entegrasyonu</h4>
                      <p className="text-sm text-gray-500">Trendyol siparişlerini otomatik olarak alın</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integrationSettings.trendyol.enabled}
                      onChange={(e) => {
                        setIntegrationSettings(prev => ({
                          ...prev,
                          trendyol: { ...prev.trendyol, enabled: e.target.checked }
                        }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>

                {integrationSettings.trendyol.enabled && (
                  <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.trendyol.apiKey}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            trendyol: { ...prev.trendyol, apiKey: e.target.value }
                          }));
                        }}
                        placeholder="Trendyol API Key'inizi girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Secret <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={integrationSettings.trendyol.apiSecret}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            trendyol: { ...prev.trendyol, apiSecret: e.target.value }
                          }));
                        }}
                        placeholder="Trendyol API Secret'ınızı girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Supplier ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.trendyol.supplierId}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            trendyol: { ...prev.trendyol, supplierId: e.target.value }
                          }));
                        }}
                        placeholder="Trendyol Supplier ID'nizi girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.trendyol.webhookUrl}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            trendyol: { ...prev.trendyol, webhookUrl: e.target.value }
                          }));
                        }}
                        placeholder="Webhook URL (otomatik oluşturulur)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                        readOnly
                      />
                      <p className="text-xs text-gray-500 mt-1">Bu URL'yi Trendyol panelinde webhook olarak ayarlayın</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => testConnection('trendyol')}
                        disabled={isTestingConnection.trendyol || !integrationSettings.trendyol.apiKey || !integrationSettings.trendyol.apiSecret}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {isTestingConnection.trendyol ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Test Ediliyor...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Bağlantıyı Test Et</span>
                          </>
                        )}
                      </button>
                      {connectionStatus.trendyol === 'success' && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium">Bağlantı Başarılı</span>
                        </div>
                      )}
                      {connectionStatus.trendyol === 'error' && (
                        <div className="flex items-center gap-2 text-red-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm font-medium">Bağlantı Hatası</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Yemeksepeti Entegrasyonu */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">Y</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Yemeksepeti Entegrasyonu</h4>
                      <p className="text-sm text-gray-500">Yemeksepeti siparişlerini otomatik olarak alın</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integrationSettings.yemeksepeti.enabled}
                      onChange={(e) => {
                        setIntegrationSettings(prev => ({
                          ...prev,
                          yemeksepeti: { ...prev.yemeksepeti, enabled: e.target.checked }
                        }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>

                {integrationSettings.yemeksepeti.enabled && (
                  <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.yemeksepeti.apiKey}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            yemeksepeti: { ...prev.yemeksepeti, apiKey: e.target.value }
                          }));
                        }}
                        placeholder="Yemeksepeti API Key'inizi girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Secret <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={integrationSettings.yemeksepeti.apiSecret}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            yemeksepeti: { ...prev.yemeksepeti, apiSecret: e.target.value }
                          }));
                        }}
                        placeholder="Yemeksepeti API Secret'ınızı girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Restaurant ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.yemeksepeti.restaurantId}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            yemeksepeti: { ...prev.yemeksepeti, restaurantId: e.target.value }
                          }));
                        }}
                        placeholder="Yemeksepeti Restaurant ID'nizi girin"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL
                      </label>
                      <input
                        type="text"
                        value={integrationSettings.yemeksepeti.webhookUrl}
                        onChange={(e) => {
                          setIntegrationSettings(prev => ({
                            ...prev,
                            yemeksepeti: { ...prev.yemeksepeti, webhookUrl: e.target.value }
                          }));
                        }}
                        placeholder="Webhook URL (otomatik oluşturulur)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                        readOnly
                      />
                      <p className="text-xs text-gray-500 mt-1">Bu URL'yi Yemeksepeti panelinde webhook olarak ayarlayın</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => testConnection('yemeksepeti')}
                        disabled={isTestingConnection.yemeksepeti || !integrationSettings.yemeksepeti.apiKey || !integrationSettings.yemeksepeti.apiSecret}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {isTestingConnection.yemeksepeti ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Test Ediliyor...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Bağlantıyı Test Et</span>
                          </>
                        )}
                      </button>
                      {connectionStatus.yemeksepeti === 'success' && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium">Bağlantı Başarılı</span>
                        </div>
                      )}
                      {connectionStatus.yemeksepeti === 'error' && (
                        <div className="flex items-center gap-2 text-red-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm font-medium">Bağlantı Hatası</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Kaydet Butonu */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={saveIntegrationSettings}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ayarları Kaydet</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'printers' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Yazıcı Yönetimi</h3>
              
              {/* Sub Tabs */}
              <div className="flex space-x-3 mb-6">
                <button
                  onClick={() => setPrinterSubTab('usb')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    printerSubTab === 'usb'
                            ? 'bg-pink-500 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-pink-50 border border-gray-300'
                  }`}
                >
                  🔌 USB ile Bağlı Yazıcılar
                </button>
                <button
                  onClick={() => setPrinterSubTab('network')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    printerSubTab === 'network'
                            ? 'bg-pink-500 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-pink-50 border border-gray-300'
                  }`}
                >
                  🌐 Ethernet Yazıcılar
                </button>
              </div>

              {/* Printer List */}
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-custom">
                {(printerSubTab === 'usb' ? printers.usb : printers.network).map((printer) => {
                  // Bir yazıcı birden fazla kategoriye atanabilir
                  const assignments = printerAssignments.filter(
                    a => a.printerName === printer.name && a.printerType === printerSubTab
                  );
                  // Tip uyumluluğu için number'a çevir
                  const assignedCategories = assignments
                    .map(a => {
                      const categoryIdNum = Number(a.category_id);
                      return categories.find(c => Number(c.id) === categoryIdNum);
                    })
                    .filter(c => c !== undefined);
                  
                  const isCashierPrinter = cashierPrinter && 
                    cashierPrinter.printerName === printer.name && 
                    cashierPrinter.printerType === printerSubTab;

                  return (
                    <div
                      key={printer.name}
                      className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isCashierPrinter 
                              ? 'bg-emerald-600' 
                              : 'bg-pink-100'
                          }`}>
                            <svg className={`w-6 h-6 ${isCashierPrinter ? 'text-white' : 'text-pink-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-800">{printer.displayName || printer.name}</h4>
                              {isCashierPrinter && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold">
                                  💰 KASA YAZICISI
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{printer.description || 'Açıklama yok'}</p>
                            {assignedCategories.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {assignedCategories.map(category => (
                                  <span key={category.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-medium">
                                    📋 {category.name}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCategoryAssignment(category.id);
                                      }}
                                      className="hover:bg-purple-200 rounded px-1 transition-colors"
                                      title="Kategori atamasını kaldır"
                                    >
                                      ✕
                                    </button>
                                </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 mt-1">Kategori atanmamış</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSetCashierPrinter(printer.name, printerSubTab)}
                          className={`flex-1 px-4 py-2 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md ${
                            isCashierPrinter
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isCashierPrinter ? '💰 Kasa Yazıcısını Kaldır' : '💰 Kasa Yazıcısı Seç'}
                        </button>
                        <button
                          onClick={() => handleAssignCategory(printer.name, printerSubTab)}
                          className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                        >
                          Kategori Ata
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {(printerSubTab === 'usb' ? printers.usb : printers.network).length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <p className="text-gray-500 font-medium">
                      {printerSubTab === 'usb' ? 'USB' : 'Ethernet'} yazıcı bulunamadı
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Yazıcılarınızı kontrol edin</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Category Assignment Modal */}
      {showCategoryAssignModal && selectedPrinter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl transform animate-scale-in relative overflow-hidden border border-gray-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-rose-400"></div>
            
            <button
              onClick={() => {
                setShowCategoryAssignModal(false);
                setSelectedPrinter(null);
                setAssigningCategory(null);
                setSelectedCategories([]);
              }}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Kategori Ata</h3>
              <p className="text-gray-600 mb-2">
                <span className="font-semibold text-pink-600">{selectedPrinter.name}</span>
              </p>
              <p className="text-sm text-gray-500">Bu yazıcıya birden fazla kategori seçebilirsiniz</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategorileri Seçin (Çoklu Seçim)
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-custom">
                  {categories.map(category => {
                    // Tip uyumluluğu için number'a çevir
                    const categoryIdNum = Number(category.id);
                    
                    // Bu kategoriye zaten bir yazıcı atanmış mı kontrol et
                    const existingAssignment = printerAssignments.find(a => {
                      const assignmentCategoryId = Number(a.category_id);
                      return assignmentCategoryId === categoryIdNum;
                    });
                    
                    const isAssignedToThisPrinter = existingAssignment && 
                      existingAssignment.printerName === selectedPrinter.name && 
                      existingAssignment.printerType === selectedPrinter.type;
                    const isAssignedToOtherPrinter = existingAssignment && !isAssignedToThisPrinter;
                    const isSelected = selectedCategories.includes(categoryIdNum);
                    
                    return (
                      <div
                        key={category.id}
                        onClick={() => {
                          if (!isAssignedToOtherPrinter) {
                            toggleCategorySelection(categoryIdNum);
                          }
                        }}
                        className={`w-full px-4 py-3 rounded-lg text-left transition-all cursor-pointer ${
                          isSelected
                        ? 'bg-pink-500 text-white'
                            : isAssignedToThisPrinter
                            ? 'bg-pink-100 text-pink-800 border border-pink-300'
                            : isAssignedToOtherPrinter
                            ? 'bg-yellow-50 text-yellow-800 border border-yellow-300 cursor-not-allowed opacity-60'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (!isAssignedToOtherPrinter) {
                                  toggleCategorySelection(categoryIdNum);
                                }
                              }}
                              disabled={isAssignedToOtherPrinter}
                              className="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="font-medium">{category.name}</span>
                    </div>
                          {isAssignedToThisPrinter && !isSelected && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                              Bu yazıcıya atanmış
                            </span>
                          )}
                          {isAssignedToOtherPrinter && (
                            <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                              {existingAssignment.printerName} yazıcısına atanmış
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Bir kategoriye sadece bir yazıcı atanabilir. Başka yazıcıya atanmış kategoriler seçilemez.
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCategoryAssignModal(false);
                    setSelectedPrinter(null);
                    setAssigningCategory(null);
                    setSelectedCategories([]);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                >
                  İptal
                  </button>
                    <button
                  onClick={confirmCategoryAssignment}
                  disabled={assigningCategory}
                  className="flex-1 px-4 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningCategory ? 'Atanıyor...' : 'Kategorileri Ata'}
                    </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl transform animate-scale-in relative overflow-hidden border border-gray-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-600"></div>
            
            <button
              onClick={() => {
                setShowAddCategoryModal(false);
                setNewCategoryName('');
                setCategoryError('');
              }}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Yeni Kategori Ekle</h3>
              <p className="text-gray-600">Yeni bir ürün kategorisi oluşturun</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Adı
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setCategoryError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCategory();
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-all"
                  placeholder="Kategori adını girin"
                  autoFocus
                />
              </div>

              {categoryError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {categoryError}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                    setCategoryError('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all transform hover:scale-105"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddCategory}
                  className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Ekle</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl transform animate-scale-in relative overflow-hidden border border-gray-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-rose-400"></div>
            
            <button
              onClick={() => {
                setShowEditCategoryModal(false);
                setEditingCategory(null);
                setNewCategoryName('');
                setCategoryError('');
              }}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Kategori Düzenle</h3>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold text-pink-600">{editingCategory.name}</span> kategorisinin adını değiştirin
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Adı
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setCategoryError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateCategory();
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                  placeholder="Kategori adını girin"
                  autoFocus
                />
              </div>

              {categoryError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {categoryError}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowEditCategoryModal(false);
                    setEditingCategory(null);
                    setNewCategoryName('');
                    setCategoryError('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all transform hover:scale-105"
                >
                  İptal
                </button>
                <button
                  onClick={handleUpdateCategory}
                  className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Güncelle</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform animate-scale-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-pink-500 to-red-500"></div>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Ürünü Sil</h3>
              <p className="text-gray-600 mb-4">
                <span className="font-semibold text-purple-600">{deleteConfirmModal.productName}</span> adlı ürünü silmek istediğinize emin misiniz?
              </p>
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                ⚠️ Bu işlem geri alınamaz!
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all transform hover:scale-105"
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Sil</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firebase Image Selection Modal */}
      {showFirebaseImageModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl transform animate-scale-in relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-rose-400"></div>
            
            <button
              onClick={() => {
                setShowFirebaseImageModal(false);
                setFirebaseImages([]);
              }}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Firebase'den Görsel Seç</h3>
              <p className="text-gray-600">Firebase'de kayıtlı görsellerden birini seçin</p>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-custom mb-6">
              {isLoadingFirebaseImages ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
                  <p className="mt-4 text-gray-600">Görseller yükleniyor...</p>
                </div>
              ) : firebaseImages.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 font-medium">Firebase'de görsel bulunamadı</p>
                  <p className="text-sm text-gray-400 mt-2">Firebase'de görsel eklemek için URL girebilirsiniz</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {firebaseImages.map((image) => (
                    <div
                      key={image.id}
                      onClick={() => {
                        setProductForm({ ...productForm, image: image.url });
                        setShowFirebaseImageModal(false);
                        setFirebaseImages([]);
                      }}
                      className="bg-white rounded-xl border-2 border-gray-200 hover:border-pink-500 cursor-pointer transition-all hover:shadow-lg overflow-hidden group"
                    >
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        <img
                          src={image.url}
                          alt={image.product_name || 'Görsel'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400">Görsel yüklenemedi</div>';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all"></div>
                      </div>
                      <div className="p-3">
                        {image.product_name && (
                          <p className="text-sm font-semibold text-gray-800 truncate">{image.product_name}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate mt-1">{image.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowFirebaseImageModal(false);
                  setFirebaseImages([]);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {deleteCategoryModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform animate-scale-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-pink-500 to-red-500"></div>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Kategoriyi Sil</h3>
              <p className="text-gray-600 mb-4">
                <span className="font-semibold text-purple-600">{deleteCategoryModal.categoryName}</span> kategorisini silmek istediğinizden emin misiniz?
              </p>
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                ⚠️ Bu işlem geri alınamaz! Kategorideki tüm ürünler de silinecektir.
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setDeleteCategoryModal(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all transform hover:scale-105"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteCategory}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Sil</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </>
  );

  if (isPage) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="p-6 flex-1 overflow-y-auto scrollbar-custom">
          {content}
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[999] animate-fade-in px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-6xl max-h-[90vh] shadow-xl transform animate-scale-in relative overflow-hidden flex flex-col border border-gray-200">
        {content}
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;

