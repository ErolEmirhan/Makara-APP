import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import orderSound from './sound/order.mp3';
import Navbar from './components/Navbar';
import CategoryPanel from './components/CategoryPanel';
import TablePanel from './components/TablePanel';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import PaymentModal from './components/PaymentModal';
import SplitPaymentModal from './components/SplitPaymentModal';
import RoleSplash from './components/RoleSplash';
import SaleSuccessToast from './components/SaleSuccessToast';
import PrintToast from './components/PrintToast';
import SplashScreen from './components/SplashScreen';
import ExitSplash from './components/ExitSplash';
import UpdateModal from './components/UpdateModal';
import ExpenseModal from './components/ExpenseModal';
import YanUrunlerManagementModal from './components/YanUrunlerManagementModal';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('pos'); // 'pos', 'sales', or 'tables'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Tüm kategorilerden ürünler (arama için)
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [yanUrunler, setYanUrunler] = useState([]); // Yan Ürünler listesi
  const [showYanUrunlerModal, setShowYanUrunlerModal] = useState(false); // Yan Ürünler yönetim modalı
  const YAN_URUNLER_CATEGORY_ID = -999; // Özel kategori ID'si
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null); // Masa seçimi
  const [userType, setUserType] = useState('Personel'); // 'Admin' or 'Personel'
  const [activeRoleSplash, setActiveRoleSplash] = useState(null);
  const [saleSuccessInfo, setSaleSuccessInfo] = useState(null);
  const [printToast, setPrintToast] = useState(null); // { status: 'printing' | 'success' | 'error', message: string }
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(null);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [showExitSplash, setShowExitSplash] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isCompletingSplitPayment, setIsCompletingSplitPayment] = useState(false);
  const [isSubmittingTableOrder, setIsSubmittingTableOrder] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const searchInputRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };
  const triggerRoleSplash = (role) => {
    setActiveRoleSplash(role);
    setTimeout(() => setActiveRoleSplash(null), 1300);
  };

  const [broadcastMessage, setBroadcastMessage] = useState(null);

  useEffect(() => {
    loadCategories();
    
    // Update event listeners
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo({ ...info, downloaded: false });
      });
      
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateInfo({ ...info, downloaded: true });
      });
      
      window.electronAPI.onUpdateError((error) => {
        console.error('Update error:', error);
        // Hata durumunda modal'ı kapat
        setUpdateInfo(null);
      });
      
      window.electronAPI.onUpdateProgress((progress) => {
        setUpdateDownloadProgress(progress);
      });

      // Broadcast message listener
      if (window.electronAPI.onBroadcastMessage) {
        const cleanup = window.electronAPI.onBroadcastMessage((data) => {
          setBroadcastMessage(data);
        });
        return cleanup;
      }
    }
  }, []);

  // Online sipariş düştüğünde ses çal (hangi ekranda olursak olalım)
  useEffect(() => {
    const onlineFirebaseConfig = {
      apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
      authDomain: "makaraonline-5464e.firebaseapp.com",
      projectId: "makaraonline-5464e",
      storageBucket: "makaraonline-5464e.firebasestorage.app",
      messagingSenderId: "1041589485836",
      appId: "1:1041589485836:web:06119973a19da0a14f0929",
      measurementId: "G-MKPPB635ZZ"
    };
    let unsubscribe;
    try {
      let app;
      try { app = getApp('onlineOrders'); } catch { app = initializeApp(onlineFirebaseConfig, 'onlineOrders'); }
      const db = getFirestore(app);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('status', '==', 'pending'));
      const prevIdsRef = { current: new Set() };
      let isFirstLoad = true;
      unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = new Set();
        snapshot.forEach((d) => ids.add(d.id));
        if (isFirstLoad) {
          isFirstLoad = false;
          prevIdsRef.current = ids;
          return;
        }
        const added = [...ids].filter((id) => !prevIdsRef.current.has(id));
        if (added.length > 0) {
          if (localStorage.getItem('onlineOrderSoundMuted') === 'true') return;
          try {
            const a = new Audio(orderSound);
            a.volume = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('onlineOrderSoundVolume') || '1')));
            a.play().catch(() => {});
          } catch (_) {}
        }
        prevIdsRef.current = ids;
      });
    } catch (e) {
      console.error('Online sipariş sesi listener başlatılamadı:', e);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Online sipariş: her gün 12:30 aktif, 23:30 pasif (otomatik)
  useEffect(() => {
    const onlineFirebaseConfig = {
      apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
      authDomain: "makaraonline-5464e.firebaseapp.com",
      projectId: "makaraonline-5464e",
      storageBucket: "makaraonline-5464e.firebasestorage.app",
      messagingSenderId: "1041589485836",
      appId: "1:1041589485836:web:06119973a19da0a14f0929",
      measurementId: "G-MKPPB635ZZ"
    };
    let activeRef;
    try {
      let app;
      try { app = getApp('onlineOrders'); } catch { app = initializeApp(onlineFirebaseConfig, 'onlineOrders'); }
      const db = getFirestore(app);
      activeRef = doc(db, 'active', 'dGRsJ5V5lgHcpRMXwDm2');
    } catch (e) {
      console.error('Online otomatik saat başlatılamadı:', e);
      return;
    }
    const run = () => {
      const now = new Date();
      const today = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0');
      const h = now.getHours();
      const m = now.getMinutes();
      if (h === 12 && m === 30 && localStorage.getItem('lastAutoOnlineActivate') !== today) {
        setDoc(activeRef, { is_active: true }, { merge: true }).then(() => {
          localStorage.setItem('lastAutoOnlineActivate', today);
        }).catch((e) => console.error('12:30 aktif yapılamadı:', e));
      }
      if (h === 23 && m === 30 && localStorage.getItem('lastAutoOnlinePassive') !== today) {
        setDoc(activeRef, { is_active: false }, { merge: true }).then(() => {
          localStorage.setItem('lastAutoOnlinePassive', today);
        }).catch((e) => console.error('23:30 pasif yapılamadı:', e));
      }
    };
    run();
    const id = setInterval(run, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // PERFORMANS: useCallback ile fonksiyonları memoize et
  const loadCategories = useCallback(async () => {
    const cats = await window.electronAPI.getCategories();
    const yanUrunlerCategory = {
      id: YAN_URUNLER_CATEGORY_ID,
      name: 'Yan Ürünler',
      order_index: 9999
    };
    setCategories([...cats, yanUrunlerCategory]);
    
    if (window.electronAPI && window.electronAPI.getYanUrunler) {
      const yanUrunlerList = await window.electronAPI.getYanUrunler();
      setYanUrunler(yanUrunlerList);
    }
    
    // Tüm ürünleri sadece ilk yüklemede çek (arama için)
    const allProds = await window.electronAPI.getProducts(null);
    setAllProducts(allProds);
    if (cats.length > 0) {
      setSelectedCategory(cats[0]);
    }
  }, []);

  const loadProducts = useCallback(async (categoryId) => {
    // Yan Ürünler kategorisi seçildiyse
    if (categoryId === YAN_URUNLER_CATEGORY_ID) {
      if (window.electronAPI && window.electronAPI.getYanUrunler) {
        const yanUrunlerList = await window.electronAPI.getYanUrunler();
        const formattedYanUrunler = yanUrunlerList.map(urun => ({
          id: `yan_urun_${urun.id}`,
          name: urun.name,
          price: urun.price,
          category_id: YAN_URUNLER_CATEGORY_ID,
          isYanUrun: true
        }));
        setProducts(formattedYanUrunler);
      }
      return;
    }
    
    const prods = await window.electronAPI.getProducts(categoryId);
    setProducts(prods);
  }, []);

  // useEffect - loadProducts tanımından sonra olmalı
  useEffect(() => {
    if (selectedCategory) {
      loadProducts(selectedCategory.id);
    }
  }, [selectedCategory, loadProducts]);

  // Arama sorgusuna göre ürünleri filtrele
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      // Arama yoksa sadece seçili kategorinin ürünlerini göster
      return products;
    }
    // Arama varsa tüm kategorilerden ara (yan ürünler dahil)
    const query = searchQuery.toLowerCase().trim();
    const allProductsWithYanUrunler = [
      ...allProducts,
      ...yanUrunler.map(urun => ({
        id: `yan_urun_${urun.id}`,
        name: urun.name,
        price: urun.price,
        category_id: YAN_URUNLER_CATEGORY_ID,
        isYanUrun: true
      }))
    ];
    return allProductsWithYanUrunler.filter(product => 
      product.name.toLowerCase().includes(query)
    );
  }, [products, allProducts, searchQuery, yanUrunler]);

  const refreshProducts = async () => {
    // Kategorileri yenile
    const cats = await window.electronAPI.getCategories();
    // Yan Ürünler kategorisini ekle
    const yanUrunlerCategory = {
      id: YAN_URUNLER_CATEGORY_ID,
      name: 'Yan Ürünler',
      order_index: 9999
    };
    setCategories([...cats, yanUrunlerCategory]);
    
    // Yan ürünleri yenile
    if (window.electronAPI && window.electronAPI.getYanUrunler) {
      const yanUrunlerList = await window.electronAPI.getYanUrunler();
      setYanUrunler(yanUrunlerList);
    }
    
    // Tüm ürünleri güncelle (arama için)
    const allProds = await window.electronAPI.getProducts(null);
    setAllProducts(allProds);
    
    // Seçili kategoriyi koru veya ilk kategoriyi seç
    let categoryToLoad = selectedCategory;
    const allCategories = [...cats, yanUrunlerCategory];
    if (allCategories.length > 0) {
      if (!categoryToLoad || !allCategories.find(c => c.id === categoryToLoad.id)) {
        categoryToLoad = allCategories[0];
        setSelectedCategory(allCategories[0]);
      } else {
        // Mevcut kategoriyi güncelle (order_index değişmiş olabilir)
        const updatedCategory = allCategories.find(c => c.id === categoryToLoad.id);
        if (updatedCategory) {
          setSelectedCategory(updatedCategory);
          categoryToLoad = updatedCategory;
        }
      }
      
      // Seçili kategorinin ürünlerini yenile
      if (categoryToLoad) {
        await loadProducts(categoryToLoad.id);
      }
    }
  };

  // PERFORMANS: useCallback ile memoize et
  const addToCart = useCallback((product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  }, []);

  const updateCartItemQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  }, [removeFromCart]);

  const toggleGift = useCallback((productId) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, isGift: !item.isGift } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setOrderNote('');
    setSelectedTable(null);
  }, []);

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setCurrentView('pos'); // Masa seçildiğinde pos view'a geç
    // İlk kategoriyi yükle
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  };

  const requestAdisyon = async () => {
    if (cart.length === 0 || !selectedTable) return;
    
    if (!window.electronAPI || !window.electronAPI.printAdisyon) {
      console.error('printAdisyon API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      showToast('Hata: Adisyon yazdırma API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }
    
    const adisyonData = {
      items: cart,
      tableName: selectedTable.name,
      tableType: selectedTable.type,
      orderNote: orderNote || null,
      sale_date: new Date().toLocaleDateString('tr-TR'),
      sale_time: new Date().toLocaleTimeString('tr-TR'),
      cashierOnly: true // Sadece kasa yazıcısından fiyatlı fiş
    };

    try {
      // Adisyon yazdırma toast'ını göster
      setPrintToast({ status: 'printing', message: 'Adisyon yazdırılıyor...' });
      
      const result = await window.electronAPI.printAdisyon(adisyonData);
      
      if (result.success) {
        setPrintToast({ 
          status: 'success', 
          message: 'Adisyon başarıyla yazdırıldı' 
        });
      } else {
        setPrintToast({ 
          status: 'error', 
          message: result.error || 'Adisyon yazdırılamadı' 
        });
      }
    } catch (error) {
      console.error('Adisyon yazdırılırken hata:', error);
      setPrintToast({ 
        status: 'error', 
        message: 'Adisyon yazdırılamadı: ' + error.message 
      });
    }
  };

  const completeTableOrder = async () => {
    if (cart.length === 0 || !selectedTable) return;
    
    if (!window.electronAPI || !window.electronAPI.createTableOrder) {
      console.error('createTableOrder API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      showToast('Hata: Masa siparişi API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }
    
    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    const orderData = {
      items: cart,
      totalAmount,
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      tableType: selectedTable.type,
      orderNote: orderNote || null
    };

    setIsSubmittingTableOrder(true);
    try {
      const result = await window.electronAPI.createTableOrder(orderData);
      
      if (result.success) {
        // Yeni sipariş mi yoksa mevcut siparişe ekleme mi?
        if (!result.isNewOrder) {
          console.log('📦 Mevcut siparişe eklendi:', result.orderId);
        } else {
          console.log('✨ Yeni sipariş oluşturuldu:', result.orderId);
        }
        // Sadece kategori bazlı yazıcılardan adisyon yazdır (kasa yazıcısından adisyon çıkmasın)
        // Her sipariş için o anın tarih/saatini kullan
        const now = new Date();
        const currentDate = now.toLocaleDateString('tr-TR');
        const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Items'lara added_time ve added_date ekle (masaüstünden eklenen ürünler için staff_name null olacak)
        const itemsWithTime = cart.map(item => ({
          ...item,
          staff_name: null, // Masaüstünden eklenen ürünler için personel bilgisi yok
          added_date: currentDate,
          added_time: currentTime
        }));
        
        const adisyonData = {
          items: itemsWithTime,
          tableName: selectedTable.name,
          tableType: selectedTable.type,
          orderNote: orderNote || null,
          sale_date: currentDate,
          sale_time: currentTime
        };
        
        if (window.electronAPI && window.electronAPI.printAdisyon) {
          setPrintToast({ status: 'printing', message: 'Kategori fişleri yazdırılıyor...' });
          let printResult = await window.electronAPI.printAdisyon(adisyonData);
          if (!printResult?.success) {
            setPrintToast({ status: 'error', message: 'Fiş yazdırılamadı, tekrar deneniyor...' });
            await new Promise(r => setTimeout(r, 1500));
            printResult = await window.electronAPI.printAdisyon(adisyonData);
          }
          if (printResult?.success) {
            setPrintToast({ status: 'success', message: 'Fişler yazdırıldı' });
          } else {
            setPrintToast({ status: 'error', message: printResult?.error || 'Fiş yazdırılamadı. Satış geçmişinden tekrar yazdırabilirsiniz.' });
          }
        }
        
        // Kasadan masaya sipariş eklendiğinde kasa yazıcısından fiş yazdırma (sadece adisyon yeterli)
        
        // Sepeti temizle
        setCart([]);
        setOrderNote('');
        
        // Mevcut siparişe ekleme durumunda masa seçimini koru, yeni sipariş durumunda temizle
        if (result.isNewOrder) {
          setSelectedTable(null);
        }
        // Mevcut siparişe eklendiyse masa seçili kalır, böylece tekrar ürün eklenebilir
        
        setSaleSuccessInfo({ 
          totalAmount, 
          paymentMethod: 'Masaya Kaydedildi',
          tableName: selectedTable.name
        });
        // Masalar görünümünü yenile
        setTableRefreshTrigger(Date.now());
      }
    } catch (error) {
      console.error('Masa siparişi kaydedilirken hata:', error);
      showToast('Masa siparişi kaydedilemedi: ' + error.message, 'error');
    } finally {
      setIsSubmittingTableOrder(false);
    }
  };

  const handlePayment = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const completeSale = async (paymentMethod) => {
    if (paymentMethod === 'split') {
      // Ayrı ödemeler modal'ını aç
      setShowPaymentModal(false);
      setShowSplitPaymentModal(true);
      return;
    }

    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    const saleData = {
      items: cart,
      totalAmount,
      paymentMethod,
      orderNote: orderNote || null
    };

    setIsCompletingSale(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowPaymentModal(false);
      
      // Kasa yazıcısından satış fişi yazdır (sadece kasa yazıcısına)
      const receiptData = {
        sale_id: result.saleId,
        totalAmount,
        paymentMethod,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null,
        cashierOnly: true // Sadece kasa yazıcısına yazdır
      };
      
      if (window.electronAPI && window.electronAPI.printReceipt) {
        setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
        window.electronAPI.printReceipt(receiptData).then(result => {
          if (result.success) {
            setPrintToast({ status: 'success', message: 'Fiş başarıyla yazdırıldı' });
          } else {
            setPrintToast({ status: 'error', message: result.error || 'Fiş yazdırılamadı' });
          }
        }).catch(err => {
          console.error('Fiş yazdırılırken hata:', err);
          setPrintToast({ status: 'error', message: 'Fiş yazdırılamadı: ' + err.message });
        });
      }
      
      // Kategori bazlı yazıcılardan adisyon yazdır
      const adisyonData = {
        items: cart,
        tableName: null, // Hızlı satış için masa yok
        tableType: null,
        orderNote: orderNote || null,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR')
      };
      
      if (window.electronAPI && window.electronAPI.printAdisyon) {
        // Arka planda yazdır, hata olsa bile devam et
        window.electronAPI.printAdisyon(adisyonData).catch(err => {
          console.error('Adisyon yazdırılırken hata:', err);
        });
      }
      
      // Fiş modal'ını göster
      setReceiptData({
        sale_id: result.saleId,
        totalAmount,
        paymentMethod,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null
      });
      setShowReceiptModal(true);
      const currentNote = orderNote;
      clearCart();
      setSaleSuccessInfo({ totalAmount, paymentMethod });
    }
    } finally {
      setIsCompletingSale(false);
    }
  };

  const completeSplitPayment = async (payments) => {
    // Parçalı ödeme için tek bir satış oluştur (tüm ürünler bir arada)
    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    // Ödeme yöntemlerini birleştir (örn: "Nakit + Kredi Kartı")
    const paymentMethods = [...new Set(payments.map(p => p.method))];
    const paymentMethodString = paymentMethods.join(' + ');

    // Ödeme detaylarını string olarak oluştur
    const paymentDetails = payments.map(p => `${p.method}: ₺${p.amount.toFixed(2)}`).join(', ');

    const saleData = {
      items: cart,
      totalAmount,
      paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
      orderNote: orderNote || null
    };

    setIsCompletingSplitPayment(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowSplitPaymentModal(false);
      // Fiş modal'ını göster
      const receiptData = {
        sale_id: result.saleId,
        totalAmount,
        paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null
      };
      
      // Kasa yazıcısından satış fişi yazdır (sadece kasa yazıcısına)
      if (window.electronAPI && window.electronAPI.printReceipt) {
        setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
        window.electronAPI.printReceipt({
          ...receiptData,
          cashierOnly: true // Sadece kasa yazıcısına yazdır
        }).then(result => {
          if (result.success) {
            setPrintToast({ status: 'success', message: 'Fiş başarıyla yazdırıldı' });
          } else {
            setPrintToast({ status: 'error', message: result.error || 'Fiş yazdırılamadı' });
          }
        }).catch(err => {
          console.error('Fiş yazdırılırken hata:', err);
          setPrintToast({ status: 'error', message: 'Fiş yazdırılamadı: ' + err.message });
        });
      }
      
      // Kategori bazlı yazıcılardan adisyon yazdır
      const adisyonData = {
        items: cart,
        tableName: null, // Hızlı satış için masa yok
        tableType: null,
        orderNote: orderNote || null,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR')
      };
      
      if (window.electronAPI && window.electronAPI.printAdisyon) {
        // Arka planda yazdır, hata olsa bile devam et
        window.electronAPI.printAdisyon(adisyonData).catch(err => {
          console.error('Adisyon yazdırılırken hata:', err);
        });
      }
      
      clearCart();
      setSaleSuccessInfo({ 
        totalAmount, 
        paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
        splitPayment: true
      });
    }
    } finally {
      setIsCompletingSplitPayment(false);
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleExit = () => {
    setShowExitSplash(true);
  };

  const handleExitComplete = async () => {
    // Veritabanını kaydet ve uygulamayı kapat
    if (window.electronAPI && window.electronAPI.quitApp) {
      await window.electronAPI.quitApp();
    } else {
      // Fallback
      window.close();
    }
  };

  const handleSaveExpense = async (expenseData) => {
    const saleData = {
      items: [{
        id: 'expense-' + Date.now(),
        name: expenseData.title,
        price: expenseData.amount,
        quantity: 1,
        isExpense: true
      }],
      totalAmount: expenseData.amount,
      paymentMethod: 'Masraf',
      orderNote: null,
      isExpense: true
    };

    setIsSavingExpense(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowExpenseModal(false);
      setSaleSuccessInfo({ 
        totalAmount: expenseData.amount, 
        paymentMethod: 'Masraf',
        expenseTitle: expenseData.title
      });
    }
    } finally {
      setIsSavingExpense(false);
    }
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}

      {showExitSplash && (
        <ExitSplash onComplete={handleExitComplete} />
      )}
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-[#e0e7ff] to-[#fce7f3] text-gray-800">
        <Navbar 
        currentView={currentView} 
        setCurrentView={(view) => {
          setCurrentView(view);
          // Masalar görünümüne geçildiğinde seçili masayı temizle
          if (view === 'tables') {
            setSelectedTable(null);
            clearCart();
          }
        }}
        totalItems={getTotalItems()}
        userType={userType}
        setUserType={setUserType}
        onRoleSplash={triggerRoleSplash}
        onProductsUpdated={refreshProducts}
        onExit={handleExit}
        onOpenSettings={() => setCurrentView('settings')}
      />
      
      {currentView === 'settings' ? (
        <div className="h-[calc(100vh-80px)] overflow-hidden bg-white">
          <SettingsModal
            variant="page"
            onClose={() => setCurrentView('pos')}
            onProductsUpdated={refreshProducts}
          />
        </div>
      ) : currentView === 'tables' ? (
        <div className="p-6">
          <TablePanel 
            onSelectTable={handleTableSelect}
            refreshTrigger={tableRefreshTrigger}
            onShowReceipt={(receiptData) => {
              setReceiptData(receiptData);
              setShowReceiptModal(true);
            }}
          />
        </div>
      ) : currentView === 'pos' ? (
        <div className="flex h-[calc(100vh-80px)]">
          {/* Sol Panel - Kategoriler ve Ürünler */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {selectedTable && (
              <div className="mb-3 p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg flex items-center justify-between">
                <p className="text-base font-semibold">
                  Masa: {selectedTable.name} için sipariş oluşturuyorsunuz
                </p>
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    clearCart();
                  }}
                  className="ml-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Masa seçimini iptal et"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div>
              <CategoryPanel
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setSearchQuery(''); // Kategori değiştiğinde aramayı temizle
                }}
              />
              {/* Yan Ürünler Yönetim Butonu - Sadece Yan Ürünler kategorisi seçildiğinde */}
              {selectedCategory && selectedCategory.id === YAN_URUNLER_CATEGORY_ID && userType === 'Admin' && (
                <div className="mt-3 mb-3">
                  <button
                    onClick={() => setShowYanUrunlerModal(true)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Yan Ürünler Yönetimi</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Arama Çubuğu ve (sadece Admin için) Masraf Ekle Butonu */}
            <div className="mb-3 flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ürün ara..."
                  className="w-full px-3 py-2 pl-10 bg-white/90 backdrop-blur-xl border-2 border-purple-200 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 font-medium placeholder-gray-400 transition-all duration-200 text-sm"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (searchInputRef.current) {
                        searchInputRef.current.focus();
                      }
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {userType === 'Admin' && (
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Masraf Ekle</span>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mb-3 text-xs text-gray-600 font-medium">
                {filteredProducts.length > 0 
                  ? `${filteredProducts.length} ürün bulundu` 
                  : 'Ürün bulunamadı'}
              </p>
            )}
            
            <ProductGrid
              products={filteredProducts}
              onAddToCart={addToCart}
            />
          </div>

          {/* Sağ Panel - Sepet */}
          <div className="w-[420px] bg-gradient-to-b from-purple-50/80 to-pink-50/80 backdrop-blur-xl border-l border-purple-200 p-6">
            <Cart
              cart={cart}
              onUpdateQuantity={updateCartItemQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              onCheckout={handlePayment}
              onSaveToTable={completeTableOrder}
              isSavingToTable={isSubmittingTableOrder}
              onRequestAdisyon={requestAdisyon}
              totalAmount={getTotalAmount()}
              selectedTable={selectedTable}
              orderNote={orderNote}
              onOrderNoteChange={setOrderNote}
              onToggleGift={toggleGift}
            />
          </div>
        </div>
      ) : (
        <div className="p-6">
          <SalesHistory />
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          totalAmount={getTotalAmount()}
          onSelectPayment={completeSale}
          onClose={() => setShowPaymentModal(false)}
          isSubmitting={isCompletingSale}
        />
      )}

      {showSplitPaymentModal && (
        <SplitPaymentModal
          cart={cart}
          totalAmount={getTotalAmount()}
          onCompleteSplitPayment={completeSplitPayment}
          onClose={() => setShowSplitPaymentModal(false)}
          isSubmitting={isCompletingSplitPayment}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSave={handleSaveExpense}
          isSubmitting={isSavingExpense}
        />
      )}

      {/* Yan Ürünler Yönetim Modal */}
      {showYanUrunlerModal && (
        <YanUrunlerManagementModal
          yanUrunler={yanUrunler}
          onClose={() => {
            setShowYanUrunlerModal(false);
            loadCategories(); // Yan ürünleri yenile
          }}
          onRefresh={async () => {
            if (window.electronAPI && window.electronAPI.getYanUrunler) {
              const yanUrunlerList = await window.electronAPI.getYanUrunler();
              setYanUrunler(yanUrunlerList);
              // Eğer Yan Ürünler kategorisi seçiliyse ürünleri yenile
              if (selectedCategory && selectedCategory.id === YAN_URUNLER_CATEGORY_ID) {
                loadProducts(YAN_URUNLER_CATEGORY_ID);
              }
            }
          }}
        />
      )}

      {activeRoleSplash && <RoleSplash role={activeRoleSplash} />}
      <SaleSuccessToast
        info={saleSuccessInfo}
        onClose={() => setSaleSuccessInfo(null)}
      />
      <PrintToast
        status={printToast?.status}
        message={printToast?.message}
        onClose={() => setPrintToast(null)}
        autoHideDuration={printToast?.status === 'printing' ? null : 2500}
      />
      {updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          downloadProgress={updateDownloadProgress}
          onDownload={async () => {
            if (window.electronAPI) {
              await window.electronAPI.downloadUpdate();
            }
          }}
          onInstall={() => {
            if (window.electronAPI) {
              window.electronAPI.installUpdate();
            }
          }}
          onClose={() => {
            setUpdateInfo(null);
            setUpdateDownloadProgress(null);
          }}
        />
      )}

      {/* Minimize Button - Sol Alt Köşe */}
      <button
        onClick={() => {
          if (window.electronAPI && window.electronAPI.minimizeWindow) {
            window.electronAPI.minimizeWindow();
          }
        }}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-white/80 hover:bg-white border-2 border-purple-300 hover:border-purple-500 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Uygulamayı Arka Plana Al (Alt+Tab)"
      >
        <svg 
          className="w-5 h-5 text-purple-600 group-hover:text-purple-700 transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M19 9l-7 7-7-7" 
            transform="rotate(90 12 12)"
          />
        </svg>
      </button>

      {/* Broadcast Message Modal */}
      {broadcastMessage && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-4" 
          onClick={() => setBroadcastMessage(null)}
          style={{ animation: 'fadeIn 0.3s ease' }}
        >
          <div 
            className="bg-gradient-to-br from-white to-slate-50 rounded-[32px] max-w-md w-full shadow-2xl overflow-hidden relative border border-white/20" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset'
            }}
          >
            {/* Dekoratif arka plan efektleri */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-200/20 to-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-pink-200/20 to-purple-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            {/* Header */}
            <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white p-7 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                  <span className="text-3xl">📢</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white mb-1 tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    Yeni Mesaj
                  </h3>
                  <p className="text-sm font-medium text-white/95">Yönetimden bildirim</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="relative z-10 p-7">
              <div className="mb-5">
                <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-wrap tracking-wide">
                  {broadcastMessage.message}
                </p>
              </div>
              <div className="bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-slate-600">
                  {broadcastMessage.date} {broadcastMessage.time}
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="relative z-10 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 flex justify-center">
              <button
                onClick={() => setBroadcastMessage(null)}
                className="px-12 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-600 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 relative overflow-hidden group"
                style={{
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                  letterSpacing: '0.3px'
                }}
              >
                <span className="relative z-10">Anladım</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
          
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUpScale {
              from { transform: translateY(40px) scale(0.9); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
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
    </div>
    </>
  );
}

export default App;

