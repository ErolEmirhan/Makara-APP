import { useState, useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'touchmove',
  'wheel',
  'pointerdown',
  'scroll',
];

/** Hareketsizlik sonrası idle ekranı; hareket gelince anında kapanır. */
export function useIdleTimer(timeoutMs = 30000, enabled = true) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef(null);
  const isIdleRef = useRef(false);

  const onActivity = useCallback(() => {
    if (!enabled) return;

    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
    }, timeoutMs);
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current);
      isIdleRef.current = false;
      setIsIdle(false);
      return undefined;
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    });
    onActivity();

    return () => {
      clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, onActivity, { capture: true });
      });
    };
  }, [enabled, onActivity]);

  return isIdle;
}
