import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CategoryPanel from './components/CategoryPanel';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import PaymentModal from './components/PaymentModal';

function App() {
  const [currentView, setCurrentView] = useState('pos'); // 'pos' or 'sales'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadCategories();
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
      // Başarı mesajı göster
      alert('Satış başarıyla tamamlandı! ✅');
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1e] via-[#1a1a2e] to-[#16213e] text-white">
      <Navbar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        totalItems={getTotalItems()}
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
          <div className="w-[420px] bg-gradient-to-b from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-l border-white/10 p-6">
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
    </div>
  );
}

export default App;

