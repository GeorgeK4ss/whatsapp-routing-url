import Redis from "ioredis";
import { logger } from '../utils/logger.js';
import { StorageError } from '../utils/errors.js';

class RedisManager {
  constructor() {
    this.client = null;
    this.memoryFallback = new Map();
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    
    this.initialize();
  }

  async initialize() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('REDIS_URL not set. Using in-memory fallback storage.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        tls: redisUrl.startsWith("rediss://") ? {} : undefined,
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

      this.setupEventHandlers();
      await this.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error: error.message });
      this.client = null;
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.connectionAttempts++;
      logger.info('Redis reconnecting', { attempt: this.connectionAttempts });
    });
  }

  async connect() {
    if (!this.client) return false;
    
    try {
      await this.client.connect();
      // Test connection
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  async get(key) {
    try {
      if (this.isConnected && this.client) {
        const value = await this.client.get(key);
        logger.debug('Redis GET', { key, value });
        return value;
      } else {
        // Fallback to memory
        const value = this.memoryFallback.get(key) || null;
        logger.debug('Memory fallback GET', { key, value });
        return value;
      }
    } catch (error) {
      logger.error('Storage GET error', { key, error: error.message });
      // Fallback to memory
      return this.memoryFallback.get(key) || null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      if (this.isConnected && this.client) {
        if (ttl) {
          await this.client.setex(key, ttl, value);
        } else {
          await this.client.set(key, value);
        }
        logger.debug('Redis SET', { key, value, ttl });
      } else {
        // Fallback to memory
        this.memoryFallback.set(key, value);
        if (ttl) {
          setTimeout(() => this.memoryFallback.delete(key), ttl * 1000);
        }
        logger.debug('Memory fallback SET', { key, value, ttl });
      }
      return true;
    } catch (error) {
      logger.error('Storage SET error', { key, error: error.message });
      // Fallback to memory
      this.memoryFallback.set(key, value);
      if (ttl) {
        setTimeout(() => this.memoryFallback.delete(key), ttl * 1000);
      }
      return false;
    }
  }

  async del(key) {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
        logger.debug('Redis DEL', { key });
      } else {
        this.memoryFallback.delete(key);
        logger.debug('Memory fallback DEL', { key });
      }
      return true;
    } catch (error) {
      logger.error('Storage DEL error', { key, error: error.message });
      this.memoryFallback.delete(key);
      return false;
    }
  }

  async exists(key) {
    try {
      if (this.isConnected && this.client) {
        const result = await this.client.exists(key);
        return result === 1;
      } else {
        return this.memoryFallback.has(key);
      }
    } catch (error) {
      logger.error('Storage EXISTS error', { key, error: error.message });
      return this.memoryFallback.has(key);
    }
  }

  async flush() {
    try {
      if (this.isConnected && this.client) {
        await this.client.flushdb();
        logger.info('Redis database flushed');
      } else {
        this.memoryFallback.clear();
        logger.info('Memory fallback cleared');
      }
      return true;
    } catch (error) {
      logger.error('Storage FLUSH error', { error: error.message });
      this.memoryFallback.clear();
      return false;
    }
  }

  async healthCheck() {
    try {
      if (this.isConnected && this.client) {
        const pong = await this.client.ping();
        return { status: 'healthy', type: 'redis', response: pong };
      } else {
        return { status: 'degraded', type: 'memory', message: 'Using memory fallback' };
      }
    } catch (error) {
      logger.error('Storage health check failed', { error: error.message });
      return { status: 'unhealthy', type: 'error', error: error.message };
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis client', { error: error.message });
      }
    }
  }
}

export const redisManager = new RedisManager();
