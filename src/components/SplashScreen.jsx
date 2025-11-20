import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SplashScreen = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showText, setShowText] = useState(false);
  
  const text = 'MAKARA';

  useEffect(() => {
    // Kısa bir gecikme sonrası animasyonu başlat
    const startTimeout = setTimeout(() => {
      setShowText(true);
    }, 200);

    // Tüm animasyon tamamlandıktan sonra 2 saniye bekle ve kapat
    const totalDuration = 200 + (text.length * 100) + 2000; // başlangıç + animasyon + bekleme
    const endTimeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 300);
    }, totalDuration);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(endTimeout);
    };
  }, [text, onComplete]);

  if (!visible) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-pink-500 transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center">
        <h1 
          className="text-white"
          style={{ 
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: 900,
            fontSize: '12rem',
            lineHeight: '1',
            letterSpacing: '0.1em',
            textShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          {text.split('').map((char, index) => (
            <span
              key={index}
              className="text-reveal-char"
              style={{
                animationDelay: showText ? `${index * 0.1}s` : '0s'
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
      </div>
    </div>,
    document.body
  );
};

export default SplashScreen;
