import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';

function formatClockParts(date) {
  return {
    h: String(date.getHours()).padStart(2, '0'),
    m: String(date.getMinutes()).padStart(2, '0'),
    s: String(date.getSeconds()).padStart(2, '0'),
  };
}

function formatDate(date) {
  return date.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function IdleSideAccent({ side }) {
  const lines = Array.from({ length: 7 });
  return (
    <aside className={`idle-accent idle-accent--${side}`} aria-hidden>
      <div className="idle-accent__beam" />
      {lines.map((_, i) => (
        <span
          key={i}
          className="idle-accent__tick"
          style={{ '--i': i }}
        />
      ))}
      <div className="idle-accent__nodes">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="idle-accent__node" style={{ '--i': i }} />
        ))}
      </div>
    </aside>
  );
}

const IdleScreen = ({
  isSultanBranch = false,
  isSuriciBranch = false,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [occupiedCount, setOccupiedCount] = useState(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOccupied = async () => {
      if (!window.electronAPI?.getTableOrders) return;
      try {
        const orders = await window.electronAPI.getTableOrders();
        if (cancelled) return;
        const count = (orders || []).filter((o) => o.status === 'pending').length;
        setOccupiedCount(count);
      } catch {
        if (!cancelled) setOccupiedCount(0);
      }
    };

    loadOccupied();
    const refresh = setInterval(loadOccupied, 15000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  const { h, m, s } = formatClockParts(now);
  const occupiedLabel = isSuriciBranch ? 'Dolu müşteri' : 'Dolu masa';

  return createPortal(
    <div
      className={`idle-screen ${isSultanBranch ? 'idle-screen--sultan' : ''}`}
      role="presentation"
      aria-hidden
    >
      <div className="idle-screen__base" />
      <div className="idle-screen__neon-floor" />
      <div className="idle-screen__scanline" />

      <IdleSideAccent side="left" />
      <IdleSideAccent side="right" />

      {/* Dolu masa — sağ üst köşe */}
      <div className="idle-badge">
        <span className="idle-badge__dot" />
        <div className="idle-badge__text">
          <span className="idle-badge__value tabular-nums">
            {occupiedCount == null ? '—' : occupiedCount}
          </span>
          <span className="idle-badge__label">{occupiedLabel}</span>
        </div>
      </div>

      <div className="idle-stage">
        <h1 className="idle-brand">MAKARA</h1>

        <time className="idle-clock" dateTime={now.toISOString()}>
          <span className="idle-clock__part">{h}</span>
          <span className="idle-clock__sep">:</span>
          <span className="idle-clock__part">{m}</span>
          <span className="idle-clock__sep idle-clock__sep--pulse">:</span>
          <span className="idle-clock__part idle-clock__part--sec">{s}</span>
        </time>

        <p className="idle-date capitalize">{formatDate(now)}</p>
      </div>

      <footer className="idle-footer">
        <span className="idle-footer__line" />
        <p className="idle-footer__hint">Devam etmek için dokunun veya hareket edin</p>
      </footer>
    </div>,
    document.body
  );
};

export default memo(IdleScreen);
