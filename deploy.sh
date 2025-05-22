#!/bin/bash

# Update system packages
sudo apt update
sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv nginx nodejs npm git

# Create project directory
sudo mkdir -p /var/www/linkedin-commenter
sudo chown -R $USER:$USER /var/www/linkedin-commenter

# Clone the repository
cd /var/www
git clone https://github.com/MorshedulHoque/linkedin-commenter-v2.git
cd linkedin-commenter-v2

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-prod.txt

# Set up Node.js environment for the extension
cd extension
npm install
cd ..

# Create systemd service file
sudo tee /etc/systemd/system/linkedin-commenter.service << EOF
[Unit]
Description=LinkedIn Commenter Flask Application
After=network.target

[Service]
User=$USER
WorkingDirectory=/var/www/linkedin-commenter-v2
Environment="PATH=/var/www/linkedin-commenter-v2/venv/bin"
ExecStart=/var/www/linkedin-commenter-v2/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/linkedin-commenter << EOF
server {
    listen 80;
    server_name utsho.com;  # Your domain from Namecheap

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

# Enable the site
sudo ln -s /etc/nginx/sites-available/linkedin-commenter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart services
sudo systemctl restart nginx
sudo systemctl enable linkedin-commenter
sudo systemctl start linkedin-commenter

# Set up SSL with Certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d utsho.com  # Your domain from Namecheap 