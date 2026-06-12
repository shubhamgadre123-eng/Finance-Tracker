#!/usr/bin/env python3
"""
Finance Tracker - Production Configuration & Setup Guide
This file demonstrates how to run the Finance Tracker app in production with custom host/port
"""

import os
import sys
from pathlib import Path

# Production environment variables
PRODUCTION_CONFIG = {
    "HOST": os.getenv("HOST", "0.0.0.0"),  # Listen on all interfaces
    "PORT": int(os.getenv("PORT", 5000)),
    "DEBUG": os.getenv("DEBUG", "False").lower() == "true",
    "MONGO_URI": os.getenv("MONGO_URI", "mongodb://localhost:27017/finance_tracker"),
    "JWT_SECRET": os.getenv("JWT_SECRET", "change-this-secret-in-production"),
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "WORKERS": int(os.getenv("WORKERS", 4)),
}

# Production configuration instructions
SETUP_INSTRUCTIONS = """
╔════════════════════════════════════════════════════════════════════════════════╗
║                     FINANCE TRACKER - PRODUCTION SETUP                         ║
╚════════════════════════════════════════════════════════════════════════════════╝

1. ENVIRONMENT SETUP
═══════════════════════

Create a .env file in the project root with:

    # MongoDB Configuration
    MONGO_URI=mongodb://your-mongo-server:27017/finance_tracker
    
    # Server Configuration
    HOST=0.0.0.0           # or specific IP (e.g., 192.168.1.100)
    PORT=5000              # Any available port
    DEBUG=False
    
    # Security
    JWT_SECRET=your-very-secure-random-key-here
    
    # Logging
    LOG_LEVEL=INFO

2. RUNNING ON DIFFERENT HOSTS
══════════════════════════════

Option A: Run on localhost (Development)
    HOST=127.0.0.1 PORT=5000 python app.py

Option B: Run on all network interfaces (Internal LAN)
    HOST=0.0.0.0 PORT=5000 python app.py
    Then access at: http://<your-machine-ip>:5000

Option C: Run on specific IP (Fixed server)
    HOST=192.168.1.100 PORT=8080 python app.py
    Then access at: http://192.168.1.100:8080

Option D: Production server (with Gunicorn)
    gunicorn -w 4 -b 0.0.0.0:5000 app:app
    
    For custom host/port:
    gunicorn -w 4 -b <HOST>:<PORT> app:app

3. FRONTEND CONFIGURATION
═════════════════════════

Update the API_BASE_URL in Finance Tracker.html:

    OLD: const API_BASE_URL = 'http://localhost:5000/api';
    
    NEW (for production):
    const API_BASE_URL = 'http://your-server-ip:5000/api';
    
    OR (for HTTPS):
    const API_BASE_URL = 'https://your-domain.com/api';

4. DEPLOYMENT OPTIONS
═════════════════════

Option 1: Local Machine on LAN
    - Set HOST=0.0.0.0
    - Access from any machine on network: http://<your-ip>:5000
    - Update HTML API_BASE_URL to your machine IP
    - Perfect for: Office/home use

Option 2: Cloud Server (AWS, DigitalOcean, etc.)
    - Set HOST=0.0.0.0
    - Configure security groups/firewall to allow port 5000
    - Use domain name with DNS pointing to server
    - Update HTML API_BASE_URL to your domain
    - Perfect for: Remote/online access

Option 3: Docker Container
    docker build -t finance-tracker .
    docker run -e HOST=0.0.0.0 -e PORT=5000 -p 5000:5000 finance-tracker

Option 4: Raspberry Pi
    - SSH into Pi
    - Clone repository
    - Run: HOST=192.168.1.50 PORT=5000 python app.py
    - Access from other devices on network

5. REVERSE PROXY SETUP (NGINX/APACHE)
═════════════════════════════════════

If running behind NGINX (recommended for production):

    upstream finance_tracker {
        server 127.0.0.1:5000;
    }

    server {
        listen 80;
        server_name finance-tracker.com;

        location / {
            proxy_pass http://finance_tracker;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /api/ {
            proxy_pass http://finance_tracker/api/;
            proxy_set_header Authorization \$http_authorization;
        }
    }

Then run app.py with:
    HOST=127.0.0.1 PORT=5000 python app.py

6. HTTPS/SSL SETUP
══════════════════

For HTTPS (required for mobile app):

    1. Generate SSL certificate:
       openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

    2. Run with SSL (using Gunicorn):
       gunicorn -w 4 --certfile=cert.pem --keyfile=key.pem \\
                --bind 0.0.0.0:443 app:app

    3. Update HTML API_BASE_URL:
       const API_BASE_URL = 'https://your-server:443/api';

7. MOBILE APP SETUP
═══════════════════

For the mobile app (React Native):

    Update api.js with production server:
    const API_BASE_URL = 'http://192.168.1.100:5000/api';
    (or your server IP/domain)

    Build APK:
    expo build:android
    
    Then distribute APK to users

8. MONITORING & LOGGING
═══════════════════════

Monitor the server:
    - Tail logs: tail -f app.log
    - Check MongoDB: mongosh finance_tracker
    - Monitor requests: netstat -an | grep 5000

Enable detailed logging:
    LOG_LEVEL=DEBUG python app.py

9. BACKUP & MAINTENANCE
═══════════════════════

Daily backup of MongoDB:
    mongodump --db finance_tracker --archive > backup_$(date +%Y%m%d).archive

Restore from backup:
    mongorestore --archive < backup_20240115.archive

10. SECURITY CHECKLIST
════════════════════

✓ Change JWT_SECRET in production
✓ Use strong MongoDB password
✓ Enable HTTPS/SSL
✓ Configure firewall rules
✓ Set DEBUG=False
✓ Use reverse proxy (NGINX/Apache)
✓ Regular backups
✓ Monitor server resources
✓ Update dependencies regularly
✓ Use environment variables for secrets

════════════════════════════════════════════════════════════════════════════════

Example .env for different scenarios:

# Development (localhost)
MONGO_URI=mongodb://127.0.0.1:27017/finance_tracker
HOST=127.0.0.1
PORT=5000
DEBUG=True
JWT_SECRET=dev-secret

# Office/Home Network
MONGO_URI=mongodb://192.168.1.50:27017/finance_tracker
HOST=0.0.0.0
PORT=5000
DEBUG=False
JWT_SECRET=office-secret

# Cloud Production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/finance_tracker
HOST=0.0.0.0
PORT=5000
DEBUG=False
JWT_SECRET=prod-super-secret-key

════════════════════════════════════════════════════════════════════════════════
"""

def print_config():
    """Print current configuration"""
    print(SETUP_INSTRUCTIONS)
    print("\n📋 Current Configuration:")
    print("─" * 80)
    for key, value in PRODUCTION_CONFIG.items():
        print(f"  {key:20} = {value}")
    print("─" * 80)

def validate_config():
    """Validate configuration"""
    errors = []
    warnings = []

    if PRODUCTION_CONFIG["JWT_SECRET"] == "change-this-secret-in-production":
        errors.append("⚠️  JWT_SECRET is not set! Use environment variable JWT_SECRET=...")

    if PRODUCTION_CONFIG["DEBUG"]:
        warnings.append("⚠️  DEBUG mode is enabled. Disable for production!")

    if PRODUCTION_CONFIG["HOST"] == "0.0.0.0":
        warnings.append("ℹ️  Listening on all interfaces (0.0.0.0)")

    return errors, warnings

def main():
    """Main function"""
    print("\n🚀 Finance Tracker - Production Configuration\n")
    
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        print_config()
        errors, warnings = validate_config()
        
        if errors:
            print("\n❌ Errors:")
            for error in errors:
                print(f"   {error}")
        
        if warnings:
            print("\n⚠️  Warnings:")
            for warning in warnings:
                print(f"   {warning}")
        
        return 1 if errors else 0
    
    print_config()
    errors, warnings = validate_config()
    
    if errors:
        print("\n❌ Configuration Errors:")
        for error in errors:
            print(f"   {error}")
        return 1
    
    print("\n✅ Configuration looks good!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
