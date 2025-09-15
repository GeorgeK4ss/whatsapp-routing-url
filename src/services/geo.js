import { fetch } from "undici";
import { redisManager } from '../storage/redis.js';
import { config } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { GeoLocationError } from '../utils/errors.js';
import { validateIPAddress } from '../config/validation.js';

class GeoLocationService {
  constructor() {
    this.providers = [
      {
        name: 'ipinfo',
        url: (ip, token) => `https://ipinfo.io/${ip}?token=${token}`,
        parser: (data) => data.country?.toUpperCase() || null,
        timeout: 3000
      },
      {
        name: 'ipapi',
        url: (ip) => `https://ipapi.co/${ip}/country/`,
        parser: (data) => data?.trim()?.toUpperCase() || null,
        timeout: 3000
      },
      {
        name: 'ip-api',
        url: (ip) => `http://ip-api.com/json/${ip}?fields=countryCode`,
        parser: (data) => data.countryCode?.toUpperCase() || null,
        timeout: 3000
      }
    ];
    
    this.cacheTTL = config.get('geoCacheTTL');
    this.timeout = config.get('geoTimeout');
  }

  // Extract client IP from request headers
  getClientIP(req) {
    const xff = req.headers["x-forwarded-for"];
    if (xff && typeof xff === "string") {
      const first = xff.split(",")[0].trim();
      if (first) return first;
    }
    
    const xrip = req.headers["x-real-ip"];
    if (xrip && typeof xrip === "string") return xrip;
    
    // Express req.ip may be "::ffff:IP"
    const ip = (req.ip || "").replace("::ffff:", "");
    return ip || "";
  }

  // Check if IP is private/local
  isPrivateIP(ip) {
    if (!ip) return true;
    
    const privateRanges = [
      /^127\./,           // 127.0.0.0/8
      /^10\./,            // 10.0.0.0/8
      /^192\.168\./,      // 192.168.0.0/16
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^::1$/,            // IPv6 localhost
      /^fe80:/,           // IPv6 link-local
      /^fc00:/,           // IPv6 unique local
      /^fd00:/            // IPv6 unique local
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  // Get cached country code
  async getCachedCountry(ip) {
    try {
      const cacheKey = `geo_${ip}`;
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        logger.debug('Geo-location cache hit', { ip, country: cached });
        return cached;
      }
      return null;
    } catch (error) {
      logger.error('Error getting cached geo-location', { ip, error: error.message });
      return null;
    }
  }

  // Cache country code
  async cacheCountry(ip, country) {
    try {
      const cacheKey = `geo_${ip}`;
      await redisManager.set(cacheKey, country, this.cacheTTL);
      logger.debug('Geo-location cached', { ip, country, ttl: this.cacheTTL });
    } catch (error) {
      logger.error('Error caching geo-location', { ip, country, error: error.message });
    }
  }

  // Fetch country from a single provider
  async fetchFromProvider(provider, ip) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout || this.timeout);
      
      let url;
      if (provider.name === 'ipinfo') {
        const token = config.get('ipinfoToken');
        if (!token) {
          throw new Error('IPInfo token not configured');
        }
        url = provider.url(ip, token);
      } else {
        url = provider.url(ip);
      }
      
      logger.debug('Fetching geo-location', { provider: provider.name, ip, url });
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'WhatsApp-Geo-Redirect/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const country = provider.parser(data);
      
      logger.debug('Geo-location response', { provider: provider.name, ip, country });
      return country;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('Geo-location request timeout', { provider: provider.name, ip });
      } else {
        logger.error('Geo-location provider error', { 
          provider: provider.name, 
          ip, 
          error: error.message 
        });
      }
      return null;
    }
  }

  // Get country code with fallback providers
  async getCountryCode(ip) {
    try {
      // Validate IP
      if (!ip || this.isPrivateIP(ip)) {
        logger.debug('Private or invalid IP, using fallback', { ip });
        return await this.getFallbackCountry();
      }
      
      validateIPAddress(ip);
      
      // Check cache first
      const cached = await this.getCachedCountry(ip);
      if (cached) {
        return cached;
      }
      
      // Try each provider in order
      for (const provider of this.providers) {
        try {
          const country = await this.fetchFromProvider(provider, ip);
          if (country) {
            // Cache the result
            await this.cacheCountry(ip, country);
            logger.info('Geo-location resolved', { ip, country, provider: provider.name });
            return country;
          }
        } catch (error) {
          logger.warn('Provider failed, trying next', { 
            provider: provider.name, 
            ip, 
            error: error.message 
          });
          continue;
        }
      }
      
      // All providers failed, use fallback
      logger.warn('All geo-location providers failed, using fallback', { ip });
      return await this.getFallbackCountry();
      
    } catch (error) {
      logger.error('Geo-location service error', { ip, error: error.message });
      return await this.getFallbackCountry();
    }
  }

  // Get fallback country (server's location)
  async getFallbackCountry() {
    try {
      const token = config.get('ipinfoToken');
      if (!token) {
        logger.warn('No IPInfo token for fallback, defaulting to REST');
        return 'REST';
      }
      
      const response = await fetch(`https://ipinfo.io/json?token=${token}`, {
        headers: {
          'User-Agent': 'WhatsApp-Geo-Redirect/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const country = data.country?.toUpperCase() || 'REST';
      
      logger.info('Fallback geo-location resolved', { country });
      return country;
      
    } catch (error) {
      logger.error('Fallback geo-location failed', { error: error.message });
      return 'REST';
    }
  }

  // Determine routing based on country
  determineRouting(country, forceCountry = null) {
    if (forceCountry) {
      const force = forceCountry.toUpperCase();
      return force === 'TR' ? 'TR' : 'REST';
    }
    
    return country === 'TR' ? 'TR' : 'REST';
  }

  // Health check for geo-location service
  async healthCheck() {
    try {
      const testIP = '8.8.8.8'; // Google DNS
      const country = await this.getCountryCode(testIP);
      
      return {
        status: 'healthy',
        testIP,
        result: country,
        providers: this.providers.map(p => p.name),
        cacheTTL: this.cacheTTL
      };
    } catch (error) {
      logger.error('Geo-location health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export const geoService = new GeoLocationService();
