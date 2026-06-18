import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export function LogoutModal({ open, onClose, onAfterLogout }) {
  const { logout } = useAuth();
  const { goBackToTables } = useApp();

  const handleLogout = () => {
    goBackToTables();
    logout();
    onClose();
    onAfterLogout?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="Çıkış Yap">
      <p className="text-gray-600 mt-2 mb-6">Oturumunuzu kapatmak istediğinize emin misiniz?</p>
      <div className="flex gap-3">
        <button onClick={handleLogout} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">
          Çıkış Yap
        </button>
        <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">
          İptal
        </button>
      </div>
    </Modal>
  );
}
