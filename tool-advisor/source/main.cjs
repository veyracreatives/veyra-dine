const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } = require('electron');
const path = require('path'); const fs = require('fs'); const { pathToFileURL } = require('url');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const ROOT = path.join(__dirname, 'ui');
let win;
function sendFile(p) {
  if (!p || !fs.existsSync(p)) return;
  win.webContents.send('open-file', path.basename(p), fs.readFileSync(p));
}
app.whenReady().then(() => {
  protocol.handle('app', req => {
    const u = new URL(req.url); let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const fp = path.normalize(path.join(ROOT, rel));
    if (!fp.startsWith(ROOT)) return new Response('no', { status: 403 });
    return net.fetch(pathToFileURL(fp).toString());
  });
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 760, minHeight: 560, backgroundColor: '#0f1218', title: 'Veyra Tool Advisor', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false } });
  win.loadURL('app://local/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('did-finish-load', () => { const f = process.argv.slice(1).find(a => /\.(stp|step|igs|iges|stl|x_t)$/i.test(a)); if (f) sendFile(f); });
});
app.on('window-all-closed', () => app.quit());
ipcMain.handle('save-pdf', async (e, html, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  const tmp = path.join(app.getPath('temp'), 'vta-sheet.html'); fs.writeFileSync(tmp, html);
  const w = new BrowserWindow({ show: false }); await w.loadFile(tmp);
  const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } });
  w.destroy(); fs.writeFileSync(r.filePath, pdf); shell.openPath(r.filePath); return r.filePath;
});
