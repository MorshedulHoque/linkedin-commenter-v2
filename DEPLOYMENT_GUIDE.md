# LinkedIn Commenter Project Deployment Guide

This guide provides specific steps for deploying the LinkedIn Commenter application on a VPS server, based on our actual deployment.

## Prerequisites

1. VPS server with Ubuntu 22.04 LTS
2. Domain names:
   - Main domain: `linkedincommenter.com`
   - API subdomain: `api.linkedincommenter.com`
3. Root access to the server
4. Git repository access

## Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Required Software
```bash
# Install Python and required packages
sudo apt install -y python3-pip python3-venv nginx nodejs npm git

# Install MySQL Server
sudo apt install -y mysql-server

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 1.3 Configure Firewall
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## Step 2: Database Setup

### 2.1 Secure MySQL Installation
```bash
sudo mysql_secure_installation
```
Follow the prompts to:
- Set root password
- Remove anonymous users
- Disallow root login remotely
- Remove test database
- Reload privilege tables

### 2.2 Create Database and User
```bash
# Login to MySQL
sudo mysql -u root -p

# In MySQL prompt, run:
CREATE DATABASE linkedin_commenter;
CREATE USER 'linkedin_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON linkedin_commenter.* TO 'linkedin_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2.3 Create Required Tables
```bash
# Login to MySQL with the new user
mysql -u linkedin_user -p linkedin_commenter

# In MySQL prompt, run:
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

## Step 3: Application Deployment

### 3.1 Clone Repository
```bash
# Create application directory
sudo mkdir -p /var/www/linkedin-commenter-v2
sudo chown -R $USER:$USER /var/www/linkedin-commenter-v2

# Clone repository
cd /var/www
git clone https://github.com/MorshedulHoque/linkedin-commenter-v2.git
cd linkedin-commenter-v2
```

### 3.2 Set up Python Environment
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements-prod.txt
```

### 3.3 Set up Node.js Environment
```bash
# Install Node.js dependencies for the extension
cd extension
npm install
cd ..
```

### 3.4 Configure Environment Variables
```bash
# Create .env file
nano .env

# Add the following content:
MYSQL_HOST=localhost
MYSQL_USER=linkedin_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DB=linkedin_commenter
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=465
MAIL_USE_SSL=true
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
```

## Step 4: Service Configuration

### 4.1 Create Systemd Service
```bash
sudo tee /etc/systemd/system/linkedin-commenter.service << EOF
[Unit]
Description=LinkedIn Commenter Flask Application
After=network.target mysql.service

[Service]
User=$USER
WorkingDirectory=/var/www/linkedin-commenter-v2
Environment="PATH=/var/www/linkedin-commenter-v2/venv/bin"
ExecStart=/var/www/linkedin-commenter-v2/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

### 4.2 Enable and Start Service
```bash
sudo systemctl enable linkedin-commenter
sudo systemctl start linkedin-commenter
```

## Step 5: Nginx Configuration

### 5.1 Create Nginx Configuration
```bash
sudo tee /etc/nginx/sites-available/linkedin-commenter << EOF
server {
    listen 80;
    server_name linkedincommenter.com www.linkedincommenter.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-XSS-Protection "1; mode=block";
        add_header X-Content-Type-Options "nosniff";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    location /static {
        alias /var/www/linkedin-commenter-v2/static;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Deny access to .git directory
    location ~ /\.git {
        deny all;
    }
}
EOF
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/linkedin-commenter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 5.3 Test and Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: SSL Certificate Setup

### 6.1 Obtain SSL Certificates
```bash
sudo certbot --nginx -d linkedincommenter.com -d www.linkedincommenter.com
```

### 6.2 Verify SSL Auto-renewal
```bash
sudo certbot renew --dry-run
```

## Step 7: Final Checks

1. Verify application is accessible at `https://linkedincommenter.com`
2. Check SSL certificates are working properly
3. Test all application features
4. Monitor application logs for any errors
5. Verify database connection and tables

## Troubleshooting

### Common Issues and Solutions

1. **Nginx 502 Bad Gateway**
   - Check if Flask application is running: `sudo systemctl status linkedin-commenter`
   - Check application logs: `sudo journalctl -u linkedin-commenter`
   - Verify port configuration in Nginx and application

2. **Database Connection Issues**
   - Verify MySQL service is running: `sudo systemctl status mysql`
   - Check database credentials in .env file
   - Verify database user permissions
   - Check MySQL error logs: `sudo tail -f /var/log/mysql/error.log`

3. **SSL Certificate Issues**
   - Verify domain DNS settings
   - Check certificate validity: `sudo certbot certificates`
   - Ensure proper Nginx SSL configuration

4. **Application Not Starting**
   - Check environment variables
   - Verify MySQL connection
   - Check application logs: `sudo journalctl -u linkedin-commenter`

### Useful Commands

```bash
# View application logs
sudo journalctl -u linkedin-commenter -f

# View MySQL logs
sudo tail -f /var/log/mysql/error.log

# Restart application
sudo systemctl restart linkedin-commenter

# Restart MySQL
sudo systemctl restart mysql

# Restart Nginx
sudo systemctl restart nginx

# Check SSL certificate status
sudo certbot certificates
```

## Maintenance

### Regular Updates
1. Pull latest changes: `git pull`
2. Install dependencies: 
   ```bash
   source venv/bin/activate
   pip install -r requirements-prod.txt
   ```
3. Restart application: `sudo systemctl restart linkedin-commenter`

### Database Backup
```bash
# Create backup
mysqldump -u linkedin_user -p linkedin_commenter > backup_$(date +%Y%m%d).sql

# Restore from backup
mysql -u linkedin_user -p linkedin_commenter < backup_file.sql
```

### Backup
1. Database backup (as shown above)
2. Application files backup
3. SSL certificates backup
4. Nginx configuration backup

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

## Monitoring

1. Set up monitoring for:
   - Server resources (CPU, Memory, Disk)
   - Application uptime
   - Error rates
   - SSL certificate expiration
   - Database performance
   - MySQL service status

## Support

For any issues or questions:
1. Check application logs: `sudo journalctl -u linkedin-commenter`
2. Review Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Check MySQL logs: `sudo tail -f /var/log/mysql/error.log`
4. Verify system resources
5. Check network connectivity
6. Verify DNS settings 