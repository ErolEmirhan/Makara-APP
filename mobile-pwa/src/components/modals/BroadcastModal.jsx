import { Modal } from '../ui/Modal';

export function BroadcastModal({ open, onClose, message, date, time }) {
  return (
    <Modal open={open} onClose={onClose} title="📢 Duyuru">
      <div className="mt-2">
        <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">{message}</p>
        {(date || time) && (
          <p className="text-gray-400 text-xs mt-4">{date} {time}</p>
        )}
        <button onClick={onClose} className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold">
          Tamam
        </button>
      </div>
    </Modal>
  );
}
