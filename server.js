import express from "express";
import morgan from "morgan";
import { getFileStorage } from "./file-storage.js";
import { fetch } from "undici";
import { countryCodes } from "./country-codes.js";

const app = express();

// Simple in-memory storage that persists during service lifetime
let config = {
  number_default: "1234567890",
  number_tr: "1234567890",
  text_default: "Hello! How can I help you?",
  text_tr: "Merhaba! Size nasıl yardımcı olabilirim?"
};

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || "";

// Defaults if KV empty (replace with your actual numbers)
const DEFAULT_NUMBER_NON_TR = "1234567890";
const DEFAULT_NUMBER_TR = "1234567890";
const DEFAULT_TEXT_NON_TR = "Hello! How can I help you?";
const DEFAULT_TEXT_TR = "Merhaba! Size nasıl yardımcı olabilirim?";

// Basic bot UA check
const botRe = /(facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot)/i;

// Helpers
const sanitizeNumber = (v) => (v || "").replace(/[^\d]/g, "");
const encode = encodeURIComponent;
const toJSON = (o) => JSON.stringify(o, null, 2);

// Extract country code from full number
function extractCountryCode(fullNumber) {
  if (!fullNumber) return "44";
  
  // Common country codes to try (longest first)
  const countryCodes = ["44", "90", "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "91", "92", "93", "94", "95", "98"];
  
  for (const code of countryCodes) {
    if (fullNumber.startsWith(code)) {
      return code;
    }
  }
  
  return "44"; // default fallback
}

// Extract first public IP from XFF
function getClientIP(req) {
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

async function getConfig() {
  return {
    number_default: config.number_default || DEFAULT_NUMBER_NON_TR,
    number_tr: config.number_tr || DEFAULT_NUMBER_TR,
    text_default: config.text_default || DEFAULT_TEXT_NON_TR,
    text_tr: config.text_tr || DEFAULT_TEXT_TR
  };
}

async function setIfPresent(key, value, validator = () => true) {
  if (value !== undefined && value !== null) {
    if (!validator(value)) throw new Error(`Invalid ${key}`);
    config[key] = value;
    console.log(`[config] Updated ${key} = ${value}`);
  }
}

async function ipToCountry(ip) {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.16.")) {
    // fallback to server-side detected requester
    return fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`).then(async r => {
      if (!r.ok) throw new Error("ipinfo self lookup failed");
      const j = await r.json();
      return (j && j.country) ? String(j.country).toUpperCase() : "";
    }).catch(() => "");
  }

  // Simple geo caching in memory
  const cacheKey = `geo_${ip}`;
  if (config[cacheKey]) return config[cacheKey];

  try {
    const res = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
    if (!res.ok) throw new Error("ipinfo bad response");
    const j = await res.json();
    const c = (j && j.country) ? String(j.country).toUpperCase() : "";
    if (c) config[cacheKey] = c;
    return c;
  } catch (e) {
    return "";
  }
}

// Logging
app.use(morgan("tiny"));

// Health
app.get("/", async (_req, res) => {
  const cfg = await getConfig();
  res.type("json").send(toJSON({ 
    ok: true, 
    cfg,
    env: {
      REDIS_URL: process.env.REDIS_URL ? "SET" : "NOT SET",
      ADMIN_TOKEN: process.env.ADMIN_TOKEN ? "SET" : "NOT SET",
      IPINFO_TOKEN: process.env.IPINFO_TOKEN ? "SET" : "NOT SET"
    }
  }));
});

// Admin page (HTML)
app.get("/admin", async (req, res) => {
  try {
    if (!ADMIN_TOKEN || req.query.token !== ADMIN_TOKEN) {
      return res.status(401).send("Unauthorized");
    }
    
    const cfg = await getConfig();
    const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>WhatsApp Admin</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f5f5f5;color:#333}
    .container{max-width:600px;margin:40px auto;padding:20px}
    .card{background:white;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.1);padding:30px}
    h1{margin:0 0 20px;color:#2c3e50;font-size:24px}
    .form-group{margin-bottom:20px}
    label{display:block;margin-bottom:5px;font-weight:500;color:#555}
    input[type="text"],input[type="tel"],textarea{width:100%;padding:12px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box}
    input[type="text"]:focus,input[type="tel"]:focus,textarea:focus{outline:none;border-color:#3498db;box-shadow:0 0 0 2px rgba(52,152,219,.2)}
    textarea{height:80px;resize:vertical}
    .btn{background:#3498db;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500}
    .btn:hover{background:#2980b9}
    .btn-success{background:#27ae60}
    .btn-success:hover{background:#229954}
    .current{background:#ecf0f1;padding:15px;border-radius:6px;margin-bottom:20px}
    .current h3{margin:0 0 10px;color:#2c3e50}
    .current p{margin:5px 0;color:#7f8c8d}
    .status{margin-top:15px;padding:10px;border-radius:6px;display:none}
    .status.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
    .status.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
    .help{font-size:12px;color:#7f8c8d;margin-top:5px}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>WhatsApp Configuration</h1>
      
      <div class="current">
        <h3>Current Settings</h3>
        <p><strong>Turkey Number:</strong> +${cfg.number_tr}</p>
        <p><strong>Default Number:</strong> +${cfg.number_default}</p>
        <p><strong>Turkey Text:</strong> ${cfg.text_tr || '(none)'}</p>
        <p><strong>Default Text:</strong> ${cfg.text_default || '(none)'}</p>
      </div>

      <form id="configForm">
        <div class="form-group">
          <label for="tr_number">Turkey WhatsApp Number</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span style="font-weight: 500; color: #555; min-width: 60px;">+90</span>
            <input type="tel" id="tr_number" name="tr_number" value="${cfg.number_tr.startsWith('90') ? cfg.number_tr.substring(2) : cfg.number_tr}" placeholder="5513797933" style="flex: 1;">
          </div>
          <div class="help">Turkey country code (+90) is fixed. Enter only the phone number (e.g., 5513797933)</div>
        </div>

        <div class="form-group">
          <label for="default_number">Default WhatsApp Number</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <select id="default_country_code" name="default_country_code" style="min-width: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
              ${countryCodes.replace(`value="${extractCountryCode(cfg.number_default)}"`, `value="${extractCountryCode(cfg.number_default)}" selected`)}
            </select>
            <input type="tel" id="default_number" name="default_number" value="${cfg.number_default.replace(new RegExp('^' + extractCountryCode(cfg.number_default)), '')}" placeholder="7723342065" style="flex: 1;">
          </div>
          <div class="help">Select country code and enter phone number without country code (e.g., 7723342065)</div>
        </div>

        <div class="form-group">
          <label for="tr_text">Turkey Prefill Text</label>
          <textarea id="tr_text" name="tr_text" placeholder="Merhaba! Size nasıl yardımcı olabilirim?">${cfg.text_tr || ''}</textarea>
          <div class="help">Optional text to prefill for Turkish users</div>
        </div>

        <div class="form-group">
          <label for="default_text">Default Prefill Text</label>
          <textarea id="default_text" name="default_text" placeholder="Hello! How can I help you?">${cfg.text_default || ''}</textarea>
          <div class="help">Optional text to prefill for non-Turkish users</div>
        </div>

        <button type="submit" class="btn btn-success">Save Configuration</button>
      </form>

      <div id="status" class="status"></div>
    </div>
  </div>

  <script>
    // Country code selection is handled in HTML template

    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const params = new URLSearchParams();
      params.append('token', '${ADMIN_TOKEN}');
      
      // Turkey number (always +90)
      if (formData.get('tr_number')) {
        params.append('tr', '90' + formData.get('tr_number'));
      }
      
      // Default number (country code + number)
      if (formData.get('default_number') && formData.get('default_country_code')) {
        params.append('default', formData.get('default_country_code') + formData.get('default_number'));
      }
      
      if (formData.get('tr_text')) params.append('text_tr', formData.get('tr_text'));
      if (formData.get('default_text')) params.append('text_default', formData.get('default_text'));
      
      try {
        const response = await fetch('/admin/api?' + params.toString(), { method: 'POST' });
        const result = await response.text();
        
        const status = document.getElementById('status');
        if (response.ok) {
          status.className = 'status success';
          status.textContent = 'Configuration saved successfully!';
          status.style.display = 'block';
          setTimeout(() => location.reload(), 1500);
        } else {
          status.className = 'status error';
          status.textContent = 'Error: ' + result;
          status.style.display = 'block';
        }
      } catch (error) {
        const status = document.getElementById('status');
        status.className = 'status error';
        status.textContent = 'Network error: ' + error.message;
        status.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
    
    return res.type("html").send(html);
  } catch (e) {
    return res.status(500).send("Server error: " + String(e.message || e));
  }
});

// Admin API (query-based and POST)
app.get("/admin/api", async (req, res) => {
  try {
    if (!ADMIN_TOKEN || req.query.token !== ADMIN_TOKEN) {
      return res.status(401).send("Unauthorized");
    }
    if (req.query.show) {
      const cfg = await getConfig();
      return res.type("json").send(toJSON(cfg));
    }
    // Set numbers/texts
    const defaultNum = sanitizeNumber(req.query.default);
    const trNum = sanitizeNumber(req.query.tr);
    const textDefault = req.query.text_default;
    const textTR = req.query.text_tr;

    await setIfPresent("number_default", defaultNum, v => !v || v.length >= 7);
    await setIfPresent("number_tr", trNum, v => !v || v.length >= 7);
    await setIfPresent("text_default", textDefault);
    await setIfPresent("text_tr", textTR);

    return res.send("OK");
  } catch (e) {
    return res.status(400).send(String(e.message || e));
  }
});

app.post("/admin/api", async (req, res) => {
  try {
    if (!ADMIN_TOKEN || req.query.token !== ADMIN_TOKEN) {
      return res.status(401).send("Unauthorized");
    }
    
    // Parse form data
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
    });
    
    const params = new URLSearchParams(body);
    const defaultNum = sanitizeNumber(params.get('default'));
    const trNum = sanitizeNumber(params.get('tr'));
    const textDefault = params.get('text_default');
    const textTR = params.get('text_tr');

    await setIfPresent("number_default", defaultNum, v => !v || v.length >= 7);
    await setIfPresent("number_tr", trNum, v => !v || v.length >= 7);
    await setIfPresent("text_default", textDefault);
    await setIfPresent("text_tr", textTR);

    return res.send("OK");
  } catch (e) {
    return res.status(400).send(String(e.message || e));
  }
});

// Main redirect
app.get("/wa", async (req, res) => {
  const ua = req.headers["user-agent"] || "";
  if (botRe.test(String(ua))) {
    const html = `
<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Contact</title>
<meta property="og:title" content="Contact"/>
<meta property="og:description" content="Get in touch."/>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:grid;place-items:center;height:100dvh;margin:0;background:#0f0f10;color:#fff}
.card{padding:32px 28px;border-radius:16px;background:#151517;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;max-width:520px}
h1{margin:0 0 8px;font-size:28px} p{opacity:.8;margin:0}
</style></head><body><div class="card"><h1>Contact</h1><p>Reach out to our team.</p></div></body></html>`;
    return res.status(200).type("html").send(html);
  }

  const url = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
  const force = (url.searchParams.get("force") || "").toUpperCase();

  let country = "";
  if (force) {
    country = force === "TR" ? "TR" : "REST";
  } else {
    const ip = getClientIP(req);
    country = await ipToCountry(ip);
    if (!country) country = "REST";
  }

  const cfg = await getConfig();
  const isTR = country === "TR" || force === "TR";
  const number = isTR ? cfg.number_tr : cfg.number_default;

  const prefill = isTR ? (cfg.text_tr || "") : (cfg.text_default || "");
  const extra = url.searchParams.get("text") || "";
  const merged = [prefill, extra].filter(Boolean).join(" ").trim();
  const textParam = merged ? `&text=${encode(merged)}` : "";

  const redirectURL = `https://api.whatsapp.com/send?phone=${encode(number)}${textParam}`;
  return res.redirect(302, redirectURL);
});

app.listen(PORT, () => {
  console.log(`[wa-geo-render] listening on :${PORT}`);
});
