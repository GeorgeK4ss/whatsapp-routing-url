import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateRedirectType, validateRedirectDelay } from '../src/config/validation.js';

describe('Redirect Validation', () => {
  test('should validate correct redirect types', () => {
    const validTypes = ['immediate', 'delayed', 'custom', 'IMMEDIATE', 'DELAYED', 'CUSTOM'];
    
    validTypes.forEach(type => {
      assert.doesNotThrow(() => {
        const result = validateRedirectType(type);
        assert.strictEqual(result, type.toLowerCase());
      }, `Should validate redirect type: ${type}`);
    });
  });

  test('should reject invalid redirect types', () => {
    const invalidTypes = ['invalid', 'redirect', '', null, undefined, 'fast', 'slow'];
    
    invalidTypes.forEach(type => {
      assert.throws(() => {
        validateRedirectType(type);
      }, `Should reject redirect type: ${type}`);
    });
  });

  test('should require redirect type', () => {
    assert.throws(() => {
      validateRedirectType('');
    }, 'Should require non-empty redirect type');
  });

  test('should validate correct redirect delays', () => {
    const validDelays = [0, 1000, 3000, 5000, 10000, 30000];
    
    validDelays.forEach(delay => {
      assert.doesNotThrow(() => {
        const result = validateRedirectDelay(delay);
        assert.strictEqual(result, delay);
      }, `Should validate redirect delay: ${delay}`);
    });
  });

  test('should reject invalid redirect delays', () => {
    const invalidDelays = [-1, 30001, 'invalid', 'abc'];
    
    invalidDelays.forEach(delay => {
      assert.throws(() => {
        validateRedirectDelay(delay);
      }, `Should reject redirect delay: ${delay}`);
    });
  });

  test('should return default value for undefined delay', () => {
    const result = validateRedirectDelay(undefined);
    assert.strictEqual(result, 3000);
  });

  test('should return default value for null delay', () => {
    const result = validateRedirectDelay(null);
    assert.strictEqual(result, 3000);
  });
});
