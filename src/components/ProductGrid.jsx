import React from 'react';

const ProductGrid = ({ products, onAddToCart }) => {

  return (
    <div className="flex-1 overflow-y-auto scrollbar-custom">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
        {products.map((product) => {
          // Sadece stok takibi yapılan ürünler için kontrol et
          const trackStock = product.trackStock === true;
          const stock = trackStock && product.stock !== undefined ? (product.stock || 0) : null;
          const isOutOfStock = trackStock && stock !== null && stock === 0;
          
          return (
            <div
              key={product.id}
              onClick={() => !isOutOfStock && onAddToCart(product)}
              className={`
                h-28 bg-white rounded-2xl 
                transition-all duration-300 flex flex-row items-center
                relative group overflow-hidden
                ${isOutOfStock 
                  ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                  : 'cursor-pointer'
                }
              `}
              style={{
                boxShadow: isOutOfStock 
                  ? '0 1px 2px rgba(0,0,0,0.05)' 
                  : '0 1px 3px rgba(0,0,0,0.08)'
              }}
            >
              {/* Minimal Profesyonel Çerçeve */}
              {!isOutOfStock && (
                <>
                  {/* Sade Border */}
                  <div className="absolute inset-0 rounded-2xl border border-gray-200/60 pointer-events-none"></div>
                  
                  {/* Hover Border Efekti */}
                  <div className="absolute inset-0 rounded-2xl border border-emerald-300/0 group-hover:border-emerald-300/40 transition-all duration-300 pointer-events-none"></div>
                </>
              )}
              
              {/* Tükendi Durumu Çerçeve */}
              {isOutOfStock && (
                <div className="absolute inset-0 rounded-2xl border border-gray-200/50 pointer-events-none"></div>
              )}
              
              {/* Hover Shadow Efekti */}
              {!isOutOfStock && (
                <div className="absolute inset-0 rounded-2xl shadow-sm opacity-0 group-hover:opacity-100 group-hover:shadow-md transition-all duration-300 pointer-events-none"></div>
              )}
              
              {/* Subtle Hover Background */}
              {!isOutOfStock && (
                <div className="absolute inset-0 bg-gray-50/0 group-hover:bg-gray-50/50 transition-all duration-300 rounded-2xl"></div>
              )}
              
              {/* Sol Taraf - Minimal Profesyonel Accent */}
              {!isOutOfStock && (
                <>
                  {/* Ana Accent Bar - Sade ve Modern */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-l-2xl"></div>
                  
                  {/* Subtle Inner Shadow - Derinlik Hissi */}
                  <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-emerald-300/40 to-transparent rounded-full"></div>
                </>
              )}
              
              {/* Ürün İsmi - Sol Taraf */}
              <div className="relative z-10 flex-1 flex items-center pl-6 pr-5 min-h-0">
                <h3 className={`
                  font-bold leading-tight line-clamp-2 text-left
                  ${isOutOfStock 
                    ? 'text-gray-500 text-sm' 
                    : 'text-gray-900 text-base group-hover:text-purple-700 transition-colors duration-300'
                  }
                `}>
                  {product.name}
                </h3>
              </div>
              
              {/* Fiyat - Sağ Taraf */}
              <div className="relative z-10 px-5 flex items-center justify-center flex-shrink-0">
                <div className={`
                  relative inline-flex items-center justify-center
                  transition-all duration-300
                  ${isOutOfStock 
                    ? 'opacity-50' 
                    : 'group-hover:scale-105'
                  }
                `}>
                  {/* Soft Arka Plan - Gradient with subtle shadow */}
                  <div className={`
                    absolute inset-0 rounded-xl blur-sm
                    ${isOutOfStock 
                      ? 'bg-gray-200' 
                      : 'bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-300 opacity-60 group-hover:opacity-80'
                    }
                  `}></div>
                  
                  {/* Ana Fiyat Badge */}
                  <span className={`
                    relative font-extrabold tracking-tight text-center
                    px-4 py-1.5 rounded-xl
                    transition-all duration-300
                    ${isOutOfStock 
                      ? 'text-gray-500 text-sm bg-gray-100 border border-gray-300' 
                      : 'text-emerald-800 text-sm bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/60 shadow-md group-hover:shadow-lg group-hover:from-emerald-100 group-hover:via-teal-100 group-hover:to-emerald-100 group-hover:border-emerald-300/80'
                    }
                  `}>
                    <span className="relative z-10">₺{product.price.toFixed(2)}</span>
                    
                    {/* Soft İç Glow Efekti */}
                    {!isOutOfStock && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/30 via-transparent to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Stok Durumu Badge */}
              {isOutOfStock && (
                <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm z-20">
                  Tükendi
                </div>
              )}
              
              {/* Hover İndikatör - Alt Çizgi */}
              {!isOutOfStock && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center rounded-b-2xl"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGrid;
