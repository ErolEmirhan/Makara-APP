import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sheet from '../components/Sheet';
import Stage3D from '../three/Stage3D';
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

  // Kasa ödülü onayladığında puan düşer → başarı ekranı
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
    <Sheet open={open} onClose={onClose} title="" tall>
      {reward && (
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" className="redeem-box" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ paddingTop: 40 }}>
              <div className="avatar is-xl">
                <Icon name="check" size={46} stroke={2.6} />
              </div>
              <h2 className="detail-title">Afiyet olsun!</h2>
              <p className="detail-blurb">{reward.name} ödülün kasada onaylandı. {formatPoints(reward.cost)} puan kullanıldı.</p>
              <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={onClose}>
                Harika
              </button>
            </motion.div>
          ) : ticket ? (
            <motion.div key="ticket" className="redeem-box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="eyebrow">Ödül kodun hazır</p>
              <h2 className="detail-title" style={{ marginTop: 0 }}>{reward.name}</h2>
              {left > 0 ? (
                <>
                  <div className="qr-frame">
                    <QRCode value={payload} size={236} />
                  </div>
                  <ProgressRing value={left / windowMs} size={46} stroke={5}>
                    <Icon name="clock" size={18} />
                  </ProgressRing>
                  <span className="countdown num">
                    {mm}:{ss} içinde kasada okut
                  </span>
                  <p className="muted" style={{ fontSize: 14 }}>
                    Puanın, kasa onayladığında düşer. Kod tek kullanımlıktır.
                  </p>
                </>
              ) : (
                <>
                  <p className="detail-blurb">Kodun süresi doldu. Puanından bir şey eksilmedi.</p>
                  <button className="btn btn-primary btn-block" onClick={activate}>
                    <Icon name="refresh" size={18} stroke={2.2} /> Yeni kod oluştur
                  </button>
                </>
              )}
              <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setTicket(null)}>
                Vazgeç
              </button>
            </motion.div>
          ) : (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="detail-stage">
                <Stage3D model={reward.model} variant={reward.variant} elevation={28} zoom={0.92} spin={0.22} />
                <span className="detail-hint">
                  <Icon name="refresh" size={14} /> Çevirmek için sürükle
                </span>
              </div>
              <p className="eyebrow" style={{ marginTop: 14 }}>
                {reward.category}
              </p>
              <h2 className="detail-title">{reward.name}</h2>
              <p className="detail-blurb">{reward.blurb}</p>
              <div className="detail-cost">
                <div>
                  <p className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Gerekli</p>
                  <span className="num">{formatPoints(reward.cost)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Puanın</p>
                  <span className="num" style={{ color: enough ? 'var(--pink-600)' : 'var(--ink-3)' }}>
                    {formatPoints(member.points)}
                  </span>
                </div>
              </div>
              {enough ? (
                <button className="btn btn-primary btn-block" onClick={activate}>
                  <Icon name="gift" size={20} stroke={2} /> Ödülü Kullan
                </button>
              ) : (
                <>
                  <div className="bar" style={{ height: 10 }}>
                    <i style={{ width: `${(member.points / reward.cost) * 100}%` }} />
                  </div>
                  <button className="btn btn-secondary btn-block" style={{ marginTop: 16 }} disabled>
                    {formatPoints(reward.cost - member.points)} puan daha biriktir
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Sheet>
  );
}
