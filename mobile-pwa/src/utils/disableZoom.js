/** Sayfa genelinde çift dokunma / pinch zoom'u kapatır (profil kırpma hariç). */
export function lockViewportZoom() {
  const allowPinch = (target) => target?.closest?.('[data-allow-pinch-zoom]');

  const blockGesture = (event) => {
    if (allowPinch(event.target)) return;
    event.preventDefault();
  };

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });

  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (allowPinch(event.target)) return;
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false }
  );
}
