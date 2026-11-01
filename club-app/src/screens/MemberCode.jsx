import Sheet from '../components/Sheet';
import QRCode from '../components/QRCode';
import { useAppData } from '../data/AppData';
import { tierFor } from '../config/loyalty';
import { formatMemberCode, memberQrPayload } from '../data/codes';
import { formatPoints } from '../lib/format';

/** Kasada okutulan üyelik kodu. */
export default function MemberCode({ open, onClose }) {
  const { member } = useAppData();
  if (!member) return null;
  const { current } = tierFor(member.lifetimePoints);
  return (
    <Sheet open={open} onClose={onClose} title="Üyelik kodun">
      <div className="code-screen">
        <p className="muted" style={{ fontSize: 15 }}>Ödeme yaparken bu kodu kasada okut.</p>
        <div className="qr-frame">
          <QRCode value={memberQrPayload(member.memberCode)} size={250} />
        </div>
        <p className="member-code num">{formatMemberCode(member.memberCode)}</p>
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
