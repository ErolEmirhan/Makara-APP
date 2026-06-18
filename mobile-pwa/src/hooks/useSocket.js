import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function useSocket(branchKey) {
  const socketRef = useRef(null);
  const { staff, forceLogout } = useAuth();
  const {
    tables, setTables, products, setProducts,
    selectedTable, loadExistingOrders, loadData, showToast,
    selectedCategory,
  } = useApp();

  useEffect(() => {
    if (!staff) return;

    const url = getSocketUrl();
    if (!url) return;

    const socket = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const debounceTimers = {};
    const debounce = (key, fn, delay = 200) => {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, delay);
    };

    socket.on('table-update', (data) => {
      debounce(`table-${data.tableId}`, async () => {
        setTables((prev) =>
          prev.map((t) => (t.id === data.tableId ? { ...t, hasOrder: data.hasOrder } : t))
        );
        try {
          const updated = await fetch(`${getSocketUrl()}/api/tables`).then((r) => r.json());
          if (Array.isArray(updated)) setTables(updated);
        } catch { /* ignore */ }
        if (selectedTable?.id === data.tableId) {
          loadExistingOrders(data.tableId);
        }
      });
    });

    socket.on('new-order', (data) => {
      debounce(`order-${data.tableId}`, () => {
        if (selectedTable?.id === data.tableId) {
          loadExistingOrders(data.tableId);
        }
      });
    });

    socket.on('staff-deleted', (data) => {
      forceLogout(data.message || 'Hesabınız silindi.');
      showToast('error', 'Hesap Silindi', data.message || 'Hesabınız silindi.');
    });

    socket.on('broadcast-message', (data) => {
      window.dispatchEvent(new CustomEvent('makara-broadcast', { detail: data }));
    });

    socket.on('product-stock-update', (data) => {
      debounce(`stock-${data.productId}`, () => {
        setProducts((prev) => {
          const idx = prev.findIndex((p) => p.id === data.productId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], stock: data.stock, trackStock: data.trackStock };
          return next;
        });
      }, 300);
    });

    return () => {
      socket.disconnect();
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  }, [staff, branchKey, selectedTable?.id, setTables, setProducts, loadExistingOrders, loadData, forceLogout, showToast]);

  return socketRef;
}
