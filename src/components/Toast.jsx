import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Toast = ({ message, type = 'info', onClose, autoHideDuration = 3000 }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!message) return;
    setIsClosing(false);
    if (!autoHideDuration) return;
    const timer = setTimeout(() => setIsClosing(true), autoHideDuration - 200);
    return () => clearTimeout(timer);
  }, [message, autoHideDuration]);

  useEffect(() => {
    if (!isClosing) return;
    const timer = setTimeout(() => onClose?.(), 200);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  if (!message) return null;

  const animationClass = isClosing ? 'animate-toast-slide-up' : 'animate-toast-slide-down';
  
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          gradient: 'from-green-500 to-emerald-500',
          border: 'border-green-300',
          icon: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          label: 'BAŞARILI'
        };
      case 'error':
        return {
          gradient: 'from-red-500 to-rose-500',
          border: 'border-red-300',
          icon: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          label: 'HATA'
        };
      case 'warning':
        return {
          gradient: 'from-amber-500 to-orange-500',
          border: 'border-amber-300',
          icon: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          label: 'UYARI'
        };
      default:
        return {
          gradient: 'from-blue-500 to-indigo-500',
          border: 'border-blue-300',
          icon: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          label: 'BİLGİ'
        };
    }
  };

  const styles = getTypeStyles();
  const handleClose = () => setIsClosing(true);

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[2000] flex justify-center pointer-events-none pt-6">
      <div className={`w-full max-w-md px-4 pointer-events-auto ${animationClass}`}>
        <div className={`bg-white/95 backdrop-blur-xl border-2 ${styles.border} rounded-2xl shadow-2xl px-6 py-4`}>
          <div className="flex items-center space-x-4">
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${styles.gradient} flex items-center justify-center shadow-lg ring-4 ring-opacity-20 flex-shrink-0 animate-scale-in text-white`}>
              {styles.icon}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{styles.label}</p>
              <p className="text-lg font-bold text-gray-900">{message}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
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

export default Toast;

