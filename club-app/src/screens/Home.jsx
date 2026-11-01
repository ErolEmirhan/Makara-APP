import Icon from '../components/Icon';
import AnimatedNumber from '../components/AnimatedNumber';
import ProductImage from '../components/ProductImage';
import ActivityList from '../components/ActivityList';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { activeOffers, tierFor } from '../config/loyalty';
import { firstName, formatPoints, initials } from '../lib/format';

export function nextGoal(rewards, points) {
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  return sorted.find((r) => r.cost > points) || sorted[sorted.length - 1] || null;
}

export default function Home({ onOpenCode, onOpenReward, onOpenProduct, onOpenActivity, onOpenOffers, onGoTab, onSimulate }) {
  const { member, activity, mode } = useAppData();
  const { rewards, offers, categories } = useCatalog();
  const { current } = tierFor(member.lifetimePoints);
  const goal = nextGoal(rewards, member.points);
  const live = activeOffers();
  const sortedRewards = [...rewards].sort((a, b) => a.cost - b.cost);

  return (
    <div className="screen">
      <div className="topbar">
        <img className="wordmark" src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
        <button className="avatar" onClick={() => onGoTab('profile')} aria-label="Hesabım">
          {initials(member.name)}
        </button>
      </div>

      <h1 className="hello">Merhaba, {firstName(member.name)}</h1>

      <section className="points-card" aria-label="Puan durumu">
        <div className="points-head">
          <span>MAKARA Club</span>
          <span>{current.name} üye</span>
        </div>
        <div className="points-value num">
          <AnimatedNumber value={member.points} />
          <small>puan</small>
        </div>
        {goal && (
          <>
            <p className="points-goal">
              {member.points >= goal.cost
                ? `${goal.name} için puanın yeterli`
                : `Sıradaki ödül: ${goal.name} · ${formatPoints(goal.cost - member.points)} puan kaldı`}
            </p>
            <div className="bar">
              <i style={{ width: `${Math.min(100, (member.points / goal.cost) * 100)}%` }} />
            </div>
          </>
        )}
        <button className="btn btn-light btn-block" onClick={onOpenCode}>
          <Icon name="qr" size={20} stroke={2} /> Kodumu göster
        </button>
      </section>

      {mode === 'demo' && (
        <div className="demo-strip">
          <div>
            <strong>Demo modu</strong>
            <span className="muted">Kasada alışverişi dene</span>
          </div>
          <button className="btn btn-dark btn-sm" onClick={onSimulate}>
            Alışveriş yap
          </button>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Kampanyalar</h2>
          <button className="link-btn" onClick={onOpenOffers}>
            Tümü
          </button>
        </div>
        <div className="rail">
          {offers.map((o) => (
            <button key={o.id} className="offer-card" onClick={onOpenOffers}>
              <div>
                <span className={`badge ${live.some((x) => x.id === o.id) ? 'is-live' : ''}`}>{o.badge}</span>
                <h3>{o.title}</h3>
                <p>{o.subtitle}</p>
              </div>
              <ProductImage product={o.product} size={92} />
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Ödüller</h2>
          <button className="link-btn" onClick={() => onGoTab('rewards')}>
            Tümü
          </button>
        </div>
        <div className="rail">
          {sortedRewards.map((r) => {
            const locked = member.points < r.cost;
            return (
              <button key={r.id} className="tile" onClick={() => onOpenReward(r)}>
                <ProductImage product={r.product} size={96} />
                <strong>{r.name}</strong>
                <span className={`cost num ${locked ? 'is-locked' : ''}`}>
                  {locked && <Icon name="lock" size={13} stroke={2.2} />}
                  {formatPoints(r.cost)} puan
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Menü</h2>
            <button className="link-btn" onClick={() => onGoTab('menu')}>
              Tümünü gör
            </button>
          </div>
          <div className="cat-grid">
            {categories.slice(0, 6).map((c) => (
              <button key={c.id} className="cat-tile" onClick={() => onGoTab('menu', c.id)}>
                <ProductImage product={c.products.find((p) => p.image) || c.products[0]} size={44} />
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Son hareketler</h2>
          {activity.length > 3 && (
            <button className="link-btn" onClick={onOpenActivity}>
              Tümü
            </button>
          )}
        </div>
        <ActivityList items={activity} limit={3} />
      </section>
    </div>
  );
}
