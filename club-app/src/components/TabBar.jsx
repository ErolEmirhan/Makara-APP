import Icon from './Icon';
import { haptic } from '../lib/format';

const TABS = [
  { key: 'home', label: 'Ana Sayfa', icon: 'starFill', iconIdle: 'star' },
  { key: 'menu', label: 'Menü', icon: 'cup' },
  null,
  { key: 'club', label: 'Ödüller', icon: 'gift' },
  { key: 'more', label: 'Diğer', icon: 'more' },
];

/** Starbucks düzeni: ortada büyük, yükseltilmiş QR butonu. */
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
            <Icon name={active === t.key || !t.iconIdle ? t.icon : t.iconIdle} size={27} stroke={1.7} />
            {t.label}
          </button>
        ) : (
          <button
            key="code"
            className="tab-qr"
            onClick={() => {
              haptic(10);
              onCode();
            }}
            aria-label="Kodumu göster"
          >
            <Icon name="qr" size={32} stroke={1.9} />
          </button>
        ),
      )}
    </nav>
  );
}
