const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nudgeDesktop', {
  attention: (p) => ipcRenderer.invoke('nb:attention', p),
  status: (s) => ipcRenderer.invoke('nb:status', s),
  openExternal: (u) => ipcRenderer.invoke('nb:openExternal', u),
  getAutoLaunch: () => ipcRenderer.invoke('nb:getAutoLaunch'),
  setAutoLaunch: (on) => ipcRenderer.invoke('nb:setAutoLaunch', on),
  present: (p) => ipcRenderer.invoke('nb:present', p),
  onPresent: (cb) => ipcRenderer.on('nb:present', (_e, p) => cb(p)),
  petIgnore: (v) => ipcRenderer.invoke('nb:pet-ignore', v),
  petMenu: (info) => ipcRenderer.invoke('nb:pet-menu', info),
  petAttention: (p) => ipcRenderer.invoke('nb:pet-attention', p),
  openMain: () => ipcRenderer.invoke('nb:open-main'),
  onTray: (cb) => ipcRenderer.on('nb:tray', (_e, cmd, arg) => cb(cmd, arg)),
});
