import { useState } from 'react';
import Sheet from '../components/Sheet';
import { useAppData } from '../data/AppData';
import { calculateEarn } from '../config/loyalty';
import { formatPoints, formatTL } from '../lib/format';

const PRESETS = [95, 180, 260, 540];

/** Yalnızca demo modunda: kasadaki alışverişi bu cihazdan taklit eder. */
export default function SimulateSheet({ open, onClose }) {
  const { member, backend } = useAppData();
  const [amount, setAmount] = useState(180);
  const [busy, setBusy] = useState(false);
  const earn = calculateEarn(amount, member?.lifetimePoints || 0);

  const pay = async () => {
    setBusy(true);
    try {
      await backend.awardPoints({ memberId: member.id, amount, branchId: 'havzan' });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Alışveriş simülasyonu">
      <p className="muted" style={{ fontSize: 14.5 }}>
        Gerçekte bu adımı kasiyer, QR kodunu okutup tutarı girerek yapar.
      </p>
      <div className="chips" style={{ margin: '16px 0', padding: 0, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button key={p} className={`chip ${amount === p ? 'is-active' : ''}`} onClick={() => setAmount(p)}>
            {formatTL(p)}
          </button>
        ))}
      </div>
      <div className="field-group">
        <div className="field">
          <label htmlFor="sim-amount">Tutar (₺)</label>
          <input id="sim-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(',', '.')) || 0)} />
        </div>
      </div>
      <div className="cost-row">
        <div>
          <p className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Kazanılacak</p>
          <span className="num" style={{ color: 'var(--brand)' }}>+{formatPoints(earn.total)}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13 }} className="muted">
          {earn.multiplier > 1 && <div>{earn.multiplier}x kampanya</div>}
          {earn.tierBonus > 0 && <div>+%{Math.round(earn.tierBonus * 100)} seviye bonusu</div>}
          {earn.multiplier === 1 && !earn.tierBonus && <div>1 ₺ = 1 puan</div>}
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={pay} disabled={busy || earn.total <= 0}>
        {busy ? <span className="spinner" /> : 'Kasada öde ve puan kazan'}
      </button>
    </Sheet>
  );
}
