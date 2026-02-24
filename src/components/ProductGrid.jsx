import React from 'react';

const ProductGrid = ({ products, onAddToCart }) => {

  return (
    <div className="flex-1 overflow-y-auto scrollbar-custom">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
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
                min-h-[7rem] bg-white rounded-2xl 
                transition-all duration-300 flex flex-row items-center
                relative group overflow-hidden p-0 pr-4
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
              
              {/* Ürün İsmi - Sol Taraf (tam görünsün, kesilmesin) - min-w-0 ile dar ekranda fiyat alanına yer bırakır */}
              <div className="relative z-10 flex-1 flex items-center pl-6 pr-2 min-h-0 min-w-0 py-3">
                <h3 className={`
                  font-bold leading-tight text-left break-words
                  ${isOutOfStock 
                    ? 'text-gray-500 text-sm' 
                    : 'text-gray-900 text-base group-hover:text-purple-700 transition-colors duration-300'
                  }
                `}>
                  {product.name}
                </h3>
              </div>
              
              {/* Fiyat - Sağ Taraf (kart içinde kalır, taşmaz) */}
              <div className="relative z-10 flex items-center justify-end flex-shrink-0 pl-2 pr-0 min-w-0">
                <div className={`
                  relative inline-flex items-center justify-center max-w-full
                  transition-all duration-300
                  ${isOutOfStock 
                    ? 'opacity-50' 
                    : 'group-hover:scale-[1.02]'
                  }
                `}>
                  {/* Ana Fiyat Badge - kart sınırları içinde */}
                  <span className={`
                    relative font-extrabold tracking-tight text-center whitespace-nowrap
                    px-3 py-1.5 rounded-lg text-sm
                    transition-all duration-300
                    ${isOutOfStock 
                      ? 'text-gray-500 bg-gray-100 border border-gray-300' 
                      : 'text-emerald-800 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/60 shadow-sm group-hover:shadow group-hover:from-emerald-100 group-hover:via-teal-100 group-hover:to-emerald-100 group-hover:border-emerald-300/80'
                    }
                  `}>
                    <span className="relative z-10">₺{product.price.toFixed(2)}</span>
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

// PERFORMANS: React.memo ile gereksiz re-render'ları önle - özel karşılaştırma
export default React.memo(ProductGrid, (prevProps, nextProps) => {
  if (prevProps.products.length !== nextProps.products.length) return false;
  if (prevProps.products.length === 0) return true;
  // İlk ve son ürünün ID'sini karşılaştır (hızlı kontrol)
  const prevFirst = prevProps.products[0];
  const nextFirst = nextProps.products[0];
  const prevLast = prevProps.products[prevProps.products.length - 1];
  const nextLast = nextProps.products[nextProps.products.length - 1];
  return prevFirst?.id === nextFirst?.id && prevLast?.id === nextLast?.id;
});
