// ============================================================
//  Electron Preload Script — جسر الأمان بين النظام وسطح المكتب
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  openCustomerWindow: () => ipcRenderer.invoke('open-customer-window')
});
