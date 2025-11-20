import React, { useState, useRef, useEffect } from 'react';
import PinModal from './PinModal';
import SettingsModal from './SettingsModal';

const Navbar = ({ currentView, setCurrentView, totalItems, userType, setUserType, onRoleSplash, onProductsUpdated }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  return (
    <nav className="h-20 bg-white/90 backdrop-blur-xl border-b border-purple-200 px-8 flex items-center justify-between shadow-lg relative z-50">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
          <img src="/icon.png" alt="Makara Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-pink-500">Makara Satış Sistemi</h1>
        </div>
      </div>

      <div className="flex items-center space-x-4">
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
              onClick={() => setShowSettingsModal(true)}
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
            </div>
          )}
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <PinModal
          onClose={handlePinClose}
          onSuccess={handlePinSuccess}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onProductsUpdated={onProductsUpdated}
        />
      )}
    </nav>
  );
};

export default Navbar;

