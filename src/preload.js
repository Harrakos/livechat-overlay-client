const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  onMemeData: (callback) => ipcRenderer.on('meme-data', (_event, payload) => callback(payload)),
  // Resolves once the main process has made the window visible.
  ready: () => ipcRenderer.invoke('overlay:ready'),
  // Tells the main process the meme is over and the window can be closed.
  done: () => ipcRenderer.send('overlay:done'),
});
