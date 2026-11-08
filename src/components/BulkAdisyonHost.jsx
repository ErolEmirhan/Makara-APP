import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import BulkPrintPopup, { BULK_TEAR_MS, BULK_PRINT_MS, BULK_PRINT_LATENCY_MS } from './BulkPrintPopup';
import Toast from './Toast';

/*
 * Gün sonu adisyonları: açık tüm masaların fiyatlı adisyonları kasa yazıcısından art arda basılır,
 * sağda yazıcı penceresi açılır. Uygulamanın her ekranında çalışır; masalar ekranındaki buton
 * (requestBulkAdisyon) ve müdürün telefondan isteği (kasadan 'remote-bulk-adisyon') bunu tetikler.
 */
let runner = null;
let busy = false;
const listeners = new Set();
const setBusy = (v) => { busy = v; listeners.forEach((fn) => fn()); };

export function requestBulkAdisyon(opts = {}) {
  if (runner) runner(opts);
}

/** Gün sonu yazdırması sürüyor mu (buton kilidi için) */
export function useBulkAdisyonBusy() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => busy
  );
}

export default function BulkAdisyonHost() {
  const [bulkAdisyon, setBulkAdisyon] = useState(null); // { jobs, finished, requestedBy } | null
  const [toast, setToast] = useState(null);
  const runningRef = useRef(false);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type, key: Date.now() }), []);

  const run = useCallback(async (opts = {}) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      await printAll(opts);
    } finally {
      runningRef.current = false;
      if (!document.querySelector('.bpp-pop')) setBusy(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function printAll(opts) {
    const api = window.electronAPI;
    if (!api?.getTableOrders || !api?.getTableOrderItems || !api?.printAdisyon) {
      showToast('Adisyon yazdırma şu anda kullanılamıyor', 'error');
      return;
    }
    let orders = [];
    try {
      orders = ((await api.getTableOrders()) || []).filter((o) => o && o.status === 'pending');
    } catch (error) {
      showToast('Açık masalar alınamadı: ' + (error?.message || 'bilinmeyen hata'), 'error');
      return;
    }
    if (orders.length === 0) {
      showToast('Açık masa yok', 'info');
      return;
    }
    orders.sort((a, b) => String(a.table_name || '').localeCompare(String(b.table_name || ''), 'tr', { numeric: true }));

    // Ürünler önceden alınır: yazıcı penceresindeki fiş her masanın gerçek içeriğini gösterir
    const jobs = [];
    for (const order of orders) {
      let items = [];
      try {
        items = (await api.getTableOrderItems(order.id)) || [];
      } catch (_) {}
      if (items.length === 0) continue;
      const mapped = items.map((item) => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        isGift: item.isGift || false,
        staff_name: item.staff_name || null,
        category_id: null,
      }));
      jobs.push({
        key: String(order.id),
        order,
        name: order.table_name || 'Masa',
        date: order.order_date || new Date().toLocaleDateString('tr-TR'),
        time: String(order.order_time || '').split(':').slice(0, 2).join(':'),
        items: mapped,
        total: mapped.reduce((sum, i) => sum + (i.isGift ? 0 : (Number(i.price) || 0) * (Number(i.quantity) || 0)), 0),
        status: 'waiting',
      });
    }
    if (jobs.length === 0) {
      showToast('Açık masalarda yazdırılacak ürün yok', 'info');
      return;
    }

    const setJob = (key, patch) =>
      setBulkAdisyon((prev) => (prev ? { ...prev, jobs: prev.jobs.map((j) => (j.key === key ? { ...j, ...patch } : j)) } : prev));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    setBulkAdisyon({ jobs, finished: false, requestedBy: opts.requestedBy || null });
    await wait(450); // pencere kayarak gelsin

    // Yazdırma hiç bekletilmez: adisyonlar kasaya art arda gönderilir, yazıcı onları pat pat basar.
    // Ekrandaki yazıcı aynı sırayı gerçek yazıcının zamanlamasıyla oynatır:
    // fiş i, yazıcıya teslim edildiği an + BULK_PRINT_LATENCY_MS'de (önceki fiş bitmeden değil) çıkmaya başlar,
    // BULK_PRINT_MS sürer, sonra koparılır.
    const failed = [];
    const results = jobs.map(() => {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      return { promise, resolve };
    });

    const producer = (async () => {
      for (let i = 0; i < jobs.length; i += 1) {
        const { order, name } = jobs[i];
        let ok = false;
        try {
          const result = await api.printAdisyon({
            items: jobs[i].items,
            tableName: order.table_name,
            tableType: order.table_type,
            orderNote: order.order_note || null,
            sale_date: order.order_date || new Date().toLocaleDateString('tr-TR'),
            sale_time: order.order_time || new Date().toLocaleTimeString('tr-TR'),
            cashierOnly: true,
          });
          ok = !!result?.success;
          if (!ok) failed.push(`${name}: ${result?.error || 'hata'}`);
        } catch (error) {
          failed.push(`${name}: ${error?.message || 'hata'}`);
        }
        results[i].resolve({ ok, at: performance.now() });
      }
    })();

    const screen = (async () => {
      let prevEnd = 0;
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        setJob(job.key, { status: 'printing' });
        const { ok, at } = await results[i].promise;
        if (!ok) {
          setJob(job.key, { status: 'failed', feedFrom: performance.now(), doneAt: performance.now() });
          setTimeout(() => setJob(job.key, { hidden: true }), 700);
          continue;
        }
        const start = Math.max(at + BULK_PRINT_LATENCY_MS, prevEnd);
        if (start > performance.now()) await wait(start - performance.now());
        const feedFrom = performance.now();
        setJob(job.key, { feedFrom, estimateMs: BULK_PRINT_MS - 180 });
        await wait(BULK_PRINT_MS - 180);
        setJob(job.key, { status: 'done', doneAt: performance.now() });
        await wait(180);
        prevEnd = performance.now();
        const key = job.key;
        setTimeout(() => setJob(key, { hidden: true }), 120 + BULK_TEAR_MS + 80);
      }
      await wait(120 + BULK_TEAR_MS);
    })();

    await Promise.all([producer, screen]);

    setBulkAdisyon((prev) => (prev ? { ...prev, finished: true } : prev));
    if (failed.length) console.error('Gün sonu adisyon hataları:', failed);
  }

  useEffect(() => {
    runner = run;
    const off = window.electronAPI?.onRemoteBulkAdisyon?.((payload) => {
      run({ requestedBy: payload?.requestedBy || null });
    });
    return () => {
      if (runner === run) runner = null;
      if (typeof off === 'function') off();
    };
  }, [run]);

  return (
    <>
      {bulkAdisyon && (
        <BulkPrintPopup
          state={bulkAdisyon}
          onClosed={() => { setBulkAdisyon(null); setBusy(false); }}
        />
      )}
      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
