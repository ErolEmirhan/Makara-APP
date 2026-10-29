import { motion } from 'framer-motion';
import SnapshotImage from '../components/SnapshotImage';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { OFFERS, PROGRAM, TIERS, activeOffers } from '../config/loyalty';
import { formatPoints } from '../lib/format';

function isBirthday(birthday, d = new Date()) {
  if (!birthday) return false;
  const [, m, day] = birthday.split('-').map(Number);
  return m === d.getMonth() + 1 && day === d.getDate();
}

const pad = (h) => String(h).padStart(2, '0');

function statusOf(offer, member) {
  if (offer.id === 'dogum-gunu') {
    if (isBirthday(member.birthday)) return { active: true, text: 'Bugün senin günün!' };
    return { active: false, text: member.birthday ? 'Doğum gününde aktif olacak' : 'Profilinden doğum gününü ekle' };
  }
  if (activeOffers().some((o) => o.id === offer.id)) return { active: true, text: 'Şu an aktif' };
  return { active: false, text: offer.hours ? `Hafta içi ${pad(offer.hours[0])}:00 – ${pad(offer.hours[1])}:00` : 'Çarşamba günleri' };
}

export default function Offers() {
  const { member } = useAppData();
  return (
    <div className="screen">
      <h1 className="screen-title" style={{ marginTop: 58 }}>Kampanyalar</h1>
      <p className="screen-subtitle">Kampanyalar kasada otomatik uygulanır, ekstra bir şey yapmana gerek yok.</p>

      {OFFERS.map((o, i) => {
        const st = statusOf(o, member);
        return (
          <motion.article
            key={o.id}
            className={`offer-big tone-${o.tone}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className={`badge ${st.active ? 'is-live' : ''}`}>{o.badge}</span>
            <h3>{o.title}</h3>
            <p>{o.subtitle}</p>
            <span className={`offer-status ${st.active ? 'is-active' : ''}`}>
              <Icon name={st.active ? 'bolt' : 'clock'} size={15} stroke={2.2} />
              {st.text}
            </span>
            <SnapshotImage model={o.model} />
          </motion.article>
        );
      })}

      <section className="section">
        <div className="section-head">
          <h2>Nasıl çalışır?</h2>
        </div>
        <div className="card how-card">
          <div className="how-step">
            <b>1</b>
            <div>
              <strong>Kartını okut</strong>
              <span>Ödeme yaparken ortadaki pembe butona dokun, QR kodunu kasaya göster.</span>
            </div>
          </div>
          <div className="how-step">
            <b>2</b>
            <div>
              <strong>Puanını kazan</strong>
              <span>Her 1 ₺ harcamana {PROGRAM.pointsPerTL} puan. Kampanyalar ve seviye bonusları üstüne eklenir.</span>
            </div>
          </div>
          <div className="how-step">
            <b>3</b>
            <div>
              <strong>Ödülünü seç</strong>
              <span>Ödüller sekmesinden lezzetini seç, kodu kasada okut, afiyetle ye.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Seviyeler</h2>
        </div>
        <div className="list-group" style={{ marginTop: 0 }}>
          {TIERS.map((t) => (
            <div key={t.key} className="row">
              <span className="tier-gem" style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${t.tint[0]}, ${t.tint[1]})` }} />
              <div className="row-main">
                <strong>{t.name}</strong>
                <span>{t.min === 0 ? 'Üye olur olmaz' : `${formatPoints(t.min)} toplam puandan itibaren`}</span>
              </div>
              <span className="badge is-soft">{t.bonus ? `+%${Math.round(t.bonus * 100)}` : 'Başlangıç'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
