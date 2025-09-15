import { redisManager } from './redis.js';
import { config } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { StorageError, ValidationError } from '../utils/errors.js';
import { validateConfiguration } from '../config/validation.js';

class ConfigStorage {
  constructor() {
    this.configKey = 'whatsapp_config';
    this.cacheKey = 'config_cache';
    this.cacheTTL = 300; // 5 minutes
    this.cachedConfig = null;
    this.lastCacheTime = 0;
  }

  async getConfig() {
    try {
      // Check memory cache first
      if (this.cachedConfig && (Date.now() - this.lastCacheTime) < (this.cacheTTL * 1000)) {
        logger.debug('Returning cached configuration');
        return this.cachedConfig;
      }

      // Try to get from Redis
      const storedConfig = await redisManager.get(this.configKey);
      
      if (storedConfig) {
        try {
          const parsedConfig = JSON.parse(storedConfig);
          this.cachedConfig = parsedConfig;
          this.lastCacheTime = Date.now();
          logger.info('Configuration loaded from storage', { keys: Object.keys(parsedConfig) });
          return parsedConfig;
        } catch (parseError) {
          logger.error('Failed to parse stored configuration', { error: parseError.message });
        }
      }

      // Fallback to default configuration
      const defaultConfig = {
        number_default: config.get('number_default'),
        number_tr: config.get('number_tr'),
        text_default: config.get('text_default'),
        text_tr: config.get('text_tr')
      };

      logger.info('Using default configuration');
      this.cachedConfig = defaultConfig;
      this.lastCacheTime = Date.now();
      return defaultConfig;

    } catch (error) {
      logger.error('Error getting configuration', { error: error.message });
      throw new StorageError('Failed to retrieve configuration');
    }
  }

  async setConfig(newConfig) {
    try {
      // Validate configuration
      const validatedConfig = validateConfiguration(newConfig);
      
      // Update cache
      this.cachedConfig = validatedConfig;
      this.lastCacheTime = Date.now();
      
      // Store in Redis
      const configJson = JSON.stringify(validatedConfig);
      await redisManager.set(this.configKey, configJson);
      
      logger.info('Configuration updated successfully', { 
        keys: Object.keys(validatedConfig),
        number_default: validatedConfig.number_default,
        number_tr: validatedConfig.number_tr
      });
      
      return validatedConfig;
    } catch (error) {
      logger.error('Error setting configuration', { error: error.message });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new StorageError('Failed to save configuration');
    }
  }

  async updateConfig(updates) {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig = { ...currentConfig, ...updates };
      return await this.setConfig(updatedConfig);
    } catch (error) {
      logger.error('Error updating configuration', { error: error.message });
      throw error;
    }
  }

  async resetConfig() {
    try {
      const defaultConfig = {
        number_default: config.get('number_default'),
        number_tr: config.get('number_tr'),
        text_default: config.get('text_default'),
        text_tr: config.get('text_tr')
      };
      
      await this.setConfig(defaultConfig);
      logger.info('Configuration reset to defaults');
      return defaultConfig;
    } catch (error) {
      logger.error('Error resetting configuration', { error: error.message });
      throw new StorageError('Failed to reset configuration');
    }
  }

  async clearCache() {
    this.cachedConfig = null;
    this.lastCacheTime = 0;
    await redisManager.del(this.cacheKey);
    logger.info('Configuration cache cleared');
  }

  // Get specific configuration value
  async getValue(key) {
    const config = await this.getConfig();
    return config[key] || null;
  }

  // Set specific configuration value
  async setValue(key, value) {
    const updates = { [key]: value };
    return await this.updateConfig(updates);
  }

  // Health check for configuration storage
  async healthCheck() {
    try {
      const storageHealth = await redisManager.healthCheck();
      const configTest = await this.getConfig();
      
      return {
        status: 'healthy',
        storage: storageHealth,
        config: {
          hasDefaultNumber: !!configTest.number_default,
          hasTurkeyNumber: !!configTest.number_tr,
          keys: Object.keys(configTest)
        }
      };
    } catch (error) {
      logger.error('Configuration storage health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export const configStorage = new ConfigStorage();
