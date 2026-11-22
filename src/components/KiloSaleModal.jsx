import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const money = (x) =>
  '₺' + (Number(x) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRESETS = [250, 500, 750, 1000, 1500, 2000];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

/** "1250,5" → 1250.5 */
export function parseKiloAmount(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * Kilo satışı: tutar (₺) girilir, Nakit / Kredi Kartı ile satış tamamlanır.
 * onConfirm({ amount, paymentMethod }) — işlem sürerken `busy` true gelir.
 */
export default function KiloSaleModal({ categoryName = 'Baklava', busy = false, onConfirm, onCancel }) {
  const [text, setText] = useState('');
  const amount = parseKiloAmount(text);
  const canPay = !busy && amount > 0;

  const pressKey = (k) => {
    if (busy) return;
    setText((prev) => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === ',') return prev.includes(',') ? prev : (prev || '0') + ',';
      const [, dec = null] = prev.split(',');
      if (dec != null && dec.length >= 2) return prev;
      if (prev === '0') return k;
      if (prev.replace(',', '').length >= 7) return prev;
      return prev + k;
    });
  };

  // Fiziksel klavye: rakamlar, virgül/nokta, Backspace, Enter (nakit), Esc
  useEffect(() => {
    const onKey = (e) => {
      if (busy) return;
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === ',' || e.key === '.') pressKey(',');
      else if (e.key === 'Backspace') pressKey('⌫');
      else if (e.key === 'Escape') onCancel?.();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const pay = (paymentMethod) => {
    if (!canPay) return;
    onConfirm({ amount, paymentMethod });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => { if (!busy) onCancel(); }}
    >
      <div
        className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Kilo satışı"
      >
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-6 pb-5 pt-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
                <ScaleIcon className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/75">{categoryName}</p>
                <h3 className="text-2xl font-black tracking-tight">Kilo satışı</h3>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-40"
              aria-label="Kapat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative mt-5 rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25">
            <p className="text-xs font-semibold text-white/80">Tartıdaki tutar</p>
            <p className={`mt-0.5 text-right text-5xl font-black tracking-tight tabular-nums ${text ? 'text-white' : 'text-white/45'}`}>
              ₺{text || '0'}
            </p>
          </div>
        </div>

        <div className="px-6 pt-5">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((a) => {
              const active = amount === a;
              return (
                <button
                  key={a}
                  type="button"
                  disabled={busy}
                  onClick={() => setText(String(a))}
                  className={`rounded-xl py-2.5 text-base font-bold transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:ring-amber-400'
                  }`}
                >
                  ₺{a.toLocaleString('tr-TR')}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => pressKey(k)}
                className="rounded-xl bg-white py-3.5 text-2xl font-bold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.97]"
              >
                {k}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-bold text-slate-700">Satış tutarı</span>
            <span className="text-3xl font-black tracking-tight text-slate-900">{money(amount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-6">
          {busy ? (
            <div className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-slate-100 py-5">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
              <span className="text-sm font-bold text-slate-700">Satış kaydediliyor…</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={!canPay}
                onClick={() => pay('Nakit')}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 py-5 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Nakit
              </button>
              <button
                type="button"
                disabled={!canPay}
                onClick={() => pay('Kredi Kartı')}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 py-5 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Kredi Kartı
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ScaleIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17M6 20h12M5 7h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7l-3 7a3.5 3.5 0 006 0L5 7zM19 7l-3 7a3.5 3.5 0 006 0l-3-7z" />
      <circle cx="12" cy="4.5" r="1.5" />
    </svg>
  );
}

/** Baklavalar kategorisinin en üstündeki büyük giriş düğmesi */
export function KiloSaleButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mb-3 flex w-full shrink-0 items-center gap-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-4 text-left text-white shadow-[0_14px_30px_-14px_rgba(234,88,12,0.75)] transition hover:brightness-[1.06] active:scale-[0.995]"
    >
      <span className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 transition group-hover:scale-110" />
      <span className="pointer-events-none absolute -bottom-14 right-28 h-28 w-28 rounded-full bg-white/10" />
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
        <ScaleIcon className="h-8 w-8" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-xl font-black tracking-tight">Kilo satışı gir</span>
        <span className="mt-0.5 block text-sm font-medium text-white/85">
          Tartıdaki tutarı yaz, nakit ya da kartla satışı tamamla
        </span>
      </span>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 shadow-md transition group-hover:translate-x-0.5">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
