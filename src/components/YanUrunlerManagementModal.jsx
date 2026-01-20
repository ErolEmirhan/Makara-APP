import React, { useState } from 'react';
import Toast from './Toast';

const YanUrunlerManagementModal = ({ yanUrunler: initialYanUrunler, onClose, onRefresh }) => {
  const [yanUrunler, setYanUrunler] = useState(initialYanUrunler || []);
  const [editingUrun, setEditingUrun] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrunName, setNewUrunName] = useState('');
  const [newUrunPrice, setNewUrunPrice] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleAddUrun = async () => {
    if (!newUrunName.trim()) {
      showToast('Ürün adı boş olamaz', 'error');
      return;
    }

    if (!newUrunPrice || parseFloat(newUrunPrice) <= 0) {
      showToast('Geçerli bir fiyat giriniz', 'error');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.createYanUrun) {
      showToast('API mevcut değil', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.createYanUrun({
        name: newUrunName.trim(),
        price: parseFloat(newUrunPrice)
      });

      if (result.success) {
        showToast('Ürün başarıyla eklendi', 'success');
        setNewUrunName('');
        setNewUrunPrice('');
        setShowAddForm(false);
        await refreshYanUrunler();
      } else {
        showToast(result.error || 'Ürün eklenemedi', 'error');
      }
    } catch (error) {
      console.error('Ürün ekleme hatası:', error);
      showToast('Ürün eklenirken bir hata oluştu', 'error');
    }
  };

  const handleUpdateUrun = async () => {
    if (!editingUrun) return;

    if (!editingUrun.name.trim()) {
      showToast('Ürün adı boş olamaz', 'error');
      return;
    }

    if (!editingUrun.price || parseFloat(editingUrun.price) <= 0) {
      showToast('Geçerli bir fiyat giriniz', 'error');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.updateYanUrun) {
      showToast('API mevcut değil', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.updateYanUrun({
        id: editingUrun.id,
        name: editingUrun.name.trim(),
        price: parseFloat(editingUrun.price)
      });

      if (result.success) {
        showToast('Ürün başarıyla güncellendi', 'success');
        setEditingUrun(null);
        await refreshYanUrunler();
      } else {
        showToast(result.error || 'Ürün güncellenemedi', 'error');
      }
    } catch (error) {
      console.error('Ürün güncelleme hatası:', error);
      showToast('Ürün güncellenirken bir hata oluştu', 'error');
    }
  };

  const handleDeleteUrun = async (urunId) => {
    if (!window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
      return;
    }

    if (!window.electronAPI || !window.electronAPI.deleteYanUrun) {
      showToast('API mevcut değil', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.deleteYanUrun(urunId);

      if (result.success) {
        showToast('Ürün başarıyla silindi', 'success');
        await refreshYanUrunler();
      } else {
        showToast(result.error || 'Ürün silinemedi', 'error');
      }
    } catch (error) {
      console.error('Ürün silme hatası:', error);
      showToast('Ürün silinirken bir hata oluştu', 'error');
    }
  };

  const refreshYanUrunler = async () => {
    if (window.electronAPI && window.electronAPI.getYanUrunler) {
      const updatedYanUrunler = await window.electronAPI.getYanUrunler();
      setYanUrunler(updatedYanUrunler);
      if (onRefresh) {
        onRefresh();
      }
    }
  };

  const handlePrintAdisyon = async () => {
    if (yanUrunler.length === 0) {
      showToast('Yazdırılacak ürün bulunmuyor', 'warning');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.printAdisyon) {
      showToast('Adisyon yazdırma API\'si mevcut değil', 'error');
      return;
    }

    // Yan ürünleri adisyon formatına çevir
    const items = yanUrunler.map(urun => ({
      id: `yan_urun_${urun.id}`,
      name: urun.name,
      price: urun.price,
      quantity: 1,
      isYanUrun: true
    }));

    const adisyonData = {
      items: items,
      tableName: 'Yan Ürünler',
      tableType: 'yan_urunler',
      sale_date: new Date().toLocaleDateString('tr-TR'),
      sale_time: new Date().toLocaleTimeString('tr-TR'),
      cashierOnly: true // Sadece kasa yazıcısından
    };

    try {
      const result = await window.electronAPI.printAdisyon(adisyonData);
      
      if (result.success) {
        showToast('Adisyon başarıyla yazdırıldı', 'success');
      } else {
        showToast(result.error || 'Adisyon yazdırılamadı', 'error');
      }
    } catch (error) {
      console.error('Adisyon yazdırma hatası:', error);
      showToast('Adisyon yazdırılırken bir hata oluştu', 'error');
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-8 py-6 flex items-center justify-between border-b border-slate-600">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Yan Ürünler Yönetimi</h2>
            <p className="text-sm text-slate-300 mt-1.5 font-medium">Local kayıtlı ürünler (Firebase'e gitmez)</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50">
          {/* Ürün Listesi */}
          <div className="space-y-3 mb-6">
            {yanUrunler.map((urun) => (
              <div
                key={urun.id}
                className="bg-white border border-gray-300 rounded-xl p-5 hover:border-slate-400 hover:shadow-md transition-all duration-200"
              >
                {editingUrun && editingUrun.id === urun.id ? (
                  <div className="flex items-start gap-6">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Adı</label>
                        <input
                          type="text"
                          value={editingUrun.name}
                          onChange={(e) => setEditingUrun({ ...editingUrun, name: e.target.value })}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all text-gray-900 font-medium"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Fiyat (₺)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingUrun.price}
                          onChange={(e) => setEditingUrun({ ...editingUrun, price: e.target.value })}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all text-gray-900 font-medium"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-8">
                      <button
                        onClick={handleUpdateUrun}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditingUrun(null)}
                        className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-lg font-bold text-gray-900 mb-2">{urun.name}</p>
                      <p className="text-xl font-extrabold text-slate-700">₺{parseFloat(urun.price).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingUrun({ ...urun })}
                        className="px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDeleteUrun(urun.id)}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Yeni Ürün Ekleme Formu */}
          {showAddForm ? (
            <div className="bg-white border-2 border-slate-300 rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-5">Yeni Ürün Ekle</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Adı</label>
                  <input
                    type="text"
                    value={newUrunName}
                    onChange={(e) => setNewUrunName(e.target.value)}
                    placeholder="Örn: Pasta Servis ücreti"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all text-gray-900 font-medium"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newUrunPrice}
                    onChange={(e) => setNewUrunPrice(e.target.value)}
                    placeholder="Örn: 150"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all text-gray-900 font-medium"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddUrun}
                    className="flex-1 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                  >
                    Ekle
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewUrunName('');
                      setNewUrunPrice('');
                    }}
                    className="flex-1 px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-5 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Yeni Ürün Ekle</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-8 py-5 flex items-center justify-between">
          <button
            onClick={handlePrintAdisyon}
            className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Adisyon Yazdır</span>
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
          >
            Kapat
          </button>
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

export default YanUrunlerManagementModal;
