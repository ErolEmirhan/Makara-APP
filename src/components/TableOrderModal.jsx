import React, { useState, useEffect, useMemo } from 'react';
import Toast from './Toast';

const TableOrderModal = ({ order, items, onClose, onCompleteTable, onPartialPayment, onRequestAdisyon, onAddItems, onItemCancelled, onCancelEntireTable }) => {
  const [sessionDuration, setSessionDuration] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [cancellingItemId, setCancellingItemId] = useState(null);
  const [cancelConfirmItem, setCancelConfirmItem] = useState(null);
  const [cancelQuantity, setCancelQuantity] = useState(1);
  const [showCancelReceiptPreview, setShowCancelReceiptPreview] = useState(false);
  const [cancelReceiptHTML, setCancelReceiptHTML] = useState(null);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pendingCancelItemId, setPendingCancelItemId] = useState(null);
  const [pendingCancelQuantity, setPendingCancelQuantity] = useState(null);
  const [showCancelEntireTableModal, setShowCancelEntireTableModal] = useState(false);
  const [cancellingEntireTable, setCancellingEntireTable] = useState(false);
  const [cancelEntireTableReason, setCancelEntireTableReason] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  if (!order) return null;

  // Aynı ürünleri grupla ve toplam miktarı göster
  const groupedItems = useMemo(() => {
    const grouped = new Map();
    
    items.forEach(item => {
      // product_id ve isGift'e göre grup key'i oluştur
      const key = `${item.product_id}_${item.isGift || false}`;
      
      if (!grouped.has(key)) {
        // İlk kez görülen ürün
        grouped.set(key, {
          ...item,
          // Tüm item ID'lerini sakla (iptal işlemleri için)
          allItemIds: [item.id],
          // Orijinal item'ları sakla (detay için)
          originalItems: [item]
        });
      } else {
        // Aynı ürün bulundu, miktarları topla
        const existing = grouped.get(key);
        existing.quantity += item.quantity;
        existing.paid_quantity = (existing.paid_quantity || 0) + (item.paid_quantity || 0);
        existing.is_paid = existing.is_paid && item.is_paid; // Her ikisi de ödenmişse true
        // Payment method'ları birleştir
        if (item.payment_method && existing.payment_method) {
          if (existing.payment_method !== item.payment_method) {
            existing.payment_method = `${existing.payment_method}, ${item.payment_method}`;
          }
        } else if (item.payment_method) {
          existing.payment_method = item.payment_method;
        }
        // ID'leri ve orijinal item'ları ekle
        existing.allItemIds.push(item.id);
        existing.originalItems.push(item);
      }
    });
    
    return Array.from(grouped.values());
  }, [items]);

  // Oturum süresini canlı olarak hesapla
  useEffect(() => {
    const calculateSessionDuration = () => {
      // Türkçe tarih formatını parse et
      const [day, month, year] = order.order_date.split('.');
      const [orderHours, orderMinutes, orderSeconds] = order.order_time.split(':');
      const orderDateTime = new Date(year, month - 1, day, orderHours, orderMinutes, orderSeconds || 0);
      const now = new Date();
      const diffMs = now - orderDateTime;
      
      if (diffMs < 0) return '0 dakika';
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffMinutes = diffMins % 60;
      
      if (diffHours > 0) {
        return `${diffHours} saat ${diffMinutes} dakika`;
      }
      return `${diffMinutes} dakika`;
    };

    // İlk hesaplama
    setSessionDuration(calculateSessionDuration());

    // Her saniye güncelle
    const interval = setInterval(() => {
      setSessionDuration(calculateSessionDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [order.order_date, order.order_time]);

  // Başlangıç toplam tutarı (ikram edilen ürünler hariç) - groupedItems kullan
  const originalTotalAmount = groupedItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * item.quantity);
  }, 0);
  // Ödemesi alınan ürünlerin toplam tutarı (kısmi ödemeler dahil) - groupedItems kullan
  const paidAmount = groupedItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    const paidQty = item.paid_quantity || 0;
    return sum + (item.price * paidQty);
  }, 0);
  // Şu anki kalan tutar (order.total_amount)
  const remainingAmount = order.total_amount || 0;

  // Ürün iptal etme fonksiyonu
  const handleCancelItem = (item) => {
    if (!window.electronAPI || !window.electronAPI.cancelTableOrderItem) {
      showToast('İptal işlemi şu anda kullanılamıyor', 'error');
      return;
    }
    setCancelConfirmItem(item);
    setCancelQuantity(item.quantity > 1 ? 1 : item.quantity); // Varsayılan olarak 1 veya tümü
    setShowCancelReceiptPreview(false);
    setCancelReceiptHTML(null);
  };

  // İptal fişi önizleme
  const handlePreviewCancelReceipt = async () => {
    if (!cancelConfirmItem) return;

    if (!window.electronAPI || !window.electronAPI.previewCancelReceipt) {
      showToast('Fiş önizleme özelliği şu anda kullanılamıyor', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.previewCancelReceipt(cancelConfirmItem.id, cancelQuantity);
      if (result.success) {
        setCancelReceiptHTML(result.html);
        setShowCancelReceiptPreview(true);
      } else {
        showToast(result.error || 'Fiş önizlemesi oluşturulamadı', 'error');
      }
    } catch (error) {
      console.error('Fiş önizleme hatası:', error);
      showToast('Fiş önizlemesi oluşturulurken bir hata oluştu', 'error');
    }
  };

  // İptal onayı
  const confirmCancelItem = async () => {
    if (!cancelConfirmItem) return;

    if (cancelQuantity <= 0 || cancelQuantity > cancelConfirmItem.quantity) {
      showToast('Geçersiz iptal miktarı', 'warning');
      return;
    }

    // İlk istek: Açıklama boş, sadece açıklama modal'ını aç (fiş yazdırma)
    setPendingCancelItemId(cancelConfirmItem.id);
    setPendingCancelQuantity(cancelQuantity);
    setCancelConfirmItem(null);
    setShowCancelReceiptPreview(false);
    setCancelReceiptHTML(null);
    setShowCancelReasonModal(true);
    setCancelReason('');
    setCancellingItemId(null);
  };

  // İptal açıklaması gönder
  const submitCancelReason = async () => {
    if (!cancelReason.trim()) {
      showToast('Lütfen iptal açıklaması yazın', 'warning');
      return;
    }

    if (!pendingCancelItemId || !pendingCancelQuantity) {
      showToast('İptal işlemi bulunamadı', 'error');
      setShowCancelReasonModal(false);
      return;
    }

    // Gruplanmış item'ı bul (eğer varsa)
    const groupedItem = groupedItems.find(item => item.id === pendingCancelItemId || item.allItemIds?.includes(pendingCancelItemId));
    
    // Eğer gruplanmış item varsa ve birden fazla item varsa, toplu iptal kullan
    if (groupedItem && groupedItem.originalItems && groupedItem.originalItems.length > 1) {
      // Tüm item'ları toplu iptal için hazırla
      let remainingQuantity = pendingCancelQuantity;
      const itemsToCancel = [];
      
      for (const originalItem of groupedItem.originalItems) {
        if (remainingQuantity <= 0) break;
        
        // Bu item'dan ne kadar iptal edilecek?
        const quantityToCancel = Math.min(remainingQuantity, originalItem.quantity);
        itemsToCancel.push({
          itemId: originalItem.id,
          quantity: quantityToCancel
        });
        
        remainingQuantity -= quantityToCancel;
      }
      
      setCancellingItemId(pendingCancelItemId);
      
      try {
        // Toplu iptal işlemi (tek fiş)
        const result = await window.electronAPI.cancelTableOrderItemsBulk(
          itemsToCancel,
          cancelReason.trim()
        );
        
        if (result.success) {
          // Başarılı
          setShowCancelReasonModal(false);
          setCancelReason('');
          setPendingCancelItemId(null);
          setPendingCancelQuantity(null);
          if (onItemCancelled) {
            onItemCancelled();
          }
        } else {
          showToast(result.error || 'İptal açıklaması kaydedilemedi', 'error');
        }
      } catch (error) {
        console.error('İptal açıklaması kaydetme hatası:', error);
        showToast('İptal açıklaması kaydedilirken bir hata oluştu', 'error');
      } finally {
        setCancellingItemId(null);
      }
    } else {
      // Normal iptal (tek item veya gruplanmamış)
      setCancellingItemId(pendingCancelItemId);
      try {
        // Kısa bir delay ekleyerek UI donmasını önle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await window.electronAPI.cancelTableOrderItem(pendingCancelItemId, pendingCancelQuantity, cancelReason.trim());
        
        if (result.success) {
          // Başarılı
          setShowCancelReasonModal(false);
          setCancelReason('');
          setPendingCancelItemId(null);
          setPendingCancelQuantity(null);
          if (onItemCancelled) {
            onItemCancelled();
          }
        } else {
          showToast(result.error || 'İptal açıklaması kaydedilemedi', 'error');
        }
      } catch (error) {
        console.error('İptal açıklaması kaydetme hatası:', error);
        showToast('İptal açıklaması kaydedilirken bir hata oluştu', 'error');
      } finally {
        setCancellingItemId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-7xl w-full mx-6 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] max-h-[95vh] overflow-y-auto">
        {/* Header Section - Corporate Design */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Sipariş Detayları
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Masa: {order.table_name} • {order.table_type === 'inside' ? 'İç Masa' : 'Dış Masa'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all duration-200 p-2 rounded-lg flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Masa Bilgileri - Corporate Card */}
          <div className="bg-gray-50/50 rounded-lg p-5 border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Masa</p>
                <p className="text-base font-bold text-gray-900">{order.table_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tip</p>
                <p className="text-base font-bold text-gray-900">
                  {order.table_type === 'inside' ? 'İç Masa' : 'Dış Masa'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tarih</p>
                <p className="text-sm font-semibold text-gray-800">{order.order_date}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saat</p>
                <p className="text-sm font-semibold text-gray-800">{order.order_time}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Süre</p>
                <p className="text-sm font-bold text-gray-900">{sessionDuration}</p>
              </div>
              {order.staff_name && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Garson</p>
                  <p className="text-sm font-semibold text-gray-800">{order.staff_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Ürünler - Corporate Grid Layout */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900">Sipariş Ürünleri</h3>
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  {groupedItems.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[450px] overflow-y-auto pr-2">
              {groupedItems.map((item) => {
                const isGift = item.isGift || false;
                const isPaid = item.is_paid || false;
                const paidQuantity = item.paid_quantity || 0;
                const remainingQuantity = item.quantity - paidQuantity;
                const paymentMethod = item.payment_method || null;
                const displayTotal = isGift ? 0 : (item.price * item.quantity);
                const paidTotal = isGift ? 0 : (item.price * paidQuantity);
                const originalTotal = item.price * item.quantity;
                
                return (
                <div
                  key={`${item.product_id}_${item.isGift || false}`}
                  className={`bg-white rounded-lg border p-4 transition-all shadow-sm hover:shadow-md ${
                    isPaid
                      ? 'bg-green-50/50 border-green-200'
                      : isGift
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center space-x-2.5 mb-3">
                        {isPaid && (
                          <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        {paidQuantity > 0 && !isPaid && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <span className="text-white text-xs font-bold">{paidQuantity}/{item.quantity}</span>
                          </div>
                        )}
                        <p className={`text-base font-semibold leading-snug text-gray-900 ${
                          isPaid ? 'line-through text-green-700' : isGift ? 'line-through text-gray-500' : ''
                        }`}>
                          {item.product_name}
                        </p>
                        {isGift && (
                          <span className="text-[10px] font-bold text-white bg-amber-600 px-2 py-0.5 rounded uppercase tracking-wide">
                            İKRAM
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2 mb-2">
                        <p className="text-lg font-bold text-gray-900">
                          {item.quantity}
                        </p>
                        <p className="text-sm text-gray-500 font-medium">adet</p>
                        <p className="text-sm text-gray-400">×</p>
                        {isGift ? (
                          <>
                            <span className="line-through text-gray-400 text-sm font-medium">₺{item.price.toFixed(2)}</span>
                            <span className="text-green-700 font-bold text-base ml-1">₺0.00</span>
                          </>
                        ) : (
                          <p className="text-base font-semibold text-gray-800">₺{item.price.toFixed(2)}</p>
                        )}
                      </div>
                      {paidQuantity > 0 && paymentMethod && (
                        <p className={`text-xs font-medium mt-1.5 px-2 py-1 rounded ${
                          isPaid ? 'text-green-800 bg-green-100' : 'text-blue-800 bg-blue-100'
                        }`}>
                          {paidQuantity} adet {paymentMethod} ile ödendi
                          {!isPaid && ` • ${remainingQuantity} adet kaldı`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-3 flex-shrink-0">
                      <div className="text-right">
                        {isGift ? (
                          <p className="font-bold text-lg text-green-700">₺0.00</p>
                        ) : isPaid ? (
                          <p className="font-bold text-lg text-green-700 line-through">₺{displayTotal.toFixed(2)}</p>
                        ) : paidQuantity > 0 ? (
                          <div>
                            <p className="font-bold text-lg text-blue-700">₺{paidTotal.toFixed(2)}</p>
                            <p className="text-xs text-gray-400 line-through font-medium">₺{displayTotal.toFixed(2)}</p>
                          </div>
                        ) : (
                          <p className="font-bold text-lg text-gray-900">₺{displayTotal.toFixed(2)}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setSelectedItemDetail(item)}
                          className="w-8 h-8 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 transition-all p-1.5 flex items-center justify-center"
                          title="Detay"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleCancelItem(item)}
                            disabled={cancellingItemId === item.id}
                            className="w-8 h-8 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-lg text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all p-1.5 flex items-center justify-center"
                            title="İptal"
                          >
                            {cancellingItemId === item.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>

          {/* Toplam ve Kısmi Ödeme Bilgileri - Corporate */}
          <div className="bg-gray-50/50 rounded-lg p-6 border border-gray-200 space-y-4">
            {paidAmount > 0.01 && (
              <div className="flex justify-between items-center bg-green-50/50 rounded-lg p-4 border border-green-200">
                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ödenen Tutar</span>
                <span className="text-lg font-bold text-green-700">₺{paidAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-base font-semibold text-gray-700 uppercase tracking-wide">Toplam Tutar</span>
              <span className={`text-2xl font-bold ${
                paidAmount > 0.01 ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}>
                ₺{originalTotalAmount.toFixed(2)}
              </span>
            </div>
            {paidAmount > 0.01 && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                <span className="text-base font-semibold text-orange-700 uppercase tracking-wide">Kalan Tutar</span>
                <span className="text-2xl font-bold text-orange-700">₺{remainingAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Masayı Sonlandır ve Kısmi Ödeme Butonları - Corporate */}
          {order.status === 'pending' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={onRequestAdisyon}
                  className="px-5 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Adisyon Yazdır</span>
                </button>
                <button
                  onClick={onPartialPayment}
                  className="px-5 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Kısmi Ödeme</span>
                </button>
                <button
                  onClick={onAddItems}
                  className="px-5 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Sipariş Ekle</span>
                </button>
                <button
                  onClick={onCompleteTable}
                  className="px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Sonlandır</span>
                </button>
              </div>
              {/* Tüm Masayı İptal Et Butonu */}
              <button
                onClick={() => setShowCancelEntireTableModal(true)}
                className="w-full px-5 py-3.5 bg-gray-800 hover:bg-gray-900 text-white font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md border border-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Tüm Masayı İptal Et</span>
              </button>
            </div>
          )}

          {/* Durum - Corporate Badge */}
          {order.status !== 'pending' && (
            <div className="flex items-center justify-center pt-2">
              <span className={`px-5 py-2.5 rounded-lg font-semibold text-sm uppercase tracking-wide border ${
                order.status === 'completed'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {order.status === 'completed' ? '✓ Tamamlandı' : '✗ İptal Edildi'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* İptal Onay Modal */}
      {cancelConfirmItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-red-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Ürün İptali</h3>
              <p className="text-gray-600 text-sm">Bu ürünü iptal etmek istediğinize emin misiniz?</p>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 mb-6 border border-red-100">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Ürün Adı</p>
                  <p className="text-lg font-bold text-gray-900">{cancelConfirmItem.product_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Mevcut Adet</p>
                    <p className="text-base font-bold text-gray-900">{cancelConfirmItem.quantity} adet</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Birim Fiyat</p>
                    <p className="text-base font-bold text-gray-900">₺{cancelConfirmItem.price.toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Miktar Seçimi - Sadece 1'den fazla varsa göster */}
                {cancelConfirmItem.quantity > 1 && (
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <p className="text-xs font-semibold text-gray-500 mb-2">İptal Edilecek Adet</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCancelQuantity(Math.max(1, cancelQuantity - 1))}
                        disabled={cancelQuantity <= 1}
                        className="w-10 h-10 rounded-lg bg-white border-2 border-red-300 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={cancelConfirmItem.quantity}
                        value={cancelQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setCancelQuantity(Math.max(1, Math.min(val, cancelConfirmItem.quantity)));
                        }}
                        className="flex-1 px-4 py-2 text-center text-lg font-bold border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={() => setCancelQuantity(Math.min(cancelConfirmItem.quantity, cancelQuantity + 1))}
                        disabled={cancelQuantity >= cancelConfirmItem.quantity}
                        className="w-10 h-10 rounded-lg bg-white border-2 border-red-300 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {cancelQuantity === cancelConfirmItem.quantity 
                        ? 'Tüm ürün iptal edilecek' 
                        : `${cancelConfirmItem.quantity - cancelQuantity} adet kalacak`}
                    </p>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t-2 border-red-300">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-gray-500">İptal Edilecek Tutar</p>
                    <p className="text-lg font-bold text-red-600">
                      ₺{(cancelConfirmItem.price * cancelQuantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-800 font-medium">
                  İptal edildiğinde bu ürünün kategorisine atanan yazıcıdan iptal fişi yazdırılacaktır.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  setCancelConfirmItem(null);
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal Et
              </button>
              <button
                onClick={handlePreviewCancelReceipt}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Fişi Önizle</span>
              </button>
              <button
                onClick={confirmCancelItem}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {cancellingItemId === cancelConfirmItem.id ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>İptal Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Evet, İptal Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İptal Fişi Önizleme Modal */}
      {showCancelReceiptPreview && cancelReceiptHTML && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">İptal Fişi Önizleme</h3>
              <button
                onClick={() => {
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
              <div className="text-sm text-gray-600 mb-2">
                <p className="font-semibold">Bu fiş yazdırıldığında şu şekilde görünecektir:</p>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg p-4 overflow-x-auto" style={{ maxWidth: '220px', margin: '0 auto' }}>
              <iframe
                srcDoc={cancelReceiptHTML}
                className="w-full border-0"
                style={{ minHeight: '400px', width: '220px' }}
                title="İptal Fişi Önizleme"
              />
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün Detay Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold gradient-text">Ürün Detayı</h3>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Ürün Adı</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItemDetail.product_name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Adet</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedItemDetail.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Birim Fiyat</p>
                  <p className="text-lg font-semibold text-gray-800">₺{selectedItemDetail.price.toFixed(2)}</p>
                </div>
              </div>

              {selectedItemDetail.staff_name ? (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-500 mb-1">Siparişi Alan Garson</p>
                    <p className="text-lg font-semibold text-purple-600 flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{selectedItemDetail.staff_name}</span>
                    </p>
                  </div>
                  {selectedItemDetail.added_date && selectedItemDetail.added_time && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Eklenme Tarihi</p>
                        <p className="text-base font-semibold text-gray-800">{selectedItemDetail.added_date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Eklenme Saati</p>
                        <p className="text-base font-semibold text-gray-800">{selectedItemDetail.added_time}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-1">Siparişi Alan</p>
                  <p className="text-lg font-semibold text-gray-600">Kasa / Sistem</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* İptal Açıklaması Modal (Fiş yazdırıldıktan sonra) */}
      {showCancelReasonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-amber-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">İptal Açıklaması</h3>
              <p className="text-gray-600 text-sm">İptal fişi yazdırıldı. Lütfen iptal nedenini açıklayın:</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                İptal Açıklaması <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Örn: Müşteri istemedi, Yanlış sipariş, Ürün bozuk..."
                className="w-full min-h-[120px] px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y"
                autoFocus
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-800 font-medium">
                  İptal açıklaması zorunludur. Açıklama yazmadan işlem tamamlanamaz.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => {
                  setShowCancelReasonModal(false);
                  setCancelReason('');
                  setCancellingItemId(null);
                }}
                disabled={cancellingItemId !== null}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Geri Dön</span>
              </button>
              <button
                onClick={submitCancelReason}
                disabled={!cancelReason.trim() || cancellingItemId !== null}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {cancellingItemId ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Tamamla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tüm Masayı İptal Et Onay Modal - Elite Corporate Design */}
      {showCancelEntireTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in" onClick={() => !cancellingEntireTable && setShowCancelEntireTableModal(false)}>
          <div className="bg-white rounded-2xl p-10 max-w-lg w-full mx-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* Icon */}
            <div className="flex items-center justify-center mb-8">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-gray-200">
                <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            
            {/* Content */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
                Tüm Masayı İptal Et
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Bu işlem geri alınamaz. Sipariş, sanki hiç açılmamış gibi tamamen silinecektir.
              </p>
              
              {/* Masa Bilgisi */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">İptal Edilecek Masa</p>
                <p className="text-lg font-bold text-gray-900">{order.table_name}</p>
                <p className="text-xs text-gray-500 mt-1">{order.table_type === 'inside' ? 'İç Masa' : 'Dış Masa'}</p>
              </div>

              {/* İptal Açıklaması */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  İptal Açıklaması <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelEntireTableReason}
                  onChange={(e) => setCancelEntireTableReason(e.target.value)}
                  placeholder="İptal nedenini açıklayın..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 resize-none text-sm"
                  rows={3}
                  disabled={cancellingEntireTable}
                />
                {!cancelEntireTableReason.trim() && (
                  <p className="text-xs text-red-500 mt-1">İptal açıklaması zorunludur</p>
                )}
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCancelEntireTableModal(false);
                  setCancelEntireTableReason('');
                }}
                disabled={cancellingEntireTable}
                className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-all duration-200 border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                Vazgeç
              </button>
              <button
                onClick={async () => {
                  if (!cancelEntireTableReason.trim()) {
                    showToast('Lütfen iptal açıklaması yazın', 'error');
                    return;
                  }

                  if (!window.electronAPI || !window.electronAPI.cancelEntireTableOrder) {
                    showToast('İptal işlemi şu anda kullanılamıyor', 'error');
                    return;
                  }

                  setCancellingEntireTable(true);
                  try {
                    const result = await window.electronAPI.cancelEntireTableOrder(order.id, cancelEntireTableReason.trim());
                    if (result.success) {
                      setShowCancelEntireTableModal(false);
                      setCancelEntireTableReason('');
                      if (onCancelEntireTable) {
                        onCancelEntireTable();
                      }
                      onClose();
                    } else {
                      if (result.requiresReason) {
                        showToast('Lütfen iptal açıklaması yazın', 'error');
                      } else {
                        showToast(result.error || 'Masayı iptal ederken bir hata oluştu', 'error');
                      }
                      setCancellingEntireTable(false);
                    }
                  } catch (error) {
                    console.error('Masayı iptal etme hatası:', error);
                    showToast('Masayı iptal ederken bir hata oluştu', 'error');
                    setCancellingEntireTable(false);
                  }
                }}
                disabled={cancellingEntireTable || !cancelEntireTableReason.trim()}
                className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-w-[140px]"
              >
                {cancellingEntireTable ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>İptal Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>İptal Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
  );
};

export default TableOrderModal;

