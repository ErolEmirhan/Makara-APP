import { useBranch } from '../../context/BranchContext';

function PlaceholderArt({ accentSolid }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(145deg, ${accentSolid}18 0%, ${accentSolid}08 45%, #f8fafc 100%)`,
      }}
    >
      <svg
        className="w-14 h-14 opacity-[0.22]"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accentSolid}
        strokeWidth="1.2"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3c-1.5 2.2-4 3.8-4 7.2 0 2.8 1.8 4.8 4 4.8s4-2 4-4.8c0-3.4-2.5-5-4-7.2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M9 18h6" />
      </svg>
    </div>
  );
}

export function ProductCard({ product, onAdd }) {
  const { theme } = useBranch();
  const outOfStock = product.trackStock && product.stock <= 0;
  const lowStock = product.trackStock && product.stock > 0 && product.stock <= 5;
  const imageSrc = product.imageSrc || null;
  const price = Number(product.price).toFixed(2);

  return (
    <button
      type="button"
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`group relative flex flex-col w-full rounded-[1.35rem] bg-white overflow-hidden text-left transition-all duration-300 border border-gray-100/90 shadow-[0_4px_24px_rgba(15,23,42,0.06)] disabled:cursor-not-allowed ${
        outOfStock
          ? 'opacity-75'
          : 'active:scale-[0.98] hover:shadow-[0_8px_32px_rgba(15,23,42,0.1)] hover:border-gray-200/90'
      }`}
      aria-label={`${product.name} — ${price} ₺`}
    >
      <div className="relative w-full aspect-[5/4] overflow-hidden bg-gray-100">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out ${
              outOfStock ? 'grayscale-[0.65] brightness-90' : 'group-hover:scale-[1.04]'
            }`}
          />
        ) : (
          <PlaceholderArt accentSolid={theme.accentSolid} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent pointer-events-none" />

        {product.trackStock && !outOfStock && (
          <span
            className={`absolute top-2.5 left-2.5 z-[2] text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg backdrop-blur-md border ${
              lowStock
                ? 'bg-amber-500/90 text-white border-amber-400/50'
                : 'bg-white/90 text-gray-700 border-white/60'
            }`}
          >
            Stok {product.stock}
          </span>
        )}

        {outOfStock && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
            <span className="px-3 py-1.5 rounded-full bg-white/95 text-gray-800 text-xs font-bold tracking-wide shadow-lg">
              Tükendi
            </span>
          </div>
        )}

        {!outOfStock && (
          <span
            className={`absolute bottom-2.5 right-2.5 z-[2] w-9 h-9 rounded-full bg-gradient-to-br ${theme.accent} text-white shadow-lg shadow-black/20 flex items-center justify-center ring-2 ring-white/90 transition-transform duration-200 group-active:scale-90`}
            aria-hidden
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 px-3 pt-3 pb-3.5 gap-1.5">
        <h3 className="font-semibold text-[13px] leading-snug text-gray-900 line-clamp-2 min-h-[2.35rem]">
          {product.name}
        </h3>

        <div className="flex items-end justify-between gap-2 mt-auto">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fiyat</p>
            <p className="text-lg font-display font-bold leading-none">
              <span className={`bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                {price}
              </span>
              <span className="text-sm font-semibold text-gray-500 ml-0.5">₺</span>
            </p>
          </div>

          {!outOfStock && (
            <span className="shrink-0 text-[10px] font-bold text-gray-400 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
              Ekle
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
