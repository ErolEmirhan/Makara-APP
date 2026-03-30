import React, { useState } from 'react';

const ReceiptModal = ({ saleInfo, items, onClose, onPrint }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!saleInfo) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString('tr-TR');
    return dateStr;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return new Date().toLocaleTimeString('tr-TR');
    return timeStr;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    
    try {
      await onPrint();
      // Kısa bir gecikme sonra disabled'ı kaldır
      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    } catch (error) {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-white backdrop-blur-xl border border-pink-200 theme-sultan:border-emerald-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold gradient-text">Fiş Yazdır</h2>
            <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
          </div>

        {/* Fiş Önizleme - 58mm genişlik */}
        <div 
          id="receipt-content"
          className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 mb-6 mx-auto"
          style={{ width: '220px', minHeight: 'auto', maxWidth: '220px' }}
        >
          <div className="text-center mb-4">
            <h3 className="font-bold text-lg mb-1">MAKARA</h3>
            <p className="text-xs text-gray-600">
              {saleInfo.tableName ? 'Masa Siparişi' : 'Satış Fişi'}
            </p>
          </div>
          
          <div className="border-t border-b border-gray-300 py-2 mb-2">
            {saleInfo.tableName && (
              <div className="flex justify-between text-xs mb-1">
                <span>Masa:</span>
                <span className="font-semibold">{saleInfo.tableName}</span>
              </div>
            )}
            <div className="flex justify-between text-xs mb-1">
              <span>Tarih:</span>
              <span className="font-semibold">{formatDate(saleInfo.sale_date)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Saat:</span>
              <span className="font-semibold">{formatTime(saleInfo.sale_time)}</span>
            </div>
            {(saleInfo.sale_id || saleInfo.order_id) && (
              <div className="flex justify-between text-xs mt-1">
                <span>{saleInfo.order_id ? 'Sipariş No:' : 'Fiş No:'}</span>
                <span className="font-semibold">#{saleInfo.sale_id || saleInfo.order_id}</span>
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="border-b border-gray-300 pb-2 mb-2">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Ürün</span>
                <span>Toplam</span>
              </div>
            </div>
            {items.map((item, index) => {
              const isGift = item.isGift || false;
              const displayPrice = isGift ? 0 : item.price;
              const displayTotal = isGift ? 0 : (item.price * item.quantity);
              
              return (
                <div key={index} className="mb-2 text-xs">
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${isGift ? 'text-gray-500 line-through' : ''}`}>
                        {item.name}
                      </span>
                      {isGift && (
                        <span className="text-xs font-bold text-fuchsia-600 theme-sultan:text-green-600 bg-fuchsia-50 theme-sultan:bg-green-50 px-1.5 py-0.5 rounded">
                          İKRAM
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {isGift ? (
                        <div>
                          <span className="font-semibold text-gray-400 line-through text-xs block">
                            ₺{(item.price * item.quantity).toFixed(2)}
                          </span>
                          <span className="font-semibold text-fuchsia-600 theme-sultan:text-green-600">₺0.00</span>
                        </div>
                      ) : (
                        <span className="font-semibold">₺{displayTotal.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {item.quantity} adet × {isGift ? (
                        <>
                          <span className="line-through text-gray-400">₺{item.price.toFixed(2)}</span>
                          <span className="text-fuchsia-600 theme-sultan:text-green-600 font-semibold ml-1">₺0.00</span>
                        </>
                      ) : (
                        `₺${item.price.toFixed(2)}`
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {saleInfo.orderNote && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">📝 Sipariş Notu:</p>
              <p className="text-xs text-amber-800">{saleInfo.orderNote}</p>
            </div>
          )}

          <div className="border-t-2 border-gray-400 pt-2 mt-3">
            {saleInfo.campaign_percentage ? (
              <>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>TOPLAM:</span>
                  <span className="line-through text-gray-400">₺{(saleInfo.original_amount || items.reduce((sum, item) => {
                    if (item.isGift) return sum;
                    return sum + (item.price * item.quantity);
                  }, 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold mb-1 text-amber-700">
                  <span>Kampanya: %{saleInfo.campaign_percentage}</span>
                  <span>-₺{(saleInfo.discount_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span>ÖDENECEK:</span>
                  <span>₺{(saleInfo.totalAmount || items.reduce((sum, item) => {
                    if (item.isGift) return sum;
                    return sum + (item.price * item.quantity);
                  }, 0)).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm font-bold mb-1">
                <span>TOPLAM:</span>
                <span>₺{items.reduce((sum, item) => {
                  // İkram edilen ürünleri toplamdan çıkar
                  if (item.isGift) return sum;
                  return sum + (item.price * item.quantity);
                }, 0).toFixed(2) || '0.00'}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-600">
              <span>Ödeme:</span>
              <span>{saleInfo.paymentMethod || 'Nakit'}</span>
            </div>
          </div>

          <div className="text-center mt-4 pt-3 border-t border-gray-300">
            <p className="text-xs text-gray-500">Teşekkür ederiz!</p>
            <p className="text-xs text-gray-500 mt-1">İyi günler dileriz</p>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-semibold text-lg transition-all duration-300"
          >
            Kapat
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 py-4 bg-gradient-to-r from-fuchsia-500 theme-sultan:from-green-500 to-pink-500 theme-sultan:to-emerald-500 hover:from-fuchsia-600 theme-sultan:hover:from-fuchsia-600 theme-sultan:from-green-600 hover:to-pink-600 theme-sultan:hover:to-emerald-600 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="flex items-center justify-center space-x-2">
              {isPrinting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Yazdırılıyor...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Yazdır</span>
                </>
              )}
            </div>
          </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReceiptModal;

