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
    const grid = railRef.current;
    if (!grid || selectedId === undefined || selectedId === null) return;
    const raw = String(selectedId);
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(raw)
        : raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const btn = grid.querySelector(`[data-category-id="${esc}"]`);
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId, visibleCategories.length]);

  return (
    <section
      className={`pos-catalog mb-4 rounded-[var(--pos-radius-lg)] border border-slate-200/90 dark:border-slate-600/85 bg-white/95 dark:bg-slate-900/92 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] theme-sultan:border-emerald-200/80 theme-sultan:shadow-[0_1px_3px_rgba(6,78,59,0.08)] overflow-hidden`}
      aria-label="Ürün kategorileri"
    >
      <div
        className={`flex items-stretch gap-0 border-b border-slate-100 theme-sultan:border-emerald-100 dark:border-slate-700 dark:theme-sultan:border-emerald-900/40 ${
          isSultanBranch ? 'bg-slate-50/80 dark:bg-slate-800/90' : 'bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 dark:from-slate-900/95 dark:via-slate-900/98 dark:to-slate-900/95'
        }`}
      >
        <div
          className={`w-1 shrink-0 self-stretch min-h-[52px] ${
            isSultanBranch ? 'bg-emerald-600' : 'bg-gradient-to-b from-pink-600 to-indigo-600 theme-sultan:from-emerald-600 theme-sultan:to-teal-600'
          }`}
          aria-hidden
        />
        <div className="flex-1 py-3 px-4 min-w-0">
          <p
            className="font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase"
            style={{ fontSize: 'var(--pos-fs-overline)', letterSpacing: '0.08em' }}
          >
            Katalog
          </p>
          <h2
            className="font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5 font-display"
            style={{ fontSize: 'var(--pos-fs-product)' }}
          >
            Kategoriler
          </h2>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          ref={railRef}
          className="pos-category-grid grid gap-2 touch-manipulation [grid-template-columns:repeat(auto-fill,minmax(6.25rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]"
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
                  w-full min-w-0 text-center rounded-[var(--pos-radius-md)] border font-semibold
                  transition-all duration-200 ease-out
                  min-h-[var(--pos-touch-min)] px-2 py-2.5 sm:px-3 flex flex-col items-center justify-center
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  ${
                    isSultanBranch
                      ? 'focus-visible:ring-emerald-500'
                      : 'focus-visible:ring-pink-500'
                  }
                  ${
                    isSelected
                      ? isSultanBranch
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-600/25 dark:border-emerald-500 dark:bg-emerald-950/55 dark:text-emerald-100 dark:ring-emerald-500/30'
                        : 'border-pink-600 bg-pink-50 text-pink-950 shadow-sm ring-1 ring-pink-600/20 dark:border-pink-500 dark:bg-pink-950/50 dark:text-pink-100 dark:ring-pink-500/25'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white'
                  }
                `}
                style={{ fontSize: 'var(--pos-fs-category)', lineHeight: 1.35 }}
              >
                <span className="line-clamp-3 break-words hyphens-auto w-full">{category.name}</span>
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
