import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import QRCode from '../components/QRCode';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { tierFor } from '../config/loyalty';
import { formatMemberCode, memberQrPayload } from '../data/codes';
import { formatPoints } from '../lib/format';

/** Apple Wallet hissiyatında üyelik kartı: parmak/fare ile eğilir, ışık süzülür. */
export default function MemberPass({ open, onClose }) {
  const { member } = useAppData();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [9, -9]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(px, [0, 1], [-11, 11]), { stiffness: 220, damping: 22 });
  const gx = useTransform(px, [0, 1], ['0%', '100%']);
  const gy = useTransform(py, [0, 1], ['0%', '100%']);
  const shine = useMotionTemplate`radial-gradient(70% 55% at ${gx} ${gy}, rgba(255,255,255,0.75), transparent 65%)`;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  const { current } = tierFor(member?.lifetimePoints);

  return createPortal(
    <AnimatePresence>
      {open && member && (
        <motion.div className="pass-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <button className="icon-btn pass-close" onClick={onClose} aria-label="Kapat">
            <Icon name="close" size={18} stroke={2.2} />
          </button>
          <motion.div
            className="pass-wrap"
            initial={{ y: 80, scale: 0.9, rotateX: 25, opacity: 0 }}
            animate={{ y: 0, scale: 1, rotateX: 0, opacity: 1 }}
            exit={{ y: 60, scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div className="pass" style={{ rotateX: rx, rotateY: ry }} onPointerMove={move} onPointerLeave={reset}>
              <motion.div className="pass-shine" style={{ background: shine }} />
              <div className="pass-top">
                <img src={`${import.meta.env.BASE_URL}wordmark-white.png`} alt="MAKARA" />
                <div style={{ textAlign: 'right' }}>
                  <p className="pass-label">Puan</p>
                  <p className="pass-value num" style={{ fontSize: 24 }}>{formatPoints(member.points)}</p>
                </div>
              </div>
              <div className="pass-fields">
                <div>
                  <p className="pass-label">Üye</p>
                  <p className="pass-value">{member.name}</p>
                </div>
                <div>
                  <p className="pass-label">Seviye</p>
                  <p className="pass-value">{current.name}</p>
                </div>
              </div>
              <div className="pass-qr">
                <QRCode value={memberQrPayload(member.memberCode)} size={216} />
                <span className="pass-code">{formatMemberCode(member.memberCode)}</span>
              </div>
            </motion.div>
            <p className="pass-hint">Kasada okut, puanların anında yüklensin.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
