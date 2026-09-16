const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  onMemeData: (callback) => ipcRenderer.on('meme-data', (_event, payload) => callback(payload)),
});
