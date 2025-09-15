import { ValidationError } from '../utils/errors.js';

export const phoneNumberRegex = /^[1-9]\d{6,14}$/;
export const countryCodeRegex = /^\d{1,4}$/;

export function validatePhoneNumber(number, field = 'phone') {
  if (!number) {
    throw new ValidationError(`${field} number is required`, field);
  }
  
  const cleanNumber = number.replace(/[^\d]/g, '');
  
  if (!phoneNumberRegex.test(cleanNumber)) {
    throw new ValidationError(`${field} number must be 7-15 digits and not start with 0`, field);
  }
  
  return cleanNumber;
}

export function validateCountryCode(code) {
  if (!code) {
    throw new ValidationError('Country code is required', 'countryCode');
  }
  
  if (!countryCodeRegex.test(code)) {
    throw new ValidationError('Country code must be 1-4 digits', 'countryCode');
  }
  
  return code;
}

export function validateText(text, field = 'text', maxLength = 1000) {
  if (text && text.length > maxLength) {
    throw new ValidationError(`${field} must be less than ${maxLength} characters`, field);
  }
  
  return text || '';
}

export function validateAdminToken(token) {
  if (!token) {
    throw new ValidationError('Admin token is required', 'token');
  }
  
  if (token.length < 16) {
    throw new ValidationError('Admin token must be at least 16 characters', 'token');
  }
  
  return token;
}

export function validateIPAddress(ip) {
  if (!ip) {
    throw new ValidationError('IP address is required', 'ip');
  }
  
  // Basic IP validation (IPv4 and IPv6)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    throw new ValidationError('Invalid IP address format', 'ip');
  }
  
  return ip;
}

export function validateConfiguration(config) {
  const errors = [];
  
  try {
    validatePhoneNumber(config.number_default, 'default');
  } catch (error) {
    errors.push(error.message);
  }
  
  try {
    validatePhoneNumber(config.number_tr, 'Turkey');
  } catch (error) {
    errors.push(error.message);
  }
  
  try {
    validateText(config.text_default, 'default text');
  } catch (error) {
    errors.push(error.message);
  }
  
  try {
    validateText(config.text_tr, 'Turkey text');
  } catch (error) {
    errors.push(error.message);
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  return config;
}
