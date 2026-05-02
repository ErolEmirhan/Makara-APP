import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PinModal from './PinModal';
import SettingsSplash from './SettingsSplash';
import DateTimeDisplay from './DateTimeDisplay';
import Toast from './Toast';
import ThemeToggle from './ThemeToggle';

const Navbar = ({ currentView, setCurrentView, totalItems, userType, setUserType, onRoleSplash, onProductsUpdated, onExit, onLogout, onOpenSettings, systemTitle = 'Makara Satış Sistemi', isSuriciBranch = false, isSultanBranch = false, themeMode = 'light', setThemeMode }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsSplash, setShowSettingsSplash] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showMobileStaffSplash, setShowMobileStaffSplash] = useState(false);
  const mobileSplashTimerRef = useRef(null);
  const [qrCode, setQrCode] = useState(null);
  const [serverURL, setServerURL] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', surname: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [managerOpsConfigured, setManagerOpsConfigured] = useState(false);
  const [managerOpsModalStaff, setManagerOpsModalStaff] = useState(null);
  const [managerOpsPin, setManagerOpsPin] = useState('');
  /** masaüstü müdür işlem şifresi modalı: müdür mü şef mi atanacak */
  const [managerDesktopOpsMode, setManagerDesktopOpsMode] = useState('manager');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [networkDevices, setNetworkDevices] = useState([]);
  const [networkScanning, setNetworkScanning] = useState(false);
  const [mobilePreferredHost, setMobilePreferredHost] = useState(null);
  const [computerHostname, setComputerHostname] = useState('');
  const menuRef = useRef(null);
  const hamburgerMenuRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(event.target)) {
        const panel = document.getElementById('hamburger-panel');
        if (panel && !panel.contains(event.target)) setShowHamburgerMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleHamburgerMenu = () => setShowHamburgerMenu((prev) => !prev);

  const closeHamburgerAnd = (fn) => {
    setShowHamburgerMenu(false);
    fn?.();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      showToast('Tam ekran açıldı', 'success');
    } else {
      document.exitFullscreen?.();
      showToast('Tam ekran kapatıldı', 'info');
    }
    setShowHamburgerMenu(false);
  };

  const handleCheckUpdates = async () => {
    setShowHamburgerMenu(false);
    try {
      if (window.electronAPI?.checkForUpdates) {
        await window.electronAPI.checkForUpdates();
        showToast('Güncelleme kontrol edildi', 'success');
      } else {
        showToast('Bu sürümde güncelleme kontrolü yok', 'info');
      }
    } catch (e) {
      showToast('Güncelleme kontrolü başarısız', 'error');
    }
  };

  const handleQuickLock = () => {
    setShowHamburgerMenu(false);
    setUserType('Personel');
    setShowUserMenu(false);
    onRoleSplash?.('Personel');
    if (currentView === 'sales') setCurrentView('pos');
    showToast('Hızlı kilit: Personel moduna geçildi', 'info');
  };

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

  useEffect(() => {
    return () => {
      if (mobileSplashTimerRef.current) {
        clearTimeout(mobileSplashTimerRef.current);
        mobileSplashTimerRef.current = null;
      }
    };
  }, []);

  const loadMobileModalData = async () => {
    setShowMobileModal(true);
    loadStaff();
    try {
      const preferred = await window.electronAPI.getMobilePreferredHost?.();
      setMobilePreferredHost(preferred ?? null);
    } catch (_) {}
    try {
      const hostname = await window.electronAPI.getComputerHostname?.();
      setComputerHostname(hostname || '');
    } catch (_) {}
    try {
      const result = await window.electronAPI.generateQRCode();
      if (result && result.success) {
        setQrCode(result.qrCode);
        setServerURL(result.url);
      } else {
        showToast('QR kod oluşturulamadı: ' + (result?.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('QR kod oluşturma hatası:', error);
      showToast('QR kod oluşturulamadı', 'error');
    }
  };

  const handleOpenMobileModal = () => {
    if (showMobileStaffSplash || showMobileModal) return;
    setShowMobileStaffSplash(true);
    if (mobileSplashTimerRef.current) clearTimeout(mobileSplashTimerRef.current);
    mobileSplashTimerRef.current = setTimeout(() => {
      mobileSplashTimerRef.current = null;
      setShowMobileStaffSplash(false);
      void loadMobileModalData();
    }, 1000);
  };

  const handleScanNetwork = async () => {
    if (!window.electronAPI.scanNetwork) return;
    setNetworkScanning(true);
    setNetworkDevices([]);
    try {
      const result = await window.electronAPI.scanNetwork();
      if (result && result.success && result.devices) {
        setNetworkDevices(result.devices);
        showToast(result.devices.length ? `${result.devices.length} cihaz bulundu` : 'Açık cihaz bulunamadı', 'info');
      } else {
        showToast(result?.error || 'Ağ taranamadı', 'error');
      }
    } catch (error) {
      console.error('Ağ tarama hatası:', error);
      showToast('Ağ taranamadı', 'error');
    } finally {
      setNetworkScanning(false);
    }
  };

  const handleUseIpForQR = async (ip) => {
    if (!window.electronAPI.setMobilePreferredHost) return;
    try {
      await window.electronAPI.setMobilePreferredHost(ip);
      setMobilePreferredHost(ip);
      const result = await window.electronAPI.generateQRCode();
      if (result && result.success) {
        setQrCode(result.qrCode);
        setServerURL(result.url);
        showToast('QR artık bu adrese yönlendiriliyor: ' + ip, 'success');
      }
    } catch (error) {
      showToast('Ayarlanırken hata oluştu', 'error');
    }
  };

  const handleClearPreferredHost = async () => {
    if (!window.electronAPI.setMobilePreferredHost) return;
    try {
      await window.electronAPI.setMobilePreferredHost(null);
      setMobilePreferredHost(null);
      const result = await window.electronAPI.generateQRCode();
      if (result && result.success) {
        setQrCode(result.qrCode);
        setServerURL(result.url);
        showToast('QR tekrar otomatik IP kullanacak', 'info');
      }
    } catch (error) {
      showToast('Ayarlanırken hata oluştu', 'error');
    }
  };

  const refreshManagerOpsConfig = async () => {
    try {
      const r = await window.electronAPI.getManagerOpsPasswordConfigured?.();
      setManagerOpsConfigured(!!r?.configured);
    } catch {
      setManagerOpsConfigured(false);
    }
  };

  const loadStaff = async () => {
    try {
      const staff = await window.electronAPI.getStaff();
      setStaffList(staff);
      await refreshManagerOpsConfig();
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
  };

  const isMakaraHavzanDesktop = !isSuriciBranch && !isSultanBranch;

  const runSetStaffManager = async (staff, managerAuthPassword) => {
    try {
      const result = await window.electronAPI.setStaffManager(staff.id, !staff.is_manager, managerAuthPassword);
      if (result.success) {
        await loadStaff();
        setManagerOpsModalStaff(null);
        setManagerOpsPin('');
        showToast(staff.is_manager ? 'Müdürlük kaldırıldı' : 'Müdür olarak atandı', 'success');
      } else {
        showToast('Hata: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Müdür atama hatası:', error);
      showToast('Müdür atanamadı: ' + error.message, 'error');
    }
  };

  const runSetStaffChef = async (staff, managerAuthPassword) => {
    try {
      if (!window.electronAPI?.setStaffChef) {
        showToast('Şef ataması bu sürümde yok', 'error');
        return;
      }
      const result = await window.electronAPI.setStaffChef(staff.id, !staff.is_chef, managerAuthPassword);
      if (result.success) {
        await loadStaff();
        setManagerOpsModalStaff(null);
        setManagerOpsPin('');
        showToast(staff.is_chef ? 'Şeflik kaldırıldı' : 'Şef olarak atandı', 'success');
      } else {
        showToast('Hata: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Şef atama hatası:', error);
      showToast('Şef atanamadı: ' + error.message, 'error');
    }
  };

  const onManagerToggleClick = (staff) => {
    setManagerDesktopOpsMode('manager');
    if (managerOpsConfigured) {
      setManagerOpsModalStaff(staff);
      setManagerOpsPin('');
    } else {
      runSetStaffManager(staff, undefined);
    }
  };

  const onChefToggleClick = (staff) => {
    if (!isMakaraHavzanDesktop) return;
    setManagerDesktopOpsMode('chef');
    if (managerOpsConfigured) {
      setManagerOpsModalStaff(staff);
      setManagerOpsPin('');
    } else {
      runSetStaffChef(staff, undefined);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.surname || !newStaff.password) {
      showToast('Lütfen tüm alanları doldurun', 'warning');
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
        showToast('Personel eklenemedi: ' + (result?.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Personel ekleme hatası:', error);
      showToast('Personel eklenemedi', 'error');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    try {
      const result = await window.electronAPI.deleteStaff(staffId);
      if (result && result.success) {
        loadStaff();
        setDeleteConfirm(null);
        setSuccessMessage('Personel başarıyla silindi');
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 3000);
      } else {
        showToast('Personel silinemedi: ' + (result?.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Personel silme hatası:', error);
      showToast('Personel silinemedi', 'error');
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingStaff) {
      showToast('Personel seçilmedi', 'warning');
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      showToast('Şifre en az 4 karakter olmalıdır', 'warning');
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
        showToast('Şifre güncellenemedi: ' + errorMsg, 'error');
      }
    } catch (error) {
      console.error('Şifre güncelleme hatası:', error);
      showToast('Şifre güncellenemedi: ' + (error.message || 'Bilinmeyen hata'), 'error');
    }
  };


  return (
    <nav className="h-20 bg-white/90 dark:bg-slate-900/92 backdrop-blur-xl border-b border-pink-200 dark:border-slate-700/90 theme-sultan:border-emerald-800/40 px-8 flex items-center justify-between shadow-lg relative z-50">
      {/* Sol üst: Hamburger menü butonu */}
      <div className="flex items-center space-x-4">
        <div ref={hamburgerMenuRef} className="flex items-center">
          <button
            type="button"
            onClick={toggleHamburgerMenu}
            className="w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white transition-all duration-200 shadow-sm hover:shadow"
            aria-label="Menüyü aç"
            title="Menü"
          >
            <span className="w-5 h-0.5 bg-current rounded-full" />
            <span className="w-5 h-0.5 bg-current rounded-full" />
            <span className="w-5 h-0.5 bg-current rounded-full" />
          </button>
        </div>

        {!isSultanBranch && (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden bg-white dark:bg-slate-800 p-1 ring-1 ring-slate-200/80 dark:ring-slate-600">
            <img
              src="./logo.png"
              alt="Makara Logo"
              className="w-full h-full object-contain"
              style={{ display: 'block' }}
              onError={(e) => {
                console.error('Logo yüklenemedi, icon.png kullanılıyor:', e.target.src);
                e.target.src = './icon.png';
              }}
              onLoad={() => console.log('Logo başarıyla yüklendi')}
            />
          </div>
        )}
        <div>
          <h1
            className={
              isSultanBranch
                ? 'text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent'
                : 'text-lg font-bold text-pink-500 dark:text-pink-400 theme-sultan:text-emerald-500 dark:theme-sultan:text-emerald-400'
            }
          >
            {systemTitle}
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">v41.0.0</p>
        </div>
        <div className="ml-4 pl-4 border-l border-gray-300 dark:border-slate-600 flex items-center gap-3">
          {typeof setThemeMode === 'function' && (
            <ThemeToggle themeMode={themeMode} onThemeChange={setThemeMode} />
          )}
          <DateTimeDisplay />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={handleOpenMobileModal}
          className="px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-zinc-900 dark:bg-violet-700 text-white hover:bg-black dark:hover:bg-violet-600 hover:shadow-lg"
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
              ? 'bg-gradient-to-r from-pink-600 theme-sultan:from-emerald-600 to-pink-500 theme-sultan:to-emerald-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>{isSuriciBranch ? 'Müşteriler' : isSultanBranch ? 'Salon' : 'Masalar'}</span>
          </div>
        </button>
        <button
          onClick={() => setCurrentView('pos')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            currentView === 'pos'
              ? 'bg-gradient-to-r from-pink-600 theme-sultan:from-emerald-600 to-pink-500 theme-sultan:to-emerald-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white'
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
              onClick={() => setShowSettingsSplash(true)}
              className="px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white"
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

        <div className="relative ml-4 pl-4 border-l border-gray-300 dark:border-slate-600" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-slate-400">Kullanıcı Tipi</p>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-100 flex items-center space-x-1">
                <span>{userType}</span>
                <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              userType === 'Admin' 
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                : 'bg-gradient-to-br from-fuchsia-500 theme-sultan:from-green-500 to-pink-500 theme-sultan:to-emerald-500'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </button>

          {/* Dropdown Menu - Modern & Professional */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 overflow-hidden animate-fade-in z-[100]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-700/80 dark:to-slate-800/80">
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Kullanıcı Tipi</p>
              </div>

              {/* Options */}
              <div className="p-2">
                <button
                  onClick={() => handleUserTypeChange('Admin')}
                  className={`w-full flex items-center space-x-3 p-3.5 rounded-lg transition-all duration-200 ${
                    userType === 'Admin'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'hover:bg-blue-50/50 dark:hover:bg-slate-700/80 text-gray-700 dark:text-slate-200'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    userType === 'Admin'
                      ? 'bg-white/20'
                      : 'bg-blue-100 dark:bg-blue-900/50'
                  }`}>
                    <svg className={`w-5 h-5 ${userType === 'Admin' ? 'text-white' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${userType === 'Admin' ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>Admin</p>
                    <p className={`text-xs ${userType === 'Admin' ? 'text-white/80' : 'text-gray-500 dark:text-slate-400'}`}>Tüm yetkilere sahip</p>
                  </div>
                  {userType === 'Admin' && (
                    <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => handleUserTypeChange('Personel')}
                  className={`w-full flex items-center space-x-3 p-3.5 rounded-lg transition-all duration-200 mt-1 ${
                    userType === 'Personel'
                      ? 'bg-gradient-to-r from-pink-600 theme-sultan:from-emerald-600 to-indigo-600 theme-sultan:to-teal-600 text-white shadow-md'
                      : 'hover:bg-pink-50 theme-sultan:hover:bg-pink-50 dark:hover:bg-slate-700/80 theme-sultan:bg-emerald-50/50 dark:theme-sultan:bg-emerald-950/30 text-gray-700 dark:text-slate-200'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    userType === 'Personel'
                      ? 'bg-white/20'
                      : 'bg-pink-100 theme-sultan:bg-emerald-100 dark:bg-pink-900/40 dark:theme-sultan:bg-emerald-900/40'
                  }`}>
                    <svg className={`w-5 h-5 ${userType === 'Personel' ? 'text-white' : 'text-pink-600 theme-sultan:text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${userType === 'Personel' ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>Personel</p>
                    <p className={`text-xs ${userType === 'Personel' ? 'text-white/80' : 'text-gray-500 dark:text-slate-400'}`}>Satış yapabilir</p>
                  </div>
                  {userType === 'Personel' && (
                    <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Status Info */}
              <div className={`px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 ${
                userType === 'Admin' 
                  ? 'bg-blue-50/50 dark:bg-slate-900/60' 
                  : 'bg-pink-50 theme-sultan:bg-emerald-50/50 dark:bg-slate-900/50 dark:theme-sultan:bg-emerald-950/40'
              }`}>
                <p className={`text-xs text-center font-medium ${
                  userType === 'Admin' 
                    ? 'text-blue-700' 
                    : 'text-pink-700 theme-sultan:text-emerald-700'
                }`}>
                  {userType === 'Admin' ? 'Tüm özelliklere erişim' : 'Satış işlemleri'}
                </p>
              </div>

              {/* Çıkış Butonu */}
              <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                <button
                  onClick={() => setShowExitConfirm(true)}
                  className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-200 text-gray-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400"
                  title="Çıkış Yap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Çıkış Yap</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sol taraftan açılan menü paneli - body'e portal ile çiziliyor ki navbar'ın arkasında kalmasın */}
      {showHamburgerMenu && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            style={{ zIndex: 9998 }}
            aria-hidden
            onClick={() => setShowHamburgerMenu(false)}
          />
          <div
            id="hamburger-panel"
            className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-r border-gray-200 dark:border-slate-700"
            style={{ zIndex: 9999, animation: 'slideInLeft 0.2s ease-out' }}
          >
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <span className="font-bold text-gray-800 dark:text-slate-100">Menü</span>
              <button
                type="button"
                onClick={() => setShowHamburgerMenu(false)}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-300"
                aria-label="Menüyü kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button
                onClick={() => closeHamburgerAnd(() => setCurrentView('pos'))}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${currentView === 'pos' ? 'bg-pink-50 theme-sultan:bg-emerald-50 dark:bg-pink-950/40 dark:theme-sultan:bg-emerald-950/40 text-pink-800 theme-sultan:text-emerald-800 dark:text-pink-200 dark:theme-sultan:text-emerald-200' : 'text-gray-700 dark:text-slate-200'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">Satış Yap</span>
              </button>
              <button
                onClick={() => closeHamburgerAnd(() => setCurrentView('tables'))}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${currentView === 'tables' ? 'bg-pink-50 theme-sultan:bg-emerald-50 dark:bg-pink-950/40 dark:theme-sultan:bg-emerald-950/40 text-pink-800 theme-sultan:text-emerald-800 dark:text-pink-200 dark:theme-sultan:text-emerald-200' : 'text-gray-700 dark:text-slate-200'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="font-medium">{isSuriciBranch ? 'Müşteriler' : isSultanBranch ? 'Salon' : 'Masalar'}</span>
              </button>
              <button
                onClick={() => closeHamburgerAnd(handleOpenMobileModal)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Mobil Personel</span>
              </button>
              {userType === 'Admin' && (
                <button
                  onClick={() => closeHamburgerAnd(() => setShowSettingsSplash(true))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Ayarlar</span>
                </button>
              )}
              <div className="my-2 border-t border-gray-100 dark:border-slate-700" />
              <button
                onClick={toggleFullscreen}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="font-medium">Tam Ekran</span>
              </button>
              {typeof window !== 'undefined' && window.electronAPI?.checkForUpdates && (
                <button
                  onClick={handleCheckUpdates}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="font-medium">Güncellemeleri Kontrol Et</span>
                </button>
              )}
              {userType === 'Admin' && (
                <button
                  onClick={handleQuickLock}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Hızlı Kilit</span>
                </button>
              )}
              <div className="my-2 border-t border-gray-100 dark:border-slate-700" />
              <button
                onClick={() => closeHamburgerAnd(() => setShowExitConfirm(true))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Çıkış Yap</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Çıkış Onay Modal */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center pt-8 z-[9999] animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="bg-white/95 dark:bg-slate-900/98 backdrop-blur-xl border-2 border-red-200 dark:border-red-900/60 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-pink-500 theme-sultan:to-emerald-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Çıkış Yap</h3>
                  <p className="text-gray-600 dark:text-slate-400">Çıkış yapıp giriş ekranına dönmek istediğinize emin misiniz?</p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white font-semibold text-lg transition-all duration-300"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  if (onLogout) {
                    onLogout();
                  } else if (onExit) {
                    onExit();
                  }
                }}
                className="flex-1 py-4 bg-gradient-to-r from-pink-500 theme-sultan:from-emerald-500 to-fuchsia-500 theme-sultan:to-green-500 hover:from-pink-600 theme-sultan:hover:from-emerald-600 hover:to-fuchsia-600 theme-sultan:hover:to-fuchsia-600 theme-sultan:to-green-600 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                Evet, Çıkış Yap
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

      {/* Settings Splash - sonrasında ayarlar sayfasına gider */}
      {showSettingsSplash && (
        <SettingsSplash
          onComplete={() => {
            setShowSettingsSplash(false);
            onOpenSettings?.();
          }}
        />
      )}

      {showMobileStaffSplash &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-zinc-950"
            role="presentation"
            aria-hidden
          >
            <svg
              className="mobile-splash-symbol h-[4.5rem] w-[4.5rem] text-zinc-100 sm:h-24 sm:w-24"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.25}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>,
          document.body
        )}

      {/* Mobil Personel — kurumsal tek ekran düzeni */}
      {showMobileModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gradient-to-b from-zinc-950 via-neutral-950 to-black p-3 sm:p-4 backdrop-blur-md animate-fade-in">
          <div
            className="relative flex w-full max-w-[1360px] flex-col overflow-hidden rounded-3xl border border-zinc-700/50 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/90 shadow-[0_32px_100px_-20px_rgba(0,0,0,0.55)] ring-1 ring-zinc-300/60"
            style={{ height: 'min(90vh, 880px)', maxHeight: '92vh' }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,0,0,0.06),transparent)]" />

            {/* Üst şerit */}
            <header className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-700/60 bg-gradient-to-r from-zinc-900 via-neutral-900 to-black px-4 py-4 text-white shadow-inner shadow-black/20 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-500/40 to-zinc-800/50 p-0.5 ring-2 ring-white/15">
                  <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-black/50">
                    <svg className="h-7 w-7 text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Mobil erişim merkezi</p>
                  <h3 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">Personel &amp; QR yönetimi</h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200 sm:inline">
                  {staffList.length} kayıt
                </span>
                {managerOpsConfigured && (
                  <span className="rounded-full border border-zinc-500/50 bg-white/10 px-3 py-1 text-[11px] font-bold text-zinc-100 shadow-sm">
                    Müdür şifresi aktif
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddStaff(true)}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_8px_28px_-4px_rgba(0,0,0,0.35)] ring-2 ring-white/30 transition hover:scale-[1.02] hover:bg-zinc-100 active:scale-[0.98] sm:px-7 sm:py-3.5 sm:text-[15px]"
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <svg className="relative h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="relative">Yeni personel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileModal(false);
                    setQrCode(null);
                    setServerURL('');
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/15 hover:text-white"
                  aria-label="Kapat"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Sol: personel | Sağ: QR üstte + Ağ altta */}
            <div className="relative grid min-h-0 flex-1 grid-cols-1 divide-y divide-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/80 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
              {/* Personel */}
              <section className="flex min-h-0 flex-col lg:col-span-7">
                <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-gradient-to-r from-transparent via-zinc-100/50 to-transparent px-4 py-3 sm:px-5">
                  <span className="bg-gradient-to-r from-zinc-800 to-zinc-600 bg-clip-text text-sm font-bold uppercase tracking-wide text-transparent">
                    Personel
                  </span>
                  <span className="rounded-full bg-zinc-200/90 px-2.5 py-0.5 text-xs font-semibold text-zinc-800">
                    {staffList.length} kişi
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                  {staffList.length === 0 ? (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300/80 bg-gradient-to-b from-white to-zinc-50 px-6 py-12 text-center">
                      <div className="mb-3 rounded-2xl bg-zinc-100 p-4">
                        <svg className="h-10 w-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-zinc-800">Henüz personel yok</p>
                      <p className="mt-1 max-w-xs text-sm text-zinc-500">Sağ üstteki <span className="font-semibold text-zinc-900">Yeni personel</span> ile ekleyin</p>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {[...staffList]
                        .sort((a, b) => {
                          if (a.is_manager && !b.is_manager) return -1;
                          if (!a.is_manager && b.is_manager) return 1;
                          if (a.is_chef && !b.is_chef) return -1;
                          if (!a.is_chef && b.is_chef) return 1;
                          return `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'tr');
                        })
                        .map((staff) => (
                        <li
                          key={staff.id}
                          className={
                            staff.is_manager
                              ? 'overflow-hidden rounded-2xl border-[3px] border-zinc-800 bg-gradient-to-br from-zinc-100 via-white to-zinc-50 p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.2)] ring-2 ring-zinc-400/60 ring-offset-2 ring-offset-white transition hover:border-black hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]'
                              : 'overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/90 to-white p-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-200/80 transition hover:border-zinc-300 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]'
                          }
                        >
                          {staff.is_manager && (
                            <div className="-mx-4 -mt-4 mb-3 rounded-t-[13px] border-b border-zinc-300 bg-gradient-to-r from-zinc-200/80 via-zinc-100 to-zinc-200/80 px-4 py-2 text-center">
                              <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-zinc-900">
                                Şube müdürü
                              </span>
                            </div>
                          )}
                          <div className="flex gap-4">
                            <div
                              className={
                                staff.is_manager
                                  ? 'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-lg font-bold text-white shadow-lg shadow-black/25 ring-2 ring-zinc-500/50'
                                  : 'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900 text-lg font-bold text-white shadow-lg shadow-zinc-500/25'
                              }
                            >
                              {staff.name.charAt(0)}
                              {staff.surname.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-bold tracking-tight text-slate-900">
                                  {staff.name} {staff.surname}
                                </p>
                                {staff.is_manager && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-md ring-2 ring-zinc-300">
                                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Müdür
                                  </span>
                                )}
                                {!staff.is_manager && staff.is_chef && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-md ring-2 ring-amber-200">
                                    Şef
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">Kayıt no · {staff.id}</p>
                            </div>
                            <button
                              type="button"
                              title="Personeli sil"
                              onClick={() => setDeleteConfirm(staff.id)}
                              className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl text-red-500 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaff(staff);
                                setNewPassword('');
                              }}
                              className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-xs font-bold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 sm:flex-initial sm:min-w-[140px] sm:text-sm"
                            >
                              Şifre değiştir
                            </button>
                            <button
                              type="button"
                              onClick={() => onManagerToggleClick(staff)}
                              className={`inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-md transition hover:brightness-110 sm:flex-initial sm:min-w-[140px] sm:text-sm ${
                                staff.is_manager
                                  ? 'bg-gradient-to-r from-rose-600 to-red-700 shadow-black/10'
                                  : 'bg-gradient-to-r from-zinc-700 to-black shadow-black/15'
                              }`}
                            >
                              {staff.is_manager ? 'Müdürlük kaldır' : 'Müdür ata'}
                            </button>
                            {isMakaraHavzanDesktop && (
                              <button
                                type="button"
                                disabled={!!staff.is_manager}
                                title={staff.is_manager ? 'Müdür aynı anda şef olamaz' : ''}
                                onClick={() => onChefToggleClick(staff)}
                                className={`inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial sm:min-w-[140px] sm:text-sm ${
                                  staff.is_chef
                                    ? 'bg-gradient-to-r from-orange-600 to-amber-800 shadow-black/10'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-black/15'
                                }`}
                              >
                                {staff.is_chef ? 'Şefliği kaldır' : 'Şef ata'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Sağ sütun: QR üst + Ağ alt */}
              <section className="flex min-h-[260px] flex-col lg:col-span-5 lg:min-h-0">
                <div className="flex min-h-0 flex-1 flex-col divide-y divide-zinc-200/80 bg-gradient-to-b from-zinc-50/80 via-white to-zinc-100/60">
                  {/* Bağlantı & QR */}
                  <div className="flex min-h-0 shrink-0 flex-col lg:min-h-[46%] lg:flex-1">
                    <div className="shrink-0 border-b border-zinc-200/80 bg-gradient-to-r from-zinc-100/90 to-zinc-50 px-4 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">Bağlantı &amp; QR</span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-5">
                      {qrCode ? (
                        <>
                          <div className="rounded-2xl border-2 border-zinc-200 bg-white p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.2)] ring-2 ring-zinc-200/90">
                            <img src={qrCode} alt="Mobil personel QR" className="h-40 w-40 sm:h-44 sm:w-44" />
                          </div>
                          <div className="w-full rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 shadow-inner">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Erişim adresi</p>
                            <p className="break-all text-center font-mono text-[11px] leading-relaxed text-zinc-900">{serverURL}</p>
                          </div>
                          <p className="flex items-center gap-2 text-center text-[11px] leading-relaxed text-zinc-500">
                            <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Telefon ile kasa aynı yerel ağda olmalıdır.
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-8">
                          <div className="h-11 w-11 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
                          <p className="text-sm font-semibold text-zinc-600">QR hazırlanıyor…</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ağ & sabit adres */}
                  <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200/80 lg:min-h-0">
                    <div className="shrink-0 border-b border-zinc-200/80 bg-gradient-to-r from-zinc-100 to-zinc-50/90 px-4 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">Ağ &amp; sabit adres</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                      {computerHostname && window.electronAPI?.setMobilePreferredHost && (
                        <div className="mb-3 rounded-xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-3 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Bu kasa</p>
                          <p className="mt-1 font-mono text-sm font-bold text-zinc-900">{computerHostname}</p>
                          <button
                            type="button"
                            onClick={() => handleUseIpForQR(computerHostname)}
                            className="mt-2 w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-black"
                          >
                            QR&apos;da bu adı kullan
                          </button>
                        </div>
                      )}
                      {window.electronAPI?.scanNetwork && (
                        <>
                          <button
                            type="button"
                            onClick={handleScanNetwork}
                            disabled={networkScanning}
                            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white py-2.5 text-xs font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
                          >
                            {networkScanning ? (
                              <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
                                Taranıyor…
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Ağı tara
                              </>
                            )}
                          </button>
                          {mobilePreferredHost && (
                            <div className="mb-3 rounded-xl border border-zinc-300 bg-zinc-100/80 px-3 py-2 text-[11px] text-zinc-800">
                              <span className="font-semibold text-zinc-600">Sabit adres:</span>{' '}
                              <span className="font-mono font-bold text-zinc-900">{mobilePreferredHost}</span>
                              <button
                                type="button"
                                onClick={handleClearPreferredHost}
                                className="ml-2 font-semibold text-zinc-800 underline decoration-zinc-400 underline-offset-2 hover:text-black"
                              >
                                Sıfırla
                              </button>
                            </div>
                          )}
                          {networkDevices.length > 0 && (
                            <ul className="space-y-2">
                              {networkDevices.map((d) => (
                                <li
                                  key={d.ip}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-[11px] shadow-sm"
                                >
                                  <div className="min-w-0">
                                    <span className="font-mono font-bold text-zinc-900">{d.ip}</span>
                                    {d.label && <span className="ml-1.5 text-zinc-500">{d.label}</span>}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleUseIpForQR(d.ip)}
                                    className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-black"
                                  >
                                    Seç
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Yeni personel — kompakt panel */}
            {showAddStaff && (
              <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-slate-900">Yeni personel</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddStaff(false);
                        setNewStaff({ name: '', surname: '', password: '' });
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">İsim</label>
                      <input
                        type="text"
                        value={newStaff.name}
                        onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-300/0 transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Ad"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Soyisim</label>
                      <input
                        type="text"
                        value={newStaff.surname}
                        onChange={(e) => setNewStaff({ ...newStaff, surname: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Soyad"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Şifre</label>
                      <input
                        type="password"
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="En az 4 karakter"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleAddStaff}
                        className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStaff(false);
                          setNewStaff({ name: '', surname: '', password: '' });
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Şifre değiştir */}
            {editingStaff && (
              <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-slate-900">Şifre güncelle</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaff(null);
                        setNewPassword('');
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="mb-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {editingStaff.name} {editingStaff.surname}
                    </span>
                  </p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleUpdatePassword();
                    }}
                    placeholder="Yeni şifre (min. 4 karakter)"
                    className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-black"
                    >
                      Uygula
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaff(null);
                        setNewPassword('');
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {managerOpsModalStaff && (
              <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                  <h4 className="text-base font-semibold text-slate-900">
                    {managerDesktopOpsMode === 'chef' ? 'Şef ataması — masaüstü şifresi' : 'Müdür işlem şifresi'}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {managerOpsModalStaff.name} {managerOpsModalStaff.surname} — masaüstü müdür işlem şifresini girin.
                  </p>
                  <input
                    type="password"
                    autoFocus
                    value={managerOpsPin}
                    onChange={(e) => setManagerOpsPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (managerDesktopOpsMode === 'chef') {
                          runSetStaffChef(managerOpsModalStaff, managerOpsPin);
                        } else {
                          runSetStaffManager(managerOpsModalStaff, managerOpsPin);
                        }
                      }
                    }}
                    placeholder="Şifre"
                    className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setManagerOpsModalStaff(null);
                        setManagerOpsPin('');
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        managerDesktopOpsMode === 'chef'
                          ? runSetStaffChef(managerOpsModalStaff, managerOpsPin)
                          : runSetStaffManager(managerOpsModalStaff, managerOpsPin)
                      }
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black"
                    >
                      Onayla
                    </button>
                  </div>
                </div>
              </div>
            )}

            {deleteConfirm && (
              <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                    <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">Personeli sil?</h4>
                  <p className="mt-2 text-sm text-slate-600">Bu işlem geri alınamaz.</p>
                  <div className="mt-6 flex justify-center gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(deleteConfirm)}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
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
            <div className="bg-white/95 backdrop-blur-xl border-2 border-fuchsia-300 theme-sultan:border-green-300 rounded-2xl shadow-2xl px-6 py-4 pointer-events-auto animate-toast-slide-down max-w-md mx-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 theme-sultan:from-green-500 to-pink-600 theme-sultan:to-emerald-600 flex items-center justify-center shadow-lg ring-4 ring-fuchsia-100 theme-sultan:ring-green-100 flex-shrink-0 animate-scale-in">
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

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </nav>
  );
};

export default Navbar;

