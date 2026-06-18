import { useEffect, useId, useRef } from 'react';
import { useApp } from '../context/AppContext';

/** Açık panel/modal varken geri tuşunda çalışır */
export function useBackHandler(active, onBack) {
  const { registerBackHandler } = useApp();
  const id = useId();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    return registerBackHandler(id, () => {
      onBackRef.current();
      return true;
    });
  }, [active, id, registerBackHandler]);
}

/** Android geri tuşunu uygulama içi gezinmeye yönlendirir */
export function useAndroidBackNavigation() {
  const {
    drawerOpen,
    setDrawerOpen,
    screen,
    goBackToTables,
    runBackHandlers,
  } = useApp();

  useEffect(() => {
    const trapHistory = () => {
      try {
        history.pushState({ makaraNav: true }, '');
      } catch {
        /* ignore */
      }
    };

    const onPopState = () => {
      if (runBackHandlers()) {
        trapHistory();
        return;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        trapHistory();
        return;
      }
      if (screen === 'order') {
        goBackToTables();
        trapHistory();
        return;
      }
      trapHistory();
    };

    trapHistory();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [drawerOpen, setDrawerOpen, screen, goBackToTables, runBackHandlers]);
}
