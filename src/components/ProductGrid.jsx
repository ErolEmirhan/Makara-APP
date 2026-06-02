import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const INITIAL_VISIBLE = 48;
const LOAD_MORE_STEP = 56;

const ProductGrid = ({
  products,
  onAddToCart,
  isSearchMode = false,
  categoryName = '',
}) => {
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

  const sectionTitle = isSearchMode
    ? 'Arama sonuçları'
    : categoryName || 'Ürünler';

  if (!products.length) {
    return (
      <div
        className="pos-catalog flex-1 flex flex-col min-h-0"
        role="region"
        aria-label="Ürün listesi"
      >
        <div className="shrink-0 mb-3 px-0.5">
          <h3
            className="font-semibold text-[var(--pos-text)]"
            style={{ fontSize: 'var(--pos-fs-input)' }}
          >
            {sectionTitle}
          </h3>
        </div>
        <div
          className="flex-1 flex flex-col items-center justify-center min-h-[10rem] rounded-[var(--pos-radius-lg)] bg-[var(--pos-surface-muted)] border border-[var(--pos-border)] text-center px-6 py-10"
          role="status"
        >
          <div
            className="w-12 h-12 rounded-full bg-[var(--pos-surface)] border border-[var(--pos-border)] flex items-center justify-center mb-3 text-[var(--pos-text-tertiary)]"
            aria-hidden
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p
            className="text-[var(--pos-text)] font-semibold"
            style={{ fontSize: 'var(--pos-fs-product)' }}
          >
            {isSearchMode ? 'Eşleşen ürün bulunamadı' : 'Bu kategoride ürün yok'}
          </p>
          <p
            className="text-[var(--pos-text-secondary)] mt-1.5 max-w-xs"
            style={{ fontSize: 'var(--pos-fs-meta)', lineHeight: 1.45 }}
          >
            {isSearchMode
              ? 'Farklı bir arama deneyin veya kategori seçin.'
              : 'Başka bir kategori seçerek devam edin.'}
          </p>
        </div>
      </div>
    );
  }

  const showSentinel = visibleCount < products.length;

  return (
    <div
      className="pos-catalog flex-1 flex flex-col min-h-0"
      role="region"
      aria-label="Ürün listesi"
    >
      <div className="shrink-0 flex items-baseline justify-between gap-3 mb-3 px-0.5">
        <h3
          className="font-semibold text-[var(--pos-text)] truncate min-w-0"
          style={{ fontSize: 'var(--pos-fs-input)' }}
        >
          {sectionTitle}
        </h3>
        <span
          className="shrink-0 tabular-nums text-[var(--pos-text-secondary)] font-medium"
          style={{ fontSize: 'var(--pos-fs-meta)' }}
        >
          {products.length} ürün
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pos-catalog-scroll scrollbar-custom min-h-0 -mx-0.5 px-0.5"
      >
        <div
          className="pos-product-grid grid gap-2.5 sm:gap-3 pb-4"
          role="list"
        >
          {visibleProducts.map((product) => {
            const trackStock = product.trackStock === true;
            const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
            const isOutOfStock = trackStock && stock !== null && stock === 0;
            const price = Number(product.price);

            return (
              <article
                key={product.id}
                role="listitem"
                className={`
                  group relative flex flex-col
                  rounded-[var(--pos-radius-md)] bg-[var(--pos-surface-elevated)]
                  border border-[var(--pos-border)]
                  overflow-hidden touch-manipulation
                  transition-[box-shadow,transform,border-color] duration-200 ease-out
                  ${
                    isOutOfStock
                      ? 'opacity-55 cursor-not-allowed'
                      : 'cursor-pointer hover:border-[var(--pos-border-strong)] hover:shadow-[var(--pos-shadow-md)] active:scale-[0.985]'
                  }
                `}
                style={{ boxShadow: 'var(--pos-shadow-sm)' }}
              >
                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => !isOutOfStock && onAddToCart(product)}
                  className="flex flex-col flex-1 text-left w-full min-h-[var(--pos-touch-min)] disabled:cursor-not-allowed p-3.5 sm:p-4 min-w-0"
                >
                  <h4
                    className={`font-semibold text-[var(--pos-text)] break-words hyphens-auto w-full leading-snug ${
                      isOutOfStock ? 'text-[var(--pos-text-secondary)]' : ''
                    }`}
                    style={{ fontSize: 'var(--pos-fs-product)' }}
                  >
                    {product.name}
                  </h4>

                  {(product.per_person || product.gluten_free) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {product.per_person ? (
                        <span
                          className="inline-flex rounded-[var(--pos-radius-sm)] bg-amber-500/10 text-amber-800 dark:text-amber-200 font-semibold px-2 py-0.5"
                          style={{ fontSize: 'var(--pos-fs-overline)' }}
                        >
                          Kişi başı
                        </span>
                      ) : null}
                      {product.gluten_free ? (
                        <span
                          className="inline-flex rounded-[var(--pos-radius-sm)] bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-semibold px-2 py-0.5"
                          style={{ fontSize: 'var(--pos-fs-overline)' }}
                        >
                          Glutensiz
                        </span>
                      ) : null}
                    </div>
                  )}

                  {product.description ? (
                    <p
                      className="text-[var(--pos-text-secondary)] mt-2 line-clamp-2"
                      style={{ fontSize: 'var(--pos-fs-meta)', lineHeight: 1.45 }}
                      title={product.description}
                    >
                      {product.description}
                    </p>
                  ) : null}

                  <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                    <span
                      className={`font-bold tabular-nums tracking-tight ${
                        isOutOfStock ? 'text-[var(--pos-text-tertiary)]' : 'pos-price-gradient'
                      }`}
                      style={{ fontSize: 'var(--pos-fs-price-lg)', lineHeight: 1.2 }}
                    >
                      ₺{price.toFixed(2)}
                    </span>
                    {trackStock && stock !== null && !isOutOfStock && (
                      <span
                        className="text-[var(--pos-text-tertiary)] tabular-nums font-medium"
                        style={{ fontSize: 'var(--pos-fs-overline)' }}
                      >
                        Stok {stock}
                      </span>
                    )}
                  </div>
                </button>

                {isOutOfStock && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-[var(--pos-surface)]/60 backdrop-blur-[1px] z-10 pointer-events-none"
                    aria-hidden
                  >
                    <span
                      className="rounded-[var(--pos-radius-pill)] bg-[var(--pos-text)] text-[var(--pos-surface)] font-semibold px-3 py-1"
                      style={{ fontSize: 'var(--pos-fs-meta)' }}
                    >
                      Tükendi
                    </span>
                  </div>
                )}
              </article>
            );
          })}
          {showSentinel ? (
            <div ref={sentinelRef} className="col-span-full h-1 w-full shrink-0" aria-hidden />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductGrid);
