// Arayüz güncellemesi sayfayı yenilediğinde kasa kaldığı yerden devam etsin (açılış ekranları atlanır).
// sessionStorage aynı pencerede yenilemeden sağ çıkar, uygulama kapanınca silinir.
export const HOT_RESUME_KEY = 'makara_hot_resume';
const MAX_AGE_MS = 60000;

export function saveHotResume(snapshot) {
  try {
    sessionStorage.setItem(HOT_RESUME_KEY, JSON.stringify({ ...(snapshot || {}), at: Date.now() }));
  } catch (_) {}
}

/** Bir kez okunur; eski ya da bozuk kayıt yok sayılır */
export function takeHotResume() {
  try {
    const raw = sessionStorage.getItem(HOT_RESUME_KEY);
    sessionStorage.removeItem(HOT_RESUME_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    return Date.now() - (snapshot.at || 0) < MAX_AGE_MS ? snapshot : null;
  } catch (_) {
    return null;
  }
}
