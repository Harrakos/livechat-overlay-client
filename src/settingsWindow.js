const path = require('node:path');
const { BrowserWindow, ipcMain } = require('electron');
const { loadSettings, saveSettings } = require('./settings');

let settingsWindow = null;
let handlersRegistered = false;

function registerHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_event, partial) => saveSettings(partial));
}

function openSettingsWindow() {
  registerHandlers();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 360,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Paramètres — LiveChat',
    webPreferences: {
      preload: path.join(__dirname, 'settingsPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

module.exports = { openSettingsWindow };
