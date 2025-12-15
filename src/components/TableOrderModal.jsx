import React, { useState, useEffect } from 'react';

const TableOrderModal = ({ order, items, onClose, onCompleteTable, onPartialPayment, onRequestAdisyon, onAddItems, onItemCancelled }) => {
  const [sessionDuration, setSessionDuration] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [cancellingItemId, setCancellingItemId] = useState(null);
  const [cancelConfirmItem, setCancelConfirmItem] = useState(null);
  const [cancelQuantity, setCancelQuantity] = useState(1);
  const [showCancelReceiptPreview, setShowCancelReceiptPreview] = useState(false);
  const [cancelReceiptHTML, setCancelReceiptHTML] = useState(null);

  if (!order) return null;

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

  // Başlangıç toplam tutarı (ikram edilen ürünler hariç)
  const originalTotalAmount = items.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * item.quantity);
  }, 0);
  // Şu anki kalan tutar (order.total_amount)
  const remainingAmount = order.total_amount || 0;
  // Ödenen kısmi ödeme tutarı
  const paidAmount = originalTotalAmount - remainingAmount;

  // Ürün iptal etme fonksiyonu
  const handleCancelItem = (item) => {
    if (!window.electronAPI || !window.electronAPI.cancelTableOrderItem) {
      alert('İptal işlemi şu anda kullanılamıyor');
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
      alert('Fiş önizleme özelliği şu anda kullanılamıyor');
      return;
    }

    try {
      const result = await window.electronAPI.previewCancelReceipt(cancelConfirmItem.id, cancelQuantity);
      if (result.success) {
        setCancelReceiptHTML(result.html);
        setShowCancelReceiptPreview(true);
      } else {
        alert(result.error || 'Fiş önizlemesi oluşturulamadı');
      }
    } catch (error) {
      console.error('Fiş önizleme hatası:', error);
      alert('Fiş önizlemesi oluşturulurken bir hata oluştu');
    }
  };

  // İptal onayı
  const confirmCancelItem = async () => {
    if (!cancelConfirmItem) return;

    if (cancelQuantity <= 0 || cancelQuantity > cancelConfirmItem.quantity) {
      alert('Geçersiz iptal miktarı');
      return;
    }

    setCancellingItemId(cancelConfirmItem.id);
    try {
      const result = await window.electronAPI.cancelTableOrderItem(cancelConfirmItem.id, cancelQuantity);
      if (result.success) {
        // Başarılı - parent component'e bildir
        setCancelConfirmItem(null);
        setCancelQuantity(1);
        setShowCancelReceiptPreview(false);
        setCancelReceiptHTML(null);
        if (onItemCancelled) {
          onItemCancelled();
        }
      } else {
        alert(result.error || 'Ürün iptal edilemedi');
      }
    } catch (error) {
      console.error('Ürün iptal hatası:', error);
      alert('Ürün iptal edilirken bir hata oluştu');
    } finally {
      setCancellingItemId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-3xl p-8 max-w-5xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold gradient-text">Masa Sipariş Detayları</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Masa Bilgileri */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Masa</p>
                <p className="text-xl font-bold text-gray-800">{order.table_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Masa Tipi</p>
                <p className="text-xl font-bold text-gray-800">
                  {order.table_type === 'inside' ? 'İç Masa' : 'Dış Masa'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Sipariş Tarihi</p>
                <p className="text-lg font-semibold text-gray-800">{order.order_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Sipariş Saati</p>
                <p className="text-lg font-semibold text-gray-800">{order.order_time}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Oturum Süresi</p>
                <p className="text-lg font-semibold text-blue-600">{sessionDuration}</p>
              </div>
              {order.staff_name && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sipariş Alan Garson</p>
                  <p className="text-lg font-semibold text-purple-600 flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{order.staff_name}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ürünler */}
          <div>
            <h3 className="text-xl font-bold mb-4 gradient-text">Ürünler</h3>
            <div className="space-y-3">
              {items.map((item) => {
                const isGift = item.isGift || false;
                const displayTotal = isGift ? 0 : (item.price * item.quantity);
                const originalTotal = item.price * item.quantity;
                
                return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors ${isGift ? 'opacity-75' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className={`font-semibold ${isGift ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {item.product_name}
                      </p>
                      {isGift && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          İKRAM
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.quantity} adet × {isGift ? (
                        <>
                          <span className="line-through text-gray-400">₺{item.price.toFixed(2)}</span>
                          <span className="text-green-600 font-semibold ml-1">₺0.00</span>
                        </>
                      ) : (
                        `₺${item.price.toFixed(2)}`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                  <div className="text-right">
                    {isGift ? (
                      <div>
                        <p className="text-xs text-gray-400 line-through">₺{originalTotal.toFixed(2)}</p>
                        <p className="font-bold text-lg text-green-600">₺0.00</p>
                      </div>
                    ) : (
                      <p className="font-bold text-lg text-purple-600">
                        ₺{displayTotal.toFixed(2)}
                      </p>
                    )}
                    </div>
                    <button
                      onClick={() => setSelectedItemDetail(item)}
                      className="p-2 hover:bg-purple-100 rounded-lg transition-colors text-purple-600 hover:text-purple-700"
                      title="Sipariş Detayı"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleCancelItem(item)}
                        disabled={cancellingItemId === item.id}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Ürünü İptal Et"
                      >
                        {cancellingItemId === item.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )})}
            </div>
          </div>

          {/* Toplam ve Kısmi Ödeme Bilgileri */}
          <div className="border-t border-purple-200 pt-6 space-y-4">
            {/* Ödenen Kısmi Ödeme */}
            {paidAmount > 0.01 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Ödenen Kısmi Ödeme</p>
                <p className="text-xl font-bold text-green-600">
                  ₺{paidAmount.toFixed(2)}
                </p>
              </div>
            )}

            {/* Toplam Tutar (Başlangıç) */}
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold text-gray-700">Toplam Tutar</span>
              <span className={`text-3xl font-bold ${
                paidAmount > 0.01 
                  ? 'text-gray-400 line-through' 
                  : 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'
              }`}>
                ₺{originalTotalAmount.toFixed(2)}
              </span>
            </div>

            {/* Kalan Tutar */}
            {paidAmount > 0.01 && (
              <div className="flex justify-between items-center pt-2 border-t border-purple-200">
                <span className="text-xl font-semibold text-orange-600">Kalan Tutar</span>
                <span className="text-3xl font-bold text-orange-600">
                  ₺{remainingAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Masayı Sonlandır ve Kısmi Ödeme Butonları */}
          {order.status === 'pending' && (
            <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
              <button
                onClick={onRequestAdisyon}
                className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Adisyon İste</span>
                </div>
              </button>
              <button
                onClick={onPartialPayment}
                className="px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Kısmi Ödeme Al</span>
                </div>
              </button>
              <button
                onClick={onAddItems}
                className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Sipariş Ekle</span>
                </div>
              </button>
              <button
                onClick={onCompleteTable}
                className="px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Masayı Sonlandır</span>
                </div>
              </button>
            </div>
          )}

          {/* Durum */}
          {order.status !== 'pending' && (
            <div className="flex items-center justify-center">
              <span className={`px-4 py-2 rounded-full font-semibold ${
                order.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {order.status === 'completed' ? 'Tamamlandı' : 'İptal Edildi'}
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
    </div>
  );
};

export default TableOrderModal;

