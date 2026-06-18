import { useEffect } from 'react';

export function SidePanel({
  open,
  onClose,
  children,
  title,
  subtitle,
  header,
  widthClass = 'w-[min(380px,92vw)]',
  zIndexClass = 'z-[9000]',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass}`} role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[6px] animate-fade-in cursor-default"
        onClick={onClose}
        aria-label="Kapat"
      />

      <aside
        className={`absolute top-0 right-0 bottom-0 ${widthClass} flex flex-col bg-white shadow-[-16px_0_48px_rgba(15,23,42,0.18)] animate-slide-in-right safe-top safe-bottom border-l border-white/20`}
        onClick={(e) => e.stopPropagation()}
      >
        {header || (
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100/80">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && (
                  <h2 className="text-xl font-display font-bold text-gray-900 tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
      </aside>
    </div>
  );
}
