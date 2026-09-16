const path = require('node:path');
const { BrowserWindow, screen } = require('electron');

const OVERLAY_WIDTH = 480;
const OVERLAY_HEIGHT = 360;
const SCREEN_MARGIN_X = 12;
const SCREEN_MARGIN_Y = 6;

function showMemeOverlay(payload) {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: originX, y: originY } = display.workArea;

  // x/y (0-100) place the window's top-left corner: 0 = flush against the
  // screen edge, 100 = flush against the opposite edge. This keeps the
  // window fully on-screen at every value.
  const usableWidth = screenWidth - OVERLAY_WIDTH - SCREEN_MARGIN_X * 2;
  const usableHeight = screenHeight - OVERLAY_HEIGHT - SCREEN_MARGIN_Y * 2;

  const posX = originX + SCREEN_MARGIN_X + (payload.x / 100) * Math.max(usableWidth, 0);
  const posY = originY + SCREEN_MARGIN_Y + (payload.y / 100) * Math.max(usableHeight, 0);

  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: Math.round(posX),
    y: Math.round(posY),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('meme-data', payload);
    win.showInactive();
  });

  const closeTimer = setTimeout(() => {
    if (!win.isDestroyed()) win.close();
  }, payload.duration * 1000 + 500);

  win.on('closed', () => clearTimeout(closeTimer));
}

module.exports = { showMemeOverlay };
