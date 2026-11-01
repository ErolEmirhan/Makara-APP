import Icon from './Icon';
import { haptic } from '../lib/format';

const TABS = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'menu', label: 'Menü', icon: 'menu' },
  null,
  { key: 'rewards', label: 'Ödüller', icon: 'gift' },
  { key: 'profile', label: 'Hesabım', icon: 'person' },
];

export default function TabBar({ active, onChange, onCode }) {
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
            <Icon name={t.icon} size={24} stroke={active === t.key ? 2.1 : 1.8} />
            {t.label}
          </button>
        ) : (
          <button
            key="code"
            className="tab-code"
            onClick={() => {
              haptic(10);
              onCode();
            }}
            aria-label="Üyelik kodumu göster"
          >
            <span>
              <Icon name="qr" size={24} stroke={2} />
            </span>
            <span>Kodum</span>
          </button>
        ),
      )}
    </nav>
  );
}
