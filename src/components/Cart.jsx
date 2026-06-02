import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

const Cart = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onSaveToTable,
  isSavingToTable = false,
  totalAmount,
  selectedTable,
  isSuriciBranch = false,
  orderNote,
  onOrderNoteChange,
  onToggleGift,
  onRequestAdisyon,
}) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState(orderNote || '');
  const textareaRef = useRef(null);

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [cart]
  );

  useEffect(() => {
    setNoteText(orderNote || '');
  }, [orderNote]);

  useEffect(() => {
    if (showNoteModal && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [showNoteModal]);

  return (
    <div className="pos-cart pos-catalog h-full flex flex-col min-h-0">
      {/* Başlık */}
      <div className="shrink-0 flex items-center justify-between gap-3 mb-4 pb-4 border-b border-black/[0.06] dark:border-white/10">
        <div className="min-w-0">
          <h2
            className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight"
            style={{ fontSize: 'var(--pos-fs-input)' }}
          >
            Sepet
          </h2>
          <p
            className="text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5"
            style={{ fontSize: 'var(--pos-fs-meta)' }}
          >
            {cart.length > 0 ? `${itemCount} adet · ${cart.length} kalem` : 'Ürün ekleyin'}
          </p>
        </div>
        {selectedTable && (
          <span
            className="shrink-0 max-w-[45%] truncate px-3 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold border border-black/[0.06] dark:border-white/10"
            style={{ fontSize: 'var(--pos-fs-meta)' }}
            title={selectedTable.name}
          >
            {isSuriciBranch ? 'Müşteri' : 'Masa'} · {selectedTable.name}
          </span>
        )}
      </div>

      {/* Ürün listesi */}
      <div className="flex-1 overflow-y-auto scrollbar-custom min-h-0 -mx-1 px-1 space-y-2.5 mb-4">
        {cart.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center py-14 px-4 rounded-[var(--pos-radius-lg)] bg-[var(--pos-surface-muted)] border border-[var(--pos-border)]"
            role="status"
          >
            <div
              className="w-14 h-14 rounded-2xl bg-[var(--pos-surface)] border border-[var(--pos-border)] flex items-center justify-center mb-3 text-[var(--pos-text-tertiary)]"
              aria-hidden
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--pos-text)]" style={{ fontSize: 'var(--pos-fs-product)' }}>
              Sepet boş
            </p>
            <p className="text-[var(--pos-text-secondary)] mt-1.5" style={{ fontSize: 'var(--pos-fs-meta)' }}>
              Soldan ürün seçerek başlayın
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const isGift = item.isGift || false;
            const lineTotal = isGift ? 0 : item.price * item.quantity;

            return (
              <article
                key={item.id}
                className={`rounded-[var(--pos-radius-md)] border bg-[var(--pos-surface-elevated)] transition-all duration-200 ${
                  isGift
                    ? 'border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-[var(--pos-border)] hover:border-[var(--pos-border-strong)] hover:shadow-[var(--pos-shadow-sm)]'
                }`}
                style={{ boxShadow: isGift ? undefined : 'var(--pos-shadow-sm)' }}
              >
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`font-semibold leading-snug break-words ${
                          isGift
                            ? 'text-[var(--pos-text-secondary)] line-through'
                            : 'text-[var(--pos-text)]'
                        }`}
                        style={{ fontSize: 'var(--pos-fs-product)' }}
                      >
                        {item.name}
                      </h4>
                      {isGift && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wide"
                          style={{ fontSize: 'var(--pos-fs-overline)' }}
                        >
                          İkram
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 font-bold tabular-nums tracking-tight ${
                        isGift ? 'text-[var(--pos-text-tertiary)] line-through' : 'pos-price-gradient'
                      }`}
                      style={{ fontSize: 'var(--pos-fs-price)' }}
                    >
                      ₺{lineTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--pos-surface-muted)] border border-[var(--pos-border)]">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="pos-cart-qty-btn"
                        title="Azalt"
                        aria-label="Azalt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      </button>
                      <span
                        className="w-8 text-center font-bold tabular-nums text-[var(--pos-text)]"
                        style={{ fontSize: 'var(--pos-fs-product)' }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="pos-cart-qty-btn"
                        title="Artır"
                        aria-label="Artır"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleGift && onToggleGift(item.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          isGift
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                            : 'bg-[var(--pos-surface-muted)] text-[var(--pos-text-secondary)] border-[var(--pos-border)] hover:bg-[var(--pos-surface)]'
                        }`}
                        title={isGift ? 'İkramı iptal et' : 'İkram et'}
                      >
                        {isGift ? 'İkram ✓' : 'İkram'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="pos-cart-qty-btn text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Kaldır"
                        aria-label="Ürünü kaldır"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {!isGift && (
                    <p
                      className="mt-2 text-[var(--pos-text-tertiary)] tabular-nums"
                      style={{ fontSize: 'var(--pos-fs-overline)' }}
                    >
                      Birim ₺{item.price.toFixed(2)}
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Alt: özet + aksiyonlar */}
      <div className="shrink-0 pt-4 border-t border-black/[0.06] dark:border-white/10 space-y-3">
        {cart.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClearCart}
              className="text-sm font-semibold text-[#86868b] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              Sepeti temizle
            </button>
            <span
              className="text-[var(--pos-text-secondary)] tabular-nums font-medium"
              style={{ fontSize: 'var(--pos-fs-meta)' }}
            >
              Ara toplam ₺{totalAmount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 px-0.5">
          <span
            className="font-bold text-[var(--pos-text-secondary)] uppercase tracking-wide"
            style={{ fontSize: 'var(--pos-fs-meta)' }}
          >
            Toplam
          </span>
          <span
            className="font-black tabular-nums pos-price-gradient leading-none"
            style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}
          >
            ₺{totalAmount.toFixed(2)}
          </span>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNoteModal(true)}
            className="pos-cart-secondary-btn !py-2.5 justify-between px-4"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {orderNote ? 'Notu düzenle' : 'Sipariş notu ekle'}
            </span>
            {orderNote ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
            ) : null}
          </button>
        )}

        {selectedTable ? (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onSaveToTable}
              disabled={cart.length === 0 || isSavingToTable}
              className="pos-cart-primary-btn"
            >
              {isSavingToTable ? (
                <>
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-80" />
                  Gönderiliyor…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {isSuriciBranch ? 'Müşteriye kaydet' : 'Masaya kaydet'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onRequestAdisyon}
              disabled={cart.length === 0}
              className="pos-cart-secondary-btn"
            >
              <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Adisyon yazdır
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="pos-cart-primary-btn mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Ödeme al
          </button>
        )}
      </div>

      {showNoteModal && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[999] animate-fade-in px-4">
          <div
            className="pos-catalog bg-[var(--pos-surface-elevated)] rounded-[var(--pos-radius-lg)] p-6 w-full max-w-md shadow-[var(--pos-shadow-md)] border border-[var(--pos-border)] transform animate-scale-in"
            role="dialog"
            aria-labelledby="cart-note-title"
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 id="cart-note-title" className="font-bold text-[var(--pos-text)]" style={{ fontSize: 'var(--pos-fs-input)' }}>
                  Sipariş notu
                </h2>
                <p className="text-[var(--pos-text-secondary)] mt-1" style={{ fontSize: 'var(--pos-fs-meta)' }}>
                  Mutfak veya kasa için kısa not
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText(orderNote || '');
                }}
                className="pos-cart-qty-btn shrink-0"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--pos-radius-md)] border border-[var(--pos-border-strong)] bg-[var(--pos-surface-muted)] text-[var(--pos-text)] placeholder:text-[var(--pos-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-pink-500/20 theme-sultan:focus:ring-emerald-500/25 focus:border-[var(--pos-border-strong)] resize-none"
              style={{ fontSize: 'var(--pos-fs-input)' }}
              placeholder="Örn: az şekerli, ekstra peynir…"
              rows={4}
              maxLength={200}
            />
            <p className="text-right text-[var(--pos-text-tertiary)] mt-1.5 tabular-nums" style={{ fontSize: 'var(--pos-fs-overline)' }}>
              {noteText.length}/200
            </p>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText(orderNote || '');
                }}
                className="pos-cart-secondary-btn flex-1"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  onOrderNoteChange?.(noteText.trim());
                  setShowNoteModal(false);
                }}
                className="pos-cart-primary-btn flex-1"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(Cart);
