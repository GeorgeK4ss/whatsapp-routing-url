import { logger } from '../utils/logger.js';

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byStatus: {},
        byRoute: {},
        byCountry: {},
        responseTime: []
      },
      geo: {
        lookups: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        byProvider: {}
      },
      errors: {
        total: 0,
        byType: {},
        byRoute: {}
      },
      uptime: Date.now()
    };
    
    this.startTime = Date.now();
  }

  // Request metrics
  recordRequest(req, res, responseTime) {
    this.metrics.requests.total++;
    
    // Status code tracking
    const status = res.statusCode;
    this.metrics.requests.byStatus[status] = (this.metrics.requests.byStatus[status] || 0) + 1;
    
    // Route tracking
    const route = req.route?.path || req.path;
    this.metrics.requests.byRoute[route] = (this.metrics.requests.byRoute[route] || 0) + 1;
    
    // Response time tracking (keep last 100)
    this.metrics.requests.responseTime.push(responseTime);
    if (this.metrics.requests.responseTime.length > 100) {
      this.metrics.requests.responseTime.shift();
    }
    
    // Country tracking (if available)
    const country = req.country;
    if (country) {
      this.metrics.requests.byCountry[country] = (this.metrics.requests.byCountry[country] || 0) + 1;
    }
  }

  // Geo-location metrics
  recordGeoLookup(country, provider, fromCache = false) {
    this.metrics.geo.lookups++;
    
    if (fromCache) {
      this.metrics.geo.cacheHits++;
    } else {
      this.metrics.geo.cacheMisses++;
    }
    
    if (provider) {
      this.metrics.geo.byProvider[provider] = (this.metrics.geo.byProvider[provider] || 0) + 1;
    }
  }

  recordGeoError(provider, error) {
    this.metrics.geo.errors++;
    this.metrics.errors.total++;
    this.metrics.errors.byType['geo'] = (this.metrics.errors.byType['geo'] || 0) + 1;
  }

  // Error metrics
  recordError(error, route) {
    this.metrics.errors.total++;
    
    const errorType = error.constructor.name || 'Unknown';
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    
    if (route) {
      this.metrics.errors.byRoute[route] = (this.metrics.errors.byRoute[route] || 0) + 1;
    }
  }

  // Get current metrics
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    const avgResponseTime = this.metrics.requests.responseTime.length > 0
      ? this.metrics.requests.responseTime.reduce((a, b) => a + b, 0) / this.metrics.requests.responseTime.length
      : 0;
    
    const cacheHitRate = this.metrics.geo.lookups > 0
      ? (this.metrics.geo.cacheHits / this.metrics.geo.lookups) * 100
      : 0;
    
    return {
      ...this.metrics,
      uptime,
      calculated: {
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        requestsPerMinute: this.metrics.requests.total / (uptime / 60000),
        errorRate: this.metrics.requests.total > 0 
          ? (this.metrics.errors.total / this.metrics.requests.total) * 100 
          : 0
      }
    };
  }

  // Reset metrics
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byStatus: {},
        byRoute: {},
        byCountry: {},
        responseTime: []
      },
      geo: {
        lookups: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        byProvider: {}
      },
      errors: {
        total: 0,
        byType: {},
        byRoute: {}
      },
      uptime: Date.now()
    };
    this.startTime = Date.now();
  }
}

export const metricsCollector = new MetricsCollector();

// Middleware to collect request metrics
export function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };
  
  next();
}

// Middleware to collect error metrics
export function errorMetricsMiddleware(error, req, res, next) {
  metricsCollector.recordError(error, req.route?.path || req.path);
  next(error);
}
