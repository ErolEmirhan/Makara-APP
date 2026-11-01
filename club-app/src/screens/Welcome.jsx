import { useState } from 'react';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import AuthSheet from './AuthSheet';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { PROGRAM } from '../config/loyalty';
import { formatPoints } from '../lib/format';

export default function Welcome() {
  const { mode } = useAppData();
  const { heroProduct } = useCatalog();
  const [auth, setAuth] = useState(null);

  return (
    <div className="app-shell">
      <main className="welcome">
        <div className="welcome-top">
          <img src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
        </div>
        <div className="welcome-hero">
          <ProductImage product={heroProduct} size={210} eager />
        </div>

        <div className="welcome-copy">
          <h1>MAKARA Club</h1>
          <p>Her alışverişinde puan kazan, puanlarını en sevdiğin ürünlere dönüştür.</p>
        </div>

        <ul className="benefits">
          <li>
            <span><Icon name="qr" size={20} stroke={2} /></span>
            <div>
              Her 1 ₺ için {PROGRAM.pointsPerTL} puan
              <small>Ödeme yaparken kodunu okut, puanın anında yüklensin.</small>
            </div>
          </li>
          <li>
            <span><Icon name="gift" size={20} stroke={2} /></span>
            <div>
              Ücretsiz ürünler
              <small>Kahveden makaraya, puanlarını menüdeki ürünlere çevir.</small>
            </div>
          </li>
          <li>
            <span><Icon name="star" size={20} stroke={2} /></span>
            <div>
              Üyeliğe özel {formatPoints(PROGRAM.welcomeBonus)} puan
              <small>Kampanya günlerinde 2 kata kadar puan kazan.</small>
            </div>
          </li>
        </ul>

        <div className="welcome-actions">
          <button className="btn btn-primary btn-block" onClick={() => setAuth('signup')}>
            Üye ol
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setAuth('signin')}>
            Giriş yap
          </button>
          {mode === 'demo' && <p className="mode-note">Demo modu · bilgiler yalnızca bu cihazda saklanır</p>}
        </div>
      </main>
      <AuthSheet mode={auth} onModeChange={setAuth} onClose={() => setAuth(null)} />
    </div>
  );
}
