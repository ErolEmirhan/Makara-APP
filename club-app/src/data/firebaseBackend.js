import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config/firebase';
import { PROGRAM, calculateEarn, rewardById } from '../config/loyalty';
import { newMemberCode, normalizePhone } from './codes';

/**
 * Gerçek sunucu: Firebase Auth + Firestore.
 * Müşteri uygulaması ve kasa paneli ayrı Firebase "app" örnekleri kullanır;
 * böylece aynı tarayıcıda kasaya giriş yapmak müşteri oturumunu kapatmaz.
 */
function appNamed(name) {
  return getApps().find((a) => a.name === name) || initializeApp(FIREBASE_CONFIG, name);
}

/** Yerel geliştirme: VITE_FIREBASE_EMULATORS=true ise Auth/Firestore emülatörlerine bağlanır. */
function connectEmulators(auth, db) {
  if (import.meta.env.VITE_FIREBASE_EMULATORS !== 'true') return;
  const host = window.location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

const toMillis = (v) => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : Date.now());

function mapMember(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: snap.id, ...d, createdAt: toMillis(d.createdAt), lastVisitAt: d.lastVisitAt ? toMillis(d.lastVisitAt) : null };
}

const ERRORS = {
  'auth/email-already-in-use': 'Bu e-posta ile zaten bir üyelik var.',
  'auth/invalid-email': 'E-posta adresi geçersiz.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/user-not-found': 'Bu e-posta ile kayıtlı üye yok.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.',
  'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
  'auth/network-request-failed': 'İnternet bağlantısı yok gibi görünüyor.',
  'permission-denied': 'Bu işlem için yetkiniz yok.',
};

function friendly(err) {
  const msg = ERRORS[err?.code];
  return msg ? new Error(msg) : err instanceof Error ? err : new Error(String(err));
}

async function guard(fn) {
  try {
    return await fn();
  } catch (err) {
    throw friendly(err);
  }
}

export function createFirebaseBackend() {
  const app = appNamed('club');
  const auth = getAuth(app);
  const db = getFirestore(app);

  const staffApp = appNamed('kasa');
  const staffAuth = getAuth(staffApp);
  const staffDb = getFirestore(staffApp);
  connectEmulators(auth, db);
  connectEmulators(staffAuth, staffDb);

  /**
   * Üye belgesi + benzersiz kod kaydı + hoş geldin hareketi tek seferde yazılır.
   * codes/{kod} belgesi, başka birinin kodunu kopyalayarak puan çalınmasını engeller.
   */
  async function createMemberDoc(uid, { name, phone, birthday, email }) {
    const ref = doc(db, 'members', uid);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const memberCode = newMemberCode();
      const batch = writeBatch(db);
      batch.set(ref, {
        name: name.trim(),
        phone: normalizePhone(phone),
        email: (email || '').toLowerCase(),
        birthday: birthday || '',
        memberCode,
        points: PROGRAM.welcomeBonus,
        lifetimePoints: PROGRAM.welcomeBonus,
        visits: 0,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'codes', memberCode), { uid });
      batch.set(doc(db, 'members', uid, 'activity', 'welcome'), {
        type: 'welcome',
        points: PROGRAM.welcomeBonus,
        title: 'Hoş geldin hediyesi',
        createdAt: serverTimestamp(),
      });
      try {
        await batch.commit();
        return;
      } catch (err) {
        if (err?.code !== 'permission-denied' || attempt === 2) throw err;
      }
    }
  }

  return {
    mode: 'firebase',

    onAuth(cb) {
      return onAuthStateChanged(auth, (user) => cb(user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null));
    },

    signUp: ({ name, phone, email, password, birthday }) =>
      guard(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await fbUpdateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
        await createMemberDoc(cred.user.uid, { name, phone, birthday, email });
        return cred.user.uid;
      }),

    completeProfile: ({ name, phone, birthday }) =>
      guard(async () => {
        const user = auth.currentUser;
        if (!user) throw new Error('Oturum bulunamadı.');
        await createMemberDoc(user.uid, { name, phone, birthday, email: user.email });
      }),

    signIn: ({ email, password }) =>
      guard(async () => (await signInWithEmailAndPassword(auth, email.trim(), password)).user.uid),

    signInWithGoogle: () =>
      guard(async () => (await signInWithPopup(auth, new GoogleAuthProvider())).user.uid),

    resetPassword: (email) => guard(() => sendPasswordResetEmail(auth, email.trim())),

    signOut: () => fbSignOut(auth),

    watchMember(uid, cb) {
      return onSnapshot(doc(db, 'members', uid), (snap) => cb(mapMember(snap)), () => cb(null));
    },

    watchActivity(uid, cb) {
      const q = query(collection(db, 'members', uid, 'activity'), orderBy('createdAt', 'desc'), limit(60));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toMillis(d.data().createdAt) }))),
        () => cb([]),
      );
    },

    updateProfile: (uid, patch) =>
      guard(async () => {
        const clean = {};
        if ('name' in patch) clean.name = patch.name.trim();
        if ('phone' in patch) clean.phone = normalizePhone(patch.phone);
        if ('birthday' in patch) clean.birthday = patch.birthday;
        clean.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'members', uid), clean);
      }),

    /* ── Kasa ── */

    onStaff(cb) {
      return onAuthStateChanged(staffAuth, async (user) => {
        if (!user) return cb(null);
        const snap = await getDoc(doc(staffDb, 'staff', user.uid)).catch(() => null);
        if (!snap?.exists()) {
          await fbSignOut(staffAuth);
          cb(null, 'Bu hesap kasa personeli olarak tanımlı değil.');
          return;
        }
        cb({ uid: user.uid, ...snap.data() });
      });
    },

    staffSignIn: ({ email, password }) =>
      guard(() => signInWithEmailAndPassword(staffAuth, email.trim(), password)),

    staffSignOut: () => fbSignOut(staffAuth),

    findMember: (q) =>
      guard(async () => {
        if (q.memberCode) {
          const code = await getDoc(doc(staffDb, 'codes', q.memberCode));
          if (!code.exists()) return null;
          return mapMember(await getDoc(doc(staffDb, 'members', code.data().uid)));
        }
        const snap = await getDocs(query(collection(staffDb, 'members'), where('phone', '==', q.phone), limit(1)));
        return snap.empty ? null : mapMember(snap.docs[0]);
      }),

    awardPoints: ({ memberId, amount, branchId }) =>
      guard(() =>
        runTransaction(staffDb, async (tx) => {
          const ref = doc(staffDb, 'members', memberId);
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('Üye bulunamadı.');
          const m = snap.data();
          const earn = calculateEarn(amount, m.lifetimePoints || 0);
          if (earn.total <= 0) throw new Error('Geçerli bir tutar girin.');
          const next = {
            points: (m.points || 0) + earn.total,
            lifetimePoints: (m.lifetimePoints || 0) + earn.total,
            visits: (m.visits || 0) + 1,
            lastVisitAt: serverTimestamp(),
          };
          tx.update(ref, next);
          tx.set(doc(collection(ref, 'activity')), {
            type: 'earn',
            points: earn.total,
            amount: Number(amount),
            multiplier: earn.multiplier,
            branchId: branchId || null,
            staffId: staffAuth.currentUser?.uid || null,
            title: 'Alışveriş',
            createdAt: serverTimestamp(),
          });
          return { earned: earn.total, member: { id: memberId, ...m, ...next } };
        }),
      ),

    redeemReward: ({ memberId, rewardId, nonce, expiresAt, branchId }) =>
      guard(() =>
        runTransaction(staffDb, async (tx) => {
          const reward = rewardById(rewardId);
          if (!reward) throw new Error('Ödül bulunamadı.');
          if (expiresAt && Date.now() > expiresAt) throw new Error('Ödül kodunun süresi dolmuş. Müşteriden yeni kod isteyin.');
          const ref = doc(staffDb, 'members', memberId);
          const usedRef = nonce ? doc(staffDb, 'redemptions', nonce) : null;
          const [snap, used] = await Promise.all([tx.get(ref), usedRef ? tx.get(usedRef) : null]);
          if (!snap.exists()) throw new Error('Üye bulunamadı.');
          if (used?.exists()) throw new Error('Bu ödül kodu zaten kullanıldı.');
          const m = snap.data();
          if ((m.points || 0) < reward.cost) throw new Error('Üyenin puanı bu ödül için yetersiz.');
          tx.update(ref, { points: m.points - reward.cost });
          if (usedRef) tx.set(usedRef, { memberId, rewardId, staffId: staffAuth.currentUser?.uid || null, at: serverTimestamp() });
          tx.set(doc(collection(ref, 'activity')), {
            type: 'redeem',
            points: -reward.cost,
            rewardId,
            title: reward.name,
            branchId: branchId || null,
            staffId: staffAuth.currentUser?.uid || null,
            createdAt: serverTimestamp(),
          });
          return { member: { id: memberId, ...m, points: m.points - reward.cost }, reward };
        }),
      ),
  };
}
