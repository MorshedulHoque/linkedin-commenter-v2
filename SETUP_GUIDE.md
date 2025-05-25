# LinkedIn Commenter V2 - Complete Setup Guide

## Table of Contents
1. [Initial Server Access](#1-initial-server-access)
2. [System Update and Package Installation](#2-system-update-and-package-installation)
3. [MySQL Setup](#3-mysql-setup)
4. [Project Setup](#4-project-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Service Configuration](#6-service-configuration)
7. [Nginx Configuration](#7-nginx-configuration)
8. [Enable Sites and SSL](#8-enable-sites-and-ssl)
9. [Start Services](#9-start-services)
10. [Verify Setup](#10-verify-setup)
11. [Test Endpoints](#11-test-endpoints)
12. [Maintenance Commands](#12-maintenance-commands)

## 1. Initial Server Access
```bash
# SSH into the server
ssh utsho@203.82.193.150

# Switch to root user
sudo su
```

## 2. System Update and Package Installation
```bash
# Update system packages
apt update
apt upgrade -y

# Install required packages
apt install -y python3-pip python3-venv nginx nodejs npm git mysql-server certbot python3-certbot-nginx
```

## 3. MySQL Setup
```bash
# Secure MySQL installation
mysql_secure_installation
# Follow prompts to:
# - Set root password
# - Remove anonymous users
# - Disallow root login remotely
# - Remove test database
# - Reload privilege tables

# Create database and user
mysql -u root -p
```

In MySQL prompt:
```sql
CREATE DATABASE linkedin_commenter;
CREATE USER 'linkedin_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON linkedin_commenter.* TO 'linkedin_user'@'localhost';
FLUSH PRIVILEGES;

# Create required tables
USE linkedin_commenter;

CREATE TABLE user (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255)
);

CREATE TABLE daily_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    request_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES user(Id),
    UNIQUE (user_id, date)
);

CREATE TABLE comments_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    post_text TEXT,
    generated_comment TEXT,
    emotion VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(Id)
);

EXIT;
```

## 4. Project Setup
```bash
# Create project directory
mkdir -p /var/www/linkedin-commenter-v2
cd /var/www

# Clone repository
git clone https://github.com/MorshedulHoque/linkedin-commenter-v2.git
cd linkedin-commenter-v2

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-prod.txt

# Set up Node.js environment
cd extension
npm install
cd ..
```

## 5. Environment Configuration
```bash
# Create .env file
nano .env
```

Add the following content:
```
MYSQL_HOST=localhost
MYSQL_USER=linkedin_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DB=linkedin_commenter
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=465
MAIL_USE_SSL=true
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
API_KEY=your_gemini_api_key
```

## 6. Service Configuration

### 6.1 Flask Service (Dashboard)
```bash
# Create systemd service file
nano /etc/systemd/system/dashboard.service
```

Add:
```ini
[Unit]
Description=LinkedIn Commenter Dashboard
After=network.target mysql.service

[Service]
User=root
WorkingDirectory=/var/www/linkedin-commenter-v2
Environment="PATH=/var/www/linkedin-commenter-v2/venv/bin"
ExecStart=/var/www/linkedin-commenter-v2/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

### 6.2 Node.js Service (API)
```bash
# Create systemd service file
nano /etc/systemd/system/api.service
```

Add:
```ini
[Unit]
Description=LinkedIn Commenter API
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/linkedin-commenter-v2/extension/scripts
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## 7. Nginx Configuration

### 7.1 Dashboard Configuration
```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/dashboard.linkedgage.com
```

Add:
```nginx
server {
    listen 80;
    server_name dashboard.linkedgage.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name dashboard.linkedgage.com;

    ssl_certificate /etc/letsencrypt/live/dashboard.linkedgage.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.linkedgage.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7.2 API Configuration
```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/api.linkedgage.com
```

Add:
```nginx
server {
    listen 80;
    server_name api.linkedgage.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.linkedgage.com;

    ssl_certificate /etc/letsencrypt/live/api.linkedgage.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.linkedgage.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 8. Enable Sites and SSL
```bash
# Enable Nginx sites
ln -s /etc/nginx/sites-available/dashboard.linkedgage.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api.linkedgage.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Obtain SSL certificates
certbot --nginx -d dashboard.linkedgage.com
certbot --nginx -d api.linkedgage.com

# Test SSL auto-renewal
certbot renew --dry-run
```

## 9. Start Services
```bash
# Enable and start services
systemctl enable dashboard
systemctl enable api
systemctl start dashboard
systemctl start api
systemctl restart nginx
```

## 10. Verify Setup
```bash
# Check service status
systemctl status dashboard
systemctl status api
systemctl status nginx

# Check logs if needed
journalctl -u dashboard -f
journalctl -u api -f
tail -f /var/log/nginx/error.log
```

## 11. Test Endpoints
```bash
# Test dashboard
curl https://dashboard.linkedgage.com

# Test API
curl https://api.linkedgage.com/health
```

## 12. Maintenance Commands
```bash
# Update application
cd /var/www/linkedin-commenter-v2
git pull
source venv/bin/activate
pip install -r requirements-prod.txt
systemctl restart dashboard
systemctl restart api

# Check SSL certificates
certbot certificates

# Backup database
mysqldump -u linkedin_user -p linkedin_commenter > backup_$(date +%Y%m%d).sql
```

## Important Notes
1. Replace `your_secure_password` with actual secure passwords
2. Replace `your_email@gmail.com` and `your_app_password` with actual Gmail credentials
3. Replace `your_gemini_api_key` with actual Gemini API key
4. Ensure DNS records are properly configured for both domains
5. Keep system updated regularly
6. Monitor logs for any issues
7. Regularly backup the database

## Troubleshooting

### Common Issues and Solutions

1. **Nginx 502 Bad Gateway**
   - Check if Flask application is running: `systemctl status dashboard`
   - Check application logs: `journalctl -u dashboard`
   - Verify port configuration in Nginx and application

2. **Database Connection Issues**
   - Verify MySQL service is running: `systemctl status mysql`
   - Check database credentials in .env file
   - Verify database user permissions
   - Check MySQL error logs: `tail -f /var/log/mysql/error.log`

3. **SSL Certificate Issues**
   - Verify domain DNS settings
   - Check certificate validity: `certbot certificates`
   - Ensure proper Nginx SSL configuration

4. **Application Not Starting**
   - Check environment variables
   - Verify MySQL connection
   - Check application logs: `journalctl -u dashboard`

## Security Considerations
1. Keep system updated regularly
2. Monitor application logs
3. Use strong passwords
4. Keep SSL certificates up to date
5. Regular security audits
6. Implement rate limiting
7. Use secure headers in Nginx
8. Regular database backups
9. Secure MySQL configuration

## Support
For any issues or questions:
1. Check application logs: `journalctl -u dashboard`
2. Review Nginx error logs: `tail -f /var/log/nginx/error.log`
3. Check MySQL logs: `tail -f /var/log/mysql/error.log`
4. Verify system resources
5. Check network connectivity
6. Verify DNS settings 