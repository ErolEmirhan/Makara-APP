import React from 'react';

const CategoryPanel = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="mb-4">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800 tracking-tight">
            Kategoriler
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2.5">
        {categories.map((category, index) => {
          const isSelected = selectedCategory?.id === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category)}
              className={`
                group relative overflow-hidden rounded-lg py-3 px-2.5 transition-all duration-300
                ${isSelected 
                  ? 'bg-pink-50 border border-pink-200 shadow-sm' 
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
                    ${isSelected ? 'text-pink-700' : 'text-gray-700 group-hover:text-gray-900'}
                  `} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {category.name}
                  </span>
                </div>
              </div>
              
              {/* Selected indicator - subtle bottom border */}
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-300"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryPanel;

