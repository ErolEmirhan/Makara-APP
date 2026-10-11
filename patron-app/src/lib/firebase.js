import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, onSnapshot, limit } from 'firebase/firestore';
import { BRANCHES } from './branches';

function appNamed(name, config) {
  try {
    return getApp(name);
  } catch {
    return initializeApp(config, name);
  }
}

export function openBranch(branchKey) {
  const branch = BRANCHES[branchKey] || BRANCHES.makara;
  const salesApp = appNamed(`sales-${branch.key}`, branch.sales);
  const tablesConfig = branch.tables || branch.sales;
  const tablesApp = appNamed(`tables-${branch.key}`, tablesConfig);
  const onlineConfig = branch.online;
  const onlineApp = onlineConfig ? appNamed(`online-${branch.key}`, onlineConfig) : null;
  return {
    branch,
    salesDb: getFirestore(salesApp),
    tablesDb: getFirestore(tablesApp),
    onlineDb: onlineApp ? getFirestore(onlineApp) : null
  };
}

export async function loadAdminUsers(salesDb) {
  const snap = await getDoc(doc(salesDb, 'admin', 'pin'));
  if (!snap.exists()) return [];
  const data = snap.data();
  if (Array.isArray(data.users) && data.users.length) return data.users;
  if (Array.isArray(data.passwords)) {
    return data.passwords.map((pin, i) => ({
      username: i === 0 ? 'Fatih' : (i === 1 ? 'Ortak' : `Kullanıcı ${i + 1}`),
      pin
    }));
  }
  return [];
}

export async function loadDaySales(salesDb, dateStrings) {
  const unique = [...new Set(dateStrings.filter(Boolean))];
  const snap = await getDocs(query(collection(salesDb, 'sales'), where('sale_date', 'in', unique.slice(0, 10))));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadDayCancels(salesDb, dateStrings) {
  const unique = [...new Set(dateStrings.filter(Boolean))];
  const snap = await getDocs(query(collection(salesDb, 'cancels'), where('cancel_date', 'in', unique.slice(0, 10))));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchTables(tablesDb, onData) {
  return onSnapshot(collection(tablesDb, 'tables'), (snap) => {
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    onData(rows);
  });
}

export function watchOnline(onlineDb, onData) {
  if (!onlineDb) {
    onData([]);
    return () => {};
  }
  const q = query(collection(onlineDb, 'orders'), where('status', '==', 'pending'), limit(100));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(rows);
  }, () => onData([]));
}
