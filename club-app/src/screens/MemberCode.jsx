import Sheet from '../components/Sheet';
import QRCode from '../components/QRCode';
import { Watermark } from '../components/Brand';
import { useAppData } from '../data/AppData';
import { tierFor } from '../config/loyalty';
import { formatMemberCode, memberQrPayload } from '../data/codes';
import { formatPoints } from '../lib/format';

/** Kasada okutulan üyelik kodu (McDonald's MyM QR kartı düzeni). */
export default function MemberCode({ open, onClose }) {
  const { member } = useAppData();
  if (!member) return null;
  const { current } = tierFor(member.lifetimePoints);
  return (
    <Sheet open={open} onClose={onClose} title="Kodum">
      <div className="code-screen">
        <section className="qr-block">
          <Watermark />
          <div className="qr-card">
            <QRCode value={memberQrPayload(member.memberCode)} size={230} />
            <span className="code num">{formatMemberCode(member.memberCode)}</span>
          </div>
          <p>Kodunu kasada okut, puanlarını topla!</p>
        </section>
        <div className="code-facts">
          <div>
            <span className="eyebrow">Puanın</span>
            <strong className="num">{formatPoints(member.points)}</strong>
          </div>
          <div>
            <span className="eyebrow">Seviye</span>
            <strong>{current.name}</strong>
          </div>
        </div>
        <p className="code-tip">Kod okunmazsa kasiyere 8 haneli kodu veya telefon numaranı söyleyebilirsin.</p>
      </div>
    </Sheet>
  );
}
