import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { formatPoints } from '../lib/format';

/** McDonald's tarzı: ödüller puan seviyelerine göre gruplanır. */
export default function Rewards({ onOpenReward }) {
  const { member } = useAppData();
  const { rewards } = useCatalog();
  const levels = [...new Set(rewards.map((r) => r.cost))].sort((a, b) => a - b);

  return (
    <div className="screen">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}>
        <span className="balance num">
          <Icon name="star" size={16} stroke={2.2} />
          {formatPoints(member.points)} puan
        </span>
      </div>
      <h1 className="page-title">Ödüller</h1>
      <p className="page-sub">Puanlarını menüdeki ürünlere dönüştür. Ödülü seç, kodunu kasada okut.</p>

      {levels.map((cost) => {
        const ok = member.points >= cost;
        return (
          <section key={cost} className="level">
            <div className="level-head">
              <h2 className="num">{formatPoints(cost)} puan</h2>
              {ok ? (
                <span className="badge is-soft">
                  <Icon name="check" size={13} stroke={2.6} /> Alınabilir
                </span>
              ) : (
                <span className="badge is-gray num">{formatPoints(cost - member.points)} puan kaldı</span>
              )}
            </div>
            <div className="reward-grid">
              {rewards
                .filter((r) => r.cost === cost)
                .map((r) => (
                  <button key={r.id} className={`reward-card ${ok ? '' : 'is-locked'}`} onClick={() => onOpenReward(r)}>
                    <ProductImage product={r.product} size={104} />
                    <strong>{r.name}</strong>
                  </button>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
