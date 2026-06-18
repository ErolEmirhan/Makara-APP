import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BRANCH_FIREBASE, getSavedBranchKey, saveBranchKey } from '../config/firebase';
import { getBranchTheme } from '../config/branch';
import { initFirebase } from '../services/firebaseService';

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const savedKey = getSavedBranchKey();
  const [branchKey, setBranchKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [connecting, setConnecting] = useState(!!savedKey);
  const [error, setError] = useState('');
  const initStarted = useRef(false);

  const branchLabel = BRANCH_FIREBASE[branchKey]?.label || branchKey;
  const theme = getBranchTheme(branchKey || savedKey || 'makara');

  const selectBranch = useCallback(async (key) => {
    if (!BRANCH_FIREBASE[key]) return false;
    setConnecting(true);
    setError('');
    try {
      await initFirebase(key);
      saveBranchKey(key);
      setBranchKey(key);
      setConfigured(true);
      return true;
    } catch (e) {
      setError(e.message || 'Firebase bağlantı hatası');
      setConfigured(false);
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    if (savedKey && BRANCH_FIREBASE[savedKey]) {
      selectBranch(savedKey);
    } else {
      setConnecting(false);
    }
  }, [savedKey, selectBranch]);

  return (
    <BranchContext.Provider
      value={{
        branchKey,
        branchLabel,
        theme,
        configured,
        connecting,
        error,
        selectBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}

export const useServer = useBranch;
export const ServerProvider = BranchProvider;
