import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PrintToast = ({ status, message, onClose, autoHideDuration = 3000 }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!status) return;
    setIsClosing(false);
    if (!autoHideDuration) return;
    const timer = setTimeout(() => setIsClosing(true), autoHideDuration - 200);
    return () => clearTimeout(timer);
  }, [status, autoHideDuration]);

  useEffect(() => {
    if (!isClosing) return;
    const timer = setTimeout(() => onClose?.(), 200);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  if (!status) return null;

  const animationClass = isClosing ? 'animate-toast-slide-up' : 'animate-toast-slide-down';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isPrinting = status === 'printing';

  const gradient = isSuccess 
    ? 'from-green-500 to-emerald-500' 
    : isError 
    ? 'from-red-500 to-rose-500'
    : 'from-blue-500 to-indigo-500';

  const handleClose = () => setIsClosing(true);

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[1300] flex justify-center pointer-events-none">
      <div className={`w-full max-w-md px-4 pt-6 pointer-events-auto ${animationClass}`}>
        <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl">
          <div className="flex items-start p-4 gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
              {isPrinting ? (
                <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isSuccess ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-[0.3em]">
                {isPrinting ? 'YAZDIRILIYOR' : isSuccess ? 'BAŞARILI' : 'HATA'}
              </p>
              <h3 className="text-lg font-semibold text-gray-900">
                {message || (isPrinting ? 'Fiş yazdırılıyor...' : isSuccess ? 'Yazdırma Başarılı' : 'Yazdırma başarısız')}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintToast;

