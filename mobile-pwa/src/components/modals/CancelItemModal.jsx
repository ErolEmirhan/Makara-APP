import { useState } from 'react';

import { Modal } from '../ui/Modal';

import { submitAndWaitMobileAction } from '../../services/firebaseService';

import { useApp } from '../../context/AppContext';

import { useAuth } from '../../context/AuthContext';



export function CancelItemModal({ open, item, tableId, onClose }) {

  const { staff } = useAuth();

  const { showToast } = useApp();

  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);



  const handleCancel = async () => {

    if (!item || !tableId || !staff) return;

    const trimmed = reason.trim();

    if (!trimmed) {

      showToast('error', 'Gerekli', 'İptal açıklaması zorunludur');

      return;

    }

    setLoading(true);

    try {

      const res = await submitAndWaitMobileAction({

        type: 'cancel_item',

        itemId: item.id,

        cancelQuantity: item.quantity,

        cancelReason: trimmed,

        tableId,

        staffId: staff.id,

        staffName: `${staff.name} ${staff.surname}`,

      });

      if (res.success) {

        showToast('success', 'İptal', 'Ürün iptal edildi');

        setReason('');

        onClose();

      } else if (res.requiresReason) {

        showToast('error', 'Gerekli', res.error || 'İptal açıklaması girin');

      } else {

        showToast('error', 'Hata', res.error || 'İptal edilemedi');

      }

    } catch (err) {

      showToast('error', 'Hata', err.message || 'Bağlantı hatası');

    } finally {

      setLoading(false);

    }

  };



  if (!item) return null;



  return (

    <Modal open={open} onClose={onClose} title="Ürün İptal">

      <p className="text-gray-600 mt-1 mb-4">

        <strong>{item.quantity}x {item.product_name}</strong> iptal edilecek.

      </p>

      <input

        type="text"

        value={reason}

        onChange={(e) => setReason(e.target.value)}

        placeholder="İptal açıklaması (zorunlu)"

        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-red-300 mb-4"

      />

      <p className="text-xs text-gray-500 mb-4">

        İptal fişi yazdırılır. Masaüstü uygulamanın açık olması gerekir.

      </p>

      <div className="flex gap-3">

        <button onClick={handleCancel} disabled={loading}

          className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50">

          {loading ? 'İşleniyor...' : 'İptal Et'}

        </button>

        <button onClick={onClose} disabled={loading}

          className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">

          Vazgeç

        </button>

      </div>

    </Modal>

  );

}


