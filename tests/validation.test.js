import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  validatePhoneNumber, 
  validateCountryCode, 
  validateText, 
  validateAdminToken,
  validateIPAddress,
  validateConfiguration 
} from '../src/config/validation.js';
import { ValidationError } from '../src/utils/errors.js';

describe('Validation Functions', () => {
  describe('validatePhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      assert.strictEqual(validatePhoneNumber('1234567890'), '1234567890');
      assert.strictEqual(validatePhoneNumber('+1234567890'), '1234567890');
      assert.strictEqual(validatePhoneNumber('123-456-7890'), '1234567890');
      assert.strictEqual(validatePhoneNumber('123 456 7890'), '1234567890');
    });

    it('should reject invalid phone numbers', () => {
      assert.throws(() => validatePhoneNumber(''), ValidationError);
      assert.throws(() => validatePhoneNumber('123'), ValidationError);
      assert.throws(() => validatePhoneNumber('0123456789'), ValidationError);
      assert.throws(() => validatePhoneNumber('1234567890123456'), ValidationError);
    });
  });

  describe('validateCountryCode', () => {
    it('should validate correct country codes', () => {
      assert.strictEqual(validateCountryCode('1'), '1');
      assert.strictEqual(validateCountryCode('44'), '44');
      assert.strictEqual(validateCountryCode('90'), '90');
      assert.strictEqual(validateCountryCode('1234'), '1234');
    });

    it('should reject invalid country codes', () => {
      assert.throws(() => validateCountryCode(''), ValidationError);
      assert.throws(() => validateCountryCode('12345'), ValidationError);
      assert.throws(() => validateCountryCode('abc'), ValidationError);
    });
  });

  describe('validateText', () => {
    it('should validate correct texts', () => {
      assert.strictEqual(validateText('Hello'), 'Hello');
      assert.strictEqual(validateText(''), '');
      assert.strictEqual(validateText(null), '');
      assert.strictEqual(validateText(undefined), '');
    });

    it('should reject texts that are too long', () => {
      const longText = 'a'.repeat(1001);
      assert.throws(() => validateText(longText), ValidationError);
    });
  });

  describe('validateAdminToken', () => {
    it('should validate correct admin tokens', () => {
      assert.strictEqual(validateAdminToken('1234567890123456'), '1234567890123456');
      assert.strictEqual(validateAdminToken('a'.repeat(20)), 'a'.repeat(20));
    });

    it('should reject invalid admin tokens', () => {
      assert.throws(() => validateAdminToken(''), ValidationError);
      assert.throws(() => validateAdminToken('123'), ValidationError);
      assert.throws(() => validateAdminToken('123456789012345'), ValidationError);
    });
  });

  describe('validateIPAddress', () => {
    it('should validate correct IP addresses', () => {
      assert.strictEqual(validateIPAddress('8.8.8.8'), '8.8.8.8');
      assert.strictEqual(validateIPAddress('192.168.1.1'), '192.168.1.1');
      assert.strictEqual(validateIPAddress('2001:db8::1'), '2001:db8::1');
    });

    it('should reject invalid IP addresses', () => {
      assert.throws(() => validateIPAddress(''), ValidationError);
      assert.throws(() => validateIPAddress('999.999.999.999'), ValidationError);
      assert.throws(() => validateIPAddress('not-an-ip'), ValidationError);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const config = {
        number_default: '1234567890',
        number_tr: '1234567890',
        text_default: 'Hello',
        text_tr: 'Merhaba'
      };

      const result = validateConfiguration(config);
      assert.deepStrictEqual(result, config);
    });

    it('should reject invalid configuration', () => {
      const config = {
        number_default: '123',
        number_tr: '1234567890',
        text_default: 'Hello',
        text_tr: 'Merhaba'
      };

      assert.throws(() => validateConfiguration(config), ValidationError);
    });
  });
});
