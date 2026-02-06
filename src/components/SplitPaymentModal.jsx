import React, { useState, useEffect } from 'react';
import Toast from './Toast';

const SplitPaymentModal = ({ cart, totalAmount, onCompleteSplitPayment, onClose, isSubmitting = false }) => {
  const [payments, setPayments] = useState([]); // [{ amount: 50, method: 'Nakit' }, ...]
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState('Nakit');
  const [currentAmount, setCurrentAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState(totalAmount);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    // Kalan tutarı hesapla
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    setRemainingAmount(totalAmount - paidAmount);
  }, [payments, totalAmount]);

  const handleAddPayment = () => {
    const amount = parseFloat(currentAmount);
    
    if (!amount || amount <= 0) {
      showToast('Lütfen geçerli bir tutar girin!', 'warning');
      return;
    }

    if (amount > remainingAmount) {
      showToast(`Girilen tutar kalan tutardan (₺${remainingAmount.toFixed(2)}) fazla olamaz!`, 'warning');
      return;
    }

    // Yeni ödeme ekle
    setPayments(prev => [...prev, {
      amount: amount,
      method: currentPaymentMethod
    }]);

    // Formu temizle
    setCurrentAmount('');
  };

  const handleRemovePayment = (index) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (remainingAmount > 0.01) { // Kuruş farkı için tolerans
      showToast(`Kalan tutar (₺${remainingAmount.toFixed(2)}) ödenmemiş!`, 'warning');
      return;
    }

    if (payments.length === 0) {
      showToast('Lütfen en az bir ödeme ekleyin!', 'warning');
      return;
    }

    // Ödemeleri doğrudan gönder (App.jsx'te işlenecek)
    onCompleteSplitPayment(payments);
  };

  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold gradient-text">Parçalı Ödeme</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toplam ve Kalan Tutar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Toplam Tutar</p>
            <p className="text-2xl font-bold text-purple-600">
              ₺{totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
            <p className="text-sm text-gray-600 mb-1">Ödenen</p>
            <p className="text-2xl font-bold text-green-600">
              ₺{paidAmount.toFixed(2)}
            </p>
          </div>
          <div className={`rounded-2xl p-4 border ${
            remainingAmount > 0.01 
              ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' 
              : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
          }`}>
            <p className="text-sm text-gray-600 mb-1">Kalan</p>
            <p className={`text-2xl font-bold ${
              remainingAmount > 0.01 ? 'text-orange-600' : 'text-green-600'
            }`}>
              ₺{remainingAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Ödeme Ekleme Alanı */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-6 border border-purple-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Yeni Ödeme Ekle</h3>
          
          {/* Ödeme Yöntemi Seçimi */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setCurrentPaymentMethod('Nakit')}
              className={`p-4 rounded-xl font-semibold transition-all duration-300 ${
                currentPaymentMethod === 'Nakit'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-green-50 border-2 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Nakit</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentPaymentMethod('Kredi Kartı')}
              className={`p-4 rounded-xl font-semibold transition-all duration-300 ${
                currentPaymentMethod === 'Kredi Kartı'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border-2 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Kredi Kartı</span>
              </div>
            </button>
          </div>

          {/* Tutar Girişi */}
          <div className="flex space-x-3">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingAmount}
              value={currentAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || parseFloat(value) >= 0) {
                  setCurrentAmount(value);
                }
              }}
              placeholder="Tutar girin (₺)"
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:outline-none text-lg font-semibold"
            />
            <button
              onClick={handleAddPayment}
              disabled={!currentAmount || parseFloat(currentAmount) <= 0 || parseFloat(currentAmount) > remainingAmount}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-lg"
            >
              Ekle
            </button>
          </div>
          {currentAmount && parseFloat(currentAmount) > remainingAmount && (
            <p className="text-red-500 text-sm mt-2">Girilen tutar kalan tutardan fazla!</p>
          )}
        </div>

        {/* Eklenen Ödemeler Listesi */}
        {payments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Eklenen Ödemeler</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {payments.map((payment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-300 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      payment.method === 'Nakit' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {payment.method === 'Nakit' ? '₺' : '💳'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{payment.method}</p>
                      <p className="text-sm text-gray-500">{new Date().toLocaleTimeString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <p className="text-xl font-bold text-purple-600">₺{payment.amount.toFixed(2)}</p>
                    <button
                      onClick={() => handleRemovePayment(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alt Butonlar */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-semibold text-lg transition-all duration-300"
          >
            İptal
          </button>
          <button
            onClick={handleComplete}
            disabled={payments.length === 0 || remainingAmount > 0.01 || isSubmitting}
            className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center space-x-2">
              {isSubmitting ? (
                <>
                  <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                  <span>İşleniyor...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ödemeleri Tamamla</span>
                </>
              )}
            </div>
          </button>
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

export default SplitPaymentModal;
