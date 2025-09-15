import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { geoService } from '../src/services/geo.js';

describe('GeoLocation Service', () => {
  let originalFetch;

  beforeEach(() => {
    // Mock fetch for testing
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should detect private IP addresses', () => {
    assert.strictEqual(geoService.isPrivateIP('127.0.0.1'), true);
    assert.strictEqual(geoService.isPrivateIP('192.168.1.1'), true);
    assert.strictEqual(geoService.isPrivateIP('10.0.0.1'), true);
    assert.strictEqual(geoService.isPrivateIP('172.16.0.1'), true);
    assert.strictEqual(geoService.isPrivateIP('8.8.8.8'), false);
    assert.strictEqual(geoService.isPrivateIP('1.1.1.1'), false);
  });

  it('should extract client IP from request headers', () => {
    const mockReq = {
      headers: {
        'x-forwarded-for': '203.0.113.1, 70.41.3.18, 150.172.238.178'
      },
      ip: '::ffff:127.0.0.1'
    };

    const ip = geoService.getClientIP(mockReq);
    assert.strictEqual(ip, '203.0.113.1');
  });

  it('should handle X-Real-IP header', () => {
    const mockReq = {
      headers: {
        'x-real-ip': '203.0.113.1'
      },
      ip: '::ffff:127.0.0.1'
    };

    const ip = geoService.getClientIP(mockReq);
    assert.strictEqual(ip, '203.0.113.1');
  });

  it('should determine routing correctly', () => {
    assert.strictEqual(geoService.determineRouting('TR'), 'TR');
    assert.strictEqual(geoService.determineRouting('US'), 'REST');
    assert.strictEqual(geoService.determineRouting('GB'), 'REST');
    assert.strictEqual(geoService.determineRouting('TR', 'TR'), 'TR');
    assert.strictEqual(geoService.determineRouting('US', 'TR'), 'TR');
    assert.strictEqual(geoService.determineRouting('TR', 'REST'), 'REST');
  });

  it('should handle health check', async () => {
    const health = await geoService.healthCheck();
    assert.strictEqual(typeof health.status, 'string');
    assert.strictEqual(typeof health.providers, 'object');
    assert.strictEqual(Array.isArray(health.providers), true);
  });
});
