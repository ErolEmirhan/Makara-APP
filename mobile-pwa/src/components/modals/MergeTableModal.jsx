import { useEffect, useMemo, useState } from 'react';
import { submitAndWaitMobileAction } from '../../services/firebaseService';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { TablePickerGrid } from '../tables/TablePickerGrid';
import { TableOpsModalShell, TableSummaryCard, StepIndicator } from './TableOpsModalShell';

export function MergeTableModal({ open, onClose }) {
  const { tables, loadData, showToast } = useApp();
  const { staff } = useAuth();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceId('');
      setTargetId('');
      setStep(1);
    }
  }, [open]);

  const sourceTable = useMemo(
    () => tables.find((t) => String(t.id) === String(sourceId)),
    [tables, sourceId]
  );

  const targetTable = useMemo(
    () => tables.find((t) => String(t.id) === String(targetId)),
    [tables, targetId]
  );

  const canSubmit = sourceId && targetId && sourceId !== targetId && !loading;

  const handleMerge = async () => {
    if (!sourceId || !targetId || sourceId === targetId || !staff) {
      showToast('error', 'Hata', 'Kaynak ve hedef masayı seçin');
      return;
    }
    setLoading(true);
    try {
      const res = await submitAndWaitMobileAction({
        type: 'merge_table',
        sourceTableId: String(sourceId),
        targetTableId: String(targetId),
        staffId: staff.id,
        staffName: `${staff.name} ${staff.surname}`,
      });
      if (res.success) {
        showToast('success', 'Başarılı', 'Masalar birleştirildi');
        await loadData();
        onClose();
      } else {
        showToast('error', 'Hata', res.error || 'Birleştirilemedi');
      }
    } catch (err) {
      showToast('error', 'Hata', err.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const handleSourceSelect = (table) => {
    setSourceId(table.id);
    if (String(table.id) === String(targetId)) setTargetId('');
    setStep(2);
  };

  return (
    <TableOpsModalShell
      open={open}
      onClose={onClose}
      title="Masa Birleştir"
      subtitle="Kaynak masadaki ürünler hedef masaya eklenir"
      icon="🔗"
      accent="from-violet-600 via-purple-600 to-fuchsia-600"
      footer={
        <div className="space-y-2">
          {sourceTable && targetTable && (
            <p className="text-center text-xs text-gray-500 font-medium">
              Masa <span className="text-gray-800 font-bold">{sourceTable.number}</span>
              {' birleşecek → '}
              <span className="text-violet-700 font-bold">{targetTable.number}</span>
            </p>
          )}
          <div className="flex gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="shrink-0 px-4 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-600 font-bold text-sm active:scale-[0.98]"
              >
                Geri
              </button>
            )}
            <button
              type="button"
              onClick={step === 1 ? () => sourceId && setStep(2) : handleMerge}
              disabled={step === 1 ? !sourceId : !canSubmit}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-[15px] shadow-lg shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Birleştiriliyor...
                </span>
              ) : step === 1 ? (
                'Devam Et'
              ) : (
                'Masaları Birleştir'
              )}
            </button>
          </div>
        </div>
      }
    >
      <StepIndicator steps={['Kaynak', 'Hedef']} current={step} />

      {step === 1 ? (
        <div>
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">
            Boşalacak kaynak masayı seçin. Bu masadaki tüm ürünler hedef masaya taşınır.
          </p>
          <TablePickerGrid
            tables={tables}
            selectedId={sourceId}
            onSelect={handleSourceSelect}
            filterMode="occupied"
            emptyMessage="Birleştirilecek dolu masa yok"
          />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Kaynak (boşalacak)</p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50"
              >
                Değiştir
              </button>
            </div>
            <TableSummaryCard table={sourceTable} role="source" />
          </div>

          <div className="flex justify-center my-2" aria-hidden>
            <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm font-bold">
              +
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Hedef masa (ürünler buraya eklenecek)</p>
            <TablePickerGrid
              tables={tables}
              selectedId={targetId}
              onSelect={(t) => setTargetId(t.id)}
              filterMode="occupied"
              excludeIds={sourceId ? [sourceId] : []}
              emptyMessage="Başka dolu masa seçin"
            />
          </div>

          {targetTable && (
            <div className="mt-4">
              <TableSummaryCard table={targetTable} role="target" />
            </div>
          )}
        </>
      )}
    </TableOpsModalShell>
  );
}
