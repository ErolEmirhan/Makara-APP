import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CategoryPanel from './components/CategoryPanel';
import TablePanel from './components/TablePanel';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import PaymentModal from './components/PaymentModal';
import SplitPaymentModal from './components/SplitPaymentModal';
import ReceiptModal from './components/ReceiptModal';
import RoleSplash from './components/RoleSplash';
import SaleSuccessToast from './components/SaleSuccessToast';
import PrintToast from './components/PrintToast';
import SplashScreen from './components/SplashScreen';
import ExitSplash from './components/ExitSplash';
import UpdateModal from './components/UpdateModal';
import VirtualKeyboard from './components/VirtualKeyboard';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';

function App() {
  const virtualKeyboardHook = useVirtualKeyboard();
  const activeInput = virtualKeyboardHook?.activeInput || null;
  const keyboardVisible = virtualKeyboardHook?.keyboardVisible || false;
  const closeKeyboard = virtualKeyboardHook?.closeKeyboard || (() => {});
  const handleInput = virtualKeyboardHook?.handleInput || (() => {});
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('pos'); // 'pos', 'sales', or 'tables'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
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
  const triggerRoleSplash = (role) => {
    setActiveRoleSplash(role);
    setTimeout(() => setActiveRoleSplash(null), 1000);
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
    if (cats.length > 0) {
      setSelectedCategory(cats[0]);
    }
  };

  const loadProducts = async (categoryId) => {
    const prods = await window.electronAPI.getProducts(categoryId);
    setProducts(prods);
  };

  const refreshProducts = async () => {
    // Kategorileri yenile
    const cats = await window.electronAPI.getCategories();
    setCategories(cats);
    
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
        await loadProducts(categoryToLoad.id);
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
      sale_time: new Date().toLocaleTimeString('tr-TR')
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
        // Adisyon yazdır (masaya kaydet'te de)
        const adisyonData = {
          items: cart,
          tableName: selectedTable.name,
          tableType: selectedTable.type,
          orderNote: orderNote || null,
          sale_date: new Date().toLocaleDateString('tr-TR'),
          sale_time: new Date().toLocaleTimeString('tr-TR')
        };
        
        if (window.electronAPI && window.electronAPI.printAdisyon) {
          // Adisyon yazdırmayı arka planda yap, hata olsa bile devam et
          window.electronAPI.printAdisyon(adisyonData).catch(err => {
            console.error('Adisyon yazdırılırken hata:', err);
          });
        }
        
        // Masa siparişi fişi için receiptData oluştur
        const tableReceiptData = {
          order_id: result.orderId,
          totalAmount,
          paymentMethod: `Masaya Kaydedildi (${selectedTable.name})`,
          sale_date: new Date().toLocaleDateString('tr-TR'),
          sale_time: new Date().toLocaleTimeString('tr-TR'),
          items: cart,
          tableName: selectedTable.name,
          tableType: selectedTable.type,
          orderNote: orderNote || null
        };
        
        // Fiş modal'ını göster
        setReceiptData(tableReceiptData);
        setShowReceiptModal(true);
        
        clearCart();
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
      setReceiptData({
        sale_id: result.saleId,
        totalAmount,
        paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null
      });
      setShowReceiptModal(true);
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
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {selectedTable && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg flex items-center justify-between">
                <p className="text-lg font-semibold">
                  Masa: {selectedTable.name} için sipariş oluşturuyorsunuz
                </p>
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    clearCart();
                  }}
                  className="ml-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Masa seçimini iptal et"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <CategoryPanel
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <ProductGrid
              products={products}
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

      {showReceiptModal && receiptData && (
        <ReceiptModal
          saleInfo={receiptData}
          items={receiptData.items}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
          }}
          onPrint={async () => {
            // Modal'ı hemen kapat
            setShowReceiptModal(false);
            setReceiptData(null);
            
            // Yazdırma toast'ını göster
            setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
            
            if (window.electronAPI && window.electronAPI.printReceipt) {
              try {
                // Yazdırma işlemini başlat (arka planda ama sonucu bekle)
                await window.electronAPI.printReceipt(receiptData);
                
                // Yazdırma işlemi tamamlandı - başarılı say
                setPrintToast({ 
                  status: 'success', 
                  message: 'Yazdırma Başarılı' 
                });
              } catch (err) {
                // Sadece gerçek hata durumunda error göster
                setPrintToast({ 
                  status: 'error', 
                  message: err.message || 'Yazdırma hatası oluştu' 
                });
              }
            } else {
              // Fallback: window.print()
              window.print();
              setPrintToast({ 
                status: 'success', 
                message: 'Yazdırma Başarılı' 
              });
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

      {/* Virtual Keyboard */}
      {keyboardVisible && (
        <VirtualKeyboard
          targetInput={activeInput}
          onClose={closeKeyboard}
          onInput={handleInput}
        />
      )}
      </div>
    </>
  );
}

export default App;

