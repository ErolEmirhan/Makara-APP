import { useEffect, useRef, useState } from 'react';
import { formatPoints } from '../lib/format';

const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Değer değiştiğinde sayarak ilerleyen rakam (puan sayacı). */
export default function AnimatedNumber({ value = 0, duration = 1200, format = formatPoints, className }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return undefined;
    const tick = (now) => {
      const k = ease(Math.min(1, (now - start) / duration));
      const v = a + (b - a) * k;
      setShown(v);
      from.current = v;
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span className={className}>{format(shown)}</span>;
}
