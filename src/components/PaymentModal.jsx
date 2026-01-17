import React, { useState } from 'react';

const PaymentModal = ({ totalAmount, onSelectPayment, onClose }) => {
  const [showCampaign, setShowCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const campaignOptions = [10, 15, 20, 25, 50];
  
  const calculateDiscount = (percentage) => {
    return (totalAmount * percentage) / 100;
  };

  const calculateFinalAmount = (percentage) => {
    return totalAmount - calculateDiscount(percentage);
  };

  const handleCampaignSelect = (percentage) => {
    setSelectedCampaign(percentage);
    setShowCampaign(false);
  };

  const handlePaymentSelect = (paymentMethod) => {
    onSelectPayment(paymentMethod, selectedCampaign);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2 gradient-text">Ödeme Yöntemi Seçin</h2>
          {selectedCampaign ? (
            <div className="space-y-2">
              <p className="text-gray-600">Orijinal Tutar</p>
              <p className="text-2xl font-bold text-gray-400 line-through">
                ₺{totalAmount.toFixed(2)}
              </p>
              <p className="text-gray-600">Kampanya: %{selectedCampaign} İndirim</p>
              <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ₺{calculateFinalAmount(selectedCampaign).toFixed(2)}
              </p>
              <p className="text-sm text-green-600 font-semibold">
                İndirim: -₺{calculateDiscount(selectedCampaign).toFixed(2)}
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600">Toplam Tutar</p>
              <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ₺{totalAmount.toFixed(2)}
              </p>
            </>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={() => handlePaymentSelect('Nakit')}
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
            onClick={() => handlePaymentSelect('Kredi Kartı')}
            className="w-full p-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-2xl text-white font-bold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Kredi Kartı</span>
            </div>
          </button>

          <button
            onClick={() => setShowCampaign(!showCampaign)}
            className="w-full p-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-2xl text-white font-bold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Kampanya Uygula</span>
            </div>
          </button>

          {showCampaign && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2">
              <p className="text-center font-semibold text-amber-800 mb-3">Kampanya Seçin</p>
              <div className="grid grid-cols-3 gap-2">
                {campaignOptions.map((percentage) => (
                  <button
                    key={percentage}
                    onClick={() => handleCampaignSelect(percentage)}
                    className={`p-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                      selectedCampaign === percentage
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105'
                        : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'
                    }`}
                  >
                    %{percentage}
                  </button>
                ))}
              </div>
              {selectedCampaign && (
                <button
                  onClick={() => {
                    setSelectedCampaign(null);
                    setShowCampaign(false);
                  }}
                  className="w-full mt-2 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition-all"
                >
                  Kampanyayı Kaldır
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => onSelectPayment('split')}
            className="w-full p-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-2xl text-white font-bold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Ayrı Ödemeler Al</span>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-medium transition-all duration-300"
        >
          İptal
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;

