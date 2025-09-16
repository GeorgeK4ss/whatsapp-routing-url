import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateWebsiteUrl } from '../src/config/validation.js';

describe('Website URL Validation', () => {
  test('should validate correct website URLs', () => {
    const validUrls = [
      'https://example.com',
      'https://www.example.com',
      'https://turkey.example.com',
      'https://subdomain.example.com/path',
      'https://example.com:8080',
      'http://example.com',
      'https://example.co.uk',
      'https://example.com/path/to/page?param=value'
    ];

    validUrls.forEach(url => {
      assert.doesNotThrow(() => {
        validateWebsiteUrl(url);
      }, `Should validate URL: ${url}`);
    });
  });

  test('should reject invalid website URLs', () => {
    const invalidUrls = [
      'not-a-url',
      'ftp://example.com',
      'example.com',
      'https://',
      'https://.com',
      'https://example',
      '',
      null,
      undefined
    ];

    invalidUrls.forEach(url => {
      assert.throws(() => {
        validateWebsiteUrl(url);
      }, `Should reject URL: ${url}`);
    });
  });

  test('should require website URL', () => {
    assert.throws(() => {
      validateWebsiteUrl('');
    }, 'Should require non-empty URL');
  });
});
