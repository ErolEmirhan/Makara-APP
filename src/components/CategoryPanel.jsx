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
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="shrink-0 text-[13px] font-semibold tracking-tight text-[var(--pos-text)]">
          Kategoriler
        </h2>
        <p className="truncate text-right text-[12px] font-medium text-[var(--pos-text-tertiary)]">
          {visibleCategories.length} grup
        </p>
      </div>

      <div className="pos-category-scroll-wrap">
        <div
          ref={railRef}
          className="pos-category-rail flex touch-pan-x snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden pb-1"
          role="tablist"
          aria-label="Kategori listesi"
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
                  snap-start shrink-0 min-h-11 rounded-2xl border px-4 text-[13.5px] font-semibold
                  transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  ${isSultanBranch ? 'focus-visible:ring-emerald-500' : 'focus-visible:ring-zinc-900'}
                  ${
                    isSelected
                      ? isSultanBranch
                        ? 'border-emerald-700 bg-emerald-700 text-white shadow-[0_8px_20px_-12px_rgba(4,120,87,0.8)]'
                        : 'border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,0.55)] dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-[var(--pos-border)] bg-[var(--pos-surface-elevated)] text-[var(--pos-text)] hover:border-[var(--pos-border-strong)]'
                  }
                `}
              >
                <span className="block whitespace-nowrap">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>
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
