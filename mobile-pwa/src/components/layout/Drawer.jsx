import { useState } from 'react';

import { useAuth } from '../../context/AuthContext';

import { useBranch } from '../../context/BranchContext';

import { useApp } from '../../context/AppContext';

import { hasManagerPermission, canTransferTable, canMergeTable } from '../../config/branch';

import { LogoutModal } from '../modals/LogoutModal';

import { ChangePasswordModal } from '../modals/ChangePasswordModal';

import { TransferTableModal } from '../modals/TransferTableModal';

import { MergeTableModal } from '../modals/MergeTableModal';

import { useBackHandler } from '../../hooks/useBackButton';



export function Drawer() {

  const { staff, refreshStaffProfile } = useAuth();

  const { theme, branchKey } = useBranch();

  const { drawerOpen, setDrawerOpen, loadData, showToast } = useApp();

  const [showLogout, setShowLogout] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);

  const [showMerge, setShowMerge] = useState(false);

  const [refreshing, setRefreshing] = useState(false);



  useBackHandler(drawerOpen, () => setDrawerOpen(false));

  useBackHandler(showLogout, () => setShowLogout(false));

  useBackHandler(showChangePassword, () => setShowChangePassword(false));

  useBackHandler(showTransfer, () => setShowTransfer(false));

  useBackHandler(showMerge, () => setShowMerge(false));



  if (!drawerOpen && !showLogout && !showChangePassword && !showTransfer && !showMerge) return null;

  const isManager = hasManagerPermission(staff, branchKey);

  const showTransferAction = canTransferTable(staff);

  const showMergeAction = canMergeTable(staff, branchKey);



  const handleRefresh = async () => {

    setRefreshing(true);

    try {

      await refreshStaffProfile();

      await loadData({ force: true });

      showToast('success', 'Başarılı', 'Tüm veriler yenilendi');

    } catch {

      showToast('error', 'Hata', 'Veriler yenilenemedi');

    } finally {

      setRefreshing(false);

    }

  };



  const menuItems = [

    { icon: '🔄', label: refreshing ? 'Yenileniyor...' : 'Verileri Yenile', action: handleRefresh, disabled: refreshing },

    ...(showTransferAction

      ? [{ icon: '↔️', label: 'Masa Aktar', action: () => { setDrawerOpen(false); setShowTransfer(true); } }]

      : []),

    ...(showMergeAction

      ? [{ icon: '🔗', label: 'Masa Birleştir', action: () => { setDrawerOpen(false); setShowMerge(true); } }]

      : []),

    { icon: '🔑', label: 'Şifre Değiştir', action: () => { setDrawerOpen(false); setShowChangePassword(true); } },

    { icon: '🚪', label: 'Çıkış Yap', action: () => { setDrawerOpen(false); setShowLogout(true); }, danger: true },

  ];



  return (

    <>

      {drawerOpen && (

        <div className="fixed inset-0 z-[8000] animate-fade-in" onClick={() => setDrawerOpen(false)}>

          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div

            className="absolute top-0 left-0 bottom-0 w-[min(320px,85vw)] bg-white shadow-2xl animate-slide-up safe-top safe-bottom"

            onClick={(e) => e.stopPropagation()}

          >

            <div className={`px-6 py-8 bg-gradient-to-br ${theme.accent}`}>

              <p className="text-white/70 text-xs uppercase tracking-widest font-semibold">{theme.name}</p>

              <h2 className="text-white text-2xl font-display font-bold mt-1">

                {staff?.name} {staff?.surname}

              </h2>

              <p className="text-white/60 text-sm mt-1">

                {isManager ? 'Müdür' : staff?.is_chef ? 'Şef' : 'Personel'}

              </p>

            </div>



            <nav className="p-4 space-y-1">

              {menuItems.map((item) => (

                <button

                  key={item.label}

                  onClick={item.action}

                  disabled={item.disabled}

                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-colors active:scale-[0.98] ${

                    item.danger

                      ? 'text-red-600 hover:bg-red-50'

                      : 'text-gray-700 hover:bg-gray-50'

                  } disabled:opacity-50`}

                >

                  <span className="text-xl">{item.icon}</span>

                  <span className="font-semibold">{item.label}</span>

                </button>

              ))}

            </nav>

          </div>

        </div>

      )}



      <LogoutModal open={showLogout} onClose={() => setShowLogout(false)} />

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />

      <TransferTableModal open={showTransfer} onClose={() => setShowTransfer(false)} />

      <MergeTableModal open={showMerge} onClose={() => setShowMerge(false)} />

    </>

  );

}


