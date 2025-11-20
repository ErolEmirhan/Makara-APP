import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SettingsModal = ({ onClose, onProductsUpdated }) => {
  const [activeTab, setActiveTab] = useState('password'); // 'password' or 'products'
  
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
  }, []);

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
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    const price = parseFloat(productForm.price);
    if (isNaN(price) || price <= 0) {
      alert('Geçerli bir fiyat girin');
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
      alert('Ürün kaydedilemedi: ' + error.message);
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
      await window.electronAPI.deleteProduct(deleteConfirmModal.productId);
      loadAllProducts();
      
      // Ana uygulamayı yenile
      if (onProductsUpdated) {
        onProductsUpdated();
      }
      
      setDeleteConfirmModal(null);
    } catch (error) {
      alert('Ürün silinemedi: ' + error.message);
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
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setProductForm({ name: '', category_id: selectedCategory?.id || '', price: '', image: '' });
  };

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory.id)
    : products;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[999] animate-fade-in px-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-6xl max-h-[90vh] shadow-2xl transform animate-scale-in relative overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
      
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:rotate-90"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Ayarlar</h2>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-3 font-medium transition-all ${
              activeTab === 'password'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔐 Parola Değiştirme
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 font-medium transition-all ${
              activeTab === 'products'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Ürün Yönetimi
          </button>
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-all"
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-all"
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-all"
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
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Parolayı Değiştir
                </button>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Product Form */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
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
                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none"
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
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                          productForm.category_id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        } focus:border-purple-500 focus:outline-none`}
                      >
                        <span className={productForm.category_id ? 'text-purple-700 font-medium' : 'text-gray-500'}>
                          {productForm.category_id
                            ? categories.find(c => c.id === parseInt(productForm.category_id))?.name || 'Kategori Seçin'
                            : 'Kategori Seçin'}
                        </span>
                        <svg 
                          className={`w-5 h-5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''} ${
                            productForm.category_id ? 'text-purple-600' : 'text-gray-400'
                          }`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showCategoryDropdown && (
                        <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-purple-200 overflow-hidden max-h-60 overflow-y-auto">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setProductForm({ ...productForm, category_id: cat.id.toString() });
                                setShowCategoryDropdown(false);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-purple-50 transition-all flex items-center space-x-3 ${
                                productForm.category_id === cat.id.toString()
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : 'text-gray-700'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full ${
                                productForm.category_id === cat.id.toString()
                                  ? 'bg-white'
                                  : 'bg-purple-500'
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
                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Görseli (Opsiyonel)
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={productForm.image}
                          readOnly
                          className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 bg-gray-50"
                          placeholder="Görsel seçilmedi"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.electronAPI || typeof window.electronAPI.selectImageFile !== 'function') {
                              alert('Dosya seçimi özelliği yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
                              return;
                            }
                            
                            try {
                              const result = await window.electronAPI.selectImageFile();
                              if (result.success && result.path) {
                                setProductForm({ ...productForm, image: result.path });
                              } else if (!result.canceled) {
                                alert('Dosya seçilemedi: ' + (result.error || 'Bilinmeyen hata'));
                              }
                            } catch (error) {
                              alert('Dosya seçme hatası: ' + error.message);
                            }
                          }}
                          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all whitespace-nowrap"
                        >
                          📁 Dosya Seç
                        </button>
                        {productForm.image && (
                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, image: '' })}
                            className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {productForm.image && (
                        <div className="mt-2">
                          <img 
                            src={productForm.image} 
                            alt="Önizleme" 
                            className="w-24 h-24 object-cover rounded-lg border-2 border-purple-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
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
                  <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-2xl p-4 border-2 border-purple-200 shadow-lg">
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
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
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
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                            selectedCategory?.id === cat.id
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
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
                      ))}
                    </div>
                    {selectedCategory && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold text-purple-600">{selectedCategory.name}</span> kategorisinde
                          </span>
                          <span className="text-sm font-bold text-purple-600">
                            {filteredProducts.length} ürün
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto scrollbar-custom">
                  {filteredProducts.map(product => {
                    const category = categories.find(c => c.id === product.category_id);
                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                              <span className="text-2xl">📦</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{product.name}</h4>
                            <p className="text-sm text-gray-500">{category?.name || 'Kategori yok'}</p>
                            <p className="text-lg font-bold text-purple-600">{product.price.toFixed(2)} ₺</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                          >
                            ✏️ Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                          >
                            🗑️ Sil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
    </div>,
    document.body
  );
};

export default SettingsModal;

