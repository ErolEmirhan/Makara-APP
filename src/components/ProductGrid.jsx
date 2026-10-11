import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  displayProductImage,
  peekProductImage,
  registerProductImage,
  resolveProductImage,
} from '../utils/productImageCache';

const INITIAL_VISIBLE = 48;
const LOAD_MORE_STEP = 56;

const HavzanProductCard = React.memo(function HavzanProductCard({ product, onAddToCart }) {
  const trackStock = product.trackStock === true;
  const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
  const isOutOfStock = trackStock && stock !== null && stock === 0;
  const price = Number(product.price);
  const [src, setSrc] = useState(() => peekProductImage(product.id, product.image) || displayProductImage(product.image));

  useEffect(() => {
    let cancelled = false;
    const immediate = peekProductImage(product.id, product.image) || displayProductImage(product.image);
    if (immediate) setSrc(immediate);
    else setSrc(null);
    resolveProductImage(product.id, product.image).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.image]);

  const priceLabel = Number.isFinite(price) ? price.toFixed(2) : '0.00';

  return (
    <article role="listitem" className="min-w-0">
      <button
        type="button"
        disabled={isOutOfStock}
        onClick={() => {
          if (isOutOfStock) return;
          const { image: _image, ...sellable } = product;
          onAddToCart(sellable);
        }}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-[var(--pos-border)] bg-[var(--pos-surface-elevated)] text-left touch-manipulation shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.28)] transition duration-200 ${
          isOutOfStock
            ? 'cursor-not-allowed opacity-70'
            : 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--pos-border-strong)] hover:shadow-[0_12px_32px_-18px_rgba(0,0,0,0.35)] active:scale-[0.985]'
        }`}
      >
        <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[var(--pos-surface-muted)]">
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className={`h-full w-full object-cover transition duration-500 ${
                isOutOfStock ? 'grayscale' : 'group-hover:scale-[1.03]'
              }`}
              onError={() => {
                if (src && !String(src).startsWith('data:image') && !String(src).startsWith('blob:')) {
                  setSrc(null);
                }
              }}
            />
          ) : (
            <img
              src="./logo.png"
              alt=""
              draggable={false}
              className="h-full w-full scale-125 object-cover opacity-70 blur-md"
            />
          )}

          {(product.per_person || product.gluten_free) && (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {product.per_person ? (
                <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 shadow-sm">
                  Kişi başı
                </span>
              ) : null}
              {product.gluten_free ? (
                <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm">
                  Glutensiz
                </span>
              ) : null}
            </div>
          )}

          {isOutOfStock ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/55">
              <span className="rounded-full bg-[var(--pos-text)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--pos-surface)]">
                Tükendi
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[4.6rem] flex-1 flex-col px-3 pb-3 pt-2.5">
          <h4 className="line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-tight text-[var(--pos-text)]">
            {product.name}
          </h4>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span className={`text-[16px] font-bold tabular-nums tracking-tight ${isOutOfStock ? 'text-[var(--pos-text-tertiary)]' : 'pos-price-gradient'}`}>
              ₺{priceLabel}
            </span>
            {trackStock && stock !== null && !isOutOfStock ? (
              <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-[var(--pos-text-tertiary)]">
                Stok {stock}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </article>
  );
});

const ProductGrid = ({
  products,
  onAddToCart,
  isSearchMode = false,
  categoryName = '',
  visual = false,
  groupByCategory = false,
  categories = [],
}) => {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_VISIBLE, products.length));
  }, [products]);

  useEffect(() => {
    for (const product of products) {
      registerProductImage(product.id, product.image);
    }
  }, [products]);

  const grouped = visual && groupByCategory && !isSearchMode;

  const categorySections = useMemo(() => {
    if (!grouped) return [];
    const names = new Map();
    const order = [];
    for (const category of categories || []) {
      const id = Number(category.id);
      if (!Number.isFinite(id) || id === -998 || id === -999) continue;
      if (names.has(id)) continue;
      names.set(id, category.name || 'Kategori');
      order.push({ id, rank: category.order_index ?? order.length });
    }
    order.sort((a, b) => a.rank - b.rank || a.id - b.id);
    const buckets = new Map(order.map((entry) => [entry.id, []]));
    const other = [];
    for (const product of products) {
      const id = Number(product.category_id);
      if (buckets.has(id)) buckets.get(id).push(product);
      else other.push(product);
    }
    const sections = order
      .map((entry) => ({
        id: entry.id,
        name: names.get(entry.id),
        products: buckets.get(entry.id),
      }))
      .filter((section) => section.products.length > 0);
    if (other.length) sections.push({ id: 'other', name: 'Diğer', products: other });
    return sections;
  }, [grouped, categories, products]);

  const visibleSections = useMemo(() => {
    if (!grouped) return [];
    let left = visibleCount;
    const windowed = [];
    for (const section of categorySections) {
      if (left <= 0) break;
      const take = section.products.slice(0, left);
      left -= take.length;
      if (take.length) {
        windowed.push({ ...section, products: take, total: section.products.length });
      }
    }
    return windowed;
  }, [grouped, categorySections, visibleCount]);

  const visibleProducts = useMemo(
    () => (grouped ? [] : products.slice(0, Math.min(visibleCount, products.length))),
    [grouped, products, visibleCount]
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
        {grouped ? (
          <div className="space-y-8 pb-4">
            {visibleSections.map((section) => (
              <section key={section.id} aria-label={section.name}>
                <div className="mb-3 flex items-end justify-between gap-3 border-b border-[var(--pos-border)] pb-2">
                  <h4 className="text-[16px] font-bold tracking-tight text-[var(--pos-text)]">
                    {section.name}
                  </h4>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--pos-text-tertiary)]">
                    {section.total} ürün
                  </span>
                </div>
                <div className="pos-product-grid--havzan grid gap-3" role="list">
                  {section.products.map((product) => (
                    <HavzanProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
                  ))}
                </div>
              </section>
            ))}
            {showSentinel ? <div ref={sentinelRef} className="h-1 w-full" aria-hidden /> : null}
          </div>
        ) : null}
        {!grouped ? (
        <div
          className={`grid pb-4 ${visual ? 'pos-product-grid--havzan gap-3' : 'pos-product-grid gap-2.5 sm:gap-3'}`}
          role="list"
        >
          {visual
            ? visibleProducts.map((product) => (
                <HavzanProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
              ))
            : null}
          {!visual && visibleProducts.map((product) => {
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
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(ProductGrid);
