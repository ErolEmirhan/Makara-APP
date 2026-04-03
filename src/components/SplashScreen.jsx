import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SplashScreen = ({ onComplete, branchKey = '' }) => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  const isSultanSplash = (branchKey || '').trim().toLowerCase() === 'sultansomati';

  const text = 'MAKARA';
  const subtitle = 'Profesyonel Adisyon Sistemi';

  useEffect(() => {
    // 2.5 saniye sonra fade out başlat
    const endTimeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 500);
    }, 2500);

    return () => {
      clearTimeout(endTimeout);
    };
  }, [onComplete]);

  if (!visible) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isSultanSplash
          ? 'linear-gradient(160deg, #059669 0%, #047857 45%, #065f46 100%)'
          : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes mainTextReveal {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
            letter-spacing: 0.3em;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            letter-spacing: 0.15em;
          }
        }
        @keyframes subtitleFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes lineExpand {
          from {
            width: 0%;
            opacity: 0;
          }
          to {
            width: 100%;
            opacity: 1;
          }
        }
        .splash-main-text {
          animation: mainTextReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 1;
        }
        .splash-subtitle-text {
          animation: subtitleFadeIn 0.8s ease-out forwards;
          animation-delay: 0.3s;
          opacity: 1;
        }
        .splash-decorative-line {
          animation: lineExpand 1s ease-out forwards;
          animation-delay: 0.5s;
          opacity: 1;
        }
        @keyframes sultanTitleIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .splash-sultan-title {
          animation: sultanTitleIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {!isSultanSplash && (
        <>
          <div 
            style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.03) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(40px)',
              pointerEvents: 'none'
            }}
          />
          <div 
            style={{
              position: 'absolute',
              bottom: '20%',
              right: '10%',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.02) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)',
              pointerEvents: 'none'
            }}
          />
        </>
      )}

      <div className="text-center" style={{ position: 'relative', zIndex: 1, width: '100%', padding: '0 24px' }}>
        {isSultanSplash ? (
          <h1
            className="splash-sultan-title"
            style={{
              fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 6vw, 3.25rem)',
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              color: '#ffffff',
              margin: 0,
              padding: 0,
              textAlign: 'center',
              textShadow: '0 2px 24px rgba(0, 0, 0, 0.2)'
            }}
          >
            Sultan Somatı
          </h1>
        ) : (
          <>
            <h1 
              className="splash-main-text"
              style={{ 
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontWeight: 800,
                fontSize: 'clamp(6rem, 15vw, 12rem)',
                lineHeight: '0.9',
                letterSpacing: '0.15em',
                color: '#0a0a0a',
                margin: 0,
                padding: 0,
                textAlign: 'center',
                textTransform: 'uppercase',
                position: 'relative',
                display: 'block',
                opacity: 1
              }}
            >
              {text}
            </h1>

            <div 
              className="splash-decorative-line"
              style={{
                width: '0%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, #d1d5db 50%, transparent 100%)',
                margin: '32px auto 40px',
                maxWidth: '400px',
                opacity: 1
              }}
            />

            <p 
              className="splash-subtitle-text"
              style={{
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)',
                fontWeight: 400,
                color: '#6b7280',
                margin: 0,
                padding: 0,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                textAlign: 'center',
                opacity: 0.7,
                display: 'block'
              }}
            >
              {subtitle}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SplashScreen;
