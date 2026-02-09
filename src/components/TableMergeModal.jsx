import React, { useState, useEffect } from 'react';
import Toast from './Toast';

const TableMergeModal = ({ onClose, onMerge }) => {
  const [step, setStep] = useState(1);
  const [tableOrders, setTableOrders] = useState([]);
  const [selectedSourceTable, setSelectedSourceTable] = useState(null);
  const [selectedTargetTable, setSelectedTargetTable] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [isMerging, setIsMerging] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const insideTables = Array.from({ length: 20 }, (_, i) => ({
    id: `inside-${i + 1}`,
    number: i + 1,
    type: 'inside',
    name: `İçeri ${i + 1}`
  }));

  const outsideTables = Array.from({ length: 24 }, (_, i) => ({
    id: `outside-${61 + i}`,
    number: 61 + i,
    type: 'outside',
    name: `Dışarı ${61 + i}`
  }));

  const packageTablesInside = Array.from({ length: 5 }, (_, i) => ({
    id: `package-inside-${i + 1}`,
    number: i + 1,
    type: 'inside',
    name: `Paket ${i + 1}`
  }));

  const packageTablesOutside = Array.from({ length: 5 }, (_, i) => ({
    id: `package-outside-${i + 1}`,
    number: i + 1,
    type: 'outside',
    name: `Paket ${i + 1}`
  }));

  const allTables = [...insideTables, ...outsideTables, ...packageTablesInside, ...packageTablesOutside];

  useEffect(() => {
    loadTableOrders();
  }, []);

  const loadTableOrders = async () => {
    if (window.electronAPI?.getTableOrders) {
      try {
        const orders = await window.electronAPI.getTableOrders();
        setTableOrders(orders || []);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const getTableOrder = (tableId) => tableOrders.find(o => o.table_id === tableId && o.status === 'pending');
  const hasOrder = (tableId) => !!getTableOrder(tableId);

  const handleSourceTableSelect = (table) => {
    if (!hasOrder(table.id)) {
      showToast('Bu masa boş. Lütfen dolu bir masa seçin.', 'warning');
      return;
    }
    setSelectedSourceTable(table);
    setSelectedTargetTable(null);
    setStep(2);
  };

  const handleTargetTableSelect = (table) => {
    if (table.id === selectedSourceTable?.id) {
      showToast('Hedef masa kaynak ile aynı olamaz.', 'warning');
      return;
    }
    if (!hasOrder(table.id)) {
      showToast('Hedef masa dolu olmalı. Lütfen dolu bir masa seçin.', 'warning');
      return;
    }
    setSelectedTargetTable(table);
  };

  const handleConfirmMerge = async () => {
    if (!selectedSourceTable || !selectedTargetTable) {
      showToast('Lütfen hem kaynak hem hedef masayı seçin.', 'warning');
      return;
    }
    if (selectedSourceTable.id === selectedTargetTable.id) {
      showToast('Aynı masayı seçemezsiniz.', 'warning');
      return;
    }
    if (!onMerge) return;
    setIsMerging(true);
    try {
      await onMerge(selectedSourceTable.id, selectedTargetTable.id);
      onClose();
    } catch (e) {
      showToast('Birleştirme sırasında hata oluştu.', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
        <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {step === 1 ? 'Birleştirilecek masayı seçin (içeriği taşınacak)' : 'Hedef masayı seçin (içeriğin ekleneceği dolu masa)'}
              </h2>
              <button type="button" onClick={onClose} className="text-white hover:text-gray-200 transition-colors p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {step === 1 && selectedSourceTable && (
              <p className="mt-2 text-sm opacity-90">Seçilen: {selectedSourceTable.name}</p>
            )}
            {step === 2 && (
              <p className="mt-2 text-sm opacity-90">
                {selectedSourceTable?.name} → {selectedTargetTable ? selectedTargetTable.name : 'Hedef seçin'}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {step === 1 ? (
              <div>
                <p className="text-gray-600 mb-4 font-semibold">İçeriği taşınacak dolu masayı seçin (bu masa kapanacak):</p>
                <div className="grid grid-cols-10 gap-2">
                  {allTables.map((table) => {
                    const tableHasOrder = hasOrder(table.id);
                    const isSelected = selectedSourceTable?.id === table.id;
                    if (!tableHasOrder) {
                      return (
                        <div
                          key={table.id}
                          className="opacity-30 cursor-not-allowed rounded-md p-2 border-2 border-gray-300 bg-gray-100"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{table.number}</span>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{table.name}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleSourceTableSelect(table)}
                        className={`rounded-md p-2 border-2 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-800 scale-105 text-white'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-700 border-teal-700 hover:border-teal-800 hover:scale-105 text-white'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-xs font-bold">{table.number}</span>
                          </div>
                          <span className="text-xs mt-1 font-semibold">{table.name}</span>
                          <span className="text-[10px] opacity-90 mt-0.5">Dolu</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4 font-semibold">İçeriğin ekleneceği hedef dolu masayı seçin:</p>
                <div className="grid grid-cols-10 gap-2">
                  {allTables.map((table) => {
                    const tableHasOrder = hasOrder(table.id);
                    const isSelected = selectedTargetTable?.id === table.id;
                    const isSourceTable = selectedSourceTable?.id === table.id;
                    const isOutside = table.type === 'outside';

                    if (isSourceTable) {
                      return (
                        <div
                          key={table.id}
                          className="opacity-60 cursor-not-allowed rounded-md p-2 border-2 border-amber-300 bg-amber-50"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
                              <span className="text-amber-900 text-xs font-bold">{table.number}</span>
                            </div>
                            <span className="text-xs text-amber-800 mt-1">{table.name}</span>
                            <span className="text-[10px] text-amber-600 mt-0.5">Kaynak</span>
                          </div>
                        </div>
                      );
                    }
                    if (!tableHasOrder) {
                      return (
                        <div
                          key={table.id}
                          className="opacity-30 cursor-not-allowed rounded-md p-2 border-2 border-gray-300 bg-gray-100"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{table.number}</span>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{table.name}</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">Boş</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleTargetTableSelect(table)}
                        className={`rounded-md p-2 border-2 transition-all ${
                          isSelected
                            ? isOutside
                              ? 'bg-amber-200 border-amber-500 scale-105'
                              : 'bg-teal-200 border-teal-500 scale-105'
                            : isOutside
                              ? 'bg-amber-50 border-amber-300 hover:border-amber-400 hover:scale-105'
                              : 'bg-teal-50 border-teal-300 hover:border-teal-400 hover:scale-105'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isOutside ? 'bg-amber-200 text-amber-900' : 'bg-teal-200 text-teal-900'
                            }`}
                          >
                            <span className="text-xs font-bold">{table.number}</span>
                          </div>
                          <span className={`text-xs mt-1 font-semibold ${isOutside ? 'text-amber-900' : 'text-teal-900'}`}>
                            {table.name}
                          </span>
                          <span className={`text-[10px] mt-0.5 ${isOutside ? 'text-amber-700' : 'text-teal-700'}`}>
                            Dolu
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setSelectedTargetTable(null);
                } else {
                  onClose();
                }
              }}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              {step === 2 ? 'Geri' : 'İptal'}
            </button>
            {step === 2 && (
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={!selectedTargetTable || isMerging}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isMerging ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Birleştiriliyor...
                  </>
                ) : (
                  'Birleştir'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </>
  );
};

export default TableMergeModal;
