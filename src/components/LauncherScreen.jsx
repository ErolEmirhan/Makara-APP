import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
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

/** Açılış animasyonu bu kadar sürer; bağlantı daha erken onaylansa bile çıkış bundan sonra başlar. */
const INTRO_MS = 2900;
/** Çıkışta perdeler ekranı tamamen kapattığı an: uygulama arkada bu anda açılır. */
const EXIT_COVER_MS = 420;
const EXIT_TOTAL_MS = 1000;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", Inter, Roboto, system-ui, sans-serif';

const WORD = 'MAKARA'.split('');

const SPLASH_CSS = `
.mk-splash{--mk-bg:#fbfaf8;--mk-ink:#17171a;--mk-muted:#8e8e93;--mk-pink:#e5398f;--mk-violet:#7c5cf6;
  --mk-out:cubic-bezier(.16,1,.3,1);--mk-io:cubic-bezier(.76,0,.24,1);--mk-back:cubic-bezier(.34,1.56,.64,1);
  position:fixed;inset:0;overflow:hidden;background:var(--mk-bg);font-family:${FONT_STACK}}
.mk-scene{position:absolute;inset:0;display:grid;place-items:center;animation:mk-push 3.4s cubic-bezier(.33,0,.2,1) forwards}
.mk-splash.is-exiting .mk-scene{animation:mk-push 3.4s cubic-bezier(.33,0,.2,1) forwards,mk-scene-out .45s var(--mk-io) forwards}
.mk-aurora{position:absolute;left:50%;top:50%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;border-radius:50%;
  background:conic-gradient(from 0deg,rgba(229,57,143,.10),rgba(124,92,246,.08),rgba(255,180,120,.06),rgba(229,57,143,.10));
  filter:blur(80px);opacity:0;animation:mk-fade-in 1.6s var(--mk-out) .1s forwards,mk-spin 14s linear infinite;
  -webkit-mask:radial-gradient(circle,#000 0%,transparent 55%);mask:radial-gradient(circle,#000 0%,transparent 55%)}
.mk-bokeh{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(229,57,143,.35),transparent 70%);opacity:0;animation:mk-bokeh 3.4s ease-out forwards}
.mk-lockup{position:relative;display:flex;align-items:center;gap:clamp(40px,4.4vw,84px);transform:translateX(var(--mk-shift,0));animation:mk-slide 1.15s var(--mk-io) 1s forwards}
.mk-mark{position:relative;width:clamp(170px,17vw,330px);aspect-ratio:1;flex:none}
.mk-disc{position:absolute;inset:0;border-radius:50%;background:var(--mk-pink);transform:scale(0);
  box-shadow:0 30px 80px -20px rgba(229,57,143,.45),0 2px 6px rgba(0,0,0,.05);
  animation:mk-dot .32s var(--mk-back) .05s forwards,mk-grow .7s var(--mk-io) .38s forwards,mk-disc-white .5s ease .55s forwards}
.mk-ripple{position:absolute;inset:0;border-radius:50%;border:1.5px solid var(--mk-pink);opacity:0;animation:mk-ripple 1.3s var(--mk-out) forwards}
.mk-ripple.r1{animation-delay:.5s}.mk-ripple.r2{animation-delay:.68s;border-color:var(--mk-violet)}.mk-ripple.r3{animation-delay:.86s;border-width:1px}
.mk-ring{position:absolute;inset:-14px;width:calc(100% + 28px);height:calc(100% + 28px);transform:rotate(-90deg);overflow:visible}
.mk-ring circle{fill:none;stroke:url(#mk-ring-grad);stroke-width:1.2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:mk-draw 1.1s var(--mk-io) .75s forwards}
.mk-logo{position:absolute;inset:6%;border-radius:50%;overflow:hidden;opacity:0;transform:scale(1.35) rotate(-14deg);filter:blur(12px);animation:mk-logo-in 1s var(--mk-out) .62s forwards}
.mk-logo img{width:100%;height:100%;object-fit:contain;display:block}
.mk-glint{position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none}
.mk-glint::after{content:"";position:absolute;top:-50%;left:-120%;width:60%;height:200%;transform:rotate(25deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent);animation:mk-glint .9s var(--mk-io) 1.95s forwards}
.mk-text{display:flex;flex-direction:column;align-items:flex-start}
.mk-word{display:flex;font-size:clamp(84px,11.5vw,220px);font-weight:700;line-height:.9;letter-spacing:.06em;color:var(--mk-ink)}
.mk-word .m{overflow:hidden;padding:.06em .01em .08em}
.mk-word .c{display:inline-block;transform:translateY(115%) rotate(8deg);filter:blur(6px);
  background:linear-gradient(100deg,var(--mk-ink) 0 42%,var(--mk-pink) 50%,var(--mk-violet) 56%,var(--mk-ink) 66% 100%);
  background-size:320% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:mk-rise .95s var(--mk-out) forwards,mk-sheen 1.2s var(--mk-io) forwards}
.mk-rule{position:relative;margin-top:clamp(14px,1.6vw,22px);height:2px;width:100%;overflow:hidden}
.mk-rule::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--mk-pink),var(--mk-violet) 60%,transparent);
  transform:scaleX(0);transform-origin:left;animation:mk-rule .9s var(--mk-io) 1.55s forwards}
.mk-tag{margin-top:clamp(14px,1.5vw,20px);font-size:clamp(14px,1.35vw,26px);font-weight:500;text-transform:uppercase;color:var(--mk-muted);
  letter-spacing:.7em;opacity:0;filter:blur(4px);animation:mk-tag 1.1s var(--mk-out) 1.75s forwards}
.mk-status{position:absolute;left:0;right:0;bottom:clamp(40px,9vh,110px);display:flex;flex-direction:column;align-items:center;gap:16px;
  text-align:center;padding:0 16px;animation:mk-status-in .6s var(--mk-out) both}
.mk-status-title{font-size:clamp(15px,1.25vw,20px);font-weight:600;color:var(--mk-ink);letter-spacing:-.01em}
.mk-status-sub{font-size:clamp(13px,1vw,15px);color:var(--mk-muted);max-width:360px;line-height:1.5}
.mk-dots{display:flex;gap:6px}
.mk-dots span{width:6px;height:6px;border-radius:50%;background:var(--mk-pink);animation:mk-dot-pulse 1.1s ease-in-out infinite}
.mk-dots span:nth-child(2){animation-delay:.15s;background:#b04bd0}.mk-dots span:nth-child(3){animation-delay:.3s;background:var(--mk-violet)}
.mk-retry{pointer-events:auto;border:0;border-radius:999px;padding:12px 36px;font:600 15px/1 ${FONT_STACK};color:#fff;cursor:pointer;
  background:linear-gradient(100deg,var(--mk-pink),var(--mk-violet));box-shadow:0 12px 30px -10px rgba(229,57,143,.6);transition:transform .15s,filter .15s}
.mk-retry:hover{filter:brightness(1.06)}.mk-retry:active{transform:scale(.97)}
@keyframes mk-push{from{transform:scale(1)}to{transform:scale(1.045)}}
@keyframes mk-scene-out{to{transform:scale(1.12);opacity:0;filter:blur(10px)}}
@keyframes mk-fade-in{to{opacity:1}}
@keyframes mk-spin{to{rotate:360deg}}
@keyframes mk-bokeh{20%{opacity:var(--o)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.3)}}
@keyframes mk-dot{from{transform:scale(0)}to{transform:scale(.08)}}
@keyframes mk-grow{from{transform:scale(.08)}to{transform:scale(1)}}
@keyframes mk-disc-white{to{background:#fff}}
@keyframes mk-ripple{from{opacity:.55;transform:scale(1)}to{opacity:0;transform:scale(2.7)}}
@keyframes mk-draw{to{stroke-dashoffset:0}}
@keyframes mk-logo-in{to{opacity:1;transform:none;filter:none}}
@keyframes mk-slide{to{transform:translateX(0)}}
@keyframes mk-glint{to{left:160%}}
@keyframes mk-rise{to{transform:none;filter:none}}
@keyframes mk-sheen{to{background-position:0 0}}
@keyframes mk-rule{to{transform:scaleX(1)}}
@keyframes mk-tag{to{opacity:1;filter:none;letter-spacing:.42em}}
@keyframes mk-status-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes mk-dot-pulse{0%,80%,100%{transform:scale(.6);opacity:.35}40%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.mk-splash *,.mk-splash *::before,.mk-splash *::after{animation-duration:.01s!important;animation-delay:0s!important}}
`;

const WIPE_CSS = `
.mk-wipe-layer{position:fixed;inset:0;z-index:2147483600;pointer-events:none;overflow:hidden}
.mk-wipe{position:absolute;inset:-10% -30%;transform:translateX(-120%) skewX(-14deg);animation:mk-wipe .85s cubic-bezier(.76,0,.24,1) forwards}
.mk-wipe.a{background:linear-gradient(100deg,#f3a6cc,#e5398f 40%,#7c5cf6)}
.mk-wipe.b{background:#fff;opacity:.9;animation-delay:.08s}
@keyframes mk-wipe{to{transform:translateX(120%) skewX(-14deg)}}
@media (prefers-reduced-motion:reduce){.mk-wipe{display:none}}
`;

/**
 * Çıkış perdeleri React ağacının dışında yaşar: launcher kalkıp uygulama açılırken
 * perde süpürmeye devam eder ve uygulamayı açığa çıkarır.
 */
function playExitWipe() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('mk-wipe-style')) {
    const style = document.createElement('style');
    style.id = 'mk-wipe-style';
    style.textContent = WIPE_CSS;
    document.head.appendChild(style);
  }
  const layer = document.createElement('div');
  layer.className = 'mk-wipe-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="mk-wipe a"></div><div class="mk-wipe b"></div>';
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), EXIT_TOTAL_MS + 200);
}

export default function LauncherScreen({ onPassed }) {
  const [phase, setPhase] = useState('checking'); // checking | offline | exiting
  const [introDone, setIntroDone] = useState(false);
  const mountedAtRef = useRef(Date.now());
  const lockupRef = useRef(null);
  const textRef = useRef(null);
  const exitStartedRef = useRef(false);

  const bokeh = useMemo(
    () =>
      Array.from({ length: 7 }, () => {
        const size = 160 + Math.random() * 260;
        return {
          width: size,
          height: size,
          left: `${8 + Math.random() * 84}%`,
          top: `${8 + Math.random() * 84}%`,
          '--o': 0.1 + Math.random() * 0.14,
          '--dx': `${Math.random() * 80 - 40}px`,
          '--dy': `${-30 - Math.random() * 60}px`,
          animationDelay: `${0.2 + Math.random() * 0.8}s`,
          filter: `blur(${40 + Math.random() * 30}px)`
        };
      }),
    []
  );

  // Logo önce ortada durur; yazı açılırken ikisi birlikte sola kayıp ortalanır.
  useLayoutEffect(() => {
    const lockup = lockupRef.current;
    const text = textRef.current;
    if (!lockup || !text) return;
    const gap = parseFloat(getComputedStyle(lockup).columnGap) || 48;
    lockup.style.setProperty('--mk-shift', `${(text.offsetWidth + gap) / 2}px`);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => window.clearTimeout(id);
  }, []);

  const startExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    setPhase('exiting');
    playExitWipe();
    window.setTimeout(() => {
      onPassed?.();
    }, EXIT_COVER_MS);
  }, [onPassed]);

  const runCheck = useCallback(async () => {
    setPhase('checking');
    const ok = await probeConnectivity();
    if (!ok) {
      setPhase('offline');
      return;
    }
    const remainder = Math.max(0, INTRO_MS - (Date.now() - mountedAtRef.current));
    await new Promise((r) => window.setTimeout(r, remainder));
    startExit();
  }, [startExit]);

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

  const showWaiting = introDone && phase === 'checking';
  const showOffline = introDone && phase === 'offline';

  return createPortal(
    <div
      className={`mk-splash z-[2147483000] ${phase === 'exiting' ? 'is-exiting pointer-events-none' : ''}`}
      aria-live="polite"
      aria-busy={phase === 'checking'}
      role="presentation"
    >
      <style>{SPLASH_CSS}</style>

      <div className="mk-scene">
        {bokeh.map((style, i) => (
          <div key={i} className="mk-bokeh" style={style} aria-hidden />
        ))}
        <div className="mk-aurora" aria-hidden />

        <div className="mk-lockup" ref={lockupRef}>
          <div className="mk-mark" aria-hidden>
            <div className="mk-ripple r1" />
            <div className="mk-ripple r2" />
            <div className="mk-ripple r3" />
            <div className="mk-disc" />
            <svg className="mk-ring" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="mk-ring-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#e5398f" />
                  <stop offset="1" stopColor="#7c5cf6" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="49" pathLength="1" />
            </svg>
            <div className="mk-logo">
              <img
                src="./logo.png"
                alt=""
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = '1';
                    e.currentTarget.src = './icon.png';
                  }
                }}
              />
            </div>
            <div className="mk-glint" />
          </div>

          <div className="mk-text" ref={textRef}>
            <h1 id="launcher-title" className="mk-word" aria-label="MAKARA">
              {WORD.map((ch, i) => (
                <span key={i} className="m" aria-hidden>
                  <span className="c" style={{ animationDelay: `${1.18 + i * 0.065}s, 2.05s` }}>
                    {ch}
                  </span>
                </span>
              ))}
            </h1>
            <div className="mk-rule" aria-hidden />
            <p className="mk-tag">Profesyonel adisyon sistemi</p>
          </div>
        </div>
      </div>

      {showWaiting && (
        <div className="mk-status">
          <div className="mk-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <p className="mk-status-sub">Bağlantı doğrulanıyor…</p>
        </div>
      )}

      {showOffline && (
        <div className="mk-status" role="alert">
          <p className="mk-status-title">Ağ kullanılamıyor</p>
          <p className="mk-status-sub">İnternet bağlantınızı kontrol edin. Bağlantı olmadan devam edilemez.</p>
          <button type="button" className="mk-retry" onClick={() => runCheck()}>
            Tekrar dene
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
