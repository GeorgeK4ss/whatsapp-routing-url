# WhatsApp Geo Redirect Service

A production-ready Node.js service that provides country-based WhatsApp redirects with geo-detection.

## Features

- **Country-based routing**: Automatically detects user location and routes to appropriate WhatsApp number
- **Turkey routing**: Turkish users → Turkish WhatsApp number
- **Default routing**: All other users → Default WhatsApp number  
- **Admin interface**: Web-based configuration management
- **Bot protection**: Returns preview page for crawlers instead of redirecting
- **Redis caching**: Fast geo-location caching with 24h TTL
- **Production ready**: Deploy to Render.com with one click

## Deploy on Render

1. **Create a new repo** with these files and push.
2. In Render:
   - New **Web Service** → from repo. Runtime: Node.
   - Add a **Redis** instance (Starter plan is fine).
   - In the web service → **Environment**:
     - Set `ADMIN_TOKEN` to a long random secret.
     - Set `IPINFO_TOKEN` (you already have one).
     - `REDIS_URL` can be auto-wired from the Redis service via `render.yaml` (or copy Connection String into env manually).
3. Deploy.

## Admin Interface

### Web Admin Page
Visit `/admin?token=YOUR_SECRET` for a user-friendly web interface to:
- View current configuration
- Update WhatsApp numbers
- Set prefill texts
- Save changes with one click

### API Endpoints (for advanced users)
- Show current config:
GET /admin/api?token=YOUR_SECRET&show=1

- Set default (non-TR) number:
GET /admin/api?token=YOUR_SECRET&default=447723342065
- Set TR number:
GET /admin/api?token=YOUR_SECRET&tr=905513797933
- Optional prefill texts:
GET /admin/api?token=YOUR_SECRET&text_default=Hello%2029Bet&text_tr=Merhaba%2029Bet

## Usage

Public link:
/wa

Add per-campaign text:
/wa?text=From%20Summer%20Campaign

Force testing:
/wa?force=TR
/wa?force=REST

## Notes
- Numbers stored as digits only (E.164 format without `+`).
- If Redis is missing, app falls back to in-memory cache (dev only).
- If IP lookup fails, defaults to non-TR routing.

## Configuration

After deployment, configure your WhatsApp numbers via the admin interface:

**Admin Page**: `/admin?token=YOUR_SECRET`

**API Configuration**:
```bash
# Set WhatsApp numbers
/admin/api?token=YOUR_SECRET&default=447723342065&tr=905513797933

# Add prefill texts
/admin/api?token=YOUR_SECRET&text_default=Hello!%20How%20can%20I%20help%20you?&text_tr=Merhaba!%20Size%20nasıl%20yardımcı%20olabilirim?
```

## Environment Variables

- `ADMIN_TOKEN`: Secure token for admin access
- `IPINFO_TOKEN`: API token for geo-location detection
- `REDIS_URL`: Redis connection string (auto-configured on Render)
