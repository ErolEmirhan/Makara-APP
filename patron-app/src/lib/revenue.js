export function isExpense(sale) {
  return sale.isExpense === true || sale.isExpense === 'true' || sale.payment_method === 'Masraf';
}

export function paymentBucket(method) {
  const m = String(method || '');
  if (m.startsWith('Online Satış') || m === 'Online Satış') return 'online';
  if (m === 'Kart' || m === 'Kredi Kartı') return 'card';
  if (m === 'Nakit') return 'cash';
  return 'other';
}

export function summarize(sales) {
  const buckets = { cash: 0, card: 0, online: 0, other: 0 };
  let total = 0;
  sales.forEach((sale) => {
    const amount = parseFloat(sale.total_amount || 0);
    total += amount;
    buckets[paymentBucket(sale.payment_method)] += amount;
  });
  return { total, ...buckets, count: sales.length };
}

function namesOf(raw) {
  return String(raw || '').split(',').map((n) => n.trim()).filter(Boolean);
}

export function staffBreakdown(sales) {
  const stats = {};
  const add = (name, amount) => {
    if (!amount) return;
    const key = name || 'Atanmamış';
    if (!stats[key]) stats[key] = { name: key, total: 0 };
    stats[key].total += amount;
  };

  sales.forEach((sale) => {
    const paid = parseFloat(sale.total_amount || 0);
    if (!paid) return;
    const items = Array.isArray(sale.items_array) ? sale.items_array : [];
    const weighted = [];
    items.forEach((item) => {
      if (item.isGift) return;
      const value = parseFloat(item.price || 0) * (Number(item.quantity) || 0);
      if (value <= 0) return;
      weighted.push({ value, names: namesOf(item.staff_name || sale.staff_name) });
    });
    const weight = weighted.reduce((sum, row) => sum + row.value, 0);
    if (weight <= 0) {
      const names = namesOf(sale.staff_name);
      const targets = names.length ? names : ['Atanmamış'];
      targets.forEach((name) => add(name, paid / targets.length));
      return;
    }
    weighted.forEach((row) => {
      const share = paid * (row.value / weight);
      const targets = row.names.length ? row.names : ['Atanmamış'];
      targets.forEach((name) => add(name, share / targets.length));
    });
  });

  const pinned = new Set(['Atanmamış']);
  return Object.values(stats).sort((a, b) => {
    const ap = pinned.has(a.name) ? 1 : 0;
    const bp = pinned.has(b.name) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return b.total - a.total;
  });
}

export function tableIsOpen(table) {
  const items = Array.isArray(table.items) ? table.items : [];
  const total = parseFloat(table.total_amount || 0) || 0;
  let open = table.is_occupied === true
    || table.is_occupied === 'true'
    || table.is_occupied === 1
    || table.status === 'occupied'
    || table.status === 'dolu'
    || items.length > 0;
  if (open && items.length === 0 && total <= 0 && !table.order_id) open = false;
  return open;
}
