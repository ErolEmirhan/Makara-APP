import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData } from '../data/AppData';
import Scanner from './Scanner';
import Icon from '../components/Icon';
import SnapshotImage from '../components/SnapshotImage';
import { BRANCHES, calculateEarn, rewardById, tierFor } from '../config/loyalty';
import { formatMemberCode, formatPhone, parseQr } from '../data/codes';
import { formatPoints, formatTL, initials, timeOf } from '../lib/format';

const BRANCH_KEY = 'makara-kasa-branch';

function readBranch() {
  try {
    return localStorage.getItem(BRANCH_KEY) || BRANCHES[0].id;
  } catch {
    return BRANCHES[0].id;
  }
}

function StaffLogin({ backend, mode, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => setError(notice || ''), [notice]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await backend.staffSignIn({ email, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="kasa-login">
      <form className="kasa-login-card" onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" style={{ height: 44, margin: '0 auto' }} />
        <h1>Kasa Paneli</h1>
        <p className="muted">MAKARA Club puan yükleme ve ödül onayı</p>
        <div className="field-group" style={{ marginTop: 22, textAlign: 'left' }}>
          {mode === 'firebase' && (
            <div className="field">
              <label htmlFor="k-email">E-posta</label>
              <input id="k-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
          )}
          <div className="field">
            <label htmlFor="k-pass">{mode === 'firebase' ? 'Şifre' : 'Kasa şifresi'}</label>
            <input
              id="k-pass"
              type="password"
              inputMode={mode === 'demo' ? 'numeric' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
        </div>
        {mode === 'demo' && <p className="form-hint">Demo modunda kasa şifresi: 1234</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Giriş yap'}
        </button>
        <a className="link-btn" href="#/" style={{ display: 'block', marginTop: 16, textAlign: 'center', textDecoration: 'none' }}>
          Müşteri uygulamasına dön
        </a>
      </form>
    </div>
  );
}

function Keypad({ value, onChange }) {
  const press = (k) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    if (k === ',') return value.includes(',') || !value ? null : onChange(`${value},`);
    const [, dec] = value.split(',');
    if (dec !== undefined && dec.length >= 2) return null;
    if (value.replace(',', '').length >= 7) return null;
    if (value === '0' && k !== ',') return onChange(k);
    return onChange(value + k);
  };
  return (
    <div className="kasa-keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map((k) => (
        <button key={k} type="button" onClick={() => press(k)} aria-label={k === 'del' ? 'Sil' : k}>
          {k === 'del' ? <Icon name="chevronLeft" size={26} stroke={2.2} /> : k}
        </button>
      ))}
    </div>
  );
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, until - now) : 0;
}

export default function KasaApp() {
  const { backend, mode } = useAppData();
  const [staff, setStaff] = useState(undefined);
  const [notice, setNotice] = useState('');
  const [branchId, setBranchId] = useState(readBranch);
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState('idle');
  const [member, setMember] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);
  const left = useCountdown(ticket?.expiresAt);

  useEffect(() => {
    document.title = 'MAKARA Kasa';
    return () => {
      document.title = 'MAKARA Club';
    };
  }, []);

  useEffect(() => {
    if (!backend) return undefined;
    return backend.onStaff((s, msg) => {
      setStaff(s);
      if (msg) setNotice(msg);
    });
  }, [backend]);

  useEffect(() => {
    try {
      localStorage.setItem(BRANCH_KEY, branchId);
    } catch {
      /* */
    }
  }, [branchId]);

  useEffect(() => {
    if (step !== 'success') return undefined;
    const t = setTimeout(reset, 4500);
    return () => clearTimeout(t);
  }, [step]);

  function reset() {
    setStep('idle');
    setMember(null);
    setTicket(null);
    setAmount('');
    setError('');
    setCode('');
    setSuccess(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleText(text) {
    setCamera(false);
    setError('');
    const parsed = parseQr(text);
    if (!parsed) {
      setError('Kod tanınmadı. Üye kodu (8 karakter), telefon ya da MAKARA QR kodu girin.');
      return;
    }
    setBusy(true);
    try {
      const query = parsed.kind === 'phone' ? { phone: parsed.phone } : { memberCode: parsed.memberCode };
      const found = await backend.findMember(query);
      if (!found) throw new Error('Bu koda ait üye bulunamadı.');
      setMember(found);
      if (parsed.kind === 'reward') {
        const reward = rewardById(parsed.rewardId);
        if (!reward) throw new Error('Ödül tanınmadı.');
        setTicket({ ...parsed, reward });
        setStep('reward');
      } else {
        setTicket(null);
        setStep('member');
      }
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const amountNumber = Number(amount.replace(',', '.')) || 0;
  const earn = member ? calculateEarn(amountNumber, member.lifetimePoints) : null;

  async function award() {
    setBusy(true);
    setError('');
    try {
      const res = await backend.awardPoints({ memberId: member.id, amount: amountNumber, branchId });
      setSuccess({ kind: 'earn', points: res.earned, total: res.member.points, name: member.name });
      setHistory((h) => [{ id: Date.now(), kind: 'earn', name: member.name, points: res.earned, amount: amountNumber, at: Date.now() }, ...h].slice(0, 12));
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    setError('');
    try {
      const res = await backend.redeemReward({
        memberId: member.id,
        rewardId: ticket.reward.id,
        nonce: ticket.nonce,
        expiresAt: ticket.expiresAt,
        branchId,
      });
      setSuccess({ kind: 'redeem', reward: res.reward, total: res.member.points, name: member.name });
      setHistory((h) => [{ id: Date.now(), kind: 'redeem', name: member.name, points: -res.reward.cost, reward: res.reward.name, at: Date.now() }, ...h].slice(0, 12));
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!backend || staff === undefined) return <div className="splash" />;
  if (!staff) return <StaffLogin backend={backend} mode={mode} notice={notice} />;

  const tier = member ? tierFor(member.lifetimePoints).current : null;

  return (
    <div className="kasa">
      <header className="kasa-header">
        <div className="kasa-brand">
          <img src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
          <span className="badge is-soft">KASA</span>
        </div>
        <div className="segmented kasa-branches" role="tablist" style={{ gridTemplateColumns: `repeat(${BRANCHES.length}, 1fr)` }}>
          <motion.span
            className="segmented-thumb"
            style={{ width: `calc(${100 / BRANCHES.length}% - 3px)` }}
            animate={{ x: `${BRANCHES.findIndex((b) => b.id === branchId) * 100}%` }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
          {BRANCHES.map((b) => (
            <button key={b.id} role="tab" aria-selected={branchId === b.id} onClick={() => setBranchId(b.id)}>
              {b.name.replace('Makara ', '')}
            </button>
          ))}
        </div>
        <div className="kasa-staff">
          <span className="muted">{staff.name || 'Kasa'}</span>
          <button className="icon-btn" onClick={() => backend.staffSignOut()} aria-label="Çıkış">
            <Icon name="logout" size={17} stroke={2} />
          </button>
        </div>
      </header>

      <main className="kasa-main">
        <section className="kasa-panel">
          <h2>Müşteriyi bul</h2>
          <Scanner active={camera} onResult={handleText} onError={(m) => { setCamera(false); setError(m); }} />
          <button className={`btn btn-block ${camera ? 'btn-ghost' : 'btn-dark'}`} onClick={() => setCamera((c) => !c)} style={{ marginTop: 12 }}>
            <Icon name="camera" size={20} /> {camera ? 'Kamerayı kapat' : 'Kamerayla okut'}
          </button>
          <form
            className="kasa-code"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) handleText(code);
            }}
          >
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Üye kodu, telefon veya QR okuyucu"
              aria-label="Üye kodu veya telefon"
              autoFocus
              autoComplete="off"
            />
            <button className="btn btn-primary" disabled={busy || !code.trim()}>
              Bul
            </button>
          </form>
          <p className="form-hint">USB / Bluetooth el tipi QR okuyucu bu alana doğrudan yazar.</p>
          {error && step !== 'member' && step !== 'reward' && <p className="form-error">{error}</p>}

          {history.length > 0 && (
            <div className="kasa-history">
              <p className="list-title" style={{ marginTop: 22 }}>Bu oturumdaki işlemler</p>
              <div className="activity-list">
                {history.map((h) => (
                  <div key={h.id} className="activity-item">
                    <span className={`activity-icon ${h.kind === 'redeem' ? 'is-redeem' : ''}`}>
                      <Icon name={h.kind === 'redeem' ? 'gift' : 'plus'} size={18} stroke={2} />
                    </span>
                    <div className="activity-main">
                      <strong>{h.name}</strong>
                      <span>{h.kind === 'redeem' ? h.reward : formatTL(h.amount)} · {timeOf(h.at)}</span>
                    </div>
                    <span className={`activity-points num ${h.points < 0 ? 'is-negative' : ''}`}>
                      {h.points < 0 ? '−' : '+'}
                      {formatPoints(Math.abs(h.points))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="kasa-panel kasa-result">
          <AnimatePresence mode="wait">
            {step === 'idle' && (
              <motion.div key="idle" className="kasa-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SnapshotImage model="roll" />
                <h3>Müşterinin kartını okutun</h3>
                <p className="muted">Uygulamadaki pembe QR butonu üyelik kartını açar. Ödül kodları da buradan onaylanır.</p>
              </motion.div>
            )}

            {(step === 'member' || step === 'reward') && member && (
              <motion.div key={`m-${step}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="kasa-member">
                  <div className="avatar" style={{ width: 54, height: 54, fontSize: 19 }}>{initials(member.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{member.name}</strong>
                    <span className="muted">
                      {formatMemberCode(member.memberCode)} · {formatPhone(member.phone)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontSize: 24, fontWeight: 800 }}>{formatPoints(member.points)}</span>
                    <span className="tier-pill" style={{ height: 24, marginLeft: 8 }}>{tier.name}</span>
                  </div>
                </div>

                {step === 'member' && (
                  <>
                    <div className="kasa-amount">
                      <span className="muted">Fiş tutarı</span>
                      <div className="kasa-amount-value num">
                        {amount || '0'}
                        <small>₺</small>
                      </div>
                      <div className="kasa-earn">
                        <span className="badge">+{formatPoints(earn.total)} puan</span>
                        {earn.multiplier > 1 && <span className="badge is-soft">{earn.multiplier}x kampanya</span>}
                        {earn.tierBonus > 0 && <span className="badge is-soft">+%{Math.round(earn.tierBonus * 100)} {tier.name}</span>}
                      </div>
                    </div>
                    <Keypad value={amount} onChange={setAmount} />
                    {error && <p className="form-error">{error}</p>}
                    <div className="kasa-actions">
                      <button className="btn btn-ghost" onClick={reset}>
                        Vazgeç
                      </button>
                      <button className="btn btn-primary" onClick={award} disabled={busy || earn.total <= 0}>
                        {busy ? <span className="spinner" /> : `Puan yükle`}
                      </button>
                    </div>
                  </>
                )}

                {step === 'reward' && ticket && (
                  <>
                    <div className="kasa-reward">
                      <SnapshotImage model={ticket.reward.model} variant={ticket.reward.variant} />
                      <div>
                        <p className="eyebrow">Ödül kullanımı</p>
                        <h3>{ticket.reward.name}</h3>
                        <p className="num" style={{ fontWeight: 750, color: 'var(--pink-600)' }}>{formatPoints(ticket.reward.cost)} puan</p>
                        <p className={`offer-status ${left > 0 ? 'is-active' : ''}`}>
                          <Icon name="clock" size={15} stroke={2.2} />
                          {left > 0
                            ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} geçerli`
                            : 'Süresi doldu'}
                        </p>
                      </div>
                    </div>
                    {member.points < ticket.reward.cost && <p className="form-error">Üyenin puanı bu ödül için yetersiz.</p>}
                    {error && <p className="form-error">{error}</p>}
                    <div className="kasa-actions">
                      <button className="btn btn-ghost" onClick={reset}>
                        Vazgeç
                      </button>
                      <button className="btn btn-primary" onClick={redeem} disabled={busy || left <= 0 || member.points < ticket.reward.cost}>
                        {busy ? <span className="spinner" /> : 'Ödülü onayla'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 'success' && success && (
              <motion.div key="success" className="kasa-success" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="avatar is-xl" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                  <Icon name="check" size={48} stroke={2.6} />
                </motion.div>
                {success.kind === 'earn' ? (
                  <>
                    <h3 className="num">+{formatPoints(success.points)} puan</h3>
                    <p className="muted">{success.name} hesabına yüklendi · yeni bakiye {formatPoints(success.total)}</p>
                  </>
                ) : (
                  <>
                    <h3>{success.reward.name}</h3>
                    <p className="muted">{success.name} için ödül onaylandı · kalan {formatPoints(success.total)} puan</p>
                  </>
                )}
                <button className="btn btn-dark" onClick={reset} style={{ marginTop: 10 }}>
                  Yeni işlem
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
