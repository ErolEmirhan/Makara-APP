import { useState } from 'react';
import { motion } from 'framer-motion';
import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { normalizePhone } from '../data/codes';

function Field({ label, ...props }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{label}</label>
      <input {...props} />
    </div>
  );
}

export default function AuthSheet({ mode, onModeChange, onClose }) {
  const app = useAppData();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', birthday: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const isSignup = mode === 'signup';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      if (isSignup) {
        if (form.name.trim().length < 2) throw new Error('Adınızı yazın.');
        if (normalizePhone(form.phone).length !== 10) throw new Error('Telefon numarası 10 haneli olmalı (5xx xxx xx xx).');
        if (app.mode === 'firebase' && !/^\S+@\S+\.\S+$/.test(form.email)) throw new Error('Geçerli bir e-posta yazın.');
        if (form.password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        await app.signUp(form);
      } else {
        await app.signIn({ email: form.email, password: form.password });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const forgot = async () => {
    setError('');
    try {
      await app.resetPassword(form.email);
      setInfo('Şifre sıfırlama bağlantısı e-postana gönderildi.');
    } catch (err) {
      setError(err.message);
    }
  };

  const google = async () => {
    setError('');
    try {
      await app.signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Sheet open={Boolean(mode)} onClose={onClose} title={isSignup ? 'MAKARA Club’a katıl' : 'Tekrar hoş geldin'}>
      <div className="segmented" role="tablist">
        <motion.span
          className="segmented-thumb"
          animate={{ x: isSignup ? '0%' : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
        <button role="tab" aria-selected={isSignup} onClick={() => onModeChange('signup')}>
          Üye Ol
        </button>
        <button role="tab" aria-selected={!isSignup} onClick={() => onModeChange('signin')}>
          Giriş Yap
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="field-group">
          {isSignup && (
            <>
              <Field id="name" label="Ad Soyad" placeholder="Adın ve soyadın" autoComplete="name" value={form.name} onChange={set('name')} />
              <Field id="phone" label="Telefon" placeholder="05xx xxx xx xx" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
            </>
          )}
          <Field
            id="email"
            label={isSignup ? 'E-posta' : app.mode === 'demo' ? 'E-posta / Tel' : 'E-posta'}
            placeholder={isSignup && app.mode === 'demo' ? 'isteğe bağlı' : 'ornek@mail.com'}
            type={app.mode === 'demo' && !isSignup ? 'text' : 'email'}
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          <Field
            id="password"
            label="Şifre"
            placeholder={isSignup ? 'En az 6 karakter' : 'Şifren'}
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={set('password')}
          />
          {isSignup && <Field id="birthday" label="Doğum günü" type="date" value={form.birthday} onChange={set('birthday')} />}
        </div>
        {isSignup && <p className="form-hint">Doğum gününü eklersen o gün sana özel bir sürprizimiz olacak.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {info && <p className="form-hint">{info}</p>}

        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={app.busy}>
          {app.busy ? <span className="spinner" /> : isSignup ? 'Üyeliği Başlat' : 'Giriş Yap'}
        </button>
      </form>

      {!isSignup && app.mode === 'firebase' && (
        <button className="link-btn" style={{ display: 'block', margin: '14px auto 0' }} onClick={forgot}>
          Şifremi unuttum
        </button>
      )}

      {app.mode === 'firebase' && (
        <>
          <div className="or-divider">veya</div>
          <button className="btn btn-ghost btn-block" onClick={google} disabled={app.busy}>
            <Icon name="google" size={20} /> Google ile devam et
          </button>
        </>
      )}
    </Sheet>
  );
}
