import Sheet from '../components/Sheet';
import ProductImage from '../components/ProductImage';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { PROGRAM, activeOffers } from '../config/loyalty';

const pad = (h) => String(h).padStart(2, '0');

function isBirthday(birthday, d = new Date()) {
  if (!birthday) return false;
  const [, m, day] = birthday.split('-').map(Number);
  return m === d.getMonth() + 1 && day === d.getDate();
}

function statusOf(offer, member) {
  if (offer.id === 'dogum-gunu') {
    if (isBirthday(member.birthday)) return { active: true, text: 'Bugün senin günün' };
    return { active: false, text: member.birthday ? 'Doğum gününde geçerli' : 'Hesabım’dan doğum gününü ekle' };
  }
  if (activeOffers().some((o) => o.id === offer.id)) return { active: true, text: 'Şu an geçerli' };
  return { active: false, text: offer.hours ? `Hafta içi ${pad(offer.hours[0])}:00 – ${pad(offer.hours[1])}:00` : 'Her çarşamba' };
}

export default function OffersSheet({ open, onClose }) {
  const { member } = useAppData();
  const { offers } = useCatalog();
  return (
    <Sheet open={open} onClose={onClose} title="Kampanyalar" tall>
      <p className="muted" style={{ fontSize: 14.5 }}>Kampanyalar kasada otomatik uygulanır.</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {offers.map((o) => {
          const st = statusOf(o, member);
          return (
            <article key={o.id} className="offer-card" style={{ width: '100%' }}>
              <div>
                <span className={`badge ${st.active ? 'is-live' : ''}`}>{o.badge}</span>
                <h3>{o.title}</h3>
                <p>{o.subtitle}</p>
                <p style={{ marginTop: 8, fontWeight: 600, color: st.active ? 'var(--success)' : 'var(--ink-2)' }}>{st.text}</p>
              </div>
              <ProductImage product={o.product} size={88} />
            </article>
          );
        })}
      </div>

      <h2 className="menu-section-title" style={{ fontSize: 17 }}>Nasıl çalışır?</h2>
      <ol style={{ margin: '8px 0 0', paddingLeft: 20, display: 'grid', gap: 8, fontSize: 14.5 }} className="muted">
        <li>Ödeme yaparken uygulamadaki kodunu kasada okut.</li>
        <li>Her 1 ₺ harcamana {PROGRAM.pointsPerTL} puan yüklenir; kampanya ve seviye bonusları otomatik eklenir.</li>
        <li>Ödüller’den ürününü seç, ödül kodunu kasada okut.</li>
      </ol>
    </Sheet>
  );
}
