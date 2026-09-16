const { autoUpdater } = require('electron-updater');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // re-check every hour while running

function setupAutoUpdate({ onStatus } = {}) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => onStatus?.('checking'));
  autoUpdater.on('update-available', (info) => onStatus?.('available', info));
  autoUpdater.on('update-not-available', () => onStatus?.('up-to-date'));
  autoUpdater.on('download-progress', (progress) => onStatus?.('downloading', progress));
  autoUpdater.on('update-downloaded', (info) => onStatus?.('ready', info));
  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error);
    onStatus?.('error', error);
  });

  // electron-updater only works against a packaged app (it reads app-update.yml,
  // which electron-builder generates at build time). Skip it in `npm start` dev runs.
  if (!require('electron').app.isPackaged) {
    console.log('Skipping auto-update: app is not packaged (dev run).');
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), CHECK_INTERVAL_MS);
}

module.exports = { setupAutoUpdate, autoUpdater };
