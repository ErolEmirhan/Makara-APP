import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const Cart = ({ cart, onUpdateQuantity, onRemoveItem, onClearCart, onCheckout, onSaveToTable, totalAmount, selectedTable, orderNote, onOrderNoteChange, onToggleGift, onRequestAdisyon }) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState(orderNote || '');
  const textareaRef = useRef(null);
  
  useEffect(() => {
    setNoteText(orderNote || '');
  }, [orderNote]);
  
  useEffect(() => {
    if (showNoteModal && textareaRef.current) {
      // Modal açıldığında textarea'ya focus et
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [showNoteModal]);
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold gradient-text">Sepet</h2>
            <p className="text-sm text-gray-500">{cart.length > 0 ? `${cart.length} ürün` : 'Ürün seçin'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-custom space-y-2 mb-6">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-24 h-24 mx-auto text-purple-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-gray-600">Sepetiniz boş</p>
            <p className="text-sm text-gray-500 mt-2">Ürün eklemek için tıklayın</p>
          </div>
        ) : (
          cart.map((item) => {
            const isGift = item.isGift || false;
            const displayPrice = isGift ? 0 : item.price;
            const displayTotal = isGift ? 0 : (item.price * item.quantity);
            
            return (
            <div key={item.id} className={`cart-item animate-fade-in ${isGift ? 'opacity-75' : ''}`}>
              <div className="flex-1">
                <h4 className={`font-medium mb-1 ${isGift ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                  {item.name}
                </h4>
                <div className="flex items-center space-x-2">
                  <p className={`text-sm ${isGift ? 'text-gray-400 line-through' : 'text-purple-600'}`}>
                    ₺{item.price.toFixed(2)}
                  </p>
                  {isGift && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      İKRAM - ₺0.00
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 bg-purple-50 rounded-lg p-1">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 bg-white hover:bg-purple-100 rounded flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  
                  <span className="w-8 text-center font-medium text-gray-800">{item.quantity}</span>
                  
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 bg-white hover:bg-purple-100 rounded flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => onToggleGift && onToggleGift(item.id)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-all whitespace-nowrap ${
                    isGift 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                  title={isGift ? 'İkramı İptal Et' : 'İkram Et'}
                >
                  {isGift ? '✓' : 'İkram'}
                </button>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="w-7 h-7 bg-red-500/20 hover:bg-red-500/30 rounded flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <div className="text-right min-w-[80px]">
                  {isGift ? (
                    <div>
                      <p className="text-xs text-gray-400 line-through">₺{(item.price * item.quantity).toFixed(2)}</p>
                      <p className="font-bold text-lg text-green-600">₺0.00</p>
                    </div>
                  ) : (
                    <p className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      ₺{(item.price * item.quantity).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )})
        )}
      </div>

      <div className="border-t border-purple-200 pt-6 space-y-4">
        {cart.length > 0 && (
          <div className="flex justify-between items-center pb-4">
            <span className="text-sm text-gray-500">Sepeti temizle</span>
            <button
              onClick={onClearCart}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              Temizle
            </button>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Ara Toplam</span>
          <span className="text-gray-800 font-medium">₺{totalAmount.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center text-lg font-bold text-gray-900">
          <span>TOPLAM</span>
          <span className="text-3xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ₺{totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Order Note Button */}
        {cart.length > 0 && (
          <button
            onClick={() => setShowNoteModal(true)}
            className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 text-amber-700 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>{orderNote ? 'Not Düzenle' : 'Not Ekle'}</span>
            </div>
            {orderNote && (
              <span className="px-2 py-0.5 bg-amber-200 rounded-full text-xs font-bold">
                ✓
              </span>
            )}
          </button>
        )}

        {selectedTable ? (
          <div className="space-y-3">
            <button
              onClick={onSaveToTable}
              disabled={cart.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                cart.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Masaya Kaydet</span>
              </div>
            </button>
            <button
              onClick={onRequestAdisyon}
              disabled={cart.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                cart.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Adisyon İste</span>
              </div>
            </button>
          </div>
        ) : (
          <button
            onClick={onCheckout}
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
              cart.length === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Ödeme Al</span>
            </div>
          </button>
        )}
      </div>

      {/* Order Note Modal */}
      {showNoteModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[999] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform animate-scale-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500"></div>
            
            <button
              onClick={() => {
                setShowNoteModal(false);
                setNoteText(orderNote || '');
              }}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:rotate-90"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold gradient-text mb-2">Sipariş Notu</h2>
              <p className="text-sm text-gray-500">Sipariş içeriği ile ilgili not ekleyin</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Not (Örn: Sütü az olacak, Ekstra peynir, vs.)
                </label>
                <textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setNoteText(newValue);
                  }}
                  onInput={(e) => {
                    // Dokunmatik klavye için input event'ini handle et
                    const newValue = e.target.value;
                    setNoteText(newValue);
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-500 focus:outline-none transition-all resize-none"
                  placeholder="Sipariş notunuzu buraya yazın..."
                  rows="4"
                  maxLength={200}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{noteText.length}/200</p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowNoteModal(false);
                    setNoteText(orderNote || '');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    if (onOrderNoteChange) {
                      onOrderNoteChange(noteText.trim());
                    }
                    setShowNoteModal(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Cart;

