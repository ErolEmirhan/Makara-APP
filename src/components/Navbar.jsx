import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PinModal from './PinModal';
import SettingsModal from './SettingsModal';
import SettingsSplash from './SettingsSplash';
import DateTimeDisplay from './DateTimeDisplay';

const Navbar = ({ currentView, setCurrentView, totalItems, userType, setUserType, onRoleSplash, onProductsUpdated, onExit }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSettingsSplash, setShowSettingsSplash] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [serverURL, setServerURL] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', surname: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const menuRef = useRef(null);

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserTypeChange = (type) => {
    setShowUserMenu(false);
    
    if (type === 'Admin') {
      // Admin seçildiyse PIN modal'ı aç
      setShowPinModal(true);
    } else {
      // Personel seçildiyse direkt geçiş yap
      setUserType(type);
      onRoleSplash?.('Personel');
      if (currentView === 'sales') {
        setCurrentView('pos');
      }
    }
  };

  const handlePinSuccess = () => {
    setUserType('Admin');
    setShowPinModal(false);
    onRoleSplash?.('Admin');
  };

  const handlePinClose = () => {
    setShowPinModal(false);
  };

  const handleOpenMobileModal = async () => {
    setShowMobileModal(true);
    loadStaff();
    try {
      const result = await window.electronAPI.generateQRCode();
      if (result && result.success) {
        setQrCode(result.qrCode);
        setServerURL(result.url);
      } else {
        alert('QR kod oluşturulamadı: ' + (result?.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('QR kod oluşturma hatası:', error);
      alert('QR kod oluşturulamadı');
    }
  };

  const loadStaff = async () => {
    try {
      const staff = await window.electronAPI.getStaff();
      setStaffList(staff);
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.surname || !newStaff.password) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      const result = await window.electronAPI.createStaff(newStaff);
      if (result && result.success) {
        const staffName = `${newStaff.name} ${newStaff.surname}`;
        setNewStaff({ name: '', surname: '', password: '' });
        setShowAddStaff(false);
        loadStaff();
        setSuccessMessage(`${staffName} başarıyla eklendi`);
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 3000);
      } else {
        alert('Personel eklenemedi: ' + (result?.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Personel ekleme hatası:', error);
      alert('Personel eklenemedi');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    try {
      const result = await window.electronAPI.deleteStaff(staffId);
      if (result && result.success) {
        loadStaff();
        setDeleteConfirm(null);
        alert('Personel başarıyla silindi');
      } else {
        alert('Personel silinemedi: ' + (result?.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Personel silme hatası:', error);
      alert('Personel silinemedi');
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingStaff) {
      alert('Personel seçilmedi');
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      alert('Şifre en az 4 karakter olmalıdır');
      return;
    }

    try {
      console.log('Şifre güncelleme isteği gönderiliyor:', { staffId: editingStaff.id, passwordLength: newPassword.length });
      
      const result = await window.electronAPI.updateStaffPassword(editingStaff.id, newPassword.trim());
      
      console.log('Şifre güncelleme sonucu:', result);
      
      if (result && result.success) {
        const staffName = `${editingStaff.name} ${editingStaff.surname}`;
        setEditingStaff(null);
        setNewPassword('');
        setSuccessMessage(`${staffName} şifresi başarıyla güncellendi`);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        loadStaff();
      } else {
        const errorMsg = result?.error || 'Bilinmeyen hata';
        console.error('Şifre güncelleme başarısız:', errorMsg);
        alert('Şifre güncellenemedi: ' + errorMsg);
      }
    } catch (error) {
      console.error('Şifre güncelleme hatası:', error);
      alert('Şifre güncellenemedi: ' + (error.message || 'Bilinmeyen hata'));
    }
  };


  return (
    <nav className="h-20 bg-white/90 backdrop-blur-xl border-b border-purple-200 px-8 flex items-center justify-between shadow-lg relative z-50">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden bg-white p-1">
          <img 
            src="./logo.png" 
            alt="Makara Logo" 
            className="w-full h-full object-contain"
            style={{ display: 'block' }}
            onError={(e) => {
              console.error('Logo yüklenemedi, icon.png kullanılıyor:', e.target.src);
              e.target.src = './icon.png'; // Fallback
            }}
            onLoad={() => console.log('Logo başarıyla yüklendi')}
          />
        </div>
        <div>
          <h1 className="text-lg font-bold text-pink-500">Makara Satış Sistemi</h1>
          <p className="text-xs text-gray-500 font-medium">v2.2.8</p>
        </div>
        <div className="ml-4 pl-4 border-l border-gray-300">
          <DateTimeDisplay />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={handleOpenMobileModal}
          className="px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Mobil Personel</span>
          </div>
        </button>
        <button
          onClick={() => setCurrentView('tables')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            currentView === 'tables'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Masalar</span>
          </div>
        </button>
        <button
          onClick={() => setCurrentView('pos')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            currentView === 'pos'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Satış Yap</span>
            {totalItems > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {totalItems}
              </span>
            )}
          </div>
        </button>

        {userType === 'Admin' && (
          <>
            <button
              onClick={() => setCurrentView('sales')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                currentView === 'sales'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Satış Detayları</span>
              </div>
            </button>
            <button
              onClick={() => setShowSettingsSplash(true)}
              className="px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Ayarlar</span>
              </div>
            </button>
          </>
        )}

        <div className="relative ml-4 pl-4 border-l border-gray-300" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right">
              <p className="text-xs text-gray-500">Kullanıcı Tipi</p>
              <p className="text-sm font-medium text-gray-800 flex items-center space-x-1">
                <span>{userType}</span>
                <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              userType === 'Admin' 
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                : 'bg-gradient-to-br from-green-500 to-emerald-500'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-purple-200 overflow-hidden animate-fade-in z-[100]">
              <div className="p-2">
                <button
                  onClick={() => handleUserTypeChange('Admin')}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${
                    userType === 'Admin'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">Admin</p>
                    <p className="text-xs opacity-75">Tüm yetkilere sahip</p>
                  </div>
                  {userType === 'Admin' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => handleUserTypeChange('Personel')}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all mt-2 ${
                    userType === 'Personel'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">Personel</p>
                    <p className="text-xs opacity-75">Satış yapabilir</p>
                  </div>
                  {userType === 'Personel' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <p className="text-xs text-gray-600 text-center">
                  {userType === 'Admin' ? '🔐 Tüm özelliklere erişim' : '📋 Satış işlemleri'}
                </p>
              </div>

              {/* Çıkış Butonu - Panelin En Altı */}
              <div className="border-t border-gray-200 p-2">
                <button
                  onClick={() => setShowExitConfirm(true)}
                  className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl hover:bg-red-50 transition-all duration-300 text-red-600 hover:text-red-700"
                  title="Çıkış Yap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-semibold">Çıkış Yap</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Çıkış Onay Modal */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center pt-8 z-[9999] animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="bg-white/95 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Çıkış Yap</h3>
              <p className="text-gray-600">Uygulamayı kapatmak istediğinize emin misiniz?</p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-semibold text-lg transition-all duration-300"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  if (onExit) {
                    onExit();
                  }
                }}
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                Evet, Çık
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <PinModal
          onClose={handlePinClose}
          onSuccess={handlePinSuccess}
        />
      )}

      {/* Settings Splash */}
      {showSettingsSplash && (
        <SettingsSplash
          onComplete={() => {
            setShowSettingsSplash(false);
            setShowSettingsModal(true);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onProductsUpdated={onProductsUpdated}
        />
      )}

      {/* Mobil Personel Modal */}
      {showMobileModal && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[1000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform animate-scale-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500"></div>
            
            <button
              onClick={() => {
                setShowMobileModal(false);
                setQrCode(null);
                setServerURL('');
              }}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Mobil Personel Yönetimi</h3>
              <p className="text-sm text-gray-500">Personel ekleyin ve QR kod oluşturun</p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Personel Listesi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Personel Listesi</h4>
                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                  >
                    + Personel Ekle
                  </button>
                </div>
                
                {staffList.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Henüz personel eklenmemiş</p>
                ) : (
                  <div className="space-y-2">
                    {staffList.map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{staff.name} {staff.surname}</p>
                          <p className="text-xs text-gray-500">ID: {staff.id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingStaff(staff);
                              setNewPassword('');
                            }}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-all"
                          >
                            Şifre Değiştir
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(staff.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-all"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Personel Ekleme Formu */}
              {showAddStaff && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-gray-700 mb-2">Yeni Personel Ekle</h4>
                  <input
                    type="text"
                    placeholder="İsim"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Soyisim"
                    value={newStaff.surname}
                    onChange={(e) => setNewStaff({ ...newStaff, surname: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddStaff}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      Ekle
                    </button>
                    <button
                      onClick={() => {
                        setShowAddStaff(false);
                        setNewStaff({ name: '', surname: '', password: '' });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-all"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {/* Şifre Değiştirme Modal */}
              {editingStaff && (
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 space-y-4 border border-blue-200 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-700">Şifre Değiştir</h4>
                    <button
                      onClick={() => {
                        setEditingStaff(null);
                        setNewPassword('');
                      }}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">{editingStaff.name} {editingStaff.surname}</span> için yeni şifre
                    </p>
                    <input
                      type="password"
                      placeholder="Yeni şifre (min. 4 karakter)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdatePassword();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUpdatePassword}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => {
                        setEditingStaff(null);
                        setNewPassword('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {/* QR Kod */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">QR Kod</h4>
                {qrCode ? (
                  <>
                    <div className="flex justify-center mb-3">
                      <img src={qrCode} alt="QR Code" className="w-48 h-48 border-4 border-blue-200 rounded-xl" />
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1 text-center">Veya bu adresi tarayıcıya yazın:</p>
                      <p className="text-xs font-mono text-blue-600 text-center break-all">{serverURL}</p>
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      📱 Aynı WiFi ağına bağlı olduğunuzdan emin olun
                    </p>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">QR kod oluşturuluyor...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Silme Onay Modal */}
            {deleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
                  <h4 className="font-bold text-gray-800 mb-2">Personeli Sil</h4>
                  <p className="text-sm text-gray-600 mb-4">Bu personeli silmek istediğinize emin misiniz?</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-all"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(deleteConfirm)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modern Success Toast */}
      {showSuccessToast && (
        createPortal(
          <div className="fixed inset-x-0 top-0 z-[2000] flex justify-center pointer-events-none pt-6">
            <div className="bg-white/95 backdrop-blur-xl border-2 border-green-300 rounded-2xl shadow-2xl px-6 py-4 pointer-events-auto animate-toast-slide-down max-w-md mx-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg ring-4 ring-green-100 flex-shrink-0 animate-scale-in">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Başarılı</p>
                  <p className="text-lg font-bold text-gray-900">{successMessage}</p>
                </div>
                <button
                  onClick={() => setShowSuccessToast(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </nav>
  );
};

export default Navbar;

