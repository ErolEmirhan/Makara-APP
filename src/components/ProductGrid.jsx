import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const INITIAL_VISIBLE = 48;
const LOAD_MORE_STEP = 56;

const ProductGrid = ({ products, onAddToCart, isSearchMode = false }) => {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_VISIBLE, products.length));
  }, [products]);

  const visibleProducts = useMemo(
    () => products.slice(0, Math.min(visibleCount, products.length)),
    [products, visibleCount]
  );

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + LOAD_MORE_STEP, products.length));
  }, [products.length]);

  useEffect(() => {
    if (visibleCount >= products.length) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: '240px', threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [loadMore, visibleCount, products.length]);

  if (!products.length) {
    return (
      <div
        className="pos-catalog flex-1 flex flex-col items-center justify-center min-h-[12rem] rounded-[var(--pos-radius-lg)] border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 text-center px-6 py-10 theme-sultan:border-emerald-200/80 dark:theme-sultan:border-emerald-800/60"
        role="status"
      >
        <p className="text-slate-500 dark:text-slate-300 font-medium" style={{ fontSize: 'var(--pos-fs-product)' }}>
          {isSearchMode
            ? 'Tüm kategorilerde eşleşen ürün yok.'
            : 'Bu kategoride gösterilecek ürün yok.'}
        </p>
        <p className="text-slate-400 dark:text-slate-500 mt-2" style={{ fontSize: 'var(--pos-fs-meta)' }}>
          {isSearchMode
            ? 'Farklı bir arama deneyin veya aramayı temizleyip kategori seçin.'
            : 'Başka bir kategori seçin.'}
        </p>
      </div>
    );
  }

  const showSentinel = visibleCount < products.length;

  return (
    <div
      ref={scrollRef}
      className="pos-catalog flex-1 overflow-y-auto pos-catalog-scroll scrollbar-custom min-h-0"
    >
      <div
        className="grid gap-2.5 pb-4 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(11.25rem,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]"
        role="list"
        aria-label="Ürün listesi"
      >
        {visibleProducts.map((product) => {
          const trackStock = product.trackStock === true;
          const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
          const isOutOfStock = trackStock && stock !== null && stock === 0;

          return (
            <article
              key={product.id}
              role="listitem"
              className={`
                group relative flex flex-col rounded-[var(--pos-radius-md)] border bg-white dark:bg-slate-800/95 overflow-hidden
                transition-[box-shadow,transform,border-color] duration-200 ease-out touch-manipulation
                ${
                  isOutOfStock
                    ? 'border-slate-200 dark:border-slate-600 opacity-60 cursor-not-allowed grayscale-[0.2]'
                    : 'border-slate-200/90 dark:border-slate-600/90 cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.14)] dark:hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] active:scale-[0.99] theme-sultan:hover:border-emerald-200/90 dark:theme-sultan:hover:border-emerald-600/70'
                }
              `}
              style={{
                boxShadow: isOutOfStock
                  ? 'inset 0 1px 0 rgba(255,255,255,0.6)'
                  : '0 1px 2px rgba(15, 23, 42, 0.05)',
              }}
            >
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => !isOutOfStock && onAddToCart(product)}
                className="flex flex-row flex-1 text-left w-full min-h-[var(--pos-touch-min)] disabled:cursor-not-allowed items-stretch min-w-0"
              >
                <div
                  className={`w-1 shrink-0 self-stretch ${
                    isOutOfStock
                      ? 'bg-slate-300'
                      : 'bg-gradient-to-b from-pink-500 to-indigo-600 theme-sultan:from-emerald-600 theme-sultan:to-teal-700'
                  }`}
                  aria-hidden
                />

                <div className="flex flex-col flex-1 min-w-0 py-3 pl-3 pr-3">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <h3
                      className={`font-semibold text-slate-900 dark:text-slate-100 break-words hyphens-auto flex-1 min-w-0 ${
                        isOutOfStock ? 'text-slate-500 dark:text-slate-400' : ''
                      }`}
                      style={{ fontSize: 'var(--pos-fs-product)', lineHeight: 1.35 }}
                    >
                      {product.name}
                    </h3>
                    {!isOutOfStock && (
                      <span
                        className="shrink-0 tabular-nums font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700/90 border border-slate-200/90 dark:border-slate-600 rounded-[var(--pos-radius-sm)] px-2 py-0.5 theme-sultan:bg-emerald-50/80 theme-sultan:border-emerald-200/60 dark:theme-sultan:bg-emerald-950/50 dark:theme-sultan:border-emerald-700/60"
                        style={{ fontSize: 'var(--pos-fs-price)', lineHeight: 1.2 }}
                      >
                        ₺{Number(product.price).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {product.per_person ? (
                      <span
                        className="inline-flex rounded-[var(--pos-radius-sm)] bg-amber-100 text-amber-900 font-semibold px-1.5 py-0.5"
                        style={{ fontSize: 'var(--pos-fs-overline)' }}
                      >
                        Kişi başı
                      </span>
                    ) : null}
                    {product.gluten_free ? (
                      <span
                        className="inline-flex rounded-[var(--pos-radius-sm)] bg-emerald-100 text-emerald-900 font-bold uppercase tracking-wide px-1.5 py-0.5"
                        style={{ fontSize: 'var(--pos-fs-overline)' }}
                      >
                        Glutensiz
                      </span>
                    ) : null}
                  </div>

                  {product.description ? (
                    <p
                      className="text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 text-left"
                      style={{ fontSize: 'var(--pos-fs-meta)', lineHeight: 1.4 }}
                      title={product.description}
                    >
                      {product.description}
                    </p>
                  ) : null}

                  <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700">
                    {isOutOfStock ? (
                      <span
                        className="font-semibold text-slate-500 tabular-nums"
                        style={{ fontSize: 'var(--pos-fs-meta)' }}
                      >
                        ₺{Number(product.price).toFixed(2)}
                      </span>
                    ) : (
                      <span
                        className="text-slate-400 dark:text-slate-500 font-medium"
                        style={{ fontSize: 'var(--pos-fs-overline)' }}
                      >
                        Sepete eklemek için dokunun
                      </span>
                    )}
                    {!isOutOfStock && (
                      <span
                        className="shrink-0 rounded-[var(--pos-radius-sm)] px-2 py-0.5 font-semibold text-pink-700 bg-pink-50 border border-pink-100 opacity-80 group-hover:opacity-100 transition-opacity theme-sultan:text-emerald-800 theme-sultan:bg-emerald-50 theme-sultan:border-emerald-100 dark:text-pink-200 dark:bg-pink-950/60 dark:border-pink-800/60 dark:theme-sultan:text-emerald-200 dark:theme-sultan:bg-emerald-950/50 dark:theme-sultan:border-emerald-800/50 max-sm:opacity-100"
                        style={{ fontSize: 'var(--pos-fs-overline)' }}
                      >
                        Ekle
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {isOutOfStock && (
                <div
                  className="absolute top-2 right-2 rounded-[var(--pos-radius-sm)] bg-red-600 text-white font-bold px-2 py-1 shadow-md z-10"
                  style={{ fontSize: 'var(--pos-fs-meta)' }}
                >
                  Tükendi
                </div>
              )}
            </article>
          );
        })}
        {showSentinel ? (
          <div
            ref={sentinelRef}
            className="col-span-full h-1 w-full shrink-0"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(ProductGrid);
