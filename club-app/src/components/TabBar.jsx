import { motion } from 'framer-motion';
import Icon from './Icon';
import { haptic } from '../lib/format';

const TABS = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'rewards', label: 'Ödüller', icon: 'gift' },
  null,
  { key: 'offers', label: 'Kampanyalar', icon: 'sparkles' },
  { key: 'profile', label: 'Hesabım', icon: 'person' },
];

export default function TabBar({ active, onChange, onCard }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map((t) =>
        t ? (
          <button
            key={t.key}
            className={`tab ${active === t.key ? 'is-active' : ''}`}
            onClick={() => {
              haptic(6);
              onChange(t.key);
            }}
            aria-current={active === t.key ? 'page' : undefined}
          >
            {active === t.key && <motion.span layoutId="tab-dot" className="tab-dot" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <Icon name={t.icon} size={25} stroke={active === t.key ? 2.1 : 1.8} />
            {t.label}
          </button>
        ) : (
          <button
            key="qr"
            className="tab-qr"
            onClick={() => {
              haptic(12);
              onCard();
            }}
            aria-label="Üyelik kartımı göster"
          >
            <Icon name="qr" size={28} stroke={2} />
          </button>
        ),
      )}
    </nav>
  );
}
