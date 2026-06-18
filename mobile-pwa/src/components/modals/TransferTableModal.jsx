import { useEffect, useMemo, useState } from 'react';
import { submitAndWaitMobileAction } from '../../services/firebaseService';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { TablePickerGrid } from '../tables/TablePickerGrid';
import { TableOpsModalShell, TableSummaryCard } from './TableOpsModalShell';

export function TransferTableModal({ open, onClose }) {
  const { tables, selectedTable, loadData, showToast } = useApp();
  const { staff } = useAuth();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceId('');
      setTargetId('');
      setPickingSource(false);
      return;
    }
    if (selectedTable?.hasOrder) {
      setSourceId(selectedTable.id);
      setPickingSource(false);
    } else {
      setSourceId('');
      setPickingSource(true);
    }
    setTargetId('');
  }, [open, selectedTable?.id, selectedTable?.hasOrder]);

  const sourceTable = useMemo(
    () => tables.find((t) => String(t.id) === String(sourceId)),
    [tables, sourceId]
  );

  const targetTable = useMemo(
    () => tables.find((t) => String(t.id) === String(targetId)),
    [tables, targetId]
  );

  const canSubmit = sourceTable?.hasOrder && targetId && !loading;

  const handleTransfer = async () => {
    if (!sourceTable || !targetId || !staff) {
      showToast('error', 'Hata', 'Kaynak ve hedef masayı seçin');
      return;
    }
    setLoading(true);
    try {
      const res = await submitAndWaitMobileAction({
        type: 'transfer_table',
        sourceTableId: String(sourceTable.id),
        targetTableId: String(targetId),
        staffId: staff.id,
        staffName: `${staff.name} ${staff.surname}`,
      });
      if (res.success) {
        showToast('success', 'Başarılı', 'Masa aktarıldı');
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

  const showSourcePicker = pickingSource || !sourceTable?.hasOrder;

  return (
    <TableOpsModalShell
      open={open}
      onClose={onClose}
      title="Masa Aktar"
      subtitle="Dolu masayı boş bir masaya taşıyın"
      icon="↔️"
      accent="from-indigo-600 via-violet-600 to-purple-600"
      footer={
        <div className="space-y-2">
          {sourceTable && targetTable && (
            <p className="text-center text-xs text-gray-500 font-medium">
              <span className="text-gray-800 font-bold">{sourceTable.number}</span>
              {' → '}
              <span className="text-indigo-700 font-bold">{targetTable.number}</span>
            </p>
          )}
          <button
            type="button"
            onClick={handleTransfer}
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-[15px] shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Aktarılıyor...
              </span>
            ) : (
              'Masayı Aktar'
            )}
          </button>
        </div>
      }
    >
      {showSourcePicker ? (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">1. Kaynak masa (dolu)</p>
          <TablePickerGrid
            tables={tables}
            selectedId={sourceId}
            onSelect={(t) => {
              setSourceId(t.id);
              setTargetId('');
              if (t.hasOrder) setPickingSource(false);
            }}
            filterMode="occupied"
            emptyMessage="Dolu masa bulunamadı"
          />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Kaynak masa</p>
              <button
                type="button"
                onClick={() => {
                  setPickingSource(true);
                  setTargetId('');
                }}
                className="text-xs font-bold text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                Değiştir
              </button>
            </div>
            <TableSummaryCard table={sourceTable} role="source" />
          </div>

          <div className="flex justify-center my-2" aria-hidden>
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">2. Hedef masa (boş)</p>
            <TablePickerGrid
              tables={tables}
              selectedId={targetId}
              onSelect={(t) => setTargetId(t.id)}
              filterMode="empty"
              excludeIds={sourceId ? [sourceId] : []}
              emptyMessage="Boş masa bulunamadı"
            />
          </div>
        </>
      )}
    </TableOpsModalShell>
  );
}
