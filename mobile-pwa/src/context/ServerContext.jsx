import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getServerUrl, setServerUrl, hasServerConfigured, getApiUrl } from '../api/client';
import { getBranchTheme } from '../config/branch';

const ServerContext = createContext(null);

export function ServerProvider({ children }) {
  const [configured, setConfigured] = useState(() => {
    if (hasServerConfigured()) return true;
    // Aynı kasa sunucusundan /mobile ile açıldıysa otomatik bağlan
    const origin = window.location.origin;
    if (origin && !origin.includes('5174') && !origin.includes('localhost:5174')) {
      try {
        setServerUrl(origin);
        return true;
      } catch { /* */ }
    }
    return false;
  });
  const [branchKey, setBranchKey] = useState('makara');
  const [branchLabel, setBranchLabel] = useState('MAKARA');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const theme = getBranchTheme(branchKey);

  const fetchBranchInfo = useCallback(async () => {
    try {
      const info = await api.getBranchInfo();
      if (info?.branch?.key) {
        setBranchKey(info.branch.key);
        setBranchLabel(info.branch.label || info.branch.key);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const connect = useCallback(async (url) => {
    setConnecting(true);
    setError('');
    try {
      let clean = url.trim().replace(/\/$/, '');
      if (!clean.startsWith('http')) clean = `http://${clean}`;
      setServerUrl(clean);

      const info = await api.getBranchInfo();
      if (info?.branch?.key) {
        setBranchKey(info.branch.key);
        setBranchLabel(info.branch.label || info.branch.key);
      }
      setConfigured(true);
      return true;
    } catch (e) {
      setError(e.message || 'Sunucuya bağlanılamadı');
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (configured) fetchBranchInfo();
  }, [configured, fetchBranchInfo]);

  return (
    <ServerContext.Provider
      value={{
        configured,
        serverUrl: getServerUrl(),
        apiUrl: getApiUrl(),
        branchKey,
        branchLabel,
        theme,
        connecting,
        error,
        connect,
        fetchBranchInfo,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within ServerProvider');
  return ctx;
}
