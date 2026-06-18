import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export function ManagerOpsModal({ open, onClose }) {
  const { staff } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [staffPass, setStaffPass] = useState('');
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      api.managerOpsConfigured().then((r) => setConfigured(!!r.configured)).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    if (!staffPass || !newPass || !confirm) {
      setError('Tüm alanları doldurun');
      return;
    }
    if (newPass !== confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    if (configured && !current) {
      setError('Mevcut şifreyi girin');
      return;
    }

    setLoading(true);
    try {
      const res = await api.setManagerOpsPassword({
        staffId: staff.id,
        staffPassword: staffPass,
        currentPassword: configured ? current : undefined,
        newPassword: newPass,
      });
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Kaydedilemedi');
      }
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Masaüstü Müdür İşlem Şifresi">
      <p className="text-gray-500 text-sm mt-1 mb-4">
        Bu şifre, bilgisayardaki personel listesinde müdür atama ve kaldırma için kullanılır.
      </p>
      <div className="space-y-3">
        {configured && (
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder="Mevcut masaüstü şifresi" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-amber-400" />
        )}
        <input type="password" value={staffPass} onChange={(e) => setStaffPass(e.target.value)}
          placeholder="Personel giriş şifreniz" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-amber-400" />
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
          placeholder="Yeni masaüstü şifresi" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-amber-400" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Yeni şifre (tekrar)" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-amber-400" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold disabled:opacity-50">
            Kaydet
          </button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">İptal</button>
        </div>
      </div>
    </Modal>
  );
}
