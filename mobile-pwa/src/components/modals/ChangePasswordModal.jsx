import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { loginStaff, changeStaffPassword } from '../../services/firebaseService';

export function ChangePasswordModal({ open, onClose }) {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setCurrent(''); setNewPass(''); setConfirm(''); setError(''); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setError('');
    if (!current || !newPass || !confirm) { setError('Tüm alanları doldurun'); return; }
    if (newPass !== confirm) { setError('Yeni şifreler eşleşmiyor'); return; }
    if (newPass.length < 4) { setError('Şifre en az 4 karakter olmalı'); return; }

    setLoading(true);
    try {
      const loginRes = await loginStaff(current);
      if (!loginRes.success) { setError('Mevcut şifre hatalı'); return; }
      const changeRes = await changeStaffPassword(loginRes.staff.id, current, newPass);
      if (changeRes.success) {
        handleClose();
        logout('Şifreniz değiştirildi. Lütfen yeni şifrenizle giriş yapın.');
      } else {
        setError(changeRes.error || 'Şifre değiştirilemedi');
      }
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Şifre Değiştir">
      <div className="space-y-4 mt-2">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
          placeholder="Mevcut şifre" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none" />
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
          placeholder="Yeni şifre" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Yeni şifre (tekrar)" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold disabled:opacity-50">
            {loading ? '...' : 'Değiştir'}
          </button>
          <button onClick={handleClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">İptal</button>
        </div>
      </div>
    </Modal>
  );
}
