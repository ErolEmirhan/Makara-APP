import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SnapshotImage from '../components/SnapshotImage';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { REWARDS } from '../config/loyalty';
import { formatPoints } from '../lib/format';

const CATEGORIES = ['Tümü', ...Array.from(new Set(REWARDS.map((r) => r.category)))];

export default function Rewards({ onOpenReward }) {
  const { member } = useAppData();
  const [cat, setCat] = useState('Tümü');
  const featured = REWARDS.find((r) => r.featured);
  const list = REWARDS.filter((r) => (cat === 'Tümü' ? r !== featured : r.category === cat)).sort((a, b) => a.cost - b.cost);

  return (
    <div className="screen">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}>
        <span className="balance-pill num">
          <Icon name="star" size={16} stroke={2.2} />
          {formatPoints(member.points)}
        </span>
      </div>
      <h1 className="screen-title">Ödüller</h1>
      <p className="screen-subtitle">Puanlarını en sevdiğin lezzetlere dönüştür.</p>

      <div className="chips" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {cat === 'Tümü' && featured && (
          <motion.button
            key="featured"
            className="featured pressable"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => onOpenReward(featured)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <div className="featured-copy">
              <p className="eyebrow">İmza lezzet</p>
              <h3>{featured.name}</h3>
              <p>{featured.blurb}</p>
              <span className="cost num">{formatPoints(featured.cost)} puan</span>
            </div>
            <SnapshotImage model={featured.model} size={460} alt={featured.name} options={{ elevation: 30 }} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div className="grid" layout>
        <AnimatePresence mode="popLayout">
          {list.map((r) => {
            const pct = Math.min(1, member.points / r.cost);
            const ok = pct >= 1;
            return (
              <motion.button
                layout
                key={r.id}
                className="reward-card pressable"
                style={{ textAlign: 'left' }}
                onClick={() => onOpenReward(r)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              >
                <SnapshotImage model={r.model} variant={r.variant} alt={r.name} />
                <span className="category">{r.category}</span>
                <strong>{r.name}</strong>
                <span className={`cost num ${ok ? '' : 'is-locked'}`}>
                  {ok ? <Icon name="check" size={14} stroke={2.6} /> : <Icon name="lock" size={13} stroke={2.2} />}
                  {formatPoints(r.cost)} puan
                </span>
                <div className="mini-bar">
                  <i style={{ width: `${pct * 100}%` }} />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
