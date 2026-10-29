import Icon from './Icon';
import { BRANCHES } from '../config/loyalty';
import { formatPoints, formatTL, relativeDay, timeOf } from '../lib/format';

const ICONS = { earn: 'plus', redeem: 'gift', welcome: 'star' };

function subtitle(item) {
  const branch = BRANCHES.find((b) => b.id === item.branchId)?.name;
  const parts = [];
  if (item.type === 'earn' && item.amount) parts.push(formatTL(item.amount));
  if (item.multiplier > 1) parts.push(`${item.multiplier}x kampanya`);
  if (branch) parts.push(branch);
  parts.push(timeOf(item.createdAt));
  return parts.join(' · ');
}

function Row({ item }) {
  const negative = item.points < 0;
  return (
    <div className="activity-item">
      <span className={`activity-icon is-${item.type}`}>
        <Icon name={ICONS[item.type] || 'plus'} size={20} stroke={2} />
      </span>
      <div className="activity-main">
        <strong>{item.type === 'redeem' ? `${item.title} ödülü` : item.title}</strong>
        <span>{subtitle(item)}</span>
      </div>
      <span className={`activity-points num ${negative ? 'is-negative' : ''}`}>
        {negative ? '−' : '+'}
        {formatPoints(Math.abs(item.points))}
      </span>
    </div>
  );
}

export default function ActivityList({ items, limit, grouped = false }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) {
    return (
      <div className="activity-list">
        <p className="empty">Henüz hareket yok. İlk alışverişinde kartını okutmayı unutma!</p>
      </div>
    );
  }
  if (!grouped) {
    return (
      <div className="activity-list">
        {list.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    );
  }
  const groups = [];
  for (const item of list) {
    const label = relativeDay(item.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups.map((g) => (
    <div key={g.label}>
      <p className="day-label">{g.label}</p>
      <div className="activity-list">
        {g.items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    </div>
  ));
}
