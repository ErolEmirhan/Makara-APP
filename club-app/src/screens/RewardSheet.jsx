import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '../components/Sheet';
import ProductImage from '../components/ProductImage';
import QRCode from '../components/QRCode';
import ProgressRing from '../components/ProgressRing';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { PROGRAM } from '../config/loyalty';
import { newNonce, rewardQrPayload } from '../data/codes';
import { formatPoints, haptic } from '../lib/format';

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function RewardSheet({ reward, open, onClose }) {
  const { member } = useAppData();
  const [ticket, setTicket] = useState(null);
  const [done, setDone] = useState(false);
  const pointsAtStart = useRef(null);
  const now = useNow(Boolean(ticket));

  useEffect(() => {
    if (!open) return;
    setTicket(null);
    setDone(false);
  }, [open, reward?.id]);

  // Kasa ödülü onayladığında puan düşer → onay ekranı
  useEffect(() => {
    if (ticket && pointsAtStart.current !== null && member.points < pointsAtStart.current) {
      setDone(true);
      setTicket(null);
      haptic([12, 60, 18]);
    }
  }, [member.points, ticket]);

  const payload = useMemo(
    () => (ticket ? rewardQrPayload({ memberCode: member.memberCode, rewardId: reward.id, expiresAt: ticket.expiresAt, nonce: ticket.nonce }) : ''),
    [ticket, member.memberCode, reward?.id],
  );

  const enough = member.points >= (reward?.cost || 0);
  const left = ticket ? Math.max(0, ticket.expiresAt - now) : 0;
  const windowMs = PROGRAM.redeemWindowMinutes * 60000;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');

  const activate = () => {
    haptic(14);
    pointsAtStart.current = member.points;
    setTicket({ nonce: newNonce(), expiresAt: Date.now() + windowMs });
  };

  return (
    <Sheet open={open} onClose={onClose} title={ticket ? 'Ödül kodun' : ''} tall>
      {reward &&
        (done ? (
          <div className="earned" style={{ paddingTop: 40 }}>
            <span className="avatar is-xl is-success">
              <Icon name="check" size={40} stroke={2.6} />
            </span>
            <h2 style={{ fontSize: 26 }}>Afiyet olsun</h2>
            <p>{reward.name} ödülün kasada onaylandı. {formatPoints(reward.cost)} puan kullanıldı.</p>
            <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={onClose}>
              Tamam
            </button>
          </div>
        ) : ticket ? (
          <div className="redeem-box">
            <ProductImage product={reward.product} size={72} />
            <h2 className="detail-title" style={{ marginTop: 0 }}>{reward.name}</h2>
            {left > 0 ? (
              <>
                <div className="qr-frame">
                  <QRCode value={payload} size={240} />
                </div>
                <span className="countdown num">
                  <ProgressRing value={left / windowMs} size={22} stroke={3} colors={['#d6156f', '#d6156f']} track="#e9e9ee" />
                  {mm}:{ss} içinde kasada okut
                </span>
                <p className="muted" style={{ fontSize: 14 }}>
                  Puanın kasa onayladığında düşer. Kod tek kullanımlıktır.
                </p>
              </>
            ) : (
              <>
                <p className="muted">Kodun süresi doldu. Puanından bir şey eksilmedi.</p>
                <button className="btn btn-primary btn-block" onClick={activate}>
                  Yeni kod oluştur
                </button>
              </>
            )}
            <button className="link-btn" style={{ marginTop: 6 }} onClick={() => setTicket(null)}>
              Vazgeç
            </button>
          </div>
        ) : (
          <>
            <div className="detail-photo">
              <ProductImage product={reward.product} size={210} eager />
            </div>
            <p className="eyebrow" style={{ marginTop: 18 }}>Ödül</p>
            <h2 className="detail-title" style={{ marginTop: 4 }}>{reward.name}</h2>
            {reward.product?.ingredients && <p className="muted" style={{ marginTop: 6, fontSize: 14.5 }}>{reward.product.ingredients}</p>}
            <div className="cost-row">
              <div>
                <p className="muted" style={{ fontSize: 13 }}>Gerekli</p>
                <span className="num">{formatPoints(reward.cost)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="muted" style={{ fontSize: 13 }}>Puanın</p>
                <span className="num" style={{ color: enough ? 'var(--brand)' : 'var(--ink-3)' }}>
                  {formatPoints(member.points)}
                </span>
              </div>
            </div>
            {enough ? (
              <button className="btn btn-primary btn-block" onClick={activate}>
                Ödülü kullan
              </button>
            ) : (
              <>
                <div className="bar">
                  <i style={{ width: `${(member.points / reward.cost) * 100}%` }} />
                </div>
                <button className="btn btn-secondary btn-block" style={{ marginTop: 14 }} disabled>
                  {formatPoints(reward.cost - member.points)} puan daha gerekli
                </button>
              </>
            )}
          </>
        ))}
    </Sheet>
  );
}
