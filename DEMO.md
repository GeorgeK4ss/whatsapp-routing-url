# Turkish Website Redirect Feature Demo

## New Feature Overview

We've added Turkish website redirect functionality to your project, now supporting:

1. **🌐 Website Redirects**: Simple website redirects with target parameter
2. **🇹🇷 Turkish Website**: Redirect to Turkish website when target=turkey
3. **🌍 Default Website**: Redirect to default website when no target specified
4. **🎛️ Admin Interface**: Easy website URL configuration through admin interface

## New Endpoints

### Website Redirect Endpoints
- **Main Redirect**: `/website` - Redirects to default website URL
- **Target Specific**: 
  - `/website?target=turkey` - Redirect to Turkish website
  - `/website?target=tr` - Redirect to Turkish website (short form)

## Environment Configuration

Add the following configuration to your `.env` file:

```env
# Website URL Configuration
DEFAULT_WEBSITE_URL=https://example.com
TURKEY_WEBSITE_URL=https://turkey.example.com
```

## Admin Interface Updates

The admin interface now includes:

1. **Website Configuration Section**: Configure Turkish and default website URLs
2. **Current Configuration Display**: Shows currently set website URLs
3. **URL Validation**: Automatically validates URL format

## Usage Examples

### 1. Basic Redirect
```
https://your-domain.com/website
```
- Redirects to default website URL

### 2. Target Specific Redirect
```
https://your-domain.com/website?target=turkey
```
- Redirects to Turkish website

```
https://your-domain.com/website?target=tr
```
- Redirects to Turkish website (short form)

### 3. Admin Configuration
Access the admin interface:
```
https://your-domain.com/admin?token=YOUR_ADMIN_TOKEN
```

Configure in the "🌐 Website Configuration" section:
- 🇹🇷 Turkey Website URL
- 🌍 Default Website URL

## Technical Implementation

### New Files
- `src/routes/website.js` - Website redirect route handling

### Modified Files
- `env.example` - Added website URL environment variables
- `src/config/settings.js` - Added website URL configuration
- `src/storage/config.js` - Added website URL storage support
- `src/config/validation.js` - Added website URL validation
- `src/routes/admin.js` - Added website URL admin interface
- `src/server.js` - Registered website route
- `README.md` - Updated documentation

### Validation Features
- Website URL format validation
- Support for HTTP and HTTPS protocols
- Automatic error handling and fallback mechanisms

## Testing

Run tests to verify new functionality:
```bash
npm test tests/website.test.js
```

Manual testing:
```bash
# Test Turkish website redirect
curl "http://localhost:3000/website?target=turkey"

# Test default website redirect
curl "http://localhost:3000/website"

# Test bot detection
curl -H "User-Agent: Googlebot/2.1" "http://localhost:3000/website"
```

## Deployment

1. Update environment variable configuration
2. Redeploy the application
3. Configure website URLs through admin interface
4. Test redirect functionality

## Important Notes

- Turkish website URL can be different each time, updated via admin interface
- Complete URL validation ensures valid HTTP/HTTPS URLs
- Bot detection returns preview page for search engines instead of redirecting
- Complete error handling and fallback mechanisms

This feature allows you to provide personalized website experiences for different users, especially suitable for scenarios where you need to provide specialized websites for Turkish users.
