import { useEffect, useMemo, useState } from 'react';
import { useBranch } from '../../context/BranchContext';
import { fetchBranchStaff } from '../../services/firebaseService';
import { StaffAvatar } from '../ui/StaffAvatar';
import { useBackHandler } from '../../hooks/useBackButton';

function buildStaffLookup(staffList) {
  const byId = new Map();
  const byName = new Map();
  staffList.forEach((s) => {
    byId.set(s.id, s);
    const full = `${s.name || ''} ${s.surname || ''}`.trim().toLowerCase();
    if (full) byName.set(full, s);
  });
  return { byId, byName };
}

function resolveStaffForItem(item, lookup) {
  if (item.staff_id != null && lookup.byId.has(item.staff_id)) {
    return lookup.byId.get(item.staff_id);
  }
  const nameKey = (item.staff_name || '').trim().toLowerCase();
  if (nameKey && lookup.byName.has(nameKey)) {
    return lookup.byName.get(nameKey);
  }
  const parts = (item.staff_name || '').trim().split(/\s+/);
  return {
    name: parts[0] || 'Personel',
    surname: parts.slice(1).join(' ') || '',
    profileImageSrc: null,
  };
}

export function groupOrderItemsByStaff(items, staffList) {
  const lookup = buildStaffLookup(staffList);
  const groups = new Map();

  items.forEach((item) => {
    const staff = resolveStaffForItem(item, lookup);
    const nameKey = (item.staff_name || '').trim().toLowerCase();
    const key = item.staff_id ?? (nameKey || '__unknown__');
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        staffId: item.staff_id ?? staff?.id ?? null,
        name: staff?.name || (item.staff_name || 'Personel').split(/\s+/)[0],
        surname: staff?.surname || (item.staff_name || '').split(/\s+/).slice(1).join(' '),
        displayName:
          staff?.name && staff?.surname
            ? `${staff.name} ${staff.surname}`
            : item.staff_name || 'Personel',
        profileImageSrc: staff?.profileImageSrc || null,
        is_manager: !!staff?.is_manager,
        is_chef: !!staff?.is_chef,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });

  return Array.from(groups.values());
}

export function ExistingOrdersPanel({ items, canCancel, onCancelItem }) {
  const { theme, branchKey } = useBranch();
  const [expanded, setExpanded] = useState(false);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    if (!branchKey || items.length === 0) return;
    fetchBranchStaff(branchKey)
      .then(setStaffList)
      .catch(() => setStaffList([]));
  }, [branchKey, items.length]);

  const groups = useMemo(
    () => groupOrderItemsByStaff(items, staffList),
    [items, staffList]
  );

  useBackHandler(items.length > 0 && expanded, () => setExpanded(false));

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.isGift ? 0 : (Number(item.price) || 0) * (Number(item.quantity) || 0)),
        0
      ),
    [items]
  );

  if (items.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-emerald-100/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Mevcut Siparişler
          </p>
          {!expanded && (
            <p className="text-[11px] text-emerald-600/80 mt-0.5">
              {items.length} ürün · {totalAmount.toFixed(2)} ₺
            </p>
          )}
        </div>

        {!expanded && groups.length > 0 && (
          <div className="flex items-center shrink-0 pr-1">
            {groups.slice(0, 5).map((group, i) => (
              <div
                key={group.key}
                className="ring-2 ring-emerald-50 rounded-full"
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
              >
                <StaffAvatar
                  name={group.name}
                  surname={group.surname}
                  profileImageSrc={group.profileImageSrc}
                  isManager={group.is_manager}
                  isChef={group.is_chef}
                  size="2xs"
                  accent={theme.accent}
                />
              </div>
            ))}
            {groups.length > 5 && (
              <span className="ml-1 text-[10px] font-bold text-emerald-700 bg-white rounded-full w-7 h-7 flex items-center justify-center ring-2 ring-white shadow-sm">
                +{groups.length - 5}
              </span>
            )}
          </div>
        )}

        <svg
          className={`w-5 h-5 text-emerald-700 shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-emerald-200/70">
          {groups.map((group) => {
            const groupTotal = group.items.reduce(
              (sum, item) =>
                sum + (item.isGift ? 0 : (Number(item.price) || 0) * (Number(item.quantity) || 0)),
              0
            );

            return (
              <section
                key={group.key}
                className="rounded-xl bg-white/70 border border-emerald-100/80 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2.5 bg-white/90 border-b border-emerald-100/60">
                  <StaffAvatar
                    name={group.name}
                    surname={group.surname}
                    profileImageSrc={group.profileImageSrc}
                    isManager={group.is_manager}
                    isChef={group.is_chef}
                    size="sm"
                    accent={theme.accent}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {group.displayName}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {group.items.length} ürün · {groupTotal.toFixed(2)} ₺
                    </p>
                  </div>
                </div>

                <ul className="divide-y divide-emerald-50">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <span className="text-gray-800 font-medium min-w-0">
                        <span className="text-emerald-700 font-bold">{item.quantity}×</span>{' '}
                        {item.product_name}
                        {item.isGift && (
                          <span className="ml-1 text-emerald-600 text-xs font-semibold">İkram</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-600 font-semibold text-xs">
                          {item.isGift ? '0.00' : (item.price * item.quantity).toFixed(2)} ₺
                        </span>
                        {canCancel && onCancelItem && (
                          <button
                            type="button"
                            onClick={() => onCancelItem(item)}
                            className="text-red-500 text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50 active:bg-red-100"
                          >
                            İptal
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className="flex items-center justify-between px-1 pt-1 text-sm">
            <span className="text-emerald-800 font-semibold">Toplam</span>
            <span className="text-emerald-900 font-bold">{totalAmount.toFixed(2)} ₺</span>
          </div>
        </div>
      )}
    </div>
  );
}
