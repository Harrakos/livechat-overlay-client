const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function loadConfig() {
  const userConfigPath = path.join(app.getPath('userData'), 'config.json');
  const bundledExamplePath = path.join(__dirname, '..', 'config.example.json');

  const configPath = fs.existsSync(userConfigPath) ? userConfigPath : bundledExamplePath;
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  if (!config.serverWsUrl || !config.clientToken) {
    throw new Error(`Invalid config at ${configPath}: missing serverWsUrl or clientToken`);
  }

  console.log(`Loaded config from ${configPath}`);
  return config;
}

module.exports = { loadConfig };
