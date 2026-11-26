const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('veyra', {
  savePdf: (html, name) => ipcRenderer.invoke('save-pdf', html, name),
  onOpenFile: cb => ipcRenderer.on('open-file', (e, name, bytes) => cb(name, bytes)),
});
