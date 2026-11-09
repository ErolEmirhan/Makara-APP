import React, { useCallback, useEffect, useState } from 'react';

const SpotifyLogo = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.59 14.42a.62.62 0 01-.86.21c-2.35-1.44-5.31-1.76-8.8-.96a.62.62 0 11-.28-1.22c3.81-.87 7.09-.5 9.73 1.12a.62.62 0 01.21.85zm1.22-2.72a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.5c3.63-1.1 8.15-.57 11.23 1.33a.78.78 0 01.26 1.08zm.1-2.83C14.68 8.95 9.37 8.78 6.3 9.71a.94.94 0 11-.54-1.8c3.53-1.07 9.39-.86 13.1 1.34a.94.94 0 01-.95 1.62z" /></svg>
);

/** Ayarlar → Entegrasyon: kasadaki Spotify (Premium) hesabını bağla; müdür telefondan şarkı arayıp çalar */
export default function SpotifyConnectCard() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    if (!api?.spotifyStatus) return;
    try { setStatus(await api.spotifyStatus()); } catch (_) {}
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (!api?.spotifyConnect) {
    return (
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6 text-sm text-gray-500">
        Spotify bağlantısı için kasa uygulamasının güncellenmesi gerekiyor. Kasayı kapatıp açın.
      </div>
    );
  }

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.spotifyConnect();
      if (res?.success) {
        setMessage({ type: res.product && res.product !== 'premium' ? 'warn' : 'ok', text: res.product && res.product !== 'premium'
          ? `${res.displayName || 'Hesap'} bağlandı ama Premium değil: şarkı çalma çalışmaz.`
          : `${res.displayName || 'Spotify'} bağlandı. Müdürler artık telefondan şarkı arayıp çalabilir.` });
      } else if (res?.error && res.error !== 'Pencere kapatıldı') {
        setMessage({ type: 'err', text: res.error });
      }
    } finally {
      setBusy(false);
      load();
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await api.spotifyDisconnect(); setMessage(null); } finally { setBusy(false); load(); }
  };

  const connected = !!status?.connected;
  return (
    <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#121212] text-[#1ed760] shadow-md">
            <SpotifyLogo />
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-bold text-gray-900">Spotify</h4>
            <p className="truncate text-sm text-gray-500">
              {connected
                ? `Bağlı: ${status.displayName || 'Spotify hesabı'}${status.product === 'premium' ? ' · Premium' : status.product ? ' · Premium değil' : ''}`
                : 'Müdürler telefondan şarkı arayıp kasada çalabilsin (Premium gerekir)'}
            </p>
          </div>
        </div>
        {connected ? (
          <button type="button" onClick={disconnect} disabled={busy} className="shrink-0 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50">
            Bağlantıyı kes
          </button>
        ) : (
          <button type="button" onClick={connect} disabled={busy} className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#1ed760] px-5 py-2.5 text-sm font-bold text-black shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <SpotifyLogo className="h-4 w-4" />}
            Spotify'ı bağla
          </button>
        )}
      </div>
      {busy && !connected && (
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-sm font-medium text-gray-600">
          Chrome'da Spotify sayfası açıldı: <b>Kabul et (Agree)</b>'ye basın. Bitince kasa kendiliğinden geri gelir.
        </div>
      )}
      {message && (
        <div className={`border-t px-6 py-3 text-sm font-medium ${message.type === 'ok' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : message.type === 'warn' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
