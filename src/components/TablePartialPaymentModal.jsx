import React, { useState, useEffect } from 'react';
import Toast from './Toast';

const TablePartialPaymentModal = ({ order, items, totalAmount, onClose, onComplete }) => {
  const [itemsWithPayment, setItemsWithPayment] = useState([]);
  const [processingItemId, setProcessingItemId] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedQuantities, setSelectedQuantities] = useState({}); // { itemId: quantity }
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    // Items'ı ödeme durumuna göre hazırla
    const itemsData = items.map(item => ({
      ...item,
      isPaid: item.is_paid || false,
      paidQuantity: item.paid_quantity || 0,
      paymentMethod: item.payment_method || null
    }));
    setItemsWithPayment(itemsData);
  }, [items]);

  // Ürün için ödeme al
  const handlePayItem = async (item) => {
    if (!window.electronAPI || !window.electronAPI.payTableOrderItem) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    if (item.isPaid) {
      showToast('Bu ürünün ödemesi zaten alınmış', 'warning');
      return;
    }

    if (item.isGift) {
      showToast('İkram edilen ürünler için ödeme alınamaz', 'warning');
      return;
    }

    // Ödenmemiş miktarı hesapla
    const paidQuantity = item.paidQuantity || 0;
    const remainingQuantity = item.quantity - paidQuantity;
    
    // Miktar seçimi (eğer birden fazla adet varsa ve tamamı ödenmemişse)
    let quantityToPay = remainingQuantity;
    if (remainingQuantity > 1) {
      const selectedQuantity = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
        modal.innerHTML = `
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Kaç Adet İçin Ödeme Alınacak?</h3>
            <p class="text-sm text-gray-600 mb-4">${item.product_name}</p>
            <p class="text-xs text-gray-500 mb-4">Toplam: ${item.quantity} adet | Ödenen: ${paidQuantity} adet | Kalan: ${remainingQuantity} adet</p>
            <div class="mb-4">
              <label class="block text-sm font-semibold text-gray-700 mb-2">Ödenecek Adet:</label>
              <input 
                type="number" 
                id="quantityInput" 
                min="1" 
                max="${remainingQuantity}" 
                value="${remainingQuantity}" 
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:outline-none text-lg font-semibold text-center"
              />
            </div>
            <div class="flex space-x-3">
              <button id="cancelQtyBtn" class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
                İptal
              </button>
              <button id="confirmQtyBtn" class="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-bold transition-all">
                Devam Et
              </button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        const quantityInput = modal.querySelector('#quantityInput');
        
        modal.querySelector('#confirmQtyBtn').onclick = () => {
          const qty = parseInt(quantityInput.value) || 1;
          if (qty < 1 || qty > remainingQuantity) {
            showToast(`Lütfen 1 ile ${remainingQuantity} arasında bir değer girin!`, 'warning');
            return;
          }
          document.body.removeChild(modal);
          resolve(qty);
        };
        
        modal.querySelector('#cancelQtyBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(null);
        };
      });
      
      if (selectedQuantity === null) return;
      quantityToPay = selectedQuantity;
    }

    // Ödeme yöntemi seçimi için modal
    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
          <h3 class="text-xl font-bold text-gray-800 mb-4">Ödeme Yöntemi Seçin</h3>
          <p class="text-sm text-gray-600 mb-4">${item.product_name} (${quantityToPay} adet)</p>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <button id="cashBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl transition-all">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Nakit</span>
              </div>
            </button>
            <button id="cardBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Kredi Kartı</span>
              </div>
            </button>
          </div>
          <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
            İptal
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#cashBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Nakit');
      };
      
      modal.querySelector('#cardBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Kredi Kartı');
      };
      
      modal.querySelector('#cancelBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };
    });

    if (!paymentMethod) return;

    setProcessingItemId(item.id);

    try {
      const result = await window.electronAPI.payTableOrderItem(item.id, paymentMethod, quantityToPay);
      
      if (result.success) {
        // Item'ı güncelle
        const newPaidQuantity = (item.paidQuantity || 0) + quantityToPay;
        const isFullyPaid = newPaidQuantity >= item.quantity;
        
        setItemsWithPayment(prev => prev.map(i => 
          i.id === item.id 
            ? { 
                ...i, 
                isPaid: isFullyPaid,
                paidQuantity: newPaidQuantity,
                paymentMethod: i.paidQuantity > 0 ? `${i.paymentMethod || ''}, ${paymentMethod}` : paymentMethod
              }
            : i
        ));
        
        // onComplete callback'ini çağır (siparişleri yenilemek için)
        if (onComplete) {
          onComplete([{ itemId: item.id, paymentMethod, quantity: quantityToPay }]);
        }
      } else {
        showToast(result.error || 'Ödeme alınamadı', 'error');
      }
    } catch (error) {
      console.error('Ödeme hatası:', error);
      showToast('Ödeme alınırken bir hata oluştu', 'error');
    } finally {
      setProcessingItemId(null);
    }
  };

  // Checkbox toggle
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        // Miktarı da temizle
        setSelectedQuantities(prevQty => {
          const newQty = { ...prevQty };
          delete newQty[itemId];
          return newQty;
        });
      } else {
        newSet.add(itemId);
        // Varsayılan olarak kalan miktarın tamamını seç
        const item = itemsWithPayment.find(i => i.id === itemId);
        if (item) {
          const paidQty = item.paidQuantity || 0;
          const remainingQty = item.quantity - paidQty;
          setSelectedQuantities(prevQty => ({
            ...prevQty,
            [itemId]: remainingQty
          }));
        }
      }
      return newSet;
    });
  };

  // Miktar değiştir
  const updateQuantity = (itemId, quantity) => {
    const item = itemsWithPayment.find(i => i.id === itemId);
    if (!item) return;
    
    const paidQty = item.paidQuantity || 0;
    const remainingQty = item.quantity - paidQty;
    
    // Miktarı sınırla
    const validQuantity = Math.max(1, Math.min(quantity, remainingQty));
    
    setSelectedQuantities(prev => ({
      ...prev,
      [itemId]: validQuantity
    }));
  };

  // Tüm ödenmemiş ürünleri seç/kaldır
  const toggleSelectAll = () => {
    const unpaidItems = itemsWithPayment.filter(item => {
      if (item.isGift) return false;
      const paidQty = item.paidQuantity || 0;
      return paidQty < item.quantity;
    });
    
    const allUnpaidSelected = unpaidItems.every(item => selectedItems.has(item.id));
    
    if (allUnpaidSelected) {
      // Tümünü kaldır
      setSelectedItems(new Set());
      setSelectedQuantities({});
    } else {
      // Tümünü seç ve kalan miktarları ayarla
      const newQuantities = {};
      unpaidItems.forEach(item => {
        const paidQty = item.paidQuantity || 0;
        const remainingQty = item.quantity - paidQty;
        newQuantities[item.id] = remainingQty;
      });
      setSelectedItems(new Set(unpaidItems.map(item => item.id)));
      setSelectedQuantities(newQuantities);
    }
  };

  // Seçilen ürünlerin toplam tutarını hesapla
  const selectedItemsTotal = itemsWithPayment.reduce((sum, item) => {
    if (!selectedItems.has(item.id) || item.isGift) return sum;
    const selectedQty = selectedQuantities[item.id] || 0;
    return sum + (item.price * selectedQty);
  }, 0);

  // Toplu ödeme al
  const handleBulkPayment = async () => {
    if (selectedItems.size === 0) {
      showToast('Lütfen en az bir ürün seçin', 'warning');
      return;
    }

    // Ödeme yöntemi seçimi
    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
          <h3 class="text-xl font-bold text-gray-800 mb-2">Ödeme Yöntemi Seçin</h3>
          <p class="text-sm text-gray-600 mb-4">Seçilen ${selectedItems.size} ürün için toplam: ₺${selectedItemsTotal.toFixed(2)}</p>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <button id="cashBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl transition-all">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Nakit</span>
              </div>
            </button>
            <button id="cardBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Kredi Kartı</span>
              </div>
            </button>
          </div>
          <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
            İptal
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#cashBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Nakit');
      };
      
      modal.querySelector('#cardBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Kredi Kartı');
      };
      
      modal.querySelector('#cancelBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };
    });

    if (!paymentMethod) return;

    setIsProcessingBulk(true);

    try {
      const selectedItemsList = itemsWithPayment.filter(item => selectedItems.has(item.id));
      const paymentResults = [];

      // Her seçili ürün için ödeme al
      for (const item of selectedItemsList) {
        if (item.isGift) continue;
        
        const selectedQty = selectedQuantities[item.id] || 0;
        
        if (selectedQty <= 0) continue;

        // Miktar kontrolü
        const paidQty = item.paidQuantity || 0;
        const remainingQty = item.quantity - paidQty;
        
        if (selectedQty > remainingQty) {
          console.error(`Ürün ${item.product_name} için seçilen miktar (${selectedQty}) kalan miktardan (${remainingQty}) fazla`);
          continue;
        }

        try {
          const result = await window.electronAPI.payTableOrderItem(item.id, paymentMethod, selectedQty);
          
          if (result.success) {
            paymentResults.push({ itemId: item.id, paymentMethod, quantity: selectedQty });
            
            // Item'ı güncelle
            const newPaidQuantity = paidQty + selectedQty;
            const isFullyPaid = newPaidQuantity >= item.quantity;
            
            setItemsWithPayment(prev => prev.map(i => 
              i.id === item.id 
                ? { 
                    ...i, 
                    isPaid: isFullyPaid,
                    paidQuantity: newPaidQuantity,
                    paymentMethod: i.paidQuantity > 0 ? `${i.paymentMethod || ''}, ${paymentMethod}` : paymentMethod
                  }
                : i
            ));
          } else {
            console.error(`Ürün ${item.product_name} için ödeme alınamadı:`, result.error);
          }
        } catch (error) {
          console.error(`Ürün ${item.product_name} için ödeme hatası:`, error);
        }
      }

      // Seçimleri temizle
      setSelectedItems(new Set());
      setSelectedQuantities({});

      // onComplete callback'ini çağır
      if (onComplete && paymentResults.length > 0) {
        onComplete(paymentResults);
      }

      if (paymentResults.length > 0) {
        // Başarı mesajı
        showToast(`${paymentResults.length} ürün için ödeme başarıyla alındı!`, 'success');
      }
    } catch (error) {
      console.error('Toplu ödeme hatası:', error);
      showToast('Ödeme alınırken bir hata oluştu', 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Ödenmemiş ürünler (tamamı ödenmemiş olanlar)
  const unpaidItems = itemsWithPayment.filter(item => {
    if (item.isGift) return false;
    const paidQty = item.paidQuantity || 0;
    return paidQty < item.quantity;
  });
  // Ödenmiş ürünler (tamamı veya kısmen)
  const paidItems = itemsWithPayment.filter(item => {
    if (item.isGift) return false;
    return (item.paidQuantity || 0) > 0;
  });
  // Toplam ödenen tutar (ödenen miktarlar üzerinden)
  const paidAmount = itemsWithPayment.reduce((sum, item) => {
    if (item.isGift) return sum;
    const paidQty = item.paidQuantity || 0;
    return sum + (item.price * paidQty);
  }, 0);
  // Kalan tutar
  const remainingAmount = totalAmount - paidAmount;

  return (
    <>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-3xl p-8 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold gradient-text">Ürün Bazlı Ödeme</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Masa Bilgisi */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Masa</p>
          <p className="text-xl font-bold text-purple-600">{order.table_name}</p>
        </div>

        {/* Toplam ve Kalan Tutar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Toplam Tutar</p>
            <p className="text-2xl font-bold text-purple-600">
              ₺{totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
            <p className="text-sm text-gray-600 mb-1">Ödenen</p>
            <p className="text-2xl font-bold text-green-600">
              ₺{paidAmount.toFixed(2)}
            </p>
          </div>
          <div className={`rounded-2xl p-4 border ${
            remainingAmount > 0.01 
              ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' 
              : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
          }`}>
            <p className="text-sm text-gray-600 mb-1">Kalan</p>
            <p className={`text-2xl font-bold ${
              remainingAmount > 0.01 ? 'text-orange-600' : 'text-green-600'
            }`}>
              ₺{remainingAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Toplu Ödeme Seçimi */}
        {unpaidItems.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={unpaidItems.length > 0 && unpaidItems.every(item => selectedItems.has(item.id))}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-2 border-purple-500 text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer"
                />
                <label className="text-sm font-semibold text-gray-700 cursor-pointer" onClick={toggleSelectAll}>
                  Tümünü Seç / Kaldır
                </label>
              </div>
              {selectedItems.size > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-600 mb-1">Seçilen {selectedItems.size} ürün</p>
                  <p className="text-xl font-bold text-purple-600">₺{selectedItemsTotal.toFixed(2)}</p>
                </div>
              )}
            </div>
            {selectedItems.size > 0 && (
              <button
                onClick={handleBulkPayment}
                disabled={isProcessingBulk}
                className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                  isProcessingBulk
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {isProcessingBulk ? 'İşleniyor...' : `Seçilen Ürünlerin Ödemesini Al (₺${selectedItemsTotal.toFixed(2)})`}
              </button>
            )}
          </div>
        )}

        {/* Ürün Listesi */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-bold text-gray-800">Ürünler</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {itemsWithPayment.map((item) => {
              const itemTotal = item.price * item.quantity;
              const paidQty = item.paidQuantity || 0;
              const remainingQty = item.quantity - paidQty;
              const paidTotal = item.price * paidQty;
              const isProcessing = processingItemId === item.id;
              const isFullyPaid = item.isPaid || paidQty >= item.quantity;
              
              return (
                <div
                  key={item.id}
                  className={`rounded-xl p-4 border-2 transition-all ${
                    isFullyPaid
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                      : paidQty > 0
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300'
                      : item.isGift
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
                      : selectedItems.has(item.id)
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400'
                      : 'bg-white border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {!isFullyPaid && !item.isGift && (
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-5 h-5 rounded border-2 border-purple-500 text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer flex-shrink-0"
                          />
                        )}
                        {isFullyPaid && <div className="w-5 h-5"></div>}
                        {item.isGift && <div className="w-5 h-5"></div>}
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isFullyPaid
                            ? 'bg-green-500'
                            : paidQty > 0
                            ? 'bg-blue-500'
                            : item.isGift
                            ? 'bg-yellow-400'
                            : 'bg-purple-500'
                        }`}>
                          {isFullyPaid ? (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : paidQty > 0 ? (
                            <span className="text-white text-xs font-bold">{paidQty}/{item.quantity}</span>
                          ) : item.isGift ? (
                            <span className="text-white text-xl">🎁</span>
                          ) : (
                            <span className="text-white text-xl">📦</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold text-lg ${
                            isFullyPaid ? 'text-green-700 line-through' : item.isGift ? 'text-yellow-700' : 'text-gray-800'
                          }`}>
                            {item.product_name}
                            {item.isGift && <span className="ml-2 text-xs">(İKRAM)</span>}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-600">
                              {item.quantity} adet × ₺{item.price.toFixed(2)}
                              {paidQty > 0 && !isFullyPaid && (
                                <span className="ml-2 text-blue-600 font-semibold">
                                  (Ödenen: {paidQty} adet)
                                </span>
                              )}
                            </p>
                            <div className="text-right">
                              {isFullyPaid ? (
                                <p className="text-lg font-bold text-green-600 line-through">
                                  ₺{itemTotal.toFixed(2)}
                                </p>
                              ) : paidQty > 0 ? (
                                <div>
                                  <p className="text-xs text-gray-400 line-through">₺{itemTotal.toFixed(2)}</p>
                                  <p className="text-lg font-bold text-blue-600">₺{paidTotal.toFixed(2)} / ₺{itemTotal.toFixed(2)}</p>
                                </div>
                              ) : (
                                <p className="text-lg font-bold text-purple-600">
                                  ₺{itemTotal.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                          {paidQty > 0 && item.paymentMethod && (
                            <p className="text-xs text-blue-600 mt-1">
                              ✅ {paidQty} adet {item.paymentMethod} ile ödendi
                            </p>
                          )}
                          {/* Miktar Seçici - Sadece seçili ürünler için göster */}
                          {selectedItems.has(item.id) && remainingQty > 0 && (
                            <div className="mt-3 flex items-center space-x-3 bg-white rounded-lg p-2 border border-purple-200">
                              <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                                Ödenecek Adet:
                              </label>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateQuantity(item.id, (selectedQuantities[item.id] || remainingQty) - 1)}
                                  className="w-8 h-8 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-600 font-bold transition-all flex items-center justify-center"
                                  disabled={selectedQuantities[item.id] <= 1}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                  </svg>
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={remainingQty}
                                  value={selectedQuantities[item.id] || remainingQty}
                                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                  className="w-16 px-2 py-1 text-center border-2 border-purple-300 rounded-lg font-bold text-purple-600 focus:border-purple-500 focus:outline-none"
                                />
                                <button
                                  onClick={() => updateQuantity(item.id, (selectedQuantities[item.id] || remainingQty) + 1)}
                                  className="w-8 h-8 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-600 font-bold transition-all flex items-center justify-center"
                                  disabled={(selectedQuantities[item.id] || remainingQty) >= remainingQty}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              </div>
                              <span className="text-xs text-gray-500">
                                / {remainingQty} adet
                              </span>
                              <span className="text-xs font-bold text-purple-600 ml-auto">
                                = ₺{((selectedQuantities[item.id] || remainingQty) * item.price).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isFullyPaid && !item.isGift && (
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <button
                          onClick={() => handlePayItem(item)}
                          disabled={isProcessing}
                          className={`px-6 py-3 rounded-xl font-bold text-white transition-all ${
                            isProcessing
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                          }`}
                        >
                          {isProcessing ? 'İşleniyor...' : paidQty > 0 ? `Kalan ${remainingQty} Adet` : 'Ödeme Al'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alt Butonlar */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-semibold text-lg transition-all duration-300"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
    {toast.show && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info', show: false })}
      />
    )}
    </>
  );
};

export default TablePartialPaymentModal;
