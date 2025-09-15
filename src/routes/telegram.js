import express from 'express';
import { configStorage } from '../storage/config.js';
import { geoService } from '../services/geo.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

// Bot detection regex (includes Telegram bots)
const botRegex = /(facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot)/i;

// Main Telegram redirect endpoint
router.get('/tg', asyncHandler(async (req, res) => {
  const userAgent = req.headers["user-agent"] || "";
  const ip = geoService.getClientIP(req);
  
  logger.info('Telegram redirect request', {
    ip,
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
    const forceCountry = (url.searchParams.get("force") || "").toUpperCase();
    const customText = url.searchParams.get("text") || "";

    // Determine country/routing
    let country = "";
    if (forceCountry) {
      country = forceCountry === "TR" ? "TR" : "REST";
      logger.info('Force country specified', { forceCountry, country });
    } else {
      country = await geoService.getCountryCode(ip);
      logger.info('Geo-location resolved', { ip, country });
    }

    // Get configuration
    const config = await configStorage.getConfig();
    
    // Determine routing
    const routing = geoService.determineRouting(country, forceCountry);
    const isTurkey = routing === 'TR';
    
    // Get appropriate channel and text
    const channel = isTurkey ? config.telegram_channel_tr : config.telegram_channel_default;
    const prefillText = isTurkey ? config.telegram_text_tr : config.telegram_text_default;
    
    // Combine texts
    const texts = [prefillText, customText].filter(Boolean);
    const finalText = texts.join(" ").trim();
    
    // Build Telegram URL
    const textParam = finalText ? `?text=${encodeURIComponent(finalText)}` : "";
    const telegramUrl = `https://t.me/${channel}${textParam}`;
    
    logger.info('Telegram redirect generated', {
      ip,
      country,
      routing,
      channel,
      hasText: !!finalText,
      telegramUrl: telegramUrl.substring(0, 100) + '...'
    });
    
    // Redirect to Telegram
    res.redirect(302, telegramUrl);
    
  } catch (error) {
    logger.error('Telegram redirect error', {
      ip,
      error: error.message,
      stack: error.stack
    });
    
    // Fallback to default configuration
    const config = await configStorage.getConfig();
    const fallbackUrl = `https://t.me/${config.telegram_channel_default}`;
    
    logger.info('Using fallback redirect', { fallbackUrl: fallbackUrl.substring(0, 100) + '...' });
    res.redirect(302, fallbackUrl);
  }
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  const [configHealth, geoHealth] = await Promise.all([
    configStorage.healthCheck(),
    geoService.healthCheck()
  ]);
  
  const overallStatus = configHealth.status === 'healthy' && geoHealth.status === 'healthy' ? 'healthy' : 'degraded';
  
  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      config: configHealth,
      geo: geoHealth
    }
  });
}));

// Generate bot preview page for Telegram
function generateBotPreview() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Contact Us - Telegram</title>
  <meta property="og:title" content="Contact Us"/>
  <meta property="og:description" content="Get in touch with our team via Telegram"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="Contact Us"/>
  <meta name="twitter:description" content="Get in touch with our team via Telegram"/>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: grid;
      place-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #0088cc 0%, #006699 100%);
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
    .telegram-icon {
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
    <div class="telegram-icon">✈️</div>
    <h1>Contact Us</h1>
    <p>Get in touch with our team via Telegram. We're here to help!</p>
    
    <div class="features">
      <div class="feature">
        <span class="feature-icon">🌍</span>
        <span>Global coverage with local channels</span>
      </div>
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span>Instant connection to our team</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔒</span>
        <span>Secure and private messaging</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default router;
