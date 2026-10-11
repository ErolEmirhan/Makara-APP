import React, { useState, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import { getCachedProductImageUrl, registerProductImage, resolveProductImage } from '../utils/productImageCache';
import {
  MAKARA_HAVZAN_MAIN_TABLE_COUNT,
  MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS,
} from '../constants/makaraMasaLayout';
import { buildSultanTablesFlat } from '../constants/sultanTables';

const roundMoney = (x) => Math.round(Number(x) * 100) / 100;

const TableOrderModal = ({ order, items, itemsLoading = false, customerMode = false, branchKey = 'makara', onClose, onCompleteTable, onPartialPayment, onPartialComplete, onRequestAdisyon, onAddItems, onItemCancelled, onCancelEntireTable, onTransferItems, onGiftApplied }) => {
  const [sessionDuration, setSessionDuration] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [cancellingItemId, setCancellingItemId] = useState(null);
  const [cancelConfirmItem, setCancelConfirmItem] = useState(null);
  const [cancelQuantity, setCancelQuantity] = useState(1);
  const [showCancelReceiptPreview, setShowCancelReceiptPreview] = useState(false);
  const [cancelReceiptHTML, setCancelReceiptHTML] = useState(null);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pendingCancelItemId, setPendingCancelItemId] = useState(null);
  const [pendingCancelQuantity, setPendingCancelQuantity] = useState(null);
  const [showCancelEntireTableModal, setShowCancelEntireTableModal] = useState(false);
  const [cancellingEntireTable, setCancellingEntireTable] = useState(false);
  const [cancelEntireTableReason, setCancelEntireTableReason] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [showTransferItemsModal, setShowTransferItemsModal] = useState(false);
  const [transferStep, setTransferStep] = useState(1);
  const [transferQuantities, setTransferQuantities] = useState({});
  const [selectedTargetTableId, setSelectedTargetTableId] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [showSplitFractionPanel, setShowSplitFractionPanel] = useState(false);
  const [processingSplitPayment, setProcessingSplitPayment] = useState(false);
  const [showAmountPaymentModal, setShowAmountPaymentModal] = useState(false);
  const [amountPaymentValue, setAmountPaymentValue] = useState('');
  const [showGiftSelectModal, setShowGiftSelectModal] = useState(false);
  /** @type {Record<string, number>} grup anahtarı → ikram adedi (0 = atla) */
  const [giftQtyByGroupKey, setGiftQtyByGroupKey] = useState({});
  const [applyingGift, setApplyingGift] = useState(false);
  const [imageByProductId, setImageByProductId] = useState({});
  const [showPartialPay, setShowPartialPay] = useState(false);
  const [partialKeys, setPartialKeys] = useState(() => new Set());
  const [partialMethodOpen, setPartialMethodOpen] = useState(false);
  const [partialProcessing, setPartialProcessing] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  if (!order) return null;
  const singularLabel = customerMode ? 'Müşteri' : 'Masa';

  // Aynı ürünleri grupla ve toplam miktarı göster
  const groupedItems = useMemo(() => {
    const grouped = new Map();
    
    items.forEach(item => {
      // product_id ve isGift'e göre grup key'i oluştur
      const key = `${item.product_id}_${item.isGift || false}`;
      
      if (!grouped.has(key)) {
        // İlk kez görülen ürün
        grouped.set(key, {
          ...item,
          // Tüm item ID'lerini sakla (iptal işlemleri için)
          allItemIds: [item.id],
          // Orijinal item'ları sakla (detay için)
          originalItems: [item]
        });
      } else {
        // Aynı ürün bulundu, miktarları topla
        const existing = grouped.get(key);
        existing.quantity += item.quantity;
        existing.paid_quantity = (existing.paid_quantity || 0) + (item.paid_quantity || 0);
        existing.is_paid = existing.is_paid && item.is_paid; // Her ikisi de ödenmişse true
        // Payment method'ları birleştir
        if (item.payment_method && existing.payment_method) {
          if (existing.payment_method !== item.payment_method) {
            existing.payment_method = `${existing.payment_method}, ${item.payment_method}`;
          }
        } else if (item.payment_method) {
          existing.payment_method = item.payment_method;
        }
        // ID'leri ve orijinal item'ları ekle
        existing.allItemIds.push(item.id);
        existing.originalItems.push(item);
      }
    });
    
    return Array.from(grouped.values());
  }, [items]);

  const groupRowKey = (g) => `${g.product_id}_${g.isGift || false}`;

  const groupUnits = (item) => {
    const rows = item.originalItems?.length ? item.originalItems : [item];
    const units = [];
    rows.forEach((row) => {
      if (!row || row.isGift) return;
      const qty = Number(row.quantity) || 0;
      const paidQty = Math.max(0, Math.min(qty, Number(row.paid_quantity) || 0));
      const price = Number(row.price) || 0;
      let cover = Math.max(0, Number(row.amount_settled) || 0);
      const method = String(row.payment_method || '');
      const closedByAmount = /tutarl/i.test(method) && !/nakit|kredi|kart/i.test(method);
      for (let i = 0; i < qty; i += 1) {
        const base = { key: `${row.id}__${i}`, itemId: row.id, price };
        if (i < paidQty) {
          units.push({ ...base, paid: true, status: closedByAmount ? 'tutarli' : 'paid', due: 0, covered: price });
          continue;
        }
        if (price > 0 && cover >= price - 0.009) {
          cover = roundMoney(cover - price);
          units.push({ ...base, paid: true, status: 'tutarli', due: 0, covered: price });
          continue;
        }
        if (cover > 0.009) {
          const due = roundMoney(Math.max(0, price - cover));
          const covered = roundMoney(Math.max(0, price - due));
          cover = 0;
          units.push({ ...base, paid: false, status: 'partial', due, covered });
          continue;
        }
        units.push({ ...base, paid: false, status: 'open', due: price, covered: 0 });
      }
    });
    return units;
  };

  const exitPartialPay = () => {
    setShowPartialPay(false);
    setPartialKeys(new Set());
    setPartialMethodOpen(false);
  };

  const selectPartialPrefix = (units, index) => {
    const keys = units.map((unit) => unit.key);
    const prefix = keys.slice(0, index + 1);
    setPartialKeys((prev) => {
      const next = new Set(prev);
      const exact = prefix.every((key) => next.has(key)) && keys.slice(index + 1).every((key) => !next.has(key));
      keys.forEach((key) => next.delete(key));
      if (!exact) prefix.forEach((key) => next.add(key));
      return next;
    });
  };

  const selectedPartialAmount = roundMoney(
    groupedItems.reduce((sum, item) => (
      sum + groupUnits(item).reduce((part, unit) => part + (partialKeys.has(unit.key) ? unit.due : 0), 0)
    ), 0)
  );

  const confirmPartialPay = async (paymentMethod) => {
    const byItem = new Map();
    groupedItems.forEach((item) => {
      groupUnits(item).forEach((unit) => {
        if (unit.paid || !partialKeys.has(unit.key) || unit.due <= 0.009) return;
        const prev = byItem.get(unit.itemId) || { itemId: unit.itemId, quantity: 0, amount: 0 };
        prev.quantity += 1;
        prev.amount = roundMoney(prev.amount + unit.due);
        byItem.set(unit.itemId, prev);
      });
    });
    const payments = Array.from(byItem.values());
    if (!payments.length) return;
    if (!window.electronAPI?.payTableOrderItemsBulk) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }
    setPartialProcessing(true);
    try {
      const result = await window.electronAPI.payTableOrderItemsBulk({ payments, paymentMethod });
      if (!result?.success) {
        showToast(result?.error || 'Ödeme alınamadı', 'error');
        return;
      }
      setPartialMethodOpen(false);
      setPartialKeys(new Set());
      setShowPartialPay(false);
      showToast('Kısmi ödeme alındı', 'success');
      if (onPartialComplete) await onPartialComplete(result.results || []);
    } catch (error) {
      showToast(error?.message || 'Ödeme alınamadı', 'error');
    } finally {
      setPartialProcessing(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const ids = [...new Set((items || []).map((item) => item.product_id).filter((id) => id != null))];
    const known = {};
    ids.forEach((id) => {
      const cached = getCachedProductImageUrl(id);
      if (cached) known[String(id)] = cached;
    });
    if (Object.keys(known).length) setImageByProductId((prev) => ({ ...prev, ...known }));
    const missing = ids.filter((id) => !getCachedProductImageUrl(id));
    if (!missing.length || !window.electronAPI?.getProducts) {
      return () => { alive = false; };
    }
    window.electronAPI.getProducts(null).then(async (products) => {
      if (!alive || !Array.isArray(products)) return;
      const pairs = await Promise.all(missing.map(async (id) => {
        const product = products.find((p) => String(p.id) === String(id));
        if (!product?.image) return null;
        registerProductImage(id, product.image);
        const url = await resolveProductImage(id, product.image);
        return url ? [String(id), url] : null;
      }));
      if (!alive) return;
      const next = {};
      pairs.forEach((pair) => {
        if (pair) next[pair[0]] = pair[1];
      });
      if (Object.keys(next).length) setImageByProductId((prev) => ({ ...prev, ...next }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [items]);

  const giftEligibleGroups = useMemo(
    () =>
      groupedItems
        .map((g) => {
          if (g.isGift) return { ...g, giftableQty: 0 };
          const giftableQty = groupUnits(g).filter((unit) => !unit.paid && unit.due > 0.009).length;
          return { ...g, giftableQty };
        })
        .filter((g) => g.giftableQty > 0),
    [groupedItems]
  );

  const setGiftQtyForGroup = (key, maxQty, rawValue) => {
    const n = parseInt(String(rawValue).trim(), 10);
    let v = Number.isFinite(n) ? n : 0;
    if (v < 0) v = 0;
    if (v > maxQty) v = maxQty;
    setGiftQtyByGroupKey((prev) => ({ ...prev, [key]: v }));
  };

  const adjustGiftQty = (key, maxQty, delta) => {
    const cur = Math.max(0, Math.min(maxQty, Number(giftQtyByGroupKey[key]) || 0));
    const next = Math.max(0, Math.min(maxQty, cur + delta));
    setGiftQtyByGroupKey((prev) => ({ ...prev, [key]: next }));
  };

  const hasAnyGiftQty = useMemo(
    () =>
      giftEligibleGroups.some((g) => {
        const k = groupRowKey(g);
        const q = Math.min(
          Math.max(0, Number(giftQtyByGroupKey[k]) || 0),
          Number(g.giftableQty) || 0
        );
        return q > 0;
      }),
    [giftEligibleGroups, giftQtyByGroupKey]
  );

  const handleConfirmGiftSelection = async () => {
    const allocations = giftEligibleGroups
      .map((g) => {
        const k = groupRowKey(g);
        const maxQ = Number(g.giftableQty) || 0;
        const raw = Number(giftQtyByGroupKey[k]) || 0;
        const q = Math.min(Math.max(0, Math.floor(raw)), maxQ);
        return q > 0 ? { groupKey: k, giftQuantity: q } : null;
      })
      .filter(Boolean);
    if (allocations.length === 0) {
      showToast('En az bir ürün için ikram adedi girin (1 veya daha fazla)', 'warning');
      return;
    }
    if (!window.electronAPI?.setTableOrderItemsAsGift) {
      showToast('İkram işlemi bu sürümde kullanılamıyor', 'error');
      return;
    }
    setApplyingGift(true);
    try {
      const result = await window.electronAPI.setTableOrderItemsAsGift(order.id, { allocations });
      if (result?.success) {
        const n = result.appliedGiftUnits ?? result.updatedCount ?? 0;
        showToast(`${n} adet ikram olarak işlendi`, 'success');
        setShowGiftSelectModal(false);
        setGiftQtyByGroupKey({});
        if (typeof onGiftApplied === 'function') onGiftApplied();
      } else {
        showToast(result?.error || 'İkram uygulanamadı', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(e?.message || 'İkram uygulanamadı', 'error');
    } finally {
      setApplyingGift(false);
    }
  };

  // Oturum süresini canlı olarak hesapla
  useEffect(() => {
    const calculateSessionDuration = () => {
      // Türkçe tarih formatını parse et
      const [day, month, year] = order.order_date.split('.');
      const [orderHours, orderMinutes, orderSeconds] = order.order_time.split(':');
      const orderDateTime = new Date(year, month - 1, day, orderHours, orderMinutes, orderSeconds || 0);
      const now = new Date();
      const diffMs = now - orderDateTime;
      
      if (diffMs < 0) return '0 dakika';
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffMinutes = diffMins % 60;
      
      if (diffHours > 0) {
        return `${diffHours} saat ${diffMinutes} dakika`;
      }
      return `${diffMinutes} dakika`;
    };

    // İlk hesaplama
    setSessionDuration(calculateSessionDuration());

    // Her saniye güncelle
    const interval = setInterval(() => {
      setSessionDuration(calculateSessionDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [order.order_date, order.order_time]);

  // Başlangıç toplam tutarı (ikram edilen ürünler hariç) - groupedItems kullan
  const originalTotalAmount = groupedItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + (item.price * item.quantity);
  }, 0);
  // Ödemesi alınan ürünlerin toplam tutarı (kısmi ödemeler dahil) - groupedItems kullan
  const paidAmount = groupedItems.reduce((sum, item) => {
    if (item.isGift) return sum;
    const paidQty = item.paid_quantity || 0;
    return sum + (item.price * paidQty);
  }, 0);
  // Kalan tutar: Toplam - Ödenen (doğru hesaplama)
  const remainingAmount = originalTotalAmount - paidAmount;
  
  // Parçalı ödeme için kalan tutar (backend'den gelen total_amount kullanılabilir)
  const remainingFromBackend = Number(order?.total_amount);
  const useBackendRemaining = typeof remainingFromBackend === 'number' && remainingFromBackend >= 0;
  const splitPaymentRemainingAmount = useBackendRemaining
    ? roundMoney(remainingFromBackend)
    : roundMoney(remainingAmount);
  
  // Parçalı ödeme ile ödenen tutar (tutar bazlı parçalı ödeme varsa) — güncel sepet toplamına göre (yeni ürün sonrası da doğru)
  const basisOrderTotal = roundMoney(originalTotalAmount);
  const partialPaymentPaid = roundMoney(basisOrderTotal - splitPaymentRemainingAmount);
  const hasPartialPayment = partialPaymentPaid > 0.01; // Parçalı ödeme yapılmış mı?

  // Tutarlı ödeme: Kullanıcının girdiği tutar ile ödeme
  const handleAmountPayment = async (amount) => {
    const payAmount = roundMoney(Number(amount));
    if (payAmount <= 0) {
      showToast('Geçersiz tutar', 'warning');
      return;
    }
    if (payAmount > splitPaymentRemainingAmount) {
      showToast(`Girilen tutar kalan tutardan (₺${splitPaymentRemainingAmount.toFixed(2)}) fazla olamaz`, 'warning');
      return;
    }
    if (!window.electronAPI?.createPartialPaymentSale || !window.electronAPI?.updateTableOrderAmount) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h3 class="text-xl font-bold text-white mb-1">Tutarlı Ödeme</h3>
            <p class="text-sm text-white/90">Tutar: ₺${payAmount.toFixed(2)}</p>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <button id="cashBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-fuchsia-500 theme-sultan:from-green-500 to-pink-500 theme-sultan:to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  <span class="text-base">Nakit</span>
                </div>
              </button>
              <button id="cardBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                  <span class="text-base">Kredi Kartı</span>
                </div>
              </button>
            </div>
            <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">İptal</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#cashBtn').onclick = () => { document.body.removeChild(modal); resolve('Nakit'); };
      modal.querySelector('#cardBtn').onclick = () => { document.body.removeChild(modal); resolve('Kredi Kartı'); };
      modal.querySelector('#cancelBtn').onclick = () => { document.body.removeChild(modal); resolve(null); };
    });

    if (!paymentMethod) return;

    setProcessingSplitPayment(true);
    setShowAmountPaymentModal(false);
    setAmountPaymentValue('');

    try {
      const saleResult = await window.electronAPI.createPartialPaymentSale({
        orderId: order.id,
        totalAmount: payAmount,
        paymentMethod,
        tableName: order.table_name || '',
        tableType: order.table_type || 'inside',
        paymentKind: 'tutarli'
      });
      if (!saleResult?.success) {
        showToast(saleResult?.error || 'Satış kaydı oluşturulamadı', 'error');
        return;
      }
      const amountResult = await window.electronAPI.updateTableOrderAmount(order.id, payAmount);
      if (!amountResult?.success) {
        showToast('Sipariş tutarı güncellenemedi: ' + (amountResult?.error || ''), 'error');
        return;
      }
      showToast(`Tutarlı ödeme alındı: ₺${payAmount.toFixed(2)}`, 'success');
      if (onItemCancelled) {
        await onItemCancelled();
      }
    } catch (err) {
      console.error('Tutarlı ödeme hatası:', err);
      showToast('Ödeme alınamadı: ' + (err.message || ''), 'error');
    } finally {
      setProcessingSplitPayment(false);
    }
  };

  // Parçalı ödeme: 1/2, 1/3, ... 1/10 — güncel sipariş toplamının 1/x'i, kalandan fazla olamaz (UI ile aynı)
  const handleSplitFractionPayment = async (denominator) => {
    const remaining = splitPaymentRemainingAmount;
    if (remaining <= 0) {
      showToast('Kalan tutar yok', 'info');
      return;
    }
    const basisTotal = roundMoney(originalTotalAmount);
    const fractionAmount = Math.floor(basisTotal / denominator);
    const payAmount = Math.min(fractionAmount, Math.floor(remaining));
    if (payAmount <= 0) {
      showToast('Kalan tutar bu bölme için uygun değil', 'info');
      return;
    }
    if (!window.electronAPI?.createPartialPaymentSale || !window.electronAPI?.updateTableOrderAmount) {
      showToast('Ödeme işlemi şu anda kullanılamıyor', 'error');
      return;
    }

    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-violet-600 to-pink-600 theme-sultan:to-emerald-600 px-6 py-4">
            <h3 class="text-xl font-bold text-white mb-1">Parçalı Ödeme 1/${denominator}</h3>
            <p class="text-sm text-white/90">Tutar: ₺${payAmount} (başlangıç toplamının 1/${denominator}'i, tam lira)</p>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <button id="cashBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-fuchsia-500 theme-sultan:from-green-500 to-pink-500 theme-sultan:to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  <span class="text-base">Nakit</span>
                </div>
              </button>
              <button id="cardBtn" class="p-5 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all transform">
                <div class="flex flex-col items-center space-y-2">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                  <span class="text-base">Kredi Kartı</span>
                </div>
              </button>
            </div>
            <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">İptal</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#cashBtn').onclick = () => { document.body.removeChild(modal); resolve('Nakit'); };
      modal.querySelector('#cardBtn').onclick = () => { document.body.removeChild(modal); resolve('Kredi Kartı'); };
      modal.querySelector('#cancelBtn').onclick = () => { document.body.removeChild(modal); resolve(null); };
    });

    if (!paymentMethod) return;

    setProcessingSplitPayment(true);
    setShowSplitFractionPanel(false);

    try {
      // Sadece toplam tutara göre: 1/x taksit tutarını al, kalemlere dağıtma
      const saleResult = await window.electronAPI.createPartialPaymentSale({
        orderId: order.id,
        totalAmount: payAmount,
        paymentMethod,
        tableName: order.table_name || '',
        tableType: order.table_type || 'inside',
        paymentKind: 'bolmeli'
      });
      if (!saleResult?.success) {
        showToast(saleResult?.error || 'Satış kaydı oluşturulamadı', 'error');
        return;
      }
      const amountResult = await window.electronAPI.updateTableOrderAmount(order.id, payAmount);
      if (!amountResult?.success) {
        showToast('Sipariş tutarı güncellenemedi: ' + (amountResult?.error || ''), 'error');
        return;
      }
      showToast(`Parçalı ödeme (1/${denominator}) alındı: ₺${payAmount}`, 'success');
      // Modal'ı yenilemek için onItemCancelled callback'ini kullan (sipariş detaylarını yeniler)
      if (onItemCancelled) {
        await onItemCancelled();
      }
    } catch (err) {
      console.error('Parçalı ödeme hatası:', err);
      showToast('Ödeme alınamadı: ' + (err.message || ''), 'error');
    } finally {
      setProcessingSplitPayment(false);
    }
  };

  // Ürün iptal etme fonksiyonu - direkt iptal açıklaması modalına gider
  const handleCancelItem = (item) => {
    if (!window.electronAPI || !window.electronAPI.cancelTableOrderItem) {
      showToast('İptal işlemi şu anda kullanılamıyor', 'error');
      return;
    }
    setPendingCancelItemId(item.id);
    setPendingCancelQuantity(item.quantity);
    setCancelQuantity(item.quantity);
    setCancelReason('');
    setShowCancelReasonModal(true);
  };

  // İptal fişi önizleme
  const handlePreviewCancelReceipt = async () => {
    if (!cancelConfirmItem) return;

    if (!window.electronAPI || !window.electronAPI.previewCancelReceipt) {
      showToast('Fiş önizleme özelliği şu anda kullanılamıyor', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.previewCancelReceipt(cancelConfirmItem.id, cancelQuantity);
      if (result.success) {
        setCancelReceiptHTML(result.html);
        setShowCancelReceiptPreview(true);
      } else {
        showToast(result.error || 'Fiş önizlemesi oluşturulamadı', 'error');
      }
    } catch (error) {
      console.error('Fiş önizleme hatası:', error);
      showToast('Fiş önizlemesi oluşturulurken bir hata oluştu', 'error');
    }
  };

  // İptal onayı
  const confirmCancelItem = async () => {
    if (!cancelConfirmItem) return;

    if (cancelQuantity <= 0 || cancelQuantity > cancelConfirmItem.quantity) {
      showToast('Geçersiz iptal miktarı', 'warning');
      return;
    }

    // İlk istek: Açıklama boş, sadece açıklama modal'ını aç (fiş yazdırma)
    setPendingCancelItemId(cancelConfirmItem.id);
    setPendingCancelQuantity(cancelQuantity);
    setCancelConfirmItem(null);
    setShowCancelReceiptPreview(false);
    setCancelReceiptHTML(null);
    setShowCancelReasonModal(true);
    setCancelReason('');
    setCancellingItemId(null);
  };

  // İptal açıklaması gönder
  const submitCancelReason = async () => {
    if (!cancelReason.trim()) {
      showToast('Lütfen iptal açıklaması yazın', 'warning');
      return;
    }

    if (!pendingCancelItemId || !pendingCancelQuantity) {
      showToast('İptal işlemi bulunamadı', 'error');
      setShowCancelReasonModal(false);
      return;
    }

    const qtyToCancel = Math.max(1, Math.min(cancelQuantity || 1, pendingCancelQuantity || 1));

    // Gruplanmış item'ı bul (eğer varsa)
    const groupedItem = groupedItems.find(item => item.id === pendingCancelItemId || item.allItemIds?.includes(pendingCancelItemId));
    
    // Modalı anında kapat - kullanıcı beklemez
    setShowCancelReasonModal(false);
    setCancelReason('');
    setPendingCancelItemId(null);
    setPendingCancelQuantity(null);

    // Eğer gruplanmış item varsa ve birden fazla item varsa, toplu iptal kullan
    if (groupedItem && groupedItem.originalItems && groupedItem.originalItems.length > 1) {
      // Tüm item'ları toplu iptal için hazırla
      let remainingQuantity = qtyToCancel;
      const itemsToCancel = [];
      
      for (const originalItem of groupedItem.originalItems) {
        if (remainingQuantity <= 0) break;
        
        // Bu item'dan ne kadar iptal edilecek?
        const quantityToCancel = Math.min(remainingQuantity, originalItem.quantity);
        itemsToCancel.push({
          itemId: originalItem.id,
          quantity: quantityToCancel
        });
        
        remainingQuantity -= quantityToCancel;
      }
      
      // API arka planda - sonuç gelince listeyi yenile
      window.electronAPI.cancelTableOrderItemsBulk(itemsToCancel, cancelReason.trim())
        .then((result) => {
          if (result.success && onItemCancelled) onItemCancelled();
          else if (!result.success) showToast(result.error || 'İptal açıklaması kaydedilemedi', 'error');
        })
        .catch((error) => {
          console.error('İptal açıklaması kaydetme hatası:', error);
          showToast('İptal açıklaması kaydedilirken bir hata oluştu', 'error');
        });
    } else {
      // Normal iptal (tek item veya gruplanmamış) - API arka planda
      window.electronAPI.cancelTableOrderItem(pendingCancelItemId, qtyToCancel, cancelReason.trim())
        .then((result) => {
          if (result.success && onItemCancelled) onItemCancelled();
          else if (!result.success) showToast(result.error || 'İptal açıklaması kaydedilemedi', 'error');
        })
        .catch((error) => {
          console.error('İptal açıklaması kaydetme hatası:', error);
          showToast('İptal açıklaması kaydedilirken bir hata oluştu', 'error');
        });
    }
  };

  const isSultanBranch = branchKey === 'sultansomati';
  const isSuriciBranch = branchKey === 'makarasur';
  const insideCount = isSultanBranch ? 0 : (isSuriciBranch ? 20 : MAKARA_HAVZAN_MAIN_TABLE_COUNT);
  const insideTables = useMemo(() => Array.from({ length: insideCount }, (_, i) => ({ id: `inside-${i + 1}`, name: `Masa ${i + 1}` })), [insideCount]);
  const outsideTables = useMemo(
    () =>
      isSuriciBranch
        ? MAKARA_SURICI_OUTSIDE_TABLE_NUMBERS.map((n) => ({ id: `outside-${n}`, name: `Masa ${n}` }))
        : [],
    [isSuriciBranch]
  );
  const packageTables = useMemo(() => [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `package-inside-${i + 1}`, name: `Paket ${i + 1}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `package-outside-${i + 1}`, name: `Paket ${i + 1}` }))
  ], []);
  const allTablesForTransfer = useMemo(() => {
    if (!showTransferItemsModal || transferStep !== 2) return [];
    if (isSultanBranch) {
      return buildSultanTablesFlat()
        .map((t) => ({ id: t.id, name: t.name }))
        .filter((t) => t.id !== order?.table_id);
    }
    const all = [...insideTables, ...outsideTables, ...packageTables];
    return all.filter((t) => t.id !== order?.table_id);
  }, [showTransferItemsModal, transferStep, isSultanBranch, insideTables, outsideTables, packageTables, order?.table_id]);

  const getTransferKey = (item) => `${item.product_id}_${!!item.isGift}`;
  const getTransferableQty = (item) => Math.max(0, (item.quantity || 0) - (item.paid_quantity || 0));
  const selectedTransferTotal = useMemo(() => {
    return groupedItems.reduce((sum, item) => {
      const qty = transferQuantities[getTransferKey(item)] || 0;
      return sum + (Number(qty) || 0);
    }, 0);
  }, [groupedItems, transferQuantities]);
  const setTransferQty = (item, delta) => {
    const key = getTransferKey(item);
    const max = getTransferableQty(item);
    const current = Math.max(0, Math.min(max, (transferQuantities[key] || 0) + delta));
    setTransferQuantities(prev => ({ ...prev, [key]: current }));
  };

  const handleTransferItemsConfirm = async () => {
    if (!selectedTargetTableId || !window.electronAPI?.transferOrderItems || selectedTransferTotal <= 0) return;
    const itemsToTransfer = groupedItems
      .map(item => {
        const qty = transferQuantities[getTransferKey(item)] || 0;
        if ((qty || 0) <= 0) return null;
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: qty,
          price: item.price,
          isGift: !!item.isGift,
          staff_name: item.originalItems?.[0]?.staff_name || null
        };
      })
      .filter(Boolean);
    if (itemsToTransfer.length === 0) return;
    setTransferring(true);
    try {
      const result = await window.electronAPI.transferOrderItems(order.id, selectedTargetTableId, itemsToTransfer);
      if (result?.success) {
        showToast(`Seçilen ürünler aktarıldı, kategori bazlı fiş yazdırılıyor`, 'success');
        setShowTransferItemsModal(false);
        setTransferStep(1);
        setTransferQuantities({});
        setSelectedTargetTableId(null);
        if (onTransferItems) onTransferItems();
        onClose();
      } else {
        showToast(result?.error || 'Aktarım yapılamadı', 'error');
      }
    } catch (err) {
      console.error('Ürün aktarım hatası:', err);
      showToast('Aktarım sırasında hata oluştu', 'error');
    } finally {
      setTransferring(false);
    }
  };

  const tableTypeLabel = (() => {
    const type = order.table_type;
    if (type === 'inside') return 'İç';
    if (type === 'outside') return 'Dış';
    if (type === 'package' || type === 'paket') return 'Paket';
    if (type === 'online') return 'Online';
    return type || singularLabel;
  })();
  const dueAmount = (hasPartialPayment || partialPaymentPaid > 0.01 || paidAmount > 0.01)
    ? splitPaymentRemainingAmount
    : originalTotalAmount;

  const lockVeil = () => (
    showPartialPay ? (
      <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/75">
        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
    ) : null
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6 animate-fade-in"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-5 py-6 text-white theme-sultan:from-emerald-600 theme-sultan:via-teal-600 theme-sultan:to-cyan-700 sm:px-8">
          <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-5">
            {showPartialPay && (
              <button
                type="button"
                onClick={exitPartialPay}
                className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
              >
                Siparişe dön
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Kapat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mx-auto max-w-3xl px-12 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/70">{showPartialPay ? 'Kısmi ödeme' : 'Sipariş detayı'}</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{order.table_name}</h2>
          </div>
          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-[28px] bg-white/15 px-5 py-3.5 backdrop-blur-md">
            {[
              ['Tip', tableTypeLabel],
              ['Tarih', order.order_date],
              ['Saat', order.order_time],
              ['Süre', sessionDuration || '—'],
              ...(order.staff_name ? [['Garson', order.staff_name]] : []),
            ].map(([label, value], index, list) => (
              <div key={label} className="flex items-center gap-4">
                <div className="min-w-[4.5rem] text-center">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
                </div>
                {index < list.length - 1 && <span className="hidden h-7 w-px bg-white/25 sm:block" />}
              </div>
            ))}
          </div>
          {order.status === 'pending' && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {groupedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTransferStep(1); setTransferQuantities({}); setSelectedTargetTableId(null); setShowTransferItemsModal(true); }}
                  disabled={showPartialPay}
                  className="relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Ürün aktar
                  {lockVeil()}
                </button>
              )}
              <button
                type="button"
                onClick={onAddItems}
                disabled={showPartialPay}
                className="relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Sipariş ekle
                {lockVeil()}
              </button>
              {giftEligibleGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setGiftQtyByGroupKey({});
                    setShowGiftSelectModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  İkram seç
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCancelEntireTableModal(true)}
                disabled={showPartialPay}
                className="relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-rose-300/30 px-4 py-2.5 text-sm font-semibold text-rose-50 ring-1 ring-rose-200/40 transition hover:bg-rose-300/45 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {customerMode ? 'Tüm müşteriyi iptal et' : 'Tüm masayı iptal et'}
                {lockVeil()}
              </button>
            </div>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-0 flex-col border-b border-slate-100 lg:border-b-0 lg:border-r">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
              {itemsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <svg className="mb-3 h-8 w-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-medium">Ürünler yükleniyor</p>
                </div>
              ) : groupedItems.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-400">Bu masada ürün yok</p>
              ) : groupedItems.map((item) => {
                const isGift = item.isGift || false;
                const isPaid = item.is_paid || false;
                const paidQuantity = item.paid_quantity || 0;
                const remainingQuantity = item.quantity - paidQuantity;
                const paymentMethod = item.payment_method || null;
                const displayTotal = isGift ? 0 : (item.price * item.quantity);
                const units = groupUnits(item);
                const rowKey = groupRowKey(item);
                const imageSrc = imageByProductId[String(item.product_id)] || '';
                const selectedUnits = units.filter((unit) => partialKeys.has(unit.key));
                const selectedCount = selectedUnits.length;
                const selectedSum = roundMoney(selectedUnits.reduce((sum, unit) => sum + unit.due, 0));
                const lineRemaining = roundMoney(units.reduce((sum, unit) => sum + unit.due, 0));
                const tutarliCount = units.filter((unit) => unit.status === 'tutarli').length;
                const partialUnit = units.find((unit) => unit.status === 'partial');
                const selectableUnits = units.filter((unit) => !unit.paid && unit.due > 0.009);
                const methodMentionsAmount = /tutarl/i.test(paymentMethod || '');
                const showBrokenPrice = !!partialUnit && tutarliCount === 0 && selectableUnits.length <= 1;
                const qtyWas = Number(item.quantity) || 0;
                const qtyLeft = isGift ? qtyWas : units.filter((unit) => !unit.paid && unit.due > 0.009).length;
                const qtyChanged = !isGift && qtyLeft < qtyWas;
                const splitCard = showPartialPay && units.length > 0;
                const renderParcel = (unit, index, edge) => {
                  const settled = unit.paid || unit.due <= 0.009;
                  const picked = !settled && partialKeys.has(unit.key);
                  const selectableIndex = selectableUnits.findIndex((entry) => entry.key === unit.key);
                  return (
                    <button
                      key={unit.key}
                      type="button"
                      disabled={partialProcessing || settled}
                      onClick={() => {
                        if (settled || selectableIndex < 0) return;
                        selectPartialPrefix(selectableUnits, selectableIndex);
                      }}
                      title={settled ? 'Ödendi' : `₺${unit.due.toFixed(2)}`}
                      className={`flex min-w-0 items-center justify-center text-sm font-black leading-none ${
                        edge === 'row' ? 'h-12' : 'flex-1'
                      } ${edge === 'row' && index % 10 !== 0 ? 'border-l' : ''} ${
                        edge !== 'row' ? 'border-l' : ''
                      } ${
                        settled
                          ? 'cursor-default border-red-700/30 bg-red-600 text-white'
                          : picked
                          ? 'border-emerald-600/25 bg-emerald-500 text-white'
                          : 'border-slate-200/90 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      {settled ? (
                        <span className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] leading-none line-through">{index + 1}</span>
                          <span className="text-[8px] font-black uppercase leading-none tracking-tight">Ödendi</span>
                        </span>
                      ) : (
                        index + 1
                      )}
                    </button>
                  );
                };
                return (
                  <div
                    key={rowKey}
                    className={`flex flex-col overflow-hidden rounded-2xl border ${
                      isPaid
                        ? 'border-emerald-100 bg-emerald-50/60'
                        : isGift
                        ? 'border-amber-100 bg-amber-50/70'
                        : 'border-slate-200/80 bg-white'
                    } ${showPartialPay && isGift ? 'brightness-[0.45]' : ''}`}
                  >
                    <div className="flex min-w-0">
                    <div className={`flex min-w-0 items-center gap-3 px-3 py-2.5 ${splitCard ? 'w-[52%] shrink-0' : 'flex-1'}`}>
                    <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center leading-none">
                      {qtyLeft > 0 ? (
                        <>
                          {qtyChanged && (
                            <span className="mb-1 text-sm font-medium tracking-tight text-slate-300 line-through">{qtyWas}x</span>
                          )}
                          <span className="text-4xl font-black tracking-tight text-slate-900">{qtyLeft}x</span>
                        </>
                      ) : (
                        <span className="text-2xl font-black tracking-tight text-slate-300 line-through">{qtyWas}x</span>
                      )}
                    </div>
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {imageSrc ? (
                        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                          {(item.product_name || '?').slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-[15px] font-semibold text-slate-900 ${isPaid || isGift ? 'line-through text-slate-400' : ''}`}>
                          {item.product_name}
                        </p>
                        {isGift && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">İkram</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {isGift ? (
                          <span className="line-through">₺{item.price.toFixed(2)}</span>
                        ) : showBrokenPrice ? (
                          <>
                            <span className="text-slate-400 line-through">₺{partialUnit.price.toFixed(2)}</span>
                            <span className="ml-1.5 font-semibold text-slate-900">₺{partialUnit.due.toFixed(2)}</span>
                          </>
                        ) : (
                          `₺${item.price.toFixed(2)}`
                        )}
                      </p>
                      {showBrokenPrice && (
                        <p className="mt-0.5 text-[10px] leading-none text-slate-400">tutarlı ödemeden dolayı</p>
                      )}
                      {tutarliCount > 0 && !methodMentionsAmount && (
                        <p className="mt-1 text-xs text-slate-500">{tutarliCount} adet tutarlı ödeme</p>
                      )}
                      {paidQuantity > 0 && paymentMethod && (
                        <p className="mt-1 text-xs text-slate-500">
                          {paidQuantity} adet {paymentMethod}
                          {!isPaid && ` · ${remainingQuantity} kaldı`}
                        </p>
                      )}
                    </div>
                    {!splitCard && (
                    <div className="flex shrink-0 items-center gap-2 pr-2">
                      <div className="text-right">
                        {selectedCount > 0 && (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Seçilen</p>
                        )}
                        <p className={`text-base font-semibold leading-none ${isGift || isPaid ? 'text-slate-400 line-through' : selectedCount > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                          {selectedCount > 0
                            ? `₺${selectedSum.toFixed(2)}`
                            : !isGift && lineRemaining + 0.009 < displayTotal
                            ? `₺${lineRemaining.toFixed(2)}`
                            : `₺${displayTotal.toFixed(2)}`}
                        </p>
                        {selectedCount === 0 && !isGift && lineRemaining + 0.009 < displayTotal && (
                          <p className="mt-1 text-xs text-slate-400 line-through">₺{displayTotal.toFixed(2)}</p>
                        )}
                      </div>
                      <>
                      <button
                        type="button"
                        onClick={() => setSelectedItemDetail(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="Detay"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelItem(item)}
                          disabled={cancellingItemId === item.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          title="İptal"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      </>
                    </div>
                    )}
                    </div>
                    {splitCard && (
                      <div className="flex min-w-0 flex-1">
                        {units.slice(0, 10).map((unit, index) => renderParcel(unit, index, 'side'))}
                      </div>
                    )}
                    </div>
                    {splitCard && units.slice(10).reduce((rows, unit, offset) => {
                      const rowIndex = Math.floor(offset / 10);
                      if (!rows[rowIndex]) rows[rowIndex] = [];
                      rows[rowIndex].push({ unit, index: offset + 10 });
                      return rows;
                    }, []).map((row) => (
                      <div key={row[0].index} className="grid grid-cols-10 border-t border-slate-200">
                        {row.map(({ unit, index }) => renderParcel(unit, index, 'row'))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-2 bg-slate-50/80 p-3">
            <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kalan</p>
              <p className="mt-0.5 text-3xl font-black tracking-tight text-slate-900">₺{Number(dueAmount).toFixed(2)}</p>
              {originalTotalAmount - dueAmount > 0.01 && (
                <p className="text-xs text-slate-400 line-through">₺{originalTotalAmount.toFixed(2)}</p>
              )}
            </div>
            {order.status === 'pending' ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <button type="button" onClick={onRequestAdisyon} disabled={showPartialPay} className={`relative flex items-stretch overflow-hidden rounded-2xl bg-amber-500 text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed ${showPartialPay ? 'h-[4.5rem] shrink-0' : 'min-h-0 flex-1'}`}>
                  <span className="relative flex aspect-[1/2] shrink-0 items-center justify-center self-stretch">
                    <span className="absolute inset-0 rounded-r-full bg-amber-950/45 shadow-[inset_-10px_0_16px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]" />
                    <svg className="relative z-10 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </span>
                  <span className="flex flex-1 items-center justify-center whitespace-nowrap px-1 text-center text-[28px] font-black leading-none tracking-tight [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_10px_rgba(0,0,0,0.35)]">Adisyon yazdır</span>
                  {lockVeil()}
                </button>
                <button
                  type="button"
                  disabled={partialProcessing}
                  onClick={async () => {
                    if (!showPartialPay) {
                      if (onPartialPayment) await onPartialPayment();
                      setPartialKeys(new Set());
                      setShowPartialPay(true);
                      return;
                    }
                    if (selectedPartialAmount <= 0.009) {
                      exitPartialPay();
                      return;
                    }
                    setPartialMethodOpen(true);
                  }}
                  className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-40"
                >
                  {showPartialPay ? (
                    <span className="flex flex-col items-center px-3">
                      <span className="text-sm font-medium text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">Seçilen tutar</span>
                      <span className="mt-2 text-6xl font-black leading-none tracking-tight [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]">₺{selectedPartialAmount.toFixed(2)}</span>
                    </span>
                  ) : (
                    <>
                      <span className="relative flex aspect-[1/2] shrink-0 items-center justify-center self-stretch">
                        <span className="absolute inset-0 rounded-r-full bg-emerald-950/40 shadow-[inset_-10px_0_16px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]" />
                        <svg className="relative z-10 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      <span className="flex flex-1 items-center justify-center whitespace-nowrap px-1 text-center text-[28px] font-black leading-none tracking-tight [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_10px_rgba(0,0,0,0.35)]">Kısmi ödeme</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSplitFractionPanel(!showSplitFractionPanel)}
                  disabled={showPartialPay || splitPaymentRemainingAmount <= 0.01 || processingSplitPayment}
                  className={`relative flex items-stretch overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-sm transition hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed theme-sultan:to-emerald-600 theme-sultan:hover:to-emerald-700 ${showPartialPay ? 'h-[4.5rem] shrink-0' : 'min-h-0 flex-1'}`}
                >
                  <span className="relative flex aspect-[1/2] shrink-0 items-center justify-center self-stretch">
                    <span className="absolute inset-0 rounded-r-full bg-violet-950/40 shadow-[inset_-10px_0_16px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] theme-sultan:bg-emerald-950/40" />
                    <svg className="relative z-10 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </span>
                  <span className="flex flex-1 items-center justify-center whitespace-nowrap px-1 text-center text-[28px] font-black leading-none tracking-tight [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_10px_rgba(0,0,0,0.35)]">Bölmeli öde</span>
                  {lockVeil()}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAmountPaymentModal(true);
                    setAmountPaymentValue('');
                  }}
                  disabled={showPartialPay || splitPaymentRemainingAmount <= 0.01 || processingSplitPayment}
                  className={`relative flex items-stretch overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed ${showPartialPay ? 'h-[4.5rem] shrink-0' : 'min-h-0 flex-1'}`}
                >
                  <span className="relative flex aspect-[1/2] shrink-0 items-center justify-center self-stretch">
                    <span className="absolute inset-0 rounded-r-full bg-blue-950/40 shadow-[inset_-10px_0_16px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]" />
                    <svg className="relative z-10 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <span className="flex flex-1 items-center justify-center whitespace-nowrap px-1 text-center text-[28px] font-black leading-none tracking-tight [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_10px_rgba(0,0,0,0.35)]">Tutarlı öde</span>
                  {lockVeil()}
                </button>
                <button type="button" onClick={onCompleteTable} disabled={showPartialPay} className={`relative flex items-stretch overflow-hidden rounded-2xl bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed ${showPartialPay ? 'h-[4.5rem] shrink-0' : 'min-h-0 flex-1'}`}>
                  <span className="relative flex aspect-[1/2] shrink-0 items-center justify-center self-stretch">
                    <span className="absolute inset-0 rounded-r-full bg-red-950/45 shadow-[inset_-10px_0_16px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]" />
                    <svg className="relative z-10 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="flex flex-1 items-center justify-center whitespace-nowrap px-1 text-center text-[28px] font-black leading-none tracking-tight [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_10px_rgba(0,0,0,0.35)]">Sonlandır</span>
                  {lockVeil()}
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-600">
                {order.status === 'completed' ? 'Tamamlandı' : 'İptal edildi'}
              </div>
            )}
          </aside>
        </div>
      </div>

      {partialMethodOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => { if (!partialProcessing) setPartialMethodOpen(false); }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_40px_90px_-24px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-8 py-7 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">Kısmi ödeme</p>
              <p className="mt-2 text-5xl font-black leading-none tracking-tight">₺{selectedPartialAmount.toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <button
                type="button"
                disabled={partialProcessing}
                onClick={() => confirmPartialPay('Nakit')}
                className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-pink-600 py-12 text-xl font-bold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl disabled:opacity-40 theme-sultan:from-emerald-500 theme-sultan:to-emerald-700"
              >
                <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Nakit
              </button>
              <button
                type="button"
                disabled={partialProcessing}
                onClick={() => confirmPartialPay('Kredi Kartı')}
                className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 py-12 text-xl font-bold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl disabled:opacity-40"
              >
                <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                Kredi Kartı
              </button>
            </div>
            <button type="button" disabled={partialProcessing} onClick={() => setPartialMethodOpen(false)} className="mx-6 mb-6 w-[calc(100%-3rem)] rounded-2xl bg-slate-100 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-200">Vazgeç</button>
          </div>
        </div>
      )}

      {/* İptal Onay Modal */}

      {cancelConfirmItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-red-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-100 to-pink-100 theme-sultan:to-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Ürün İptali</h3>
              <p className="text-gray-600 text-sm">Bu ürünü iptal etmek istediğinize emin misiniz?</p>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-pink-50 theme-sultan:to-emerald-50 rounded-2xl p-6 mb-6 border border-red-100">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Ürün Adı</p>
                  <p className="text-lg font-bold text-gray-900">{cancelConfirmItem.product_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Mevcut Adet</p>
                    <p className="text-base font-bold text-gray-900">{cancelConfirmItem.quantity} adet</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Birim Fiyat</p>
                    <p className="text-base font-bold text-gray-900">₺{cancelConfirmItem.price.toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Miktar Seçimi - Sadece 1'den fazla varsa göster */}
                {cancelConfirmItem.quantity > 1 && (
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <p className="text-xs font-semibold text-gray-500 mb-2">İptal Edilecek Adet</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCancelQuantity(Math.max(1, cancelQuantity - 1))}
                        disabled={cancelQuantity <= 1}
                        className="w-10 h-10 rounded-lg bg-white border-2 border-red-300 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={cancelConfirmItem.quantity}
                        value={cancelQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setCancelQuantity(Math.max(1, Math.min(val, cancelConfirmItem.quantity)));
                        }}
                        className="flex-1 px-4 py-2 text-center text-lg font-bold border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={() => setCancelQuantity(Math.min(cancelConfirmItem.quantity, cancelQuantity + 1))}
                        disabled={cancelQuantity >= cancelConfirmItem.quantity}
                        className="w-10 h-10 rounded-lg bg-white border-2 border-red-300 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {cancelQuantity === cancelConfirmItem.quantity 
                        ? 'Tüm ürün iptal edilecek' 
                        : `${cancelConfirmItem.quantity - cancelQuantity} adet kalacak`}
                    </p>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t-2 border-red-300">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-gray-500">İptal Edilecek Tutar</p>
                    <p className="text-lg font-bold text-red-600">
                      ₺{(cancelConfirmItem.price * cancelQuantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-800 font-medium">
                  İptal edildiğinde mümkünse kategori yazıcısına, yoksa kasa yazıcısına veya sistem varsayılan yazıcıya iptal fişi gönderilir; yazıcı ataması olmasa da iptal işlenir.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  setCancelConfirmItem(null);
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal Et
              </button>
              <button
                onClick={handlePreviewCancelReceipt}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Fişi Önizle</span>
              </button>
              <button
                onClick={confirmCancelItem}
                disabled={cancellingItemId === cancelConfirmItem.id}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 theme-sultan:to-emerald-500 hover:from-red-600 hover:to-pink-600 theme-sultan:hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {cancellingItemId === cancelConfirmItem.id ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>İptal Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Evet, İptal Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İptal Fişi Önizleme Modal */}
      {showCancelReceiptPreview && cancelReceiptHTML && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">İptal Fişi Önizleme</h3>
              <button
                onClick={() => {
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
              <div className="text-sm text-gray-600 mb-2">
                <p className="font-semibold">Bu fiş yazdırıldığında şu şekilde görünecektir:</p>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg p-4 overflow-x-auto" style={{ maxWidth: '220px', margin: '0 auto' }}>
              <iframe
                srcDoc={cancelReceiptHTML}
                className="w-full border-0"
                style={{ minHeight: '400px', width: '220px' }}
                title="İptal Fişi Önizleme"
              />
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setShowCancelReceiptPreview(false);
                  setCancelReceiptHTML(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün Detay Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-pink-200 theme-sultan:border-emerald-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold gradient-text">Ürün Detayı</h3>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Ürün Adı</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItemDetail.product_name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Adet</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedItemDetail.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Birim Fiyat</p>
                  <p className="text-lg font-semibold text-gray-800">₺{selectedItemDetail.price.toFixed(2)}</p>
                </div>
              </div>

              {selectedItemDetail.staff_name ? (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-500 mb-1">Siparişi Alan Garson</p>
                    <p className="text-lg font-semibold text-pink-600 theme-sultan:text-emerald-600 flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{selectedItemDetail.staff_name}</span>
                    </p>
                  </div>
                  {selectedItemDetail.added_date && selectedItemDetail.added_time && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Eklenme Tarihi</p>
                        <p className="text-base font-semibold text-gray-800">{selectedItemDetail.added_date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Eklenme Saati</p>
                        <p className="text-base font-semibold text-gray-800">{selectedItemDetail.added_time}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-1">Siparişi Alan</p>
                  <p className="text-lg font-semibold text-gray-600">Kasa / Sistem</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* İptal Açıklaması Modal (Fiş yazdırıldıktan sonra) */}
      {showCancelReasonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-amber-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">İptal Açıklaması</h3>
              <p className="text-gray-600 text-sm">İptal fişi yazdırıldı. Lütfen iptal nedenini açıklayın:</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                İptal Açıklaması <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Örn: Müşteri istemedi, Yanlış sipariş, Ürün bozuk..."
                className="w-full min-h-[120px] px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y"
                autoFocus
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-800 font-medium">
                  İptal açıklaması zorunludur. Açıklama yazmadan işlem tamamlanamaz.
                </p>
              </div>
            </div>

            {/* İptal edilecek adet seçimi */}
            {pendingCancelQuantity > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">İptal Edilecek Adet</label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setCancelQuantity(Math.max(1, (cancelQuantity || 1) - 1))}
                    className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={(cancelQuantity || 1) <= 1}
                  >
                    −
                  </button>
                  <span className="min-w-[3rem] text-center text-xl font-bold text-gray-900">{cancelQuantity || 1}</span>
                  <button
                    type="button"
                    onClick={() => setCancelQuantity(Math.min(pendingCancelQuantity || 1, (cancelQuantity || 1) + 1))}
                    className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={(cancelQuantity || 1) >= (pendingCancelQuantity || 1)}
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">Toplam {pendingCancelQuantity} adet mevcut</p>
              </div>
            )}

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => {
                  setShowCancelReasonModal(false);
                  setCancelReason('');
                  setCancellingItemId(null);
                }}
                disabled={cancellingItemId !== null}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Geri Dön</span>
              </button>
              <button
                onClick={submitCancelReason}
                disabled={!cancelReason.trim() || cancellingItemId !== null}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {cancellingItemId ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Tamamla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tüm Masayı İptal Et Onay Modal - Elite Corporate Design */}
      {showCancelEntireTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in" onClick={() => !cancellingEntireTable && setShowCancelEntireTableModal(false)}>
          <div className="bg-white rounded-2xl p-10 max-w-lg w-full mx-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* Icon */}
            <div className="flex items-center justify-center mb-8">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-gray-200">
                <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            
            {/* Content */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
                {customerMode ? 'Tüm Müşteriyi İptal Et' : 'Tüm Masayı İptal Et'}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Bu işlem geri alınamaz. Sipariş, sanki hiç açılmamış gibi tamamen silinecektir.
              </p>
              
              {/* Müşteri/Masa Bilgisi */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">İptal Edilecek {singularLabel}</p>
                <p className="text-lg font-bold text-gray-900">{order.table_name}</p>
                <p className="text-xs text-gray-500 mt-1">{singularLabel}</p>
              </div>

              {/* İptal Açıklaması */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  İptal Açıklaması <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelEntireTableReason}
                  onChange={(e) => setCancelEntireTableReason(e.target.value)}
                  placeholder="İptal nedenini açıklayın..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 resize-none text-sm"
                  rows={3}
                  disabled={cancellingEntireTable}
                />
                {!cancelEntireTableReason.trim() && (
                  <p className="text-xs text-red-500 mt-1">İptal açıklaması zorunludur</p>
                )}
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCancelEntireTableModal(false);
                  setCancelEntireTableReason('');
                }}
                disabled={cancellingEntireTable}
                className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-all duration-200 border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                Vazgeç
              </button>
              <button
                onClick={async () => {
                  if (!cancelEntireTableReason.trim()) {
                    showToast('Lütfen iptal açıklaması yazın', 'error');
                    return;
                  }

                  if (!window.electronAPI || !window.electronAPI.cancelEntireTableOrder) {
                    showToast('İptal işlemi şu anda kullanılamıyor', 'error');
                    return;
                  }

                  setCancellingEntireTable(true);
                  try {
                    const result = await window.electronAPI.cancelEntireTableOrder(order.id, cancelEntireTableReason.trim());
                    if (result.success) {
                      setShowCancelEntireTableModal(false);
                      setCancelEntireTableReason('');
                      if (onCancelEntireTable) {
                        onCancelEntireTable();
                      }
                      onClose();
                    } else {
                      if (result.requiresReason) {
                        showToast('Lütfen iptal açıklaması yazın', 'error');
                      } else {
                        showToast(result.error || `${singularLabel} iptal edilirken bir hata oluştu`, 'error');
                      }
                      setCancellingEntireTable(false);
                    }
                  } catch (error) {
                    console.error(`${singularLabel} iptal etme hatası:`, error);
                    showToast(`${singularLabel} iptal edilirken bir hata oluştu`, 'error');
                    setCancellingEntireTable(false);
                  }
                }}
                disabled={cancellingEntireTable || !cancelEntireTableReason.trim()}
                className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-w-[140px]"
              >
                {cancellingEntireTable ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>İptal Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>İptal Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün aktar - 1: Ürün/adet seç, 2: Hedef seç */}
      {showTransferItemsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={(e) => e.target === e.currentTarget && !transferring && (setTransferStep(1), setShowTransferItemsModal(false))}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-pink-700 theme-sultan:from-emerald-700 to-blue-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Ürünleri aktar</h3>
              <p className="text-sm text-white/90 mt-0.5">
                {transferStep === 1 ? 'Aktarılacak ürünleri ve adetleri seçin (yalnızca ödenmemiş adetler).' : `Hedef ${customerMode ? 'müşteriyi' : 'masayı'} seçin, ardından aktar ve yazdır.`}
              </p>
            </div>
            {transferStep === 1 ? (
              <>
                <div className="p-4 overflow-y-auto flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aktarılacak adet (ödenmemiş)</p>
                  <div className="space-y-3">
                    {groupedItems.filter(item => getTransferableQty(item) > 0).map((item) => {
                      const key = getTransferKey(item);
                      const maxQty = getTransferableQty(item);
                      const current = Math.min(maxQty, transferQuantities[key] || 0);
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-500">En fazla {maxQty} adet</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTransferQty(item, -1)}
                              disabled={current <= 0}
                              className="w-9 h-9 rounded-lg border border-gray-300 bg-white font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >−</button>
                            <span className="w-10 text-center font-bold text-gray-900">{current}</span>
                            <button
                              type="button"
                              onClick={() => setTransferQty(item, 1)}
                              disabled={current >= maxQty}
                              className="w-9 h-9 rounded-lg border border-gray-300 bg-white font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {groupedItems.filter(item => getTransferableQty(item) > 0).length === 0 && (
                    <p className="text-gray-500 text-sm py-4">Aktarılabilir (ödenmemiş) ürün yok.</p>
                  )}
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Seçilen: {selectedTransferTotal} adet</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => !transferring && setShowTransferItemsModal(false)} className="px-4 py-2 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">İptal</button>
                    <button
                      type="button"
                      onClick={() => setTransferStep(2)}
                      disabled={selectedTransferTotal <= 0}
                      className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Hedef {customerMode ? 'müşteri' : 'masa'} seç
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 overflow-y-auto flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hedef {customerMode ? 'müşteri' : 'masa'} (mevcut {customerMode ? 'müşteri' : 'masa'} hariç)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {allTablesForTransfer.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedTargetTableId(selectedTargetTableId === table.id ? null : table.id)}
                        className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                          selectedTargetTableId === table.id ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {table.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
                  <button type="button" onClick={() => setTransferStep(1)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← Ürün seçimine dön</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => !transferring && setShowTransferItemsModal(false)} className="px-4 py-2 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">İptal</button>
                    <button
                      type="button"
                      onClick={handleTransferItemsConfirm}
                      disabled={!selectedTargetTableId || transferring}
                      className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {transferring ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Aktarılıyor...
                        </>
                      ) : (
                        <>Aktar ve yazdır</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tutarlı Ödeme Modal */}
      {showAmountPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in" onClick={() => setShowAmountPaymentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-blue-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Tutarlı Ödeme</h3>
                  <p className="text-sm text-white/90 mt-1">Ödeme yapılacak tutarı girin</p>
                </div>
                <button
                  onClick={() => {
                    setShowAmountPaymentModal(false);
                    setAmountPaymentValue('');
                  }}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ödeme Tutarı
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₺</span>
                  <input
                    type="number"
                    value={amountPaymentValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (!isNaN(value) && Number(value) >= 0)) {
                        setAmountPaymentValue(value);
                      }
                    }}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={splitPaymentRemainingAmount}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && amountPaymentValue) {
                        handleAmountPayment(amountPaymentValue);
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Maksimum: ₺{splitPaymentRemainingAmount.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAmountPaymentModal(false);
                    setAmountPaymentValue('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    if (amountPaymentValue) {
                      handleAmountPayment(amountPaymentValue);
                    } else {
                      showToast('Lütfen bir tutar girin', 'warning');
                    }
                  }}
                  disabled={!amountPaymentValue || processingSplitPayment}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                >
                  {processingSplitPayment ? 'İşleniyor...' : 'Ödeme Al'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parçalı Ödeme Seçenekleri Modal */}
      {showSplitFractionPanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in" onClick={() => setShowSplitFractionPanel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-violet-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-pink-600 theme-sultan:to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Bölmeli Ödeme Seçenekleri</h3>
                  <p className="text-sm text-white/90 mt-1">1/2, 1/3 … 1/10 arasından seçin</p>
                </div>
                <button
                  onClick={() => setShowSplitFractionPanel(false)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                  const fractionAmount = Math.floor(basisOrderTotal / n);
                  const payAmount = Math.min(fractionAmount, Math.floor(splitPaymentRemainingAmount));
                  const isDisabled = payAmount <= 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isDisabled || processingSplitPayment}
                      onClick={() => {
                        handleSplitFractionPayment(n);
                        setShowSplitFractionPanel(false);
                      }}
                      className="px-4 py-3 rounded-xl font-bold text-sm bg-white border-2 border-violet-200 text-violet-800 hover:bg-violet-50 hover:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center"
                    >
                      <span className="text-base font-bold">1/{n}</span>
                      <span className="text-xs font-normal text-gray-600 mt-1">₺{payAmount}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showGiftSelectModal && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !applyingGift && setShowGiftSelectModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[min(94vh,920px)] flex flex-col overflow-hidden border border-gray-200 theme-sultan:border-emerald-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900">İkram</h3>
                <p className="text-xs text-gray-500 mt-0.5">+ / − ile adet; 0 bırakılan satır değişmez.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={applyingGift}
                  onClick={() => setShowGiftSelectModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  disabled={applyingGift || !hasAnyGiftQty}
                  onClick={handleConfirmGiftSelection}
                  className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 theme-sultan:bg-emerald-600 hover:opacity-95 disabled:opacity-50"
                >
                  {applyingGift ? '…' : 'Uygula'}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] bg-white shadow-[0_1px_0_0_rgb(229_231_235)]">
                  <tr className="text-left text-gray-500 text-xs font-semibold uppercase tracking-wide">
                    <th className="px-3 py-2 sm:px-4">Ürün</th>
                    <th className="px-2 py-2 w-14 sm:w-16 text-center">Sepet</th>
                    <th className="px-3 py-2 w-[9.5rem] sm:w-40 text-right">İkram</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {giftEligibleGroups.map((g) => {
                    const k = groupRowKey(g);
                    const maxQ = Number(g.giftableQty) || 0;
                    const val = Math.min(
                      Math.max(0, Number(giftQtyByGroupKey[k]) || 0),
                      maxQ
                    );
                    return (
                      <tr
                        key={k}
                        className={val > 0 ? 'bg-amber-50/60 theme-sultan:bg-emerald-50/50' : 'bg-white'}
                      >
                        <td className="px-3 py-2 sm:px-4 align-middle">
                          <span className="font-medium text-gray-900 line-clamp-2">{g.product_name}</span>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-gray-600 align-middle">
                          {maxQ}
                        </td>
                        <td className="px-3 py-1.5 align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={applyingGift || val <= 0}
                              onClick={() => adjustGiftQty(k, maxQ, -1)}
                              className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-700 leading-none hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Azalt"
                            >
                              −
                            </button>
                            <span className="min-w-[2rem] text-center font-bold tabular-nums text-gray-900">
                              {val}
                            </span>
                            <button
                              type="button"
                              disabled={applyingGift || val >= maxQ}
                              onClick={() => adjustGiftQty(k, maxQ, 1)}
                              className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-700 leading-none hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Artır"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </div>,
    document.body
  );
};

export default memo(TableOrderModal);

