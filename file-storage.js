// Hybrid storage: try file first, fallback to in-memory
let memoryStorage = new Map();

// Default configuration
const DEFAULT_CONFIG = {
  number_default: "1234567890",
  number_tr: "1234567890", 
  text_default: "Hello! How can I help you?",
  text_tr: "Merhaba! Size nasıl yardımcı olabilirim?"
};

// Load configuration from memory (persists during service lifetime)
function loadConfig() {
  const config = { ...DEFAULT_CONFIG };
  
  // Load from memory storage
  for (const [key, value] of memoryStorage.entries()) {
    config[key] = value;
  }
  
  return config;
}

// Save configuration to memory
function saveConfig(config) {
  try {
    // Save to memory storage
    for (const [key, value] of Object.entries(config)) {
      memoryStorage.set(key, value);
    }
    console.log('[storage] Config saved to memory successfully');
    return true;
  } catch (error) {
    console.error('[storage] Error saving config:', error.message);
    return false;
  }
}

// Memory-based storage implementation
export function getFileStorage() {
  return {
    async get(key) {
      const config = loadConfig();
      const value = config[key] || null;
      console.log(`[storage] GET ${key} = ${value}`);
      return value;
    },
    
    async set(key, value) {
      console.log(`[storage] SET ${key} = ${value}`);
      const config = loadConfig();
      config[key] = value;
      return saveConfig(config);
    },
    
    async getAll() {
      const config = loadConfig();
      console.log(`[storage] GET ALL =`, config);
      return config;
    }
  };
}
