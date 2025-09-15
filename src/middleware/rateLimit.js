import { redisManager } from '../storage/redis.js';
import { config } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

class RateLimiter {
  constructor() {
    this.windowMs = config.get('rateLimitWindow');
    this.maxRequests = config.get('rateLimitMax');
    this.memoryStore = new Map();
  }

  // Get client identifier
  getClientId(req) {
    // Use IP address as primary identifier
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // For admin routes, also consider the token
    if (req.path.startsWith('/admin') && req.query.token) {
      return `admin:${ip}:${req.query.token}`;
    }
    
    return `client:${ip}`;
  }

  // Check rate limit
  async checkLimit(req) {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      // Try Redis first
      if (redisManager.isConnected) {
        return await this.checkLimitRedis(clientId, now, windowStart);
      } else {
        // Fallback to memory
        return this.checkLimitMemory(clientId, now, windowStart);
      }
    } catch (error) {
      logger.error('Rate limit check failed', { error: error.message, clientId });
      // Allow request if rate limiting fails
      return { allowed: true, remaining: this.maxRequests, resetTime: now + this.windowMs };
    }
  }

  // Redis-based rate limiting
  async checkLimitRedis(clientId, now, windowStart) {
    const key = `rate_limit:${clientId}`;
    
    // Use Redis sorted set to track requests
    const pipeline = redisManager.client.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(this.windowMs / 1000));
    
    const results = await pipeline.exec();
    const currentRequests = results[1][1];
    
    const allowed = currentRequests < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - currentRequests - 1);
    const resetTime = now + this.windowMs;
    
    return { allowed, remaining, resetTime, current: currentRequests + 1 };
  }

  // Memory-based rate limiting
  checkLimitMemory(clientId, now, windowStart) {
    if (!this.memoryStore.has(clientId)) {
      this.memoryStore.set(clientId, []);
    }
    
    const requests = this.memoryStore.get(clientId);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    const allowed = validRequests.length < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - validRequests.length - 1);
    const resetTime = now + this.windowMs;
    
    if (allowed) {
      validRequests.push(now);
      this.memoryStore.set(clientId, validRequests);
    }
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupMemoryStore(now);
    }
    
    return { allowed, remaining, resetTime, current: validRequests.length + 1 };
  }

  // Clean up old memory store entries
  cleanupMemoryStore(now) {
    const cutoff = now - this.windowMs;
    
    for (const [clientId, requests] of this.memoryStore.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      
      if (validRequests.length === 0) {
        this.memoryStore.delete(clientId);
      } else {
        this.memoryStore.set(clientId, validRequests);
      }
    }
  }

  // Get rate limit info for a client
  async getLimitInfo(req) {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      if (redisManager.isConnected) {
        const key = `rate_limit:${clientId}`;
        await redisManager.client.zremrangebyscore(key, 0, windowStart);
        const current = await redisManager.client.zcard(key);
        return {
          limit: this.maxRequests,
          remaining: Math.max(0, this.maxRequests - current),
          resetTime: now + this.windowMs,
          current
        };
      } else {
        const requests = this.memoryStore.get(clientId) || [];
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        return {
          limit: this.maxRequests,
          remaining: Math.max(0, this.maxRequests - validRequests.length),
          resetTime: now + this.windowMs,
          current: validRequests.length
        };
      }
    } catch (error) {
      logger.error('Rate limit info check failed', { error: error.message, clientId });
      return {
        limit: this.maxRequests,
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
        current: 0
      };
    }
  }
}

export const rateLimiter = new RateLimiter();

// Rate limiting middleware
export function rateLimitMiddleware(req, res, next) {
  rateLimiter.checkLimit(req)
    .then(limitInfo => {
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimiter.maxRequests,
        'X-RateLimit-Remaining': limitInfo.remaining,
        'X-RateLimit-Reset': new Date(limitInfo.resetTime).toISOString()
      });
      
      if (!limitInfo.allowed) {
        logger.warn('Rate limit exceeded', {
          clientId: rateLimiter.getClientId(req),
          ip: req.ip,
          path: req.path,
          current: limitInfo.current,
          limit: rateLimiter.maxRequests
        });
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((limitInfo.resetTime - Date.now()) / 1000)
        });
      }
      
      next();
    })
    .catch(error => {
      logger.error('Rate limit middleware error', { error: error.message });
      // Allow request if rate limiting fails
      next();
    });
}

// Admin rate limiting (more restrictive)
export function adminRateLimitMiddleware(req, res, next) {
  // Admin routes get stricter rate limiting
  const originalMaxRequests = rateLimiter.maxRequests;
  rateLimiter.maxRequests = Math.min(10, originalMaxRequests); // Max 10 requests per window
  
  rateLimitMiddleware(req, res, (error) => {
    // Restore original limit
    rateLimiter.maxRequests = originalMaxRequests;
    
    if (error) {
      next(error);
    } else {
      next();
    }
  });
}
