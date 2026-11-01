import Icon from '../components/Icon';
import QRCode from '../components/QRCode';
import ProductImage from '../components/ProductImage';
import RewardTile from '../components/RewardTile';
import { Watermark, Wordmark } from '../components/Brand';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { activeOffers } from '../config/loyalty';
import { formatMemberCode, memberQrPayload } from '../data/codes';
import { formatPoints } from '../lib/format';

const pad = (h) => String(h).padStart(2, '0');

function isBirthday(birthday, d = new Date()) {
  if (!birthday) return false;
  const [, m, day] = birthday.split('-').map(Number);
  return m === d.getMonth() + 1 && day === d.getDate();
}

export function offerStatus(offer, member) {
  if (offer.id === 'dogum-gunu') {
    if (isBirthday(member.birthday)) return { live: true, text: 'Bugün senin günün' };
    return { live: false, text: member.birthday ? 'Doğum gününde geçerli' : 'Doğum gününü ekle' };
  }
  if (activeOffers().some((o) => o.id === offer.id)) return { live: true, text: 'Şu an geçerli' };
  return { live: false, text: offer.hours ? `Hafta içi ${pad(offer.hours[0])}:00 – ${pad(offer.hours[1])}:00` : 'Her çarşamba' };
}

/** McDonald's MyM düzeni: QR kartı, ödüller rafı, fırsatlar listesi. */
export default function Club({ onOpenReward, onOpenAllRewards, onOpenHistory, onOpenHow }) {
  const { member } = useAppData();
  const { rewards, offers } = useCatalog();
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);

  return (
    <div className="page">
      <div className="club-top">
        <Wordmark />
        <button className="balance-link num" onClick={onOpenHistory}>
          {formatPoints(member.points)} puan <Icon name="chevronRight" size={18} stroke={2.4} />
        </button>
      </div>

      <div className="pad" style={{ paddingTop: 18 }}>
        <section className="qr-block">
          <Watermark />
          <button className="info" onClick={onOpenHow} aria-label="Nasıl çalışır?">
            <Icon name="info" size={24} stroke={1.8} />
          </button>
          <div className="qr-card">
            <QRCode value={memberQrPayload(member.memberCode)} size={176} />
            <span className="code num">{formatMemberCode(member.memberCode)}</span>
          </div>
          <p>Kodunu kasada okut, puanlarını topla!</p>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Ödüller</h2>
            <button className="see-all" onClick={onOpenAllRewards}>
              Hepsini gör <Icon name="arrowRight" size={16} stroke={2.2} />
            </button>
          </div>
          <div className="rail">
            {sorted.map((r) => (
              <RewardTile key={r.id} reward={r} points={member.points} onOpen={onOpenReward} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Fırsatlar</h2>
          </div>
          {offers.map((o) => {
            const st = offerStatus(o, member);
            return (
              <article key={o.id} className="offer-card">
                <span className="tag-price">{o.badge.toLocaleUpperCase('tr-TR')}</span>
                <span className={`status ${st.live ? 'is-live' : ''}`}>
                  <Icon name={st.live ? 'bolt' : 'clock'} size={14} stroke={2.2} />
                  {st.text}
                </span>
                <div className="visual">
                  <span className="ring-photo">
                    <ProductImage product={o.product} size={130} />
                  </span>
                </div>
                <h3>{o.title}</h3>
                <p>{o.subtitle}</p>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
