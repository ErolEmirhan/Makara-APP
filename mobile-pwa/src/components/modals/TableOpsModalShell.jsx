export function TableOpsModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  accent = 'from-indigo-500 to-violet-600',
  children,
  footer,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg flex flex-col bg-white rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl animate-slide-up overflow-hidden max-h-[min(92dvh,720px)] sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative shrink-0 px-5 pt-5 pb-4 bg-gradient-to-br ${accent} text-white`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-start gap-3 pr-10">
            {icon && (
              <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-xl font-bold font-display tracking-tight">{title}</h3>
              {subtitle && (
                <p className="text-sm text-white/80 mt-1 leading-snug">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 sm:hidden" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 bg-gray-50/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTableLabel(table) {
  return table.name || `Masa ${table.number}`;
}

export function TableSummaryCard({ table, role, accent = 'emerald' }) {
  if (!table) return null;

  const roleStyles = {
    source: 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50',
    target: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50',
    merge: 'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50',
  };

  const roleLabels = {
    source: 'Kaynak',
    target: 'Hedef',
    merge: 'Seçili',
  };

  const orderTotal = typeof table.orderTotal === 'number' ? table.orderTotal : 0;

  return (
    <div className={`rounded-2xl border-2 p-4 ${roleStyles[role] || roleStyles.target}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
        {roleLabels[role] || 'Masa'}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black text-gray-900 truncate">{formatTableLabel(table)}</p>
          {table.zoneLabel && (
            <p className="text-xs text-gray-500 mt-0.5">{table.zoneLabel}</p>
          )}
        </div>
        <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
          table.hasOrder
            ? 'bg-emerald-700 text-emerald-50 shadow-md shadow-emerald-900/20'
            : 'bg-white text-gray-700 border border-gray-200'
        }`}>
          {table.number}
        </div>
      </div>
      {table.hasOrder && (
        <p className="text-sm font-semibold text-emerald-700 mt-2">
          {orderTotal.toFixed(2)} ₺ · Dolu
        </p>
      )}
      {!table.hasOrder && (
        <p className="text-sm font-medium text-gray-500 mt-2">Boş masa</p>
      )}
    </div>
  );
}

export function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-gray-100">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div
            key={label}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              active
                ? 'bg-white text-indigo-700 shadow-sm'
                : done
                ? 'text-indigo-600'
                : 'text-gray-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              active
                ? 'bg-indigo-600 text-white'
                : done
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {done ? '✓' : step}
            </span>
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
