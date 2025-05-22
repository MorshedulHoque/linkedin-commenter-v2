#!/bin/bash

# Update system packages
sudo apt update
sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv nginx nodejs npm

# Create project directory
sudo mkdir -p /var/www/linkedin-commenter
sudo chown -R $USER:$USER /var/www/linkedin-commenter

# Copy project files
cp -r * /var/www/linkedin-commenter/

# Set up Python virtual environment
cd /var/www/linkedin-commenter
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

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
WorkingDirectory=/var/www/linkedin-commenter
Environment="PATH=/var/www/linkedin-commenter/venv/bin"
ExecStart=/var/www/linkedin-commenter/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/linkedin-commenter << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your actual domain

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /static {
        alias /var/www/linkedin-commenter/static;
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
sudo certbot --nginx -d your-domain.com  # Replace with your actual domain 