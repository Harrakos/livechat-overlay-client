const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const { loadSettings } = require('./settings');

// Window size at taille=100. The renderer's CSS is designed around
// DESIGN_WIDTH, so it is scaled by (actual width / DESIGN_WIDTH).
const BASE_WIDTH = 720;
const BASE_HEIGHT = 540;
const DESIGN_WIDTH = 480;
const SCREEN_MARGIN_X = 12;
const SCREEN_MARGIN_Y = 6;

// Memes are shown one at a time: a meme that arrives while another is on
// screen waits its turn instead of stacking on top of it.
const MAX_PENDING = 20; // guards against spam piling up minutes of memes
const queue = [];
let showing = false;

function showMemeOverlay(payload) {
  if (queue.length >= MAX_PENDING) {
    console.warn('Meme queue full, dropping incoming meme');
    return;
  }
  queue.push(payload);
  playNext();
}

function clearQueue() {
  queue.length = 0;
}

function playNext() {
  if (showing || queue.length === 0) return;
  showing = true;
  displayMeme(queue.shift(), () => {
    showing = false;
    playNext();
  });
}

function displayMeme(payload, onDone) {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: originX, y: originY } = display.workArea;

  const scaleFactor = typeof payload.scale === 'number' ? payload.scale / 100 : 1;
  // Never let the window exceed the screen (taille=300 would otherwise be
  // larger than most displays); shrink both axes by the same factor.
  const fitFactor = Math.min(
    1,
    (screenWidth - SCREEN_MARGIN_X * 2) / (BASE_WIDTH * scaleFactor),
    (screenHeight - SCREEN_MARGIN_Y * 2) / (BASE_HEIGHT * scaleFactor),
  );
  const windowWidth = Math.round(BASE_WIDTH * scaleFactor * fitFactor);
  const windowHeight = Math.round(BASE_HEIGHT * scaleFactor * fitFactor);
  const uiScale = windowWidth / DESIGN_WIDTH;

  // x/y (0-100) place the window's top-left corner: 0 = flush against the
  // screen edge, 100 = flush against the opposite edge. This keeps the
  // window fully on-screen at every value.
  const usableWidth = screenWidth - windowWidth - SCREEN_MARGIN_X * 2;
  const usableHeight = screenHeight - windowHeight - SCREEN_MARGIN_Y * 2;

  const posX = originX + SCREEN_MARGIN_X + (payload.x / 100) * Math.max(usableWidth, 0);
  const posY = originY + SCREEN_MARGIN_Y + (payload.y / 100) * Math.max(usableHeight, 0);

  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
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
      // The overlay window is created programmatically, never from a user
      // click — without this, Electron/Chromium would silently block audio
      // autoplay on videos that have sound.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  const { volume } = loadSettings();

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('meme-data', { ...payload, volume, uiScale });
    win.showInactive();
  });

  const closeTimer = setTimeout(() => {
    if (!win.isDestroyed()) win.close();
  }, payload.duration * 1000 + 500);

  win.on('closed', () => {
    clearTimeout(closeTimer);
    onDone();
  });
}

module.exports = { showMemeOverlay, clearQueue };
