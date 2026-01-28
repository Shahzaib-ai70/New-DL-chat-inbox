# 🚀 Deployment Guide for dlchats.site

**Goal:** Deploy "New-DL-chat-inbox" on your VPS separately from your existing project.
**Method:** Run on a separate port (3002) and use the domain `dlchats.site`.

---

## 🛑 Step 1: Safety Check (Run on VPS)

Before doing anything, let's ensure Port 3002 is free so we don't conflict with your "Old Project".
SSH into your VPS (`ssh root@72.60.236.77`) and run:

```bash
# Check if Port 3002 is free (it should be empty)
lsof -i :3002
```
*   If it returns nothing: **Great! Proceed.**
*   If it shows a process: **STOP.** You need to change the port in `ecosystem.config.cjs` before deploying.

---

## 📦 Step 2: Install & Setup (Run on VPS)

We will put this project in a **new folder** (`/var/www/dlchats`) to keep it completely separate.

### ⚠️ Prerequisite: Install Chrome Dependencies
This app uses Puppeteer (Chrome). You **MUST** run this once if you haven't before:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libasound2 \
libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 \
libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
lsb-release wget xdg-utils
```

### 1. Create Directory & Clone
```bash
# Create new directory
mkdir -p /var/www/dlchats
cd /var/www/dlchats

# Clone the repository (use dot . to clone into current dir)
# If directory is not empty, use git pull
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/Shahzaib-ai70/New-DL-chat-inbox.git .
fi
```

### 2. Run Deployment Script
I have updated `deploy.sh` to handle everything (install, build, permissions, persistence).

```bash
chmod +x deploy.sh
./deploy.sh
```

*This will start the server on Port 3002 with the name `dlchats-server`.*

### 3. Save PM2 State
To ensure it starts after reboot:
```bash
pm2 save
pm2 startup
```

---

## 🌐 Step 3: Connect Domain (app.dlchats.site)

**IMPORTANT:** You configured the subdomain `app`, so your site will be at `http://app.dlchats.site`.

1.  **Create/Edit Config:**
    ```bash
    nano /etc/nginx/sites-available/dlchats.site
    ```

2.  **Paste Content (Updated for 'app' subdomain):**
    ```nginx
    server {
        server_name app.dlchats.site;

        location / {
            proxy_pass http://localhost:3002;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
        
        # Increase upload size
        client_max_body_size 50M;
    }
    ```

3.  **Enable & Restart:**
    ```bash
    # If not already linked
    ln -s /etc/nginx/sites-available/dlchats.site /etc/nginx/sites-enabled/
    
    # Check and restart
    nginx -t
    systemctl restart nginx
    ```

---

## 🛠️ Troubleshooting

If your site is still not working, run this diagnostic tool on your VPS:

```bash
cd /var/www/dlchats
chmod +x check-status.sh
./check-status.sh
```

**Common Fixes:**
1.  **App not running?** Run `./deploy.sh` again.
2.  **Nginx failed?** Check `nginx -t` for errors.
3.  **Port 3002 blocked?** Nginx bypasses external firewalls, so Step 3 is the fix.
