import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FIREBASE_ENABLED } from '../config/firebase';
import { createDemoBackend } from './demoBackend';

const AppDataContext = createContext(null);

let backendPromise = null;
/** Firebase yalnızca ayarlıysa yüklenir; demo modunda paket boyutuna eklenmez. */
export function getBackend() {
  if (!backendPromise) {
    backendPromise = FIREBASE_ENABLED
      ? import('./firebaseBackend').then((m) => m.createFirebaseBackend())
      : Promise.resolve(createDemoBackend());
  }
  return backendPromise;
}

export function AppDataProvider({ children }) {
  const [backend, setBackend] = useState(null);
  const [user, setUser] = useState(undefined);
  const [member, setMember] = useState(undefined);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getBackend().then((b) => alive && setBackend(b));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!backend) return undefined;
    return backend.onAuth((u) => setUser(u));
  }, [backend]);

  useEffect(() => {
    if (!backend || !user) {
      setMember(user === null ? null : undefined);
      setActivity([]);
      return undefined;
    }
    setMember(undefined);
    const offMember = backend.watchMember(user.uid, setMember);
    const offActivity = backend.watchActivity(user.uid, setActivity);
    return () => {
      offMember();
      offActivity();
    };
  }, [backend, user?.uid]);

  const value = useMemo(() => {
    const run = async (fn) => {
      busyRef.current = true;
      setBusy(true);
      try {
        return await fn();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    };
    return {
      ready: Boolean(backend) && user !== undefined && (user === null || member !== undefined),
      mode: backend?.mode || (FIREBASE_ENABLED ? 'firebase' : 'demo'),
      backend,
      user,
      member: member || null,
      needsProfile: Boolean(user && member === null && !busy),
      activity,
      busy,
      signUp: (data) => run(() => backend.signUp(data)),
      signIn: (data) => run(() => backend.signIn(data)),
      signInWithGoogle: () => run(() => backend.signInWithGoogle()),
      completeProfile: (data) => run(() => backend.completeProfile(data)),
      resetPassword: (email) => backend.resetPassword(email),
      signOut: () => backend.signOut(),
      updateProfile: (patch) => backend.updateProfile(user.uid, patch),
    };
  }, [backend, user, member, activity, busy]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData, AppDataProvider içinde kullanılmalı');
  return ctx;
}
