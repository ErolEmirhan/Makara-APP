import { useEffect, useMemo, useState } from 'react';
import { submitAndWaitMobileAction } from '../../services/firebaseService';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { TablePickerGrid } from '../tables/TablePickerGrid';
import { TableOpsModalShell } from './TableOpsModalShell';

function itemKey(item) {
  return `${item.product_id}_${item.isGift ? '1' : '0'}`;
}

function transferableQty(item) {
  const total = Number(item.quantity) || 0;
  const paid = Number(item.paid_quantity) || 0;
  return Math.max(0, total - paid);
}

export function TransferItemsModal({ open, onClose }) {
  const { tables, selectedTable, currentOrderItems, loadData, showToast } = useApp();
  const { staff } = useAuth();
  const [step, setStep] = useState(1);
  const [qtyByKey, setQtyByKey] = useState({});
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setQtyByKey({});
      setTargetId('');
      setLoading(false);
    }
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map();
    (currentOrderItems || []).forEach((item) => {
      const max = transferableQty(item);
      if (max <= 0) return;
      const key = itemKey(item);
      const prev = map.get(key);
      if (prev) {
        prev.max += max;
        return;
      }
      map.set(key, {
        key,
        product_id: item.product_id,
        product_name: item.product_name || 'Ürün',
        price: item.price || 0,
        isGift: !!item.isGift,
        staff_name: item.staff_name || null,
        max,
      });
    });
    return Array.from(map.values());
  }, [currentOrderItems]);

  const selectedCount = Object.values(qtyByKey).reduce((sum, n) => sum + (Number(n) || 0), 0);

  const setQty = (key, max, delta) => {
    setQtyByKey((prev) => {
      const next = Math.max(0, Math.min(max, (Number(prev[key]) || 0) + delta));
      return { ...prev, [key]: next };
    });
  };

  const handleTransfer = async () => {
    if (!selectedTable || !targetId || !staff) {
      showToast('error', 'Hata', 'Hedef masayı seçin');
      return;
    }
    const items = groups
      .map((group) => ({
        product_id: group.product_id,
        product_name: group.product_name,
        quantity: Number(qtyByKey[group.key]) || 0,
        price: group.price,
        isGift: group.isGift,
        staff_name: group.staff_name,
      }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      showToast('error', 'Hata', 'Aktarılacak ürün seçin');
      return;
    }
    setLoading(true);
    try {
      const res = await submitAndWaitMobileAction({
        type: 'transfer_items',
        sourceTableId: String(selectedTable.id),
        targetTableId: String(targetId),
        items,
        staffId: staff.id,
        staffName: `${staff.name} ${staff.surname}`,
        staffIsManager: !!staff.is_manager,
        staffIsChef: !!staff.is_chef,
      });
      if (res.success) {
        showToast('success', 'Başarılı', 'Ürünler aktarıldı');
        await loadData();
        onClose();
      } else {
        showToast('error', 'Hata', res.error || 'Aktarılamadı');
      }
    } catch (err) {
      showToast('error', 'Hata', err.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TableOpsModalShell
      open={open}
      onClose={onClose}
      title={step === 1 ? 'Ürün aktar' : 'Hedef masa'}
      subtitle={step === 1 ? 'Yalnızca ödenmemiş adetler taşınır' : 'Ürünlerin gideceği masayı seçin'}
      icon="↗"
      accent="from-violet-600 via-purple-600 to-fuchsia-600"
      footer={
        step === 1 ? (
          <button
            type="button"
            disabled={selectedCount <= 0}
            onClick={() => setStep(2)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-40"
          >
            Hedef masa seç
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-bold"
            >
              Geri
            </button>
            <button
              type="button"
              disabled={!targetId || loading}
              onClick={handleTransfer}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-40"
            >
              {loading ? 'Aktarılıyor...' : 'Ürünleri aktar'}
            </button>
          </div>
        )
      }
    >
      {step === 1 ? (
        groups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aktarılabilir ürün yok.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const current = Math.min(group.max, Number(qtyByKey[group.key]) || 0);
              return (
                <div key={group.key} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{group.product_name}</p>
                    <p className="text-xs text-gray-500">En fazla {group.max} adet</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setQty(group.key, group.max, -1)} className="w-9 h-9 rounded-xl bg-white border border-gray-200 font-bold">−</button>
                    <span className="w-6 text-center font-black">{current}</span>
                    <button type="button" onClick={() => setQty(group.key, group.max, 1)} className="w-9 h-9 rounded-xl bg-white border border-gray-200 font-bold">+</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <TablePickerGrid
          tables={tables}
          selectedId={targetId}
          onSelect={(table) => setTargetId(table.id)}
          excludeIds={selectedTable ? [selectedTable.id] : []}
          emptyMessage="Hedef masa bulunamadı"
        />
      )}
    </TableOpsModalShell>
  );
}
