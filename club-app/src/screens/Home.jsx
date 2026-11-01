import Icon from '../components/Icon';
import AnimatedNumber from '../components/AnimatedNumber';
import ProductImage, { categoryIcon } from '../components/ProductImage';
import RewardTile from '../components/RewardTile';
import { Watermark, Wordmark } from '../components/Brand';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { activeOffers, tierFor } from '../config/loyalty';
import { firstName, formatPoints, greeting } from '../lib/format';

export function nextGoal(rewards, points) {
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  return sorted.find((r) => r.cost > points) || sorted[sorted.length - 1] || null;
}

/** Starbucks'taki bardaklı ilerleme halkası: ortada sıradaki ödülün fotoğrafı. */
function GoalRing({ goal, points }) {
  const size = 136;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal ? Math.min(1, points / goal.cost) : 0;
  return (
    <div className="progress-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <ProductImage product={goal?.product} size={100} eager />
      {goal && (
        <small className="num">
          {formatPoints(Math.min(points, goal.cost))}/{formatPoints(goal.cost)}
        </small>
      )}
    </div>
  );
}

export default function Home({ onOpenCode, onOpenReward, onOpenAllRewards, onOpenTier, onOpenBranches, onGoTab, onSimulate }) {
  const { member, mode } = useAppData();
  const { rewards, offers, categoryName } = useCatalog();
  const { current } = tierFor(member.lifetimePoints);
  const goal = nextGoal(rewards, member.points);
  const readyCount = rewards.filter((r) => r.cost <= member.points).length;
  const live = activeOffers();
  const sortedRewards = [...rewards].sort((a, b) => a.cost - b.cost);

  return (
    <div className="page">
      <header className="brand-header">
        <Watermark />
        <div className="header-row">
          <h1>
            {greeting()} {firstName(member.name)}
          </h1>
          <div className="header-actions">
            <button className="header-icon" onClick={() => onGoTab('more')} aria-label="Hesabım">
              <Icon name="user" size={26} stroke={1.7} />
            </button>
          </div>
        </div>

        <div className="balance-row">
          <div>
            <p className="balance-label">Puan bakiyesi</p>
            <p className="balance-value num">
              <Icon name="starFill" size={26} style={{ color: '#FFD3E5' }} />
              <AnimatedNumber value={member.points} />
            </p>
            <p className="balance-sub">
              {readyCount > 0 ? `${readyCount} ödül hazır` : goal ? `${formatPoints(goal.cost - member.points)} puan kaldı` : ''}
            </p>
          </div>
          <GoalRing goal={goal} points={member.points} />
          <button className="tier-box" onClick={onOpenTier}>
            <span className="balance-label">Seviyem</span>
            <span className="tier-badge">
              <Icon name="starFill" size={22} />
              <span>{current.name}</span>
            </span>
          </button>
        </div>
      </header>

      <div className="sheet-top pad">
        <section className="member-card">
          <span className="pill">{current.name} üye</span>
          <p>Ödeme yaparken kodunu kasada okut, harcadığın her 1 ₺ için puan kazan.</p>
          <div className="member-card-row">
            <span className="mini-card">
              <Wordmark white />
              <i />
            </span>
            <div>
              <span className="label">Puanın</span>
              <strong className="num">{formatPoints(member.points)}</strong>
            </div>
          </div>
          <button className="btn btn-primary btn-block btn-caps" onClick={onOpenCode}>
            Kodumu göster
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
            <h2 className="is-brand">Senin İçin</h2>
            <button className="see-all" onClick={() => onGoTab('club')}>
              Tümü <Icon name="arrowRight" size={16} stroke={2.2} />
            </button>
          </div>
          <div className="rail">
            {offers.map((o) => (
              <button key={o.id} className="story-card" onClick={() => onGoTab('club')}>
                <Watermark />
                {o.product?.image ? (
                  <span className="bg-product">
                    <ProductImage product={o.product} size={190} />
                  </span>
                ) : (
                  <span className="bg-icon">
                    <Icon name={categoryIcon(categoryName(o.product?.categoryId))} size={150} stroke={1.2} />
                  </span>
                )}
                <div>
                  <span className={`pill ${live.some((x) => x.id === o.id) ? 'is-success' : 'is-soft'}`}>{o.badge}</span>
                  <h3>{o.title}</h3>
                  <p>{o.subtitle}</p>
                </div>
              </button>
            ))}
            <button className="story-card" onClick={onOpenBranches}>
              <img className="bg" src={`${import.meta.env.BASE_URL}branch-surici.jpg`} alt="" />
              <div>
                <span className="pill is-soft">Şubelerimiz</span>
                <h3>Havzan ve Suriçi’nde seni bekliyoruz</h3>
                <p>Yol tarifi için dokun.</p>
              </div>
            </button>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Ödüller</h2>
            <button className="see-all" onClick={onOpenAllRewards}>
              Hepsini gör <Icon name="arrowRight" size={16} stroke={2.2} />
            </button>
          </div>
          <div className="rail">
            {sortedRewards.map((r) => (
              <RewardTile key={r.id} reward={r} points={member.points} onOpen={onOpenReward} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
