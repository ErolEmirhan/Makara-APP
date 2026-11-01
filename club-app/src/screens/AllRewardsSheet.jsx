import { useState } from 'react';
import Sheet from '../components/Sheet';
import RewardTile from '../components/RewardTile';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { formatPoints } from '../lib/format';

export default function AllRewardsSheet({ open, onClose, onOpenReward }) {
  const { member } = useAppData();
  const { rewards } = useCatalog();
  const [level, setLevel] = useState(null);
  const levels = [...new Set(rewards.map((r) => r.cost))].sort((a, b) => a - b);
  const list = rewards.filter((r) => level === null || r.cost === level).sort((a, b) => a.cost - b.cost);

  return (
    <Sheet open={open} onClose={onClose} title="Ödüller" tall>
      <div className="level-switch">
        <button className={level === null ? 'is-active' : ''} onClick={() => setLevel(null)}>
          Tümü
          <small>{rewards.length} ödül</small>
        </button>
        {levels.map((l) => (
          <button key={l} className={level === l ? 'is-active' : ''} onClick={() => setLevel(l)}>
            <span className="num">{formatPoints(l)}</span>
            <small>{member.points >= l ? 'Alınabilir' : `${formatPoints(l - member.points)} kaldı`}</small>
          </button>
        ))}
      </div>
      <div className="reward-grid">
        {list.map((r) => (
          <RewardTile key={r.id} reward={r} points={member.points} onOpen={onOpenReward} size={104} />
        ))}
      </div>
    </Sheet>
  );
}
