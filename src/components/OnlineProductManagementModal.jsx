import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, updateDoc, setDoc, getDocs, getDoc } from 'firebase/firestore';

const OnlineProductManagementModal = ({ onClose }) => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [firestore, setFirestore] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const contentRef = useRef(null);
  const isManualScrollRef = useRef(false);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0);
  const [savingMinAmount, setSavingMinAmount] = useState(false);
  const [bulkPriceAdd, setBulkPriceAdd] = useState('');
  const [savingBulkPrice, setSavingBulkPrice] = useState(false);
  const [categoryOutOfStock, setCategoryOutOfStock] = useState({});

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast({ message: '', type: 'info', show: false });
    }, 3000);
  };

  // Firebase bağlantısını başlat
  useEffect(() => {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
        authDomain: "makaraonline-5464e.firebaseapp.com",
        projectId: "makaraonline-5464e",
        storageBucket: "makaraonline-5464e.firebasestorage.app",
        messagingSenderId: "1041589485836",
        appId: "1:1041589485836:web:06119973a19da0a14f0929",
        measurementId: "G-MKPPB635ZZ"
      };

      const app = initializeApp(firebaseConfig, 'onlineProductManagement');
      const db = getFirestore(app);
      setFirestore(db);
    } catch (error) {
      console.error('Firebase başlatılamadı:', error);
      showToast('Firebase bağlantısı kurulamadı', 'error');
    }
  }, []);

  // Kategorileri ve ürünleri yükle
  useEffect(() => {
    if (firestore) {
      loadData();
      loadMinimumOrderAmount();
    }
  }, [firestore]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Kategorileri yükle
      const categoriesData = await window.electronAPI.getCategories();
      setCategories(categoriesData || []);

      // Tüm ürünleri yükle
      const productsData = await window.electronAPI.getProducts(null);
      
      // Firebase'den online fiyat ve tükendi bilgilerini çek
      if (firestore) {
        const productsWithOnlineData = await Promise.all(
          productsData.map(async (product) => {
            try {
              const productRef = doc(firestore, 'products', product.id.toString());
              const productDoc = await getDoc(productRef);
              
              if (productDoc.exists()) {
                const data = productDoc.data();
                return {
                  ...product,
                  online_price: data.online_price !== undefined ? data.online_price : product.price,
                  is_out_of_stock_online: data.is_out_of_stock_online || false
                };
              } else {
                return {
                  ...product,
                  online_price: product.price,
                  is_out_of_stock_online: false
                };
              }
            } catch (error) {
              console.error(`Ürün ${product.id} için Firebase verisi çekilemedi:`, error);
              return {
                ...product,
                online_price: product.price,
                is_out_of_stock_online: false
              };
            }
          })
        );
        
        setProducts(productsWithOnlineData);
      } else {
        setProducts(productsData.map(p => ({
          ...p,
          online_price: p.price,
          is_out_of_stock_online: false
        })));
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      showToast('Veriler yüklenemedi: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Minimum sepet tutarını yükle
  const loadMinimumOrderAmount = async () => {
    if (!firestore) return;

    try {
      const settingsRef = doc(firestore, 'settings', 'minimum_order_amount');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setMinimumOrderAmount(data.amount || 0);
      } else {
        setMinimumOrderAmount(0);
      }
    } catch (error) {
      console.error('Minimum sepet tutarı yüklenemedi:', error);
    }
  };

  // Minimum sepet tutarını güncelle
  const handleMinimumOrderAmountUpdate = async (newAmount) => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    setSavingMinAmount(true);
    try {
      const amount = parseFloat(newAmount) || 0;
      const settingsRef = doc(firestore, 'settings', 'minimum_order_amount');
      
      // Önce dokümanın var olup olmadığını kontrol et
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        // Doküman varsa güncelle
        await updateDoc(settingsRef, {
          amount: amount,
          updated_at: new Date().toISOString()
        });
      } else {
        // Doküman yoksa oluştur
        await setDoc(settingsRef, {
          amount: amount,
          updated_at: new Date().toISOString()
        });
      }

      setMinimumOrderAmount(amount);
      showToast(`Minimum sepet tutarı ${amount.toFixed(2)} ₺ olarak kaydedildi`, 'success');
    } catch (error) {
      console.error('Minimum sepet tutarı kaydedilemedi:', error);
      showToast('Minimum sepet tutarı kaydedilemedi: ' + error.message, 'error');
    } finally {
      setSavingMinAmount(false);
    }
  };

  // Online fiyatı güncelle
  const handlePriceUpdate = async (productId, newPrice) => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    try {
      const productRef = doc(firestore, 'products', productId.toString());
      const price = parseFloat(newPrice) || 0;
      
      // Sadece online_price alanını kaydet (ürün bilgileri başka Firebase'de)
      // setDoc ile merge: true kullan - doküman varsa günceller, yoksa oluşturur
      await setDoc(productRef, {
        id: productId,
        online_price: price
      }, { merge: true });

      // Local state'i güncelle
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, online_price: price } : p
        )
      );

      showToast('Online fiyat güncellendi', 'success');
    } catch (error) {
      console.error('Fiyat güncelleme hatası:', error);
      showToast('Fiyat güncellenemedi: ' + error.message, 'error');
    }
  };

  // Tükendi durumunu güncelle
  const handleStockToggle = async (productId, isOutOfStock) => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    try {
      const productRef = doc(firestore, 'products', productId.toString());
      
      // Sadece is_out_of_stock_online alanını kaydet (ürün bilgileri başka Firebase'de)
      // setDoc ile merge: true kullan - doküman varsa günceller, yoksa oluşturur
      await setDoc(productRef, {
        id: productId,
        is_out_of_stock_online: isOutOfStock
      }, { merge: true });

      // Local state'i güncelle
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, is_out_of_stock_online: isOutOfStock } : p
        )
      );

      showToast(isOutOfStock ? 'Ürün tükendi olarak işaretlendi' : 'Ürün mevcut olarak işaretlendi', 'success');
    } catch (error) {
      console.error('Stok durumu güncelleme hatası:', error);
      showToast('Stok durumu güncellenemedi: ' + error.message, 'error');
    }
  };

  // Tüm tükendileri kaldır
  const handleResetAll = async () => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    setSaving(true);
    try {
      // Önce Firebase'den tüm ürünleri kontrol et
      const productsRef = collection(firestore, 'products');
      const productsSnapshot = await getDocs(productsRef);
      
      // Firebase'de is_out_of_stock_online: true olan ürünleri bul
      const firebaseOutOfStockIds = new Set();
      productsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.is_out_of_stock_online === true) {
          firebaseOutOfStockIds.add(data.id?.toString() || docSnap.id);
        }
      });

      // Local state'teki tükendi ürünleri de ekle
      const localOutOfStockProducts = products.filter(p => p.is_out_of_stock_online);
      localOutOfStockProducts.forEach(p => {
        firebaseOutOfStockIds.add(p.id.toString());
      });

      // Tüm ürünleri (local state'teki) Firebase'e is_out_of_stock_online: false olarak kaydet
      // Bu şekilde hem Firebase'deki hem de local'deki tüm ürünler güncellenir
      const allProductIds = new Set([
        ...products.map(p => p.id.toString()),
        ...Array.from(firebaseOutOfStockIds)
      ]);

      if (allProductIds.size === 0) {
        showToast('Güncellenecek ürün bulunamadı', 'info');
        setShowResetConfirm(false);
        setSaving(false);
        return;
      }

      // Tüm ürünleri mevcut olarak işaretle
      const updatePromises = Array.from(allProductIds).map(productId => {
        const productRef = doc(firestore, 'products', productId);
        // setDoc ile merge: true kullan (doküman yoksa oluşturur)
        return setDoc(productRef, {
          id: parseInt(productId) || productId,
          is_out_of_stock_online: false
        }, { merge: true });
      });

      await Promise.all(updatePromises);

      // Local state'i güncelle - tüm ürünleri mevcut olarak işaretle
      setProducts(prevProducts =>
        prevProducts.map(p => ({ ...p, is_out_of_stock_online: false }))
      );

      showToast(`Tüm ürünler mevcut olarak işaretlendi (${allProductIds.size} ürün)`, 'success');
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Reset hatası:', error);
      showToast('Reset işlemi başarısız: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Kategorilere göre ürünleri grupla
  const productsByCategory = categories.map(category => ({
    category,
    products: products.filter(p => p.category_id === category.id)
  })).filter(group => group.products.length > 0);

  // Kategori tükendi durumunu yükle
  useEffect(() => {
    if (firestore && categories.length > 0) {
      loadCategoryStockStatus();
    }
  }, [firestore, categories]);

  const loadCategoryStockStatus = async () => {
    if (!firestore) return;
    
    try {
      const categoryStatus = {};
      
      // Her kategori için Firebase'den kontrol et
      await Promise.all(
        categories.map(async (category) => {
          try {
            const categoryRef = doc(firestore, 'categories', category.id.toString());
            const categoryDoc = await getDoc(categoryRef);
            
            if (categoryDoc.exists()) {
              const data = categoryDoc.data();
              categoryStatus[category.id] = data.is_out_of_stock_online || false;
            } else {
              categoryStatus[category.id] = false;
            }
          } catch (error) {
            console.error(`Kategori ${category.id} için stok durumu yüklenemedi:`, error);
            categoryStatus[category.id] = false;
          }
        })
      );
      
      setCategoryOutOfStock(categoryStatus);
    } catch (error) {
      console.error('Kategori stok durumu yüklenemedi:', error);
    }
  };

  // Tüm ürünlere fiyat ekle
  const handleBulkPriceAdd = async () => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    const addAmount = parseFloat(bulkPriceAdd);
    if (isNaN(addAmount) || addAmount === 0) {
      showToast('Lütfen geçerli bir fiyat giriniz', 'error');
      return;
    }

    setSavingBulkPrice(true);
    try {
      const updatePromises = products.map(async (product) => {
        const currentPrice = product.online_price || product.price;
        const newPrice = currentPrice + addAmount;
        
        const productRef = doc(firestore, 'products', product.id.toString());
        await setDoc(productRef, {
          id: product.id,
          online_price: newPrice
        }, { merge: true });
      });

      await Promise.all(updatePromises);

      // Local state'i güncelle
      setProducts(prevProducts =>
        prevProducts.map(p => ({
          ...p,
          online_price: (p.online_price || p.price) + addAmount
        }))
      );

      showToast(`Tüm ürünlere ${addAmount.toFixed(2)} ₺ eklendi`, 'success');
      setBulkPriceAdd('');
    } catch (error) {
      console.error('Toplu fiyat ekleme hatası:', error);
      showToast('Fiyatlar güncellenemedi: ' + error.message, 'error');
    } finally {
      setSavingBulkPrice(false);
    }
  };

  // Kategori tükendi durumunu güncelle
  const handleCategoryStockToggle = async (categoryId, isOutOfStock) => {
    if (!firestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    try {
      const categoryRef = doc(firestore, 'categories', categoryId.toString());
      await setDoc(categoryRef, {
        id: categoryId,
        is_out_of_stock_online: isOutOfStock
      }, { merge: true });

      // Local state'i güncelle
      setCategoryOutOfStock(prev => ({
        ...prev,
        [categoryId]: isOutOfStock
      }));

      // Kategorideki tüm ürünleri de güncelle
      const categoryProducts = products.filter(p => p.category_id === categoryId);
      const productUpdatePromises = categoryProducts.map(async (product) => {
        const productRef = doc(firestore, 'products', product.id.toString());
        await setDoc(productRef, {
          id: product.id,
          is_out_of_stock_online: isOutOfStock
        }, { merge: true });
      });

      await Promise.all(productUpdatePromises);

      // Local state'teki ürünleri güncelle
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.category_id === categoryId ? { ...p, is_out_of_stock_online: isOutOfStock } : p
        )
      );

      showToast(
        isOutOfStock 
          ? 'Kategori tükendi olarak işaretlendi' 
          : 'Kategori mevcut olarak işaretlendi', 
        'success'
      );
    } catch (error) {
      console.error('Kategori stok durumu güncelleme hatası:', error);
      showToast('Kategori stok durumu güncellenemedi: ' + error.message, 'error');
    }
  };

  // Kategoriye scroll yap
  const scrollToCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    isManualScrollRef.current = true;
    
    const element = document.getElementById(`category-${categoryId}`);
    if (element && contentRef.current) {
      const container = contentRef.current;
      const elementTop = element.offsetTop - container.offsetTop - 30; // 30px padding
      
      // Smooth scroll
      container.scrollTo({
        top: Math.max(0, elementTop),
        behavior: 'smooth'
      });

      // Scroll tamamlandıktan sonra manuel scroll flag'ini kaldır
      setTimeout(() => {
        isManualScrollRef.current = false;
      }, 1000);
    }
  };

  // İlk kategoriyi otomatik seç
  useEffect(() => {
    if (productsByCategory.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(productsByCategory[0].category.id);
    }
  }, [productsByCategory]);

  // Scroll sırasında görünür kategoriyi tespit et
  useEffect(() => {
    if (!contentRef.current || productsByCategory.length === 0) return;

    const handleScroll = () => {
      if (isManualScrollRef.current) return; // Manuel scroll sırasında tespit etme
      
      const container = contentRef.current;
      if (!container) return;

      const containerTop = container.scrollTop;
      const scrollPosition = containerTop + 150; // Offset

      // Hangi kategori görünür alanda?
      for (let i = productsByCategory.length - 1; i >= 0; i--) {
        const category = productsByCategory[i].category;
        const element = document.getElementById(`category-${category.id}`);
        if (element) {
          const elementTop = element.offsetTop - container.offsetTop;
          if (elementTop <= scrollPosition) {
            setSelectedCategoryId(prevId => {
              if (prevId !== category.id) {
                return category.id;
              }
              return prevId;
            });
            break;
          }
        }
      }
    };

    const container = contentRef.current;
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [productsByCategory]);

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in px-4 py-8">
      <div className="bg-white rounded-3xl w-full max-w-7xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] transform animate-scale-in relative overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
        {/* Premium Top Border */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600"></div>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all duration-200 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md z-10"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Header */}
        <div className="px-10 pt-10 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white">
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">Online Ürün Yönetimi</h3>
                <p className="text-sm text-gray-600 font-medium">Online siparişlere özel fiyat ve stok yönetimi</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Tüm Ürünlere Fiyat Ekle */}
              <div className="flex items-center space-x-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl px-4 py-2 shadow-sm">
                <input
                  type="number"
                  step="0.01"
                  value={bulkPriceAdd}
                  onChange={(e) => setBulkPriceAdd(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBulkPriceAdd();
                    }
                  }}
                  disabled={savingBulkPrice}
                  placeholder="Fiyat ekle"
                  className="w-24 px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none disabled:opacity-50 bg-transparent border-none"
                />
                <span className="text-xs font-semibold text-gray-600">₺</span>
                <button
                  onClick={handleBulkPriceAdd}
                  disabled={savingBulkPrice || !bulkPriceAdd}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {savingBulkPrice ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Kaydet</span>
                    </>
                  )}
                </button>
              </div>
              
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Minimum Sepet Tutarı Bar */}
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-t border-amber-200 -mx-10 px-10 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block">Minimum Sepet Tutarı</label>
                  <p className="text-xs text-gray-500">Müşteriler bu tutarın altında sipariş veremez</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-white rounded-xl px-4 py-2 border-2 border-amber-300 shadow-sm">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minimumOrderAmount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setMinimumOrderAmount(value);
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleMinimumOrderAmountUpdate(value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    disabled={savingMinAmount}
                    className="w-32 px-2 py-1 text-lg font-bold text-gray-900 focus:outline-none disabled:opacity-50"
                    placeholder="0.00"
                  />
                  <span className="text-sm font-semibold text-gray-600">₺</span>
                  {savingMinAmount && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Kategori Header Bar - Sabit */}
          {!loading && productsByCategory.length > 0 && (
            <div className="sticky top-0 z-20 bg-white border-t border-gray-200 -mx-10 px-10 pt-4 pb-4 shadow-sm">
              <style>{`
                .category-scroll-container::-webkit-scrollbar {
                  display: none;
                }
                .category-scroll-container {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
              `}</style>
              <div className="category-scroll-container flex items-center space-x-2 overflow-x-auto pb-2">
                {productsByCategory.map(({ category }) => (
                  <button
                    key={category.id}
                    onClick={() => scrollToCategory(category.id)}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-300 flex items-center space-x-2 ${
                      selectedCategoryId === category.id
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <span>{category.name}</span>
                    {selectedCategoryId === category.id && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-10 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
            </div>
          ) : productsByCategory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600 font-medium text-lg">Henüz ürün bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-8">
              {productsByCategory.map(({ category, products: categoryProducts }) => (
                <div 
                  key={category.id} 
                  id={`category-${category.id}`}
                  className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden scroll-mt-4"
                >
                  {/* Kategori Başlığı */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <h4 className="text-xl font-bold text-gray-900">{category.name}</h4>
                          {/* Kategori Tükendi Switch */}
                          <div className="flex items-center space-x-3">
                            <span className={`text-sm font-semibold ${categoryOutOfStock[category.id] ? 'text-red-600' : 'text-gray-600'}`}>
                              {categoryOutOfStock[category.id] ? 'Tükendi' : 'Mevcut'}
                            </span>
                            <button
                              onClick={() => handleCategoryStockToggle(category.id, !categoryOutOfStock[category.id])}
                              className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md ${
                                categoryOutOfStock[category.id]
                                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-500'
                              }`}
                            >
                              <span
                                className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform duration-200 shadow-lg ${
                                  categoryOutOfStock[category.id] ? 'translate-x-11' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{categoryProducts.length} ürün</p>
                      </div>
                    </div>
                  </div>

                  {/* Ürün Tablosu */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ürün Adı</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Normal Fiyat</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Online Fiyat</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Tükendi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {categoryProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                {product.image && (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="font-semibold text-gray-900">{product.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-600 font-medium">₺{product.price.toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={product.online_price || product.price}
                                  onChange={(e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    setProducts(prevProducts =>
                                      prevProducts.map(p =>
                                        p.id === product.id ? { ...p, online_price: newPrice } : p
                                      )
                                    );
                                  }}
                                  onBlur={(e) => {
                                    const newPrice = parseFloat(e.target.value) || product.price;
                                    handlePriceUpdate(product.id, newPrice);
                                  }}
                                  className="w-32 px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-semibold text-gray-900"
                                />
                                <span className="text-xs text-gray-500">₺</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => handleStockToggle(product.id, !product.is_out_of_stock_online)}
                                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                                    product.is_out_of_stock_online
                                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                                      product.is_out_of_stock_online ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                {product.is_out_of_stock_online && (
                                  <span className="ml-2 text-xs font-semibold text-red-600">Tükendi</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset Onay Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[3000]">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-200">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center border-2 border-orange-200">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="text-center mb-6">
                <h4 className="text-xl font-bold text-gray-900 mb-2">Tüm Ürünler Mevcut</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Tüm ürünlerin mevcut olarak işaretlenmesini onaylıyor musunuz? Bu işlem tüm tükendi durumlarını kaldıracak.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={saving}
                  className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl transition-all duration-200 border-2 border-gray-300 hover:border-gray-400 min-w-[120px] disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleResetAll}
                  disabled={saving}
                  className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-xl transition-all duration-200 shadow-md hover:shadow-lg min-w-[120px] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>İşleniyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Evet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast.show && (
          <div className="fixed inset-x-0 bottom-0 z-[3000] flex justify-center pointer-events-none pb-6">
            <div className={`bg-white/95 backdrop-blur-xl border-2 rounded-2xl shadow-2xl px-6 py-4 pointer-events-auto animate-fade-in max-w-md mx-4 ${
              toast.type === 'success' ? 'border-green-300' : 
              toast.type === 'error' ? 'border-red-300' : 
              'border-blue-300'
            }`}>
              <div className="flex items-center space-x-3">
                {toast.type === 'success' && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {toast.type === 'error' && (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <p className="text-sm font-semibold text-gray-900">{toast.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default OnlineProductManagementModal;
