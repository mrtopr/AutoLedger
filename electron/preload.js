const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  printCurrentPage: (options) => ipcRenderer.send('print-page', options),
});
