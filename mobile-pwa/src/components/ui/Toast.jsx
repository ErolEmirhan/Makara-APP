export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none safe-top">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-up rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-xl border pointer-events-auto ${
            t.type === 'error'
              ? 'bg-red-500/90 border-red-400/30 text-white'
              : t.type === 'success'
              ? 'bg-emerald-500/90 border-emerald-400/30 text-white'
              : 'bg-white/90 border-white/30 text-gray-900'
          }`}
        >
          <p className="font-bold text-sm">{t.title}</p>
          {t.message && <p className="text-xs opacity-90 mt-0.5">{t.message}</p>}
        </div>
      ))}
    </div>
  );
}
