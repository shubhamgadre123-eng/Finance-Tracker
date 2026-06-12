// FILE: config.js
// Place this file in the same directory as Finance Tracker.html
// This allows easy URL configuration without editing the HTML file

// ============================================================
// FINANCE TRACKER - URL & ENVIRONMENT CONFIGURATION
// ============================================================

// AUTO-DETECTION (Default - No changes needed for local dev)
// The app automatically detects localhost vs production
// Results in: http://localhost:5000/api OR https://yourdomain.com:5000/api

// To override, uncomment one of the options below:

// ============================================================
// OPTION 1: LOCAL DEVELOPMENT
// ============================================================
// const API_CONFIG = {
//     baseUrl: 'http://localhost:5000/api',
//     websiteName: 'Finance Tracker Local',
//     environment: 'development'
// };

// ============================================================
// OPTION 2: PRODUCTION WITH CUSTOM DOMAIN
// ============================================================
// const API_CONFIG = {
//     baseUrl: 'https://yourdomain.com:5000/api',
//     websiteName: 'Finance Tracker',
//     environment: 'production'
// };

// ============================================================
// OPTION 3: IP ADDRESS BASED (Local Network)
// ============================================================
// const API_CONFIG = {
//     baseUrl: 'http://192.168.1.100:5000/api',
//     websiteName: 'Finance Tracker LAN',
//     environment: 'staging'
// };

// ============================================================
// OPTION 4: CLOUD DEPLOYMENT (AWS, Heroku, DigitalOcean)
// ============================================================
// const API_CONFIG = {
//     baseUrl: 'https://api.yourdomain.com/api',
//     websiteName: 'Finance Tracker Cloud',
//     environment: 'production'
// };

// ============================================================
// HOW TO USE THIS FILE:
// ============================================================
// 1. Uncomment the option you need (remove // from lines)
// 2. Replace 'yourdomain.com' or '192.168.1.100' with your actual URL
// 3. Save this file
// 4. Add this to Finance Tracker.html before other scripts:
//    <script src="config.js"></script>
// 5. The app will use your custom configuration

// Example for production:
// In Finance Tracker.html, add near the top of <head>:
// ============================================================
// <script>
//     const API_CONFIG = {
//         baseUrl: 'https://myfinanceapp.com:5000/api',
//         websiteName: 'My Finance Tracker',
//         environment: 'production'
//     };
// </script>
// ============================================================

// COMMON CONFIGURATIONS

// Development Environment
let devConfig = `
const API_CONFIG = {
    baseUrl: 'http://localhost:5000/api',
    websiteName: 'Finance Tracker Dev',
    environment: 'development',
    debug: true
};
`;

// Production Environment
let prodConfig = `
const API_CONFIG = {
    baseUrl: 'https://yourdomain.com:5000/api',
    websiteName: 'Finance Tracker',
    environment: 'production',
    debug: false
};
`;

// Local Network (LAN)
let lanConfig = `
const API_CONFIG = {
    baseUrl: 'http://192.168.1.100:5000/api',
    websiteName: 'Finance Tracker LAN',
    environment: 'staging',
    debug: true
};
`;

// ============================================================
// FREQUENTLY USED URLS
// ============================================================

/*
LOCALHOST (Default)
- Website: http://localhost:3000
- API: http://localhost:5000/api
- No configuration needed

LOCAL NETWORK
- Website: http://192.168.1.100:3000
- API: http://192.168.1.100:5000/api
- Update baseUrl to your IP

CUSTOM DOMAIN
- Website: https://myfinanceapp.com
- API: https://myfinanceapp.com:5000/api
- Update baseUrl to your domain

SUBDOMAIN
- Website: https://app.yourdomain.com
- API: https://api.yourdomain.com:5000/api
- Update baseUrl to your API subdomain

CLOUD DEPLOYMENT
- Website: https://finance-tracker-abc123.herokuapp.com
- API: https://finance-tracker-abc123.herokuapp.com/api
- Update baseUrl to your cloud URL
*/

// ============================================================
// SETUP INSTRUCTIONS
// ============================================================

/*
STEP 1: Choose Your URL Configuration

Development:
  const API_CONFIG = {
    baseUrl: 'http://localhost:5000/api'
  };

Production (Domain):
  const API_CONFIG = {
    baseUrl: 'https://yourdomain.com:5000/api'
  };

Production (IP):
  const API_CONFIG = {
    baseUrl: 'http://192.168.1.100:5000/api'
  };

STEP 2: Update Finance Tracker.html

Find this section:
  <script>
    const API_BASE_URL = 'http://localhost:5000/api';

Replace with:
  <script>
    const API_CONFIG = {
      baseUrl: 'YOUR_URL_HERE'
    };
    const API_BASE_URL = API_CONFIG.baseUrl;

STEP 3: Set Your URL

For domains:
  Replace 'YOUR_URL_HERE' with 'https://yourdomain.com:5000/api'

For IP addresses:
  Replace 'YOUR_URL_HERE' with 'http://192.168.1.100:5000/api'

For localhost:
  Replace 'YOUR_URL_HERE' with 'http://localhost:5000/api'

STEP 4: Test the Connection

1. Open browser console (F12)
2. Check that API_BASE_URL shows correct URL
3. Try login with demo credentials:
   Username: SHUBHAM
   Password: SHUBHAM
4. If login succeeds, URL is configured correctly!
*/

// ============================================================
// TROUBLESHOOTING
// ============================================================

/*
If API URL is not working:

1. Check browser console for error message
   - Open: F12 or Right-click > Inspect > Console tab
   - Look for red error messages
   - Note the exact error

2. Verify backend is running
   - Windows: Check if Node.js/Python process is running
   - Linux: sudo systemctl status finance-tracker
   - Docker: docker ps

3. Test URL directly in browser
   - Visit: http://your-url:5000/api/health
   - Should show: {"status":"ok"}

4. Check firewall settings
   - Port 5000 must be accessible
   - Windows Firewall: Allow port 5000
   - Linux Firewall: sudo ufw allow 5000

5. Verify correct URL format
   - Must include protocol: http:// or https://
   - Must include port: :5000
   - Must include /api: /api
   - Example: https://yourdomain.com:5000/api ✓
   - Wrong: yourdomain.com:5000 ✗

6. Check DNS resolution (for domains)
   - Windows: nslookup yourdomain.com
   - Linux: dig yourdomain.com
   - Should return your server IP
*/

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
