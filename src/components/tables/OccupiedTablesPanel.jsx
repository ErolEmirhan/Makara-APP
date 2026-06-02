import React from 'react';
import TableGridCard from './TableGridCard';

/**
 * Yalnızca dolu masalar — bölüm bölüm (İç salon, Dış, Paket vb.)
 */
const OccupiedTablesPanel = ({
  groups = [],
  onTableClick,
  title = 'Dolu masalar',
}) => {
  const totalCount = groups.reduce((sum, g) => sum + (g.items?.length || 0), 0);

  if (totalCount === 0) return null;

  return (
    <section className="mb-8 rounded-2xl border border-pink-200/70 bg-gradient-to-br from-pink-50/90 via-white to-slate-50/80 shadow-[0_4px_20px_-8px_rgba(236,72,153,0.18)] overflow-hidden theme-sultan:border-emerald-200/70 theme-sultan:from-emerald-50/90 theme-sultan:shadow-[0_4px_20px_-8px_rgba(16,185,129,0.15)]">
      <div className="px-4 py-3 md:px-5 md:py-4 border-b border-pink-100/80 bg-white/60 flex items-center justify-between gap-3 theme-sultan:border-emerald-100/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-pink-100 text-pink-600 shrink-0 theme-sultan:bg-emerald-100 theme-sultan:text-emerald-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 font-medium truncate">Hızlı erişim — dolu masaya dokunun</p>
          </div>
        </div>
        {totalCount > 0 && (
          <span className="shrink-0 text-xs font-black tabular-nums px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-sm theme-sultan:from-emerald-500 theme-sultan:to-teal-500">
            {totalCount} dolu
          </span>
        )}
      </div>

      <div className="p-3 md:p-4">
        <div className="space-y-4">
          {groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2 px-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-pink-500 theme-sultan:text-emerald-600">
                    ({group.items.length})
                  </span>
                  <span className="flex-1 h-px bg-slate-200/80" aria-hidden />
                </div>
                <div
                  className={
                    group.gridClass ||
                    'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-2.5'
                  }
                >
                  {group.items.map(({ table, order }) => (
                    <TableGridCard
                      key={table.id}
                      table={table}
                      order={order}
                      variant={group.variant || 'default'}
                      showPackageIcon={group.showPackageIcon}
                      onClick={() => onTableClick(table)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
      </div>
    </section>
  );
};

export default OccupiedTablesPanel;
