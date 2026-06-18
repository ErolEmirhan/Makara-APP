const SERVER_KEY = 'makaraServerUrl';

let serverUrl = '';
let apiUrl = '';

export function getServerUrl() {
  if (serverUrl) return serverUrl;
  const stored = localStorage.getItem(SERVER_KEY);
  if (stored) {
    serverUrl = stored.replace(/\/$/, '');
    apiUrl = `${serverUrl}/api`;
  }
  return serverUrl;
}

export function getApiUrl() {
  if (!apiUrl && getServerUrl()) {
    apiUrl = `${serverUrl}/api`;
  }
  return apiUrl;
}

export function getSocketUrl() {
  return getServerUrl();
}

export function setServerUrl(url) {
  const clean = url.replace(/\/$/, '').replace(/\/mobile\/?$/, '');
  serverUrl = clean;
  apiUrl = `${clean}/api`;
  localStorage.setItem(SERVER_KEY, clean);
}

export function clearServerUrl() {
  serverUrl = '';
  apiUrl = '';
  localStorage.removeItem(SERVER_KEY);
}

export function hasServerConfigured() {
  return !!localStorage.getItem(SERVER_KEY);
}

async function request(path, options = {}) {
  const base = getApiUrl();
  if (!base) throw new Error('Sunucu adresi yapılandırılmamış');

  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  getBranchInfo: () => request('/branch-info'),
  login: (password) => request('/staff/login', { method: 'POST', body: JSON.stringify({ password }) }),
  changePassword: (body) => request('/staff/change-password', { method: 'POST', body: JSON.stringify(body) }),
  managerOpsConfigured: () => request('/staff/manager-ops-configured'),
  setManagerOpsPassword: (body) => request('/staff/manager-operations-password', { method: 'POST', body: JSON.stringify(body) }),
  recentCancellations: () => request('/staff/recent-cancellations'),
  getCategories: () => fetch(`${getApiUrl()}/categories`).then((r) => r.json()),
  getProducts: (categoryId) => {
    const q = categoryId ? `?category_id=${categoryId}` : '';
    return fetch(`${getApiUrl()}/products${q}`).then((r) => r.json());
  },
  getTables: () => fetch(`${getApiUrl()}/tables`).then((r) => r.json()),
  getTableOrders: (tableId) => fetch(`${getApiUrl()}/table-orders?tableId=${encodeURIComponent(tableId)}`).then((r) => r.json()),
  sendOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  prepareAdisyon: (payload) => request('/prepare-adisyon', { method: 'POST', body: JSON.stringify(payload) }),
  cancelOrderItem: (payload) => request('/cancel-table-order-item', { method: 'POST', body: JSON.stringify(payload) }),
  transferTable: (payload) => request('/transfer-table-order', { method: 'POST', body: JSON.stringify(payload) }),
  transferItems: (payload) => request('/transfer-order-items', { method: 'POST', body: JSON.stringify(payload) }),
  mergeTable: (payload) => request('/merge-table-order', { method: 'POST', body: JSON.stringify(payload) }),
  imageProxy: (url) => `${getApiUrl()}/image-proxy?url=${encodeURIComponent(url)}`,
  // Sultan
  sultanPendingOrders: () => fetch(`${getApiUrl()}/sultan-mobile/pending-orders`).then((r) => r.json()),
  sultanCompleteOrder: (payload) => request('/sultan-manager/complete-order', { method: 'POST', body: JSON.stringify(payload) }),
  sultanRevertOrder: (payload) => request('/sultan-manager/revert-completed-order', { method: 'POST', body: JSON.stringify(payload) }),
  sultanPrintAdisyon: (payload) => request('/sultan-manager/print-adisyon', { method: 'POST', body: JSON.stringify(payload) }),
  sultanCancelEntireOrder: (payload) => request('/sultan-manager/cancel-entire-order', { method: 'POST', body: JSON.stringify(payload) }),
  sultanCompletedOrders: () => fetch(`${getApiUrl()}/sultan-manager/completed-table-orders`).then((r) => r.json()),
  // Reservations
  getReservations: () => fetch(`${getApiUrl()}/reservations`).then((r) => r.json()),
  createReservation: (payload) => request('/reservations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
  printReservation: (payload) => request('/reservations/print', { method: 'POST', body: JSON.stringify(payload) }),
};
