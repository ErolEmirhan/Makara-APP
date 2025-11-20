import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CategoryPanel from './components/CategoryPanel';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import PaymentModal from './components/PaymentModal';
import RoleSplash from './components/RoleSplash';
import SaleSuccessToast from './components/SaleSuccessToast';
import SplashScreen from './components/SplashScreen';
import UpdateModal from './components/UpdateModal';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('pos'); // 'pos' or 'sales'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userType, setUserType] = useState('Admin'); // 'Admin' or 'Personel'
  const [activeRoleSplash, setActiveRoleSplash] = useState(null);
  const [saleSuccessInfo, setSaleSuccessInfo] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(null);
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

  const clearCart = () => {
    setCart([]);
  };

  const handlePayment = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const completeSale = async (paymentMethod) => {
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const saleData = {
      items: cart,
      totalAmount,
      paymentMethod
    };

    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowPaymentModal(false);
      clearCart();
      setSaleSuccessInfo({ totalAmount, paymentMethod });
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-[#e0e7ff] to-[#fce7f3] text-gray-800">
        <Navbar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        totalItems={getTotalItems()}
        userType={userType}
        setUserType={setUserType}
        onRoleSplash={triggerRoleSplash}
        onProductsUpdated={refreshProducts}
      />
      
      {currentView === 'pos' ? (
        <div className="flex h-[calc(100vh-80px)]">
          {/* Sol Panel - Kategoriler ve Ürünler */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
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
              totalAmount={getTotalAmount()}
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

      {activeRoleSplash && <RoleSplash role={activeRoleSplash} />}
      <SaleSuccessToast
        info={saleSuccessInfo}
        onClose={() => setSaleSuccessInfo(null)}
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

