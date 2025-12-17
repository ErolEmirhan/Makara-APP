import React, { useState, useEffect, useRef, useMemo } from 'react';
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
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('pos'); // 'pos', 'sales', or 'tables'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Tüm kategorilerden ürünler (arama için)
  const [selectedCategory, setSelectedCategory] = useState(null);
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
  const searchInputRef = useRef(null);
  const triggerRoleSplash = (role) => {
    setActiveRoleSplash(role);
    setTimeout(() => setActiveRoleSplash(null), 1300);
  };

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
    }
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadProducts(selectedCategory.id);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    const cats = await window.electronAPI.getCategories();
    setCategories(cats);
    // Tüm ürünleri yükle (arama için)
    const allProds = await window.electronAPI.getProducts(null);
    setAllProducts(allProds);
    if (cats.length > 0) {
      setSelectedCategory(cats[0]);
    }
  };

  const loadProducts = async (categoryId) => {
    const prods = await window.electronAPI.getProducts(categoryId);
    setProducts(prods);
    // Tüm ürünleri de güncelle (arama için)
    const allProds = await window.electronAPI.getProducts(null);
    setAllProducts(allProds);
  };

  // Arama sorgusuna göre ürünleri filtrele
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      // Arama yoksa sadece seçili kategorinin ürünlerini göster
      return products;
    }
    // Arama varsa tüm kategorilerden ara
    const query = searchQuery.toLowerCase().trim();
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(query)
    );
  }, [products, allProducts, searchQuery]);

  const refreshProducts = async () => {
    // Kategorileri yenile
    const cats = await window.electronAPI.getCategories();
    setCategories(cats);
    
    // Tüm ürünleri güncelle (arama için)
    const allProds = await window.electronAPI.getProducts(null);
    setAllProducts(allProds);
    
    // Seçili kategoriyi koru veya ilk kategoriyi seç
    let categoryToLoad = selectedCategory;
    if (cats.length > 0) {
      if (!categoryToLoad || !cats.find(c => c.id === categoryToLoad.id)) {
        categoryToLoad = cats[0];
        setSelectedCategory(cats[0]);
      } else {
        // Mevcut kategoriyi güncelle (order_index değişmiş olabilir)
        const updatedCategory = cats.find(c => c.id === categoryToLoad.id);
        if (updatedCategory) {
          setSelectedCategory(updatedCategory);
          categoryToLoad = updatedCategory;
        }
      }
      
      // Seçili kategorinin ürünlerini yenile
      if (categoryToLoad) {
        const prods = await window.electronAPI.getProducts(categoryToLoad.id);
        setProducts(prods);
      }
    }
  };

  const addToCart = (product) => {
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
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const toggleGift = (productId) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, isGift: !item.isGift } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setOrderNote('');
    setSelectedTable(null); // Sepet temizlendiğinde masa seçimini de temizle
  };

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
      alert('Hata: Adisyon yazdırma API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
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
      alert('Hata: Masa siparişi API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
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
          // Adisyon yazdırmayı arka planda yap, hata olsa bile devam et
          window.electronAPI.printAdisyon(adisyonData).catch(err => {
            console.error('Adisyon yazdırılırken hata:', err);
          });
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
      alert('Masa siparişi kaydedilemedi: ' + error.message);
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
    // Masrafı normal satış gibi Firebase Sales'e kaydet
    const saleData = {
      items: [{
        id: 'expense-' + Date.now(),
        name: expenseData.title,
        price: expenseData.amount,
        quantity: 1,
        isExpense: true // Masraf olduğunu belirt
      }],
      totalAmount: expenseData.amount,
      paymentMethod: 'Masraf',
      orderNote: null,
      isExpense: true // Satış değil, masraf
    };

    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setSaleSuccessInfo({ 
        totalAmount: expenseData.amount, 
        paymentMethod: 'Masraf',
        expenseTitle: expenseData.title
      });
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
      />
      
      {currentView === 'tables' ? (
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
            <CategoryPanel
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(category) => {
                setSelectedCategory(category);
                setSearchQuery(''); // Kategori değiştiğinde aramayı temizle
              }}
            />
            
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
        />
      )}

      {showSplitPaymentModal && (
        <SplitPaymentModal
          cart={cart}
          totalAmount={getTotalAmount()}
          onCompleteSplitPayment={completeSplitPayment}
          onClose={() => setShowSplitPaymentModal(false)}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSave={handleSaveExpense}
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
      </div>
    </>
  );
}

export default App;

