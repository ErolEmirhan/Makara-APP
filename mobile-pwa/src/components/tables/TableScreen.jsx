import { useEffect, useMemo } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useApp } from '../../context/AppContext';
import { MAKARA_HAVZAN_ZONES } from '../../config/firebase';

const ZONE_FRAME = {
  pink: {
    section: 'border-pink-200/90 bg-gradient-to-br from-pink-50/80 via-white to-fuchsia-50/40 shadow-sm shadow-pink-100/30',
    title: 'text-pink-900',
    badge: 'bg-pink-100 text-pink-700 border-pink-200/80',
    dot: 'bg-pink-400',
  },
  amber: {
    section: 'border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/40 shadow-sm shadow-amber-100/30',
    title: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-400',
  },
  emerald: {
    section: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 shadow-sm shadow-emerald-100/30',
    title: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  purple: {
    section: 'border-purple-200/90 bg-gradient-to-br from-purple-50/80 via-white to-violet-50/40 shadow-sm shadow-purple-100/30',
    title: 'text-purple-900',
    badge: 'bg-purple-100 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-400',
  },
};

function TableButton({ table, onSelect, isSultan }) {
  const hasOrder = table.hasOrder;
  const orderTotal = typeof table.orderTotal === 'number' ? table.orderTotal : 0;
  const isOutside = table.type === 'outside' || String(table.id).startsWith('outside-');
  const isGarden = table.type === 'garden' || table.zoneKey === 'bahce';

  return (
    <button
      onClick={() => onSelect(table)}
      className={`aspect-square rounded-2xl border-2 font-bold transition-all active:scale-95 flex flex-col items-center justify-center p-1 relative ${
        hasOrder
          ? 'border-emerald-600 bg-gradient-to-br from-emerald-800 to-emerald-950 text-emerald-50 shadow-lg shadow-emerald-900/30'
          : isSultan
          ? 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
          : isGarden
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-900'
          : isOutside
          ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-900'
          : 'border-pink-200 bg-gradient-to-br from-pink-50 to-fuchsia-50 text-pink-900'
      }`}
    >
      {hasOrder && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
      )}
      <span className="text-lg font-black">{table.number}</span>
      {hasOrder ? (
        <>
          {table.name && (
            <span className="text-[9px] font-bold text-emerald-200 mt-1 line-clamp-2 text-center leading-tight px-1">
              {table.name}
            </span>
          )}
          <span className="text-[10px] font-semibold text-emerald-300 mt-1 px-1.5 py-0.5 rounded bg-emerald-900/40">
            {orderTotal.toFixed(2)} ₺
          </span>
        </>
      ) : (
        <span className="text-[10px] opacity-60 mt-1">Boş</span>
      )}
    </button>
  );
}

function TableSectionGroup({ title, rangeLabel, count, accent, children }) {
  const frame = ZONE_FRAME[accent] || ZONE_FRAME.pink;

  return (
    <section className={`rounded-2xl border-2 p-3.5 mb-5 ${frame.section}`}>
      <div className="flex items-center gap-2.5 mb-3.5 px-0.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${frame.dot}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <h2 className={`text-base font-display font-bold tracking-tight ${frame.title}`}>
            {title}
          </h2>
          {rangeLabel && (
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Masa {rangeLabel}</p>
          )}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0 ${frame.badge}`}>
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function SultanSectionBar({ tables, currentSection, onSelectSection }) {
  const sections = useMemo(() => {
    const map = {};
    tables.forEach((t) => {
      if (t.sectionKey) map[t.sectionKey] = t.sectionLabel || t.sectionKey;
    });
    return Object.entries(map);
  }, [tables]);

  if (!sections.length) return null;

  const activeKey = currentSection || sections[0][0];
  const activeLabel = sections.find(([k]) => k === activeKey)?.[1] || '';

  return (
    <div className="mb-4">
      <p className="text-center text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
        Bölüm seçin
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {sections.map(([key, label]) => {
          const count = tables.filter((t) => t.sectionKey === key).length;
          return (
            <button
              key={key}
              onClick={() => onSelectSection(key)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeKey === key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm font-bold text-gray-700 mt-3">
        {activeLabel} — Masa seçin
      </p>
    </div>
  );
}

function isPackageTable(table) {
  return String(table.id).startsWith('package-');
}

export function TableScreen() {
  const { theme, branchKey } = useBranch();
  const {
    tables, loading, selectTable,
    currentSultanSection, setCurrentSultanSection,
  } = useApp();

  const isSultan = theme.isSultan;
  const isHavzan = branchKey === 'makara' || theme.isMakaraHavzan;
  const isSultanLayout = isSultan && tables.length > 0 && String(tables[0].id).startsWith('sultan-');

  useEffect(() => {
    if (isSultanLayout && !currentSultanSection) {
      const first = tables.find((t) => t.sectionKey);
      if (first) setCurrentSultanSection(first.sectionKey);
    }
  }, [isSultanLayout, tables, currentSultanSection, setCurrentSultanSection]);

  const displayTables = useMemo(() => {
    if (isSultanLayout) {
      return tables.filter((t) => t.sectionKey === (currentSultanSection || tables[0]?.sectionKey));
    }
    return tables;
  }, [tables, isSultanLayout, currentSultanSection]);

  const packageTables = useMemo(
    () => tables.filter(isPackageTable),
    [tables]
  );

  const havzanZones = useMemo(() => {
    if (!isHavzan || isSultanLayout) return [];
    return MAKARA_HAVZAN_ZONES.map((zone) => ({
      ...zone,
      tables: tables.filter(
        (t) => !isPackageTable(t) && t.number >= zone.min && t.number <= zone.max
      ),
    })).filter((z) => z.tables.length > 0);
  }, [tables, isHavzan, isSultanLayout]);

  const { insideTables, outsideTables } = useMemo(() => {
    if (isSultanLayout || isHavzan) return { insideTables: [], outsideTables: [] };
    return {
      insideTables: tables.filter((t) => String(t.id).startsWith('inside-') && !isPackageTable(t)),
      outsideTables: tables.filter((t) => String(t.id).startsWith('outside-') && !isPackageTable(t)),
    };
  }, [tables, isSultanLayout, isHavzan]);

  if (loading && !tables.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const renderGrid = (list) => (
    <div className="grid grid-cols-4 gap-2">
      {list.map((table) => (
        <TableButton key={table.id} table={table} onSelect={selectTable} isSultan={isSultan} />
      ))}
    </div>
  );

  return (
    <div className="px-4 pb-32">
      {isSultanLayout && (
        <SultanSectionBar
          tables={tables}
          currentSection={currentSultanSection}
          onSelectSection={setCurrentSultanSection}
        />
      )}

      {isSultanLayout ? (
        renderGrid(displayTables)
      ) : isHavzan ? (
        <>
          {havzanZones.map((zone) => (
            <TableSectionGroup
              key={zone.key}
              title={zone.label}
              rangeLabel={`${zone.min}–${zone.max}`}
              count={zone.tables.length}
              accent={zone.accent}
            >
              {renderGrid(zone.tables)}
            </TableSectionGroup>
          ))}
          {packageTables.length > 0 && (
            <TableSectionGroup
              title="Paket"
              rangeLabel="Gel-Al"
              count={packageTables.length}
              accent="purple"
            >
              {renderGrid(packageTables)}
            </TableSectionGroup>
          )}
        </>
      ) : (
        <>
          {insideTables.length > 0 && (
            <TableSectionGroup
              title="İç Mekan"
              count={insideTables.length}
              accent="pink"
            >
              {renderGrid(insideTables)}
            </TableSectionGroup>
          )}
          {outsideTables.length > 0 && (
            <TableSectionGroup
              title="Dış Mekan"
              count={outsideTables.length}
              accent="amber"
            >
              {renderGrid(outsideTables)}
            </TableSectionGroup>
          )}
          {packageTables.length > 0 && (
            <TableSectionGroup
              title="Paket"
              count={packageTables.length}
              accent="purple"
            >
              {renderGrid(packageTables)}
            </TableSectionGroup>
          )}
        </>
      )}

      {!tables.length && !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🪑</p>
          <p>Masa bulunamadı</p>
        </div>
      )}
    </div>
  );
}
