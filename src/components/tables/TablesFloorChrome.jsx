import React from 'react';

/** Masalar ekranı üst başlık + doluluk özeti */
export const TablesFloorHeader = ({
  title,
  subtitle,
  stats = [],
  legend = true,
}) => (
  <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] overflow-hidden">
    <div className="px-5 py-4 md:px-6 md:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 heading-display">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 font-medium">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90"
          >
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {s.label}
            </span>
            <span className="text-sm font-black text-slate-900 tabular-nums">
              <span className="text-pink-500 theme-sultan:text-emerald-600">{s.filled}</span>
              <span className="text-slate-400 font-bold mx-0.5">/</span>
              {s.total}
            </span>
          </div>
        ))}
        {legend && (
          <div className="flex items-center gap-3 ml-1 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md border border-slate-200 bg-white shadow-sm" />
              Boş
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-br from-pink-400 to-fuchsia-600 shadow-sm theme-sultan:from-emerald-500 theme-sultan:to-teal-600" />
              Dolu
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);

/** Salon / paket bölüm başlığı */
export const TablesSectionBlock = ({ icon, title, filled, total, children, className = '' }) => (
  <section className={`mb-8 ${className}`}>
    <div className="flex items-center justify-between gap-3 mb-4 px-1">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
            {icon}
          </span>
        )}
        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">
          {title}
        </h3>
      </div>
      {total != null && (
        <span className="shrink-0 text-xs font-bold tabular-nums px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
          <span className="text-pink-500 theme-sultan:text-emerald-600">{filled ?? 0}</span>
          <span className="text-slate-400 mx-1">/</span>
          {total} dolu
        </span>
      )}
    </div>
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3 md:p-4 shadow-inner">
      {children}
    </div>
  </section>
);

/** İç ve dış salon arası ayırıcı */
export const TablesFloorDivider = () => (
  <div className="relative my-6 flex items-center justify-center" aria-hidden>
    <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
    <span className="relative z-10 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 rounded-full border border-slate-200/80">
      Dış salon
    </span>
  </div>
);
