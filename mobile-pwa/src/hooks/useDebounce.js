import { useEffect, useCallback, useRef } from 'react';

export function useDebouncedCallback(fn, delay = 250) {
  const timer = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
}

export function useDebounceEffect(fn, deps, delay = 250) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
