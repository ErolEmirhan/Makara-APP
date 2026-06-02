import React, { memo } from 'react';

/**
 * Salon / paket masa kartı — boş ve dolu durumları tek yerden yönetilir.
 */
const TableGridCard = ({
  table,
  order,
  onClick,
  variant = 'default',
  showPackageIcon = false,
}) => {
  const isOccupied = Boolean(order);
  const displayName = order?.table_name || order?.tableName || table.name;
  const totalAmount = order?.total_amount != null ? Number(order.total_amount) : null;

  const sizeClasses = {
    compact: 'rounded-xl p-1.5 min-h-0',
    default: 'rounded-2xl p-2.5 min-h-0',
    large: 'rounded-2xl p-3 min-h-0',
    surici: 'rounded-xl p-2 min-h-0',
  };

  const numberSize = {
    compact: 'text-lg md:text-xl',
    default: 'text-xl md:text-2xl',
    large: 'text-2xl md:text-3xl',
    surici: 'text-xl md:text-2xl',
  };

  const baseBtn =
    'table-btn group relative flex flex-col items-center justify-center aspect-square w-full border transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 theme-sultan:focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2';

  const occupiedClasses =
    'border-pink-700/70 bg-gradient-to-br from-pink-400 via-pink-500 to-fuchsia-600 text-white shadow-[0_8px_24px_-6px_rgba(236,72,153,0.4)] hover:shadow-[0_12px_28px_-6px_rgba(236,72,153,0.5)] hover:-translate-y-0.5 theme-sultan:border-emerald-700/70 theme-sultan:from-emerald-400 theme-sultan:via-emerald-500 theme-sultan:to-teal-600 theme-sultan:shadow-[0_8px_24px_-6px_rgba(16,185,129,0.35)] theme-sultan:hover:shadow-[0_12px_28px_-6px_rgba(16,185,129,0.45)]';

  const emptyClasses =
    'border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-pink-300/80 theme-sultan:hover:border-emerald-400/80 hover:shadow-md hover:-translate-y-0.5';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseBtn} ${sizeClasses[variant] || sizeClasses.default} ${
        isOccupied ? occupiedClasses : emptyClasses
      }`}
      aria-label={
        isOccupied
          ? `${displayName}, dolu${totalAmount != null ? `, ${totalAmount.toFixed(2)} TL` : ''}`
          : `${table.name || `Masa ${table.number}`}, boş`
      }
    >
      {isOccupied && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-300 ring-2 ring-pink-800/25 theme-sultan:ring-emerald-900/30 animate-pulse"
          aria-hidden
        />
      )}

      {variant === 'surici' && isOccupied ? (
        <span className="text-xs md:text-sm font-bold text-center leading-tight line-clamp-3 px-0.5 break-words w-full">
          {displayName}
        </span>
      ) : (
        <>
          {!isOccupied && showPackageIcon && (
            <svg
              className="w-6 h-6 text-slate-400 mb-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          )}
          <span
            className={`font-black tabular-nums leading-none tracking-tight ${
              numberSize[variant] || numberSize.default
            } ${isOccupied ? 'text-white' : 'text-slate-600'}`}
          >
            {table.number}
          </span>
          {isOccupied && variant !== 'compact' && displayName && displayName !== `Masa ${table.number}` && (
            <span className="text-[10px] md:text-[11px] font-semibold text-pink-50/95 text-center leading-tight mt-1 line-clamp-2 px-0.5">
              {displayName}
            </span>
          )}
        </>
      )}

      {isOccupied && variant !== 'compact' && totalAmount != null && totalAmount > 0 && (
        <span className="mt-1 text-[10px] md:text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-black/20 text-white/95">
          ₺{totalAmount.toFixed(0)}
        </span>
      )}

      <span
        className={`mt-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
          isOccupied
            ? 'bg-pink-900/25 text-pink-50 border border-pink-300/25 theme-sultan:bg-emerald-950/35 theme-sultan:text-emerald-50 theme-sultan:border-emerald-400/20'
            : 'bg-slate-100 text-slate-500 border border-slate-200/80'
        }`}
      >
        {isOccupied ? 'Dolu' : 'Boş'}
      </span>
    </button>
  );
};

function tableGridCardPropsAreEqual(prev, next) {
  return (
    prev.table?.id === next.table?.id &&
    prev.variant === next.variant &&
    prev.showPackageIcon === next.showPackageIcon &&
    prev.order?.id === next.order?.id &&
    prev.order?.total_amount === next.order?.total_amount &&
    prev.order?.status === next.order?.status
  );
}

export default memo(TableGridCard, tableGridCardPropsAreEqual);
