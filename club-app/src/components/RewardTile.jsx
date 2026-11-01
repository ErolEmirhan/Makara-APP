import ProductImage from './ProductImage';
import Icon from './Icon';
import { formatPoints } from '../lib/format';

/** McDonald's ödül kartı düzeni: degrade halkalı ürün görseli, puan rozeti, ürün adı. */
export default function RewardTile({ reward, points, onOpen, size = 112 }) {
  const locked = points < reward.cost;
  return (
    <button className={`reward-tile ${locked ? 'is-locked' : ''}`} onClick={() => onOpen(reward)}>
      <span className="ring-photo">
        <ProductImage product={reward.product} size={size} />
      </span>
      <span className="points-pill num">
        {locked && <Icon name="lock" size={14} stroke={2.4} />}
        {formatPoints(reward.cost)} puan
      </span>
      <strong>{reward.name}</strong>
    </button>
  );
}
