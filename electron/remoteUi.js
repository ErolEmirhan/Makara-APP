const { app, dialog, net, shell, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Kasa arayüzü (src/) Vercel'den açılır: Makara-APP main'e push → Vercel deploy → kasa yenilenir.
// electron/ altındaki değişiklikler (IPC, yazıcı, Firestore) yine release ister.
// İnternet yoksa, Vercel cevap vermezse ya da arayüz bu kasa sürümünden yenisini isterse
// paketteki dist/index.html açılır.
const REMOTE_UI_URL = process.env.MAKARA_UI_URL || 'https://makaraapp.vercel.app/';
const REMOTE_UI_ORIGIN = new URL(REMOTE_UI_URL).origin;
const LOCAL_UI_FILE = path.join(__dirname, '../dist/index.html');
const STORAGE_BRIDGE_FILE = path.join(__dirname, 'storage-bridge.html');
const PROBE_TIMEOUT_MS = 6000;
const UPDATE_CHECK_MS = 2 * 60 * 1000;

let current = { mode: null, build: null };
let log = (msg) => console.log(msg);
let updatePromptOpen = false;
let dismissedBuild = null;
let storageSnapshotPath = null;
/** Arayüz kendi güncelleme bildirimini gösteriyorsa (remote-ui-register) diyalog açılmaz */
let rendererHandlesUpdates = false;
let pendingUpdate = null;

function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

function readMeta(html, name) {
  const m = html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

/** Hash'li giriş paketi her deploy'da değişir; yeni sürüm tespiti buna bakar */
function readBuildId(html) {
  const m = html.match(/assets\/index-[\w-]+\.js/);
  return m ? m[0] : null;
}

async function probeRemoteUi() {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('zaman aşımı')), PROBE_TIMEOUT_MS);
    });
    const res = await Promise.race([
      net.fetch(`${REMOTE_UI_URL}?shell-probe=${Date.now()}`, { cache: 'no-store' }),
      timeout
    ]);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await Promise.race([res.text(), timeout]);
    const build = readBuildId(html);
    if (!build) return { ok: false, reason: 'arayüz paketi bulunamadı' };
    const minShell = readMeta(html, 'makara-min-shell');
    if (minShell && compareVersions(app.getVersion(), minShell) < 0) {
      return { ok: false, reason: `arayüz kasa sürümü ${minShell}+ istiyor` };
    }
    return { ok: true, build };
  } catch (error) {
    return { ok: false, reason: error.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** file:// arayüzündeki localStorage (online sipariş, ses, tema ayarları) bir kez kopyalanır */
async function ensureFileStorageSnapshot() {
  if (!storageSnapshotPath || fs.existsSync(storageSnapshotPath)) return;
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  try {
    await win.loadFile(STORAGE_BRIDGE_FILE);
    const json = await win.webContents.executeJavaScript(
      'JSON.stringify(Object.fromEntries(Object.entries(localStorage)))'
    );
    fs.writeFileSync(storageSnapshotPath, json, 'utf8');
  } catch (error) {
    log(`Arayüz ayarları kopyalanamadı: ${error.message}`);
  } finally {
    win.destroy();
  }
}

function readStorageSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(storageSnapshotPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

async function showRemoteUi(win, build) {
  await win.loadURL(REMOTE_UI_URL);
  current = { mode: 'remote', build };
}

async function showLocalUi(win, reason) {
  log(`Kasa arayüzü paketten açılıyor (${reason})`);
  await win.loadFile(LOCAL_UI_FILE);
  current = { mode: 'local', build: null };
}

async function openRemoteUiOrFallback(win, build) {
  await ensureFileStorageSnapshot();
  try {
    await showRemoteUi(win, build);
    log(`Kasa arayüzü Vercel'den açıldı: ${build}`);
  } catch (error) {
    if (!win.isDestroyed()) await showLocalUi(win, error.message);
  }
}

async function loadMainUi(win) {
  const probe = await probeRemoteUi();
  if (!probe.ok) return showLocalUi(win, probe.reason);
  await openRemoteUiOrFallback(win, probe.build);
}

/** Uzak sayfa kasa penceresini başka siteye götüremesin; dış linkler tarayıcıda açılır */
function guardNavigation(win) {
  win.webContents.on('did-navigate', () => {
    rendererHandlesUpdates = false;
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:') || url.startsWith('http://localhost')) return;
    let origin = null;
    try {
      origin = new URL(url).origin;
    } catch (_) {}
    if (origin === REMOTE_UI_ORIGIN) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
  });
}

async function checkForRemoteUiUpdate(win) {
  if (!win || win.isDestroyed() || updatePromptOpen) return;
  const probe = await probeRemoteUi();
  if (!probe.ok) return;
  const recovering = current.mode === 'local';
  if (!recovering && probe.build === current.build) return;

  if (rendererHandlesUpdates) {
    if (pendingUpdate?.build === probe.build) return;
    pendingUpdate = { build: probe.build, recovering };
    win.webContents.send('remote-ui-update-available', pendingUpdate);
    return;
  }

  if (probe.build === dismissedBuild) return;
  updatePromptOpen = true;
  try {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Şimdi yenile', 'Sonra'],
      defaultId: 0,
      cancelId: 1,
      title: 'MAKARA POS',
      message: recovering
        ? 'İnternet bağlantısı geldi. Güncel kasa arayüzü açılsın mı?'
        : 'Kasa arayüzünün yeni sürümü hazır.',
      detail: 'Açık masalar ve kayıtlı siparişler korunur. Sepette gönderilmemiş ürün varsa önce onu tamamlayın.'
    });
    if (response !== 0) {
      dismissedBuild = probe.build;
      return;
    }
    await openRemoteUiOrFallback(win, probe.build);
  } catch (error) {
    log(`Kasa arayüzü yenilenemedi: ${error.message}`);
  } finally {
    updatePromptOpen = false;
  }
}

function initRemoteUi({ logger } = {}) {
  if (logger) log = logger;
  storageSnapshotPath = path.join(app.getPath('userData'), 'ui-local-storage.json');
  // preload senkron okur; yalnızca Vercel arayüzüne verilir
  ipcMain.on('ui-storage-seed', (event) => {
    let origin = null;
    try {
      origin = new URL(event.senderFrame.url).origin;
    } catch (_) {}
    event.returnValue = origin === REMOTE_UI_ORIGIN ? readStorageSnapshot() : null;
  });
  ipcMain.handle('remote-ui-register', (event) => {
    // Sayfa değişirken eski sayfadan geç gelen kayıt yeni sayfaya sayılmasın
    if (!event.senderFrame || event.senderFrame.url !== event.sender.getURL()) return null;
    rendererHandlesUpdates = true;
    return pendingUpdate;
  });
  // Arayüz sepet boş ve kasa boştayken ya da "Şimdi güncelle" ile çağırır
  ipcMain.handle('remote-ui-apply', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !pendingUpdate) return false;
    const { build } = pendingUpdate;
    pendingUpdate = null;
    await openRemoteUiOrFallback(win, build);
    return true;
  });
}

function startRemoteUiUpdateWatcher(getWindow) {
  return setInterval(() => {
    checkForRemoteUiUpdate(getWindow()).catch(() => {});
  }, UPDATE_CHECK_MS);
}

module.exports = {
  REMOTE_UI_URL,
  initRemoteUi,
  loadMainUi,
  guardNavigation,
  startRemoteUiUpdateWatcher,
  checkForRemoteUiUpdate,
  probeRemoteUi,
  compareVersions,
  getRemoteUiState: () => ({ ...current })
};
