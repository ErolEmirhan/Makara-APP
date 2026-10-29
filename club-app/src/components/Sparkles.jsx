import { useMemo } from 'react';

/** Sahnede yükselen şeker tozu parıltıları. */
export default function Sparkles({ count = 18, seed = 3 }) {
  const items = useMemo(() => {
    let s = seed;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: `${8 + r() * 84}%`,
      top: `${45 + r() * 50}%`,
      '--s': `${3 + r() * 7}px`,
      '--d': `${5 + r() * 6}s`,
      '--delay': `${-r() * 10}s`,
    }));
  }, [count, seed]);
  return (
    <div className="sparkle-field" aria-hidden="true">
      {items.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}
