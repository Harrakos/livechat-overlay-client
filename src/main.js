const path = require('node:path');
const { app, Tray, Menu, nativeImage } = require('electron');
const { loadConfig } = require('./config');
const { WsClient } = require('./wsClient');
const { showMemeOverlay, clearQueue } = require('./overlayWindow');
const { setupAutoUpdate, autoUpdater } = require('./autoUpdate');
const { openSettingsWindow } = require('./settingsWindow');

const TRAY_ICON_PATH = path.join(__dirname, 'assets', 'tray-icon.png');

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
// In-memory only on purpose: a restart always resumes reception, so nobody
// ends up silently muted forever after forgetting they paused.
let paused = false;

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
  const items = [
    { label: connectionLabel(connectionStatus), enabled: false },
    {
      label: paused ? '▶ Reprendre la réception des memes' : '⏸ Mettre en pause la réception',
      click: () => setPaused(!paused),
    },
  ];

  const updateItemLabel = updateLabel(updateStatus);
  if (updateItemLabel) {
    items.push({ label: updateItemLabel, enabled: false });
  }
  if (updateStatus === 'ready') {
    items.push({ label: 'Redémarrer pour mettre à jour', click: () => autoUpdater.quitAndInstall() });
  }

  items.push(
    { type: 'separator' },
    { label: 'Paramètres...', click: () => openSettingsWindow() },
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
  const pausedSuffix = paused ? ' (en pause)' : '';
  tray?.setToolTip(`LiveChat — ${connectionLabel(connectionStatus)}${pausedSuffix}`);
}

function setPaused(value) {
  paused = value;
  // Pausing also drops memes still waiting in the queue, otherwise they
  // would pop up right after resuming, long after they were sent.
  if (paused) clearQueue();
  refreshTray();
}

function onMeme(payload) {
  console.log(`Meme received: scale=${payload.scale} duration=${payload.duration} x=${payload.x} y=${payload.y}`);
  // The WebSocket stays connected while paused so resuming is instant;
  // memes that arrive in the meantime are simply dropped, not queued.
  if (paused) return;
  showMemeOverlay(payload);
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
  const icon = nativeImage.createFromPath(TRAY_ICON_PATH).resize({ width: 32, height: 32 });
  // The icon is a plain white silhouette on transparent — mark it as a
  // template image so macOS auto-inverts it for the current menu bar theme.
  // (Windows/Linux trays don't have an equivalent; on a light taskbar/panel
  // theme the white icon may be hard to see there.)
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip('LiveChat');
  tray.setContextMenu(buildTrayMenu());

  app.setLoginItemSettings({ openAtLogin: true });

  setupAutoUpdate({ onStatus: onUpdateStatus });

  const config = loadConfig();
  wsClient = new WsClient(config);

  wsClient.on('status', onConnectionStatus);
  wsClient.on('meme', onMeme);
  wsClient.connect();
});

app.on('window-all-closed', (event) => {
  // Keep running in the tray even with no overlay windows open.
  event.preventDefault();
});

app.on('before-quit', () => {
  wsClient?.stop();
});
