const path = require('node:path');
const { app, Tray, Menu, nativeImage } = require('electron');
const { loadConfig } = require('./config');
const { WsClient } = require('./wsClient');
const { showMemeOverlay } = require('./overlayWindow');
const { setupAutoUpdate, autoUpdater } = require('./autoUpdate');

// Simple solid-color placeholder icon (16x16 Discord-blurple square) — swap
// tray-icon.png for a real brand icon before shipping.
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGOISP30nxLMMGrAqAGjBgwXAwCEoK4f/pwOKwAAAABJRU5ErkJggg==';

// On Linux, transparent BrowserWindows often aren't actually transparent at
// the GPU/compositor level without this switch — without it the window can
// render as an opaque rectangle that swallows clicks even with
// setIgnoreMouseEvents(true). Must be set before app is ready.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.disableHardwareAcceleration();
}

app.dock?.hide();

let tray;
let wsClient;
let connectionStatus = 'connecting';
let updateStatus = 'idle';

function connectionLabel(status) {
  switch (status) {
    case 'connected':
      return 'Connecté au serveur';
    case 'disconnected':
      return 'Déconnecté — reconnexion...';
    default:
      return 'Connexion en cours...';
  }
}

function updateLabel(status) {
  switch (status) {
    case 'checking':
      return 'Recherche de mise à jour...';
    case 'available':
      return 'Mise à jour trouvée, téléchargement...';
    case 'downloading':
      return 'Téléchargement de la mise à jour...';
    case 'ready':
      return 'Mise à jour prête (installation au redémarrage)';
    case 'error':
      return 'Erreur de mise à jour';
    case 'up-to-date':
    default:
      return null; // don't clutter the menu when there's nothing to report
  }
}

function buildTrayMenu() {
  const items = [{ label: connectionLabel(connectionStatus), enabled: false }];

  const updateItemLabel = updateLabel(updateStatus);
  if (updateItemLabel) {
    items.push({ label: updateItemLabel, enabled: false });
  }
  if (updateStatus === 'ready') {
    items.push({ label: 'Redémarrer pour mettre à jour', click: () => autoUpdater.quitAndInstall() });
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Vérifier les mises à jour',
      click: () => {
        if (!app.isPackaged) {
          console.log('Update check ignored: app is not packaged (dev run).');
          return;
        }
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { label: 'Quitter', click: () => app.quit() },
  );

  return Menu.buildFromTemplate(items);
}

function refreshTray() {
  tray?.setContextMenu(buildTrayMenu());
  tray?.setToolTip(`LiveChat Overlay — ${connectionLabel(connectionStatus)}`);
}

function onConnectionStatus(status) {
  connectionStatus = status;
  refreshTray();
}

function onUpdateStatus(status) {
  updateStatus = status;
  refreshTray();
}

app.whenReady().then(() => {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip('LiveChat Overlay');
  tray.setContextMenu(buildTrayMenu());

  app.setLoginItemSettings({ openAtLogin: true });

  setupAutoUpdate({ onStatus: onUpdateStatus });

  const config = loadConfig();
  wsClient = new WsClient(config);

  wsClient.on('status', onConnectionStatus);
  wsClient.on('meme', showMemeOverlay);
  wsClient.connect();
});

app.on('window-all-closed', (event) => {
  // Keep running in the tray even with no overlay windows open.
  event.preventDefault();
});

app.on('before-quit', () => {
  wsClient?.stop();
});
