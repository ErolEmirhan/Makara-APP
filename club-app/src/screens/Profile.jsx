import { useState } from 'react';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { useAppData } from '../data/AppData';
import { BRANCHES, PROGRAM, tierFor } from '../config/loyalty';
import { formatMemberCode, formatPhone } from '../data/codes';
import { formatPoints, initials, memberSince } from '../lib/format';
import { useToast } from '../components/Toast';

function Row({ icon, title, subtitle, onClick, href, danger }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag className={`row ${danger ? 'is-danger' : ''}`} onClick={onClick} href={href} target={href ? '_blank' : undefined} rel={href ? 'noreferrer' : undefined}>
      <span className="row-icon">
        <Icon name={icon} size={17} stroke={2.1} />
      </span>
      <span className="row-main">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </span>
      {!danger && <Icon name="chevronRight" size={18} className="row-chevron" />}
    </Tag>
  );
}

function EditProfileSheet({ open, onClose }) {
  const { member, updateProfile } = useAppData();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const current = form || { name: member.name, phone: formatPhone(member.phone), birthday: member.birthday || '' };
  const set = (k) => (e) => setForm({ ...current, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateProfile(current);
      toast('Bilgilerin güncellendi');
      setForm(null);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Kişisel bilgiler">
      <form onSubmit={save}>
        <div className="field-group">
          <div className="field">
            <label htmlFor="p-name">Ad Soyad</label>
            <input id="p-name" value={current.name} onChange={set('name')} />
          </div>
          <div className="field">
            <label htmlFor="p-phone">Telefon</label>
            <input id="p-phone" inputMode="tel" value={current.phone} onChange={set('phone')} />
          </div>
          <div className="field">
            <label htmlFor="p-bday">Doğum günü</label>
            <input id="p-bday" type="date" value={current.birthday} onChange={set('birthday')} />
          </div>
        </div>
        {member.email && <p className="form-hint">E-posta: {member.email}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }}>
          Kaydet
        </button>
      </form>
    </Sheet>
  );
}

export default function Profile({ onOpenActivity, onSimulate }) {
  const { member, mode, signOut } = useAppData();
  const [editing, setEditing] = useState(false);
  const { current, next, progress } = tierFor(member.lifetimePoints);

  const resetDemo = () => {
    try {
      localStorage.removeItem('makara-club-demo-v1');
    } catch {
      /* */
    }
    window.location.reload();
  };

  return (
    <div className="screen">
      <h1 className="page-title">Hesabım</h1>
      <div className="profile-head">
        <div className="avatar is-xl">{initials(member.name)}</div>
        <div>
          <h1>{member.name}</h1>
          <p>{memberSince(member.createdAt)} tarihinden beri üye · {member.visits || 0} ziyaret</p>
          <p className="num" style={{ marginTop: 2, letterSpacing: '0.08em', fontWeight: 600 }}>{formatMemberCode(member.memberCode)}</p>
        </div>
      </div>

      <section className="tier-card">
        <p className="eyebrow">Seviyen</p>
        <h3>{current.name} üye</h3>
        <ul>
          {current.perks.map((p) => (
            <li key={p}>
              <Icon name="check" size={16} stroke={2.6} /> {p}
            </li>
          ))}
        </ul>
        {next ? (
          <>
            <div className="tier-track">
              <span>{current.name}</span>
              <span>
                {next.name} · {formatPoints(next.min - member.lifetimePoints)} puan kaldı
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          </>
        ) : (
          <p style={{ marginTop: 14, fontWeight: 600 }}>En yüksek seviyedesin.</p>
        )}
      </section>

      <p className="list-title">Hesap</p>
      <div className="list-group">
        <Row icon="edit" title="Kişisel bilgiler" subtitle={formatPhone(member.phone)} onClick={() => setEditing(true)} />
        <Row icon="list" title="Puan geçmişi" subtitle={`Toplam ${formatPoints(member.lifetimePoints)} puan kazandın`} onClick={onOpenActivity} />
      </div>

      <p className="list-title">Şubelerimiz</p>
      <div className="list-group">
        {BRANCHES.map((b) => (
          <Row key={b.id} icon="pin" title={b.name} subtitle={b.area} href={b.maps} />
        ))}
      </div>

      <p className="list-title">MAKARA</p>
      <div className="list-group">
        <Row icon="globe" title="makara.network" subtitle="Web sitemiz" href={PROGRAM.website} />
      </div>

      {mode === 'demo' && (
        <>
          <p className="list-title">Demo araçları</p>
          <div className="list-group">
            <Row icon="bolt" title="Alışveriş simüle et" subtitle="Kasada puan kazanmayı dene" onClick={onSimulate} />
            <Row icon="qr" title="Kasa panelini aç" subtitle="Demo şifre 1234" onClick={() => (window.location.hash = 'kasa')} />
            <Row icon="refresh" title="Demo verisini sıfırla" onClick={resetDemo} />
          </div>
        </>
      )}

      <div className="list-group">
        <Row icon="logout" title="Çıkış yap" onClick={signOut} danger />
      </div>

      <p className="footer-note">MAKARA Club{mode === 'demo' ? ' · Demo modu' : ''}</p>
      <EditProfileSheet open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
