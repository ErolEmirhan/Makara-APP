import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const PinModal = ({ onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [correctPin, setCorrectPin] = useState('1234');

  useEffect(() => {
    const loadPin = async () => {
      const pin = await window.electronAPI.getAdminPin();
      setCorrectPin(pin);
    };
    loadPin();
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      validatePin();
    }
  }, [pin]);

  const validatePin = () => {
    if (pin === correctPin) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } else {
      setError(true);
      setTimeout(() => {
        setError(false);
        setPin('');
      }, 600);
    }
  };

  const handleNumberClick = (num) => {
    if (pin.length < 4 && !success) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const renderPinDots = () => {
    return (
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${
              error
                ? 'border-red-500 bg-red-50 animate-shake'
                : success
                ? 'border-green-500 bg-green-50 scale-110'
                : pin.length > index
                ? 'border-purple-500 bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg scale-110'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            {pin.length > index && (
              <div className={`text-3xl font-bold ${success ? 'text-green-600' : 'text-white'}`}>
                {success ? '✓' : '●'}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const NumberButton = ({ number }) => (
    <button
      onClick={() => handleNumberClick(number.toString())}
      disabled={success}
      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <span className="text-3xl font-bold text-gray-700 group-hover:text-purple-600 transition-colors">
        {number}
      </span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[999] animate-fade-in px-4">
      <div className="bg-white rounded-3xl p-10 w-full max-w-xl shadow-2xl transform animate-scale-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
      
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:rotate-90"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Admin Girişi</h2>
          <p className={`text-sm transition-all ${error ? 'text-red-500 font-semibold' : success ? 'text-green-500 font-semibold' : 'text-gray-500'}`}>
            {error ? '❌ Hatalı PIN! Tekrar deneyin.' : success ? '✅ Giriş Başarılı!' : '4 haneli PIN kodunuzu girin'}
          </p>
        </div>

        {renderPinDots()}

        <div className="w-full flex justify-center">
          <div className="grid grid-cols-3 gap-5 mb-6 mt-12 max-w-sm">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <NumberButton key={num} number={num} />
            ))}
            
            <button
              onClick={handleClear}
              disabled={success || pin.length === 0}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-400 hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-lg font-bold text-white">C</span>
            </button>

            <NumberButton number={0} />

            <button
              onClick={handleDelete}
              disabled={success || pin.length === 0}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-400 to-pink-400 hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full border border-purple-200">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-gray-600 font-medium">
              Güvenli Admin Paneli
            </span>
          </div>
        </div>
      
      </div>
    </div>,
    document.body
  );
};

export default PinModal;

