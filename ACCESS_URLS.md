# Finance Tracker - Access URLs Quick Reference

## 🌐 Current Website URLs

| Environment | Website URL | API URL |
|---|---|---|
| **Local Development** | http://localhost:3000 | http://localhost:5000/api |
| **Local IP (LAN)** | http://192.168.x.x:3000 | http://192.168.x.x:5000/api |
| **Production (Domain)** | https://yourdomain.com | https://yourdomain.com:5000/api |
| **Docker** | http://localhost:8080 | http://localhost:5000/api |

---

## 🚀 Quick Start

### For Local Development (Recommended)

1. **Start Backend:**
   ```bash
   # Windows
   node server.js
   # or
   python app.py
   
   # Linux/Mac
   node server.js
   # or
   python app.py
   ```

2. **Access Website:**
   ```
   http://localhost:3000
   or
   http://localhost:5000
   ```

3. **Login with Demo:**
   - Username: `SHUBHAM`
   - Password: `SHUBHAM`

---

## 🏠 Local Network Access

### Option 1: Find Your IP Address

**Windows:**
```powershell
ipconfig
# Look for IPv4 Address: 192.168.x.x
```

**Linux/Mac:**
```bash
ifconfig
# or
ip addr show
# Look for inet address: 192.168.x.x
```

### Option 2: Access from Another Computer on Same Network

```
Website: http://192.168.1.100:3000
API: http://192.168.1.100:5000/api

Replace 192.168.1.100 with your actual IP from Step 1
```

---

## ☁️ Production Deployment

### Using Your Own Domain

**Step 1: Point Domain to Your Server**
```
DNS Settings:
- A Record → your-server-ip
- CNAME → yourdomain.com
```

**Step 2: Start Backend**
```bash
HOST=0.0.0.0 PORT=5000 node server.js
# or
python app.py
```

**Step 3: Access Website**
```
https://yourdomain.com
https://yourdomain.com:5000/api
```

### Using Cloud Services

**Heroku:**
```
Website: https://your-app-name.herokuapp.com
API: https://your-app-name.herokuapp.com/api
```

**AWS (EC2):**
```
Website: https://your-instance-ip.amazonaws.com
API: https://your-instance-ip.amazonaws.com:5000/api
```

**DigitalOcean:**
```
Website: https://your-droplet-ip.digitalocean.com
API: https://your-droplet-ip.digitalocean.com:5000/api
```

---

## 📱 Mobile Access

### From Mobile Device on Same Network

**Step 1: Find Your Computer's IP**
```
Windows: ipconfig → IPv4 Address: 192.168.x.x
Mac/Linux: ifconfig → inet: 192.168.x.x
```

**Step 2: Open in Mobile Browser**
```
http://192.168.1.100:3000
(Replace with your computer's IP)
```

**Step 3: Add to Home Screen (PWA)**
```
iOS Safari:
  - Share → Add to Home Screen
  
Android Chrome:
  - Menu (⋮) → Install app
```

---

## 🔗 Common URL Patterns

### Development & Testing
```
// Local machine
http://localhost:3000          ✓ Frontend
http://localhost:5000/api      ✓ API

// Local network
http://192.168.1.X:3000        ✓ Frontend
http://192.168.1.X:5000/api    ✓ API
```

### Production
```
// Domain-based
https://yourdomain.com         ✓ Frontend
https://yourdomain.com:5000/api ✓ API

// Subdomain-based  
https://app.yourdomain.com     ✓ Frontend
https://api.yourdomain.com:5000/api ✓ API
```

---

## 🧪 API Endpoints

### Health Check
```
GET http://localhost:5000/api/health
→ Returns: {"status": "ok"}
```

### Authentication
```
POST http://localhost:5000/api/auth/login
POST http://localhost:5000/api/auth/register
```

### Data Operations
```
GET  http://localhost:5000/api/transactions
POST http://localhost:5000/api/transactions
GET  http://localhost:5000/api/budgets
GET  http://localhost:5000/api/goals
```

---

## 🔧 Configuration

### Automatic URL Detection

The app automatically detects your environment:

```javascript
// Detects: localhost → http://localhost:5000/api
// Detects: yourdomain.com → https://yourdomain.com:5000/api
// Detects: 192.168.1.100 → http://192.168.1.100:5000/api
```

### Manual Override (if needed)

Edit Finance Tracker.html:
```html
<script>
    // Override auto-detection if needed
    const API_BASE_URL = 'https://yourdomain.com:5000/api';
</script>
```

---

## 🐳 Docker Deployment

### Build & Run
```bash
docker build -t finance-tracker .
docker run -p 3000:3000 -p 5000:5000 finance-tracker
```

### Access
```
Website: http://localhost:3000
API: http://localhost:5000/api
```

---

## 📊 Example Access Scenarios

### Scenario 1: Team Member on Different Computer
```
1. Find your computer's IP: 192.168.1.50
2. Colleague visits: http://192.168.1.50:3000
3. Backend handles API calls automatically
```

### Scenario 2: Access from Mobile
```
1. Computer IP: 192.168.1.100
2. Mobile opens: http://192.168.1.100:3000
3. Install as PWA for offline support
```

### Scenario 3: Public Website Launch
```
1. Domain: myfinances.com
2. Server IP: 34.56.78.90
3. DNS points to server IP
4. Visit: https://myfinances.com
5. API calls use: https://myfinances.com:5000/api
```

---

## ⚠️ Troubleshooting URLs

### Can't Access http://localhost:3000
**Solution:**
- Check backend is running: `node server.js`
- Try: http://127.0.0.1:3000
- Check firewall allows port 3000

### API Not Responding
**Solution:**
```bash
# Test direct API access
curl http://localhost:5000/api/health
# Should return: {"status":"ok"}

# If not:
- Check backend process is running
- Check port 5000 is not in use
- Restart backend: node server.js
```

### Can't Access from Local Network
**Solution:**
```bash
# 1. Find your IP
ipconfig

# 2. Check firewall allows port 3000 & 5000
# Windows: Windows Firewall (allow inbound)
# Mac: System Preferences > Security > Firewall

# 3. Try from other computer:
http://YOUR_IP:3000
```

### CORS Errors
**Solution:**
- Ensure API_BASE_URL includes protocol and port
- Correct: http://localhost:5000/api ✓
- Wrong: localhost:5000 ✗

---

## 📝 Demo Credentials

```
Username: SHUBHAM
Password: SHUBHAM
```

Works on all environments!

---

## 🎯 Performance Test URLs

```bash
# Test API response time
curl -w "Response time: %{time_total}s\n" http://localhost:5000/api/health

# Batch requests
for i in {1..10}; do
  curl http://localhost:5000/api/health
done

# Load test (using Apache Bench)
ab -n 1000 -c 100 http://localhost:5000/api/health
```

---

## 🔐 Security Notes

⚠️ **For Production:**
- ✓ Use HTTPS (not HTTP)
- ✓ Update domain/IP in API_BASE_URL
- ✓ Enable CORS for your domain only
- ✓ Keep authentication tokens secure
- ✓ Use SSL certificates (Let's Encrypt)
- ✗ Don't expose sensitive URLs publicly
- ✗ Don't hardcode API keys in frontend

---

## 📞 Support

**Issue: Wrong URL?**
1. Check browser console (F12)
2. Look for "API Base URL: ..." message
3. Verify it matches your environment
4. If not, restart backend + refresh browser

**Issue: Connection refused?**
1. Backend must be running
2. Check correct port (default: 5000)
3. Check firewall/network settings
4. Try from command line: `curl http://localhost:5000/api/health`

---

## 📚 URL Reference Card

```
┌─────────────────────────────────────────────────┐
│  DEVELOPMENT (Local Machine)                    │
├─────────────────────────────────────────────────┤
│ Frontend: http://localhost:3000                 │
│ API:      http://localhost:5000/api             │
│ Demo:     SHUBHAM / SHUBHAM                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  LOCAL NETWORK (Multiple Computers)             │
├─────────────────────────────────────────────────┤
│ Frontend: http://192.168.1.100:3000             │
│ API:      http://192.168.1.100:5000/api         │
│ Demo:     SHUBHAM / SHUBHAM                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  PRODUCTION (Custom Domain)                     │
├─────────────────────────────────────────────────┤
│ Frontend: https://yourdomain.com                │
│ API:      https://yourdomain.com:5000/api       │
│ SSL:      REQUIRED                              │
└─────────────────────────────────────────────────┘
```

---

**Last Updated:** 2026-02-26
**Status:** ✅ Ready for Production
