const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '..', 'config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = { loadConfig, saveConfig };
