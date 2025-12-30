# Rate Limiting Controls - Quick Reference

## 🔧 Where to Enable/Disable Rate Limiting

### File: `google-apps-script.gs`
**Lines: 14-20**

```javascript
// ===== RATE LIMITING CONFIGURATION =====
const ENABLE_RATE_LIMITING = true; // ⚠️ SET TO FALSE WHEN TESTING/DEVELOPING
const MAX_REQUESTS_PER_HOUR = 20; // Maximum requests per user per hour
const MAX_REQUESTS_PER_DAY = 100; // Maximum requests per user per day

// Whitelist - No rate limiting for these
const WHITELISTED_IPS = ['172.16.255.61']; // Your local IP - add more if needed
const ALLOW_LOCALHOST = true; // Bypass rate limit when accessing from localhost/127.0.0.1
```

## Quick Actions

### ✅ Enable Rate Limiting (Production)
```javascript
const ENABLE_RATE_LIMITING = true;
```

### ⚠️ Disable Rate Limiting (Testing/Development)
```javascript
const ENABLE_RATE_LIMITING = false;
```

### 🎛️ Adjust Limits
```javascript
const MAX_REQUESTS_PER_HOUR = 50;  // Change to desired number
const MAX_REQUESTS_PER_DAY = 200;  // Change to desired number
```

### 🏠 Whitelist Your IP (No Limits for You!)
```javascript
const WHITELISTED_IPS = ['172.16.255.61', 'xxx.xxx.xxx.xxx']; // Add your IPs here
```

### 💻 Auto-Detect Localhost (Dev Mode)
```javascript
const ALLOW_LOCALHOST = true; // Automatically bypasses when on localhost:5500
```

## 📍 Exact Locations in Code

### 1. Configuration (Lines 7-16)
```
google-apps-script.gs
├── Line 7: const PRIMARY_MODEL = 'gemini-2.5-flash';
├── Line 8: const FALLBACK_MODEL = 'gemini-1.5-flash';
├── Line 11: const DISABLE_THINKING = true;
├── Line 12: const MAX_TOKENS = 500;
├── Line 14: const ENABLE_RATE_LIMITING = true; ← HERE
├── Line 15: const MAX_REQUESTS_PER_HOUR = 20; ← HERE
└── Line 16: const MAX_REQUESTS_PER_DAY = 100; ← HERE
```

### 2. Rate Limit Check (Lines 23-31)
```javascript
// In doPost function
if (ENABLE_RATE_LIMITING) {
  const rateLimitCheck = checkRateLimit(e);
  if (!rateLimitCheck.allowed) {
    return createResponse({
      success: false,
      error: rateLimitCheck.message
    });
  }
}
```

### 3. Rate Limit Logic (Lines 251-318)
```javascript
function checkRateLimit(e) {
  // This function handles the actual rate limiting
  // It uses CacheService to track requests
  // No need to modify this function
}
```

## How It Works

### Priority System (checked in order):
1. ✅ **Whitelisted IP?** → Allow (no limit)
2. ✅ **Localhost/Dev Mode?** → Allow (no limit)
3. ⏱️ **Rate Limit Check** → Count requests

### Rate Limiting Details:
1. **User Fingerprint**: Combines `userId` (from localStorage) + `userAgent` (browser info)
2. **Storage**: Uses Google's CacheService (fast, temporary)
3. **Tracking**: 
   - Hourly counter: Resets after 1 hour
   - Daily counter: Resets after 24 hours
4. **Response**: Shows friendly error message in user's language when limit exceeded

### Whitelist & Localhost Detection:
- **Whitelisted IPs**: Your public IP(s) bypass all limits
- **Localhost Detection**: Automatically detects `localhost` or `127.0.0.1` in URL
- **Dev Mode**: When you test on `http://127.0.0.1:5500` → no limits!
- **Your Network**: Your IP `172.16.255.61` (local) maps to your public IP → whitelisted

## Error Messages Shown to Users

### English
```
"Rate limit exceeded. Maximum 20 requests per hour. Please try again later."
"Daily limit reached. Maximum 100 requests per day. Please try again tomorrow."
```

### Russian
```
"Превышен лимит запросов. Максимум 20 запросов в час. Попробуйте позже."
"Достигнут дневной лимит. Максимум 100 запросов в день. Попробуйте завтра."
```

## Development Workflow

### Before Testing:
```javascript
const ENABLE_RATE_LIMITING = false; // Disable
```
↓ Save → Deploy as new version → Test

### Before Production:
```javascript
const ENABLE_RATE_LIMITING = true; // Enable
```
↓ Save → Deploy as new version → Go live

## Monitoring

To see rate limit activity:
1. Open Google Apps Script
2. Click "Executions" (left sidebar)
3. Look for logs with: "Rate limit check error" or "Rate limit exceeded"

## Testing Rate Limits

1. Set limits very low for testing:
```javascript
const MAX_REQUESTS_PER_HOUR = 3;
const MAX_REQUESTS_PER_DAY = 5;
```

2. Test by sending multiple requests
3. Verify you get the rate limit error message
4. Reset by clearing cache or waiting for timeout
5. Set back to production values

## Advanced: Manual Cache Reset (if needed)

Add this function to your script:
```javascript
function resetRateLimitCache() {
  CacheService.getScriptCache().removeAll(['rate_hour_*', 'rate_day_*']);
  Logger.log('Rate limit cache cleared');
}
```

Then run it from the script editor when you need to reset limits during testing.

## Finding Your Public IP to Whitelist

### Method 1: Automatic (Recommended)
Your chatbot now automatically fetches and stores your public IP!
1. Open your portfolio in browser
2. Open DevTools (F12)
3. Go to Console
4. Look for: `User public IP stored: xxx.xxx.xxx.xxx`
5. Copy that IP
6. Add it to `WHITELISTED_IPS` array in `google-apps-script.gs`

### Method 2: Manual
1. Visit: https://api.ipify.org
2. Copy the IP shown
3. Add it to `WHITELISTED_IPS` array

### Method 3: Localhost (Easiest for Development)
Just use `http://127.0.0.1:5500` or `http://localhost:5500` when testing!
- No need to add IP
- Automatically detected as dev mode
- Zero rate limits

## Whitelist Examples

### Single IP (You only)
```javascript
const WHITELISTED_IPS = ['172.16.255.61'];
```

### Multiple IPs (You + Team)
```javascript
const WHITELISTED_IPS = [
  '172.16.255.61',    // Your home
  '203.0.113.42',     // Your office
  '198.51.100.89'     // Teammate
];
```

### Empty (No whitelist, localhost still works)
```javascript
const WHITELISTED_IPS = [];
```

## Notes

- **Local IP** (`172.16.255.61`) = Your device on your network
- **Public IP** (e.g., `203.0.113.42`) = What the internet sees
- The script needs your **public IP** to whitelist you
- But **localhost detection works without any IP** - easiest for development!

