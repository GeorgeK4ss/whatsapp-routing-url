import { ValidationError } from '../utils/errors.js';

export const phoneNumberRegex = /^[1-9]\d{6,14}$/;
export const countryCodeRegex = /^\d{1,4}$/;
export const telegramChannelRegex = /^[a-zA-Z0-9_]{5,32}$/;
export const websiteUrlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

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

export function validateTelegramChannel(channel, field = 'Telegram channel') {
  if (!channel) {
    throw new ValidationError(`${field} is required`, field);
  }
  
  const cleanChannel = channel.replace(/^@/, ''); // Remove @ prefix if present
  
  if (!telegramChannelRegex.test(cleanChannel)) {
    throw new ValidationError(`${field} must be 5-32 characters, alphanumeric and underscores only`, field);
  }
  
  return cleanChannel;
}

export function validateWebsiteUrl(url, field = 'website URL') {
  if (!url) {
    throw new ValidationError(`${field} is required`, field);
  }
  
  if (!websiteUrlRegex.test(url)) {
    throw new ValidationError(`${field} must be a valid HTTP or HTTPS URL`, field);
  }
  
  return url;
}

export function validateRedirectType(type, field = 'redirect type') {
  if (!type) {
    throw new ValidationError(`${field} is required`, field);
  }
  
  const validTypes = ['immediate', 'delayed', 'custom'];
  if (!validTypes.includes(type.toLowerCase())) {
    throw new ValidationError(`${field} must be one of: ${validTypes.join(', ')}`, field);
  }
  
  return type.toLowerCase();
}

export function validateRedirectDelay(delay, field = 'redirect delay') {
  if (delay === undefined || delay === null) {
    return 3000; // default value
  }
  
  const numDelay = parseInt(delay);
  if (isNaN(numDelay) || numDelay < 0 || numDelay > 30000) {
    throw new ValidationError(`${field} must be a number between 0 and 30000 milliseconds`, field);
  }
  
  return numDelay;
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
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
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
  
  // Validate Telegram channels if present
  if (config.telegram_channel_default) {
    try {
      validateTelegramChannel(config.telegram_channel_default, 'default Telegram channel');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  if (config.telegram_channel_tr) {
    try {
      validateTelegramChannel(config.telegram_channel_tr, 'Turkey Telegram channel');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  // Validate Telegram texts if present
  if (config.telegram_text_default !== undefined) {
    try {
      validateText(config.telegram_text_default, 'default Telegram text');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  if (config.telegram_text_tr !== undefined) {
    try {
      validateText(config.telegram_text_tr, 'Turkey Telegram text');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  // Validate website URLs if present
  if (config.website_url_default) {
    try {
      validateWebsiteUrl(config.website_url_default, 'default website URL');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  if (config.website_url_tr) {
    try {
      validateWebsiteUrl(config.website_url_tr, 'Turkey website URL');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  // Validate redirect configuration if present
  if (config.redirect_type) {
    try {
      validateRedirectType(config.redirect_type, 'redirect type');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  if (config.redirect_delay !== undefined) {
    try {
      validateRedirectDelay(config.redirect_delay, 'redirect delay');
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  return config;
}
