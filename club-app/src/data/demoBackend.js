import { PROGRAM, calculateEarn, rewardById } from '../config/loyalty';
import { newMemberCode, normalizePhone } from './codes';

/**
 * Demo modu: her şey bu cihazın tarayıcısında (localStorage) tutulur.
 * Kasa paneli başka bir sekmede açıksa değişiklikler anında senkronlanır.
 * Firebase ayarı girildiğinde uygulama otomatik olarak gerçek sunucuya geçer.
 */
const KEY = 'makara-club-demo-v1';
const STAFF_PIN = '1234';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* gizli sekme vb. */
  }
  return { members: {}, activity: {}, passwords: {}, redemptions: {}, session: null, staff: null };
}

let db = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* depolama kapalıysa bellekte devam */
  }
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    db = load();
    listeners.forEach((fn) => fn());
  });
}

function subscribe(fn) {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function addActivity(memberId, entry) {
  const list = db.activity[memberId] || [];
  list.unshift({ id: id(), createdAt: Date.now(), ...entry });
  db.activity[memberId] = list.slice(0, 200);
}

function findMemberId({ email, phone }) {
  const e = (email || '').trim().toLowerCase();
  const p = normalizePhone(phone || '');
  return Object.keys(db.members).find((mid) => {
    const m = db.members[mid];
    return (e && m.email === e) || (p && m.phone === p);
  });
}

export function createDemoBackend() {
  return {
    mode: 'demo',

    onAuth(cb) {
      return subscribe(() => cb(db.session && db.members[db.session] ? { uid: db.session } : null));
    },

    async signUp({ name, phone, email, password, birthday }) {
      await wait();
      if (findMemberId({ email, phone })) throw new Error('Bu e-posta veya telefon ile zaten bir üyelik var.');
      const uid = id();
      db.members[uid] = {
        id: uid,
        name: name.trim(),
        phone: normalizePhone(phone),
        email: (email || '').trim().toLowerCase(),
        birthday: birthday || '',
        memberCode: newMemberCode(),
        points: PROGRAM.welcomeBonus,
        lifetimePoints: PROGRAM.welcomeBonus,
        visits: 0,
        createdAt: Date.now(),
      };
      db.passwords[uid] = password;
      addActivity(uid, { type: 'welcome', points: PROGRAM.welcomeBonus, title: 'Hoş geldin hediyesi' });
      db.session = uid;
      save();
      return uid;
    },

    async signIn({ email, password }) {
      await wait();
      const uid = findMemberId({ email, phone: email });
      if (!uid || db.passwords[uid] !== password) throw new Error('E-posta/telefon veya şifre hatalı.');
      db.session = uid;
      save();
      return uid;
    },

    async completeProfile() {},

    async signInWithGoogle() {
      throw new Error('Google ile giriş, Firebase bağlandığında aktif olur.');
    },

    async resetPassword() {
      throw new Error('Demo modunda şifre sıfırlama yok.');
    },

    async signOut() {
      db.session = null;
      save();
    },

    watchMember(uid, cb) {
      return subscribe(() => cb(db.members[uid] ? { ...db.members[uid] } : null));
    },

    watchActivity(uid, cb) {
      return subscribe(() => cb([...(db.activity[uid] || [])]));
    },

    async updateProfile(uid, patch) {
      await wait(250);
      const allowed = ['name', 'phone', 'birthday'];
      for (const k of allowed) if (k in patch) db.members[uid][k] = k === 'phone' ? normalizePhone(patch[k]) : patch[k];
      save();
    },

    /* ── Kasa ── */

    onStaff(cb) {
      return subscribe(() => cb(db.staff ? { uid: 'demo-staff', name: 'Kasa (Demo)' } : null));
    },

    async staffSignIn({ password }) {
      await wait();
      if (password !== STAFF_PIN) throw new Error('Demo kasa şifresi 1234.');
      db.staff = true;
      save();
    },

    async staffSignOut() {
      db.staff = null;
      save();
    },

    async findMember(query) {
      await wait(250);
      const mid = Object.keys(db.members).find((k) => {
        const m = db.members[k];
        if (query.memberCode) return m.memberCode === query.memberCode;
        if (query.phone) return m.phone === query.phone;
        return false;
      });
      return mid ? { ...db.members[mid] } : null;
    },

    async awardPoints({ memberId, amount, branchId }) {
      await wait();
      const m = db.members[memberId];
      if (!m) throw new Error('Üye bulunamadı.');
      const earn = calculateEarn(amount, m.lifetimePoints);
      if (earn.total <= 0) throw new Error('Geçerli bir tutar girin.');
      m.points += earn.total;
      m.lifetimePoints += earn.total;
      m.visits = (m.visits || 0) + 1;
      m.lastVisitAt = Date.now();
      addActivity(memberId, {
        type: 'earn',
        points: earn.total,
        amount: Number(amount),
        multiplier: earn.multiplier,
        branchId: branchId || null,
        title: 'Alışveriş',
      });
      save();
      return { earned: earn.total, member: { ...m } };
    },

    async redeemReward({ memberId, rewardId, nonce, expiresAt, branchId }) {
      await wait();
      const m = db.members[memberId];
      const reward = rewardById(rewardId);
      if (!m || !reward) throw new Error('Ödül veya üye bulunamadı.');
      if (expiresAt && Date.now() > expiresAt) throw new Error('Ödül kodunun süresi dolmuş. Müşteriden yeni kod isteyin.');
      if (nonce && db.redemptions[nonce]) throw new Error('Bu ödül kodu zaten kullanıldı.');
      if (m.points < reward.cost) throw new Error('Üyenin puanı bu ödül için yetersiz.');
      m.points -= reward.cost;
      if (nonce) db.redemptions[nonce] = { memberId, rewardId, at: Date.now() };
      addActivity(memberId, {
        type: 'redeem',
        points: -reward.cost,
        rewardId,
        title: reward.name,
        branchId: branchId || null,
      });
      save();
      return { member: { ...m }, reward };
    },
  };
}
