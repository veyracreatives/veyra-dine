// Veyra Dine In for Windows: the counter app.
// - Online mode (default when config.json has a serverUrl): opens the online server, guests order on any network,
//   and the owner can also log in from any browser.
// - This-computer mode: runs the server here (guests must be on the restaurant Wi-Fi). Installs that already
//   have restaurants saved on this computer stay in this mode so nothing is lost. The tray menu switches modes.
'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch { return {}; } })();
if (process.env.VD_SERVER_URL) CONFIG.serverUrl = process.env.VD_SERVER_URL; // testing against another server
const APP_NAME = CONFIG.appName || 'Veyra Dine In';
const ICON = path.join(__dirname, 'icon.png');
app.setName(APP_NAME);
// Installs from before the rename keep their data in the old "Veyra Dine" folder: keep using it.
{ const legacy = path.join(app.getPath('appData'), 'Veyra Dine'); if (APP_NAME !== 'Veyra Dine' && fs.existsSync(legacy)) app.setPath('userData', legacy); }
if (process.platform === 'win32') app.setAppUserModelId(CONFIG.appId || 'in.veyralab.dine');

let win = null, tray = null, quitting = false, baseUrl = '', restaurantName = '', trayHintShown = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

async function startLocalServer() {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');
  const S = require('../server');
  let port = Number(CONFIG.port) || 3000, srv = null;
  for (let i = 0; i < 20 && !srv; i++, port++) {
    try { srv = await S.start(port, '0.0.0.0'); } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  if (!srv) throw new Error('No free port to start the server');
  port -= 0;
  const actual = srv.address().port;
  const ip = S.lanAddresses()[0];
  // QR codes must point to an address phones can reach
  process.env.PUBLIC_URL = ip ? `http://${ip}:${actual}` : `http://localhost:${actual}`;
  return `http://localhost:${actual}`;
}

let startQuery = '';

// ---------- WiFi backup hub (online mode only) ----------
// The app keeps a copy of the restaurant on this computer and serves it on the restaurant WiFi. When the internet
// goes down, the window switches to that copy: guests (backup QR) and waiters on the WiFi keep ordering. When the
// internet is back, the orders go to the online server (no doubles) and the window switches back.
const hub = { base: '', lanUrl: '', port: 0, on: false, slug: '', lastPull: 0, lastOk: Date.now(), fails: 0, busy: false };
const HUB_PORT = Number(CONFIG.hubPort) || 8787;
async function startHub() {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'hub');
  process.env.HUB_MODE = '1';
  const S = require('../server');
  let srv = null, port = HUB_PORT;
  for (let i = 0; i < 10 && !srv; i++, port++) { try { srv = await S.start(port, '0.0.0.0'); } catch (e) { if (e.code !== 'EADDRINUSE') throw e; } }
  if (!srv) return;
  hub.port = srv.address().port; hub.base = `http://localhost:${hub.port}`;
  const ip = S.lanAddresses()[0]; hub.lanUrl = ip ? `http://${ip}:${hub.port}` : '';
  process.env.PUBLIC_URL = hub.lanUrl || hub.base; // backup QR codes point to this computer on the WiFi
  try { hub.slug = (await (await fetch(hub.base + '/api/hub/status')).json()).slug || ''; } catch {}
  setTimeout(hubTick, 4000); setInterval(hubTick, 30000);
}
const cloud = () => CONFIG.serverUrl.replace(/\/$/, '');
async function cloudCookie() {
  try { const c = await win.webContents.session.cookies.get({ url: cloud(), name: 'vd_admin' }); return c[0] ? 'vd_admin=' + c[0].value : ''; } catch { return ''; }
}
async function tfetch(url, opts = {}, ms = 8000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(t); }
}
async function cloudUp() { try { const r = await tfetch(cloud() + '/api/auth/config', {}, 6000); return r.ok; } catch { return false; } }
async function pullCopy(cookie) {
  const r = await tfetch(cloud() + '/api/admin/hub/snapshot', { headers: { cookie } }, 20000);
  if (!r.ok) return false;
  const snap = await r.json();
  const ok = await tfetch(hub.base + '/api/hub/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snap) }, 20000);
  if (!ok.ok) return false;
  hub.slug = snap.restaurant.slug; hub.lastPull = Date.now();
  // pictures: copy dish photos, logo and cover so the WiFi menu shows them without internet
  const dir = path.join(app.getPath('userData'), 'hub', 'uploads'); fs.mkdirSync(dir, { recursive: true });
  const pics = [snap.restaurant.logo, snap.restaurant.cover, ...snap.items.map(i => i.photo)].filter(u => typeof u === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(u));
  for (const u of pics) {
    const f = path.join(dir, u.slice(9)); if (fs.existsSync(f)) continue;
    try { const pr = await tfetch(cloud() + u, {}, 15000); if (pr.ok) fs.writeFileSync(f, Buffer.from(await pr.arrayBuffer())); } catch {}
  }
  return true;
}
async function pushOrders(cookie) {
  const p = await (await tfetch(hub.base + '/api/hub/pending')).json();
  if (!p.orders.length) return 0;
  const r = await tfetch(cloud() + '/api/admin/hub/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ orders: p.orders }) }, 20000);
  if (!r.ok) throw new Error('sync ' + r.status);
  const d = await r.json();
  await tfetch(hub.base + '/api/hub/synced', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: d.done }) });
  return d.done.length;
}
function hubNote(title, body) { if (Notification.isSupported()) { const n = new Notification({ title, body, icon: ICON }); n.on('click', showWindow); n.show(); } }
async function hubTick() {
  if (hub.busy || !hub.base || !win) return; hub.busy = true;
  try {
    if (await cloudUp()) {
      hub.fails = 0; hub.lastOk = Date.now();
      const cookie = hub.on ? hub.cookie : await cloudCookie();
      if (cookie) {
        hub.cookie = cookie;
        const sent = await pushOrders(cookie).catch(() => -1);
        if (hub.on && sent >= 0) { // back online: everything sent, go back to the online server
          hub.on = false; win.loadURL(`${baseUrl}/admin`);
          hubNote('Internet is back', sent ? `${sent} order${sent > 1 ? 's' : ''} from the WiFi backup were sent online.` : 'Back on the online server.');
        }
        if (!hub.on && Date.now() - hub.lastPull > 5 * 60000) await pullCopy(cookie).catch(() => {});
      }
    } else if (!hub.on && hub.slug && ++hub.fails >= 2) { // two checks in a row failed: switch to the WiFi backup
      hub.on = true; hub.cookie = await cloudCookie();
      win.loadURL(`${hub.base}/api/hub/login?slug=${encodeURIComponent(hub.slug)}`);
      hubNote('No internet: WiFi backup is on', 'Guests on your WiFi can order with the backup QR. Waiters keep working on the WiFi.');
    }
  } catch {} finally { hub.busy = false; }
}
ipcMain.handle('vd:hub', async () => {
  if (!hub.base) return null;
  let st = {}; try { st = await (await tfetch(hub.base + '/api/hub/status', {}, 3000)).json(); } catch {}
  return { on: hub.on, lan: hub.lanUrl, port: hub.port, slug: hub.slug || st.slug, copiedAt: st.at || null, pending: st.pending || 0 };
});
ipcMain.on('vd:hub-print', () => { if (hub.base && hub.slug) shell.openExternal(`${hub.base}/api/hub/login?slug=${encodeURIComponent(hub.slug)}&to=/print-qr`); });
ipcMain.on('vd:hub-refresh', async () => { const c = await cloudCookie(); if (c) { hub.lastPull = 0; hubTick(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 640, title: APP_NAME, icon: ICON, show: false,
    backgroundColor: '#FBF6EE', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.loadURL(`${baseUrl}/admin${startQuery}`);
  win.once('ready-to-show', () => win.show());
  // open outside links (WhatsApp, buy, test menu, print) in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl + '/print-qr') || (hub.base && url.startsWith(hub.base + '/print-qr'))) return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 800, icon: ICON, autoHideMenuBar: true } };
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(baseUrl) && !(hub.base && url.startsWith(hub.base))) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code === -3) return; // aborted, ignore
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#FBF6EE;color:#1B1714"><div style="text-align:center;max-width:460px"><h2>Can't reach ${APP_NAME}</h2><p>Please check that this computer is connected to the internet.</p><button onclick="location.href='${baseUrl}/admin'" style="height:46px;padding:0 22px;border:0;border-radius:12px;background:#E4572E;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Try again</button></div></body>`));
  });
  win.on('close', async e => {
    if (quitting) return;
    e.preventDefault();
    const { response } = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Keep running', 'Quit anyway'], defaultId: 0, cancelId: 0, title: APP_NAME,
      message: `Keep ${APP_NAME} running?`,
      detail: `If you close it, you won't hear new orders. It will keep running in the system tray, next to the clock.`,
    });
    if (response === 1) { quitting = true; app.quit(); }
    else { win.hide(); if (!trayHintShown && Notification.isSupported()) { trayHintShown = true; new Notification({ title: APP_NAME, body: 'Still running. New orders will pop up here.', icon: ICON }).show(); } }
  });
}

function showWindow() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function createTray() {
  const first = !tray;
  if (first) tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  const menu = Menu.buildFromTemplate([
    { label: `Open ${APP_NAME}`, click: showWindow },
    { label: 'Print table QR cards', click: () => { showWindow(); win.webContents.executeJavaScript(`window.open('/print-qr')`); } },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: i => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    { label: updateReady ? `Restart to update to ${updateReady}` : (upd.state === 'available' || upd.state === 'later') ? `Update to ${upd.version}` : 'Check for updates', click: checkUpdatesNow },
    { label: `Version ${app.getVersion()}`, enabled: false },
    ...(CONFIG.serverUrl ? [{ label: baseUrl.startsWith('http://localhost') ? 'Use the online server…' : 'Run on this computer only…', click: () => switchMode(baseUrl.startsWith('http://localhost') ? 'online' : 'local') }] : []),
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(menu);
  if (first) tray.on('click', showWindow);
}

// from the admin page (preload.js)
// login screen in this-computer mode: 'Continue with Google' / 'Use my online account' switch to the online server straight away
ipcMain.handle('vd:mode', () => ({ mode: baseUrl.startsWith('http://localhost') ? 'local' : 'online', canOnline: !!CONFIG.serverUrl }));
ipcMain.on('vd:use-online', (_e, then) => {
  if (!CONFIG.serverUrl) return;
  try { fs.writeFileSync(MODE_FILE(), JSON.stringify({ mode: 'online', at: new Date().toISOString() })); } catch {}
  quitting = true; app.relaunch({ args: process.argv.slice(1).filter(a => !a.startsWith('--then=')).concat(then === 'google' ? ['--then=google'] : []) }); app.exit(0);
});
// bill / KOT printing: list printers, and print a small receipt straight to the chosen printer
ipcMain.handle('vd:printers', async () => {
  if (!win) return [];
  const list = await win.webContents.getPrintersAsync();
  return list.map(p => ({ name: p.name, label: p.displayName || p.name, isDefault: !!p.isDefault }));
});
ipcMain.handle('vd:print', async (_e, { html, deviceName, silent } = {}) => {
  const pw = new BrowserWindow({ show: false, width: 400, height: 800, webPreferences: { sandbox: true, javascript: false } });
  try {
    await pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(String(html || '')));
    await new Promise(r => setTimeout(r, 300)); // let the QR image paint
    return await new Promise(resolve => pw.webContents.print({ silent: !!silent, deviceName: deviceName || undefined, printBackground: true, margins: { marginType: 'none' } }, (ok, err) => resolve({ ok, error: ok ? null : err })));
  } finally { setTimeout(() => { if (!pw.isDestroyed()) pw.destroy(); }, 1500); }
});
ipcMain.on('vd:ready', (_e, info) => {
  restaurantName = info && info.name || '';
  let title = restaurantName ? `${APP_NAME} · ${restaurantName}` : APP_NAME;
  const a = info && info.access;
  if (a && a.plan === 'trial') title += a.active ? `  (free trial: ${a.daysLeft} days left)` : '  (free trial ended)';
  if (win) win.setTitle(title);
  if (tray) tray.setToolTip(title);
});
ipcMain.on('vd:alert', (_e, { title, body } = {}) => {
  if (!win) return;
  if (!win.isFocused()) win.flashFrame(true);
  if (Notification.isSupported()) {
    const n = new Notification({ title: String(title || APP_NAME), body: String(body || ''), icon: ICON, urgency: 'critical' });
    n.on('click', showWindow); n.show();
  }
});


// ---------- automatic updates ----------
// The app checks for new versions in the background and shows "New update available" inside the app.
// The restaurant clicks "Update now" when it suits them, so an update never interrupts service.
// Data lives outside the app folder, so updates never touch the menu, tables or orders.
let updater = null, updateReady = null, manualCheck = false, installWhenReady = false;
let upd = { state: 'none', current: app.getVersion() };
function sendUpdate(patch) {
  upd = { ...upd, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('vd:update', upd);
  if (tray) createTray();
}
// Lifetime licenses include 1 year of updates. After that the app keeps working on its version and stops updating.
let updatesEndedOn = null;
async function updatesAllowed() {
  try {
    if (!win || win.isDestroyed()) return true;
    const me = await win.webContents.executeJavaScript("fetch('/api/admin/me').then(r => r.ok ? r.json() : null).catch(() => null)");
    const r = me && me.restaurant; if (!r) return true;
    const until = r.license && r.license.updatesUntil;
    updatesEndedOn = r.access && r.access.plan === 'lifetime' && until && until < new Date().toISOString().slice(0, 10) ? until : null;
    return !updatesEndedOn;
  } catch { return true; }
}
function updatesEndedBox() {
  return dialog.showMessageBox(win, { type: 'info', message: 'Updates for your lifetime license have ended', detail: `Your 1 year of updates ended on ${new Date(updatesEndedOn + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. ${APP_NAME} keeps working as it is.\n\nTo get the newest features, renew updates on WhatsApp +91 89282 46726 and enter the new key under Settings, Plan and license.` });
}
function setupUpdates() {
  if (!app.isPackaged || !CONFIG.updateUrl) return;
  try { updater = require('electron-updater').autoUpdater; } catch { return; }
  updater.setFeedURL({ provider: 'generic', url: CONFIG.updateUrl });
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.on('update-available', info => {
    if (upd.state === 'downloading' || upd.state === 'ready') return;
    sendUpdate({ state: 'available', version: info.version, percent: 0 });
    if (Notification.isSupported()) { const n = new Notification({ title: `New update available: ${APP_NAME} ${info.version}`, body: 'Open the app and click "Update now".', icon: ICON }); n.on('click', showWindow); n.show(); }
    manualCheck = false;
  });
  updater.on('download-progress', p => sendUpdate({ state: 'downloading', percent: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', info => {
    updateReady = info.version; sendUpdate({ state: 'ready', version: info.version, percent: 100 });
    if (installWhenReady) setTimeout(() => { quitting = true; updater.quitAndInstall(true, true); }, 1200);
  });
  updater.on('update-not-available', () => { if (manualCheck) dialog.showMessageBox(win, { type: 'info', message: `You have the latest version (${app.getVersion()}).` }); manualCheck = false; });
  updater.on('error', err => {
    console.error('update', err && err.message);
    if (upd.state === 'downloading') sendUpdate({ state: 'error' });
    else if (manualCheck) dialog.showMessageBox(win, { type: 'warning', message: 'Could not check for updates right now.', detail: 'Check the internet connection and try again later.' });
    manualCheck = false;
  });
  const check = async () => { if ((upd.state === 'none' || upd.state === 'later') && await updatesAllowed()) updater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 10000);
  setInterval(check, 2 * 60 * 60 * 1000);
}
function startUpdate() {
  if (!updater) return;
  if (updateReady) { quitting = true; return updater.quitAndInstall(true, true); }
  installWhenReady = true;
  if (upd.state !== 'downloading') { sendUpdate({ state: 'downloading', percent: 0 }); updater.downloadUpdate().catch(() => sendUpdate({ state: 'error' })); }
}
ipcMain.on('vd:update-state', () => { if (upd.state !== 'none') sendUpdate({}); });
ipcMain.on('vd:update-now', startUpdate);
ipcMain.on('vd:update-later', () => { if (upd.state === 'available') sendUpdate({ state: 'later' }); });
function checkUpdatesNow() {
  if (!updater) return dialog.showMessageBox(win, { type: 'info', message: `${APP_NAME} ${app.getVersion()}`, detail: 'Automatic updates are not set up in this copy.' });
  if (upd.state === 'available' || upd.state === 'later' || updateReady) { showWindow(); return startUpdate(); }
  return updatesAllowed().then(ok => ok ? checkUpdatesNowGo() : updatesEndedBox());
}
function checkUpdatesNowGo() {
  manualCheck = true; updater.checkForUpdates().catch(() => {});
}

const MODE_FILE = () => path.join(app.getPath('userData'), 'mode.json');
function runMode() {
  if (!CONFIG.serverUrl) return 'local';
  try { const m = JSON.parse(fs.readFileSync(MODE_FILE(), 'utf8')).mode; if (m === 'local' || m === 'online') return m; } catch {}
  let mode = 'online';
  try { const d = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'data', 'db.json'), 'utf8')); if (d.restaurants && d.restaurants.length) mode = 'local'; } catch {}
  try { fs.writeFileSync(MODE_FILE(), JSON.stringify({ mode, at: new Date().toISOString() })); } catch {}
  return mode;
}
async function switchMode(mode) {
  const { response } = await dialog.showMessageBox(win, { type: 'question', buttons: ['Switch and restart', 'Cancel'], defaultId: 0, cancelId: 1, title: APP_NAME,
    message: mode === 'online' ? 'Use the online server?' : 'Run on this computer only?',
    detail: mode === 'online' ? `Your restaurant will run on ${CONFIG.serverUrl}. Guests can order on mobile data and you can log in from any browser. Restaurants saved on this computer stay here and you can switch back any time.` : 'Guests will need to be on your Wi-Fi to order. Your online account is not deleted and you can switch back any time.' });
  if (response !== 0) return;
  fs.writeFileSync(MODE_FILE(), JSON.stringify({ mode, at: new Date().toISOString() }));
  quitting = true; app.relaunch(); app.exit(0);
}

app.whenReady().then(async () => {
  try {
    baseUrl = runMode() === 'online' ? CONFIG.serverUrl.replace(/\/$/, '') : await startLocalServer();
    if (process.argv.includes('--then=google') && !baseUrl.startsWith('http://localhost')) startQuery = '?google=1';
  } catch (err) {
    dialog.showErrorBox(APP_NAME, `Could not start: ${err.message}`); app.quit(); return;
  }
  createWindow();
  createTray();
  setupUpdates();
  if (CONFIG.serverUrl && !baseUrl.startsWith('http://localhost') && CONFIG.hub !== false) startHub().catch(e => console.log('[hub]', e.message));
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());
  if (!fs.existsSync(path.join(app.getPath('userData'), '.first-run-done'))) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); // start with Windows by default
    fs.writeFileSync(path.join(app.getPath('userData'), '.first-run-done'), new Date().toISOString());
  }
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* keep running in the tray */ });
