import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Arayüz yenilemesi hafif (sayfa yenilenir), kasa güncellemesi uygulamayı yeniden başlatır.
const UI_IDLE_MS = 15000;
const SHELL_IDLE_MS = 60000;
const APPLY_DELAY_MS = 1400;

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Vercel'de yeni arayüz ya da GitHub'da yeni kasa sürümü hazır olunca: sepet boş, yazı yazılmıyor ve
 * kasa bir süredir boştaysa sormadan uygular. Sepette ürün varsa bekler (gönderilmemiş sipariş kaybolmasın).
 * App'in tepesinde çağrılır ki açılış ekranındayken gelen haber kaçmasın.
 */
export function useKasaUpdates(cartCount) {
  const [uiUpdate, setUiUpdate] = useState(null);
  const [shellUpdate, setShellUpdate] = useState(null);
  const [applying, setApplying] = useState(null);
  const lastInputRef = useRef(Date.now());
  const cartRef = useRef(cartCount);
  cartRef.current = cartCount;

  const api = window.electronAPI;
  // Eski kasa sürümleri kurulum sihirbazını görünür açar; onlarda kendiliğinden kurmayız
  const shellSilent = typeof api?.getDownloadedUpdate === 'function';

  useEffect(() => {
    if (!api) return undefined;
    const offs = [];
    if (api.onRemoteUiUpdate) offs.push(api.onRemoteUiUpdate((u) => u && setUiUpdate(u)));
    api.registerRemoteUiUpdates?.().then((u) => u && setUiUpdate(u)).catch(() => {});
    api.onUpdateDownloaded?.((info) => setShellUpdate({ version: info?.version }));
    api.getDownloadedUpdate?.().then((info) => info && setShellUpdate(info)).catch(() => {});
    api.onUpdateError?.((error) => console.error('Update error:', error));
    return () => offs.forEach((off) => off?.());
  }, [api]);

  useEffect(() => {
    const mark = () => {
      lastInputRef.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { capture: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
  }, []);

  const apply = useCallback((kind) => {
    setApplying(kind);
    setTimeout(async () => {
      try {
        if (kind === 'shell') {
          await window.electronAPI.installUpdate();
        } else if (!(await window.electronAPI.applyRemoteUiUpdate())) {
          setApplying(null);
        }
      } catch {
        setApplying(null);
      }
    }, APPLY_DELAY_MS);
  }, []);

  useEffect(() => {
    if ((!uiUpdate && !shellUpdate) || applying) return undefined;
    const id = setInterval(() => {
      if (cartRef.current > 0 || isTyping()) return;
      const idle = Date.now() - lastInputRef.current;
      if (shellUpdate) {
        if (shellSilent && idle >= SHELL_IDLE_MS) apply('shell');
      } else if (idle >= UI_IDLE_MS) {
        apply('ui');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [uiUpdate, shellUpdate, applying, apply, shellSilent]);

  const applyNow = useCallback(() => {
    if (cartRef.current > 0) return;
    apply(shellUpdate ? 'shell' : 'ui');
  }, [apply, shellUpdate]);

  return { uiUpdate, shellUpdate, applying, applyNow, cartCount, autoApplies: !shellUpdate || shellSilent };
}

function RefreshGlyph({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export default function KasaUpdateNotice({ uiUpdate, shellUpdate, applying, applyNow, cartCount, autoApplies }) {
  if (!applying && !uiUpdate && !shellUpdate) return null;

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
    const isShell = applying === 'shell';
    return createPortal(
      <div
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
            {isShell ? 'Kasa güncelleniyor' : 'Güncelleniyor'}
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-400">
            {isShell ? 'Birkaç saniye içinde yeniden açılacak' : 'Yeni sürüm yükleniyor…'}
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

  const isShell = !!shellUpdate;
  const subtitle = cartCount > 0
    ? 'Sepet boşalınca kendiliğinden güncellenecek'
    : autoApplies
      ? 'Kasa boştayken kendiliğinden güncellenecek'
      : 'Uygun olduğunuzda güncelleyin';

  return createPortal(
    <div
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
            {isShell ? 'Kasa güncellemesi hazır' : 'Yeni sürüm hazır'}
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
