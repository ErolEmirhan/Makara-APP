import React, { useMemo, useRef, useEffect } from 'react';

function isYanUrunlerCategoryRow(c) {
  const n = Number(c?.id);
  if (n === 999999 || n === -999) return true;
  const nm = (c?.name || '').trim().toLowerCase();
  return nm === 'yan ürünler' || nm === 'yan urunler';
}

const CategoryPanel = ({ categories, selectedCategory, onSelectCategory, isSultanBranch = false }) => {
  const railRef = useRef(null);
  const selectedId = selectedCategory?.id;

  const visibleCategories = useMemo(() => {
    if (!isSultanBranch) return categories;
    return (categories || []).filter((c) => !isYanUrunlerCategoryRow(c));
  }, [categories, isSultanBranch]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || selectedId === undefined || selectedId === null) return;
    const raw = String(selectedId);
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(raw)
        : raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const btn = rail.querySelector(`[data-category-id="${esc}"]`);
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedId, visibleCategories.length]);

  return (
    <section
      className="pos-catalog shrink-0 mb-3 w-full min-w-0 max-w-full"
      aria-label="Ürün kategorileri"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2.5 px-0.5 min-w-0">
        <h2
          className="font-semibold tracking-tight text-[var(--pos-text)] shrink-0"
          style={{ fontSize: 'var(--pos-fs-input)' }}
        >
          Kategoriler
        </h2>
        {selectedCategory?.name ? (
          <p
            className="truncate text-[var(--pos-text-secondary)] font-medium min-w-0 text-right"
            style={{ fontSize: 'var(--pos-fs-meta)' }}
          >
            {selectedCategory.name}
          </p>
        ) : null}
      </div>

      <div className="pos-category-scroll-wrap">
        <div
          ref={railRef}
          className="pos-category-rail flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory touch-pan-x"
          role="tablist"
          aria-label="Kategori listesi — yatay kaydırın"
        >
          {visibleCategories.map((category) => {
            const isSelected = selectedCategory?.id === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-category-id={String(category.id)}
                onClick={() => onSelectCategory(category)}
                className={`
                  snap-start shrink-0 flex-none min-h-[var(--pos-touch-min)] px-4 sm:px-5
                  rounded-[var(--pos-radius-pill)] font-semibold
                  transition-all duration-200 ease-out
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  ${isSultanBranch ? 'focus-visible:ring-emerald-500' : 'focus-visible:ring-pink-500'}
                  ${
                    isSelected
                      ? isSultanBranch
                        ? 'bg-emerald-600 text-white shadow-[var(--pos-shadow-sm)]'
                        : 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-[var(--pos-shadow-sm)]'
                      : 'bg-[var(--pos-surface-muted)] text-[var(--pos-text)] border border-[var(--pos-border)] hover:bg-[var(--pos-surface)] hover:border-[var(--pos-border-strong)]'
                  }
                `}
                style={{ fontSize: 'var(--pos-fs-category)', lineHeight: 1.25 }}
              >
                <span className="whitespace-nowrap block">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p
        className="mt-1 text-[var(--pos-text-tertiary)] font-medium px-0.5 sm:hidden"
        style={{ fontSize: 'var(--pos-fs-overline)' }}
      >
        Daha fazla kategori için sola-sağa kaydırın
      </p>
    </section>
  );
};

export default React.memo(CategoryPanel, (prevProps, nextProps) => {
  return (
    prevProps.selectedCategory?.id === nextProps.selectedCategory?.id &&
    prevProps.categories.length === nextProps.categories.length &&
    prevProps.isSultanBranch === nextProps.isSultanBranch
  );
});
