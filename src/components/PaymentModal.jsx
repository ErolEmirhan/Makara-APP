import React from 'react';

const PaymentModal = ({ totalAmount, onSelectPayment, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2 gradient-text">Ödeme Yöntemi Seçin</h2>
          <p className="text-gray-300">Toplam Tutar</p>
          <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ₺{totalAmount.toFixed(2)}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={() => onSelectPayment('Nakit')}
            className="w-full p-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-2xl text-white font-bold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Nakit Ödeme</span>
            </div>
          </button>

          <button
            onClick={() => onSelectPayment('Kredi Kartı')}
            className="w-full p-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-2xl text-white font-bold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Kredi Kartı</span>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 hover:text-white font-medium transition-all duration-300"
        >
          İptal
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;

