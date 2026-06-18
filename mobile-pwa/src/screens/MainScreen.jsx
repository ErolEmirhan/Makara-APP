import { useEffect, useState } from 'react';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { startStaffPresence, stopStaffPresence } from '../services/firebaseService';
import { AppHeader } from '../components/layout/AppHeader';
import { Drawer } from '../components/layout/Drawer';
import { Cart } from '../components/layout/Cart';
import { TableScreen } from '../components/tables/TableScreen';
import { OrderScreen } from '../components/order/OrderScreen';
import { ToastContainer } from '../components/ui/Toast';
import { BroadcastModal } from '../components/modals/BroadcastModal';
import { useAndroidBackNavigation, useBackHandler } from '../hooks/useBackButton';

export function MainScreen() {
  const { theme, branchKey } = useBranch();
  const { staff } = useAuth();
  const { screen, loadData, toasts } = useApp();
  const [broadcast, setBroadcast] = useState(null);

  useAndroidBackNavigation();
  useBackHandler(!!broadcast, () => setBroadcast(null));

  useEffect(() => {
    if (staff && branchKey) loadData();
  }, [staff, branchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!staff || !branchKey) return;
    startStaffPresence(staff, branchKey);
    return () => stopStaffPresence(true);
  }, [staff, branchKey]);

  useEffect(() => {
    const handler = (e) => setBroadcast(e.detail);
    window.addEventListener('makara-broadcast', handler);
    return () => window.removeEventListener('makara-broadcast', handler);
  }, []);

  return (
    <div className={`min-h-dvh bg-gray-50 ${theme.isSultan ? 'theme-sultan' : ''}`}>
      <AppHeader />
      <main className="pt-[68px]">
        {screen === 'tables' ? <TableScreen /> : <OrderScreen />}
      </main>
      <Cart />
      <Drawer />
      <ToastContainer toasts={toasts} />
      <BroadcastModal
        open={!!broadcast}
        onClose={() => setBroadcast(null)}
        message={broadcast?.message}
        date={broadcast?.date}
        time={broadcast?.time}
      />
    </div>
  );
}
