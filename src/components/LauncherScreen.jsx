import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

async function probeConnectivity() {
  if (window.electronAPI?.checkInternetConnectivity) {
    try {
      return Boolean(await window.electronAPI.checkInternetConnectivity());
    } catch {
      return false;
    }
  }
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(id);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

/** Launcher tam olarak en az bu kadar süre görünür (bağlantı daha erken onaylansa bile). */
const MIN_LAUNCHER_MS = 5000;

/**
 * League of Legends tarzı: tam ekran uygulama değil; ekranın ortasında
 * yaklaşık yarım ekran boyutunda ayrı bir "client" penceresi.
 */
const CLIENT_WINDOW_CLASS =
  'relative flex h-full w-full flex-col overflow-hidden rounded-[22px]';

export default function LauncherScreen({ onPassed }) {
  const [phase, setPhase] = useState('checking'); // checking | offline | exiting
  const [pulseExit, setPulseExit] = useState(false);

  const runCheck = useCallback(async () => {
    const phaseStart = Date.now();
    setPhase('checking');
    const ok = await probeConnectivity();
    if (!ok) {
      setPhase('offline');
      return;
    }
    const elapsed = Date.now() - phaseStart;
    const remainder = Math.max(0, MIN_LAUNCHER_MS - elapsed);
    await new Promise((r) => window.setTimeout(r, remainder));
    setPhase('exiting');
    setPulseExit(true);
    window.setTimeout(() => {
      onPassed?.();
    }, 720);
  }, [onPassed]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    const onOnline = () => {
      if (phase === 'offline') runCheck();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [phase, runCheck]);

  const fadeCls = `transition-opacity duration-[620ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
    pulseExit ? 'opacity-0' : 'opacity-100'
  }`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[2147483000] overflow-hidden bg-transparent ${fadeCls} ${pulseExit ? 'pointer-events-none' : ''}`}
      aria-live="polite"
      aria-busy={phase === 'checking'}
      role="presentation"
    >
      <style>{`
        @keyframes launcher-panel-in {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes launcher-shimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes launcher-ring-a {
          0% { transform: scale(0.72); opacity: 0.55; }
          70% { opacity: 0.12; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes launcher-ring-b {
          0% { transform: scale(0.72); opacity: 0.35; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes launcher-dot {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes launcher-mesh {
          0%, 100% { opacity: 0.4; transform: translate(0, 0) rotate(0deg); }
          50% { opacity: 0.65; transform: translate(-3%, 2%) rotate(6deg); }
        }
      `}</style>

      {/* Arka plan boyanmaz: Electron şeffaf pencerede gerçek masaüstü duvar kağıdı görünür */}

      {/* Ortada yüzen istemci — görünümün ~yarısı; ana uygulama gibi kenarlara yayılmaz */}
      <div
        className={`absolute left-1/2 top-1/2 z-10 w-[min(880px,50vw)] max-w-[96vw] min-w-[360px] h-[min(620px,52vh)] max-h-[85vh] min-h-[380px] ${fadeCls}`}
        style={{ transform: 'translate(-50%, -50%)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="launcher-title"
      >
      <div
        className="h-full w-full rounded-[22px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(255,255,255,0.75)]"
        style={{ animation: 'launcher-panel-in 0.95s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
      <div className={`${CLIENT_WINDOW_CLASS} bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]`}>
        {/* İç parlama ve mesh */}
        <div
          className="pointer-events-none absolute -left-24 top-0 h-[220px] w-[220px] rounded-full bg-gradient-to-br from-blue-100/90 via-white to-transparent blur-3xl"
          style={{ animation: 'launcher-mesh 11s ease-in-out infinite' }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-12 h-[200px] w-[200px] rounded-full bg-gradient-to-tl from-slate-200/70 via-white to-transparent blur-3xl"
          style={{ animation: 'launcher-mesh 13s ease-in-out infinite reverse' }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-t-[22px] bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-90">
          <div
            className="absolute inset-y-0 w-[55%] rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
            style={{
              animation: phase === 'checking' ? 'launcher-shimmer 2.8s ease-in-out infinite' : 'none'
            }}
          />
        </div>

        <div className="relative flex flex-1 flex-col px-9 pb-10 pt-11">
          {/* Üst sembol alanı — soyut bağlantı / güven */}
          <div className="relative mx-auto mb-8 flex h-[120px] w-[120px] shrink-0 items-center justify-center">
            <span
              className="pointer-events-none absolute inline-flex h-[118px] w-[118px] rounded-full border border-slate-200/90 bg-white/70 shadow-[inset_0_1px_2px_rgba(255,255,255,1)]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute rounded-full border border-blue-400/25"
              style={{
                width: 118,
                height: 118,
                animation: phase === 'checking' ? 'launcher-ring-a 2.8s ease-out infinite' : 'none'
              }}
            />
            <span
              className="pointer-events-none absolute rounded-full border border-slate-300/40"
              style={{
                width: 118,
                height: 118,
                animation: phase === 'checking' ? 'launcher-ring-b 2.8s ease-out 0.55s infinite' : 'none'
              }}
            />

            {/* Orta ikon — net SVG path’ler (Heroicons uyumlu); dönen hat CSS border ile */}
            <div className="relative z-10 flex h-[76px] w-[76px] shrink-0 items-center justify-center">
              {phase === 'offline' ? (
                <svg
                  className="h-[52px] w-[52px] text-slate-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M1.42 9a15 15 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0"
                  />
                  <circle cx="12" cy="20.25" r="1.35" fill="currentColor" />
                  <path stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" d="M4 5l16 16" />
                </svg>
              ) : phase === 'exiting' ? (
                <svg className="h-14 w-14 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 m-auto h-[72px] w-[72px] animate-spin rounded-full border-[2.5px] border-slate-200 border-t-slate-600 border-r-transparent border-b-transparent opacity-95 [animation-duration:3s]" />
                  <svg
                    className="relative z-[1] h-[52px] w-[52px] text-slate-800"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M1.42 9a15 15 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0"
                    />
                    <circle cx="12" cy="20.25" r="1.35" fill="currentColor" />
                  </svg>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col text-center">
            <p id="launcher-title" className="text-[22px] font-semibold tracking-tight text-slate-900 md:text-[23px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif' }}>
              {phase === 'offline' ? 'Ağ kullanılamıyor' : phase === 'exiting' ? 'Hazırlanıyor' : 'Bağlantı doğrulanıyor'}
            </p>
            <p className="mx-auto mt-3 max-w-[320px] text-[14px] leading-relaxed text-slate-500" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}>
              {phase === 'checking' &&
                'İnternet bağlantınızı kontrol edin. Güvenli bağlantı kurulunca oturum açılacaktır.'}
              {phase === 'offline' &&
                'İnternet bağlantınızı kontrol edin. Bağlantı olmadan devam edilemez.'}
              {phase === 'exiting' && 'Oturum başlatılıyor…'}
            </p>

            <div className="mt-auto flex flex-col items-center justify-end gap-5 pt-8">
              {phase === 'checking' && (
                <div className="flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-slate-800"
                      style={{
                        animation: `launcher-dot 1.1s ease-in-out ${i * 0.15}s infinite`
                      }}
                    />
                  ))}
                </div>
              )}

              {phase === 'offline' && (
                <button
                  type="button"
                  onClick={() => runCheck()}
                  className="rounded-full bg-[#0071e3] px-10 py-3 text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(0,113,227,0.55)] transition hover:bg-[#0077ed] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 focus-visible:ring-offset-2"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Tekrar dene
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>,
    document.body
  );
}
