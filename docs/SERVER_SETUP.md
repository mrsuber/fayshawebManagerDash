# FayshaaWeb Server Setup Documentation

## Server Information

- **IP Address**: 76.13.41.99
- **Operating System**: Ubuntu 24.04.4 LTS (Noble)
- **Kernel**: 6.8.0-100-generic
- **SSH Access**: `ssh root@76.13.41.99`

## Technology Stack

### Runtime & Framework
- **Node.js**: v20.20.0 (LTS)
- **npm**: v10.8.2
- **Express**: TBD
- **React**: TBD

### Database
- **PostgreSQL**: v16.11
  - Chosen for multi-application support on VPS
  - Efficient for large dataset queries
  - Easy to manage multiple applications

### Process Management
- **PM2**: v6.0.14
  - Supports Node.js multithreading/clustering
  - Process monitoring and auto-restart
  - Load balancing capabilities

### Web Server
- **nginx**: v1.24.0
  - Reverse proxy
  - Static file serving
  - SSL/TLS termination

## Installation Steps Completed

### 1. System Update
```bash
ssh root@76.13.41.99
apt update && apt upgrade -y
```

### 2. PostgreSQL Installation
```bash
apt install -y postgresql postgresql-contrib
systemctl status postgresql
```

**Database Configuration:**
```sql
CREATE DATABASE fayshaa;
CREATE USER fayshaauser WITH PASSWORD 'ChangeMeL8ter!';
GRANT ALL PRIVILEGES ON DATABASE fayshaa TO fayshaauser;
```

**Important**: Change the database password before production deployment!

### 3. Node.js Installation
```bash
# Install Node.js 20 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # v20.20.0
npm --version   # v10.8.2
```

### 4. PM2 Installation
```bash
npm install -g pm2

# Verify installation
pm2 --version  # 6.0.14
```

### 5. nginx Installation
```bash
apt install -y nginx

# Verify installation
nginx -v  # nginx/1.24.0
systemctl status nginx
```

### 6. Firewall Configuration (UFW)
```bash
# Configure firewall rules
ufw allow ssh      # Port 22
ufw allow http     # Port 80
ufw allow https    # Port 443
ufw enable

# Verify firewall status
ufw status
```

**Active Rules:**
- SSH (22/tcp) - ALLOW
- HTTP (80/tcp) - ALLOW
- HTTPS (443) - ALLOW

## Project Directory Structure

```
/var/www/fayshaa/
├── backend/     # Node.js/Express API server
└── frontend/    # React application
```

Created with:
```bash
mkdir -p /var/www/fayshaa/{backend,frontend}
```

## Database Credentials

**⚠️ SECURITY WARNING**: Update these credentials before production use!

- **Database Name**: fayshaa
- **Database User**: fayshaauser
- **Database Password**: ChangeMeL8ter!
- **Host**: localhost
- **Port**: 5432 (PostgreSQL default)

### Connection String Example
```
postgresql://fayshaauser:ChangeMeL8ter!@localhost:5432/fayshaa
```

## Services Status

All services are running and enabled on system startup:

```bash
# Check PostgreSQL
systemctl status postgresql

# Check nginx
systemctl status nginx

# Check PM2
pm2 status
```

## Next Steps

### Security Hardening
1. [ ] Update PostgreSQL database password
2. [ ] Configure PostgreSQL to listen on localhost only
3. [ ] Set up SSH key-based authentication
4. [ ] Disable root SSH login
5. [ ] Configure fail2ban for brute force protection
6. [ ] Set up automatic security updates

### Application Deployment
1. [ ] Deploy backend application to `/var/www/fayshaa/backend/`
2. [ ] Deploy frontend application to `/var/www/fayshaa/frontend/`
3. [ ] Configure PM2 ecosystem file for cluster mode
4. [ ] Set up PM2 startup script
5. [ ] Set up nginx gzip compression
6. [ ] Configure nginx caching

### SSL/TLS Configuration
1. [x] Install Certbot (Let's Encrypt)
2. [x] Obtain SSL certificates for fayshaa.com and www.fayshaa.com
3. [x] Configure nginx for HTTPS
4. [x] Set up automatic certificate renewal
5. [x] Configure HTTPS redirect

**Status**: SSL certificates installed and active. Certificate expires on 2026-05-23.
**Domain**: https://fayshaa.com

### Monitoring & Logging
1. [ ] Configure PM2 monitoring
2. [ ] Set up nginx access/error logs
3. [ ] Configure PostgreSQL logging
4. [ ] Set up log rotation
5. [ ] Configure system monitoring (optional: Prometheus/Grafana)

### Backup Strategy
1. [ ] Set up PostgreSQL automated backups
2. [ ] Configure application code backups
3. [ ] Set up backup retention policy
4. [ ] Test backup restoration procedures

## PM2 Cluster Mode Configuration

PM2 will be used to leverage Node.js multithreading capabilities. Example configuration:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'fayshaa-api',
    script: './backend/server.js',
    instances: 'max',  // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'fayshaa',
      DB_USER: 'fayshaauser',
      DB_PASSWORD: 'ChangeMeL8ter!'
    }
  }]
};
```

Start application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## nginx Reverse Proxy Configuration

Example nginx configuration for the application:

```nginx
# /etc/nginx/sites-available/fayshaa.com
# HTTPS configuration added automatically by Certbot
server {
    server_name fayshaa.com www.fayshaa.com;

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend React app
    location / {
        root /var/www/fayshaa/frontend/build;
        try_files $uri $uri/ /index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/fayshaa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fayshaa.com/privkey.pem;
}

server {
    # HTTP to HTTPS redirect
    listen 80;
    server_name fayshaa.com www.fayshaa.com;
    return 301 https://$server_name$request_uri;
}
```

**Status**: Already configured and enabled at `/etc/nginx/sites-enabled/fayshaa.com`

## Troubleshooting

### Check Service Logs
```bash
# PM2 logs
pm2 logs

# nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Common Issues

**PostgreSQL connection refused:**
```bash
# Check if PostgreSQL is running
systemctl status postgresql

# Check if PostgreSQL is listening
netstat -plnt | grep 5432
```

**nginx 502 Bad Gateway:**
```bash
# Check if backend application is running
pm2 status

# Check nginx error logs
tail -f /var/log/nginx/error.log
```

**PM2 app crashes:**
```bash
# Check PM2 logs
pm2 logs

# Restart application
pm2 restart all
```

## Maintenance Commands

```bash
# Restart all services
systemctl restart postgresql
systemctl restart nginx
pm2 restart all

# Check system resources
htop
df -h
free -h

# Update system packages
apt update && apt upgrade -y

# View active connections
ss -tuln
```

## Documentation Version

- **Created**: 2026-02-22
- **Last Updated**: 2026-02-22
- **Author**: System Administrator
- **Version**: 1.0

## Notes

- This server is configured to support multiple applications
- All applications will share the PostgreSQL instance
- Each application should have its own database and user
- PM2 cluster mode will utilize all available CPU cores for optimal performance
- nginx will handle SSL termination and serve as reverse proxy for all applications
