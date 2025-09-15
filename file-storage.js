import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  number_default: "1234567890",
  number_tr: "1234567890", 
  text_default: "Hello! How can I help you?",
  text_tr: "Merhaba! Size nasıl yardımcı olabilirim?"
};

// Load configuration from file
function loadConfig() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[file-storage] Error loading config:', error.message);
  }
  return DEFAULT_CONFIG;
}

// Save configuration to file
function saveConfig(config) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(config, null, 2));
    console.log('[file-storage] Config saved successfully');
    return true;
  } catch (error) {
    console.error('[file-storage] Error saving config:', error.message);
    return false;
  }
}

// File-based storage implementation
export function getFileStorage() {
  let config = loadConfig();
  
  return {
    async get(key) {
      return config[key] || null;
    },
    
    async set(key, value) {
      config[key] = value;
      return saveConfig(config);
    },
    
    async getAll() {
      return config;
    }
  };
}
