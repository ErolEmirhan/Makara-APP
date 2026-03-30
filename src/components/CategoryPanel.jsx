import React, { useMemo } from 'react';

function isYanUrunlerCategoryRow(c) {
  const n = Number(c?.id);
  if (n === 999999 || n === -999) return true;
  const nm = (c?.name || '').trim().toLowerCase();
  return nm === 'yan ürünler' || nm === 'yan urunler';
}

const CategoryPanel = ({ categories, selectedCategory, onSelectCategory, isSultanBranch = false }) => {
  const visibleCategories = useMemo(() => {
    if (!isSultanBranch) return categories;
    return (categories || []).filter((c) => !isYanUrunlerCategoryRow(c));
  }, [categories, isSultanBranch]);

  return (
    <div className="mb-4">
      <div className="mb-5 pb-4 flex justify-center">
        <div
          className={`w-full max-w-md mx-auto text-center py-3 px-4 rounded-xl border shadow-sm ${
            isSultanBranch
              ? 'bg-white border-slate-200'
              : 'bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-100'
          }`}
        >
          <h2
            className={`text-xl font-bold tracking-tight ${
              isSultanBranch
                ? 'text-slate-800'
                : 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 bg-clip-text text-transparent'
            }`}
          >
            Kategoriler
          </h2>
          <div
            className={`mt-2 h-0.5 w-20 mx-auto rounded-full ${
              isSultanBranch ? 'bg-slate-200' : 'bg-gradient-to-r from-slate-300 via-slate-500 to-slate-300'
            }`}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2.5">
        {visibleCategories.map((category, index) => {
          const isSelected = selectedCategory?.id === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category)}
              className={`
                group relative overflow-hidden rounded-lg py-3 px-2.5 transition-all duration-300
                ${isSelected 
                  ? 'bg-pink-50 theme-sultan:bg-emerald-50 border border-pink-200 theme-sultan:border-emerald-200 shadow-sm' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                }
              `}
            >
              {/* Content */}
              <div className="relative z-10 flex items-center justify-center w-full">
                {/* Category Name */}
                <div className="text-center w-full">
                  <span className={`
                    font-medium text-xs transition-colors duration-300 leading-tight
                    ${isSelected ? 'text-pink-700 theme-sultan:text-emerald-700' : 'text-gray-700 group-hover:text-gray-900'}
                  `} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {category.name}
                  </span>
                </div>
              </div>
              
              {/* Selected indicator - subtle bottom border */}
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-300 theme-sultan:bg-emerald-300"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// PERFORMANS: React.memo ile gereksiz re-render'ları önle
export default React.memo(CategoryPanel, (prevProps, nextProps) => {
  return (
    prevProps.selectedCategory?.id === nextProps.selectedCategory?.id &&
    prevProps.categories.length === nextProps.categories.length &&
    prevProps.isSultanBranch === nextProps.isSultanBranch
  );
});

