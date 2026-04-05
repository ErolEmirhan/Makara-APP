import React from 'react';

/**
 * Şube/katalog Firebase senkronu sırasında alt bant + doluluk çubuğu.
 * payload: { percent, message, phase }
 */
export default function CatalogSyncProgressBar({ progress, sultanTheme = false }) {
  if (!progress || progress.phase === 'done') return null;

  const pct = Math.min(100, Math.max(0, Number(progress.percent) || 0));
  const msg = progress.message || 'Yükleniyor…';

  const barGradient = sultanTheme
    ? 'linear-gradient(90deg, #059669 0%, #0d9488 55%, #14b8a6 100%)'
    : 'linear-gradient(90deg, #db2777 0%, #a855f7 55%, #6366f1 100%)';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100000] pointer-events-none px-3 pb-3 sm:px-4 sm:pb-4"
      role="status"
      aria-live="polite"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`mx-auto max-w-xl rounded-xl border shadow-lg backdrop-blur-md px-4 py-3 ${
          sultanTheme
            ? 'border-emerald-200/90 bg-emerald-950/88 text-emerald-50'
            : 'border-slate-200/90 bg-white/95 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p
            className={`text-sm font-semibold leading-snug min-w-0 flex-1 ${
              sultanTheme ? 'text-emerald-50' : 'text-slate-800'
            }`}
          >
            {msg}
          </p>
          <span
            className={`tabular-nums text-sm font-bold shrink-0 ${
              sultanTheme ? 'text-emerald-200' : 'text-pink-600'
            }`}
          >
            %{Math.round(pct)}
          </span>
        </div>
        <div
          className={`h-2.5 w-full rounded-full overflow-hidden ${
            sultanTheme ? 'bg-emerald-900/80' : 'bg-slate-200/90'
          }`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{
              width: `${pct}%`,
              background: barGradient,
              boxShadow: sultanTheme
                ? '0 0 12px rgba(52, 211, 153, 0.35)'
                : '0 0 12px rgba(236, 72, 153, 0.25)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
