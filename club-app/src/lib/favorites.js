import { useCallback, useEffect, useState } from 'react';

/** Favori ürünler: yalnızca bu cihazda, üye bazında saklanır. */
const EVENT = 'makara-favorites';
const keyFor = (memberId) => `makara-fav-${memberId || 'guest'}`;

function read(memberId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(keyFor(memberId)) || '[]'));
  } catch {
    return new Set();
  }
}

export function useFavorites(memberId) {
  const [ids, setIds] = useState(() => read(memberId));
  useEffect(() => {
    const sync = () => setIds(read(memberId));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [memberId]);
  const toggle = useCallback(
    (id) => {
      const next = read(memberId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(keyFor(memberId), JSON.stringify([...next]));
      } catch {
        /* depolama kapalı */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [memberId],
  );
  return [ids, toggle];
}
