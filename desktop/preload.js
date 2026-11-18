// Gives the admin page a small bridge to Windows: pop-up alerts, taskbar flash, window title, app updates, bill printing.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vdDesktop', {
  alert: (title, body) => ipcRenderer.send('vd:alert', { title, body }),
  ready: info => ipcRenderer.send('vd:ready', info),
  onUpdate: cb => { ipcRenderer.on('vd:update', (_e, s) => cb(s)); ipcRenderer.send('vd:update-state'); },
  updateNow: () => ipcRenderer.send('vd:update-now'),
  updateLater: () => ipcRenderer.send('vd:update-later'),
  printers: () => ipcRenderer.invoke('vd:printers'),
  print: (html, opts) => ipcRenderer.invoke('vd:print', { html, ...(opts || {}) }),
  mode: () => ipcRenderer.invoke('vd:mode'),
  useOnline: then => ipcRenderer.send('vd:use-online', then || ''),
});
