import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const CourierManagementModal = ({ onClose }) => {
  const [couriers, setCouriers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourier, setEditingCourier] = useState(null);
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPassword, setNewCourierPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    loadCouriers();
  }, []);

  const loadCouriers = async () => {
    if (window.electronAPI && window.electronAPI.getCouriers) {
      try {
        const result = await window.electronAPI.getCouriers();
        if (result.success) {
          setCouriers(result.couriers || []);
        } else {
          showToast('Kuryeler yüklenemedi: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Kuryeler yüklenirken hata:', error);
        showToast('Kuryeler yüklenirken bir hata oluştu', 'error');
      }
    }
  };

  const handleAddCourier = async () => {
    if (!newCourierName.trim()) {
      showToast('Lütfen kurye adı girin', 'warning');
      return;
    }

    if (!newCourierPassword.trim()) {
      showToast('Lütfen şifre girin', 'warning');
      return;
    }

    if (newCourierPassword.length < 4) {
      showToast('Şifre en az 4 karakter olmalıdır', 'warning');
      return;
    }

    if (window.electronAPI && window.electronAPI.addCourier) {
      try {
        const result = await window.electronAPI.addCourier(newCourierName.trim(), newCourierPassword);
        if (result.success) {
          showToast('Kurye başarıyla eklendi', 'success');
          setNewCourierName('');
          setNewCourierPassword('');
          setShowAddModal(false);
          loadCouriers();
        } else {
          showToast(result.error || 'Kurye eklenemedi', 'error');
        }
      } catch (error) {
        console.error('Kurye eklenirken hata:', error);
        showToast('Kurye eklenirken bir hata oluştu', 'error');
      }
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      showToast('Lütfen yeni şifre girin', 'warning');
      return;
    }

    if (newPassword.length < 4) {
      showToast('Şifre en az 4 karakter olmalıdır', 'warning');
      return;
    }

    if (window.electronAPI && window.electronAPI.changeCourierPassword) {
      try {
        const result = await window.electronAPI.changeCourierPassword(editingCourier.id, newPassword);
        if (result.success) {
          showToast('Şifre başarıyla değiştirildi', 'success');
          setNewPassword('');
          setShowEditModal(false);
          setEditingCourier(null);
          loadCouriers();
        } else {
          showToast(result.error || 'Şifre değiştirilemedi', 'error');
        }
      } catch (error) {
        console.error('Şifre değiştirilirken hata:', error);
        showToast('Şifre değiştirilirken bir hata oluştu', 'error');
      }
    }
  };

  const handleDeleteCourier = async (courierId, courierName) => {
    if (!window.confirm(`"${courierName}" adlı kuryeyi silmek istediğinizden emin misiniz?`)) {
      return;
    }

    if (window.electronAPI && window.electronAPI.deleteCourier) {
      try {
        const result = await window.electronAPI.deleteCourier(courierId);
        if (result.success) {
          showToast('Kurye başarıyla silindi', 'success');
          loadCouriers();
        } else {
          showToast(result.error || 'Kurye silinemedi', 'error');
        }
      } catch (error) {
        console.error('Kurye silinirken hata:', error);
        showToast('Kurye silinirken bir hata oluştu', 'error');
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] shadow-xl transform animate-scale-in relative overflow-hidden flex flex-col border border-gray-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-600 to-gray-800"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6 pt-2">
          <div className="w-14 h-14 bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Kurye Yönetimi</h2>
          <p className="text-gray-600 text-sm">Kurye ekleyin, şifrelerini yönetin</p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="mb-6">
            <button
              onClick={() => {
                setNewCourierName('');
                setNewCourierPassword('');
                setShowAddModal(true);
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Yeni Kurye Ekle</span>
            </button>
          </div>

          <div className="space-y-3">
            {couriers.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600 font-medium">Henüz kurye eklenmemiş</p>
              </div>
            ) : (
              couriers.map((courier) => (
                <div
                  key={courier.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{courier.name}</h3>
                      <p className="text-sm text-gray-500">ID: {courier.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCourier(courier);
                          setNewPassword('');
                          setShowEditModal(true);
                        }}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all text-sm"
                      >
                        Şifre Değiştir
                      </button>
                      <button
                        onClick={() => handleDeleteCourier(courier.id, courier.name)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all text-sm"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Toast */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ message: '', type: 'info', show: false })}
          />
        )}

        {/* Kurye Ekleme Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2100] animate-fade-in px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl transform animate-scale-in relative">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-xl font-bold text-gray-900 mb-6">Yeni Kurye Ekle</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kurye Adı</label>
                  <input
                    type="text"
                    value={newCourierName}
                    onChange={(e) => setNewCourierName(e.target.value)}
                    placeholder="Kurye adını girin"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Şifre</label>
                  <input
                    type="password"
                    value={newCourierPassword}
                    onChange={(e) => setNewCourierPassword(e.target.value)}
                    placeholder="Şifre girin (min 4 karakter)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleAddCourier}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold rounded-lg transition-all"
                  >
                    Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Şifre Değiştirme Modal */}
        {showEditModal && editingCourier && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2100] animate-fade-in px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl transform animate-scale-in relative">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCourier(null);
                  setNewPassword('');
                }}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Şifre Değiştir</h3>
              <p className="text-sm text-gray-600 mb-6">Kurye: {editingCourier.name}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Yeni Şifre</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifre girin (min 4 karakter)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCourier(null);
                      setNewPassword('');
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleChangePassword}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold rounded-lg transition-all"
                  >
                    Değiştir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CourierManagementModal;
