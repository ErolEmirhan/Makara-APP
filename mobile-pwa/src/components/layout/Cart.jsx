import { useState } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useBackHandler } from '../../hooks/useBackButton';

function CartItemThumb({ imageSrc, name, accent }) {
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm bg-gray-100"
      />
    );
  }

  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`w-11 h-11 rounded-full shrink-0 ring-2 ring-white shadow-sm flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${accent}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function Cart() {
  const { theme } = useBranch();
  const { staff } = useAuth();
  const {
    cart, cartTotal, cartCount, screen,
    selectedTable, orderNote, setOrderNote,
    updateCartItem, removeFromCart, clearCart,
    showToast, goBackToTables, loadExistingOrders,
    sendOrder,
  } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showNote, setShowNote] = useState(false);

  useBackHandler(
    screen === 'order' && !!selectedTable && (showNote || expanded),
    () => {
      if (showNote) {
        setShowNote(false);
        return;
      }
      if (expanded) {
        setExpanded(false);
      }
    }
  );

  if (screen !== 'order' || !selectedTable) return null;

  const handleSend = async () => {
    if (!cart.length || sending || !staff) return;
    setSending(true);
    const tableId = selectedTable.id;

    setSent(true);
    showToast('success', 'Sipariş Gönderildi', 'Kasaya iletildi, yazdırılıyor...');
    clearCart();
    loadExistingOrders(tableId);

    setTimeout(() => {
      setSending(false);
      setSent(false);
      if (theme.isSultan || theme.isMakaraHavzan) goBackToTables();
    }, 1200);

    try {
      const result = await sendOrder(staff);
      if (!result.success) {
        showToast('error', 'Hata', 'Sipariş kaydedilemedi');
      }
    } catch {
      showToast('error', 'Bağlantı Hatası', 'Firebase\'e iletilemedi');
    }
  };

  const toggleGift = (cartLineId) => {
    const item = cart.find((i) => i.cartLineId === cartLineId);
    if (item) updateCartItem(cartLineId, { isGift: !item.isGift });
  };

  const decrementItem = (item) => {
    if (item.quantity <= 1) {
      removeFromCart(item.cartLineId);
    } else {
      updateCartItem(item.cartLineId, { quantity: item.quantity - 1 });
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
        <div className="w-full rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-gray-100 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r ${theme.accent}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm">
                {cartCount}
              </span>
              <span className="text-white font-bold">Sepet</span>
            </div>
            <span className="text-white font-black text-lg">{cartTotal.toFixed(2)} ₺</span>
          </button>

          {expanded && (
            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Sepet boş</p>
              ) : (
                cart.map((item) => (
                  <div key={item.cartLineId} className="flex items-center gap-2.5 p-3 rounded-2xl bg-gray-50">
                    <CartItemThumb imageSrc={item.imageSrc} name={item.name} accent={theme.accent} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">
                        {item.name}
                        {item.isGift && <span className="text-emerald-600 text-xs ml-1">İkram</span>}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {item.isGift ? '0.00' : item.price.toFixed(2)} ₺ × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => decrementItem(item)}
                        className="w-8 h-8 rounded-lg bg-gray-200 font-bold active:bg-gray-300"
                        aria-label="Azalt"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => updateCartItem(item.cartLineId, { quantity: item.quantity + 1 })}
                        className="w-8 h-8 rounded-lg bg-gray-200 font-bold">+</button>
                    </div>
                    <button onClick={() => toggleGift(item.cartLineId)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg ${item.isGift ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>🎁</button>
                    <button onClick={() => removeFromCart(item.cartLineId)} className="text-red-400 font-bold text-lg">×</button>
                  </div>
                ))
              )}
              <button onClick={() => setShowNote(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold">
                {orderNote ? `📝 ${orderNote}` : '📝 Sipariş notu ekle'}
              </button>
            </div>
          )}

          {cart.length > 0 && (
            <button onClick={handleSend} disabled={sending}
              className="w-full py-4 font-bold text-lg text-white bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-70">
              {sent ? '✓ Gönderildi' : sending ? 'Gönderiliyor...' : 'Siparişi Gönder'}
            </button>
          )}
        </div>
      </div>

      {showNote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={() => setShowNote(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">Sipariş Notu</h3>
            <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 resize-none h-24" autoFocus />
            <button onClick={() => setShowNote(false)} className="w-full mt-3 py-3 rounded-xl bg-purple-500 text-white font-bold">Tamam</button>
          </div>
        </div>
      )}
    </>
  );
}
