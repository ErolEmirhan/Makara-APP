import { useState } from 'react';
import Sheet from '../components/Sheet';
import { useAppData } from '../data/AppData';
import { formatPhone } from '../data/codes';
import { useToast } from '../components/Toast';

export default function EditProfileSheet({ open, onClose }) {
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
