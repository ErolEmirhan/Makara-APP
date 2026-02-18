import React, { useState, useEffect, useRef } from 'react';
import Toast from './Toast';

const roundMoney = (x) => Math.round(Number(x) * 100) / 100;

const TablePartialPaymentModal = ({ order, items, totalAmount, onClose, onComplete }) => {
  const [itemsWithPayment, setItemsWithPayment] = useState([]);
  const [processingItemId, setProcessingItemId] = useState(null);
  const [selectedQuantities, setSelectedQuantities] = useState({}); // { itemId: quantity } - Başlangıçta tümü 0
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [showSplitFractionPanel, setShowSplitFractionPanel] = useState(false);
  // Parçalı ödemede 1/2, 1/3... daima baştaki toplam tutara göre hesaplansın
  const initialOrderTotalRef = useRef(null);
  // Ödeme sonrası parent refetch edene kadar ödenen kalemlerin doğru bölümde görünmesi için
  const lastPaymentUpdatesRef = useRef({});

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Baştaki toplam tutarı tek seferlik sakla (Parçalı Ödeme 1/2, 1/3... hep buna göre – kalem toplamı)
  useEffect(() => {
    if (order && items?.length && initialOrderTotalRef.current === null) {
      const sumItems = items.reduce((s, i) => s + (i.isGift ? 0 : (Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
      initialOrderTotalRef.current = roundMoney(sumItems);
    }
  }, [order, items, totalAmount]);

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

      // Gruplama anahtarı: product_name + fiyat (2 basamak, float hatası önlenir)
      const priceKey = Number(Number(item.price).toFixed(2));
      const groupKey = `${item.product_name}_${priceKey}`;
      
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
    lastPaymentUpdatesRef.current = {}; // Yeni items geldiğinde yerel ödeme önbelleğini temizle

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

  // Parçalı ödeme: 1/2, 1/3, ... 1/10 (daima baştaki toplam tutara göre, küsüratsız tam lira)
  const handleSplitFractionPayment = async (denominator) => {
    const initialTotal = initialOrderTotalRef.current ?? roundMoney(Number(order?.total_amount) || Number(totalAmount) || 0);
    if (initialTotal <= 0) {
      showToast('Toplam tutar hesaplanamadı', 'warning');
      return;
    }
    // Tam lira: küsürat yok (1/3 = 33 TL, bir taksitte 5 TL fazla/eksik olabilir)
    const targetAmount = Math.floor(initialTotal / denominator);
    const payAmount = Math.min(targetAmount, Math.floor(remainingAmount));
    if (payAmount <= 0) {
      showToast('Kalan tutar yok', 'info');
      return;
    }
    if (!window.electronAPI?.createPartialPaymentSale || !window.electronAPI?.updateTableOrderAmount) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
            <h3 class="text-xl font-bold text-white mb-1">Parçalı Ödeme 1/${denominator}</h3>
            <p class="text-sm text-white/90">Tutar: ₺${payAmount} (başlangıç toplamının 1/${denominator}'i, tam lira)</p>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <button id="cashBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  <span class="text-base">Nakit</span>
                </div>
              </button>
              <button id="cardBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                  <span class="text-base">Kredi Kartı</span>
                </div>
              </button>
            </div>
            <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">İptal</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#cashBtn').onclick = () => { document.body.removeChild(modal); resolve('Nakit'); };
      modal.querySelector('#cardBtn').onclick = () => { document.body.removeChild(modal); resolve('Kredi Kartı'); };
      modal.querySelector('#cancelBtn').onclick = () => { document.body.removeChild(modal); resolve(null); };
    });

    if (!paymentMethod) return;

    setProcessingItemId('split');
    setShowSplitFractionPanel(false);

    try {
      // Sadece toplam tutara göre: 1/x taksit tutarını al, kalemlere dağıtma
      const saleResult = await window.electronAPI.createPartialPaymentSale({
        orderId: order.id,
        totalAmount: payAmount,
        paymentMethod,
        tableName: order.table_name || '',
        tableType: order.table_type || 'inside'
      });
      if (!saleResult?.success) {
        showToast('Satış kaydı oluşturulamadı', 'error');
        return;
      }
      const amountResult = await window.electronAPI.updateTableOrderAmount(order.id, payAmount);
      if (!amountResult?.success) {
        showToast('Sipariş tutarı güncellenemedi: ' + (amountResult?.error || ''), 'error');
        return;
      }
      if (onComplete) await onComplete([]);
      showToast(`Parçalı ödeme (1/${denominator}) alındı: ₺${payAmount}`, 'success');
    } catch (err) {
      console.error('Parçalı ödeme hatası:', err);
      showToast('Ödeme alınamadı: ' + (err.message || ''), 'error');
    } finally {
      setProcessingItemId(null);
    }
  };

  // Kalan ödemeyi al - Tüm kalan ürünleri direkt ödeme al
  const handlePayRemaining = async () => {
    if (remainingAmount <= 0.01) {
      showToast('Kalan tutar yok', 'info');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.payTableOrderItem) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    // Tüm kalan ürünleri bul
    const remainingItems = itemsWithPayment.filter(item => {
      if (item.isGift) return false;
      const paidQty = item.groupedPaidQuantity || 0;
      const remainingQty = item.groupedQuantity - paidQty;
      return remainingQty > 0;
    });

    if (remainingItems.length === 0) {
      showToast('Kalan ürün bulunamadı', 'warning');
      return;
    }

    // Ödeme yöntemi seçimi
    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      
      const remainingTotal = roundMoney(remainingItems.reduce((sum, item) => {
        const paidQty = item.groupedPaidQuantity || 0;
        const remainingQty = item.groupedQuantity - paidQty;
        return sum + (item.price * remainingQty);
      }, 0));
      
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4">
            <h3 class="text-xl font-bold text-white mb-1">Kalan Ödemeyi Al</h3>
            <p class="text-sm text-white/90">Toplam: ₺${remainingTotal.toFixed(2)}</p>
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
      const paymentUpdates = {};

      // Her kalan ürün için ödeme al
      for (const item of remainingItems) {
        const paidQty = item.groupedPaidQuantity || 0;
        const remainingQty = item.groupedQuantity - paidQty;
        
        if (remainingQty <= 0) continue;

        // Sadece gerçek tableOrderItem id'leri; kalan miktarı aşmadan ödeme al
        const originalIds = item.originalIds || [item.id];
        const realOriginalIds = originalIds.filter(id => typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)));
        let remainingSelectedQty = remainingQty;

        for (const originalId of realOriginalIds) {
          if (remainingSelectedQty <= 0) break;
          const originalItem = items.find(i => String(i.id) === String(originalId));
          if (!originalItem) continue;
          const originalPaidQty = Number(originalItem.paid_quantity || 0);
          const originalRemainingQty = originalItem.quantity - originalPaidQty;
          const qtyToPayForThisItem = Math.min(remainingSelectedQty, originalRemainingQty);
          if (qtyToPayForThisItem <= 0) continue;
          try {
            const result = await window.electronAPI.payTableOrderItem(originalId, paymentMethod, Number(qtyToPayForThisItem));
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

        const newPaidQuantity = paidQty + (remainingQty - remainingSelectedQty);
        const isFullyPaid = newPaidQuantity >= item.groupedQuantity;
        paymentUpdates[item.id] = {
          groupedPaidQuantity: newPaidQuantity,
          isPaid: isFullyPaid,
          paymentMethod: item.groupedPaidQuantity > 0 ? `${item.paymentMethod || ''}, ${paymentMethod}` : paymentMethod
        };
      }

      if (Object.keys(paymentUpdates).length > 0) {
        lastPaymentUpdatesRef.current = { ...paymentUpdates };
        setItemsWithPayment(prev => prev.map(i => {
          const u = paymentUpdates[i.id];
          if (!u) return i;
          return { ...i, groupedPaidQuantity: u.groupedPaidQuantity, isPaid: u.isPaid, paymentMethod: u.paymentMethod };
        }));
      }

      // onComplete callback'ini çağır
      if (onComplete && paymentResults.length > 0) {
        onComplete(paymentResults);
      }

      if (paymentResults.length > 0) {
        showToast(`Kalan ${paymentResults.length} ürün için ödeme başarıyla alındı!`, 'success');
      } else {
        showToast('Ödeme alınamadı', 'error');
      }
    } catch (error) {
      console.error('Kalan ödeme hatası:', error);
      showToast('Ödeme alınırken bir hata oluştu', 'error');
    } finally {
      setProcessingItemId(null);
    }
  };

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
      const paymentUpdates = {}; // itemId -> { groupedPaidQuantity, isPaid, paymentMethod }

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
        
        // Sadece gerçek (sayısal) tableOrderItem id'leri üzerinden ödeme al; toplam selectedQty'yi aşma
        const realOriginalIds = originalIds.filter(id => typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)));
        let totalPaidForGroup = 0;
        const maxToPayForGroup = selectedQty;

        for (const originalId of realOriginalIds) {
          if (totalPaidForGroup >= maxToPayForGroup) break;

          const originalItem = items.find(i => String(i.id) === String(originalId));
          if (!originalItem) continue;

          const originalPaidQty = Number(originalItem.paid_quantity || 0);
          const originalRemainingQty = originalItem.quantity - originalPaidQty;
          const remainingToPayInGroup = maxToPayForGroup - totalPaidForGroup;
          const qtyToPayForThisItem = Math.min(remainingToPayInGroup, originalRemainingQty, Math.max(0, Math.floor(remainingSelectedQty)));

          if (qtyToPayForThisItem <= 0) continue;

          try {
            const result = await window.electronAPI.payTableOrderItem(originalId, paymentMethod, Number(qtyToPayForThisItem));
            if (result.success) {
              paymentResults.push({ itemId: originalId, paymentMethod, quantity: qtyToPayForThisItem });
              remainingSelectedQty -= qtyToPayForThisItem;
              totalPaidForGroup += qtyToPayForThisItem;
            } else {
              console.error(`Ürün ${originalItem.product_name} (ID: ${originalId}) için ödeme alınamadı:`, result.error);
            }
          } catch (error) {
            console.error(`Ürün ${originalItem.product_name} (ID: ${originalId}) için ödeme hatası:`, error);
          }
        }
        
        const actuallyPaidForGroup = totalPaidForGroup;
        const newPaidQuantity = paidQty + actuallyPaidForGroup;
        const isFullyPaid = newPaidQuantity >= item.groupedQuantity;
        paymentUpdates[item.id] = {
          groupedPaidQuantity: newPaidQuantity,
          isPaid: isFullyPaid,
          paymentMethod: item.groupedPaidQuantity > 0 ? `${item.paymentMethod || ''}, ${paymentMethod}` : paymentMethod
        };
        setSelectedQuantities(prev => ({ ...prev, [item.id]: 0 }));
      }

      // Tüm ödeme güncellemelerini tek seferde uygula + ref'e yaz (render'da ödenen kalemlere geçsin)
      if (Object.keys(paymentUpdates).length > 0) {
        lastPaymentUpdatesRef.current = { ...paymentUpdates };
        setItemsWithPayment(prev => prev.map(i => {
          const u = paymentUpdates[i.id];
          if (!u) return i;
          return {
            ...i,
            groupedPaidQuantity: u.groupedPaidQuantity,
            isPaid: u.isPaid,
            paymentMethod: u.paymentMethod
          };
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
      total: roundMoney(item.price * (selectedQuantities[item.id] || 0))
    }));

  const selectedItemsTotal = roundMoney(selectedItemsInfo.reduce((sum, item) => sum + item.total, 0));
  const selectedItemsText = selectedItemsInfo.map(item => `${item.product_name} (${item.selectedQty})`).join(', ');

  // Ref'teki güncel ödeme bilgisini state ile birleştir (ödenen kalemler hemen doğru bölümde görünsün)
  const effectiveItems = itemsWithPayment.map(item => {
    const u = lastPaymentUpdatesRef.current[item.id];
    if (!u) return item;
    return { ...item, groupedPaidQuantity: u.groupedPaidQuantity, isPaid: u.isPaid, paymentMethod: u.paymentMethod != null ? u.paymentMethod : item.paymentMethod };
  });

  const awaitingItems = effectiveItems.filter(item => {
    if (item.isGift) return false;
    const paidQty = item.groupedPaidQuantity || 0;
    return paidQty < item.groupedQuantity;
  });
  const completedItems = effectiveItems.filter(item => {
    if (item.isGift) return false;
    return (item.groupedPaidQuantity || 0) >= item.groupedQuantity;
  });
  const giftItems = effectiveItems.filter(item => item.isGift);

  // Orijinal toplam tutar (açılışta; parçalı ödeme 1/x daima buna göre)
  const originalTotalAmount = roundMoney(effectiveItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * item.groupedQuantity);
  }, 0));

  const initialTotal = initialOrderTotalRef.current ?? originalTotalAmount;
  // Parçalı ödeme tutar bazlı alındığı için kalan = backend order.total_amount (tek kaynak)
  const remainingFromBackend = Number(order?.total_amount);
  const useBackendRemaining = typeof remainingFromBackend === 'number' && remainingFromBackend >= 0;
  const remainingAmount = useBackendRemaining
    ? roundMoney(remainingFromBackend)
    : roundMoney(originalTotalAmount - effectiveItems.reduce((sum, item) => {
        if (item.isGift) return sum;
        const paidQty = item.groupedPaidQuantity || 0;
        return sum + (item.price * paidQty);
      }, 0));
  const paidAmount = roundMoney(initialTotal - remainingAmount);

  // Tutar bazlı parçalı ödeme alınmışsa (kalem bazlı ödenen yok, sadece order.total_amount düşmüş)
  const paidFromItems = roundMoney(effectiveItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * (item.groupedPaidQuantity || 0));
  }, 0));
  const hasAmountBasedPartialPayment = paidAmount > 0.01 && paidFromItems < 0.01;

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
              <p className="text-xl font-bold text-gray-900">₺{originalTotalAmount.toFixed(2)}</p>
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
              <p className="text-xs text-gray-500 mb-1 font-medium">Ödenmemiş Kalem</p>
              <p className="text-xl font-bold text-gray-900">{hasAmountBasedPartialPayment ? '—' : `${awaitingItems.length} Adet`}</p>
            </div>
          </div>
          {/* Parçalı Ödeme: 1/2, 1/3, ... 1/10 (baştaki toplam tutara göre) */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowSplitFractionPanel(!showSplitFractionPanel)}
              disabled={remainingAmount <= 0.01 || processingItemId === 'split'}
              className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Parçalı Ödeme (1/2, 1/3 … 1/10)
            </button>
            {showSplitFractionPanel && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                  const initialTotal = initialOrderTotalRef.current ?? originalTotalAmount;
                  const fractionAmount = Math.floor(initialTotal / n);
                  const payAmount = Math.min(fractionAmount, Math.floor(remainingAmount));
                  const isDisabled = payAmount <= 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSplitFractionPayment(n)}
                      className="px-4 py-2.5 rounded-xl font-bold text-sm bg-white border-2 border-violet-200 text-violet-800 hover:bg-violet-50 hover:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <span className="block">1/{n}</span>
                      <span className="block text-xs font-normal text-gray-600">₺{payAmount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* İçerik: Parçalı ödeme alınmışsa sadece ürün listesi + bildirim; değilse ödeme bekleyen/ödenen */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {hasAmountBasedPartialPayment ? (
            <>
              {/* Parçalı ödeme alındı – sadece parçalı ödeme ile devam bildirimi */}
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Parçalı ödeme başlatıldı</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Bu siparişte ödeme tutar bazlı parçalı ödeme (1/2, 1/3, …) ile alındı. Kalan tutarı tamamlamak için <strong>yalnızca yukarıdaki Parçalı Ödeme (1/2, 1/3 … 1/10)</strong> butonlarını kullanın. Ürün seçerek veya “Kalan ödemeyi al” ile ödeme alınamaz.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sadece ürün listesi: Ürün, Adet, Birim Fiyat, Tutar */}
              <section>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Sipariş kalemleri</h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                        <th className="py-3 px-4 font-semibold">Ürün</th>
                        <th className="py-3 px-4 font-semibold text-center w-24">Adet</th>
                        <th className="py-3 px-4 font-semibold text-right w-28">Birim Fiyat</th>
                        <th className="py-3 px-4 font-semibold text-right w-28">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveItems.filter(i => !i.isGift).map((item) => {
                        const itemTotal = roundMoney(item.price * item.groupedQuantity);
                        return (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium text-gray-800">{item.product_name}</td>
                            <td className="py-3 px-4 text-center text-gray-600">{item.groupedQuantity}</td>
                            <td className="py-3 px-4 text-right text-gray-600">₺{Number(item.price).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-medium">₺{itemTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {giftItems.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    İkramlar
                  </h3>
                  <div className="rounded-xl border border-amber-200 overflow-hidden bg-amber-50/30">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-amber-50 text-gray-600 border-b border-amber-100">
                          <th className="py-3 px-4 font-semibold">Ürün</th>
                          <th className="py-3 px-4 font-semibold text-center w-20">Adet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {giftItems.map((item) => (
                          <tr key={item.id} className="border-b border-amber-100/50">
                            <td className="py-3 px-4 font-medium text-amber-800">{item.product_name}</td>
                            <td className="py-3 px-4 text-center text-amber-700">{item.groupedQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              {/* Ödeme bekleyen kalemler */}
              <section>
                <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Ödeme bekleyen ({awaitingItems.length} kalem)
                </h3>
                <div className="rounded-xl border border-orange-200 overflow-hidden bg-white">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-orange-50 text-gray-600 border-b border-orange-100">
                        <th className="py-3 px-4 font-semibold">Ürün</th>
                        <th className="py-3 px-4 font-semibold text-center w-24">Kalan adet</th>
                        <th className="py-3 px-4 font-semibold text-right w-24">Birim</th>
                        <th className="py-3 px-4 font-semibold text-right w-24">Tutar</th>
                        <th className="py-3 px-4 font-semibold text-right w-24">Ödenen</th>
                        <th className="py-3 px-4 font-semibold text-right w-24">Kalan</th>
                        <th className="py-3 px-4 font-semibold text-center w-36">Ödenecek</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awaitingItems.map((item) => {
                        const paidQty = item.groupedPaidQuantity || 0;
                        const remainingQty = item.groupedQuantity - paidQty;
                        const itemTotal = roundMoney(item.price * item.groupedQuantity);
                        const paidTotal = roundMoney(item.price * paidQty);
                        const remainingTotal = roundMoney(item.price * remainingQty);
                        const selectedQty = selectedQuantities[item.id] || 0;
                        return (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-orange-50/50">
                            <td className="py-3 px-4 font-medium text-gray-800">{item.product_name}</td>
                            <td className="py-3 px-4 text-center text-gray-600 font-medium">{remainingQty}</td>
                            <td className="py-3 px-4 text-right text-gray-600">₺{Number(item.price).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-medium">₺{itemTotal.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-blue-600">₺{paidTotal.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-orange-600">₺{remainingTotal.toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, selectedQty - 1)}
                                  disabled={selectedQty <= 0}
                                  className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold"
                                >−</button>
                                <input
                                  type="number"
                                  min={0}
                                  max={remainingQty}
                                  value={selectedQty}
                                  onChange={(e) => updateQuantity(item.id, Math.max(0, Math.min(remainingQty, parseInt(e.target.value) || 0)))}
                                  className="w-14 py-1 text-center border border-gray-300 rounded text-gray-800 font-semibold"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, selectedQty + 1)}
                                  disabled={selectedQty >= remainingQty}
                                  className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold"
                                >+</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {awaitingItems.length === 0 && (
                    <p className="py-6 text-center text-gray-500">Ödeme bekleyen kalem yok.</p>
                  )}
                </div>
              </section>

              {/* Ödenen kalemler */}
              <section>
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Ödenen kalemler ({completedItems.length})
                </h3>
                <div className="rounded-xl border border-green-200 overflow-hidden bg-green-50/30">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-green-50 text-gray-600 border-b border-green-100">
                        <th className="py-3 px-4 font-semibold">Ürün</th>
                        <th className="py-3 px-4 font-semibold text-center w-20">Adet</th>
                        <th className="py-3 px-4 font-semibold text-right w-28">Tutar</th>
                        <th className="py-3 px-4 font-semibold">Ödeme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedItems.map((item) => {
                        const itemTotal = roundMoney(item.price * item.groupedQuantity);
                        return (
                          <tr key={item.id} className="border-b border-green-100/50">
                            <td className="py-3 px-4 font-medium text-green-800">{item.product_name}</td>
                            <td className="py-3 px-4 text-center text-green-700">{item.groupedQuantity}</td>
                            <td className="py-3 px-4 text-right font-medium text-green-700">₺{itemTotal.toFixed(2)}</td>
                            <td className="py-3 px-4 text-green-600 text-sm">{item.paymentMethod || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {completedItems.length === 0 && (
                    <p className="py-6 text-center text-gray-500">Henüz ödenen kalem yok.</p>
                  )}
                </div>
              </section>

              {giftItems.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    İkramlar
                  </h3>
                  <div className="rounded-xl border border-amber-200 overflow-hidden bg-amber-50/30">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-amber-50 text-gray-600 border-b border-amber-100">
                          <th className="py-3 px-4 font-semibold">Ürün</th>
                          <th className="py-3 px-4 font-semibold text-center w-20">Adet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {giftItems.map((item) => (
                          <tr key={item.id} className="border-b border-amber-100/50">
                            <td className="py-3 px-4 font-medium text-amber-800">{item.product_name}</td>
                            <td className="py-3 px-4 text-center text-amber-700">{item.groupedQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Sabit Footer: Parçalı ödeme modunda sadece bilgi; normal modda Seçilen/Kalan ödemeyi al */}
        <div className="bg-gray-800 border-t border-gray-700 px-8 py-4">
          {hasAmountBasedPartialPayment ? (
            <div className="flex items-center justify-between gap-6">
              <p className="text-sm text-gray-300">
                Kalan ödeme <strong className="text-white">Parçalı Ödeme (1/2, 1/3 … 1/10)</strong> ile tamamlanmalıdır.
              </p>
            </div>
          ) : (
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
                  <p className="text-sm text-gray-300 mb-1">Seçilen tutar:</p>
                  <p className="text-2xl font-bold text-white">₺{selectedItemsTotal.toFixed(2)}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {remainingAmount > 0.01 && (
                    <button
                      onClick={handlePayRemaining}
                      disabled={processingItemId === 'bulk'}
                      className={`px-6 py-3 rounded-lg font-bold text-white text-base transition-all shadow-lg ${
                        processingItemId === 'bulk'
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-orange-600 hover:bg-orange-700 hover:shadow-xl'
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
                        `Kalan Ödemeyi Al (₺${remainingAmount.toFixed(2)})`
                      )}
                    </button>
                  )}
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
                      `Seçilen Ödemeyi Al (₺${selectedItemsTotal.toFixed(2)})`
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
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
