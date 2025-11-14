import React from 'react';

const ProductGrid = ({ products, onAddToCart }) => {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-custom">
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => onAddToCart(product)}
            className="product-card animate-fade-in"
          >
            <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl mb-3 flex items-center justify-center overflow-hidden relative group">
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-white/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-xs text-white/50">Ürün Görseli</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                <span className="text-white font-medium">Sepete Ekle +</span>
              </div>
            </div>
            
            <h3 className="font-semibold text-white mb-2 truncate">{product.name}</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ₺{product.price.toFixed(2)}
              </span>
              <button className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;

