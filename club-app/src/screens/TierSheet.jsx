import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { PROGRAM, TIERS, tierFor } from '../config/loyalty';
import { formatPoints } from '../lib/format';

export default function TierSheet({ open, onClose }) {
  const { member } = useAppData();
  const { current, next, progress } = tierFor(member?.lifetimePoints || 0);
  return (
    <Sheet open={open} onClose={onClose} title="Seviyem ve kazanım" tall>
      <section className="tier-card">
        <p className="eyebrow">Seviyen</p>
        <h3>{current.name} üye</h3>
        <ul>
          {current.perks.map((p) => (
            <li key={p}>
              <Icon name="check" size={16} stroke={2.6} /> {p}
            </li>
          ))}
        </ul>
        {next ? (
          <>
            <div className="tier-track">
              <span>{current.name}</span>
              <span className="num">
                {next.name} · {formatPoints(next.min - member.lifetimePoints)} puan kaldı
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          </>
        ) : (
          <p style={{ marginTop: 14, fontWeight: 700 }}>En yüksek seviyedesin.</p>
        )}
      </section>

      <div className="info-block">
        <h3>Nasıl puan kazanırım?</h3>
        <p>Ödeme yaparken uygulamadaki kodunu kasada okut. Harcadığın her 1 ₺ için {PROGRAM.pointsPerTL} puan kazanırsın; kampanya ve seviye bonusları otomatik eklenir.</p>
      </div>
      <div className="info-block">
        <h3>Ödülümü nasıl kullanırım?</h3>
        <p>Ödüller’den ürününü seç, “Ödülü kullan” ile oluşan kodu {PROGRAM.redeemWindowMinutes} dakika içinde kasada okut.</p>
      </div>

      <div className="info-block">
        <h3>Seviyeler</h3>
      </div>
      <div className="activity-list" style={{ marginTop: 10 }}>
        {TIERS.map((t) => (
          <div key={t.key} className="activity-item">
            <span className="activity-icon">
              <Icon name="starFill" size={18} />
            </span>
            <div className="activity-main">
              <strong>{t.name}</strong>
              <span>{t.min === 0 ? 'Üye olur olmaz' : `${formatPoints(t.min)} toplam puandan itibaren`}</span>
            </div>
            <span className="badge is-soft">{t.bonus ? `+%${Math.round(t.bonus * 100)} puan` : 'Başlangıç'}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
