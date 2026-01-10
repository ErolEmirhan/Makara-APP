import React from 'react';

const OnlineOrderModal = ({ order, items, onClose, onRequestAdisyon, onPrepareProducts, onCancelOrder }) => {
  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">
        {/* Minimal Header */}
        <div className="relative bg-white px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-lg font-bold text-gray-900">Online Sipariş</h2>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded border border-gray-300">
                    #{order.id.slice(-8).toUpperCase()}
                  </span>
                  {order.status === 'pending' && (
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-semibold rounded flex items-center gap-1">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                      Beklemede
                    </span>
                  )}
                  {order.status === 'completed' && (
                    <span className="px-2 py-0.5 bg-gray-300 text-gray-700 text-[10px] font-semibold rounded flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Tamamlandı
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all flex items-center justify-center border border-gray-200 hover:text-gray-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 bg-white">
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Sol Taraf - Müşteri ve Ürünler */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
              {/* Müşteri Bilgileri */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Müşteri Bilgileri</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">İsim</p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{order.customer_name || order.name || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Telefon</p>
                    <p className="text-xs font-semibold text-gray-900">{order.customer_phone || order.phone || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Ödeme</p>
                    <p className="text-xs font-semibold text-gray-900">
                      {order.paymentMethod === 'card' ? 'Kart' : 
                       order.paymentMethod === 'cash' ? 'Nakit' : 
                       order.paymentMethod || '-'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Adres</p>
                  <p className="text-xs font-medium text-gray-900 line-clamp-2">{order.customer_address || order.address || '-'}</p>
                </div>
                
                {/* Sipariş Notu */}
                {(order.note || order.orderNote || order.order_note) && (
                  <div className="mt-3 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="text-[10px] font-semibold text-amber-700 uppercase">Not</p>
                    </div>
                    <p className="text-xs font-medium text-gray-900 line-clamp-2">
                      {order.note || order.orderNote || order.order_note}
                    </p>
                  </div>
                )}
              </div>

              {/* Ürünler */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Ürünler</h3>
                  </div>
                  <span className="px-2.5 py-1 bg-gray-200 text-gray-700 text-[10px] font-semibold rounded-lg">
                    {(items || []).length} Adet
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2">
                    {(items || []).map((item, idx) => {
                      const itemName = item.name || item.product_name || '';
                      const itemPrice = item.price || 0;
                      const itemQuantity = item.quantity || 1;
                      const itemTotal = itemPrice * itemQuantity;
                      
                      return (
                        <div
                          key={idx}
                          className="bg-gray-50 rounded-lg p-2.5 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                        >
                          <p className="text-xs font-semibold text-gray-900 mb-1.5 truncate">{itemName}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600">
                              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold">
                                {itemQuantity}x
                              </span>
                              <span>₺{itemPrice.toFixed(2)}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                              ₺{itemTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ Taraf - Sipariş Detayları ve Butonlar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              {/* Sipariş Bilgileri */}
              <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-gray-200">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Sipariş Detayları</h3>
                </div>
                
                <div className="space-y-2.5">
                  <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Tarih</p>
                    <p className="text-xs font-semibold text-gray-900">{order.formattedDate || '-'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Saat</p>
                    <p className="text-xs font-semibold text-gray-900">{order.formattedTime || '-'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border-2 border-gray-300 mt-3">
                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Toplam</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₺{(order.total_amount || order.total || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 flex-1 justify-end">
                <button
                  onClick={onRequestAdisyon}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 border border-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Adisyon İste</span>
                </button>
                <button
                  onClick={onPrepareProducts}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 border border-orange-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Ürünleri Hazırlat</span>
                </button>

                {/* Bottom Action Buttons */}
                {order.status === 'pending' && (
                  <button
                    onClick={onCancelOrder}
                    className="w-full px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow border border-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>İptal Et</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineOrderModal;
