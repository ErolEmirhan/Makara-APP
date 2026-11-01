import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { PROGRAM } from '../config/loyalty';
import { formatMemberCode } from '../data/codes';
import { initials, memberSince } from '../lib/format';

function Row({ icon, title, sub, onClick, href, danger }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      className={`menu-row ${danger ? 'is-danger' : ''}`}
      onClick={onClick}
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noreferrer' : undefined}
    >
      <Icon name={icon} size={24} stroke={1.8} />
      <span className="label">
        <strong>{title}</strong>
        {sub && <span className="sub">{sub}</span>}
      </span>
      {!danger && <Icon name="chevronRight" size={22} stroke={2} />}
    </Tag>
  );
}

/** McDonald's "Diğer" düzeni. */
export default function More({ onEditProfile, onOpenHistory, onOpenTier, onOpenBranches, onSimulate }) {
  const { member, mode, signOut } = useAppData();
  const { heroProduct } = useCatalog();

  const resetDemo = () => {
    try {
      localStorage.removeItem('makara-club-demo-v1');
    } catch {
      /* */
    }
    window.location.reload();
  };

  return (
    <div className="page">
      <div className="more-head">
        <h1 className="page-title">Diğer</h1>
        <span className="ring-photo">
          <ProductImage product={heroProduct} size={104} />
        </span>
      </div>

      <div className="profile-card">
        <span className="avatar">{initials(member.name)}</span>
        <div>
          <strong>{member.name}</strong>
          <span>
            {memberSince(member.createdAt)} tarihinden beri üye · {formatMemberCode(member.memberCode)}
          </span>
        </div>
      </div>

      <div className="menu-list">
        <Row icon="user" title="Hesabım" sub="Ad, telefon, doğum günü" onClick={onEditProfile} />
        <Row icon="list" title="Puan geçmişi" onClick={onOpenHistory} />
        <Row icon="star" title="Seviyem ve kazanım" sub="Puan nasıl kazanılır, seviyeler" onClick={onOpenTier} />
        <Row icon="pin" title="Şubelerimiz" sub="Makara Havzan · Makara Suriçi" onClick={onOpenBranches} />
        <Row icon="info" title="Hakkımızda" sub="makara.network" href={PROGRAM.website} />
        {mode === 'demo' && (
          <>
            <Row icon="bolt" title="Alışveriş simüle et" sub="Demo: kasada puan kazanmayı dene" onClick={onSimulate} />
            <Row icon="qr" title="Kasa paneli" sub="Demo şifre 1234" onClick={() => (window.location.hash = 'kasa')} />
            <Row icon="refresh" title="Demo verisini sıfırla" onClick={resetDemo} />
          </>
        )}
        <Row icon="logout" title="Çıkış yap" onClick={signOut} danger />
      </div>
    </div>
  );
}
