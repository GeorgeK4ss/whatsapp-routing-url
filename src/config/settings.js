import { logger } from '../utils/logger.js';
import { ConfigurationError } from '../utils/errors.js';

class ConfigManager {
  constructor() {
    this.config = {
      // WhatsApp numbers (E.164 format without +)
      number_default: process.env.DEFAULT_WHATSAPP_NUMBER || "1234567890",
      number_tr: process.env.TURKEY_WHATSAPP_NUMBER || "1234567890",
      
      // Prefill texts
      text_default: process.env.DEFAULT_TEXT || "Hello! How can I help you?",
      text_tr: process.env.TURKEY_TEXT || "Merhaba! Size nasıl yardımcı olabilirim?",
      
      // Telegram channels
      telegram_channel_default: process.env.DEFAULT_TELEGRAM_CHANNEL || "your_default_channel",
      telegram_channel_tr: process.env.TURKEY_TELEGRAM_CHANNEL || "your_turkey_channel",
      
      // Telegram prefill texts
      telegram_text_default: process.env.DEFAULT_TELEGRAM_TEXT || "Hello! How can I help you?",
      telegram_text_tr: process.env.TURKEY_TELEGRAM_TEXT || "Merhaba! Size nasıl yardımcı olabilirim?",
      
      // Website URLs
      website_url_default: process.env.DEFAULT_WEBSITE_URL || "https://example.com",
      website_url_tr: process.env.TURKEY_WEBSITE_URL || "https://turkey.example.com",
      
      // Redirect configuration
      redirect_type: process.env.DEFAULT_REDIRECT_TYPE || "immediate",
      redirect_delay: parseInt(process.env.REDIRECT_DELAY) || 3000,
      redirect_message: process.env.REDIRECT_MESSAGE || "Redirecting to our website...",
      
      // Service configuration
      port: parseInt(process.env.PORT) || 3000,
      nodeEnv: process.env.NODE_ENV || 'development',
      
      // Security
      adminToken: process.env.ADMIN_TOKEN,
      sessionSecret: process.env.SESSION_SECRET || 'default-session-secret',
      
      // External services
      ipinfoToken: process.env.IPINFO_TOKEN,
      redisUrl: process.env.REDIS_URL,
      
      // Rate limiting
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || (process.env.NODE_ENV === 'development' ? 300000 : 600000), // 5 min dev, 10 min prod
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'development' ? 1000 : 500),
      
      // Geo-location
      geoCacheTTL: parseInt(process.env.GEO_CACHE_TTL) || 86400, // 24 hours
      geoTimeout: parseInt(process.env.GEO_TIMEOUT) || 5000, // 5 seconds
      
      // Logging
      logLevel: process.env.LOG_LEVEL || 'info',
      logFile: process.env.LOG_FILE || 'app.log'
    };
    
    this.validateConfiguration();
    this.logConfiguration();
  }

  validateConfiguration() {
    const errors = [];
    
    // Validate required environment variables
    if (!this.config.adminToken) {
      errors.push('ADMIN_TOKEN is required');
    } else if (this.config.adminToken.length < 16) {
      errors.push('ADMIN_TOKEN must be at least 16 characters');
    }
    
    if (!this.config.ipinfoToken) {
      errors.push('IPINFO_TOKEN is required for geo-location detection');
    }
    
    // Validate phone numbers
    if (!/^[1-9]\d{6,14}$/.test(this.config.number_default)) {
      errors.push('DEFAULT_WHATSAPP_NUMBER must be 7-15 digits and not start with 0');
    }
    
    if (!/^[1-9]\d{6,14}$/.test(this.config.number_tr)) {
      errors.push('TURKEY_WHATSAPP_NUMBER must be 7-15 digits and not start with 0');
    }
    
    // Validate Telegram channels
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(this.config.telegram_channel_default)) {
      errors.push('DEFAULT_TELEGRAM_CHANNEL must be 5-32 characters, alphanumeric and underscores only');
    }
    
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(this.config.telegram_channel_tr)) {
      errors.push('TURKEY_TELEGRAM_CHANNEL must be 5-32 characters, alphanumeric and underscores only');
    }
    
    // Validate port
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }
    
    if (errors.length > 0) {
      throw new ConfigurationError(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  logConfiguration() {
    logger.info('Configuration loaded', {
      port: this.config.port,
      nodeEnv: this.config.nodeEnv,
      hasAdminToken: !!this.config.adminToken,
      hasIpinfoToken: !!this.config.ipinfoToken,
      hasRedisUrl: !!this.config.redisUrl,
      defaultNumber: this.config.number_default,
      turkeyNumber: this.config.number_tr,
      logLevel: this.config.logLevel
    });
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }

  set(key, value) {
    if (key in this.config) {
      this.config[key] = value;
      logger.info(`Configuration updated: ${key}`, { value });
    } else {
      logger.warn(`Attempted to set unknown configuration key: ${key}`);
    }
  }

  // Get configuration for public endpoints (without sensitive data)
  getPublicConfig() {
    return {
      number_default: this.config.number_default,
      number_tr: this.config.number_tr,
      text_default: this.config.text_default,
      text_tr: this.config.text_tr,
      telegram_channel_default: this.config.telegram_channel_default,
      telegram_channel_tr: this.config.telegram_channel_tr,
      telegram_text_default: this.config.telegram_text_default,
      telegram_text_tr: this.config.telegram_text_tr,
      website_url_default: this.config.website_url_default,
      website_url_tr: this.config.website_url_tr,
      redirect_type: this.config.redirect_type,
      redirect_delay: this.config.redirect_delay,
      redirect_message: this.config.redirect_message
    };
  }

  // Get environment status for health checks
  getEnvironmentStatus() {
    return {
      REDIS_URL: this.config.redisUrl ? 'SET' : 'NOT SET',
      ADMIN_TOKEN: this.config.adminToken ? 'SET' : 'NOT SET',
      IPINFO_TOKEN: this.config.ipinfoToken ? 'SET' : 'NOT SET',
      NODE_ENV: this.config.nodeEnv,
      PORT: this.config.port
    };
  }
}

export const config = new ConfigManager();
