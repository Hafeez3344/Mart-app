const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Network & Status
  getLanInfo: () => ipcRenderer.invoke('get-lan-info'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),

  // Hardware: Silent Thermal Printing
  silentPrint: (options) => ipcRenderer.invoke('silent-print', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // Hardware: Cash Drawer
  openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),

  // Database Maintenance
  createDbBackup: () => ipcRenderer.invoke('create-db-backup'),

  // Window Controls
  toggleKiosk: () => ipcRenderer.invoke('toggle-kiosk'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
});

