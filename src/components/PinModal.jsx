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

  // Klavye desteği
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Başarılı girişten sonra klavye desteğini devre dışı bırak
      if (success) return;

      // Sayı tuşları (0-9)
      if (event.key >= '0' && event.key <= '9') {
        if (pin.length < 4) {
          handleNumberClick(event.key);
        }
        event.preventDefault();
      }
      // Backspace veya Delete - Son karakteri sil
      else if (event.key === 'Backspace' || event.key === 'Delete') {
        if (pin.length > 0) {
          handleDelete();
        }
        event.preventDefault();
      }
      // Escape - Modal'ı kapat
      else if (event.key === 'Escape') {
        onClose();
        event.preventDefault();
      }
      // Enter - PIN 4 haneli ise doğrula
      else if (event.key === 'Enter') {
        if (pin.length === 4) {
          validatePin();
        }
        event.preventDefault();
      }
    };

    // Event listener ekle
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin, success]);

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
      <div className="flex items-center justify-center space-x-4 mb-10">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
              error
                ? 'border-red-400 bg-red-50 animate-shake'
                : success
                ? 'border-emerald-500 bg-emerald-50 scale-105'
                : pin.length > index
                ? 'border-blue-600 bg-blue-600 shadow-md scale-105'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {pin.length > index && (
              <div className={`text-2xl font-bold ${success ? 'text-emerald-600' : 'text-white'}`}>
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
      className="w-20 h-20 rounded-xl bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm hover:shadow-md"
    >
      <span className="text-2xl font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
        {number}
      </span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[999] animate-fade-in px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl transform animate-scale-in relative overflow-hidden border border-gray-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
      
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
      >
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

        <div className="text-center mb-8 pt-4">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Girişi</h2>
          <p className={`text-sm transition-all font-medium ${
            error 
              ? 'text-red-600' 
              : success 
              ? 'text-emerald-600' 
              : 'text-gray-600'
          }`}>
            {error ? 'Hatalı PIN. Lütfen tekrar deneyin.' : success ? 'Giriş başarılı!' : '4 haneli PIN kodunuzu girin'}
          </p>
        </div>

        {renderPinDots()}

        <div className="w-full flex justify-center">
          <div className="grid grid-cols-3 gap-3 mb-6 max-w-xs">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <NumberButton key={num} number={num} />
            ))}
            
            <button
              onClick={handleClear}
              disabled={success || pin.length === 0}
              className="w-20 h-20 rounded-xl bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 hover:border-gray-300 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              <span className="text-base font-semibold text-gray-700">C</span>
            </button>

            <NumberButton number={0} />

            <button
              onClick={handleDelete}
              disabled={success || pin.length === 0}
              className="w-20 h-20 rounded-xl bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 hover:border-gray-300 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-blue-700 font-medium">
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

