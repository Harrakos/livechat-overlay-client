const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const { loadSettings } = require('./settings');

// Window size at taille=100.
const BASE_WIDTH = 720;
const BASE_HEIGHT = 540;
// Floor for small `taille` values. The badge and caption keep a fixed size,
// so below this they would no longer fit and get cropped.
const MIN_WIDTH = 360;
const MIN_HEIGHT = 270;
const SCREEN_MARGIN_X = 12;
const SCREEN_MARGIN_Y = 6;

// Memes are shown one at a time: a meme that arrives while another is on
// screen waits its turn instead of stacking on top of it.
const MAX_PENDING = 20; // guards against spam piling up minutes of memes
// Safety nets so a broken meme can never block the queue forever.
const LOAD_TIMEOUT_MS = 20_000; // the renderer never reported the meme ready
const MAX_SHOW_MS = 135_000; // the renderer never reported it finished (longest video is 120s)
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
  const windowWidth = Math.max(Math.round(BASE_WIDTH * scaleFactor * fitFactor), MIN_WIDTH);
  const windowHeight = Math.max(Math.round(BASE_HEIGHT * scaleFactor * fitFactor), MIN_HEIGHT);

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
      // The window stays hidden while its media loads; do not let Chromium
      // throttle the page in the meantime.
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  const { volume } = loadSettings();

  const closeWindow = () => {
    if (!win.isDestroyed()) win.close();
  };

  // The window stays hidden until the renderer has loaded the avatar and
  // the media and says it is ready, so everything appears at the same time.
  let hardTimer = null;
  const loadTimer = setTimeout(closeWindow, LOAD_TIMEOUT_MS);

  win.webContents.ipc.handle('overlay:ready', () => {
    clearTimeout(loadTimer);
    if (win.isDestroyed()) return;
    win.showInactive();
    hardTimer = setTimeout(closeWindow, MAX_SHOW_MS);
  });
  // The renderer decides how long the meme lasts (a video plays to its end),
  // and tells us when it has finished fading out.
  win.webContents.ipc.on('overlay:done', closeWindow);
  win.webContents.on('render-process-gone', closeWindow);

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('meme-data', { ...payload, volume });
  });

  win.on('closed', () => {
    clearTimeout(loadTimer);
    clearTimeout(hardTimer);
    onDone();
  });
}

module.exports = { showMemeOverlay, clearQueue };
