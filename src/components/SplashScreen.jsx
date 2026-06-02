import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SPLASH_DURATION_MS = 2800;
const EXIT_MS = 550;

const SplashScreen = ({ onComplete, branchKey = '' }) => {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  const isSultanSplash = (branchKey || '').trim().toLowerCase() === 'sultansomati';
  const letters = 'MAKARA'.split('');

  useEffect(() => {
    const endTimeout = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, EXIT_MS);
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(endTimeout);
  }, [onComplete]);

  if (!visible) return null;

  return createPortal(
    <div
      className={`splash-screen fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden ${
        exiting ? 'splash-screen--exit' : ''
      }`}
      style={{
        background: isSultanSplash
          ? 'linear-gradient(165deg, #064e3b 0%, #047857 38%, #059669 72%, #0d9488 100%)'
          : 'linear-gradient(180deg, #fafafa 0%, #f5f5f7 45%, #eef0f5 100%)',
      }}
      role="presentation"
      aria-hidden
    >
      {/* Arka plan orb'ları */}
      {!isSultanSplash ? (
        <>
          <div
            className="splash-orb absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] max-w-[520px] max-h-[520px] rounded-full pointer-events-none opacity-70"
            style={{
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, transparent 68%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="splash-orb splash-orb--delay absolute -bottom-[15%] -right-[8%] w-[50vw] h-[50vw] max-w-[480px] max-h-[480px] rounded-full pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(167, 139, 250, 0.2) 0%, transparent 70%)',
              filter: 'blur(48px)',
            }}
          />
          <div
            className="splash-orb absolute top-[35%] right-[15%] w-[28vw] h-[28vw] max-w-[240px] max-h-[240px] rounded-full pointer-events-none opacity-50"
            style={{
              background: 'radial-gradient(circle, rgba(244, 114, 182, 0.15) 0%, transparent 72%)',
              filter: 'blur(32px)',
              animationDelay: '-5s',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="splash-sultan-glow absolute top-1/4 left-1/2 -translate-x-1/2 w-[70vw] max-w-[600px] aspect-square rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)',
              filter: 'blur(24px)',
            }}
          />
          <div
            className="splash-orb splash-orb--delay absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none opacity-40"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)',
            }}
          />
        </>
      )}

      {/* İçerik */}
      <div className="relative z-10 flex flex-col items-center px-8 w-full max-w-lg">
        {!isSultanSplash && (
          <div className="splash-icon-wrap mb-8 sm:mb-10">
            <div
              className="relative w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-[22%] bg-white flex items-center justify-center overflow-hidden"
              style={{
                boxShadow:
                  '0 2px 4px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <img
                src="./logo.png"
                alt=""
                className="w-[72%] h-[72%] object-contain"
                onError={(e) => {
                  e.target.src = './icon.png';
                }}
              />
            </div>
          </div>
        )}

        {isSultanSplash ? (
          <div className="text-center">
            <div
              className="splash-icon-wrap inline-flex w-20 h-20 sm:w-24 sm:h-24 rounded-[22%] bg-white/15 backdrop-blur-md items-center justify-center mb-6 ring-1 ring-white/25"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            >
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">S</span>
            </div>
            <h1
              className="splash-wordmark text-white font-bold tracking-tight"
              style={{
                fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
                textShadow: '0 2px 24px rgba(0,0,0,0.2)',
              }}
            >
              Sultan Somatı
            </h1>
            <p className="splash-tagline mt-3 text-emerald-100/85 text-sm sm:text-base font-medium tracking-wide">
              Profesyonel adisyon sistemi
            </p>
          </div>
        ) : (
          <>
            <h1
              className="font-black uppercase text-center leading-none"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}
              aria-label="MAKARA"
            >
              {letters.map((char, i) => (
                <span
                  key={i}
                  className="splash-letter bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent"
                  style={{ animationDelay: `${0.2 + i * 0.06}s` }}
                >
                  {char}
                </span>
              ))}
            </h1>

            <p className="splash-tagline mt-5 text-[#86868b] text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] text-center">
              Profesyonel adisyon sistemi
            </p>
          </>
        )}
      </div>

      {/* Alt progress — Apple tarzı ince çizgi */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 sm:pb-12 flex flex-col items-center gap-3 px-12">
        <div
          className="w-full max-w-[200px] h-[3px] rounded-full overflow-hidden"
          style={{
            background: isSultanSplash ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div
            className={`splash-progress-track relative h-full rounded-full ${
              isSultanSplash
                ? 'bg-white/90'
                : 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500'
            }`}
          >
            {!isSultanSplash && (
              <div
                className="splash-progress-shimmer absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                aria-hidden
              />
            )}
          </div>
        </div>
        <p
          className="splash-tagline text-[10px] sm:text-[11px] font-medium tracking-widest uppercase"
          style={{
            color: isSultanSplash ? 'rgba(255,255,255,0.55)' : '#aeaeb2',
            animationDelay: '0.65s',
          }}
        >
          Yükleniyor
        </p>
      </div>
    </div>,
    document.body
  );
};

export default SplashScreen;
