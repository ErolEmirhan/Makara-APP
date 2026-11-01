import { useState } from 'react';
import { useAppData } from '../data/AppData';
import { normalizePhone } from '../data/codes';

/** Google ile ilk girişte eksik bilgileri tamamlatır. */
export default function CompleteProfile() {
  const app = useAppData();
  const [form, setForm] = useState({ name: app.user?.displayName || '', phone: '', birthday: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.name.trim().length < 2) throw new Error('Adınızı yazın.');
      if (normalizePhone(form.phone).length !== 10) throw new Error('Telefon numarası 10 haneli olmalı.');
      await app.completeProfile(form);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="app-shell">
      <main className="welcome" style={{ justifyContent: 'center' }}>
        <div className="welcome-top">
          <img src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
        </div>
        <div className="welcome-copy" style={{ marginBottom: 22 }}>
          <h1>Son bir adım</h1>
          <p>Kasada seni bulabilmemiz için birkaç bilgi.</p>
        </div>
        <form onSubmit={submit}>
          <div className="field-group">
            <div className="field">
              <label htmlFor="c-name">Ad Soyad</label>
              <input id="c-name" value={form.name} onChange={set('name')} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="c-phone">Telefon</label>
              <input id="c-phone" inputMode="tel" placeholder="05xx xxx xx xx" value={form.phone} onChange={set('phone')} autoComplete="tel" />
            </div>
            <div className="field">
              <label htmlFor="c-bday">Doğum günü</label>
              <input id="c-bday" type="date" value={form.birthday} onChange={set('birthday')} />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={app.busy}>
            {app.busy ? <span className="spinner" /> : 'Üyeliği tamamla'}
          </button>
        </form>
        <button className="link-btn" style={{ margin: '18px auto 0' }} onClick={app.signOut}>
          Farklı hesapla giriş yap
        </button>
      </main>
    </div>
  );
}
