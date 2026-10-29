import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import Icon from './Icon';

/** iOS tarzı alt sayfa: aşağı sürükleyerek kapanır, arka planı karartır. */
export default function Sheet({ open, onClose, children, title, tall = false, dark = false, className = '' }) {
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root" key="sheet">
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.div
            className={`sheet ${tall ? 'is-tall' : ''} ${dark ? 'is-dark' : ''} ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose?.();
            }}
          >
            <div className="sheet-grabber-zone" onPointerDown={(e) => controls.start(e)}>
              <span className="sheet-grabber" />
            </div>
            {title !== undefined && (
              <div className="sheet-header" onPointerDown={(e) => controls.start(e)}>
                <h2>{title}</h2>
                <button className="icon-btn" onClick={onClose} aria-label="Kapat">
                  <Icon name="close" size={18} stroke={2.2} />
                </button>
              </div>
            )}
            <div className="sheet-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
