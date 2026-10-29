import { motion } from 'framer-motion';
import Stage3D from '../three/Stage3D';
import Sparkles from '../components/Sparkles';
import AnimatedNumber from '../components/AnimatedNumber';
import SnapshotImage from '../components/SnapshotImage';
import ActivityList from '../components/ActivityList';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { OFFERS, REWARDS, activeOffers, tierFor } from '../config/loyalty';
import { firstName, formatPoints, greeting, initials } from '../lib/format';

export function nextGoal(points) {
  const sorted = [...REWARDS].sort((a, b) => a.cost - b.cost);
  return sorted.find((r) => r.cost > points) || sorted[sorted.length - 1];
}

const enter = (i) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 * i, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
});

export default function Home({ onOpenCard, onOpenReward, onOpenActivity, onGoTab, onSimulate }) {
  const { member, activity, mode } = useAppData();
  const { current } = tierFor(member.lifetimePoints);
  const goal = nextGoal(member.points);
  const remaining = Math.max(0, goal.cost - member.points);
  const live = activeOffers();
  const sortedRewards = [...REWARDS].sort((a, b) => a.cost - b.cost);

  return (
    <div className="screen">
      <div className="topbar">
        <img className="wordmark" src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
        <button className="avatar" onClick={() => onGoTab('profile')} aria-label="Hesabım">
          {initials(member.name)}
        </button>
      </div>

      <motion.div className="greet" {...enter(0)}>
        <p>{greeting()},</p>
        <h1>{firstName(member.name)}</h1>
      </motion.div>

      <div className="hero">
        <div className="hero-stage">
          <div className="intro-glow" />
          <Sparkles count={14} seed={9} />
          <Stage3D model="roll" elevation={32} zoom={0.86} offsetY={0.02} />
        </div>

        <motion.section className="points-card" {...enter(1)} aria-label="Puan durumu">
          <div className="points-row">
            <div>
              <p className="eyebrow">Puanın</p>
              <div style={{ marginTop: 6 }}>
                <AnimatedNumber value={member.points} className="points-value num" />
                <span className="points-unit">puan</span>
              </div>
            </div>
            <span className="tier-pill">
              <span className="tier-gem" style={{ background: `linear-gradient(135deg, ${current.tint[0]}, ${current.tint[1]})` }} />
              {current.name}
            </span>
          </div>

          <button className="goal pressable" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenReward(goal)}>
            <SnapshotImage model={goal.model} variant={goal.variant} alt={goal.name} />
            <div className="goal-text">
              {remaining > 0 ? (
                <>
                  <strong>{formatPoints(remaining)} puan kaldı</strong>
                  <span>Sıradaki ödülün: {goal.name}</span>
                </>
              ) : (
                <>
                  <strong>{goal.name} seni bekliyor</strong>
                  <span>Puanın yetiyor, hemen kullan</span>
                </>
              )}
              <div className="bar">
                <i style={{ width: `${Math.min(100, (member.points / goal.cost) * 100)}%` }} />
              </div>
            </div>
          </button>

          <button className="btn btn-primary btn-block show-card-btn" onClick={onOpenCard}>
            <Icon name="qr" size={22} stroke={2} /> Kartımı Göster
          </button>
        </motion.section>

        {mode === 'demo' && (
          <motion.div className="demo-strip" {...enter(2)}>
            <div>
              <strong>Demo modu</strong>
              <span className="muted">Kasada alışverişi deneyimle</span>
            </div>
            <button className="btn btn-dark" onClick={onSimulate}>
              <Icon name="bolt" size={16} stroke={2} /> Simüle et
            </button>
          </motion.div>
        )}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Kampanyalar</h2>
          <button className="link-btn" onClick={() => onGoTab('offers')}>
            Tümü
          </button>
        </div>
        <div className="rail">
          {OFFERS.map((o) => (
            <button key={o.id} className={`offer-card tone-${o.tone} pressable`} style={{ textAlign: 'left' }} onClick={() => onGoTab('offers')}>
              <span className={`badge ${live.some((x) => x.id === o.id) ? 'is-live' : ''}`}>{o.badge}</span>
              <h3>{o.title}</h3>
              <p>{o.subtitle}</p>
              <SnapshotImage model={o.model} />
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>Puanınla alabileceklerin</h2>
          <button className="link-btn" onClick={() => onGoTab('rewards')}>
            Tümü
          </button>
        </div>
        <div className="rail">
          {sortedRewards.map((r) => {
            const locked = member.points < r.cost;
            return (
              <button key={r.id} className="mini-reward pressable" style={{ textAlign: 'left' }} onClick={() => onOpenReward(r)}>
                <SnapshotImage model={r.model} variant={r.variant} alt={r.name} />
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

      <section className="section" style={{ marginTop: 18 }}>
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
