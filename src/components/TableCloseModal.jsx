import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const roundMoney = (x) => Math.round(Number(x) * 100) / 100;
const money = (x) =>
  '₺' + (Number(x) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PERCENT_PRESETS = [5, 10, 15, 20, 25, 50];
const AMOUNT_PRESETS = [10, 25, 50, 100];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

/** Girilen metni (1.250,50 / 1250.5) sayıya çevirir */
function parseAmount(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Masayı kapatma: indirim (yok / yüzde / tutar) + ödeme yöntemi.
 * onConfirm({ paymentMethod, campaignPercentage, discountAmountTL }) — işlem sürerken `busy` true gelir.
 */
export default function TableCloseModal({ tableName, totalAmount, busy = false, onConfirm, onCancel }) {
  const total = roundMoney(totalAmount);
  const [mode, setMode] = useState('none'); // none | percent | amount
  const [percent, setPercent] = useState(null);
  const [customPercent, setCustomPercent] = useState('');
  const [amountText, setAmountText] = useState('');

  const effectivePercent = percent != null ? percent : parseAmount(customPercent);

  const { discount, error } = useMemo(() => {
    if (mode === 'percent') {
      const p = effectivePercent;
      if (!p) return { discount: 0, error: null };
      if (p <= 0 || p >= 100) return { discount: 0, error: 'Yüzde 0 ile 100 arasında olmalı' };
      const finalAmount = roundMoney(total * (1 - p / 100));
      return { discount: roundMoney(total - finalAmount), error: null };
    }
    if (mode === 'amount') {
      const a = roundMoney(parseAmount(amountText));
      if (!a) return { discount: 0, error: null };
      if (a >= total) return { discount: 0, error: `İndirim toplamdan (${money(total)}) küçük olmalı` };
      return { discount: a, error: null };
    }
    return { discount: 0, error: null };
  }, [mode, effectivePercent, amountText, total]);

  const payable = roundMoney(total - discount);
  const canPay = !busy && !error;

  const pressKey = (k) => {
    if (busy) return;
    setAmountText((prev) => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === ',') return prev.includes(',') ? prev : (prev || '0') + ',';
      const [, dec = null] = prev.split(',');
      if (dec != null && dec.length >= 2) return prev;
      if (prev === '0') return k;
      if (prev.replace(',', '').length >= 7) return prev;
      return prev + k;
    });
  };

  const pay = (paymentMethod) => {
    if (!canPay) return;
    if (mode === 'percent' && discount > 0) {
      onConfirm({ paymentMethod, campaignPercentage: effectivePercent, discountAmountTL: null });
    } else if (mode === 'amount' && discount > 0) {
      onConfirm({ paymentMethod, campaignPercentage: null, discountAmountTL: discount });
    } else {
      onConfirm({ paymentMethod, campaignPercentage: null, discountAmountTL: null });
    }
  };

  const tab = (key, label) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => setMode(key)}
      className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
        mode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

  const chip = (active, label, onClick) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-xl py-3 text-base font-bold transition ${
        active
          ? 'bg-slate-900 text-white shadow-md'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400'
      }`}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => { if (!busy) onCancel(); }}
    >
      <div
        className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Masayı kapat</p>
              <h3 className="truncate text-2xl font-black tracking-tight text-slate-900">{tableName}</h3>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              aria-label="Kapat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">İndirim</p>
          <div className="mt-2 flex gap-1 rounded-2xl bg-slate-100 p-1">
            {tab('none', 'Yok')}
            {tab('percent', 'Yüzde %')}
            {tab('amount', 'Tutar ₺')}
          </div>

          {mode === 'percent' && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {PERCENT_PRESETS.map((p) =>
                  chip(percent === p, `%${p}`, () => { setPercent(p); setCustomPercent(''); })
                )}
              </div>
              <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 focus-within:ring-slate-400">
                <span className="text-sm font-semibold text-slate-500">Diğer %</span>
                <input
                  inputMode="decimal"
                  disabled={busy}
                  value={customPercent}
                  onChange={(e) => { setCustomPercent(e.target.value.replace(/[^0-9,]/g, '').slice(0, 5)); setPercent(null); }}
                  placeholder="örn. 12"
                  className="min-w-0 flex-1 bg-transparent text-right text-base font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-300"
                />
              </label>
            </div>
          )}

          {mode === 'amount' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <span className="text-sm font-semibold text-slate-500">İndirim tutarı</span>
                <span className={`text-3xl font-black tracking-tight ${amountText ? 'text-slate-900' : 'text-slate-300'}`}>
                  ₺{amountText || '0'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {AMOUNT_PRESETS.map((a) =>
                  chip(parseAmount(amountText) === a, `₺${a}`, () => setAmountText(String(a)))
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={busy}
                    onClick={() => pressKey(k)}
                    className="rounded-xl bg-white py-3 text-xl font-bold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.97]"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex justify-between text-sm font-semibold text-slate-500">
              <span>Toplam</span>
              <span>{money(total)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm font-bold text-emerald-600">
                <span>İndirim{mode === 'percent' ? ` (%${String(effectivePercent).replace('.', ',')})` : ''}</span>
                <span>−{money(discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
              <span className="text-sm font-bold text-slate-700">Ödenecek</span>
              <span className="text-3xl font-black tracking-tight text-slate-900">{money(payable)}</span>
            </div>
            {error && <p className="pt-1 text-sm font-semibold text-red-600">{error}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-6">
          {busy ? (
            <div className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-slate-100 py-5">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
              <span className="text-sm font-bold text-slate-700">Masa kapatılıyor…</span>
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
