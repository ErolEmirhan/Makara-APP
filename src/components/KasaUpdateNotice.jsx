import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveHotResume } from '../utils/hotResume';

// Arayüz güncellemesi: sayfa kaldığı yerden yenilenir (sepet, ekran, masa korunur), sormadan uygulanır.
// Kasa güncellemesi: uygulama yeniden başlar; sepet boş ve kasa boştayken uygulanır.
const UI_IDLE_MS = 4000;
const SHELL_IDLE_MS = 60000;
const SHELL_APPLY_DELAY_MS = 1400;
const UI_CHECK_MS = 20000;

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Açık modal (ödeme, masa, ayarlar…) varken yenilenmez; tıklanamayan katmanlar sayılmaz */
function isModalOpen() {
  return [...document.querySelectorAll('.fixed.inset-0')].some(
    (el) => !el.classList.contains('pointer-events-none') && !el.closest('[data-kasa-update]')
  );
}

function readBuildId(text) {
  const m = text && text.match(/assets\/index-[\w-]+\.js/);
  return m ? m[0] : null;
}

/** Bu sayfanın yüklendiği paket; aynı paket için gelen "yeni sürüm" yok sayılır */
function readOwnBuild() {
  const el = document.querySelector('script[type="module"][src*="assets/index-"]');
  return readBuildId(el?.getAttribute('src'));
}

/**
 * App'in tepesinde çağrılır ki açılış ekranındayken gelen haber kaçmasın.
 * snapshotRef.current() güncellemeden hemen önce kaldığı yeri verir. Açılış ekranındayken
 * kaybolacak bir şey olmadığından arayüz güncellemesi beklemeden uygulanır.
 */
export function useKasaUpdates(cartCount, snapshotRef, { inLauncher = false } = {}) {
  const [uiUpdate, setUiUpdate] = useState(null);
  const [shellUpdate, setShellUpdate] = useState(null);
  const [applying, setApplying] = useState(null);
  const lastInputRef = useRef(Date.now());
  const cartRef = useRef(cartCount);
  cartRef.current = cartCount;
  const inLauncherRef = useRef(inLauncher);
  inLauncherRef.current = inLauncher;
  const ownBuildRef = useRef(readOwnBuild());

  const api = window.electronAPI;
  // Eski kasa sürümleri kurulum sihirbazını görünür açar; onlarda kendiliğinden kurmayız
  const shellSilent = typeof api?.getDownloadedUpdate === 'function';

  useEffect(() => {
    if (!api) return undefined;
    const acceptUi = (u) => {
      if (u?.build && u.build !== ownBuildRef.current) setUiUpdate(u);
    };
    const offs = [];
    if (api.onRemoteUiUpdate) offs.push(api.onRemoteUiUpdate(acceptUi));
    api.registerRemoteUiUpdates?.().then(acceptUi).catch(() => {});
    api.onUpdateDownloaded?.((info) => setShellUpdate({ version: info?.version }));
    api.getDownloadedUpdate?.().then((info) => info && setShellUpdate(info)).catch(() => {});
    api.onUpdateError?.((error) => console.error('Update error:', error));
    return () => offs.forEach((off) => off?.());
  }, [api]);

  // Vercel'den açıldıysa yeni deploy'u kabuğu beklemeden kendisi fark eder
  useEffect(() => {
    if (location.protocol !== 'https:' || !ownBuildRef.current) return undefined;
    const check = async () => {
      try {
        const res = await fetch(`/?ui-check=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const build = readBuildId(await res.text());
        if (build && build !== ownBuildRef.current) setUiUpdate({ build });
      } catch (_) {}
    };
    const id = setInterval(check, UI_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mark = () => {
      lastInputRef.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { capture: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
  }, []);

  const applyUi = useCallback(() => {
    setApplying('ui');
    saveHotResume(snapshotRef?.current?.());
    // Paketteki yedek arayüzdeyken (internet sonradan geldi) Vercel'e kabuk geçirir
    if (location.protocol === 'file:' && window.electronAPI?.applyRemoteUiUpdate) {
      window.electronAPI.applyRemoteUiUpdate().then((ok) => {
        if (!ok) setApplying(null);
      }).catch(() => setApplying(null));
    } else {
      location.reload();
    }
  }, [snapshotRef]);

  const applyShell = useCallback(() => {
    setApplying('shell');
    setTimeout(() => {
      window.electronAPI.installUpdate().catch(() => setApplying(null));
    }, SHELL_APPLY_DELAY_MS);
  }, []);

  useEffect(() => {
    if ((!uiUpdate && !shellUpdate) || applying) return undefined;
    const id = setInterval(() => {
      if (uiUpdate && !shellUpdate && inLauncherRef.current) {
        applyUi();
        return;
      }
      if (isTyping() || isModalOpen()) return;
      const idle = Date.now() - lastInputRef.current;
      if (shellUpdate) {
        if (shellSilent && cartRef.current === 0 && idle >= SHELL_IDLE_MS) applyShell();
      } else if (idle >= UI_IDLE_MS) {
        applyUi();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [uiUpdate, shellUpdate, applying, applyUi, applyShell, shellSilent]);

  const applyNow = useCallback(() => {
    if (cartRef.current > 0) return;
    applyShell();
  }, [applyShell]);

  return { shellUpdate, applying, applyNow, cartCount, autoApplies: shellSilent };
}

function RefreshGlyph({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export default function KasaUpdateNotice({ shellUpdate, applying, applyNow, cartCount, autoApplies }) {
  if (applying === 'ui' || (!applying && !shellUpdate)) return null;

  const styles = (
    <style>{`
      @keyframes kasa-upd-in { from { opacity: 0; transform: translate(-50%, 16px) scale(.98); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
      @keyframes kasa-upd-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kasa-upd-pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
      @keyframes kasa-upd-spin { to { transform: rotate(360deg); } }
      @keyframes kasa-upd-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
    `}</style>
  );

  if (applying) {
    return createPortal(
      <div
        data-kasa-update
        className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/60 backdrop-blur-md px-4"
        style={{ animation: 'kasa-upd-fade .25s ease-out' }}
        role="status"
        aria-live="assertive"
      >
        {styles}
        <div
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 px-8 py-9 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/5"
          style={{ animation: 'kasa-upd-pop .32s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="relative mx-auto mb-6 h-16 w-16">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(52,211,153,0) 0deg, #34d399 140deg, #22d3ee 260deg, rgba(34,211,238,0) 360deg)',
                animation: 'kasa-upd-spin 1s linear infinite',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              }}
            />
            <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-white/5 text-emerald-300">
              <RefreshGlyph className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xl font-extrabold tracking-tight text-white">
            Kasa güncelleniyor
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-400">
            Birkaç saniye içinde yeniden açılacak
          </p>
          <div className="relative mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              style={{ animation: 'kasa-upd-bar 1.1s ease-in-out infinite' }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const subtitle = cartCount > 0
    ? 'Sepet boşalınca kendiliğinden güncellenecek'
    : autoApplies
      ? 'Kasa boştayken kendiliğinden güncellenecek'
      : 'Uygun olduğunuzda güncelleyin';

  return createPortal(
    <div
      data-kasa-update
      className="fixed bottom-6 left-1/2 z-[99990] w-[min(92vw,34rem)]"
      style={{ transform: 'translateX(-50%)', animation: 'kasa-upd-in .4s cubic-bezier(0.22, 1, 0.36, 1)' }}
      role="status"
      aria-live="polite"
    >
      {styles}
      <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-900/90 py-3 pl-3.5 pr-3 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/5 backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-[0_6px_18px_-4px_rgba(52,211,153,0.6)]">
          <RefreshGlyph className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-white">
            Kasa güncellemesi hazır
          </p>
          <p className="truncate text-[12.5px] font-medium text-slate-400">{subtitle}</p>
        </div>
        {cartCount === 0 && (
          <button
            type="button"
            onClick={applyNow}
            className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold text-slate-900 shadow-sm transition hover:bg-slate-100 active:scale-[0.97]"
          >
            Şimdi güncelle
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
