import React from 'react';

/**
 * Şube/katalog Firebase senkronu — yeşil gradyan, geniş çubuk, shimmer.
 * Ana süreç uzun getDocs sırasında nabız gönderir; width geçişi yumuşatır.
 */
export default function CatalogSyncProgressBar({ progress }) {
  if (!progress || progress.phase === 'done') return null;

  const pct = Math.min(100, Math.max(0, Number(progress.percent) || 0));
  const msg = progress.message || 'Katalog yükleniyor…';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100000] pointer-events-none px-3 pb-3 sm:px-5 sm:pb-5"
      role="status"
      aria-live="polite"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <style>{`
        @keyframes catalog-sync-shimmer {
          0% { transform: translateX(-120%) skewX(-14deg); }
          100% { transform: translateX(220%) skewX(-14deg); }
        }
      `}</style>
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-slate-950 via-emerald-950/98 to-slate-900 shadow-[0_22px_56px_-14px_rgba(6,78,59,0.7),0_0_0_1px_rgba(52,211,153,0.14)] backdrop-blur-xl px-5 py-4 ring-1 ring-emerald-400/25">
        <div className="flex items-end justify-between gap-3 mb-3.5">
          <p className="text-[15px] sm:text-base font-bold text-emerald-50 leading-snug tracking-tight min-w-0 flex-1 drop-shadow-sm">
            {msg}
          </p>
          <span className="shrink-0 tabular-nums text-[1.65rem] sm:text-[1.85rem] font-black text-emerald-300 leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(16,185,129,0.5)]">
            {Math.round(pct)}
            <span className="text-lg sm:text-xl font-extrabold text-emerald-400/90">%</span>
          </span>
        </div>
        <div
          className="relative h-5 sm:h-[1.35rem] w-full overflow-hidden rounded-full bg-slate-950/90 ring-2 ring-emerald-500/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full will-change-[width]"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, #022c22 0%, #065f46 10%, #059669 32%, #34d399 50%, #10b981 68%, #047857 100%)',
              boxShadow:
                '0 0 28px rgba(52, 211, 153, 0.5), inset 0 1px 0 rgba(255,255,255,0.28)',
              transition: 'width 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="absolute inset-y-0 w-1/2 opacity-[0.42]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                animation: 'catalog-sync-shimmer 1.75s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        <p className="mt-2.5 text-center text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-emerald-500/85">
          Şube bağlantısı · ürün senkronu
        </p>
      </div>
    </div>
  );
}
