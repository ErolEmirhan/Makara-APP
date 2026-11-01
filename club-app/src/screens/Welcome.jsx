import { useState } from 'react';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { Watermark, Wordmark } from '../components/Brand';
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
        <section className="welcome-hero">
          <Watermark />
          <Wordmark white className="logo" />
          <span className="ring-photo">
            <ProductImage product={heroProduct} size={190} eager />
          </span>
          <h1>Her tatlı an puan kazandırır</h1>
          <p>MAKARA Club’a katıl, üyeliğe özel {formatPoints(PROGRAM.welcomeBonus)} puan hediye.</p>
        </section>

        <section className="welcome-body">
          <ul className="benefits">
            <li>
              <span><Icon name="qr" size={22} stroke={2} /></span>
              <div>
                Kodunu okut, puan kazan
                <small>Harcadığın her 1 ₺ için {PROGRAM.pointsPerTL} puan.</small>
              </div>
            </li>
            <li>
              <span><Icon name="gift" size={22} stroke={2} /></span>
              <div>
                Ücretsiz lezzetler
                <small>Puanlarını kahveden makaraya menüdeki ürünlere çevir.</small>
              </div>
            </li>
            <li>
              <span><Icon name="starFill" size={22} /></span>
              <div>
                Özel kampanyalar
                <small>Makara Çarşambası’nda 2 kat puan, doğum gününde hediye.</small>
              </div>
            </li>
          </ul>

          <div className="welcome-actions">
            <button className="btn btn-primary btn-block btn-caps" onClick={() => setAuth('signup')}>
              Üye ol
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setAuth('signin')}>
              Zaten üyeyim, giriş yap
            </button>
            {mode === 'demo' && <p className="mode-note">Demo modu · bilgiler yalnızca bu cihazda saklanır</p>}
          </div>
        </section>
      </main>
      <AuthSheet mode={auth} onModeChange={setAuth} onClose={() => setAuth(null)} />
    </div>
  );
}
