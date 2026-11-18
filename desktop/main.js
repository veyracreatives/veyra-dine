// Veyra Dine In for Windows: the counter app.
// - If config.json has a serverUrl, it opens that online server (guests' phones work on any network).
// - If not, it runs the server on this computer (guests must be on the restaurant Wi-Fi).
'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch { return {}; } })();
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

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 640, title: APP_NAME, icon: ICON, show: false,
    backgroundColor: '#FBF6EE', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.loadURL(`${baseUrl}/admin`);
  win.once('ready-to-show', () => win.show());
  // open outside links (WhatsApp, buy, test menu, print) in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl + '/print-qr')) return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 800, icon: ICON, autoHideMenuBar: true } };
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(baseUrl)) { e.preventDefault(); shell.openExternal(url); } });
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
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(menu);
  if (first) tray.on('click', showWindow);
}

// from the admin page (preload.js)
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
  const check = () => { if (upd.state === 'none' || upd.state === 'later') updater.checkForUpdates().catch(() => {}); };
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
  manualCheck = true; updater.checkForUpdates().catch(() => {});
}

app.whenReady().then(async () => {
  try {
    baseUrl = CONFIG.serverUrl ? CONFIG.serverUrl.replace(/\/$/, '') : await startLocalServer();
  } catch (err) {
    dialog.showErrorBox(APP_NAME, `Could not start: ${err.message}`); app.quit(); return;
  }
  createWindow();
  createTray();
  setupUpdates();
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());
  if (!fs.existsSync(path.join(app.getPath('userData'), '.first-run-done'))) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); // start with Windows by default
    fs.writeFileSync(path.join(app.getPath('userData'), '.first-run-done'), new Date().toISOString());
  }
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* keep running in the tray */ });
