import React, { useState, useEffect } from 'react';
import Toast from './Toast';

const TablePartialPaymentModal = ({ order, items, totalAmount, onClose, onComplete }) => {
  const [itemsWithPayment, setItemsWithPayment] = useState([]);
  const [processingItemId, setProcessingItemId] = useState(null);
  const [selectedQuantities, setSelectedQuantities] = useState({}); // { itemId: quantity } - Başlangıçta tümü 0
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

    // Aynı ürünleri grupla (product_name ve price'a göre)
    const groupedItems = {};
    
    itemsData.forEach(item => {
      // İkram olanları ayrı tut, gruplama
      if (item.isGift) {
        const giftKey = `gift_${item.id}`;
        groupedItems[giftKey] = {
          ...item,
          originalIds: [item.id], // Orijinal item ID'lerini sakla
          groupedQuantity: item.quantity,
          groupedPaidQuantity: item.paidQuantity || 0
        };
        return;
      }

      // Gruplama anahtarı: product_name + price
      const groupKey = `${item.product_name}_${item.price}`;
      
      if (groupedItems[groupKey]) {
        // Mevcut gruba ekle
        groupedItems[groupKey].originalIds.push(item.id);
        groupedItems[groupKey].groupedQuantity += item.quantity;
        groupedItems[groupKey].groupedPaidQuantity += (item.paidQuantity || 0);
        
        // Ödeme yöntemlerini birleştir
        if (item.paymentMethod && groupedItems[groupKey].paymentMethod) {
          if (!groupedItems[groupKey].paymentMethod.includes(item.paymentMethod)) {
            groupedItems[groupKey].paymentMethod = `${groupedItems[groupKey].paymentMethod}, ${item.paymentMethod}`;
          }
        } else if (item.paymentMethod) {
          groupedItems[groupKey].paymentMethod = item.paymentMethod;
        }
        
        // Eğer birisi ödenmişse, grup kısmen ödenmiş sayılır
        if (item.isPaid || (item.paidQuantity || 0) > 0) {
          groupedItems[groupKey].isPaid = groupedItems[groupKey].groupedPaidQuantity >= groupedItems[groupKey].groupedQuantity;
        }
      } else {
        // Yeni grup oluştur
        groupedItems[groupKey] = {
          ...item,
          originalIds: [item.id], // Orijinal item ID'lerini sakla
          groupedQuantity: item.quantity,
          groupedPaidQuantity: item.paidQuantity || 0,
          // Grup için unique bir ID oluştur
          id: `group_${groupKey}`
        };
      }
    });

    // Gruplanmış öğeleri array'e çevir
    const groupedItemsArray = Object.values(groupedItems);
    
    setItemsWithPayment(groupedItemsArray);
    
    // Tüm ödenmemiş ürünler için başlangıçta 0 miktar seç
    const initialQuantities = {};
    groupedItemsArray.forEach(item => {
      if (!item.isGift) {
        const paidQty = item.groupedPaidQuantity || 0;
        const remainingQty = item.groupedQuantity - paidQty;
        if (remainingQty > 0) {
          initialQuantities[item.id] = 0; // Başlangıçta 0
        }
      }
    });
    setSelectedQuantities(initialQuantities);
  }, [items]);

  // Toplu ödeme al - Tüm seçilen ürünler için
  const handleBulkPayment = async () => {
    if (!window.electronAPI || !window.electronAPI.payTableOrderItem) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    // Seçili ürünleri filtrele
    const selectedItems = itemsWithPayment.filter(item => {
      if (item.isGift) return false;
      const selectedQty = selectedQuantities[item.id] || 0;
      return selectedQty > 0;
    });

    if (selectedItems.length === 0) {
      showToast('Lütfen en az bir ürün seçin', 'warning');
      return;
    }

    // Ödeme yöntemi seçimi
    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h3 class="text-xl font-bold text-white mb-1">Ödeme Yöntemi</h3>
            <p class="text-sm text-white/90">Toplam: ₺${selectedItemsTotal.toFixed(2)}</p>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <button id="cashBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span class="text-base">Nakit</span>
                </div>
              </button>
              <button id="cardBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span class="text-base">Kredi Kartı</span>
                </div>
              </button>
            </div>
            <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
              İptal
            </button>
          </div>
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

    setProcessingItemId('bulk');

    try {
      const paymentResults = [];

      // Her seçili ürün için ödeme al
      for (const item of selectedItems) {
        const selectedQty = selectedQuantities[item.id] || 0;
        if (selectedQty <= 0) continue;

        const paidQty = item.groupedPaidQuantity || 0;
        const remainingQty = item.groupedQuantity - paidQty;
        
        if (selectedQty > remainingQty) {
          console.error(`Ürün ${item.product_name} için seçilen miktar (${selectedQty}) kalan miktardan (${remainingQty}) fazla`);
          continue;
        }

        // Gruplanmış ürünler için, orijinal item'lar arasında ödemeyi dağıt
        const originalIds = item.originalIds || [item.id];
        let remainingSelectedQty = selectedQty;
        
        // Her orijinal item için ödeme al
        for (const originalId of originalIds) {
          if (remainingSelectedQty <= 0) break;
          
          // Orijinal item'ı bul (items prop'undan)
          const originalItem = items.find(i => i.id === originalId);
          if (!originalItem) {
            // Eğer bulunamazsa, bu bir grup item'ı olabilir, direkt ödeme al
            try {
              const result = await window.electronAPI.payTableOrderItem(originalId, paymentMethod, remainingSelectedQty);
              if (result.success) {
                paymentResults.push({ itemId: originalId, paymentMethod, quantity: remainingSelectedQty });
                remainingSelectedQty = 0;
              }
            } catch (error) {
              console.error(`Ürün (ID: ${originalId}) için ödeme hatası:`, error);
            }
            continue;
          }
          
          const originalPaidQty = originalItem.paid_quantity || 0;
          const originalRemainingQty = originalItem.quantity - originalPaidQty;
          
          // Bu item için ödenecek miktarı belirle
          const qtyToPayForThisItem = Math.min(remainingSelectedQty, originalRemainingQty);
          
          if (qtyToPayForThisItem <= 0) continue;

          try {
            const result = await window.electronAPI.payTableOrderItem(originalId, paymentMethod, qtyToPayForThisItem);
            
            if (result.success) {
              paymentResults.push({ itemId: originalId, paymentMethod, quantity: qtyToPayForThisItem });
              remainingSelectedQty -= qtyToPayForThisItem;
            } else {
              console.error(`Ürün ${originalItem.product_name} (ID: ${originalId}) için ödeme alınamadı:`, result.error);
            }
          } catch (error) {
            console.error(`Ürün ${originalItem.product_name} (ID: ${originalId}) için ödeme hatası:`, error);
          }
        }
        
        // Grup item'ı güncelle
        const newPaidQuantity = paidQty + selectedQty;
        const isFullyPaid = newPaidQuantity >= item.groupedQuantity;
        
        setItemsWithPayment(prev => prev.map(i => 
          i.id === item.id 
            ? { 
                ...i, 
                isPaid: isFullyPaid,
                groupedPaidQuantity: newPaidQuantity,
                paymentMethod: i.groupedPaidQuantity > 0 ? `${i.paymentMethod || ''}, ${paymentMethod}` : paymentMethod
              }
            : i
        ));
        
        // Seçilen miktarı sıfırla
        setSelectedQuantities(prev => ({
          ...prev,
          [item.id]: 0
        }));
      }

      // onComplete callback'ini çağır
      if (onComplete && paymentResults.length > 0) {
        onComplete(paymentResults);
      }

      if (paymentResults.length > 0) {
        showToast(`${paymentResults.length} ürün için ödeme başarıyla alındı!`, 'success');
      } else {
        showToast('Ödeme alınamadı', 'error');
      }
    } catch (error) {
      console.error('Toplu ödeme hatası:', error);
      showToast('Ödeme alınırken bir hata oluştu', 'error');
    } finally {
      setProcessingItemId(null);
    }
  };

  // Miktar değiştir (+ - butonları için)
  const updateQuantity = (itemId, quantity) => {
    const item = itemsWithPayment.find(i => i.id === itemId);
    if (!item) return;
    
    const paidQty = item.groupedPaidQuantity || 0;
    const remainingQty = item.groupedQuantity - paidQty;
    
    // Miktarı sınırla (0 ile kalan miktar arasında)
    const validQuantity = Math.max(0, Math.min(quantity, remainingQty));
    
    setSelectedQuantities(prev => ({
      ...prev,
      [itemId]: validQuantity
    }));
  };

  // Seçilen ürünlerin bilgilerini hesapla
  const selectedItemsInfo = itemsWithPayment
    .filter(item => {
      if (item.isGift) return false;
      const selectedQty = selectedQuantities[item.id] || 0;
      return selectedQty > 0;
    })
    .map(item => ({
      ...item,
      selectedQty: selectedQuantities[item.id] || 0,
      total: (item.price * (selectedQuantities[item.id] || 0))
    }));

  const selectedItemsTotal = selectedItemsInfo.reduce((sum, item) => sum + item.total, 0);
  const selectedItemsText = selectedItemsInfo.map(item => `${item.product_name} (${item.selectedQty})`).join(', ');

  // Ödenmemiş ürünler (tamamı ödenmemiş olanlar)
  const unpaidItems = itemsWithPayment.filter(item => {
    if (item.isGift) return false;
    const paidQty = item.groupedPaidQuantity || 0;
    return paidQty < item.groupedQuantity;
  });
  // Ödenmiş ürünler (tamamı veya kısmen)
  const paidItems = itemsWithPayment.filter(item => {
    if (item.isGift) return false;
    return (item.groupedPaidQuantity || 0) > 0;
  });
  // Toplam ödenen tutar (ödenen miktarlar üzerinden)
  const paidAmount = itemsWithPayment.reduce((sum, item) => {
    if (item.isGift) return sum;
    const paidQty = item.groupedPaidQuantity || 0;
    return sum + (item.price * paidQty);
  }, 0);
  // Kalan tutar
  const remainingAmount = totalAmount - paidAmount;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl mx-4 max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header - Kurumsal ve Minimal */}
        <div className="bg-gray-800 px-8 py-5 flex items-center justify-between border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Kısmi Ödeme</h2>
            <p className="text-sm text-gray-300 mt-1">Masa: {order.table_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Özet Bilgiler - Kurumsal */}
        <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Toplam Tutar</p>
              <p className="text-xl font-bold text-gray-900">₺{totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Ödenen</p>
              <p className="text-xl font-bold text-green-600">₺{paidAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Kalan</p>
              <p className={`text-xl font-bold ${remainingAmount > 0.01 ? 'text-orange-600' : 'text-green-600'}`}>
                ₺{remainingAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Ödenmemiş Ürün</p>
              <p className="text-xl font-bold text-gray-900">{unpaidItems.length} Adet</p>
            </div>
          </div>
        </div>

        {/* Ürün Listesi - Scroll Edilebilir, Kurumsal */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-3">
            {itemsWithPayment.map((item) => {
              const itemTotal = item.price * item.groupedQuantity;
              const paidQty = item.groupedPaidQuantity || 0;
              const remainingQty = item.groupedQuantity - paidQty;
              const paidTotal = item.price * paidQty;
              const isFullyPaid = item.isPaid || paidQty >= item.groupedQuantity;
              const selectedQty = selectedQuantities[item.id] || 0;
              
              return (
                <div
                  key={item.id}
                  className={`rounded-lg p-4 border transition-all ${
                    isFullyPaid
                      ? 'bg-green-50 border-green-200'
                      : paidQty > 0
                      ? 'bg-blue-50 border-blue-200'
                      : item.isGift
                      ? 'bg-yellow-50 border-yellow-200'
                      : selectedQty > 0
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-6">
                    {/* Sol Taraf - Ürün Bilgisi */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isFullyPaid
                          ? 'bg-green-500'
                          : paidQty > 0
                          ? 'bg-blue-500'
                          : item.isGift
                          ? 'bg-yellow-400'
                          : 'bg-gray-400'
                      }`}>
                        {isFullyPaid ? (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : paidQty > 0 ? (
                          <span className="text-white text-xs font-bold">{paidQty}/{item.groupedQuantity}</span>
                        ) : item.isGift ? (
                          <span className="text-white text-lg">🎁</span>
                        ) : (
                          <span className="text-white text-lg">📦</span>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`font-semibold text-base ${
                            isFullyPaid ? 'text-green-700 line-through' : item.isGift ? 'text-yellow-700' : 'text-gray-800'
                          }`}>
                            {item.product_name}
                            {item.isGift && <span className="ml-2 text-xs font-normal">(İKRAM)</span>}
                          </p>
                          <div className="text-right">
                            {isFullyPaid ? (
                              <p className="text-base font-bold text-green-600 line-through">₺{itemTotal.toFixed(2)}</p>
                            ) : paidQty > 0 ? (
                              <div>
                                <p className="text-xs text-gray-400 line-through">₺{itemTotal.toFixed(2)}</p>
                                <p className="text-base font-bold text-blue-600">₺{paidTotal.toFixed(2)}</p>
                              </div>
                            ) : (
                              <p className="text-base font-bold text-gray-800">₺{itemTotal.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {item.groupedQuantity} adet × ₺{item.price.toFixed(2)}
                          {paidQty > 0 && !isFullyPaid && (
                            <span className="ml-2 text-blue-600">({paidQty} ödendi, {remainingQty} kalan)</span>
                          )}
                        </p>
                        
                        {/* Miktar Seçici - Basit ve Kurumsal */}
                        {!isFullyPaid && !item.isGift && remainingQty > 0 && (
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-700">Miktar:</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.id, selectedQty - 1)}
                                disabled={selectedQty <= 0}
                                className="w-9 h-9 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 font-semibold transition-all flex items-center justify-center"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={remainingQty}
                                value={selectedQty}
                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1.5 text-center border border-gray-300 rounded text-base font-semibold text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => updateQuantity(item.id, selectedQty + 1)}
                                disabled={selectedQty >= remainingQty}
                                className="w-9 h-9 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 font-semibold transition-all flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm text-gray-500">/ {remainingQty} adet</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sabit Footer Bar - Kurumsal */}
        <div className="bg-gray-800 border-t border-gray-700 px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              {selectedItemsInfo.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-300 mb-1">Seçilen Ürünler:</p>
                  <p className="text-base font-semibold text-white truncate">{selectedItemsText || '-'}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Ürün seçmek için miktar belirleyin</p>
              )}
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-300 mb-1">Toplam:</p>
                <p className="text-2xl font-bold text-white">₺{selectedItemsTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={handleBulkPayment}
                disabled={selectedItemsInfo.length === 0 || processingItemId === 'bulk'}
                className={`px-8 py-3 rounded-lg font-bold text-white text-base transition-all shadow-lg ${
                  selectedItemsInfo.length === 0 || processingItemId === 'bulk'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl'
                }`}
              >
                {processingItemId === 'bulk' ? (
                  <span className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>İşleniyor...</span>
                  </span>
                ) : (
                  'Ödeme Al'
                )}
              </button>
            </div>
          </div>
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
