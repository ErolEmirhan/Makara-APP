import React from 'react';

const Cart = ({ cart, onUpdateQuantity, onRemoveItem, onClearCart, onCheckout, totalAmount }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold gradient-text">Sepet</h2>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-custom space-y-2 mb-6">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-24 h-24 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-gray-400">Sepetiniz boş</p>
            <p className="text-sm text-gray-500 mt-2">Ürün eklemek için tıklayın</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="cart-item animate-fade-in">
              <div className="flex-1">
                <h4 className="font-medium text-white mb-1">{item.name}</h4>
                <p className="text-sm text-purple-300">₺{item.price.toFixed(2)}</p>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="w-7 h-7 bg-red-500/20 hover:bg-red-500/30 rounded flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <div className="text-right min-w-[80px]">
                  <p className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    ₺{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/10 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Ara Toplam</span>
          <span className="text-white font-medium">₺{totalAmount.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center text-lg font-bold">
          <span>TOPLAM</span>
          <span className="text-3xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ₺{totalAmount.toFixed(2)}
          </span>
        </div>

        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
            cart.length === 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Ödeme Al</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Cart;

