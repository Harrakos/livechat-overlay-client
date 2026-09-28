const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function loadConfig() {
  const userConfigPath = path.join(app.getPath('userData'), 'config.json');
  // config.default.json is generated at build time (CI injects the real
  // prod values from GitHub secrets — see .github/workflows/release.yml)
  // and bundled into the packaged app, so a fresh install works with zero
  // manual setup. It's gitignored: never committed with real values.
  const bundledDefaultPath = path.join(__dirname, '..', 'config.default.json');
  // Fallback for local dev when config.default.json hasn't been generated.
  const bundledExamplePath = path.join(__dirname, '..', 'config.example.json');

  let configPath = userConfigPath;
  if (!fs.existsSync(configPath)) configPath = bundledDefaultPath;
  if (!fs.existsSync(configPath)) configPath = bundledExamplePath;

  if (!fs.existsSync(configPath)) {
    throw new Error(
      'No config found. Create one at ' +
        userConfigPath +
        ', or copy client/config.example.json to client/config.default.json for local dev.',
    );
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  if (!config.serverWsUrl || !config.clientToken) {
    throw new Error(`Invalid config at ${configPath}: missing serverWsUrl or clientToken`);
  }

  console.log(`Loaded config from ${configPath}`);
  return config;
}

module.exports = { loadConfig };
