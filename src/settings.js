const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  volume: 0.5, // 0..1
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings };
