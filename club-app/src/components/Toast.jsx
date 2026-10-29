import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);
  const show = useCallback((message, icon = null) => {
    clearTimeout(timer.current);
    setToast({ message, icon, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="toast"
            role="status"
            initial={{ opacity: 0, y: -24, x: '-50%', scale: 0.92 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: -24, x: '-50%', scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {toast.icon}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
