# 🚀 Deployment Guide for dlchats.site

**Goal:** Deploy "New-DL-chat-inbox" on your VPS alongside your existing project, without breaking anything.
**Method:** Run on a separate port (3002) and use a Subdomain (e.g., `app.dlchats.site`).

## 🛑 Step 1: Safety Check (Run on VPS)

Before doing anything, let's see what's running on your VPS so we don't break it.
SSH into your VPS (`ssh root@72.60.236.77`) and run:

```bash
# Check if Port 3002 is free (it should be empty)
lsof -i :3002

# Check what web server you are using (Nginx or Apache)
netstat -tulpn | grep :80
```
*   If you see `nginx`, we will use the **Nginx Config** below.
*   If you see `apache2`, we will use the **Apache Config**.
*   If Port 3002 is busy, tell me, and we will change the port in `server.cjs`.

---

## 📦 Step 2: Install & Setup (Run on VPS)

We will put this project in a **new folder** so it never touches your old project.

1.  **Go to your home directory:**
    ```bash
    cd ~
    ```

2.  **Clone your GitHub Repo:**
    ```bash
    git clone https://github.com/Shahzaib-ai70/New-DL-chat-inbox.git whatsapp-dashboard
    cd whatsapp-dashboard
    ```

3.  **Install & Start:**
    ```bash
    # Install dependencies
    npm install

    # Build the frontend
    npm run build

    # Start with PM2 (Name: whatsapp-v2)
    pm2 start ecosystem.config.js
    ```

4.  **Save PM2 list** (so it restarts after reboot):
    ```bash
    pm2 save
    pm2 startup
    ```

✅ **Your app is now running internally on Port 3002.**

---

## 🌐 Step 3: Connect Domain (dlchats.site)

To access it without typing the port, we should use a **Subdomain** like `app.dlchats.site` or `bot.dlchats.site`.

**1. Create Subdomain (Hostinger Panel):**
*   Go to Hostinger DNS Zone.
*   Add an **A Record**:
    *   Name: `app` (or whatever you want)
    *   Target: `72.60.236.77`

**2. Configure Web Server (VPS):**

### 👉 If you use NGINX (Most likely):
Create a config file:
```bash
nano /etc/nginx/sites-available/whatsapp-dashboard
```
Paste this (Change `app.dlchats.site` to your actual subdomain):
```nginx
server {
    listen 80;
    server_name app.dlchats.site;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable it:
```bash
ln -s /etc/nginx/sites-available/whatsapp-dashboard /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 👉 If you use APACHE:
(Let me know if you use Apache, and I will give you the `.htaccess` or VirtualHost config).

---

## 🔄 Step 4: Automatic Updates (The "GitHub Always" part)

I have included a `deploy.sh` file. Whenever you push changes to GitHub, just do this on VPS:

```bash
cd ~/whatsapp-dashboard
./deploy.sh
```
*It will pull the new code, rebuild, and restart automatically.*
