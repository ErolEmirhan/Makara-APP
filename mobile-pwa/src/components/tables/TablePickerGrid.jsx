import { useMemo, useState } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useApp } from '../../context/AppContext';
import { MAKARA_HAVZAN_ZONES } from '../../config/firebase';

function isPackageTable(table) {
  return String(table.id).startsWith('package-');
}

function matchesFilter(table, filterMode) {
  if (filterMode === 'empty') return !table.hasOrder;
  if (filterMode === 'occupied') return !!table.hasOrder;
  return true;
}

function TablePickCard({ table, selected, onSelect, disabled }) {
  const hasOrder = table.hasOrder;
  const orderTotal = typeof table.orderTotal === 'number' ? table.orderTotal : 0;
  const isOutside = table.type === 'outside' || String(table.id).startsWith('outside-');
  const isGarden = table.type === 'garden' || table.zoneKey === 'bahce';

  let base =
    'border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/40';
  if (hasOrder) {
    base = 'border-emerald-600 bg-gradient-to-br from-emerald-800 to-emerald-950 text-emerald-50';
  } else if (isGarden) {
    base = 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-900';
  } else if (isOutside) {
    base = 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-900';
  } else {
    base = 'border-pink-100 bg-gradient-to-br from-pink-50/80 to-fuchsia-50/60 text-pink-900';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect(table)}
      className={`aspect-square rounded-xl border-2 font-bold transition-all flex flex-col items-center justify-center p-1 relative ${
        disabled ? 'opacity-35 cursor-not-allowed' : 'active:scale-95'
      } ${
        selected
          ? 'ring-[3px] ring-indigo-500 ring-offset-2 border-indigo-500 scale-[1.02] shadow-lg shadow-indigo-500/20 z-[1]'
          : base
      }`}
    >
      {selected && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center shadow-md">
          ✓
        </span>
      )}
      {hasOrder && !selected && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
      )}
      <span className="text-base font-black leading-none">{table.number}</span>
      {hasOrder ? (
        <span className={`text-[9px] font-semibold mt-1 px-1 rounded ${
          selected ? 'text-emerald-200' : 'text-emerald-300 bg-emerald-900/30'
        }`}>
          {orderTotal > 0 ? `${orderTotal.toFixed(0)}₺` : 'Dolu'}
        </span>
      ) : (
        <span className="text-[9px] opacity-50 mt-1 font-medium">Boş</span>
      )}
    </button>
  );
}

function ZoneBlock({ title, rangeLabel, count, children }) {
  return (
    <section className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</h4>
          {rangeLabel && (
            <p className="text-[10px] text-gray-400 font-medium">Masa {rangeLabel}</p>
          )}
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export function TablePickerGrid({
  tables,
  selectedId,
  onSelect,
  filterMode = 'any',
  excludeIds = [],
  emptyMessage = 'Uygun masa bulunamadı',
  showSearch = true,
}) {
  const { branchKey, theme } = useBranch();
  const { currentSultanSection, setCurrentSultanSection } = useApp();
  const [search, setSearch] = useState('');

  const excludeSet = useMemo(
    () => new Set(excludeIds.map((id) => String(id))),
    [excludeIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (!matchesFilter(t, filterMode)) return false;
      if (excludeSet.has(String(t.id))) return false;
      if (!q) return true;
      const label = (t.name || `Masa ${t.number}`).toLowerCase();
      return label.includes(q) || String(t.number).includes(q);
    });
  }, [tables, filterMode, excludeSet, search]);

  const isSultanLayout = theme.isSultan && tables.length > 0 && String(tables[0].id).startsWith('sultan-');
  const isHavzan = branchKey === 'makara' || theme.isMakaraHavzan;

  const sultanSections = useMemo(() => {
    if (!isSultanLayout) return [];
    const map = {};
    filtered.forEach((t) => {
      if (t.sectionKey) map[t.sectionKey] = t.sectionLabel || t.sectionKey;
    });
    return Object.entries(map);
  }, [filtered, isSultanLayout]);

  const activeSultanSection = currentSultanSection || sultanSections[0]?.[0];

  const sultanTables = useMemo(() => {
    if (!isSultanLayout) return filtered;
    return filtered.filter((t) => t.sectionKey === activeSultanSection);
  }, [filtered, isSultanLayout, activeSultanSection]);

  const havzanGroups = useMemo(() => {
    if (!isHavzan || isSultanLayout) return [];
    return MAKARA_HAVZAN_ZONES.map((zone) => ({
      ...zone,
      tables: filtered.filter(
        (t) => !isPackageTable(t) && t.number >= zone.min && t.number <= zone.max
      ),
    })).filter((z) => z.tables.length > 0);
  }, [filtered, isHavzan, isSultanLayout]);

  const packageTables = useMemo(() => {
    if (isSultanLayout) return [];
    return filtered.filter(isPackageTable);
  }, [filtered, isSultanLayout]);

  const suriciGroups = useMemo(() => {
    if (isSultanLayout || isHavzan) return null;
    const inside = filtered.filter((t) => String(t.id).startsWith('inside-') && !isPackageTable(t));
    const outside = filtered.filter((t) => String(t.id).startsWith('outside-') && !isPackageTable(t));
    const packages = filtered.filter(isPackageTable);
    return { inside, outside, packages };
  }, [filtered, isSultanLayout, isHavzan]);

  const ungrouped = useMemo(() => {
    if (isSultanLayout || isHavzan || suriciGroups) return [];
    return filtered;
  }, [filtered, isSultanLayout, isHavzan, suriciGroups]);

  const showSearchBar = showSearch && tables.length > 8;

  const renderGrid = (list) => (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
      {list.map((table) => (
        <TablePickCard
          key={table.id}
          table={table}
          selected={String(selectedId) === String(table.id)}
          onSelect={onSelect}
          disabled={excludeSet.has(String(table.id))}
        />
      ))}
    </div>
  );

  if (!filtered.length) {
    return (
      <div className="text-center py-10 px-4">
        <p className="text-3xl mb-2">🪑</p>
        <p className="text-sm text-gray-500 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {showSearchBar && (
        <div className="relative mb-4 sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-1 -mx-1 px-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Masa no veya adı ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      )}

      {isSultanLayout && sultanSections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide -mx-1 px-1">
          {sultanSections.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentSultanSection(key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSultanSection === key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isSultanLayout && renderGrid(sultanTables)}

      {isHavzan && !isSultanLayout && havzanGroups.map((zone) => (
        <ZoneBlock
          key={zone.key}
          title={zone.label}
          rangeLabel={`${zone.min}–${zone.max}`}
          count={zone.tables.length}
        >
          {renderGrid(zone.tables)}
        </ZoneBlock>
      ))}

      {packageTables.length > 0 && (
        <ZoneBlock title="Paket" count={packageTables.length}>
          {renderGrid(packageTables)}
        </ZoneBlock>
      )}

      {suriciGroups && (
        <>
          {suriciGroups.inside.length > 0 && (
            <ZoneBlock title="İç Mekan" count={suriciGroups.inside.length}>
              {renderGrid(suriciGroups.inside)}
            </ZoneBlock>
          )}
          {suriciGroups.outside.length > 0 && (
            <ZoneBlock title="Dış Mekan" count={suriciGroups.outside.length}>
              {renderGrid(suriciGroups.outside)}
            </ZoneBlock>
          )}
          {suriciGroups.packages.length > 0 && (
            <ZoneBlock title="Paket" count={suriciGroups.packages.length}>
              {renderGrid(suriciGroups.packages)}
            </ZoneBlock>
          )}
        </>
      )}

      {ungrouped.length > 0 && renderGrid(ungrouped)}
    </div>
  );
}
