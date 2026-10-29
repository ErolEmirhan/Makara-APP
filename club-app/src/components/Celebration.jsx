import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Stage3D from '../three/Stage3D';
import AnimatedNumber from './AnimatedNumber';
import { formatPoints, haptic } from '../lib/format';

const COLORS = ['#EA368D', '#FF8CC4', '#FFC9E1', '#FFFFFF', '#B8126A', '#F5D08A'];

/** Kasadan puan yüklendiğinde: dönen 3D jeton + konfeti + sayaç. */
export default function Celebration({ data, onDone }) {
  useEffect(() => {
    if (!data) return undefined;
    haptic([10, 40, 10, 40, 30]);
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [data, onDone]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        background: COLORS[i % COLORS.length],
        '--x': `${((i * 53) % 120) - 60}px`,
        '--r': `${360 + ((i * 97) % 720)}deg`,
        '--d': `${2.2 + ((i * 13) % 14) / 10}s`,
        '--delay': `${((i * 7) % 10) / 20}s`,
        width: i % 3 ? 8 : 12,
        height: i % 2 ? 14 : 8,
        boxShadow: COLORS[i % COLORS.length] === '#FFFFFF' ? '0 0 0 1px rgba(234,54,141,.2)' : undefined,
      })),
    [data?.key],
  );

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div className="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone} role="status">
          <div className="confetti" aria-hidden="true">
            {pieces.map((style, i) => (
              <i key={i} style={style} />
            ))}
          </div>
          <motion.div
            className="celebrate-inner"
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          >
            <div className="celebrate-stage">
              <Stage3D model="coin" elevation={8} zoom={0.9} spin={3.2} interactive={false} float />
            </div>
            <h2 className="num gradient-text">
              +<AnimatedNumber value={data.delta} duration={1600} />
            </h2>
            <p>puan hesabına eklendi · toplam {formatPoints(data.total)}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
