import React, { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const roundMoney = (x) => Math.round(Number(x) * 100) / 100;

/**
 * TablePartialPaymentModal — sade, iki-sütunlu kısmi ödeme arayüzü.
 *
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  Kısmi Ödeme · Masa X          Kalan ₺X / Toplam ₺X         [×] │
 *  ├─────────────────────────────────────┬────────────────────────────┤
 *  │  KALAN ÜRÜNLER (grid, büyük kart)   │  SEPET (seçilenler listesi)│
 *  │                                     │                            │
 *  │  [ ×1  Çay   ₺40 ] [ ×1 Kola ₺50 ]  │  Elmalı Soda  ×2  ₺80  [×] │
 *  │  [ ×1  Çay   ₺40 ] …                │  Limonlu Soda ×1  ₺40  [×] │
 *  │                                     │                            │
 *  ├─────────────────────────────────────┼────────────────────────────┤
 *  │  [ KALAN TÜMÜNÜ AL · ₺X ]           │  [ SEÇİLENLERİN ÖD. AL ₺X ]│
 *  └─────────────────────────────────────┴────────────────────────────┘
 */
const TablePartialPaymentModal = ({ order, items, onClose, onComplete }) => {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);
  const [paymentMethodModal, setPaymentMethodModal] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast((p) => ({ ...p, show: false })), 2800);
  }, []);

  const units = useMemo(() => {
    const list = [];
    (items || []).forEach((it) => {
      if (it.isGift) return;
      const qty = Number(it.quantity) || 0;
      const paid = Math.max(0, Math.min(qty, Number(it.paid_quantity) || 0));
      for (let i = 0; i < qty; i += 1) {
        list.push({
          key: `${it.id}__${i}`,
          itemId: it.id,
          unitIndex: i,
          productName: it.product_name,
          price: Number(it.price) || 0,
          paid: i < paid,
          paymentMethod: i < paid ? (it.payment_method || null) : null,
        });
      }
    });
    return list;
  }, [items]);

  const giftUnits = useMemo(() => {
    const list = [];
    (items || []).forEach((it) => {
      if (!it.isGift) return;
      const qty = Number(it.quantity) || 0;
      for (let i = 0; i < qty; i += 1) {
        list.push({ key: `gift_${it.id}__${i}`, productName: it.product_name });
      }
    });
    return list;
  }, [items]);

  const totalAmount = useMemo(
    () => roundMoney(units.reduce((s, u) => s + u.price, 0)),
    [units]
  );
  const paidAmount = useMemo(
    () => roundMoney(units.filter((u) => u.paid).reduce((s, u) => s + u.price, 0)),
    [units]
  );
  const remainingAmount = useMemo(
    () => roundMoney(totalAmount - paidAmount),
    [totalAmount, paidAmount]
  );
  const unpaidUnits = useMemo(() => units.filter((u) => !u.paid), [units]);
  const selectedUnits = useMemo(
    () => units.filter((u) => selectedKeys.has(u.key) && !u.paid),
    [units, selectedKeys]
  );
  const selectedAmount = useMemo(
    () => roundMoney(selectedUnits.reduce((s, u) => s + u.price, 0)),
    [selectedUnits]
  );

  /** Sepet satırları: aynı ürün tek satırda grup; unitKey listesi ile ekle/çıkar */
  const cartLines = useMemo(() => {
    const map = new Map();
    selectedUnits.forEach((u) => {
      const key = `${u.itemId}__${u.price}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productName: u.productName,
          price: u.price,
          quantity: 0,
          unitKeys: [],
        });
      }
      const row = map.get(key);
      row.quantity += 1;
      row.unitKeys.push(u.key);
    });
    return Array.from(map.values());
  }, [selectedUnits]);

  const toggleUnit = (unit) => {
    if (unit.paid || processing) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(unit.key)) next.delete(unit.key);
      else next.add(unit.key);
      return next;
    });
  };

  const removeLineFromCart = (line) => {
    if (processing) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      line.unitKeys.forEach((k) => next.delete(k));
      return next;
    });
  };

  const clearSelection = () => {
    if (processing) return;
    setSelectedKeys(new Set());
  };

  const processPayment = async (unitsToPay, paymentMethod) => {
    if (!window.electronAPI) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }
    const expected = Array.isArray(unitsToPay) ? unitsToPay.length : 0;
    if (expected === 0) return;

    const validUnits = unitsToPay.filter((u) => u && u.itemId != null && u.itemId !== '');
    if (validUnits.length === 0) {
      showToast('İşlenecek geçerli kalem bulunamadı', 'error');
      return;
    }

    const qtyByItem = new Map();
    validUnits.forEach((u) => {
      qtyByItem.set(u.itemId, (qtyByItem.get(u.itemId) || 0) + 1);
    });
    const paymentsPayload = Array.from(qtyByItem.entries()).map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    setProcessing(true);

    try {
      if (typeof window.electronAPI.payTableOrderItemsBulk === 'function') {
        let r;
        try {
          r = await window.electronAPI.payTableOrderItemsBulk({
            payments: paymentsPayload,
            paymentMethod,
          });
        } catch (err) {
          console.error('[KısmiÖdeme] Bulk IPC istisnası:', err);
          showToast('Ödeme alınamadı: ' + (err?.message || 'bilinmeyen hata'), 'error');
          return;
        }

        if (!r || !r.success) {
          const msg = r?.error || 'bilinmeyen hata';
          if (r?.errors && r.errors.length) console.error('[KısmiÖdeme] Bulk hataları:', r.errors);
          showToast('Ödeme alınamadı: ' + msg, 'error');
          return;
        }

        const paidUnits = r.results.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
        setSelectedKeys(new Set());

        if (paidUnits < expected) {
          showToast(
            `${paidUnits}/${expected} adet ödeme alındı` +
              (r.errors && r.errors[0] ? ` — ${r.errors[0]}` : ''),
            'warning'
          );
        } else {
          showToast(`${paidUnits} ürünün ödemesi alındı`, 'success');
        }

        if (onComplete && r.results.length > 0) {
          await onComplete(r.results);
        }
        return;
      }

      // Fallback: per-item IPC (eski)
      console.warn('[KısmiÖdeme] Bulk IPC yok, per-item fallback');
      const results = [];
      const errors = [];
      let paidCount = 0;
      for (let idx = 0; idx < paymentsPayload.length; idx += 1) {
        const { itemId, quantity } = paymentsPayload[idx];
        try {
          const r = await window.electronAPI.payTableOrderItem(itemId, paymentMethod, quantity);
          if (r && r.success) {
            results.push({ itemId, paymentMethod, quantity });
            paidCount += quantity;
          } else {
            errors.push(`#${itemId}: ${r?.error || 'bilinmeyen hata'}`);
          }
        } catch (err) {
          errors.push(`#${itemId}: ${err?.message || err}`);
        }
      }
      setSelectedKeys(new Set());
      if (paidCount === 0) {
        showToast('Ödeme alınamadı: ' + (errors[0] || 'bilinmeyen hata'), 'error');
      } else if (paidCount < expected) {
        showToast(`${paidCount}/${expected} adet ödeme alındı`, 'warning');
      } else {
        showToast(`${paidCount} ürünün ödemesi alındı`, 'success');
      }
      if (onComplete && results.length > 0) await onComplete(results);
    } finally {
      setProcessing(false);
    }
  };

  const requestPayment = (mode) => {
    if (processing) return;
    if (mode === 'selected') {
      if (selectedUnits.length === 0) {
        showToast('Önce soldan ürün seçin', 'warning');
        return;
      }
      setPaymentMethodModal({
        mode,
        title: 'Seçilenlerin Ödemesini Al',
        amount: selectedAmount,
        count: selectedUnits.length,
      });
    } else if (mode === 'remaining') {
      if (unpaidUnits.length === 0) {
        showToast('Kalan ürün yok', 'info');
        return;
      }
      setPaymentMethodModal({
        mode,
        title: 'Kalan Tümünü Al',
        amount: remainingAmount,
        count: unpaidUnits.length,
      });
    }
  };

  const confirmPayment = async (paymentMethod) => {
    const pmm = paymentMethodModal;
    setPaymentMethodModal(null);
    if (!pmm) return;
    const list = pmm.mode === 'remaining' ? unpaidUnits : selectedUnits;
    await processPayment(list, paymentMethod);
  };

  /**
   * Sol panel için üniteleri ÜRÜN BAZINDA grupla.
   * Grup anahtarı: `productName + price` (farklı itemId'lerdeki aynı ürün
   * aynı gruba girsin — örn. 2 çay ekledikten sonra 2 çay daha eklenmişse).
   * Grup içinde ödenmemişler önce, ödenmişler sonda.
   * Grup sıralaması: içinde kalan ödenmemiş olan gruplar önce, tamamı ödenmiş
   * olanlar altta.
   */
  const productGroups = useMemo(() => {
    const map = new Map();
    units.forEach((u) => {
      const key = `${u.productName}__${u.price}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productName: u.productName,
          price: u.price,
          units: [],
          unpaidCount: 0,
          paidCount: 0,
        });
      }
      const g = map.get(key);
      g.units.push(u);
      if (u.paid) g.paidCount += 1;
      else g.unpaidCount += 1;
    });
    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      units: [...g.units].sort((a, b) => Number(a.paid) - Number(b.paid)), // unpaid önce
    }));
    // içinde ödenmemiş olanlar önce
    arr.sort((a, b) => {
      if (a.unpaidCount > 0 && b.unpaidCount === 0) return -1;
      if (a.unpaidCount === 0 && b.unpaidCount > 0) return 1;
      return a.productName.localeCompare(b.productName, 'tr');
    });
    return arr;
  }, [units]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
        <div className="relative w-full h-[96vh] max-w-[1400px] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.55)] overflow-hidden">
          {/* Header — sade */}
          <header className="shrink-0 flex items-center justify-between gap-4 px-8 py-5 bg-white border-b border-slate-200">
            <div className="min-w-0 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-zinc-700 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">Kısmi Ödeme</p>
                <h2 className="truncate text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {order.table_name || 'Masa'}
                </h2>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-5 pr-2">
              <Stat label="Toplam" value={`₺${totalAmount.toFixed(2)}`} />
              <div className="h-8 w-px bg-slate-200" />
              <Stat label="Ödenen" value={`₺${paidAmount.toFixed(2)}`} tone="green" />
              <div className="h-8 w-px bg-slate-200" />
              <Stat label="Kalan" value={`₺${remainingAmount.toFixed(2)}`} tone={remainingAmount > 0.01 ? 'orange' : 'green'} />
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              aria-label="Kapat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          {/* İki sütun */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* SOL: Kalan Ürünler */}
            <section className="flex-1 min-w-0 flex flex-col bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200">
              <div className="shrink-0 flex items-center justify-between gap-3 px-8 py-4 bg-white/70 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Kalan Ürünler</h3>
                <span className="text-sm font-semibold text-slate-500">
                  {unpaidUnits.length} adet bekliyor
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6">
                {units.length === 0 ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400 text-lg">
                    Bu masada ödemesi alınacak ürün yok.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {productGroups.map((group) => (
                      <ProductGroupCard
                        key={group.key}
                        group={group}
                        selectedKeys={selectedKeys}
                        disabled={processing}
                        onToggleUnit={toggleUnit}
                      />
                    ))}
                  </div>
                )}

                {giftUnits.length > 0 && (
                  <div className="mt-8">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-700">
                      İkramlar ({giftUnits.length})
                    </h4>
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {giftUnits.map((g) => (
                        <div
                          key={g.key}
                          className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 px-4 py-4 text-center"
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">İkram</p>
                          <p className="mt-1.5 text-sm font-bold text-amber-900 line-clamp-2">{g.productName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SOL altta: Kalan Tümünü Al butonu */}
              <div className="shrink-0 px-6 sm:px-8 py-5 bg-white border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => requestPayment('remaining')}
                  disabled={processing || unpaidUnits.length === 0}
                  className={`w-full inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-lg sm:text-xl font-extrabold text-white shadow-lg transition ${
                    processing || unpaidUnits.length === 0
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-110 active:scale-[0.99]'
                  }`}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kalan Tümünü Al · ₺{remainingAmount.toFixed(2)}
                </button>
              </div>
            </section>

            {/* SAĞ: Sepet */}
            <aside className="shrink-0 w-full lg:w-[460px] xl:w-[500px] flex flex-col bg-white">
              <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 005.6 19H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {selectedUnits.length > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {selectedUnits.length}
                      </span>
                    )}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">Sepet</h3>
                    <p className="text-xs text-slate-500">Seçilen ürünler</p>
                  </div>
                </div>
                {selectedUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={processing}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40"
                  >
                    Temizle
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cartLines.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <ul className="space-y-3">
                    {cartLines.map((line) => (
                      <CartLine
                        key={line.key}
                        line={line}
                        disabled={processing}
                        onRemove={() => removeLineFromCart(line)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div className="shrink-0 px-5 py-5 bg-slate-50 border-t border-slate-200 space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sepet Toplamı</p>
                    <p className="text-3xl font-extrabold text-slate-900 leading-none mt-1">
                      ₺{selectedAmount.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    {selectedUnits.length} adet
                  </p>
                </div>

                {/* SAĞ altta: Seçilenlerin Ödemesini Al */}
                <button
                  type="button"
                  onClick={() => requestPayment('selected')}
                  disabled={processing || selectedUnits.length === 0}
                  className={`w-full inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-lg sm:text-xl font-extrabold text-white shadow-lg transition ${
                    processing || selectedUnits.length === 0
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 active:scale-[0.99]'
                  }`}
                >
                  {processing ? (
                    <Spinner />
                  ) : (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )}
                  Seçilenlerin Ödemesini Al
                </button>
              </div>
            </aside>
          </div>

          {processing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-xl">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
                <span className="text-sm font-semibold text-slate-800">Ödeme alınıyor…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {paymentMethodModal && (
        <PaymentMethodModal
          title={paymentMethodModal.title}
          amount={paymentMethodModal.amount}
          count={paymentMethodModal.count}
          onCancel={() => setPaymentMethodModal(null)}
          onSelect={confirmPayment}
        />
      )}

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </>,
    document.body
  );
};

/* ----------------------------- Alt bileşenler ----------------------------- */

const Stat = ({ label, value, tone = 'neutral' }) => {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'orange'
      ? 'text-orange-600'
      : 'text-slate-900';
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-base sm:text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
};

const EmptyCart = () => (
  <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center px-6 py-10">
    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
      <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 005.6 19H17"
        />
      </svg>
    </div>
    <p className="mt-4 text-base font-bold text-slate-700">Sepet boş</p>
    <p className="mt-2 text-sm text-slate-500 max-w-[260px]">
      Soldaki ürünlere tıklayarak ödemesini alacaklarınızı buraya ekleyin.
    </p>
  </div>
);

const CartLine = ({ line, disabled, onRemove }) => {
  const lineTotal = line.price * line.quantity;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-blue-300">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-extrabold text-blue-700">
          ×{line.quantity}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{line.productName}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Birim ₺{line.price.toFixed(2)} · Toplam{' '}
            <span className="font-bold text-slate-800">₺{lineTotal.toFixed(2)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Sepetten çıkar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </li>
  );
};

/**
 * Aynı ürünün tüm adetlerini tek bir çerçeveli kart altında topla.
 * Başlıkta ürün adı, toplam adet (kalan / ödenen), birim fiyat ve grup toplamı.
 * İçinde küçük bir alt-grid: her adet ayrı ünite kartı.
 * Tamamı ödenmişse başlık "tamam" tonunda (emerald).
 */
const ProductGroupCard = ({ group, selectedKeys, disabled, onToggleUnit }) => {
  const allPaid = group.unpaidCount === 0;
  const groupTotal = group.price * group.units.length;

  return (
    <div
      className={`rounded-2xl border-2 p-4 sm:p-5 shadow-sm transition ${
        allPaid
          ? 'border-emerald-300 bg-emerald-50/40'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Grup başlığı */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold shadow-sm ${
              allPaid
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-900 text-white'
            }`}
          >
            ×{group.units.length}
          </span>
          <div className="min-w-0">
            <h4
              className={`truncate text-base sm:text-lg font-extrabold ${
                allPaid ? 'text-emerald-900' : 'text-slate-900'
              }`}
            >
              {group.productName}
            </h4>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-500">
              Birim ₺{group.price.toFixed(2)}
              {group.paidCount > 0 && (
                <>
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span className="text-emerald-600">
                    {group.paidCount} ödendi
                  </span>
                </>
              )}
              {group.unpaidCount > 0 && (
                <>
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span className="text-orange-600">
                    {group.unpaidCount} bekliyor
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Grup Toplamı
          </p>
          <p
            className={`text-base sm:text-lg font-extrabold ${
              allPaid ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            ₺{groupTotal.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Alt grid: her adet ayrı kutu */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {group.units.map((u) => (
          <UnitCard
            key={u.key}
            unit={u}
            selected={selectedKeys.has(u.key) && !u.paid}
            disabled={disabled}
            onClick={() => onToggleUnit(u)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Kompakt ünite kartı — içinde bulunduğu ProductGroupCard başlığı ürün
 * adını + birim fiyatı zaten gösteriyor; burada yalnızca tek adet "ödeme
 * hakkı"nın (1 birim) görsel durumu: seçili / ödenmemiş / ödenmiş.
 */
const UnitCard = ({ unit, selected, disabled, onClick }) => {
  if (unit.paid) {
    return (
      <div
        className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-4 h-[96px] shadow-sm cursor-not-allowed"
        aria-disabled="true"
        title={unit.paymentMethod || 'Ödendi'}
      >
        <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow">
          Ödendi
        </span>
        {unit.paymentMethod && (
          <span className="text-[10px] font-semibold text-emerald-700 truncate max-w-full">
            {unit.paymentMethod}
          </span>
        )}
      </div>
    );
  }

  const base =
    'relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-4 h-[96px] text-center transition select-none';
  const stateClass = selected
    ? 'border-blue-600 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-[0_10px_24px_-8px_rgba(37,99,235,0.45)] ring-2 ring-blue-400/60'
    : 'border-slate-200 bg-white shadow-sm hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${stateClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-pressed={selected}
    >
      {selected && (
        <div className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <span
        className={`text-3xl sm:text-4xl font-extrabold leading-none ${
          selected ? 'text-blue-700' : 'text-slate-400'
        }`}
      >
        ×1
      </span>
      <span
        className={`text-[11px] font-bold uppercase tracking-wider ${
          selected ? 'text-blue-700' : 'text-slate-400'
        }`}
      >
        {selected ? 'Seçildi' : 'Seç'}
      </span>
    </button>
  );
};

const PaymentMethodModal = ({ title, amount, count, onCancel, onSelect }) => {
  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="mt-1 text-sm text-white/90">
            {count ? `${count} ürün · ` : ''}Toplam: ₺{Number(amount || 0).toFixed(2)}
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onSelect('Nakit')}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 py-6 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>Nakit</span>
            </button>
            <button
              type="button"
              onClick={() => onSelect('Kredi Kartı')}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 py-6 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <span>Kredi Kartı</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            İptal
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const Spinner = () => (
  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
);

export default TablePartialPaymentModal;
