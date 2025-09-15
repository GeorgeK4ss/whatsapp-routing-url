import express from 'express';
import { configStorage } from '../storage/config.js';
import { config } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { validateAdminToken, validatePhoneNumber, validateText, validateTelegramChannel } from '../config/validation.js';
import { countryCodes } from '../data/country-codes.js';

const router = express.Router();

// Middleware to validate admin token
const validateAdmin = (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    validateAdminToken(token);
    
    if (token !== config.get('adminToken')) {
      throw new AppError('Invalid admin token', 401);
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Admin dashboard page
router.get('/', validateAdmin, asyncHandler(async (req, res) => {
  const currentConfig = await configStorage.getConfig();
  const envStatus = config.getEnvironmentStatus();
  
  const html = generateAdminHTML(currentConfig, envStatus);
  res.type('html').send(html);
}));

// Get current configuration
router.get('/api/config', validateAdmin, asyncHandler(async (req, res) => {
  const currentConfig = await configStorage.getConfig();
  res.json({
    success: true,
    config: currentConfig,
    environment: config.getEnvironmentStatus()
  });
}));

// Update configuration
router.post('/api/config', validateAdmin, asyncHandler(async (req, res) => {
  const { 
    tr_number, default_number, default_country_code, tr_text, default_text,
    tr_telegram_channel, default_telegram_channel, tr_telegram_text, default_telegram_text
  } = req.body;
  
  const updates = {};
  
  // Process Turkey number (always +90)
  if (tr_number) {
    const cleanNumber = validatePhoneNumber(tr_number, 'Turkey');
    updates.number_tr = '90' + cleanNumber;
  }
  
  // Process default number with country code
  if (default_number && default_country_code) {
    const cleanNumber = validatePhoneNumber(default_number, 'default');
    updates.number_default = default_country_code + cleanNumber;
  }
  
  // Process texts
  if (tr_text !== undefined) {
    updates.text_tr = validateText(tr_text, 'Turkey text');
  }
  
  if (default_text !== undefined) {
    updates.text_default = validateText(default_text, 'default text');
  }
  
  // Process Telegram channels
  if (tr_telegram_channel) {
    updates.telegram_channel_tr = validateTelegramChannel(tr_telegram_channel, 'Turkey Telegram channel');
  }
  
  if (default_telegram_channel) {
    updates.telegram_channel_default = validateTelegramChannel(default_telegram_channel, 'default Telegram channel');
  }
  
  // Process Telegram texts
  if (tr_telegram_text !== undefined) {
    updates.telegram_text_tr = validateText(tr_telegram_text, 'Turkey Telegram text');
  }
  
  if (default_telegram_text !== undefined) {
    updates.telegram_text_default = validateText(default_telegram_text, 'default Telegram text');
  }
  
  const updatedConfig = await configStorage.updateConfig(updates);
  
  logger.info('Configuration updated via admin API', { 
    updates: Object.keys(updates),
    ip: req.ip 
  });
  
  res.json({
    success: true,
    message: 'Configuration updated successfully',
    config: updatedConfig
  });
}));

// Reset configuration to defaults
router.post('/api/reset', validateAdmin, asyncHandler(async (req, res) => {
  const defaultConfig = await configStorage.resetConfig();
  
  logger.info('Configuration reset to defaults', { ip: req.ip });
  
  res.json({
    success: true,
    message: 'Configuration reset to defaults',
    config: defaultConfig
  });
}));

// Health check endpoint
router.get('/api/health', validateAdmin, asyncHandler(async (req, res) => {
  const [configHealth, storageHealth] = await Promise.all([
    configStorage.healthCheck(),
    config.getEnvironmentStatus()
  ]);
  
  res.json({
    success: true,
    health: {
      config: configHealth,
      environment: storageHealth,
      timestamp: new Date().toISOString()
    }
  });
}));

// Generate admin HTML
function generateAdminHTML(currentConfig, envStatus) {
  const extractCountryCode = (fullNumber) => {
    if (!fullNumber) return "44";
    const countryCodes = ["44", "90", "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "91", "92", "93", "94", "95", "98"];
    for (const code of countryCodes) {
      if (fullNumber.startsWith(code)) {
        return code;
      }
    }
    return "44";
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>WhatsApp Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px;
    }
    .card { 
      background: white; 
      border-radius: 16px; 
      box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
      padding: 40px;
      margin-bottom: 20px;
    }
    h1 { 
      margin: 0 0 30px; 
      color: #2c3e50; 
      font-size: 28px;
      text-align: center;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .status-item {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #28a745;
    }
    .status-item.warning { border-left-color: #ffc107; }
    .status-item.error { border-left-color: #dc3545; }
    .status-label { font-weight: 600; color: #6c757d; font-size: 12px; text-transform: uppercase; }
    .status-value { font-size: 14px; margin-top: 5px; }
    .form-group { margin-bottom: 25px; }
    label { 
      display: block; 
      margin-bottom: 8px; 
      font-weight: 600; 
      color: #495057;
    }
    .input-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .country-code {
      min-width: 80px;
      max-width: 100px;
      padding: 12px 8px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 13px;
      background: #f8f9fa;
      flex-shrink: 0;
    }
    input[type="text"], input[type="tel"], textarea, select { 
      width: 100%; 
      padding: 12px 16px; 
      border: 2px solid #e9ecef; 
      border-radius: 8px; 
      font-size: 14px; 
      transition: border-color 0.3s ease;
    }
    input:focus, textarea:focus, select:focus { 
      outline: none; 
      border-color: #667eea; 
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    textarea { 
      height: 80px; 
      resize: vertical;
      font-family: inherit;
    }
    .btn { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; 
      border: none; 
      padding: 12px 24px; 
      border-radius: 8px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 600;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .btn:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }
    .btn-secondary {
      background: #6c757d;
    }
    .btn-danger {
      background: #dc3545;
    }
    .btn-group {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .current { 
      background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
      padding: 20px; 
      border-radius: 12px; 
      margin-bottom: 30px;
    }
    .current h3 { margin: 0 0 15px; color: #2c3e50; }
    .current-item { 
      display: flex; 
      justify-content: space-between; 
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    .current-item:last-child { border-bottom: none; }
    .current-label { font-weight: 600; color: #495057; }
    .current-value { color: #6c757d; }
    .status { 
      margin-top: 20px; 
      padding: 15px; 
      border-radius: 8px; 
      display: none;
      font-weight: 500;
    }
    .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .help { 
      font-size: 12px; 
      color: #6c757d; 
      margin-top: 5px;
      font-style: italic;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>🚀 WhatsApp Admin Dashboard</h1>
      
      <div class="status-grid">
        <div class="status-item ${envStatus.REDIS_URL === 'SET' ? '' : 'warning'}">
          <div class="status-label">Redis</div>
          <div class="status-value">${envStatus.REDIS_URL}</div>
        </div>
        <div class="status-item ${envStatus.ADMIN_TOKEN === 'SET' ? '' : 'error'}">
          <div class="status-label">Admin Token</div>
          <div class="status-value">${envStatus.ADMIN_TOKEN}</div>
        </div>
        <div class="status-item ${envStatus.IPINFO_TOKEN === 'SET' ? '' : 'warning'}">
          <div class="status-label">IPInfo Token</div>
          <div class="status-value">${envStatus.IPINFO_TOKEN}</div>
        </div>
        <div class="status-item">
          <div class="status-label">Environment</div>
          <div class="status-value">${envStatus.NODE_ENV}</div>
        </div>
      </div>
      
      <div class="current">
        <h3>📋 Current Configuration</h3>
        <div class="current-item">
          <span class="current-label">Turkey Number:</span>
          <span class="current-value">+${currentConfig.number_tr}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Default Number:</span>
          <span class="current-value">+${currentConfig.number_default}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Turkey Text:</span>
          <span class="current-value">${currentConfig.text_tr || '(none)'}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Default Text:</span>
          <span class="current-value">${currentConfig.text_default || '(none)'}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Turkey Telegram Channel:</span>
          <span class="current-value">@${currentConfig.telegram_channel_tr || '(none)'}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Default Telegram Channel:</span>
          <span class="current-value">@${currentConfig.telegram_channel_default || '(none)'}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Turkey Telegram Text:</span>
          <span class="current-value">${currentConfig.telegram_text_tr || '(none)'}</span>
        </div>
        <div class="current-item">
          <span class="current-label">Default Telegram Text:</span>
          <span class="current-value">${currentConfig.telegram_text_default || '(none)'}</span>
        </div>
      </div>

      <form id="configForm">
        <div class="form-group">
          <label for="tr_number">🇹🇷 Turkey WhatsApp Number</label>
          <div class="input-group">
            <span class="country-code">+90 (Fixed)</span>
            <input type="tel" id="tr_number" name="tr_number" 
                   value="${currentConfig.number_tr.startsWith('90') ? currentConfig.number_tr.substring(2) : currentConfig.number_tr}" 
                   placeholder="5513797933" style="flex: 1; min-width: 0;">
          </div>
          <div class="help">Turkey country code (+90) is fixed. Enter only the phone number (e.g., 5513797933)</div>
        </div>

        <div class="form-group">
          <label for="default_number">🌍 Default WhatsApp Number</label>
          <div class="input-group">
            <select id="default_country_code" name="default_country_code" class="country-code">
              ${countryCodes.replace(`value="${extractCountryCode(currentConfig.number_default)}"`, `value="${extractCountryCode(currentConfig.number_default)}" selected`)}
            </select>
            <input type="tel" id="default_number" name="default_number" 
                   value="${currentConfig.number_default.replace(new RegExp('^' + extractCountryCode(currentConfig.number_default)), '')}" 
                   placeholder="7723342065" style="flex: 1; min-width: 0;">
          </div>
          <div class="help">Select country code and enter phone number without country code (e.g., 7723342065)</div>
        </div>

        <div class="form-group">
          <label for="tr_text">🇹🇷 Turkey Prefill Text</label>
          <textarea id="tr_text" name="tr_text" placeholder="Merhaba! Size nasıl yardımcı olabilirim?">${currentConfig.text_tr || ''}</textarea>
          <div class="help">Optional text to prefill for Turkish users</div>
        </div>

        <div class="form-group">
          <label for="default_text">🌍 Default Prefill Text</label>
          <textarea id="default_text" name="default_text" placeholder="Hello! How can I help you?">${currentConfig.text_default || ''}</textarea>
          <div class="help">Optional text to prefill for non-Turkish users</div>
        </div>

        <hr style="margin: 40px 0; border: none; border-top: 2px solid #e9ecef;">
        <h3 style="margin: 0 0 20px; color: #2c3e50; text-align: center;">✈️ Telegram Configuration</h3>

        <div class="form-group">
          <label for="tr_telegram_channel">🇹🇷 Turkey Telegram Channel</label>
          <div class="input-group">
            <span class="country-code">@</span>
            <input type="text" id="tr_telegram_channel" name="tr_telegram_channel" 
                   value="${currentConfig.telegram_channel_tr || ''}" 
                   placeholder="your_turkey_channel" style="flex: 1; min-width: 0;">
          </div>
          <div class="help">Telegram channel username for Turkish users (without @ symbol)</div>
        </div>

        <div class="form-group">
          <label for="default_telegram_channel">🌍 Default Telegram Channel</label>
          <div class="input-group">
            <span class="country-code">@</span>
            <input type="text" id="default_telegram_channel" name="default_telegram_channel" 
                   value="${currentConfig.telegram_channel_default || ''}" 
                   placeholder="your_default_channel" style="flex: 1; min-width: 0;">
          </div>
          <div class="help">Telegram channel username for non-Turkish users (without @ symbol)</div>
        </div>

        <div class="form-group">
          <label for="tr_telegram_text">🇹🇷 Turkey Telegram Prefill Text</label>
          <textarea id="tr_telegram_text" name="tr_telegram_text" placeholder="Merhaba! Size nasıl yardımcı olabilirim?">${currentConfig.telegram_text_tr || ''}</textarea>
          <div class="help">Optional text to prefill for Turkish users on Telegram</div>
        </div>

        <div class="form-group">
          <label for="default_telegram_text">🌍 Default Telegram Prefill Text</label>
          <textarea id="default_telegram_text" name="default_telegram_text" placeholder="Hello! How can I help you?">${currentConfig.telegram_text_default || ''}</textarea>
          <div class="help">Optional text to prefill for non-Turkish users on Telegram</div>
        </div>

        <div class="btn-group">
          <button type="submit" class="btn">💾 Save Configuration</button>
          <button type="button" id="resetBtn" class="btn btn-danger">🔄 Reset to Defaults</button>
          <button type="button" id="healthBtn" class="btn btn-secondary">🏥 Health Check</button>
        </div>
      </form>

      <div id="loading" class="loading">
        <div class="spinner"></div>
        <div>Processing...</div>
      </div>

      <div id="status" class="status"></div>
    </div>
  </div>

  <script>
    const token = new URLSearchParams(window.location.search).get('token');
    
    function showStatus(message, type = 'success') {
      const status = document.getElementById('status');
      status.className = \`status \${type}\`;
      status.textContent = message;
      status.style.display = 'block';
      setTimeout(() => {
        status.style.display = 'none';
      }, 5000);
    }
    
    function showLoading(show = true) {
      document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
    
    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoading(true);
      
      const formData = new FormData(e.target);
      const data = {
        token: token,
        tr_number: formData.get('tr_number'),
        default_number: formData.get('default_number'),
        default_country_code: formData.get('default_country_code'),
        tr_text: formData.get('tr_text'),
        default_text: formData.get('default_text'),
        tr_telegram_channel: formData.get('tr_telegram_channel'),
        default_telegram_channel: formData.get('default_telegram_channel'),
        tr_telegram_text: formData.get('tr_telegram_text'),
        default_telegram_text: formData.get('default_telegram_text')
      };
      
      try {
        const response = await fetch('/admin/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          showStatus('✅ Configuration saved successfully!');
          setTimeout(() => location.reload(), 1500);
        } else {
          showStatus(\`❌ Error: \${result.error || 'Unknown error'}\`, 'error');
        }
      } catch (error) {
        showStatus(\`❌ Network error: \${error.message}\`, 'error');
      } finally {
        showLoading(false);
      }
    });
    
    document.getElementById('resetBtn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to reset all configuration to defaults?')) {
        return;
      }
      
      showLoading(true);
      
      try {
        const response = await fetch(\`/admin/api/reset?token=\${token}\`, {
          method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
          showStatus('✅ Configuration reset to defaults!');
          setTimeout(() => location.reload(), 1500);
        } else {
          showStatus(\`❌ Error: \${result.error || 'Unknown error'}\`, 'error');
        }
      } catch (error) {
        showStatus(\`❌ Network error: \${error.message}\`, 'error');
      } finally {
        showLoading(false);
      }
    });
    
    document.getElementById('healthBtn').addEventListener('click', async () => {
      showLoading(true);
      
      try {
        const response = await fetch(\`/admin/api/health?token=\${token}\`);
        const result = await response.json();
        
        if (response.ok) {
          showStatus(\`✅ Health Check: \${result.health.config.status}\`);
        } else {
          showStatus(\`❌ Health Check Failed: \${result.error}\`, 'error');
        }
      } catch (error) {
        showStatus(\`❌ Health Check Error: \${error.message}\`, 'error');
      } finally {
        showLoading(false);
      }
    });
  </script>
</body>
</html>`;
}

export default router;
