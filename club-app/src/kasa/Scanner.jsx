import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Icon from '../components/Icon';

/**
 * Kamera ile QR okuma. Destekleyen tarayıcılarda yerleşik BarcodeDetector,
 * diğerlerinde (iOS Safari dahil) jsQR kullanılır.
 */
export default function Scanner({ active, onResult, onError }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!active) return undefined;
    let stream = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;

    const finish = (text) => {
      if (stopped) return;
      stopped = true;
      try {
        navigator.vibrate?.(30);
      } catch {
        /* */
      }
      onResult(text);
    };

    const scan = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) return finish(codes[0].rawValue);
          } else {
            const w = 480;
            const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) return finish(code.data);
          }
        } catch {
          /* bir sonraki karede tekrar dene */
        }
      }
      raf = requestAnimationFrame(scan);
    };

    (async () => {
      try {
        setStatus('starting');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        raf = requestAnimationFrame(scan);
      } catch {
        setStatus('error');
        onError?.('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin veya kodu elle girin.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className={`kasa-scanner ${active ? 'is-active' : ''}`}>
      <video ref={videoRef} playsInline muted />
      {active && status === 'scanning' && (
        <div className="kasa-scan-frame" aria-hidden="true">
          <span />
        </div>
      )}
      {(!active || status !== 'scanning') && (
        <div className="kasa-scanner-idle">
          <Icon name="camera" size={34} />
          <p>{status === 'starting' ? 'Kamera açılıyor…' : 'Müşterinin QR kodunu okutmak için kamerayı açın'}</p>
        </div>
      )}
    </div>
  );
}
