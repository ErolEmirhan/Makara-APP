import React from 'react';

const CategoryPanel = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold mb-4 gradient-text">Kategoriler</h2>
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category)}
            className={`category-btn ${
              selectedCategory?.id === category.id
                ? 'category-btn-active'
                : 'category-btn-inactive'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryPanel;

